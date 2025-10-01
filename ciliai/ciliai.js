// ciliai.js

// This function will be called by the router in globals.js
function displayCiliAIPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    document.querySelector('.cilia-panel').style.display = 'none';

    // Inject the updated HTML structure
    contentArea.innerHTML = `
        <div class="ciliai-container">
            <div class="ciliai-header">
                <h1><span class="ciliai-icon">🧬</span> CiliAI</h1>
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
                                <label for="hybrid" title="Best for most users. Combines our fast, expert-curated database with real-time AI literature mining for the most comprehensive results.">
                                    <span class="mode-icon">🔬</span>
                                    <div>
                                        <strong>Hybrid</strong><br>
                                        <small>Expert DB + Literature</small>
                                    </div>
                                </label>
                            </div>
                            <div class="mode-option">
                                <input type="radio" id="expert" name="mode" value="expert">
                                <label for="expert" title="Fastest option. Queries only our internal, manually curated database of known gene-cilia interactions.">
                                    <span class="mode-icon">🏛️</span>
                                    <div>
                                        <strong>Expert Only</strong><br>
                                        <small>Curated database</small>
                                    </div>
                                </label>
                            </div>
                            <div class="mode-option">
                                <input type="radio" id="nlp" name="mode" value="nlp">
                                <label for="nlp" title="Most current data. Performs a live AI-powered search across PubMed abstracts. May be slower but includes the very latest findings.">
                                    <span class="mode-icon">📚</span>
                                    <div>
                                        <strong>Literature Only</strong><br>
                                        <small>Live AI text mining</small>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <button class="analyze-btn" id="analyzeBtn">
                        🔍 Analyze Genes
                    </button>
                </div>

                <div id="resultsSection" class="results-section" style="display: none;">
                    <h2>Analysis Results</h2>
                    <div id="resultsContainer"></div>
                </div>
            </div>
        </div>
        <style>
            /* Design styles to match CiliaHub theme */
            .ciliai-container {
                font-family: 'Arial', sans-serif;
                max-width: 950px;
                margin: 2rem auto;
                padding: 2rem;
                background-color: #f9f9f9;
                border-radius: 12px;
            }
            .ciliai-header { text-align: center; margin-bottom: 2rem; }
            .ciliai-header h1 {
                font-size: 2.8rem;
                color: #2c5aa0;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
            }
            .ciliai-header p { font-size: 1.2rem; color: #555; }
            
            .ai-query-section {
                background-color: #e8f4fd;
                border: 1px solid #bbdefb;
                padding: 1.5rem 2rem;
                border-radius: 8px;
                margin-bottom: 2rem;
            }
            .ai-query-section h3 { margin-top: 0; color: #2c5aa0; }
            .ai-input-group { display: flex; gap: 10px; }
            .ai-query-input {
                flex-grow: 1;
                padding: 0.8rem;
                border: 1px solid #ccc;
                border-radius: 4px;
                font-size: 1rem;
            }
            .ai-query-btn {
                padding: 0.8rem 1.2rem;
                font-size: 1rem;
                background-color: #2c5aa0;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            .ai-query-btn:hover { background-color: #1e4273; }

            .input-section {
                background-color: #fff;
                padding: 2rem;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            }
            .input-section h3 { margin-top: 0; color: #333; }
            .input-group { margin-bottom: 1.5rem; }
            .input-group label {
                display: block;
                font-weight: bold;
                margin-bottom: 0.5rem;
                color: #333;
            }
            .gene-input-textarea {
                width: 100%;
                padding: 0.8rem;
                border: 1px solid #ccc;
                border-radius: 4px;
                font-size: 1rem;
                min-height: 80px;
                resize: vertical;
            }
            .mode-selector {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 1rem;
            }
            .mode-option input[type="radio"] { display: none; }
            .mode-option label {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 1rem;
                border: 2px solid #ddd;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .mode-option input[type="radio"]:checked + label {
                border-color: #2c5aa0;
                background-color: #e8f4fd;
                box-shadow: 0 0 5px rgba(44, 90, 160, 0.3);
            }
            .mode-icon { font-size: 1.8rem; }
            .analyze-btn {
                width: 100%;
                padding: 1rem;
                font-size: 1.1rem;
                font-weight: bold;
                background-color: #28a745;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            .analyze-btn[disabled] {
                background-color: #a5d6a7;
                cursor: not-allowed;
            }
            .analyze-btn:hover:not([disabled]) { background-color: #218838; }
            .results-section {
                margin-top: 2rem;
                padding: 2rem;
                background-color: #fff;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            }
            .result-card {
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 1.5rem;
                margin-bottom: 1.5rem;
                position: relative;
                overflow: hidden;
            }
            .result-card h3 { margin-top: 0; color: #2c5aa0; font-size: 1.4rem; }
            .result-card .status-found { color: #28a745; }
            .result-card .status-not-found { color: #dc3545; }
            .result-card .status-searching { color: #007bff; }
            .prediction-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1rem;
                margin-top: 1rem;
            }
            .prediction-box {
                padding: 1rem;
                border-radius: 6px;
                text-align: center;
                background-color: #f8f9fa; 
                border: 1px solid #dee2e6;
            }
            .prediction-box.promotes { background-color: #d4edda; border: 1px solid #c3e6cb; }
            .prediction-box.inhibits { background-color: #f8d7da; border: 1px solid #f5c6cb; }
            .prediction-box.no-effect { background-color: #e2e3e5; border: 1px solid #d6d8db; }
            .prediction-box.conflicting { background-color: #fff3cd; border: 1px solid #ffeeba; }
            .prediction-box h4 { margin: 0 0 0.5rem 0; color: #495057; }
            .prediction-box p { margin: 0; font-size: 1.2rem; font-weight: bold; }

            .evidence-section {
                margin-top: 1.5rem;
                border-top: 1px solid #eee;
                padding-top: 1rem;
            }
            .evidence-toggle {
                background: none;
                border: 1px solid #2c5aa0;
                color: #2c5aa0;
                padding: 0.4rem 0.8rem;
                border-radius: 20px;
                cursor: pointer;
                font-weight: bold;
                transition: all 0.2s;
                margin-bottom: 0.5rem;
            }
            .evidence-toggle:hover { background-color: #e8f4fd; }
            .evidence-content {
                display: none;
                margin-top: 1rem;
                padding-left: 1rem;
                border-left: 3px solid #bbdefb;
            }
            .evidence-snippet {
                background-color: #f1f3f5;
                padding: 0.8rem;
                border-radius: 4px;
                margin-bottom: 0.8rem;
                font-size: 0.9rem;
                color: #333;
            }
            .evidence-snippet strong { color: #0056b3; }
            .evidence-snippet mark { background-color: #ffeeba; padding: 0.1em 0.2em; border-radius: 3px; }
        </style>
    `;

    // Attach event listeners after HTML is injected
    setupCiliAIEventListeners();
}

