/*
============================================================================
 CiliAI - Consolidated & Corrected Script
 Version: 2.1 (Pure Europe PMC Implementation)

 This file contains the complete, corrected JavaScript code for the CiliAI tool.
 - Fixes ReferenceErrors for 'geneDataCache' and 'analyzeGeneViaFullTextPMC'.
 - Replaces all NCBI eUtils calls with the Europe PMC REST API to avoid CORS errors.
 - Consolidates multiple literature retriever versions into a single, clean function.
============================================================================
*/

// ============================================================================
// GLOBAL STATE & CACHE INITIALIZATION
// ============================================================================

// FIX: Declare geneDataCache in the global scope to prevent ReferenceError
let geneDataCache = new Map();


// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // NOTE: Removed NCBI URLs, they are no longer used for fetching.
    USER_EMAIL: "user@example.com", // It's good practice for users to know this can be changed
    TOOL_NAME: "CiliAI/2.1-EPMC",

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

    ARTICLES_PER_GENE: 10, // Reduced for faster client-side performance
    MAX_CONCURRENT: 2,
    REQUEST_TIMEOUT: 30000,
    ENTREZ_SLEEP: 150, // Can be shorter for non-NCBI APIs
    RETRY_ATTEMPTS: 2,
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
            "id": "21873644", "source": "pubmed",
            "context": "...loss of HDAC6 results in hyperacetylation of tubulin and leads to the formation of longer, more stable primary cilia in renal epithelial cells.",
            "refLink": "https://pubmed.ncbi.nlm.nih.gov/21873644/"
        }]
    },
    "IFT88": {
        "evidence": [{
            "id": "10882118", "source": "pubmed",
            "context": "Mutations in IFT88 (polaris) disrupt intraflagellar transport, leading to a failure in cilia assembly and resulting in severely shortened or absent cilia.",
            "refLink": "https://pubmed.ncbi.nlm.nih.gov/10882118/"
        }]
    },
    "ARL13B": {
        "evidence": [{
            "id": "21940428", "source": "pubmed",
            "context": "The small GTPase ARL13B is critical for ciliary structure; its absence leads to stunted cilia with abnormal morphology and axonemal defects.",
            "refLink": "https://pubmed.ncbi.nlm.nih.gov/21940428/"
        }]
    }
};

// ============================================================================
// CORE UTILITY FUNCTIONS
// ============================================================================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function makeApiRequest(url, params = {}, description = 'API Request', retries = CONFIG.RETRY_ATTEMPTS) {
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;

    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

            const response = await fetch(fullUrl, { method: 'GET', signal: controller.signal });
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
// TEXT ANALYSIS & INFERENCE
// ============================================================================

function paragraphSubjectGenes(paragraph, allGenes) {
    const mentioned = allGenes.filter(g => new RegExp(`\\b${g}\\b`, 'i').test(paragraph));
    if (mentioned.length > 0) return mentioned;
    if (/\b(these (single )?mutants|all mutants|all genes|each mutant|compared to control)\b/i.test(paragraph)) {
        return allGenes;
    }
    return [];
}

function hasQuantitativeData(text) {
    return /\b(\d+(\.\d+)?\s?(µm|%|vs|±|twofold|fold-change))\b/i.test(text);
}

