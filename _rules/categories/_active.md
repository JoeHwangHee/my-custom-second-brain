# _active.md — 활성 카테고리 스키마 바인딩

operation 규칙(storage / query / lint / delete)은 스키마 파일명을 직접 박지 않고,
`active_schema`가 가리키는 **"활성 스키마"**를 참조한다. 스키마를 교체하려면 이 한 곳만 바꾼다.
경로는 `_rules/categories/` 기준 상대다.

L1 약어 레지스트리와 카테고리 포함/제외/경계 기준은 각 스키마 파일 내부에 정의된다
(스키마마다 다르므로 이 파일에는 두지 않는다).

```
active_schema: category_schema.md
available: [category_schema.md]   # 향후 work/personal 등 추가
```

> 향후 확장: 스키마별로 분리된 `memory/<schema>/` 서브트리(완전 병행)는 현재 범위 밖이다.
> 지금은 단일 활성 스키마가 `memory/` 트리와 1:1 매핑된다. 자세한 근거는 `_system/DESIGN.md` 참조.
