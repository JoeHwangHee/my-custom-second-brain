// embed.mjs — Ollama bge-m3 임베딩 래퍼 (L2 정규화로 cosine 일관)
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.BRAIN_EMBED_MODEL || 'bge-m3';
export const DIM = 1024;

function l2normalize(v) {
  let s = 0;
  for (const x of v) s += x * x;
  const n = Math.sqrt(s) || 1;
  return v.map((x) => x / n);
}

function friendlyConnError(e) {
  const msg = String(e && (e.cause?.code || e.message || e));
  if (/ECONNREFUSED|fetch failed/.test(msg)) {
    return new Error(
      `Ollama에 연결할 수 없습니다 (${OLLAMA_URL}).\n` +
        `  1) ollama serve   # 데몬 기동\n` +
        `  2) ollama pull ${MODEL}   # 모델 내려받기\n` +
        `후 다시 시도하세요.`
    );
  }
  return e;
}

async function callOnce(text) {
  let res;
  try {
    res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt: text }),
    });
  } catch (e) {
    throw friendlyConnError(e);
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`임베딩 요청 실패 ${res.status}: ${t}`);
  }
  const json = await res.json();
  const emb = json.embedding;
  if (!Array.isArray(emb) || emb.length !== DIM) {
    throw new Error(`임베딩 차원 불일치: 받은 길이=${emb && emb.length}, 기대=${DIM}`);
  }
  return l2normalize(emb);
}

// 1회 재시도 포함 단건 임베딩
export async function embed(text) {
  try {
    return await callOnce(text);
  } catch (e) {
    if (/연결할 수 없습니다/.test(String(e.message))) throw e;
    return await callOnce(text); // 일시 오류 1회 재시도
  }
}

export async function embedBatch(texts) {
  const out = [];
  for (const t of texts) out.push(await embed(t)); // 소규모 코퍼스 순차
  return out;
}
