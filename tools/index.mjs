#!/usr/bin/env node
// index.mjs — 인덱서: markdown → bge-m3 임베딩 → 벡터DB upsert
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFile } from './lib/frontmatter.mjs';
import { embed } from './lib/embed.mjs';
import { openDb, upsertItem, pruneMissing } from './lib/db.mjs';
import { ROOT, DB_PATH, thoughtFiles } from './lib/scan.mjs';
import { buildItem } from './lib/item.mjs';

const exists = (relPath) => existsSync(resolve(ROOT, relPath));

async function indexAll(db) {
  let n = 0;
  for (const f of thoughtFiles()) {
    const { item, text } = buildItem(f.path, f.data, f.body);
    upsertItem(db, item, await embed(text));
    n++;
  }
  const pruned = pruneMissing(db, exists);
  return { indexed: n, pruned };
}

async function indexFile(db, p) {
  const abs = resolve(process.cwd(), p);
  if (!existsSync(abs)) throw new Error(`파일 없음: ${p}`);
  const { data, body } = parseFile(abs);
  if (!data || !data.id) throw new Error(`frontmatter id 없음: ${p}`);
  const { item, text } = buildItem(abs, data, body);
  upsertItem(db, item, await embed(text));
  return item.id;
}

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}
const has = (flag) => process.argv.includes(flag);

async function main() {
  const db = openDb(DB_PATH);
  try {
    if (has('--prune') && !has('--all') && !has('--file')) {
      const n = pruneMissing(db, exists);
      console.log(`prune: 고아 ${n}건 제거`);
      return;
    }
    const file = arg('--file');
    if (file) {
      const id = await indexFile(db, file);
      console.log(`indexed: ${id}`);
      return;
    }
    // 기본/--all: 전체 재색인
    const { indexed, pruned } = await indexAll(db);
    console.log(`indexed: ${indexed}건, pruned: ${pruned}건`);
  } finally {
    db.close();
  }
}

main().catch((e) => {
  console.error(String(e.message || e));
  process.exit(1);
});
