# 구조 결함 정비 검증 결과

이 문서는 9개 구조적 결함(#1–#9, 추가 발견 G1–G4 포함) 정비 후, 규칙을 실제 입력으로
end-to-end 실행해 데이터 정합성이 닫히는지 검증한 결과를 기록한다.

- 검증 방식: 임시 브랜치(`verify/scenarios`)에서 실제 Thought/인덱스/그래프/로그 파일을
  규칙대로 생성·수정하며 워크스루. 검증 후 데이터는 폐기, 규칙 변경분만 main에 유지.
- 검증 일자: 2026-06-04
- 정비 커밋: main `#2 … #9` (9개 커밋, 결함별 1커밋)
- 대상 규칙 파일(경로는 v5.0 재배치 기준 표기): `_system/router.md`, `_rules/operations/*.md`,
  `CLAUDE.md`, `_system/DESIGN.md`, `memory/index.md`/`_index.md`, `_graph.md`, `memory/log.md`,
  `_rules/_state/_lint_status.md` (`_system/MEMORY.md`는 미수정)

---

## 시나리오별 결과

| 시나리오 | 입력 / 조작 | 검증 대상 | 결과 |
|---|---|---|---|
| 1. L2 자동생성 | "양자역학 중첩 원리를 공부했다" | #5, **G2** | leaf `learning/physics` 자동 생성. 비어 있던 `learning/_index.md`에 `## 하위 카테고리` 신설+행 추가. leaf entry_count=1=실제수, 부모=0 유지, CATEGORY+INGEST 로그. **PASS** |
| 2. 크로스+Lint | "유산소 운동이 체지방 감소에 효과적" + supports 크로스 → 공동조회 15건 후 Lint | #2, #1, #9 | L1 상이→**root `_graph.md`** 엣지 기록(#2). Lint 후 Thought `related:`와 root graph **둘 다 0.66 일치**(#1, 수정 전엔 graph 0.60 고착). co_occurrence=엔트리수 15(#9). **PASS** |
| 3. Delete | "양자역학 기록 삭제해줘" | **G1**, #7 | `삭제해줘`→Delete 라우팅(이전엔 도달 경로 없음). entry_count 1→0=실제0, 파일 제거, DELETE 로그, 잔존 참조 0건. **PASS** |
| 4. Lint 트리거 | `ingest_since_lint=3<50` 상태 + 명시적 "정비해줘" | #6, **G4** | 내부 자동 트리거 미발동(24h 조건 폐지), 명시적 명령으로만 Lint 실행. **PASS** |
| 5. SSOT 수렴 | `index.md` L1 keywords 고의 훼손 후 Lint | #4 | 정본 `category_schema.md` 대조→불일치 감지→정본 기준 자동 교정. **PASS** |
| 6. graph_score 로드범위 | 규칙 동작 | **G3**, #8 | "후보 밖 파일 신규 로드 금지" 규칙 반영. 후보 내 frontmatter로 정·역방향 무료 판정. **PASS** |
| 7. 상호참조 grep | 전수 | 전체 | `세션 수` 0건, `_system/router.md` Delete 분기 3곳, `24h`는 "폐지" 설명 맥락만. **PASS** |

---

## 핵심 확인 사항

- **G2**: 새 leaf가 부모 네비게이션에 정상 연결됨(이전 설계라면 고립되었을 케이스).
- **#1**: 크로스 엣지 `link_strength`가 Thought `related:`와 `_graph.md` 양쪽에서 동기화
  (0.66)됨. 이중 저장 정합성 결함 해소.
- **G1**: 삭제 요청이 실제 핸들러로 라우팅되어 정합성 즉시 보정.
- **#9**: `co_occurrence_count`를 "함께 조회된 엔트리 수"로 계산하는 정의가 실데이터에서 적용됨.

전체 설계 의도와 규칙 결정 근거는 `DESIGN.md` 참조.

---

## v5.0 3계층 마이그레이션 검증 (2026-06-06)

3계층 재구조화(`_system/` · `_rules/{operations,categories,_state}` · `memory/`) + 삭제 규칙
추출(`delete_rules.md`) + 카테고리 스키마 바인딩 시임(`_rules/categories/_active.md`) 적용 후
end-to-end 검증.

| 검증 | 방법 | 결과 |
|---|---|---|
| 이동 무결성 | `git status` | 옮긴 파일 전부 `R`(rename) 추적, 데이터 손실 0. **PASS** |
| 잔존 옛 경로 스윕 | grep 8패턴 × (CLAUDE.md, _system/, _rules/, memory/) | 0건. (초기 2건 — `_pending.md`의 `_router.md` 참조, storage §7 "삭제 핸들러" 명칭 — 교정 후 0건.) **PASS** |
| 신규 트리 실재 | `find` | 목표 3계층 전 파일 + `delete_rules.md`·`_active.md` 존재. **PASS** |
| 파이프라인 드라이런 | Ingest/Query/Delete/Lint 로드순서 경로 실재 | 12개 경로 전부 실재. **PASS** |
| 라우팅 회귀 | `router.md` "의도 확정 후 이동" | 4분기 새 경로 도달. **Delete→delete_rules.md 직접**(우회 제거), storage/query/lint 전부 "활성 스키마" 경유. **PASS** |
| CLAUDE.md 부트스트랩 | 루트 잔류 + 내부 경로 | 루트 고정 유지, `_system/CLAUDE.md` 미존재, 내부 옛 경로 0건. **PASS** |

핵심: 데이터 트리(`memory/`)는 이동만 되고 논리 `category_path`/`category:`는 불변. operation 규칙은
카테고리 스키마를 `_active.md`로 추상 참조하여 스키마 교체 시 operation 무수정 재사용이 가능하다.
