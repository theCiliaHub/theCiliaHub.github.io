// FILE: ciliai.js
// JavaScript port of literature_miner_engine.py for CiliAI
// NOTE: Browser environments may face CORS restrictions when calling NCBI Entrez APIs directly.
// For robust use, run this code from a server-side environment (Node.js) or via a server proxy.

const ESEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const EFETCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';
const USER_AGENT = 'CiliaMinerJS/1.0 (mailto:user@example.com)';

const API_QUERY_KEYWORDS = [
  'cilia', 'ciliary', 'cilia length', 'ciliary length', 'shorter cilia',
  'longer cilia', 'ciliogenesis', 'ciliation', 'loss of cilia', 'fewer cilia',
  'impaired ciliogenesis', 'cilia assembly', 'fluid flow', 'mucociliary', 'multiciliated'
];

const LOCAL_ANALYSIS_KEYWORDS = Array.from(new Set([
  'cilia', 'ciliary', 'cilium', 'ciliogenesis', 'ciliation', 'axoneme', 'basal body',
  'cilia length', 'shorter', 'shortened', 'longer', 'fewer', 'reduction', 'reduced',
  'decrease', 'increased', 'increase', 'flow', 'fluid flow', 'mucociliary', 'multiciliated',
  'extracellular fluid', 'bead', 'beads', 'displacement', 'cilia-generated', 'mucociliary clearance'
]));

const EFFECT_PATTERNS = {
  shorter: /\b(shorter|shortened|decrease in length|reduced length|reduction in length)\b/i,
  fewer: /\b(fewer|reduced number|decrease in number|loss of cilia|less cilia)\b/i,
  reduced_flow: /\b(reduction in (flow|bead displacement)|reduced flow|decrease in bead displacement|significant reduction in bead)\b/i,
  longer: /\b(longer|elongated|increase in length|elongation)\b/i,
  no_change: /\b(unchanged|no effect|no difference|not altered|did not affect)\b/i,
  increased: /\b(increased|increase|enhanced)\b/i
};

const INFERENCE_LEXICON = {
  MANIPULATION: {
    LOSS: ['loss', 'knockout', 'deletion', 'mutation', 'loss-of-function', 'depletion', 'deficient', 'knockdown', 'kd', 'null'],
    GAIN: ['overexpression', 'gain-of-function', 'activation', 'rescued', 'restoring', 'ectopic expression']
  },
  PHENOTYPE: {
    LENGTH_DECREASE: ['shorter', 'shortened', 'decrease in length', 'reduced length', 'reduction in length'],
    LENGTH_INCREASE: ['longer', 'elongated', 'increase in length', 'elongation', 'lengthened'],
    LENGTH_NEUTRAL: ['unchanged', 'no effect', 'no difference', 'not altered', 'unaltered'],
    LENGTH_VARIABLE: ['variable', 'heterogeneous', 'mixed'],
    FREQ_DECREASE: ['fewer', 'reduced number', 'decrease in number', 'loss of cilia', 'impaired ciliogenesis', 'abrogated ciliogenesis'],
    FREQ_INCREASE: ['increased number', 'more cilia', 'hyper-ciliation', 'multiciliogenesis'],
    FREQ_NEUTRAL: ['no change', 'no difference', 'unchanged']
  }
};

const SENT_SPLIT_REGEX = /(?<=[.!?])\s+/;
const PARA_SPLIT_REGEX = /\n{2,}/;
const ARTICLES_PER_GENE = 40;
const MAX_WORKERS = 4; // used only if running in Node or web worker pool
const REQUESTS_TIMEOUT = 30000; // ms
const ENTREZ_SLEEP = 340; // ms polite delay

// Utility sleep
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// fetch with retry & backoff
async function makeApiRequestWithRetry(url, params, desc, retries = 3, backoffFactor = 500) {
  const query = new URLSearchParams(params).toString();
  const fullUrl = `${url}?${query}`;

  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(fullUrl, { headers: { 'User-Agent': USER_AGENT } });
      if (resp.status === 429) {
        const wait = backoffFactor * Math.pow(2, i);
        console.warn(`[WARN] Rate limited on ${desc}. Sleeping ${wait}ms...`);
        await sleep(wait);
        continue;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      const text = await resp.text();
      return text;
    } catch (err) {
      if (i === retries - 1) throw err;
      const wait = backoffFactor * Math.pow(2, i);
      console.warn(`[WARN] Request error (${desc}): ${err}. Retrying in ${wait}ms...`);
      await sleep(wait);
    }
  }
  throw new Error(`Failed request for ${desc} after ${retries} retries.`);
}

