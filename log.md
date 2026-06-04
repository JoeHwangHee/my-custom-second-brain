# log.md — 활동 로그

Append-only. 30일 초과 항목은 Lint가 삭제.
단, LINT executed 항목 중 가장 최근 1건은 날짜 무관 영구 보존.

엔트리 형식:
  {timestamp} | QUERY    | {subject} | {accessed_file_ids}
  {timestamp} | INGEST   | {file_id}
  {timestamp} | DELETE   | {file_id}
  {timestamp} | CATEGORY | {created_path}
  {timestamp} | LINT     | executed
  {timestamp} | OTHER    | -

QUERY의 accessed_file_ids: 실제 전체 내용이 로드된 파일 ID (상한 10개)

---

2026-05-30T00:00:00 | INGEST | dl-health-20260530-001
2026-05-30T00:01:00 | QUERY  | 체지방률 | dl-health-20260530-001