// --- Helper Functions ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Expert-curated internal database (mock)
const CILI_AI_DB = {
    "HDAC6": {
        "summary": { "lof_length": "Promotes / Maintains", "percentage_ciliated": "No effect", "source": "Expert DB" },
        "evidence": [
            { "id": "21873644", "source": "pubmed", "context": "...loss of HDAC6 results in hyperacetylation of tubulin and leads to the formation of longer, more stable primary cilia in renal epithelial cells." }
        ]
    },
    "IFT88": {
        "summary": { "lof_length": "Inhibits / Restricts", "percentage_ciliated": "Reduced cilia numbers", "source": "Expert DB" },
        "evidence": [
            { "id": "10882118", "source": "pubmed", "context": "Mutations in IFT88 (polaris) disrupt intraflagellar transport, leading to a failure in cilia assembly and resulting in severely shortened or absent cilia." }
        ]
    },
    "ARL13B": {
        "summary": { "lof_length": "Inhibits / Restricts", "percentage_ciliated": "Reduced cilia numbers", "source": "Expert DB" },
        "evidence": [
            { "id": "21940428", "source": "pubmed", "context": "The small GTPase ARL13B is critical for ciliary structure; its absence leads to stunted cilia with abnormal morphology and axonemal defects." }
        ]
    }
};

