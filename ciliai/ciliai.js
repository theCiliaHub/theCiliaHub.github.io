// ciliAI.js - Enhanced with advanced AI query handler, heatmap visualization, corrected screen names, and robust autocomplete

// --- Global Data Cache ---

let ciliaHubDataCache = null;
let screenDataCache = null;
// --- Phylogeny Summary Integration ---
let phylogenyDataCache = null;

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
        </div>
    <div id="ai-result-area" class="results-section" style="display: none; margin-top: 1.5rem; padding: 1rem;"></div>
</div>
                        <div class="example-queries">
                            <p><strong>Try asking:</strong> 
                                <span>"What is the function of IFT88?"</span>, 
                                <span>"Display genes for Bardet-Biedl Syndrome"</span>, 
                                <span>"Show me basal body genes"</span>, 
                                <span>"What domains are in CEP290?"</span>,
                                <span>"Show me ciliary genes in humans"</span>,
                                <span>"Display gene expression of ARL13B"</span>.
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
                                    <input type="radio" id="hybrid" name="mode" value="hybrid" checked aria-label="Hybrid mode: Combines expert database, screen data, and literature">
                                    <label for="hybrid" title="Best for most users. Combines our fast, expert-curated database, screen data, and real-time AI literature mining for the most comprehensive results.">
                                        <span class="mode-icon">🔬</span>
                                        <div>
                                            <strong>Hybrid</strong><br>
                                            <small>Expert DB + Screen Data + Literature</small>
                                        </div>
                                    </label>
                                </div>
                                <div class="mode-option">
                                    <input type="radio" id="expert" name="mode" value="expert" aria-label="Expert only mode: Queries only our internal, manually curated database and screen data">
                                    <label for="expert" title="Fastest option. Queries only our internal, manually curated database and screen data of known gene-cilia interactions.">
                                        <span class="mode-icon">🏛️</span>
                                        <div>
                                            <strong>Expert Only</strong><br>
                                            <small>Curated database + Screen Data</small>
                                        </div>
                                    </label>
                                </div>
                                <div class="mode-option">
                                    <input type="radio" id="nlp" name="mode" value="nlp" aria-label="Literature only mode: Performs a live AI-powered search across PubMed full-text articles">
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
                .example-queries span { background-color: #d1e7fd; padding: 2px 6px; border-radius: 4px; font-family: monospace; cursor: pointer;}
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
                .expression-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                .expression-table th, .expression-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                .expression-table th { background-color: #e8f4fd; color: #2c5aa0; }
                .expression-table tr:nth-child(even) { background-color: #f9f9f9; }
                .ai-suggestion a { color: #3b82f6; text-decoration: none; }
                .ai-suggestion a:hover { text-decoration: underline; }
            </style>
        `;
    } catch (error) {
        console.error('Failed to inject CiliAI HTML:', error);
        contentArea.innerHTML = '<p class="status-not-found">Error: Failed to load CiliAI interface.</p>';
        return;
    }

    await Promise.all([fetchCiliaData(), fetchScreenData(), fetchPhylogenyData(), fetchTissueData()]);
    console.log('ciliAI.js: All data loaded');
    setupCiliAIEventListeners();
};

// --- Helper Functions & Mock DB ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function debounce(fn, delay) { let timeout; return function (...args) { clearTimeout(timeout); timeout = setTimeout(() => fn(...args), delay); }; }
const CILI_AI_DB = { "HDAC6": { "summary": { "lof_length": "Promotes / Maintains", "percentage_ciliated": "No effect", "source": "Expert DB" }, "evidence": [{ "id": "21873644", "source": "pubmed", "context": "...loss of HDAC6 results in hyperacetylation of tubulin and leads to the formation of longer, more stable primary cilia in renal epithelial cells." }] }, "IFT88": { "summary": { "lof_length": "Inhibits / Restricts", "percentage_ciliated": "Reduced cilia numbers", "source": "Expert DB" }, "evidence": [{ "id": "10882118", "source": "pubmed", "context": "Mutations in IFT88 (polaris) disrupt intraflagellar transport, leading to a failure in cilia assembly and resulting in severely shortened or absent cilia." }] }, "ARL13B": { "summary": { "lof_length": "Inhibits / Restricts", "percentage_ciliated": "Reduced cilia numbers", "source": "Expert DB" }, "evidence": [{ "id": "21940428", "source": "pubmed", "context": "The small GTPase ARL13B is critical for ciliary structure; its absence leads to stunted cilia with abnormal morphology and axonemal defects." }] } };


// --- Data Fetching and Caching (WITH COMPREHENSIVE SANITIZATION FIX) ---
async function fetchCiliaData() {
    if (ciliaHubDataCache) return ciliaHubDataCache;
    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/ciliahub_data.json');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();

        ciliaHubDataCache = data.map(gene => ({
            gene: gene.gene || 'Unknown Gene',
            ensembl_id: gene.ensembl_id || 'Not available',
            description: gene.description || 'Not available',
            omim_id: gene.omim_id || 'Not available',
            functional_summary: gene.functional_summary || 'Not available',
            localization: gene.localization || 'Not available',
            functional_category: gene.functional_category || 'Not available',
            reference: gene.reference || 'Not available',
            pfam_ids: gene.pfam_ids || 'Not available',
            synonym: gene.synonym || 'Not available',
            ciliopathy: gene.ciliopathy || 'Not available',
            complex_names: Array.isArray(gene.complex_names) ? gene.complex_names : [],
            complex_components: Array.isArray(gene.complex_components) ? gene.complex_components : [],
            domain_descriptions: Array.isArray(gene.domain_descriptions) ? gene.domain_descriptions : (typeof gene.domain_descriptions === 'string' ? gene.domain_descriptions.split(',').map(d => d.trim()) : []),
            screens: Array.isArray(gene.screens) ? gene.screens : []
        }));

        console.log('CiliaHub data loaded and SANITIZED successfully.');
        return ciliaHubDataCache;
    } catch (error) {
        console.error("Failed to fetch and process CiliaHub data:", error);
        return null;
    }
}


async function fetchScreenData() {
    if (screenDataCache) return screenDataCache;
    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cilia_screens_data.json');
        if (!response.ok) throw new Error(`Failed to fetch screen data: ${response.statusText}`);
        const data = await response.json();
        screenDataCache = data;
        console.log('Screen data loaded successfully:', Object.keys(data).length, 'genes');
        return data;
    } catch (error) {
        console.error('Error fetching screen data:', error);
        return {};
    }
}


// =============== START: REPLACED FUNCTION ===============
// This function from "Code 1" replaces the faulty one from "Code 2" to fix the TypeError.
async function fetchPhylogenyData() {
    if (phylogenyDataCache) return phylogenyDataCache;

    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/phylogeny_summary.json');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const raw = await response.json();

        const unified = {};

        // 1. Handle top-level arrays like "ciliated_only_genes"
        if (raw.ciliated_only_genes) {
            raw.ciliated_only_genes
                .filter(gene => typeof gene === 'string') // Ensure it's a string
                .forEach(g => unified[g.trim().toUpperCase()] = { category: 'ciliary_only' });
        }

        if (raw.nonciliary_only_genes) {
            raw.nonciliary_only_genes
                .filter(gene => typeof gene === 'string') // Ensure it's a string
                .forEach(g => unified[g.trim().toUpperCase()] = { category: 'nonciliary_only' });
        }

        if (raw.in_all_organisms) {
            raw.in_all_organisms
                .filter(gene => typeof gene === 'string') // Ensure it's a string
                .forEach(g => unified[g.trim().toUpperCase()] = { category: 'in_all_organisms' });
        }

        // 2. Handle list of objects like {id, sym, class, species}
        if (Array.isArray(raw)) {
            raw.forEach(item => {
                const gene = (item.sym || '').trim().toUpperCase(); // Safely handles missing 'sym'
                const cat = (item.class || '').toLowerCase().replace(/\s+/g, '_');
                if (gene) unified[gene] = { category: cat, species: item.species || [] };
            });
        }

        phylogenyDataCache = unified;
        console.log(`Phylogeny data normalized: ${Object.keys(unified).length} entries`);
        return phylogenyDataCache;
    } catch (error) {
        console.error('Failed to fetch phylogeny summary data:', error);
        return {};
    }
}

// =============== END: REPLACED FUNCTION ===============

// =============================================================================
// Fetch tissue expression data
// =============================================================================

async function fetchTissueData() {
    // Use the global cache
    if (window.tissueDataCache) return window.tissueDataCache;

    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/rna_tissue_consensus.tsv');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const tsv = await response.text();
        const lines = tsv.trim().split('\n');
        if (lines.length < 2) throw new Error('Empty TSV file');

        const data = {};
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split('\t');
            if (parts.length < 4) continue;

            const [, geneSymbol, tissue, nTPMValue] = parts;
            if (!geneSymbol || !tissue || !nTPMValue) continue;

            const gene = geneSymbol.toUpperCase().trim();
            const nTPM = parseFloat(nTPMValue.trim());
            if (!isNaN(nTPM)) {
                if (!data[gene]) data[gene] = {};
                data[gene][tissue.trim()] = nTPM;
            }
        }

        window.tissueDataCache = data;
        console.log('Tissue expression data loaded for', Object.keys(data).length, 'genes');
        return window.tissueDataCache;

    } catch (error) {
        console.error('Failed to fetch tissue data:', error);

        // Fallback data
        window.tissueDataCache = {
            'IFT88': { 'Kidney Cortex': 8.45, 'Kidney Medulla': 12.67 }
        };
        return window.tissueDataCache;
    }
}

// Expose it globally just in case
window.fetchTissueData = fetchTissueData;



async function getGenesByFunctionalCategory(query) {
    await fetchCiliaData();
    if (!ciliaHubDataCache) return [];
    if (!query) return [];
    
    // Normalize the query
    const normalizedQuery = query.toLowerCase().trim();
    
    // Create search terms - handle various formats
    let searchTerms = [];
    
    // Map common queries to database terms
    const termMappings = {
        'basal body': ['basal body', 'centriole', 'centrosome'],
        'transition zone': ['transition zone', 'tz'],
        'axoneme': ['axoneme', 'motile'],
        'motile cilium': ['motile', 'axoneme'],
        'ciliogenesis': ['ciliogenesis', 'assembly', 'biogenesis'],
        'trafficking': ['trafficking', 'transport', 'bbsome'],
        'motor': ['motor', 'dynein', 'kinesin'],
        'signaling': ['signaling', 'hedgehog', 'shh']
    };
    
    // Find matching terms
    for (const [key, terms] of Object.entries(termMappings)) {
        if (normalizedQuery.includes(key)) {
            searchTerms.push(...terms);
            break; // Use first match
        }
    }
    
    // If no mapping found, use original query
    if (searchTerms.length === 0) {
        searchTerms = normalizedQuery.split(/\s+/).filter(Boolean);
    }
    
    // Search through functional_category and localization fields
    return ciliaHubDataCache
        .filter(item => {
            const combinedText = [
                item.functional_category || '',
                item.localization || '',
                item.functional_summary || '',
                item.description || ''
            ].join(' ').toLowerCase();
            
            // Match if ANY search term is found
            return searchTerms.some(term => combinedText.includes(term));
        })
        .map(item => item.gene)
        .filter((value, index, self) => self.indexOf(value) === index) // Unique genes
        .sort();
}


/**
 * Renders an interactive protein interaction network using Cytoscape.js.
 * @param {string} geneSymbol - The central gene for the network.
 * @param {string} containerId - The ID of the div element to render the graph in.
 */
async function displayInteractionNetwork(geneSymbol, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with ID "${containerId}" not found for network graph.`);
        return;
    }
    container.innerHTML = `<p class="status-searching">Building interaction network for ${geneSymbol}...</p>`;

    // Ensure CiliaHub data is available
    if (!ciliaHubDataCache) await fetchCiliaData();

    // The user's original fetchCiliaData function creates an array of objects.
    // We need to find the specific gene data.
    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === geneSymbol.toUpperCase());
    const interactions = geneData?.interactions;

    if (!interactions || interactions.length === 0) {
        container.innerHTML = `<div class="result-card"><p class="status-not-found">No interaction data found for <strong>${geneSymbol}</strong> in the CiliaHub database.</p></div>`;
        return;
    }

    const elements = [{ data: { id: geneSymbol, label: geneSymbol }, classes: 'central-node' }];
    interactions.forEach(interactor => {
        elements.push({ data: { id: interactor, label: interactor }, classes: 'interactor-node' });
        elements.push({ data: { source: geneSymbol, target: interactor } });
    });

    // Clear the container before rendering
    container.innerHTML = ''; 

    cytoscape({
        container: container,
        elements: elements,
        style: [
            { selector: 'node', style: { 'label': 'data(label)', 'text-valign': 'center', 'color': '#fff', 'text-outline-width': 2, 'text-outline-color': '#555' } },
            { selector: '.central-node', style: { 'background-color': '#d35400', 'width': 80, 'height': 80 } },
            { selector: '.interactor-node', style: { 'background-color': '#2980b9', 'width': 60, 'height': 60 } },
            { selector: 'edge', style: { 'width': 3, 'line-color': '#ccc', 'curve-style': 'bezier' } }
        ],
        layout: { name: 'cose', padding: 10, nodeRepulsion: 400000, idealEdgeLength: 100, animate: true }
    });
}

