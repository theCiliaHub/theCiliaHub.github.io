/* ciliai_literature_retriever.js
   Enhanced retrieval layer for CiliAI - extracts cilia-related full-text snippets
   for each gene and ranks them by relevance. Designed to plug into the existing
   CiliAI front-end code supplied earlier.

   Integration notes:
   - Exported functions at bottom mirror naming style used in CiliAI.
   - Uses existing CONFIG, INFERENCE_LEXICON and utility functions (sleep, makeApiRequest)
   - Attempts full-text extraction from PMC XML returned by efetch (db=pmc, retmode=xml)
   - Falls back to PubMed abstract when full text isn't available.
   - Caches retrieved full-text blobs in IndexedDB/localStorage (configurable) to avoid repeated fetches.

   Limitations & recommendations:
   - Paywalled publisher PDFs are not accessible via NCBI efetch; for those, consider integrating
     Europe PMC full-text or publisher APIs (requires API keys/agreements).
   - This code keeps all network calls synchronous with the main thread via async/await —
     consider moving heavy parsing into a web worker for large batches.
*/

// ================================================================
// Configuration overrides / additions specific to full-text retrieval
// ================================================================
const FT_CONFIG = {
    CACHE_ENABLED: true,
    CACHE_TTL_MS: 1000 * 60 * 60 * 24 * 14, // 14 days
    USE_INDEXEDDB: false, // set true for larger caches; fallback to localStorage
    MAX_SNIPPET_LENGTH: 600, // characters
    MIN_PARAGRAPH_SCORE: 0.5, // threshold to include snippet
    PROXIMITY_WINDOW: 120, // characters to compute gene-keyword proximity
};

// ------------------------------------------------
// Simple in-memory cache + optional localStorage
// ------------------------------------------------
const FTCache = {
    _mem: new Map(),
    get(key) {
        if (this._mem.has(key)) return this._mem.get(key);
        if (!FT_CONFIG.CACHE_ENABLED) return null;
        try {
            const raw = localStorage.getItem(`ciliai_ft_${key}`);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (Date.now() - parsed._ts > FT_CONFIG.CACHE_TTL_MS) {
                localStorage.removeItem(`ciliai_ft_${key}`);
                return null;
            }
            this._mem.set(key, parsed.value);
            return parsed.value;
        } catch (e) {
            return null;
        }
    },
    set(key, value) {
        this._mem.set(key, value);
        if (!FT_CONFIG.CACHE_ENABLED) return;
        try {
            const toStore = { _ts: Date.now(), value };
            localStorage.setItem(`ciliai_ft_${key}`, JSON.stringify(toStore));
        } catch (e) {
            // ignore storage errors
        }
    }
};

// ================================================================
// Full-text fetchers & parsers
// ================================================================

async function fetchFullTextPMC(pmcid) {
    // pmcid may come with or without leading 'PMC'
    const normalized = pmcid.toString().replace(/^PMC/i, '');
    const cacheKey = `pmc_${normalized}`;
    const cached = FTCache.get(cacheKey);
    if (cached) return cached;

    const params = {
        db: 'pmc',
        id: normalized,
        retmode: 'xml',
        tool: CONFIG.TOOL_NAME,
        email: CONFIG.USER_EMAIL
    };

    const resp = await makeApiRequest(CONFIG.EFETCH_URL, params, `PMC fulltext fetch ${pmcid}`);
    const xmlText = await resp.text();

    // store raw XML in cache and return
    FTCache.set(cacheKey, xmlText);
    return xmlText;
}

function xmlToDoc(xmlText) {
    const parser = new DOMParser();
    return parser.parseFromString(xmlText, 'application/xml');
}

function extractParagraphsFromPMCXml(xmlDoc) {
    // Extract relevant textual nodes from the <body>
    const paragraphs = [];
    try {
        const body = xmlDoc.querySelector('body') || xmlDoc;
        if (!body) return paragraphs;

        // Pull p, sec (section headings + text), fig captions, and table captions
        const nodes = body.querySelectorAll('p, sec, caption, title');
        nodes.forEach(n => {
            let txt = n.textContent || '';
            txt = txt.replace(/\s+/g, ' ').trim();
            if (txt.length > 30) paragraphs.push(txt);
        });
    } catch (e) {
        console.warn('[WARN] extractParagraphsFromPMCXml failed', e);
    }
    return paragraphs;
}

// Extra helper: take a long paragraph and split into sub-sentences that stay intelligible
function chunkParagraph(paragraph, maxLen = 800) {
    if (paragraph.length <= maxLen) return [paragraph];
    // naive split at sentence boundaries
    const parts = paragraph.split(/(?<=[.!?])\s+/);
    const out = [];
    let buffer = '';
    for (const p of parts) {
        if ((buffer + ' ' + p).length <= maxLen) {
            buffer = (buffer + ' ' + p).trim();
        } else {
            if (buffer) out.push(buffer.trim());
            buffer = p.trim();
        }
    }
    if (buffer) out.push(buffer.trim());
    return out;
}

// ================================================================
// Relevance scoring utilities
// ================================================================

