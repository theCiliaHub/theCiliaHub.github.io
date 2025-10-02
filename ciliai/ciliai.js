// ciliAI.js - Enhanced with heatmap visualization and corrected screen names
// ciliAI.js - Enhanced with advanced AI queries and data integration

// --- Global Data Store ---
let CILIAHUB_DATA = null;
let SCREEN_DATA = null;

// --- Data Loading Functions ---
async function loadCiliaHubData() {
    if (CILIAHUB_DATA) return CILIAHUB_DATA;
    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/ciliahub_data.json');
        if (!response.ok) throw new Error('Failed to load CiliaHub main data.');
        CILIAHUB_DATA = await response.json();
        console.log("CiliaHub main data loaded successfully.");
        return CILIAHUB_DATA;
    } catch (error) {
        console.error("Error loading CiliaHub data:", error);
        return { genes: [] }; // Return empty structure on failure
    }
}

async function fetchScreenData() {
    if (SCREEN_DATA) return SCREEN_DATA;
    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cilia_screens_data.json');
        if (!response.ok) throw new Error(`Failed to fetch screen data: ${response.statusText}`);
        SCREEN_DATA = await response.json();
        console.log('Screen data loaded successfully:', Object.keys(SCREEN_DATA).length, 'genes');
        return SCREEN_DATA;
    } catch (error) {
        console.error('Error fetching screen data:', error);
        return {};
    }
}