// --- Intent Parsing Engine (WITH FIX) ---
function parseComplexQuery(rawQuery, allGenes = []) {
    let normalizedQuery = rawQuery.toLowerCase().trim().replace(/[?!.,]/g, '').replace(/\b(please|kindly|can you|could you|would you|show me|tell me|give me|display|list|find|explain|about|information on|info about|details of)\b/g, '').replace(/\s+/g, ' ');
    const entities = { genes: [], category: null, disease: null, infoType: null };
    const geneSet = new Set(allGenes.map(g => g.toUpperCase()));
    normalizedQuery.toUpperCase().split(' ').forEach(word => { if (geneSet.has(word)) entities.genes.push(word); });
    
    if (normalizedQuery.match(/\b(localization|located)\b/)) entities.infoType = 'localization';

    const categoryPattern = /(motile cilium|axoneme|basal body|transition zone|ciliogenesis)/;
    const categoryMatch = normalizedQuery.match(new RegExp(`(?:genes for|genes in|related to|genes of)\\s+(${categoryPattern.source})|(${categoryPattern.source})\\s+genes`));
    if (categoryMatch) {
        entities.category = categoryMatch[1] || categoryMatch[2];
        return { intent: 'LIST_GENES_BY_CATEGORY', entities };
    }
    
    if (normalizedQuery.match(/\b(domain|motif|repeat|structure)\b/)) return { intent: 'GET_DOMAINS', entities };
    if (normalizedQuery.match(/\b(compare|between|vs\.?|versus)\b/) && entities.genes.length >= 2) return { intent: 'COMPARE_EXPRESSION', entities };
    if (normalizedQuery.match(/\b(interact|network|partner|binding)\b/)) return { intent: 'GET_INTERACTIONS', entities };
    if (normalizedQuery.match(/\b(phylogeny|evolution|ortholog|conservation)\b/)) return { intent: 'GET_PHYLOGENY', entities };
    if (normalizedQuery.match(/\b(expression|expressed|tissue|where is|in which)\b/)) return { intent: 'GET_EXPRESSION', entities };
    
    const diseaseMatch = normalizedQuery.match(/(?:genes for|disease(?:s)?|illness|syndrome|condition|linked to)\s+([a-z\s0-9\-]+)/);
    if (diseaseMatch) {
        if (entities.genes.length > 0) return { intent: 'GET_DISEASES', entities };
        entities.disease = diseaseMatch[1].replace(entities.genes.join(' ').toLowerCase(), '').trim();
        return { intent: 'LIST_GENES_BY_DISEASE', entities };
    }
    
    if (entities.infoType === 'localization') return { intent: 'GET_LOCALIZATION', entities };
    if (normalizedQuery.match(/\b(function|role|does|do)\b/)) return { intent: 'GET_FUNCTION', entities };
    if (normalizedQuery.match(/\b(ciliome|ciliary genes)\b/)) return { intent: 'LIST_CILIOME', entities };
    if (entities.genes.length > 0) return { intent: 'GET_FUNCTION', entities };
    
    return { intent: 'UNKNOWN', entities };
}

