# Second Brain

## 진입점
- 의도 분기:    _system/router.md
- 저장 규칙:    _rules/operations/storage_rules.md
- 조회 규칙:    _rules/operations/query_rules.md
- 삭제 규칙:    _rules/operations/delete_rules.md
- 정비 규칙:    _rules/operations/lint_rules.md
- 카테고리 기준: _rules/categories/category_schema.md (활성 스키마: _rules/categories/_active.md)

## 운영 상태
- 카테고리 목록: memory/index.md
- Lint 상태:    _rules/_state/_lint_status.md
- 미결 항목:    _rules/_state/_pending.md
- 활동 로그:    memory/log.md

## 핵심 원칙
- Lazy Loading: 각 단계마다 필요한 파일만 순차 로드
- 분할 기준: _index.md 50건 / _graph.md 100건
- 크로스 카테고리 관계만 _graph.md에 저장

---
이 파일은 초기 1회 작성 후 수정 금지.
Ingest / Query / Lint 과정에서 절대 수정하지 않는다.