// Make functions globally available for router in globals.js
window.displayCiliAIPage = function displayCiliAIPage() {
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

    // Pre-load data as soon as the page is displayed
    loadCiliaHubData();
    fetchScreenData();

    // Inject the updated HTML structure
    contentArea.innerHTML = `
        <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
        <div class="ciliai-container">
            <div class="ciliai-header">
                <h1>CiliAI</h1>
                <p>Your AI-powered partner for discovering gene-cilia relationships.</p>
            </div>
            
            <div class="ciliai-main-content">
                <div class="ai-query-section">
                    <h3>Ask a Question</h3>
                    <div class="ai-input-group">
                        <input type="text" id="aiQueryInput" class="ai-query-input" placeholder="e.g., Show me genes with WD40 repeats...">
                        <button class="ai-query-btn" id="aiQueryBtn">Ask CiliAI</button>
                    </div>
                    <div class="example-queries">
                        <span>Try: </span>
                        <span class="example-query" data-query="List genes with WD40 repeats">WD40 repeat genes</span>
                        <span class="example-query" data-query="Show cilia and mitochondria localizing genes">Cilia & Mitochondria genes</span>
                        <span class="example-query" data-query="Genes with LRR domains">LRR domain genes</span>
                        <span class="example-query" data-query="List all cilia genes">List all genes</span>
                    </div>
                </div>

                <div class="input-section">
                    <h3>Analyze Specific Gene Phenotypes</h3>
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
                                     <div>
                                         <strong>Hybrid</strong><br>
                                         <small>Expert DB + Screen Data + Literature</small>
                                     </div>
                                 </label>
                             </div>
                             <div class="mode-option">
                                 <input type="radio" id="expert" name="mode" value="expert">
                                 <label for="expert" title="Fastest option. Queries only our internal, manually curated database and screen data of known gene-cilia interactions.">
                                     <span class="mode-icon">🏛️</span>
                                     <div>
                                         <strong>Expert Only</strong><br>
                                         <small>Curated database + Screen Data</small>
                                     </div>
                                 </label>
                             </div>
                             <div class="mode-option">
                                 <input type="radio" id="nlp" name="mode" value="nlp">
                                 <label for="nlp" title="Most current data. Performs a live AI-powered search across PubMed full-text articles. May be slower but includes the very latest findings.">
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
                    <h2 id="resultsTitle">Analysis Results</h2>
                    <button class="visualize-btn" id="visualizeBtn" style="display: none;">📊 Visualize Screen Data</button>
                    <div id="plot-display-area" style="margin-top: 1rem;"></div>
                    <div id="resultsContainer"></div>
                </div>
            </div>
        </div>
        <style>
            /* Design styles to match CiliaHub theme */
            .ciliai-container { font-family: 'Arial', sans-serif; max-width: 950px; margin: 2rem auto; padding: 2rem; background-color: #f9f9f9; border-radius: 12px; }
            .ciliai-header { text-align: center; margin-bottom: 2rem; }
            .ciliai-header h1 { font-size: 2.8rem; color: #2c5aa0; margin: 0; }
            .ciliai-header p { font-size: 1.2rem; color: #555; margin-top: 0.5rem; }
            
            .ai-query-section { background-color: #e8f4fd; border: 1px solid #bbdefb; padding: 1.5rem 2rem; border-radius: 8px; margin-bottom: 2rem; }
            .ai-query-section h3 { margin-top: 0; color: #2c5aa0; }
            .ai-input-group { display: flex; gap: 10px; }
            .ai-query-input { flex-grow: 1; padding: 0.8rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
            .ai-query-btn { padding: 0.8rem 1.2rem; font-size: 1rem; background-color: #2c5aa0; color: white; border: none; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; }
            .ai-query-btn:hover { background-color: #1e4273; }
            
            .example-queries { margin-top: 1rem; font-size: 0.9rem; color: #555; }
            .example-query { background-color: #ffffff; border: 1px solid #2c5aa0; color: #2c5aa0; padding: 0.2rem 0.6rem; border-radius: 12px; cursor: pointer; transition: all 0.2s; margin-left: 5px; }
            .example-query:hover { background-color: #2c5aa0; color: white; }

            .input-section { background-color: #fff; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
            .input-section h3 { margin-top: 0; color: #333; }
            .input-group { margin-bottom: 1.5rem; }
            .input-group label { display: block; font-weight: bold; margin-bottom: 0.5rem; color: #333; }
            .gene-input-textarea { width: 100%; padding: 0.8rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; min-height: 80px; resize: vertical; }
            .mode-selector { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
            .mode-option input[type="radio"] { display: none; }
            .mode-option label { display: flex; align-items: center; gap: 10px; padding: 1rem; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
            .mode-option input[type="radio"]:checked + label { border-color: #2c5aa0; background-color: #e8f4fd; box-shadow: 0 0 5px rgba(44, 90, 160, 0.3); }
            .mode-icon { font-size: 1.8rem; }
            .analyze-btn { width: 100%; padding: 1rem; font-size: 1.1rem; font-weight: bold; background-color: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer; transition: background-color 0.2s; }
            .analyze-btn[disabled] { background-color: #a5d6a7; cursor: not-allowed; }
            .analyze-btn:hover:not([disabled]) { background-color: #218838; }
            
            .visualize-btn { width: 100%; padding: 0.8rem; font-size: 1rem; background-color: #007bff; color: white; border: none; border-radius: 8px; cursor: pointer; transition: background-color 0.2s; margin-bottom: 1rem; }
            .visualize-btn:hover:not([disabled]) { background-color: #0056b3; }
            .visualize-btn[disabled] { background-color: #b8daff; cursor: not-allowed; }

            .results-section { margin-top: 2rem; padding: 2rem; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
            .result-card, .ai-result-card { border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; position: relative; overflow: hidden; }
            .result-card h3, .ai-result-card h3 { margin-top: 0; color: #2c5aa0; font-size: 1.4rem; }
            .result-card .status-found { color: #28a745; }
            .result-card .status-not-found { color: #dc3545; }
            .result-card .status-searching { color: #007bff; }
            
            .ai-result-table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.9rem; }
            .ai-result-table th, .ai-result-table td { border: 1px solid #ddd; padding: 0.75rem; text-align: left; }
            .ai-result-table th { background-color: #e8f4fd; font-weight: bold; color: #2c5aa0; }
            .ai-result-table tr:nth-child(even) { background-color: #f8f9fa; }
            .ai-result-table td:first-child { font-weight: bold; }
        </style>
    `;

    setupCiliAIEventListeners();
};

// --- AI Query Engine ---
async function handleAIQuery() {
    const aiQueryInput = document.getElementById('aiQueryInput');
    const query = aiQueryInput.value.trim().toLowerCase();
    if (!query) return;

    const data = await loadCiliaHubData();
    if (!data || !data.genes) {
        displayAiResults("Error", "<p>Could not load the CiliaHub knowledge base. Please try again later.</p>");
        return;
    }

    // --- Intent Routing ---
    // 1. Domain Query
    const domainMatch = query.match(/\b(WD40|ankyrin|LRR|coiled-coil)\s*(repeat|domain)?s?\b/i);
    if (domainMatch) {
        handleDomainQuery(domainMatch[1], data.genes);
        return;
    }
    
    // 2. Mitochondria/Localization Query
    if (query.includes("mitochondria") || query.includes("mitochondrion")) {
        handleLocalizationQuery(query, data.genes);
        return;
    }

    // 3. List all genes
    if (query.match(/\b(list|show|tell me about)\s*(all|the)\s*(genes|cilia genes)\b/i)) {
        handleListAllQuery(data.genes);
        return;
    }

    // 4. Fallback to Gene Symbol Search
    const geneRegex = /\b([A-Z0-9]{3,})\b/g;
    const matches = aiQueryInput.value.trim().match(geneRegex);
    if (matches && matches.length > 0) {
        const detectedGene = matches[0].toUpperCase();
        document.getElementById('geneInput').value = detectedGene;
        runAnalysis([detectedGene]);
    } else {
        displayAiResults("Query Not Understood", `<p>Sorry, I could not identify a valid gene or known query in your question. Please try one of the examples or enter a specific gene symbol.</p>`);
    }
}

