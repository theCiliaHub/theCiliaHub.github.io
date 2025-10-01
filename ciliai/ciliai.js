// ciliai.js - ENHANCED WITH ROBUST LITERATURE MINING ENGINE

// ============================================================================
// LITERATURE MINER ENGINE
// ============================================================================

class LiteratureMinerEngine {
    constructor() {
        // Configuration
        this.ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
        this.EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
        this.USER_AGENT = "CiliaMiner/2.0 (mailto:user@example.com)";

        this.API_QUERY_KEYWORDS = [
            "cilia", "ciliary", "cilia length", "ciliary length", "shorter cilia",
            "longer cilia", "ciliogenesis", "ciliation", "loss of cilia", "fewer cilia",
            "impaired ciliogenesis", "cilia assembly", "fluid flow", "mucociliary", "multiciliated"
        ];

        this.LOCAL_ANALYSIS_KEYWORDS = [...new Set([
            "cilia", "ciliary", "cilium", "ciliogenesis", "ciliation", "axoneme", "basal body",
            "cilia length", "shorter", "shortened", "longer", "fewer", "reduction", "reduced",
            "decrease", "increased", "increase", "flow", "fluid flow", "mucociliary", "multiciliated",
            "extracellular fluid", "bead", "beads", "displacement", "cilia-generated", "mucociliary clearance"
        ])];

        this.EFFECT_PATTERNS = {
            'shorter': /\b(shorter|shortened|decrease in length|reduced length|reduction in length)\b/i,
            'fewer': /\b(fewer|reduced number|decrease in number|loss of cilia|less cilia)\b/i,
            'reduced_flow': /\b(reduction in (flow|bead displacement)|reduced flow|decrease in bead displacement|significant reduction in bead)\b/i,
            'longer': /\b(longer|elongated|increase in length|elongation)\b/i,
            'no_change': /\b(unchanged|no effect|no difference|not altered|did not affect)\b/i,
            'increased': /\b(increased|increase|enhanced)\b/i
        };

        this.INFERENCE_LEXICON = {
            'MANIPULATION': {
                'LOSS': ['loss', 'knockout', 'deletion', 'mutation', 'loss-of-function'],
                'GAIN': ['overexpression', 'gain-of-function', 'activation']
            },
            'PHENOTYPE': {
                'LENGTH_DECREASE': ['shorter', 'shortened', 'decrease in length', 'reduced length'],
                'LENGTH_INCREASE': ['longer', 'elongated', 'increase in length', 'elongation'],
                'LENGTH_NEUTRAL': ['unchanged', 'no effect', 'no difference', 'not altered', 'unaltered'],
                'LENGTH_VARIABLE': ['variable', 'heterogeneous', 'mixed'],
                'FREQ_DECREASE': ['fewer', 'reduced number', 'loss of cilia', 'less cilia'],
                'FREQ_INCREASE': ['increased number', 'more cilia', 'hyper-ciliation'],
                'FREQ_NEUTRAL': ['no change', 'no difference', 'unchanged']
            }
        };

        this.ARTICLES_PER_GENE = 40;
        this.MAX_WORKERS = 4;
        this.REQUESTS_TIMEOUT = 30000;
        this.ENTREZ_SLEEP = 340;
    }

