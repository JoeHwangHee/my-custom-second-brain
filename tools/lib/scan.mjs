// scan.mjs — 저장소 경로 상수 + Thought 파일 스캔(flat 인지유형 트리)
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { readdirSync, existsSync } from 'node:fs';
import { parseFile } from './frontmatter.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MEMORY_DIR = join(ROOT, 'memory');
export const DB_PATH = join(ROOT, 'tools', '.index', 'brain.db');

// 인지유형 5종 (= L1 = 폴더). category_schema 약어 레지스트리와 동기.
export const TYPES = ['episodic', 'semantic', 'procedural', 'reflective', 'thesis'];

// memory/{type}/*.md 중 frontmatter.id 가 있는 Thought 파일만 반환
export function thoughtFiles() {
  const out = [];
  for (const t of TYPES) {
    const dir = join(MEMORY_DIR, t);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.md') || name.startsWith('_')) continue;
      const path = join(dir, name);
      const { data, body } = parseFile(path);
      if (!data || !data.id) continue;
      out.push({ path, data, body });
    }
  }
  return out;
}
