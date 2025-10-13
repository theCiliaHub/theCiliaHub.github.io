// --- Global Data Cache ---
let ciliaHubDataCache = null;
let screenDataCache = null;
let phylogenyDataCache = null;
// Note: tissueDataCache is attached to the window object in its function

// --- Fallback Data ---
const FALLBACK_CILIOPATHY_GENES = [
    { gene: 'BBS10', ciliopathy: 'Bardet–Biedl Syndrome', description: 'Bardet-Biedl syndrome 10, chaperonin-like protein.' },
    { gene: 'NPHP1', ciliopathy: 'Nephronophthisis', description: 'Nephronophthisis 1, involved in ciliary function.' },
    { gene: 'AHI1', ciliopathy: 'Joubert Syndrome', description: 'Abelson helper integration site 1.' },
    { gene: 'CEP290', ciliopathy: 'Joubert Syndrome, Bardet–Biedl Syndrome', description: 'Centrosomal protein 290.' },
    { gene: 'IFT88', ciliopathy: 'Polycystic Kidney Disease', description: 'Intraflagellar transport 88.' }
];

const CILI_AI_DB = {
    "HDAC6": { "summary": { "lof_length": "Promotes / Maintains", "percentage_ciliated": "No effect", "source": "Expert DB" }, "evidence": [{ "id": "21873644", "source": "pubmed", "context": "...loss of HDAC6 results in hyperacetylation of tubulin and leads to the formation of longer, more stable primary cilia in renal epithelial cells." }] },
    "IFT88": { "summary": { "lof_length": "Inhibits / Restricts", "percentage_ciliated": "Reduced cilia numbers", "source": "Expert DB" }, "evidence": [{ "id": "10882118", "source": "pubmed", "context": "Mutations in IFT88 (polaris) disrupt intraflagellar transport, leading to a failure in cilia assembly and resulting in severely shortened or absent cilia." }] },
    "ARL13B": { "summary": { "lof_length": "Inhibits / Restricts", "percentage_ciliated": "Reduced cilia numbers", "source": "Expert DB" }, "evidence": [{ "id": "21940428", "source": "pubmed", "context": "The small GTPase ARL13B is critical for ciliary structure; its absence leads to stunted cilia with abnormal morphology and axonemal defects." }] },
    "BBS1": { "summary": { "lof_length": "Inhibits / Restricts", "percentage_ciliated": "Reduced cilia numbers", "source": "Expert DB" }, "evidence": [{ "id": "12118255", "source": "pubmed", "context": "Mutated in Bardet-Biedl syndrome (type 1) OMIM 209901." }] }
};

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
                        <div id="ai-result-area" class="results-section" style="display: none; margin-top: 1.5rem; padding: 1rem;"></div>
                    </div>
                    <div class="example-queries">
                        <p><strong>Try asking:</strong> 
                            <span>"Display genes for Bardet-Biedl Syndrome"</span>, 
                            <span>"Show me basal body genes"</span>,
                            <span>"Effect of ARL13B on cilia length?"</span>,
                            <span>"Tell me about ciliogenesis for BBS1"</span>,
                            <span>"Show me ciliary-only genes"</span>,
                            <span>"List genes found in all organisms"</span>,
                            <span>"Display components of BBSome complex"</span>,
                            <span>"Show WD40 domain containing proteins"</span>,
                            <span>"Display ciliary genes in C. elegans"</span>.
                        </p>
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
                                    <label for="hybrid" title="Best for most users. Combines our fast, expert-curated database, screen data, and real-time AI literature mining.">
                                        <span class="mode-icon">🔬</span>
                                        <div><strong>Hybrid</strong><br><small>Expert DB + Screen Data + Literature</small></div>
                                    </label>
                                </div>
                                <div class="mode-option">
                                    <input type="radio" id="expert" name="mode" value="expert" aria-label="Expert only mode">
                                    <label for="expert" title="Fastest option. Queries only our internal, manually curated database and screen data.">
                                        <span class="mode-icon">🏛️</span>
                                        <div><strong>Expert Only</strong><br><small>Curated database + Screen Data</small></div>
                                    </label>
                                </div>
                                <div class="mode-option">
                                    <input type="radio" id="nlp" name="mode" value="nlp" aria-label="Literature only mode">
                                    <label for="nlp" title="Most current data. Performs a live AI-powered search across PubMed. May be slower.">
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
                .ai-query-section { background-color: #e8f4fd; border: 1px solid #bbdefb; padding: 1.5rem 2rem; border-radius: 8px; margin-bottom: 1rem; }
                .ai-query-section h3 { margin-top: 0; color: #2c5aa0; }
                .ai-input-group { position: relative; display: flex; gap: 10px; }
                .ai-query-input { flex-grow: 1; padding: 0.8rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
                .ai-query-btn { padding: 0.8rem 1.2rem; font-size: 1rem; background-color: #2c5aa0; color: white; border: none; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; }
                .ai-query-btn:hover { background-color: #1e4273; }
                .example-queries { margin-top: 0; margin-bottom: 2rem; font-size: 0.9rem; color: #555; text-align: center; }
                .example-queries span { background-color: #d1e7fd; padding: 3px 8px; border-radius: 4px; font-family: monospace; cursor: pointer; margin: 4px; display: inline-block; line-height: 1.5; }
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
                .visualize-btn[disabled] { background-color: #b8daff; cursor: not-allowed; }
                .visualize-btn:hover:not([disabled]) { background-color: #0056b3; }
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
                .gene-list { column-count: 3; list-style-type: none; padding-left: 0; }
                .gene-list li { margin-bottom: 0.5rem; }
                .ciliopathy-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                .ciliopathy-table th, .ciliopathy-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                .ciliopathy-table th { background-color: #e8f4fd; color: #2c5aa0; }
                .ciliopathy-table tr:nth-child(even) { background-color: #f9f9f9; }
                .gene-detail-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                .gene-detail-table th { background-color: #e8f4fd; color: #2c5aa0; text-align: left; padding: 8px; border: 1px solid #ddd; }
                .gene-detail-table td { padding: 8px; border: 1px solid #ddd; }
                .gene-detail-table tr:nth-child(even) { background-color: #f9f9f9; }
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

// --- Helper Functions ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function debounce(fn, delay) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => fn(...args), delay); }; }
function normalizeTerm(s) {
    if (!s) return '';
    return String(s).toLowerCase().replace(/[_\-\s]+/g, ' ').trim();
}

// --- Data Fetching and Caching ---
async function fetchCiliaData() {
    if (ciliaHubDataCache) return ciliaHubDataCache;
    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/ciliahub_data.json');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();

        const processToArray = (field) => {
            if (typeof field === 'string') return field.split(',').map(item => item.trim()).filter(Boolean);
            if (Array.isArray(field)) return field;
            return [];
        };

        ciliaHubDataCache = data.map(gene => ({
            ...gene,
            functional_category: processToArray(gene.functional_category),
            domain_descriptions: processToArray(gene.domain_descriptions),
            ciliopathy: processToArray(gene.ciliopathy),
            localization: processToArray(gene.localization),
            complex_names: processToArray(gene.complex_names),
            complex_components: processToArray(gene.complex_components)
        }));
        
        console.log('CiliaHub data loaded and formatted successfully.');
        return ciliaHubDataCache;
    } catch (error) {
        console.error("Failed to fetch CiliaHub data:", error);
        ciliaHubDataCache = []; 
        return ciliaHubDataCache;
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
        return screenDataCache;
    } catch (error) {
        console.error('Error fetching screen data:', error);
        screenDataCache = {}; 
        return screenDataCache;
    }
}

async function fetchPhylogenyData() {
    if (phylogenyDataCache) return phylogenyDataCache;
    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/phylogeny_summary.json');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const raw = await response.json();
        const unified = {};

        if (raw.ciliated_only_genes) {
            raw.ciliated_only_genes.filter(gene => typeof gene === 'string').forEach(g => unified[g.trim().toUpperCase()] = { category: 'ciliary_only' });
        }
        if (raw.nonciliary_only_genes) {
            raw.nonciliary_only_genes.filter(gene => typeof gene === 'string').forEach(g => unified[g.trim().toUpperCase()] = { category: 'nonciliary_only' });
        }
        if (raw.in_all_organisms) {
            raw.in_all_organisms.filter(gene => typeof gene === 'string').forEach(g => unified[g.trim().toUpperCase()] = { category: 'in_all_organisms' });
        }
        if (Array.isArray(raw)) {
            raw.forEach(item => {
                const gene = (item.sym || '').trim().toUpperCase();
                const cat = (item.class || '').toLowerCase().replace(/[\s-]+/g, '_');
                if (gene) unified[gene] = { category: cat, species: item.species || [] };
            });
        }
        
        phylogenyDataCache = unified;
        console.log(`Phylogeny data normalized: ${Object.keys(unified).length} entries`);
        return phylogenyDataCache;
    } catch (error) {
        console.error('Failed to fetch phylogeny summary data:', error);
        phylogenyDataCache = {};
        return phylogenyDataCache;
    }
}

async function fetchTissueData() {
    if (window.tissueDataCache) return window.tissueDataCache;
    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/rna_tissue_consensus.tsv');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const tsv = await response.text();
        const lines = tsv.trim().split(/\r?\n/);
        if (lines.length < 2) throw new Error('Empty or invalid TSV file');

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
       window.tissueDataCache = {
           'IFT88': { 'Kidney Cortex': 8.45, 'Kidney Medulla': 12.67 },
           'ARL13B': { 'Brain': 5.2, 'Kidney': 3.1, 'Testis': 9.8 }
       };
       return window.tissueDataCache;
   }
}
window.fetchTissueData = fetchTissueData;


// --- Query Helper Functions ---
async function getGenesByFunctionalCategory(term) {
    console.log("Running the CORRECT getGenesByFunctionalCategory function!");
    await fetchCiliaData();
    if (!ciliaHubDataCache) return [];

    const termLower = normalizeTerm(term);
    const termRegex = new RegExp(termLower.replace(/\s+/g, '[\\s_-]*'), 'i');

    const matchingGenes = ciliaHubDataCache
        .filter(geneData => {
            const functionalMatch = geneData.functional_category.some(fc => normalizeTerm(fc).match(termRegex));
            const localizationMatch = geneData.localization.some(l => normalizeTerm(l).match(termRegex));
            return functionalMatch || localizationMatch;
        })
        .map(geneData => ({ gene: geneData.gene, description: geneData.description }))
        .sort((a, b) => a.gene.localeCompare(b.gene));
    
    console.log(`Found ${matchingGenes.length} genes for term "${termLower}"`);
    return matchingGenes;
}

async function getCiliopathyGenes(disease) {
    await fetchCiliaData();
    if (!ciliaHubDataCache) {
        return { genes: [], description: 'No data available. Failed to load CiliaHub data.' };
    }
    const diseaseLower = normalizeTerm(disease);
    let matchingGenes = [];
    let description = '';

    if (diseaseLower === 'ciliopathy') {
        matchingGenes = ciliaHubDataCache
            .map(gene => ({ gene: gene.gene, description: gene.description }))
            .sort((a, b) => a.gene.localeCompare(b.gene));
        description = `Found ${matchingGenes.length} genes associated with any ciliopathy.`;
    } else {
        const diseaseRegex = new RegExp(diseaseLower.replace(/\s+/g, '[\\s_\\-–]*').replace('syndrome', '(syndrome)?'), 'i');
        matchingGenes = ciliaHubDataCache
            .filter(gene => gene.ciliopathy.some(c => normalizeTerm(c).match(diseaseRegex)))
            .map(gene => ({ gene: gene.gene, description: gene.description }))
            .sort((a, b) => a.gene.localeCompare(b.gene));
        description = `Found ${matchingGenes.length} genes associated with "${disease}".`;
        
        if (matchingGenes.length === 0 && diseaseLower.includes('bardet biedl')) {
            matchingGenes = FALLBACK_CILIOPATHY_GENES
                .filter(gene => gene.ciliopathy.includes('Bardet–Biedl Syndrome'))
                .map(gene => ({ gene: gene.gene, description: gene.description }));
            description = `Found ${matchingGenes.length} genes for Bardet-Biedl Syndrome (fallback).`;
        }
    }
    return { genes: matchingGenes, description };
}

async function getGenesByDomain(terms) {
    await fetchCiliaData();
    if (!ciliaHubDataCache) return [];
    const lowerTerms = terms.map(normalizeTerm);
    return ciliaHubDataCache
        .filter(gene => lowerTerms.every(term => gene.domain_descriptions.some(d => normalizeTerm(d).includes(term))))
        .map(gene => gene.gene)
        .sort();
}

async function getGenesByLocalization(terms) {
    await fetchCiliaData();
    if (!ciliaHubDataCache) return [];
    const lowerTerms = terms.map(normalizeTerm);
    return ciliaHubDataCache
        .filter(gene => lowerTerms.every(term => gene.localization.some(l => normalizeTerm(l).includes(term))))
        .map(gene => gene.gene)
        .sort();
}

async function getGenesByPhylogeny(query) {
    await fetchPhylogenyData();
    const phy = phylogenyDataCache || {};
    const q = normalizeTerm(query || '');

    if (q.includes('in all') || q.includes('all organisms')) {
        return { label: 'Present in all organisms', genes: Object.keys(phy).filter(g => phy[g].category === 'in_all_organisms').sort() };
    }
    if (q.includes('non-ciliary') || q.includes('non ciliary')) {
        return { label: 'Non-ciliary-only genes', genes: Object.keys(phy).filter(g => phy[g].category === 'nonciliary_only').sort() };
    }
    if (q.includes('ciliary only') || q.includes('ciliated only')) {
        return { label: 'Ciliary-only genes', genes: Object.keys(phy).filter(g => phy[g].category === 'ciliary_only').sort() };
    }
    if (q.includes('present in both')) {
        return { label: 'Present in both ciliated and non-ciliated organisms', genes: Object.keys(phy).filter(g => phy[g].category === 'present_in_both').sort() };
    }
    return { label: 'No phylogeny group matched', genes: [] };
}


// --- Main AI Query Handler ---
window.handleAIQuery = async function() {
    const aiQueryInput = document.getElementById('aiQueryInput');
    const resultArea = document.getElementById('ai-result-area');
    const query = aiQueryInput.value.trim();
    if (!query) return;

    resultArea.style.display = 'block';
    resultArea.innerHTML = `<p class="status-searching">CiliAI is thinking...</p>`;
    
    const ciliaHubData = await fetchCiliaData();
    const phylogenyData = await fetchPhylogenyData();
    const screenData = await fetchScreenData();
    const tissueData = await fetchTissueData();

    if (!ciliaHubData || ciliaHubData.length === 0) {
        resultArea.innerHTML = `<p class="status-not-found">Error: Core ciliary gene data could not be loaded.</p>`;
        return;
    }

    let resultHtml = '';
    const qLower = query.toLowerCase();
    let match;

    try {
        // PRIORITY 1: New complex queries
        if ((match = qLower.match(/(?:components of|show|display)\s+(?:the\s+)?(.+?)\s+complex/i))) {
            const complexName = match[1].trim();
            const complexRegex = new RegExp(complexName, 'i');
            const components = ciliaHubData
                .filter(gene => gene.complex_names.some(cn => cn.match(complexRegex)))
                .map(gene => ({ gene: gene.gene, description: `Part of the ${gene.complex_names.join(', ')} complex` }));
            resultHtml = formatListResult(`Components of ${complexName.toUpperCase()} Complex`, components);
        }
        else if ((match = qLower.match(/(?:bring|display|show)\s+(.+?)\s+domain\s*containing\s*(?:proteins|genes)/i))) {
            const domainName = match[1].trim();
            const domainRegex = new RegExp(domainName, 'i');
            const proteins = ciliaHubData
                .filter(gene => gene.domain_descriptions.some(dd => dd.match(domainRegex)))
                .map(gene => ({ gene: gene.gene, description: `Contains a ${domainName.toUpperCase()}-like domain.` }));
            resultHtml = formatListResult(`${domainName.toUpperCase()} Domain-Containing Proteins`, proteins);
        }
        else if ((match = qLower.match(/(?:display|show)\s+ciliary\s+genes\s+in\s+(.+)/i))) {
            const organismName = match[1].trim();
            const organismMap = { 'c. elegans': 'C.elegans', 'human': 'H.sapiens', 'humans': 'H.sapiens', 'mouse': 'M.musculus', 'zebrafish': 'D.rerio', 'fruit fly': 'D.melanogaster' };
            const speciesCode = organismMap[organismName.toLowerCase()] || organismName;

            const organismGenes = ciliaHubData
                .filter(ciliaGene => {
                    const genePhylo = phylogenyData[ciliaGene.gene.toUpperCase()];
                    return genePhylo && genePhylo.species && genePhylo.species.includes(speciesCode);
                })
                .map(gene => ({ gene: gene.gene, description: `Present in ${speciesCode}` }));
            resultHtml = formatListResult(`Ciliary Genes in ${organismName}`, organismGenes, `Found ${organismGenes.length} ciliary genes present in ${speciesCode}.`);
        }
        else if ((match = qLower.match(/(?:show|display|compare)\s+(?:genes\s+)?(?:highly\s+)?expressed\s+in\s+([a-zA-Z\s]+)\s+vs\.?\s+ciliary\s+genes\s+in\s+\1/i))) {
            const tissue = match[1].trim();
            const tissueCapitalized = tissue.charAt(0).toUpperCase() + tissue.slice(1);
            const HIGH_EXPRESSION_THRESHOLD = 50;

            if (!tissueData || Object.keys(tissueData).length === 0) {
                resultHtml = `<p class="status-not-found">Cannot perform comparison: Tissue data is not available.</p>`;
            } else {
                const allHighlyExpressed = Object.entries(tissueData)
                    .filter(([, tissues]) => tissues[tissueCapitalized] > HIGH_EXPRESSION_THRESHOLD)
                    .map(([gene, tissues]) => ({ gene, nTPM: tissues[tissueCapitalized] }));

                const ciliaryInTissue = ciliaHubData
                    .filter(ciliaGene => tissueData[ciliaGene.gene.toUpperCase()]?.[tissueCapitalized])
                    .map(ciliaGene => ({
                        gene: ciliaGene.gene,
                        nTPM: tissueData[ciliaGene.gene.toUpperCase()][tissueCapitalized]
                    }));

                allHighlyExpressed.sort((a, b) => b.nTPM - a.nTPM);
                ciliaryInTissue.sort((a, b) => b.nTPM - a.nTPM);
                resultHtml = formatComparisonResult(`Gene Expression in ${tissueCapitalized}`, tissueCapitalized, allHighlyExpressed, ciliaryInTissue);
            }
        }
        else if ((match = qLower.match(/(?:effect of|tell me about|show|what is the)\s+([A-Z0-9\-]+)\s+(?:on|and|regarding)\s+(?:cilia\s*)?(length|ciliogenesis|percentage|number|signaling)/i))) {
            const geneSymbol = match[1].toUpperCase();
            const geneScreenData = screenData ? screenData[geneSymbol] : null;
            if (geneScreenData) {
                resultHtml = `<div class="result-card"><h3>Screen Data for ${geneSymbol}</h3>${renderScreenDataTable(geneSymbol, geneScreenData)}</div>`;
            } else {
                resultHtml = `<div class="result-card"><h3>Screen Data for ${geneSymbol}</h3><p class="status-not-found">No ciliary screen data found.</p></div>`;
            }
        }
        else if ((match = qLower.match(/(?:display|show|list)\s+genes\s+(?:found|present)?\s*(only in ciliated|in ciliated only|ciliary only|only in non-ciliary|non-ciliary only|in all organisms|present in both)/i))) {
            const { label, genes } = await getGenesByPhylogeny(match[1]);
            resultHtml = formatListResult(label, genes.map(g => ({ gene: g, description: `Phylogeny Group: ${label}` })));
        }
        else if (qLower.match(/(?:please\s+)?(?:display|show)\s+ciliopathy\s+genes/i)) {
            const { genes, description } = await getCiliopathyGenes('ciliopathy');
            resultHtml = formatListResult('Ciliopathy Genes', genes, description);
        }
        else if (qLower.includes('ciliary genes') && qLower.includes('human')) {
            const results = ciliaHubData
                .filter(g => g.localization.some(l => normalizeTerm(l).includes('cili')) || g.ciliopathy.length > 0)
                .map(g => ({ gene: g.gene, description: g.description }))
                .sort((a, b) => a.gene.localeCompare(b.gene));
            resultHtml = formatListResult('Human Ciliary Genes', results, `Found ${results.length} genes.`);
        }
        else if ((match = qLower.match(/(?:please\s+)?(?:display|show|genes for)\s+(.+?)\s+genes/i)) && !match[1].includes('ciliopathy')) {
            const disease = match[1].trim();
            const { genes, description } = await getCiliopathyGenes(disease);
            resultHtml = formatListResult(`${disease} Genes`, genes, description);
        }
        else if ((match = qLower.match(/(?:genes for|genes related to|show me)\s+(motile cilium|axoneme|basal body|transition zone|ciliogenesis)/i))) {
            const term = match[1];
            const results = await getGenesByFunctionalCategory(term);
            resultHtml = formatListResult(`Genes for: ${term}`, results);
        }
        else if ((match = qLower.match(/(?:gene expression|expression|display the expression of)\s+(?:of|for)?\s+([A-Z0-9\-]+)/i))) {
            const gene = match[1].toUpperCase();
            await displayCiliAIExpressionHeatmap([gene], resultArea, tissueData);
            return;
        }
        // ... and so on for all your other else/if blocks
        else {
            resultHtml = `<p>Sorry, I didn’t understand that. Try one of the examples.</p>`;
        }
        resultArea.innerHTML = resultHtml;
    } catch (e) {
        resultArea.innerHTML = `<p class="status-not-found">An error occurred. Check console for details.</p>`;
        console.error("CiliAI Query Error:", e);
    }
};


// --- UI and Formatting Helper Functions ---

function formatComprehensiveGeneDetails(geneSymbol, geneData) {
    if (!geneData) {
        return `<div class="result-card"><h3>${geneSymbol}</h3><p class="status-not-found">Gene not found in the database.</p></div>`;
    }
    const { ensembl_id, functional_summary, description, localization, complex_names, complex_components, domain_descriptions, synonym, ciliopathy } = geneData;

    return `
        <div class="result-card">
            <h3>${geneSymbol} Details</h3>
            <table class="gene-detail-table">
                <tr><th>Ensembl ID</th><td>${ensembl_id || 'N/A'}</td></tr>
                <tr><th>Functional Summary</th><td>${functional_summary || description || 'N/A'}</td></tr>
                <tr><th>Localization</th><td>${localization.join(', ') || 'N/A'}</td></tr>
                <tr><th>Complex Name</th><td>${complex_names.join(', ') || 'N/A'}</td></tr>
                <tr><th>Complex Components</th><td>${complex_components.join(', ') || 'N/A'}</td></tr>
                <tr><th>Domain Descriptions</th><td>${domain_descriptions.join(', ') || 'N/A'}</td></tr>
                <tr><th>Synonym</th><td>${synonym || 'N/A'}</td></tr>
                <tr><th>Ciliopathy</th><td>${ciliopathy.join(', ') || 'N/A'}</td></tr>
            </table>
            <h4>Screen Results</h4>
            ${screenDataCache && screenDataCache[geneSymbol] ? renderScreenDataTable(geneSymbol, screenDataCache[geneSymbol]) : '<p>No screen data available.</p>'}
            <p class="ai-suggestion">
                <a href="#" class="ai-action" data-action="expression-visualize" data-gene="${geneSymbol}">📊 View expression heatmap</a>
            </p>
        </div>
    `;
}

function formatGeneDetail(geneData, geneSymbol, detailTitle, detailContent) {
    if (!geneData) {
        return `<div class="result-card"><h3>${geneSymbol}</h3><p class="status-not-found">Gene not found in the database.</p></div>`;
    }
    return `
        <div class="result-card">
            <h3>${geneSymbol}</h3>
            <h4>${detailTitle}</h4>
            <p>${detailContent || 'No information available.'}</p>
        </div>
    `;
}

function formatListResult(title, geneList, message = '') {
    if (!geneList || geneList.length === 0) {
        return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No matching genes found.</p></div>`;
    }
    const messageHtml = message ? `<p>${message}</p>` : '';
    const displayedGenes = geneList.slice(0, 100);
    const tableHtml = `
        <table class="ciliopathy-table">
            <thead><tr><th class="sortable">Gene</th><th>Description</th></tr></thead>
            <tbody>
                ${displayedGenes.map(g => `
                    <tr>
                        <td><strong>${g.gene}</strong></td>
                        <td>${g.description ? (g.description.substring(0, 100) + (g.description.length > 100 ? '...' : '')) : ''}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ${geneList.length > 100 ? `<p>Showing first 100 of ${geneList.length} genes.</p>` : ''}
    `;
    return `
        <div class="result-card">
            <h3>${title} (${geneList.length} found)</h3>
            ${messageHtml}
            ${tableHtml}
        </div>
    `;
}

function formatComparisonResult(title, tissue, list1, list2) {
    const listToHtml = (geneList) => {
        if (!geneList || geneList.length === 0) return '<p>No matching genes found.</p>';
        return `<ul class="gene-list" style="column-count: 2;">${geneList.slice(0, 50).map(g => `<li><strong>${g.gene}</strong> (nTPM: ${g.nTPM.toFixed(2)})</li>`).join('')}</ul>`;
    };

    return `
        <div class="result-card">
            <h3>${title}</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <h4>All Genes Highly Expressed in ${tissue}</h4>
                    ${listToHtml(list1)}
                </div>
                <div>
                    <h4>Ciliary Genes Expressed in ${tissue}</h4>
                    ${listToHtml(list2)}
                </div>
            </div>
        </div>
    `;
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
    if (e.target.matches('.example-queries span')) {
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
            const resultArea = document.getElementById('ai-result-area');
            resultArea.innerHTML = `<p class="status-searching">Building expression heatmap...</p>`;
            displayCiliAIExpressionHeatmap([gene], resultArea);
        }
    }
});


// --- Other Helper Functions (Updated to Remove Optional Chaining) ---
function formatGeneDetail(geneData, geneSymbol, detailTitle, detailContent) {
  if (!geneData) {
    return `<div class="result-card"><h3>${geneSymbol}</h3><p class="status-not-found">Gene not found in the database.</p></div>`;
  }
  return `
    <div class="result-card">
      <h3>${geneSymbol}</h3>
      <h4>${detailTitle}</h4>
      <p>${detailContent || 'No information available.'}</p>
    </div>
  `;
}

// --- Table Formatting ---
function formatListResult(title, geneList, message = '') {
  if (!geneList || geneList.length === 0) {
    return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No matching genes found.</p></div>`;
  }
  const messageHtml = message ? `<p>${message}</p>` : '';
  const displayedGenes = geneList.slice(0, 100); // Limit to 100 for performance
  const tableHtml = `
    <table class="ciliopathy-table">
      <thead>
        <tr>
          <th class="sortable">Gene</th>
          <th>Description (Snippet)</th>
        </tr>
      </thead>
      <tbody>
        ${displayedGenes.map(g => `
          <tr>
            <td><strong>${g.gene}</strong></td>
            <td>${g.description.substring(0, 100)}${g.description.length > 100 ? '...' : ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${geneList.length > 100 ? `<p><a href="https://theciliahub.github.io/" target="_blank">View full list (${geneList.length} genes) in CiliaHub</a></p>` : ''}
  `;
  return `
    <div class="result-card">
      <h3>${title} (${geneList.length} found)</h3>
      ${messageHtml}
      ${tableHtml}
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

// --- Autocomplete Logic ---
function setupAiQueryAutocomplete() {
    console.log('Setting up autocomplete for aiQueryInput (placeholder)');
    const aiQueryInput = document.getElementById('aiQueryInput');
    const suggestionsContainer = document.getElementById('aiQuerySuggestions');
    if (!aiQueryInput || !suggestionsContainer) return;

    const exampleQueries = [
        "function of IFT88",
        "genes for Joubert Syndrome",
        "show me axoneme genes",
        "what domains are in CEP290",
        "show me human ciliary genes",
        "phylogeny of ARL13B",
        "expression of BBS1",
        "display ciliopathy genes",
        "display Nephronophthisis genes",
        "display genes with WD40 domains",
        "display genes with cilia localizations",
        "display genes with cilia and mitochondria localizations"
    ];

    aiQueryInput.addEventListener('input', () => {
        const inputText = aiQueryInput.value.toLowerCase();
        if (inputText.length < 3) {
            suggestionsContainer.style.display = 'none';
            return;
        }
        const filteredSuggestions = exampleQueries.filter(q => q.toLowerCase().includes(inputText));
        if (filteredSuggestions.length > 0) {
            suggestionsContainer.innerHTML = filteredSuggestions
                .map(q => `<div class="suggestion-item">${q}</div>`)
                .join('');
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
            handleAIQuery();
        }
    });

    document.addEventListener('click', (e) => {
        if (!aiQueryInput.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });
}

// --- Gene Analysis Engine & UI (largely unchanged) ---

function setupAutocomplete() {
    console.log('Setting up autocomplete for geneInput (placeholder)');
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

  visualizeBtn.addEventListener('click', async () => {
    const genes = geneInput.value.split(/[\s,]+/).map(g => g.trim().toUpperCase()).filter(Boolean);
    if (genes.length > 0) {
      const mode = document.querySelector('input[name="mode"]:checked').value;
      if (mode === 'expert' || mode === 'hybrid') {
        document.getElementById('plot-display-area').innerHTML = `<p class="status-searching">Building screen results heatmap...</p>`;
        const screenData = await fetchScreenData();
        renderScreenSummaryHeatmap(genes, screenData);
      } else {
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

  // Add sorting for tables
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('sortable')) {
      const table = e.target.closest('table');
      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const index = Array.from(e.target.parentNode.children).indexOf(e.target);
      const isAscending = e.target.dataset.sort !== 'desc';
      rows.sort((a, b) => {
        const aText = a.children[index].textContent.trim();
        const bText = b.children[index].textContent.trim();
        return isAscending ? aText.localeCompare(bText) : bText.localeCompare(aText);
      });
      tbody.innerHTML = '';
      rows.forEach(row => tbody.appendChild(row));
      e.target.dataset.sort = isAscending ? 'desc' : 'asc';
    }
  });
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




function analyzeGenesFromInput() {
    const geneInput = document.getElementById('geneInput');
    const genes = geneInput.value.split(/[\s,]+/).map(g => g.trim().toUpperCase()).filter(Boolean);
    if (genes.length === 0) {
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.innerHTML = '<p class="status-not-found">Please enter at least one gene symbol.</p>';
        document.getElementById('resultsSection').style.display = 'block';
        return;
    }
    runAnalysis([...new Set(genes)]);
}

async function runAnalysis(geneList) {
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsSection = document.getElementById('resultsSection');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const visualizeBtn = document.getElementById('visualizeBtn');
    const checkedInput = document.querySelector('input[name="mode"]:checked');
    const mode = checkedInput ? checkedInput.value : 'hybrid';

    resultsContainer.innerHTML = '';
    resultsSection.style.display = 'block';
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    visualizeBtn.style.display = 'none';
    document.getElementById('plot-display-area').innerHTML = '';

    for (const gene of geneList) {
        resultsContainer.insertAdjacentHTML('beforeend', createPlaceholderCard(gene, mode));
    }

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

        const allEvidence = [...(dbData && dbData.evidence ? dbData.evidence : []), ...apiEvidence, ...screenEvidence];
        const finalHtml = createResultCard(gene, dbData, allEvidence);
        if (resultCard) resultCard.outerHTML = finalHtml;
    }

    analyzeBtn.disabled = false;
    analyzeBtn.textContent = '🔍 Analyze Genes';
    if (geneList.length > 0) visualizeBtn.style.display = 'block';
}

// REPLACE your entire displayCiliAIExpressionHeatmap function with this corrected version.
async function displayCiliAIExpressionHeatmap(genes, resultArea, tissueData) {
  // The redundant "await fetchTissueData()" call has been removed.

  if (!tissueData || Object.keys(tissueData).length === 0) {
    resultArea.innerHTML = `<p class="status-not-found">Error: Tissue expression data could not be loaded or is empty.</p>`;
    return;
  }

  let resultHtml = '';
  genes.forEach(gene => {
    // It now uses the 'tissueData' parameter directly instead of the global cache.
    let geneData = tissueData[gene];
    
    if (!geneData && gene === 'ARL13B') {
      geneData = { 'Brain': 5.2, 'Kidney': 3.1 };
      console.log(`Using fallback expression data for ${gene}`);
    }

    if (!geneData) {
      resultHtml += `<div class="result-card"><h3>Expression of ${gene}</h3><p class="status-not-found">No expression data found for ${gene}.</p></div>`;
      return;
    }

    const tissues = Object.keys(geneData).sort();
    const tableHtml = `
      <table class="expression-table">
        <thead><tr><th>Tissue</th><th>nTPM</th></tr></thead>
        <tbody>
          ${tissues.map(tissue => `
            <tr>
              <td>${tissue}</td>
              <td>${geneData[tissue].toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    resultHtml += `
      <div class="result-card">
        <h3>Expression of ${gene}</h3>
        <p>Expression levels (nTPM) across tissues for ${gene}.</p>
        ${tableHtml}
      </div>
    `;
  });
  resultArea.innerHTML = resultHtml;
}

function renderScreenDataTable(gene, screenInfo) {
  if (!screenInfo || !Array.isArray(screenInfo)) {
    return '<p class="status-not-found">No structured screen data available.</p>';
  }

  const screenNames = {
    'Kim2016': 'Kim et al. (2016) IMCD3 RNAi',
    'Wheway2015': 'Wheway et al. (2015) RPE1 RNAi',
    'Roosing2015': 'Roosing et al. (2015) hTERT-RPE1',
    'Basu2023': 'Basu et al. (2023) MDCK CRISPR',
    'Breslow2018': 'Breslow et al. (2018) Hedgehog Signaling'
  };

  const hitCount = screenInfo.filter(s => s.result !== 'No effect' && s.result !== 'Not Reported').length;
  const summary = `<p class="screen-summary">According to ${hitCount} out of ${screenInfo.length} ciliary screens, <strong>${gene}</strong> was found to impact cilia.</p>`;

  const tableHtml = `
    <table class="expression-table">
      <thead><tr><th>Source</th><th>Result</th></tr></thead>
      <tbody>
        ${screenInfo.map(s => {
          const name = screenNames[s.source] || s.source;
          return `<tr><td>${name}</td><td>${s.result || 'N/A'}</td></tr>`;
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


async function renderPhylogenyHeatmap(genes) {
    const phylogeny = await fetchPhylogenyData();
    if (!phylogeny || Object.keys(phylogeny).length === 0) {
        console.error('No phylogeny data available');
        document.getElementById('plot-display-area').innerHTML = '<p class="status-not-found">No phylogeny data available.</p>';
        return;
    }

    const organisms = new Set();
    genes.forEach(g => {
        const gData = phylogeny[g];
        if (gData && gData.species) {
            gData.species.forEach(org => organisms.add(org));
        }
    });

    const orgList = Array.from(organisms).sort();
    const matrix = genes.map(g => orgList.map(org => phylogeny[g]?.species?.includes(org) ? 1 : 0));

    const trace = {
        z: matrix,
        x: orgList,
        y: genes,
        type: 'heatmap',
        colorscale: [
            [0, '#f8f9fa'],
            [1, '#2c5aa0']
        ],
        showscale: false,
        hovertemplate: '<b>Gene:</b> %{y}<br><b>Organism:</b> %{x}<br><b>Present:</b> %{z}<extra></extra>'
    };

    const layout = {
        title: { text: 'Phylogeny Heatmap', font: { size: 16, family: 'Arial', color: '#2c5aa0' } },
        xaxis: { title: 'Organisms', tickangle: -45, automargin: true },
        yaxis: { title: 'Genes', automargin: true },
        margin: { t: 40, l: 100, r: 20, b: 100 },
        height: Math.max(300, genes.length * 30)
    };

    Plotly.newPlot('plot-display-area', [trace], layout, { responsive: true });
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

    // Updated category maps to match new result values
    const numberCategoryMap = { 
        "No effect": { v: 1, c: '#fee090' }, 
        "Not Reported": { v: 2, c: '#636363' }, 
        "Not in Screen": { v: 3, c: '#bdbdbd' }
    };
    const signalingCategoryMap = { 
        "Increased Signaling (Negative Regulator)": { v: 1, c: '#d73027' }, 
        "No effect": { v: 2, c: '#fdae61' }, 
        "Not Reported": { v: 3, c: '#636363' }, 
        "Not in Screen": { v: 4, c: '#bdbdbd' }
    };

    const geneLabels = genes.map(g => g.toUpperCase());
    const zDataNumber = [], textDataNumber = [], zDataSignaling = [], textDataSignaling = [];

    genes.forEach(gene => {
        const numberRowValues = [], numberRowText = [], signalingRowValues = [], signalingRowText = [];
        numberScreenOrder.forEach(screenName => {
            const screenKey = numberScreens[screenName];
            let resultText = "Not in Screen";
            const screenEntry = screenData[gene]?.find(s => s.source === screenKey);
            if (screenEntry) {
                resultText = screenEntry.result || "Not Reported";
            }
            const mapping = numberCategoryMap[resultText] || numberCategoryMap["Not in Screen"];
            numberRowValues.push(mapping.v);
            numberRowText.push(resultText);
        });
        signalingScreenOrder.forEach(screenName => {
            const screenKey = signalingScreens[screenName];
            let resultText = "Not in Screen";
            const screenEntry = screenData[gene]?.find(s => s.source === screenKey);
            if (screenEntry) {
                resultText = screenEntry.result || "Not Reported";
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

    const trace1 = { 
        x: numberScreenOrder, 
        y: geneLabels, 
        z: zDataNumber, 
        customdata: textDataNumber, 
        type: 'heatmap', 
        colorscale: [[0, '#fee090'], [0.5, '#636363'], [1.0, '#bdbdbd']], 
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
        colorscale: [[0, '#d73027'], [0.33, '#fdae61'], [0.67, '#636363'], [1.0, '#bdbdbd']], 
        showscale: false, 
        hovertemplate: '<b>Gene:</b> %{y}<br><b>Screen:</b> %{x}<br><b>Result:</b> %{customdata}<extra></extra>', 
        xaxis: 'x2', 
        yaxis: 'y1', 
        xgap: 1, 
        ygap: 1 
    };
    
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
    Object.entries(numberCategoryMap).forEach(([key, val]) => { 
        layout.annotations.push({ xref: 'paper', yref: 'paper', x: 1.02, y: current_y, xanchor: 'left', yanchor: 'middle', text: `█ ${key}`, font: { color: val.c, size: 12 }, showarrow: false }); 
        current_y -= 0.06; 
    });
    current_y -= 0.1;
    layout.annotations.push({ xref: 'paper', yref: 'paper', x: 1.02, y: current_y + 0.05, xanchor: 'left', text: '<b>Hedgehog Signaling</b>', showarrow: false, font: { size: 13 } });
    Object.entries(signalingCategoryMap).forEach(([key, val]) => { 
        layout.annotations.push({ xref: 'paper', yref: 'paper', x: 1.02, y: current_y, xanchor: 'left', yanchor: 'middle', text: `█ ${key}`, font: { color: val.c, size: 12 }, showarrow: false }); 
        current_y -= 0.06; 
    });

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
