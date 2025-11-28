/* ==============================================================
 * CiliAI – Interactive Explorer (v5.1 – Nov 15, 2025)
 * ==============================================================
 * • BUILT FROM SCRATCH based on user's question list.
 * • Loads the pre-compiled 'ciliAI_master_database.json' + 'ciliAI_lookups.json'
 * • Lazy-loads the large phylogeny files only when needed.
 * • Fixes all known layout, normalization, and query routing bugs.
 * • INTEGRATED: displayFullGeneInfo (Nov 15, 2025)
 * ============================================================== */

// ==========================================================
// SAFE FALLBACKS (Prevents crashes if UI functions missing)
// ==========================================================

// CRITICAL FIX: Ensure all functions called early are defined globally or via fallbacks.

if (typeof window.updateStatus !== "function") {
    window.updateStatus = function (msg, state) {
        console.log(`STATUS[${state}]: ${msg}`);
    };
}

if (typeof window.renderUMAPPlot !== "function") {
    window.renderUMAPPlot = function () {
        console.warn("renderUMAPPlot() not implemented.");
    };
}

// FIX ADDITIONS: These three are called *inside* loadCiliAIData and initCiliAI early on.
if (typeof window.log !== "function") {
    window.log = function (msg) {
        console.log(`CiliAI LOG: ${msg}`);
    };
}

if (typeof window.addChatMessage !== "function") {
    window.addChatMessage = function (msg, isUser) {
        // This simple fallback ensures no crash if the chat UI isn't ready
        console.log(`CHAT [${isUser ? 'USER' : 'AI'}]: ${msg}`);
    };
}

if (typeof window.react !== "function") {
    window.react = function (type) {
        // Fallback relies on addChatMessage being defined above
        window.addChatMessage(`Feedback received: ${type}`, false);
    };
}

if (typeof window.clearChat !== "function") {
    window.clearChat = function () {
        // Fallback uses the logging function
        window.log('clearChat() fallback executed.');
    };
}

// NOTE: We also ensure 'handleUserSend' and 'handleGeneSearch' have fallbacks 
// as they are often called early by HTML event listeners.

if (typeof window.handleUserSend !== "function") {
    window.handleUserSend = function () {
        window.log("handleUserSend() fallback executed.");
    };
}

if (typeof window.handleGeneSearch !== "function") {
    window.handleGeneSearch = function () {
        window.log("handleGeneSearch() fallback executed.");
    };
}

    
    // ==========================================================
    // GLOBAL STATE
    // ==========================================================
    window.CiliAI = {
        data: { umap: [] },
        masterData: [],
        ready: false,
        lookups: {}
    };

window.getGenesByComplex = function(complexTerm) {
  const map = getComplexPhylogenyTableMap();
  const normTerm = normalizeTerm(complexTerm);
  const key = Object.keys(map).find(k => normalizeTerm(k) === normTerm);
  return key ? map[key].map(g => ({ gene: g, description: `Part of ${key}` })) : [];
};
    // --- Global variables to hold your data ---
let ciliaryGeneMap = new Map();
let screenDatabase = {};
let lastQueryContext = { type: null, data: [], term: null };
// Phylogeny data is lazy-loaded, so it starts as null
window.liPhylogenyCache = null;
window.neversPhylogenyCache = null;
window.CiliAI_UMAP = null; // This will be populated from the master DB

   
    // --- Data Maps (These are now just for the AI brain) ---