function buildQueryAllFields(gene) {
  const kwClause = API_QUERY_KEYWORDS.map(k => `"${k}"[Title/Abstract]`).join(' OR ');
  return `("${gene}"[Title/Abstract]) AND (${kwClause})`;
}

function buildQueryPmc(gene) {
  const kwClause = API_QUERY_KEYWORDS.join(' OR ');
  return `${gene} AND (${kwClause})`;
}

async function searchPubmed(gene, retmax = ARTICLES_PER_GENE) {
  const params = { db: 'pubmed', term: buildQueryAllFields(gene), retmode: 'json', retmax: String(retmax) };
  const text = await makeApiRequestWithRetry(ESEARCH_URL, params, `PubMed search ${gene}`);
  await sleep(ENTREZ_SLEEP);
  try {
    const obj = JSON.parse(text);
    return obj?.esearchresult?.idlist || [];
  } catch (e) {
    console.warn('Could not parse PubMed search JSON, returning empty array', e);
    return [];
  }
}

async function fetchPubmedAbstracts(pmids) {
  if (!pmids || pmids.length === 0) return [];
  const params = { db: 'pubmed', id: pmids.join(','), retmode: 'xml', rettype: 'abstract' };
  const xmlText = await makeApiRequestWithRetry(EFETCH_URL, params, 'PubMed fetch');
  await sleep(ENTREZ_SLEEP);

  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'application/xml');
  const articles = [];
  const pubmedArticles = xml.getElementsByTagName('PubmedArticle');
  for (let i = 0; i < pubmedArticles.length; i++) {
    const pa = pubmedArticles[i];
    const medline = pa.getElementsByTagName('MedlineCitation')[0];
    if (!medline) continue;
    const articleInfo = medline.getElementsByTagName('Article')[0];
    if (!articleInfo) continue;
    const titleElem = articleInfo.getElementsByTagName('ArticleTitle')[0];
    const title = titleElem ? titleElem.textContent.trim() : '';
    let abstractText = '';
    const abstractElem = articleInfo.getElementsByTagName('Abstract')[0];
    if (abstractElem) {
      const abstractTexts = abstractElem.getElementsByTagName('AbstractText');
      const parts = [];
      for (let j = 0; j < abstractTexts.length; j++) parts.push(abstractTexts[j].textContent.trim());
      abstractText = parts.join(' ');
    }
    const pmidElem = medline.getElementsByTagName('PMID')[0];
    const pmid = pmidElem ? pmidElem.textContent.trim() : null;
    articles.push({ pmid, source: 'pubmed', title, text: abstractText });
  }
  return articles;
}

async function searchPmc(gene, retmax = ARTICLES_PER_GENE) {
  const params = { db: 'pmc', term: buildQueryPmc(gene), retmode: 'json', retmax: String(retmax) };
  const text = await makeApiRequestWithRetry(ESEARCH_URL, params, `PMC search ${gene}`);
  await sleep(ENTREZ_SLEEP);
  try {
    const obj = JSON.parse(text);
    return obj?.esearchresult?.idlist || [];
  } catch (e) {
    console.warn('Could not parse PMC search JSON', e);
    return [];
  }
}

