#!/usr/bin/env node
// delete.mjs — 결정론 삭제: 역참조·크로스엣지·고아벡터 정리 + log
// 순수 변환 함수(stripRelated/stripGraphRows/resolveTarget)는 export(테스트 대상),
// 경로 의존 오케스트레이션만 main()에 둔다(lint.mjs 패턴).
import { existsSync, readFileSync, writeFileSync, unlinkSync, appendFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, pruneMissing } from './lib/db.mjs';
import { ROOT, MEMORY_DIR, DB_PATH, thoughtFiles } from './lib/scan.mjs';

// frontmatter related: 블록에서 id===targetId 항목만 라인 단위 제거.
// 전부 제거되면 `related: []`로 정규화. (yaml 재직렬화 금지 — 키 순서·포맷 보존)
const indentOf = (line) => line.match(/^(\s*)/)[1].length;
const isItemStart = (line) => /^\s*-\s/.test(line);

export function stripRelated(raw, targetId) {
  const lines = raw.split('\n');
  if (lines[0] !== '---') return { raw, removed: 0 };
  let fmEnd = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      fmEnd = i;
      break;
    }
  }
  if (fmEnd === -1) return { raw, removed: 0 };

  let relIdx = -1;
  for (let i = 1; i < fmEnd; i++) {
    if (/^\s*related:/.test(lines[i])) {
      relIdx = i;
      break;
    }
  }
  if (relIdx === -1) return { raw, removed: 0 };

  const relIndent = indentOf(lines[relIdx]);
  // related 블록 범위: relIdx+1 .. blockEnd(미포함) — 다음 top-level 키 전까지
  let blockEnd = fmEnd;
  for (let i = relIdx + 1; i < fmEnd; i++) {
    if (lines[i].trim() === '') continue;
    if (indentOf(lines[i]) <= relIndent) {
      blockEnd = i;
      break;
    }
  }

  let removed = 0;
  const keep = [];
  let i = relIdx + 1;
  while (i < blockEnd) {
    if (!isItemStart(lines[i])) {
      keep.push(lines[i]);
      i++;
      continue;
    }
    const item = [lines[i]];
    let j = i + 1;
    while (j < blockEnd && !isItemStart(lines[j])) {
      item.push(lines[j]);
      j++;
    }
    const idMatch = item.join('\n').match(/(?:^|\n)\s*-\s*id:\s*(\S+)/);
    if (idMatch && idMatch[1] === targetId) removed++;
    else keep.push(...item);
    i = j;
  }

  if (removed === 0) return { raw, removed: 0 };

  const pad = ' '.repeat(relIndent);
  const out =
    keep.length === 0
      ? [...lines.slice(0, relIdx), `${pad}related: []`, ...lines.slice(blockEnd)]
      : [...lines.slice(0, relIdx + 1), ...keep, ...lines.slice(blockEnd)];
  return { raw: out.join('\n'), removed };
}

// _graph.md 파이프 표에서 from/to에 targetId가 있는 행 제거. 헤더·구분선 보존.
// (scan.mjs graphEdges 의 셀 파싱 규칙과 일치)
export function stripGraphRows(raw, targetId) {
  const lines = raw.split('\n');
  let removed = 0;
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('|')) {
      const parts = t.split('|');
      if (parts[0].trim() === '') parts.shift();
      if (parts.length && parts[parts.length - 1].trim() === '') parts.pop();
      const cells = parts.map((c) => c.trim());
      const from = cells[0];
      const to = cells[1];
      const isData = from && from !== 'from_id' && !/^-+$/.test(from);
      if (isData && (from === targetId || to === targetId)) {
        removed++;
        continue;
      }
    }
    out.push(line);
  }
  return { raw: out.join('\n'), removed };
}

// arg가 id면 data.id 매칭 우선, 그 다음 경로 매칭. 미발견 시 null.
export function resolveTarget(files, arg) {
  for (const f of files) if (f.data && f.data.id === arg) return f;
  for (const f of files) if (f.path === arg) return f;
  return null;
}

// items.path 는 ROOT 상대 경로(index.mjs 와 동일 규약) — prune 판정도 동일하게.
const exists = (relPath) => existsSync(resolve(ROOT, relPath));

function parseArgs() {
  const args = process.argv.slice(2);
  return { target: args.find((a) => !a.startsWith('--')), json: args.includes('--json') };
}

function main() {
  const { target, json } = parseArgs();
  if (!target) {
    console.error('사용법: node delete.mjs <id|path> [--json]');
    process.exit(1);
  }
  const files = thoughtFiles();
  const hit = resolveTarget(files, target);
  if (!hit) {
    console.error(`대상 없음: ${target} (삭제하지 않음)`);
    process.exit(1);
  }
  const id = hit.data.id;

  // 2. 역참조 제거: 모든 Thought 파일 순회(대상 자신 제외) — 비대칭 역참조까지 포착
  let backrefsRemoved = 0;
  for (const f of files) {
    if (f.path === hit.path) continue;
    const { raw, removed } = stripRelated(readFileSync(f.path, 'utf8'), id);
    if (removed > 0) {
      writeFileSync(f.path, raw);
      backrefsRemoved += removed;
    }
  }

  // 3. 크로스 엣지 제거: memory/_graph.md
  let graphRowsRemoved = 0;
  const graphPath = join(MEMORY_DIR, '_graph.md');
  if (existsSync(graphPath)) {
    const { raw, removed } = stripGraphRows(readFileSync(graphPath, 'utf8'), id);
    if (removed > 0) {
      writeFileSync(graphPath, raw);
      graphRowsRemoved = removed;
    }
  }

  // 4. 대상 Thought 파일 삭제
  unlinkSync(hit.path);

  // 5. 고아 벡터 prune
  let pruned = 0;
  const db = openDb(DB_PATH);
  try {
    pruned = pruneMissing(db, exists);
  } finally {
    db.close();
  }

  // 6. log.md DELETE 기록
  appendFileSync(
    join(MEMORY_DIR, 'log.md'),
    `${new Date().toISOString().slice(0, 19)} | DELETE | ${id}\n`
  );

  // 7. 리포트
  const report = { id, backrefsRemoved, graphRowsRemoved, pruned };
  if (json) console.log(JSON.stringify(report));
  else
    console.log(
      `삭제: ${id} (역참조 ${backrefsRemoved}건, 크로스 ${graphRowsRemoved}건, prune ${pruned}건)`
    );
}

// 직접 실행 시에만 main() 구동(테스트 import 시 부작용 방지)
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }
}