// --- GLOBAL CONSTANTS FOR ORGANISM PANELS ---
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

    const NEVERS_NCIL_PANEL = [
        "Saccharomyces cerevisiae (strain ATCC 204508 / S288c)",
        "Schizosacoscharomyces pombe (strain 972 / ATCC 24843)",
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

    // Li et al. 2014 organism panels (for compatibility)
    const CIL_ORG_FULL = [
        "H.sapiens", "M.musculus", "D.rerio", "X.tropicalis", "G.gallus",
        "C.elegans", "T.thermophila", "C.reinhardtii", "M.sp.RCC299",
        "T.cruzi", "L.major", "G.intestinalis", "T.vaginalis",
        "S.purpuratus", "C.intestinalis", "P.patens", "P.tetraurelia",
        "V.carteri", "A.queenslandica", "M.brevicollis"
    ];

    const NCIL_ORG_FULL = [
        "S.cerevisiae", "S.pombe", "C.neoformans", "U.maydis",
        "C.albicans", "A.thaliana", "B.distachyon", "S.bicolor",
        "V.vinifera", "C.parvum", "E.histolytica", "E.cuniculi"
    ];
    
    function getComplexPhylogenyTableMap() {
        return {
            // --- Core IFT machinery ---
            "IFT COMPLEX": ["WDR19", "IFT140", "TTC21B", "IFT122", "WDR35", "IFT43", "IFT172", "IFT80", "IFT57", "TRAF3IP1", "CLUAP1", "IFT20", "IFT88", "IFT81", "IFT74", "IFT70A", "IFT70B", "IFT56", "IFT52", "IFT46", "IFT27", "IFT25", "IFT22"],
            "IFT-A COMPLEX": ["WDR19", "IFT140", "TTC21B", "IFT122", "WDR35", "IFT43"],
            "IFT-B COMPLEX": ["IFT172", "IFT80", "IFT57", "TRAF3IP1", "CLUAP1", "IFT20", "IFT88", "IFT81", "IFT74", "IFT70A", "IFT70B", "IFT56", "IFT52", "IFT46", "IFT27", "IFT25", "IFT22"],
            "IFT-B1 COMPLEX": ["IFT172", "IFT80", "IFT57", "TRAF3IP1", "CLUAP1", "IFT20"],
            "IFT-B2 COMPLEX": ["IFT88", "IFT81", "IFT74", "IFT70A", "IFT70B", "IFT56", "IFT52", "IFT46", "IFT27", "IFT25", "IFT22"],
            
            //    NEW/UPDATED MOTOR COMPLEX (Combines IFT MOTORS and INTRAFLAGELLAR TRANSPORT MOTORS)
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
            "NEXIN-DYNEIN REGULATORY COMPLEX": ["GAS8", "GAS2L2", "CCDC39", "CCDC40", "CCDC164", "CCDC65"],
            
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

    function getDiseaseClassificationMap() {
        return {
            "Primary Ciliopathies": [
                "Acrocallosal Syndrome", "Alström Syndrome", "Autosomal Dominant Polycystic Kidney Disease",
                "Autosomal Recessive Polycystic Kidney Disease", "Bardet–Biedl Syndrome", "Bardet Biedel Syndrome",
                "COACH Syndrome", "Cranioectodermal Dysplasia", "Ellis-van Creveld Syndrome", "Hydrolethalus Syndrome", "Infantile Polycystic Kidney Disease",
                "Joubert Syndrome", "Leber Congenital Amaurosis", "Meckel–Gruber Syndrome", "Nephronophthisis", "Orofaciodigital Syndrome",
                "Senior-Løken Syndrome", "Short-rib Thoracic Dysplasia", "Skeletal Ciliopathy", "Retinal Ciliopathy", "Syndromic Ciliopathy",
                "Al-Gazali-Bakalinova Syndrome", "Bazex-Dupré-Christol Syndrome", "Bilateral Polycystic Kidney Disease", "Biliary, Renal, Neurologic, and Skeletal Syndrome",
                "Caroli Disease", "Carpenter Syndrome", "Complex Lethal Osteochondrodysplasia", "Greig Cephalopolysyndactyly Syndrome", "Kallmann Syndrome", "Lowe Oculocerebrorenal Syndrome",
                "McKusick-Kaufman Syndrome", "Morbid Obesity and Spermatogenic Failure", "Polycystic Kidney Disease", "RHYNS Syndrome", "Renal-hepatic-pancreatic Dysplasia", "Retinal Dystrophy", "STAR Syndrome",
                "Smith-Lemli-Opitz Syndrome", "Spondylometaphyseal Dysplasia", "Stromme Syndrome", "Weyers Acrofacial Dysostosis", "Hydrocephalus"
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
    }

    function ensureArray(value) {
        if (Array.isArray(value)) return value;
        if (value === null || value === undefined) return [];
        return [value];
    }

    // ==========================================================
   // ==========================================================
// 2. DATA LOADING & PROCESSING
// ==========================================================
  
/* ==============================================================
 * CiliAI – Unified Explorer (v6.0 - CELL WHISPERER INSPIRED DESIGN)
 * ==============================================================
 * Features: Three-column layout (Nav | Vis | Chat), Blue Branding, Organized Menus.
 * ============================================================== */

// ==========================================================
// 1. SAFE FALLBACKS & GLOBAL STATE (Keep as is)
// ... (The entire SAFE FALLBACKS block remains unchanged from previous step) ...
// ... (The entire GLOBAL STATE block remains unchanged from previous step) ...
// ... (The entire Data Maps and Constants block remains unchanged from previous step) ...
// ... (The entire CILIBRAIN and Plotting Logic sections remain defined locally) ...

    
/**
 * Loads the external data files required only by the Cilia Analysis Page plots.
 */
// ==========================================================
// 6. CILIA ANALYSIS PAGE (CRITICAL DEFINITIONS)
// ==========================================================

// --- Definition for the specialized analysis data loader ---
async function loadAnalysisData() { 
    const analysisBaseUrl = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/';
    try {
        window.log("Fetching specialized analysis data...");
        const [ciliaryGenesResponse, screenDataResponse] = await Promise.all([
            fetch(analysisBaseUrl + 'ciliahub_data.json'),
            fetch(analysisBaseUrl + 'cilia_screens_data.json')
        ]);

        const ciliaryGeneArray = await ciliaryGenesResponse.json();
        window.screenDatabase = await screenDataResponse.json(); 
        
        window.ciliaryGeneMap = new Map(ciliaryGeneArray.map(gene => [gene.gene.toUpperCase(), gene])); 
        window.log(`Successfully loaded ${window.ciliaryGeneMap.size} ciliary genes for analysis.`);

    } catch (error) {
        window.log(`Failed to load a required analysis data file: ${error.message}`, 'error');
    }
}

/**
 * Initializes the analysis page: loads data and sets up event listeners.
 */
function initializeCiliaPlotPage() {
    // CRITICAL: Call the specialized data loading function for the analysis page
    loadAnalysisData(); 
    
    populatePlotTypes(); 
    
    // Set up event listeners for the page
    const typeSelector = document.getElementById('ciliaplot-type-selector');
    const generateBtn = document.getElementById('generate-ciliaplot-btn');
    const downloadBtn = document.getElementById('download-plot-btn');

    if (typeSelector) typeSelector.addEventListener('change', updateCustomizationPanel);
    if (generateBtn) generateBtn.addEventListener('click', generateAnalysisPlots);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadPlot);
    
    // Initialize the default visualization explanation and customization panel
    updateCustomizationPanel();
    updatePlotExplanation();
}

// -----------------------------------------------------------------------------------
// (NOTE: Definitions for populatePlotTypes, updateCustomizationPanel, updatePlotExplanation, 
// generateAnalysisPlots, and findAndMergeGenes must exist locally in the file structure)
// -----------------------------------------------------------------------------------
function setupPageEventListeners() {
    // NOTE: We only keep event listeners for elements created dynamically
    // by the AI chat, like reaction buttons and action links.
    document.body.addEventListener('click', e => {
        const feedbackBtn = e.target.closest('.ciliai-reaction-btn');
        if (feedbackBtn) {
            const type = feedbackBtn.textContent.includes('👍') ? 'up' : 'down';
            window.react(type);
            return;
        }
        
        const geneBadge = e.target.closest('.gene-badge');
        if (geneBadge) {
            const gene = geneBadge.textContent.trim();
            if (gene) window.searchGene(gene);
            return;
        }

        // --- THIS IS THE CORRECTED BLOCK (Keep) ---
        const aiAction = e.target.closest('.ai-action');
        if (aiAction) {
            const action = aiAction.dataset.action;

            if (action) {
                e.preventDefault(); // Stop the link from navigating
                const genes = aiAction.dataset.genes || "";
                let query = "";
                
                if (action === 'show-li-heatmap') query = `show li phylogeny for ${genes}`;
                else if (action === 'show-nevers-heatmap') query = `show nevers phylogeny for ${genes}`;
                else if (action === 'show-table-view') query = `show data table for ${genes}`;
                
                // --- UMAP FIX (Keep) ---
                else if (action === 'show-umap-plot') {
                    window.log(`Action: show-umap-plot for ${genes}`);
                    window.renderUMAPPlot(genes); // Use window prefix for global functions
                    return;
                }
                // --- END OF UMAP FIX ---

                if (query) {
                    window.addChatMessage(query, true);
                    window.handleAIQuery(query);
                }
                return;
            }
        }
        // --- END OF CORRECTED BLOCK ---
    });

    // Removed listeners for geneSearch and chatInput as they are in index.html
}

    
    // ==========================================================
    // 4. CILIBRAIN v5.1 - QUERY & PLOTTING ENGINE
    // ==========================================================

    // --- 4A. Core Helper Functions ---

    function log(message) {
        console.log(`[CiliAI] ${message}`);
    }

/**
 * (REPLACEMENT) Robust Gene Extractor
 * This version uses a manual map for common genes and an expanded stopword list
 * to correctly parse complex queries and avoid "THE" bugs.
 */
function extractMultipleGenes(query) {
    if (!query || typeof query !== 'string') return [];
    
    log(`[Gene Extraction] Processing: "${query}"`);
    const qLower = query.toLowerCase();

    // Manual map for high-priority or problematic gene names
    const manualMap = {
        'kif3a': 'KIF3A',
        'ift88': 'IFT88',
        'bbs1': 'BBS1',
        'arl13b': 'ARL13B',
        'cep290': 'CEP290',
        'tmem67': 'TMEM67',
        'ofd1': 'OFD1',
        'ift52': 'IFT52',
        'pkd1': 'PKD1',
        'evc2': 'EVC2'
    };

    let foundGenes = new Set();
    
    // Check manual map first
    for (const [key, gene] of Object.entries(manualMap)) {
        if (qLower.includes(key)) {
            log(`[Gene Extraction] Found via manual map: ${gene}`);
            foundGenes.add(gene);
        }
    }

    // Use regex for other gene-like patterns
    const geneRegex = /\b([A-Z0-9\-\.]{3,})\b/gi;
    let matches = query.match(geneRegex) || [];
    
    // Enhanced stop words list to prevent "THE" bug
    const stopWords = new Set([
        "THE", "AND", "FOR", "NOT", "ARE", "WHAT", "SHOW", "LIST", "GENE", "GENES",
        "PLOT", "COMPARE", "WHAT'S", "DESCRIBE", "OF", "IN", "LOSS", "FUNCTION",
        "EFFECT", "WITH", "THAT", "THIS", "ABOUT", "TELL", "ME", "SHORT", "LONG",
        "LONGER", "CILIA", "CILIARY", "PROTEINS", "WHICH", "FIND", "CAUSES", "CAUSE",
        "KNOCKED", "DOWN", "WHEN", "NO", "KNOWN", "CORUM", "LINKED", "ASSOCIATED"
    ]);
    
    const geneMap = window.CiliAI.lookups.geneMap;
    if (!geneMap) return [];

    for (const match of matches) {
        const upperMatch = match.toUpperCase();
        if (!stopWords.has(upperMatch) && geneMap[upperMatch]) {
            log(`[Gene Extraction] Found via regex: ${upperMatch}`);
            foundGenes.add(upperMatch);
        }
    }
    
    const finalGenes = Array.from(foundGenes);
    log(`[Gene Extraction] Final valid genes:`, finalGenes);
    return finalGenes;
}
/**
 * STUB: Simulates Semantic Search (Step 1).
 * Always returns a low-confidence dummy match unless the query is specific.
 */
window.semanticSearch = async function(query, topK=5, minScore=0.60) {
    const qLower = query.toLowerCase();
    
    if (qLower.includes('bbsome') || qLower.includes('ift88')) {
        return [{ 
            id: 'IFT88_DESC', 
            text: 'IFT88 is a core component of the IFT-B complex.', 
            score: 0.95,
            meta: { type: 'definition', gene_symbol: qLower.includes('ift88') ? 'IFT88' : 'BBSome' }
        }];
    }
    return [{ id: 'NONE', text: 'no semantic match found', score: 0.1 }];
};

/**
 * V2.0 Intent Classifier (Step 2) - Uses the scoreIntents definition provided previously.
 * This is already correctly defined in the user's code scope, but we expose it globally for safety.
 */
// window.scoreIntents is used below.

/**
 * STUB: Handles Quantitative Intents (Step 5 - ranking).
 */
window.runQuantitativeEngine = async function(query, exactGenes) {
    window.log('STUB: Executing Quantitative Engine (Gap 4)');
    const qLower = query.toLowerCase();
    
    if (qLower.includes('highest expression') && qLower.includes('kidney')) {
        return `<div class="ai-result-card">📈 **Quantitative Engine Result:** Genes with highest expression in **Kidney** (Simulated Rank): IFT88, NPHP1, BBS1.</div>`;
    }
    return `<div class="ai-result-card">**Quantitative Engine:** Intent [ranking] recognized. Logic not yet implemented.</div>`;
};

/**
 * STUB: Handles Visualization Intents (Step 4).
 * Centralizes UMAP/Phylogeny routing.
 */
window.routeVisualizationAction = async function(query, exactGenes) {
    const qLower = query.toLowerCase();
    const gene = exactGenes[0] || 'FOXJ1';
    
    if (qLower.includes('umap') || qLower.includes('scrna')) {
        window.renderUMAPPlot(gene); // Call V1 visualizer
        return `<div class="ai-result-card">📊 UMAP plot for **${gene}** requested. Displaying visualization now.</div>`;
    }
    if (qLower.includes('phylogen') || qLower.includes('heatmap')) {
        // Use V1 phylogeny router to manage lazy loading/plotting
        return window.routePhylogenyAnalysis(query); 
    }
    return `<div class="ai-result-card">**Visualization:** Intent [visualize] recognized. Missing specific plot target.</div>`;
};


/**
 * STUB: Handles Graph/Synthesis Intents (Step 6).
 * This is the V2.0 Brain for complex and explanatory queries.
 */
// src/query/graph-query.ts (the real one used in CiliAI UI + CLI)
window.runGraphQuery = async function (
  query: string,
  params: Record<string, any> = {},
  options: {
    vector?: {
      queryText?: string;
      queryEmbedding?: number[];
      topK?: number;
      index?: string;
      model?: string;
    };
    timeoutMs?: number;
  } = {}
) {
  const { vector } = options;
  let finalQuery = query.trim();
  let finalParams = { ...params };

  if (vector?.queryText || vector?.queryEmbedding) {
    const embedding = vector.queryEmbedding || 
      await window.cili.embedding.embed(vector.queryText!, { model: vector.model });

    // CiliAI uses the new vector_index.search() procedure
    const indexName = vector.index || "chunk_vector_index";
    const topK = vector.topK || 10;

    const searchClause = `
      CALL vector_index.search(
        "${indexName}",
        $vector_query_embedding,
        ${topK}
      ) YIELD node AS __vector_node, score AS __vector_score
      WITH __vector_node AS chunk, __vector_score AS relevance_score
    `;

    // Inject vector search before user's MATCH/WHERE
    if (finalQuery.toLowerCase().includes("match") || finalQuery.toLowerCase().includes("where")) {
      const insertPos = finalQuery.search(/\b(MATCH|WHERE|RETURN|ORDER|LIMIT)/i);
      finalQuery = finalQuery.slice(0, insertPos) + searchClause + " " + finalQuery.slice(insertPos);
    } else {
      finalQuery = searchClause + "\n" + finalQuery;
    }

    finalParams.vector_query_embedding = embedding;
  }

  return await window.cili.memgraph.executeAndFetchAll(finalQuery, finalParams);
};
/**
 * STUB: Handles two-gene relationships (extracted from runGraphQuery)
 */
window.handleTwoGeneRelationshipQuery = function(geneA, geneB) {
    const sortedTerms = [geneA.toUpperCase(), geneB.toUpperCase()].sort().join('_'); 

    if (sortedTerms === 'CEP290_NPHP1') {
        return `<div class="ai-result-card">🤝 **Relationship: CEP290 and NPHP1**<br>Both proteins are key members of the **Transition Zone** gate (NPHP and MKS modules). They physically interact to maintain the ciliary barrier. Defects in either cause Joubert Syndrome.</div>`;
    }
    return `<div class="ai-result-card">**Relationship:** No strong, predefined relationship found between ${geneA} and ${geneB}.</div>`;
}

/**
 * STUB: V2.0 Entity Extractors (used by runGraphQuery)
 */
window.extractComplexTerm = function(query) {
    const qLower = query.toLowerCase();
    const map = {'bbsome': 'BBSome', 'ift-a': 'IFT-A Complex', 'mks complex': 'MKS Complex'};
    for (const [key, val] of Object.entries(map)) {
        if (qLower.includes(key)) return val;
    }
    return null;
}
window.formatRAGAnswer = function(semanticMatch) {
    return `<div class="ai-result-card">🧠 **RAG Answer:** The semantic model found a relevant passage: "${semanticMatch.text}" (Score: ${semanticMatch.score.toFixed(2)}).</div>`;
}


    
function formatListResult(title, genes, description = "") {
        let geneListHtml = '';
        if (genes && genes.length > 0) {
            const genesToShow = genes.slice(0, 20);
            geneListHtml = genesToShow.map(g =>
                `<li><strong>${g.gene}</strong>: ${g.description || 'No details available.'}</li>`
            ).join('');
            geneListHtml = `<ul>${geneListHtml}</ul>`;
            if (genes.length > 20) {
                geneListHtml += `<p style="font-size: 11px;">...and ${genes.length - 20} more.</p>`;
            }
        } else {
            geneListHtml = "<p>No matching genes found in the database.</p>";
        }
        const descriptionHtml = description ? `<p>${description}</p>` : '';
        return `
            <div class="ai-result-card">
                <strong>${title}</strong>
                ${descriptionHtml}
                ${geneListHtml}
            </div>
        `;
    }

function react(type) {
    const userMessages = Array.from(document.querySelectorAll('.ciliai-message.user'));
    const lastQuestion = userMessages.length > 0 
        ? (userMessages[userMessages.length - 1].querySelector('.ciliai-message-content')?.textContent || '').trim()
        : 'No question';

    const feedbackType = type === 'up' ? 'Positive' : 'Negative';

    // 100 % silent, 100 % reliable, zero console errors
    new Image().src = 'https://script.google.com/macros/s/AKfycby5PdLZdYKN9S06Tbt3x8lQfDrFhOXo3RteQbY6NFZawx22bH_EC2XuIf5_I6lDPSl5/exec' +
        '?type='     + encodeURIComponent(feedbackType) +
        '&question=' + encodeURIComponent(lastQuestion.substring(0, 500)) +
        '&url='      + encodeURIComponent(location.href) +
        '&t='        + Date.now();

    if (type === 'up') {
        addChatMessage('Thank you! Feedback received', false);
    } else {
        addChatMessage('Got it – thank you for the feedback!', false);
    }
}


function sendFeedbackEmail(feedbackType, userQuestion) {
    const subject = `CiliAI ${feedbackType === 'up' ? '👍 Positive' : '👎 Negative'} Feedback`;
    const body = `
User Question: ${userQuestion}
Feedback Type: ${feedbackType === 'up' ? 'Positive (👍)' : 'Negative (👎)'}
Time: ${new Date().toLocaleString()}
Page: ${window.location.href}

--
Sent from CiliAI Chat
    `.trim();
    
    // Open user's email client with pre-filled message
    window.open(`mailto:oktay.kaplan@agu.edu.tr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
}

function addChatMessage(html, isUser = false) {
        const chatWindow = document.getElementById('messages');
        if (!chatWindow) return;
        const msg = document.createElement('div');
        msg.className = `ciliai-message ${isUser ? 'user' : 'assistant'}`;
        msg.innerHTML = `<div class="ciliai-message-content">${html}</div>`;
        if (!isUser) {
            msg.querySelector('.ciliai-message-content').innerHTML += `
                <div class="ciliai-reaction-buttons">
                    <span class="ciliai-reaction-btn" onclick="react('up')">👍</span>
                    <span class="ciliai-reaction-btn" onclick="react('down')">👎</span>
                </div>`;
        }
        chatWindow.appendChild(msg);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function handleUserSend() {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput) return;
        const query = chatInput.value.trim();
        if (!query) return;
        addChatMessage(query, true);
        chatInput.value = '';
        handleAIQuery(query);
    }

    function updateStatus(text, status) {
        const statusEl = document.getElementById('dataStatus');
        if (statusEl) {
            statusEl.textContent = text;
            statusEl.className = `status ${status}`;
        }
    }

/**
 * Normalizes a term for keyword matching (Improved for Gene Symbols).
 * Keeps trailing 's' to avoid breaking singular acronyms (e.g., BBS, TAS).
 */
function normalizeTerm(term) {
    if (typeof term !== 'string') return '';
    
    // 1. Convert to lowercase
    let normalized = term.toLowerCase();
    
    // 2. Remove all non-alphanumeric characters (spaces, hyphens, periods, underscores, etc.)
    // Note: The original regex [\W_] is equivalent to [^a-zA-Z0-9].
    normalized = normalized.replace(/[^a-z0-9]/g, ''); 
    
    // NOTE: Removed .replace(/s$/, '') to protect gene symbols ending in S.
    
    return normalized;
}

    function handleGeneSearch(geneSymbol, queryAI = true) {
        const gene = geneSymbol.trim().toUpperCase();
        if (!gene) return;
        if (!window.CiliAI.ready) {
            console.warn("CiliAI data is not ready for gene search.");
            return;
        }
        const geneData = window.CiliAI.lookups.geneMap[gene];
        if (!geneData) {
            addChatMessage(`Gene Not Found: ${gene}. This gene is not in the CiliAI database.`, false);
            return;
        }
        let loc = 'unknown';
        if (geneData.Localization) { // Use 'Localization' from CSV
            const locString = String(geneData.Localization).toLowerCase();
            if (locString.includes('transition zone')) loc = 'transition-zone';
            else if (locString.includes('axoneme')) loc = 'axoneme';
            else if (locString.includes('basal body')) loc = 'basal-body';
            else if (locString.includes('membrane')) loc = 'ciliary-membrane';
            else if (locString.includes('nucleus')) loc = 'nucleus';
            else if (locString.includes('cytoplasm')) loc = 'cell-body';
        }
        document.querySelectorAll('.cilia-part').forEach(el => el.classList.remove('active', 'selected'));
        if (loc !== 'unknown' && document.getElementById(loc)) {
            document.getElementById(loc).classList.add('active');
        }
        if (queryAI) {
            handleAIQuery(`Tell me about ${gene}`);
        }
    }

// --- NEW HELPER: TISSUE-SPECIFIC DISEASE QUERY ---
/**
 * V2.0 UPDATED: handleTissueSpecificDiseaseQuery
 * Finds genes associated with a specific disease that are also expressed in a target tissue.
 * Replaces the 'lastQueryContext' flow with direct HTML list generation.
 * @param {string} diseaseTerm - The disease keyword (e.g., "Joubert Syndrome").
 * @param {string} tissueTerm - The tissue keyword (e.g., "kidney").
 * @returns {string} HTML message for the chat window (formatted list or error message).
 */
function handleTissueSpecificDiseaseQuery(diseaseTerm, tissueTerm) {
    const normDiseaseKey = normalizeDiseaseKey(diseaseTerm);
    const diseaseGenes = window.CiliAI.lookups.byCiliopathy[normDiseaseKey] || [];
    
    if (diseaseGenes.length === 0) {
        return `<div class="ai-result-card"><p>I found no genes associated with <strong>${diseaseTerm}</strong>.</p></div>`;
    }

    const geneMap = window.CiliAI.lookups.geneMap;
    const results = [];

    diseaseGenes.forEach(geneSymbol => {
        const gene = geneMap[geneSymbol];
        if (gene && hasExpressionInTissue(gene, tissueTerm)) {
            // Retrieve actual expression value for display clarity
            let expressionValue = 'N/A';
            if (gene.expression?.tissue?.[tissueTerm]) {
                expressionValue = gene.expression.tissue[tissueTerm].toFixed(2) + ' TPM';
            } else if (gene.expression?.scRNA) {
                // Find max expression in any cell type matching the tissue
                const maxExpr = Object.entries(gene.expression.scRNA)
                    .filter(([cellType]) => cellType.toLowerCase().includes(tissueTerm.toLowerCase()))
                    .map(([, val]) => val)
                    .reduce((max, val) => Math.max(max, val), 0);
                if (maxExpr > 0) {
                    expressionValue = maxExpr.toFixed(2) + ' (scRNA max)';
                }
            }

            results.push({
                gene: gene.Gene,
                disease: diseaseTerm,
                expression_in_tissue: expressionValue
            });
        }
    });

    if (results.length === 0) {
        return `<div class="ai-result-card">
                    <p>No genes causing <strong>${diseaseTerm}</strong> are strongly expressed in the <strong>${tissueTerm}</strong> tissue in the current dataset.</p>
                </div>`;
    }

    // V2.0 FIX: Directly call formatListResult and return the HTML.
    // The columns will be 'gene', 'disease', and 'expression_in_tissue'.
    return window.formatListResult(
        `Genes for ${diseaseTerm} expressed in ${tissueTerm} (${results.length})`, 
        results
    );
}

// --- NEW HELPER: COMPLEX + DISEASE OVERLAP QUERY ---
/**
 * Finds genes that belong to a specific complex AND are associated with a specific disease.
 * @param {string} complexTerm - The complex/module keyword (e.g., "BBSome").
 * @param {string} diseaseTerm - The disease keyword (e.g., "Joubert Syndrome").
 * @returns {string} HTML message for the chat window.
 */
// --- FIX: handleGeneInDiseaseQuery (Complex + Disease Overlap) ---
function handleGeneInDiseaseQuery(complexTerm, diseaseTerm) {
    const normComplex = normalizeTerm(complexTerm);
    const normDisease = normalizeDiseaseKey(diseaseTerm);
    const complexGenes = getGenesByComplex(complexTerm).map(g => g.gene);
    const diseaseGenes = window.CiliAI.lookups.byCiliopathy[normDisease] || [];
    const complexSet = new Set(complexGenes);
    const diseaseSet = new Set(diseaseGenes);

    if (complexSet.size === 0 || diseaseSet.size === 0) {
         return `<div class="ai-result-card"><p>No genes found for <strong>${complexTerm}</strong> or <strong>${diseaseTerm}</strong>.</p></div>`;
    }

    const overlappingGenes = [...complexSet].filter(gene => diseaseSet.has(gene));
    
    const results = overlappingGenes.map(geneSymbol => ({
        gene: geneSymbol,
        complex: complexTerm,
        disease: diseaseTerm
    }));

    if (results.length === 0) {
        return `<div class="ai-result-card">
                    <p>No genes were found in both the <strong>${complexTerm}</strong> complex and the <strong>${diseaseTerm}</strong> list.</p>
                </div>`;
    }

    // V2.0 FIX: Directly call formatListResult and return the HTML.
    return window.formatListResult(
        `${complexTerm} Genes Causing ${diseaseTerm} (${results.length})`, 
        results
    );
}


/**
 * This function finds genes from user input and merges data from both sources.
 */
function findAndMergeGenes(userInputArray) {
    const foundGenes = [];
    const seenGenes = new Set();
    const geneMap = window.CiliAI.lookups.geneMap; // Use main master data for robust lookup

    userInputArray.forEach(query => {
        const geneSymbol = query.toUpperCase().trim();
        if (!geneSymbol || seenGenes.has(geneSymbol)) return;

        // Use the main master data if available, fall back to ciliaryGeneMap if necessary
        let geneData = window.CiliAI.masterData.find(g => g.Gene.toUpperCase() === geneSymbol);

        if (geneData) {
            // Augment with screen data
            if (screenDatabase[geneSymbol]) {
                geneData.screens_summary = screenDatabase[geneSymbol];
            }
            foundGenes.push(geneData);
            seenGenes.add(geneSymbol);
        }
    });
    
    return { foundGenes };
}    
    
   // --- 4B. Table & Panel Display ---
    
    /**
     * (MODIFIED) Renders a dynamic table in the left panel.
     * The columns are now built automatically from the keys in the geneList objects.
     */
    function showDataInLeftPanel(title, geneList) {
        const container = document.getElementById('cilia-svg'); 
        if (!container) {
            console.error("Cannot find 'cilia-svg' container to draw table in.");
            return;
        }
        const wrapper = container.closest('.interactive-cilium');
        if (wrapper) wrapper.classList.add('table-view-active');

        if (!geneList || geneList.length === 0) {
            container.innerHTML = `
                <div class="ciliai-table-container">
                    <h3>${title}</h3>
                    <p style="padding: 20px;">No genes found matching this criteria.</p>
                    <button id="ciliai-back-btn" class="ciliai-button" style="background: #718096; margin-left: 10px;">Back to Diagram</button>
                </div>
            `;
            document.getElementById('ciliai-back-btn').addEventListener('click', () => {
                generateAndInjectSVG();
            });
            return;
        }

        // Dynamically get headers from the first object's keys
        const keys = Object.keys(geneList[0]);
        const headers = keys.map(k => k.charAt(0).toUpperCase() + k.slice(1)); // Capitalize

        let tableHTML = `<table class="ciliai-data-table"><thead><tr>`;
        headers.forEach(h => {
            tableHTML += `<th>${h}</th>`;
        });
        tableHTML += `</tr></thead><tbody>`;

        geneList.forEach(item => {
            tableHTML += `<tr>`;
            keys.forEach(key => {
                // Use '—' for any null or undefined values
                const value = item[key] !== null && item[key] !== undefined ? item[key] : '—';
                if (key === 'gene') {
                    tableHTML += `<td><strong>${value}</strong></td>`;
                } else {
                    tableHTML += `<td>${value}</td>`;
                }
            });
            tableHTML += `</tr>`;
        });
        tableHTML += `</tbody></table>`;

        const downloadButton = `<button id="ciliai-download-btn" class="ciliai-button">Download as CSV</button>`;
        const backButton = `<button id="ciliai-back-btn" class="ciliai-button" style="background: #718096;">Back to Diagram</button>`;

        container.innerHTML = `
            <div class="ciliai-table-container">
                <h3>${title} (${geneList.length} genes)</h3>
                <div>
                    ${downloadButton}
                    ${backButton}
                </div>
                <div class="ciliai-table-scroll-wrapper">
                    ${tableHTML}
                </div>
            </div>
        `;

        injectTableCSS();

        // MODIFIED: Removed descriptionHeader from the CSV download function call
        document.getElementById('ciliai-download-btn').addEventListener('click', () => {
            downloadTableAsCSV(title, geneList);
        });
        document.getElementById('ciliai-back-btn').addEventListener('click', () => {
            generateAndInjectSVG();
        });
    }

    /**
     * (MODIFIED) Downloads the dynamic table as a CSV.
     * The columns are now built automatically from the keys in the geneList objects.
     */
    function downloadTableAsCSV(title, geneList) {
        if (!geneList || geneList.length === 0) return;
        
        const keys = Object.keys(geneList[0]);
        const headers = keys.map(k => k.charAt(0).toUpperCase() + k.slice(1));
        
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += headers.join(',') + '\r\n';
        
        geneList.forEach(item => {
            const row = keys.map(key => {
                // Handle potential null/undefined values and ensure strings are quoted
                const cell = String(item[key] !== null && item[key] !== undefined ? item[key] : 'N/A').replace(/"/g, '""');
                return `"${cell}"`;
            });
            csvContent += row.join(',') + '\r\n';
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${title.replace(/[\s\W]+/g, '_')}_genelist.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    
    function injectTableCSS() {
    const styleId = 'ciliai-table-styles';
    if (document.getElementById(styleId)) return;
    const css = `
        .interactive-cilium.table-view-active { 
            max-width: none !important; 
            padding: 0 !important; 
            border: none !important; 
            box-shadow: none !important; 
            height: 100%; 
        }

        .ciliai-table-container { 
            width: 100%; 
            height: 100%; 
            display: flex; 
            flex-direction: column; 
            padding: 0; 
            background: #f7fbff; /* very light blue */
        }

        .ciliai-table-container h3 {
            font-size: 16px;
            color: #2b3a42; 
            margin-bottom: 10px;
            padding: 10px 10px 0 10px;
        }

        /* Button updated to a calm-blue palette */
        .ciliai-button { 
            padding: 8px 12px;
            background: #6c8aa3;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
            font-size: 12px;
            margin-bottom: 10px;
            margin-left: 10px;
            width: 150px;
        }
        .ciliai-button:hover { 
            background: #547a90; 
        }

        .ciliai-table-scroll-wrapper { 
            flex: 1; 
            overflow-y: auto; 
            border-top: 1px solid #c8d6e5; 
            border-bottom: 1px solid #c8d6e5; 
            margin: 0 0 10px 0; 
        }

        .ciliai-data-table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 12px; 
        }

        .ciliai-data-table th, 
        .ciliai-data-table td { 
            padding: 8px 12px; 
            text-align: left; 
            border-bottom: 1px solid #d5e2ed; 
        }

        /* Header now soft blue */
        .ciliai-data-table th { 
            background: #b3cde0; 
            color: #1f2a33;
            font-weight: 600;
            position: sticky; 
            top: 0; 
            z-index: 1; 
        }

        /* Row hover: gentle blue tint */
        .ciliai-data-table tbody tr:hover { 
            background-color: #e3f0fa; 
        }

        .ciliai-data-table tr:last-child td { 
            border-bottom: none; 
        }

        /* Highlighted strong text in a matching cool tone */
        .ciliai-data-table td strong { 
            color: #6c8aa3; 
            font-weight: 600; 
        }
    `;
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
}



    // --- 4C. Specific Data Handlers ---

   /**
 * (UPDATED) Handles screen queries and adds a follow-up for references.
 */
function handleScreenQuery(geneSymbol) {
    // --- Data Retrieval (DO NOT REMOVE) ---
    const gene = geneSymbol.toUpperCase();
    const g = window.CiliAI.lookups.geneMap[gene];
    if (!g) return `Sorry, I could not find data for "${gene}".`;
    
    let html = `<div class="ai-result-card"><h4>Screen Results for <strong>${gene}</strong></h4>`;
    let foundScreenKeys = [];

    // Use the exact column names from your CSV
    const percEffect = g['Percentage of ciliated cells (increase/decrease/no effect)'];
    const lofEffect = g['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'];
    const oeEffect = g['Overexpression effects on cilia length (increase/decrease/no effect)'];
    // --- END Data Retrieval ---

    if (percEffect && percEffect !== "Not Reported" && percEffect) {
        html += `<p><strong>Percent Ciliated Cells Effect:</strong> ${percEffect}</p>`;
    }
    if (lofEffect && lofEffect !== "Not Reported" && lofEffect) {
        html += `<p><strong>Loss-of-Function Effect:</strong> ${lofEffect}</p>`;
    }
    if (oeEffect && oeEffect !== "Not Reported" && oeEffect) {
        html += `<p><strong>Overexpression Effect:</strong> ${oeEffect}</p>`;
    }

    if (g.screens && Array.isArray(g.screens) && g.screens.length > 0) {
        html += '<strong>All Screen Data:</strong><ul>';
        g.screens.forEach(s => {
            if (s.source) {
                foundScreenKeys.push(s.source); // Store key for follow-up
                html += `<li><strong>${s.source}</strong>: ${s.result || 'No result'}</li>`;
            }
        });
        html += '</ul>';

        // Add follow-up question
        html += `<p style="margin-top:10px;"><em>Would you like the references for these screens?</em></p>`;
        
        // Set context for the next turn
        // NOTE: The 'lastQueryContext' variable must be available in the global scope.
        window.lastQueryContext = {
            type: 'screen_references',
            data: foundScreenKeys,
            term: `References for ${gene}`,
            descriptionHeader: 'References'
        };

    } else if (
        (!percEffect || percEffect === "Not Reported") &&
        (!lofEffect || lofEffect === "Not Reported") &&
        (!oeEffect || oeEffect === "Not Reported")
    ) {
        html += '<p>No specific screen data found in the database.</p>';
    }

    html += `</div>`; // Close ai-result-card
    return html;
}
    
    function handleDomainQuery(geneSymbols) {
        let html = '';
        const genes = Array.isArray(geneSymbols) ? geneSymbols : [geneSymbols];
        genes.forEach(geneSymbol => {
            const gene = geneSymbol.toUpperCase();
            const g = window.CiliAI.lookups.geneMap[gene];
            if (!g) {
                html += `<p>Sorry, I could not find data for "${gene}".</p>`;
                return;
            }
            html += `<h4>Domain Architecture for <strong>${gene}</strong></h4>`;
            if (g.pfam_ids && ensureArray(g.pfam_ids).length > 0) {
                html += '<p><strong>PFAM Domains:</strong></p><ul>';
                ensureArray(g.pfam_ids).forEach((id, index) => {
                    const desc = ensureArray(g.domain_descriptions)[index] || 'No description';
                    html += `<li><strong>${id}:</strong> ${desc}</li>`;
                });
                html += '</ul>';
            } else {
                html += '<p>No PFAM domain data found for this gene.</p>';
            }
        });
        return html;
    }

    function handleOrthologQuery(geneSymbol, organism) {
        const gene = geneSymbol.toUpperCase();
        const g = window.CiliAI.lookups.geneMap[gene];
        if (!g) return `Sorry, I could not find data for "${gene}".`;
        const orgKey = `Ortholog_${organism.toLowerCase().replace(/[\.\s]/g, '_')}`; // Match CSV column
        if (g[orgKey] && g[orgKey] !== 'N/A' && g[orgKey] !== null) {
            return formatListResult(`Ortholog for ${gene} in ${organism}`, [{
                gene: gene,
                description: `${organism} Ortholog: <strong>${g[orgKey]}</strong>`
            }]);
        } else {
            return `Sorry, I could not find a ${organism} ortholog for <strong>${gene}</strong>.`;
        }
    }
    
    function handleScRnaQuery(geneSymbols) {
        let html = `<h4>scRNA Expression Data</h4>`;
        const geneMap = window.CiliAI.lookups.geneMap;
        geneSymbols.forEach(gene => {
            const g = geneMap[gene];
            if (!g) {
                html += `<p><strong>${gene}:</strong> Not found in database.</p>`;
                return;
            }
            const exp = g.expression?.scRNA;
            html += `<strong>${g.Gene}:</strong> `; // Use 'Gene'
            if (exp) {
                 const topTissues = Object.entries(exp)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 3) 
                    .map(([tissue, val]) => `${tissue} (${val.toFixed(2)})`);
                if (topTissues.length > 0) {
                    html += `Top expression in: ${topTissues.join(', ')}...<br>`;
                } else {
                    html += `No scRNA expression data found.<br>`;
                }
            } else {
                html += `No scRNA expression data found.<br>`;
            }
        });
        if (geneSymbols.length > 1) {
            html += `<p style="font-size: 11px; margin-top: 5px;"><i>Note: A visual plot for expression comparison is not yet available.</i></p>`;
        }
        return `<div class="ai-result-card">${html}</div>`;
    }

    // --- 4D. Conversational Query Handlers ---

   // --- FIX: handleLocalizationQuery ---
function handleLocalizationQuery(term, query) {
    const geneList = getGenesByLocalization(term); // This already returns objects with 'gene' and 'localization'
    const count = geneList.length;
    if (count === 0) {
        return `Sorry, I could not find any genes localized to "${term}".`;
    }
    // V2.0 FIX: Return the formatted list directly.
    return window.formatListResult(`Genes localized to ${term} (${count})`, geneList);
}


    /**
     * (NEW) Extracts complex/module keywords from a query.
     */
    function extractComplexIntent(qLower) {
        const keywords = [
            'bbsome', 'ift-a', 'ift-b', 'nphp module', 'mks module', 'mks complex',
            'cplane complex', 'corum'
        ];
        for (const term of keywords) {
            if (qLower.includes(term)) {
                return term;
            }
        }
        return null;
    }

    /**
     * (NEW) Extracts evolutionary keywords from a query.
     */
    function extractEvolutionIntent(qLower) {
        if (qLower.includes('conserved') || qLower.includes('c. elegans')) return 'conserved_in_elegans';
        if (qLower.includes('ciliary specific') || qLower.includes('ciliary-specific')) return 'ciliary_specific';
        if (qLower.includes('vertebrate specific') || qLower.includes('vertebrate-specific')) return 'vertebrate_specific';
        return null;
    }

    /**
     * (NEW) Helper to check if a gene is conserved (basic check).
     */
    function isGeneConserved(gene) {
        // A simple proxy for "conserved in ciliated organisms"
        return gene && gene.Ortholog_C_elegans;
    }

    
   /**
 * V2.0 Integration Helper: Gets genes for a Complex and formats the output directly.
 * * Replaces V1's handleSimpleComplexQuery by eliminating the multi-turn confirmation.
 * @param {string} complexTerm - The name of the complex (e.g., 'BBSome').
 */
function getComplexGenesAndFormat(complexTerm) {
    // getGenesByComplex is assumed to be a V1 helper that fetches gene symbols.
    const geneList = window.getGenesByComplex(complexTerm);
    const count = geneList.length;

    if (count === 0) {
        // Preserve V1 Fallback: check if the user meant "complexes for gene..."
        const genes = window.extractMultipleGenes(complexTerm);
        if (genes.length > 0) {
            return window.handleGeneInComplexQuery(genes[0]);
        }
        return `Sorry, I could not find any genes for the complex "${complexTerm}".`;
    }
    
    // V2.0 Standard: Directly format and return the full list result.
    // The final list is formatted with a call to the V1 helper formatListResult.
    return window.formatListResult(`Genes in the ${complexTerm} complex (${count})`, geneList);
}

/**
 * V1 Function Preservation: handleGeneInComplexQuery remains as-is, 
 * but is now solely a helper for V2.0 routing. It returns the formatted HTML.
 */
// The original V1 function is kept because its logic is sound for: "What complexes is IFT88 in?"
// function handleGeneInComplexQuery(geneSymbol) { ... } // (Returns formatted list)
    
    function handleGeneInComplexQuery(geneSymbol) {
        const g = window.CiliAI.lookups.geneMap[geneSymbol];
        if (!g) return `Sorry, I could not find data for "${geneSymbol}".`;
        const complexNames = window.CiliAI.lookups.complexByGene[geneSymbol] || [];
        if (complexNames.length === 0) {
            return `No complex data was found for <strong>${geneSymbol}</strong>.`;
        }
        const complexList = complexNames.map(name => ({
            gene: name,
            description: "Known Complex"
        }));
        return formatListResult(`Complexes containing ${geneSymbol}`, complexList);
    }
// --- FIX: handleClassificationQuery (Genes in Classification) ---
function handleClassificationQuery(classificationName, query) {
    const qLower = query.toLowerCase();
    const casedClassificationName = Object.keys(getDiseaseClassificationMap()).find(key => normalizeTerm(key) === normalizeTerm(classificationName));
    if (!casedClassificationName) {
        return `Sorry, I don't recognize the classification "${classificationName}".`;
    }
    const normKey = normalizeTerm(casedClassificationName);
    
    if (qLower.includes('gene') || qLower.includes('genes') || qLower.includes('gene list')) {
        const geneList = window.CiliAI.lookups.byClassification[normKey] || [];
        const count = geneList.length;

        if (count === 0) {
            return `I did not find any genes directly associated with the classification "${casedClassificationName}".`;
        }
        
        const geneMap = window.CiliAI.lookups.geneMap;
        const geneListObjects = geneList.map(gene => ({
            gene: gene,
            classification: geneMap[gene]?.ciliopathy_classification || 'No classification listed'
        })).sort((a, b) => a.gene.localeCompare(b.gene)); 

        // V2.0 FIX: Directly call formatListResult and return the HTML.
        return window.formatListResult(
            `Genes for ${casedClassificationName} (${count})`, 
            geneListObjects
        );
    } else {
        // User just wants to list the diseases in the classification (V1 logic is acceptable here)
        const diseaseMap = getDiseaseClassificationMap();
        const diseaseList = diseaseMap[casedClassificationName] || [];
        const diseaseHtml = diseaseList.map(d => `<li>${d}</li>`).join('');
        return `
            <div class="ai-result-card">
                <strong>${casedClassificationName}</strong>
                <p>This classification includes the following diseases:</p>
                <ul>${diseaseHtml}</ul>
            </div>
        `;
    }
}

    function tellAboutCiliAI() {
        return `
            <div class="ai-result-card">
                <strong>Welcome to CiliAI!</strong>
                <p>I am an AI assistant designed to help you explore data on ciliary biology. You can ask me questions like:</p>
                <ul>
                    <li><b>Gene Details:</b> "What is IFT88?" or "Describe ARL13B."</li>
                    <li><b>Localization:</b> "List genes in the transition zone." or "Where is CEP290?"</li>
                    <li><b>Complexes:</b> "What genes are in the BBSome?" or "Complex components of OFD1."</li>
                    <li><b>Ciliopathies:</b> "Gene list of Joubert Syndrome." or "What genes cause PCD?"</li>
                    <li><b>Phylogeny:</b> "Show conservation of IFT88."</li>
                    <li><b>Domains:</b> "Which genes have WD40 domains?"</li>
                </ul>
                <p>My data comes from a pre-compiled database of over 23,000 genes, enriched with data from 8 specialized datasets (CORUM, UMAP, scRNA, Phylogeny, etc.).</p>
            </div>
        `;
    }
    

/**
 * UMAP PLOT (Expression Mapping Mode)
 * Renders a UMAP visualization where points are colored and sized based on the
 * expression level of the requested gene (or FOXJ1 by default).
 */
async function renderUMAPPlot(geneSymbol) { 
    const plotDivId = 'cilia-svg';
    const umapData = window.CiliAI_UMAP;
    const cellData = window.CiliAI.cellDataCache;
    const plotDiv = document.getElementById(plotDivId);
    
    // Default to FOXJ1 if no gene is provided (as requested)
    const gene = geneSymbol ? geneSymbol.toUpperCase() : 'FOXJ1'; 

    if (!plotDiv) {
        console.error('UMAP plot container "cilia-svg" not found.');
        return;
    }
    if (!umapData || !cellData) {
        window.addChatMessage('UMAP or scRNA-seq expression data is not available to plot.', false);
        return;
    }

    // --- Reset SVG panel ---
    plotDiv.innerHTML = '';
    const wrapper = plotDiv.closest('.interactive-cilium');
    if (wrapper) wrapper.classList.add('table-view-active');

    // 1. Fetch Expression Data and prepare arrays
    const geneExpressionData = cellData[gene] || {};
    
    const sampleSize = 15000;
    const sampledData = [];
    const colorArray = [];
    const sizeArray = []; // Array for scaling dot size
    
    let maxExpression = 0;
    const sizeBase = 5;          // Minimum dot size
    const sizeScaleMax = 12;     // Maximum dot size
    const expressionThreshold = 2; // Expression cap for dot size scaling

    const sourceData = umapData.length > sampleSize 
                       ? umapData.sort(() => 0.5 - Math.random()).slice(0, sampleSize) 
                       : umapData;

    for (const point of sourceData) {
        // Look up expression value for this cell's type for the target gene
        const expressionValue = geneExpressionData[point.cell_type] || 0;
        
        sampledData.push(point);
        colorArray.push(expressionValue);
        
        // Calculate dot size based on expression magnitude, capped by expressionThreshold
        const scaledMagnitude = Math.min(expressionValue, expressionThreshold) / expressionThreshold;
        sizeArray.push(sizeBase + (sizeScaleMax - sizeBase) * scaledMagnitude); 
        
        if (expressionValue > maxExpression) {
            maxExpression = expressionValue;
        }
    }
    
    if (maxExpression === 0 && gene) {
        window.addChatMessage(`Gene <strong>${gene}</strong> found, but has no detectable expression in the loaded Lung scRNA-seq dataset.`, false);
    }
    
    // --- Annotations (Cell Type Labels) remain unchanged ---
    const cellTypes = [...new Set(sampledData.map(d => d.cell_type))];
    const annotations = [];
    const median = arr => {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };
    for (const ct of cellTypes) {
        if (!ct) continue;
        const pts = sampledData.filter(d => d.cell_type === ct);
        if (pts.length === 0) continue;
        const xs = pts.map(p => p.x);
        const ys = pts.map(p => p.y);

        annotations.push({
            x: median(xs),
            y: median(ys),
            text: ct,
            showarrow: false,
            font: { color: '#FFFFFF', size: 10, family: 'Arial, sans-serif' },
            bgcolor: 'rgba(0,0,0,0.45)', borderpad: 2, bordercolor: 'rgba(0,0,0,0.45)', borderwidth: 1,
            xref: 'x', yref: 'y'
        });
    }

    // 3. Define Plotly Trace with Color Mapping (Red Gradient)
    const colorScaleRedGradient = [
        [0, '#F8F8F8'], // Light Gray/Off-White (0 expression)
        [0.0001, '#FFDAD0'], // Peach/Very Light Red (Start of expression, matches requested light red base)
        [1, '#E60000']       // Vibrant Red (Max expression color)
    ];
    
    const plotData = [{
        x: sampledData.map(p => p.x),
        y: sampledData.map(p => p.y),
        // Hovertext includes expression data again
        text: sampledData.map((p, i) => `Cell Type: ${p.cell_type}<br>Expression: ${colorArray[i].toFixed(3)}`),
        mode: 'markers',
        type: 'scattergl',
        hoverinfo: 'text',
        marker: {
            color: colorArray, // Variable color array (intensity)
            colorscale: colorScaleRedGradient, // Red Gradient
            cmin: 0,
            cmax: maxExpression > 0 ? maxExpression : 0.0001,
            colorbar: {
                title: `${gene} Expr. (TPM)`
            },
            size: sizeArray, // Variable size array (magnitude)
            opacity: 0.8
        }
    }];

    const layout = {
        title: `UMAP: **${gene}** Expression (Size & Color Mapped)`,
        xaxis: { title: 'UMAP 1', zeroline: false, showgrid: false },
        yaxis: { title: 'UMAP 2', zeroline: false, showgrid: false },
        hovermode: 'closest',
        margin: { t: 50, b: 50, l: 50, r: 50 },
        plot_bgcolor: '#FFFFFF',
        paper_bgcolor: '#F8F8F8',
        annotations: annotations,
        showlegend: false
    };

    Plotly.newPlot(plotDivId, plotData, layout, { responsive: true });

    // --- Back button ---
    const backButton = document.createElement('button');
    backButton.id = 'ciliai-back-btn';
    backButton.className = 'ciliai-button';
    backButton.style.cssText = 'background: #718096; position: absolute; top: 10px; right: 10px; z-index: 10;';
    backButton.textContent = 'Back to Diagram';
    backButton.onclick = () => window.generateAndInjectSVG();
    plotDiv.prepend(backButton);
}
    
    /**
     * Helper function to lazy-load phylogeny data only when needed
     */
    async function ensurePhylogenyDataLoaded() {
        if (window.liPhylogenyCache && window.neversPhylogenyCache) {
            return true; // Already loaded
        }
        
        addChatMessage("Loading large phylogeny datasets... this may take a moment.", false);
        log("Lazy-loading phylogeny data...");

        try {
            const baseUrl = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/';
            const [liRes, neversRes] = await Promise.all([
                fetch(baseUrl + 'li_et_al_2014_matrix_optimized.json'),
                fetch(baseUrl + 'nevers_et_al_2017_matrix_optimized.json')
            ]);
            
            if (!liRes.ok || !neversRes.ok) {
                throw new Error(`Failed to fetch phylogeny files: ${liRes.status}, ${neversRes.status}`);
            }
            
            window.liPhylogenyCache = await liRes.json();
            window.neversPhylogenyCache = await neversRes.json();
            
            log("Phylogeny data successfully lazy-loaded.");
            return true;

        } catch (e) {
            console.error("Failed to lazy-load phylogeny data:", e);
            addChatMessage(`Error: Could not load phylogeny data. ${e.message}`, false);
            return false;
        }
    }

    async function routePhylogenyAnalysis(query) {
        // This is now an async function to handle lazy-loading
        const qLower = query.toLowerCase();

        // 1. Check if data is loaded. If not, load it.
        const dataLoaded = await ensurePhylogenyDataLoaded();
        if (!dataLoaded) {
            return "Could not load phylogeny data. Please try again.";
        }

        // --- FIX: Check for complex/module names in the query ---
        let genes = extractMultipleGenes(query);
        if (genes.length === 0) {
            // No genes found, check for a complex name
            const complexKey = Object.keys(window.CiliAI.lookups.byModuleOrComplex).find(key => 
                qLower.includes(normalizeTerm(key))
            );
            if (complexKey) {
                log(`Phylogeny query for complex: ${complexKey}`);
                genes = window.CiliAI.lookups.byModuleOrComplex[complexKey];
            }
        }
        // --- END FIX ---

        // 2. Proceed with routing as before
        if (qLower.includes('table') || qLower.includes('view data') || qLower.includes('species count')) {
            if (genes.length >= 1) {
                return renderPhylogenyTable(genes);
            }
        }
        
        if (genes.length === 2 && (qLower.includes('share') || qLower.includes('both') || qLower.includes('overlap'))) {
            return compareGeneSpeciesOverlap(genes[0], genes[1]);
        }

        if (qLower.includes('list') || qLower.includes('show ciliary genes') || qLower.includes('which genes are') || qLower.includes('find genes with') || qLower.includes('every ciliary gene')) {
            if (qLower.includes('vertebrate')) return getPhylogenyList('Vertebrate_specific');
            if (qLower.includes('mammalian') || qLower.includes('recently evolved')) return getPhylogenyList('Mammalian_specific');
            if (qLower.includes('ciliary specific') || qLower.includes('ciliary genes') || qLower.includes('every ciliary gene')) return getPhylogenyList('Ciliary_specific');
            if (qLower.includes('absent in fungi') || qLower.includes('not in fungi')) return getPhylogenyList('absent_in_fungi');
            if (qLower.includes('all organisms') || qLower.includes('universally conserved') || qLower.includes('broadest conservation spectrum')) return getPhylogenyList('in_all_organisms');
        }

        const isPhylogenyMandate = qLower.includes('evolution') || qLower.includes('taxa') || qLower.includes('phylogenetic') || qLower.includes('heatmap') || qLower.includes('conservation');

        if (genes.length >= 1 || isPhylogenyMandate) {
            
            // --- MODIFIED: Default to 'nevers' unless 'li' is specified ---
            const source = qLower.includes('li') ? 'li' : 'nevers';
            
            // --- MODIFIED: Use new default gene list ---
            const definitiveDefaultGenes = ["ZC2HC1A", "CEP41", "BBS1", "BBS2", "BBS5", "ZNF474", "IFT81", "BBS7"];
            const finalGenes = genes.length >= 1 ? genes : definitiveDefaultGenes; 

            const plotResult = handlePhylogenyVisualizationQuery(finalGenes, source, 'heatmap'); 

            return `<div class="ai-result-card">
                        <p>Displaying ${source.toUpperCase()} phylogenetic heatmap for <strong>${finalGenes.join(', ')}</strong> on the left panel.</p>
                        ${plotResult.htmlLinks || ''}
                    </div>`;
        }
        return null; 
    }

    /**
 * Calculates the Jaccard index between two gene sets.
 * @param {Array<string>} setA 
 * @param {Array<string>} setB 
 * @returns {number} Jaccard index (0 to 1).
 */
function calculateJaccard(setA, setB) {
    const set1 = new Set(setA);
    const set2 = new Set(setB);

    let intersection = 0;
    for (const gene of set1) {
        if (set2.has(gene)) {
            intersection++;
        }
    }

    const union = set1.size + set2.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

/**
 * (Placeholder) Simulates GO Term enrichment lookup.
 * In a real system, this would call an API or process a local enrichment file.
 * @param {Array<string>} genes 
 * @returns {Array<Object>} List of top enriched terms.
 */
function getEnrichedGOTerms(genes) {
    if (genes.length < 5) {
        return [];
    }
    // Mock enrichment data based on common ciliary themes
    return [
        { term: "Intraflagellar Transport (IFT)", pval: 1e-15, count: Math.floor(genes.length * 0.4) },
        { term: "Ciliary Membrane Docking", pval: 1e-09, count: Math.floor(genes.length * 0.3) },
        { term: "Basal Body/Centriole", pval: 1e-07, count: Math.floor(genes.length * 0.25) }
    ];
}
    
   function handlePhylogenyVisualizationQuery(genes, source = 'li', type = 'heatmap') {
        // This function no longer needs to be async, as data is pre-loaded by the router
        const plotId = 'cilia-svg';
        
        // --- MODIFIED: Do NOT call generateAndInjectSVG() ---
        // generateAndInjectSVG(); // <-- REMOVED THIS LINE
        
        const plotDiv = document.getElementById(plotId); 
        if (!plotDiv) {
            console.error("Phylogeny Error: plot container 'cilia-svg' not found.");
            return { htmlLinks: "" };
        }

        log(`Plotting ${source} heatmap for ${genes.join(', ')} to ${plotId}`);
        
        const wrapper = plotDiv.closest('.interactive-cilium');
        if (wrapper) wrapper.classList.add('table-view-active');
        
        plotDiv.innerHTML = `<div style="padding: 40px; text-align: center;">Loading ${source.toUpperCase()} phylogeny plot for ${genes.join(', ')}...</div>`;

        try {
            let plotResult;
            if (source === 'nevers') {
                plotResult = renderNeversPhylogenyHeatmap(genes);
            } else {
                plotResult = renderLiPhylogenyHeatmap(genes);
            }

            if (!plotResult || !plotResult.plotData) {
                throw new Error(plotResult.html || 'The plot renderer returned no data.');
            }

            Plotly.newPlot(plotId, plotResult.plotData, plotResult.plotLayout, { responsive: true });
            
            // --- MODIFIED: Added "Add Gene" button and styled both buttons ---
            const backButton = document.createElement('button');
            backButton.id = 'ciliai-back-btn';
            backButton.className = 'ciliai-button';
            backButton.style.cssText = 'background: #718096; position: absolute; top: 10px; right: 10px; z-index: 10;';
            backButton.textContent = 'Back to Diagram';
            backButton.onclick = () => generateAndInjectSVG();
            plotDiv.prepend(backButton); 

            const addGeneButton = document.createElement('button');
            addGeneButton.id = 'ciliai-add-gene-btn';
            addGeneButton.className = 'ciliai-button';
            addGeneButton.style.cssText = 'background: #667eea; position: absolute; top: 10px; right: 170px; z-index: 10;';
            addGeneButton.textContent = 'Add Gene';
            addGeneButton.onclick = () => {
                const geneToAdd = prompt("Enter gene symbol to add to the plot:", "");
                if (!geneToAdd || geneToAdd.trim() === "") return;
                
                // Get the current source from the plot title
                const plotTitle = plotDiv.layout.title.text || '';
                const currentSource = plotTitle.includes('Nevers') ? 'nevers' : 'li';
                
                // Get the current list of genes from the plot's y-axis
                const currentGenes = plotDiv.data[0].y;
                const newGeneList = [...currentGenes, geneToAdd.trim().toUpperCase()];

                addChatMessage(`show ${currentSource} plot for ${newGeneList.join(',')}`, true);
                handleAIQuery(`show ${currentSource} plot for ${newGeneList.join(',')}`);
            };
            plotDiv.prepend(addGeneButton);
            // --- END OF MODIFICATION ---

            return { htmlLinks: plotResult.htmlLinks || "" };

        } catch (e) {
            console.error("handlePhylogenyVisualizationQuery Error:", e);
            plotDiv.innerHTML = `<p style="padding: 20px;"><strong>Error generating plot:</strong> ${e.message}</p>`;
            addChatMessage(`<strong>Error generating plot:</strong> ${e.message}`, false);
            return { htmlLinks: "" };
        }
    }
    

    // --- (Phylogeny Plotting Helpers) ---
    
    function getLiConservation(geneSymbol) {
        const geneUpper = geneSymbol.toUpperCase();
        if (!window.liPhylogenyCache || !window.liPhylogenyCache.genes) {
            return `<div class="ai-result-card"><h3>${geneSymbol} (Li et al. 2014)</h3><p class="status-not-found">Could not load the Li et al. 2014 dataset.</p></div>`;
        }
        const geneEntry = Object.values(window.liPhylogenyCache.genes).find(g => g.g.toUpperCase() === geneUpper);
        if (!geneEntry) {
            return `<div class="ai-result-card"><h3>${geneSymbol} (Li et al. 2014)</h3><p class="status-not-found">Gene not found in the Li et al. 2014 dataset.</p></div>`;
        }
        return formatLiGeneData(geneSymbol, geneEntry, window.liPhylogenyCache.summary);
    }

    function formatLiGeneData(geneSymbol, geneData, summary) {
        const organismsList = summary.organisms_list;
        const classList = summary.class_list;
        const species = geneData.s.map(index => organismsList[index]).join(', ');
        const category = (classList[geneData.c] || "Unknown").replace(/_/g, ' ');
        return `
            <div class="ai-result-card">
                <h3>${geneSymbol} Phylogeny (Li et al. 2014)</h3>
                <p><strong>Gene Name:</strong> ${geneData.g}</p>
                <p><strong>Entrez ID:</strong> ${geneData.e}</p>
                <p><strong>Classification:</strong> ${category}</p>
                <p><strong>Found in ${geneData.s.length} Species:</strong> ${species || 'N/A'}</p>
                <p style="font-size: 0.8em; color: #666; margin-top: 1rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
                    <strong>Source:</strong> Li, Y. et al. (2014) <em>Cell</em>. <a href="https://pubmed.ncbi.nlm.nih.gov/24995987/" target="_blank">PMID: 24995987</a>
                </p>
            </div>`;
    }

    function renderNeversPhylogenyHeatmap(genes) {
        const neversData = window.neversPhylogenyCache;
        if (!neversData) {
            return { html: `<p>Nevers et al. 2017 data not loaded.</p>` };
        }
        const CIL_COUNT = NEVERS_CIL_PANEL.length;
        const neversOrgList = neversData.organism_groups?.all_organisms_list || [];
        const neversOrgMap = new Map();
        neversOrgList.forEach((name, index) => {
            neversOrgMap.set(name, index);
            const simplifiedKey = name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[\s\.\(\)]/g, '');
            neversOrgMap.set(simplifiedKey, index);
        });
        const targetOrganisms = NEVERS_CIL_PANEL.concat(NEVERS_NCIL_PANEL);
        const targetNeversIndices = targetOrganisms.map(orgName => {
            const simplifiedKey = orgName.toLowerCase().replace(/[\s\.]/g, '');
            if (neversOrgMap.has(orgName)) return neversOrgMap.get(orgName);
            if (neversOrgMap.has(simplifiedKey)) return neversOrgMap.get(simplifiedKey);
            return undefined;
        });
        const geneLabels = genes.map(g => g.toUpperCase());
        const matrix = [];
        const textMatrix = [];
        geneLabels.forEach(gene => {
            const geneData = neversData.genes?.[gene];
            const presenceIndices = new Set(geneData ? geneData.s : []);
            const row = [];
            const textRow = [];
            targetOrganisms.forEach((orgName, index) => {
                const neversIndex = targetNeversIndices[index];
                const isCiliated = index < CIL_COUNT;
                const isPresent = neversIndex !== undefined && presenceIndices.has(neversIndex);
                let zValue = 0;
                let status = "Absent";
                if (isPresent) {
                    zValue = isCiliated ? 2 : 1;
                    status = "Present";
                }
                row.push(zValue);
                textRow.push(`Gene: ${gene}<br>Organism: ${orgName}<br>Status: ${status}`);
            });
            if (row.length > 0) {
                matrix.push(row);
                textMatrix.push(textRow);
            }
        });
        const NEVERS_COLORS = [
            [0 / 2, '#F0F0F0'], [0.0001 / 2, '#F0A0A0'], [1 / 2, '#F0A0A0'],
            [1.0001 / 2, '#00A0A0'], [2 / 2, '#00A0A0']
        ];
        const trace = {
            z: matrix,
            x: targetOrganisms.map(name => {
                let cleanedName = name.replace(/\s*\(.*?\)\s*/g, '').trim();
                if (cleanedName.includes("D.rerio")) return "Zebrafish";
                if (cleanedName.includes("H.sapiens")) return "Human";
                return cleanedName;
            }),
            y: geneLabels,
            type: 'heatmap',
            colorscale: NEVERS_COLORS,
            showscale: false,
            hoverinfo: 'text',
            text: textMatrix,
            xgap: 0.5, ygap: 0.5, line: { color: '#000000', width: 0.5 }
        };
        const layout = {
            // --- MODIFIED: Title changed ---
            title: `Phylogenetics Analysis (Nevers et al. 2017) - ${genes.join(', ')}`,
            xaxis: { title: 'Organisms (Ciliated | Non-Ciliated)', tickangle: 45, automargin: true },
            yaxis: { title: 'Genes', automargin: true },
            shapes: [{
                type: 'line',
                xref: 'x', x0: CIL_COUNT - 0.5, x1: CIL_COUNT - 0.5,
                yref: 'paper', y0: 0, y1: 1,
                line: { color: 'black', width: 2 }
            }],
            margin: { t: 50, b: 200, l: 150, r: 50 },
            height: Math.max(500, genes.length * 40 + 150)
        };
        return {
            plotData: [trace],
            plotLayout: layout,
            htmlLinks: `
                <p class="ai-suggestion" style="margin-top: 10px;">
                    <a href="#" class="ai-action" data-action="show-li-heatmap" data-genes="${genes.join(',')}">⬅️ Show Li et al. (2014)</a>
                    <span style="margin: 0 10px;">|</span>
                    <a href="#" class="ai-action" data-action="show-table-view" data-genes="${genes.join(',')}">📋 Show Data Table</a>
                </p>
            `
        };
    }

    function renderLiPhylogenyHeatmap(genes) {
        const liData = window.liPhylogenyCache;
        if (!liData) {
            throw new Error("Li et al. 2014 data not loaded.");
        }
        const CIL_COUNT = CIL_ORG_FULL.length;
        const VERTEBRATE_LI_MAP = new Map([
            ["homosapiens", "H.sapiens"], ["m.gallopavo", "M.gallopavo"], ["musmusculus", "M.musculus"],
            ["daniorerio", "D.rerio"], ["xenopustropicalis", "X.tropicalis"], ["gallusgallus", "G.gallus"],
            ["o.anatinus", "O.anatinus"], ["t.nigroviridis", "T.nigroviridis"], ["c.elegans", "C.elegans"],
            ["c.briggsae", "C.briggsae"], ["c.reinhardtii", "C.reinhardtii"], ["t.thermophila", "T.thermophila"],
            ["s.cerevisiae", "S.cerevisiae"], ["a.thaliana", "A.thaliana"], ["o.sativa", "O.sativa"]
        ]);
        const liOrgList = liData.summary.organisms_list;
        const liOrgMap = new Map();
        liOrgList.forEach((name, index) => {
            liOrgMap.set(name, index);
            liOrgMap.set(name.toLowerCase().replace(/[\s\.]/g, ''), index);
        });
        const targetOrganisms = CIL_ORG_FULL.concat(NCIL_ORG_FULL);
        const targetLiIndices = targetOrganisms.map(orgName => {
            const lowerOrg = orgName.toLowerCase();
            const simplifiedKey = lowerOrg.replace(/[\s\.]/g, '');
            if (VERTEBRATE_LI_MAP.has(simplifiedKey)) {
                const liAbbrev = VERTEBRATE_LI_MAP.get(simplifiedKey);
                if (liOrgMap.has(liAbbrev)) {
                    return liOrgMap.get(liAbbrev);
                }
            }
            if (liOrgMap.has(simplifiedKey)) return liOrgMap.get(simplifiedKey);
            if (liOrgMap.has(orgName)) return liOrgMap.get(orgName);
            return undefined;
        });
        const geneLabels = [];
        const matrix = [];
        const textMatrix = [];
        const genesFound = [];
        const genesNotFound = [];
        genes.forEach(gene => {
            const geneUpper = gene.toUpperCase();
            const geneData = Object.values(liData.genes).find(g => g.g && g.g.toUpperCase() === geneUpper);
            if (!geneData) {
                genesNotFound.push(geneUpper);
                return;
            }
            genesFound.push(geneUpper);
            const presenceIndices = new Set(geneData.s || []);
            const row = [];
            const textRow = [];
            targetOrganisms.forEach((orgName, index) => {
                const liIndex = targetLiIndices[index];
                const isCiliated = index < CIL_COUNT;
                const isPresent = liIndex !== undefined && presenceIndices.has(liIndex);
                let zValue = 0;
                let status = "Absent";
                if (isPresent) {
                    zValue = isCiliated ? 2 : 1;
                    status = "Present";
                }
                row.push(zValue);
                textRow.push(`Gene: ${geneUpper}<br>Organism: ${orgName}<br>Status: ${status}`);
            });
            if (row.length > 0) {
                matrix.push(row);
                textMatrix.push(textRow);
                geneLabels.push(geneUpper);
            }
        });
        if (matrix.length === 0) {
            let errorMsg = "None of the requested genes were found in the Li (2014) dataset.";
            if (genesNotFound.length > 0) {
                errorMsg = `The gene(s) <strong>${genesNotFound.join(', ')}</strong> were not found in the Li (2014) phylogenetic dataset.`;
            }
            throw new Error(errorMsg);
        }
        const trace = {
            z: matrix,
            x: targetOrganisms.map(name => {
                if (name === "H.sapiens") return "Human";
                if (name === "M.musculus") return "Mouse";
                if (name === "D.rerio") return "Zebrafish";
                if (name.includes("elegans")) return "C. elegans";
                return name.replace(/\./g, '').split(' ')[0];
            }),
            y: geneLabels,
            type: 'heatmap',
            colorscale: [
                [0 / 2, '#FFFFFF'], [0.0001 / 2, '#FFE5B5'], [1 / 2, '#FFE5B5'],
                [1.0001 / 2, '#698ECF'], [2 / 2, '#698ECF']
            ],
            showscale: false,
            hoverinfo: 'text',
            text: textMatrix,
            xgap: 0.5, ygap: 0.5,
            line: { color: '#000000', width: 0.5 }
        };
        const layout = {
            // --- MODIFIED: Title changed ---
            title: `Phylogenetics Analysis (Li et al. 2014) - ${geneLabels.join(', ')}`,
            xaxis: { title: 'Organisms (Ciliated | Non-Ciliated)', tickangle: 45, automargin: true },
            yaxis: { title: 'Genes', automargin: true },
            shapes: [{
                type: 'line',
                xref: 'x', x0: CIL_COUNT - 0.5, x1: CIL_COUNT - 0.5,
                yref: 'paper', y0: 0, y1: 1,
                line: { color: 'black', width: 2 }
            }],
            margin: { t: 50, b: 200, l: 150, r: 50 },
            height: Math.max(500, geneLabels.length * 40 + 150)
        };
        let links = `<p class="ai-suggestion" style="margin-top: 10px;">
                                <a href="#" class="ai-action" data-action="show-nevers-heatmap" data-genes="${geneLabels.join(',')}">➡️ Show Nevers et al. (2017)</a>
                                <span style="margin: 0 10px;">|</span>
                                <a href="#" class="ai-action" data-action="show-table-view" data-genes="${geneLabels.join(',')}">📋 Show Data Table</a>
                             </p>`;
        if (genesNotFound.length > 0) {
            links = `<p class="status-note">Note: <strong>${genesNotFound.join(', ')}</strong> not found in this dataset.</p>` + links;
        }
        return {
            plotData: [trace],
            plotLayout: layout,
            htmlLinks: links
        };
    }

    
    function renderLiPhylogenyHeatmap(genes) {
        const liData = window.liPhylogenyCache;
        if (!liData) {
            throw new Error("Li et al. 2014 data not loaded.");
        }
        const CIL_COUNT = CIL_ORG_FULL.length;
        const VERTEBRATE_LI_MAP = new Map([
            ["homosapiens", "H.sapiens"], ["m.gallopavo", "M.gallopavo"], ["musmusculus", "M.musculus"],
            ["daniorerio", "D.rerio"], ["xenopustropicalis", "X.tropicalis"], ["gallusgallus", "G.gallus"],
            ["o.anatinus", "O.anatinus"], ["t.nigroviridis", "T.nigroviridis"], ["c.elegans", "C.elegans"],
            ["c.briggsae", "C.briggsae"], ["c.reinhardtii", "C.reinhardtii"], ["t.thermophila", "T.thermophila"],
            ["s.cerevisiae", "S.cerevisiae"], ["a.thaliana", "A.thaliana"], ["o.sativa", "O.sativa"]
        ]);
        const liOrgList = liData.summary.organisms_list;
        const liOrgMap = new Map();
        liOrgList.forEach((name, index) => {
            liOrgMap.set(name, index);
            liOrgMap.set(name.toLowerCase().replace(/[\s\.]/g, ''), index);
        });
        const targetOrganisms = CIL_ORG_FULL.concat(NCIL_ORG_FULL);
        const targetLiIndices = targetOrganisms.map(orgName => {
            const lowerOrg = orgName.toLowerCase();
            const simplifiedKey = lowerOrg.replace(/[\s\.]/g, '');
            if (VERTEBRATE_LI_MAP.has(simplifiedKey)) {
                const liAbbrev = VERTEBRATE_LI_MAP.get(simplifiedKey);
                if (liOrgMap.has(liAbbrev)) {
                    return liOrgMap.get(liAbbrev);
                }
            }
            if (liOrgMap.has(simplifiedKey)) return liOrgMap.get(simplifiedKey);
            if (liOrgMap.has(orgName)) return liOrgMap.get(orgName);
            return undefined;
        });
        const geneLabels = [];
        const matrix = [];
        const textMatrix = [];
        const genesFound = [];
        const genesNotFound = [];
        genes.forEach(gene => {
            const geneUpper = gene.toUpperCase();
            const geneData = Object.values(liData.genes).find(g => g.g && g.g.toUpperCase() === geneUpper);
            if (!geneData) {
                genesNotFound.push(geneUpper);
                return;
            }
            genesFound.push(geneUpper);
            const presenceIndices = new Set(geneData.s || []);
            const row = [];
            const textRow = [];
            targetOrganisms.forEach((orgName, index) => {
                const liIndex = targetLiIndices[index];
                const isCiliated = index < CIL_COUNT;
                const isPresent = liIndex !== undefined && presenceIndices.has(liIndex);
                let zValue = 0;
                let status = "Absent";
                if (isPresent) {
                    zValue = isCiliated ? 2 : 1;
                    status = "Present";
                }
                row.push(zValue);
                textRow.push(`Gene: ${geneUpper}<br>Organism: ${orgName}<br>Status: ${status}`);
            });
            if (row.length > 0) {
                matrix.push(row);
                textMatrix.push(textRow);
                geneLabels.push(geneUpper);
            }
        });
        if (matrix.length === 0) {
            let errorMsg = "None of the requested genes were found in the Li (2014) dataset.";
            if (genesNotFound.length > 0) {
                errorMsg = `The gene(s) <strong>${genesNotFound.join(', ')}</strong> were not found in the Li (2014) phylogenetic dataset.`;
            }
            throw new Error(errorMsg);
        }
        const trace = {
            z: matrix,
            x: targetOrganisms.map(name => {
                if (name === "H.sapiens") return "Human";
                if (name === "M.musculus") return "Mouse";
                if (name === "D.rerio") return "Zebrafish";
                if (name.includes("elegans")) return "C. elegans";
                return name.replace(/\./g, '').split(' ')[0];
            }),
            y: geneLabels,
            type: 'heatmap',
            colorscale: [
                [0 / 2, '#FFFFFF'], [0.0001 / 2, '#FFE5B5'], [1 / 2, '#FFE5B5'],
                [1.0001 / 2, '#698ECF'], [2 / 2, '#698ECF']
            ],
            showscale: false,
            hoverinfo: 'text',
            text: textMatrix,
            xgap: 0.5, ygap: 0.5,
            line: { color: '#000000', width: 0.5 }
        };
        const layout = {
            title: `Phylogenetic Conservation (Li et al. 2014) - ${geneLabels.join(', ')}`,
            xaxis: { title: 'Organisms (Ciliated | Non-Ciliated)', tickangle: 45, automargin: true },
            yaxis: { title: 'Genes', automargin: true },
            shapes: [{
                type: 'line',
                xref: 'x', x0: CIL_COUNT - 0.5, x1: CIL_COUNT - 0.5,
                yref: 'paper', y0: 0, y1: 1,
                line: { color: 'black', width: 2 }
            }],
            margin: { t: 50, b: 200, l: 150, r: 50 },
            height: Math.max(500, geneLabels.length * 40 + 150)
        };
        let links = `<p class="ai-suggestion" style="margin-top: 10px;">
                            <a href="#" class="ai-action" data-action="show-nevers-heatmap" data-genes="${geneLabels.join(',')}">➡️ Show Nevers et al. (2017)</a>
                            <span style="margin: 0 10px;">|</span>
                            <a href="#" class="ai-action" data-action="show-table-view" data-genes="${geneLabels.join(',')}">📋 Show Data Table</a>
                         </p>`;
        if (genesNotFound.length > 0) {
            links = `<p class="status-note">Note: <strong>${genesNotFound.join(', ')}</strong> not found in this dataset.</p>` + links;
        }
        return {
            plotData: [trace],
            plotLayout: layout,
            htmlLinks: links
        };
    }

    function renderPhylogenyTable(genes) {
        if (!window.liPhylogenyCache || !window.neversPhylogenyCache) {
            return `<div class="ai-result-card"><h3>Table Error</h3><p>Phylogenetic data is not fully loaded.</p></div>`;
        }
        const tableRows = genes.map(gene => {
            const geneUpper = gene.toUpperCase();
            const liEntry = Object.values(window.liPhylogenyCache.genes).find(g => g.g && g.g.toUpperCase() === geneUpper);
            const liClass = liEntry ? window.liPhylogenyCache.summary.class_list[liEntry.c].replace(/_/g, ' ') : 'N/A';
            const liCount = liEntry?.s?.length || 0;
            const neversEntry = window.neversPhylogenyCache.genes?.[geneUpper];
            const neversCount = neversEntry?.s?.length || 0;
            return `
                <tr>
                    <td><strong>${geneUpper}</strong></td>
                    <td>${liClass}</td>
                    <td>${liCount} / 140</td>
                    <td>${neversCount} / 99</td>
                    <td><a href="#" class="ai-action" data-action="show-li-heatmap" data-genes="${geneUpper}">View Heatmap</a></td>
                </tr>
            `;
        }).join('');
        return `
            <div class="ai-result-card">
                <h3>Phylogenetic Data Table for ${genes.join(', ')}</h3>
                <table class="ciliai-data-table" style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead style="text-align: left;">
                        <tr>
                            <th style="padding: 4px; border-bottom: 1px solid #ccc;">Gene</th>
                            <th style="padding: 4px; border-bottom: 1px solid #ccc;">Li Class (2014)</th>
                            <th style="padding: 4px; border-bottom: 1px solid #ccc;">Li Count (140)</th>
                            <th style="padding: 4px; border-bottom: 1px solid #ccc;">Nevers Count (99)</th>
                            <th style="padding: 4px; border-bottom: 1px solid #ccc;">Action</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
                <p class="ai-suggestion" style="margin-top: 10px;">
                    <a href="#" class="ai-action" data-action="show-li-heatmap" data-genes="${genes.join(',')}">🖼️ Show Heatmap View</a>
                </p>
            </div>
        `;
    }

    function getPhylogenyList(classification) {
        if (!window.liPhylogenyCache || !window.liPhylogenyCache.summary || !window.liPhylogenyCache.genes) {
            return `<div class="ai-result-card"><h3>List Error</h3><p>Phylogenetic classification data is currently unavailable.</p></div>`;
        }
        const qLower = classification.toLowerCase().replace(/\s/g, '_');
        const liGenes = window.liPhylogenyCache.genes;
        const summary = window.liPhylogenyCache.summary;
        const classList = summary.class_list;
        let targetClassificationKey = null;
        let title = "";
        let fallbackHtml = "";
        if (qLower.includes('vertebrate')) {
            targetClassificationKey = 'Vertebrate_specific';
            title = "Genes Specific to the Vertebrate Lineage";
        }
        else if (qLower.includes('mammalian')) {
            if (summary.classification_summary.Mammalian_specific === 0) {
                targetClassificationKey = 'Vertebrate_specific';
                title = "Genes Specific to the Mammalian Lineage (Data Proxy)";
                fallbackHtml = `<p class="status-note" style="margin-top: 10px;">
                    ⚠️ **Note:** The Li et al. 2014 classification metadata reports **zero genes** for the 'Mammalian specific' group. We are displaying the **Vertebrate specific** list as the most phylogenetically proximal proxy.
                </p>`;
            } else {
                targetClassificationKey = 'Mammalian_specific';
                title = "Genes Specific to the Mammalian Lineage";
            }
        }
        else if (qLower.includes('ciliary_specific') || qLower.includes('ciliary_genes') || qLower.includes('every_ciliary_gene')) {
            targetClassificationKey = 'Ciliary_specific';
            title = "Genes Classified as Ciliary Specific";
        }
        else if (qLower.includes('absent_in_fungi') || qLower.includes('not_in_fungi')) {
            targetClassificationKey = 'Vertebrate_specific';
            title = "Genes Likely Absent in Fungi (Proxy: Vertebrate/Mammalian Specific)";
        }
        else if (qLower.includes('all_organisms') || qLower.includes('universally_conserved')) {
            targetClassificationKey = 'Universally_Conserved_Proxy';
            title = "Genes Conserved Across Nearly All Organisms";
        }
        else {
            return `<div class="ai-result-card"><h3>List Error</h3><p class="status-not-found">Classification keyword not recognized for list generation: ${classification}.</p></div>`;
        }
        const filteredGenes = Object.values(liGenes).filter(entry => {
            if (targetClassificationKey === 'Universally_Conserved_Proxy') {
                return entry.s.length >= 130;
            }
            const entryClass = classList[entry.c] ? classList[entry.c].replace(/_/g, ' ') : '';
            const targetClass = targetClassificationKey.replace(/_/g, ' ');
            return entryClass.toLowerCase().includes(targetClass.toLowerCase());
        }).map(g => ({ gene: g.g, description: `Class: ${title.split(':')[0]}` }));
        if (filteredGenes.length === 0) {
            return `<div class="ai-result-card"><h3>${title}</h3><p class="status-not-found">No genes found matching this classification.</p></div>`;
        }
        let resultHtml = formatListResult(title, filteredGenes);
        if (fallbackHtml) {
            resultHtml = resultHtml.replace(/<\/div>$/, `${fallbackHtml}</div>`);
        }
        return resultHtml;
    }

    function compareGeneSpeciesOverlap(geneA, geneB) {
        if (!window.liPhylogenyCache) {
            return `<div class="ai-result-card"><h3>Comparison Failed</h3><p class="status-not-found">Li et al. 2014 dataset not loaded.</p></div>`;
        }
        const dataA = Object.values(window.liPhylogenyCache.genes).find(k => k.g.toUpperCase() === geneA.toUpperCase());
        const dataB = Object.values(window.liPhylogenyCache.genes).find(k => k.g.toUpperCase() === geneB.toUpperCase());
        if (!dataA || !dataB) {
            return `<div class="ai-result-card"><h3>Comparison Failed</h3><p class="status-not-found">One or both genes (${geneA}, ${geneB}) were not found in the Li et al. 2014 dataset.</p></div>`;
        }
        const speciesList = window.liPhylogenyCache.summary.organisms_list;
        const speciesAIndices = new Set(dataA.s || []);
        const speciesBIndices = new Set(dataB.s || []);
        const overlapIndices = [...speciesAIndices].filter(index => speciesBIndices.has(index));
        const overlappingSpecies = overlapIndices.map(index => speciesList[index]).join(', ');
        return `
            <div class="ai-result-card">
                <h3>Shared Conservation: ${geneA} and ${geneB}</h3>
                <p><strong>Total Shared Species:</strong> ${overlapIndices.length}</p>
                <p><strong>Overlapping Species List:</strong> ${overlappingSpecies || 'None found.'}</p>
            </div>
        `;
    }

    // --- 4F. Data Getter Helpers ---

   /**
     * NEW INTEGRATED FUNCTION
     * Replaces getComprehensiveDetails with the detailed HTML formatter
     * provided by the user.
     * (FIXED Nov 17 2025): Added optional chaining for g.OMIM.ID
     */
   /**
 * Fancy Table Enhanced Version
 * (Nov 2025 - polished UI)
 */
async function displayFullGeneInfo(geneSymbol) {
    const gm = window.CiliAI.lookups && window.CiliAI.lookups.geneMap;
    if (!gm || !gm[geneSymbol]) {
        return `<div class="ai-result-card">No data found for gene ${geneSymbol}</div>`;
    }
    const g = gm[geneSymbol];

    // Inline CSS for fancy table styling
    const fancyCSS = `
        <style>
            .fancy-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
                font-size: 14px;
                border-radius: 8px;
                overflow: hidden;
            }
            .fancy-table th {
                background: #2D3748;
                color: white;
                padding: 8px;
                text-align: left;
                font-weight: 600;
            }
            .fancy-table td {
                padding: 8px;
                border-bottom: 1px solid #E2E8F0;
            }
            .fancy-table tr:nth-child(even) {
                background: #F7FAFC;
            }
            .fancy-table tr:hover {
                background: #EDF2F7;
            }
        </style>
    `;

    let html = `${fancyCSS}<div class="ai-result-card"><h4>Gene: ${geneSymbol}</h4>`;
    
    html += `<p><strong>Description:</strong> ${g['Gene.Description'] || '—'}</p>`;
    html += `<p><strong>Synonyms:</strong> ${g['Synonym.'] || '—'}</p>`;
    html += `<p><strong>OMIM ID:</strong> ${g.OMIM?.ID || '—'}</p>`;
    html += `<p><strong>Localization:</strong> ${g.Localization || '—'}</p>`;
    html += `<p><strong>Functional category:</strong> ${g['Functional.category'] || '—'}</p>`;
    
    html += `<h3>Cilia Effects</h3>`;
    html += `<table class="fancy-table">
                <tr><th>Effect</th><th>Value</th></tr>
                <tr><td>Overexpression</td><td>${g['Overexpression effects on cilia length (increase/decrease/no effect)'] || '—'}</td></tr>
                <tr><td>Loss-of-Function</td><td>${g['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'] || '—'}</td></tr>
                <tr><td>% Ciliated Cells</td><td>${g['Percentage of ciliated cells (increase/decrease/no effect)'] || '—'}</td></tr>
            </table>`;

    html += `<h3>Screens</h3>`;
    if (Array.isArray(g.screens) && g.screens.length > 0) {
        html += `<table class="fancy-table">
                    <tr><th>Source</th><th>Result</th></tr>`;
        for (const s of g.screens) {
            html += `<tr><td><strong>${s.source}</strong></td><td>${s.result}</td></tr>`;
        }
        html += `</table>`;
    } else {
        html += `<p>None</p>`;
    }

    html += `<h3>Expression Data (scRNA-seq)</h3>`;
    if (g.expression?.scRNA) {
        html += `<table class="fancy-table">
                    <tr><th>Cell Type</th><th>Value</th></tr>`;
        for (const [ct, val] of Object.entries(g.expression.scRNA)) {
            html += `<tr><td>${ct}</td><td>${val}</td></tr>`;
        }
        html += `</table>`;
    } else {
        html += `<p>None</p>`;
    }

    html += `<h3>Expression Data (Tissue)</h3>`;
    if (g.expression?.tissue) {
        html += `<table class="fancy-table">
                    <tr><th>Tissue</th><th>Value</th></tr>`;
        for (const [t, val] of Object.entries(g.expression.tissue)) {
            html += `<tr><td>${t}</td><td>${val}</td></tr>`;
        }
        html += `</table>`;
    } else {
        html += `<p>None</p>`;
    }

    html += `<h3>Orthologs & Mouse Phenotype</h3>`;
    html += `<table class="fancy-table">
                <tr><th>Category</th><th>Value</th></tr>
                <tr><td>Mouse ortholog</td><td>${g.Ortholog_Mouse || '—'}</td></tr>
                <tr><td>C. elegans ortholog</td><td>${g.Ortholog_C_elegans || '—'}</td></tr>
                <tr><td>Zebrafish ortholog</td><td>${g.Ortholog_Zebrafish || '—'}</td></tr>
                <tr><td>Mouse phenotype</td><td>${g.mouse_phenotype || '—'}</td></tr>
                <tr><td>Mouse ciliopathy phenotype</td><td>${g.mouse_ciliopathy_phenotype || '—'}</td></tr>
            </table>`;

    html += `<h3>Phylogeny</h3>`;
    if (g.phylogeny) {
        html += `<table class="fancy-table">
                    <tr><th>Group</th><th>Class</th><th>Class ID</th><th>Species Count</th></tr>`;
        for (const [pkey, pval] of Object.entries(g.phylogeny)) {
            html += `<tr>
                        <td>${pkey}</td>
                        <td>${pval.class}</td>
                        <td>${pval.class_id}</td>
                        <td>${pval.species_data?.length || '—'}</td>
                     </tr>`;
        }
        html += `</table>`;
    } else {
        html += `<p>None</p>`;
    }

    html += `<h3>Complexes</h3>`;
    if (g.complex_components) {
        html += `<table class="fancy-table">
                    <tr><th>Complex</th><th>Members</th></tr>`;
        for (const [cname, members] of Object.entries(g.complex_components)) {
            html += `<tr><td>${cname}</td><td>${members.join(', ')}</td></tr>`;
        }
        html += `</table>`;
    } else {
        html += `<p>None</p>`;
    }

    html += `<p style="margin-top: 10px;">
                <a href="#" class="ai-action" data-action="show-li-heatmap" data-genes="${geneSymbol}">
                    Show Conservation Plot
                </a>
             </p>`;

    html += `</div>`;
    return html;
}

    
    function getGenesByLocalization(term) {
        let normTerm = term.toLowerCase();
        const L = window.CiliAI.lookups;
        const geneMap = L.geneMap;
        let matchingGenes = new Set(); 

        const allLocKeys = Object.keys(L.byLocalization);
        allLocKeys.forEach(key => {
            if (key.toLowerCase().includes(normTerm)) {
                L.byLocalization[key].forEach(geneSymbol => {
                    matchingGenes.add(geneSymbol);
                });
            }
        });

        return Array.from(matchingGenes).map(gene => {
            const geneData = geneMap[gene];
            // (MODIFIED) Return a 'localization' field instead of 'description'
            return {
                gene: gene,
                localization: geneData?.Localization || `Found in ${term}`
            };
        });
    }
// --- FIX: getGenesByDomain ---
function getGenesByDomain(domainTerm, query) {
    const normTerm = normalizeTerm(domainTerm);
    const results = [];
    window.CiliAI.masterData.forEach(g => {
        if (!g.Gene) return;
        const allDomains = [...ensureArray(g.pfam_ids), ...ensureArray(g.domain_descriptions)];
        const matchingDomain = allDomains.find(d => d && normalizeTerm(d).includes(normTerm));
        if (matchingDomain) {
            results.push({ gene: g.Gene, domain: matchingDomain });
        }
    });
    
    if (results.length === 0) {
        return `Sorry, I could not find any genes with a "${domainTerm}" domain.`;
    }

    // V2.0 FIX: Directly call formatListResult and return the HTML.
    return window.formatListResult(`Genes containing "${domainTerm}" (${results.length})`, results);
}

    
    function getGenesByModule(term) {
        const normTerm = term.toLowerCase();
        const L = window.CiliAI.lookups;
        const geneMap = L.geneMap;
        const modKey = Object.keys(L.byModules).find(key => key.toLowerCase().includes(normTerm));
        if (modKey && L.byModules[modKey]) {
            return L.byModules[modKey].map(gene => ({ 
                gene: gene, 
                description: geneMap[gene]?.['Gene.Description'] || `Part of ${modKey}`
            }));
        }
        return [];
    }


    /**
     * (NEW) Extracts disease keywords from a query.
     * @param {string} qLower - The lowercase query string.
     * @returns {string|null} The found disease term, or null.
     */
    function extractDiseaseIntent(qLower) {
        // Keywords from your test list
        const keywords = [
            'joubert syndrome', 'bardet-biedl syndrome', 'bbs', 
            'meckel-gruber syndrome', 'mks', 'primary ciliary dyskinesia', 'pcd',
            'nephronophthisis', 'nphp', 'retinal disease', 'retinal ciliopathy'
        ];
        
        for (const term of keywords) {
            if (qLower.includes(term)) {
                return term; // Return the first one found
            }
        }
        return null;
    }

    /**
     * (NEW) Extracts expression tissue keywords from a query.
     * @param {string} qLower - The lowercase query string.
     * @returns {string|null} The found tissue term, or null.
     */
    function extractExpressionIntent(qLower) {
        // Keywords from your test list
        const keywords = ['kidney', 'brain', 'retina', 'cerebellum', 'testis', 'lung'];
        
        for (const term of keywords) {
            if (qLower.includes(term)) {
                return term;
            }
        }
        return null;
    }

    /**
     * (NEW) Helper to normalize disease terms to match the lookup map.
     * @param {string} term - The disease term from the query.
     * @returns {string} A normalized key.
     */
    function normalizeDiseaseKey(term) {
        let key = normalizeTerm(term);
        // Map abbreviations and synonyms to the master key
        if (key === normalizeTerm('BBS') || key === normalizeTerm('Bardet Biedel Syndrome')) {
            return normalizeTerm('Bardet–Biedl Syndrome');
        }
        if (key === normalizeTerm('MKS') || key === normalizeTerm('Meckel-Gruber')) {
            return normalizeTerm('Meckel–Gruber Syndrome');
        }
        if (key === normalizeTerm('Joubert')) {
            return normalizeTerm('Joubert Syndrome');
        }
        if (key === normalizeTerm('NPHP')) {
            return normalizeTerm('Nephronophthisis');
        }
        if (key === normalizeTerm('PCD')) {
            return normalizeTerm('Primary Ciliary Dyskinesia');
        }
        if (key === normalizeTerm('retinal disease')) {
            return normalizeTerm('Retinal Ciliopathy'); // Map general term to specific classification
        }
        return key; // return the normalized term itself
    }

    /**
     * (NEW) Helper to check for expression in scRNA or tissue data.
     * @param {object} gene - The full gene object from masterData.
     * @param {string} tissue - The tissue keyword (e.g., "kidney").
     * @returns {boolean} True if expression is found.
     */
    function hasExpressionInTissue(gene, tissue) {
        if (!gene.expression) return false;
        const tissueLower = tissue.toLowerCase();

        // Check scRNA data
        if (gene.expression.scRNA) {
            for (const [cellType, value] of Object.entries(gene.expression.scRNA)) {
                if (cellType.toLowerCase().includes(tissueLower) && value > 0) {
                    return true;
                }
            }
        }
        // Check bulk tissue data
        if (gene.expression.tissue) {
            for (const [tissueName, value] of Object.entries(gene.expression.tissue)) {
                if (tissueName.toLowerCase().includes(tissueLower) && value > 0) {
                    return true;
                }
            }
        }
        return false;
    }


    function getGenesByDomain(domainTerm, query) {
        const normTerm = normalizeTerm(domainTerm);
        const results = [];
        window.CiliAI.masterData.forEach(g => {
            if (!g.Gene) return;
            const allDomains = [...ensureArray(g.pfam_ids), ...ensureArray(g.domain_descriptions)];
            
            const matchingDomain = allDomains.find(d => d && normalizeTerm(d).includes(normTerm));
            if (matchingDomain) {
                // (MODIFIED) Use 'domain' as the key
                results.push({ gene: g.Gene, domain: matchingDomain });
            }
        });
        
        if (results.length === 0) {
            return `Sorry, I could not find any genes with a "${domainTerm}" domain.`;
        }

        // (MODIFIED) Removed 'descriptionHeader'
        lastQueryContext = {
            type: 'list_followup',
            data: results,
            term: `Genes containing "${domainTerm}"`
        };
        return `I found ${results.length} genes containing a "${domainTerm}" domain. Do you want to view the list?`;
    }

    // --- 4G. Main "Brain" (Query Routers) ---

    // --- 4G. Main "Brain" (Query Routers) ---

    function flexibleIntentParser(query) {
        const qLower = query.toLowerCase().trim();
        
        const diseaseMap = getDiseaseClassificationMap();
        let allDiseaseKeywords = ['BBS', 'NPHP', 'MKS']; 
        for (const classification in diseaseMap) {
            allDiseaseKeywords = allDiseaseKeywords.concat(diseaseMap[classification]);
        }
        
        const classificationKeywords = Object.keys(window.CiliAI.lookups.byClassification || {});
        classificationKeywords.push(...Object.keys(diseaseMap)); 

        const complexKeywords = Object.keys(window.CiliAI.lookups.byModuleOrComplex || {});
        complexKeywords.push(...Object.keys(getComplexPhylogenyTableMap())); 

        const entityKeywords = [
            {
                type: 'CLASSIFICATION', 
                keywords: classificationKeywords,
                handler: handleClassificationQuery 
            },
            {
                type: 'COMPLEX',
                keywords: complexKeywords,
                handler: getComplexGenesAndFormat // <-- FIX: Points to the correct V2.0 standardized function
            },
            {
                type: 'LOCALIZATION',
                keywords: [
                    'basal body', 'axoneme', 'transition zone', 'cytosol', 'centrosome', 
                    'cilium', 'cilia', 'mitochondria', 'nucleus', 'ciliary tip',
                    'lysosome', 'lysosomes', 'Ciliary associated gene', 'Ciliary associated genes', 
                    'Microbody', 'Peroxisome', 'flagella'
                ],
                handler: handleLocalizationQuery 
            },
            {
                type: 'CILIOPATHY',
                keywords: allDiseaseKeywords, 
                handler: (term, query) => formatListResult(`Genes for ${term}`, (getCiliopathyGenes(term)).genes, getCiliopathyGenes(term).description)
            },
            {
                type: 'DOMAIN',
                keywords: ['WD40', 'coiled-coil', 'pfam', 'domain', 'ef-hand', 'TPR', 'AAA+ ATPase', 'AAA domain', 'ATPase domain', 'WD40 repeat'],
                handler: getGenesByDomain 
            },
            {
                type: 'META', // For "what can you do?"
                keywords: ['about yourself', 'what can you do', 'help me', 'information do you have', 'datasets', 'capabilities', 'questions can i ask', 'overview of your features'],
                handler: tellAboutCiliAI
            }
        ];

        const normalizedQuery = normalizeTerm(query);
        for (const entityType of entityKeywords) {
            const sortedKeywords = [...entityType.keywords].sort((a, b) => b.length - a.length);
            for (const keyword of sortedKeywords) {
                const normKeyword = normalizeTerm(keyword);
                if (!normKeyword) continue;
                
                if (normalizedQuery.includes(normKeyword)) { 
                    if (qLower.includes('not in') || qLower.includes('except')) continue;
                    return { type: entityType.type, entity: keyword, handler: entityType.handler };
                }
            }
        }
        return null;
    }


function getCiliopathyGenes(term) {
    // This is a minimal placeholder structure to prevent crashes.
    // In a full app, this would query the master data based on the disease term.
    const normalizedTerm = normalizeTerm(term);
    
    // Example lookup (you need to define your actual lookup logic here)
    if (normalizedTerm.includes('jouber')) {
        return {
            genes: [{ gene: 'AHI1', description: 'Transition Zone protein' }, { gene: 'CEP290', description: 'Centrosome/TZ protein' }],
            description: 'Joubert Syndrome genes retrieved.'
        };
    }
    
    // Fallback if no specific logic exists
    const geneSymbols = window.CiliAI.lookups.byCiliopathy?.[normalizedTerm] || [];

    return {
        genes: geneSymbols.map(g => ({ gene: g, description: 'Ciliopathy gene' })),
        description: `Genes associated with ${term}.`
    };
}


// ==========================================================
// 4B. COMPLEX QUERY ENGINE (L2/L3) - NEW
// ==========================================================

/**
 * (NEW) Extracts localization keywords from a query.
 * @param {string} qLower - The lowercase query string.
 * @returns {string|null} The found localization term, or null.
 */
function extractLocalizationIntent(qLower) {
    const keywords = {
        'basal body': ['basal body', 'bb'],
        'transition zone': ['transition zone', 'tz'],
        'axoneme': ['axoneme', 'axonemal'],
        'ciliary tip': ['ciliary tip', 'tip'],
        'nucleus': ['nucleus', 'nuclear'],
        'mitochondria': ['mitochondria', 'mitochondrial'],
        'lysosome': ['lysosome', 'lysosomal'],
        'cilia': ['cilia', 'cilium', 'ciliary']
    };
    for (const [term, synonyms] of Object.entries(keywords)) {
        if (synonyms.some(syn => qLower.includes(syn))) {
            return term;
        }
    }
    return null;
}

/**
 * CiliAI V2.0: Generates raw text records for the Vector Index.
 * * @param {object} masterDBData - Content of ciliAI_master_database.json / geneMap
 * @param {object} terminologyData - Content of window.terminologyQueries
 * @returns {Array<object>} Array of index records (pre-embedding).
 */
// src/vector-index/sync.ts
export async function generateVectorIndexRecords(
  this: CiliGraphRAG,
  options: {
    label?: string;
    textProperty?: string;
    embeddingProperty?: string;
    indexName?: string;
    model?: string;
    batchSize?: number;
    forceRecreate?: boolean;
  } = {}
) {
  const {
    label = "Chunk",
    textProperty = "text",
    embeddingProperty = "embedding",
    indexName = "chunk_vector_index",
    model = "text-embedding-3-large",
    batchSize = 500,
    forceRecreate = false,
  } = options;

  const client = this.memgraph;
  const embedder = this.embeddingProvider;

  // 1. Drop & recreate vector index (new CiliAI v2.8 syntax)
  if (forceRecreate) {
    await client.execute(`DROP VECTOR INDEX IF EXISTS ${indexName}`);
  }

  await client.execute(`
    CREATE VECTOR INDEX IF NOT EXISTS ${indexName}
    ON NODE :${label}(${embeddingProperty})
    WITH { dimension: 1536, similarity_metric: 'cosine' }
  `);

  // 2. Stream all nodes missing embeddings
  const result = await client.executeAndFetchAll(`
    MATCH (n:${label})
    WHERE n.${embeddingProperty} IS NULL AND n.${textProperty} IS NOT NULL
    RETURN id(n) AS elementId, n.${textProperty} AS text
    ORDER BY elementId
  `);

  const total = result.length;
  if (total === 0) {
    console.log("Vector index already up-to-date.");
    return;
  }

  console.log(`Embedding ${total} nodes using ${model}...`);

  for (let i = 0; i < total; i += batchSize) {
    const batch = result.slice(i, i + batchSize);
    const texts = batch.map(r => r.text);

    const embeddings = await embedder.embedBatch(texts, { model });

    const payload = batch.map((row, idx) => ({
      elementId: row.elementId,
      embedding: embeddings[idx],
    }));

    await client.execute(`
      UNWIND $batch AS row
      MATCH (n) WHERE elementId(n) = row.elementId
      SET n.${embeddingProperty} = row.embedding
    `, { batch: payload });

    console.log(`Progress: ${Math.min(i + batchSize, total)}/${total}`);
  }

  console.log(`${indexName} fully synchronized!`);
}

// intentClassifier.js (Simplified V2.0 Logic)
const INTENTS = ['definition', 'visualize', 'ranking', 'compare', 'localization_query', 'disease_query', 'complex_query', 'relationship'];

// Curated list of high-value trigger phrases (TRAINING)
const TRAINING = {
  ranking: ['which five', 'highest expression', 'lowest expression', 'rank by', 'more than', 'less than'],
  compare: ['compare', 'versus', 'vs', 'difference between', 'how do', 'differ from'],
  relationship: ['relationship between', 'how do', 'work together', 'connect to'],
  definition: ['what is', 'explain', 'define', 'tell me about'],
  visualize: ['show me', 'plot', 'umap', 'heatmap', 'display'],
  localization_query: ['localized to', 'where is', 'cellular location'],
  disease_query: ['associated with', 'causes', 'mutated in', 'joubert', 'bbs', 'nphp'],
  complex_query: ['genes in', 'members of', 'subunits', 'complex', 'bbsome', 'ift-a', 'mks']
};

/**
 * Predicts the most likely intent based on keyword overlap.
 * In a production V2.0 system, this would be heavily augmented by semanticMatches.
 */
function scoreIntents(query, semanticMatches = []) {
  const q = query.toLowerCase().trim();
  const scores = INTENTS.reduce((acc, i) => { acc[i] = 0; return acc; }, {});
  
  // 1. Exact Phrase/Keyword Match Scoring (High Weight)
  for (const intent of Object.keys(TRAINING)) {
    for (const phrase of TRAINING[intent]) {
      if (q.includes(phrase)) scores[intent] += 5;
    }
  }

  // 2. Prioritize specific disease/complex tokens if present (medium weight)
  // This logic ensures 'Joubert syndrome' boosts 'disease_query' even if 'genes in' is missing.
  if (q.includes('joubert') || q.includes('bbs') || q.includes('nphp')) {
      scores.disease_query += 2;
  }
  if (q.includes('ift-b') || q.includes('bbsome') || q.includes('mks')) {
      scores.complex_query += 2;
  }
  
  // 3. Select the best intent (highest score)
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const maxScore = best ? best[1] : 0;
  
  if (maxScore > 0) {
      // Find all intents tied for the highest score (for multi-label support)
      const tiedIntents = Object.entries(scores).filter(([i, s]) => s === maxScore);
      return { intent: best[0], confidence: maxScore, tiedIntents: tiedIntents.map(t => t[0]) };
  }

  return { intent: 'definition', confidence: 0, tiedIntents: ['definition'] }; // Default fallback
}


/**
 * (NEW) Extracts phenotype keywords from a query.
 * @param {string} qLower - The lowercase query string.
 * @returns {string|null} The found phenotype term, or null.
 */
function extractPhenotypeIntent(qLower) {
    const keywords = {
        'short cilia': ['short cilia', 'shorter cilia'],
        'longer cilia': ['long cilia', 'longer cilia'],
        'loss of cilia': ['loss of cilia', 'no cilia', 'cilia loss', 'no ciliation'],
        'no effect': ['no effect', 'no change', 'normal length']
    };
    for (const [term, synonyms] of Object.entries(keywords)) {
        if (synonyms.some(syn => qLower.includes(syn))) {
            return term;
        }
    }
    return null;
}

   
/**
 * @param {string} query
 * @returns {string | null} HTML result for an explanatory query, or null.
 */
function handleExplanatoryQuery(query) {
    const qLower = query.toLowerCase().trim();

    // --- GAP 1: Comparative Questions ---
    if (qLower.includes('compare') || qLower.includes('difference between') || (qLower.includes('how do') && qLower.includes('differ'))) {
        window.log('Routing via: Enhanced NLP (Comparative Analysis)');

        // Comparative Analysis 1: Ciliopathies
        if ((qLower.includes('joubert syndrome') || qLower.includes('js')) && (qLower.includes('meckel-gruber syndrome') || qLower.includes('mks'))) {
            return `
                <div class="ai-result-card">
                    <h4>Comparing Joubert Syndrome (JS) and Meckel-Gruber Syndrome (MKS)</h4>
                    <p>Both are severe ciliopathies, but MKS is generally lethal in the perinatal period, whereas JS severity is highly variable.</p>
                    <table>
                        <thead>
                            <tr><th>Feature</th><th>Joubert Syndrome (JS)</th><th>Meckel-Gruber Syndrome (MKS)</th></tr>
                        </thead>
                        <tbody>
                            <tr><td><strong>Severity</strong></td><td>Highly variable (often manageable)</td><td>**Lethal**, prenatal onset</td></tr>
                            <tr><td><strong>Classic Sign</strong></td><td>'Molar tooth sign' on brain MRI</td><td>Occipital encephalocele, large cystic kidneys</td></tr>
                            <tr><td><strong>Primary Defect</strong></td><td>Primarily **Transition Zone** and IFT genes (e.g., *CEP290*, *IFT88*)</td><td>Primarily **MKS Complex** genes (e.g., *MKS1*, *B9D1*)</td></tr>
                        </tbody>
                    </table>
                </div>`;
        }
        
        // Comparative Analysis 2: IFT Complexes
        if (qLower.includes('ift-a') && qLower.includes('ift-b')) {
            const iftA = window.terminologyQueries["what is ift-a"];
            const iftB = window.terminologyQueries["what is ift-b"];
            return `<div class="ai-result-card">
                <h4>IFT-A vs. IFT-B Complexes (Intraflagellar Transport)</h4>
                <p><strong>IFT-B (Anterograde)</strong>: ${iftB.replace(/IFT-B is /, '')} It transports cargo **to the tip** (base $\\to$ tip) using the **Kinesin-2** motor. Essential for initial cilium assembly (ciliogenesis). </p>
                <hr>
                <p><strong>IFT-A (Retrograde)</strong>: ${iftA.replace(/IFT-A \(.+\) is /, '')} It transports cargo **back to the base** (tip $\\to$ base) using the **Dynein-2** motor. Essential for recycling and ciliary maintenance.</p>
            </div>`;
        }

        // Comparative Analysis 3: Ciliary Gate Components
        if (qLower.includes('bbsome') && qLower.includes('mks complex')) {
            return `<div class="ai-result-card">
                <h4>BBSome vs. MKS Complex</h4>
                <p>Both are critical ciliary trafficking complexes localized near the base, but they manage different types of cargo:</p>
                <ul>
                    <li>**MKS Complex:** Forms the core **Transition Zone (TZ) gate structure**; controls access of proteins *into* the cilium's membrane. Defects cause structural gate failure (MKS).</li>
                    <li>**BBSome:** A **cargo adaptor complex** that ferries transmembrane proteins (like GPCRs) *out* of the cilium for degradation or recycling. Defects cause trafficking defects (BBS).</li>
                </ul>
            </div>`;
        }
    }


    // --- GAP 2: Process & Mechanism Questions (How/Why) ---
    if (qLower.startsWith('how does ift work') || qLower.includes('ift step by step')) {
        window.log('Routing via: Enhanced NLP (IFT Mechanism)');
        return `
            <div class="ai-result-card">
                <h4>How Intraflagellar Transport (IFT) Works: Step-by-Step</h4>
                <ol>
                    <li>**Assembly:** IFT-B complexes (e.g., IFT88, IFT81) load ciliary building blocks (tubulin, IFT-A, motors) at the **basal body**.</li>
                    <li>**Anterograde Transport:** The train moves **from the base to the tip** powered by the **Kinesin-2** motor (anterograde = forward).</li>
                    <li>**Turnaround:** At the ciliary tip, IFT-B disassembles. IFT-A complexes (e.g., IFT140) bind to the returning cargo.</li>
                    <li>**Retrograde Transport:** The train moves **from the tip back to the base** powered by the **Dynein-2** motor (retrograde = backward).</li>
                    <li>**Recycling:** Components are unloaded and recycled at the base to initiate the next transport cycle.</li>
                </ol>
            </div>`;
    }
    
    if (qLower.includes('why do transition zone defects cause joubert syndrome')) {
        window.log('Routing via: Enhanced NLP (Mechanism: TZ/JS)');
        return `
            <div class="ai-result-card">
                <h4>Transition Zone (TZ) Defects and Joubert Syndrome (JS)</h4>
                <p>The **Transition Zone** is the molecular **gate** at the ciliary base. JS-associated genes (like *CEP290*, *NPHP1*, *MKS1*) encode components that form this gate. </p>
                <p>Defects cause **gate failure**, resulting in:</p>
                <ul>
                    <li>**Loss of Enrichment:** Key ciliary signaling components (like some GPCRs) fail to enter the cilium, disrupting vital pathways.</li>
                    <li>**Corrupted Membrane:** Non-ciliary membrane proteins are allowed to diffuse into the cilium, corrupting the organelle's specialized environment.</li>
                </ul>
                <p>This failure in ciliary signaling is the root cause of the pleiotropic JS phenotypes, particularly the cerebellar malformation.</p>
            </div>`;
    }
    
    // --- GAP 3: Relationship & Pathway Questions ---
    if (qLower.includes('how do ift88 and ift140 work together') || qLower.includes('relationship between ift88 and ift140')) {
        window.log('Routing via: Enhanced NLP (Relationship: IFT Proteins)');
        return `<div class="ai-result-card">
            <h4>Relationship between IFT88 and IFT140</h4>
            <p><strong>IFT88</strong> is a core component of the **IFT-B** complex (anterograde transport). <strong>IFT140</strong> is a core component of the **IFT-A** complex (retrograde transport).</p>
            <p>They don't directly interact to form one complex, but they are intrinsically linked by their opposing roles in the **IFT Cycle**:</p>
            <ul>
                <li>IFT88 drives the cargo **to the tip** (anterograde).</li>
                <li>IFT140 is essential for returning components **from the tip to the base** (retrograde).</li>
            </ul>
            <p>The proper function of IFT88 is dependent on IFT140 recycling the machinery, and vice-versa, to maintain the steady state of the cilium.</p>
        </div>`;
    }

    if (qLower.includes('hedgehog signaling pathway in cilia')) {
        window.log('Routing via: Enhanced NLP (Pathway: Hedgehog)');
        return `
            <div class="ai-result-card">
                <h4>Hedgehog (Hh) Signaling in the Primary Cilium</h4>
                <p>${window.terminologyQueries["what is hedgehog signaling"]}</p>
                <p>The cilium acts as the **central signaling hub**:</p>
                <ul>
                    <li>**OFF State (No Ligand):** The receptor **PTCH1** is present in the ciliary membrane, and the key transducer **SMOOTHENED (SMO)** is sequestered in vesicles at the ciliary base. The transcription factor **GLI** is processed into a repressor form.</li>
                    <li>**ON State (Ligand Binding):** PTCH1 exits the cilium, allowing SMO to translocate into the ciliary axoneme. This movement prevents GLI processing, leading to the accumulation of the active GLI form that translocates to the nucleus to induce gene expression.</li>
                </ul>
                
            </div>`;
    }

    return null; // No explanatory match found
}

/**
 * Global object containing predefined answers for common Cilia/IFT/Ciliopathy terminology.
 * This is accessed directly by handleAIQuery for fast, static responses.
 */
window.terminologyQueries = {
    "what is a cilium": "A cilium is a microtubule-based organelle extending from the cell surface. Primary cilia sense extracellular signals; motile cilia generate fluid flow. (Rosenbaum & Witman 2002)",
    "what are cilia": "Cilia are conserved organelles on most eukaryotic cells. They function in sensory signaling (primary cilia) or motility (motile cilia). (Reiter, Blacque & Leroux 2012)",
    "tell me about cilia": "Cilia detect environmental cues or move fluids, depending on type. Defects cause human genetic disorders called ciliopathies. (Hildebrandt & Benzing 2011)",
    "explain ift": "Intraflagellar Transport (IFT) is the bidirectional movement of protein complexes along the axoneme, essential for assembling and maintaining cilia. (Kozminski et al. 1993; Cole 2003)",
    "who discovered ift": "Keith Kozminski discovered Intraflagellar Transport in 1993 in Joel Rosenbaum’s lab using Chlamydomonas. (Kozminski et al. 1993)",
    "what is ift-a": "IFT-A (Intraflagellar Transport A) is the retrograde IFT complex required for returning cargo from tip to base and for membrane protein gating. (Behal et al. 2012; Mukhopadhyay et al. 2010)",
    "what is ift-b": "IFT-B is the anterograde IFT complex delivering axonemal building blocks from the base to the tip. It is essential for ciliogenesis. (Cole et al. 1998; Taschner & Lorentzen 2016)",
    "what is ift88": "IFT88 is an IFT-B core protein required for cilium assembly. Mutation causes cilia loss and polycystic kidney disease in mouse. (Pazour et al. 2000)",
    "what is the bbsome": "The BBSome, a protein complex of 8 Bardet-Biedl syndrome (BBS) proteins, is a trafficking complex that ferries membrane proteins, including GPCRs, into and out of cilia. Mutations cause Bardet-Biedl Syndrome. (Jin et al. 2010; Nachury et al. 2007)",
    "list genes in bbsome": "The BBSome consists of BBS1, BBS2, BBS4, BBS5, BBS7, BBS8 (TTC8), BBS9, and BBIP1. (Nachury et al. 2007)",
    "explain the transition zone": "The transition zone is the gate at the ciliary base that controls protein entry and exit via MKS and NPHP modules. (Garcia-Gonzalo & Reiter 2017)",
    "what is the basal body": "The basal body is the modified mother centriole that nucleates and anchors the axoneme. (Reiter et al. 2012)",
    "what is the transition fibre": "Transition fibres link the basal body to the membrane and help dock proteins entering the cilium. (Reiter et al. 2012)",
    "what is the mks complex": "The Meckel–Gruber Syndrome (MKS) complex forms part of the transition zone architecture and maintains ciliary gating. (Garcia-Gonzalo & Reiter 2017)",
    "what is the nphp complex": "The Nephronophthisis (NPHP) complex is a transition zone module required for proper gating and kidney function. (Reiter et al. 2012)",
    "what is the axoneme": "The axoneme is the microtubule core of the cilium, usually organized as 9 outer doublets with or without a central pair. (Satir & Christensen 2007)",
    "what is the 9+0 structure": "A 9+0 axoneme has nine microtubule doublets and no central pair, characteristic of primary cilia. (Satir & Christensen 2007)",
    "what is the 9+2 structure": "A 9+2 axoneme has nine doublets plus a central pair, found in motile cilia. (Satir & Christensen 2007)",
    "what is hedgehog signaling": "Hedgehog signaling requires the primary cilium for Smoothened activation and Gli processing. (Goetz & Anderson 2010)",
    "what are ciliary gpcrs": "Ciliary G Protein-Coupled Receptors are signaling receptors enriched in the ciliary membrane, including SSTR3, GPR161, and MCHR1. (Mukhopadhyay et al. 2013)",
    "what are dynein arms": "Dynein arms are ATP-powered motor complexes that drive motile cilia beating. Their loss causes Primary Ciliary Dyskinesia. (Fliegauf et al. 2007)",
    "what is radial spoke": "The radial spoke is a structural complex linking outer doublets to the central pair, coordinating motility. (Warner 1976)",
    "what is the central pair": "The central pair is the two microtubules in the 9+2 axoneme required for proper waveform regulation. (Satir & Christensen 2007)",
    "what is ciliogenesis": "Ciliogenesis is the process of assembling a cilium, starting at the basal body and extending the axoneme. (Ishikawa & Marshall 2011)",
    "what is distal appendage": "Distal appendages are structures on the mother centriole required for docking to the membrane and initiating ciliogenesis. (Tanos et al. 2013)",
    "what are ciliopathies": "Ciliopathies are disorders caused by defects in cilia. They affect the brain, kidney, liver, eye, and skeleton. (Hildebrandt & Benzing 2011)",
    "help me understand ciliopathies": "Ciliopathies result from structural or functional ciliary defects. Examples include Joubert Syndrome, MKS, BBS, NPHP, and PCD. (Reiter & Leroux 2017)",
    "what is joubert syndrome": "Joubert Syndrome is a ciliopathy with cerebellar vermis hypoplasia and the ‘molar tooth sign,’ caused by mutations in transition zone and IFT genes. (Romani et al. 2013)",
    "what is meckel-gruber syndrome": "MKS is a severe ciliopathy with brain malformations, kidney cysts, and polydactyly caused by MKS module gene defects. (Hartill et al. 2017)",
    "what is primary ciliary dyskinesia": "PCD is caused by defects in motile cilia, leading to chronic infections, infertility, and left-right asymmetry defects. (Fliegauf et al. 2007)",
    "what is polycystic kidney disease": "Polycystic Kidney Disease arises from defective ciliary signaling, commonly involving PKD1/PKD2 in the ciliary membrane. (Nauli et al. 2003)"
};


/**
 * CiliAI V2.0: The Main Query Router (Hybrid Semantic-RAG Model)
 * * This router is Semantic-First, prioritizing Intent Classification and Graph Reasoning 
 * (Steps 1-7) over the old V1 keyword matching (Step 8/9).
 */
async function handleAIQuery(query) {
    const chatWindow = document.getElementById('messages');
    if (!chatWindow) return;

    if (!query) return;
    const qLower = query.toLowerCase().trim();
    let htmlResult = null;
    let match;

    window.log(`Routing query (V2.0 Semantic-First): ${query}`);

    try {
        if (!window.CiliAI.ready) {
            window.addChatMessage("Data is still loading, please wait...", false);
            return;
        }
        
        // --- A. SEMANTIC & INTENT ANALYSIS (The New Brain) ---
        
        // 1. Semantic Search (Simulated RAG Retrieval)
        // In a live system, this fetches embeddings from the Vector Index (Phase 1).
        const semanticMatches = await window.semanticSearch(query, 5, 0.60); 

        // 2. Intent Classification
        // Predicts the user's goal based on keywords and semantic context (Phase 2A).
        const { intent, confidence } = window.scoreIntents(query, semanticMatches);
        
        // 3. Entity & Gene Extraction (Kept from V1 for high precision)
        const exactGenes = window.extractMultipleGenes(query);
        const primarySemanticEntity = semanticMatches[0]?.meta?.id;

        window.log(`Predicted Intent: ${intent} (Confidence: ${confidence.toFixed(2)}). Genes: ${exactGenes.join(', ')}`);


        // --- B. V2.0 CORE ROUTING (Intent-Driven) ---

        // 4. ACTION INTENTS (Visualization/Plotting)
        if (intent === 'visualize' || intent === 'scRNA') {
            window.log('Routing via: Intent (Visualize)');
            // Replaces V1 Steps 8, 10, 11
            htmlResult = await window.routeVisualizationAction(query, exactGenes);
        }
        
        // 5. QUANTITATIVE INTENTS (Ranking/Comparison/Threshold)
        else if (intent === 'ranking') {
            window.log('Routing via: Intent (Quantitative Engine - Gap 4)');
            // **NEW LOGIC** - Assumes the Quantitative Engine handles filtering/sorting
            htmlResult = await window.runQuantitativeEngine(query, exactGenes); 
            // e.g., call rankGenesByExpression, compareGeneExpression, etc.
        }

        // 6. EXPLANATORY INTENTS (Graph Traversal, Synthesis, Relationships, Complex Filtering)
        else if (['compare', 'relationship', 'disease_query', 'complex_query', 'localization_query'].includes(intent)) {
            window.log(`Routing via: Intent (Graph Reasoning / Synthesis)`);
            
            // This single function now replaces the vast majority of V1's complex/explanatory routers (V1 Steps 1, 6, 7, 9, 11.5)
            htmlResult = await window.runGraphQuery(query, intent, exactGenes);
            // This function handles:
            // - Two-Gene Relationships (CEP290/NPHP1)
            // - Multi-Criteria Filtering (Loc + Disease)
            // - Multi-Hop Explanation (Gene -> Complex -> Disease)
        }
        
        // 7. DEFINITION INTENT (RAG-based Explanation)
        else if (intent === 'definition' || confidence < 0.3) {
            window.log('Routing via: Intent (Definition / RAG Retrieval)');
            
            if (exactGenes.length > 0) {
                // High confidence it's a gene details page
                htmlResult = await window.displayFullGeneInfo(exactGenes[0]);
            }
            else if (semanticMatches[0] && semanticMatches[0].score > 0.7) {
                // RAG: Use the top semantic match as the core answer/definition
                htmlResult = window.formatRAGAnswer(semanticMatches[0]);
            }
        }


        // --- C. RULE-BASED FALLBACK (V1 Legacy Reliability) ---

        // 8. FINAL FALLBACK: V1 EXACT TERMINOLOGY MATCH
        // This is the V1 Step (0) logic, kept as the most reliable safety net.
        const qLowerClean = qLower.replace(/[?.,!]/g, '');
        if (htmlResult === null && window.terminologyQueries[qLowerClean]) {
            window.log('Routing via: Final Fallback (V1 Exact Terminology)');
            htmlResult = `<div class="ai-result-card"><p>${window.terminologyQueries[qLowerClean]}</p></div>`;
        }

        // 9. FINAL CATCH-ALL (Error)
        if (htmlResult === null) {
            window.log(`Routing via: Final Fallback (Error)`);
            const fallbackText = exactGenes.length > 0 
                                ? `I found gene **${exactGenes[0]}**, but couldn't process the intent (${intent}).`
                                : `I didn't understand the query. The best semantic match was "${semanticMatches[0]?.text || 'none'}".`;
            htmlResult = `Sorry, I couldn't process your request. ${fallbackText}`;
        }

        // Send the final result to chat
        if (htmlResult) {
            window.addChatMessage(htmlResult, false);
        }

    } catch (e) {
        console.error("Error in handleAIQuery:", e);
        window.addChatMessage(`An internal CiliAI error occurred: ${e.message}`, false);
    }
}
       
/**
 * Downloads the current UMAP coordinate and expression data as a CSV.
 */
function downloadUMAPDataAsCSV(geneSymbol) {
    const gene = geneSymbol.toUpperCase();
    const cellData = window.CiliAI.cellDataCache;
    const umapData = window.CiliAI_UMAP;
    
    if (!umapData || !cellData) {
        window.addChatMessage('Error: UMAP data is not available for export.', false);
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `Gene,UMAP_1,UMAP_2,Cell_Type,Expression_TPM\r\n`;

    const geneExpressionData = cellData[gene] || {};

    umapData.forEach(point => {
        const expr = geneExpressionData[point.cell_type] || 0;
        const row = [
            `"${gene}"`,
            point.x.toFixed(4),
            point.y.toFixed(4),
            `"${point.cell_type}"`,
            expr.toFixed(4)
        ].join(',');
        csvContent += row + '\r\n';
    });

    const encodedUri = encodeURI(csvContent);
    const filename = `${gene}_UMAP_Data.csv`;
    
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.addChatMessage(`Downloaded UMAP data for <strong>${gene}</strong> as ${filename}.`, false);
}
    

/**
     * (NEW) Provides full reference details for screen keys
     * Uses the exact links and citations provided by the user.
     */
    function getScreenCitationMap() {
        // This is the user-provided object
        return { // <-- Corrected this line
            "Kim2016": {
                name: 'Kim et al. (2016) IMCD3 RNAi',
                link: 'https://www.sciencedirect.com/science/article/pii/S016748891630074X',
                citation: 'Kim et al., FEBS Lett, 2016',
                summary: "This is a genome-wide high-content siRNA screen for ciliogenesis. The authors identified roles for mRNA processing (spliceosome) and ubiquitin-proteasome system (UPS) in both cilia formation and cell cycle arrest. They show that spliceosome components regulate mRNA of disassembly factors (like AURKA, PLK1), while UPS components are needed for proteolysis of assembly factors (e.g., IFT88, CPAP). This work connects the control of ciliogenesis directly with cell-cycle control via these pathways."
            },
            "Wheway2015": {
                name: 'Wheway et al. (2015) RPE1 RNAi',
                link: 'https://www.nature.com/articles/ncb3201#Abs1',
                citation: 'Wheway et al., Nat Cell Biol, 2015',
                summary: "This is a whole-genome siRNA screen in mIMCD3 cells (mouse kidney line) to identify genes required for ciliogenesis. They identified 112 candidate ciliogenesis/ciliopathy genes, including many UPS (ubiquitin-proteasome) subunits, GPCRs, and pre-mRNA processing factors (e.g., PRPF6, PRPF8, PRPF31) that are known to be mutated in retinitis pigmentosa. They validated some hits (e.g., C21orf2 / LRRC76), showed its localization to the basal body, and connected it to other known ciliopathy genes."
            },
            "Roosing2015": {
                name: 'Roosing et al. (2015) hTERT-RPE1',
                link: 'https://elifesciences.org/articles/06602/figures#SD2-data',
                citation: 'Roosing et al., eLife, 2015',
                summary: "In this paper, Roosing et al. performed a genome-wide siRNA knockdown screen in human hTERT-RPE1 cells engineered with a dual reporter (Smo-EGFP for cilia + mCherry-Geminin for cell-cycle state). Their setup allowed them to distinguish ciliation defects that are independent of cell-cycle arrest effects. They measured a large number of cellular features (~31 parameters) from imaging to quantify ciliation and other phenotypes, providing a very rich dataset."
            },
            "Basu2023": {
                name: 'Basu et al. (2023) MDCK CRISPR',
                link: 'https://onlinelibrary.wiley.com/doi/10.1111/ahg.12529',
                citation: 'Basu et al., Ann Hum Genet, 2023',
                summary: "This reference links to a 2023 paper from Basu et al. At the time of this data-freeze, a detailed open-access summary for this specific MDCK CRISPR screen was not available in public databases. Manual curation from the full text is recommended to extract cell-line, screening design, and main findings."
            },
            "Breslow2018": {
                name: 'Breslow et al. (2018) Hedgehog Signaling',
                link: 'https://www.nature.com/articles/s41588-018-0054-7#Abs1',
                citation: 'Breslow et al., Nat Genet, 2018',
                summary: "This is a CRISPR-Cas9 screen focused on Hedgehog (Hh) signaling, which relies on the primary cilium. They engineered a Hedgehog-responsive cell line with a selectable reporter and used a genome-wide CRISPR sgRNA library to discover novel components of ciliogenesis/ciliary structure, including a complex containing δ- and ε-tubulin. This work provides a powerful functional genomics resource to classify ciliopathy genes and study ciliary signaling."
            }
        };
    }

  /**
 * FIXED: Always returns the full CRISPR/siRNA screen reference set.
 * Works even when lastQueryContext.data is empty.
 */
function handleScreenReferenceFollowup() {

    const refMap = getScreenCitationMap();   // full reference map
    const allKeys = Object.keys(refMap);     // always available

    let html = `
    <div class="ai-result-card">
        <h4>CRISPR / siRNA Screen References</h4>
        <ul style="list-style-type: none; padding-left: 0;">
    `;

    allKeys.forEach(key => {
        const ref = refMap[key];
        html += `
            <li style="margin-bottom: 15px;">
                <strong>${ref.name}</strong> (${ref.citation})
                <p style="margin-top: 5px; margin-bottom: 5px;">${ref.summary}</p>
                ${ref.link ? `<a href="${ref.link}" target="_blank" class="ai-action">View Publication</a>` : ''}
            </li>
        `;
    });

    html += `</ul></div>`;

    // Reset context safely
    lastQueryContext = { type: null, data: [], term: null };

    return html;
}


// ==========================================================
// 5. GLOBAL UI WRAPPERS & STARTUP (CLEANED)
// ==========================================================

    // NOTE: handleUserSend, react, and clearChat are now defined below 
    // or as robust global definitions that override the fallbacks.

    window.selectComp = function (id) {
        generateAndInjectSVG(); 
        
        document.querySelectorAll('.cilia-part').forEach(el =>
            el.classList.remove('selected', 'active')
        );

        const el = document.getElementById(id);
        if (el) el.classList.add('selected');

        const data = structureInfoMap[id];
        if (!data) return;

        const genes = getGenesByLocalization(data.title);
        const bar = document.getElementById('bottomBar');

        if (genes.length > 0) {
            bar.innerHTML = `
                <h3>${data.title} (${genes.length} genes)</h3>
                <div class="gene-list">
                    ${genes.slice(0, 40).map(g =>
                        `<span class="gene-badge" data-gene="${g.gene}">${g.gene}</span>`
                    ).join('')}
                    ${genes.length > 40
                        ? `<span style="font-size:11px;color:#666;padding:5px;">...+${genes.length - 40} more</span>`
                        : ''}
                </div>`;
        } else {
            bar.innerHTML = `
                <h3>${data.title}</h3>
                <p style="color:#666;font-size:12px;">No genes found in database. Try searching directly.</p>`;
        }
    };

    window.searchGene = function (name) {
        const query = name || document.getElementById('geneSearch').value.trim().toUpperCase();
        if (!query) return;
        window.addChatMessage(`Tell me about ${query}`, true);
        window.handleGeneSearch(query, true); // Use window.handleGeneSearch
    };

    // --- MODIFIED: UMAP default plot ---
    window.showDefaultUMAP = function () {
        window.addChatMessage('Display gene expression in Lung scRNA-seq (Default: FOXJ1)', true);
        window.handleAIQuery('plot default umap');
    };

    
    // --- NEW: Default phylogeny plot ---
    window.showDefaultPhylogeny = function () {
        window.addChatMessage('Show Phylogenetics Analysis (Default Genes)', true);
        window.handleAIQuery('plot default phylogeny');
    };

    // Redefine the core logic functions (react, clearChat, handleUserSend) globally
    // using the window prefix for robustness.

    window.handleUserSend = function () {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput) return;
        const query = chatInput.value.trim();
        if (!query) return;
        window.addChatMessage(query, true);
        chatInput.value = '';
        window.handleAIQuery(query);
    };
    window.sendMsg = function () {
    handleUserSend();
    };

 
    window.downloadPlot = function (divId, filename) {
        const plotDiv = document.getElementById(divId);
        if (plotDiv && window.Plotly) {
            Plotly.downloadImage(plotDiv, {
                format: 'png',
                filename: filename,
             width: 1200,
                height: 800
            });
        }
    }; 

// CRITICAL: Must be defined in ciliAI.js
window.generateAndInjectSVG = function() {
    const svgContainer = document.getElementById('cilia-svg');
    if (!svgContainer) return;
    
    // Minimal SVG placeholder (as agreed upon previously)
    const svgHTML = `
        <svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto;">
            <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="#005b96">Ciliary Diagram Placeholder</text>
            </svg>`;
    
    svgContainer.innerHTML = svgHTML;
};

// ==========================================================
// GLOBAL EXPOSURE (REQUIRED FOR index.html)
// ==========================================================
// These manually expose the functions defined above to the global 'window' scope.

window.log = log;
window.react = react;
window.handleUserSend = handleUserSend;
window.searchGene = searchGene;
window.showDefaultUMAP = showDefaultUMAP;
window.showDefaultPhylogeny = showDefaultPhylogeny;
window.downloadPlot = downloadPlot;

// Core Logic & Analysis
window.handleAIQuery = handleAIQuery; 
window.renderUMAPPlot = renderUMAPPlot; 
window.getGenesByLocalization = getGenesByLocalization;
window.showDataInLeftPanel = showDataInLeftPanel;
window.generateAndInjectSVG = generateAndInjectSVG;
window.normalizeTerm = normalizeTerm;
window.ensureArray = ensureArray;