async function fetchPmcFulltext(pmcids) {
  if (!pmcids || pmcids.length === 0) return [];
  const params = { db: 'pmc', id: pmcids.join(','), retmode: 'xml' };
  const xmlText = await makeApiRequestWithRetry(EFETCH_URL, params, 'PMC fetch');
  await sleep(ENTREZ_SLEEP);

  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'application/xml');
  const articles = [];
  const articleNodes = xml.getElementsByTagName('article');
  for (let i = 0; i < articleNodes.length; i++) {
    const art = articleNodes[i];
    let pmcid = null;
    const aidNodes = art.getElementsByTagName('article-id');
    for (let j = 0; j < aidNodes.length; j++) {
      const aid = aidNodes[j];
      const t = aid.getAttribute('pub-id-type') || '';
      if (t.toLowerCase().includes('pmc')) {
        pmcid = aid.textContent.trim();
        break;
      }
    }
    const titleElem = art.getElementsByTagName('article-title')[0];
    const title = titleElem ? titleElem.textContent.trim() : '';
    const paragraphs = [];
    const body = art.getElementsByTagName('body')[0];
    if (body) {
      const pNodes = body.getElementsByTagName('p');
      for (let k = 0; k < pNodes.length; k++) {
        const txt = pNodes[k].textContent.trim();
        if (txt) paragraphs.push(txt);
      }
      const capNodes = body.getElementsByTagName('caption');
      for (let k = 0; k < capNodes.length; k++) {
        const txt = capNodes[k].textContent.trim();
        if (txt) paragraphs.push(txt);
      }
    }
    // fallback: sec elements
    const secNodes = art.getElementsByTagName('sec');
    for (let k = 0; k < secNodes.length; k++) {
      const txt = secNodes[k].textContent.trim();
      if (txt) paragraphs.push(txt);
    }
    articles.push({ pmcid, source: 'pmc', title, paragraphs });
  }
  return articles;
}

