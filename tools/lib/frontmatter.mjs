// frontmatter.mjs — YAML frontmatter 파싱 + 임베딩 텍스트 추출
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

// raw 문자열에서 선행 `---` frontmatter 블록과 본문을 분리한다.
export function splitFrontmatter(raw) {
  if (!raw.startsWith('---')) return { data: {}, body: raw };
  // 닫는 구분선: 줄 시작의 `---`
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: raw };
  let data = {};
  try {
    data = parse(m[1]) || {};
  } catch {
    data = {};
  }
  const body = raw.slice(m[0].length);
  return { data, body };
}

export function parseFile(path) {
  const raw = readFileSync(path, 'utf8');
  const { data, body } = splitFrontmatter(raw);
  return { data, body, raw };
}

// 임베딩 대상 텍스트 = title + 본문 (frontmatter 제외)
export function embedText(data, body) {
  const title = data && data.title ? String(data.title).trim() : '';
  const b = (body || '').trim();
  return title ? `${title}\n\n${b}` : b;
}
