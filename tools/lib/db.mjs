// db.mjs — sqlite-vec 벡터DB (메타 테이블 + vec0 가상테이블)
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DIM } from './embed.mjs';

export function openDb(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  sqliteVec.load(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      rowid  INTEGER PRIMARY KEY,
      id     TEXT UNIQUE,
      path   TEXT,
      title  TEXT,
      type   TEXT,
      tags   TEXT,
      origin TEXT,
      date   TEXT,
      hash   TEXT
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_items USING vec0(
      embedding float[${DIM}] distance_metric=cosine
    );
  `);
  return db;
}

const toVec = (embedding) => JSON.stringify(embedding);

// id 기준 upsert. (rowid를 items.id↔vec_items 동기 유지)
export function upsertItem(db, item, embedding) {
  const tags = Array.isArray(item.tags) ? item.tags.join(',') : item.tags || '';
  const existing = db.prepare('SELECT rowid FROM items WHERE id = ?').get(item.id);
  const tx = db.transaction(() => {
    let rowid;
    if (existing) {
      rowid = existing.rowid;
      db.prepare(
        'UPDATE items SET path=?,title=?,type=?,tags=?,origin=?,date=?,hash=? WHERE rowid=?'
      ).run(item.path, item.title, item.type, tags, item.origin, item.date, item.hash, rowid);
      db.prepare('DELETE FROM vec_items WHERE rowid=?').run(BigInt(rowid));
    } else {
      const info = db
        .prepare('INSERT INTO items(id,path,title,type,tags,origin,date,hash) VALUES (?,?,?,?,?,?,?,?)')
        .run(item.id, item.path, item.title, item.type, tags, item.origin, item.date, item.hash);
      rowid = Number(info.lastInsertRowid);
    }
    // vec0 가상테이블은 rowid를 BigInt(정수)로만 받는다.
    db.prepare('INSERT INTO vec_items(rowid, embedding) VALUES (?, ?)').run(BigInt(rowid), toVec(embedding));
    return rowid;
  });
  return tx();
}

export function deleteById(db, id) {
  const row = db.prepare('SELECT rowid FROM items WHERE id = ?').get(id);
  if (!row) return false;
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM items WHERE rowid=?').run(row.rowid);
    db.prepare('DELETE FROM vec_items WHERE rowid=?').run(BigInt(row.rowid));
  });
  tx();
  return true;
}

// KNN 검색: embedding으로 상위 k개. score = 1 - cosine_distance.
export function search(db, embedding, k = 40) {
  const rows = db
    .prepare(
      `SELECT rowid, distance FROM vec_items
       WHERE embedding MATCH ? ORDER BY distance LIMIT ?`
    )
    .all(toVec(embedding), k);
  const getItem = db.prepare('SELECT id,path,title,type,tags,origin,date FROM items WHERE rowid=?');
  return rows.map((r) => {
    const it = getItem.get(r.rowid);
    return {
      ...it,
      tags: it && it.tags ? it.tags.split(',').filter(Boolean) : [],
      score: 1 - r.distance,
    };
  });
}

// 파일이 사라진 항목 제거(고아 벡터)
export function pruneMissing(db, exists) {
  const all = db.prepare('SELECT rowid, path FROM items').all();
  const delI = db.prepare('DELETE FROM items WHERE rowid=?');
  const delV = db.prepare('DELETE FROM vec_items WHERE rowid=?');
  let n = 0;
  const tx = db.transaction(() => {
    for (const r of all) {
      if (!exists(r.path)) {
        delI.run(r.rowid);
        delV.run(BigInt(r.rowid));
        n++;
      }
    }
  });
  tx();
  return n;
}

// 특정 인지유형의 모든 (id, path, title, embedding)
export function typeEmbeddings(db, type) {
  const rows = db
    .prepare(
      `SELECT i.id, i.path, i.title, vec_to_json(v.embedding) AS emb
       FROM items i JOIN vec_items v ON v.rowid=i.rowid WHERE i.type=?`
    )
    .all(type);
  return rows.map((r) => ({ id: r.id, path: r.path, title: r.title, emb: JSON.parse(r.emb) }));
}

// 전체 (id, type, embedding) — near-miss 후보 탐지용
export function allEmbeddings(db) {
  const rows = db
    .prepare(
      `SELECT i.id, i.type, i.path, vec_to_json(v.embedding) AS emb
       FROM items i JOIN vec_items v ON v.rowid=i.rowid`
    )
    .all();
  return rows.map((r) => ({ id: r.id, type: r.type, path: r.path, emb: JSON.parse(r.emb) }));
}

export function getEmbeddingById(db, id) {
  const row = db
    .prepare(
      `SELECT vec_to_json(v.embedding) AS emb
       FROM items i JOIN vec_items v ON v.rowid=i.rowid WHERE i.id=?`
    )
    .get(id);
  return row ? JSON.parse(row.emb) : null;
}

export function listItems(db) {
  return db.prepare('SELECT id, path, type FROM items').all();
}