function interpretEvidence(gene, evidenceText) {
    const inferredRoles = { length: [], frequency: [] };
    const sentences = evidenceText.split(/(?<=[.!?])\s+/);

    for (const sentence of sentences) {
        const context = sentence.toLowerCase();
        if (!new RegExp(`\\b${gene.toLowerCase()}\\b`).test(context)) continue;

        const negation = /\b(no|not|did not|none|unchanged|unaltered|without)\b/i.test(context);
        const isLoss = INFERENCE_LEXICON.MANIPULATION.LOSS.some(kw => context.includes(kw.toLowerCase()));
        const isGain = INFERENCE_LEXICON.MANIPULATION.GAIN.some(kw => context.includes(kw.toLowerCase()));
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

// ============================================================================
// PURE EUROPE PMC LITERATURE RETRIEVER (CORS-SAFE)
// ============================================================================

const EPMC_CONFIG = {
    BASE_URL: 'https://www.ebi.ac.uk/europepmc/webservices/rest',
    CACHE_ENABLED: true,
    CACHE_TTL_MS: 1000 * 60 * 60 * 24 * 14, // 14 days
    MAX_SNIPPET_LENGTH: 600,
    MIN_PARAGRAPH_SCORE: 0.35,
    PROXIMITY_WINDOW: 120,
};

const EPMCCache = {
    _mem: new Map(),
    get(k) {
        if (this._mem.has(k)) return this._mem.get(k);
        if (!EPMC_CONFIG.CACHE_ENABLED) return null;
        try {
            const raw = localStorage.getItem(`ciliai_epmc_${k}`);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (Date.now() - parsed._ts > EPMC_CONFIG.CACHE_TTL_MS) {
                localStorage.removeItem(`ciliai_epmc_${k}`);
                return null;
            }
            this._mem.set(k, parsed.value);
            return parsed.value;
        } catch (e) { return null; }
    },
    set(k, v) {
        this._mem.set(k, v);
        if (!EPMC_CONFIG.CACHE_ENABLED) return;
        try { localStorage.setItem(`ciliai_epmc_${k}`, JSON.stringify({ _ts: Date.now(), value: v })); } catch {}
    }
};

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function xmlToDoc(xmlText) { return new DOMParser().parseFromString(xmlText, 'application/xml'); }

function extractParagraphsFromXmlDoc(xmlDoc) {
    const out = [];
    try {
        const root = xmlDoc.querySelector('body') || xmlDoc;
        if (!root) return out;
        // Extract from paragraphs, sections, captions, tables, and supplementary materials
        const nodes = root.querySelectorAll('p, sec, caption, title, td, "supplementary-material"');
        nodes.forEach(n => {
            const txt = (n.textContent || '').replace(/\s+/g, ' ').trim();
            if (txt.length > 40) out.push(txt); // Min length for meaningful text
        });
    } catch (e) { console.warn('[EPMC] Extract paragraphs failed', e); }
    return [...new Set(out)]; // Return unique paragraphs
}

function scoreParagraphForGene(paragraph, gene) {
    const text = paragraph.toLowerCase();
    const geneLower = gene.toLowerCase();
    const geneMatches = (text.match(new RegExp(`\\b${escapeRegExp(geneLower)}\\b`, 'g')) || []).length;
    const geneScore = Math.min(3, geneMatches);
    let keywordHits = CONFIG.LOCAL_ANALYSIS_KEYWORDS.reduce((acc, kw) => acc + (text.includes(kw.toLowerCase()) ? 1 : 0), 0);
    const keywordScore = Math.min(4, keywordHits);
    let proximityScore = 0;
    const idx = text.indexOf(geneLower);
    if (idx !== -1) {
        for (const kw of CONFIG.LOCAL_ANALYSIS_KEYWORDS) {
            const kidx = text.indexOf(kw.toLowerCase());
            if (kidx !== -1) {
                const prox = Math.abs(kidx - idx);
                proximityScore = Math.max(proximityScore, (EPMC_CONFIG.PROXIMITY_WINDOW - prox) / EPMC_CONFIG.PROXIMITY_WINDOW * 2);
            }
        }
    }
    const quantBonus = hasQuantitativeData(text) ? 1.5 : 0;
    const manipAll = INFERENCE_LEXICON.MANIPULATION.LOSS.concat(INFERENCE_LEXICON.MANIPULATION.GAIN);
    const manipBonus = manipAll.some(m => text.includes(m.toLowerCase())) ? 1.0 : 0;
    const raw = geneScore + keywordScore + proximityScore + quantBonus + manipBonus;
    return { raw, normalized: Math.min(1, raw / 9) };
}

function makeSnippetAroundGene(text, gene) {
    const maxLen = EPMC_CONFIG.MAX_SNIPPET_LENGTH;
    const idx = text.toLowerCase().indexOf(gene.toLowerCase());
    if (idx === -1) return text.slice(0, maxLen) + (text.length > maxLen ? '…' : '');
    const half = Math.floor(maxLen / 2);
    const start = Math.max(0, idx - half);
    let snip = text.slice(start, start + maxLen);
    if (start > 0) snip = '…' + snip;
    if (start + maxLen < text.length) snip = snip + '…';
    return snip;
}

async function searchEuropePMC_for_gene(gene) {
    const kwClause = CONFIG.API_QUERY_KEYWORDS.join(' OR ');
    const query = `(AUTH:"${gene}" OR "${gene}") AND (${kwClause}) AND (HAS_FT:y)`;
    const params = { query, format: 'json', pageSize: CONFIG.ARTICLES_PER_GENE.toString() };
    const resp = await makeApiRequest(`${EPMC_CONFIG.BASE_URL}/search`, params, `Europe PMC search ${gene}`);
    const j = await resp.json();
    return j?.resultList?.result || [];
}

async function fetchEuropePMCFullTextXML(pmcid) {
    const id = pmcid.toString().replace(/^PMC/i, '');
    const key = `epmc_ft_${id}`;
    const cached = EPMCCache.get(key);
    if (cached) return cached;

    const url = `${EPMC_CONFIG.BASE_URL}/PMC${encodeURIComponent(id)}/fullTextXML`;
    const resp = await makeApiRequest(url, {}, `EuropePMC fullTextXML ${id}`);
    const txt = await resp.text();
    EPMCCache.set(key, txt);
    return txt;
}

async function extractEvidenceFromXmlText(xmlText, gene, allGenes, sourceTag, articleId, refLink) {
    const xmlDoc = xmlToDoc(xmlText);
    const paragraphs = extractParagraphsFromXmlDoc(xmlDoc);
    const candidates = [];
    for (const para of paragraphs) {
        if (!paragraphSubjectGenes(para, allGenes).includes(gene)) continue;
        if (!CONFIG.LOCAL_ANALYSIS_KEYWORDS.some(kw => para.toLowerCase().includes(kw))) continue;
        const score = scoreParagraphForGene(para, gene);
        if (score.normalized < EPMC_CONFIG.MIN_PARAGRAPH_SCORE) continue;
        
        candidates.push({
            id: articleId, source: sourceTag, context: para,
            snippet: makeSnippetAroundGene(para, gene), score, 
            inferredRoles: interpretEvidence(gene, para), refLink
        });
    }
    candidates.sort((a, b) => b.score.raw - a.score.raw);
    return candidates;
}

/**
 * Main literature retrieval orchestrator. Relies exclusively on Europe PMC.
 */
async function analyzeGeneViaEuropePMC(gene, resultCard, allGenes) {
    const foundEvidence = [];
    const seenContexts = new Set();

    try {
        updateCardStatus(resultCard, `Searching Europe PMC for ${gene}...`);
        const epmcHits = await searchEuropePMC_for_gene(gene);

        if (epmcHits.length === 0) {
            updateCardStatus(resultCard, `No open access full-text articles found for ${gene}.`, 'status-not-found');
            return [];
        }

        let processedCount = 0;
        for (const hit of epmcHits) {
            if (processedCount >= CONFIG.ARTICLES_PER_GENE) break;
            const pmcid = hit.pmcid;
            if (!pmcid) continue;

            updateCardStatus(resultCard, `Analyzing PMC${pmcid}...`);
            try {
                const xmlText = await fetchEuropePMCFullTextXML(pmcid);
                if (xmlText) {
                    const refLink = hit.doi ? `https://doi.org/${hit.doi}` : `https://europepmc.org/articles/${pmcid}`;
                    const snippets = await extractEvidenceFromXmlText(xmlText, gene, allGenes, 'EuropePMC', pmcid, refLink);
                    for (const ev of snippets) {
                        const contextKey = ev.context.substring(0, 150);
                        if (!seenContexts.has(contextKey)) {
                            seenContexts.add(contextKey);
                            foundEvidence.push(ev);
                        }
                    }
                }
            } catch (err) {
                console.warn(`[EPMC] Failed to process ${pmcid}:`, err);
            }
            
            processedCount++;
            await sleep(CONFIG.ENTREZ_SLEEP);
        }
    } catch (err) {
        console.error(`[EPMC] Literature retrieval failed for ${gene}:`, err);
        updateCardStatus(resultCard, 'Literature Search Failed', 'status-not-found');
    }

    foundEvidence.sort((a, b) => (b.score?.raw || 0) - (a.score?.raw || 0));
    return foundEvidence.slice(0, CONFIG.ARTICLES_PER_GENE);
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
// UI DISPLAY & EVENT HANDLING
// ============================================================================

function displayCiliAIPage() {
    const contentArea = document.querySelector('.content-area');
    if (!contentArea) { console.error('Content area not found'); return; }
    contentArea.className = 'content-area content-area-full';
    const ciliaPanel = document.querySelector('.cilia-panel');
    if (ciliaPanel) { ciliaPanel.style.display = 'none'; }

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
                                <label for="nlp" title="Most current data. Performs a live AI-powered search across Europe PMC full-text articles. May be slower but includes the very latest findings.">
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
            .ciliai-header{text-align:center;margin-bottom:2rem} .ciliai-header h1{font-size:2.8rem;color:#2c5aa0;margin:0}
            .ciliai-header p{font-size:1.2rem;color:#555;margin-top:.5rem} .ai-query-section{background-color:#e8f4fd;border:1px solid #bbdefb;padding:1.5rem 2rem;border-radius:8px;margin-bottom:2rem}
            .ai-query-section h3{margin-top:0;color:#2c5aa0} .ai-input-group{display:flex;gap:10px} .ai-query-input{flex-grow:1;padding:.8rem;border:1px solid #ccc;border-radius:4px;font-size:1rem}
            .ai-query-btn{padding:.8rem 1.2rem;font-size:1rem;background-color:#2c5aa0;color:#fff;border:none;border-radius:4px;cursor:pointer;transition:background-color .2s}
            .ai-query-btn:hover{background-color:#1e4273} .input-section{background-color:#fff;padding:2rem;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.05)}
            .input-section h3{margin-top:0;color:#333} .input-group{margin-bottom:1.5rem} .input-group label{display:block;font-weight:700;margin-bottom:.5rem;color:#333}
            .gene-input-textarea{width:100%;padding:.8rem;border:1px solid #ccc;border-radius:4px;font-size:1rem;min-height:80px;resize:vertical}
            .mode-selector{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem} .mode-option input[type=radio]{display:none}
            .mode-option label{display:flex;align-items:center;gap:10px;padding:1rem;border:2px solid #ddd;border-radius:8px;cursor:pointer;transition:all .2s}
            .mode-option input[type=radio]:checked+label{border-color:#2c5aa0;background-color:#e8f4fd;box-shadow:0 0 5px rgba(44,90,160,.3)}
            .mode-icon{font-size:1.8rem} .analyze-btn{width:100%;padding:1rem;font-size:1.1rem;font-weight:700;background-color:#28a745;color:#fff;border:none;border-radius:8px;cursor:pointer;transition:background-color .2s}
            .analyze-btn[disabled]{background-color:#a5d6a7;cursor:not-allowed} .analyze-btn:hover:not([disabled]){background-color:#218838}
            .results-section{margin-top:2rem;padding:2rem;background-color:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.05)}
            .result-card{border:1px solid #ddd;border-radius:8px;padding:1.5rem;margin-bottom:1.5rem;position:relative;overflow:hidden}
            .result-card h3{margin-top:0;color:#2c5aa0;font-size:1.4rem} .result-card .status-found{color:#28a745} .result-card .status-not-found{color:#dc3545}
            .result-card .status-searching{color:#007bff} .prediction-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem}
            .prediction-box{padding:1rem;border-radius:6px;text-align:center;background-color:#f8f9fa;border:1px solid #dee2e6}
            .prediction-box.promotes-maintains{background-color:#d4edda;border-color:#c3e6cb} .prediction-box.inhibits-restricts{background-color:#f8d7da;border-color:#f5c6cb}
            .prediction-box.no-effect-neutral{background-color:#e2e3e5;border-color:#d6d8db} .prediction-box.variable-mixed-phenotype{background-color:#d1c4e9;border-color:#b39ddb}
            .prediction-box.no-specific-data, .prediction-box.unclear{background-color:#f8f9fa;border-color:#dee2e6}
            .prediction-box p{margin:0;font-size:1.2rem;font-weight:700} .prediction-box h4{margin:0 0 .5rem;color:#495057}
            .evidence-section{margin-top:1.5rem;border-top:1px solid #eee;padding-top:1rem}
            .evidence-toggle{background:0 0;border:1px solid #2c5aa0;color:#2c5aa0;padding:.4rem .8rem;border-radius:20px;cursor:pointer;font-weight:700;transition:all .2s;margin-bottom:.5rem}
            .evidence-toggle:hover{background-color:#e8f4fd} .evidence-content{display:none;margin-top:1rem;padding-left:1rem;border-left:3px solid #bbdefb}
            .evidence-snippet{background-color:#f1f3f5;padding:.8rem;border-radius:4px;margin-bottom:.8rem;font-size:.9rem;color:#333}
            .evidence-snippet strong{color:#0056b3} .evidence-snippet mark{background-color:#ffeeba;padding:.1em .2em;border-radius:3px}
            .evidence-snippet a{color:#2c5aa0;text-decoration:none;font-weight:bold;} .evidence-snippet a:hover{text-decoration:underline;}
            .text-gray-500{color:#6c757d} .font-semibold{font-weight:600} .text-blue-600{color:#0056b3}
            .text-green-600{color:#28a745} .text-red-600{color:#dc3545} .text-yellow-700{color:#856404} .text-purple-600{color:#6f42c1}
        </style>
    `;
    setupCiliAIEventListeners();
};

function setupCiliAIEventListeners() {
    document.getElementById('analyzeBtn')?.addEventListener('click', analyzeGenesFromInput);
    document.getElementById('aiQueryBtn')?.addEventListener('click', handleAIQuery);
    document.getElementById('geneInput')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); analyzeGenesFromInput(); }});
    document.getElementById('aiQueryInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleAIQuery(); });
    document.getElementById('resultsContainer')?.addEventListener('click', e => {
        if (e.target?.classList.contains('evidence-toggle')) {
            const content = e.target.nextElementSibling;
            if (content) {
                const isVisible = content.style.display === 'block';
                content.style.display = isVisible ? 'none' : 'block';
                e.target.textContent = isVisible ? `Show Evidence (${e.target.dataset.count}) ▾` : `Hide Evidence (${e.target.dataset.count}) ▴`;
            }
        }
    });
}

function handleAIQuery() {
    const query = document.getElementById('aiQueryInput')?.value.trim();
    const geneRegex = /\b([A-Z0-9]{3,})\b/g;
    const matches = query ? query.match(geneRegex) : null;
    if (matches?.length > 0) {
        const detectedGene = matches[0].toUpperCase();
        document.getElementById('geneInput').value = detectedGene;
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
    const genes = document.getElementById('geneInput')?.value
        .split(/[\s,]+/)
        .map(g => g.trim().toUpperCase())
        .filter(Boolean);
    if (!genes || genes.length === 0) {
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
                    id: `Screen-${gene}`, source: 'Screen Data', context,
                    inferredRoles: interpretEvidence(gene, context), refLink: '#'
                });
            }
        }

        if (mode === 'nlp' || mode === 'hybrid') {
            // ✅ CORRECTED: This now calls the pure, CORS-safe Europe PMC function.
            const apiEvidence = await analyzeGeneViaEuropePMC(gene, resultCard, geneList);
            allEvidence.push(...apiEvidence);
        }

        const finalHtml = createResultCard(gene, allEvidence);
        resultCard.outerHTML = finalHtml;
    }

    analyzeBtn.disabled = false;
    analyzeBtn.textContent = '🔍 Analyze Genes';
}

function updateCardStatus(cardElement, message, statusClass = 'status-searching') {
    if (!cardElement) return;
    const statusEl = cardElement.querySelector('.status-searching, .status-found, .status-not-found');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = statusClass;
    }
}


// ============================================================================
// RESULT CARD GENERATORS
// ============================================================================

function generateFinalSummary(roles) {
    if (roles.length === 0) return `<span class="text-gray-500">No specific data</span>`;
    const counts = roles.reduce((acc, val) => ({ ...acc, [val]: (acc[val] || 0) + 1 }), {});
    const promotes = counts['PROMOTES'] || 0;
    const inhibits = counts['INHIBITS'] || 0;
    const neutral = counts['NEUTRAL'] || 0;
    const variable = counts['VARIABLE'] || 0;

    if (neutral > 0 && promotes === 0 && inhibits === 0 && variable === 0) return `<span class="font-semibold text-blue-600">No effect / Neutral</span>`;
    if (promotes > 0 && inhibits > 0) return `<span class="font-semibold text-yellow-700">Variable / Mixed Phenotype</span>`;
    if (promotes > 0) return `<span class="font-semibold text-green-600">Promotes / Maintains</span>`;
    if (inhibits > 0) return `<span class="font-semibold text-red-600">Inhibits / Restricts</span>`;
    if (variable > 0) return `<span class="font-semibold text-purple-600">Variable / Mixed phenotype</span>`;
    return `<span class="text-gray-500">Unclear</span>`;
}

function createPlaceholderCard(gene, mode) {
    let statusText = 'Fetching from Expert DB and Screen Data...';
    if (mode === 'nlp') statusText = 'Searching Europe PMC live literature...';
    if (mode === 'hybrid') statusText = 'Checking Expert DB, Screen Data & Literature...';
    return `<div class="result-card" id="card-${gene}"><h3>${gene} - <span class="status-searching">${statusText}</span></h3></div>`;
}

function createResultCard(gene, allEvidence) {
    const uniqueEvidence = Array.from(new Map(allEvidence.map(ev => [ev.context.substring(0, 150), ev])).values());
    const statusText = uniqueEvidence.length > 0 ? 'Evidence Found' : 'No Data Found';
    const statusClass = uniqueEvidence.length > 0 ? 'status-found' : 'status-not-found';

    const allRoles = uniqueEvidence.reduce((acc, ev) => {
        acc.length.push(...(ev.inferredRoles?.length || []));
        acc.frequency.push(...(ev.inferredRoles?.frequency || []));
        return acc;
    }, { length: [], frequency: [] });

    const lengthSummary = generateFinalSummary(allRoles.length);
    const freqSummary = generateFinalSummary(allRoles.frequency);
    const lofClass = lengthSummary.replace(/<[^>]+>/g, '').toLowerCase().replace(/[^a-z]/g, '-');
    const percClass = freqSummary.replace(/<[^>]+>/g, '').toLowerCase().replace(/[^a-z]/g, '-');

    const summaryHtml = `
        <div class="prediction-grid">
            <div class="prediction-box ${lofClass}"><h4 class="prediction-title">Cilia Length</h4><p>${lengthSummary}</p></div>
            <div class="prediction-box ${percClass}"><h4 class="prediction-title">Ciliation Frequency</h4><p>${freqSummary}</p></div>
        </div>
    `;

    const evidenceHtml = uniqueEvidence.length > 0 ? `
        <div class="evidence-section">
            <button class="evidence-toggle" data-count="${uniqueEvidence.length}">Show Evidence (${uniqueEvidence.length}) ▾</button>
            <div class="evidence-content" style="display: none;">
                ${uniqueEvidence.map(ev => `
                    <div class="evidence-snippet">
                        ${(ev.snippet || ev.context).replace(new RegExp(`\\b(${gene})\\b`, 'ig'), `<mark>$1</mark>`)}
                        <br><a href="${ev.refLink}" target="_blank"><strong>Source: ${ev.source.toUpperCase()} (${ev.id})</strong></a>
                    </div>`).join('')}
            </div>
        </div>` : '';

    return `
        <div class="result-card" id="card-${gene}">
            <h3>${gene} - <span class="${statusClass}">${statusText}</span></h3>
            ${summaryHtml}
            ${evidenceHtml}
        </div>`;
}

// ============================================================================
// GLOBAL EXPORTS FOR ROUTER COMPATIBILITY
// ============================================================================

window.displayCiliAIPage = displayCiliAIPage;
window.setupCiliAIEventListeners = setupCiliAIEventListeners;
window.runAnalysis = runAnalysis;
