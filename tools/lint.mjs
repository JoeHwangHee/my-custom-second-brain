#!/usr/bin/env node
// lint.mjs — 결정론 정비: 벡터동기화·entry_count·examples(centroid)·near-miss·깨진링크
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { embedText } from './lib/frontmatter.mjs';
import { embed } from './lib/embed.mjs';
import {
  openDb,
  upsertItem,
  pruneMissing,
  typeEmbeddings,
  allEmbeddings,
} from './lib/db.mjs';
import { ROOT, MEMORY_DIR, DB_PATH, TYPES, thoughtFiles, graphEdges } from './lib/scan.mjs';

const has = (f) => process.argv.includes(f);
function arg(f, d) {
  const i = process.argv.indexOf(f);
  return i >= 0 ? process.argv[i + 1] : d;
}

const exists = (relPath) => existsSync(resolve(ROOT, relPath));
const dot = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

async function syncVectors(db) {
  let indexed = 0;
  for (const f of thoughtFiles()) {
    const text = embedText(f.data, f.body);
    const hash = createHash('sha256').update(text).digest('hex').slice(0, 16);
    upsertItem(
      db,
      {
        id: f.data.id,
        path: relative(ROOT, f.path),
        title: f.data.title ? String(f.data.title) : '',
        type: String(f.data.category_path || '').split('/')[0] || '',
        tags: f.data.tags || [],
        origin: f.data.origin || '',
        date: f.data.date ? String(f.data.date) : '',
        hash,
      },
      await embed(text)
    );
    indexed++;
  }
  const pruned = pruneMissing(db, exists);
  return { indexed, pruned };
}

function centroidExamples(db, type, n = 3) {
  const items = typeEmbeddings(db, type);
  if (!items.length) return [];
  const dim = items[0].emb.length;
  const c = new Array(dim).fill(0);
  for (const it of items) for (let i = 0; i < dim; i++) c[i] += it.emb[i];
  for (let i = 0; i < dim; i++) c[i] /= items.length;
  return items
    .map((it) => ({ title: it.title, s: dot(it.emb, c) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.title)
    .filter(Boolean);
}

// flat 구조: 인지유형별 _index.md 대신 memory/index.md 통계 섹션(마커)을 갱신
function updateStatsSection(stats) {
  const path = join(MEMORY_DIR, 'index.md');
  if (!existsSync(path)) return false;
  const raw = readFileSync(path, 'utf8');
  const rows = stats
    .map((s) => `| ${s.type} | ${s.count} | ${s.examples.join('; ') || '-'} |`)
    .join('\n');
  const table = `| 인지유형 | entry_count | examples |\n|---|---|---|\n${rows}`;
  const replaced = raw.replace(
    /<!-- lint:stats:start -->[\s\S]*?<!-- lint:stats:end -->/,
    `<!-- lint:stats:start -->\n${table}\n<!-- lint:stats:end -->`
  );
  writeFileSync(path, replaced);
  return true;
}

function nearMissCandidates(db, threshold, relatedPairs) {
  const all = allEmbeddings(db);
  const out = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const s = dot(all[i].emb, all[j].emb);
      if (s >= threshold) {
        const key = [all[i].id, all[j].id].sort().join('::');
        if (!relatedPairs.has(key)) out.push({ a: all[i].id, b: all[j].id, sim: Number(s.toFixed(3)) });
      }
    }
  }
  return out.sort((x, y) => y.sim - x.sim);
}

export function consistencyReport(files, edges = []) {
  const ids = new Set(files.map((f) => f.data.id));
  const broken = [];
  const reflectiveNoRel = [];
  const relatedPairs = new Set();
  const referenced = new Set();
  for (const f of files) {
    const rel = Array.isArray(f.data.related) ? f.data.related : [];
    const type = String(f.data.category_path || '').split('/')[0];
    if (type === 'reflective' && rel.length === 0) reflectiveNoRel.push(f.data.id);
    for (const r of rel) {
      if (!r || !r.id) continue;
      relatedPairs.add([f.data.id, r.id].sort().join('::'));
      referenced.add(r.id);
      if (!ids.has(r.id)) broken.push({ from: f.data.id, to: r.id });
    }
  }
  // 크로스(L1 간) 엣지: _graph.md에만 기록되므로 frontmatter와 별도로 반영해야
  // 오판정(false-positive orphan)·미탐지(끊긴 엣지)를 막는다.
  const graphBroken = [];
  for (const e of edges) {
    if (!e || !e.from || !e.to) continue;
    relatedPairs.add([e.from, e.to].sort().join('::'));
    referenced.add(e.to);
    if (!ids.has(e.from) || !ids.has(e.to)) graphBroken.push({ from: e.from, to: e.to });
  }
  const orphans = [...ids].filter((id) => !referenced.has(id));
  return { broken, reflectiveNoRel, orphans, relatedPairs, graphBroken };
}

async function main() {
  const apply = has('--apply');
  const threshold = parseFloat(arg('--near-miss-threshold', '0.92'));
  const db = openDb(DB_PATH);
  try {
    // 1) 벡터 동기화 (Ollama 필요; 실패 시 기존 db로 계속)
    try {
      const { indexed, pruned } = await syncVectors(db);
      console.log(`[sync] indexed ${indexed}, pruned ${pruned}`);
    } catch (e) {
      console.warn(`[sync] 건너뜀: ${e.message.split('\n')[0]}`);
    }

    const files = thoughtFiles();

    // 2) entry_count + examples(centroid) → memory/index.md 통계 섹션 (apply 시 기록)
    const stats = [];
    for (const type of TYPES) {
      const count = files.filter((f) => String(f.data.category_path || '').split('/')[0] === type).length;
      const examples = apply ? centroidExamples(db, type) : [];
      stats.push({ type, count, examples });
      console.log(`[${apply ? 'index' : 'check'}] ${type}: entry_count=${count}`);
    }
    if (apply) updateStatsSection(stats);

    // 3) 정합성 리포트 (자동수정 금지 — 사용자 확인용)
    const { broken, reflectiveNoRel, orphans, relatedPairs, graphBroken } = consistencyReport(files, graphEdges());
    if (broken.length) console.log(`[broken-link] ${broken.map((b) => `${b.from}→${b.to}`).join(', ')}`);
    if (graphBroken.length) console.log(`[graph-broken-edge] ${graphBroken.map((b) => `${b.from}→${b.to}`).join(', ')}`);
    if (reflectiveNoRel.length) console.log(`[reflective-no-related] ${reflectiveNoRel.join(', ')}`);
    if (orphans.length) console.log(`[orphan] ${orphans.join(', ')}`);

    // 4) near-miss 후보 (고유사·미연결 쌍 — 자동병합 금지)
    const nm = nearMissCandidates(db, threshold, relatedPairs);
    if (nm.length) console.log(`[near-miss 후보] ${nm.map((p) => `${p.a}~${p.b}(${p.sim})`).join(', ')}`);

    if (!broken.length && !graphBroken.length && !reflectiveNoRel.length && !nm.length) console.log('[ok] 정합성 이상 없음');
  } finally {
    db.close();
  }
}

// 직접 실행 시에만 main() 구동(테스트가 consistencyReport를 import할 때 부작용 방지)
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => {
    console.error(String(e.message || e));
    process.exit(1);
  });
}