// --- Live Literature Mining Engine (Client-Side) ---

async function analyzeGeneViaAPI(gene, resultCard) {
    const ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
    const EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
    
    // The new, comprehensive keyword lists
    const API_QUERY_KEYWORDS = [
        "cilia", "ciliary", "cilia length", "ciliogenesis", "ciliation", "loss of cilia",
        "fewer cilia", "fluid flow", "mucociliary", "multiciliated", "intraflagellar transport", "ciliopathy"
    ];
    const LOCAL_ANALYSIS_KEYWORDS = new Set([
        'cilia', 'ciliary', 'cilium', 'axoneme', 'basal body', 'transition zone', 'centriole', 'ciliogenesis',
        'ciliation', 'intraflagellar transport', 'ift', 'cilia assembly', 'cilia disassembly', 'ciliary motility',
        'shorter', 'shortened', 'longer', 'elongated', 'fewer', 'loss of', 'absent cilia', 'reduction', 'reduced',
        'decrease', 'increased', 'increase', 'abnormal length', 'flow', 'fluid flow', 'cilia-generated',
        'mechanosensor', 'ciliary signaling', 'bead displacement', 'mucociliary', 'multiciliated', 'kidney tubule',
        'photoreceptor', 'acls', 'acrocallosal syndrome', 'alms', 'alström syndrome',
        'autosomal dominant polycystic kidney disease', 'adpkd', 'autosomal recessive polycystic kidney disease', 'arpkd',
        'bardet–biedl syndrome', 'bbs', 'joubert syndrome', 'jbts', 'kallmann syndrome',
        'leber congenital amaurosis', 'lca', 'meckel–gruber syndrome', 'mks',
        'nephronophthisis', 'nphp', 'orofaciodigital syndrome', 'ofd', 'polycystic kidney disease', 'pkd',
        'senior-løken syndrome', 'slsn', 'short-rib thoracic dysplasia', 'srtd', 'ciliopathy'
    ]);

    const geneRegex = new RegExp(`\\b${gene}\\b`, 'i');
    const sentSplitRegex = /(?<=[.!?])\s+/;
    let foundEvidence = [];

    try {
        // 1. Search PubMed
        const kwClause = API_QUERY_KEYWORDS.map(k => `"${k}"[Title/Abstract]`).join(" OR ");
        const query = `("${gene}"[Title/Abstract]) AND (${kwClause})`;
        const searchParams = new URLSearchParams({ db: 'pubmed', term: query, retmode: 'json', retmax: '25' });
        
        const searchResp = await fetch(`${ESEARCH_URL}?${searchParams}`);
        if (!searchResp.ok) throw new Error(`NCBI ESearch failed: ${searchResp.statusText}`);
        const searchData = await searchResp.json();
        const pmids = searchData.esearchresult?.idlist || [];

        if (pmids.length === 0) {
            return []; // No articles found
        }
        
        // 2. Fetch Abstracts
        await sleep(350); // Be polite to NCBI API
        const fetchParams = new URLSearchParams({ db: 'pubmed', id: pmids.join(','), retmode: 'xml', rettype: 'abstract' });
        const fetchResp = await fetch(`${EFETCH_URL}?${fetchParams}`);
        if (!fetchResp.ok) throw new Error(`NCBI EFetch failed: ${fetchResp.statusText}`);
        const xmlText = await fetchResp.text();
        
        // 3. Parse XML and Analyze Text
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");
        const articles = xmlDoc.getElementsByTagName('PubmedArticle');

        for (const article of articles) {
            const pmid = article.querySelector('MedlineCitation > PMID')?.textContent;
            const title = article.querySelector('ArticleTitle')?.textContent || '';
            const abstractNode = article.querySelector('Abstract');
            let abstractText = '';
            if (abstractNode) {
                 abstractText = Array.from(abstractNode.getElementsByTagName('AbstractText')).map(el => el.textContent).join(' ');
            }
            
            const fullText = `${title}. ${abstractText}`;
            if (!geneRegex.test(fullText)) continue; // Skip if gene not mentioned

            const sentences = fullText.split(sentSplitRegex);
            for (const sent of sentences) {
                const sentLower = sent.toLowerCase();
                if (geneRegex.test(sentLower) && [...LOCAL_ANALYSIS_KEYWORDS].some(kw => sentLower.includes(kw))) {
                     foundEvidence.push({
                        id: pmid,
                        source: 'pubmed',
                        context: sent.trim().replace(geneRegex, `<mark>${gene}</mark>`)
                    });
                }
            }
        }
    } catch (error) {
        console.error(`Failed to fetch literature for ${gene}:`, error);
        // Optionally update the card to show an error state
        const errorEl = resultCard.querySelector('.status-searching');
        if (errorEl) {
            errorEl.textContent = 'Literature Search Failed';
            errorEl.className = 'status-not-found';
        }
    }
    
    return foundEvidence;
}


