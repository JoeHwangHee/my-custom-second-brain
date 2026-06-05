# delete_rules.md — 삭제 규칙

`_system/router.md`에서 Delete로 확정된 입력을 처리한다. 전체 스캔 없이 대상 파일의
메타데이터만으로 정합성을 즉시 보정한다(토큰 절감).

실메모리의 물리 루트는 `memory/`다. 아래 `_index.md`/`_graph.md`는 대상 파일이 속한
`memory/` 하위 경로 기준의 상대 지칭이다.

---

## 삭제 절차

```
1. 삭제 대상 Thought 파일 특정 (Stage 3 subject → id 또는 경로)
   모호하면 사용자에게 대상 id를 확인한다(잘못된 삭제 방지).

2. 대상 파일 frontmatter만 읽어 category_path와 related: 를 확보.

3. 정합성 보정 (대상 메타데이터 범위 내에서만):
   a. 해당 leaf _index.md: entry_count −1, examples에 대상 title이 있으면 제거,
      하위 목록에서 대상 항목 제거
   b. 대상의 related: 에 적힌 상대 파일들에서 대상 id를 가리키는 역참조 제거
   c. 대상이 포함된 크로스 엣지: 결정 레벨 _graph.md에서 from/to에 대상 id가 있는 행 제거
      (크로스 여부 및 기록 레벨 판정은
       _rules/operations/storage_rules.md "크로스 카테고리 관계 처리"의
       category_path 비교 규칙을 사용)

4. 대상 Thought 파일 삭제.

5. memory/log.md 기록: {timestamp} | DELETE | {file_id}
```

원칙: 즉시 보정으로 정합성을 닫는다. 누락이 발생해도 Lint Step 6(고아 엣지/깨진 링크
점검)이 백스톱으로 잔여 불일치를 정리한다.