// --- Main Query Handler (FULLY RESTORED & CORRECTED) ---
window.handleAIQuery = async function() {
    const aiQueryInput = document.getElementById('aiQueryInput');
    const resultArea = document.getElementById('ai-result-area');
    const query = aiQueryInput.value.trim();
    if (!query) return;

    resultArea.style.display = 'block';
    resultArea.innerHTML = `<p class="status-searching">🧠 CiliAI is thinking...</p>`;
    
    const [data, phylogeny] = await Promise.all([fetchCiliaData(), fetchPhylogenyData()]);
    if (!data) {
        resultArea.innerHTML = `<p class="status-not-found">⚠️ Failed to load core data.</p>`;
        return;
    }

    const { intent, entities } = parseComplexQuery(query, data.map(g => g.gene));
    let resultHtml = '';

    try {
        if (entities.genes.length === 0 && !['LIST_GENES_BY_CATEGORY', 'LIST_GENES_BY_DISEASE', 'LIST_CILIOME', 'UNKNOWN'].includes(intent)) {
             resultHtml = `<div class="result-card"><p>Please specify a gene name in your query (e.g., "what domains are in IFT140?").</p></div>`;
        } else {
            switch (intent) {
                case 'COMPARE_EXPRESSION':
                    await displayCiliAIExpressionHeatmap(entities.genes, resultArea);
                    return;
                case 'GET_INTERACTIONS':
                    resultArea.style.height = '450px';
                    await displayInteractionNetwork(entities.genes[0], 'ai-result-area');
                    return;
                case 'GET_EXPRESSION':
                    await displayCiliAIExpressionHeatmap(entities.genes, resultArea);
                    return;
                case 'GET_DOMAINS': {
                    const geneSymbol = entities.genes[0];
                    const geneData = data.find(g => g.gene === geneSymbol);
                    const domains = (geneData?.domain_descriptions && geneData.domain_descriptions.length > 0) 
                        ? geneData.domain_descriptions.join(', ') 
                        : 'No domains or repeats listed in the database.';
                    resultHtml = formatGeneDetail(geneData, geneSymbol, 'Domains / Repeats', domains);
                    break;
                }
                case 'GET_LOCALIZATION': {
                    const geneSymbol = entities.genes[0];
                    const geneData = data.find(g => g.gene === geneSymbol);
                    resultHtml = formatGeneDetail(geneData, geneSymbol, 'Localization', geneData?.localization);
                    break;
                }
                case 'GET_FUNCTION': {
                    const geneSymbol = entities.genes[0];
                    const geneData = data.find(g => g.gene === geneSymbol);
                    resultHtml = formatGeneDetail(geneData, geneSymbol, 'Function', geneData?.functional_summary);
                    break;
                }
                case 'GET_DISEASES': {
                    const geneSymbol = entities.genes[0];
                    const geneData = data.find(g => g.gene === geneSymbol);
                    resultHtml = formatGeneDetail(geneData, geneSymbol, 'Associated Diseases', geneData?.ciliopathy);
                    break;
                }
                case 'GET_PHYLOGENY': {
                    const geneSymbol = entities.genes[0];
                    const geneData = phylogeny[geneSymbol.toUpperCase()];
                    if (!geneData || !geneData.category) {
                        resultHtml = `<div class="result-card"><h3>Phylogeny of ${geneSymbol}</h3><p class="status-not-found">No phylogeny data found.</p></div>`;
                    } else {
                        resultHtml = `<div class="result-card"><h3>Phylogeny of ${geneSymbol}</h3><p>This gene is classified under: <strong>${geneData.category.replace(/_/g, ' ')}</strong>.</p></div>`;
                    }
                    break;
                }
                case 'LIST_GENES_BY_DISEASE': {
                    const diseaseRegex = new RegExp(entities.disease.replace(/ /g, '[\\s-]*'), 'i');
                    const results = data.filter(g => (g.ciliopathy || g.functional_summary || '').match(diseaseRegex)).map(g => g.gene).sort();
                    resultHtml = formatListResult(`Genes for: ${entities.disease}`, results);
                    break;
                }
                case 'LIST_GENES_BY_CATEGORY': {
                    const results = await getGenesByFunctionalCategory(entities.category);
                    resultHtml = formatListResult(`Genes for: ${entities.category}`, results);
                    break;
                }
                case 'LIST_CILIOME': {
                    const results = data.map(g => g.gene).sort();
                    resultHtml = formatListResult('All Ciliary Genes (Ciliome)', results);
                    break;
                }
                default:
                    resultHtml = `<div class="result-card"><p>🤔 Sorry, I didn’t understand that. Please try rephrasing.</p></div>`;
                    break;
            }
        }
        resultArea.innerHTML = resultHtml;
    } catch (err) {
        resultArea.innerHTML = `<p class="status-not-found">⚠️ An error occurred.</p>`;
        console.error(err);
    }
};


function normalizeTerm(s) {
    if (!s) return '';
    return String(s).toLowerCase().replace(/[_\-\s]+/g, ' ').trim();
}


function parseUserIntent(query) {
  const q = query.toLowerCase().trim();

  if (q.match(/\b(domain|motif|repeat|structure|architecture|fold)\b/)) {
    return "domains";
  }
  if (q.match(/\b(expression|expressed|tissue|where)\b/)) {
    return "expression";
  }
  if (q.match(/\b(disease|illness|syndrome|condition|linked|caused)\b/)) {
    return "diseases";
  }
  if (q.match(/\b(function|role|does|activity|does.*do)\b/)) {
    return "function";
  }
  if (q.match(/\b(phylogeny|evolution|ortholog|homolog|tree)\b/)) {
    return "phylogeny";
  }
  if (q.match(/\b(interact|partner|binding|complex)\b/)) {
    return "interaction";
  }
  if (q.match(/\b(ciliome|cilia|ciliary genes|cilia-related)\b/)) {
    return "ciliome";
  }

  return "unknown";
}

// ===============================================================
// 🌐 Natural Query Normalizer + Intent Parser
// ===============================================================
function normalizeAndDetectIntent(rawQuery, data) {
    let q = rawQuery.toLowerCase().trim();
    const intents = {};

    // --- Cleanup ---
    q = q.replace(/[?!.]/g, ' ');
    q = q.replace(/\b(please|kindly|can you|could you|would you|show me|tell me|give me|display|list|find|explain|about|information on|info about|details of)\b/g, '');
    q = q.replace(/\s+/g, ' ').trim();

    // --- Normalize common synonyms ---
    q = q.replace(/\b(role|job|purpose|activity|functionality)\b/g, 'function');
    q = q.replace(/\b(where is|where can i find|tissue expression of|in which tissues|expressed in|localization of|found in|pattern of)\b/g, 'expression of');
    q = q.replace(/\b(domains of|protein regions in|motifs in|contains domains of|domain architecture of)\b/g, 'domains in');
    q = q.replace(/\b(disease[s]? caused by|illnesses linked to|associated disorders of|mutations in|syndromes linked to|conditions related to)\b/g, 'diseases linked to');
    q = q.replace(/\b(interaction partners of|binding partners of|interactors of|interactome of|network of)\b/g, 'interacting partners of');
    q = q.replace(/\b(evolution|evolutionary conservation of|orthologs of|homologs of|present in species|comparative analysis of|species distribution of)\b/g, 'phylogeny of');
    q = q.replace(/\b(ciliome genes|cilia-related genes|cilia genes|genes with ciliary function|cilia components)\b/g, 'ciliary genes');
    q = q.replace(/\b(compare expression between|compare expression of|expression comparison of)\b/g, 'compare expression of');

    // --- Detect genes in text ---
    const geneSymbols = data ? data.map(g => g.gene.toUpperCase()) : [];
    const foundGenes = [];
    geneSymbols.forEach(g => {
        const regex = new RegExp(`\\b${g.toLowerCase()}\\b`);
        if (regex.test(q)) foundGenes.push(g);
    });

    // --- Detect intent keywords ---
    if (q.match(/function of/)) intents.type = 'function';
    else if (q.match(/expression of|where is/)) intents.type = 'expression';
    else if (q.match(/domains in/)) intents.type = 'domains';
    else if (q.match(/diseases linked to|associated with/)) intents.type = 'diseases';
    else if (q.match(/interacting partners of|interaction network/)) intents.type = 'interaction';
    else if (q.match(/phylogeny of/)) intents.type = 'phylogeny';
    else if (q.match(/ciliary genes|ciliome/)) intents.type = 'ciliome';
    else if (q.match(/genes for|genes involved in|genes related to/)) intents.type = 'category';
    else intents.type = 'unknown';

    return { normalized: q, genes: foundGenes, intent: intents.type };
}
// ===============================================================
// 💡 Suggestion Engine
// ===============================================================
function suggestSimilarQuery(intent, genes) {
    if (!intent || genes.length === 0) return null;
    const g = genes[0];
    const suggestions = {
        function: [`What is the function of ${g}?`, `Describe the role of ${g}`],
        expression: [`Where is ${g} expressed?`, `Show expression of ${g}`],
        domains: [`What domains are in ${g}?`, `Show protein domains of ${g}`],
        diseases: [`List diseases linked to ${g}`, `What disorders are associated with ${g}?`],
        interaction: [`Show interacting partners of ${g}`, `Interaction network for ${g}`],
        phylogeny: [`Show phylogeny of ${g}`, `Evolutionary conservation of ${g}`],
        ciliome: [`Show all human ciliary genes`, `List ciliome genes`],
        category: [`Show genes for ciliogenesis`, `Genes related to Joubert syndrome`]
    };
    return suggestions[intent] || [];
}