function handleDomainQuery(domain, allGenes) {
    const results = allGenes.filter(gene => 
        gene.Protein_families && gene.Protein_families.toLowerCase().includes(domain.toLowerCase())
    );

    let contentHtml;
    if (results.length > 0) {
        const tableRows = results.map(gene => `
            <tr>
                <td>${gene.Gene_name || 'N/A'}</td>
                <td>${gene.Full_name || 'N/A'}</td>
                <td>${gene.Protein_families || 'N/A'}</td>
            </tr>
        `).join('');

        contentHtml = `
            <p>Found ${results.length} gene(s) containing a <strong>${domain.toUpperCase()}</strong> domain.</p>
            <table class="ai-result-table">
                <thead><tr><th>Gene</th><th>Full Name</th><th>Protein Families</th></tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
        `;
    } else {
        contentHtml = `<p>No genes were found in the database with a <strong>${domain.toUpperCase()}</strong> domain.</p>`;
    }
    displayAiResults(`Genes with ${domain.toUpperCase()} Domains`, contentHtml);
}

function handleLocalizationQuery(query, allGenes) {
    let results = [];
    let title = "Mitochondria-Related Genes";
    const wantsBoth = query.includes("cilia") && (query.includes("and") || query.includes("localizing"));

    if (wantsBoth) {
        title = "Cilia & Mitochondria Co-localizing Genes";
        results = allGenes.filter(gene => {
            const loc = gene.Subcellular_location_Sensor || '';
            return loc.includes("Mitochondrion") && (loc.includes("Cilium") || loc.includes("Centrosome"));
        });
    } else {
        results = allGenes.filter(gene => {
            const loc = gene.Subcellular_location_Sensor || '';
            return loc.includes("Mitochondrion");
        });
    }

    let contentHtml;
    if (results.length > 0) {
        const tableRows = results.map(gene => `
            <tr>
                <td>${gene.Gene_name || 'N/A'}</td>
                <td>${gene.Full_name || 'N/A'}</td>
                <td>${gene.Subcellular_location_Sensor || 'N/A'}</td>
            </tr>
        `).join('');

        contentHtml = `
            <p>Found ${results.length} gene(s) matching your localization query.</p>
            <table class="ai-result-table">
                <thead><tr><th>Gene</th><th>Full Name</th><th>Subcellular Localization</th></tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
        `;
    } else {
        contentHtml = `<p>No genes matching your query were found in the database.</p>`;
    }
    displayAiResults(title, contentHtml);
}

function handleListAllQuery(allGenes) {
    const tableRows = allGenes.map(gene => `
        <tr>
            <td>${gene.Gene_name || 'N/A'}</td>
            <td>${gene.Full_name || 'N/A'}</td>
            <td>${gene.Protein_families || 'N/A'}</td>
        </tr>
    `).join('');

    const contentHtml = `
        <p>Displaying all ${allGenes.length} genes from the CiliaHub knowledge base.</p>
        <table class="ai-result-table">
            <thead><tr><th>Gene</th><th>Full Name</th><th>Protein Families</th></tr></thead>
            <tbody>${tableRows}</tbody>
        </table>
    `;
    displayAiResults("All Cilia-Related Genes", contentHtml);
}


function displayAiResults(title, contentHtml) {
    const resultsSection = document.getElementById('resultsSection');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsTitle = document.getElementById('resultsTitle');
    const visualizeBtn = document.getElementById('visualizeBtn');

    resultsTitle.textContent = "AI Query Result";
    visualizeBtn.style.display = 'none'; // Hide visualize button for AI queries
    document.getElementById('plot-display-area').innerHTML = ''; // Clear plot area

    resultsContainer.innerHTML = `
        <div class="ai-result-card">
            <h3>${title}</h3>
            ${contentHtml}
        </div>
    `;
    resultsSection.style.display = 'block';
}