// --- UI and Event Handling ---

function setupCiliAIEventListeners() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const aiQueryBtn = document.getElementById('aiQueryBtn');

    analyzeBtn.addEventListener('click', analyzeGenesFromInput);
    aiQueryBtn.addEventListener('click', handleAIQuery);

    document.getElementById('geneInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            analyzeGenesFromInput();
        }
    });
    
    document.getElementById('aiQueryInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleAIQuery();
        }
    });

    document.getElementById('resultsContainer').addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('evidence-toggle')) {
            const content = e.target.nextElementSibling;
            if (content) {
                const isVisible = content.style.display === 'block';
                content.style.display = isVisible ? 'none' : 'block';
                e.target.textContent = isVisible ? 'Show Evidence ▾' : 'Hide Evidence ▴';
            }
        }
    });
}

function handleAIQuery() {
    const query = document.getElementById('aiQueryInput').value;
    const geneRegex = /\b([A-Z0-9]{3,})\b/g;
    const matches = query.match(geneRegex);
    
    if (matches && matches.length > 0) {
        const detectedGene = matches[0];
        document.getElementById('geneInput').value = detectedGene;
        runAnalysis([detectedGene]);
    } else {
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.innerHTML = `<p class="status-not-found">Could not identify a valid gene symbol in your question. Please try again, e.g., "What does IFT88 do?".</p>`;
        document.getElementById('resultsSection').style.display = 'block';
    }
}

function analyzeGenesFromInput() {
    const geneInput = document.getElementById('geneInput');
    const genes = geneInput.value.split(/[\s,]+/).filter(g => g.trim() !== '');
    
    if (genes.length === 0) {
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.innerHTML = '<p class="status-not-found">Please enter at least one gene symbol.</p>';
        document.getElementById('resultsSection').style.display = 'block';
        return;
    }
    
    const sanitizedGenes = [...new Set(genes.map(g => g.trim().toUpperCase()))]; // Remove duplicates
    runAnalysis(sanitizedGenes);
}

async function runAnalysis(geneList) {
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsSection = document.getElementById('resultsSection');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const mode = document.querySelector('input[name="mode"]:checked').value;

    resultsContainer.innerHTML = ''; // Clear previous results
    resultsSection.style.display = 'block';
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';

    // Create placeholder cards for each gene
    geneList.forEach(gene => {
        resultsContainer.insertAdjacentHTML('beforeend', createPlaceholderCard(gene, mode));
    });

    for (const gene of geneList) {
        const resultCard = document.getElementById(`card-${gene}`);
        let dbData = null;
        let apiEvidence = [];

        if (mode === 'expert' || mode === 'hybrid') {
            dbData = CILI_AI_DB[gene] || null;
        }
        if (mode === 'nlp' || mode === 'hybrid') {
            apiEvidence = await analyzeGeneViaAPI(gene, resultCard);
        }
        
        // Render the final card with combined data
        const finalHtml = createResultCard(gene, dbData, apiEvidence, mode);
        resultCard.outerHTML = finalHtml;
    }

    analyzeBtn.disabled = false;
    analyzeBtn.textContent = '🔍 Analyze Genes';
}

