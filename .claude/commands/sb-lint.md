---
description: Second Brain을 정비(Lint)한다
argument-hint: [--apply]
---

Second Brain 정비를 `sb-lint` 서브에이전트에 위임한다. Agent 도구를 `subagent_type: sb-lint` 로
호출한다. 인자가 있으면(예 `--apply`) 그대로 전달한다:

$ARGUMENTS

서브에이전트가 반환한 점검 리포트와 **사용자 확인이 필요한 항목**을 사용자에게 전달하고,
확인이 필요한 건은 사용자와 함께 처리한다.
