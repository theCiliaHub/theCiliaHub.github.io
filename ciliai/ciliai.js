// ciliAI.js - Enhanced with advanced AI query handler, heatmap visualization, corrected screen names, and robust autocomplete

// --- Global Data Cache ---

let ciliaHubDataCache = null;
let screenDataCache = null;
// --- Phylogeny Summary Integration ---
let phylogenyDataCache = null;
let tissueDataCache = null; // Already defined in the provided code

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
                                <span>"show me genes for Joubert Syndrome"</span>, 
                                <span>"show me WD40 domain genes"</span>, 
                                <span>"show me cilia localizing genes"</span>, 
                                <span>"show me complexes for IFT88"</span>,
                                <span>"show me cilia organisms specific genes"</span>,
                                <span>"gene expression of IFT88 in kidney"</span>.
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
                .example-queries span { background-color: #d1e7fd; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
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

// --- Data Fetching and Caching (Abbreviated for brevity) ---
async function fetchCiliaData() { if (ciliaHubDataCache) return ciliaHubDataCache; try { const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/ciliahub_data.json'); if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`); const data = await response.json(); ciliaHubDataCache = data.map(gene => ({...gene, domain_descriptions: typeof gene.domain_descriptions === 'string' ? gene.domain_descriptions.split(',').map(d => d.trim()) : Array.isArray(gene.domain_descriptions) ? gene.domain_descriptions : [] })); console.log('CiliaHub data loaded.'); return ciliaHubDataCache; } catch (error) { console.error("Failed to fetch CiliaHub data:", error); return null; } }
async function fetchScreenData() { if (screenDataCache) return screenDataCache; try { const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cilia_screens_data.json'); if (!response.ok) throw new Error(`Failed to fetch screen data: ${response.statusText}`); screenDataCache = await response.json(); console.log('Screen data loaded.'); return screenDataCache; } catch (error) { console.error('Error fetching screen data:', error); return {}; } }


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
        const data = await response.json();
        screenDataCache = data;
        console.log('Screen data loaded successfully:', Object.keys(data).length, 'genes');
        return data;
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

        // 1️⃣ Handle top-level arrays like "ciliated_only_genes"
        if (raw.ciliated_only_genes) {
            raw.ciliated_only_genes
                .filter(Boolean)
                .forEach(g => unified[g.trim().toUpperCase()] = { category: 'ciliary_only' });
        }

        if (raw.nonciliary_only_genes) {
            raw.nonciliary_only_genes
                .filter(Boolean)
                .forEach(g => unified[g.trim().toUpperCase()] = { category: 'nonciliary_only' });
        }

        if (raw.in_all_organisms) {
            raw.in_all_organisms
                .filter(Boolean)
                .forEach(g => unified[g.trim().toUpperCase()] = { category: 'in_all_organisms' });
        }

        // 2️⃣ Handle list of objects like {id, sym, class, species}
        if (Array.isArray(raw)) {
            raw.forEach(item => {
                const gene = (item.sym || '').trim().toUpperCase();
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

async function fetchTissueData() {
    if (tissueDataCache) return tissueDataCache;
    try {
        console.debug('fetchTissueData: Fetching TSV...');
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/rna_tissue_consensus.tsv');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const tsv = await response.text();
        console.debug('fetchTissueData: TSV fetched, length:', tsv.length);
        
        const lines = tsv.trim().split('\n');
        if (lines.length < 2) {
            console.warn('fetchTissueData: TSV is empty or malformed (no header/data rows)');
            throw new Error('Empty TSV file');
        }
        
        const data = {};
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split('\t');
            if (parts.length < 4) {
                console.warn(`fetchTissueData: Skipping malformed row ${i}:`, lines[i]);
                continue;
            }

            // Correct column order: EnsemblID, GeneSymbol, Tissue, Expression
            const [ensemblID, geneSymbol, tissue, nTPMValue] = parts;
            if (!geneSymbol || !tissue || !nTPMValue) continue;

            const gene = geneSymbol.toUpperCase().trim();
            const nTPM = parseFloat(nTPMValue.trim());

            if (!isNaN(nTPM)) {
                if (!data[gene]) data[gene] = {};
                data[gene][tissue.trim()] = nTPM;
            } else {
                console.warn(`fetchTissueData: Invalid nTPM in row ${i}:`, nTPMValue);
            }
        }

        // Debug check
        if (data['WDR31']) {
            console.debug('fetchTissueData: Example WDR31 tissues loaded:', Object.keys(data['WDR31']).slice(0, 5));
        } else {
            console.warn('fetchTissueData: WDR31 not found in TSV — check file format.');
        }

        // Fallback check for IFT88
        if (!data['IFT88']) {
            console.warn('fetchTissueData: IFT88 not found in TSV - adding fallback');
            data['IFT88'] = {
                'Kidney Cortex': 8.45,
                'Kidney Medulla': 12.67,
                'Lung': 5.23,
                'Liver': 3.12,
                'Brain': 1.89
            };
        }

        tissueDataCache = data;
        console.log('Tissue expression data loaded and cached for', Object.keys(data).length, 'genes');
        return tissueDataCache;

    } catch (error) {
        console.error('Failed to fetch tissue data:', error);

        // Minimal fallback dataset
        const fallbackData = {
            'IFT88': {
                'Kidney Cortex': 8.45,
                'Kidney Medulla': 12.67
            }
        };

        tissueDataCache = fallbackData;
        console.log('Using fallback tissue data for', Object.keys(fallbackData).length, 'genes');
        return tissueDataCache;
    }
}

// --- NEW: Functional-category search helper ---
// Uses ciliaHubDataCache (from fetchCiliaData()) to find genes whose functional_category,
// functional_summary, localization or description contains the query terms.
async function getGenesByFunctionalCategory(query) {
    await fetchCiliaData();
    if (!ciliaHubDataCache || !Array.isArray(ciliaHubDataCache)) return [];

    if (!query) return [];

    const terms = query.split(/[,&]| and /i).map(t => normalizeTerm(t)).filter(Boolean);
    if (terms.length === 0) return [];

    const matches = ciliaHubDataCache.filter(item => {
        const cat = normalizeTerm(item.functional_category || '');
        const summary = normalizeTerm(item.functional_summary || '');
        const loc = normalizeTerm(item.localization || '');
        const desc = normalizeTerm(item.description || '');
        // require each term to be present in at least one of the fields
        return terms.every(term => (cat.includes(term) || summary.includes(term) || loc.includes(term) || desc.includes(term)));
    }).map(x => x.gene);

    return Array.from(new Set(matches)).sort();
}

// --- NEW: Phylogeny query helper ---
// Wraps your normalized phylogenyDataCache and provides labeled results for common natural phrases.
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

    // fallback: return empty with hint
    return { label: 'No phylogeny group matched', genes: [] };
}
// --- NEW: Utility normalizer ---
function normalizeTerm(s) {
    if (!s) return '';
    return String(s).toLowerCase().replace(/[_\-\s]+/g, ' ').trim();
}

// --- Enhanced Conversational Query Handler ---
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

    const data = await fetchCiliaData();
    const phylogeny = await fetchPhylogenyData();
    const tissueData = await fetchTissueData();

    if (!data || !phylogeny || !tissueData) {
        resultsContainer.innerHTML = `<p class="status-not-found">Error: Data could not be loaded. Please check the console.</p>`;
        return;
    }

    const qnorm = normalizeTerm(query);
    let resultHtml = '';
    let title = `Results for "${query}"`;
    
    try {
        // === SPECIES-SPECIFIC QUERIES ===
        if ((match = query.match(/(?:show me|display|find|list)\s+(.+?)\s+(?:specific|only)\s+(?:ciliary|cilia)\s+genes/i)) ||
            (match = query.match(/(.+?)\s+specific\s+(?:ciliary|cilia)\s+genes/i))) {
            
            const species = match[1].trim().toLowerCase();
            title = `${species.charAt(0).toUpperCase() + species.slice(1)}-specific ciliary genes`;
            
            // Map common species names to standardized formats
            const speciesMap = {
                'h.sapiens': 'Homo sapiens', 'human': 'Homo sapiens', 'homo sapiens': 'Homo sapiens',
                'm.musculus': 'Mus musculus', 'mouse': 'Mus musculus', 'mus musculus': 'Mus musculus', 
                'd.rerio': 'Danio rerio', 'zebrafish': 'Danio rerio', 'danio rerio': 'Danio rerio',
                'c.elegans': 'Caenorhabditis elegans', 'worm': 'Caenorhabditis elegans',
                'd.melanogaster': 'Drosophila melanogaster', 'fly': 'Drosophila melanogaster'
            };
            
            const standardizedSpecies = speciesMap[species] || species;
            const results = data.filter(gene => 
                gene.species && gene.species.toLowerCase().includes(standardizedSpecies.toLowerCase())
            );
            
            resultHtml = formatSpeciesResults(results, title, standardizedSpecies);
        }
        
        // === CILIA STRUCTURE/COMPONENT QUERIES ===
        else if ((match = query.match(/(?:show me|display|find|list)\s+genes\s+(?:for|associated with|in)\s+(.+)/i)) ||
                 (match = query.match(/(.+)\s+genes/i))) {
            
            const component = match[1].trim().toLowerCase();
            title = `Genes associated with ${component}`;
            
            // Map common component names to search terms
            const componentMap = {
                'motile cilium': ['motile cilium', 'motile cilia', 'motility', 'motile'],
                'motile cilia': ['motile cilium', 'motile cilia', 'motility', 'motile'],
                'axoneme': ['axoneme', 'axonemal', 'microtubule doublet', 'central pair'],
                'basal body': ['basal body', 'basal bodies', 'centriole', 'mother centriole'],
                'transition zone': ['transition zone', 'ciliary gate', 'ciliary necklace'],
                'primary cilium': ['primary cilium', 'primary cilia', 'sensory cilium'],
                'sensory cilium': ['sensory cilium', 'sensory cilia', 'primary cilium'],
                'intraflagellar transport': ['intraflagellar transport', 'ift', 'ift-a', 'ift-b'],
                'bbsome': ['bbsome', 'bardet-biedl syndrome complex'],
                'ciliary tip': ['ciliary tip', 'tip complex', 'distal tip'],
                'ciliary base': ['ciliary base', 'basal body', 'proximal end']
            };
            
            const searchTerms = componentMap[component] || [component];
            const results = data.filter(gene => {
                const searchText = [
                    gene.functional_category || '',
                    gene.functional_summary || '', 
                    gene.localization || '',
                    gene.description || ''
                ].join(' ').toLowerCase();
                
                return searchTerms.some(term => searchText.includes(term));
            });
            
            resultHtml = formatComponentResults(results, title, component);
        }
        
        // === GENERAL CILIARY GENE QUERIES ===
        else if (/(?:show me|display|list|find)\s+(?:all\s+)?(?:ciliary|cilia)\s+genes/i.test(query)) {
            title = "All ciliary genes";
            const results = data; // All genes in the dataset are ciliary
            
            resultHtml = `
                <div class="result-card">
                    <h3>${title}</h3>
                    <p>Found ${results.length} ciliary genes in the database.</p>
                    <div style="max-height: 400px; overflow-y: auto; border: 1px solid #ddd; padding: 1rem; border-radius: 4px;">
                        <ul style="columns: 3; column-gap: 2rem;">
                            ${results.map(gene => `<li><strong>${gene.gene}</strong>${gene.species ? ` (${gene.species})` : ''}</li>`).join('')}
                        </ul>
                    </div>
                    <p class="ai-suggestion">
                        🔍 Would you like to 
                        <a href="#" class="ai-action" data-action="filter-by-species" style="color:#3b82f6;">filter by species</a> or 
                        <a href="#" class="ai-action" data-action="filter-by-localization" style="color:#3b82f6;">filter by localization</a>?
                    </p>
                </div>
            `;
        }
        
        // === FUNCTIONAL CATEGORY QUERIES ===
        else if ((match = query.match(/(?:show me|display|find)\s+(.+?)\s+(?:functional category\s+)?genes/i)) ||
                 (match = query.match(/(?:genes in|genes for)\s+(.+?)\s+functional category/i))) {
            
            const category = match[1].trim();
            title = `Genes in "${category}" functional category`;
            
            const results = data.filter(gene => 
                gene.functional_category && 
                gene.functional_category.toLowerCase().includes(category.toLowerCase())
            );
            
            resultHtml = formatFunctionalCategoryResults(results, title, category);
        }
        
        // === LOCALIZATION QUERIES ===
        else if ((match = query.match(/(?:show me|display|find)\s+genes\s+(?:localizing to|in|at)\s+(.+)/i)) ||
                 (match = query.match(/(.+)\s+localizing\s+genes/i))) {
            
            const location = match[1].trim();
            title = `Genes localizing to ${location}`;
            
            const results = data.filter(gene => 
                gene.localization && 
                gene.localization.toLowerCase().includes(location.toLowerCase())
            );
            
            resultHtml = formatLocalizationResults(results, title, location);
        }
        
        // === DOMAIN-BASED QUERIES ===
        else if ((match = query.match(/(?:show me|display|find)\s+(?:genes with|proteins with)\s+(.+?)\s+domain/i)) ||
                 (match = query.match(/(.+?)\s+domain\s+genes/i))) {
            
            const domain = match[1].trim();
            title = `Genes with "${domain}" domain`;
            
            const results = data.filter(gene => 
                gene.domain_descriptions && 
                gene.domain_descriptions.some(d => d.toLowerCase().includes(domain.toLowerCase()))
            );
            
            resultHtml = formatDomainResults(results, title, domain);
        }
        
        // === DISEASE/PATHOLOGY QUERIES ===
        else if ((match = query.match(/(?:genes for|genes associated with|genes involved in)\s+(.+)/i)) ||
                 (match = query.match(/(.+)\s+(?:syndrome|disease|ciliopathy)/i))) {
            
            const disease = match[1].trim();
            title = `Genes associated with ${disease}`;
            
            const results = data.filter(gene => 
                gene.functional_summary && 
                gene.functional_summary.toLowerCase().includes(disease.toLowerCase())
            );
            
            resultHtml = formatDiseaseResults(results, title, disease);
        }
        
        // === EXPRESSION PATTERN QUERIES ===
        else if ((match = query.match(/(?:high|low|elevated|reduced)\s+expression\s+(?:in|at)\s+(.+)/i)) ||
                 (match = query.match(/(.+)\s+highly expressed\s+genes/i))) {
            
            const tissue = match[1] ? match[1].trim() : '';
            const expressionType = query.match(/(high|low|elevated|reduced)/i)?.[1] || 'high';
            title = `Genes with ${expressionType} expression${tissue ? ` in ${tissue}` : ''}`;
            
            // This would require additional expression threshold data
            resultHtml = `
                <div class="result-card">
                    <h3>${title}</h3>
                    <p>Expression-based queries require detailed expression quantification data.</p>
                    <p>Try asking about specific genes instead: "gene expression of IFT88 in kidney"</p>
                </div>
            `;
        }
        
        // === PHYLOGENY CONSERVATION QUERIES ===
        else if (/(?:conserved|evolutionarily conserved|phylogenetically conserved)/i.test(query)) {
            title = "Evolutionarily conserved ciliary genes";
            
            const phyloMap = {};
            Object.entries(phylogeny).forEach(([gene, info]) => {
                const keys = [gene, ...(info.synonyms || [])];
                keys.forEach(k => {
                    if (k) phyloMap[k.toUpperCase()] = info;
                });
            });
            
            // Genes present in multiple organisms are considered conserved
            const conservedGenes = Object.entries(phyloMap)
                .filter(([gene, info]) => info?.presence && Object.values(info.presence).filter(Boolean).length >= 3)
                .map(([gene]) => gene);
            
            resultHtml = formatConservedGenesResults(conservedGenes, title, data);
        }
        
        // === COMPLEX/MULTIPROTEIN QUERIES ===
        else if ((match = query.match(/(?:show me|display|find)\s+(?:components of|genes in)\s+(.+?)\s+complex/i)) ||
                 (match = query.match(/(.+?)\s+complex\s+(?:components|genes)/i))) {
            
            const complexName = match[1].trim();
            title = `Components of ${complexName} complex`;
            
            const results = data.filter(gene => 
                gene.complex_names && 
                gene.complex_names.some(c => c.toLowerCase().includes(complexName.toLowerCase()))
            );
            
            resultHtml = formatComplexResults(results, title, complexName);
        }
        
        // === FALLBACK: DIRECT GENE INPUT ===
        else if (/^[A-Z0-9\-]{3,}$/i.test(query.split(' ')[0])) {
            const detectedGene = query.split(' ')[0].toUpperCase();
            document.getElementById('geneInput').value = detectedGene;
            runAnalysis([detectedGene]);
            return;
        }
        
        // === FALLBACK: UNRECOGNIZED QUERY ===
        else {
            resultHtml = `
                <div class="result-card">
                    <h3>I didn't understand that query</h3>
                    <p>Try asking about:</p>
                    <ul>
                        <li>"Show me ciliary genes"</li>
                        <li>"Display H.sapiens specific ciliary genes"</li>
                        <li>"Show me genes for motile cilium"</li>
                        <li>"Genes for Joubert syndrome"</li>
                        <li>"Genes with WD40 domain"</li>
                        <li>"Genes localizing to basal body"</li>
                        <li>"Gene expression of IFT88 in kidney"</li>
                        <li>"Components of IFT-B complex"</li>
                    </ul>
                </div>
            `;
        }
        
        resultsContainer.innerHTML = resultHtml;
        
    } catch (error) {
        console.error('Error processing AI query:', error);
        resultsContainer.innerHTML = `<p class="status-not-found">An error occurred during the search. Please check the console.</p>`;
    }
}

// === FORMATTING HELPER FUNCTIONS ===

function formatSpeciesResults(results, title, species) {
    if (results.length === 0) {
        return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No ${species}-specific ciliary genes found.</p></div>`;
    }
    
    return `
        <div class="result-card">
            <h3>${title}</h3>
            <p>Found ${results.length} ${species}-specific ciliary genes:</p>
            <div style="max-height: 300px; overflow-y: auto;">
                <table class="expression-table">
                    <thead>
                        <tr><th>Gene</th><th>Functional Category</th><th>Localization</th></tr>
                    </thead>
                    <tbody>
                        ${results.map(gene => `
                            <tr>
                                <td><strong>${gene.gene}</strong></td>
                                <td>${gene.functional_category || 'N/A'}</td>
                                <td>${gene.localization || 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <p class="ai-suggestion">
                🔬 Would you like to 
                <a href="#" class="ai-action" data-action="analyze-genes" data-genes="${results.map(g => g.gene).join(',')}" style="color:#3b82f6;">analyze these genes</a> or 
                <a href="#" class="ai-action" data-action="compare-species" style="color:#3b82f6;">compare with other species</a>?
            </p>
        </div>
    `;
}

function formatComponentResults(results, title, component) {
    if (results.length === 0) {
        return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No genes found associated with ${component}.</p></div>`;
    }
    
    return `
        <div class="result-card">
            <h3>${title}</h3>
            <p>Found ${results.length} genes associated with ${component}:</p>
            <div style="max-height: 300px; overflow-y: auto;">
                <ul>
                    ${results.map(gene => `
                        <li>
                            <strong>${gene.gene}</strong> 
                            ${gene.species ? `(${gene.species})` : ''}
                            ${gene.functional_summary ? `- ${gene.functional_summary.substring(0, 100)}...` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `;
}

function formatFunctionalCategoryResults(results, title, category) {
    if (results.length === 0) {
        return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No genes found in "${category}" functional category.</p></div>`;
    }
    
    return `
        <div class="result-card">
            <h3>${title}</h3>
            <p>Found ${results.length} genes in this functional category:</p>
            <div style="max-height: 300px; overflow-y: auto;">
                <ul>
                    ${results.map(gene => `
                        <li>
                            <strong>${gene.gene}</strong> - 
                            ${gene.functional_summary || 'No summary available'}
                        </li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `;
}

function formatLocalizationResults(results, title, location) {
    if (results.length === 0) {
        return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No genes found localizing to ${location}.</p></div>`;
    }
    
    return `
        <div class="result-card">
            <h3>${title}</h3>
            <p>Found ${results.length} genes localizing to ${location}:</p>
            <div style="max-height: 300px; overflow-y: auto;">
                <ul>
                    ${results.map(gene => `
                        <li>
                            <strong>${gene.gene}</strong> 
                            ${gene.species ? `(${gene.species})` : ''}
                            ${gene.functional_category ? `- ${gene.functional_category}` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `;
}

function formatConservedGenesResults(conservedGenes, title, fullData) {
    if (conservedGenes.length === 0) {
        return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No conserved genes found.</p></div>`;
    }
    
    // Get full gene data for conserved genes
    const conservedGeneData = conservedGenes.map(geneName => 
        fullData.find(g => g.gene.toUpperCase() === geneName.toUpperCase())
    ).filter(Boolean);
    
    return `
        <div class="result-card">
            <h3>${title}</h3>
            <p>Found ${conservedGenes.length} evolutionarily conserved ciliary genes across multiple species:</p>
            <div style="max-height: 300px; overflow-y: auto;">
                <ul>
                    ${conservedGeneData.slice(0, 20).map(gene => `
                        <li>
                            <strong>${gene.gene}</strong> 
                            ${gene.species ? `(${gene.species})` : ''}
                            ${gene.functional_category ? `- ${gene.functional_category}` : ''}
                        </li>
                    `).join('')}
                    ${conservedGenes.length > 20 ? `<li>... and ${conservedGenes.length - 20} more conserved genes</li>` : ''}
                </ul>
            </div>
            <p class="ai-suggestion">
                🌍 Would you like to 
                <a href="#" class="ai-action" data-action="phylogeny-heatmap" data-genes="${conservedGenes.slice(0, 20).join(',')}" style="color:#3b82f6;">visualize phylogenetic conservation</a>?
            </p>
        </div>
    `;
}


// --- AI Result Formatting Helpers ---

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

// --- Enhanced Conversational Query Handler ---
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

    const data = await fetchCiliaData();
    const phylogeny = await fetchPhylogenyData();
    const tissueData = await fetchTissueData();

    if (!data || !phylogeny || !tissueData) {
        resultsContainer.innerHTML = `<p class="status-not-found">Error: Data could not be loaded. Please check the console.</p>`;
        return;
    }

    const qnorm = normalizeTerm(query);
    let resultHtml = '';
    let title = `Results for "${query}"`;
    
    try {
        // === SPECIES-SPECIFIC QUERIES ===
        if ((match = query.match(/(?:show me|display|find|list)\s+(.+?)\s+(?:specific|only)\s+(?:ciliary|cilia)\s+genes/i)) ||
            (match = query.match(/(.+?)\s+specific\s+(?:ciliary|cilia)\s+genes/i))) {
            
            const species = match[1].trim().toLowerCase();
            title = `${species.charAt(0).toUpperCase() + species.slice(1)}-specific ciliary genes`;
            
            // Map common species names to standardized formats
            const speciesMap = {
                'h.sapiens': 'Homo sapiens', 'human': 'Homo sapiens', 'homo sapiens': 'Homo sapiens',
                'm.musculus': 'Mus musculus', 'mouse': 'Mus musculus', 'mus musculus': 'Mus musculus', 
                'd.rerio': 'Danio rerio', 'zebrafish': 'Danio rerio', 'danio rerio': 'Danio rerio',
                'c.elegans': 'Caenorhabditis elegans', 'worm': 'Caenorhabditis elegans',
                'd.melanogaster': 'Drosophila melanogaster', 'fly': 'Drosophila melanogaster'
            };
            
            const standardizedSpecies = speciesMap[species] || species;
            const results = data.filter(gene => 
                gene.species && gene.species.toLowerCase().includes(standardizedSpecies.toLowerCase())
            );
            
            resultHtml = formatSpeciesResults(results, title, standardizedSpecies);
        }
        
        // === CILIA STRUCTURE/COMPONENT QUERIES ===
        else if ((match = query.match(/(?:show me|display|find|list)\s+genes\s+(?:for|associated with|in)\s+(.+)/i)) ||
                 (match = query.match(/(.+)\s+genes/i))) {
            
            const component = match[1].trim().toLowerCase();
            title = `Genes associated with ${component}`;
            
            // Map common component names to search terms
            const componentMap = {
                'motile cilium': ['motile cilium', 'motile cilia', 'motility', 'motile'],
                'motile cilia': ['motile cilium', 'motile cilia', 'motility', 'motile'],
                'axoneme': ['axoneme', 'axonemal', 'microtubule doublet', 'central pair'],
                'basal body': ['basal body', 'basal bodies', 'centriole', 'mother centriole'],
                'transition zone': ['transition zone', 'ciliary gate', 'ciliary necklace'],
                'primary cilium': ['primary cilium', 'primary cilia', 'sensory cilium'],
                'sensory cilium': ['sensory cilium', 'sensory cilia', 'primary cilium'],
                'intraflagellar transport': ['intraflagellar transport', 'ift', 'ift-a', 'ift-b'],
                'bbsome': ['bbsome', 'bardet-biedl syndrome complex'],
                'ciliary tip': ['ciliary tip', 'tip complex', 'distal tip'],
                'ciliary base': ['ciliary base', 'basal body', 'proximal end']
            };
            
            const searchTerms = componentMap[component] || [component];
            const results = data.filter(gene => {
                const searchText = [
                    gene.functional_category || '',
                    gene.functional_summary || '', 
                    gene.localization || '',
                    gene.description || ''
                ].join(' ').toLowerCase();
                
                return searchTerms.some(term => searchText.includes(term));
            });
            
            resultHtml = formatComponentResults(results, title, component);
        }
        
        // === GENERAL CILIARY GENE QUERIES ===
        else if (/(?:show me|display|list|find)\s+(?:all\s+)?(?:ciliary|cilia)\s+genes/i.test(query)) {
            title = "All ciliary genes";
            const results = data; // All genes in the dataset are ciliary
            
            resultHtml = `
                <div class="result-card">
                    <h3>${title}</h3>
                    <p>Found ${results.length} ciliary genes in the database.</p>
                    <div style="max-height: 400px; overflow-y: auto; border: 1px solid #ddd; padding: 1rem; border-radius: 4px;">
                        <ul style="columns: 3; column-gap: 2rem;">
                            ${results.map(gene => `<li><strong>${gene.gene}</strong>${gene.species ? ` (${gene.species})` : ''}</li>`).join('')}
                        </ul>
                    </div>
                    <p class="ai-suggestion">
                        🔍 Would you like to 
                        <a href="#" class="ai-action" data-action="filter-by-species" style="color:#3b82f6;">filter by species</a> or 
                        <a href="#" class="ai-action" data-action="filter-by-localization" style="color:#3b82f6;">filter by localization</a>?
                    </p>
                </div>
            `;
        }
        
        // === FUNCTIONAL CATEGORY QUERIES ===
        else if ((match = query.match(/(?:show me|display|find)\s+(.+?)\s+(?:functional category\s+)?genes/i)) ||
                 (match = query.match(/(?:genes in|genes for)\s+(.+?)\s+functional category/i))) {
            
            const category = match[1].trim();
            title = `Genes in "${category}" functional category`;
            
            const results = data.filter(gene => 
                gene.functional_category && 
                gene.functional_category.toLowerCase().includes(category.toLowerCase())
            );
            
            resultHtml = formatFunctionalCategoryResults(results, title, category);
        }
        
        // === LOCALIZATION QUERIES ===
        else if ((match = query.match(/(?:show me|display|find)\s+genes\s+(?:localizing to|in|at)\s+(.+)/i)) ||
                 (match = query.match(/(.+)\s+localizing\s+genes/i))) {
            
            const location = match[1].trim();
            title = `Genes localizing to ${location}`;
            
            const results = data.filter(gene => 
                gene.localization && 
                gene.localization.toLowerCase().includes(location.toLowerCase())
            );
            
            resultHtml = formatLocalizationResults(results, title, location);
        }
        
        // === DOMAIN-BASED QUERIES ===
        else if ((match = query.match(/(?:show me|display|find)\s+(?:genes with|proteins with)\s+(.+?)\s+domain/i)) ||
                 (match = query.match(/(.+?)\s+domain\s+genes/i))) {
            
            const domain = match[1].trim();
            title = `Genes with "${domain}" domain`;
            
            const results = data.filter(gene => 
                gene.domain_descriptions && 
                gene.domain_descriptions.some(d => d.toLowerCase().includes(domain.toLowerCase()))
            );
            
            resultHtml = formatDomainResults(results, title, domain);
        }
        
        // === DISEASE/PATHOLOGY QUERIES ===
        else if ((match = query.match(/(?:genes for|genes associated with|genes involved in)\s+(.+)/i)) ||
                 (match = query.match(/(.+)\s+(?:syndrome|disease|ciliopathy)/i))) {
            
            const disease = match[1].trim();
            title = `Genes associated with ${disease}`;
            
            const results = data.filter(gene => 
                gene.functional_summary && 
                gene.functional_summary.toLowerCase().includes(disease.toLowerCase())
            );
            
            resultHtml = formatDiseaseResults(results, title, disease);
        }
        
        // === EXPRESSION PATTERN QUERIES ===
        else if ((match = query.match(/(?:high|low|elevated|reduced)\s+expression\s+(?:in|at)\s+(.+)/i)) ||
                 (match = query.match(/(.+)\s+highly expressed\s+genes/i))) {
            
            const tissue = match[1] ? match[1].trim() : '';
            const expressionType = query.match(/(high|low|elevated|reduced)/i)?.[1] || 'high';
            title = `Genes with ${expressionType} expression${tissue ? ` in ${tissue}` : ''}`;
            
            // This would require additional expression threshold data
            resultHtml = `
                <div class="result-card">
                    <h3>${title}</h3>
                    <p>Expression-based queries require detailed expression quantification data.</p>
                    <p>Try asking about specific genes instead: "gene expression of IFT88 in kidney"</p>
                </div>
            `;
        }
        
        // === PHYLOGENY CONSERVATION QUERIES ===
        else if (/(?:conserved|evolutionarily conserved|phylogenetically conserved)/i.test(query)) {
            title = "Evolutionarily conserved ciliary genes";
            
            const phyloMap = {};
            Object.entries(phylogeny).forEach(([gene, info]) => {
                const keys = [gene, ...(info.synonyms || [])];
                keys.forEach(k => {
                    if (k) phyloMap[k.toUpperCase()] = info;
                });
            });
            
            // Genes present in multiple organisms are considered conserved
            const conservedGenes = Object.entries(phyloMap)
                .filter(([gene, info]) => info?.presence && Object.values(info.presence).filter(Boolean).length >= 3)
                .map(([gene]) => gene);
            
            resultHtml = formatConservedGenesResults(conservedGenes, title, data);
        }
        
        // === COMPLEX/MULTIPROTEIN QUERIES ===
        else if ((match = query.match(/(?:show me|display|find)\s+(?:components of|genes in)\s+(.+?)\s+complex/i)) ||
                 (match = query.match(/(.+?)\s+complex\s+(?:components|genes)/i))) {
            
            const complexName = match[1].trim();
            title = `Components of ${complexName} complex`;
            
            const results = data.filter(gene => 
                gene.complex_names && 
                gene.complex_names.some(c => c.toLowerCase().includes(complexName.toLowerCase()))
            );
            
            resultHtml = formatComplexResults(results, title, complexName);
        }
        
        // === FALLBACK: DIRECT GENE INPUT ===
        else if (/^[A-Z0-9\-]{3,}$/i.test(query.split(' ')[0])) {
            const detectedGene = query.split(' ')[0].toUpperCase();
            document.getElementById('geneInput').value = detectedGene;
            runAnalysis([detectedGene]);
            return;
        }
        
        // === FALLBACK: UNRECOGNIZED QUERY ===
        else {
            resultHtml = `
                <div class="result-card">
                    <h3>I didn't understand that query</h3>
                    <p>Try asking about:</p>
                    <ul>
                        <li>"Show me ciliary genes"</li>
                        <li>"Display H.sapiens specific ciliary genes"</li>
                        <li>"Show me genes for motile cilium"</li>
                        <li>"Genes for Joubert syndrome"</li>
                        <li>"Genes with WD40 domain"</li>
                        <li>"Genes localizing to basal body"</li>
                        <li>"Gene expression of IFT88 in kidney"</li>
                        <li>"Components of IFT-B complex"</li>
                    </ul>
                </div>
            `;
        }
        
        resultsContainer.innerHTML = resultHtml;
        
    } catch (error) {
        console.error('Error processing AI query:', error);
        resultsContainer.innerHTML = `<p class="status-not-found">An error occurred during the search. Please check the console.</p>`;
    }
}

// === FORMATTING HELPER FUNCTIONS ===

function formatSpeciesResults(results, title, species) {
    if (results.length === 0) {
        return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No ${species}-specific ciliary genes found.</p></div>`;
    }
    
    return `
        <div class="result-card">
            <h3>${title}</h3>
            <p>Found ${results.length} ${species}-specific ciliary genes:</p>
            <div style="max-height: 300px; overflow-y: auto;">
                <table class="expression-table">
                    <thead>
                        <tr><th>Gene</th><th>Functional Category</th><th>Localization</th></tr>
                    </thead>
                    <tbody>
                        ${results.map(gene => `
                            <tr>
                                <td><strong>${gene.gene}</strong></td>
                                <td>${gene.functional_category || 'N/A'}</td>
                                <td>${gene.localization || 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <p class="ai-suggestion">
                🔬 Would you like to 
                <a href="#" class="ai-action" data-action="analyze-genes" data-genes="${results.map(g => g.gene).join(',')}" style="color:#3b82f6;">analyze these genes</a> or 
                <a href="#" class="ai-action" data-action="compare-species" style="color:#3b82f6;">compare with other species</a>?
            </p>
        </div>
    `;
}

function formatComponentResults(results, title, component) {
    if (results.length === 0) {
        return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No genes found associated with ${component}.</p></div>`;
    }
    
    return `
        <div class="result-card">
            <h3>${title}</h3>
            <p>Found ${results.length} genes associated with ${component}:</p>
            <div style="max-height: 300px; overflow-y: auto;">
                <ul>
                    ${results.map(gene => `
                        <li>
                            <strong>${gene.gene}</strong> 
                            ${gene.species ? `(${gene.species})` : ''}
                            ${gene.functional_summary ? `- ${gene.functional_summary.substring(0, 100)}...` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `;
}

function formatFunctionalCategoryResults(results, title, category) {
    if (results.length === 0) {
        return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No genes found in "${category}" functional category.</p></div>`;
    }
    
    return `
        <div class="result-card">
            <h3>${title}</h3>
            <p>Found ${results.length} genes in this functional category:</p>
            <div style="max-height: 300px; overflow-y: auto;">
                <ul>
                    ${results.map(gene => `
                        <li>
                            <strong>${gene.gene}</strong> - 
                            ${gene.functional_summary || 'No summary available'}
                        </li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `;
}

function formatLocalizationResults(results, title, location) {
    if (results.length === 0) {
        return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No genes found localizing to ${location}.</p></div>`;
    }
    
    return `
        <div class="result-card">
            <h3>${title}</h3>
            <p>Found ${results.length} genes localizing to ${location}:</p>
            <div style="max-height: 300px; overflow-y: auto;">
                <ul>
                    ${results.map(gene => `
                        <li>
                            <strong>${gene.gene}</strong> 
                            ${gene.species ? `(${gene.species})` : ''}
                            ${gene.functional_category ? `- ${gene.functional_category}` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `;
}

function formatConservedGenesResults(conservedGenes, title, fullData) {
    if (conservedGenes.length === 0) {
        return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No conserved genes found.</p></div>`;
    }
    
    // Get full gene data for conserved genes
    const conservedGeneData = conservedGenes.map(geneName => 
        fullData.find(g => g.gene.toUpperCase() === geneName.toUpperCase())
    ).filter(Boolean);
    
    return `
        <div class="result-card">
            <h3>${title}</h3>
            <p>Found ${conservedGenes.length} evolutionarily conserved ciliary genes across multiple species:</p>
            <div style="max-height: 300px; overflow-y: auto;">
                <ul>
                    ${conservedGeneData.slice(0, 20).map(gene => `
                        <li>
                            <strong>${gene.gene}</strong> 
                            ${gene.species ? `(${gene.species})` : ''}
                            ${gene.functional_category ? `- ${gene.functional_category}` : ''}
                        </li>
                    `).join('')}
                    ${conservedGenes.length > 20 ? `<li>... and ${conservedGenes.length - 20} more conserved genes</li>` : ''}
                </ul>
            </div>
            <p class="ai-suggestion">
                🌍 Would you like to 
                <a href="#" class="ai-action" data-action="phylogeny-heatmap" data-genes="${conservedGenes.slice(0, 20).join(',')}" style="color:#3b82f6;">visualize phylogenetic conservation</a>?
            </p>
        </div>
    `;
}

// Update the autocomplete examples to include new query types
function setupAiQueryAutocomplete() {
    const aiQueryInput = document.getElementById('aiQueryInput');
    const suggestionsContainer = document.getElementById('aiQuerySuggestions');
    if (!aiQueryInput || !suggestionsContainer) return;

    const exampleQueries = [
        // Basic queries
        "show me ciliary genes",
        "display ciliary genes",
        
        // Species-specific queries
        "show me H.sapiens specific ciliary genes", 
        "display H.sapiens specific ciliary genes",
        "human specific ciliary genes",
        "mouse specific ciliary genes",
        
        // Structure/component queries
        "display genes for motile cilium",
        "show me genes for motile cilium", 
        "show me genes for axoneme",
        "display genes for axoneme",
        "genes for basal body",
        "genes for transition zone",
        
        // Functional category queries
        "show me trafficking genes",
        "display cytoskeleton genes",
        "genes for intraflagellar transport",
        
        // Localization queries
        "genes localizing to the basal body",
        "show me ciliary tip proteins",
        "display transition zone genes",
        
        // Domain queries
        "show me WD40 domain genes",
        "genes with kinase domain",
        
        // Disease queries
        "genes for Joubert Syndrome",
        "genes for Bardet-Biedl Syndrome",
        
        // Complex queries
        "components of IFT-B complex",
        "show me BBSome genes",
        
        // Expression queries
        "gene expression of IFT88 in kidney",
        "expression levels for ARL13B",
        
        // Phylogeny queries
        "conserved ciliary genes",
        "genes present in all organisms"
    ];

    // ... rest of autocomplete implementation remains the same
    aiQueryInput.addEventListener('input', () => {
        const inputText = aiQueryInput.value.toLowerCase();
        if (inputText.length < 2) {
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
        }
    });

    document.addEventListener('click', (e) => {
        if (!aiQueryInput.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });
}

// Update the interactive action handlers
document.addEventListener('click', async (event) => {
    if (event.target.classList.contains('ai-action')) {
        event.preventDefault();
        const action = event.target.dataset.action;
        const genes = event.target.dataset.genes ? event.target.dataset.genes.split(',') : [];

        const resultsContainer = document.getElementById('resultsContainer');

        if (action === 'analyze-genes') {
            document.getElementById('geneInput').value = genes.join(', ');
            runAnalysis(genes);
        } else if (action === 'phylogeny-heatmap') {
            resultsContainer.innerHTML = `<p class="status-searching">Building phylogenetic conservation heatmap...</p>`;
            await renderPhylogenyHeatmap(genes);
        } else if (action === 'filter-by-species') {
            // Trigger species filter dialog or update query
            aiQueryInput.value = "H.sapiens specific ciliary genes";
            handleAIQuery();
        } else if (action === 'filter-by-localization') {
            aiQueryInput.value = "genes localizing to basal body";
            handleAIQuery();
        } else if (action === 'compare-species') {
            resultsContainer.innerHTML = `<p class="status-searching">Comparing gene conservation across species...</p>`;
            // Implement multi-species comparison logic
        }
    }
});

// Ensure the enhanced function is available globally
window.handleAIQuery = handleAIQuery;

// --- Gene Analysis Engine & UI ---

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
            // FIX 1: Added 'geneName &&' to prevent errors if a gene name is missing in the data
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
            
            // FIX 2: More robust logic to replace the currently typed term
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
    const resultsContainer = document.getElementById('resultsContainer');
    const geneInput = document.getElementById('geneInput');
    const aiQueryInput = document.getElementById('aiQueryInput');

    if (!analyzeBtn || !aiQueryBtn || !visualizeBtn || !resultsContainer || !geneInput || !aiQueryInput) {
        console.warn('One or more CiliAI elements were not found in the DOM.');
        return;
    }

    analyzeBtn.addEventListener('click', analyzeGenesFromInput);
    aiQueryBtn.addEventListener('click', handleAIQuery);

   visualizeBtn.addEventListener('click', async () => {
    const genes = geneInput.value.split(/[\s,]+/).map(g => g.trim().toUpperCase()).filter(Boolean);
    if (genes.length > 0) {
        const mode = document.querySelector('input[name="mode"]:checked').value;
        if (mode === 'expert' || mode === 'hybrid') {
            const screenData = await fetchScreenData();
            renderScreenSummaryHeatmap(genes, screenData);
        } else {
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
    // In setupCiliAIEventListeners
aiQueryInput.addEventListener('keydown', debounce((e) => {
    if (e.key === 'Enter') {
        console.debug('AI Query Button/Enter pressed, raw query:', aiQueryInput.value);
        handleAIQuery();
    }
}, 300));

    resultsContainer.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('evidence-toggle')) {
            const contentId = e.target.dataset.contentId;
            const content = document.getElementById(contentId);
            if (content) {
                const isVisible = content.style.display === 'block';
                content.style.display = isVisible ? 'none' : 'block';
                e.target.textContent = isVisible ? `Show Evidence (${e.target.dataset.count}) ▾` : `Hide Evidence (${e.target.dataset.count}) ▴`;
            }
        }
    });

    // Activate both autocomplete features
    setupAutocomplete();   
    setupAiQueryAutocomplete();
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
    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'hybrid';

    if (!screenDataCache) {
        resultsContainer.innerHTML = '<p class="status-searching">Loading screen data, please wait...</p>';
        await fetchScreenData();
    }

    resultsContainer.innerHTML = '';
    resultsSection.style.display = 'block';
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    visualizeBtn.style.display = 'none';
    document.getElementById('plot-display-area').innerHTML = '';

    const screenData = screenDataCache;

    geneList.forEach(gene => {
        resultsContainer.insertAdjacentHTML('beforeend', createPlaceholderCard(gene, mode));
    });

    for (const gene of geneList) {
        const resultCard = document.getElementById(`card-${gene}`);
        let dbData = CILI_AI_DB[gene] || null;
        let apiEvidence = [];
        let screenEvidence = [];

        if (mode === 'expert' || mode === 'hybrid') {
            if (screenData && screenData[gene]) {
                screenEvidence.push({
                    id: `screen-${gene}`,
                    source: 'screen_data',
                    context: renderScreenDataTable(gene, screenData[gene])
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

async function renderExpressionHeatmap(genes) {
    const tissueData = await fetchTissueData();
    if (!tissueData || Object.keys(tissueData).length === 0) {
        console.error('No tissue expression data available');
        document.getElementById('plot-display-area').innerHTML = '<p class="status-not-found">Error: No tissue expression data available.</p>';
        return;
    }

    const tissues = new Set();
    genes.forEach(g => {
        if (tissueData[g]) {
            Object.keys(tissueData[g]).forEach(t => tissues.add(t));
        }
    });

    const tissueList = Array.from(tissues).sort();
    const matrix = genes.map(g => tissueList.map(t => tissueData[g]?.[t] || 0));

    const trace = {
        z: matrix,
        x: tissueList,
        y: genes,
        type: 'heatmap',
        colorscale: 'Viridis',
        showscale: true,
        colorbar: { title: 'nTPM' },
        hovertemplate: '<b>Gene:</b> %{y}<br><b>Tissue:</b> %{x}<br><b>Expression:</b> %{z:.2f} nTPM<extra></extra>'
    };

    const layout = {
        title: 'Gene Expression Heatmap (nTPM)',
        xaxis: { title: 'Tissues', tickangle: -45 },
        yaxis: { title: 'Genes' },
        margin: { t: 40, l: 100, r: 20, b: 100 },
        height: Math.max(300, genes.length * 20 + tissueList.length * 10)
    };

    Plotly.newPlot('plot-display-area', [trace], layout, { responsive: true });
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
        <table class="screen-table">
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
    let statusText = 'Fetching from Expert DB and Screen Data...';
    if (mode === 'nlp') statusText = 'Searching live literature...';
    if (mode === 'hybrid') statusText = 'Checking Expert DB, Screen Data & Searching Literature...';
    return `<div class="result-card" id="card-${gene}"><h3>${gene} - <span class="status-searching">${statusText}</span></h3></div>`;
}

function createResultCard(gene, dbData, allEvidence) {
    let statusText = allEvidence.length > 0 ? 'Evidence Found' : 'No Data Found';
    let statusClass = allEvidence.length > 0 ? 'status-found' : 'status-not-found';
    
    let summaryHtml = '';
    if (dbData && dbData.summary) {
        const lofClass = dbData.summary.lof_length.toLowerCase().replace(/[^a-z]/g, '-');
        const percClass = dbData.summary.percentage_ciliated.toLowerCase().replace(/[^a-z]/g, '-');
        summaryHtml = `
            <div class="prediction-grid">
                <div class="prediction-box ${lofClass || 'no-effect'}">
                    <h4>Loss-of-Function (Cilia Length)</h4>
                    <p>${dbData.summary.lof_length}</p>
                </div>
                <div class="prediction-box ${percClass || 'no-effect'}">
                    <h4>Percentage Ciliated</h4>
                    <p>${dbData.summary.percentage_ciliated}</p>
                </div>
            </div>
        `;
    } else {
        summaryHtml = '<p>No summary prediction available. Review literature and screen evidence for insights.</p>';
    }

    let evidenceHtml = '';
    if (allEvidence.length > 0) {
        const screenEv = allEvidence.find(ev => ev.source === 'screen_data');
        const otherEvidence = allEvidence.filter(ev => ev.source !== 'screen_data');

        evidenceHtml = `<div class="evidence-section">`;
        if (screenEv) {
            evidenceHtml += `<h4>Ciliary Screen Data</h4><div class="screen-evidence-container">${screenEv.context}</div>`;
        }
        if (otherEvidence.length > 0) {
            const evidenceSnippets = otherEvidence.map(ev => `
                <div class="evidence-snippet">
                    ${ev.context.replace(new RegExp(`(${gene})`, 'ig'), `<mark>$1</mark>`)}
                    <br><strong>Source: ${ev.source.toUpperCase()} (${ev.id})</strong>
                </div>
            `).join('');

            evidenceHtml += `
                <button class="evidence-toggle" data-count="${otherEvidence.length}" data-content-id="evidence-${gene}">Show Other Evidence (${otherEvidence.length}) ▾</button>
                <div class="evidence-content" id="evidence-${gene}">${evidenceSnippets}</div>
            `;
        }
        evidenceHtml += `</div>`;
    }

    return `
        <div class="result-card">
            <h3>${gene} - <span class="${statusClass}">${statusText}</span></h3>
            ${summaryHtml}
            ${evidenceHtml}
        </div>
    `;
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
    // Add validation to ensure query matches expected gene format
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

// --- Enhanced Live Literature Mining Engine (EuropePMC + PubMed/PMC full-text) ---
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

    // ✅ Broaden gene regex to include hyphenated and case variants
    const geneRegex = new RegExp(`\\b${gene}(?:[-_ ]?\\w{0,3})?\\b`, 'i');
    const sentSplitRegex = /(?<=[.!?])\s+/;
    let foundEvidence = [];

    const MAX_ARTICLES = 15;
    const MAX_EVIDENCE = 5;
    const RATE_LIMIT_DELAY = 350;

    try {
        // --- ✅ Step 1: Europe PMC Search including FULL TEXT ---
        const epmcQuery = `${gene} AND (${API_QUERY_KEYWORDS.join(" OR ")}) AND (OPEN_ACCESS:Y OR FULL_TEXT:Y)`;
        const epmcResp = await fetch(
            `${EUROPE_PMC_URL}?query=${encodeURIComponent(epmcQuery)}&resultType=core&format=json&pageSize=40`
        );

        if (epmcResp.ok) {
            const epmcData = await epmcResp.json();
            const epmcResults = epmcData.resultList?.result || [];

            for (const r of epmcResults) {
                if (foundEvidence.length >= MAX_EVIDENCE) break;

                // ✅ Prefer fullText if available
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

        // --- Step 2: PubMed + PMC (unchanged but cleaned) ---
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


// --- Heatmap Visualization ---

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
window.renderExpressionHeatmap = renderExpressionHeatmap; // New exposure
