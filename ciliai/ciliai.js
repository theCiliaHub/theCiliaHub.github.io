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

const FT_CONFIG = {
    CACHE_ENABLED: true,
    CACHE_TTL_MS: 1000 * 60 * 60 * 24 * 14, // 14 days
    MAX_SNIPPET_LENGTH: 600,
    MIN_PARAGRAPH_SCORE: 0.4,
    PROXIMITY_WINDOW: 120
};

// Simple in-memory + localStorage cache
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
        } catch {
            return null;
        }
    },
    set(key, value) {
        this._mem.set(key, value);
        if (!FT_CONFIG.CACHE_ENABLED) return;
        try {
            localStorage.setItem(`ciliai_ft_${key}`, JSON.stringify({ _ts: Date.now(), value }));
        } catch { /* ignore */ }
    }
};



// Utility
function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function xmlToDoc(xmlText) { return new DOMParser().parseFromString(xmlText, 'application/xml'); }

// Fetch PMC XML
async function fetchFullTextPMC(pmcid) {
    const id = pmcid.toString().replace(/^PMC/i, '');
    const cacheKey = `pmc_${id}`;
    const cached = FTCache.get(cacheKey);
    if (cached) return cached;

    const params = {
        db: 'pmc',
        id,
        retmode: 'xml',
        tool: CONFIG.TOOL_NAME,
        email: CONFIG.USER_EMAIL
    };
    const resp = await makeApiRequest(CONFIG.EFETCH_URL, params, `PMC fulltext ${pmcid}`);
    const xmlText = await resp.text();
    FTCache.set(cacheKey, xmlText);
    return xmlText;
}

// Extract paragraphs
function extractParagraphsFromPMCXml(xmlDoc) {
    const body = xmlDoc.querySelector('body') || xmlDoc;
    if (!body) return [];
    const nodes = body.querySelectorAll('p, sec, caption, title');
    return Array.from(nodes).map(n => n.textContent.replace(/\s+/g, ' ').trim())
        .filter(txt => txt.length > 30);
}

// Paragraph relevance scoring
function scoreParagraphForGene(paragraph, gene, keywordList = CONFIG.LOCAL_ANALYSIS_KEYWORDS) {
    const text = paragraph.toLowerCase();
    const geneLower = gene.toLowerCase();

    const geneMatches = (text.match(new RegExp(`\\b${escapeRegExp(geneLower)}\\b`, 'g')) || []).length;
    const geneScore = Math.min(3, geneMatches);

    let keywordHits = 0;
    for (const kw of keywordList) if (text.includes(kw.toLowerCase())) keywordHits++;
    const keywordScore = Math.min(3, keywordHits);

    let proximityScore = 0;
    const idx = text.indexOf(geneLower);
    if (idx !== -1) {
        for (const kw of keywordList) {
            const kidx = text.indexOf(kw.toLowerCase());
            if (kidx !== -1) {
                const prox = Math.abs(kidx - idx);
                proximityScore = Math.max(proximityScore, (FT_CONFIG.PROXIMITY_WINDOW - prox) / FT_CONFIG.PROXIMITY_WINDOW * 2);
            }
        }
    }

    const quantBonus = /\d+(\.\d+)?\s?(%|fold|µm|um|cells?)/.test(text) ? 1.5 : 0;
    const manipWords = INFERENCE_LEXICON.MANIPULATION.LOSS.concat(INFERENCE_LEXICON.MANIPULATION.GAIN);
    const manipBonus = manipWords.some(m => text.includes(m.toLowerCase())) ? 1.0 : 0;

    const raw = geneScore + keywordScore + proximityScore + quantBonus + manipBonus;
    return { raw, normalized: Math.min(1, raw / 8) };
}

// Snippet builder
function makeSnippet(text, gene, maxLen) {
    const idx = text.toLowerCase().indexOf(gene.toLowerCase());
    if (idx === -1) return text.slice(0, maxLen) + (text.length > maxLen ? '…' : '');
    const half = Math.floor(maxLen / 2);
    const start = Math.max(0, idx - half);
    let snip = text.slice(start, start + maxLen);
    if (start > 0) snip = '…' + snip;
    if (start + maxLen < text.length) snip = snip + '…';
    return snip;
}

