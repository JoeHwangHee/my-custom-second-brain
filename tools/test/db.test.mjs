// db.test.mjs — 합성 1024-dim 벡터로 db 로직 검증 (Ollama 불요)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, mkdtempSync } from 'node:fs';
import { openDb, upsertItem, search, pruneMissing, getEmbeddingById, existingHashes, updateItemMeta } from '../lib/db.mjs';
import { DIM } from '../lib/embed.mjs';

// 단위 기저 벡터 (정규화됨)
function unit(i) {
  const v = new Array(DIM).fill(0);
  v[i] = 1;
  return v;
}

function tmpDbPath() {
  const dir = mkdtempSync(join(tmpdir(), 'brain-test-'));
  return { dir, path: join(dir, 'brain.db') };
}

function mkItem(id, type = 'episodic') {
  return { id, path: `memory/${type}/${id}.md`, title: id, type, tags: ['t'], origin: 'first_party', date: '2026-06-07', hash: 'h' };
}

test('upsert + cosine KNN 순위', () => {
  const { dir, path } = tmpDbPath();
  const db = openDb(path);
  try {
    upsertItem(db, mkItem('a'), unit(0));
    upsertItem(db, mkItem('b'), unit(1));
    upsertItem(db, mkItem('c'), unit(2));

    // unit(0)에 가까운 쿼리 → a가 1위, score≈1
    const res = search(db, unit(0), 10);
    assert.equal(res[0].id, 'a');
    assert.ok(res[0].score > 0.99, `score=${res[0].score}`);
    assert.equal(res.length, 3);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('upsert 중복 id 갱신(중복행 없음)', () => {
  const { dir, path } = tmpDbPath();
  const db = openDb(path);
  try {
    upsertItem(db, mkItem('a'), unit(0));
    upsertItem(db, { ...mkItem('a'), title: 'a2' }, unit(5));
    const res = search(db, unit(5), 10);
    assert.equal(res.length, 1);
    assert.equal(res[0].title, 'a2');
    assert.ok(res[0].score > 0.99);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('getEmbeddingById', () => {
  const { dir, path } = tmpDbPath();
  const db = openDb(path);
  try {
    upsertItem(db, mkItem('a'), unit(0));
    const emb = getEmbeddingById(db, 'a');
    assert.ok(Array.isArray(emb) && emb.length === DIM); // 색인된 id → 임베딩 복원
    assert.equal(getEmbeddingById(db, 'zzz'), null); // 미존재 id → null
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('existingHashes: id→hash 맵 반환', () => {
  const { dir, path } = tmpDbPath();
  const db = openDb(path);
  try {
    upsertItem(db, { ...mkItem('a'), hash: 'h-a' }, unit(0));
    upsertItem(db, { ...mkItem('b'), hash: 'h-b' }, unit(1));
    const m = existingHashes(db);
    assert.equal(m.get('a'), 'h-a');
    assert.equal(m.get('b'), 'h-b');
    assert.equal(m.get('zzz'), undefined); // 미존재 id
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('updateItemMeta: 임베딩 불변, 메타만 갱신', () => {
  const { dir, path } = tmpDbPath();
  const db = openDb(path);
  try {
    upsertItem(db, { ...mkItem('a'), hash: 'h1', title: 't1' }, unit(0));
    const before = getEmbeddingById(db, 'a');
    updateItemMeta(db, { ...mkItem('a'), hash: 'h2', title: 't2' });
    // 메타 갱신됨
    assert.equal(existingHashes(db).get('a'), 'h2');
    assert.equal(search(db, unit(0), 10)[0].title, 't2');
    // 임베딩은 그대로(vec_items 미변경)
    assert.deepEqual(getEmbeddingById(db, 'a'), before);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('pruneMissing은 파일 부재 항목 제거', () => {
  const { dir, path } = tmpDbPath();
  const db = openDb(path);
  try {
    upsertItem(db, mkItem('a'), unit(0));
    upsertItem(db, mkItem('b'), unit(1));
    // a만 존재한다고 가정
    const removed = pruneMissing(db, (p) => p.endsWith('a.md'));
    assert.equal(removed, 1);
    const remaining = search(db, unit(0), 10); // 남은 전체
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, 'a'); // a 유지, b 제거
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
