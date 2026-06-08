// scan.mjs — 저장소 경로 상수 + Thought 파일 스캔(flat 인지유형 트리)
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { parseFile } from './frontmatter.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MEMORY_DIR = join(ROOT, 'memory');
export const DB_PATH = join(ROOT, 'tools', '.index', 'brain.db');

// 인지유형 5종 (= L1 = category_path 라벨). category_schema 약어 레지스트리와 동기.
// flat 구조: 인지유형은 폴더가 아니라 frontmatter category_path로만 식별한다.
export const TYPES = ['episodic', 'semantic', 'procedural', 'reflective', 'thesis'];

// memory/ 직속의 frontmatter.id 가 있는 Thought 파일만 반환 (flat)
export function thoughtFiles() {
  const out = [];
  for (const name of readdirSync(MEMORY_DIR)) {
    // _graph.md·index.md·log.md 등 인덱스/로그 제외, Thought(.md, id 보유)만
    if (!name.endsWith('.md') || name.startsWith('_') || name === 'index.md' || name === 'log.md') continue;
    const path = join(MEMORY_DIR, name);
    const { data, body } = parseFile(path);
    if (!data || !data.id) continue;
    out.push({ path, data, body });
  }
  return out;
}

// memory/_graph.md 의 파이프 테이블에서 크로스(L1 간) 엣지 행 파싱.
// 헤더/구분선/플레이스홀더(from_id) 행은 건너뛴다.
export function graphEdges(path = join(MEMORY_DIR, '_graph.md')) {
  if (!existsSync(path)) return [];
  const out = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 4) continue;
    const [from, to, edge_type, link_strength] = cells;
    if (from === 'from_id' || /^-+$/.test(from) || !from || !to) continue;
    out.push({ from, to, edge_type, link_strength });
  }
  return out;
}