function scoreParagraphForGene(paragraph, gene, keywordList = CONFIG.LOCAL_ANALYSIS_KEYWORDS) {
    const text = paragraph.toLowerCase();
    const geneLower = gene.toLowerCase();

    // 1) Direct mention score
    const geneMatches = (text.match(new RegExp(`\\b${escapeRegExp(geneLower)}\\b`, 'g')) || []).length;
    const geneScore = Math.min(3, geneMatches) * 1.0; // up to 3 points

    // 2) Keyword density
    let keywordHits = 0;
    for (const kw of keywordList) if (text.includes(kw.toLowerCase())) keywordHits++;
    const keywordScore = Math.min(5, keywordHits) / Math.max(1, keywordList.length) * 3.0; // scaled to 0-3

    // 3) Proximity: how close are gene mentions and keyword mentions
    const firstGeneIdx = text.indexOf(geneLower);
    let minProx = Infinity;
    if (firstGeneIdx !== -1) {
        for (const kw of keywordList) {
            const kidx = text.indexOf(kw.toLowerCase());
            if (kidx !== -1) minProx = Math.min(minProx, Math.abs(kidx - firstGeneIdx));
        }
    }
    const proximityScore = (minProx === Infinity) ? 0 : Math.max(0, (FT_CONFIG.PROXIMITY_WINDOW - minProx) / FT_CONFIG.PROXIMITY_WINDOW) * 2.0; // 0-2

    // 4) Quantitative data bonus
    const quantBonus = hasQuantitativeData(text) ? 1.5 : 0;

    // 5) Manipulation language bonus - presence of words implying loss/gain
    const manip = INFERENCE_LEXICON.MANIPULATION.LOSS.concat(INFERENCE_LEXICON.MANIPULATION.GAIN);
    const manipHits = manip.some(m => text.includes(m.toLowerCase())) ? 1.0 : 0;

    const raw = geneScore + keywordScore + proximityScore + quantBonus + manipHits; // approx 0 - 10
    const normalized = Math.min(1, raw / 8); // scale to 0-1
    return { raw, normalized, breakdown: { geneScore, keywordScore, proximityScore, quantBonus, manipHits } };
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ================================================================
// Evidence extraction pipeline (core function)
// ================================================================

async function extractEvidenceFromPMCArticle(pmcid, gene, allGenes) {
    const xmlText = await fetchFullTextPMC(pmcid);
    const xmlDoc = xmlToDoc(xmlText);
    const paragraphs = extractParagraphsFromPMCXml(xmlDoc);

    const candidates = [];

    for (const para of paragraphs) {
        // also chunk long paragraphs for better scoring
        const chunks = chunkParagraph(para, 800);
        for (const chunk of chunks) {
            const subjects = paragraphSubjectGenes(chunk, allGenes);
            if (!subjects.includes(gene)) continue;
            // quick keyword filter
            if (!CONFIG.LOCAL_ANALYSIS_KEYWORDS.some(kw => chunk.toLowerCase().includes(kw))) continue;

            const score = scoreParagraphForGene(chunk, gene);
            if (score.normalized < FT_CONFIG.MIN_PARAGRAPH_SCORE) continue;

            // extract a short snippet (bounded length) keeping the gene in the middle
            const snippet = makeSnippetAroundGene(chunk, gene, FT_CONFIG.MAX_SNIPPET_LENGTH);
            const inferredRoles = interpretEvidence(gene, chunk);

            candidates.push({ id: pmcid, source: 'PMC', context: chunk, snippet, score, inferredRoles, refLink: `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcid}/` });
        }
    }

    // sort candidates by raw score desc
    candidates.sort((a, b) => b.score.raw - a.score.raw);
    return candidates;
}

function makeSnippetAroundGene(text, gene, maxLen) {
    const idx = text.toLowerCase().indexOf(gene.toLowerCase());
    if (idx === -1) return text.substring(0, maxLen) + (text.length > maxLen ? '…' : '');

    const half = Math.floor(maxLen / 2);
    const start = Math.max(0, idx - half + gene.length);
    let snippet = text.substring(start, start + maxLen);
    if (start > 0) snippet = '…' + snippet;
    if (start + maxLen < text.length) snippet = snippet + '…';
    return snippet;
}

// ================================================================
// High-level orchestrator that replaces/enhances the PMC block in analyzeGeneViaAPI
// ================================================================

async function analyzeGeneViaFullTextPMC(gene, pmcids, allGenes) {
    const results = [];
    for (const pmc of pmcids) {
        try {
            const evidence = await extractEvidenceFromPMCArticle(pmc, gene, allGenes);
            // keep top N from each article
            if (evidence.length > 0) results.push(...evidence.slice(0, 6));
            // be kind to Entrez
            await sleep(CONFIG.ENTREZ_SLEEP);
        } catch (e) {
            console.warn(`[WARN] Failed fulltext parse for PMC${pmc}:`, e.message || e);
        }
    }

    // global ranking and deduplication by snippet start
    const uniq = new Map();
    for (const ev of results.sort((a, b) => b.score.raw - a.score.raw)) {
        const key = ev.context.substring(0, 140);
        if (!uniq.has(key)) uniq.set(key, ev);
    }

    return Array.from(uniq.values()).slice(0, CONFIG.ARTICLES_PER_GENE);
}

// ================================================================
// Helper: attempt to extract PMCIDs from previously fetched PMC search XML/JSON
// (Used when analyzeGeneViaAPI already retrieved a list of pmc ids). If only PMIDs exist,
// attempt to map to PMC via ELink (not implemented here — placeholder)
// ================================================================

async function mapPmidsToPmcids(pmids) {
    // For now go to Entrez elink: dbfrom=pubmed&db=pmc&id=pmids
    // Return list of PMCIDs (strings without PMC prefix) when available.
    try {
        if (!pmids || pmids.length === 0) return [];
        const params = {
            dbfrom: 'pubmed',
            db: 'pmc',
            id: pmids.join(','),
            retmode: 'json',
            tool: CONFIG.TOOL_NAME,
            email: CONFIG.USER_EMAIL
        };
        const resp = await makeApiRequest('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi', params, 'PMID->PMCID mapping');
        const data = await resp.json();
        // parse linksets
        const pmcids = [];
        const linksets = data?.linksets || [];
        for (const ls of linksets) {
            const links = ls?.linksetdbs?.flatMap(ldb => ldb?.links || []) || [];
            for (const l of links) {
                // l might be '1234567'
                pmcids.push(l.replace(/^PMC/i, ''));
            }
        }
        return [...new Set(pmcids)];
    } catch (e) {
        console.warn('[WARN] mapPmidsToPmcids failed', e.message || e);
        return [];
    }
}

// ================================================================
// Public integrator: new analyzeGeneViaAPI replacement logic that tries full text first
// and falls back to original behavior where necessary. Keep compatibility with earlier API.
// ================================================================

async function analyzeGeneViaAPI_FT(gene, resultCard, allGenes) {
    let foundEvidence = [];
    let seenIds = new Set();

    try {
        // 1) PubMed Search - get PMIDs, try to map to PMCIDs for full-text access
        const searchParamsPubMed = {
            db: 'pubmed',
            term: buildQueryPubMed(gene),
            retmode: 'json',
            retmax: (CONFIG.ARTICLES_PER_GENE * 2).toString(), // search wider to find pmc mapping
            tool: CONFIG.TOOL_NAME,
            email: CONFIG.USER_EMAIL
        };
        const searchRespPubMed = await makeApiRequest(CONFIG.ESEARCH_URL, searchParamsPubMed, `PubMed search ${gene}`);
        const searchDataPubMed = await searchRespPubMed.json();
        const pmids = searchDataPubMed?.esearchresult?.idlist || [];

        // Map PMIDs -> PMCIDs
        const pmcids = await mapPmidsToPmcids(pmids);

        // 2) Try full-text extraction for PMCIDs
        if (pmcids.length > 0) {
            const ftEvidence = await analyzeGeneViaFullTextPMC(gene, pmcids.slice(0, CONFIG.ARTICLES_PER_GENE), allGenes);
            ftEvidence.forEach(ev => {
                if (!seenIds.has(`pmc:${ev.id}`)) {
                    seenIds.add(`pmc:${ev.id}`);
                    foundEvidence.push(ev);
                }
            });
        }

        // 3) If not enough evidence found, fall back to PubMed abstract fetch (original behavior)
        if (foundEvidence.length < 3 && pmids.length > 0) {
            await sleep(CONFIG.ENTREZ_SLEEP);
            const fetchParamsPubMed = {
                db: 'pubmed',
                id: pmids.slice(0, Math.min(pmids.length, CONFIG.ARTICLES_PER_GENE)).join(','),
                retmode: 'xml',
                rettype: 'abstract',
                tool: CONFIG.TOOL_NAME,
                email: CONFIG.USER_EMAIL
            };
            const fetchRespPubMed = await makeApiRequest(CONFIG.EFETCH_URL, fetchParamsPubMed, `PubMed fetch ${gene}`);
            const xmlText = await fetchRespPubMed.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
            const articles = xmlDoc.querySelectorAll('PubmedArticle');

            articles.forEach(article => {
                const pmid = article.querySelector('MedlineCitation > PMID')?.textContent;
                if (seenIds.has(`pmid:${pmid}`)) return;
                seenIds.add(`pmid:${pmid}`);

                const title = article.querySelector('ArticleTitle')?.textContent || '';
                const abstractText = Array.from(article.querySelectorAll('Abstract > AbstractText')).map(el => el.textContent).join(' ');
                const combinedText = `${title}. ${abstractText}`;

                combinedText.split(/\n{2,}/).forEach(p => {
                    if (paragraphSubjectGenes(p, allGenes).includes(gene) && CONFIG.LOCAL_ANALYSIS_KEYWORDS.some(kw => p.toLowerCase().includes(kw))) {
                        const inferredRoles = interpretEvidence(gene, p);
                        if (inferredRoles.length.length > 0 || inferredRoles.frequency.length > 0) {
                            foundEvidence.push({ id: pmid, source: 'PubMed', context: p, inferredRoles, refLink: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` });
                        }
                    }
                });
            });
        }

    } catch (error) {
        console.error(`[ERROR] FT Literature search failed for ${gene}:`, error);
        const errorEl = resultCard?.querySelector('.status-searching');
        if (errorEl) {
            errorEl.textContent = 'Literature Search Failed';
            errorEl.className = 'status-not-found';
        }
    }

    // Deduplicate evidence based on the start of the context string
    const uniqueContexts = new Set();
    return foundEvidence.filter(ev => {
        const contextStart = ev.context.substring(0, 150).trim();
        if (uniqueContexts.has(contextStart)) return false;
        uniqueContexts.add(contextStart);
        return true;
    });
}



// Notes for integrators:
// Replace calls to analyzeGeneViaAPI(gene, resultCard, allGenes) with analyzeGeneViaAPI_FT(gene, resultCard, allGenes)
// in runAnalysis() if you want full-text-first behaviour. The fallback preserves original behaviour when
// full text is not available or evidence is scarce.


// ============================================================================
// CONFIGURATION - Enhanced from literature_miner_engine.py
// ============================================================================

const CONFIG = {
    ESEARCH_URL: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
    EFETCH_URL: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
    USER_EMAIL: "user@example.com", // It's good practice for users to know this can be changed
    TOOL_NAME: "CiliAI/2.0",

    API_QUERY_KEYWORDS: [
        "cilia", "ciliary", "cilia length", "ciliary length", "shorter cilia",
        "longer cilia", "ciliogenesis", "ciliation", "loss of cilia", "fewer cilia",
        "impaired ciliogenesis", "cilia assembly", "fluid flow", "mucociliary",
        "multiciliated", "primary cilium", "axoneme", "basal body"
    ],

    LOCAL_ANALYSIS_KEYWORDS: [
        "cilia", "ciliary", "cilium", "ciliogenesis", "ciliation", "axoneme",
        "basal body", "cilia length", "shorter", "shortened", "longer", "fewer",
        "reduction", "reduced", "decrease", "increased", "increase", "flow",
        "fluid flow", "mucociliary", "multiciliated", "extracellular fluid",
        "bead", "beads", "displacement", "cilia-generated", "mucociliary clearance"
    ],

    ARTICLES_PER_GENE: 40,
    MAX_CONCURRENT: 2,
    REQUEST_TIMEOUT: 30000,
    ENTREZ_SLEEP: 350,
    RETRY_ATTEMPTS: 3,
    BACKOFF_FACTOR: 500
};

// Remove duplicates from keywords
CONFIG.LOCAL_ANALYSIS_KEYWORDS = [...new Set(CONFIG.LOCAL_ANALYSIS_KEYWORDS)];

// ============================================================================
// INFERENCE LEXICON
// ============================================================================

const INFERENCE_LEXICON = {
    MANIPULATION: {
        LOSS: [
            'depletion', 'deficient', 'loss of', 'knockout', 'ko', 'mutant',
            'silencing', 'abrogated', 'disruption', 'ablation', 'null',
            'knockdown', 'kd', 'impaired', 'mutation', 'defects', 'lacking',
            'deleted', 'frameshift', 'nonsense', 'homozygous', 'truncating',
            'generated mutants', 'CRISPR/Cas9', 'loss-of-function', 'LOF',
            'shRNAs targeting'
        ],
        GAIN: [
            'overexpression', 'ectopic expression', 'transfection with wild-type',
            'rescued', 'restoring', 'treatment with', 'application of', 'expressing',
            'gain-of-function', 'GOF', 'constitutively active', 'stabilized',
            'hyperactive', 'induced expression'
        ]
    },
    PHENOTYPE: {
        LENGTH_DECREASE: [
            'shorter', 'shortened', 'decrease in length', 'reduced length',
            'reduction in length', 'decreased the length', 'diminished length',
            'loss of axonemal length', 'stunted', 'hypoplastic cilia'
        ],
        LENGTH_INCREASE: [
            'longer', 'elongated', 'increase in length', 'increased ciliary length',
            'elongation of', 'twofold increase in the average length',
            'hyperelongated', 'over-extended', 'significantly lengthened'
        ],
        LENGTH_NEUTRAL: [
            'length remained unchanged', 'no difference in the primary ciliary length',
            'length was not altered', 'length was similar',
            'did not significantly alter cilia length', 'unchanged ciliary length',
            'not statistically different', 'comparable length',
            'cilia length remained unchanged'
        ],
        LENGTH_VARIABLE: [
            'altered cilia length', 'abnormal morphology', 'variations in cilia size',
            'diverse', 'broader length distribution', 'greater variation',
            'heterogeneous length', 'mixed phenotype', 'inconsistent length changes'
        ],
        FREQ_DECREASE: [
            'fewer', 'reduced number', 'decrease in number', 'loss of cilia',
            'absence of primary cilia', 'ciliogenesis defect', 'impaired ciliogenesis',
            'suppresses cilium formation', 'required for cilia formation',
            'lower rate of ciliated', 'failed to form',
            'deficit in de novo cilia formation', 'diminished',
            'abrogated ciliogenesis', 'failure of ciliogenesis',
            'prevented cilia assembly', 'ciliation was abolished',
            'significant reduction in ciliation', 'markedly decreased frequency',
            'number of ciliated cells decreased'
        ],
        FREQ_INCREASE: [
            'increase in the percentage of ciliated',
            'increased the numbers of ciliated',
            'increase in the percent of ciliated',
            'multiciliogenesis', 'induced primary ciliogenesis',
            'hyper-ciliation', 'enhanced ciliogenesis',
            'promoted cilium formation', 'stimulated ciliogenesis'
        ],
        FREQ_NEUTRAL: [
            'did not affect ciliation levels', 'normal rate of ciliation',
            'ciliation unaffected', 'no significant change in ciliation',
            'comparable fraction of ciliated cells'
        ]
    }
};

// ============================================================================
// EXPERT DATABASE
// ============================================================================

const CILI_AI_DB = {
    "HDAC6": {
        "evidence": [{
            "id": "21873644",
            "source": "pubmed",
            "context": "...loss of HDAC6 results in hyperacetylation of tubulin and leads to the formation of longer, more stable primary cilia in renal epithelial cells.",
            "refLink": "https://pubmed.ncbi.nlm.nih.gov/21873644/"
        }]
    },
    "IFT88": {
        "evidence": [{
            "id": "10882118",
            "source": "pubmed",
            "context": "Mutations in IFT88 (polaris) disrupt intraflagellar transport, leading to a failure in cilia assembly and resulting in severely shortened or absent cilia.",
            "refLink": "https://pubmed.ncbi.nlm.nih.gov/10882118/"
        }]
    },
    "ARL13B": {
        "evidence": [{
            "id": "21940428",
            "source": "pubmed",
            "context": "The small GTPase ARL13B is critical for ciliary structure; its absence leads to stunted cilia with abnormal morphology and axonemal defects.",
            "refLink": "https://pubmed.ncbi.nlm.nih.gov/21940428/"
        }]
    }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function makeApiRequest(url, params, description, retries = CONFIG.RETRY_ATTEMPTS) {
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = `${url}?${queryString}`;

    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

            const response = await fetch(fullUrl, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.status === 429) {
                const waitTime = CONFIG.BACKOFF_FACTOR * Math.pow(2, i);
                console.warn(`[WARN] Rate limited on ${description}. Sleeping ${waitTime}ms...`);
                await sleep(waitTime);
                continue;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return response;
        } catch (error) {
            if (i === retries - 1) {
                throw new Error(`Failed ${description} after ${retries} retries: ${error.message}`);
            }
            const waitTime = CONFIG.BACKOFF_FACTOR * Math.pow(2, i);
            console.warn(`[WARN] Request error (${description}): ${error.message}. Retrying in ${waitTime}ms...`);
            await sleep(waitTime);
        }
    }
}

// ============================================================================
// QUERY BUILDERS
// ============================================================================

function buildQueryPubMed(gene) {
    const kwClause = CONFIG.API_QUERY_KEYWORDS
        .map(k => `"${k}"[Title/Abstract]`)
        .join(' OR ');
    return `("${gene}"[Title/Abstract]) AND (${kwClause})`;
}

function buildQueryPMC(gene) {
    const kwClause = CONFIG.API_QUERY_KEYWORDS.join(' OR ');
    return `${gene} AND (${kwClause})`;
}

// ============================================================================
// TEXT ANALYSIS FUNCTIONS
// ============================================================================

function paragraphSubjectGenes(paragraph, allGenes) {
    const mentioned = allGenes.filter(g =>
        new RegExp(`\\b${g}\\b`, 'i').test(paragraph)
    );
    if (mentioned.length > 0) return mentioned;

    if (/\b(these (single )?mutants|all mutants|all genes|each mutant|compared to control)\b/i.test(paragraph)) {
        return allGenes;
    }
    return [];
}

function hasQuantitativeData(text) {
    return /\b(\d+(\.\d+)?\s?(µm|%|vs|±|twofold))\b/i.test(text);
}

function interpretEvidence(gene, evidenceText) {
    const inferredRoles = { length: [], frequency: [] };
    const sentences = evidenceText.split(/(?<=[.!?])\s+/);

    for (const sentence of sentences) {
        const context = sentence.toLowerCase();
        if (!new RegExp(`\\b${gene.toLowerCase()}\\b`).test(context)) continue;

        const negation = /\b(no|not|did not|none|unchanged|unaltered|without)\b/i.test(context);
        const isLoss = INFERENCE_LEXICON.MANIPULATION.LOSS.some(kw =>
            context.includes(kw.toLowerCase())
        );
        const isGain = INFERENCE_LEXICON.MANIPULATION.GAIN.some(kw =>
            context.includes(kw.toLowerCase())
        );
        const weight = hasQuantitativeData(context) ? 3 : 1;

        const pushRole = (phenotypeList, category, lossRole = 'PROMOTES', gainRole = 'INHIBITS') => {
            for (const kw of phenotypeList) {
                if (context.includes(kw.toLowerCase())) {
                    for (let i = 0; i < weight; i++) {
                        if (negation) {
                            inferredRoles[category].push('NEUTRAL');
                        } else {
                            if (isLoss) inferredRoles[category].push(lossRole);
                            if (isGain) inferredRoles[category].push(gainRole);
                        }
                    }
                }
            }
        };

        pushRole(INFERENCE_LEXICON.PHENOTYPE.LENGTH_DECREASE, 'length', 'PROMOTES', 'INHIBITS');
        pushRole(INFERENCE_LEXICON.PHENOTYPE.LENGTH_INCREASE, 'length', 'INHIBITS', 'PROMOTES');
        pushRole(INFERENCE_LEXICON.PHENOTYPE.LENGTH_NEUTRAL, 'length', 'NEUTRAL', 'NEUTRAL');
        pushRole(INFERENCE_LEXICON.PHENOTYPE.LENGTH_VARIABLE, 'length', 'VARIABLE', 'VARIABLE');
        pushRole(INFERENCE_LEXICON.PHENOTYPE.FREQ_DECREASE, 'frequency', 'PROMOTES', 'INHIBITS');
        pushRole(INFERENCE_LEXICON.PHENOTYPE.FREQ_INCREASE, 'frequency', 'INHIBITS', 'PROMOTES');
        pushRole(INFERENCE_LEXICON.PHENOTYPE.FREQ_NEUTRAL, 'frequency', 'NEUTRAL', 'NEUTRAL');
    }

    inferredRoles.length = [...new Set(inferredRoles.length)];
    inferredRoles.frequency = [...new Set(inferredRoles.frequency)];
    return inferredRoles;
}

function generateFinalSummary(roles) {
    if (roles.length === 0) {
        return `<span class="text-gray-500">No specific data</span>`;
    }

    const counts = roles.reduce((acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
    }, {});

    const promotes = counts['PROMOTES'] || 0;
    const inhibits = counts['INHIBITS'] || 0;
    const neutral = counts['NEUTRAL'] || 0;
    const variable = counts['VARIABLE'] || 0;

    if (neutral > 0 && promotes === 0 && inhibits === 0 && variable === 0) {
        return `<span class="font-semibold text-blue-600">No effect / Neutral</span>`;
    }
    if (promotes > 0 && inhibits > 0) {
        return `<span class="font-semibold text-yellow-700">Variable / Mixed Phenotype</span>`;
    }
    if (promotes > 0) {
        return `<span class="font-semibold text-green-600">Promotes / Maintains</span>`;
    }
    if (inhibits > 0) {
        return `<span class="font-semibold text-red-600">Inhibits / Restricts</span>`;
    }
    if (variable > 0) {
        return `<span class="font-semibold text-purple-600">Variable / Mixed phenotype</span>`;
    }

    return `<span class="text-gray-500">Unclear</span>`;
}

// ============================================================================
// ENHANCED LITERATURE RETRIEVAL ENGINE
// ============================================================================

async function analyzeGeneViaAPI(gene, resultCard, allGenes) {
    let foundEvidence = [];
    let seenIds = new Set();

    try {
        // --- 1. PubMed Search ---
        console.log(`[DEBUG] Starting PubMed search for ${gene}`);
        const searchParamsPubMed = {
            db: 'pubmed',
            term: buildQueryPubMed(gene),
            retmode: 'json',
            retmax: CONFIG.ARTICLES_PER_GENE.toString(),
            tool: CONFIG.TOOL_NAME,
            email: CONFIG.USER_EMAIL
        };
        const searchRespPubMed = await makeApiRequest(CONFIG.ESEARCH_URL, searchParamsPubMed, `PubMed search ${gene}`);
        const searchDataPubMed = await searchRespPubMed.json();
        const pmids = searchDataPubMed?.esearchresult?.idlist || [];
        console.log(`[DEBUG] Found ${pmids.length} PubMed IDs for ${gene}`);

        if (pmids.length > 0) {
            await sleep(CONFIG.ENTREZ_SLEEP);
            const fetchParamsPubMed = {
                db: 'pubmed',
                id: pmids.join(','),
                retmode: 'xml',
                rettype: 'abstract',
                tool: CONFIG.TOOL_NAME,
                email: CONFIG.USER_EMAIL
            };
            const fetchRespPubMed = await makeApiRequest(CONFIG.EFETCH_URL, fetchParamsPubMed, `PubMed fetch ${gene}`);
            const xmlText = await fetchRespPubMed.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "application/xml");
            const articles = xmlDoc.querySelectorAll('PubmedArticle');

            articles.forEach(article => {
                const pmid = article.querySelector('MedlineCitation > PMID')?.textContent;
                if (seenIds.has(`pmid:${pmid}`)) return;
                seenIds.add(`pmid:${pmid}`);

                const title = article.querySelector('ArticleTitle')?.textContent || '';
                const abstractText = Array.from(article.querySelectorAll('Abstract > AbstractText')).map(el => el.textContent).join(' ');
                const combinedText = `${title}. ${abstractText}`;

                combinedText.split(/\n{2,}/).forEach(p => {
                    if (paragraphSubjectGenes(p, allGenes).includes(gene) && CONFIG.LOCAL_ANALYSIS_KEYWORDS.some(kw => p.toLowerCase().includes(kw))) {
                        const inferredRoles = interpretEvidence(gene, p);
                        if (inferredRoles.length.length > 0 || inferredRoles.frequency.length > 0) {
                            foundEvidence.push({
                                id: pmid,
                                source: 'PubMed',
                                context: p,
                                inferredRoles,
                                refLink: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
                            });
                        }
                    }
                });
            });
        }

        // --- 2. PMC Search ---
        console.log(`[DEBUG] Starting PMC search for ${gene}`);
        await sleep(CONFIG.ENTREZ_SLEEP);
        const searchParamsPMC = {
            db: 'pmc',
            term: buildQueryPMC(gene),
            retmode: 'json',
            retmax: CONFIG.ARTICLES_PER_GENE.toString(),
            tool: CONFIG.TOOL_NAME,
            email: CONFIG.USER_EMAIL
        };
        const searchRespPMC = await makeApiRequest(CONFIG.ESEARCH_URL, searchParamsPMC, `PMC search ${gene}`);
        const searchDataPMC = await searchRespPMC.json();
        const pmcids = searchDataPMC?.esearchresult?.idlist || [];
        console.log(`[DEBUG] Found ${pmcids.length} PMC IDs for ${gene}`);

        if (pmcids.length > 0) {
            await sleep(CONFIG.ENTREZ_SLEEP);
            const fetchParamsPMC = {
                db: 'pmc',
                id: pmcids.join(','),
                retmode: 'xml',
                tool: CONFIG.TOOL_NAME,
                email: CONFIG.USER_EMAIL
            };
            const fetchRespPMC = await makeApiRequest(CONFIG.EFETCH_URL, fetchParamsPMC, `PMC fetch ${gene}`);
            const xmlText = await fetchRespPMC.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "application/xml");
            const articles = xmlDoc.querySelectorAll('article');

            articles.forEach(article => {
                const pmcidNode = Array.from(article.querySelectorAll('article-id')).find(node => node.getAttribute('pub-id-type') === 'pmc');
                const pmcid = pmcidNode ? pmcidNode.textContent : null;
                if (!pmcid || seenIds.has(`pmcid:${pmcid}`)) return;
                seenIds.add(`pmcid:${pmcid}`);

                const paragraphs = Array.from(article.querySelectorAll('body p, body caption, body sec')).map(el => el.textContent.trim()).filter(Boolean);
                paragraphs.forEach(p => {
                    if (paragraphSubjectGenes(p, allGenes).includes(gene) && CONFIG.LOCAL_ANALYSIS_KEYWORDS.some(kw => p.toLowerCase().includes(kw))) {
                        const inferredRoles = interpretEvidence(gene, p);
                        if (inferredRoles.length.length > 0 || inferredRoles.frequency.length > 0) {
                            foundEvidence.push({
                                id: pmcid,
                                source: 'PMC',
                                context: p,
                                inferredRoles,
                                refLink: `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcid}/`
                            });
                        }
                    }
                });
            });
        }
    } catch (error) {
        console.error(`[ERROR] Literature search failed for ${gene}:`, error);
        const errorEl = resultCard?.querySelector('.status-searching');
        if (errorEl) {
            errorEl.textContent = 'Literature Search Failed';
            errorEl.className = 'status-not-found';
        }
    }

    // Deduplicate evidence based on the start of the context string
    const uniqueContexts = new Set();
    return foundEvidence.filter(ev => {
        const contextStart = ev.context.substring(0, 150).trim();
        if (uniqueContexts.has(contextStart)) return false;
        uniqueContexts.add(contextStart);
        return true;
    });
}

// ============================================================================
// SCREEN DATA FETCHER
// ============================================================================

async function fetchScreenData() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/cilia_screens_data.json');
        if (!response.ok) throw new Error(`Failed to fetch screen data: ${response.statusText}`);
        const data = await response.json();
        console.log('[INFO] Screen data loaded:', Object.keys(data).length, 'genes');
        return data;
    } catch (error) {
        console.error('[ERROR] Fetching screen data:', error);
        return {};
    }
}

// ============================================================================
// UI DISPLAY FUNCTIONS
// ============================================================================

function displayCiliAIPage() {
    const contentArea = document.querySelector('.content-area');
    if (!contentArea) {
        console.error('Content area not found');
        return;
    }
    contentArea.className = 'content-area content-area-full';
    const ciliaPanel = document.querySelector('.cilia-panel');
    if (ciliaPanel) {
        ciliaPanel.style.display = 'none';
    }

    contentArea.innerHTML = `
        <div class="ciliai-container">
            <div class="ciliai-header">
                <h1>CiliAI</h1>
                <p>Your AI-powered partner for discovering gene-cilia relationships.</p>
            </div>
            <div class="ciliai-main-content">
                <div class="ai-query-section">
                    <h3>Ask a Question</h3>
                    <div class="ai-input-group">
                        <input type="text" id="aiQueryInput" class="ai-query-input" placeholder="e.g., What is the role of IFT88 in cilia biology?">
                        <button class="ai-query-btn" id="aiQueryBtn">Ask CiliAI</button>
                    </div>
                </div>
                <div class="input-section">
                    <h3>Analyze Gene Phenotypes</h3>
                    <div class="input-group">
                        <label for="geneInput">Gene Symbols:</label>
                        <textarea id="geneInput" class="gene-input-textarea" placeholder="Enter one or more gene symbols, separated by commas, spaces, or newlines (e.g., HDAC6, IFT88, ARL13B)"></textarea>
                    </div>
                    <div class="input-group">
                        <label>Analysis Mode:</label>
                        <div class="mode-selector">
                            <div class="mode-option">
                                <input type="radio" id="hybrid" name="mode" value="hybrid" checked>
                                <label for="hybrid" title="Best for most users. Combines our fast, expert-curated database, screen data, and real-time AI literature mining for the most comprehensive results.">
                                    <span class="mode-icon">🔬</span>
                                    <div><strong>Hybrid</strong><br><small>Expert DB + Screen Data + Literature</small></div>
                                </label>
                            </div>
                            <div class="mode-option">
                                <input type="radio" id="expert" name="mode" value="expert">
                                <label for="expert" title="Fastest option. Queries only our internal, manually curated database and screen data of known gene-cilia interactions.">
                                    <span class="mode-icon">🏛️</span>
                                    <div><strong>Expert Only</strong><br><small>Curated database + Screen Data</small></div>
                                </label>
                            </div>
                            <div class="mode-option">
                                <input type="radio" id="nlp" name="mode" value="nlp">
                                <label for="nlp" title="Most current data. Performs a live AI-powered search across PubMed full-text articles. May be slower but includes the very latest findings.">
                                    <span class="mode-icon">📚</span>
                                    <div><strong>Literature Only</strong><br><small>Live AI text mining</small></div>
                                </label>
                            </div>
                        </div>
                    </div>
                    <button class="analyze-btn" id="analyzeBtn">🔍 Analyze Genes</button>
                </div>
                <div id="resultsSection" class="results-section" style="display: none;">
                    <h2>Analysis Results</h2>
                    <div id="resultsContainer"></div>
                </div>
            </div>
        </div>
        <style>
            .ciliai-container{font-family:'Arial',sans-serif;max-width:950px;margin:2rem auto;padding:2rem;background-color:#f9f9f9;border-radius:12px}
            .ciliai-header{text-align:center;margin-bottom:2rem}
            .ciliai-header h1{font-size:2.8rem;color:#2c5aa0;margin:0}
            .ciliai-header p{font-size:1.2rem;color:#555;margin-top:.5rem}
            .ai-query-section{background-color:#e8f4fd;border:1px solid #bbdefb;padding:1.5rem 2rem;border-radius:8px;margin-bottom:2rem}
            .ai-query-section h3{margin-top:0;color:#2c5aa0}
            .ai-input-group{display:flex;gap:10px}
            .ai-query-input{flex-grow:1;padding:.8rem;border:1px solid #ccc;border-radius:4px;font-size:1rem}
            .ai-query-btn{padding:.8rem 1.2rem;font-size:1rem;background-color:#2c5aa0;color:#fff;border:none;border-radius:4px;cursor:pointer;transition:background-color .2s}
            .ai-query-btn:hover{background-color:#1e4273}
            .input-section{background-color:#fff;padding:2rem;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.05)}
            .input-section h3{margin-top:0;color:#333}
            .input-group{margin-bottom:1.5rem}
            .input-group label{display:block;font-weight:700;margin-bottom:.5rem;color:#333}
            .gene-input-textarea{width:100%;padding:.8rem;border:1px solid #ccc;border-radius:4px;font-size:1rem;min-height:80px;resize:vertical}
            .mode-selector{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem}
            .mode-option input[type=radio]{display:none}
            .mode-option label{display:flex;align-items:center;gap:10px;padding:1rem;border:2px solid #ddd;border-radius:8px;cursor:pointer;transition:all .2s}
            .mode-option input[type=radio]:checked+label{border-color:#2c5aa0;background-color:#e8f4fd;box-shadow:0 0 5px rgba(44,90,160,.3)}
            .mode-icon{font-size:1.8rem}
            .analyze-btn{width:100%;padding:1rem;font-size:1.1rem;font-weight:700;background-color:#28a745;color:#fff;border:none;border-radius:8px;cursor:pointer;transition:background-color .2s}
            .analyze-btn[disabled]{background-color:#a5d6a7;cursor:not-allowed}
            .analyze-btn:hover:not([disabled]){background-color:#218838}
            .results-section{margin-top:2rem;padding:2rem;background-color:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.05)}
            .result-card{border:1px solid #ddd;border-radius:8px;padding:1.5rem;margin-bottom:1.5rem;position:relative;overflow:hidden}
            .result-card h3{margin-top:0;color:#2c5aa0;font-size:1.4rem}
            .result-card .status-found{color:#28a745}
            .result-card .status-not-found{color:#dc3545}
            .result-card .status-searching{color:#007bff}
            .prediction-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem}
            .prediction-box{padding:1rem;border-radius:6px;text-align:center;background-color:#f8f9fa;border:1px solid #dee2e6}
            .prediction-box.promotes-maintains{background-color:#d4edda;border:1px solid #c3e6cb}
            .prediction-box.inhibits-restricts{background-color:#f8d7da;border:1px solid #f5c6cb}
            .prediction-box.no-effect-neutral{background-color:#e2e3e5;border:1px solid #d6d8db}
            .prediction-box.variable-mixed-phenotype{background-color:#d1c4e9;border:1px solid #b39ddb}
            .prediction-box.no-specific-data{background-color:#e2e3e5;border:1px solid #d6d8db}
            .prediction-box.unclear{background-color:#e2e3e5;border:1px solid #d6d8db}
            .prediction-box p{margin:0;font-size:1.2rem;font-weight:700}
            .prediction-box h4{margin:0 0 .5rem;color:#495057}
            .evidence-section{margin-top:1.5rem;border-top:1px solid #eee;padding-top:1rem}
            .evidence-toggle{background:0 0;border:1px solid #2c5aa0;color:#2c5aa0;padding:.4rem .8rem;border-radius:20px;cursor:pointer;font-weight:700;transition:all .2s;margin-bottom:.5rem}
            .evidence-toggle:hover{background-color:#e8f4fd}
            .evidence-content{display:none;margin-top:1rem;padding-left:1rem;border-left:3px solid #bbdefb}
            .evidence-snippet{background-color:#f1f3f5;padding:.8rem;border-radius:4px;margin-bottom:.8rem;font-size:.9rem;color:#333}
            .evidence-snippet strong{color:#0056b3}
            .evidence-snippet mark{background-color:#ffeeba;padding:.1em .2em;border-radius:3px}
            .evidence-snippet a{color:#2c5aa0;text-decoration:underline;cursor:pointer}
            .evidence-snippet a:hover{color:#1e4273}
            .text-gray-500{color:#6c757d}
            .font-semibold{font-weight:600}
            .text-blue-600{color:#0056b3}
            .text-green-600{color:#28a745}
            .text-red-600{color:#dc3545}
            .text-yellow-700{color:#856404}
            .text-purple-600{color:#6f42c1}
        </style>
    `;

    setupCiliAIEventListeners();
};

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function setupCiliAIEventListeners() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const aiQueryBtn = document.getElementById('aiQueryBtn');
    const resultsContainer = document.getElementById('resultsContainer');

    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', analyzeGenesFromInput);
    }
    if (aiQueryBtn) {
        aiQueryBtn.addEventListener('click', handleAIQuery);
    }

    const geneInput = document.getElementById('geneInput');
    if (geneInput) {
        geneInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                analyzeGenesFromInput();
            }
        });
    }
    const aiQueryInput = document.getElementById('aiQueryInput');
    if (aiQueryInput) {
        aiQueryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleAIQuery();
            }
        });
    }

    if (resultsContainer) {
        resultsContainer.addEventListener('click', function(e) {
            if (e.target && e.target.classList.contains('evidence-toggle')) {
                const content = e.target.nextElementSibling;
                if (content) {
                    const isVisible = content.style.display === 'block';
                    content.style.display = isVisible ? 'none' : 'block';
                    const count = e.target.dataset.count || 0;
                    e.target.textContent = isVisible ? `Show Evidence (${count}) ▾` : `Hide Evidence (${count}) ▴`;
                }
            }
        });
    }
}

function handleAIQuery() {
    const aiQueryInput = document.getElementById('aiQueryInput');
    if (!aiQueryInput) return;
    const query = aiQueryInput.value.trim();
    const geneRegex = /\b([A-Z0-9]{3,})\b/g;
    const matches = query.match(geneRegex);

    if (matches && matches.length > 0) {
        const detectedGene = matches[0].toUpperCase();
        const geneInput = document.getElementById('geneInput');
        if (geneInput) geneInput.value = detectedGene;
        runAnalysis([detectedGene]);
    } else {
        const resultsContainer = document.getElementById('resultsContainer');
        if (resultsContainer) {
            resultsContainer.innerHTML = `<p class="status-not-found">Could not identify a valid gene symbol. Please try again, e.g., "What does IFT88 do?".</p>`;
            document.getElementById('resultsSection').style.display = 'block';
        }
    }
}

function analyzeGenesFromInput() {
    const geneInput = document.getElementById('geneInput');
    if (!geneInput) return;
    const genes = geneInput.value.split(/[\s,]+/).map(g => g.trim().toUpperCase()).filter(Boolean);

    if (genes.length === 0) {
        const resultsContainer = document.getElementById('resultsContainer');
        if (resultsContainer) {
            resultsContainer.innerHTML = `<p class="status-not-found">Please enter at least one gene symbol.</p>`;
            document.getElementById('resultsSection').style.display = 'block';
        }
        return;
    }
    runAnalysis([...new Set(genes)]);
}

// ============================================================================
// MAIN ANALYSIS ORCHESTRATOR
// ============================================================================

async function runAnalysis(geneList) {
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsSection = document.getElementById('resultsSection');
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (!resultsContainer || !resultsSection || !analyzeBtn) return;

    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'hybrid';
    resultsContainer.innerHTML = '';
    resultsSection.style.display = 'block';
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';

    const screenData = (mode === 'hybrid' || mode === 'expert') ? await fetchScreenData() : {};

    for (const gene of geneList) {
        resultsContainer.insertAdjacentHTML('beforeend', createPlaceholderCard(gene, mode));
        const resultCard = document.getElementById(`card-${gene}`);
        let allEvidence = [];

        if (mode === 'expert' || mode === 'hybrid') {
            if (CILI_AI_DB[gene]) {
                allEvidence.push(...CILI_AI_DB[gene].evidence.map(ev => ({ ...ev, inferredRoles: interpretEvidence(gene, ev.context) })));
            }
            if (screenData[gene]) {
                const screenInfo = screenData[gene];
                const context = `Ciliary screen data indicates a length phenotype of "${screenInfo.cilia_length}" and a ciliation frequency phenotype of "${screenInfo.percent_ciliated}".`;
                allEvidence.push({
                    id: `Screen-${gene}`,
                    source: 'Screen Data',
                    context: context,
                    inferredRoles: interpretEvidence(gene, context),
                    refLink: '#'
                });
            }
        }

        if (mode === 'nlp' || mode === 'hybrid') {
            const apiEvidence = await analyzeGeneViaAPI(gene, resultCard, geneList);
            allEvidence.push(...apiEvidence);
        }

        const finalHtml = createResultCard(gene, allEvidence);
        resultCard.outerHTML = finalHtml;
    }

    analyzeBtn.disabled = false;
    analyzeBtn.textContent = '🔍 Analyze Genes';
}

// ============================================================================
// RESULT CARD GENERATORS
// ============================================================================

function createPlaceholderCard(gene, mode) {
    let statusText = 'Fetching from Expert DB and Screen Data...';
    if (mode === 'nlp') statusText = 'Searching live literature...';
    if (mode === 'hybrid') statusText = 'Checking Expert DB, Screen Data & Searching Literature...';
    return `<div class="result-card" id="card-${gene}"><h3>${gene} - <span class="status-searching">${statusText}</span></h3></div>`;
}

function createResultCard(gene, allEvidence) {
    const uniqueContexts = new Set();
    const uniqueEvidence = allEvidence.filter(ev => {
        const contextStart = ev.context.substring(0, 150).trim();
        if (uniqueContexts.has(contextStart)) return false;
        uniqueContexts.add(contextStart);
        return true;
    });

    const statusText = uniqueEvidence.length > 0 ? 'Evidence Found' : 'No Data Found';
    const statusClass = uniqueEvidence.length > 0 ? 'status-found' : 'status-not-found';

    const allRoles = { length: [], frequency: [] };
    const references = new Set();

    uniqueEvidence.forEach(ev => {
        if (ev.inferredRoles) {
            allRoles.length.push(...ev.inferredRoles.length);
            allRoles.frequency.push(...ev.inferredRoles.frequency);
        }
        if (ev.id && ev.source && ev.refLink) {
            references.add(`<a href="${ev.refLink}" target="_blank">${ev.source}:${ev.id}</a>`);
        }
    });

    const lengthSummary = generateFinalSummary(allRoles.length);
    const freqSummary = generateFinalSummary(allRoles.frequency);
    const lofClass = lengthSummary.replace(/<[^>]+>/g, '').toLowerCase().replace(/[^a-z]/g, '-');
    const percClass = freqSummary.replace(/<[^>]+>/g, '').toLowerCase().replace(/[^a-z]/g, '-');

    const summaryHtml = `
        <div class="prediction-grid">
            <div class="prediction-box ${lofClass}">
                <h4>Loss-of-Function (Cilia Length)</h4>
                <p>${lengthSummary}</p>
            </div>
            <div class="prediction-box ${percClass}">
                <h4>Percentage Ciliated</h4>
                <p>${freqSummary}</p>
            </div>
        </div>
    `;

    let evidenceHtml = '';
    if (uniqueEvidence.length > 0) {
        evidenceHtml = `
            <div class="evidence-section">
                <button class="evidence-toggle" data-count="${uniqueEvidence.length}">Show Evidence (${uniqueEvidence.length}) ▾</button>
                <div class="evidence-content" style="display: none;">
                    ${uniqueEvidence.map(ev => {
                        const geneRegex = new RegExp(`\\b(${gene})\\b`, 'ig');
                        const highlightedContext = ev.context.replace(geneRegex, `<mark>$1</mark>`);
                        return `
                        <div class="evidence-snippet">
                            ${highlightedContext}
                            <br><strong><a href="${ev.refLink}" target="_blank">Source: ${ev.source.toUpperCase()} (${ev.id})</a></strong>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
    }

    const refHtml = references.size > 0 ? Array.from(references).join(', ') : 'N/A';

    return `
        <div class="result-card" id="card-${gene}">
            <h3>${gene} - <span class="${statusClass}">${statusText}</span></h3>
            ${summaryHtml}
            ${evidenceHtml}
            <div class="references-section" style="margin-top: 1rem; font-size: 0.8rem;">
                <strong>References:</strong> ${refHtml}
            </div>
        </div>
    `;
}

// ============================================================================
// GLOBAL EXPORTS FOR ROUTER COMPATIBILITY
// ============================================================================

window.displayCiliAIPage = displayCiliAIPage;
window.setupCiliAIEventListeners = setupCiliAIEventListeners;
window.handleAIQuery = handleAIQuery;
window.analyzeGenesFromInput = analyzeGenesFromInput;
window.runAnalysis = runAnalysis;
window.analyzeGeneViaAPI = analyzeGeneViaAPI;
window.fetchScreenData = fetchScreenData;
window.createResultCard = createResultCard;
window.createPlaceholderCard = createPlaceholderCard;
window.interpretEvidence = interpretEvidence;
window.generateFinalSummary = generateFinalSummary;
window.paragraphSubjectGenes = paragraphSubjectGenes;
// ================================================================
// Exports (attach to window for compatibility)
// ================================================================
window.FT_CONFIG = FT_CONFIG;
window.fetchFullTextPMC = fetchFullTextPMC;
window.extractParagraphsFromPMCXml = extractParagraphsFromPMCXml;
window.scoreParagraphForGene = scoreParagraphForGene;
window.analyzeGeneViaFullTextPMC = analyzeGeneViaFullTextPMC;
window.analyzeGeneViaAPI_FT = analyzeGeneViaAPI_FT;
