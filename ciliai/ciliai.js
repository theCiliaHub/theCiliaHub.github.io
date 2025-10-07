// ciliAI.js - Enhanced with tissue expression, advanced AI queries, and functional category search

// --- Global Data Cache ---
let ciliaHubDataCache = null;
let screenDataCache = null;
let phylogenyDataCache = null;
let tissueDataCache = null; // New cache for tissue data

// --- Main Page Display Function ---
window.displayCiliAIPage = async function displayCiliAIPage() {
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

    try {
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
                        <div class="ai-input-group autocomplete-wrapper">
                            <input type="text" id="aiQueryInput" class="ai-query-input" placeholder="e.g., genes for Joubert Syndrome">
                            <div id="aiQuerySuggestions" class="suggestions-container"></div>
                            <button class="ai-query-btn" id="aiQueryBtn">Ask CiliAI</button>
                        </div>
                        <div class="example-queries">
                            <p><strong>Try asking:</strong> 
                                <span>"Where is IFT88 expressed?"</span>, 
                                <span>"genes highly expressed in testis"</span>,
                                <span>"genes lost in non-ciliated organisms"</span>,
                                <span>"show me ciliogenesis genes"</span>,
                                <span>"compare domains of IFT88 and IFT57"</span>.
                            </p>
                        </div>
                    </div>

                    <div class="input-section">
                        <h3>Analyze Gene Phenotypes</h3>
                        <div class="input-group">
                            <label for="geneInput">Gene Symbols:</label>
                            <div class="autocomplete-wrapper">
                                <textarea id="geneInput" class="gene-input-textarea" placeholder="Start typing a gene symbol (e.g., IFT88)..."></textarea>
                                <div id="geneSuggestions" class="suggestions-container"></div>
                            </div>
                        </div>

                        <div class="input-group">
                            <label>Analysis Mode:</label>
                            <div class="mode-selector">
                                <div class="mode-option">
                                    <input type="radio" id="hybrid" name="mode" value="hybrid" checked aria-label="Hybrid mode">
                                    <label for="hybrid" title="Best for most users. Combines our fast, expert-curated database, screen data, and real-time AI literature mining for the most comprehensive results.">
                                        <span class="mode-icon">🔬</span>
                                        <div><strong>Hybrid</strong><br><small>Expert DB + Screen Data + Literature</small></div>
                                    </label>
                                </div>
                                <div class="mode-option">
                                    <input type="radio" id="expert" name="mode" value="expert" aria-label="Expert only mode">
                                    <label for="expert" title="Fastest option. Queries only our internal, manually curated database and screen data of known gene-cilia interactions.">
                                        <span class="mode-icon">🏛️</span>
                                        <div><strong>Expert Only</strong><br><small>Curated DB + Screen Data</small></div>
                                    </label>
                                </div>
                                <div class="mode-option">
                                    <input type="radio" id="nlp" name="mode" value="nlp" aria-label="Literature only mode">
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
                        <button class="visualize-btn" id="visualizeBtn" style="display: none;">📊 Visualize Results</button>
                        <div id="plot-display-area" style="margin-top: 1rem;"></div>
                        <div id="resultsContainer"></div>
                    </div>
                </div>
            </div>
            
            <style>
                .ciliai-container { font-family: 'Arial', sans-serif; max-width: 950px; margin: 2rem auto; padding: 2rem; background-color: #f9f9f9; border-radius: 12px; }
                .ciliai-header { text-align: center; margin-bottom: 2rem; }
                .ciliai-header h1 { font-size: 2.8rem; color: #2c5aa0; margin: 0; }
                .ciliai-header p { font-size: 1.2rem; color: #555; margin-top: 0.5rem; }
                .ai-query-section { background-color: #e8f4fd; border: 1px solid #bbdefb; padding: 1.5rem 2rem; border-radius: 8px; margin-bottom: 2rem; }
                .ai-query-section h3 { margin-top: 0; color: #2c5aa0; }
                .ai-input-group { position: relative; display: flex; gap: 10px; }
                .ai-query-input { flex-grow: 1; padding: 0.8rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
                .ai-query-btn { padding: 0.8rem 1.2rem; font-size: 1rem; background-color: #2c5aa0; color: white; border: none; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; }
                .ai-query-btn:hover { background-color: #1e4273; }
                .example-queries { margin-top: 1rem; font-size: 0.9rem; color: #555; }
                .example-queries span { background-color: #d1e7fd; padding: 2px 6px; border-radius: 4px; font-family: monospace; cursor: pointer; }
                .input-section { background-color: #fff; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
                .input-section h3 { margin-top: 0; color: #333; }
                .input-group { margin-bottom: 1.5rem; }
                .input-group label { display: block; font-weight: bold; margin-bottom: 0.5rem; color: #333; }
                .gene-input-textarea { width: 100%; padding: 0.8rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; min-height: 80px; resize: vertical; box-sizing: border-box; }
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
                .result-card { border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; position: relative; overflow: hidden; }
                .result-card h3 { margin-top: 0; color: #2c5aa0; font-size: 1.4rem; }
                .result-card .status-found { color: #28a745; }
                .result-card .status-not-found { color: #dc3545; }
                .result-card .status-searching { color: #007bff; }
                .prediction-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; }
                .prediction-box { padding: 1rem; border-radius: 6px; text-align: center; background-color: #f8f9fa; border: 1px solid #dee2e6; }
                .prediction-box h4 { margin: 0 0 0.5rem 0; color: #495057; }
                .prediction-box p { margin: 0; font-size: 1.2rem; font-weight: bold; }
                .autocomplete-wrapper { position: relative; width: 100%; }
                .suggestions-container { display: none; position: absolute; top: 100%; left: 0; border: 1px solid #ddd; background-color: white; width: 100%; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 8px rgba(0,0,0,0.1); border-radius: 0 0 4px 4px; box-sizing: border-box; }
                .suggestion-item { padding: 10px; cursor: pointer; font-size: 0.9rem; }
                .suggestion-item:hover { background-color: #f0f0f0; }
            </style>
        `;
    } catch (error) {
        console.error('Failed to inject CiliAI HTML:', error);
        contentArea.innerHTML = '<p class="status-not-found">Error: Failed to load CiliAI interface.</p>';
        return;
    }

    // Fetch all necessary data in parallel for faster loading
    await Promise.all([
        fetchCiliaData(), 
        fetchScreenData(), 
        fetchPhylogenyData(),
        fetchTissueData() // New data source
    ]);
    setupCiliAIEventListeners();
};

// --- Helper Functions & Mock DB ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function debounce(fn, delay) { let timeout; return function (...args) { clearTimeout(timeout); timeout = setTimeout(() => fn(...args), delay); }; }
const CILI_AI_DB = { "HDAC6": { "summary": { "lof_length": "Promotes / Maintains", "percentage_ciliated": "No effect", "source": "Expert DB" }, "evidence": [{ "id": "21873644", "source": "pubmed", "context": "...loss of HDAC6 results in hyperacetylation of tubulin and leads to the formation of longer, more stable primary cilia in renal epithelial cells." }] }, "IFT88": { "summary": { "lof_length": "Inhibits / Restricts", "percentage_ciliated": "Reduced cilia numbers", "source": "Expert DB" }, "evidence": [{ "id": "10882118", "source": "pubmed", "context": "Mutations in IFT88 (polaris) disrupt intraflagellar transport, leading to a failure in cilia assembly and resulting in severely shortened or absent cilia." }] }, "ARL13B": { "summary": { "lof_length": "Inhibits / Restricts", "percentage_ciliated": "Reduced cilia numbers", "source": "Expert DB" }, "evidence": [{ "id": "21940428", "source": "pubmed", "context": "The small GTPase ARL13B is critical for ciliary structure; its absence leads to stunted cilia with abnormal morphology and axonemal defects." }] } };

// --- Data Fetching and Caching ---
async function fetchCiliaData() {
    if (ciliaHubDataCache) return ciliaHubDataCache;
    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/ciliahub_data.json');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        ciliaHubDataCache = data.map(gene => ({
            ...gene,
            domain_descriptions: typeof gene.domain_descriptions === 'string' 
                ? gene.domain_descriptions.split(',').map(d => d.trim()) 
                : Array.isArray(gene.domain_descriptions) 
                ? gene.domain_descriptions 
                : []
        }));
        console.log('CiliaHub data loaded and cached successfully.');
        return ciliaHubDataCache;
    } catch (error) {
        console.error("Failed to fetch CiliaHub data:", error);
        return null;
    }
}

async function fetchScreenData() {
    if (screenDataCache) return screenDataCache;
    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cilia_screens_data.json');
        if (!response.ok) throw new Error(`Failed to fetch screen data: ${response.statusText}`);
        screenDataCache = await response.json();
        console.log('Screen data loaded successfully.');
        return screenDataCache;
    } catch (error) {
        console.error('Error fetching screen data:', error);
        return {};
    }
}

async function fetchPhylogenyData() {
    if (phylogenyDataCache) return phylogenyDataCache;
    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/phylogeny_summary.json');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const raw = await response.json();
        const unified = {};
        const processGeneList = (list, category) => {
            if (Array.isArray(list)) {
                list.filter(Boolean).forEach(g => unified[g.trim().toUpperCase()] = { category });
            }
        };
        processGeneList(raw.ciliated_only_genes, 'ciliary_only');
        processGeneList(raw.nonciliary_only_genes, 'nonciliary_only');
        processGeneList(raw.in_all_organisms, 'in_all_organisms');
        if (Array.isArray(raw)) {
            raw.forEach(item => {
                const gene = (item.sym || '').trim().toUpperCase();
                const cat = (item.class || '').toLowerCase().replace(/\s+/g, '_');
                if (gene && cat) unified[gene] = { category: cat, species: item.species || [] };
            });
        }
        phylogenyDataCache = unified;
        console.log(`Phylogeny data normalized: ${Object.keys(unified).length} entries.`);
        return phylogenyDataCache;
    } catch (error) {
        console.error('Failed to fetch phylogeny summary data:', error);
        return {};
    }
}

async function fetchTissueData() {
    if (tissueDataCache) return tissueDataCache;
    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/raw/refs/heads/main/rna_tissue_consensus.tsv');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const tsv = await response.text();
        const lines = tsv.trim().split('\n');
        const data = {};
        for (let i = 1; i < lines.length; i++) {
            const [geneSymbol, tissue, nTPMValue] = lines[i].split('\t');
            const gene = geneSymbol.toUpperCase();
            if (!data[gene]) data[gene] = {};
            data[gene][tissue] = parseFloat(nTPMValue);
        }
        tissueDataCache = data;
        console.log('Tissue expression data loaded and cached.');
        return tissueDataCache;
    } catch (error) {
        console.error('Failed to fetch tissue data:', error);
        return {};
    }
}

// --- Conversational CiliAI Query Engine ---
// --- Conversational CiliAI Query Engine ---
async function handleAIQuery() {
    const aiQueryInput = document.getElementById('aiQueryInput');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsSection = document.getElementById('resultsSection');
    const query = aiQueryInput.value.trim();

    if (!query) return;

    resultsSection.style.display = 'block';
    resultsContainer.innerHTML = `<p class="status-searching">CiliAI is thinking...</p>`;
    document.getElementById('plot-display-area').innerHTML = '';
    document.getElementById('visualizeBtn').style.display = 'none';

    // Ensure all data is loaded before proceeding
    const data = ciliaHubDataCache;
    const phylogeny = phylogenyDataCache;
    const tissue = tissueDataCache;
    if (!data || !phylogeny || !tissue) {
        resultsContainer.innerHTML = `<p class="status-not-found">Error: Core data could not be loaded. Please check the console and try again.</p>`;
        return;
    }

    let resultHtml = '';
    let match;

    try {
        // A. Expression and Tissue Enrichment Queries
        if ((match = query.match(/(?:where is|expression of)\s+([A-Z0-9\-]+)/i))) {
            const gene = match[1].toUpperCase();
            resultHtml = formatTissueExpressionResults(gene, tissue[gene], `Tissue Expression for ${gene}`);
        }
        else if ((match = query.match(/(?:which genes are|genes)\s+(?:highly\s+)?expressed in\s+(.+)/i))) {
            const tissueName = match[1].trim().toLowerCase();
            const HIGH_EXPRESSION_THRESHOLD = 50; // nTPM threshold
            let results = [];
            for (const gene in tissue) {
                const matchingTissueKey = Object.keys(tissue[gene]).find(t => t.toLowerCase() === tissueName);
                if (matchingTissueKey && tissue[gene][matchingTissueKey] > HIGH_EXPRESSION_THRESHOLD) {
                    results.push({ gene, nTPM: tissue[gene][matchingTissueKey] });
                }
            }
            results.sort((a, b) => b.nTPM - a.nTPM); // Sort descending by expression
            resultHtml = formatTopTissueGenes(results, `Top Expressed Genes in ${tissueName}`, tissueName);
        }

        // C. Domain-based queries (REORDERED TO BE FIRST)
        else if ((match = query.match(/compare domain architecture of\s+([A-Z0-9\-]+)\s+and\s+([A-Z0-9\-]+)/i))) {
            const [gene1, gene2] = [match[1].toUpperCase(), match[2].toUpperCase()];
            const gene1Data = data.find(g => g.gene.toUpperCase() === gene1);
            const gene2Data = data.find(g => g.gene.toUpperCase() === gene2);
            resultHtml = formatDomainComparison(gene1Data, gene2Data, `Domain Comparison: ${gene1} vs ${gene2}`);
        }
        else if ((match = query.match(/genes with\s+(.+)\s+domains?/i))) {
            const domains = match[1].split(/ and |, /).map(d => d.replace(' domain', '').trim().toLowerCase());
            const results = data.filter(g => {
                const geneDomains = (g.domain_descriptions || []).map(d => d.toLowerCase());
                return domains.every(reqDomain => geneDomains.some(geneDomain => geneDomain.includes(reqDomain)));
            });
            resultHtml = formatDomainResults(results, `Genes with domains: ${domains.join(' & ')}`);
        }
        // MODIFIED REGEX to be more flexible (accepts "domain genes")
        else if ((match = query.match(/(?:show me|find|what genes have a)\s+(.*?)\s+domain(?: genes)?/i))) {
            const domain = match[1].trim();
            const results = data.filter(g => (g.domain_descriptions || []).some(d => d.toLowerCase().includes(domain.toLowerCase())));
            resultHtml = formatDomainResults(results, `Genes with "${domain}" domain`);
        }

        // B. Functional Category Queries (NOW AFTER DOMAINS)
        else if ((match = query.match(/(?:show me|find)\s+(.*?)\s+genes/i))) {
            const category = match[1].trim().toLowerCase();
            const results = data.filter(g => g.functional_category && g.functional_category.toLowerCase().includes(category));
            resultHtml = formatSimpleResults(results, `Genes in Functional Category: "${category}"`);
        }
        
        // D. Evolutionary Gain/Loss Queries
        else if (/(ciliary[-\s]?only|ciliated\s+organisms\s+specific|lost in non-ciliated organisms)/i.test(query)) {
            const results = Object.keys(phylogeny).filter(gene => phylogeny[gene]?.category === 'ciliary_only');
            resultHtml = formatSimpleGeneList(results, 'Genes Specific to Ciliated Organisms (Lost in Non-Ciliated)');
        }
        else if ((match = query.match(/(emerged with|unique to|gain of function in)\s+(.+)/i))) {
             const group = match[2].trim().toLowerCase().replace(/\s/g, '_');
             const results = Object.keys(phylogeny).filter(gene => phylogeny[gene]?.category?.includes(group));
             resultHtml = formatSimpleGeneList(results, `Genes associated with evolutionary group: "${match[2]}"`);
        }
        
        // E. Standard Queries (Disease, Localization, Complex)
        else if ((match = query.match(/(?:genes for|genes involved in)\s+(.*)/i))) {
            const disease = match[1].trim().toLowerCase();
            const diseaseRegex = new RegExp(disease.replace(/ /g, '[\\s-]*'), 'i');
            const results = data.filter(g => g.functional_summary && diseaseRegex.test(g.functional_summary));
            resultHtml = formatSimpleResults(results, `Genes associated with "${disease}"`);
        }
        else if ((match = query.match(/genes localizing to the\s+(.*)/i))) {
            const location = match[1].trim();
            const results = data.filter(g => g.localization && g.localization.toLowerCase().includes(location.toLowerCase()));
            resultHtml = formatSimpleResults(results, `Genes localizing to "${location}"`);
        }
        else if ((match = query.match(/complex(?:es)?\s+for\s+([A-Z0-9\-]+)/i))) {
            const geneName = match[1].toUpperCase();
            const gene = data.find(g => g.gene.toUpperCase() === geneName);
            resultHtml = formatComplexResults(gene, `Complex Information for ${geneName}`);
        }
        
        // F. Direct Gene Input & Fallback
        else if (/^[A-Z0-9]{3,}$/i.test(query.split(' ')[0])) {
            document.getElementById('geneInput').value = query.split(' ')[0].toUpperCase();
            analyzeGenesFromInput();
            return;
        } else {
            resultHtml = `<p>Sorry, I didn’t understand that query. Try one of the examples or ask about gene functions, localizations, or diseases.</p>`;
        }
        resultsContainer.innerHTML = resultHtml;

    } catch (e) {
        resultsContainer.innerHTML = `<p class="status-not-found">An error occurred. Please check the console.</p>`;
        console.error("AI Query Error:", e);
    }
}

// --- AI Result Formatting Helpers ---
function formatSimpleResults(results, title) {
    if (!results || results.length === 0) return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No matching genes found.</p></div>`;
    let html = `<div class="result-card"><h3>${title} (${results.length} found)</h3><ul>`;
    results.forEach(g => { html += `<li><strong>${g.gene}</strong>: ${g.description || 'No description.'}</li>`; });
    return html + '</ul></div>';
}

function formatSimpleGeneList(results, title) {
    if (!results || results.length === 0) return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No matching genes found.</p></div>`;
    let html = `<div class="result-card"><h3>${title} (${results.length} found)</h3><ul>`;
    results.forEach(gene => { html += `<li>${gene}</li>`; });
    return html + '</ul></div>';
}

function formatDomainResults(results, title) {
    if (!results || results.length === 0) return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No matching genes found.</p></div>`;
    let html = `<div class="result-card"><h3>${title} (${results.length} found)</h3>`;
    results.forEach(g => {
        const domains = (g.domain_descriptions || []).join(', ') || 'None';
        html += `<div style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>${g.gene}</strong><br><small>Domains: ${domains}</small></div>`;
    });
    return html + '</div>';
}

function formatDomainComparison(gene1Data, gene2Data, title) {
    let html = `<div class="result-card"><h3>${title}</h3><div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">`;
    const createColumn = (geneData) => {
        if (!geneData) return `<div><h4>Not Found</h4><p>Gene data unavailable.</p></div>`;
        const domains = geneData.domain_descriptions || [];
        return `<div><h4>${geneData.gene}</h4><ul>${domains.map(d => `<li>${d}</li>`).join('') || '<li>No domains listed.</li>'}</ul></div>`;
    };
    html += createColumn(gene1Data);
    html += createColumn(gene2Data);
    html += '</div></div>';
    return html;
}

function formatComplexResults(gene, title) {
    if (!gene) return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">Gene not found.</p></div>`;
    let html = `<div class="result-card"><h3>${title}</h3>`;
    if (gene.complex_names && gene.complex_names.length > 0) {
        html += `<h4>Complexes:</h4><ul>${gene.complex_names.map(name => `<li>${name}</li>`).join('')}</ul>`;
    }
    if (gene.complex_components && gene.complex_components.length > 0) {
        html += `<h4>Components:</h4><p>${gene.complex_components.join(', ')}</p>`;
    }
    if (!gene.complex_names?.length && !gene.complex_components?.length) {
        html += '<p>No complex information listed for this gene.</p>';
    }
    return html + '</div>';
}

function formatTissueExpressionResults(gene, expressionData, title) {
    if (!expressionData) return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No expression data found for ${gene}.</p></div>`;
    const sortedTissues = Object.entries(expressionData).sort(([,a],[,b]) => b - a);
    let html = `<div class="result-card"><h3>${title}</h3><ul style="columns: 2;">`;
    sortedTissues.forEach(([tissue, nTPM]) => {
        html += `<li><strong>${tissue}:</strong> ${nTPM.toFixed(2)} nTPM</li>`;
    });
    return html + '</ul></div>';
}

function formatTopTissueGenes(results, title, tissue) {
    if (results.length === 0) return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No genes found with high expression in ${tissue}.</p></div>`;
    let html = `<div class="result-card"><h3>${title} (${results.length} found)</h3><ul>`;
    results.slice(0, 50).forEach(item => { // Show top 50
        html += `<li><strong>${item.gene}</strong> (${item.nTPM.toFixed(2)} nTPM)</li>`;
    });
    return html + '</ul></div>';
}

// --- Autocomplete Logic ---
function setupAiQueryAutocomplete() {
    const aiQueryInput = document.getElementById('aiQueryInput');
    const suggestionsContainer = document.getElementById('aiQuerySuggestions');
    if (!aiQueryInput || !suggestionsContainer) return;

    const exampleQueries = [
        "Where is IFT88 expressed?",
        "genes highly expressed in testis",
        "show me ciliogenesis genes",
        "genes for Bardet-Biedl Syndrome",
        "show me WD40 domain genes",
        "genes lost in non-ciliated organisms",
        "compare domains of CDKL1 and EFCAB7",
        "genes with coiled-coil and EF-hand domains",
        "which genes emerged with metazoans?",
        "complexes for IFT88"
    ];

    aiQueryInput.addEventListener('input', () => {
        const inputText = aiQueryInput.value.toLowerCase();
        if (inputText.length < 2) {
            suggestionsContainer.style.display = 'none';
            return;
        }
        const filtered = exampleQueries.filter(q => q.toLowerCase().includes(inputText));
        if (filtered.length > 0) {
            suggestionsContainer.innerHTML = filtered.map(q => `<div class="suggestion-item">${q}</div>`).join('');
            suggestionsContainer.style.display = 'block';
        } else {
            suggestionsContainer.style.display = 'none';
        }
    });

    suggestionsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-item')) {
            aiQueryInput.value = e.target.textContent;
            suggestionsContainer.style.display = 'none';
            aiQueryInput.focus();
        }
    });

    document.addEventListener('click', (e) => {
        if (!aiQueryInput.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });
}

// --- Gene Analysis Engine & UI ---
function setupAutocomplete() {
    const geneInput = document.getElementById('geneInput');
    const suggestionsContainer = document.getElementById('geneSuggestions');
    if (!geneInput || !suggestionsContainer) return;

    geneInput.addEventListener('input', async () => {
        if (!ciliaHubDataCache) await fetchCiliaData();
        if (!ciliaHubDataCache) return;

        const currentTerm = geneInput.value.split(/[\s,]+/).pop().trim().toUpperCase();
        if (currentTerm.length < 2) {
            suggestionsContainer.style.display = 'none';
            return;
        }
        const suggestions = ciliaHubDataCache
            .map(g => g.gene)
            .filter(geneName => geneName && geneName.toUpperCase().startsWith(currentTerm))
            .slice(0, 10);

        if (suggestions.length > 0) {
            suggestionsContainer.innerHTML = suggestions.map(gene => `<div class="suggestion-item">${gene}</div>`).join('');
            suggestionsContainer.style.display = 'block';
        } else {
            suggestionsContainer.style.display = 'none';
        }
    });

    suggestionsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-item')) {
            const selectedGene = e.target.textContent;
            const terms = geneInput.value.split(/[\s,]+/).filter(Boolean);
            if (geneInput.value.trim().slice(-1) !== ',') terms.pop();
            terms.push(selectedGene);
            geneInput.value = terms.join(', ') + ', ';
            suggestionsContainer.style.display = 'none';
            geneInput.focus();
        }
    });

    document.addEventListener('click', (e) => {
        if (!geneInput.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });
}

function setupCiliAIEventListeners() {
    document.getElementById('analyzeBtn')?.addEventListener('click', analyzeGenesFromInput);
    document.getElementById('aiQueryBtn')?.addEventListener('click', handleAIQuery);
    
    document.getElementById('visualizeBtn')?.addEventListener('click', async () => {
        const genes = document.getElementById('geneInput').value.split(/[\s,]+/).map(g => g.trim().toUpperCase()).filter(Boolean);
        if (genes.length > 0) {
            const mode = document.querySelector('input[name="mode"]:checked').value;
            // Simplified: Always show screen heatmap if expert/hybrid, otherwise phylogeny
            if ((mode === 'expert' || mode === 'hybrid') && screenDataCache) {
                 renderScreenSummaryHeatmap(genes, screenDataCache);
            } else {
                 await renderPhylogenyHeatmap(genes);
            }
        }
    });

    document.getElementById('geneInput')?.addEventListener('keydown', debounce(e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            analyzeGenesFromInput();
        }
    }, 300));
    
    document.getElementById('aiQueryInput')?.addEventListener('keydown', debounce(e => {
        if (e.key === 'Enter') handleAIQuery();
    }, 300));

    document.getElementById('resultsContainer')?.addEventListener('click', e => {
        if (e.target?.classList.contains('evidence-toggle')) {
            const content = document.getElementById(e.target.dataset.contentId);
            if (content) {
                const isVisible = content.style.display === 'block';
                content.style.display = isVisible ? 'none' : 'block';
                e.target.textContent = isVisible ? `Show Evidence (${e.target.dataset.count}) ▾` : `Hide Evidence (${e.target.dataset.count}) ▴`;
            }
        }
    });
    
    document.querySelector('.example-queries')?.addEventListener('click', e => {
        if (e.target.tagName === 'SPAN') {
            document.getElementById('aiQueryInput').value = e.target.textContent.replace(/"/g, '');
            handleAIQuery();
        }
    });

    setupAutocomplete();
    setupAiQueryAutocomplete();
}

function analyzeGenesFromInput() {
    const geneInput = document.getElementById('geneInput');
    const genes = [...new Set(geneInput.value.split(/[\s,]+/).map(g => g.trim().toUpperCase()).filter(Boolean))];
    if (genes.length === 0) {
        document.getElementById('resultsContainer').innerHTML = '<p class="status-not-found">Please enter at least one gene symbol.</p>';
        document.getElementById('resultsSection').style.display = 'block';
        return;
    }
    runAnalysis(genes);
}

async function runAnalysis(geneList) {
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsSection = document.getElementById('resultsSection');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const visualizeBtn = document.getElementById('visualizeBtn');
    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'hybrid';

    resultsContainer.innerHTML = '';
    resultsSection.style.display = 'block';
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    visualizeBtn.style.display = 'none';
    document.getElementById('plot-display-area').innerHTML = '';

    geneList.forEach(gene => {
        resultsContainer.insertAdjacentHTML('beforeend', createPlaceholderCard(gene, mode));
    });

    for (const gene of geneList) {
        const resultCard = document.getElementById(`card-${gene}`);
        let dbData = CILI_AI_DB[gene] || null;
        let apiEvidence = [];
        let screenEvidence = [];

        if (mode === 'expert' || mode === 'hybrid') {
            if (screenDataCache && screenDataCache[gene]) {
                screenEvidence.push({
                    id: `screen-${gene}`,
                    source: 'screen_data',
                    context: renderScreenDataTable(gene, screenDataCache[gene])
                });
            }
        }
        if (mode === 'nlp' || mode === 'hybrid') {
            apiEvidence = await analyzeGeneViaAPI(gene, resultCard);
        }
        
        const allEvidence = [...(dbData?.evidence || []), ...apiEvidence, ...screenEvidence];
        const finalHtml = createResultCard(gene, dbData, allEvidence, mode);
        if (resultCard) resultCard.outerHTML = finalHtml;
    }

    analyzeBtn.disabled = false;
    analyzeBtn.textContent = '🔍 Analyze Genes';
    if (geneList.length > 0) visualizeBtn.style.display = 'block';
}

function renderScreenDataTable(gene, screenInfo) {
    if (!screenInfo || typeof screenInfo !== 'object') return '<p>No structured screen data.</p>';
    const screensObj = screenInfo.screens || screenInfo; // Handle both direct object and nested
    const screenKeys = Object.keys(screensObj);
    const hitCount = screenKeys.filter(key => screensObj[key]?.hit).length;
    const screenNames = { 'Kim2016': 'Kim et al. (2016)', 'Wheway2015': 'Wheway et al. (2015)', 'Roosing2015': 'Roosing et al. (2015)', 'Basu2023': 'Basu et al. (2023)', 'Breslow2018': 'Breslow et al. (2018)' };
    const summary = `<p><strong>${gene}</strong> was a hit in <strong>${hitCount} of ${screenKeys.length}</strong> ciliary screens.</p>`;
    const tableHtml = `<table style="width:100%; font-size:0.9em;"><thead><tr><th>Screen</th><th>Hit?</th><th>Effect</th></tr></thead><tbody>
        ${screenKeys.map(key => `<tr><td>${screenNames[key] || key}</td><td>${screensObj[key]?.hit ? '✅' : '❌'}</td><td>${screensObj[key]?.effect || 'N/A'}</td></tr>`).join('')}
    </tbody></table>`;
    return summary + tableHtml;
}

function createPlaceholderCard(gene, mode) {
    let statusText = mode === 'nlp' ? 'Searching live literature...' : 'Fetching data...';
    return `<div class="result-card" id="card-${gene}"><h3>${gene} - <span class="status-searching">${statusText}</span></h3></div>`;
}

function createResultCard(gene, dbData, allEvidence) {
    const statusText = allEvidence.length > 0 ? 'Evidence Found' : 'No Data Found';
    const statusClass = allEvidence.length > 0 ? 'status-found' : 'status-not-found';
    
    let summaryHtml = (dbData && dbData.summary) ? `
        <div class="prediction-grid">
            <div class="prediction-box"><h4>Cilia Length (LOF)</h4><p>${dbData.summary.lof_length}</p></div>
            <div class="prediction-box"><h4>% Ciliated</h4><p>${dbData.summary.percentage_ciliated}</p></div>
        </div>` : '<p>No summary prediction available.</p>';

    let evidenceHtml = '';
    if (allEvidence.length > 0) {
        const screenEv = allEvidence.find(ev => ev.source === 'screen_data');
        const otherEv = allEvidence.filter(ev => ev.source !== 'screen_data');
        evidenceHtml = `<div class="evidence-section" style="margin-top: 1rem;">`;
        if (screenEv) evidenceHtml += `<h4>Ciliary Screen Data</h4><div>${screenEv.context}</div>`;
        if (otherEv.length > 0) {
            const snippets = otherEv.map(ev => `<div style="border-top:1px solid #eee; padding:8px 0;">${ev.context.replace(new RegExp(`(${gene})`, 'ig'), `<mark>$1</mark>`)}<br><strong>Source: ${ev.source.toUpperCase()} (${ev.id})</strong></div>`).join('');
            evidenceHtml += `<button class="evidence-toggle" data-count="${otherEv.length}" data-content-id="evidence-${gene}">Show Other Evidence (${otherEv.length}) ▾</button><div class="evidence-content" style="display:none;" id="evidence-${gene}">${snippets}</div>`;
        }
        evidenceHtml += `</div>`;
    }

    return `<div class="result-card"><h3>${gene} - <span class="${statusClass}">${statusText}</span></h3>${summaryHtml}${evidenceHtml}</div>`;
}

async function renderPhylogenyHeatmap(genes) {
    if (!phylogenyDataCache) return;
    const allOrgs = new Set();
    genes.forEach(g => {
        const geneData = phylogenyDataCache[g.toUpperCase()];
        if (geneData?.species) geneData.species.forEach(org => allOrgs.add(org));
        if (geneData?.presence) Object.keys(geneData.presence).forEach(org => allOrgs.add(org));
    });

    const orgList = Array.from(allOrgs).sort();
    const z = genes.map(g => {
        const geneData = phylogenyDataCache[g.toUpperCase()];
        return orgList.map(org => {
            if (!geneData) return 0;
            if (geneData.presence) return geneData.presence[org] ? 1 : 0;
            if (geneData.species) return geneData.species.includes(org) ? 1 : 0;
            return 0;
        });
    });

    Plotly.newPlot('plot-display-area', [{ z, x: orgList, y: genes, type: 'heatmap', colorscale: [[0, '#e8f4fd'],[1, '#2c5aa0']], showscale: false }], {
        title: 'Phylogenetic Presence/Absence',
        xaxis: { tickangle: -45 },
        margin: { b: 150, l: 100 }
    });
}

// --- Live Literature Mining Engine ---
async function analyzeGeneViaAPI(gene, resultCard) {
    const ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
    const EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
    const API_KEYWORDS = ["cilia", "ciliary", "ciliogenesis", "intraflagellar transport", "ciliopathy"];
    const LOCAL_KEYWORDS = new Set(['cilia', 'cilium', 'axoneme', 'basal body', 'transition zone', 'shorter', 'longer', 'fewer', 'loss of', 'absent', 'reduced', 'increased']);
    
    try {
        const query = `("${gene}"[Title/Abstract]) AND (${API_KEYWORDS.map(k=>`"${k}"[Title/Abstract]`).join(" OR ")})`;
        const searchResp = await fetch(`${ESEARCH}?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=10`);
        const searchData = await searchResp.json();
        const pmids = searchData.esearchresult?.idlist || [];

        if (pmids.length === 0) return [];
        await sleep(350);

        const fetchResp = await fetch(`${EFETCH}?db=pubmed&id=${pmids.join(',')}&retmode=xml&rettype=abstract`);
        const xmlText = await fetchResp.text();
        const articles = new DOMParser().parseFromString(xmlText, "application/xml").getElementsByTagName('PubmedArticle');
        
        let foundEvidence = [];
        for (const article of articles) {
            const pmid = article.querySelector('MedlineCitation > PMID')?.textContent || 'N/A';
            const title = article.querySelector('ArticleTitle')?.textContent || '';
            const abstract = Array.from(article.querySelectorAll('AbstractText')).map(el => el.textContent).join(' ');
            const text = `${title}. ${abstract}`;

            if (!text.match(new RegExp(`\\b${gene}\\b`, 'i'))) continue;

            for (const sent of text.split(/(?<=[.!?])\s+/)) {
                if (sent.match(new RegExp(`\\b${gene}\\b`, 'i')) && [...LOCAL_KEYWORDS].some(kw => sent.toLowerCase().includes(kw))) {
                    foundEvidence.push({ id: pmid, source: 'pubmed', context: sent.trim() });
                    if (foundEvidence.length >= 5) return foundEvidence;
                }
            }
        }
        return foundEvidence;

    } catch (error) {
        console.error(`Literature search failed for ${gene}:`, error);
        if (resultCard) {
            const statusEl = resultCard.querySelector('.status-searching');
            if (statusEl) {
                statusEl.textContent = 'Literature Search Failed';
                statusEl.className = 'status-not-found';
            }
        }
        return [];
    }
}

// --- Heatmap Visualization ---
function renderScreenSummaryHeatmap(genes, screenData) {
    if (!window.Plotly) return;
    
    const numberScreens = { 'Kim et al. (2016)': 'Kim2016', 'Wheway et al. (2015)': 'Wheway2015', 'Roosing et al. (2015)': 'Roosing2015', 'Basu et al. (2023)': 'Basu2023' };
    const signalingScreens = { 'Breslow et al. (2018)': 'Breslow2018' };
    const numberScreenOrder = Object.keys(numberScreens);
    const signalingScreenOrder = Object.keys(signalingScreens);
    
    const categoryMap = { "Decreased cilia numbers": 1, "Increased cilia numbers": 2, "Causes Supernumerary Cilia": 3, "No effect": 4, "Decreased Signaling (Positive Regulator)": 5, "Increased Signaling (Negative Regulator)": 6, "No Significant Effect": 7, "Not in Screen": 0, "Not Reported": 0 };
    const colors = ['#bdbdbd', '#0571b0', '#ca0020', '#fdae61', '#fee090', '#2166ac', '#d73027', '#fdae61'];
    const colorscale = colors.map((color, i) => [i / (colors.length - 1), color]);
    
    const zNumber = [], textNumber = [], zSignaling = [], textSignaling = [];
    genes.forEach(gene => {
        const numRow = [], numText = [], sigRow = [], sigText = [];
        numberScreenOrder.forEach(name => {
            const result = screenData[gene]?.screens?.[numberScreens[name]]?.result || "Not in Screen";
            numRow.push(categoryMap[result] || 0);
            numText.push(result);
        });
        signalingScreenOrder.forEach(name => {
            const result = screenData[gene]?.screens?.[signalingScreens[name]]?.result || "Not in Screen";
            sigRow.push(categoryMap[result] || 0);
            sigText.push(result);
        });
        zNumber.push(numRow); textNumber.push(numText);
        zSignaling.push(sigRow); textSignaling.push(sigText);
    });

    const trace1 = { x: numberScreenOrder, y: genes, z: zNumber, customdata: textNumber, type: 'heatmap', colorscale, showscale: false, hovertemplate: '<b>Gene:</b> %{y}<br><b>Screen:</b> %{x}<br><b>Result:</b> %{customdata}<extra></extra>', xgap: 2, ygap: 2 };
    const trace2 = { x: signalingScreenOrder, y: genes, z: zSignaling, customdata: textSignaling, type: 'heatmap', colorscale, showscale: false, hovertemplate: '<b>Gene:</b> %{y}<br><b>Screen:</b> %{x}<br><b>Result:</b> %{customdata}<extra></extra>', xaxis: 'x2', xgap: 2, ygap: 2 };

    const layout = {
        title: 'Summary of Ciliary Screen Results',
        grid: { rows: 1, columns: 2, pattern: 'independent' },
        xaxis: { domain: [0, 0.78], tickangle: -45 },
        xaxis2: { domain: [0.8, 1.0], tickangle: -45 },
        yaxis: { automargin: true },
        height: 300 + (genes.length * 25),
        margin: { b: 150, l: 100 }
    };

    Plotly.newPlot('plot-display-area', [trace1, trace2], layout, { responsive: true });
}



// --- Global Exposure for Router ---
window.displayCiliAIPage = displayCiliAIPage;
window.setupCiliAIEventListeners = setupCiliAIEventListeners;
window.handleAIQuery = handleAIQuery;
window.analyzeGenesFromInput = analyzeGenesFromInput;
window.runAnalysis = runAnalysis;
window.analyzeGeneViaAPI = analyzeGeneViaAPI;
window.fetchScreenData = fetchScreenData;
window.createResultCard = createResultCard;
window.createPlaceholderCard = createPlaceholderCard;
window.renderScreenSummaryHeatmap = renderScreenSummaryHeatmap;