// Extract evidence from one PMC article
async function extractEvidenceFromPMCArticle(pmcid, gene, allGenes) {
    const xmlDoc = xmlToDoc(await fetchFullTextPMC(pmcid));
    const paragraphs = extractParagraphsFromPMCXml(xmlDoc);
    const results = [];

    for (const para of paragraphs) {
        if (!paragraphSubjectGenes(para, allGenes).includes(gene)) continue;
        if (!CONFIG.LOCAL_ANALYSIS_KEYWORDS.some(kw => para.toLowerCase().includes(kw))) continue;
        const score = scoreParagraphForGene(para, gene);
        if (score.normalized < FT_CONFIG.MIN_PARAGRAPH_SCORE) continue;
        const snippet = makeSnippet(para, gene, FT_CONFIG.MAX_SNIPPET_LENGTH);
        const inferred = interpretEvidence(gene, para);

        results.push({
            id: pmcid,
            source: 'PMC',
            context: para,
            snippet,
            score,
            inferredRoles: inferred,
            refLink: `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcid}/`
        });
    }
    return results;
}

// Map PMID → PMCID
async function mapPmidsToPmcids(pmids) {
    if (!pmids.length) return [];
    const params = {
        dbfrom: 'pubmed',
        db: 'pmc',
        id: pmids.join(','),
        retmode: 'json',
        tool: CONFIG.TOOL_NAME,
        email: CONFIG.USER_EMAIL
    };
    try {
        const resp = await makeApiRequest('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi', params, 'PMID→PMCID');
        const data = await resp.json();
        const out = [];
        for (const ls of data?.linksets || []) {
            const links = ls?.linksetdbs?.flatMap(ldb => ldb?.links || []) || [];
            links.forEach(l => out.push(l.replace(/^PMC/i, '')));
        }
        return [...new Set(out)];
    } catch { return []; }
}

