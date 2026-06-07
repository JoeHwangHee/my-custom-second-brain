# category_schema.md — 카테고리 기준 (인지유형 L1, v6.0)

L1 카테고리는 **인지유형 5종**이다(경험·개념·절차·통찰·주장). 한 Thought는 하나의 인지유형에
속한다(단일 소속). 주제(운동·식단 등)는 L1이 아니라 `tags` + 벡터 임베딩이 담당하며, 폴더는
**flat**이다 — 모든 Thought는 `memory/` 직속에 저장되고 인지유형은 `category_path`로 식별한다(폴더 없음).

이 파일은 `_rules/categories/_active.md`가 가리키는 **활성 스키마**다. operation 규칙은 파일명을
직접 박지 않고 `_active.md`의 active_schema를 통해 참조한다.

이 파일은 카테고리 추가/변경 시에만 수동 수정한다. Ingest / Query / Lint 과정에서 수정 금지.

> **중요 — keywords의 역할 변화**: v6.0에서 카테고리 `keywords`는 주제어가 아니라 **화행 신호**다.
> 그리고 이는 **결정론적 라우팅 게이트가 아니라 LLM의 저장 분류 가이드**일 뿐이다. 인지유형 판단은
> 저장 시 LLM이 화행으로 1회 수행하고(어차피 글을 읽으므로 추가 토큰 없음), 조회 라우팅은
> 벡터 검색(`tools/query.mjs`)이 담당한다. 캐스케이드/키워드 게이트는 폐지됐다.

---

## L1 인지유형 약어 레지스트리 (단일 출처)

ID 접두사 `{인지유형약어}`의 **정본**이다. 약어는 여기서만 정의한다.

| L1 경로 | 약어 | 핵심 질문 | 화행 신호(분류 가이드) | 특수 규칙 |
|---|---|---|---|---|
| episodic | ep | 언제 무슨 일이 있었나 | 했다·갔다·오늘·어제·만났다·봤다 | `origin: first_party`만 |
| semantic | se | 이것은 무엇인가 | ~이다·~란·개념·정의·의미·원리 | — |
| procedural | pr | 어떻게 하는가 | ~하는 법·먼저·그다음·절차·방법·단계 | — |
| reflective | rf | 여러 경험서 무엇을 알았나 | 되돌아보면·깨달았다·패턴·교훈 | `related:` 필수, tags에 "reflective" |
| thesis | th | 무엇을 주장하는가 | ~해야 한다·~라고 본다·입장·당위·평가 | `related:`(supports/contradicts) 권장 |

약어 ep/se/pr/rf/th는 전역 유일이다.

---

## 분류 기준 (포함/제외/경계)

### episodic — 경험
포함: 시간/장소가 있는 1인칭 경험. 무슨 일이 있었나.
제외: 복수 경험을 종합한 메타 통찰 → reflective.
경계: 단일 경험 + 짧은 감상은 episodic. `origin: first_party`만.

### semantic — 개념
포함: 세계에 대한 사실·개념·정의·원리.
제외: 개인 경험 → episodic, 주장·평가 → thesis.
경계: 외부 지식 + 의견 혼합은 semantic(`origin: curated`).

### procedural — 방법
포함: 절차·방법·수행 방식(단계적).
제외: 개념 설명만 → semantic.
경계: "무엇" 위주면 semantic, "어떻게" 위주면 procedural.

### reflective — 통찰
포함: 복수 경험/지식에서 도출한 메타 수준 통찰("되돌아보니 ~").
제외: 단일 경험 + 감상 → episodic.
경계: `related:` 근거 필수. 근거가 없으면 episodic/semantic으로 재분류(아래 다중신호 규칙).

### thesis — 주장
포함: 명시적 주장·입장·당위·평가("~해야 한다", "~라고 본다").
제외: 사실 서술 → semantic.
경계: 근거는 `related:`의 supports/contradicts로 연결(권장).

---

## 다중 화행 신호 처리

한 입력이 여러 인지유형 신호를 가지면(예: "매일 운동했더니 꾸준함이 중요하다 싶다" = 경험+통찰):
- 경험 부분은 episodic, 통찰 부분은 reflective로 **분해 저장**(각각 ID 발급).
- reflective는 `related:` 필수이므로 분해된 episodic을 근거로 `synthesized` 엣지로 자동 연결한다
  (다른 인지유형 간이므로 `memory/_graph.md` 크로스 엣지에도 기록).
- 분해가 애매하면 지배적 신호로 단일 분류한다.
- 이 분해는 storage가 수행한다(router 불변).

---

## 새 인지유형 추가 (수동 · 사용자 확인)

인지유형 5종은 고정 온톨로지다. 새 L1(인지유형) 추가는 자동으로 하지 않으며, 추가 시:
1. 위 약어 레지스트리에 `경로 → 약어` 등록 + 충돌 검사.
2. 분류 기준 명문화.
3. `memory/index.md`에 인지유형 행 추가(별도 폴더/_index 없음 — Thought는 memory/ 직속).
4. `tools/lib/scan.mjs`의 `TYPES` 배열에 추가.