// --- Event Listener Setup ---
function setupCiliAIEventListeners() {
    document.getElementById('analyzeBtn')?.addEventListener('click', analyzeGenesFromInput);
    document.getElementById('aiQueryBtn')?.addEventListener('click', handleAIQuery);
    document.getElementById('visualizeBtn')?.addEventListener('click', () => {
        const genes = document.getElementById('geneInput').value.split(/[\s,]+/).map(g => g.trim().toUpperCase()).filter(Boolean);
        if (genes.length > 0) {
            renderScreenSummaryHeatmap(genes, SCREEN_DATA);
        }
    });

    document.getElementById('aiQueryInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAIQuery();
    });
    
    document.getElementById('geneInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            analyzeGenesFromInput();
        }
    });
    
    document.querySelector('.ciliai-main-content')?.addEventListener('click', function(e) {
        if (e.target.classList.contains('example-query')) {
            const query = e.target.dataset.query;
            document.getElementById('aiQueryInput').value = query;
            handleAIQuery();
        }
        if (e.target.classList.contains('evidence-toggle')) {
            const content = e.target.nextElementSibling;
            if (content) {
                const isVisible = content.style.display === 'block';
                content.style.display = isVisible ? 'none' : 'block';
                const count = e.target.dataset.count || 0;
                e.target.textContent = isVisible ? `Show Other Evidence (${count}) ▾` : `Hide Other Evidence (${count}) ▴`;
            }
        }
    });
}

// --- Gene-Specific Analysis (largely unchanged) ---
// (Includes runAnalysis, createResultCard, analyzeGeneViaAPI, renderScreenDataTable, renderScreenSummaryHeatmap etc.)
// ... The rest of your comprehensive gene analysis and plotting code follows here ...
// NOTE: I've omitted the large, unchanged functions for brevity, but they should be included in the final file.
// All functions from the previous version like runAnalysis, createResultCard, analyzeGeneViaAPI, etc. are assumed to be here.

function analyzeGenesFromInput() {
    const geneInput = document.getElementById('geneInput');
    if (!geneInput) return;
    const genes = geneInput.value.split(/[\s,]+/).map(g => g.trim().toUpperCase()).filter(g => g !== '');
    
    if (genes.length === 0) {
        const resultsContainer = document.getElementById('resultsContainer');
        if (resultsContainer) {
            resultsContainer.innerHTML = '<p class="status-not-found">Please enter at least one gene symbol.</p>';
            const resultsSection = document.getElementById('resultsSection');
            if (resultsSection) resultsSection.style.display = 'block';
        }
        return;
    }
    
    const sanitizedGenes = [...new Set(genes)];
    runAnalysis(sanitizedGenes);
}

async function runAnalysis(geneList) {
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsSection = document.getElementById('resultsSection');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const visualizeBtn = document.getElementById('visualizeBtn');
    const resultsTitle = document.getElementById('resultsTitle');

    if (!resultsContainer || !resultsSection || !analyzeBtn || !visualizeBtn) return;
    
    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'hybrid';

    resultsTitle.textContent = "Analysis Results";
    resultsContainer.innerHTML = '';
    document.getElementById('plot-display-area').innerHTML = '';
    resultsSection.style.display = 'block';
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    visualizeBtn.style.display = 'none';

    for (const gene of geneList) {
        resultsContainer.insertAdjacentHTML('beforeend', createPlaceholderCard(gene, mode));
        const resultCard = document.getElementById(`card-${gene}`);
        let dbData = CILI_AI_DB[gene] || null;
        let apiEvidence = [];
        let screenEvidence = [];

        if (mode === 'expert' || mode === 'hybrid') {
            const screenInfo = SCREEN_DATA ? SCREEN_DATA[gene] : null;
            if (screenInfo) {
                if (!dbData && (screenInfo.cilia_length || screenInfo.percent_ciliated)) {
                    dbData = {
                        summary: {
                            lof_length: screenInfo.cilia_length || 'Unknown',
                            percentage_ciliated: screenInfo.percent_ciliated || 'Unknown',
                            source: 'Screen Data'
                        }, evidence: []
                    };
                }
                screenEvidence.push({
                    id: `screen-${gene}`, source: 'screen_data', context: renderScreenDataTable(gene, screenInfo)
                });
            }
        }

        if (mode === 'nlp' || mode === 'hybrid') {
            apiEvidence = await analyzeGeneViaAPI(gene, resultCard);
        }
        
        const allEvidence = [...(dbData?.evidence || []), ...apiEvidence, ...screenEvidence];
        
        const finalHtml = createResultCard(gene, dbData, allEvidence);
        if (resultCard) {
            resultCard.outerHTML = finalHtml;
        }
    }

    analyzeBtn.disabled = false;
    analyzeBtn.textContent = '🔍 Analyze Genes';
    visualizeBtn.style.display = 'block';
}