// Orchestrator
async function analyzeGeneViaAPI_FT(gene, resultCard, allGenes) {
    const found = [];
    const seen = new Set();

    try {
        // Search PubMed
        const searchParams = {
            db: 'pubmed',
            term: buildQueryPubMed(gene),
            retmode: 'json',
            retmax: (CONFIG.ARTICLES_PER_GENE * 2).toString(),
            tool: CONFIG.TOOL_NAME,
            email: CONFIG.USER_EMAIL
        };
        const searchResp = await makeApiRequest(CONFIG.ESEARCH_URL, searchParams, `PubMed search ${gene}`);
        const pmids = (await searchResp.json())?.esearchresult?.idlist || [];

        // Map to PMC
        const pmcids = await mapPmidsToPmcids(pmids);

        // Full-text first
        for (const pmc of pmcids.slice(0, CONFIG.ARTICLES_PER_GENE)) {
            const evs = await extractEvidenceFromPMCArticle(pmc, gene, allGenes);
            evs.forEach(ev => {
                if (!seen.has(ev.context)) {
                    seen.add(ev.context);
                    found.push(ev);
                }
            });
            await sleep(CONFIG.ENTREZ_SLEEP);
        }

        // Fallback: abstracts
        if (found.length < 3 && pmids.length > 0) {
            const fetchParams = {
                db: 'pubmed',
                id: pmids.slice(0, CONFIG.ARTICLES_PER_GENE).join(','),
                retmode: 'xml',
                rettype: 'abstract',
                tool: CONFIG.TOOL_NAME,
                email: CONFIG.USER_EMAIL
            };
            const fetchResp = await makeApiRequest(CONFIG.EFETCH_URL, fetchParams, `PubMed fetch ${gene}`);
            const xmlDoc = xmlToDoc(await fetchResp.text());
            xmlDoc.querySelectorAll('PubmedArticle').forEach(article => {
                const pmid = article.querySelector('PMID')?.textContent;
                const title = article.querySelector('ArticleTitle')?.textContent || '';
                const abs = Array.from(article.querySelectorAll('AbstractText')).map(el => el.textContent).join(' ');
                const combined = `${title}. ${abs}`;
                if (paragraphSubjectGenes(combined, allGenes).includes(gene)) {
                    if (CONFIG.LOCAL_ANALYSIS_KEYWORDS.some(kw => combined.toLowerCase().includes(kw))) {
                        const inferred = interpretEvidence(gene, combined);
                        found.push({ id: pmid, source: 'PubMed', context: combined, inferredRoles: inferred, refLink: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` });
                    }
                }
            });
        }
    } catch (err) {
        console.error(`[ERROR] Literature search failed for ${gene}:`, err);
    }

    // Global ranking
    found.sort((a, b) => b.score?.raw - a.score?.raw || 0);
    return found.slice(0, CONFIG.ARTICLES_PER_GENE);
}

// Exports
window.analyzeGeneViaAPI_FT = analyzeGeneViaAPI_FT;


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
            const apiEvidence = await analyzeGeneViaAPI_FT(gene, resultCard, geneList);
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
/* =========================
   CiliAI Full-Text Retriever v2
   - PMC-first, Europe PMC full-text fallback
   - Ranked + deduplicated evidence
   - Exposes analyzeGeneViaAPI_FT_v2(gene, resultCard, allGenes)
   Requires: CONFIG, makeApiRequest, interpretEvidence, paragraphSubjectGenes, hasQuantitativeData, INFERENCE_LEXICON, sleep
   ========================= */

const FTV2 = {
    CACHE_ENABLED: true,
    CACHE_TTL_MS: 1000 * 60 * 60 * 24 * 14,
    MAX_SNIPPET_LENGTH: 600,
    MIN_PARAGRAPH_SCORE: 0.35,
    PROXIMITY_WINDOW: 120,
    EUROPEPMC_BASE: 'https://www.ebi.ac.uk/europepmc/webservices/rest'
};

// simple cache (mem + localStorage)
const FTV2Cache = {
    _mem: new Map(),
    get(k) {
        if (this._mem.has(k)) return this._mem.get(k);
        if (!FTV2.CACHE_ENABLED) return null;
        try {
            const raw = localStorage.getItem(`ciliai_ftv2_${k}`);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (Date.now() - parsed._ts > FTV2.CACHE_TTL_MS) {
                localStorage.removeItem(`ciliai_ftv2_${k}`);
                return null;
            }
            this._mem.set(k, parsed.value);
            return parsed.value;
        } catch (e) { return null; }
    },
    set(k, v) {
        this._mem.set(k, v);
        if (!FTV2.CACHE_ENABLED) return;
        try { localStorage.setItem(`ciliai_ftv2_${k}`, JSON.stringify({ _ts: Date.now(), value: v })); } catch {}
    }
};

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&'); }
function xmlToDoc(xmlText) { return new DOMParser().parseFromString(xmlText, 'application/xml'); }

/* -----------------------
   Helper: extract paragraphs from PMC-like XML
   ----------------------- */
function extractParagraphsFromXmlDoc(xmlDoc) {
    const out = [];
    try {
        const root = xmlDoc.querySelector('body') || xmlDoc;
        if (!root) return out;
        const nodes = root.querySelectorAll('p, sec, caption, title');
        nodes.forEach(n => {
            const txt = (n.textContent || '').replace(/\s+/g, ' ').trim();
            if (txt.length > 30) out.push(txt);
        });
    } catch (e) { console.warn('[FTV2] extract paragraphs failed', e); }
    return out;
}

/* -----------------------
   Scoring (same idea as v1 but tuned)
   ----------------------- */
function scoreParagraphForGene_v2(paragraph, gene, keywordList = CONFIG.LOCAL_ANALYSIS_KEYWORDS) {
    const text = paragraph.toLowerCase();
    const geneLower = gene.toLowerCase();

    const geneMatches = (text.match(new RegExp(`\\b${escapeRegExp(geneLower)}\\b`, 'g')) || []).length;
    const geneScore = Math.min(3, geneMatches);

    let keywordHits = 0;
    for (const kw of keywordList) if (text.includes(kw.toLowerCase())) keywordHits++;
    const keywordScore = Math.min(4, keywordHits); // more weight for keywords present

    let proximityScore = 0;
    const idx = text.indexOf(geneLower);
    if (idx !== -1) {
        for (const kw of keywordList) {
            const kidx = text.indexOf(kw.toLowerCase());
            if (kidx !== -1) {
                const prox = Math.abs(kidx - idx);
                proximityScore = Math.max(proximityScore, (FTV2.PROXIMITY_WINDOW - prox) / FTV2.PROXIMITY_WINDOW * 2);
            }
        }
    }

    const quantBonus = hasQuantitativeData(text) ? 1.5 : 0;
    const manipAll = INFERENCE_LEXICON.MANIPULATION.LOSS.concat(INFERENCE_LEXICON.MANIPULATION.GAIN);
    const manipBonus = manipAll.some(m => text.includes(m.toLowerCase())) ? 1.0 : 0;

    const raw = geneScore + keywordScore + proximityScore + quantBonus + manipBonus;
    return { raw, normalized: Math.min(1, raw / 9) };
}

function makeSnippetAroundGene(text, gene, maxLen = FTV2.MAX_SNIPPET_LENGTH) {
    const idx = text.toLowerCase().indexOf(gene.toLowerCase());
    if (idx === -1) return text.slice(0, maxLen) + (text.length > maxLen ? '…' : '');
    const half = Math.floor(maxLen / 2);
    const start = Math.max(0, idx - half);
    let snip = text.slice(start, start + maxLen);
    if (start > 0) snip = '…' + snip;
    if (start + maxLen < text.length) snip = snip + '…';
    return snip;
}

/* -----------------------
   Fetch PMC XML via NCBI efetch (with caching)
   ----------------------- */
async function fetchPMCxmlFromNCBI(pmcid) {
    const id = pmcid.toString().replace(/^PMC/i, '');
    const key = `ncbi_pmc_${id}`;
    const cached = FTV2Cache.get(key);
    if (cached) return cached;

    const params = { db: 'pmc', id: id, retmode: 'xml', tool: CONFIG.TOOL_NAME, email: CONFIG.USER_EMAIL };
    const resp = await makeApiRequest(CONFIG.EFETCH_URL, params, `NCBI PMC fetch ${pmcid}`);
    const xml = await resp.text();
    FTV2Cache.set(key, xml);
    return xml;
}

// ciliai_literature_retriever.js
// =============================================================================
// Full-Text First Literature Retriever for CiliAI with Supplementary Data Parsing
// =============================================================================

// Import / assumes globals: CONFIG, INFERENCE_LEXICON, interpretEvidence, makeApiRequest, sleep
// =============================================================================

// Europe PMC API endpoint
const EUROPE_PMC_API = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";

// Utility: Fetch JSON from Europe PMC
async function fetchEuropePMC(query) {
  const url = `${EUROPE_PMC_API}?query=${encodeURIComponent(query)}&resultType=core&format=json`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Europe PMC error: ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error("Europe PMC fetch error:", err);
    return null;
  }
}

// Extract PMCID/PMID list from Europe PMC search results
function extractEuropePMCIds(json) {
  if (!json || !json.resultList || !json.resultList.result) return [];
  return json.resultList.result.map(r => ({
    pmid: r.pmid || null,
    pmcid: r.pmcid ? r.pmcid.replace("PMC", "") : null,
    title: r.title || "",
    journal: r.journalTitle || ""
  }));
}

// Fetch PMC XML full text from NCBI efetch
async function fetchFullTextPMC(pmcid) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=${pmcid}&rettype=full&retmode=xml&api_key=${CONFIG.NCBI_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`PMC efetch failed: ${response.status}`);
    const text = await response.text();
    return new window.DOMParser().parseFromString(text, "text/xml");
  } catch (err) {
    console.error("fetchFullTextPMC error:", err);
    return null;
  }
}

// Extract text paragraphs, tables, figures, captions, supplementary info from PMC XML
function extractParagraphsFromPMCXml(xmlDoc) {
  if (!xmlDoc) return [];

  const paras = [];

  // Body paragraphs
  paras.push(...[...xmlDoc.querySelectorAll("body p")].map(p => p.textContent.trim()));

  // Table captions and content
  paras.push(...[...xmlDoc.querySelectorAll("table-wrap caption")].map(c => c.textContent.trim()));
  paras.push(...[...xmlDoc.querySelectorAll("table-wrap td")].map(td => td.textContent.trim()));

  // Figure captions
  paras.push(...[...xmlDoc.querySelectorAll("fig caption")].map(c => c.textContent.trim()));

  // Supplementary material (sec type="supplementary-material")
  paras.push(...[...xmlDoc.querySelectorAll("sec[type='supplementary-material']")].map(s => s.textContent.trim()));

  return paras.filter(Boolean);
}

// Scoring function for relevance
function scoreParagraphForGene(gene, para) {
  let score = 0;
  const geneRe = new RegExp(`\\b${gene}\\b`, "i");
  if (geneRe.test(para)) score += 5;
  if (/cilia|ciliary|ciliogenesis/i.test(para)) score += 5;
  if (/loss|knockout|depletion|KO|deficient/i.test(para)) score += 3;
  if (/overexpress|gain|rescue|increase/i.test(para)) score += 3;
  if (/\\d+\\s*(μm|um|%|percent|p\\s*<)/i.test(para)) score += 2;
  return score;
}

// Generate snippet
function makeSnippetAroundGene(gene, para) {
  const idx = para.toLowerCase().indexOf(gene.toLowerCase());
  if (idx === -1) return para.slice(0, 250) + (para.length > 250 ? "..." : "");
  const start = Math.max(0, idx - 100);
  const end = Math.min(para.length, idx + 150);
  return (start > 0 ? "..." : "") + para.slice(start, end) + (end < para.length ? "..." : "");
}

// Extract evidence from PMC full text
function extractEvidenceFromPMCArticle(gene, pmcid, xmlDoc) {
  const paras = extractParagraphsFromPMCXml(xmlDoc);
  const scored = paras.map(p => ({
    para: p,
    score: scoreParagraphForGene(gene, p)
  })).filter(o => o.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map(o => ({
    snippet: makeSnippetAroundGene(gene, o.para),
    context: o.para,
    score: o.score,
    source: `PMC${pmcid}`
  }));
}

// Master function: Europe PMC first, fallback to PubMed abstract
async function analyzeGeneViaAPI_FT(gene) {
  let evidence = [];

  // Step 1: Europe PMC full-text search
  const json = await fetchEuropePMC(`${gene} cilia`);
  const ids = extractEuropePMCIds(json);
  if (ids.length > 0) {
    for (const id of ids) {
      if (!id.pmcid) continue;
      const xmlDoc = await fetchFullTextPMC(id.pmcid);
      if (xmlDoc) {
        const ev = extractEvidenceFromPMCArticle(gene, id.pmcid, xmlDoc);
        evidence.push(...ev);
      }
      await sleep(200);
    }
  }

  // Step 2: fallback to PubMed abstract if no evidence
  if (evidence.length === 0) {
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${gene}+cilia&retmode=json&api_key=${CONFIG.NCBI_API_KEY}`;
    const res = await fetch(url);
    const js = await res.json();
    if (js.esearchresult.idlist.length > 0) {
      const pmid = js.esearchresult.idlist[0];
      const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml&api_key=${CONFIG.NCBI_API_KEY}`;
      const xml = await fetch(fetchUrl).then(r => r.text());
      const doc = new window.DOMParser().parseFromString(xml, "text/xml");
      const abst = doc.querySelector("Abstract");
      if (abst) {
        const text = abst.textContent;
        evidence.push({
          snippet: makeSnippetAroundGene(gene, text),
          context: text,
          score: 1,
          source: `PubMed${pmid}`
        });
      }
    }
  }

  // Rank and return
  evidence.sort((a, b) => b.score - a.score);
  return evidence;
}

// Exported API
window.analyzeGeneViaAPI_FT = analyzeGeneViaAPI_FT;

/* -----------------------
   Europe PMC: search & fullTextXML fetch
   ----------------------- */
async function searchEuropePMC_for_gene(gene) {
    // construct query: gene AND (cilia OR ciliary OR ciliogenesis ...)
    const kwClause = CONFIG.API_QUERY_KEYWORDS.join(' OR ');
    const query = `${gene} AND (${kwClause})`;
    const params = { query: query, format: 'json', pageSize: CONFIG.ARTICLES_PER_GENE.toString() };
    const resp = await makeApiRequest(`${FTV2.EUROPEPMC_BASE}/search`, params, `Europe PMC search ${gene}`);
    const j = await resp.json();
    return (j?.resultList?.result) || [];
}

async function fetchEuropePMCFullTextXML(pmcidOrId) {
    // pmcidOrId should be a PMCID (with or without PMC) or an Europe PMC ID
    let id = pmcidOrId.toString();
    id = id.replace(/^PMC/i, '');
    const key = `epmc_ft_${id}`;
    const cached = FTV2Cache.get(key);
    if (cached) return cached;

    // docs: /{PMCID}/fullTextXML
    const url = `${FTV2.EUROPEPMC_BASE}/${encodeURIComponent(id)}/fullTextXML`;
    try {
        const resp = await makeApiRequest(url, {}, `EuropePMC fullTextXML ${id}`);
        const txt = await resp.text();
        FTV2Cache.set(key, txt);
        return txt;
    } catch (e) {
        console.warn('[FTV2] EuropePMC fullTextXML failed for', id, e.message || e);
        return null;
    }
}

/* -----------------------
   Extract evidence from PMC-like XML text (works for NCBI PMC XML and EuropePMC xml)
   ----------------------- */
async function extractEvidenceFromXmlText(xmlText, gene, allGenes, sourceTag, articleId, refLink) {
    const xmlDoc = xmlToDoc(xmlText);
    const paragraphs = extractParagraphsFromXmlDoc(xmlDoc);
    const candidates = [];
    for (const para of paragraphs) {
        if (!paragraphSubjectGenes(para, allGenes).includes(gene)) continue;
        if (!CONFIG.LOCAL_ANALYSIS_KEYWORDS.some(kw => para.toLowerCase().includes(kw))) continue;
        const score = scoreParagraphForGene_v2(para, gene);
        if (score.normalized < FTV2.MIN_PARAGRAPH_SCORE) continue;
        const snippet = makeSnippetAroundGene(para, gene);
        const inferred = interpretEvidence(gene, para);
        candidates.push({
            id: articleId,
            source: sourceTag,
            context: para,
            snippet,
            score,
            inferredRoles: inferred,
            refLink
        });
    }
    // rank per-article
    candidates.sort((a, b) => b.score.raw - a.score.raw);
    return candidates;
}

/* -----------------------
   Map PubMed -> PMC using ELink (if available)
   ----------------------- */
async function mapPmidsToPmcids_v2(pmids) {
    if (!pmids || pmids.length === 0) return [];
    const params = { dbfrom: 'pubmed', db: 'pmc', id: pmids.join(','), retmode: 'json', tool: CONFIG.TOOL_NAME, email: CONFIG.USER_EMAIL };
    try {
        const resp = await makeApiRequest('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi', params, 'PMID->PMCID mapping');
        const j = await resp.json();
        const out = [];
        const linksets = j?.linksets || [];
        for (const ls of linksets) {
            const links = ls?.linksetdbs?.flatMap(ldb => ldb?.links || []) || [];
            for (const l of links) out.push(String(l).replace(/^PMC/i, ''));
        }
        return [...new Set(out)];
    } catch (e) {
        console.warn('[FTV2] mapPmidsToPmcids failed', e.message || e);
        return [];
    }
}

/* -----------------------
   Main orchestrator v2
   ----------------------- */
async function analyzeGeneViaAPI_FT_v2(gene, resultCard, allGenes) {
    const found = [];
    const seenContexts = new Set();
    try {
        // 1) Try PMC esearch (db=pmc) directly using buildQueryPMC
        const searchParamsPMC = {
            db: 'pmc',
            term: buildQueryPMC(gene),
            retmode: 'json',
            retmax: CONFIG.ARTICLES_PER_GENE.toString(),
            tool: CONFIG.TOOL_NAME,
            email: CONFIG.USER_EMAIL
        };
        const searchRespPMC = await makeApiRequest(CONFIG.ESEARCH_URL, searchParamsPMC, `PMC search ${gene}`);
        const pmcids = (await searchRespPMC.json())?.esearchresult?.idlist || [];

        // If PMC results found, fetch their XML via efetch and extract
        if (pmcids.length > 0) {
            for (const pmc of pmcids.slice(0, CONFIG.ARTICLES_PER_GENE)) {
                try {
                    await sleep(CONFIG.ENTREZ_SLEEP);
                    const xmlText = await fetchPMCxmlFromNCBI(pmc);
                    const evs = await extractEvidenceFromXmlText(xmlText, gene, allGenes, 'PMC', `PMC${pmc}`, `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmc}/`);
                    for (const ev of evs) {
                        const key = ev.context.substring(0, 140);
                        if (!seenContexts.has(key)) {
                            seenContexts.add(key);
                            found.push(ev);
                        }
                    }
                } catch (e) {
                    console.warn('[FTV2] PMC parse fail', pmc, e.message || e);
                }
            }
        }

        // 2) If not enough evidence, use Europe PMC (often indexes publisher OA fulltext not in PMC)
        if (found.length < 3) {
            const epmcHits = await searchEuropePMC_for_gene(gene);
            for (const hit of epmcHits.slice(0, CONFIG.ARTICLES_PER_GENE)) {
                // Hit fields may include pmcid, pmid, doi, id, fullTextUrlList, isOpenAccess
                const pmcid = hit.pmcid || hit.id?.startsWith('PMC') ? (hit.pmcid || hit.id.replace(/^PMC/i, '')) : null;
                const candidateId = hit.pmcid || hit.id || hit.pmid || hit.doi || (hit.source && `${hit.source}:${hit.id}`) || 'europepmc';
                let xmlText = null;
                // Prefer Europe PMC fullTextXML if pmcid available
                if (pmcid) {
                    try {
                        xmlText = await fetchEuropePMCFullTextXML(pmcid);
                    } catch (e) { xmlText = null; }
                }
                // If EuropePMC fulltext failed, check fullTextUrlList for xml/html
                if (!xmlText && hit.fullTextUrlList && Array.isArray(hit.fullTextUrlList.url)) {
                    // try to fetch the first xml/html url (avoid pdfs here)
                    for (const uobj of hit.fullTextUrlList.url) {
                        const u = uobj?.url || uobj;
                        if (!u) continue;
                        if (u.endsWith('.xml') || u.includes('/xml')) {
                            try {
                                const resp = await makeApiRequest(u, {}, `publisher XML ${u}`);
                                xmlText = await resp.text();
                                break;
                            } catch (e) { continue; }
                        }
                        // if it's HTML and not disallowed by CORS, try to fetch and extract text minimally
                        if (u.includes('html')) {
                            try {
                                const resp = await makeApiRequest(u, {}, `publisher HTML ${u}`);
                                const html = await resp.text();
                                // Minimal wrapper: put into a DOM and extract <p> text
                                const doc = new DOMParser().parseFromString(html, 'text/html');
                                const paras = Array.from(doc.querySelectorAll('p')).map(n => n.textContent.replace(/\s+/g,' ').trim()).filter(Boolean);
                                xmlText = `<body>${paras.map(p => `<p>${p}</p>`).join('')}</body>`;
                                break;
                            } catch (e) { continue; }
                        }
                    }
                }

                // If we got xmlText from Europe PMC or publisher, extract evidence
                if (xmlText) {
                    try {
                        const evs = await extractEvidenceFromXmlText(xmlText, gene, allGenes, 'EuropePMC', candidateId, hit.fullTextUrlList?.url?.[0] || (hit.doi ? `https://doi.org/${hit.doi}` : null));
                        for (const ev of evs) {
                            const key = ev.context.substring(0, 140);
                            if (!seenContexts.has(key)) {
                                seenContexts.add(key);
                                found.push(ev);
                            }
                        }
                    } catch (e) {
                        console.warn('[FTV2] EuropePMC xml parse failed', candidateId, e.message || e);
                    }
                }
                // politeness
                await sleep(CONFIG.ENTREZ_SLEEP);
                if (found.length >= CONFIG.ARTICLES_PER_GENE) break;
            }
        }

        // 3) Final fallback: PubMed abstracts (if still little evidence)
        if (found.length < 3) {
            const searchParamsPubMed = {
                db: 'pubmed',
                term: buildQueryPubMed(gene),
                retmode: 'json',
                retmax: CONFIG.ARTICLES_PER_GENE.toString(),
                tool: CONFIG.TOOL_NAME,
                email: CONFIG.USER_EMAIL
            };
            const searchRespPubMed = await makeApiRequest(CONFIG.ESEARCH_URL, searchParamsPubMed, `PubMed search ${gene}`);
            const pmids = (await searchRespPubMed.json())?.esearchresult?.idlist || [];

            if (pmids.length > 0) {
                await sleep(CONFIG.ENTREZ_SLEEP);
                const fetchParams = {
                    db: 'pubmed',
                    id: pmids.join(','),
                    retmode: 'xml',
                    rettype: 'abstract',
                    tool: CONFIG.TOOL_NAME,
                    email: CONFIG.USER_EMAIL
                };
                const fetchResp = await makeApiRequest(CONFIG.EFETCH_URL, fetchParams, `PubMed fetch ${gene}`);
                const xml = await fetchResp.text();
                const xmlDoc = xmlToDoc(xml);
                const articles = xmlDoc.querySelectorAll('PubmedArticle');
                articles.forEach(article => {
                    const pmid = article.querySelector('PMID')?.textContent || '';
                    const title = article.querySelector('ArticleTitle')?.textContent || '';
                    const abstract = Array.from(article.querySelectorAll('AbstractText')).map(n => n.textContent).join(' ');
                    const combined = `${title}. ${abstract}`;
                    if (paragraphSubjectGenes(combined, allGenes).includes(gene) && CONFIG.LOCAL_ANALYSIS_KEYWORDS.some(kw => combined.toLowerCase().includes(kw))) {
                        const inferred = interpretEvidence(gene, combined);
                        const key = combined.substring(0, 140);
                        if (!seenContexts.has(key)) {
                            seenContexts.add(key);
                            found.push({ id: pmid, source: 'PubMed', context: combined, snippet: makeSnippetAroundGene(combined, gene), score: scoreParagraphForGene_v2(combined, gene), inferredRoles: inferred, refLink: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` });
                        }
                    }
                });
            }
        }

    } catch (err) {
        console.error(`[FTV2] Literature retrieval failed for ${gene}:`, err);
        const errEl = resultCard?.querySelector('.status-searching');
        if (errEl) { errEl.textContent = 'Literature Search Failed'; errEl.className = 'status-not-found'; }
    }

    // Deduplicate and global ranking
    //  - group by context start -> unique
    //  - score = paragraph raw score + log(1 + articleSupportCount)
    // compute support counts per short context across found items (some contexts will be repeated across articles)
    const contextToArticles = new Map();
    for (const ev of found) {
        const k = ev.context.substring(0, 160).trim();
        const set = contextToArticles.get(k) || new Set();
        set.add(`${ev.source}:${ev.id}`);
        contextToArticles.set(k, set);
    }

    // create final list with augmented score
    const final = [];
    const seenFinalKeys = new Set();
    for (const ev of found) {
        const key = ev.context.substring(0, 160).trim();
        if (seenFinalKeys.has(key)) continue;
        seenFinalKeys.add(key);
        const support = (contextToArticles.get(key)?.size) || 1;
        const artBoost = Math.log(1 + support); // modest boost for multiple supporting articles
        const paragraphRaw = ev.score?.raw || 0;
        const totalScore = paragraphRaw + artBoost;
        final.push({ ...ev, supportCount: support, totalScore });
    }

    final.sort((a, b) => b.totalScore - a.totalScore);
    // limit to configured max
    return final.slice(0, CONFIG.ARTICLES_PER_GENE);
}

/* Expose function */
window.analyzeGeneViaAPI_FT_v2 = analyzeGeneViaAPI_FT_v2;

/* Integration note:
   - In your runAnalysis(), replace analyzeGeneViaAPI(...) or analyzeGeneViaAPI_FT(...) calls with analyzeGeneViaAPI_FT_v2(...)
   - Example: const apiEvidence = await analyzeGeneViaAPI_FT_v2(gene, resultCard, geneList);
*/


// ============================================================================
// GLOBAL EXPORTS FOR ROUTER COMPATIBILITY
// ============================================================================

window.displayCiliAIPage = displayCiliAIPage;
window.setupCiliAIEventListeners = setupCiliAIEventListeners;
window.handleAIQuery = handleAIQuery;
window.analyzeGenesFromInput = analyzeGenesFromInput;
window.runAnalysis = runAnalysis;
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
