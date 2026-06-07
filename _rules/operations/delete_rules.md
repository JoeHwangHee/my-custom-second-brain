# delete_rules.md — 삭제 규칙 (v6.0)

`_system/router.md`에서 Delete로 확정된 입력을 처리한다. 전체 스캔 없이 대상 메타데이터만으로
정합성을 즉시 보정한다(토큰 절감). edge 의미는 `_rules/edges/_active.md` 활성 스키마 참조.

---

## 삭제 절차

```
1. 삭제 대상 Thought 파일 특정 (Stage 3 subject → id 또는 경로)
   모호하면 사용자에게 대상 id를 확인한다(잘못된 삭제 방지).

2. 대상 파일 frontmatter만 읽어 category_path(인지유형)와 related: 를 확보.

3. 정합성 보정 (대상 메타데이터 범위 내에서만):
   a. 해당 인지유형 memory/{type}/_index.md: entry_count −1, 목록에서 대상 항목 제거.
   b. 대상의 related: 에 적힌 상대 파일들에서 대상 id를 가리키는 역참조 제거.
   c. 다른 인지유형 간 크로스 엣지: memory/_graph.md 에서 from/to 에 대상 id가 있는 행 제거.
      (flat 구조라 크로스는 항상 루트 _graph.md 한 곳.)

4. 대상 Thought 파일 삭제.

5. 벡터DB 동기화: node tools/index.mjs --prune
   (파일이 사라진 고아 벡터를 제거. 단건만 빠르게 지우려면 대상 삭제 후 --prune 호출.)

6. memory/log.md 기록: {timestamp} | DELETE | {file_id}
```

원칙: 즉시 보정으로 정합성을 닫는다. 누락이 생겨도 Lint(tools/lint.mjs: 깨진링크/고아엣지 점검 +
--prune)가 백스톱으로 잔여 불일치를 정리한다.
