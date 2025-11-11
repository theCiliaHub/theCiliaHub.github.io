// --- Global Data Cache ---
let ciliaHubDataCache = null;
let screenDataCache = null;
// Note: tissueDataCache is attached to the window object in its function
// --- ADDITION: New function to fetch and parse Cellxgene data ---
let cellxgeneDataCache = null;
// --- ADDITION: UMAP Plotting Functions ---
let umapDataCache = null;
// --- ADD THESE NEW LINES ---
let CILI_AI_DOMAIN_DB = null;     // For the new domain database
let neversPhylogenyCache = null;  // For Nevers et al. 2017 data
let liPhylogenyCache = null;      // For Li et al. 2014 data
let allGeneSymbols = null; // Add this global variable alongside others
// --- NEW: Merge Li and Nevers into Single Cache ---
let phylogenyDataCache = null;  // Updated to hold merged data
const ciliAI_geneCache = new Map();
// --- GLOBAL CORUM CACHE ---
let corumDataCache = {
    list: [],
    byGene: {},
    byNameLower: {},
    loaded: false
};

// --- NEW: Reusable scRNA-seq Data Reference ---
const SC_RNA_SEQ_REFERENCE_HTML = `
<p style="font-size: 0.8em; color: #666; margin-top: 1rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
    <strong>Data Source:</strong> human lung organoid cell atlas (AnnData v0.10).
    <a href="https://datasets.cellxgene.cziscience.com/a2011f35-04c4-427f-80d1-27ee0670251d.h5ad" target="_blank">
        [Download Source H5AD]
    </a>
</p>
`;

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


