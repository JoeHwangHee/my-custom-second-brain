# tools/ — Second Brain v6.0 로컬 임베딩 인덱싱/조회 CLI

markdown(SSOT)을 로컬 임베딩(Ollama `bge-m3`)으로 색인하고, sqlite-vec 벡터DB로 시맨틱 검색한다.
벡터DB(`tools/.index/brain.db`)는 **재생성 가능한 파생물**(gitignore)이며, 원본은 항상 markdown이다.

## 부트스트랩 (macOS, Apple Silicon)

```bash
brew install ollama
ollama serve &                 # 데몬 기동 (localhost:11434)
ollama pull bge-m3             # 임베딩 모델 (1024-dim, 한국어 강함)

cd tools
npm install                    # better-sqlite3(네이티브)·sqlite-vec·yaml
node --test                    # 합성벡터 db 검증 (Ollama 불요)
node index.mjs --all           # 전체 색인
```

### better-sqlite3 빌드 실패 시 (Node 버전 호환)
`better-sqlite3`는 네이티브 모듈이다. 설치 중 prebuilt가 없어 빌드가 실패하면 Node LTS로 폴백:

```bash
nvm install 22 && nvm use 22
rm -rf node_modules package-lock.json && npm install
```

## 명령

```bash
# 인덱서
node index.mjs --all                 # 전체 재색인 (이식성 복원 경로)
node index.mjs --file <path.md>      # 단건 색인 (Ingest 직후)
node index.mjs --prune               # 파일 사라진 고아 벡터 제거

# 검색
node query.mjs "<쿼리>" [--type ep,rf] [--tag 운동] [--topk 8] [--json]
node query.mjs --related <file|id>   # 유사 후보 (관계 발견; Ingest 직후 edge 후보)
#   --type: 인지유형 필터(ep/se/pr/rf/th 또는 풀네임). --tag: 주제 태그. 둘은 독립 필터.

# 삭제 (결정론)
node delete.mjs <id|path> [--json]   # 역참조·크로스엣지(_graph.md)·고아벡터 정리 + log DELETE
#   대상 미발견 시 삭제하지 않고 exit 1. 모든 Thought 순회로 비대칭 역참조까지 제거.

# 정비 (결정론)
node lint.mjs            # 동기화 + 정합성/near-miss 리포트 (자동수정 없음)
node lint.mjs --apply    # + memory/index.md 통계 섹션 entry_count·examples(centroid) 기록
```

## 환경 변수
- `OLLAMA_URL` (기본 `http://localhost:11434`)
- `BRAIN_EMBED_MODEL` (기본 `bge-m3`)

## 설계 메모
- 거리 지표 = **cosine**(`vec0 ... distance_metric=cosine`) + embed 단계 **L2 정규화** 이중 보장.
  `score = 1 − cosine_distance`.
- 검색은 over-fetch(`topk×5`) 후 JS에서 `--type/--tag` 필터 → topk 트림(소규모 코퍼스 안전).
- `id`는 `{인지유형약어}-{YYYYMMDD}-{순번}` (예 `ep-20260607-001`). 접두사 = 인지유형(L1).
