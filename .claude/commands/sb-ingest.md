---
description: Second Brain에 입력을 저장(Ingest)한다
argument-hint: <저장할 내용>
---

Second Brain 저장을 `sb-ingest` 서브에이전트에 위임한다. 무거운 규칙(인지유형 분류·edge 스키마)은
서브에이전트(haiku)가 보유하므로 메인은 내용 전달만 한다.

Agent 도구를 `subagent_type: sb-ingest` 로 호출하고 아래 내용을 그대로 넘긴다:

$ARGUMENTS

서브에이전트가 반환한 결과 요약(생성 id·인지유형·연결 edge·pending 발생 여부)만 사용자에게 보고한다.