function createPlaceholderCard(gene, mode) {
    let statusText = 'Fetching from Expert DB...';
    if (mode === 'nlp') statusText = 'Searching live literature...';
    if (mode === 'hybrid') statusText = 'Checking Expert DB & Searching Literature...';
    return `<div class="result-card" id="card-${gene}"><h3>${gene} - <span class="status-searching">${statusText}</span></h3></div>`;
}

function createResultCard(gene, dbData, apiEvidence, mode) {
    const combinedEvidence = [...(dbData?.evidence || []), ...apiEvidence];
    const summaryData = dbData?.summary;
    const hasDbData = !!summaryData;
    const hasApiData = apiEvidence.length > 0;

    let titleStatus = `<span class="status-not-found">No Data Found</span>`;
    let sourceText = 'N/A';
    if (hasDbData && hasApiData) {
        titleStatus = `<span class="status-found">Prediction Found</span>`;
        sourceText = 'Expert DB + Literature Mining';
    } else if (hasDbData) {
        titleStatus = `<span class="status-found">Prediction Found</span>`;
        sourceText = 'Expert DB';
    } else if (hasApiData) {
        titleStatus = `<span class="status-found">Evidence Found</span>`;
        sourceText = 'Literature Mining';
    }

    let evidenceHtml = '';
    if (combinedEvidence.length > 0) {
        const uniqueSnippets = [...new Map(combinedEvidence.map(item => [item.context, item])).values()];
        const snippets = uniqueSnippets.map(ev => 
            `<div class="evidence-snippet">
                ${ev.context}
                <br>
                <strong>Source:</strong> ${ev.source.toUpperCase()} (${ev.id})
             </div>`
        ).join('');
        evidenceHtml = `
            <div class="evidence-section">
                <button class="evidence-toggle">Show Evidence (${uniqueSnippets.length}) ▾</button>
                <div class="evidence-content">${snippets}</div>
            </div>`;
    }

    let predictionHtml = `<p>No summary prediction available. Review literature evidence for insights.</p>`;
    if (summaryData) {
        predictionHtml = `
            <p><strong>Data Source:</strong> ${sourceText}</p>
            <div class="prediction-grid">
                ${createPredictionBox('Cilia Length (LoF)', summaryData.lof_length)}
                ${createPredictionBox('Cilia Formation', summaryData.percentage_ciliated)}
            </div>`;
    }

    let cardContent = `
        <h3>${gene} - ${titleStatus}</h3>
        ${predictionHtml}
        ${evidenceHtml}`;
        
    if (!hasDbData && !hasApiData) {
        cardContent = `<h3>${gene} - <span class="status-not-found">No Data Found</span></h3><p>No information was found in the expert database or through live literature mining for this gene.</p>`;
    }

    return `<div class="result-card" id="card-${gene}">${cardContent}</div>`;
}

function createPredictionBox(title, prediction) {
    let className = 'no-effect';
    let text = prediction;
    
    if (!prediction) {
        return `
        <div class="prediction-box">
            <h4>${title}</h4>
            <p>Not Reported</p>
        </div>
    `;
    }

    const predictionCleaned = prediction.toLowerCase();
    if (predictionCleaned.includes('promotes')) className = 'promotes';
    else if (predictionCleaned.includes('inhibits') || predictionCleaned.includes('reduced')) className = 'inhibits';
    else if (predictionCleaned.includes('no effect')) className = 'no-effect';
    else if (predictionCleaned.includes('conflicting')) className = 'conflicting';

    return `
        <div class="prediction-box ${className}">
            <h4>${title}</h4>
            <p>${text}</p>
        </div>
    `;
}
