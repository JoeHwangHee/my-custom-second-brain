#!/usr/bin/env node
// query.mjs — 시맨틱 검색: 쿼리 임베딩 → KNN(cosine) → 메타필터 → topk
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { embed } from './lib/embed.mjs';
import { openDb, search, getEmbeddingById } from './lib/db.mjs';
import { parseFile } from './lib/frontmatter.mjs';
import { ROOT, DB_PATH } from './lib/scan.mjs';

function parseArgs(argv) {
  const a = { _: [], topk: 8, json: false, excludeNearMiss: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--type') a.type = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (t === '--tag') a.tag = argv[++i];
    else if (t === '--topk') a.topk = parseInt(argv[++i], 10) || 8;
    else if (t === '--related') a.related = argv[++i];
    else if (t === '--exclude-near-miss') a.excludeNearMiss = true;
    else if (t === '--json') a.json = true;
    else a._.push(t);
  }
  return a;
}

function snippet(relPath) {
  try {
    const { body } = parseFile(resolve(ROOT, relPath));
    return body.trim().replace(/\s+/g, ' ').slice(0, 120);
  } catch {
    return '';
  }
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const db = openDb(DB_PATH);
  try {
    let qEmb;
    let selfId = null;
    if (a.related) {
      // 관계 후보 모드: 파일경로 또는 id
      const asPath = resolve(process.cwd(), a.related);
      if (existsSync(asPath)) {
        const { data, body } = parseFile(asPath);
        selfId = data && data.id;
        qEmb = selfId ? getEmbeddingById(db, selfId) : null;
        if (!qEmb) {
          const { embedText } = await import('./lib/frontmatter.mjs');
          qEmb = await embed(embedText(data, body));
        }
      } else {
        selfId = a.related;
        qEmb = getEmbeddingById(db, a.related);
        if (!qEmb) throw new Error(`인덱스에 없는 id: ${a.related}`);
      }
    } else {
      const q = a._.join(' ').trim();
      if (!q) throw new Error('사용법: query.mjs "<쿼리>" [--type ep,rf] [--tag 운동] [--topk N] [--related <file|id>] [--json]');
      qEmb = await embed(q);
    }

    let rows = search(db, qEmb, Math.max(a.topk * 5, 20));
    if (a.type) rows = rows.filter((r) => a.type.includes(r.type) || a.type.includes(shortOf(r.type)));
    if (a.tag) rows = rows.filter((r) => r.tags.includes(a.tag));
    if (selfId) rows = rows.filter((r) => r.id !== selfId);
    rows = rows.slice(0, a.topk);

    const out = rows.map((r) => ({
      id: r.id,
      path: r.path,
      title: r.title,
      type: r.type,
      score: Number(r.score.toFixed(4)),
      snippet: snippet(r.path),
    }));

    if (a.json) console.log(JSON.stringify(out, null, 2));
    else {
      for (const r of out) console.log(`${r.score.toFixed(3)}  [${r.type}] ${r.id}  ${r.title}\n        ${r.snippet}`);
      if (!out.length) console.log('(결과 없음)');
    }
  } finally {
    db.close();
  }
}

// 인지유형 약어 ↔ 풀네임 (필터 편의)
const SHORT = { episodic: 'ep', semantic: 'se', procedural: 'pr', reflective: 'rf', thesis: 'th' };
function shortOf(type) {
  return SHORT[type] || type;
}

main().catch((e) => {
  console.error(String(e.message || e));
  process.exit(1);
});
