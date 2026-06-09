---
description: Second Brain을 조회(Query)한다
argument-hint: <질의>
---

Second Brain 조회를 `sb-query` 서브에이전트에 위임한다. 서브에이전트는 대화 맥락이 없으므로,
**메인이 먼저** 질의의 지시대명사를 대화 맥락으로 해소하고 subject를 정규화한다(예 "그거" → 직전 주제명).

그런 다음 Agent 도구를 `subagent_type: sb-query` 로 호출해 **정규화된 subject**를 넘긴다:

$ARGUMENTS

서브에이전트가 합성한 답변과 근거 파일 id를 사용자에게 전달한다.