function createPlaceholderCard(gene, mode) {
    let statusText = 'Fetching from Expert DB and Screen Data...';
    if (mode === 'nlp') statusText = 'Searching live literature...';
    if (mode === 'hybrid') statusText = 'Checking Expert DB, Screen Data & Searching Literature...';
    return `<div class="result-card" id="card-${gene}"><h3>${gene} - <span class="status-searching">${statusText}</span></h3></div>`;
}

function createResultCard(gene, dbData, allEvidence) {
    const statusText = allEvidence.length > 0 ? 'Evidence Found' : 'No Data Found';
    const statusClass = allEvidence.length > 0 ? 'status-found' : 'status-not-found';
    
    let summaryHtml = '';
    if (dbData && dbData.summary) {
        const lofClass = (dbData.summary.lof_length || '').toLowerCase().includes('inhibit') ? 'inhibits' : 'promotes';
        const percClass = (dbData.summary.percentage_ciliated || '').toLowerCase().includes('reduce') ? 'inhibits' : 'promotes';
        summaryHtml = `
            <div class="prediction-grid">
                <div class="prediction-box ${lofClass}">
                    <h4>Loss-of-Function (Cilia Length)</h4>
                    <p>${dbData.summary.lof_length || 'N/A'}</p>
                </div>
                <div class="prediction-box ${percClass}">
                    <h4>Percentage Ciliated</h4>
                    <p>${dbData.summary.percentage_ciliated || 'N/A'}</p>
                </div>
            </div>`;
    } else {
        summaryHtml = '<p>No summary prediction available. Review literature and screen evidence for insights.</p>';
    }

    let evidenceHtml = '';
    if (allEvidence.length > 0) {
        const screenEv = allEvidence.find(ev => ev.source === 'screen_data');
        const otherEvidence = allEvidence.filter(ev => ev.source !== 'screen_data');

        const evidenceSnippets = otherEvidence.map(ev => `
            <div class="evidence-snippet">
                ${ev.context}
                <br><strong>Source: ${ev.source.toUpperCase()} (${ev.id})</strong>
            </div>`
        ).join('');
        
        evidenceHtml = `<div class="evidence-section">`;
        if (screenEv) {
            evidenceHtml += `<h4>Ciliary Screen Data</h4><div class="screen-evidence-container">${screenEv.context}</div>`;
        }
        if (otherEvidence.length > 0) {
            evidenceHtml += `
                <button class="evidence-toggle" data-count="${otherEvidence.length}">Show Other Evidence (${otherEvidence.length}) ▾</button>
                <div class="evidence-content">${evidenceSnippets}</div>`;
        }
        evidenceHtml += `</div>`;
    }

    return `
        <div class="result-card" id="card-${gene}">
            <h3>${gene} - <span class="${statusClass}">${statusText}</span></h3>
            ${summaryHtml}
            ${evidenceHtml}
        </div>`;
}

// All other functions like renderScreenDataTable, renderScreenSummaryHeatmap, analyzeGeneViaAPI, etc. are assumed to be present below
// ...

























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



// --- Render Screen Data Table ---
function renderScreenDataTable(gene, screenInfo) {
    let summary = '';
    let tableHtml = '';

    if (!screenInfo || typeof screenInfo !== 'object') {
        return '<p class="status-not-found">No structured screen data available for this gene.</p>';
    }

    const screensObj = screenInfo.screens || {};
    const screenKeys = Object.keys(screensObj);
    const numScreens = screenKeys.length || 5;
    const hitCount = screenKeys.filter(key => screensObj[key].hit === true).length;

    summary = `<p class="screen-summary">According to ${hitCount} out of ${numScreens} ciliary screens, <strong>${gene}</strong> was found to impact cilia (e.g., length or formation).</p>`;

    // Corrected screen names based on cilia biology literature
    const screenNames = [
        { key: 'Kim2016', name: 'Kim et al. (2016) IMCD3 RNAi' },
        { key: 'Wheway2015', name: 'Wheway et al. (2015) RPE1 RNAi' },
        { key: 'Roosing2015', name: 'Roosing et al. (2015) hTERT-RPE1' },
        { key: 'Basu2023', name: 'Basu et al. (2023) MDCK CRISPR' },
        { key: 'Breslow2018', name: 'Breslow et al. (2018) Hedgehog Signaling' }
    ];

    tableHtml = `
        <table class="screen-table">
            <thead>
                <tr>
                    <th>Screen</th>
                    <th>Hit?</th>
                    <th>Effect</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody>
                ${screenNames.slice(0, numScreens).map(({ key, name }) => {
                    const screenData = screensObj[key] || { hit: false, effect: 'N/A', details: 'Not tested' };
                    const hitIcon = screenData.hit ? '✅' : '❌';
                    const effectClass = screenData.hit ? (screenData.effect?.toLowerCase().includes('decreas') ? 'inhibits' : 'promotes') : 'no-effect';
                    return `
                        <tr>
                            <td>${name}</td>
                            <td>${hitIcon}</td>
                            <td class="effect-${effectClass}">${screenData.effect || 'N/A'}</td>
                            <td>${screenData.details || 'N/A'}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    return `${summary}${tableHtml}`;
}

