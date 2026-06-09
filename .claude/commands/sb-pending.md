---
description: Second Brain 미결(_pending) 항목을 처리한다
---

Second Brain 미결 처리를 `sb-pending` 서브에이전트에 위임한다. Agent 도구를
`subagent_type: sb-pending` 로 호출한다.

서브에이전트가 자동 해소분(reindex_pending 재색인) 결과와 **사용자 확인이 필요한 항목**
(reflective_pending·new_category_proposal)을 반환하면, 후자는 사용자와 함께 해소한다.
