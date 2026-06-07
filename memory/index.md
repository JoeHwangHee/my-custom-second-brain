# index.md — 인지유형 목록 + 통계

인지유형 5종(고정 온톨로지). 새 인지유형 추가 시에만 수동 수정.
**flat 구조**: 모든 Thought는 `memory/` 직속에 저장되고, 인지유형은 frontmatter `category_path`로
식별한다(폴더 없음). 조회 라우팅은 벡터 검색(`tools/query.mjs`)이 수행하며, keywords(화행 신호)
정본은 `_rules/categories/category_schema.md`다.

| 인지유형 | 약어 | 핵심 질문 | 화행 신호 |
|---|---|---|---|
| 경험 | ep | 언제 무슨 일이 있었나 | 했다, 갔다, 오늘, 어제, 만났다, 봤다 |
| 개념 | se | 이것은 무엇인가 | 이다, 란, 개념, 정의, 의미, 원리 |
| 방법 | pr | 어떻게 하는가 | 하는 법, 먼저, 그다음, 절차, 방법, 단계 |
| 통찰 | rf | 여러 경험서 무엇을 알았나 | 되돌아보면, 깨달았다, 패턴, 교훈 |
| 주장 | th | 무엇을 주장하는가 | 해야 한다, 라고 본다, 입장, 당위, 평가 |

## 통계 (Lint 자동 관리)
<!-- lint:stats:start -->
| 인지유형 | entry_count | examples |
|---|---|---|
| episodic | 0 | - |
| semantic | 0 | - |
| procedural | 0 | - |
| reflective | 0 | - |
| thesis | 1 | AI 활용자에게는 지식량보다 이해·활용력이 중요하다 |
<!-- lint:stats:end -->
