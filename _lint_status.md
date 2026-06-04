# _lint_status.md — Lint 트리거 상태

Lint 트리거 판단 전용 파일. Lint 실행 시마다 갱신.
log.md 전체를 읽지 않고 이 파일만으로 트리거 여부 판단 가능.

내부 트리거는 ingest_since_lint ≥ 50 하나뿐이다.
last_lint는 기록/감사용으로 유지하며, 트리거 판단에는 사용하지 않는다(24h 조건 폐지).

---

last_lint: 2026-05-30T00:00:00
ingest_since_lint: 1