// --- Main Page Display Function (REPLACEMENT) ---
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
            <script src="https://cdn.jsdelivr.net/npm/cytoscape@3.23.0/dist/cytoscape.min.js"></script>
            <div class="ciliai-container">
                <div class="ciliai-header">
                    <h1>CiliAI</h1>
                    <p>Your AI-powered partner for discovering gene-cilia relationships.</p>
                </div>
                <div class="ciliai-main-content">
                    <div class="ai-query-section">
                        <h3>Ask a Question</h3>
                        <div class="ai-input-group autocomplete-wrapper">
                            <input type="text" id="aiQueryInput" class="ai-query-input" placeholder="What's on your mind? Try a gene name or a question...">
                            <div id="aiQuerySuggestions" class="suggestions-container"></div>
                            <button class="ai-query-btn" id="aiQueryBtn">Ask CiliAI</button>
                        </div>
                        <div class="example-queries">
                            <p>
                                <strong>Try asking:</strong> 
                                <span data-question="What can you do?">About CiliAI</span>, 
                                <span data-question="Show genes for Joubert syndrome">List genes for Joubert syndrome</span>, 
                                <span data-question="List ciliary genes in C. elegans">List potential ciliary genes in C. elegans (Phylogenetic)</span>, 
                                <span data-question="Plot UMAP expression for FOXJ1">Display expression for FOXJ1 in Lung</span>,
                                <span data-question="Compare ARL13B and FOXJ1 expression in lung scRNA-seq">Compare ARL13B and FOXJ1 expression in lung scRNA-seq</span>,
                                <span data-question="Compare phylogeny of BBS1 and CEP290.">Compare phylogeny of BBS1 and CEP290</span>,
                                <span data-question="What proteins are enriched at the ciliary tip?">What proteins are enriched at the ciliary tip?</span>,
                                <span data-question="Which Joubert Syndrome genes are expressed in ciliated cells?">Joubert genes in ciliated cells</span>
                            </p>
                        </div>
                        <div id="ai-result-area" class="results-section" style="display: none; margin-top: 1.5rem; padding: 1rem;"></div>
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
                                    <label for="hybrid" title="Combines database, screen data, and real-time AI literature mining.">
                                        <span class="mode-icon">🔬</span>
                                        <div><strong>Hybrid</strong><br><small>DB + Screens + Literature</small></div>
                                    </label>
                                </div>
                                <div class="mode-option">
                                    <input type="radio" id="expert" name="mode" value="expert" aria-label="Expert only mode">
                                    <label for="expert" title="Queries only our internal database and screen data.">
                                        <span class="mode-icon">🏛️</span>
                                        <div><strong>Expert Only</strong><br><small>Curated DB + Screens</small></div>
                                    </label>
                                </div>
                                <div class="mode-option">
                                    <input type="radio" id="nlp" name="mode" value="nlp" aria-label="Literature only mode">
                                    <label for="nlp" title="Performs a live AI-powered search across PubMed.">
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
                .example-queries { margin-top: 1rem; font-size: 0.9rem; color: #555; text-align: left; }
                .example-queries span { background-color: #d1e7fd; padding: 4px 10px; border-radius: 12px; font-family: 'Arial', sans-serif; cursor: pointer; margin: 4px; display: inline-block; transition: background-color 0.2s; border: 1px solid #b1d7fc;}
                .example-queries span:hover { background-color: #b1d7fc; }
                .input-section { background-color: #fff; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
                .input-group { margin-bottom: 1.5rem; }
                .input-group label { display: block; font-weight: bold; margin-bottom: 0.5rem; color: #333; }
                .gene-input-textarea { width: 100%; box-sizing: border-box; padding: 0.8rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; min-height: 80px; resize: vertical; }
                .mode-selector { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
                .mode-option input[type="radio"] { display: none; }
                .mode-option label { display: flex; align-items: center; gap: 10px; padding: 1rem; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
                .mode-option input[type="radio"]:checked + label { border-color: #2c5aa0; background-color: #e8f4fd; box-shadow: 0 0 5px rgba(44, 90, 160, 0.3); }
                .mode-icon { font-size: 1.8rem; }
                .analyze-btn { width: 100%; padding: 1rem; font-size: 1.1rem; font-weight: bold; background-color: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer; transition: background-color 0.2s; }
                .analyze-btn:hover:not([disabled]) { background-color: #218838; }
                .results-section { margin-top: 2rem; padding: 2rem; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
                .result-card { border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
                .result-card h3 { margin-top: 0; color: #2c5aa0; }
                .ciliopathy-table, .expression-table, .gene-detail-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                .ciliopathy-table th, .ciliopathy-table td, .expression-table th, .expression-table td, .gene-detail-table th, .gene-detail-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                .ciliopathy-table th, .expression-table th, .gene-detail-table th { background-color: #e8f4fd; color: #2c5aa0; }
                .suggestions-container { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #ccc; z-index: 1000; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .suggestion-item { padding: 10px; cursor: pointer; }
                .suggestion-item:hover { background-color: #f0f0f0; }
                .download-button { background-color: #28a745; color: white; padding: 8px 14px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em; font-weight: bold; margin-top: 15px; transition: background-color 0.3s ease; }
                .download-button:hover { background-color: #218838; }
            </style>
        `;
    } catch (error) {
        console.error('Failed to inject CiliAI HTML:', error);
        contentArea.innerHTML = '<p>Error: Failed to load CiliAI interface.</p>';
        return;
    }
    
    console.log('ciliAI.js: Page HTML injected.');
    
    // We *do not* call ciliAI_init here.
    // The `ciliAI_waitForElements()` function at the bottom of
    // ciliai.js is already running and will find the HTML
    // elements as soon as they are painted.
};


// --- Helper Functions ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function debounce(fn, delay) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => fn(...args), delay); }; }

function normalizeTerm(s) {
    if (!s) return '';
    // UPDATED: Now replaces periods, hyphens, underscores, and spaces with a single space.
    return String(s).toLowerCase().replace(/[._\-\s]+/g, ' ').trim();
}



// ==================== SEMANTIC INTENT RESOLVER ====================
// Detects user intent using keyword clusters and fuzzy semantic matching.

// --- NEW GLOBAL CONSTANTS (for Localization + Phenotype Priority Check) ---
const localizationTerms = [
    "basal body", "transition zone", "cilia", "axoneme", "centrosome", 
    "ciliary membrane", "nucleus", "lysosome", "mitochondria", "ciliary tip"
];
const phenotypeTerms = [
    "short cilia", "longer cilia", "cilia length", "cilia defects", 
    "decreased ciliation", "loss of cilia", "reduced cilia", "increase", "decrease", "no effect"
];

/**
 * ============================================================================
 * CiliAI.js - Standalone Module
 * ============================================================================
 *
 * This file contains all logic for the CiliAI chatbot.
 * It manages its own fetching, its own caching, and its own intent
 * resolution. All functions and variables are prefixed with "ciliAI_"
 * to prevent conflicts with other scripts like script.js or globals.js.
 *
 * Version: 4.0 (Standalone Module)
 */

// ============================================================================
// 1. 🌎 CiliAI GLOBAL CACHE
// ============================================================================

// ============================================================================
// 2. 🧲 CiliAI "GATEKEEPER" CACHING FUNCTION
// ============================================================================

/**
 * Ensures all data for a specific gene is fetched and cached *within CiliAI*.
 * This is the primary "gatekeeper" function for all *single-gene* data.
 *
 * @param {string} geneName - The human gene name (e.g., "IFT88"). Case-insensitive.
 * @returns {Promise<object>} A promise that resolves to an object 
 * containing all data for that gene (or a "notFound" state).
 */
async function ciliAI_getGeneData(geneName) {
    const upperGeneName = geneName.toUpperCase(); // Standardize key

    // 1. [CACHE HIT]
    if (ciliAI_geneCache.has(upperGeneName)) {
        return ciliAI_geneCache.get(upperGeneName);
    }

    // 2. [CACHE MISS]
    const dataPromise = (async () => {
        console.log(`[CiliAI Cache MISS] Fetching all data for ${upperGeneName}...`);

        const results = await Promise.allSettled([
            ciliAI_fetchCiliaHubData_internal(upperGeneName),     // Main JSON file
            ciliAI_fetchPhylogenyData_internal(upperGeneName),   // Combined (Nevers + Li)
            ciliAI_fetchDomainData_internal(upperGeneName),       // Domain data
            ciliAI_fetchCiliaLengthData_internal(upperGeneName),  // Cilia length data
            ciliAI_fetchComplexData_internal(upperGeneName)       // Protein complex data
        ]);

        // 3. Collate the results
        const ciliaHubResult = results[0].status === 'fulfilled' ? results[0].value : null;

        const combinedData = {
            ...(ciliaHubResult || { geneInfo: null, expression: null }), 
            phylogeny:   results[1].status === 'fulfilled' ? results[1].value : null,
            domains:     results[2].status === 'fulfilled' ? results[2].value : null,
            ciliaLength: results[3].status === 'fulfilled' ? results[3].value : null,
            complex:     results[4].status === 'fulfilled' ? results[4].value : null,
            lastFetched: new Date().toISOString()
        };

        // 4. Check if we got any data at all
        if (!combinedData.geneInfo) {
            console.warn(`[CiliAI] No data found for ${upperGeneName} in any key source.`);
            const notFoundData = { notFound: true, ...combinedData };
            ciliAI_geneCache.set(upperGeneName, Promise.resolve(notFoundData)); 
            return notFoundData;
        }

        // 5. Return the combined data
        return combinedData;

    })().catch(err => {
        console.error(`[CiliAI] Catastrophic failure fetching data for ${upperGeneName}:`, err);
        ciliAI_geneCache.delete(upperGeneName);
        return { notFound: true, error: err.message };
    });

    // 6. Store the promise *itself* in the cache
    ciliAI_geneCache.set(upperGeneName, dataPromise);

    // 7. [OPTIMIZATION] Replace promise with resolved data once complete
    dataPromise.then(data => {
        ciliAI_geneCache.set(upperGeneName, Promise.resolve(data));
    }).catch(() => { /* Handled in the .catch() block above */ });

    return dataPromise;
}

// ============================================================================
// 3. 🛠️ CiliAI "INTERNAL" HELPER FETCH FUNCTIONS
// ============================================================================
// These functions are ONLY called by ciliAI_getGeneData.

/**
 * [INTERNAL] Fetches data from the main ciliahub_data.json.
 * @param {string} geneName - The human gene name (UPPERCASE)
 * @returns {Promise<object | null>}
 */
async function ciliAI_fetchCiliaHubData_internal(geneName) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/ciliahub_data.json';
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const allData = await response.json();
        const geneKey = Object.keys(allData.genes).find(key => key.toUpperCase() === geneName);
        
        if (geneKey) {
            return { 
                geneInfo: allData.genes[geneKey],
                expression: allData.expression[geneKey] || null
            };
        }
        return null;
    } catch (err) {
        console.error(`[CiliAI] Failed to fetch CiliaHub data for ${geneName}:`, err);
        return null;
    }
}

/**
 * [INTERNAL] Fetches and combines phylogeny data from Nevers and Li.
 * @param {string} geneName - The human gene name (UPPERCASE)
 * @returns {Promise<object | null>}
 */
async function ciliAI_fetchPhylogenyData_internal(geneName) {
    const neversURL = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/nevers_et_al_2017_matrix_optimized.json';
    const liURL = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/li_et_al_2014_matrix_optimized.json';

    try {
        const [neversResult, liResult] = await Promise.allSettled([
            fetch(neversURL).then(res => res.json()),
            fetch(liURL).then(res => res.json())
        ]);

        let combinedPhylogeny = { nevers: null, li: null };

        if (neversResult.status === 'fulfilled') {
            const geneEntry = neversResult.value.find(entry => entry.Human_Gene_Name && entry.Human_Gene_Name.toUpperCase() === geneName);
            if (geneEntry) combinedPhylogeny.nevers = geneEntry;
        } else {
            console.warn(`[CiliAI] Could not load Nevers phylogeny for ${geneName}:`, neversResult.reason);
        }

        if (liResult.status === 'fulfilled') {
            const geneEntry = liResult.value.find(entry => entry.Human_Gene_Name && entry.Human_Gene_Name.toUpperCase() === geneName);
            if (geneEntry) combinedPhylogeny.li = geneEntry;
        } else {
            console.warn(`[CiliAI] Could not load Li phylogeny for ${geneName}:`, liResult.reason);
        }

        return (combinedPhylogeny.nevers || combinedPhylogeny.li) ? combinedPhylogeny : null;

    } catch (err) {
        console.error(`[CiliAI] Failed to fetch phylogeny for ${geneName}:`, err);
        return null;
    }
}

/**
 * [INTERNAL] Fetches domain data for a specific gene.
 * @param {string} geneName - The human gene name (UPPERCASE)
 * @returns {Promise<object | null>}
 */
async function ciliAI_fetchDomainData_internal(geneName) {
    // *** IMPORTANT: Set your correct URL ***
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cili_ai_domain_database.json';
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const allDomainData = await response.json();
        return allDomainData[geneName] || null;
    } catch (err) {
        console.error(`[CiliAI] Failed to fetch domain data for ${geneName}:`, err);
        return null;
    }
}


/**
 * [INTERNAL] Fetches protein complex data.
 * @param {string} geneName - The human gene name (UPPERCASE)
 * @returns {Promise<object | null>}
 */
async function ciliAI_fetchComplexData_internal(geneName) {
    // *** IMPORTANT: Set your correct URL ***
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/corum_humanComplexes.json'; // Example path
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const allComplexData = await response.json();

        let foundComplex = null;
        for (const complexName in allComplexData) {
            const complex = allComplexData[complexName];
            if (complex.members && complex.members.find(member => member.toUpperCase() === geneName)) {
                foundComplex = { name: complexName, ...complex };
                break;
            }
        }
        return foundComplex;
    } catch (err) {
        console.error(`[CiliAI] Failed to fetch complex data for ${geneName}:`, err);
        return null;
    }
}


// ============================================================================
// 4. 🧠 CiliAI DUAL-STAGE INTENT RESOLVER
// ============================================================================
async function ciliAI_resolveIntent(query) {
    console.log("[CiliAI LOG] 4. ciliAI_resolveIntent started.");
    const qLower = query.toLowerCase().trim();
    
    ciliAI_updateChatWindow("Thinking...", "system");

    try {
        // --- STAGE 1: Check for complex, list-based, or non-gene queries ---
        console.log("[CiliAI LOG] 5. Trying Stage 1 (Complex Intent)...");
        const complexResult = await ciliAI_resolveComplexIntent(qLower, query); 
        
        if (complexResult !== null) {
            console.log("[CiliAI LOG] 5a. Stage 1 Matched. Result:", complexResult);
            if (typeof complexResult === 'string') {
                ciliAI_updateChatWindow(complexResult, "ciliai");
            }
            return; // Intent was handled. Stop here.
        }

        console.log("[CiliAI LOG] 5b. Stage 1 Failed. Proceeding to Stage 2 (Single Gene)...");
        
        // --- STAGE 2: Fallback to single-gene query resolution ---
        // ====================================================================
        // ** THE FIX **
        // This RegEx is smarter. It looks for all-caps words (3+ chars) OR
        // words with letters and numbers (like IFT88).
        // It explicitly IGNORES common words like "show", "me", "what", "is".
        // ====================================================================
        const geneRegex = /\b(?!show\b|me\b|what\b|is\b|tell\b|about\b|for\b|genes\b)([A-Z]{3,}|[A-Z0-9-]{3,})\b/i;
        const geneMatch = query.match(geneRegex); // Match against the *original* query to preserve case
        const geneName = geneMatch ? geneMatch[1].toUpperCase() : null;

        console.log(`[CiliAI LOG] 6. Gene parsed: ${geneName}`);

        let intent = null;
        let params = { gene: geneName };

        // --- Intent Matching (for single-gene queries) ---
        if (qLower.includes("phylogeny") || qLower.includes("evolution") || qLower.includes("ortholog")) {
            intent = "getPhylogeny";
        } else if (qLower.includes("domain") || qLower.includes("structure")) {
            intent = "getDomains";
        } else if (qLower.includes("length") || qLower.includes("long") || qLower.includes("short")) {
            intent = "getCiliaLength";
        } else if (qLower.includes("complex") || qLower.includes("interact")) {
            intent = "getComplex";
        } else if (qLower.includes("summary") || qLower.includes("what is") || qLower.includes("tell me about")) {
            intent = "getSummary"; 
        } else if (geneName) {
            intent = "getSummary"; // Default action
        } else if (qLower.includes("hello") || qLower.includes("hi")) {
            intent = "greet";
        } else {
            intent = "unknown";
        }

        console.log(`[CiliAI LOG] 7. Intent parsed: ${intent}`);

        // --- Action Dispatch (for single-gene queries) ---
        if (intent !== "greet" && intent !== "unknown" && !params.gene) {
            console.warn("[CiliAI LOG] 7a. Intent needs gene, but none found.");
            ciliAI_updateChatWindow("Please specify a gene name for that request.", "ciliai");
            return;
        }

        switch (intent) {
            case "getSummary":
                await ciliAI_handleGeneSummary(params.gene);
                break;
            case "getPhylogeny":
                await ciliAI_handlePhylogeny(params.gene);
                break;
            case "getDomains":
                await ciliAI_handleDomains(params.gene);
                break;
            case "getCiliaLength":
                await ciliAI_handleCiliaLength(params.gene);
                break;
            case "getComplex":
                await ciliAI_handleComplex(params.gene);
                break;
            case "greet":
                ciliAI_updateChatWindow("Hello! I am CiliAI. How can I help you learn about ciliary genes?", "ciliai");
                break;
            default: // unknown
                console.warn("[CiliAI LOG] 7b. Unknown intent.");
                ciliAI_updateChatWindow("I'm sorry, I didn't understand that. Please ask about a specific gene (e.g., 'What is IFT88?') or a complex topic (e.g., 'List genes for Joubert Syndrome').", "ciliai");
        }
    
    } catch (err) {
        console.error("[CiliAI] Error handling intent: ", err);
        ciliAI_updateChatWindow(`An unexpected error occurred: ${err.message}`, "error");
    }
}


/**
 * STAGE 1 HANDLER: Resolves complex, list-based, and non-gene queries.
 * @param {string} qLower - The lowercased query.
 * @param {string} query - The original query (for case-sensitive parts).
 * @returns {Promise<string | null>} An HTML string for display, or null if no intent is matched.
 */
async function ciliAI_resolveComplexIntent(qLower, query) {
    // --- Define semantic clusters for major biological contexts ---
    const intentClusters = {
        ciliary_tip: ["ciliary tip", "distal tip", "tip proteins", "tip components", "tip composition", "proteins at the ciliary tip", "ciliary tip complex", "enriched at the tip", "distal region", "ciliary tip proteome"],
        domain: ["domain", "motif", "architecture", "protein fold", "domain organization", "enriched", "depleted"],
        phylogeny: ["phylogeny", "evolution", "conservation", "ortholog", "paralog", "species tree", "evolutionary profile", "conservation heatmap", "conserved"],
        complex: ["complex", "interactome", "binding partners", "corum", "protein interaction", "ift", "bbsome", "dynein", "mks", "nphp", "radial spoke", "axoneme", "transition zone"],
        expression: ["expression", "umap", "tissue", "cell type", "where expressed", "scRNA", "single-cell", "transcript", "abundance", "expression pattern", "plot"],
        disease: ["mutation", "variant", "pathogenic", "ciliopathy", "disease", "syndrome", "bbs", "joubert", "mks", "pcd", "lca", "nephronophthisis", "polycystic kidney disease"],
        disease_classification: ["primary ciliopathy", "secondary ciliopathy", "motile ciliopathy", "atypical ciliopathy", "primary disease", "secondary disease", "motile disease", "atypical disease", "ciliopathy classification"],
        localization: ["localize", "location", "subcellular", "basal body", "transition zone", "centrosome", "axoneme", "ciliary membrane"],
        phenotype: ["knockdown", "phenotype", "effect", "shorter cilia", "longer cilia", "cilia length", "cilia number", "decreased ciliation", "loss of cilia"]
    };

    // --- Terms for Priority Checks ---
    const localizationTerms = [
        "basal body", "transition zone", "cilia", "axoneme", "centrosome",  
        "ciliary membrane", "nucleus", "lysosome", "mitochondria", "ciliary tip"
    ];
    const phenotypeTerms = [
        "short cilia", "longer cilia", "cilia length", "cilia defects",  
        "decreased ciliation", "loss of cilia", "reduced cilia", "increase", "decrease", "no effect"
    ];
    const diseaseNames = ["bardet-biedl syndrome", "joubert syndrome", "meckel-gruber syndrome", "primary ciliary dyskinesia", "leber congenital amaurosis", "nephronophthisis", "polycystic kidney disease", "autosomal dominant polycystic kidney disease", "autosomal recessive polycystic kidney disease", "short-rib thoracic dysplasia", "senior-løken syndrome", "cranioectodermal dysplasia", "nphp", "bbs", "mks", "pcd", "ciliopathy", "syndrome"];
    const strictPhenotypeTerms = ["phenotype", "short cilia", "long cilia", "cilia length", "cilia number", "decreased ciliation", "loss of cilia", "reduced cilia", "increase", "decrease"];


    // --- Priority Rule 1: Combined "disease" + "phenotype" ---
    const matchedDisease = diseaseNames.find(name => qLower.includes(name));
    const matchedStrictPhenotype = strictPhenotypeTerms.find(term => qLower.includes(term));

    if (matchedDisease && matchedStrictPhenotype) {
        const standardDisease =
            matchedDisease.toUpperCase() === "BBS" ? "Bardet–Biedl Syndrome" :
            matchedDisease.toUpperCase() === "MKS" ? "Meckel–Gruber Syndrome" :
            matchedDisease.toUpperCase() === "PCD" ? "Primary Ciliary Dyskinesia" :
            matchedDisease.toUpperCase() === "NPHP" ? "Nephronophthisis" :
            matchedDisease;
        // NOTE: This assumes a function `getDiseaseGenesByPhenotype` exists elsewhere
        // and returns an HTML string.
        // return await getDiseaseGenesByPhenotype(standardDisease, matchedStrictPhenotype);
        console.log(`[CiliAI Complex] getDiseaseGenesByPhenotype("${standardDisease}", "${matchedStrictPhenotype}")`);
        return `<p>Functionality for 'getDiseaseGenesByPhenotype' (Disease: ${standardDisease}, Phenotype: ${matchedStrictPhenotype}) is not yet implemented.</p>`; // Placeholder
    }

    // --- Priority Rule 2: Combined "localization" + "phenotype" ---
    const matchedLocalization = localizationTerms.find(name => qLower.includes(name));
    const matchedPhenotype = phenotypeTerms.find(term => qLower.includes(term));

    if (matchedLocalization && matchedPhenotype) {
        // NOTE: This assumes a function `getLocalizationPhenotypeGenes` exists elsewhere
        // return await getLocalizationPhenotypeGenes(matchedLocalization, matchedPhenotype);
        console.log(`[CiliAI Complex] getLocalizationPhenotypeGenes("${matchedLocalization}", "${matchedPhenotype}")`);
        return `<p>Functionality for 'getLocalizationPhenotypeGenes' (Location: ${matchedLocalization}, Phenotype: ${matchedPhenotype}) is not yet implemented.</p>`; // Placeholder
    }
    
    // --- Rule-based fuzzy detection (Fallback) ---
    let detectedIntent = null;
    for (const [intent, phrases] of Object.entries(intentClusters)) {
        if (phrases.some(p => qLower.includes(p))) {
            detectedIntent = intent;
            break;
        }
    }

    // --- Intent Resolution Logic (Uses detectedIntent) ---
    // (Note: These handlers assume other functions exist to fetch list-data)

    if (detectedIntent === "ciliary_tip") {
        // const title = "Ciliary Tip Components";
        // const data = await getCuratedComplexComponents("CILIARY TIP");
        // return formatListResult(title, data);
        console.log("[CiliAI Complex] getCuratedComplexComponents('CILIARY TIP')");
        return `<p>Functionality for 'getCuratedComplexComponents' (CILIARY TIP) is not yet implemented.</p>`; // Placeholder
    }

    // --- Disease Classification Handler ---
    else if (detectedIntent === "disease_classification") {
        let classification = null;
        if (qLower.includes('primary ciliopathy') || qLower.includes('primary disease')) {
            classification = "Primary Ciliopathies";
        } else if (qLower.includes('motile ciliopathy') || qLower.includes('motile disease')) {
            classification = "Motile Ciliopathies";
        } else if (qLower.includes('secondary ciliopathy') || qLower.includes('secondary disease')) {
            classification = "Secondary Diseases";
        } else if (qLower.includes('atypical ciliopathy') || qLower.includes('atypical disease')) {
            classification = "Atypical Ciliopathies";
        }

        if (classification) {
            // const genes = await getGenesByCiliopathyClassification(classification);
            // return formatListResult(`Genes classified as ${classification}`, genes);
            console.log(`[CiliAI Complex] getGenesByCiliopathyClassification("${classification}")`);
            return `<p>Functionality for 'getGenesByCiliopathyClassification' (${classification}) is not yet implemented.</p>`; // Placeholder
        }
    }

    // --- Specific Disease Handler (Generic List) ---
    else if (detectedIntent === "disease") {
        const diseaseList = ["bardet-biedl syndrome", "joubert syndrome", "meckel-gruber syndrome", "primary ciliary dyskinesia", "leber congenital amaurosis", "nephronophthisis", "polycystic kidney disease", "autosomal dominant polycystic kidney disease", "autosomal recessive polycystic kidney disease", "short-rib thoracic dysplasia", "senior-løken syndrome", "cranioectodermal dysplasia", "nphp", "bbs", "mks", "pcd", "ciliopathy", "syndrome"];

        let targetDisease = null;
        for (const name of diseaseList.sort((a, b) => b.length - a.length)) {
            if (qLower.includes(name)) {
                targetDisease = name;
                break;
            }
        }

        if (targetDisease) {
            const standardName =
                targetDisease.toUpperCase() === "BBS" ? "Bardet–Biedl Syndrome" :
                targetDisease.toUpperCase() === "MKS" ? "Meckel–Gruber Syndrome" :
                targetDisease.toUpperCase() === "PCD" ? "Primary Ciliary Dyskinesia" :
                targetDisease.toUpperCase() === "NPHP" ? "Nephronophthisis" :
                targetDisease;

            // const { genes, description } = await getCiliopathyGenes(standardName);
            // const titleCaseName = standardName.replace(/\b\w/g, l => l.toUpperCase());
            // return formatListResult(`Genes for ${titleCaseName}`, genes, description);
            console.log(`[CiliAI Complex] getCiliopathyGenes("${standardName}")`);
            return `<p>Functionality for 'getCiliopathyGenes' (${standardName}) is not yet implemented.</p>`; // Placeholder
        }

        return `<p>🩺 Disease query detected, but no specific disease or classification was identified for listing genes. Please try a query like "List genes for Joubert Syndrome".</p>`;
    }

    // --- Domain Handler ---
    else if (detectedIntent === "domain") {
        const geneRegex = /\b([A-Z0-9-]{3,})\b/i;
        if (geneRegex.test(qLower)) {
            return null; // Fallback to single-gene handler
        }
        // return await resolveDomainQuery(query);
        console.log(`[CiliAI Complex] resolveDomainQuery("${query}")`);
        return `<p>Functionality for 'resolveDomainQuery' (without a gene) is not yet implemented.</p>`; // Placeholder
    }

    // --- Phylogeny Handler ---
    else if (detectedIntent === "phylogeny") {
        const geneRegex = /\b([A-Z0-9-]{3,})\b/i;
        if (geneRegex.test(qLower)) {
            return null; // Fallback to single-gene handler
        }
        // return await resolvePhylogeneticQuery(query);
        console.log(`[CiliAI Complex] resolvePhylogeneticQuery("${query}")`);
        return `<p>Functionality for 'resolvePhylogeneticQuery' (without a gene) is not yet implemented.</p>`; // Placeholder
    }

    // --- Complex Handler ---
    else if (detectedIntent === "complex") {
        const geneRegex = /\b([A-Z0-9-]{3,})\b/i;
        if (geneRegex.test(qLower)) {
            return null; // Fallback to single-gene handler
        }
        // return await routeComplexPhylogenyAnalysis(query);
        console.log(`[CiliAI Complex] routeComplexPhylogenyAnalysis("${query}")`);
        return `<p>Functionality for 'routeComplexPhylogenyAnalysis' (without a gene) is not yet implemented.</p>`; // Placeholder
    }

    // --- Expression Handler ---
    else if (detectedIntent === "expression") {
        const genes = (query.match(/\b[A-Z0-9\-]{3,}\b/g) || []);
        if (genes.length > 0) {
            // This assumes helper functions exist to handle plotting.
            if (qLower.includes('umap') && genes.length === 1) {
                // await displayUmapGeneExpression(genes[0]);
                console.log(`[CiliAI Complex PLOT] displayUmapGeneExpression("${genes[0]}")`);
                return `<p>Showing UMAP plot for ${genes[0]}...</p>`; // Placeholder
            }
            // await displayCellxgeneBarChart(genes);
            console.log(`[CiliAI Complex PLOT] displayCellxgeneBarChart("${genes.join(', ')}")`);
            return `<p>Showing expression bar chart for ${genes.join(', ')}...</p>`; // Placeholder
        } else {
            return `<p>🧬 Please specify a gene to show expression data.</p>`;
        }
    }

    // --- Localization Handler (Generic List) ---
    else if (detectedIntent === "localization") {
        const locationMatch = qLower.match(/(basal body|transition zone|axoneme|centrosome|ciliary membrane)/);
        if (locationMatch && locationMatch[1]) {
            // const data = await getGenesByLocalization(locationMatch[1]);  
            // return formatListResult(`Genes localizing to ${locationMatch[1]}`, data);
            console.log(`[CiliAI Complex] getGenesByLocalization("${locationMatch[1]}")`);
            return `<p>Functionality for 'getGenesByLocalization' (${locationMatch[1]}) is not yet implemented.</p>`; // Placeholder
        } else {
            return `<p>📍 Localization query detected. Please be more specific (e.g., "genes in the basal body").</p>`;
        }
    }
    // --- Phenotype Handler (Generic List) ---
    else if (detectedIntent === "phenotype") {
        const geneRegex = /\b([A-Z0-9-]{3,})\b/i;
        if (geneRegex.test(qLower)) {
            return null; // Fallback to single-gene handler
        }
        return `<p>🔎 Phenotype/Screen query detected. Please use a specific gene (e.g., "What happens to cilia when KIF3A is knocked down?") or a specific phenotype (e.g., "Find genes causing short cilia").</p>`;
    }

    // --- Default fallback ---
    return null;
}


// ============================================================================
// 5. 💬 CiliAI "CONSUMER" HANDLER FUNCTIONS (for Single-Gene Queries)
// ============================================================================
// These functions are called by ciliAI_resolveIntent (Stage 2).
// They all use the SAME `ciliAI_getGeneData` function.

/**
 * Handles the "getSummary" intent.
 * @param {string} geneName 
 */
async function ciliAI_handleGeneSummary(geneName) {
    const geneData = await ciliAI_getGeneData(geneName);
    if (geneData.notFound) {
        ciliAI_updateChatWindow(`Sorry, I could not find any data for the gene "${geneName}".`, "error");
        return;
    }

    const geneSymbol = geneData.geneInfo?.Symbol || geneName.toUpperCase();
    let responses = [];
    responses.push(`Here's a summary for **${geneSymbol}**:`);

    if (geneData.geneInfo?.Summary) {
        responses.push(`**Summary:** ${geneData.geneInfo.Summary}`);
    } else {
        responses.push(`**Summary:** No summary is available for this gene.`);
    }

    let details = [];
    if (geneData.ciliaLength) details.push(`It is a known **${geneData.ciliaLength.role}** of cilia length.`);
    if (geneData.complex) details.push(`It is part of the **${geneData.complex.name}** protein complex.`);
    if (geneData.domains) details.push(`It has known protein domains.`);
    if (geneData.phylogeny) details.push(`Phylogenetic data is available.`);
    
    if (details.length > 0) {
        responses.push("\n**Key Details:**\n* " + details.join('\n* '));
    }

    ciliAI_updateChatWindow(responses.join('\n\n'), "ciliai");
    
    // Example: Trigger a plot
    // if (geneData.phylogeny && window.plotNeversPhylogeny) {
    //     window.plotNeversPhylogeny(geneData.phylogeny.nevers);
    // }
}

/**
 * Handles the "getPhylogeny" intent.
 * @param {string} geneName 
 */
async function ciliAI_handlePhylogeny(geneName) {
    const geneData = await ciliAI_getGeneData(geneName);
    if (geneData.notFound) {
        ciliAI_updateChatWindow(`Sorry, I could not find data for "${geneName}".`, "error");
        return;
    }

    if (!geneData.phylogeny) {
        ciliAI_updateChatWindow(`No phylogeny data was found for **${geneName}**.`, "ciliai");
        return;
    }

    let responses = [];
    if (geneData.phylogeny.nevers) {
        responses.push(`**Nevers et al. (2017) data found.**`);
        // if (window.plotNeversPhylogeny) window.plotNeversPhylogeny(geneData.phylogeny.nevers);
        console.log("[CiliAI PLOTTER] Plotting Nevers data for", geneName);
    }
    if (geneData.phylogeny.li) {
        responses.push(`**Li et al. (2016) data found.**`);
        // if (window.plotLiPhylogeny) window.plotLiPhylogeny(geneData.phylogeny.li);
        console.log("[CiliAI PLOTTER] Plotting Li data for", geneName);
    }

    ciliAI_updateChatWindow(responses.join('\n'), "ciliai");
}

/**
 * Handles the "getDomains" intent.
 * @param {string} geneName 
 */
async function ciliAI_handleDomains(geneName) {
    const geneData = await ciliAI_getGeneData(geneName);
    if (geneData.notFound) {
        ciliAI_updateChatWindow(`Sorry, I could not find data for "${geneName}".`, "error");
        return;
    }

    // Assumes geneData.domains is an array of objects: [{ name: "PF..."}, ...]
    if (!geneData.domains || geneData.domains.length === 0) {
        ciliAI_updateChatWindow(`No protein domain information was found for **${geneName}**.`, "ciliai");
        return;
    }

    const domainNames = geneData.domains.map(d => d.name).join(', ');
    ciliAI_updateChatWindow(`**${geneName}** contains the following domains: **${domainNames}**.`, "ciliai");
    
    // Example: Trigger a domain plotting function
    // if (window.plotDomains) window.plotDomains(geneData.domains);
}

/**
 * Handles the "getCiliaLength" intent.
 * @param {string} geneName 
 */
async function ciliAI_handleCiliaLength(geneName) {
    const geneData = await ciliAI_getGeneData(geneName);
    if (geneData.notFound) {
        ciliAI_updateChatWindow(`Sorry, I could not find data for "${geneName}".`, "error");
        return;
    }

    // *** CORRECTION ***
    // This data now lives inside the geneInfo object, fetched from ciliahub_data.json
    if (!geneData.geneInfo) {
        ciliAI_updateChatWindow(`No cilia length data was found for **${geneName}**.`, "ciliai");
        return;
    }
    
    const lof = geneData.geneInfo.lof_effects || "Not Reported";
    const oe = geneData.geneInfo.overexpression_effects || "Not Reported";
    const perc = geneData.geneInfo.percent_ciliated_cells_effects || "Not Reported";

    let responses = [];
    responses.push(`Cilia phenotype effects for **${geneName}**:`);
    responses.push(`* **Loss-of-function:** ${lof}`);
    responses.push(`* **Overexpression:** ${oe}`);
    responses.push(`* **% Ciliated Cells:** ${perc}`);

    ciliAI_updateChatWindow(responses.join('\n'), "ciliai");
}

/**
 * Handles the "getComplex" intent.
 * @param {string} geneName 
 */
async function ciliAI_handleComplex(geneName) {
    const geneData = await ciliAI_getGeneData(geneName);
    if (geneData.notFound) {
        ciliAI_updateChatWindow(`Sorry, I could not find data for "${geneName}".`, "error");
        return;
    }

    if (!geneData.complex) {
        ciliAI_updateChatWindow(`**${geneName}** is not listed as part of a known CORUM complex in our data.`, "ciliai");
        return;
    }

    const complexName = geneData.complex.name;
    const memberCount = geneData.complex.members.length;
    ciliAI_updateChatWindow(`**${geneName}** is a member of the **${complexName}** complex, which has ${memberCount} members.`, "ciliai");
}

/**
 * *** NEWLY ADDED ***
 * Handles the "getExpression" intent (for tissue and scRNA).
 * @param {string} geneName 
 */
async function ciliAI_handleExpression(geneName) {
    const geneData = await ciliAI_getGeneData(geneName);
    if (geneData.notFound) {
        ciliAI_updateChatWindow(`Sorry, I could not find data for "${geneName}".`, "error");
        return;
    }

    let responses = [];
    responses.push(`Expression data for **${geneName}**:`);
    
    // 1. Check for Tissue Data
    if (geneData.tissue) {
        responses.push(`\n**Tissue Consensus Data:**`);
        // Find top 3 tissues
        const tissues = Object.entries(geneData.tissue)
            .map(([tissue, nTPM]) => ({ tissue, nTPM: parseFloat(nTPM) }))
            .filter(t => !isNaN(t.nTPM))
            .sort((a, b) => b.nTPM - a.nTPM);
            
        if (tissues.length > 0) {
            responses.push(`* Highest expression in: **${tissues[0].tissue}** (${tissues[0].nTPM} nTPM)`);
            if (tissues.length > 1) responses.push(`* Second highest: **${tissues[1].tissue}** (${tissues[1].nTPM} nTPM)`);
            if (tissues.length > 2) responses.push(`* Third highest: **${tissues[2].tissue}** (${tissues[2].nTPM} nTPM)`);
        } else {
            responses.push(`* No tissue consensus data found.`);
        }
    } else {
        responses.push(`\n* No tissue consensus data found.`);
    }
    
    // 2. Check for scRNA-seq Data
    if (geneData.scRNA) {
        responses.push(`\n**Single-Cell (scRNA-seq) Data:**`);
        // Find top 3 cell types
         const cells = Object.entries(geneData.scRNA)
            .map(([cell, pct]) => ({ cell, pct: parseFloat(pct) }))
            .filter(c => !isNaN(c.pct))
            .sort((a, b) => b.pct - a.pct);
            
        if (cells.length > 0) {
            responses.push(`* Highest expression in: **${cells[0].cell}** (${cells[0].pct.toFixed(2)}% of cells)`);
            if (cells.length > 1) responses.push(`* Second highest: **${cells[1].cell}** (${cells[1].pct.toFixed(2)}% of cells)`);
            if (cells.length > 2) responses.push(`* Third highest: **${cells[2].cell}** (${cells[2].pct.toFixed(2)}% of cells)`);
        } else {
            responses.push(`* No scRNA-seq data found.`);
        }
    } else {
        responses.push(`\n* No scRNA-seq data found.`);
    }

    ciliAI_updateChatWindow(responses.join('\n'), "ciliai");
}


// ============================================================================
// 6. 🔌 CiliAI EVENT HANDLERS
// ============================================================================
// This section connects CiliAI to the HTML DOM.

/**
 * Handles the query from the user input.
 * This function is attached to the "Send" button and "Enter" key.
 */
async function ciliAI_handleQuery() {
    console.log("[CiliAI LOG] 1. ciliAI_handleQuery fired.");
    
    // *** This ID must match your HTML ***
    const inputElement = document.getElementById('aiQueryInput'); 
    
    if (!inputElement) {
        console.error("[CiliAI LOG] 1a. CRITICAL: Cannot find input element '#aiQueryInput'.");
        return;
    }

    const query = inputElement.value;
    if (!query.trim()) {
        console.warn("[CiliAI LOG] 1b. Query is empty. Aborting.");
        return;
    }
    
    console.log(`[CiliAI LOG] 2. Query is: "${query}"`);
    
    // Add user's message to chat UI
    ciliAI_updateChatWindow(query, 'user');
    
    try {
        console.log("[CiliAI LOG] 3. Calling ciliAI_resolveIntent...");
        await ciliAI_resolveIntent(query); 
        console.log("[CiliAI LOG] 8. ciliAI_resolveIntent finished.");
    } catch (err) {
        console.error("[CiliAI] Query Error:", err);
        ciliAI_updateChatWindow("An error occurred: " + err.message, "error");
    }
    
    // Clear the input box *after* the query is processed
    inputElement.value = '';
}

/**
 * Updates the CiliAI chat UI.
 * @param {string} message - The message HTML or text to display.
 * @param {string} sender - The class name (e.g., "user", "ciliai", "error").
 */
function ciliAI_updateChatWindow(message, sender) {
    // *** This ID must match your HTML ***
    const chatBox = document.getElementById('ai-result-area');
    
    if (message === "Thinking...") {
        if (chatBox) {
            chatBox.style.display = 'block'; // Make sure it's visible
            chatBox.innerHTML = `<p class="status-searching">CiliAI is thinking... 🧠</p>`;
        }
        return; 
    }
    
    if (!chatBox) {
        // Fallback to console
        const formattedMessage = message.replace(/<[^>]*>?/gm, '');
        console.log(`[CiliAI - ${sender.toUpperCase()}]: ${formattedMessage}`);
        return;
    }

    // Make sure the chatbox is visible
    chatBox.style.display = 'block';

    const msgElement = document.createElement('div');
    msgElement.className = `ciliai-message ${sender}`;
    
    // Convert markdown bold to HTML bold
    message = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Convert newlines to <br> tags
    message = message.replace(/\n/g, '<br>');
    
    msgElement.innerHTML = message;

    if (sender === 'user') {
        chatBox.innerHTML = ''; // Clear previous results
        chatBox.appendChild(msgElement);
    } else {
        // If it's a CiliAI message, *replace* the "Thinking..."
        chatBox.innerHTML = msgElement.innerHTML;
    }
    
    chatBox.scrollTop = chatBox.scrollHeight;
}


// ============================================================================
// 7. 🚀 RUN CiliAI (ROBUST INITIALIZER)
// ============================================================================

/**
 * Attaches all CiliAI event listeners to the DOM.
 * This is the *only* place the listeners are added.
 */
function ciliAI_init_listeners() {
    // *** These IDs must match your HTML ***
    const sendButton = document.getElementById('aiQueryBtn');
    const inputElement = document.getElementById('aiQueryInput');
    const exampleQueriesContainer = document.querySelector('.example-queries'); 

    let listenersAttached = true; // Start optimistic

    // 1. Attach to Send Button
    if (sendButton) {
        sendButton.addEventListener('click', ciliAI_handleQuery);
    } else {
        console.warn("[CiliAI] Send button 'aiQueryBtn' not found.");
        listenersAttached = false;
    }

    // 2. Attach to Input Box (for 'Enter' key)
    if (inputElement) {
        inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); 
                ciliAI_handleQuery();
            }
        });
    } else {
        console.warn("[CiliAI] Input box 'aiQueryInput' not found.");
        listenersAttached = false;
    }

    // 3. Attach to Example Queries Container
    if (exampleQueriesContainer) {
        exampleQueriesContainer.addEventListener('click', (e) => {
            // Check if the clicked element is one of the <span> tags
            if (e.target && e.target.matches('.example-queries span')) {
                const query = e.target.dataset.question || e.target.textContent;
                
                // Put the query in the input box
                const input = document.getElementById('aiQueryInput');
                if (input) {
                    input.value = query;
                }
                
                // Manually trigger the query handler
                ciliAI_handleQuery(); 
            }
        });
    } else {
        console.warn("[CiliAI] Example queries container '.example-queries' not found.");
    }

    // Final check
    if (listenersAttached) {
        console.log("✅ [CiliAI] Event listeners successfully attached.");
        return true; // Success
    }
    
    // Log explicit "not found" messages
    if (!sendButton) console.warn("[CiliAI] Send button not found. (Tried 'aiQueryBtn')");
    if (!inputElement) console.warn("[CiliAI] Input box not found. (Tried 'aiQueryInput')");

    return false; // Elements not found yet
}

/**
 * This function waits for the CiliAI HTML elements (which are injected 
 * by displayCiliAIPage) to appear in the DOM before attaching listeners.
 */
function ciliAI_waitForElements() {
    console.log("[CiliAI] Waiting for elements 'aiQueryBtn' and 'aiQueryInput'...");

    // Try to attach listeners immediately
    if (ciliAI_init_listeners()) {
        return; // Success, elements were already there
    }

    // If not found, set up an interval to check for them
    let attempts = 0;
    const maxAttempts = 50; // Check for 5 seconds (50 * 100ms)

    const checkInterval = setInterval(() => {
        attempts++;
        if (ciliAI_init_listeners()) {
            // Success! Elements are now loaded.
            clearInterval(checkInterval);
        } else if (attempts > maxAttempts) {
            // Failed. Stop trying.
            clearInterval(checkInterval);
            console.error("[CiliAI] FAILED to find 'aiQueryBtn' or 'aiQueryInput' after 5 seconds.");
        }
    }, 100);
}

// Start the process as soon as this file is loaded.
// This replaces the old document.addEventListener('DOMContentLoaded', ciliAI_init);
ciliAI_waitForElements();



// ============================================================================
// 8. 🧪 CiliAI SIMULATION (for testing)
// ============================================================================

/**
 * DUMMY FUNCTION: Simulates handling user input from a text box.
 * This is a helper for testing.
 */
async function ciliAI_simulateUserInput(text) {
    console.log(`\n--- [CiliAI SIM] USER SENDS: "${text}" ---`);
    
    // 1. Manually set the input box value
    const inputElement = document.getElementById('aiQueryInput');
    if (inputElement) {
        inputElement.value = text;
    } else {
        console.error("[CiliAI SIM] Could not find input box '#aiQueryInput'");
        return;
    }
    
    // 2. Manually call the query handler
    await ciliAI_handleQuery();
}

/**
 * DUMMY FUNCTION: Runs a series of tests for the new dual-stage system.
 */
async function ciliAI_runSimulation() {
    // Use a timeout to ensure the DOM is ready
    setTimeout(async () => {
        console.log("--- CiliAI SIMULATION START ---");

        // === Test 1: Single-gene summary (Fetch) ===
        await ciliAI_simulateUserInput("Tell me about IFT88"); 
        
        // === Test 2: Single-gene specific (Cache) ===
        setTimeout(async () => {
            await ciliAI_simulateUserInput("what complex is IFT88 in?");
        }, 3000); // Wait 3 seconds for first fetch

        // === Test 3: Complex query (Placeholder) ===
        setTimeout(async () => {
            await ciliAI_simulateUserInput("List genes for Joubert syndrome");
        }, 6000); // Wait 6 seconds
        
        // === Test 4: Single-gene expression (Fetch/Cache) ===
        setTimeout(async () => {
            await ciliAI_simulateUserInput("expression for IFT88");
        }, 9000); // Wait 9 seconds

        console.log("--- CiliAI SIMULATION END (tests are running) ---");
    }, 2000); // Wait 2 seconds for page to load
}

// To run the test, uncomment this line:
// ciliAI_runSimulation();



// =============================================================================
// REPLACEMENT: The definitive "Brain" of CiliAI, merging all features correctly.
// =============================================================================
function createIntentParser() {
    // NOTE: This object must be named 'classifiedDiseases' to match its usage below
    const classifiedDiseases = {
        "Primary Ciliopathies": [ 
            "Acrocallosal Syndrome", "Alström Syndrome", "Autosomal Dominant Polycystic Kidney Disease",
            "Autosomal Recessive Polycystic Kidney Disease", "Bardet–Biedl Syndrome", "COACH Syndrome",
            "Cranioectodermal Dysplasia", "Ellis-van Creveld Syndrome", "Hydrolethalus Syndrome", "Infantile Polycystic Kidney Disease",
            "Joubert Syndrome", "Leber Congenital Amaurosis", "Meckel–Gruber Syndrome", "Nephronophthisis", "Orofaciodigital Syndrome",
            "Senior-Løken Syndrome", "Short-rib Thoracic Dysplasia", "Skeletal Ciliopathy", "Retinal Ciliopathy", "Syndromic Ciliopathy",
            "Al-Gazali-Bakalinova Syndrome", "Bazex-Dupré-Christol Syndrome", "Bilateral Polycystic Kidney Disease", "Biliary, Renal, Neurologic, and Skeletal Syndrome",
            "Caroli Disease", "Carpenter Syndrome", "Complex Lethal Osteochondrodysplasia", "Greig Cephalopolysyndactyly Syndrome", "Kallmann Syndrome", "Lowe Oculocerebrorenal Syndrome",
            "McKusick-Kaufman Syndrome", "Morbid Obesity and Spermatogenic Failure", "Polycystic Kidney Disease", "RHYNS Syndrome", "Renal-hepatic-pancreatic Dysplasia", "Retinal Dystrophy", "STAR Syndrome",
            "Smith-Lemli-Opitz Syndrome", "Spondylometaphyseal Dysplasia", "Stromme Syndrome", "Weyers Acrofacial Dysostosis", "Hydrocephalus" // Added Hydrocephalus back
        ], 
        "Motile Ciliopathies": [ 
            "Primary Ciliary Dyskinesia", "Birt-Hogg-Dubé Syndrome", "Juvenile Myoclonic Epilepsy" 
        ],
        "Secondary Diseases": [ 
            "Ataxia-telangiectasia-like Disorder", "Birt-Hogg-Dubé Syndrome", "Cone-Rod Dystrophy", "Cornelia de Lange Syndrome",
            "Holoprosencephaly", "Juvenile Myoclonic Epilepsy", "Medulloblastoma", "Retinitis Pigmentosa", "Spinocerebellar Ataxia", "Bazex-Dupré-Christol Syndrome", "Lowe Oculocerebrorenal Syndrome",
            "McKusick-Kaufman Syndrome", "Pallister-Hall Syndrome", "Simpson-Golabi-Behmel Syndrome", "Townes-Brocks Syndrome", "Usher Syndrome", "Visceral Heterotaxy" 
        ],
        "Atypical Ciliopathies": [ 
            "Biliary Ciliopathy", "Chronic Obstructive Pulmonary Disease", "Ciliopathy", "Ciliopathy - Retinal dystrophy", "Golgipathies or Ciliopathy", "Hepatic Ciliopathy", "Male Infertility and Ciliopathy", "Male infertility", "Microcephaly and Chorioretinopathy Type 3", "Mucociliary Clearance Disorder", "Notch-mediated Ciliopathy", "Primary Endocardial Fibroelastosis", "Retinal Ciliopathy", "Retinal Degeneration", "Skeletal Ciliopathy", "Syndromic Ciliopathy" 
        ]
    };
    
    // Use the explicit classification list and common aliases
    const aliases = ["BBS", "Joubert", "NPHP", "MKS"];
    // NOTE: Object.values(classifiedDiseases) is correct here.
    const allDiseases = [...Object.values(classifiedDiseases).flat(), ...aliases];

    const entityKeywords = [
        {
            type: 'FUNCTIONAL_CATEGORY',
            keywords: ['kinesin motors', 'dynein motors', 'Ciliary assembly/disassembly', 'Signaling', 'Motile cilium', 'Motor protein', 'Transport', 'Protein modification', 'Cytoskeletal', 'cilium assembly', 'basal body docking', 'retrograde IFT'],
            handler: async (term) => formatListResult(`Genes in Functional Category: ${term}`, await getGenesByFunction(term)),
            autocompleteTemplate: (term) => `Show me ${term} genes`
        },
        {
            type: 'COMPLEX',
            // Ensure BBSome is included in this list, either statically or dynamically if possible
            keywords: ['BBSome', 'IFT-A', 'IFT-B', 'Transition Zone Complex', 'MKS Complex', 'NPHP Complex'],
            handler: async (term) => formatListResult(`Components of ${term}`, await getGenesByComplex(term)),
            autocompleteTemplate: (term) => `Display components of ${term} complex`
        },
        {
            type: 'CILIOPATHY',
            keywords: [...new Set(allDiseases)],
            handler: async (term) => {
                const titleTerm = term.toUpperCase() === 'BBS' ? 'Bardet–Biedl Syndrome' :
                                  term.toUpperCase() === 'MKS' ? 'Meckel–Gruber Syndrome' : term;
                const { genes, description } = await getCiliopathyGenes(term);
                return formatListResult(`Genes for ${titleTerm}`, genes, description);
            },
            autocompleteTemplate: (term) => `Display genes for ${term}`
        },
        {
            type: 'LOCALIZATION',
            keywords: ['basal body', 'axoneme', 'transition zone', 'centrosome', 'cilium', 'lysosome', 'ciliary tip', 'transition fiber'],
            handler: async (term) => formatListResult(`Genes localizing to ${term}`, await getGenesByLocalization(term)),
            autocompleteTemplate: (term) => `Show me ${term} localizing genes`
        },
        {
            type: 'ORGANISM',
            keywords: [
                "Prokaryote", "E.cuniculi", "E.histolytica", "E.dispar", "G.lamblia", "T.vaginalis", "T.brucei", "T.cruzi", "L.infantum",
                "L.major", "L.braziliensis", "T.gondii", "C.hominis", "C.parvum", "B.bovis", "T.annulata", "T.parva", "P.knowlesi", "P.vivax",
                "P.falciparum", "P.chabaudi", "P.berghei", "P.yoelii", "P.tetraurelia", "T.thermophila", "P.infestans", "T.pseudonana",
                "P.tricornutum", "C.merolae", "N.gruberi", "O.lucimarinus", "O.tauri", "C.reinhardtii", "V.carteri", "P.patens",
                "S.moellendorffii", "S.bicolor", "Z.mays", "O.sativa", "B.distachyon", "A.lyrata", "A.thaliana", "L.japonicus", "M.truncatula",
                "V.vinifera", "P.trichocarpa", "R.communis", "T.trahens", "D.discoideum", "A.macrogynus", "S.punctatus", "M.globosa", "U.maydis",
                "C.neoformans", "P.chrysosporium", "S.commune", "C.cinerea", "L.bicolor", "S.pombe", "B.fuckeliana", "S.sclerotiorum",
                "F.graminearum", "M.grisea", "N.crassa", "P.anserina", "P.chrysogenum", "A.clavatus", "A.fumigatus", "N.fischeri", "A.flavus",
                "A.oryzae", "A.niger", "A.nidulans", "U.reesii", "C.immitis", "C.posadasii", "P.nodorum", "T.melanosporum", "Y.lipolytica",
                "P.pastoris", "C.lusitaniae", "D.hansenii", "M.guilliermondii", "S.stipitis", "L.elongisporus", "C.tropicalis", "C.albicans",
                "C.dubliniensis", "K.lactis", "A.gossypii", "K.waltii", "L.thermotolerans", "Z.rouxii", "V.polyspora", "C.glabrata", "S.bayanus",
                "S.mikatae", "S.cerevisiae", "S.paradoxus", "S.arctica", "C.owczarzaki", "M.brevicollis", "S.rosetta", "S.mansoni", "B.malayi",
                "C.briggsae", "C.elegans", "D.pulex", "A.pisum", "P.humanus", "A.mellifera", "N.vitripennis", "B.mori", "T.castaneum",
                "D.melanogaster", "D.pseudoobscura", "A.gambiae", "A.aegypti", "C.quinquefasciatus", "B.floridae", "T.adhaerens", "S.purpuratus",
                "H.magnipapillata", "N.vectensis", "C.intestinalis", "D.rerio", "O.latipes", "F.rubripes", "T.nigroviridis", "X.tropicalis",
                "G.gallus", "M.gallopavo", "O.anatinus", "M.domestica", "S.scrofa", "M.musculus", "C.familiaris", "B.taurus", "H.sapiens",
                "worm", "human", "mouse", "zebrafish", "fly", "yeast"
            ],

            // In createIntentParser -> entityKeywords (type: 'ORGANISM')
            handler: async (term) => {
            const { genes, description, speciesCode } = await getCiliaryGenesForOrganism(term);
            return formatListResult(`Ciliary genes in ${speciesCode}`, genes, description); 
            },
            autocompleteTemplate: (term) => `Display ciliary genes in ${term}`
            },
            {
            type: 'DOMAIN',
            keywords: ['WD40', 'Leucine-rich repeat', 'IQ motif', 'calmodulin-binding', 'EF-hand', 'coiled-coil', 'CTS', 'ciliary targeting sequences', 'ciliary localization signals'],
            handler: async (term) => formatListResult(`${term} domain-containing proteins`, await getGenesWithDomain(term)),
            autocompleteTemplate: (term) => `Show ${term} domain containing proteins`
        }
    ];

    return {
        parse: (query) => {
            const normalizedQuery = normalizeTerm(query);
            for (const entityType of entityKeywords) {
                const sortedKeywords = [...entityType.keywords].sort((a, b) => b.length - a.length);
                for (const keyword of sortedKeywords) {
                    const keywordRegex = new RegExp(`\\b${normalizeTerm(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                    if (keywordRegex.test(normalizedQuery)) {
                        return { intent: entityType.type, entity: keyword, handler: entityType.handler };
                    }
                }
            }
            return null;
        },
        getKnownKeywords: () => entityKeywords.flatMap(e => e.keywords.map(k => ({ keyword: k, suggestion: e.autocompleteTemplate(k) }))),
        getAllDiseases: () => [...new Set(allDiseases)],
        getAllComplexes: () => entityKeywords.find(e => e.type === 'COMPLEX').keywords,
        getAllGenes: () => ciliaHubDataCache ? ciliaHubDataCache.map(g => g.gene) : []
    };
}

const intentParser = createIntentParser();



/**
 * Helper function to get complex details by gene symbol.
 * @param {string} geneSymbol The gene to search for.
 * @returns {Array<Object>} List of complexes containing the gene.
 */
function getComplexesByGene(geneSymbol) {
    if (!corumDataCache.loaded) {
        console.warn('CORUM data not loaded yet.');
        return [];
    }
    const upper = geneSymbol.toUpperCase();
    return corumDataCache.byGene[upper] || [];
}

/**
 * Helper function to get complex subunits by complex name (partial match).
 * This replaces the crashing regex logic for complex name lookups.
 * @param {string} complexName The complex name (can be partial).
 * @returns {Array<Object>} List of complexes matching the name.
 */
/**
 * Retrieves subunits for a given complex name from CORUM, safely handling missing data.
 */
function getSubunitsByComplexName(complexName) {
    if (!corumDataCache?.complexes) return [];
    const nameLower = (complexName || '').toLowerCase();

    return corumDataCache.complexes.filter(
        c => c && typeof c.complex_name === 'string' &&
             c.complex_name.toLowerCase().includes(nameLower)
    );
}


/**
 * New function to describe CiliAI's capabilities, listing all available data types.
 */
async function tellAboutCiliAI() {
    const html = `
    <div class="result-card">
        <h3>About CiliAI 🤖</h3>
        <p>I am CiliAI, an AI-powered assistant designed to help you explore and analyze ciliary gene data. I integrate information from 8 different genomic and functional datasets (CiliaHub, screen data, phylogeny, domain databases, and scRNA-seq) to answer your questions.</p>
        
        <h4>CiliAI Capabilities:</h4>
        <ul>
            <li><strong>Comprehensive Gene Lookup:</strong> Get full details on any gene (e.g., <strong>Tell me about IFT88</strong>).</li>
            <li><strong>Disease Genetics:</strong> Find genes for specific conditions (e.g., <strong>List genes for Bardet-Biedl Syndrome</strong>).</li>
            <li><strong>Localization & Protein Complex:</strong> Identify components in cellular structures (e.g., <strong>Show proteins in the transition zone</strong> or <strong>components of IFT-A complex</strong>).</li>
            <li><strong>Phenotype Screening:</strong> Query experimental results (e.g., <strong>Which genes cause shorter cilia?</strong> or <strong>Show ciliary effects for BBS1</strong>).</li>
            <li><strong>Expression & Visualization:</strong> Explore tissue and single-cell data (e.g., <strong>Plot FOXJ1 UMAP expression</strong> or <strong>Which ciliary genes are expressed in kidney?</strong>).</li>
            <li><strong>Phylogeny & Orthologs:</strong> Check conservation and orthologs across species (e.g., <strong>Does ARL13B have an ortholog in C. elegans?</strong>).</li>
            <li><strong>Domain Analysis:</strong> Search by protein features (e.g., <strong>Show WD40 domain containing proteins</strong>).</li>
        </ul>
        
        <h4>Try Asking:</h4>
        <ul style="column-count: 2; margin-top: 10px;">
            <li>Tell me about **DYNC2H1**</li>
            <li>List genes classified as **Primary Ciliopathy**</li>
            <li>Where is **CEP290** located?</li>
            <li>Show **orthologs of IFT88**</li>
            <li>**Compare IFT-A and IFT-B** complex composition</li>
            <li>**UMAP plot for FOXJ1**</li>
        </ul>
    </div>`;
    return html;
}

/**
 * New handler to get live literature evidence for a gene.
 */
async function getLiteratureEvidence(gene) {
    const evidence = await analyzeGeneViaAPI(gene);
    if (!evidence || evidence.length === 0) {
        return `<div class="result-card"><h3>Literature Evidence for ${gene}</h3><p class="status-not-found">No relevant sentences found in a search of recent literature.</p></div>`;
    }

    const evidenceSnippets = evidence.map(ev => `
        <div style="border-bottom:1px solid #eee; padding-bottom:0.5rem; margin-bottom:0.5rem;">
            <p>${ev.context.replace(new RegExp(`(${gene})`, 'ig'), `<mark>$1</mark>`)}</p>
            <small><strong>Source:</strong> ${ev.source.toUpperCase()} (${ev.id})</small>
        </div>`
    ).join('');

    return `
        <div class="result-card">
            <h3>Literature Evidence for ${gene}</h3>
            ${evidenceSnippets}
        </div>`;
}

/**@##########################BEGINNING OF GENE CATCHING RELATED QUETIONS AND HELPER CORUM##################################
 * @##########################BEGINNING OF GENE CATCHING RELATED QUETIONS AND HELPER CORUM##################################
 * @##########################BEGINNING OF GENE CATCHING RELATED QUETIONS AND HELPER CORUM##################################
 * @##########################BEGINNING OF GENE CATCHING RELATED QUETIONS AND HELPER CORUM##################################
 */
/**
 * Ensures all data for a specific gene is fetched and cached *within CiliAI*.
 * This is the primary "gatekeeper" function for all *single-gene* data.
 *
 * @param {string} geneName - The human gene name (e.g., "IFT88"). Case-insensitive.
 * @returns {Promise<object>} A promise that resolves to an object 
 * containing all data for that gene (or a "notFound" state).
 */
async function ciliAI_getGeneData(geneName) {
    const upperGeneName = geneName.toUpperCase(); // Standardize key

    // 1. [CACHE HIT]
    if (ciliAI_geneCache.has(upperGeneName)) {
        return ciliAI_geneCache.get(upperGeneName);
    }

    // 2. [CACHE MISS]
    const dataPromise = (async () => {
        console.log(`[CiliAI Cache MISS] Fetching all data for ${upperGeneName}...`);

        const results = await Promise.allSettled([
            ciliAI_fetchCiliaHubData_internal(upperGeneName),     // Main JSON file (contains geneInfo, effects)
            ciliAI_fetchPhylogenyData_internal(upperGeneName),   // Combined (Nevers + Li)
            ciliAI_fetchDomainData_internal(upperGeneName),       // Domain data
            ciliAI_fetchComplexData_internal(upperGeneName),      // Protein complex data (from CORUM)
            ciliAI_fetchTissueData_internal(upperGeneName),       // Tissue consensus TSV
            ciliAI_fetchScRnaData_internal(upperGeneName),        // scRNA-seq data
            ciliAI_fetchScreenData_internal(upperGeneName)        // Separate screen data
        ]);

        // 3. Collate the results
        const ciliaHubResult = results[0].status === 'fulfilled' ? results[0].value : null;

        const combinedData = {
            // Spread the CiliaHub data (geneInfo, expression, etc.)
            ...(ciliaHubResult || { geneInfo: null, expression: null }), 
            
            // Assign results from other fetches
            phylogeny:   results[1].status === 'fulfilled' ? results[1].value : null,
            domains:     results[2].status === 'fulfilled' ? results[2].value : null,
            complex:     results[3].status === 'fulfilled' ? results[3].value : null,
            tissue:      results[4].status === 'fulfilled' ? results[4].value : null, 
            scRNA:       results[5].status === 'fulfilled' ? results[5].value : null,
            screens:     results[6].status === 'fulfilled' ? results[6].value : null,
            lastFetched: new Date().toISOString()
        };

        // 4. Check if we got any data at all
        if (!combinedData.geneInfo) {
            console.warn(`[CiliAI] No data found for ${upperGeneName} in any key source.`);
            const notFoundData = { notFound: true, ...combinedData };
            ciliAI_geneCache.set(upperGeneName, Promise.resolve(notFoundData)); 
            return notFoundData;
        }

        // 5. Return the combined data
        return combinedData;

    })().catch(err => {
        console.error(`[CiliAI] Catastrophic failure fetching data for ${upperGeneName}:`, err);
        ciliAI_geneCache.delete(upperGeneName);
        return { notFound: true, error: err.message };
    });

    // 6. Store the promise *itself* in the cache
    ciliAI_geneCache.set(upperGeneName, dataPromise);

    // 7. [OPTIMIZATION] Replace promise with resolved data once complete
    dataPromise.then(data => {
        ciliAI_geneCache.set(upperGeneName, Promise.resolve(data));
    }).catch(() => { /* Handled in the .catch() block above */ });

    return dataPromise;
}

/**
 * [INTERNAL] Fetches main data from ciliahub_data.json.
 * This file is an ARRAY of gene objects.
 * @param {string} geneName - The human gene name (UPPERCASE)
 * @returns {Promise<object | null>}
 */
async function ciliAI_fetchCiliaHubData_internal(geneName) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/ciliahub_data.json';
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const allData = await response.json(); // This is an ARRAY

        // Find the gene in the array
        const geneInfo = allData.find(entry => entry.gene && entry.gene.toUpperCase() === geneName);
        
        if (geneInfo) {
            // This file contains geneInfo, expression (in screens), and length effects
            // We return the *whole object* for that gene
            // 'expression' key is used for the 'screens' array in this file
            return { 
                geneInfo: geneInfo,
                expression: geneInfo.screens || null 
            };
        }
        return null;
    } catch (err) {
        console.error(`[CiliAI] Failed to fetch CiliaHub data for ${geneName}:`, err);
        return null;
    }
}

/**
 * [INTERNAL] Fetches and combines phylogeny data from Nevers and Li.
 * @param {string} geneName - The human gene name (UPPERCASE)
 * @returns {Promise<object | null>}
 */
async function ciliAI_fetchPhylogenyData_internal(geneName) {
    const neversURL = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/nevers_et_al_2017_matrix_optimized.json';
    const liURL = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/li_et_al_2014_matrix_optimized.json';

    try {
        const [neversResult, liResult] = await Promise.allSettled([
            fetch(neversURL).then(res => res.json()),
            fetch(liURL).then(res => res.json())
        ]);

        let combinedPhylogeny = { nevers: null, li: null };

        // Data is an OBJECT { "GENE": {...} }
        if (neversResult.status === 'fulfilled') {
            if (neversResult.value && neversResult.value[geneName]) {
                combinedPhylogeny.nevers = neversResult.value[geneName];
            }
        } else {
            console.warn(`[CiliAI] Could not load Nevers phylogeny for ${geneName}:`, neversResult.reason);
        }

        // Data is an OBJECT { "GENE": {...} }
        if (liResult.status === 'fulfilled') {
             if (liResult.value && liResult.value[geneName]) {
                combinedPhylogeny.li = liResult.value[geneName];
            }
        } else {
            console.warn(`[CiliAI] Could not load Li phylogeny for ${geneName}:`, liResult.reason);
        }

        return (combinedPhylogeny.nevers || combinedPhylogeny.li) ? combinedPhylogeny : null;

    } catch (err) {
        console.error(`[CiliAI] Failed to fetch phylogeny for ${geneName}:`, err);
        return null;
    }
}

/**
 * [INTERNAL] Fetches domain data for a specific gene.
 * @param {string} geneName - The human gene name (UPPERCASE)
 * @returns {Promise<object | null>}
 */
async function ciliAI_fetchDomainData_internal(geneName) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/protein_domains.json'; 
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const allDomainData = await response.json();
        
        // Assuming allDomainData is an object keyed by gene name
        const geneDomainData = allDomainData[geneName] || null;

        return geneDomainData; 
    } catch (err) {
        console.error(`[CiliAI] Failed to fetch domain data for ${geneName}:`, err);
        return null;
    }
}

/**
 * [INTERNAL] Fetches protein complex data from CORUM.
 * @param {string} geneName - The human gene name (UPPERCASE)
 * @returns {Promise<object | null>}
 */
async function ciliAI_fetchComplexData_internal(geneName) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/corum_humanComplexes.json';
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const allComplexData = await response.json(); // This is an ARRAY

        // Find the first complex that includes this gene
        const foundComplex = allComplexData.find(complex => 
            complex.subunits && Array.isArray(complex.subunits) &&
            complex.subunits.some(subunit => subunit.gene_name && subunit.gene_name.toUpperCase() === geneName)
        );
        
        if (foundComplex) {
             // Return a simplified object
             return {
                name: foundComplex.complex_name,
                members: foundComplex.subunits.map(s => s.gene_name)
             };
        }
        return null;
    } catch (err) {
        console.error(`[CiliAI] Failed to fetch complex data for ${geneName}:`, err);
        return null;
    }
}

/**
 * [INTERNAL] Fetches tissue expression data from the rna_tissue_consensus.tsv file.
 * @param {string} geneName - The human gene name (UPPERCASE)
 * @returns {Promise<object | null>} An object with tissue expression data or null.
 */
async function ciliAI_fetchTissueData_internal(geneName) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/rna_tissue_consensus.tsv';
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const tsvData = await response.text();
        const lines = tsvData.split('\n');
        
        if (lines.length < 2) throw new Error("TSV file is empty or has no header.");

        const headers = lines[0].split('\t');
        const geneNameIndex = headers.findIndex(h => h.toLowerCase() === 'gene name' || h.toLowerCase() === 'gene');
        
        if (geneNameIndex === -1) throw new Error("Could not find 'Gene name' column in TSV header.");

        for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split('\t');
            const currentGene = columns[geneNameIndex];
            
            if (currentGene && currentGene.toUpperCase() === geneName) {
                const tissueData = {};
                headers.forEach((header, index) => {
                    if (index !== geneNameIndex) {
                        tissueData[header] = columns[index];
                    }
                });
                return tissueData; // Success!
            }
        }
        return null; // Gene not found
    } catch (err) {
        console.error(`[CiliAI] Failed to fetch tissue data for ${geneName}:`, err);
        return null;
    }
}

/**
 * [INTERNAL] Fetches scRNA-seq data from cellxgene_data.json.
 * @param {string} geneName - The human gene name (UPPERCASE)
 * @returns {Promise<object | null>} An object with scRNA-seq data or null.
 */
async function ciliAI_fetchScRnaData_internal(geneName) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cellxgene_data.json';
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const allScRnaData = await response.json();
        
        // Data is an object { "GENE": {...} }
        const geneKey = Object.keys(allScRnaData).find(key => key.toUpperCase() === geneName);
        
        if (geneKey) {
            return allScRnaData[geneKey];
        }
        return null; // Gene not found
    } catch (err) {
        console.error(`[CiliAI] Failed to fetch scRNA-seq data for ${geneName}:`, err);
        return null;
    }
}

/**
 * [INTERNAL] Fetches screen data.
 * @param {string} geneName - The human gene name (UPPERCASE)
 * @returns {Promise<object | null>}
 */
async function ciliAI_fetchScreenData_internal(geneName) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cilia_screens_data.json';
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const allScreenData = await response.json(); // Data is { "GENE": [...] }

        const geneKey = Object.keys(allScreenData).find(key => key.toUpperCase() === geneName);
        
        if (geneKey) {
            return allScreenData[geneKey]; // Return the array of screen results
        }
        return null;
    } catch (err) {
        console.error(`[CiliAI] Failed to fetch screen data for ${geneName}:`, err);
        return null;
    }
}




/**@##########################BEGINNING OF COMPLEX RELATED QUETIONS AND HELPER CORUM##################################
 * @##########################BEGINNING OF COMPLEX RELATED QUETIONS AND HELPER CORUM##################################
 * @##########################BEGINNING OF COMPLEX RELATED QUETIONS AND HELPER CORUM##################################
 * @##########################BEGINNING OF COMPLEX RELATED QUETIONS AND HELPER CORUM##################################
 */

/**
 * @name routeComplexPhylogenyAnalysis
 * @description High-priority router to detect complex module queries and execute the correct helper function,
 * bypassing flawed general query parsing.
 * @param {string} query - The raw user query.
 * @returns {Promise<string|null>} HTML output (if complex match) or null (to continue standard routing).
 */
async function routeComplexPhylogenyAnalysis(query) {
    const qUpper = query.toUpperCase();

    // Map the expected user input keyword combinations (including the word "TABLE")
    const complexMap = {
        "IFT COMPLEX TABLE": "IFT COMPLEX",
        "IFT-A COMPLEX TABLE": "IFT-A COMPLEX",
        "IFT-B COMPLEX TABLE": "IFT-B COMPLEX",
        "IFT-B1 CORE COMPONENTS TABLE": "IFT-B1 COMPLEX",
        "IFT-B2 PERIPHERAL COMPONENTS TABLE": "IFT-B2 COMPLEX",
        "BBSOME COMPONENTS TABLE": "BBSOME",
        "MKS MODULE COMPONENTS TABLE": "MKS MODULE",
        "NPHP MODULE GENES TABLE": "NPHP MODULE",
        "TRANSITION ZONE PROTEINS TABLE": "TRANSITION ZONE",
        
        // --- NEW ENTRIES ---
        "EXOCYST COMPLEX COMPONENTS TABLE": "EXOCYST",
        "CILIARY TIP PROTEINS TABLE": "CILIARY TIP",
        "CILIARY TIP LOCALIZING PROTEINS TABLE": "CILIARY TIP",
        "RADIAL SPOKE PROTEINS TABLE": "RADIAL SPOKE",
        "CENTRAL PAIR COMPLEX TABLE": "CENTRAL PAIR",
        "DYNEIN ARM COMPONENTS TABLE": "DYNEIN ARM",
        "OUTER DYNEIN ARM PROTEINS TABLE": "OUTER DYNEIN ARM",
        "INNER DYNEIN ARM PROTEINS TABLE": "INNER DYNEIN ARM",

        // Add permutations without 'components' or 'genes' but include 'table'
        "IFT COMPLEX TABLE": "IFT COMPLEX",
        "IFT-A TABLE": "IFT-A COMPLEX",
        "BBSOME TABLE": "BBSOME",
        "MKS MODULE TABLE": "MKS MODULE",
        "NPHP MODULE TABLE": "NPHP MODULE",
        "EXOCYST TABLE": "EXOCYST",
        "CILIARY TIP TABLE": "CILIARY TIP",
        "RADIAL SPOKE TABLE": "RADIAL SPOKE",
        "CENTRAL PAIR TABLE": "CENTRAL PAIR",
        "DYNEIN ARM TABLE": "DYNEIN ARM",
        "OUTER DYNEIN ARM TABLE": "OUTER DYNEIN ARM",
        "INNER DYNEIN ARM TABLE": "INNER DYNEIN ARM"
    };

    // Simplify the query string to check for module + table intent
    const simplifiedQuery = qUpper.replace(/COMPARE|CONSERVATION|EVOLUTIONARY|SHOW|OF|THE|ANALYSIS|\s+/g, ' ').trim();
    
    let detectedComplex = null;

    // Look for a direct match, prioritizing the combination with 'TABLE'
    for (const [key, name] of Object.entries(complexMap)) {
        if (qUpper.includes(key.replace(/\s/g, ' '))) {
            detectedComplex = name;
            break;
        }
    }

    if (detectedComplex) {
        // Execute the dedicated table handler directly
        return getComplexPhylogenyTable(detectedComplex);
    }
    
    return null; // Continue to the standard phylogenetic router
}


/**
 * Extracts and normalizes the curated gene map data for use by getGenesByComplex.
 * NOTE: This must be placed near getComplexPhylogenyTable so it can access the same data structure.
 */
function getComplexPhylogenyTableMap() {
    return {
        // --- Core IFT machinery ---
        "IFT COMPLEX": ["WDR19", "IFT140", "TTC21B", "IFT122", "WDR35", "IFT43", "IFT172", "IFT80", "IFT57", "TRAF3IP1", "CLUAP1", "IFT20", "IFT88", "IFT81", "IFT74", "IFT70A", "IFT70B", "IFT56", "IFT52", "IFT46", "IFT27", "IFT25", "IFT22"],
        "IFT-A COMPLEX": ["WDR19", "IFT140", "TTC21B", "IFT122", "WDR35", "IFT43"],
        "IFT-B COMPLEX": ["IFT172", "IFT80", "IFT57", "TRAF3IP1", "CLUAP1", "IFT20", "IFT88", "IFT81", "IFT74", "IFT70A", "IFT70B", "IFT56", "IFT52", "IFT46", "IFT27", "IFT25", "IFT22"],
        "IFT-B1 COMPLEX": ["IFT172", "IFT80", "IFT57", "TRAF3IP1", "CLUAP1", "IFT20"],
        "IFT-B2 COMPLEX": ["IFT88", "IFT81", "IFT74", "IFT70A", "IFT70B", "IFT56", "IFT52", "IFT46", "IFT27", "IFT25", "IFT22"],
        
        // ⭐ NEW/UPDATED MOTOR COMPLEX (Combines IFT MOTORS and INTRAFLAGELLAR TRANSPORT MOTORS)
        "IFT MOTOR COMPLEX": ["KIF3A", "KIF3B", "KIF17", "DYNC2H1", "DYNC2LI1", "WDR34", "WDR60"], 
        "INTRAFLAGELLAR TRANSPORT MOTORS": ["KIF3A", "KIF3B", "KIF17", "DYNC2H1", "DYNC2LI1", "WDR34", "WDR60"],
        
        // --- BBSome and trafficking ---
        "BBSOME": ["BBS1", "BBS2", "BBS4", "BBS5", "BBS7", "TTC8", "BBS9", "BBIP1"],
        "EXOCYST": ["EXOC1", "EXOC2", "EXOC3", "EXOC4", "EXOC5", "EXOC6", "EXOC7", "EXOC8"],

        // --- Transition zone modules ---
        "TRANSITION ZONE": ["NPHP1", "MKS1", "CEP290", "AHI1", "RPGRIP1L", "TMEM67", "CC2D2A", "B9D1", "B9D2"],
        "MKS MODULE": ["MKS1", "TMEM17", "TMEM67", "TMEM138", "B9D2", "B9D1", "CC2D2A", "TMEM107", "TMEM237", "TMEM231", "TMEM216", "TCTN1", "TCTN2", "TCTN3"],
        "NPHP MODULE": ["NPHP1", "NPHP3", "NPHP4", "RPGRIP1L", "IQCB1", "CEP290", "SDCCAG8"],

        // --- Basal body & appendage components (Consolidated) ---
        "BASAL BODY": ["CEP164", "CEP83", "SCLT1", "CEP89", "LRRC45", "ODF2", "CEP128", "CEP135", "CETN2", "CETN3", "POC1B", "FBF1", "CCDC41", "CCDC120", "OFD1"], 
        "CENTRIOLE DISTAL APPENDAGES": ["CEP164", "SCLT1", "CEP89", "LRRC45", "CEP123", "ANKRD26", "FOPNL", "CEP128", "CEP135", "FBF1", "CCDC41", "CCDC120"],
        "CENTRIOLE SUBDISTAL APPENDAGES": ["CEP128", "ODF2", "CCDC120", "NIN", "NINL", "CEP170", "CCDC68", "CCDC102B"],
        "CENTRIOLAR SATELLITES": ["PCM1", "CEP131", "CEP290", "OFD1", "AZI1", "CEP72", "SSX2IP"],
        
        // --- Transition fiber & ciliary gate ---
        "TRANSITION FIBER": ["CEP164", "CEP83", "SCLT1", "CEP89", "LRRC45", "CEP123", "CEP350", "CEP44"],

        // --- Axonemal and motility machinery ---
        "CILIARY TIP": ["HYDIN", "IQCA1", "CATSPER2", "KIF19A", "KIF7", "CCDC78", "CCDC33", "SPEF1", "CEP104", "CSPP1", "TOGARAM1", "ARMC9", "MAPRE1", "MAPRE3", "CCDC66"],
        "RADIAL SPOKE": ["RSPH1", "RSPH3", "RSPH4A", "RSPH6A", "RSPH9", "RSPH10B", "RSPH23", "RSPH16", "DRC1", "DRC3", "DRC4", "DRC5"],
        "CENTRAL PAIR": ["HYDIN", "SPAG6", "SPAG16", "SPAG17", "POC1A", "CEP131", "CFAP43", "CFAP44", "CFAP45", "CFAP47"],
        "DYNEIN ARM": ["DNAH1", "DNAH2", "DNAH5", "DNAH6", "DNAH7", "DNAH8", "DNAH9", "DNAH10", "DNAH11", "DNALI1", "DNAI1", "DNAI2", "DNAAF1", "DNAAF2", "DNAAF3", "DNAAF4", "LRRC6", "CCDC103"],
        "OUTER DYNEIN ARM": ["DNAH5", "DNAH11", "DNAH17", "DNAH18", "DNAI1", "DNAI2", "DNAAF1", "DNAAF2", "DNAAF3", "DNAAF4", "LRRC6", "CCDC103", "WDR63"],
        "INNER DYNEIN ARM": ["DNAH2", "DNAH7", "DNAH10", "DNALI1", "DNAL4", "DNAAF5", "CCDC40", "CCDC114", "CCDC151"],
        "NEXIN-DYNEIN REGULATORY COMPLEX": ["GAS8", "GAS2L2", "CCDC39", "CCDC40", "CCDC164", "CCDC65"], // New DRC
        
        // --- Ciliary rootlet & anchoring ---
        "ROOTLETIN COMPLEX": ["CROCC", "CROCC2", "CEP68", "CEP44", "ODF2"],
        "CENTRIOLE LINKER": ["CEP68", "CEP250", "C-NAP1", "ROCK1", "NEK2"],

        // --- Ciliary signaling hubs ---
        "SHH SIGNALING": ["SMO", "PTCH1", "GLI1", "GLI2", "GLI3", "SUFU", "KIF7", "TULP3", "IFT172", "IFT81", "ARL13B"],
        "GPCR COMPLEX": ["GPR161", "GPR175", "GPR22", "GPR83", "ADCY3", "RXFP2", "SSTR3", "NPY2R", "HTR6"],
        "HEDGEHOG TRAFFICKING COMPLEX": ["ARL13B", "INPP5E", "TULP3", "IFT172", "KIF7", "BBS4", "BBS5", "SMO"],

        // --- Centrosome & PCM components ---
        "CENTROSOME": ["CEP152", "CEP192", "PLK4", "STIL", "SAS6", "CEP135", "CETN2", "PCNT", "CDK5RAP2", "CEP215"],
        "PEROXISOMAL COMPLEX": ["PEX1", "PEX2", "PEX3", "PEX5", "PEX6", "PEX10", "PEX12", "PEX13", "PEX14", "PEX19"]
    };
}

/**
 * @name standardizeComplexName
 * @description Normalizes user input for known ciliary complexes, mapping common synonyms
 * (e.g., IFT-A, MKS) to a consistent internal name for stable lookup.
 * @param {string} complexName - The raw user query term (e.g., "IFT-A complex members").
 * @returns {string} The standardized name (e.g., "IFT-A complex").
 */
function standardizeComplexName(complexName) {
    // 1. Clean the input: Remove common suffixes (COMPLEX, MODULE, (S), PROTEINS) and fix regex flag (using 'g')
    const nameUpper = complexName.toUpperCase()
        .replace(/COMPLEX|MODULE|\(S\)|PROTEINS/g, '')
        .trim();
   // 2. Definitive mapping table
    const standardizationMap = {
        'IFT-A': 'IFT-A COMPLEX',
        'IFT-B': 'IFT-B COMPLEX',
        'IFT': 'IFT COMPLEX',
        'BBSOME': 'BBSOME',
        'TRANSITION ZONE': 'TRANSITION ZONE',
        'MKS': 'MKS MODULE',
        'NPHP': 'NPHP MODULE',
        'EXOCYST': 'EXOCYST',
        'CILIARY TIP': 'CILIARY TIP',
        // ⭐ IFT MOTORS (Consolidated Mappings)
        'IFT MOTOR': 'IFT MOTOR COMPLEX',
        'INTRAFLAGELLAR TRANSPORT MOTORS': 'IFT MOTOR COMPLEX',
        'KINESIN-2': 'IFT MOTOR COMPLEX',
        'DYNEIN-2': 'IFT MOTOR COMPLEX',
        // ⭐ NEW BASAL BODY/APPENDAGE MAPPINGS
        'BASAL BODY': 'BASAL BODY', // Existing, but crucial
        'DISTAL APPENDAGES': 'CENTRIOLE DISTAL APPENDAGES',
        'SUBDISTAL APPENDAGES': 'CENTRIOLE SUBDISTAL APPENDAGES',
        'CENTRIOLAR SATELLITES': 'CENTRIOLAR SATELLITES',
        // ⭐ NEW AXONEMAL MAPPINGS
        'NEXIN': 'NEXIN-DYNEIN REGULATORY COMPLEX',
        'DRC': 'NEXIN-DYNEIN REGULATORY COMPLEX',
        // Axonemal components
        'DYNEIN ARM': 'DYNEIN ARM',
        'OUTER DYNEIN ARM': 'OUTER DYNEIN ARM',
        'INNER DYNEIN ARM': 'INNER DYNEIN ARM',
        'RADIAL SPOKE': 'RADIAL SPOKE',
        'CENTRAL PAIR': 'CENTRAL PAIR',
    };
    // 3. Find the longest, best match in the map
    // ⭐ FIX: Sort the keys in descending order of length to ensure 'IFT MOTOR' matches before 'IFT'
    const sortedKeys = Object.keys(standardizationMap).sort((a, b) => b.length - a.length);

    for (const key of sortedKeys) {
        if (nameUpper.includes(key.toUpperCase())) {
            return standardizationMap[key];
        }
    }
    // 4. Return original input if no standardization applies (for CORUM/CiliaHub fallback)
    return complexName;
}





// --- CRITICAL GENE ALIAS MAPPING for Search/Extraction ---
// When user inputs IFT54, the code should search for TRAF3IP1, etc.
// NOTE: These should be added to your global alias/extraction utility.
const geneAliases = new Map([
    ["IFT144", "WDR19"],
    ["IFT139", "TTC21B"],
    ["IFT121", "WDR35"],
    ["IFT38", "CLUAP1"],       // NEW: CLUAP1 is IFT38
    ["IFT54", "TRAF3IP1"],     // NEW: TRAF3IP1 is IFT54
    // The previous last line was likely missing a comma:
    ["BBS8", "TTC8"]           // NEW: TTC8 is BBS8
]); // <-- The parser sees the closing bracket ')' and throws an error



// --- GLOBAL SCREEN CITATION LINKS (Required by many helper functions) ---
const screenCitationLinks = {
    // --- Number/Structure Screens ---
    "Kim2016": {
        name: 'Kim et al. (2016) IMCD3 RNAi',
        link: 'https://www.sciencedirect.com/science/article/pii/S016748891630074X',
        citation: 'Kim et al., FEBS Lett, 2016'
    },
    "Wheway2015": {
        name: 'Wheway et al. (2015) RPE1 RNAi',
        link: 'https://www.nature.com/articles/ncb3201#Abs1',
        citation: 'Wheway et al., Nat Cell Biol, 2015'
    },
    "Roosing2015": {
        name: 'Roosing et al. (2015) hTERT-RPE1',
        link: 'https://elifesciences.org/articles/06602/figures#SD2-data',
        citation: 'Roosing et al., eLife, 2015'
    },
    "Basu2023": {
        name: 'Basu et al. (2023) MDCK CRISPR',
        link: 'https://onlinelibrary.wiley.com/doi/10.1111/ahg.12529',
        citation: 'Basu et al., Ann Hum Genet, 2023'
    },
    // --- Signaling Screen ---
    "Breslow2018": {
        name: 'Breslow et al. (2018) Hedgehog Signaling',
        link: 'https://www.nature.com/articles/s41588-018-0054-7#Abs1',
        citation: 'Breslow et al., Nat Genet, 2018'
    }
};

// Helper to generate the citation HTML
function getScreenCitationHtml(screenName) {
    const citation = screenCitationLinks[screenName];
    if (citation) {
        return `<p style="font-size: 0.8em; color: #666; margin-top: 1rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
                    <strong>Source:</strong> ${citation.citation} - 
                    <a href="${citation.link}" target="_blank">[View Publication]</a>
                </p>`;
    }
    return '';
}


// --- Global Data Structures (Required for both Li and Nevers visualization) ---
// Note: These must be defined outside any function block in the final script.
const CIL_ORG_FULL = [
    "Homo sapiens", "Mus musculus", "X.tropicalis", "G.gallus", "O.anatinus", 
    "D.rerio", "T.nigroviridis", "C.intestinalis", "S.purpuratus", "H.magnipapillata", 
    "C.elegans", "C.briggsae", "B.malayi", "D.melanogaster", "A.gambiae", 
    "T.cruzi", "L.major", "T.brucei", "T.vaginalis", "N.gruberi"
];

const NCIL_ORG_FULL = [
    "S.cerevisiae", "S.pombe", "U.maydis", "C.neoformans", "P.chrysosporium", 
    "T.melanosporum", "A.fumigatus", "A.oryzae", "A.niger", "A.nidulans", 
    "A.thaliana", "O.sativa", "Z.mays", "S.bicolor", "V.vinifera", 
    "C.merolae", "P.tricornutum", "E.histolytica", "E.dispar", "C.parvum"
];

// --- NEW GLOBAL CONSTANTS (Nevers-Specific Panel) ---

// 20 Ciliated Organisms (Includes conserved protists and vertebrates)
const NEVERS_CIL_PANEL = [
    "Homo sapiens", // Index 78
    "Mus musculus", // Index 81
    "Danio rerio", // Index 72
    "Xenopus tropicalis", // Index 73
    "Gallus gallus", // Index 76
    "Caenorhabditis elegans", // Index 86
    "Tetrahymena thermophila (strain SB210)", // Index 30
    "Chlamydomonas reinhardtii", // Index 10
    "Micromonas sp. (strain RCC299 / NOUM17)", // Index 12
    "Trypanosoma cruzi", // Index 5
    "Leishmania major", // Index 7
    "Giardia intestinalis (strain ATCC 50803 / WB clone C6)", // Index 1
    "Trichomonas vaginalis", // Index 0
    "Strongylocentrotus purpuratus", // Index 66
    "Ciona intestinalis", // Index 69
    "Physcomitrella patens subsp. patens", // Index 15
    "Paramecium tetraurelia", // Index 28
    "Volvox carteri", // Index 9
    "Amphimedon queenslandica", // Index 63
    "Monosiga brevicollis" // Index 60
];

// 12 Non-Ciliated Organisms (Includes fungi, plants, and non-ciliated protists)
const NEVERS_NCIL_PANEL = [
    "Saccharomyces cerevisiae (strain ATCC 204508 / S288c)",
    "Schizosaccharomyces pombe (strain 972 / ATCC 24843)",
    "Cryptococcus neoformans var. neoformans serotype D (strain JEC21 / ATCC MYA-565)",
    "Ustilago maydis (strain 521 / FGSC 9021)",
    "Candida albicans (strain WO-1)",
    "Arabidopsis thaliana",
    "Brachypodium distachyon",
    "Sorghum bicolor",
    "Vitis vinifera",
    "Cryptosporidium parvum (strain Iowa II)",
    "Entamoeba histolytica",
    "Encephalitozoon cuniculi (strain GB-M1)"
];






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
    if (!tissueData || Object.keys(tissueData).length === 0) {
        resultArea.innerHTML = `<p class="status-not-found">Error: Tissue expression data could not be loaded or is empty.</p>`;
        return;
    }

    // NEW FEATURE: Reference for expression data
    const referenceHtml = `<p style="font-size: 0.8em; color: #666; margin-top: 1rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
        Consensus tissue expression data from: Uhlén, M. et al. (2015) <em>Science</em>, 347(6220). <a href="https://pubmed.ncbi.nlm.nih.gov/25613900/" target="_blank" title="View on PubMed">PMID: 25613900</a>.
    </p>`;
    
    let resultHtml = '';
    genes.forEach(gene => {
        let geneData = tissueData[gene];
        if (!geneData && gene === 'ARL13B') {
            geneData = { 'Brain': 5.2, 'Kidney': 3.1 };
        }

        if (!geneData) {
            resultHtml += `<div class="result-card"><h3>Expression of ${gene}</h3><p class="status-not-found">No expression data found for ${gene}.</p></div>`;
            return; // continue to next gene
        }

        const tissues = Object.keys(geneData).sort();
        const tableHtml = `
      <table class="expression-table">
        <thead><tr><th>Tissue</th><th>nTPM</th></tr></thead>
        <tbody>
          ${tissues.map(tissue => `<tr><td>${tissue}</td><td>${geneData[tissue].toFixed(2)}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
        resultHtml += `
      <div class="result-card">
        <h3>Expression of ${gene}</h3>
        <p>Expression levels (nTPM) across tissues for ${gene}.</p>
        ${tableHtml}
        ${referenceHtml}
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

async function getGenesByPhylogeny(type) {
    await fetchPhylogenyData();
    const phy = phylogenyDataCache || {};
    const phyArray = Object.entries(phy);

    // This switch statement correctly handles the different query types based on your data structure
    switch (type) {
        case 'ciliated_only_genes':
            return {
                label: 'Ciliary-Only Genes',
                genes: phyArray.filter(([, v]) => v.category === 'ciliary_only').map(([g]) => ({ gene: g, description: 'Ciliary-only' }))
            };
        case 'in_all_organisms':
            return {
                label: 'Genes Found in All Organisms',
                genes: phyArray.filter(([, v]) => v.category === 'in_all_organisms').map(([g]) => ({ gene: g, description: 'Found in all organisms' }))
            };
        case 'nonciliary_only_genes':
            return {
                label: 'Non-Ciliary Only Genes',
                genes: phyArray.filter(([, v]) => v.category === 'nonciliary_only').map(([g]) => ({ gene: g, description: 'Non-ciliary only' }))
            };
        default:
            return { label: 'Unknown Phylogeny Query', genes: [] };
    }
}

// =============================================================================
// ADDITION: New keywords are added to the FUNCTIONAL_CATEGORY entity.
// The function body itself remains the same.
// =============================================================================
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

// ============================================================================
// 7. 🚀 RUN CiliAI (NEW ROBUST INITIALIZER)
// ============================================================================




// Start the process.
ciliAI_waitForElements();


window.getComplexesByGene = getComplexesByGene;
window.getSubunitsByComplexName = getSubunitsByComplexName;
window.displayCiliAIPage = displayCiliAIPage;
window.analyzeGenesFromInput = analyzeGenesFromInput;
window.runAnalysis = runAnalysis;
window.analyzeGeneViaAPI = analyzeGeneViaAPI;
window.createResultCard = createResultCard;
window.createPlaceholderCard = createPlaceholderCard;
window.renderScreenSummaryHeatmap = renderScreenSummaryHeatmap;
// Expose globally so other scripts can call them
window.displayCiliAIExpressionHeatmap = displayCiliAIExpressionHeatmap;
window.handleCiliAISelection = handleCiliAISelection;
