// item.mjs — markdown(frontmatter+body) → 벡터DB item 레코드 빌더 (index/lint 공용)
import { createHash } from 'node:crypto';
import { relative } from 'node:path';
import { embedText } from './frontmatter.mjs';
import { ROOT, typeOf } from './scan.mjs';

// item 레코드(id/path/title/type/tags/origin/date/hash) + 임베딩 대상 text를 만든다.
// 임베딩 자체는 비용이 크므로 호출부에서 `await embed(text)`로 수행한다.
export function buildItem(absPath, data, body) {
  const text = embedText(data, body);
  const hash = createHash('sha256').update(text).digest('hex').slice(0, 16);
  const item = {
    id: data.id,
    path: relative(ROOT, absPath),
    title: data.title ? String(data.title) : '',
    type: typeOf(data),
    tags: data.tags || [],
    origin: data.origin || '',
    date: data.date ? String(data.date) : '',
    hash,
  };
  return { item, text };
}