// -------------------------------
// Click handler for gene selection
// -------------------------------
document.addEventListener('click', (e) => {
    if (e.target.matches('.gene-card, .gene-name')) {
        const geneName = e.target.dataset.geneName || e.target.textContent.trim();
        if (geneName) handleCiliAISelection([geneName]);
    }

    // Handle clicks on suggested questions
    if (e.target.matches('.example-queries')) {
        const aiQueryInput = document.getElementById('aiQueryInput');
        aiQueryInput.value = e.target.textContent.replace(/["']/g, '');
        handleAIQuery();
    }

    // Handle explicit heatmap request
    if (e.target.classList.contains('ai-action')) {
        e.preventDefault();
        const action = e.target.dataset.action;
        const gene = e.target.dataset.gene;
        if (action === 'expression-visualize' && gene) {
            document.getElementById('plot-display-area').innerHTML = `<p class="status-searching">Building expression heatmap...</p>`;
            handleCiliAISelection([gene]);
        }
    }
});


// --- AI Result Formatting Helpers ---
function formatGeneDetail(geneData, geneSymbol, detailTitle, detailContent) {
    if (!geneData) {
        return `<div class="result-card"><h3>${geneSymbol}</h3><p class="status-not-found">Gene not found in the database.</p></div>`;
    }
    return `
        <div class="result-card">
            <h3>${geneSymbol}</h3>
            <h4>${detailTitle}:</h4>
            <p>${detailContent || 'No information available.'}</p>
        </div>
    `;
}




function formatListResult(title, geneList, message = '') {
    if (!geneList || geneList.length === 0) {
        return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No matching genes found.</p></div>`;
    }
    const messageHtml = message ? `<p>${message}</p>` : '';
    return `
        <div class="result-card">
            <h3>${title} (${geneList.length} found)</h3>
            ${messageHtml}
            <ul style="column-count: 3; list-style-type: none; padding-left: 0;">
                ${geneList.map(g => `<li>${g}</li>`).join('')}
            </ul>
        </div>
    `;
}

function formatSimpleResults(results, title) {
    if (results.length === 0) return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No matching genes found.</p></div>`;
    let html = `<div class="result-card"><h3>${title} (${results.length} found)</h3><ul>`;
    results.forEach(gene => {
        html += `<li><strong>${gene.gene}</strong>: ${gene.description || 'No description available.'}</li>`;
    });
    return html + '</ul></div>';
}

function formatDomainResults(results, title) {
    if (results.length === 0) return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No matching genes found.</p></div>`;
    let html = `<div class="result-card"><h3>${title} (${results.length} found)</h3>`;
    results.forEach(gene => {
        const domains = Array.isArray(gene.domain_descriptions) ? gene.domain_descriptions.join(', ') : 'None';
        html += `<div style="border-bottom: 1px solid #eee; padding: 10px 0; margin-bottom: 10px;"><strong>${gene.gene}</strong><ul><li>Domains: ${domains}</li></ul></div>`;
    });
    return html + '</div>';
}

function formatComplexResults(gene, title) {
    if (!gene) return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">Gene not found in the dataset.</p></div>`;
    let html = `<div class="result-card"><h3>${title}</h3>`;
    if (gene.complex_names && gene.complex_names.length > 0) {
        html += '<h4>Complex Names:</h4><ul>';
        gene.complex_names.forEach(name => { html += `<li>${name}</li>`; });
        html += '</ul>';
    } else {
        html += '<p>No complex names listed for this gene.</p>';
    }
    if (gene.complex_components && gene.complex_components.length > 0) {
        html += `<br><h4>Complex Components:</h4><p>${gene.complex_components.join(', ')}</p>`;
    } else {
        html += '<p>No complex components listed for this gene.</p>';
    }
    return html + '</div>';
}


const normalizeQuery = (query) => {
  const q = query.toLowerCase().trim();

  const mappings = [
    { pattern: /(what does|tell me what|describe).+?(\b[A-Z0-9\-]+\b)/i, intent: "gene_function" },
    { pattern: /(where|which tissues).+express(ed)?/i, intent: "gene_expression" },
    { pattern: /(disease|illness|syndrome|linked|associated).+?(\b[A-Z0-9\-]+\b)/i, intent: "ciliopathy_links" },
    { pattern: /(domain|motif|repeat|region).+?(\b[A-Z0-9\-]+\b)/i, intent: "protein_domains" },
    { pattern: /(phylogeny|evolution|ortholog)/i, intent: "phylogeny" },
    { pattern: /(show|list).+(ciliary|cilia-related|cilia genes)/i, intent: "ciliary_gene_list" },
    { pattern: /(localization|where is|compartment|complex|interact)/i, intent: "localization_complex" },
  ];

  for (const map of mappings) {
    if (map.pattern.test(q)) return map.intent;
  }

  return "unknown";
};

// --- Autocomplete Logic (Enhanced for Natural Queries + CiliaHub Integration) ---
function setupAiQueryAutocomplete() {
    const aiQueryInput = document.getElementById('aiQueryInput');
    const suggestionsContainer = document.getElementById('aiQuerySuggestions');
    if (!aiQueryInput || !suggestionsContainer) return;

    // --- Expanded Example Groups (linked to actual CiliaHub datasets) ---
    const groupedExamples = {
        function: [
            "what does ARL13B do",
            "function of IFT88",
            "role of CEP290",
            "describe KIF3A function",
            "how does ARL6 work"
        ],
        expression: [
            "where is BBS1 expressed",
            "expression of TMEM67",
            "which tissues express ARL13B",
            "tissue pattern of IFT81"
        ],
        domains: [
            "protein domains in CEP290",
            "what domains are in OSM-3",
            "motifs in ARL13B",
            "show repeats in IFT140"
        ],
        diseases: [
            "diseases linked to ARL6",
            "conditions related to BBS10",
            "syndromes caused by OFD1",
            "is TMEM231 linked to a ciliopathy"
        ],
        phylogeny: [
            "phylogeny of ARL13B",
            "evolution of RPGRIP1L",
            "orthologs of TMEM231",
            "species conservation of OSM-3"
        ],
        ciliome: [
            "show human ciliary genes",
            "list ciliome genes",
            "cilia-related genes in human",
            "which genes form the ciliome"
        ],
        interaction: [
            "interaction network of BBS4",
            "interactors of ARL13B",
            "binding partners of IFT172",
            "which proteins interact with CEP164"
        ],
        localization: [
            "where is IFT88 localized",
            "subcellular localization of ARL13B",
            "cilia compartment of BBS4",
            "in which complex is IFT172 found"
        ]
    };

    const allExamples = Object.values(groupedExamples).flat();

    // --- Autocomplete Input Logic ---
    aiQueryInput.addEventListener('input', () => {
        const text = aiQueryInput.value.toLowerCase().trim();
        if (text.length < 2) {
            suggestionsContainer.style.display = 'none';
            return;
        }

        // Fuzzy match logic: match any substring or partial phrase
        const filtered = allExamples.filter(q => q.toLowerCase().includes(text)).slice(0, 6);

        if (filtered.length > 0) {
            suggestionsContainer.innerHTML = filtered
                .map(q => `<div class="suggestion-item">${q}</div>`)
                .join('');
            suggestionsContainer.style.display = 'block';
        } else {
            // If no matches, suggest closest example or hint
            const didYouMean = findClosestExample(text, allExamples);
            if (didYouMean) {
                suggestionsContainer.innerHTML = `<div class="suggestion-item">Did you mean "<b>${didYouMean}</b>"?</div>`;
                suggestionsContainer.style.display = 'block';
            } else {
                suggestionsContainer.style.display = 'none';
            }
        }
    });

    // --- Click Behavior ---
    suggestionsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-item')) {
            const selected = e.target.textContent.replace(/Did you mean "|"\?/g, '');
            aiQueryInput.value = selected;
            suggestionsContainer.style.display = 'none';
            aiQueryInput.focus();
            handleAIQuery(); // trigger main handler
        }
    });

    // --- Hide on Outside Click ---
    document.addEventListener('click', (e) => {
        if (!aiQueryInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });

    // --- Simple "Did You Mean" Helper ---
    function findClosestExample(query, examples) {
        const distance = (a, b) => {
            const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
            for (let i = 0; i <= a.length; i++) dp[i][0] = i;
            for (let j = 0; j <= b.length; j++) dp[0][j] = j;
            for (let i = 1; i <= a.length; i++) {
                for (let j = 1; j <= b.length; j++) {
                    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                    dp[i][j] = Math.min(
                        dp[i - 1][j] + 1,
                        dp[i][j - 1] + 1,
                        dp[i - 1][j - 1] + cost
                    );
                }
            }
            return dp[a.length][b.length];
        };

        let best = null;
        let minDist = Infinity;
        for (const ex of examples) {
            const d = distance(query, ex.toLowerCase());
            if (d < minDist) {
                minDist = d;
                best = ex;
            }
        }
        return minDist <= 6 ? best : null; // only suggest if reasonably close
    }
}



// --- Gene Analysis Engine & UI (largely unchanged) ---

function setupAutocomplete() {
    const geneInput = document.getElementById('geneInput');
    const suggestionsContainer = document.getElementById('geneSuggestions');
    if (!geneInput || !suggestionsContainer) return;

    geneInput.addEventListener('input', async () => {
        if (!ciliaHubDataCache) await fetchCiliaData();
        if (!ciliaHubDataCache) return;
        const fullText = geneInput.value;
        const currentTerm = fullText.split(/[\s,]+/).pop().trim().toUpperCase();
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
            const lastChar = geneInput.value.trim().slice(-1);
            if (lastChar && lastChar !== ',') {
                terms.pop();
            }
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
    const analyzeBtn = document.getElementById('analyzeBtn');
    const aiQueryBtn = document.getElementById('aiQueryBtn');
    const visualizeBtn = document.getElementById('visualizeBtn');
    const geneInput = document.getElementById('geneInput');
    const aiQueryInput = document.getElementById('aiQueryInput');

    if (!analyzeBtn || !aiQueryBtn || !visualizeBtn || !geneInput || !aiQueryInput) {
        console.warn('One or more CiliAI elements were not found.');
        return;
    }

    analyzeBtn.addEventListener('click', analyzeGenesFromInput);
    aiQueryBtn.addEventListener('click', handleAIQuery);

    // This is the corrected event listener for the main "Visualize Results" button
    visualizeBtn.addEventListener('click', async () => {
        const genes = geneInput.value.split(/[\s,]+/).map(g => g.trim().toUpperCase()).filter(Boolean);
        if (genes.length > 0) {
            const mode = document.querySelector('input[name="mode"]:checked').value;
            // Logic to show the correct heatmap based on the analysis mode
            if (mode === 'expert' || mode === 'hybrid') {
                document.getElementById('plot-display-area').innerHTML = `<p class="status-searching">Building screen results heatmap...</p>`;
                const screenData = await fetchScreenData();
                renderScreenSummaryHeatmap(genes, screenData);
            } else { // 'nlp' mode
                document.getElementById('plot-display-area').innerHTML = `<p class="status-searching">Building phylogeny heatmap...</p>`;
                await renderPhylogenyHeatmap(genes);
            }
        }
    });

    geneInput.addEventListener('keydown', debounce((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            analyzeGenesFromInput();
        }
    }, 300));

    aiQueryInput.addEventListener('keydown', debounce((e) => {
        if (e.key === 'Enter') {
            handleAIQuery();
        }
    }, 300));
    
    setupAutocomplete();
    setupAiQueryAutocomplete();
}

/**
 * Main handler when a gene (or list of genes) is selected in CiliAI
 * Generates both heatmap and suggested questions dynamically
 * @param {Array<string>} genes - Array of gene symbols
 */
// ===============================================
// Handle CiliAI gene selection + question generation
// ===============================================
async function handleCiliAISelection(genes) {
    const plotArea = document.getElementById('plot-display-area');
    const askPanel = document.getElementById('ciliAI-ask-panel');

    if (!Array.isArray(genes) || genes.length === 0) {
        if (plotArea) plotArea.innerHTML = '<p class="status-not-found">No gene selected.</p>';
        if (askPanel) askPanel.innerHTML = '';
        return;
    }

    // 1️⃣ Build expression heatmap
    if (plotArea) plotArea.innerHTML = `<p class="status-searching">Building expression heatmap for ${genes.join(', ')}...</p>`;
    await displayCiliAIExpressionHeatmap(genes);

    // 2️⃣ Generate suggested questions dynamically
    const base = genes[0];
    const questions = [
        `What is the function of ${base}?`,
        `Describe the role of ${base}`,
        `Show expression of ${base}`,
        `Where is ${base} expressed?`,
        `In which tissues is ${base} expressed?`,
        `Is ${base} a ciliary gene?`,
        `Show protein domains of ${base}`,
        `List diseases linked to ${base}`,
        `What diseases are associated with ${base}?`,
        `Show localization of ${base}`,
        `Which organ systems express ${base}?`,
        `What is the phylogeny of ${base}?`,
        `Evolutionary conservation of ${base}`,
        `What are the interacting partners of ${base}?`,
        `Show all known info about ${base}`
    ];

    // 3️⃣ Render questions in panel
    if (askPanel) {
        askPanel.innerHTML = `
            <h4>💡 Suggested CiliAI Questions for ${base}</h4>
            <ul class="ciliAI-question-list" style="padding-left:0; list-style:none;">
                ${questions.map(q => `<li class="ciliAI-question-item" style="cursor:pointer; color:#0077cc; margin-bottom:4px;">${q}</li>`).join('')}
            </ul>
        `;
    }
}


// --- Your Original `analyzeGenesFromInput` function ---
function analyzeGenesFromInput() { 
    const geneInput = document.getElementById('geneInput');
    if (!geneInput) return;
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsSection = document.getElementById('resultsSection');
    resultsSection.style.display = 'block';
    resultsContainer.innerHTML = ''; // Clear previous results

    const genes = geneInput.value.split(/[\s,]+/).map(g => g.trim().toUpperCase()).filter(Boolean);
    if (genes.length === 0) {
        resultsContainer.innerHTML = '<p class="status-not-found">Please enter at least one gene symbol to analyze.</p>';
        return;
    }
    
    [...new Set(genes)].forEach(geneSymbol => {
        const geneData = ciliaHubDataCache.find(g => g.gene === geneSymbol);
        if (geneData) {
            resultsContainer.innerHTML += renderFullGeneCard(geneData);
        } else {
            resultsContainer.innerHTML += `<div class="result-card"><h3>${geneSymbol}</h3><p class="status-not-found">Gene not found in the database.</p></div>`;
        }
    });
}

// New function to render the full card for the "Analyze" section
function renderFullGeneCard(geneData) {
    const domains = geneData.domain_descriptions.length > 0 ? geneData.domain_descriptions.join(', ') : 'Not available';
    const complexes = geneData.complex_names.length > 0 ? geneData.complex_names.join('; ') : 'Not available';
    const ciliopathies = geneData.ciliopathy || 'Not available';

    return `
        <div class="result-card">
            <h3>${geneData.gene}</h3>
            <p><strong>Description:</strong> ${geneData.description}</p>
            
            <h4>Functional Summary:</h4>
            <p>${geneData.functional_summary}</p>

            <h4>Localization:</h4>
            <p>${geneData.localization}</p>

            <h4>Domains / Repeats:</h4>
            <p>${domains}</p>

            <h4>Associated Ciliopathies:</h4>
            <p>${ciliopathies}</p>

            <h4>Protein Complexes:</h4>
            <p>${complexes}</p>
        </div>
    `;
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
            await fetchScreenData();
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
        const finalHtml = createResultCard(gene, dbData, allEvidence);
        if (resultCard) resultCard.outerHTML = finalHtml;
    }

    analyzeBtn.disabled = false;
    analyzeBtn.textContent = '🔍 Analyze Genes';
    if (geneList.length > 0) visualizeBtn.style.display = 'block';
}

/**
 * Renders an expression heatmap directly within a specified container.
 * This function is now the primary method for displaying expression via the "Ask" feature.
 * @param {Array<string>} genes - Array of gene symbols to plot.
 * @param {HTMLElement} container - The DOM element where the plot will be rendered.
 */
async function displayCiliAIExpressionHeatmap(genes, container) {
    if (!container) {
        console.error("Heatmap container not found.");
        return;
    }
    container.innerHTML = ''; // Clear previous content

    try {
        const tissueData = await fetchTissueData();
        if (!tissueData || Object.keys(tissueData).length === 0) {
            throw new Error("No tissue expression data could be loaded.");
        }

        const validGenes = genes.filter(g => tissueData[g.toUpperCase()]);
        if (validGenes.length === 0) {
             container.innerHTML = `<div class="result-card"><p class="status-not-found">No expression data found for ${genes.join(', ')} in the database.</p></div>`;
             return;
        }

        const tissueSet = new Set();
        validGenes.forEach(g => {
            Object.keys(tissueData[g.toUpperCase()]).forEach(t => tissueSet.add(t));
        });

        const tissueList = Array.from(tissueSet).sort();
        if (tissueList.length === 0) {
            throw new Error(`No valid tissues found for ${validGenes.join(', ')}.`);
        }

        const matrix = validGenes.map(g =>
            tissueList.map(t => tissueData[g.toUpperCase()]?.[t] || 0)
        );

        const trace = {
            z: matrix,
            x: tissueList,
            y: validGenes,
            type: 'heatmap',
            colorscale: 'Viridis',
            colorbar: { title: 'nTPM', tickformat: '.1f' },
            hovertemplate: '<b>Gene:</b> %{y}<br><b>Tissue:</b> %{x}<br><b>nTPM:</b> %{z:.2f}<extra></extra>'
        };

        const layout = {
            title: validGenes.length > 1 ? `Comparative Gene Expression (nTPM)` : `Expression Profile of ${validGenes[0]}`,
            xaxis: { tickangle: -45, automargin: true },
            yaxis: { automargin: true },
            margin: { l: 100, r: 20, b: 150, t: 60 },
            paper_bgcolor: '#ffffff',
            plot_bgcolor: '#ffffff'
        };

        Plotly.newPlot(container, [trace], layout, { responsive: true });

    } catch (err) {
        console.error('❌ Heatmap rendering failed:', err);
        container.innerHTML = `<div class="result-card"><p class="status-not-found">❌ Failed to render expression heatmap: ${err.message}</p></div>`;
    }
}

function renderScreenDataTable(gene, screenInfo) {
    if (!screenInfo || typeof screenInfo !== 'object') return '<p class="status-not-found">No structured screen data available.</p>';
    
    let screensObj = {};
    if (Array.isArray(screenInfo)) {
        screensObj = screenInfo.reduce((acc, entry) => {
            if (entry.source && entry.result) {
                acc[entry.source] = {
                    hit: entry.result.toLowerCase() !== 'no effect', 
                    effect: entry.result,
                    details: 'From raw data' 
                };
            }
            return acc;
        }, {});
    } else if (screenInfo.screens) {
        screensObj = screenInfo.screens;
    }

    const screenKeys = Object.keys(screensObj);
    const hitCount = screenKeys.filter(key => screensObj[key]?.hit).length;

    const screenNames = {
        'Kim2016': 'Kim et al. (2016) IMCD3 RNAi',
        'Wheway2015': 'Wheway et al. (2015) RPE1 RNAi',
        'Roosing2015': 'Roosing et al. (2015) hTERT-RPE1',
        'Basu2023': 'Basu et al. (2023) MDCK CRISPR',
        'Breslow2018': 'Breslow et al. (2018) Hedgehog Signaling'
    };

    const summary = `<p class="screen-summary">According to ${hitCount} out of ${screenKeys.length} ciliary screens, <strong>${gene}</strong> was found to impact cilia.</p>`;

    const tableHtml = `
        <table class="expression-table">
            <thead><tr><th>Screen</th><th>Hit?</th><th>Effect</th><th>Details</th></tr></thead>
            <tbody>
                ${screenKeys.map(key => {
                    const d = screensObj[key] || { hit: false, effect: 'N/A', details: 'Not tested' };
                    const name = screenNames[key] || key;
                    return `<tr><td>${name}</td><td>${d.hit ? '✅' : '❌'}</td><td>${d.effect}</td><td>${d.details}</td></tr>`;
                }).join('')}
            </tbody>
        </table>`;
    return summary + tableHtml;
}

function createPlaceholderCard(gene, mode) {
    let statusText = 'Searching...';
    if (mode === 'nlp') statusText = 'Searching live literature...';
    if (mode === 'hybrid') statusText = 'Searching databases & literature...';
    return `<div class="result-card" id="card-${gene}"><h3>${gene} - <span class="status-searching">${statusText}</span></h3></div>`;
}

function createResultCard(gene, dbData, allEvidence) {
    let statusText = allEvidence.length > 0 ? 'Evidence Found' : 'No Data Found';
    let statusClass = allEvidence.length > 0 ? 'status-found' : 'status-not-found';
    
    let summaryHtml = '';
    if (dbData && dbData.summary) {
        summaryHtml = `
            <div class="prediction-grid">
                <div class="prediction-box"><h4>Cilia Length (on loss)</h4><p>${dbData.summary.lof_length}</p></div>
                <div class="prediction-box"><h4>% Ciliated Cells (on loss)</h4><p>${dbData.summary.percentage_ciliated}</p></div>
            </div>`;
    } else {
        summaryHtml = '<p>No summary prediction available. Review evidence for insights.</p>';
    }

    let evidenceHtml = '';
    if (allEvidence.length > 0) {
        const screenEv = allEvidence.find(ev => ev.source === 'screen_data');
        const otherEvidence = allEvidence.filter(ev => ev.source !== 'screen_data');
        evidenceHtml = `<div class="evidence-section" style="margin-top:1rem;">`;
        if (screenEv) {
            evidenceHtml += `<h4>Ciliary Screen Data</h4>${screenEv.context}`;
        }
        if (otherEvidence.length > 0) {
            const evidenceSnippets = otherEvidence.map(ev => `
                <div style="border-bottom:1px solid #eee; padding-bottom:0.5rem; margin-bottom:0.5rem;">
                    <p>${ev.context.replace(new RegExp(`(${gene})`, 'ig'), `<mark>$1</mark>`)}</p>
                    <small><strong>Source:</strong> ${ev.source.toUpperCase()} (${ev.id})</small>
                </div>`).join('');
            evidenceHtml += `<details style="margin-top:1rem;"><summary>Show Literature Evidence (${otherEvidence.length})</summary>${evidenceSnippets}</details>`;
        }
        evidenceHtml += `</div>`;
    }

    return `
        <div class="result-card">
            <h3>${gene} - <span class="${statusClass}">${statusText}</span></h3>
            ${summaryHtml}
            ${evidenceHtml}
        </div>`;
}


async function getGenesByPhylogeny(query) {
    await fetchPhylogenyData();
    const phy = phylogenyDataCache || {};
    const q = normalizeTerm(query || '');

    if (q.includes('in all') || q.includes('all organisms') || q.includes('present in all')) {
        const genes = Object.entries(phy).filter(([, v]) => v.category === 'in_all_organisms').map(([g]) => g);
        return { label: 'Present in all organisms', genes: genes.sort() };
    }

    if (q.includes('non') && (q.includes('cili') || q.includes('ciliary') || q.includes('non-ciliary') || q.includes('non ciliary'))) {
        const genes = Object.entries(phy).filter(([, v]) => v.category === 'nonciliary_only').map(([g]) => g);
        return { label: 'Non-ciliary-only genes', genes: genes.sort() };
    }

    if (q.includes('ciliated-only') || q.includes('ciliary-only') || q.includes('only ciliated') || (q.includes('only') && q.includes('ciliated'))) {
        const genes = Object.entries(phy).filter(([, v]) => v.category === 'ciliary_only').map(([g]) => g);
        return { label: 'Ciliary-only genes', genes: genes.sort() };
    }

    if (q.includes('present in both') || q.includes('both') || q.includes('present-in-both') || q.includes('present in ciliated and non')) {
        const genes = Object.entries(phy).filter(([, v]) => v.category === 'present_in_both' || v.category === 'present-in-both' || v.category === 'presentinboth').map(([g]) => g);
        return { label: 'Present in both ciliated and non-ciliated organisms', genes: genes.sort() };
    }

    return { label: 'No phylogeny group matched', genes: [] };
}
function normalizeTerm(s) {
    if (!s) return '';
    return String(s).toLowerCase().replace(/[_\-\s]+/g, ' ').trim();
}


async function renderPhylogenyHeatmap(genes) {
    const phylogeny = await fetchPhylogenyData();
    if (!phylogeny || Object.keys(phylogeny).length === 0) {
        console.error('No phylogeny data available');
        return;
    }

    const organisms = new Set();
    genes.forEach(g => {
        const gData = phylogeny[g];
        if (gData && gData.presence) {
            Object.keys(gData.presence).forEach(org => organisms.add(org));
        }
    });

    const orgList = Array.from(organisms);
    const matrix = genes.map(g => orgList.map(org => phylogeny[g]?.presence?.[org] ? 1 : 0));

    const trace = {
        z: matrix,
        x: orgList,
        y: genes,
        type: 'heatmap',
        colorscale: [
            [0, '#f8f9fa'],
            [1, '#2c5aa0']
        ],
        showscale: false
    };

    const layout = {
        title: 'Phylogeny Heatmap',
        xaxis: { title: 'Organisms', tickangle: -45 },
        yaxis: { title: 'Genes' },
        margin: { t: 40, l: 100, r: 20, b: 100 },
        height: Math.max(300, genes.length * 20)
    };

    Plotly.newPlot('plot-display-area', [trace], layout);
}

function handleExpressionSearchInput(e) {
    let query = e.target.value.trim().toUpperCase();
    if (!/^[A-Za-z0-9-]+$/.test(query)) {
        console.warn(`Invalid gene query format: ${query}`);
        return;
    }
    if (query.length < 2) {
        hideExpressionSuggestions();
        return;
    }
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const suggestions = getExpressionGeneSuggestions(query);
        showExpressionSuggestions(suggestions);
    }, 150);
}

