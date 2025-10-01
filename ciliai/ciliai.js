// literature_miner_engine.js - Fully functional JavaScript version for CiliAI
// Replace the existing ciliai.js with this enhanced version

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

        this.ARTICLES_PER_GENE = 20; // Reduced for faster testing
        this.REQUESTS_TIMEOUT = 30000;
        this.ENTREZ_SLEEP = 340;
    }

    // Utility function to sleep
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Make API request with retry logic
    async makeApiRequestWithRetry(url, params, desc, retries = 3, backoffFactor = 0.5) {
        for (let i = 0; i < retries; i++) {
            try {
                const urlParams = new URLSearchParams(params);
                const fullUrl = `${url}?${urlParams}`;
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.REQUESTS_TIMEOUT);
                
                const response = await fetch(fullUrl, {
                    method: 'GET',
                    headers: {
                        'User-Agent': this.USER_AGENT
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

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
        
        const response = await this.makeApiRequestWithRetry(
            this.ESEARCH_URL, params, `PubMed search ${gene}`
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
            'retmode': 'xml'
        };
        
        const response = await this.makeApiRequestWithRetry(
            this.EFETCH_URL, params, "PubMed fetch"
        );
        
        const text = await response.text();
        const articles = this.parsePubmedXml(text);
        
        await this.sleep(this.ENTREZ_SLEEP);
        return articles;
    }

    // Parse PubMed XML
    parsePubmedXml(xmlText) {
        const articles = [];
        
        // Simple XML parsing using DOMParser
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            
            // Check for parsing errors
            const parseError = xmlDoc.getElementsByTagName("parsererror")[0];
            if (parseError) {
                console.error("XML parsing error:", parseError.textContent);
                return articles;
            }
            
            const pubmedArticles = xmlDoc.getElementsByTagName('PubmedArticle');
            
            for (let i = 0; i < pubmedArticles.length; i++) {
                const article = pubmedArticles[i];
                const medlineCitation = article.getElementsByTagName('MedlineCitation')[0];
                if (!medlineCitation) continue;
                
                const articleInfo = medlineCitation.getElementsByTagName('Article')[0];
                if (!articleInfo) continue;
                
                // Get title
                const titleElem = articleInfo.getElementsByTagName('ArticleTitle')[0];
                const title = titleElem ? titleElem.textContent : "";
                
                // Get abstract
                let abstractText = "";
                const abstractElem = articleInfo.getElementsByTagName('Abstract')[0];
                if (abstractElem) {
                    const abstractTexts = abstractElem.getElementsByTagName('AbstractText');
                    for (let j = 0; j < abstractTexts.length; j++) {
                        if (abstractTexts[j].textContent) {
                            abstractText += abstractTexts[j].textContent + " ";
                        }
                    }
                }
                
                // Get PMID
                const pmidElem = medlineCitation.getElementsByTagName('PMID')[0];
                const pmid = pmidElem ? pmidElem.textContent : `unknown-${i}`;
                
                articles.push({
                    pmid: pmid,
                    source: 'pubmed',
                    title: title,
                    text: abstractText.trim()
                });
            }
        } catch (error) {
            console.error("Error parsing PubMed XML:", error);
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
        
        const response = await this.makeApiRequestWithRetry(
            this.ESEARCH_URL, params, `PMC search ${gene}`
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
        
        const response = await this.makeApiRequestWithRetry(
            this.EFETCH_URL, params, "PMC fetch"
        );
        
        const text = await response.text();
        const articles = this.parsePmcXml(text);
        
        await this.sleep(this.ENTREZ_SLEEP);
        return articles;
    }

    // Parse PMC XML
    parsePmcXml(xmlText) {
        const articles = [];
        
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            
            const parseError = xmlDoc.getElementsByTagName("parsererror")[0];
            if (parseError) {
                console.error("PMC XML parsing error:", parseError.textContent);
                return articles;
            }
            
            const articleElements = xmlDoc.getElementsByTagName('article');
            
            for (let i = 0; i < articleElements.length; i++) {
                const article = articleElements[i];
                
                // Get PMCID
                let pmcid = null;
                const articleIds = article.getElementsByTagName('article-id');
                for (let j = 0; j < articleIds.length; j++) {
                    const aid = articleIds[j];
                    const pubIdType = aid.getAttribute('pub-id-type');
                    if (pubIdType && pubIdType.toLowerCase().includes('pmc')) {
                        pmcid = aid.textContent;
                        break;
                    }
                }
                
                // Get title
                const titleElem = article.getElementsByTagName('article-title')[0];
                const title = titleElem ? titleElem.textContent : "";
                
                // Extract paragraphs from body
                const paragraphs = [];
                const body = article.getElementsByTagName('body')[0];
                
                if (body) {
                    // Get all paragraph elements
                    const pElements = body.getElementsByTagName('p');
                    for (let j = 0; j < pElements.length; j++) {
                        const text = pElements[j].textContent.trim();
                        if (text && text.length > 10) { // Minimum length filter
                            paragraphs.push(text);
                        }
                    }
                    
                    // Get captions
                    const captions = body.getElementsByTagName('caption');
                    for (let j = 0; j < captions.length; j++) {
                        const text = captions[j].textContent.trim();
                        if (text && text.length > 10) {
                            paragraphs.push(text);
                        }
                    }
                }
                
                // Fallback: get section text
                const sections = article.getElementsByTagName('sec');
                for (let j = 0; j < sections.length; j++) {
                    const text = sections[j].textContent.trim();
                    if (text && text.length > 10 && !paragraphs.includes(text)) {
                        paragraphs.push(text);
                    }
                }
                
                articles.push({
                    pmcid: pmcid || `pmc-unknown-${i}`,
                    source: 'pmc',
                    title: title,
                    paragraphs: paragraphs
                });
            }
        } catch (error) {
            console.error("Error parsing PMC XML:", error);
        }
        
        return articles;
    }

    // Text analysis functions
    paragraphMatches(paragraph, gene) {
        if (!paragraph) return false;
        
        const geneRegex = new RegExp('\\b' + this.escapeRegExp(gene) + '\\b', 'i');
        if (!geneRegex.test(paragraph)) return false;
        
        const parLower = paragraph.toLowerCase();
        return this.LOCAL_ANALYSIS_KEYWORDS.some(kw => parLower.includes(kw.toLowerCase()));
    }

    sentenceContextMatches(paragraph, gene, windowSentences = 1) {
        const sents = paragraph.trim().split(/[.!?]+\s+/).filter(s => s);
        const matches = [];
        const geneRegex = new RegExp('\\b' + this.escapeRegExp(gene) + '\\b', 'i');
        
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
            const regex = new RegExp('\\b' + this.escapeRegExp(g) + '\\b', 'i');
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

    // Utility function to escape regex characters
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
            console.log(`[INFO] Found ${pmids.length} PubMed articles for ${gene}`);
            
            if (pmids.length > 0) {
                const pubmedArticles = await this.fetchPubmedAbstracts(pmids);
                console.log(`[INFO] Fetched ${pubmedArticles.length} PubMed abstracts for ${gene}`);
                
                for (const art of pubmedArticles) {
                    const artId = `pmid:${art.pmid}`;
                    if (seenIds.has(artId)) continue;
                    seenIds.add(artId);

                    const combinedText = `${art.title || ''}. ${art.text || ''}`;
                    const paragraphs = combinedText.split(/\n\s*\n/); // Split by blank lines
                    
                    for (const p of paragraphs) {
                        if (!p || p.length < 10) continue;
                        
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
                                    id: art.pmid,
                                    article_title: art.title
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
            console.log(`[INFO] Found ${pmcids.length} PMC articles for ${gene}`);
            
            if (pmcids.length > 0) {
                const pmcArticles = await this.fetchPmcFullText(pmcids);
                console.log(`[INFO] Fetched ${pmcArticles.length} PMC articles for ${gene}`);
                
                for (const art of pmcArticles) {
                    const artId = `pmcid:${art.pmcid}`;
                    if (seenIds.has(artId)) continue;
                    seenIds.add(artId);

                    const paragraphs = art.paragraphs || [];
                    for (const p of paragraphs) {
                        if (!p || p.length < 10) continue;
                        
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
                                    id: art.pmcid,
                                    article_title: art.title
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
            const geneRegex = new RegExp('\\b' + this.escapeRegExp(gene.toLowerCase()) + '\\b');
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
        if (!roles || roles.length === 0) return "No specific data";
        
        const counts = {};
        roles.forEach(role => {
            counts[role] = (counts[role] || 0) + 1;
        });

        const promotes = counts['PROMOTES'] || 0;
        const inhibits = counts['INHIBITS'] || 0;
        const neutral = counts['NEUTRAL'] || 0;
        const variable = counts['VARIABLE'] || 0;

        if (promotes > 0 && inhibits > 0) return "Conflicting Data";
        if (promotes > 0) return "Promotes / Maintains";
        if (inhibits > 0) return "Inhibits / Restricts";
        if (variable > 0) return "Affects Morphology/Variability";
        if (neutral > 0) return "No clear role";

        return "Unclear";
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

// Enhanced CiliAI class that integrates with the existing CiliaHub interface
class CiliAI {
    constructor() {
        this.miner = new LiteratureMinerEngine();
        this.isProcessing = false;
        this.results = null;
        
        // Initialize UI elements
        this.initializeUI();
    }

    initializeUI() {
        // Create result containers if they don't exist
        if (!document.getElementById('resultsContainer')) {
            const resultsDiv = document.createElement('div');
            resultsDiv.id = 'resultsContainer';
            resultsDiv.style.marginTop = '20px';
            document.body.appendChild(resultsDiv);
        }
        
        if (!document.getElementById('progressContainer')) {
            const progressDiv = document.createElement('div');
            progressDiv.id = 'progressContainer';
            progressDiv.style.margin = '10px 0';
            document.body.appendChild(progressDiv);
        }
    }

    async analyzeGenes() {
        if (this.isProcessing) {
            this.showError('Analysis already in progress');
            return;
        }

        this.isProcessing = true;
        
        try {
            // Get genes from input
            const genes = this.getGenesFromInput();
            if (!genes || genes.length === 0) {
                this.showError('Please enter at least one gene symbol');
                return;
            }

            this.updateStatus(`Starting analysis for ${genes.length} genes...`);
            this.showProgress(0, 'Initializing...');

            const results = await this.miner.processGenes(genes, (current, total, gene) => {
                const percent = Math.round((current / total) * 100);
                this.showProgress(percent, `Processing ${gene} (${current}/${total})`);
            });

            this.results = results;
            this.displayResults(results);
            this.showProgress(100, 'Analysis complete!');
            
        } catch (error) {
            console.error('Analysis failed:', error);
            this.showError(`Analysis failed: ${error.message}`);
        } finally {
            this.isProcessing = false;
        }
    }

    getGenesFromInput() {
        // Try to get genes from various possible input elements
        const geneInput = document.getElementById('geneInput') || 
                         document.querySelector('input[placeholder*="gene"]') ||
                         document.querySelector('input[type="text"]');
        
        if (geneInput && geneInput.value) {
            return geneInput.value.split(/[\s,]+/).filter(g => g.trim());
        }
        
        // Fallback: return some test genes
        return ['IFT88', 'KIF3A', 'ARL13B', 'BBS1'];
    }

    updateStatus(message) {
        console.log(`Status: ${message}`);
        // Update status in UI
        const statusElement = document.getElementById('status') || this.createStatusElement();
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    showProgress(percent, message) {
        console.log(`Progress: ${percent}% - ${message}`);
        
        const progressContainer = document.getElementById('progressContainer');
        if (progressContainer) {
            progressContainer.innerHTML = `
                <div style="width: 100%; background-color: #f0f0f0; border-radius: 5px; margin: 10px 0;">
                    <div style="width: ${percent}%; height: 20px; background-color: #4CAF50; border-radius: 5px; transition: width 0.3s;"></div>
                </div>
                <div style="text-align: center; font-size: 14px;">${message}</div>
            `;
        }
    }

    displayResults(results) {
        const resultsContainer = document.getElementById('resultsContainer');
        if (!resultsContainer) return;

        let html = '<h3>Literature Mining Results</h3>';
        
        for (const [gene, data] of Object.entries(results.results)) {
            html += this.createGeneResultHTML(gene, data);
        }

        html += `
            <div style="margin-top: 20px; padding: 10px; background-color: #f9f9f9; border-radius: 5px;">
                <strong>Summary:</strong> Processed ${Object.keys(results.results).length} genes at ${results.metadata.timestamp}
            </div>
        `;

        resultsContainer.innerHTML = html;
    }

    createGeneResultHTML(gene, data) {
        let html = `
            <div style="border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin: 10px 0; background-color: white;">
                <h4 style="margin-top: 0; color: #2c3e50;">
                    ${gene} 
                    <span style="font-size: 14px; color: #7f8c8d;">(${data.found_articles} articles with evidence)</span>
                </h4>
        `;

        if (data.error) {
            html += `<div style="color: red;">Error: ${data.error}</div>`;
        }

        if (data.articles && data.articles.length > 0) {
            data.articles.forEach((article, index) => {
                html += this.createArticleHTML(article, index);
            });
        } else {
            html += `<div style="color: #7f8c8d; font-style: italic;">No relevant evidence found in literature.</div>`;
        }

        html += `</div>`;
        return html;
    }

    createArticleHTML(article, index) {
        let html = `
            <div style="border-left: 3px solid #3498db; padding-left: 10px; margin: 10px 0;">
                <div style="font-weight: bold;">
                    <a href="https://pubmed.ncbi.nlm.nih.gov/${article.id}/" target="_blank" style="text-decoration: none;">
                        ${article.title || 'Untitled'}
                    </a>
                    <span style="font-size: 12px; color: #7f8c8d; margin-left: 10px;">
                        (${article.source.toUpperCase()} - ${article.id})
                    </span>
                </div>
        `;

        if (article.evidence && article.evidence.length > 0) {
            article.evidence.forEach((evidence, evIndex) => {
                const roles = this.miner.interpretEvidence(evidence.gene, evidence.context);
                const lengthSummary = this.miner.generateFinalSummary(roles.length);
                const freqSummary = this.miner.generateFinalSummary(roles.frequency);
                
                html += `
                    <div style="margin: 5px 0; padding: 8px; background-color: #f8f9fa; border-radius: 3px;">
                        <div style="font-size: 14px; color: #2c3e50;">
                            <strong>Gene:</strong> ${evidence.gene} | 
                            <strong>Length Role:</strong> ${lengthSummary} | 
                            <strong>Frequency Role:</strong> ${freqSummary}
                        </div>
                        <div style="font-size: 13px; color: #34495e; margin-top: 5px;">
                            "${evidence.context}"
                        </div>
                        <div style="font-size: 12px; color: #7f8c8d; margin-top: 3px;">
                            Effects: ${evidence.effects.join(', ')}
                        </div>
                    </div>
                `;
            });
        }

        html += `</div>`;
        return html;
    }

    showError(message) {
        console.error('Error:', message);
        alert(`Error: ${message}`);
    }

    createStatusElement() {
        const statusElement = document.createElement('div');
        statusElement.id = 'status';
        statusElement.style.margin = '10px 0';
        statusElement.style.padding = '10px';
        statusElement.style.backgroundColor = '#e3f2fd';
        statusElement.style.borderRadius = '5px';
        document.body.appendChild(statusElement);
        return statusElement;
    }
}

// Initialize CiliAI when the page loads
document.addEventListener('DOMContentLoaded', function() {
    window.ciliai = new CiliAI();
    
    // Add analyze button if it doesn't exist
    if (!document.getElementById('analyzeButton')) {
        const analyzeButton = document.createElement('button');
        analyzeButton.id = 'analyzeButton';
        analyzeButton.textContent = 'Analyze Genes with Literature Miner';
        analyzeButton.style.backgroundColor = '#4CAF50';
        analyzeButton.style.color = 'white';
        analyzeButton.style.padding = '10px 20px';
        analyzeButton.style.border = 'none';
        analyzeButton.style.borderRadius = '5px';
        analyzeButton.style.cursor = 'pointer';
        analyzeButton.style.margin = '10px 0';
        analyzeButton.onclick = () => window.ciliai.analyzeGenes();
        
        // Try to find a good place to insert the button
        const geneInput = document.getElementById('geneInput') || 
                         document.querySelector('input[placeholder*="gene"]');
        if (geneInput && geneInput.parentNode) {
            geneInput.parentNode.appendChild(analyzeButton);
        } else {
            document.body.insertBefore(analyzeButton, document.body.firstChild);
        }
    }
    
    console.log('CiliAI Literature Miner initialized successfully!');
});

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LiteratureMinerEngine, CiliAI };
}
