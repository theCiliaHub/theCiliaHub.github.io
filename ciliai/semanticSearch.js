// semanticSearch.js (Node/browser-safe)
async function getEmbedding(text) {
  // Call your embeddings microservice (returns Float32Array or Array)
  const res = await fetch('/embed', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ text })
  });
  const { embedding } = await res.json(); // e.g. [0.01, -0.02, ...]
  return embedding;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i=0;i<a.length;i++){ dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return dot / (Math.sqrt(na)*Math.sqrt(nb) + 1e-12);
}

// Example in-memory index: array of { id, text, meta, embedding }
const VECTOR_INDEX = []; // persisted/loaded at startup

async function buildIndex(docs) {
  // docs: [{id, text, meta}]
  for (const d of docs) {
    const emb = await getEmbedding(d.text);
    VECTOR_INDEX.push({ id: d.id, text: d.text, meta: d.meta, embedding: emb });
  }
}

// search
async function semanticSearch(query, topK=10, minScore=0.55) {
  const qEmb = await getEmbedding(query);
  const scores = VECTOR_INDEX.map(item => ({ id: item.id, score: cosine(qEmb, item.embedding), meta: item.meta, text:item.text }));
  scores.sort((a,b)=>b.score-a.score);
  return scores.filter(s=>s.score>=minScore).slice(0, topK);
}

// Example: store per-gene descriptions, term definitions, and small paragraphs for explanation.