async function analyzeGeneViaAPI(gene, resultCard) {
    const ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
    const ELINK_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi";
    const EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
    const EUROPE_PMC_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";

    const API_QUERY_KEYWORDS = ["cilia", "ciliary", "ciliogenesis", "intraflagellar transport", "ciliopathy"];
    const LOCAL_ANALYSIS_KEYWORDS = new Set([
        'cilia','ciliary','cilium','axoneme','basal body','transition zone',
        'ciliogenesis','ift','shorter','longer','fewer','loss of','absent',
        'reduced','increased','motility'
    ]);

    const geneRegex = new RegExp(`\\b${gene}(?:[-_ ]?\\w{0,3})?\\b`, 'i');
    const sentSplitRegex = /(?<=[.!?])\s+/;
    let foundEvidence = [];

    const MAX_ARTICLES = 15;
    const MAX_EVIDENCE = 5;
    const RATE_LIMIT_DELAY = 350;

    try {
        const epmcQuery = `${gene} AND (${API_QUERY_KEYWORDS.join(" OR ")}) AND (OPEN_ACCESS:Y OR FULL_TEXT:Y)`;
        const epmcResp = await fetch(
            `${EUROPE_PMC_URL}?query=${encodeURIComponent(epmcQuery)}&resultType=core&format=json&pageSize=40`
        );

        if (epmcResp.ok) {
            const epmcData = await epmcResp.json();
            const epmcResults = epmcData.resultList?.result || [];

            for (const r of epmcResults) {
                if (foundEvidence.length >= MAX_EVIDENCE) break;

                const textContent = [
                    r.title || '',
                    r.abstractText || '',
                    r.fullText || ''
                ].join('. ');

                if (!textContent || !geneRegex.test(textContent)) continue;

                const sentences = textContent.split(sentSplitRegex);
                for (const sent of sentences) {
                    if (foundEvidence.length >= MAX_EVIDENCE) break;
                    const sentLower = sent.toLowerCase();
                    if (geneRegex.test(sent) && [...LOCAL_ANALYSIS_KEYWORDS].some(kw => sentLower.includes(kw))) {
                        foundEvidence.push({
                            id: r.id || r.pmid || 'EPMC',
                            source: r.source || 'EuropePMC',
                            context: sent.trim()
                        });
                    }
                }
            }
        }

        if (foundEvidence.length >= MAX_EVIDENCE) return foundEvidence;

        const kwClause = API_QUERY_KEYWORDS.map(k => `"${k}"[Title/Abstract]`).join(" OR ");
        const query = `("${gene}"[Title/Abstract]) AND (${kwClause})`;
        const searchParams = new URLSearchParams({ db: 'pubmed', term: query, retmode: 'json', retmax: '25' });
        const searchResp = await fetch(`${ESEARCH_URL}?${searchParams}`);
        if (!searchResp.ok) throw new Error(`NCBI ESearch failed: ${searchResp.statusText}`);

        const searchData = await searchResp.json();
        const pmids = searchData.esearchresult?.idlist.slice(0, MAX_ARTICLES) || [];
        if (pmids.length === 0) return foundEvidence;

        const linkParams = new URLSearchParams({ dbfrom: 'pubmed', db: 'pmc', id: pmids.join(','), retmode: 'json' });
        const [linkResp, pubmedFetch] = await Promise.all([
            fetch(`${ELINK_URL}?${linkParams}`),
            fetch(`${EFETCH_URL}?db=pubmed&id=${pmids.join(',')}&retmode=xml&rettype=abstract`)
        ]);

        const linkData = linkResp.ok ? await linkResp.json() : {};
        const pmcIds = [];
        const linkSets = linkData.linksets || [];
        for (const linkSet of linkSets) {
            const links = linkSet.linksetdbs?.find(set => set.dbto === 'pmc')?.links || [];
            pmcIds.push(...links);
        }

        let pmcArticles = [];
        if (pmcIds.length > 0) {
            await sleep(RATE_LIMIT_DELAY);
            const fetchParams = new URLSearchParams({ db: 'pmc', id: pmcIds.join(','), retmode: 'xml', rettype: 'full' });
            const fetchResp = await fetch(`${EFETCH_URL}?${fetchParams}`);
            if (fetchResp.ok) {
                const xmlText = await fetchResp.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "application/xml");
                pmcArticles = Array.from(xmlDoc.getElementsByTagName('article'));
            }
        }

        const pubmedArticles = (() => {
            if (!pubmedFetch.ok) return [];
            return pubmedFetch.text().then(xmlText => {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "application/xml");
                return Array.from(xmlDoc.getElementsByTagName('PubmedArticle'));
            });
        })();

        const [pubmedParsed, pmcParsed] = await Promise.all([pubmedArticles, pmcArticles]);
        const allArticles = [...pmcParsed, ...pubmedParsed];

        for (const article of allArticles) {
            if (foundEvidence.length >= MAX_EVIDENCE) break;

            let pmid, textContent;
            if (article.tagName.toLowerCase() === 'article') {
                pmid = article.querySelector('article-id[pub-id-type="pmid"]')?.textContent || 'PMC Article';
                const title = article.querySelector('article-title')?.textContent || '';
                const body = Array.from(article.querySelectorAll('body p, body sec, body para'))
                    .map(el => el.textContent).join(' ');
                textContent = `${title}. ${body}`;
            } else {
                pmid = article.querySelector('MedlineCitation > PMID')?.textContent || 'PubMed Article';
                const title = article.querySelector('ArticleTitle')?.textContent || '';
                const abstractText = Array.from(article.querySelectorAll('AbstractText'))
                    .map(el => el.textContent).join(' ');
                textContent = `${title}. ${abstractText}`;
            }

            if (!textContent || !geneRegex.test(textContent)) continue;

            const sentences = textContent.split(sentSplitRegex);
            for (const sent of sentences) {
                if (foundEvidence.length >= MAX_EVIDENCE) break;
                const sentLower = sent.toLowerCase();
                if (geneRegex.test(sent) && [...LOCAL_ANALYSIS_KEYWORDS].some(kw => sentLower.includes(kw))) {
                    foundEvidence.push({ id: pmid, source: 'PubMed', context: sent.trim() });
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

function renderScreenSummaryHeatmap(genes, screenData) {
    if (!window.Plotly) {
        console.error('Plotly is not loaded.');
        document.getElementById('plot-display-area').innerHTML = '<p class="status-not-found">Error: Plotly library failed to load.</p>';
        return;
    }

    const plotArea = document.getElementById('plot-display-area');
    if (!plotArea) return;

    const numberScreens = { 'Kim et al. (2016) IMCD3 RNAi': 'Kim2016', 'Wheway et al. (2015) RPE1 RNAi': 'Wheway2015', 'Roosing et al. (2015) hTERT-RPE1': 'Roosing2015', 'Basu et al. (2023) MDCK CRISPR': 'Basu2023' };
    const signalingScreens = { 'Breslow et al. (2018) Hedgehog Signaling': 'Breslow2018' };
    const numberScreenOrder = Object.keys(numberScreens);
    const signalingScreenOrder = Object.keys(signalingScreens);

    const numberCategoryMap = { "Decreased cilia numbers": { v: 1, c: '#0571b0' }, "Increased cilia numbers": { v: 2, c: '#ca0020' }, "Causes Supernumerary Cilia": { v: 3, c: '#fdae61' }, "No effect": { v: 4, c: '#fee090' }, "Not in Screen": { v: 5, c: '#bdbdbd' }, "Not Reported": { v: 6, c: '#636363' } };
    const signalingCategoryMap = { "Decreased Signaling (Positive Regulator)": { v: 1, c: '#2166ac' }, "Increased Signaling (Negative Regulator)": { v: 2, c: '#d73027' }, "No Significant Effect": { v: 3, c: '#fdae61' }, "Not in Screen": { v: 4, c: '#bdbdbd' }, "Not Reported": { v: 5, c: '#636363' } };

    const geneLabels = genes.map(g => g.toUpperCase());
    const zDataNumber = [], textDataNumber = [], zDataSignaling = [], textDataSignaling = [];

    genes.forEach(gene => {
        const numberRowValues = [], numberRowText = [], signalingRowValues = [], signalingRowText = [];
        numberScreenOrder.forEach(screenName => {
            const screenKey = numberScreens[screenName];
            let resultText = "Not in Screen";
            if (screenData[gene]?.screens?.[screenKey]) {
                resultText = screenData[gene].screens[screenKey].result || "Not Reported";
            }
            const mapping = numberCategoryMap[resultText] || numberCategoryMap["Not in Screen"];
            numberRowValues.push(mapping.v);
            numberRowText.push(resultText);
        });
        signalingScreenOrder.forEach(screenName => {
            const screenKey = signalingScreens[screenName];
            let resultText = "Not in Screen";
            if (screenData[gene]?.screens?.[screenKey]) {
                resultText = screenData[gene].screens[screenKey].result || "Not Reported";
            }
            const mapping = signalingCategoryMap[resultText] || signalingCategoryMap["Not in Screen"];
            signalingRowValues.push(mapping.v);
            signalingRowText.push(resultText);
        });
        zDataNumber.push(numberRowValues);
        textDataNumber.push(numberRowText);
        zDataSignaling.push(signalingRowValues);
        textDataSignaling.push(signalingRowText);
    });

    const trace1 = { x: numberScreenOrder, y: geneLabels, z: zDataNumber, customdata: textDataNumber, type: 'heatmap', colorscale: [[0, '#0571b0'], [0.2, '#ca0020'], [0.4, '#fdae61'], [0.6, '#fee090'], [0.8, '#636363'], [1.0, '#bdbdbd']], showscale: false, hovertemplate: '<b>Gene:</b> %{y}<br><b>Screen:</b> %{x}<br><b>Result:</b> %{customdata}<extra></extra>', xgap: 1, ygap: 1 };
    const trace2 = { x: signalingScreenOrder, y: geneLabels, z: zDataSignaling, customdata: textDataSignaling, type: 'heatmap', colorscale: [[0, '#2166ac'], [0.25, '#d73027'], [0.5, '#fdae61'], [0.75, '#636363'], [1.0, '#bdbdbd']], showscale: false, hovertemplate: '<b>Gene:</b> %{y}<br><b>Screen:</b> %{x}<br><b>Result:</b> %{customdata}<extra></extra>', xaxis: 'x2', yaxis: 'y1', xgap: 1, ygap: 1 };
    
    const layout = {
        title: { text: 'Summary of Ciliary Screen Results', font: { size: 16, family: 'Arial', color: '#2c5aa0' } },
        grid: { rows: 1, columns: 2, pattern: 'independent' },
        xaxis: { domain: [0, 0.78], tickangle: -45, automargin: true },
        xaxis2: { domain: [0.8, 1.0], tickangle: -45, automargin: true },
        yaxis: { automargin: true, tickfont: { size: 10 } },
        margin: { l: 120, r: 220, b: 150, t: 80 },
        height: 400 + (geneLabels.length * 30),
        annotations: []
    };
    
    let current_y = 1.0;
    layout.annotations.push({ xref: 'paper', yref: 'paper', x: 1.02, y: current_y + 0.05, xanchor: 'left', text: '<b>Cilia Number/Structure</b>', showarrow: false, font: { size: 13 } });
    Object.entries(numberCategoryMap).forEach(([key, val]) => { layout.annotations.push({ xref: 'paper', yref: 'paper', x: 1.02, y: current_y, xanchor: 'left', yanchor: 'middle', text: `█ ${key}`, font: { color: val.c, size: 12 }, showarrow: false }); current_y -= 0.06; });
    current_y -= 0.1;
    layout.annotations.push({ xref: 'paper', yref: 'paper', x: 1.02, y: current_y + 0.05, xanchor: 'left', text: '<b>Hedgehog Signaling</b>', showarrow: false, font: { size: 13 } });
    Object.entries(signalingCategoryMap).forEach(([key, val]) => { if (key !== "Not in Screen" && key !== "Not Reported") { layout.annotations.push({ xref: 'paper', yref: 'paper', x: 1.02, y: current_y, xanchor: 'left', yanchor: 'middle', text: `█ ${key}`, font: { color: val.c, size: 12 }, showarrow: false }); current_y -= 0.06; } });

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
// Expose globally so other scripts can call them
window.displayCiliAIExpressionHeatmap = displayCiliAIExpressionHeatmap;
window.handleCiliAISelection = handleCiliAISelection;