    // Utility function to sleep
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Make API request with retry logic
    async makeApiRequestWithRetry(url, params, headers, timeout, desc, retries = 3, backoffFactor = 0.5) {
        for (let i = 0; i < retries; i++) {
            try {
                const urlParams = new URLSearchParams(params);
                const fullUrl = `${url}?${urlParams}`;
                
                const response = await fetch(fullUrl, {
                    method: 'GET',
                    headers: headers,
                    signal: AbortSignal.timeout(timeout)
                });

                if (response.status === 429) {
                    const waitTime = backoffFactor * (2 ** i);
                    console.warn(`[WARN] Rate limited on ${desc}. Sleeping ${waitTime}s...`);
                    await this.sleep(waitTime * 1000);
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return response;
            } catch (error) {
                if (i === retries - 1) {
                    throw error;
                } else {
                    const waitTime = backoffFactor * (2 ** i);
                    console.warn(`[WARN] Request error (${desc}): ${error}. Retrying in ${waitTime}s...`);
                    await this.sleep(waitTime * 1000);
                }
            }
        }
    }

    // Build queries
    buildQueryAllFields(gene) {
        const kwClause = this.API_QUERY_KEYWORDS.map(k => `"${k}"[Title/Abstract]`).join(' OR ');
        return `("${gene}"[Title/Abstract]) AND (${kwClause})`;
    }

    buildQueryPmc(gene) {
        const kwClause = this.API_QUERY_KEYWORDS.join(' OR ');
        return `${gene} AND (${kwClause})`;
    }

    // Search PubMed
    async searchPubmed(gene, retmax = this.ARTICLES_PER_GENE) {
        const params = {
            'db': 'pubmed',
            'term': this.buildQueryAllFields(gene),
            'retmode': 'json',
            'retmax': retmax.toString()
        };
        const headers = {'User-Agent': this.USER_AGENT};
        
        const response = await this.makeApiRequestWithRetry(
            this.ESEARCH_URL, params, headers, this.REQUESTS_TIMEOUT, `PubMed search ${gene}`
        );
        
        const data = await response.json();
        const pmids = data?.esearchresult?.idlist || [];
        
        await this.sleep(this.ENTREZ_SLEEP);
        return pmids;
    }

    // Fetch PubMed abstracts
    async fetchPubmedAbstracts(pmids) {
        if (!pmids || pmids.length === 0) return [];
        
        const params = {
            'db': 'pubmed',
            'id': pmids.join(','),
            'retmode': 'xml',
            'rettype': 'abstract'
        };
        const headers = {'User-Agent': this.USER_AGENT};
        
        const response = await this.makeApiRequestWithRetry(
            this.EFETCH_URL, params, headers, this.REQUESTS_TIMEOUT, "PubMed fetch"
        );
        
        const text = await response.text();
        const articles = this.parsePubmedXml(text);
        
        await this.sleep(this.ENTREZ_SLEEP);
        return articles;
    }

    // Parse PubMed XML
    parsePubmedXml(xmlText) {
        const articles = [];
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        
        const pubmedArticles = xmlDoc.getElementsByTagName('PubmedArticle');
        
        for (let article of pubmedArticles) {
            const medlineCitation = article.getElementsByTagName('MedlineCitation')[0];
            if (!medlineCitation) continue;
            
            const articleInfo = medlineCitation.getElementsByTagName('Article')[0];
            if (!articleInfo) continue;
            
            const titleElem = articleInfo.getElementsByTagName('ArticleTitle')[0];
            const title = titleElem ? titleElem.textContent : "";
            
            const abstractElem = articleInfo.getElementsByTagName('Abstract')[0];
            let abstractText = "";
            
            if (abstractElem) {
                const abstractTexts = abstractElem.getElementsByTagName('AbstractText');
                abstractText = Array.from(abstractTexts)
                    .map(elem => elem.textContent)
                    .filter(text => text)
                    .join(' ');
            }
            
            const pmidElem = medlineCitation.getElementsByTagName('PMID')[0];
            const pmid = pmidElem ? pmidElem.textContent : null;
            
            articles.push({
                pmid: pmid,
                source: 'pubmed',
                title: title,
                text: abstractText
            });
        }
        
        return articles;
    }

    // Search PMC
    async searchPmc(gene, retmax = this.ARTICLES_PER_GENE) {
        const params = {
            'db': 'pmc',
            'term': this.buildQueryPmc(gene),
            'retmode': 'json',
            'retmax': retmax.toString()
        };
        const headers = {'User-Agent': this.USER_AGENT};
        
        const response = await this.makeApiRequestWithRetry(
            this.ESEARCH_URL, params, headers, this.REQUESTS_TIMEOUT, `PMC search ${gene}`
        );
        
        const data = await response.json();
        const pmcids = data?.esearchresult?.idlist || [];
        
        await this.sleep(this.ENTREZ_SLEEP);
        return pmcids;
    }

    // Fetch PMC full text
    async fetchPmcFullText(pmcids) {
        if (!pmcids || pmcids.length === 0) return [];
        
        const params = {
            'db': 'pmc',
            'id': pmcids.join(','),
            'retmode': 'xml'
        };
        const headers = {'User-Agent': this.USER_AGENT};
        
        const response = await this.makeApiRequestWithRetry(
            this.EFETCH_URL, params, headers, this.REQUESTS_TIMEOUT, "PMC fetch"
        );
        
        const text = await response.text();
        const articles = this.parsePmcXml(text);
        
        await this.sleep(this.ENTREZ_SLEEP);
        return articles;
    }

    // Parse PMC XML
    parsePmcXml(xmlText) {
        const articles = [];
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        
        const articleElements = xmlDoc.getElementsByTagName('article');
        
        for (let article of articleElements) {
            let pmcid = null;
            const articleIds = article.getElementsByTagName('article-id');
            
            for (let aid of articleIds) {
                const pubIdType = aid.getAttribute('pub-id-type');
                if (pubIdType && pubIdType.toLowerCase().includes('pmc')) {
                    pmcid = aid.textContent;
                    break;
                }
            }
            
            const titleElem = article.getElementsByTagName('article-title')[0];
            const title = titleElem ? titleElem.textContent : "";
            
            const paragraphs = [];
            const body = article.getElementsByTagName('body')[0];
            
            if (body) {
                // Get paragraphs
                const pElements = body.getElementsByTagName('p');
                for (let p of pElements) {
                    const text = p.textContent.trim();
                    if (text) paragraphs.push(text);
                }
                
                // Get captions
                const captions = body.getElementsByTagName('caption');
                for (let cap of captions) {
                    const text = cap.textContent.trim();
                    if (text) paragraphs.push(text);
                }
            }
            
            // Fallback: get section text
            const sections = article.getElementsByTagName('sec');
            for (let sec of sections) {
                const text = sec.textContent.trim();
                if (text) paragraphs.push(text);
            }
            
            articles.push({
                pmcid: pmcid,
                source: 'pmc',
                title: title,
                paragraphs: paragraphs
            });
        }
        
        return articles;
    }

    // Text analysis functions
    paragraphMatches(paragraph, gene) {
        if (!paragraph) return false;
        
        const geneRegex = new RegExp('\\b' + gene.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
        if (!geneRegex.test(paragraph)) return false;
        
        const parLower = paragraph.toLowerCase();
        return this.LOCAL_ANALYSIS_KEYWORDS.some(kw => parLower.includes(kw.toLowerCase()));
    }

    sentenceContextMatches(paragraph, gene, windowSentences = 1) {
        const sents = paragraph.trim().split(/[.!?]+\s+/).filter(s => s);
        const matches = [];
        const geneRegex = new RegExp('\\b' + gene.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
        
        for (let i = 0; i < sents.length; i++) {
            if (geneRegex.test(sents[i])) {
                const start = Math.max(0, i - windowSentences);
                const end = Math.min(sents.length, i + windowSentences + 1);
                const context = sents.slice(start, end).join(' ').trim();
                
                if (this.LOCAL_ANALYSIS_KEYWORDS.some(kw => context.toLowerCase().includes(kw.toLowerCase()))) {
                    matches.push(context);
                }
            }
        }
        
        return matches;
    }

    detectEffect(contextText) {
        const found = [];
        for (const [label, pattern] of Object.entries(this.EFFECT_PATTERNS)) {
            if (pattern.test(contextText)) {
                found.push(label);
            }
        }
        return found.length > 0 ? found : ['unknown'];
    }

    paragraphSubjectGenes(paragraph, allGenes) {
        const mentioned = allGenes.filter(g => {
            const regex = new RegExp('\\b' + g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
            return regex.test(paragraph);
        });
        
        if (mentioned.length > 0) {
            return mentioned;
        }
        
        // Check for collective phrases
        const collectiveRegex = /\b(these (single )?mutants|all mutants|all genes|each mutant)\b/i;
        if (collectiveRegex.test(paragraph)) {
            return allGenes;
        }
        
        return [];
    }

    // Main processing function
    async processGene(gene, allGenesInList = null) {
        const allGenes = allGenesInList || [gene];
        console.log(`[INFO] Processing gene: ${gene}`);
        
        const results = {
            gene: gene,
            articles: [],
            found_articles: 0
        };
        
        const seenIds = new Set();

        try {
            // PubMed processing
            const pmids = await this.searchPubmed(gene);
            if (pmids.length > 0) {
                const pubmedArticles = await this.fetchPubmedAbstracts(pmids);
                
                for (const art of pubmedArticles) {
                    const artId = `pmid:${art.pmid}`;
                    if (seenIds.has(artId)) continue;
                    seenIds.add(artId);

                    const combinedText = `${art.title || ''}. ${art.text || ''}`;
                    const paragraphs = combinedText.split(/\n{2,}/);
                    
                    for (const p of paragraphs) {
                        const subjectGenes = this.paragraphSubjectGenes(p, allGenes);
                        if (subjectGenes.length === 0) continue;

                        const sentContexts = this.sentenceContextMatches(p, gene, 2);
                        const contexts = sentContexts.length > 0 ? sentContexts : [p];

                        const evidences = [];
                        for (const c of contexts) {
                            const effects = this.detectEffect(c);
                            for (const subjGene of subjectGenes) {
                                evidences.push({
                                    gene: subjGene,
                                    context: c,
                                    effects: effects,
                                    source: 'pubmed',
                                    id: art.pmid
                                });
                            }
                        }
                        
                        if (evidences.length > 0) {
                            results.articles.push({
                                id: art.pmid,
                                source: 'pubmed',
                                title: art.title,
                                evidence: evidences
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`[ERROR] PubMed handling failed for ${gene}:`, error);
        }

        try {
            // PMC processing
            const pmcids = await this.searchPmc(gene);
            if (pmcids.length > 0) {
                const pmcArticles = await this.fetchPmcFullText(pmcids);
                
                for (const art of pmcArticles) {
                    const artId = `pmcid:${art.pmcid || art.title}`;
                    if (seenIds.has(artId)) continue;
                    seenIds.add(artId);

                    const paragraphs = art.paragraphs || [];
                    for (const p of paragraphs) {
                        const subjectGenes = this.paragraphSubjectGenes(p, allGenes);
                        if (subjectGenes.length === 0) continue;

                        const sentContexts = this.sentenceContextMatches(p, gene, 2);
                        const contexts = sentContexts.length > 0 ? sentContexts : [p];

                        const evidences = [];
                        for (const c of contexts) {
                            const effects = this.detectEffect(c);
                            for (const subjGene of subjectGenes) {
                                evidences.push({
                                    gene: subjGene,
                                    context: c,
                                    effects: effects,
                                    source: 'pmc',
                                    id: art.pmcid
                                });
                            }
                        }
                        
                        if (evidences.length > 0) {
                            results.articles.push({
                                id: art.pmcid,
                                source: 'pmc',
                                title: art.title,
                                evidence: evidences
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`[ERROR] PMC handling failed for ${gene}:`, error);
        }

        results.found_articles = results.articles.length;
        console.log(`[INFO] Done ${gene} -> ${results.found_articles} article(s) with evidence found`);
        return results;
    }

    // Inference and interpretation functions
    interpretEvidence(gene, evidenceText) {
        const inferredRoles = { length: [], frequency: [] };
        if (!evidenceText) return inferredRoles;

        const clauses = evidenceText.split(/[.;]|,?\s+(while|whereas|but)\s+/i);
        
        for (const clause of clauses) {
            const context = (clause || "").toLowerCase();
            const geneRegex = new RegExp('\\b' + gene.toLowerCase() + '\\b');
            if (!geneRegex.test(context)) continue;

            const negation = /\b(no|not|did not|none|unchanged|unaltered|without)\b/.test(context);
            const isLoss = this.INFERENCE_LEXICON.MANIPULATION.LOSS.some(kw => context.includes(kw.toLowerCase()));
            const isGain = this.INFERENCE_LEXICON.MANIPULATION.GAIN.some(kw => context.includes(kw.toLowerCase()));

            const inferRole = (phenotypeList, lossRole = 'PROMOTES', gainRole = 'INHIBITS') => {
                const role = [];
                for (const kw of phenotypeList) {
                    if (context.includes(kw.toLowerCase())) {
                        if (negation) {
                            role.push('NEUTRAL');
                        } else {
                            if (isLoss) role.push(lossRole);
                            if (isGain) role.push(gainRole);
                        }
                    }
                }
                return role;
            };

            inferredRoles.length.push(...inferRole(this.INFERENCE_LEXICON.PHENOTYPE.LENGTH_DECREASE, 'PROMOTES', 'INHIBITS'));
            inferredRoles.length.push(...inferRole(this.INFERENCE_LEXICON.PHENOTYPE.LENGTH_INCREASE, 'INHIBITS', 'PROMOTES'));
            inferredRoles.length.push(...inferRole(this.INFERENCE_LEXICON.PHENOTYPE.LENGTH_NEUTRAL, 'NEUTRAL', 'NEUTRAL'));
            inferredRoles.length.push(...inferRole(this.INFERENCE_LEXICON.PHENOTYPE.LENGTH_VARIABLE, 'VARIABLE', 'VARIABLE'));

            inferredRoles.frequency.push(...inferRole(this.INFERENCE_LEXICON.PHENOTYPE.FREQ_DECREASE, 'PROMOTES', 'INHIBITS'));
            inferredRoles.frequency.push(...inferRole(this.INFERENCE_LEXICON.PHENOTYPE.FREQ_INCREASE, 'INHIBITS', 'PROMOTES'));
            inferredRoles.frequency.push(...inferRole(this.INFERENCE_LEXICON.PHENOTYPE.FREQ_NEUTRAL, 'NEUTRAL', 'NEUTRAL'));
        }

        // Remove duplicates
        inferredRoles.length = [...new Set(inferredRoles.length)];
        inferredRoles.frequency = [...new Set(inferredRoles.frequency)];

        return inferredRoles;
    }

    generateFinalSummary(roles) {
        if (!roles || roles.length === 0) return `<span class="text-gray-500">No specific data</span>`;
        
        const counts = {};
        roles.forEach(role => {
            counts[role] = (counts[role] || 0) + 1;
        });

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

    // Main function to process multiple genes
    async processGenes(genes, progressCallback = null) {
        const allResults = {};
        console.log(`[INFO] Starting search and interpretation for ${genes.length} genes...`);

        // Process genes sequentially to respect rate limits
        for (let i = 0; i < genes.length; i++) {
            const gene = genes[i];
            if (progressCallback) {
                progressCallback(i + 1, genes.length, gene);
            }
            
            try {
                const result = await this.processGene(gene, genes);
                allResults[gene] = result;
            } catch (error) {
                console.error(`[ERROR] ${gene} generated an exception:`, error);
                allResults[gene] = {
                    gene: gene,
                    articles: [],
                    found_articles: 0,
                    error: error.message
                };
            }
        }

        const output = {
            metadata: {
                timestamp: new Date().toISOString(),
                genes_processed: genes.length
            },
            results: allResults
        };

        return output;
    }
}

// ============================================================================
// ENHANCED CILI AI
// ============================================================================

class EnhancedCiliAI {
    constructor() {
        this.miner = new LiteratureMinerEngine();
        this.isProcessing = false;
    }

    // Main function to integrate with CiliAI
    async analyzeGenes(genes) {
        if (this.isProcessing) {
            throw new Error('Analysis already in progress');
        }

        this.isProcessing = true;
        
        try {
            // Update UI to show processing
            this.updateUI('processing', { genes: genes });
            
            const results = await this.miner.processGenes(genes, (current, total, gene) => {
                this.updateUI('progress', { current, total, gene });
            });
            
            this.updateUI('complete', { results });
            return results;
            
        } catch (error) {
            this.updateUI('error', { error: error.message });
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    updateUI(state, data) {
        // Integrate with existing CiliAI UI update mechanism
        console.log(`UI Update: ${state}`, data);
        
        switch (state) {
            case 'processing':
                // Show loading spinner, disable inputs
                if (window.ciliai && window.ciliai.updateStatus) {
                    window.ciliai.updateStatus(`Starting analysis for ${data.genes.length} genes...`);
                } else {
                    const analyzeBtn = document.getElementById('analyzeBtn');
                    if (analyzeBtn) {
                        analyzeBtn.disabled = true;
                        analyzeBtn.textContent = 'Analyzing...';
                    }
                }
                break;
            case 'progress':
                // Update progress bar
                if (window.ciliai && window.ciliai.updateProgress) {
                    const percent = (data.current / data.total) * 100;
                    window.ciliai.updateProgress(percent, `Processing ${data.gene} (${data.current}/${data.total})`);
                } else {
                    const resultsContainer = document.getElementById('resultsContainer');
                    if (resultsContainer) {
                        const existingCard = document.getElementById(`card-${data.gene}`);
                        if (!existingCard) {
                            resultsContainer.insertAdjacentHTML('beforeend', createPlaceholderCard(data.gene, 'hybrid'));
                        }
                    }
                }
                break;
            case 'complete':
                // Display results
                if (window.ciliai && window.ciliai.displayResults) {
                    window.ciliai.displayResults(data.results);
                } else {
                    const resultsContainer = document.getElementById('resultsContainer');
                    if (resultsContainer) {
                        resultsContainer.innerHTML = '';
                        for (const gene in data.results) {
                            const result = data.results[gene];
                            const evidence = [];
                            result.articles.forEach(article => {
                                article.evidence.forEach(ev => {
                                    if (ev.gene === gene) {
                                        evidence.push({
                                            id: ev.id,
                                            source: ev.source.toUpperCase(),
                                            context: ev.context,
                                            inferredRoles: this.miner.interpretEvidence(gene, ev.context),
                                            refLink: ev.source === 'pubmed' ? `https://pubmed.ncbi.nlm.nih.gov/${ev.id}/` : `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${ev.id}/`
                                        });
                                    }
                                });
                            });
                            resultsContainer.insertAdjacentHTML('beforeend', createResultCard(gene, evidence));
                        }
                    }
                }
                break;
            case 'error':
                // Show error
                if (window.ciliai && window.ciliai.showError) {
                    window.ciliai.showError(data.error);
                } else {
                    const resultsContainer = document.getElementById('resultsContainer');
                    if (resultsContainer) {
                        resultsContainer.innerHTML = `<p class="status-not-found">Error: ${data.error}</p>`;
                    }
                }
                break;
        }
    }
}

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
                                <label for="hybrid" title="Best for most users. Combines our fast, expert-curated database, screen data, and real-time AI literature mining for the most comprehensive results;">
                                    <span class="mode-icon">🔬</span>
                                    <div><strong>Hybrid</strong><br><small>Expert DB + Screen Data + Literature</small></div>
                                </label>
                            </div>
                            <div class="mode-option">
                                <input type="radio" id="expert" name="mode" value="expert">
                                <label for="expert" title="Fastest option. Queries only our internal, manually curated database and screen data of known gene-cilia interactions;">
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
            .evidence-snippet mark{background-color:#ffeeba;padding:.1em .2em;border
