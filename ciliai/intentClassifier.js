// intentClassifier.js (very small, deterministic fallback)
const INTENTS = ['definition','phylogeny','scRNA','localization','complex','disease_query','visualize','compare'];

// Precompute a list of training phrases per intent (keep it small & curated)
const TRAINING = {
  definition: ['what is IFT', 'explain intraflagellar transport', 'define BBSome'],
  phylogeny: ['phylogeny', 'evolutionary conservation', 'which organisms have'],
  scRNA: ['single cell', 'scRNA', 'cell type'],
  localization: ['localize', 'where is', 'localized to'],
  complex: ['complex', 'subunit', 'BBSome'],
  disease_query: ['causes', 'associated with', 'Joubert', 'Joubert syndrome'],
  visualize: ['show me a heatmap', 'plot', 'umap', 'visualize'],
  compare: ['compare', 'versus', 'vs']
};

// naive text -> intent scoring by token overlap + semantic fallback
function scoreIntents(query, semanticMatches=[]) {
  const q = query.toLowerCase();
  const scores = INTENTS.reduce((acc,i)=>{acc[i]=0;return acc;},{});
  for (const intent of Object.keys(TRAINING)){
    for (const phrase of TRAINING[intent]) {
      if (q.includes(phrase.replace(/\s+/g,' '))) scores[intent] += 2;
    }
  }
  // token overlap
  const tokens = q.split(/\W+/).filter(Boolean);
  for (const t of tokens) {
    for (const intent of Object.keys(TRAINING)) {
      for (const phrase of TRAINING[intent]) {
        if (phrase.split(/\W+/).includes(t)) scores[intent] += 0.3;
      }
    }
  }
  // semanticMatches: if a semantic match contains keywords (eg 'scRNA') boost that intent
  for (const s of semanticMatches) {
    if (s.meta?.tag && s.meta.tag === 'scRNA') scores['scRNA'] += 1;
    if (s.meta?.type === 'definition') scores['definition'] += 1;
    if (s.meta?.type === 'disease') scores['disease_query'] += 1;
  }
  // choose highest
  const best = Object.entries(scores).sort((a,b)=>b[1]-a[1])[0];
  return { intent: best[0], scores };
}
