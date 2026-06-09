// delete.test.mjs — 결정론 삭제 순수 함수 검증 (Ollama·DB 불요)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { stripRelated, stripGraphRows, resolveTarget } from '../delete.mjs';

// --- 픽스처 ---------------------------------------------------------------

function thought(id, related) {
  const rel =
    related && related.length
      ? 'related:\n' +
        related
          .map(
            (r) =>
              `  - id: ${r}\n    edge_type: references\n    link_strength: 0.6\n    co_occurrence_count: 0`
          )
          .join('\n') +
        '\n'
      : 'related: []\n';
  return `---\nid: ${id}\ntitle: ${id} 제목\norigin: first_party\n${rel}category_path: episodic\ndate: 2026-01-01\n---\n${id} 본문\n`;
}

const GRAPH = `# _graph.md\n\n| from_id | to_id | edge_type | link_strength |\n|---|---|---|---|\n| ep-1 | th-1 | supports | 0.6 |\n| rf-1 | ep-2 | synthesized | 0.7 |\n`;

// --- stripRelated ---------------------------------------------------------

test('stripRelated: 매칭 항목만 제거하고 타 항목·다른 frontmatter 키는 보존', () => {
  const raw = thought('ep-1', ['th-1', 'se-2']);
  const { raw: out, removed } = stripRelated(raw, 'th-1');
  assert.equal(removed, 1);
  assert.ok(!out.includes('id: th-1'), 'th-1 항목 제거됨');
  assert.ok(out.includes('id: se-2'), 'se-2 항목 보존됨');
  assert.ok(out.includes('category_path: episodic'), 'related 이후 키 보존됨');
  assert.ok(out.includes('id: ep-1'), '본 파일 id 보존됨');
});

test('stripRelated: 항목이 전부 제거되면 related: [] 로 정규화', () => {
  const raw = thought('ep-1', ['th-1']);
  const { raw: out, removed } = stripRelated(raw, 'th-1');
  assert.equal(removed, 1);
  assert.ok(/related:\s*\[\]/.test(out), 'related: [] 로 정규화됨');
  assert.ok(!out.includes('- id:'), '잔여 리스트 항목 없음');
  assert.ok(out.includes('category_path: episodic'), '이후 키 보존됨');
});

test('stripRelated: 대상 id 부재 시 no-op (removed=0, 원문 유지)', () => {
  const raw = thought('ep-1', ['th-1', 'se-2']);
  const { raw: out, removed } = stripRelated(raw, 'no-such');
  assert.equal(removed, 0);
  assert.equal(out, raw);
});

// --- stripGraphRows -------------------------------------------------------

test('stripGraphRows: to 셀이 대상인 행 제거, 헤더·구분선·기타 행 보존', () => {
  const { raw: out, removed } = stripGraphRows(GRAPH, 'ep-2');
  assert.equal(removed, 1);
  assert.ok(!out.includes('rf-1'), '대상 포함 행 제거됨');
  assert.ok(out.includes('| ep-1 | th-1 | supports | 0.6 |'), '무관 행 보존됨');
  assert.ok(out.includes('| from_id | to_id'), '헤더 보존됨');
  assert.ok(out.includes('|---|'), '구분선 보존됨');
});

test('stripGraphRows: from 셀이 대상인 행도 제거', () => {
  const { raw: out, removed } = stripGraphRows(GRAPH, 'ep-1');
  assert.equal(removed, 1);
  assert.ok(!out.includes('| ep-1 | th-1'), 'from 매칭 행 제거됨');
  assert.ok(out.includes('rf-1'), '무관 행 보존됨');
});

test('stripGraphRows: 대상 부재 시 no-op', () => {
  const { raw: out, removed } = stripGraphRows(GRAPH, 'zz-9');
  assert.equal(removed, 0);
  assert.equal(out, GRAPH);
});

// --- resolveTarget --------------------------------------------------------

test('resolveTarget: id 매칭', () => {
  const files = [
    { path: '/m/ep-1.md', data: { id: 'ep-1' } },
    { path: '/m/th-1.md', data: { id: 'th-1' } },
  ];
  assert.equal(resolveTarget(files, 'th-1').path, '/m/th-1.md');
});

test('resolveTarget: 경로 매칭', () => {
  const files = [{ path: '/m/ep-1.md', data: { id: 'ep-1' } }];
  assert.equal(resolveTarget(files, '/m/ep-1.md').data.id, 'ep-1');
});

test('resolveTarget: 미발견 시 null', () => {
  const files = [{ path: '/m/ep-1.md', data: { id: 'ep-1' } }];
  assert.equal(resolveTarget(files, 'no-such'), null);
});

// --- 통합: 임시 memory에서 역참조/크로스 제거 후 재기록 -----------------

test('통합: 상호 related 연결 + _graph.md → 역참조·크로스 행 제거 후 재기록', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-del-'));
  try {
    const aPath = join(dir, 'ep-1.md');
    const bPath = join(dir, 'th-1.md');
    const gPath = join(dir, '_graph.md');
    writeFileSync(aPath, thought('ep-1', ['th-1'])); // ep-1 → th-1
    writeFileSync(bPath, thought('th-1', ['ep-1'])); // th-1 → ep-1 (역참조)
    writeFileSync(gPath, `# _graph.md\n\n| from_id | to_id | edge_type | link_strength |\n|---|---|---|---|\n| ep-1 | th-1 | supports | 0.6 |\n`);

    // 대상 ep-1 삭제 시: th-1의 ep-1 역참조 제거 + _graph.md 행 제거
    const bStripped = stripRelated(readFileSync(bPath, 'utf8'), 'ep-1');
    writeFileSync(bPath, bStripped.raw);
    const gStripped = stripGraphRows(readFileSync(gPath, 'utf8'), 'ep-1');
    writeFileSync(gPath, gStripped.raw);

    assert.equal(bStripped.removed, 1);
    assert.ok(/related:\s*\[\]/.test(readFileSync(bPath, 'utf8')), 'th-1 역참조 제거됨');
    assert.equal(gStripped.removed, 1);
    assert.ok(!readFileSync(gPath, 'utf8').includes('ep-1'), '_graph.md 크로스 행 제거됨');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