function paragraphMatches(paragraph, gene) {
  if (!paragraph) return false;
  const geneRegex = new RegExp(`\\b${escapeRegExp(gene)}\\b`, 'i');
  if (!geneRegex.test(paragraph)) return false;
  const lower = paragraph.toLowerCase();
  return LOCAL_ANALYSIS_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

function sentenceContextMatches(paragraph, gene, windowSentences = 1) {
  const sents = paragraph.trim().split(SENT_SPLIT_REGEX);
  const matches = [];
  const geneRegex = new RegExp(`\\b${escapeRegExp(gene)}\\b`, 'i');
  for (let i = 0; i < sents.length; i++) {
    const s = sents[i];
    if (geneRegex.test(s)) {
      const start = Math.max(0, i - windowSentences);
      const end = Math.min(sents.length, i + windowSentences + 1);
      const context = sents.slice(start, end).join(' ').trim();
      if (LOCAL_ANALYSIS_KEYWORDS.some(kw => context.toLowerCase().includes(kw.toLowerCase()))) {
        matches.push(context);
      }
    }
  }
  return matches;
}

function detectEffect(contextText) {
  const found = [];
  for (const [label, pat] of Object.entries(EFFECT_PATTERNS)) {
    if (pat.test(contextText)) found.push(label);
  }
  return found.length ? found : ['unknown'];
}

function paragraphSubjectGenes(paragraph, allGenes) {
  const mentioned = (allGenes || []).filter(g => new RegExp(`\\b${escapeRegExp(g)}\\b`, 'i').test(paragraph));
  if (mentioned.length) return mentioned;
  if (/\b(these (single )?mutants|all mutants|all genes|each mutant)\b/i.test(paragraph)) return allGenes;
  return [];
}

async function processGene(gene, allGenesInList = null) {
  allGenesInList = allGenesInList || [gene];
  console.info(`[INFO] Processing gene: ${gene}`);
  const results = { gene, articles: [] };
  const seenIds = new Set();

  try {
    const pmids = await searchPubmed(gene);
    if (pmids && pmids.length) {
      const pubmedArticles = await fetchPubmedAbstracts(pmids);
      for (const art of pubmedArticles) {
        const artId = `pmid:${art.pmid}`;
        if (seenIds.has(artId)) continue;
        seenIds.add(artId);

        const combinedText = `${art.title || ''}. ${art.text || ''}`;
        const paragraphs = combinedText.split(PARA_SPLIT_REGEX);
        for (const p of paragraphs) {
          const subjectGenes = paragraphSubjectGenes(p, allGenesInList);
          if (!subjectGenes.length) continue;

          const sentContexts = sentenceContextMatches(p, gene, 2);
          const contexts = sentContexts.length ? sentContexts : [p];

          const evidences = [];
          for (const c of contexts) {
            const effects = detectEffect(c);
            for (const subjGene of subjectGenes) {
              evidences.push({ gene: subjGene, context: c, effects, source: 'pubmed', id: art.pmid });
            }
          }
          if (evidences.length) {
            results.articles.push({ id: art.pmid, source: 'pubmed', title: art.title, evidence: evidences });
          }
        }
      }
    }
  } catch (err) {
    console.error(`[ERROR] PubMed handling failed for ${gene}:`, err);
  }

  try {
    const pmcids = await searchPmc(gene);
    if (pmcids && pmcids.length) {
      const pmcArticles = await fetchPmcFulltext(pmcids);
      for (const art of pmcArticles) {
        const artId = `pmcid:${art.pmcid || hashString(art.title || '')}`;
        if (seenIds.has(artId)) continue;
        seenIds.add(artId);

        const paragraphs = art.paragraphs || [];
        for (const p of paragraphs) {
          const subjectGenes = paragraphSubjectGenes(p, allGenesInList);
          if (!subjectGenes.length) continue;

          const sentContexts = sentenceContextMatches(p, gene, 2);
          const contexts = sentContexts.length ? sentContexts : [p];

          const evidences = [];
          for (const c of contexts) {
            const effects = detectEffect(c);
            for (const subjGene of subjectGenes) {
              evidences.push({ gene: subjGene, context: c, effects, source: 'pmc', id: art.pmcid });
            }
          }
          if (evidences.length) {
            results.articles.push({ id: art.pmcid, source: 'pmc', title: art.title, evidence: evidences });
          }
        }
      }
    }
  } catch (err) {
    console.error(`[ERROR] PMC handling failed for ${gene}:`, err);
  }

  results.found_articles = results.articles.length;
  console.info(`[INFO] Done ${gene} -> ${results.found_articles} article(s) with evidence found`);
  return results;
}

function interpretEvidence(gene, evidenceText) {
  const inferred = { length: [], frequency: [] };
  const clauses = evidenceText.split(/[.;]|,?\s+(while|whereas|but)\s+/i);
  for (const clause of clauses) {
    const context = (clause || '').toLowerCase();
    if (!new RegExp(`\\b${escapeRegExp(gene.toLowerCase())}\\b`).test(context)) continue;

    const negation = /\b(no|not|did not|none|unchanged|unaltered|without)\b/.test(context);
    const isLoss = INFERENCE_LEXICON.MANIPULATION.LOSS.some(kw => context.includes(kw));
    const isGain = INFERENCE_LEXICON.MANIPULATION.GAIN.some(kw => context.includes(kw));

    function inferRole(phenotypeList, lossRole = 'PROMOTES', gainRole = 'INHIBITS') {
      const roles = [];
      for (const kw of phenotypeList) {
        if (context.includes(kw)) {
          if (negation) roles.push('NEUTRAL');
          else {
            if (isLoss) roles.push(lossRole);
            if (isGain) roles.push(gainRole);
          }
        }
      }
      return roles;
    }

    inferred.length.push(...inferRole(INFERENCE_LEXICON.PHENOTYPE.LENGTH_DECREASE, 'PROMOTES', 'INHIBITS'));
    inferred.length.push(...inferRole(INFERENCE_LEXICON.PHENOTYPE.LENGTH_INCREASE, 'INHIBITS', 'PROMOTES'));
    inferred.length.push(...inferRole(INFERENCE_LEXICON.PHENOTYPE.LENGTH_NEUTRAL, 'NEUTRAL', 'NEUTRAL'));
    inferred.length.push(...inferRole(INFERENCE_LEXICON.PHENOTYPE.LENGTH_VARIABLE, 'VARIABLE', 'VARIABLE'));

    inferred.frequency.push(...inferRole(INFERENCE_LEXICON.PHENOTYPE.FREQ_DECREASE, 'PROMOTES', 'INHIBITS'));
    inferred.frequency.push(...inferRole(INFERENCE_LEXICON.PHENOTYPE.FREQ_INCREASE, 'INHIBITS', 'PROMOTES'));
    inferred.frequency.push(...inferRole(INFERENCE_LEXICON.PHENOTYPE.FREQ_NEUTRAL, 'NEUTRAL', 'NEUTRAL'));
  }

  inferred.length = Array.from(new Set(inferred.length));
  inferred.frequency = Array.from(new Set(inferred.frequency));
  return inferred;
}

function generateFinalSummary(roles) {
  if (!roles || roles.length === 0) return 'No specific data';
  const counts = roles.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
  const promotes = counts['PROMOTES'] || 0;
  const inhibits = counts['INHIBITS'] || 0;
  const neutral = counts['NEUTRAL'] || 0;
  const variable = counts['VARIABLE'] || 0;

  if (promotes > 0 && inhibits > 0) return 'Conflicting Data';
  if (promotes > 0) return 'Promotes / Maintains';
  if (inhibits > 0) return 'Inhibits / Restricts';
  if (variable > 0) return 'Affects Morphology/Variability';
  if (neutral > 0) return 'No clear role';
  return 'Unclear';
}

// Helper utilities
function escapeRegExp(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function hashString(str) { // simple hash fallback
  let h = 0; for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i) | 0; return Math.abs(h);
}

// High-level runner (runs searches for list of genes)
async function runGeneBatch(genes, opts = { parallel: 2 }) {
  const results = {};
  for (let i = 0; i < genes.length; i++) {
    const gene = genes[i];
    try {
      const res = await processGene(gene, genes);
      results[gene] = res;
    } catch (err) {
      console.error(`Gene ${gene} failed:`, err);
      results[gene] = { gene, articles: [], error: String(err) };
    }
  }
  const output = { metadata: { timestamp: new Date().toISOString(), genes_processed: genes.length }, results };
  return output;
}

// Export for Node/browser
if (typeof module !== 'undefined' && module.exports) module.exports = { runGeneBatch, processGene, interpretEvidence, generateFinalSummary };

// FILE: report.html
// This is the updated HTML integration. Save as report.html and include ciliai.js in the same directory.

/*
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cilia Interpretation Report</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="bg-gray-100 text-gray-800">

    <div class="container mx-auto p-4 md:p-8">
        <header class="text-center mb-8">
            <h1 class="text-4xl font-bold text-gray-900">Cilia Gene Interpretation Report</h1>
            <p class="text-lg text-gray-600 mt-2">Load your JSON results file for an automated literature analysis and functional inference. Or run live queries (server/proxy recommended).</p>
        </header>

        <main class="bg-white p-6 md:p-8 rounded-2xl shadow-lg mb-8">
            <h2 class="text-2xl font-semibold text-gray-800 mb-4">Instructions</h2>
            <div class="space-y-4 text-gray-700">
                <div class="flex items-start space-x-4">
                    <div class="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">1</div>
                    <div>
                        <h3 class="font-semibold">Run the JavaScript Engine (optional)</h3>
                        <p>If you have a server or Node environment, you can run live Entrez queries via the included <code class="bg-gray-200 p-1 rounded">ciliai.js</code>. Browser calls may be blocked by CORS—use a proxy when needed.</p>
                        <div class="mt-2 flex gap-2">
                          <input id="genes-input" class="p-2 border rounded w-full" placeholder="Enter gene symbols separated by commas (e.g. ARL13B, IFT140)" />
                          <button id="run-genes" class="px-4 py-2 bg-blue-600 text-white rounded">Run</button>
                        </div>
                    </div>
                </div>
                <div class="flex items-start space-x-4">
                    <div class="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">2</div>
                    <div>
                        <h3 class="font-semibold">Load the Results File</h3>
                        <p>Once a results JSON is available (from a run or precomputed), load it below to generate the report.</p>
                        <input type="file" id="file-input" class="mt-4 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                    </div>
                </div>
            </div>
        </main>
        
        <div id="report-container" class="hidden">
             <h2 class="text-3xl font-bold text-gray-900 mb-6 text-center">Generated Analysis Summary</h2>
             <div class="bg-white rounded-2xl shadow-lg overflow-x-auto">
                <table class="min-w-full">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="p-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Gene</th>
                            <th class="p-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Ensembl ID</th>
                            <th class="p-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Inferred Role (Cilia Length)</th>
                            <th class="p-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Inferred Role (Ciliogenesis)</th>
                            <th class="p-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">References</th>
                        </tr>
                    </thead>
                    <tbody id="report-body" class="divide-y divide-gray-200">
                    </tbody>
                </table>
            </div>
        </div>

        <div id="no-results-message" class="text-center text-gray-500 py-12 hidden">
            <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900">No results to display</h3>
            <p class="mt-1 text-sm text-gray-500">Please load a valid results file to begin.</p>
        </div>
    </div>

    <script>
    // The front-end interpretation engine mirrors the Python logic and uses the INFERENCE_LEXICON defined earlier.
    const fileInput = document.getElementById('file-input');
    const reportContainer = document.getElementById('report-container');
    const reportBody = document.getElementById('report-body');
    const noResultsMessage = document.getElementById('no-results-message');
    const runBtn = document.getElementById('run-genes');
    const genesInput = document.getElementById('genes-input');

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                displayInterpretation(data);
            } catch (err) {
                alert('Error parsing JSON file. Please make sure it is a valid results file.');
                console.error(err);
            }
        };
        reader.readAsText(file);
    });

    async function fetchEnsemblId(geneSymbol) {
        try {
            const response = await fetch(`https://rest.ensembl.org/lookup/symbol/homo_sapiens/${encodeURIComponent(geneSymbol)}?content-type=application/json`);
            if (!response.ok) return 'Not Found';
            const data = await response.json();
            return data.id || 'Not Found';
        } catch (error) {
            console.error(`Could not fetch Ensembl ID for ${geneSymbol}:`, error);
            return 'Error';
        }
    }

    async function displayInterpretation(data) {
        if (!data || !data.results) {
            noResultsMessage.classList.remove('hidden');
            reportContainer.classList.add('hidden');
            return;
        }
        reportBody.innerHTML = '';
        const genes = Object.values(data.results);
        if (genes.length === 0) {
             noResultsMessage.classList.remove('hidden');
             reportContainer.classList.add('hidden');
             return;
        }
        noResultsMessage.classList.add('hidden');
        reportContainer.classList.remove('hidden');
        
        const rowPromises = genes.map(async geneData => {
            const interpretation = interpretGeneData(geneData);
            const ensemblId = await fetchEnsemblId(interpretation.gene).catch(()=>'Not Found');
            return `
                <tr class="hover:bg-gray-50">
                    <td class="p-4 font-bold text-gray-900">${escapeHtml(interpretation.gene)}</td>
                    <td class="p-4 font-mono text-sm text-gray-600">${ensemblId}</td>
                    <td class="p-4 text-gray-700">${interpretation.lengthSummary}</td>
                    <td class="p-4 text-gray-700">${interpretation.frequencySummary}</td>
                    <td class="p-4 text-sm">${interpretation.references}</td>
                </tr>
            `;
        });
        const rowsHtml = await Promise.all(rowPromises);
        reportBody.innerHTML = rowsHtml.join('');
    }

    function hasQuantitativeData(text) {
        return /\b(\d+(\.\d+)?\s?(µm|%|vs|±|twofold))\b/i.test(text);
    }

    function interpretGeneData(geneData) {
        const inferredRoles = { gene: geneData.gene, length: [], frequency: [], references: new Set() };
        if (!geneData.articles || geneData.articles.length === 0) {
             return { gene: geneData.gene, lengthSummary: 'No data found', frequencySummary: 'No data found', references: 'N/A' };
        }

        geneData.articles.forEach(article => {
            let evidenceFoundInArticle = false;
            if (!article.evidence) return;

            article.evidence.forEach(ev => {
                const clauses = ev.context.split(/,?\s+(while|whereas|but)\s+/i);
                clauses.forEach(clause => {
                    const context = clause.toLowerCase();
                    if (!context.includes(geneData.gene.toLowerCase())) return;

                    evidenceFoundInArticle = true;
                    const isLossOfFunction = INFERENCE_LEXICON.MANIPULATION.LOSS.some(kw => context.includes(kw));
                    const isGainOfFunction = INFERENCE_LEXICON.MANIPULATION.GAIN.some(kw => context.includes(kw));
                    const weight = hasQuantitativeData(context) ? 3 : 1;

                    const pushRole = (role, category) => { for(let i = 0; i < weight; i++) inferredRoles[category].push(role); };

                    // LENGTH
                    if (INFERENCE_LEXICON.PHENOTYPE.LENGTH_DECREASE.some(kw => context.includes(kw))) {
                        if (isLossOfFunction) pushRole('PROMOTES', 'length');
                        if (isGainOfFunction) pushRole('INHIBITS', 'length');
                    }
                    if (INFERENCE_LEXICON.PHENOTYPE.LENGTH_INCREASE.some(kw => context.includes(kw))) {
                        if (isLossOfFunction) pushRole('INHIBITS', 'length');
                        if (isGainOfFunction) pushRole('PROMOTES', 'length');
                    }
                    if (INFERENCE_LEXICON.PHENOTYPE.LENGTH_NEUTRAL.some(kw => context.includes(kw))) { pushRole('NEUTRAL', 'length'); }
                    if (INFERENCE_LEXICON.PHENOTYPE.LENGTH_VARIABLE.some(kw => context.includes(kw))) { pushRole('VARIABLE', 'length'); }

                    // FREQUENCY
                    if (INFERENCE_LEXICON.PHENOTYPE.FREQ_DECREASE.some(kw => context.includes(kw))) {
                        if (isLossOfFunction) pushRole('PROMOTES', 'frequency');
                        if (isGainOfFunction) pushRole('INHIBITS', 'frequency');
                    }
                    if (INFERENCE_LEXICON.PHENOTYPE.FREQ_INCREASE.some(kw => context.includes(kw))) {
                        if (isLossOfFunction) pushRole('INHIBITS', 'frequency');
                        if (isGainOfFunction) pushRole('PROMOTES', 'frequency');
                    }
                    if (INFERENCE_LEXICON.PHENOTYPE.FREQ_NEUTRAL.some(kw => context.includes(kw))) { pushRole('NEUTRAL', 'frequency'); }
                });
            });

            if (evidenceFoundInArticle && article.id) {
                let refLink = '#';
                let displayId = article.id;
                const source = article.source || 'unknown';
                if (source === 'pmc') {
                    const numericId = String(article.id).replace(/PMC/i, '');
                    displayId = `PMC${numericId}`;
                    refLink = `https://www.ncbi.nlm.nih.gov/pmc/articles/${displayId}/`;
                } else if (source === 'pubmed') {
                    refLink = `https://pubmed.ncbi.nlm.nih.gov/${article.id}/`;
                }
                inferredRoles.references.add(`<a href="${refLink}" target="_blank" class="text-blue-600 hover:underline">${displayId}</a>`);
            }
        });

        return { gene: geneData.gene, lengthSummary: generateFinalSummary(inferredRoles.length), frequencySummary: generateFinalSummary(inferredRoles.frequency), references: Array.from(inferredRoles.references).join(', ') || 'N/A' };
    }

    function generateFinalSummary(roles) {
        if (!roles || roles.length === 0) return `<span class="text-gray-500">No specific data</span>`;
        const counts = roles.reduce((acc, val) => { acc[val] = (acc[val] || 0) + 1; return acc; }, {});
        const promotes = counts['PROMOTES'] || 0; const inhibits = counts['INHIBITS'] || 0; const neutral = counts['NEUTRAL'] || 0; const variable = counts['VARIABLE'] || 0;
        if (neutral > 0 && promotes === 0 && inhibits === 0 && variable === 0) return `<span class="font-semibold text-blue-600">No effect / Neutral (${neutral})</span>`;
        if (promotes > 0 && inhibits > 0) return `<span class="font-semibold text-yellow-700">Overexpression ➝ Promotes / Elongates;<br/>Loss ➝ Inhibits / Causes Loss</span>`;
        if (promotes > 0) return `<span class="font-semibold text-green-600">Promotes / Maintains (${promotes})</span>`;
        if (inhibits > 0) return `<span class="font-semibold text-red-600">Inhibits / Restricts (${inhibits})</span>`;
        if (variable > 0) return `<span class="font-semibold text-purple-600">Variable / Mixed phenotype (${variable})</span>`;
        return `<span class="text-gray-500">Unclear</span>`;
    }

    function escapeHtml(unsafe) {
        return unsafe.replace(/[&<"'>]/g, function(m) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[m]; });
    }

    // Optional: Run live queries (note: CORS may block entrez calls from browser)
    runBtn.addEventListener('click', async () => {
        const genesRaw = genesInput.value.trim();
        if (!genesRaw) return alert('Please enter at least one gene symbol.');
        const genes = genesRaw.split(',').map(g => g.trim()).filter(Boolean);
        // Attempt to run runGeneBatch via ciliai.js if available globally (server mode)
        if (window.runGeneBatch) {
            try {
                const data = await window.runGeneBatch(genes);
                displayInterpretation(data);
            } catch (err) {
                alert('Live run failed. See console for details. Consider running from Node/server or uploading a precomputed file.');
                console.error(err);
            }
        } else {
            alert('Live queries from browser are likely blocked by CORS. Use a server-side proxy or run ciliai.js in Node.');
        }
    });

    </script>
</body>
</html>
*/