// --- Heatmap Visualization (Adapted from plots.js) ---
function renderScreenSummaryHeatmap(genes, screenData) {
    // Clear previous plot
    const plotArea = document.getElementById('plot-display-area');
    if (!plotArea) return;

    // Corrected screen names and mappings
    const numberScreens = {
        'Kim et al. (2016) IMCD3 RNAi': 'Kim2016',
        'Wheway et al. (2015) RPE1 RNAi': 'Wheway2015',
        'Roosing et al. (2015) hTERT-RPE1': 'Roosing2015',
        'Basu et al. (2023) MDCK CRISPR': 'Basu2023'
    };
    const signalingScreens = {
        'Breslow et al. (2018) Hedgehog Signaling': 'Breslow2018'
    };
    const numberScreenOrder = Object.keys(numberScreens);
    const signalingScreenOrder = Object.keys(signalingScreens);

    const numberCategoryMap = {
        "Decreased cilia numbers": { value: 1, color: '#0571b0' },
        "Increased cilia numbers": { value: 2, color: '#ca0020' },
        "Causes Supernumerary Cilia": { value: 3, color: '#fdae61' },
        "No effect": { value: 4, color: '#fee090' },
        "Not in Screen": { value: 5, color: '#bdbdbd' },
        "Not Reported": { value: 6, color: '#636363' }
    };
    const signalingCategoryMap = {
        "Decreased Signaling (Positive Regulator)": { value: 1, color: '#2166ac' },
        "Increased Signaling (Negative Regulator)": { value: 2, color: '#d73027' },
        "No Significant Effect": { value: 3, color: '#fdae61' },
        "Not in Screen": { value: 4, color: '#bdbdbd' },
        "Not Reported": { value: 5, color: '#636363' }
    };

    const geneLabels = genes.map(g => g.toUpperCase());
    const zDataNumber = [], textDataNumber = [], zDataSignaling = [], textDataSignaling = [];

    genes.forEach(gene => {
        const numberRowValues = [], numberRowText = [], signalingRowValues = [], signalingRowText = [];

        numberScreenOrder.forEach(screenName => {
            const screenKey = numberScreens[screenName];
            let resultText = "Not in Screen";
            if (screenData[gene] && screenData[gene].screens) {
                const screenResult = screenData[gene].screens[screenKey];
                if (screenResult) resultText = screenResult.result || "Not Reported";
            }
            const mapping = numberCategoryMap[resultText] || numberCategoryMap["Not in Screen"];
            numberRowValues.push(mapping.value);
            numberRowText.push(resultText);
        });

        signalingScreenOrder.forEach(screenName => {
            const screenKey = signalingScreens[screenName];
            let resultText = "Not in Screen";
            if (screenData[gene] && screenData[gene].screens) {
                const screenResult = screenData[gene].screens[screenKey];
                if (screenResult) resultText = screenResult.result || "Not Reported";
            }
            const mapping = signalingCategoryMap[resultText] || signalingCategoryMap["Not in Screen"];
            signalingRowValues.push(mapping.value);
            signalingRowText.push(resultText);
        });

        zDataNumber.push(numberRowValues);
        textDataNumber.push(numberRowText);
        zDataSignaling.push(signalingRowValues);
        textDataSignaling.push(signalingRowText);
    });

    const trace1 = {
        x: numberScreenOrder,
        y: geneLabels,
        z: zDataNumber,
        customdata: textDataNumber,
        type: 'heatmap',
        colorscale: [
            [0, numberCategoryMap["Decreased cilia numbers"].color], [0.16, numberCategoryMap["Decreased cilia numbers"].color],
            [0.17, numberCategoryMap["Increased cilia numbers"].color], [0.33, numberCategoryMap["Increased cilia numbers"].color],
            [0.34, numberCategoryMap["Causes Supernumerary Cilia"].color], [0.50, numberCategoryMap["Causes Supernumerary Cilia"].color],
            [0.51, numberCategoryMap["No effect"].color], [0.67, numberCategoryMap["No effect"].color],
            [0.68, numberCategoryMap["Not Reported"].color], [0.84, numberCategoryMap["Not Reported"].color],
            [0.85, numberCategoryMap["Not in Screen"].color], [1.0, numberCategoryMap["Not in Screen"].color]
        ],
        showscale: false,
        hovertemplate: '<b>Gene:</b> %{y}<br><b>Screen:</b> %{x}<br><b>Result:</b> %{customdata}<extra></extra>',
        xgap: 1,
        ygap: 1
    };

    const trace2 = {
        x: signalingScreenOrder,
        y: geneLabels,
        z: zDataSignaling,
        customdata: textDataSignaling,
        type: 'heatmap',
        colorscale: [
            [0, signalingCategoryMap["Decreased Signaling (Positive Regulator)"].color], [0.25, signalingCategoryMap["Decreased Signaling (Positive Regulator)"].color],
            [0.26, signalingCategoryMap["Increased Signaling (Negative Regulator)"].color], [0.5, signalingCategoryMap["Increased Signaling (Negative Regulator)"].color],
            [0.51, signalingCategoryMap["No Significant Effect"].color], [0.75, signalingCategoryMap["No Significant Effect"].color],
            [0.76, signalingCategoryMap["Not Reported"].color], [0.85, signalingCategoryMap["Not Reported"].color],
            [0.86, signalingCategoryMap["Not in Screen"].color], [1.0, signalingCategoryMap["Not in Screen"].color]
        ],
        showscale: false,
        hovertemplate: '<b>Gene:</b> %{y}<br><b>Screen:</b> %{x}<br><b>Result:</b> %{customdata}<extra></extra>',
        xaxis: 'x2',
        yaxis: 'y1',
        xgap: 1,
        ygap: 1
    };

    const data = [trace1, trace2];

    const layout = {
        title: { text: 'Summary of Ciliary Screen Results', font: { size: 16, family: 'Arial', color: '#2c5aa0' } },
        grid: { rows: 1, columns: 2, pattern: 'independent' },
        xaxis: { domain: [0, 0.78], tickangle: -45, automargin: true },
        xaxis2: { domain: [0.8, 1.0], tickangle: -45, automargin: true },
        yaxis: { automargin: true, tickfont: { size: 10 } },
        margin: { l: 120, r: 220, b: 150, t: 80 },
        width: 950,
        height: 400 + (geneLabels.length * 30),
        annotations: []
    };

    const legend_x_pos = 1.02;
    const legend_spacing = 0.06;
    let current_y_pos = 1.0;

    layout.annotations.push({
        xref: 'paper', yref: 'paper', x: legend_x_pos, y: current_y_pos + 0.05,
        xanchor: 'left', text: '<b>Cilia Number/Structure</b>', showarrow: false, font: { size: 13 }
    });
    Object.keys(numberCategoryMap).forEach(key => {
        layout.annotations.push({
            xref: 'paper', yref: 'paper', x: legend_x_pos, y: current_y_pos,
            xanchor: 'left', yanchor: 'middle', text: `█ ${key}`,
            font: { color: numberCategoryMap[key].color, size: 12 },
            showarrow: false
        });
        current_y_pos -= legend_spacing;
    });

    current_y_pos -= 0.1;

    layout.annotations.push({
        xref: 'paper', yref: 'paper', x: legend_x_pos, y: current_y_pos + 0.05,
        xanchor: 'left', text: '<b>Hedgehog Signaling</b>', showarrow: false, font: { size: 13 }
    });
    Object.keys(signalingCategoryMap).forEach(key => {
        if (key !== "Not in Screen" && key !== "Not Reported") {
            layout.annotations.push({
                xref: 'paper', yref: 'paper', x: legend_x_pos, y: current_y_pos,
                xanchor: 'left', yanchor: 'middle', text: `█ ${key}`,
                font: { color: signalingCategoryMap[key].color, size: 12 },
                showarrow: false
            });
            current_y_pos -= legend_spacing;
        }
    });

    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
}

