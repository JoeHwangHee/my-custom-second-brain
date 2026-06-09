---
description: Second Brain 항목을 삭제(Delete)한다
argument-hint: <id 또는 대상 설명>
---

Second Brain 삭제를 `sb-delete` 서브에이전트에 위임한다. **메인이 먼저** 삭제 대상을 특정한다
(대화 맥락의 지시대명사 해소 포함). 여러 후보로 모호하면 사용자에게 대상 id를 확인한 뒤 진행한다.

대상이 확정되면 Agent 도구를 `subagent_type: sb-delete` 로 호출해 대상(id 또는 경로)을 넘긴다:

$ARGUMENTS

서브에이전트가 반환한 정리 결과(역참조/크로스/prune 건수)를 사용자에게 보고한다.
