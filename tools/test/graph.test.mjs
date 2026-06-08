// graph.test.mjs — _graph.md 파서 + consistencyReport 교차엣지 반영 검증 (Ollama 불요)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, mkdtempSync, writeFileSync } from 'node:fs';
import { graphEdges } from '../lib/scan.mjs';
import { consistencyReport } from '../lint.mjs';

function tmpGraph(content) {
  const dir = mkdtempSync(join(tmpdir(), 'brain-graph-'));
  const path = join(dir, '_graph.md');
  writeFileSync(path, content);
  return { dir, path };
}

function mkFile(id, type = 'episodic', related = []) {
  return { data: { id, category_path: type, related } };
}

test('graphEdges: 헤더·구분선·플레이스홀더 스킵, 실제 행만 파싱', () => {
  const { dir, path } = tmpGraph(
    `# _graph.md\n\n| from_id | to_id | edge_type | link_strength |\n|---|---|---|---|\n| ep-1 | th-1 | supports | 0.6 |\n| rf-1 | ep-2 | synthesized | 0.7 |\n`
  );
  try {
    const edges = graphEdges(path);
    assert.equal(edges.length, 2);
    assert.deepEqual(edges[0], { from: 'ep-1', to: 'th-1', edge_type: 'supports', link_strength: '0.6' });
    assert.equal(edges[1].from, 'rf-1');
    assert.equal(edges[1].to, 'ep-2');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('graphEdges: 끝 파이프 없는 행도 누락 없이 파싱', () => {
  // markdown 표는 끝 `|`가 선택사항 → trailing-pipe 없는 행도 잡아야 한다.
  const { dir, path } = tmpGraph(
    `# _graph.md\n| from_id | to_id | edge_type | link_strength |\n|---|---|---|---|\n| ep-1 | th-1 | supports | 0.6 |\n| rf-1 | ep-2 | synthesized | 0.7\n`
  );
  try {
    const edges = graphEdges(path);
    assert.equal(edges.length, 2);
    assert.deepEqual(edges[1], { from: 'rf-1', to: 'ep-2', edge_type: 'synthesized', link_strength: '0.7' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('graphEdges: 파일 없으면 빈 배열', () => {
  assert.deepEqual(graphEdges(join(tmpdir(), 'no-such-graph-xyz.md')), []);
});

test('consistencyReport: 교차엣지가 relatedPairs에 합쳐진다(near-miss 제외용)', () => {
  const files = [mkFile('ep-1', 'episodic'), mkFile('th-1', 'thesis')];
  const edges = [{ from: 'ep-1', to: 'th-1', edge_type: 'supports', link_strength: '0.6' }];

  const withoutGraph = consistencyReport(files, []);
  assert.ok(!withoutGraph.relatedPairs.has(['ep-1', 'th-1'].sort().join('::')), '교차엣지 미반영 시 쌍 없음');

  const withGraph = consistencyReport(files, edges);
  assert.ok(withGraph.relatedPairs.has(['ep-1', 'th-1'].sort().join('::')), '교차쌍이 relatedPairs에 반영');
});

test('consistencyReport: 존재하지 않는 id를 가리키는 graph edge는 graphBroken에 잡힘', () => {
  const files = [mkFile('ep-1', 'episodic')];
  const edges = [{ from: 'ep-1', to: 'th-999', edge_type: 'supports', link_strength: '0.6' }];
  const { graphBroken } = consistencyReport(files, edges);
  assert.equal(graphBroken.length, 1);
  assert.deepEqual(graphBroken[0], { from: 'ep-1', to: 'th-999' });
});