// --- Live Literature Mining Engine (Client-Side) ---
async function analyzeGeneViaAPI(gene, resultCard) {
    const ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
    const ELINK_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi";
    const EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
    
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
        const kwClause = API_QUERY_KEYWORDS.map(k => `"${k}"[Title/Abstract]`).join(" OR ");
        const query = `("${gene}"[Title/Abstract]) AND (${kwClause})`;
        const searchParams = new URLSearchParams({ db: 'pubmed', term: query, retmode: 'json', retmax: '25' });
        
        const searchResp = await fetch(`${ESEARCH_URL}?${searchParams}`);
        if (!searchResp.ok) throw new Error(`NCBI ESearch failed: ${searchResp.statusText}`);
        const searchData = await searchResp.json();
        const pmids = searchData.esearchresult?.idlist || [];

        if (pmids.length === 0) {
            return [];
        }

        await sleep(350);
        const linkParams = new URLSearchParams({
            dbfrom: 'pubmed',
            db: 'pmc',
            id: pmids.join(','),
            retmode: 'json'
        });
        const linkResp = await fetch(`${ELINK_URL}?${linkParams}`);
        if (!linkResp.ok) throw new Error(`NCBI ELink failed: ${linkResp.statusText}`);
        const linkData = await linkResp.json();
        
        const pmcIds = [];
        const linkSets = linkData.linksets || [];
        for (const linkSet of linkSets) {
            const links = linkSet.linksetdbs?.find(set => set.dbto === 'pmc')?.links || [];
            pmcIds.push(...links);
        }

        let articles = [];
        if (pmcIds.length > 0) {
            await sleep(350);
            const fetchParams = new URLSearchParams({ db: 'pmc', id: pmcIds.join(','), retmode: 'xml', rettype: 'full' });
            const fetchResp = await fetch(`${EFETCH_URL}?${fetchParams}`);
            if (fetchResp.ok) {
                const xmlText = await fetchResp.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "application/xml");
                articles = xmlDoc.getElementsByTagName('article');
            }
        }

        if (articles.length === 0) {
            await sleep(350);
            const fetchParams = new URLSearchParams({ db: 'pubmed', id: pmids.join(','), retmode: 'xml', rettype: 'abstract' });
            const fetchResp = await fetch(`${EFETCH_URL}?${fetchParams}`);
            if (fetchResp.ok) {
                const xmlText = await fetchResp.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "application/xml");
                articles = xmlDoc.getElementsByTagName('PubmedArticle');
            }
        }

        for (const article of articles) {
            let pmid, textContent;
            if (article.tagName === 'article') {
                pmid = article.querySelector('article-id[pub-id-type="pmid"]')?.textContent || 
                       article.querySelector('article-id[pub-id-type="pmcid"]')?.textContent;
                const title = article.querySelector('article-title')?.textContent || '';
                const body = article.querySelector('body') ? Array.from(article.querySelectorAll('body p, body sec, body para')).map(el => el.textContent).join(' ') : '';
                textContent = `${title}. ${body}`;
            } else {
                pmid = article.querySelector('MedlineCitation > PMID')?.textContent;
                const title = article.querySelector('ArticleTitle')?.textContent || '';
                const abstractNode = article.querySelector('Abstract');
                let abstractText = '';
                if (abstractNode) {
                    abstractText = Array.from(abstractNode.getElementsByTagName('AbstractText')).map(el => el.textContent).join(' ');
                }
                textContent = `${title}. ${abstractText}`;
            }

            if (!textContent || !geneRegex.test(textContent)) continue;

            const sentences = textContent.split(sentSplitRegex).filter(s => s.trim());
            for (const sent of sentences) {
                const sentLower = sent.toLowerCase();
                if (geneRegex.test(sentLower) && [...LOCAL_ANALYSIS_KEYWORDS].some(kw => sentLower.includes(kw.toLowerCase()))) {
                    foundEvidence.push({
                        id: pmid || 'unknown',
                        source: 'pubmed',
                        context: sent.trim().replace(geneRegex, `<mark>${gene}</mark>`)
                    });
                }
            }
        }
    } catch (error) {
        console.error(`Failed to fetch literature for ${gene}:`, error);
        const errorEl = resultCard ? resultCard.querySelector('.status-searching') : null;
        if (errorEl) {
            errorEl.textContent = 'Literature Search Failed';
            errorEl.className = 'status-not-found';
        }
    }
    
    return foundEvidence;
}




// Expose all functions globally for compatibility with globals.js router
window.setupCiliAIEventListeners = setupCiliAIEventListeners;
window.handleAIQuery = handleAIQuery;
window.analyzeGenesFromInput = analyzeGenesFromInput;
window.runAnalysis = runAnalysis;
window.analyzeGeneViaAPI = analyzeGeneViaAPI;
window.fetchScreenData = fetchScreenData;
window.createResultCard = createResultCard;
window.createPlaceholderCard = createPlaceholderCard;
window.renderScreenSummaryHeatmap = renderScreenSummaryHeatmap;
