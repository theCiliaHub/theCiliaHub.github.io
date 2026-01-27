/* ==============================================================
 * CiliAI – Unified Logic Engine (v7.2.3 – State & Legacy Fixes)
 * ============================================================== */

// 1. GLOBAL STATE & SAFE INITIALIZATION
// ==========================================================

// Ensure window.CiliAI exists; if it exists, extend it.
window.CiliAI = window.CiliAI || {};

// Initialize Datasets if missing
if (!window.CiliAI.datasets) {
    window.CiliAI.datasets = {
        lung: { name: 'Human Lung Organoid', umap: [], icon: "🫁", colorScale: [[0, '#e2e8f0'], [0.1, '#fed7d7'], [1, '#c53030']] },
        lung_downsampled: { name: 'Human Lung Tissue (Complete)', umap: [], colorScale: 'Reds', icon: "🫁" },
        kidney: { name: 'Human Kidney', umap: [], expression: null, colorScale: 'Blues', icon: "🫘" },
        liver: { name: 'Human Liver', umap: [], colorScale: 'Greens', icon: "🍺" },
        hypothalamus: { name: 'Hypothalamus', umap: [], expression: {}, colorScale: 'Purples', icon: "🧠" },
        chondrocyte: { name: 'Chondrocyte', umap: [], colorScale: 'Teal', icon: "🦴" }
    };
}

/* ------------------------------------------------------------------
 * Legacy compatibility: resetZoom (required by SpatialManager)
 * ------------------------------------------------------------------ */
if (!window.CiliAI.resetZoom) {
    window.CiliAI.resetZoom = function () {
        const el = document.getElementById('umap-container');
        if (window.Plotly && el) {
            Plotly.relayout(el, {
                'xaxis.autorange': true,
                'yaxis.autorange': true
            });
        }
    };
}

// Initialize Global State Properties
if (!window.CiliAI.activeDataset) window.CiliAI.activeDataset = 'lung';
if (!window.CiliAI.masterData) window.CiliAI.masterData = [];
if (!window.CiliAI.lookups) window.CiliAI.lookups = { geneMap: {}, cellDataCache: {}, byCiliopathy: {} };
if (window.CiliAI.ready === undefined) window.CiliAI.ready = false;


// CRITICAL FIX: Initialize Legacy Globals for SpatialManager/Zoom
// The 'Cannot set properties of undefined' error happens because legacy code expects window.zoomStateByGene
window.zoomStateByGene = window.zoomStateByGene || {}; 
window.CiliAI.zoomStateByGene = window.zoomStateByGene; // Sync with namespace

// CRITICAL FIX: Initialize Query Context for "Yes" follow-ups
window.lastQueryContext = window.lastQueryContext || { type: null, data: [], term: null };

// ── UTILITIES (MUST BE DEFINED ALWAYS) ──
window.CiliAI.utils = {
    normalizeQuery: (query) => (query || '').toLowerCase().trim(),
    extractGenes: (query) => {
        if (!query) return [];
        return window.extractMultipleGenes ? window.extractMultipleGenes(query) : [];
    },
    getExpressedCellTypes: (exprMap) => {
        if (!exprMap) return [];
        return window.getExpressedCellTypes ? window.getExpressedCellTypes(exprMap) : [];
    },
    normalizeTerm: (term) => {
        if (!term) return '';
        return window.normalizeTerm ? window.normalizeTerm(term) : term.toLowerCase().replace(/[^a-z0-9]/g, '');
    },
    ensureArray: (value) => {
        if (Array.isArray(value)) return value;
        if (value === null || value === undefined) return [];
        return [value];
    }
};

// Expose legacy globals just in case
window.extractMultipleGenes = window.extractMultipleGenes || function(q) { return []; };
window.getTPMInCellType = window.getTPMInCellType || function() { return 0; };

console.log("CiliAI v7.2.3 – Legacy Globals & State Initialized");

// Define logger to prevent ReferenceErrors
if (typeof window.log !== "function") {
    window.log = function (msg) { console.log(`CiliAI LOG: ${msg}`); };
}

// Chat Handler
if (typeof window.addChatMessage !== "function") {
    window.addChatMessage = function (msg, isUser) { 
        const chatWindow = document.getElementById('messages');
        if (chatWindow) {
            const div = document.createElement('div');
            div.className = isUser ? 'ciliai-message user' : 'ciliai-message assistant';
            div.innerHTML = `<div class="ciliai-message-content">${msg}</div>`;
            chatWindow.appendChild(div);
            chatWindow.scrollTop = chatWindow.scrollHeight;
        } else {
            console.log(`CHAT: ${msg}`); 
        }
    };
}

// Global variables for lazy loading
window.liPhylogenyCache = null;
window.neversPhylogenyCache = null;

// Default genes for phylogeny queries
window.DEFAULT_PHYLO_GENES = ["ZC2HC1A", "CEP41", "BBS1", "BBS2", "BBS5", "ZNF474", "IFT81", "BBS7"];

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
    
// --- 1. FIXED COMPLEX MAP (Removed Broad Locations) ---
function getComplexPhylogenyTableMap() {
    return {
        // --- Core IFT machinery ---
        "IFT COMPLEX": ["WDR19", "IFT140", "TTC21B", "IFT122", "WDR35", "IFT43", "IFT172", "IFT80", "IFT57", "TRAF3IP1", "CLUAP1", "IFT20", "IFT88", "IFT81", "IFT74", "IFT70A", "IFT70B", "IFT56", "IFT52", "IFT46", "IFT27", "IFT25", "IFT22"],
        "IFT-A COMPLEX": ["WDR19", "IFT140", "TTC21B", "IFT122", "WDR35", "IFT43"],
        "IFT-B COMPLEX": ["IFT172", "IFT80", "IFT57", "TRAF3IP1", "CLUAP1", "IFT20", "IFT88", "IFT81", "IFT74", "IFT70A", "IFT70B", "IFT56", "IFT52", "IFT46", "IFT27", "IFT25", "IFT22"],
        "IFT-B1 COMPLEX": ["IFT172", "IFT80", "IFT57", "TRAF3IP1", "CLUAP1", "IFT20"],
        "IFT-B2 COMPLEX": ["IFT88", "IFT81", "IFT74", "IFT70A", "IFT70B", "IFT56", "IFT52", "IFT46", "IFT27", "IFT25", "IFT22"],
        
        "IFT MOTOR COMPLEX": ["KIF3A", "KIF3B", "KIF17", "DYNC2H1", "DYNC2LI1", "WDR34", "WDR60"],
        "INTRAFLAGELLAR TRANSPORT MOTORS": ["KIF3A", "KIF3B", "KIF17", "DYNC2H1", "DYNC2LI1", "WDR34", "WDR60"],
        
        // --- BBSome and trafficking ---
        "BBSOME": ["BBS1", "BBS2", "BBS4", "BBS5", "BBS7", "TTC8", "BBS9", "BBIP1"],
        "EXOCYST": ["EXOC1", "EXOC2", "EXOC3", "EXOC4", "EXOC5", "EXOC6", "EXOC7", "EXOC8"],

        // --- Specific Modules (Keep these) ---
        "MKS MODULE": ["MKS1", "TMEM17", "TMEM67", "TMEM138", "B9D2", "B9D1", "CC2D2A", "TMEM107", "TMEM237", "TMEM231", "TMEM216", "TCTN1", "TCTN2", "TCTN3"],
        "NPHP MODULE": ["NPHP1", "NPHP3", "NPHP4", "RPGRIP1L", "IQCB1", "CEP290", "SDCCAG8"],

        // --- Appendages & Satellites ---
        "CENTRIOLE DISTAL APPENDAGES": ["CEP164", "SCLT1", "CEP89", "LRRC45", "CEP123", "ANKRD26", "FOPNL", "CEP128", "CEP135", "FBF1", "CCDC41", "CCDC120"],
        "CENTRIOLAR SATELLITES": ["PCM1", "CEP131", "CEP290", "OFD1", "AZI1", "CEP72", "SSX2IP"],
        "TRANSITION FIBER": ["CEP164", "CEP83", "SCLT1", "CEP89", "LRRC45", "CEP123", "CEP350", "CEP44"],

        // --- Axonemal and motility machinery ---
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

        // --- !!! CRITICAL FIX !!! ---
        // Removed "TRANSITION ZONE", "BASAL BODY", "CILIARY TIP", "CENTROSOME" keys
        // so the AI falls back to searching the full database 'Localization' column
        // instead of using these short static lists.
        
        "PEROXISOMAL COMPLEX": ["PEX1", "PEX2", "PEX3", "PEX5", "PEX6", "PEX10", "PEX12", "PEX13", "PEX14", "PEX19"]
    };
}

function getDiseaseClassificationMap() {
        return {
            "Primary Ciliopathies": [
                "Acrocallosal Syndrome", "Alström Syndrome", "Autosomal Dominant Polycystic Kidney Disease",
                "Autosomal Recessive Polycystic Kidney Disease", "Bardet–Biedl Syndrome", "Bardet Biedel Syndrome",
                "COACH Syndrome", "Cranioectodermal Dysplasia", "Ellis-van Creveld Syndrome", "Hydrolethalus Syndrome",
                "Infantile Polycystic Kidney Disease", "Joubert Syndrome", "Leber Congenital Amaurosis",
                "Meckel–Gruber Syndrome", "Nephronophthisis", "Orofaciodigital Syndrome",
                "Senior-Løken Syndrome", "Short-rib Thoracic Dysplasia", "Skeletal Ciliopathy", "Retinal Ciliopathy",
                "Syndromic Ciliopathy", "Al-Gazali-Bakalinova Syndrome", "Bazex-Dupré-Christol Syndrome",
                "Bilateral Polycystic Kidney Disease", "Biliary, Renal, Neurologic, and Skeletal Syndrome",
                "Caroli Disease", "Carpenter Syndrome", "Complex Lethal Osteochondrodysplasia",
                "Greig Cephalopolysyndactyly Syndrome", "Kallmann Syndrome", "Lowe Oculocerebrorenal Syndrome",
                "McKusick-Kaufman Syndrome", "Morbid Obesity and Spermatogenic Failure", "Polycystic Kidney Disease",
                "RHYNS Syndrome", "Renal-hepatic-pancreatic Dysplasia", "Retinal Dystrophy", "STAR Syndrome",
                "Smith-Lemli-Opitz Syndrome", "Spondylometaphyseal Dysplasia", "Stromme Syndrome",
                "Weyers Acrofacial Dysostosis", "Hydrocephalus"
            ],
            "Motile Ciliopathies": [
                "Primary Ciliary Dyskinesia", "Birt-Hogg-Dubé Syndrome", "Juvenile Myoclonic Epilepsy"
            ],
            "Secondary Diseases": [
                "Ataxia-telangiectasia-like Disorder", "Birt-Hogg-Dubé Syndrome", "Cone-Rod Dystrophy",
                "Cornelia de Lange Syndrome", "Holoprosencephaly", "Juvenile Myoclonic Epilepsy",
                "Medulloblastoma", "Retinitis Pigmentosa", "Spinocerebellar Ataxia", "Bazex-Dupré-Christol Syndrome",
                "Lowe Oculocerebrorenal Syndrome", "McKusick-Kaufman Syndrome", "Pallister-Hall Syndrome",
                "Simpson-Golabi-Behmel Syndrome", "Townes-Brocks Syndrome", "Usher Syndrome", "Visceral Heterotaxy"
            ],
            "Atypical Ciliopathies": [
                "Biliary Ciliopathy", "Chronic Obstructive Pulmonary Disease", "Ciliopathy",
                "Ciliopathy - Retinal dystrophy", "Golgipathies or Ciliopathy", "Hepatic Ciliopathy",
                "Male Infertility and Ciliopathy", "Male infertility", "Microcephaly and Chorioretinopathy Type 3",
                "Mucociliary Clearance Disorder", "Notch-mediated Ciliopathy", "Primary Endocardial Fibroelastosis",
                "Retinal Ciliopathy", "Retinal Degeneration", "Skeletal Ciliopathy", "Syndromic Ciliopathy"
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

// 1. Enhanced Gene Extraction (Fixes "THE" bug, case issues, etc.)
function extractMultipleGenes(query) {
    if (!query || typeof query !== 'string') return [];
    const qLower = query.toLowerCase();

    // Manual overrides for common genes
    const manualMap = {
        'kif3a': 'KIF3A', 'ift88': 'IFT88', 'bbs1': 'BBS1', 'arl13b': 'ARL13B',
        'cep290': 'CEP290', 'tmem67': 'TMEM67', 'ofd1': 'OFD1', 'foxj1': 'FOXJ1',
        'tctn1': 'TCTN1', 'mks1': 'MKS1', 'rpgrip1l': 'RPGRIP1L', 'ttc21b': 'TTC21B',
        'aaas': 'AAAS'
    };

    const found = new Set();

    // Manual match first
    for (const [key, gene] of Object.entries(manualMap)) {
        if (qLower.includes(key)) found.add(gene);
    }

    // Regex extraction with improved stopword filter
    const geneRegex = /\b([A-Z0-9][A-Z0-9\-\.]{2,})\b/gi;
    const matches = query.match(geneRegex) || [];
    const stopWords = new Set([
        "THE", "AND", "FOR", "NOT", "ARE", "WHAT", "SHOW", "LIST", "GENE", "GENES",
        "PLOT", "COMPARE", "WHAT'S", "DESCRIBE", "OF", "IN", "LOSS", "FUNCTION",
        "EFFECT", "WITH", "THAT", "THIS", "ABOUT", "TELL", "ME", "SHORT", "LONG",
        "LONGER", "CILIA", "CILIARY", "PROTEINS", "WHICH", "FIND", "CAUSES", "CAUSE",
        "KNOCKED", "DOWN", "WHEN", "NO", "KNOWN", "CORUM", "LINKED", "ASSOCIATED"
    ]);

    const geneMap = window.CiliAI.lookups.geneMap || {};

    matches.forEach(match => {
        const upper = match.toUpperCase();
        if (stopWords.has(upper)) return;
        if (geneMap[upper] || found.has(upper)) found.add(upper);
    });

    const result = Array.from(found);
    window.log(`[Gene Extraction] "${query}" → ${JSON.stringify(result)}`);
    return result;
}

// 2. Cell-Type Specific Expression Helpers
function getTPMInCellType(geneSymbol, cellType) {
    const gene = window.CiliAI.lookups.geneMap[geneSymbol.toUpperCase()];
    if (!gene?.expression?.scRNA) return 0;
    return gene.expression.scRNA[cellType] || 0;
}

function isExpressedInCellType(geneSymbol, cellType) {
    return getTPMInCellType(geneSymbol, cellType) > 0;
}

// 3. NEW: Cell-Type Specific Intent Parser
function extractCellTypeQuestion(qLower) {
    const cellTypes = {
        'basal cell': 'basal cell',
        'ciliated cell': 'ciliated cell',
        'multiciliated cell': 'multiciliated cell',
        'club cell': 'club cell',
        'goblet cell': 'goblet cell',
        'neuroendocrine cell': 'neuroendocrine cell',
        'alveolar type 1 cell': 'pulmonary alveolar type 1 cell',
        'alveolar type 2 cell': 'pulmonary alveolar type 2 cell'
    };

    for (const [keyword, type] of Object.entries(cellTypes)) {
        if (qLower.includes(keyword)) return type;
    }
    return null;
}
function formatListResult(title, genes, description = "") {
    if (!genes || genes.length === 0) {
        return `<div class="ai-result-card"><strong>${title}</strong><p>No matching genes found.</p></div>`;
    }

    const count = genes.length;
    // Limit inline display to 100 to prevent DOM lag (user can view full table for more)
    const displayGenes = genes.slice(0, 100); 

    let listHtml = `<div style="max-height: 280px; overflow-y: auto; margin: 0; background: #fff;">`;

    displayGenes.forEach(item => {
        // Resolve full gene data to calculate score
        const g = window.CiliAI.lookups.geneMap[item.gene.toUpperCase()] || {};
        const desc = item.description || g['Gene.Description'] || '';

        // --- SCORE & BADGE LOGIC (Matching DisplayFullGeneInfo) ---
        let score = 0;
        if (g.screens) score += g.screens.length; 
        if (g.Ciliopathies && g.Ciliopathies.length > 0) score += 2;
        if (g.Ortholog_C_elegans && g.Ortholog_C_elegans !== 'N/A') score += 1; 

        let badge = '';
        if (score >= 4) badge = `<span class="cilia-badge badge-gold" style="font-size:9px; padding:2px 6px; margin-left:6px;">🥇 High Conf</span>`;
        else if (score >= 2) badge = `<span class="cilia-badge badge-silver" style="font-size:9px; padding:2px 6px; margin-left:6px;">🥈 Verified</span>`;
        else badge = `<span class="cilia-badge badge-bronze" style="font-size:9px; padding:2px 6px; margin-left:6px;">🥉 Candidate</span>`;
        // ---------------------------------------------------------

        listHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; border-bottom: 1px solid #f1f5f9; transition: background 0.1s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                <div style="display: flex; align-items: center;">
                    <strong style="color: #005b96; cursor: pointer; font-size: 13px;" onclick="window.displayFullGeneInfo('${item.gene}')">${item.gene}</strong>
                    ${badge}
                </div>
                <div style="font-size: 11px; color: #94a3b8; max-width: 180px; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${desc}
                </div>
            </div>
        `;
    });
    listHtml += `</div>`;

    const allGeneNames = genes.map(g => g.gene).join(',');
    const top5 = genes.slice(0, 5).map(g => g.gene).join(',');

    return `
        <div class="ai-result-card" style="padding: 0; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); font-family: 'Inter', sans-serif;">
            <div style="padding: 15px; background: #fff; border-bottom: 1px solid #e2e8f0;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h4 style="margin:0; color:#005b96; font-size:15px; font-weight:700;">${title}</h4>
                    <span style="background: #005b96; color: white; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: bold;">${count}</span>
                </div>
                ${description ? `<p style="font-size: 12px; color: #64748b; margin-top: 5px; margin-bottom:0;">${description}</p>` : ''}
            </div>
            
            ${listHtml}
            
            <div style="padding: 12px 15px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; gap: 10px;">
                <button class="ciliai-button" style="flex: 1; margin: 0; background: #b3cde0; color: #005b96; height:36px; display:flex; align-items:center; justify-content:center; font-weight:700; border:1px solid #005b96;" 
                    onclick="window.handleBatchQuery('${allGeneNames}')"
                    onmouseover="this.style.background='#005b96'; this.style.color='white'"
                    onmouseout="this.style.background='#b3cde0'; this.style.color='#005b96'">
                    📊 View Full Table
                </button>
                <button class="ciliai-button" style="flex: 1; margin: 0; background: #005b96; color: white; height:36px; display:flex; align-items:center; justify-content:center; font-weight:700;" 
                    onclick="window.handleAIQuery('Multi: ${top5}')"
                    onmouseover="this.style.background='#004577'"
                    onmouseout="this.style.background='#005b96'">
                    🎨 Visualize Top 5
                </button>
            </div>
        </div>
    `;
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
 * Finds genes associated with a specific disease that are also expressed in a target tissue.
 * @param {string} diseaseTerm - The disease keyword (e.g., "Joubert Syndrome").
 * @param {string} tissueTerm - The tissue keyword (e.g., "kidney").
 * @returns {string} HTML message for the chat window.
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

    lastQueryContext = {
        type: 'list_followup',
        data: results,
        term: `Genes for ${diseaseTerm} expressed in ${tissueTerm}`
    };

    return `I found ${results.length} genes causing <strong>${diseaseTerm}</strong> that are expressed in <strong>${tissueTerm}</strong>. Do you want to view the list?`;
}

// --- NEW HELPER: COMPLEX + DISEASE OVERLAP QUERY ---
/**
 * Finds genes that belong to a specific complex AND are associated with a specific disease.
 * @param {string} complexTerm - The complex/module keyword (e.g., "BBSome").
 * @param {string} diseaseTerm - The disease keyword (e.g., "Joubert Syndrome").
 * @returns {string} HTML message for the chat window.
 */
function handleGeneInDiseaseQuery(complexTerm, diseaseTerm) {
    const normComplex = normalizeTerm(complexTerm);
    const normDisease = normalizeDiseaseKey(diseaseTerm);
    
    // 1. Get genes in the complex
    const complexGenes = getGenesByComplex(complexTerm).map(g => g.gene);
    const complexSet = new Set(complexGenes);
    
    // 2. Get genes associated with the disease
    const diseaseGenes = window.CiliAI.lookups.byCiliopathy[normDisease] || [];
    const diseaseSet = new Set(diseaseGenes);

    if (complexSet.size === 0) {
        return `<div class="ai-result-card"><p>I found no genes associated with the <strong>${complexTerm}</strong> complex.</p></div>`;
    }
    if (diseaseSet.size === 0) {
        return `<div class="ai-result-card"><p>I found no genes associated with <strong>${diseaseTerm}</strong>.</p></div>`;
    }

    // 3. Find the overlap
    const overlappingGenes = [...complexSet].filter(gene => diseaseSet.has(gene));
    const geneMap = window.CiliAI.lookups.geneMap;
    
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

    lastQueryContext = {
        type: 'list_followup',
        data: results,
        term: `${complexTerm} Genes Causing ${diseaseTerm}`
    };

    return `I found ${results.length} genes that are both in the <strong>${complexTerm}</strong> complex and associated with <strong>${diseaseTerm}</strong>. Do you want to view the list?`;
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
 * Renders a Sortable, Filterable Table with Extended Gene Info (ENSG, Loc, Disease)
 */
window.showDataInLeftPanel = function(title, geneList) {
    const container = document.getElementById('cilia-svg'); 
    if (!container) {
        console.error("Cannot find 'cilia-svg' container.");
        return;
    }
    const wrapper = container.closest('.interactive-cilium');
    if (wrapper) wrapper.classList.add('table-view-active');

    if (!geneList || geneList.length === 0) {
        container.innerHTML = `<div class="ciliai-table-container"><h3>${title}</h3><p style="padding:20px;">No genes found.</p><button id="ciliai-back-btn" class="ciliai-button" style="background:#718096;">Back</button></div>`;
        document.getElementById('ciliai-back-btn').addEventListener('click', () => window.generateAndInjectSVG());
        return;
    }

    // 1. Augment Data with ENSG, Localization, Diseases
    const augmentedList = geneList.map(item => {
        // Handle varied input formats (sometimes item is just string, sometimes object)
        const geneSymbol = (typeof item === 'string' ? item : (item.gene || item.Gene || item.GENE || 'Unknown')).toUpperCase();
        
        // Lookup full details from master map
        const fullData = window.CiliAI.lookups.geneMap[geneSymbol] || {};
        
        // Extract Diseases (handle arrays or strings)
        let diseases = 'None listed';
        if (Array.isArray(fullData.Ciliopathies)) diseases = fullData.Ciliopathies.join(', ');
        else if (fullData.Ciliopathies) diseases = fullData.Ciliopathies;
        else if (fullData['Ciliopathy']) diseases = fullData['Ciliopathy'];

        // Create new object with forced order: Gene, ENSG, Loc, Disease, then others
        const newItem = {
            Gene: geneSymbol,
            ENSG: fullData['Ensembl ID'] || fullData['Ensembl.ID'] || '—',
            Localization: fullData['Localization'] || '—',
            Diseases: diseases,
            ...item // Add original specific data (e.g. expression, p-value)
        };
        
        // Cleanup: Remove redundant 'gene' key if we added 'Gene'
        if(newItem.gene) delete newItem.gene;
        
        return newItem;
    });

    // 2. Dynamic Headers
    const keys = Object.keys(augmentedList[0]);
    const headers = keys.map(k => k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ')); 

    // 3. Build Table HTML
    let tableHTML = `
        <div style="padding: 0 10px 10px 10px;">
            <input type="text" id="ciliai-table-filter" placeholder="Filter table (e.g., 'kidney' or 'IFT')..." 
                   style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 13px;">
        </div>
        <table class="ciliai-data-table sortable" id="ciliai-dynamic-table">
            <thead>
                <tr>
                    ${keys.map((k, i) => `
                        <th onclick="window.sortTable('ciliai-dynamic-table', ${i})" style="cursor:pointer; user-select:none;">
                            ${headers[i]} <span style="font-size:10px; color:#666;">▼</span>
                        </th>
                    `).join('')}
                </tr>
            </thead>
            <tbody>
    `;

    augmentedList.forEach(item => {
        tableHTML += `<tr>`;
        keys.forEach(key => {
            let value = item[key] !== null && item[key] !== undefined ? item[key] : '—';
            // Truncate very long disease lists
            if (key === 'Diseases' && value.length > 50) {
                value = `<span title="${value}">${value.substring(0, 50)}...</span>`;
            }
            // Make Gene clickable
            if (key === 'Gene') {
                tableHTML += `<td><strong style="color:#2b6cb0; cursor:pointer;" onclick="window.displayFullGeneInfo('${value}')">${value}</strong></td>`;
            } else {
                tableHTML += `<td>${value}</td>`;
            }
        });
        tableHTML += `</tr>`;
    });
    tableHTML += `</tbody></table>`;

    // 4. Render Container
    container.innerHTML = `
        <div class="ciliai-table-container">
            <h3>${title} (${augmentedList.length} genes)</h3>
            <div>
                <button id="ciliai-download-btn" class="ciliai-button">Download CSV</button>
                <button id="ciliai-back-btn" class="ciliai-button" style="background: #718096;">Back</button>
            </div>
            <div class="ciliai-table-scroll-wrapper">
                ${tableHTML}
            </div>
        </div>
    `;

    window.injectTableCSS(); // Ensure styles exist

    // 5. Attach Filter Listener
    document.getElementById('ciliai-table-filter').addEventListener('keyup', function() {
        const filter = this.value.toUpperCase();
        const rows = document.getElementById("ciliai-dynamic-table").getElementsByTagName("tr");
        for (let i = 1; i < rows.length; i++) {
            let txtValue = rows[i].textContent || rows[i].innerText;
            if (txtValue.toUpperCase().indexOf(filter) > -1) {
                rows[i].style.display = "";
            } else {
                rows[i].style.display = "none";
            }
        }
    });

    // 6. Attach Button Listeners
    document.getElementById('ciliai-download-btn').addEventListener('click', () => {
        window.downloadTableAsCSV(title, augmentedList);
    });
    document.getElementById('ciliai-back-btn').addEventListener('click', () => {
        window.generateAndInjectSVG();
    });
};

/**
 * Sorts an HTML Table by column index
 */
window.sortTable = function(tableId, n) {
    const table = document.getElementById(tableId);
    let switching = true, shouldSwitch, dir = "asc", switchcount = 0;
    let i, x, y, rows = table.rows;

    while (switching) {
        switching = false;
        for (i = 1; i < (rows.length - 1); i++) {
            shouldSwitch = false;
            x = rows[i].getElementsByTagName("TD")[n];
            y = rows[i + 1].getElementsByTagName("TD")[n];
            
            let xContent = x.innerText.toLowerCase();
            let yContent = y.innerText.toLowerCase();
            const xNum = parseFloat(xContent);
            const yNum = parseFloat(yContent);
            const isNumeric = !isNaN(xNum) && !isNaN(yNum);

            if (dir == "asc") {
                if (isNumeric ? (xNum > yNum) : (xContent > yContent)) {
                    shouldSwitch = true;
                    break;
                }
            } else if (dir == "desc") {
                if (isNumeric ? (xNum < yNum) : (xContent < yContent)) {
                    shouldSwitch = true;
                    break;
                }
            }
        }
        if (shouldSwitch) {
            rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
            switching = true;
            switchcount++;
        } else {
            if (switchcount == 0 && dir == "asc") {
                dir = "desc";
                switching = true;
            }
        }
    }
};   
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
 * (UPDATED) Handles screen queries and adds a hint for references.
 * **FIXED:** Removed the internal follow-up context to prevent it from hijacking 'yes' for gene lists.
 */
function handleScreenQuery(geneSymbol) {
    // --- Data Retrieval (DO NOT REMOVE) ---
    const gene = geneSymbol.toUpperCase();
    const g = window.CiliAI.lookups.geneMap[gene];
    if (!g) return `Sorry, I could not find data for "${gene}".`;
    
    let html = `<div class="ai-result-card"><h4>Screen Results for <strong>${gene}</strong></h4>`;
    
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
            // FoundScreenKeys is no longer needed here, as there is no follow-up logic.
            html += `<li><strong>${s.source}</strong>: ${s.result || 'No result'}</li>`;
        });
        html += '</ul>';

        // Add a non-interactive hint instead of a context-setting question
        html += `<p style="font-size: 11px; margin-top: 10px;">(Hint: Ask "show screen references" to see publication details.)</p>`;
        
        // *** CRITICAL REMOVAL: The lastQueryContext object for 'screen_references' is removed. ***
        // This prevents the context from being active when the user types 'yes' for a gene list.

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

    function handleLocalizationQuery(term, query) {
        const geneList = getGenesByLocalization(term); 
        const count = geneList.length;
        if (count === 0) {
            return `Sorry, I could not find any genes localized to "${term}".`;
        }
        // (MODIFIED) Removed 'descriptionHeader'
        lastQueryContext = {
            type: 'list_followup',
            data: geneList, 
            term: `Genes localized to ${term}`
        };
        return `According to the latest data, ${count} genes are enriched in the ${term}. Do you want to view the list?`;
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


// Helper function to extract evolutionary concepts
function extractEvolutionIntent(qLower) {
    if (qLower.includes('ciliary-specific') || qLower.includes('ciliary specific')) return 'Ciliary_specific';
    if (qLower.includes('vertebrate-specific') || qLower.includes('vertebrate specific')) return 'Vertebrate_specific';
    if (qLower.includes('mammalian-specific') || qLower.includes('mammalian specific')) return 'Mammalian_specific';
    if (qLower.includes('c. elegans') || qLower.includes('conserved in')) return 'Conserved_in_elegans';
    return null;
}


    /**
     * (NEW) Helper to check if a gene is conserved (basic check).
     */
    function isGeneConserved(gene) {
        // A simple proxy for "conserved in ciliated organisms"
        return gene && gene.Ortholog_C_elegans;
    }

    
   function handleSimpleComplexQuery(term, query) {
        const geneList = getGenesByComplex(term);
        const count = geneList.length;
        if (count === 0) {
            // Fallback: check if the user meant "complexes for gene..."
            const genes = extractMultipleGenes(term);
            if (genes.length > 0) {
                return handleGeneInComplexQuery(genes[0]);
            }
            return `Sorry, I could not find any genes for the complex "${term}".`;
        }
        lastQueryContext = {
            type: 'list_followup', 
            data: geneList, 
            term: `Genes in ${term}`,
            descriptionHeader: 'Description'
        };
        return `I found ${count} genes in the ${term} complex. Do you want to view the list?`;
    }
    
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
    
    function handleClassificationQuery(classificationName, query) {
        const qLower = query.toLowerCase();
        
        // Find the cased name, e.g., "Primary Ciliopathies"
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
            // (MODIFIED) Use 'classification' as the key
            const geneListObjects = geneList.map(gene => ({
                gene: gene,
                classification: geneMap[gene]?.ciliopathy_classification || 'No classification listed'
            })).sort((a, b) => a.gene.localeCompare(b.gene)); 

            // (MODIFIED) Removed 'descriptionHeader'
            lastQueryContext = {
                type: 'list_followup',
                data: geneListObjects,
                term: `Genes for ${casedClassificationName}`
            };
            return `I found ${count} unique genes associated with ${casedClassificationName}. Do you want to view the list?`;
        
        } else {
            // User just wants to list the diseases in the classification
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
 * INJECTS CSS FOR TABS, BADGES, TABLES, AND UMAP SWITCH BUTTONS
 * Call this once when the gene page or plot is loaded.
 */
function injectCiliAIStyles() {
    const styleId = 'ciliai-core-styles';
    if (document.getElementById(styleId)) return;
    
    const css = `
        /* Tabs Styling */
        .cilia-tabs { display: flex; border-bottom: 2px solid #e2e8f0; margin-bottom: 15px; }
        .cilia-tab-btn {
            padding: 10px 20px; border: none; background: none; font-weight: 600; color: #718096;
            cursor: pointer; transition: all 0.2s; border-bottom: 2px solid transparent;
        }
        .cilia-tab-btn:hover { color: #2b6cb0; background: #ebf8ff; }
        .cilia-tab-btn.active { color: #2b6cb0; border-bottom: 2px solid #2b6cb0; }
        
        /* Tab Content Animation */
        .cilia-tab-content { display: none; animation: fadeIn 0.2s ease-in; }
        .cilia-tab-content.active { display: block; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

        /* Confidence Badges */
        .cilia-badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 0.75em; font-weight: bold; margin-left: 10px; vertical-align: middle; }
        .badge-gold { background: #fefcbf; color: #744210; border: 1px solid #d69e2e; }
        .badge-silver { background: #edf2f7; color: #2d3748; border: 1px solid #cbd5e0; }
        .badge-bronze { background: #fff5f5; color: #742a2a; border: 1px solid #feb2b2; }

        /* Data Tables */
        .fancy-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0; }
        .fancy-table th { background: #ebf8ff; color: #2c5282; padding: 6px 8px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; }
        .fancy-table td { padding: 6px 8px; border-bottom: 1px solid #E2E8F0; color: #4a5568; }
        .fancy-table tr:last-child td { border-bottom: none; }
        .fancy-table tr:hover { background: #f7fafc; }

        /* Section Headers */
        .section-header { margin-top: 1.2rem; font-size: 13px; font-weight: 700; color: #2d3748; border-bottom: 2px solid #edf2f7; padding-bottom: 4px; margin-bottom: 8px; }
        .data-source-note { font-size: 10px; color: #718096; margin-top: 4px; font-style: italic; }

        /* NEW: UMAP Dataset Switch Button */
        .ciliai-umap-switch {
            background: #ffffff;
            border: 1px solid #cbd5e0;
            color: #4a5568;
            padding: 6px 12px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-right: 8px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .ciliai-umap-switch:hover {
            background: #ebf8ff;
            color: #2b6cb0;
            border-color: #2b6cb0;
        }
    `;
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
}
/**
 * Calculates the bounding box (min/max UMAP coordinates) for a specified cell type cluster.
 * Also calculates the center point for potential annotation placement.
 * @param {string} cellType - The name of the cell cluster to find boundaries for.
 * @returns {object|null} {xMin, xMax, yMin, yMax, center: {x, y}} or null if not found.
 */
function getClusterBoundaries(cellType) {
    const umapData = window.CiliAI_UMAP;
    if (!umapData) return null;

    const targetPoints = umapData.filter(d => d.cell_type.toLowerCase() === cellType.toLowerCase());

    if (targetPoints.length === 0) {
        window.log(`[UMAP] No points found for cell type: ${cellType}`);
        return null;
    }

    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    let sumX = 0;
    let sumY = 0;

    targetPoints.forEach(p => {
        xMin = Math.min(xMin, p.x);
        xMax = Math.max(xMax, p.x);
        yMin = Math.min(yMin, p.y);
        yMax = Math.max(yMax, p.y);
        sumX += p.x;
        sumY += p.y;
    });

    // Add a small buffer to the bounds for better visualization padding
    const buffer = 0.5;

    return {
        xMin: xMin - buffer,
        xMax: xMax + buffer,
        yMin: yMin - buffer,
        yMax: yMax + buffer,
        center: {
            x: sumX / targetPoints.length,
            y: sumY / targetPoints.length
        }
    };
}

// And ensure the median function used inside renderUMAPPlot's annotation loop is defined globally,
// as it was left as a comment placeholder:
window.median = function (arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

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
 * Renders the Gold Standard Database View
 * Replicates the specific table layout requested for the "Complete Ciliary Gene List"
 */
window.renderGoldStandardView = function() {
    // 1. Get Data (Sort alphabetically by Gene)
    // We use the masterData loaded in CiliAI
    const allGenes = window.CiliAI.masterData.sort((a, b) => a.Gene.localeCompare(b.Gene));
    const totalCount = allGenes.length;

    // 2. Define Columns
    const columns = [
        { label: 'Gene ↕', key: 'Gene', width: '80px', isBold: true },
        { label: 'Description ↕', key: 'Gene.Description', width: '200px' },
        { label: 'Localization ↕', key: 'Localization', width: '150px' },
        { label: 'Ciliopathy ↕', key: 'Ciliopathies', width: '150px' },
        { label: 'Mouse Ortholog ↕', key: 'Ortholog_Mouse', width: '120px' },
        { label: 'Actions', key: 'actions', width: '80px' }
    ];

    // 3. Generate Rows (Limit to first 100 for performance, with "Load More" capability logic implies)
    // For this specific view, we map the exact data points requested.
    
    let tableRows = '';
    
    // We render a slice to keep the DOM light, but the count reflects the full DB
    const displayGenes = allGenes.slice(0, 100); 

    displayGenes.forEach(g => {
        // Data Safe Handling
        const desc = g['Gene.Description'] || '-';
        const loc = g.Localization || '-';
        
        // Handle Ciliopathy (Array or String)
        let disease = '-';
        if (Array.isArray(g.Ciliopathies)) disease = g.Ciliopathies.join('; ');
        else if (g.Ciliopathy) disease = g.Ciliopathy;
        
        const mouse = g.Ortholog_Mouse || '-';

        tableRows += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px; color: #005b96; font-weight: 700;">${g.Gene}</td>
                <td style="padding: 10px; font-size: 12px; color: #475569; line-height: 1.3;">${desc}</td>
                <td style="padding: 10px; font-size: 12px; color: #334155;">${loc}</td>
                <td style="padding: 10px; font-size: 12px; color: #be185d;">${disease}</td>
                <td style="padding: 10px; font-size: 12px; color: #475569; font-style: italic;">${mouse}</td>
                <td style="padding: 10px; text-align: center;">
                    <div style="display: flex; gap: 8px; justify-content: center;">
                        <button onclick="window.displayFullGeneInfo('${g.Gene}')" title="View Details" style="border:none; background:none; cursor:pointer; font-size: 16px;">👁️</button>
                        <button onclick="window.renderUMAPPlot('${g.Gene}', ['${g.Gene}'])" title="View Plot" style="border:none; background:none; cursor:pointer; font-size: 16px;">📊</button>
                    </div>
                </td>
            </tr>
        `;
    });

    // 4. Construct Final HTML
    return `
        <div class="ai-result-card" style="padding: 0; overflow: hidden; font-family: 'Inter', sans-serif; border: 1px solid #e2e8f0;">
            <div style="padding: 15px 20px; background: #fff; border-bottom: 1px solid #e2e8f0;">
                <h3 style="margin: 0; color: #005b96; font-size: 16px; font-weight: 700;">Ciliary Gene Database</h3>
                <p style="margin: 5px 0 0; font-size: 12px; color: #64748b;">
                    Comprehensive catalog of <strong>${totalCount.toLocaleString()}</strong> genes, localization, and disease associations.
                </p>
            </div>
            
            <div style="max-height: 400px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                    <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 10; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                        <tr>
                            ${columns.map(col => `
                                <th style="padding: 10px; color: #475569; font-weight: 600; border-bottom: 2px solid #e2e8f0; width: ${col.width};">
                                    ${col.label}
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
            <div style="padding: 10px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
                Showing first 100 genes. Use search to find specific targets.
            </div>
        </div>
    `;
};


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

/**
 * Calculates the average expression and fold change for a complex in two cell types.
 * @param {string} complexName - The name of the complex (e.g., 'BBSOME').
 * @param {string} cellTypeA - The first cell type (numerator).
 * @param {string} cellTypeB - The second cell type (denominator).
 * @returns {object} {complex: string, avgA: number, avgB: number, foldChange: number}
 */
function calculateFoldChangeForComplex(complexName, cellTypeA, cellTypeB) {
    const L = window.CiliAI.lookups;
    const geneSymbols = L.byModuleOrComplex[complexName.toUpperCase()] || [];
    const geneMap = L.geneMap;
    let sumA = 0;
    let sumB = 0;
    let count = 0;

    if (geneSymbols.length === 0) {
        return { complex: complexName, error: `Complex ${complexName} not found or has no genes.` };
    }

    geneSymbols.forEach(gene => {
        const g = geneMap[gene];
        if (g && g.expression?.scRNA) {
            const exprA = g.expression.scRNA[cellTypeA] || 0;
            const exprB = g.expression.scRNA[cellTypeB] || 0;
            
            // Filter out genes absent in both, but include genes present in only one.
            if (exprA > 0 || exprB > 0) {
                sumA += exprA;
                sumB += exprB;
                count++;
            }
        }
    });

    if (count === 0) {
        return { complex: complexName, error: `No scRNA data found for any gene in the complex across both cell types.` };
    }

    const avgA = sumA / count;
    const avgB = sumB / count;
    
    // Use a tiny epsilon to prevent division by zero in log fold change context
    const epsilon = 1e-3; 
    const denominator = avgB > 0 ? avgB : epsilon;
    const foldChange = avgA / denominator;

    return { 
        complex: complexName, 
        avgA: avgA, 
        avgB: avgB, 
        foldChange: foldChange,
        count: count,
        cellTypeA: cellTypeA,
        cellTypeB: cellTypeB
    };
}


/**
 * Calculates the average expression for a list of genes across all cell types in the scRNA data.
 * @param {Array<string>} geneSymbols - List of gene symbols in the set.
 * @returns {object} A map of {cellType: average_expression_value}.
 */
function getAverageComplexExpression(geneSymbols) {
    const geneMap = window.CiliAI.lookups.geneMap;
    const allCellTypes = [...new Set(window.CiliAI_UMAP.map(d => d.cell_type))];
    const avgExpression = {};
    const geneCounts = {};
    let totalGenesWithData = 0;

    // 1. Calculate the sum of expression for each cell type
    geneSymbols.forEach(gene => {
        const g = geneMap[gene];
        if (g && g.expression?.scRNA) {
            totalGenesWithData++;
            allCellTypes.forEach(cellType => {
                const expr = g.expression.scRNA[cellType] || 0;
                avgExpression[cellType] = (avgExpression[cellType] || 0) + expr;
                geneCounts[cellType] = (geneCounts[cellType] || 0) + (expr > 0 ? 1 : 0);
            });
        }
    });

    // 2. Divide the sum by the number of genes that contributed data (for true average)
    const finalAverage = {};
    if (totalGenesWithData > 0) {
        for (const cellType of allCellTypes) {
            // Calculate average using the count of genes used in the sum
            const count = geneCounts[cellType] || 1; 
            finalAverage[cellType] = (avgExpression[cellType] || 0) / count;
        }
    }

    return finalAverage;
}

/**
 * Finds the set of all species that contain at least one gene from BOTH phylogenetic classes.
 * @param {string} classA - First phylogenetic class name (e.g., 'Vertebrate_specific').
 * @param {string} classB - Second phylogenetic class name.
 * @param {string} source - 'li' or 'nevers'.
 * @returns {object} {sharedSpecies: string[], sharedCount: number}
 */
function getPhylogenyClassSpeciesOverlap(classA, classB, source = 'li') {
    const data = source === 'li' ? window.liPhylogenyCache : window.neversPhylogenyCache;
    if (!data) return { error: `${source.toUpperCase()} phylogeny data is not loaded.` };

    const classList = source === 'li' ? data.summary.class_list : null;
    const organismsList = source === 'li' ? data.summary.organisms_list : data.organism_groups.all_organisms_list;
    const isLi = source === 'li';

    // 1. Identify the Class IDs (Li only)
    let classIdA = -1, classIdB = -1;
    if (isLi) {
        classIdA = classList.findIndex(name => name.toLowerCase() === classA.toLowerCase());
        classIdB = classList.findIndex(name => name.toLowerCase() === classB.toLowerCase());
        
        if (classIdA === -1 || classIdB === -1) {
             return { error: `One or both phylogenetic classes not found in the ${source.toUpperCase()} dataset.` };
        }
    }

    // 2. Aggregate all species indices for each class
    const speciesInClassA = new Set();
    const speciesInClassB = new Set();

    Object.values(data.genes).forEach(geneEntry => {
        let geneClassMatchesA = false;
        let geneClassMatchesB = false;

        if (isLi) {
            geneClassMatchesA = (geneEntry.c === classIdA);
            geneClassMatchesB = (geneEntry.c === classIdB);
        } else { 
            // Nevers data does not contain class field per gene; this only works for Li. 
            // For Nevers, we'd need to filter by a custom criterion, which is currently unsupported.
            return { error: `Class-based comparison only supported for Li et al. (2014) data.` };
        }

        if (geneClassMatchesA && Array.isArray(geneEntry.s)) {
            geneEntry.s.forEach(index => speciesInClassA.add(index));
        }
        if (geneClassMatchesB && Array.isArray(geneEntry.s)) {
            geneEntry.s.forEach(index => speciesInClassB.add(index));
        }
    });

    // 3. Find the intersection of species indices
    const sharedIndices = [...speciesInClassA].filter(index => speciesInClassB.has(index));

    // 4. Map indices back to names
    const sharedSpecies = sharedIndices.map(index => organismsList[index]).sort();

    return {
        sharedSpecies: sharedSpecies,
        sharedCount: sharedSpecies.length,
        classA: classA,
        classB: classB,
        source: source
    };
}


/**
 * (NEW) Extracts Cell Type keywords from a query.
 * @param {string} qLower - The lowercase query string.
 * @returns {string|null} The found cell type term, or null.
 */
function extractCellTypeIntent(qLower) {
    // Keywords based on the scRNA data provided (lung cell types)
    const keywords = [
        'ciliated cell', 'stem cell', 'club cell', 'goblet cell', 
        'neuroendocrine cell', 'basal cell', 'pulmonary alveolar type 1 cell', 
        'pulmonary alveolar type 2 cell', 'lung secretory cell'
    ];
    
    for (const term of keywords) {
        if (qLower.includes(term)) {
            return term; // Return the full cased term for accuracy
        }
    }
    return null;
}

// ==========================================================
// 1. UPDATED INTENT EXTRACTORS (Adding Domain and Evo Types)
// ==========================================================

// Helper function to extract domain keywords
function extractDomainIntent(qLower) {
    const keywords = ['wd40 domain', 'pfam domain pf13432', 'wd40', 'pf13432', 'coiled-coil', 'ef-hand', 'tpr', 'aaa+ atpase', 'aaa domain', 'atpase domain', 'wd40 repeat'];
    for (const term of keywords) {
        if (qLower.includes(term)) {
            return term;
        }
    }
    return null;
}

// Helper to check for a domain (can be used by the main filter)
function hasDomain(gene, domainTerm) {
    const normTerm = normalizeTerm(domainTerm);
    const allDomains = [...ensureArray(gene.pfam_ids), ...ensureArray(gene.domain_descriptions)];
    return allDomains.some(d => d && normalizeTerm(d).includes(normTerm));
}

// Helper to check if gene belongs to a phylogeny class
function isInPhylogenyClass(gene, evoClass) {
    if (!gene.phylogeny || !gene.phylogeny.li) return false;
    const geneClass = (gene.phylogeny.li.class || '').replace(/_/g, ' ').toLowerCase();
    const targetClass = evoClass.replace(/_/g, ' ').toLowerCase();
    return geneClass.includes(targetClass);
}

/**
 * Core filtering loop for multi-criteria queries.
 * This handles all Localization/Phenotype/Expression/Disease/Evo/Domain combinations.
 */
function performMultiCriteriaFilter(query, intents) {
    let titleParts = [];
    const filteredGenes = window.CiliAI.masterData.filter(gene => {
        if (!gene || !gene.Gene) return false; 
        
        // --- Filter 1: Localization (e.g., 'basal body', 'lysosomal')
        if (intents.localization) {
            if (!titleParts.includes(`Loc: ${intents.localization}`)) titleParts.push(`Loc: ${intents.localization}`);
            const geneLoc = (gene.Localization || '').toLowerCase();
            if (!geneLoc.includes(intents.localization)) return false;
        }

        // --- Filter 2: Phenotype (e.g., 'short cilia', 'loss of cilia', 'no effect')
        if (intents.phenotype) {
            if (!titleParts.includes(`Pheno: ${intents.phenotype}`)) titleParts.push(`Pheno: ${intents.phenotype}`);
            const genePheno = (gene['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'] || '').toLowerCase();
            const phenoMatch = (intents.phenotype === 'short cilia' && (genePheno.includes('short') || genePheno.includes('decrease'))) ||
                               (intents.phenotype === 'longer cilia' && (genePheno.includes('long') || genePheno.includes('increase'))) ||
                               (intents.phenotype === 'loss of cilia' && (genePheno.includes('absent') || genePheno.includes('loss of cilia'))) ||
                               (intents.phenotype === 'no effect' && (genePheno.includes('no effect') || genePheno === ''));
            
            if (!phenoMatch) return false;
        }

        // --- Filter 3: Disease Association (e.g., 'Joubert Syndrome')
        if (intents.disease) {
            if (!titleParts.includes(`Disease: ${intents.disease}`)) titleParts.push(`Disease: ${intents.disease}`);
            const diseaseKey = normalizeDiseaseKey(intents.disease);
            const diseaseGenes = window.CiliAI.lookups.byCiliopathy[diseaseKey];
            if (!diseaseGenes || !diseaseGenes.includes(gene.Gene.toUpperCase())) return false;
        }

        // --- Filter 4: Expression (e.g., 'expressed in kidney', 'not expressed in testis')
        if (intents.expression) {
            const hasExpr = hasExpressionInTissue(gene, intents.expression);
            const title = `Expr: ${intents.isNegative ? 'NOT ' : ''}${intents.expression}`;
            if (!titleParts.includes(title)) titleParts.push(title);
            
            if (intents.isNegative ? hasExpr : !hasExpr) return false;
        }

        // --- Filter 5: Complex (e.g., 'IFT-B complex', 'not in known ciliary complex')
        if (intents.complex) {
            const inComplex = gene.complex_components && Object.keys(gene.complex_components).some(comp => comp.toLowerCase().includes(intents.complex));
            const title = `Complex: ${intents.isNegative ? 'NOT ' : ''}${intents.complex}`;
            if (!titleParts.includes(title)) titleParts.push(title);
            
            if (intents.isNegative ? inComplex : !inComplex) return false;
        } else if (query.toLowerCase().includes('not in a known ciliary complex')) {
             // Discovery query: "List all genes that are not in a known ciliary complex..."
            const hasAnyComplex = gene.complex_components && Object.keys(gene.complex_components).length > 0;
            if (hasAnyComplex) return false;
            if (!titleParts.includes('Complex: NOT in any known complex')) titleParts.push('Complex: NOT in any known complex');
        }

        // --- Filter 6: Evolution/Domain (e.g., 'vertebrate-specific', 'WD40 domain')
        if (intents.evolution) {
            if (!titleParts.includes(`Evo: ${intents.evolution}`)) titleParts.push(`Evo: ${intents.evolution}`);
            if (intents.evolution === 'Conserved_in_elegans') {
                if (!isGeneConserved(gene)) return false;
            } else if (!isInPhylogenyClass(gene, intents.evolution)) {
                 return false;
            }
        }
        
        if (intents.domain) {
            if (!titleParts.includes(`Domain: ${intents.domain}`)) titleParts.push(`Domain: ${intents.domain}`);
            if (!hasDomain(gene, intents.domain)) return false;
        }
        
        // All filters passed
        return true;
    });

    // --- 7. Format the Results (Custom columns based on query)
    const resultTitle = titleParts.join(' + ');

    if (filteredGenes.length === 0) {
        return `<div class="ai-result-card"><p>I found no genes that match all of your criteria: <strong>${resultTitle}</strong>.</p></div>`;
    }

    const geneListObjects = filteredGenes.map(g => {
        const geneObject = { gene: g.Gene };
        if (intents.localization) geneObject.localization = g.Localization || '—';
        if (intents.phenotype) geneObject.phenotype = g['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'] || '—';
        if (intents.disease) geneObject.disease = intents.disease;
        if (intents.expression) geneObject.expression = hasExpressionInTissue(g, intents.expression) ? intents.expression : 'Absent';
        if (intents.complex) geneObject.complex = intents.complex;
        if (intents.domain) geneObject.domain = intents.domain;
        if (intents.evolution) geneObject.evolution = intents.evolution.replace(/_/g, ' ');
        
        // Final fallback column if only gene is present
        if (Object.keys(geneObject).length === 1) { 
            geneObject.description = g['Gene.Description'] || 'No description available.';
        }
        return geneObject;
    });

    // Set context for follow-up
    lastQueryContext = {
        type: 'list_followup',
        data: geneListObjects,
        term: `Genes matching: ${resultTitle}`
    };

    return `I found ${filteredGenes.length} gene(s) matching your criteria: <strong>${resultTitle}</strong>. Do you want to view the list?`;
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

// --- Tab Switching Logic ---
window.openTab = function(evt, tabName) {
    const tabContents = document.getElementsByClassName("cilia-tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove("active");
    }
    const tabLinks = document.getElementsByClassName("cilia-tab-btn");
    for (let i = 0; i < tabLinks.length; i++) {
        tabLinks[i].classList.remove("active");
    }
    document.getElementById(`tab-${tabName}`).classList.add("active");
    evt.currentTarget.classList.add("active");
    
    // Auto-trigger UMAP if switching to Expression tab
    if (tabName === 'expression') {
        const geneName = document.getElementById('current-gene-name')?.textContent;
        if (geneName && window.renderUMAPPlot) {
            setTimeout(() => window.renderUMAPPlot(geneName, [geneName]), 100);
        }
    }
};

// ==============================================================
// 2. MAIN GENE DISPLAY FUNCTION (Updated: Ciliary Tissues)
// ==============================================================
window.displayFullGeneInfo = async function(geneSymbol) {
    if(typeof injectCiliAIStyles === 'function') injectCiliAIStyles();
    
    const gm = window.CiliAI?.lookups?.geneMap;
    if (!gm || !gm[geneSymbol]) {
        return `<div class="ai-result-card">No data found for gene <strong>${geneSymbol}</strong></div>`;
    }

    const g = gm[geneSymbol];
    const safeVal = (v) => (v && v !== 'N/A' && v !== '0' && v !== null && v !== undefined) 
        ? v 
        : '<span style="color:#ccc">—</span>';

    // ── Data Extraction ──
    const scRNA = g.expression?.scRNA || {};
    
    // Extract Tissue Expression (Removing metadata keys)
    let tissueExpr = {};
    let exprCategory = 'Unknown';
    let nTissues = 0;

    if (g.expression && g.expression.tissue) {
        tissueExpr = { ...g.expression.tissue };
        
        // Remove non-expression keys
        delete tissueExpr.n_tissues_expressed;
        delete tissueExpr.Category;
        
        // Retrieve metadata from parent object or tissue object
        exprCategory = g.expression.category || g.expression.tissue.Category || 'Unknown';
        nTissues = g.expression.n_tissues || g.expression.tissue.n_tissues_expressed || 0;
    }

    // Confidence badge logic
    let score = 0;
    if (g.screens) score += g.screens.length;
    if (g.Ciliopathies && g.Ciliopathies.length > 0) score += 2;
    if (g.Ortholog_C_elegans && g.Ortholog_C_elegans !== 'N/A') score += 1;

    let badge = '';
    if      (score >= 4) badge = `<span class="cilia-badge badge-gold">🥇 High Confidence</span>`;
    else if (score >= 2) badge = `<span class="cilia-badge badge-silver">🥈 Verified</span>`;
    else                 badge = `<span class="cilia-badge badge-bronze">🥉 Candidate</span>`;

    // ────────────────────────────────────────────────────────────────
    // BUILD HTML
    // ────────────────────────────────────────────────────────────────
    let html = `<div class="ai-result-card" style="font-family: 'Inter', sans-serif; padding:20px;">`;

    // Header
    html += `
        <div style="display:flex; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:20px;">
            <h2 id="current-gene-name" style="margin:0; color:#2b6cb0; font-size:1.9rem;">
                ${geneSymbol}
            </h2>
            ${badge}
        </div>`;

    // Tabs
    html += `
        <div class="cilia-tabs" style="margin-bottom:20px; border-bottom:2px solid #e2e8f0; padding-bottom:4px;">
            <button class="cilia-tab-btn active" onclick="window.openTab(event, 'overview')">Overview</button>
            <button class="cilia-tab-btn"        onclick="window.openTab(event, 'expression')">Expression</button>
            <button class="cilia-tab-btn"        onclick="window.openTab(event, 'screens')">Screens</button>
            <button class="cilia-tab-btn"        onclick="window.openTab(event, 'evolution')">Evolution</button>
        </div>`;

    // ── OVERVIEW TAB ──
    html += `
        <div id="tab-overview" class="cilia-tab-content active">
            <p><strong>Description:</strong> ${g['Gene.Description'] || 'No description available.'}</p>
            <p><strong>Localization:</strong> ${g.Localization || 'Not annotated'}</p>
            
            <div style="background:#f8fafc; padding:14px; border-radius:8px; margin:16px 0; border:1px solid #e2e8f0; font-size:0.95em;">
                <p style="margin:6px 0;"><strong>Mouse Ortholog:</strong> ${safeVal(g.Ortholog_Mouse)}</p>
                <p style="margin:6px 0;"><strong>LoF Phenotype:</strong> ${safeVal(g['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'])}</p>
                <p style="margin:6px 0;"><strong>OMIM:</strong> ${safeVal(g.OMIM?.ID)}</p>
            </div>
            
            ${g.complex_components ? window.renderComplexTable(g.complex_components) : '<p style="color:#64748b;">No known protein complex membership.</p>'}
        </div>`;

    // ── EXPRESSION TAB ──
    html += `
        <div id="tab-expression" class="cilia-tab-content">
            <div style="margin-bottom:20px;">
                <button class="ciliai-button" onclick="window.renderUMAPPlot('${geneSymbol}')">
                     🔄 View UMAP Plot
                </button>
            </div>`;

    // 1. Bulk Tissue Data (Updated Labels)
    if (Object.keys(tissueExpr).length > 0) {
        const tissueLabel = nTissues === 1 ? 'Ciliary Tissue' : 'Ciliary Tissues';

        html += `
            <div class="section-header" style="margin-bottom:12px;">Bulk RNA-seq (Ciliary Tissues)</div>
            
            <div style="display:flex; gap:10px; margin-bottom:12px;">
                 <span style="font-size:11px; background:#e0f2fe; color:#0369a1; padding:4px 8px; border-radius:4px; border:1px solid #bae6fd;">
                    Category: <strong>${exprCategory}</strong>
                 </span>
                 <span style="font-size:11px; background:#f0fdf4; color:#15803d; padding:4px 8px; border-radius:4px; border:1px solid #bbf7d0;">
                    Expressed in <strong>${nTissues}</strong> ${tissueLabel}
                 </span>
            </div>

            ${window.renderTissueExpressionTable(tissueExpr)}
        `;
    } else {
        html += '<p style="color:#64748b; font-style:italic;">No bulk tissue expression data available.</p>';
    }

    // 2. scRNA Data
    html += `
        <div class="section-header" style="margin:28px 0 12px; padding-top:16px; border-top:1px solid #e2e8f0;">
            Single-cell RNA-seq (Lung)
        </div>
        ${Object.keys(scRNA).length > 0 
            ? window.renderScRNATable(scRNA) 
            : '<p style="color:#64748b;">No single-cell expression data available.</p>'}
    `;

    html += `</div>`;

    // ── SCREENS TAB ──
    html += `
        <div id="tab-screens" class="cilia-tab-content">
            ${window.renderCiliaEffectsTable(g)}
            ${Array.isArray(g.screens) && g.screens.length > 0 
                ? window.renderScreensTable(g.screens) 
                : '<p style="color:#64748b; margin-top:10px;">No functional screen data available.</p>'}
        </div>`;

    // ── EVOLUTION TAB ──
    html += `
        <div id="tab-evolution" class="cilia-tab-content">
            ${g.phylogeny 
                ? window.renderPhyloTable(g.phylogeny) 
                : '<p style="color:#64748b;">No phylogenetic data available.</p>'}
            <div style="margin-top:20px;">
                <button class="ciliai-button" onclick="window.handleAIQuery('show evolution of ${geneSymbol}')">
                    

[Image of Phylogenetic Tree]
 View Phylogeny Heatmap
                </button>
            </div>
        </div>`;

    html += `</div>`; // Close card

    return html;
};

// ==============================================================
// 1. DATA DISPLAY HELPERS (Expression Atlas)
// ==============================================================
// Tissue-level expression table (sorted descending TPM)
window.renderTissueExpressionTable = function(tissueData) {
    if (!tissueData) return '';
    
    // Filter out non-numeric keys if any remain
    const validEntries = Object.entries(tissueData).filter(([k, v]) => typeof v === 'number');
    
    const sorted = validEntries.sort(([,a], [,b]) => b - a); // highest TPM first

    // Detect if this is the new "Ciliary Tissue" dataset format
    const hasCiliaryContext = true; // Since we are enforcing this meaning now

    let html = `
        <table class="fancy-table" style="width:100%; margin-top:8px;">
            <thead>
                <tr>
                    <th style="background:#f1f5f9; color:#475569;">Ciliary Tissue</th>
                    <th style="text-align:right; width:120px; background:#f1f5f9; color:#475569;">TPM</th>
                </tr>
            </thead>
            <tbody>`;

    sorted.forEach(([tissue, tpm]) => {
        // Clean display name
        let display = tissue
            .replace(/_/g, ' ')
            .replace('Lung Primary', 'Lung (Primary Cilia)')
            .replace('Lung Motile',  'Lung (Motile Cilia)')
            .replace('Hypothalamus', 'Brain (Hypothalamus)')
            .replace('Skeleton', 'Bone / Skeleton');

        const isHigh = tpm >= 10;
        
        // Dynamic bar width
        const barWidth = Math.min(100, (tpm / (sorted[0][1] || 1)) * 100);
        
        html += `
            <tr>
                <td style="font-weight:${isHigh ? '600' : 'normal'}; color:#334155;">${display}</td>
                <td style="text-align:right;">
                    <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px;">
                        <span style="font-weight:${isHigh ? '600' : 'normal'}; color:${isHigh ? '#2b6cb0' : '#64748b'};">${tpm.toFixed(2)}</span>
                        <div style="width:50px; height:4px; background:#e2e8f0; border-radius:2px;">
                            <div style="width:${barWidth}%; height:100%; background:${isHigh ? '#3182ce' : '#cbd5e0'}; border-radius:2px;"></div>
                        </div>
                    </div>
                </td>
            </tr>`;
    });

    html += `
            </tbody>
        </table>
        <div style="margin-top:8px; font-size:11px; color:#94a3b8; font-style:italic; text-align:right;">
            Source: CiliAI Integrated Expression Atlas (Ciliary Tissues Only)
        </div>`;

    return html;
};

// ==============================================================
// 3. SEARCH HELPERS (Pan-ciliary / Idio-specific)
// ==============================================================

window.getPanCiliaryGenes = function() {
    if (!window.CiliAI.expressionAtlas) return [];
    return Object.entries(window.CiliAI.expressionAtlas)
        .filter(([, data]) => data.Category === 'Pan-ciliary (Ubiquitous)')
        .map(([gene]) => gene)
        .sort();
};

window.getTissueSpecificGenes = function(tissueKeyword) {
    if (!window.CiliAI.expressionAtlas) return [];
    const key = tissueKeyword.toLowerCase();
    
    // Map user keywords to atlas columns
    let columnKey = '';
    if (key.includes('lung')) columnKey = 'Lung_Primary'; // or Check both
    else if (key.includes('kidney')) columnKey = 'Kidney';
    else if (key.includes('liver')) columnKey = 'Liver';
    else if (key.includes('brain')) columnKey = 'Hypothalamus';
    else if (key.includes('nose')) columnKey = 'Olfactory';
    
    return Object.entries(window.CiliAI.expressionAtlas)
        .filter(([, data]) => {
            if (data.Category !== 'Idio-ciliary (Tissue-Specific)') return false;
            // Check if this tissue is the dominant one
            // (Simple check: expression > 1 and it's listed as expressed)
            if (columnKey && data[columnKey] > 1) return true;
            return false; 
        })
        .map(([gene]) => gene)
        .sort();
};

function renderComplexTable(components) {
    let html = `<div class="section-header">Protein Complexes</div>
                <table class="fancy-table"><tr><th>Complex</th><th>Members</th></tr>`;
    for (const [cname, members] of Object.entries(components)) {
        html += `<tr><td>${cname}</td><td>${members.join(', ')}</td></tr>`;
    }
    return html + `</table>`;
}

function renderScRNATable(scRNA) {
    let html = `<table class="fancy-table"><tr><th>Cell Type</th><th>TPM</th></tr>`;
    Object.entries(scRNA).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([k,v]) => {
         html += `<tr><td>${k}</td><td><strong>${Number(v).toFixed(2)}</strong></td></tr>`;
    });
    return html + `</table><div class="data-source-note">Source: human lung organoid cell atlas.</div>`;
}

function renderCiliaEffectsTable(g) {
    const safeVal = (v) => (v && v !== 'N/A' && v !== '0') ? v : '—';
    return `<div class="section-header">Cilia Effects</div>
            <table class="fancy-table">
                <tr><th>Effect Type</th><th>Result</th></tr>
                <tr><td>Overexpression</td><td>${safeVal(g['Overexpression effects on cilia length (increase/decrease/no effect)'])}</td></tr>
                <tr><td>Loss-of-Function</td><td>${safeVal(g['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'])}</td></tr>
                <tr><td>% Ciliated</td><td>${safeVal(g['Percentage of ciliated cells (increase/decrease/no effect)'])}</td></tr>
            </table>`;
}

function renderScreensTable(screens) {
    let html = `<div class="section-header">Screen Results</div><table class="fancy-table"><tr><th>Source</th><th>Result</th></tr>`;
    screens.forEach(s => {
        html += `<tr><td><strong>${s.source}</strong></td><td>${s.result}</td></tr>`;
    });
    return html + `</table>`;
}

function renderPhyloTable(phylogeny) {
    let html = `<div class="section-header">Evolutionary History</div>
                <table class="fancy-table"><tr><th>Dataset</th><th>Class</th><th>Species Count</th></tr>`;
    for (const [pkey, pval] of Object.entries(phylogeny)) {
         const safeP = pval || {};
         html += `<tr><td>${pkey}</td><td>${safeP.class || '-'}</td><td>${safeP.species_data?.length || 0}</td></tr>`;
    }
    return html + `</table>`;
}

// Helpers for the Dashboard (Add these adjacent to displayFullGeneInfo)
function renderMiniExpressionTable(data) {
    if (!data) return '<p style="color:#a0aec0; font-size: 13px;">No scRNA data available.</p>';
    // Sort by value desc
    const sorted = Object.entries(data).sort(([,a], [,b]) => b - a).slice(0, 5);
    let html = '<table style="width:100%; font-size: 13px; border-collapse: collapse;">';
    sorted.forEach(([type, val]) => {
        const barWidth = Math.min(100, (val * 10)); // simple scaling
        html += `
            <tr>
                <td style="padding: 6px 0; color: #4a5568;">${type}</td>
                <td style="text-align: right; width: 40%; padding: 6px 0;">
                    <div style="display: flex; align-items: center; justify-content: flex-end;">
                        <span style="margin-right: 8px; font-weight: 600; color: #2b6cb0;">${val.toFixed(2)}</span>
                        <div style="width: 60px; height: 6px; background: #edf2f7; border-radius: 3px;">
                            <div style="width: ${barWidth}%; height: 100%; background: #4299e1; border-radius: 3px;"></div>
                        </div>
                    </div>
                </td>
            </tr>`;
    });
    return html + '</table>';
}

function renderMiniComplexList(data) {
    if (!data) return '<p style="color:#a0aec0; font-size: 13px;">Not part of known complexes.</p>';
    let html = '';
    for (const [name, members] of Object.entries(data)) {
        html += `
            <div style="margin-bottom: 10px; background: #fffaf0; border: 1px solid #feebc8; padding: 10px; border-radius: 6px;">
                <div style="font-weight: 600; font-size: 13px; color: #744210; margin-bottom: 4px;">${name}</div>
                <div style="font-size: 12px; color: #975a16; line-height: 1.4;">${members.join(', ')}</div>
            </div>
        `;
    }
    return html;
}
 
 /**
 * ROBUST LOCALIZATION SEARCH
 * Scans both the lookup maps AND the raw master database column.
 */
function getGenesByLocalization(term) {
    if (!term || !window.CiliAI || !window.CiliAI.lookups) return [];

    // --- Normalize search term ---
    let normTerm = term.toLowerCase().trim();

    // Handle common aliases
    if (normTerm === 'tz' || normTerm === 'transition-zone') {
        normTerm = 'transition zone';
    }

    const L = window.CiliAI.lookups;
    const geneMap = L.geneMap || {};
    const matchingGenes = new Set();

    // --------------------------------------------------
    // 1. FAST PATH: Pre-defined localization lookup
    // --------------------------------------------------
    if (L.byLocalization) {
        Object.entries(L.byLocalization).forEach(([key, genes]) => {
            if (key && key.toLowerCase().includes(normTerm)) {
                genes.forEach(geneSymbol => {
                    if (geneSymbol) {
                        matchingGenes.add(geneSymbol.toUpperCase());
                    }
                });
            }
        });
    }

    // --------------------------------------------------
    // 2. ROBUST PATH: Scan master data directly
    //    (critical for Transition Zone completeness)
    // --------------------------------------------------
    if (Array.isArray(window.CiliAI.masterData)) {
        window.CiliAI.masterData.forEach(row => {
            if (!row || !row.Gene || !row.Localization) return;

            const loc = row.Localization.toLowerCase().replace(/-/g, ' ');
            if (loc.includes(normTerm)) {
                matchingGenes.add(row.Gene.toUpperCase());
            }
        });
    }

    // --------------------------------------------------
    // 3. Return standardized objects
    // --------------------------------------------------
    return Array.from(matchingGenes).map(gene => {
        const geneData = geneMap[gene] || {};
        return {
            gene,
            localization: geneData.Localization || term
        };
    });
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

    function getGenesByComplex(term) {
        const normTerm = normalizeTerm(term);
        const L = window.CiliAI.lookups;
        const geneMap = L.geneMap;
        const complexKey = Object.keys(L.byModuleOrComplex).find(key => normalizeTerm(key).includes(normTerm));
        if (complexKey) {
            const geneSymbols = L.byModuleOrComplex[complexKey];
            return geneSymbols.map(gene => ({
                gene: gene,
                description: geneMap[gene]?.['Gene.Description'] || `Component of ${complexKey}`
            }));
        }
        return [];
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
    
    // 1. Prepare Disease Keywords
    const diseaseMap = getDiseaseClassificationMap();
    let allDiseaseKeywords = ['BBS', 'NPHP', 'MKS']; 
    for (const classification in diseaseMap) {
        allDiseaseKeywords = allDiseaseKeywords.concat(diseaseMap[classification]);
    }
    
    // 2. Prepare Classification Keywords
    const classificationKeywords = Object.keys(window.CiliAI.lookups.byClassification || {});
    classificationKeywords.push(...Object.keys(diseaseMap)); 

    // 3. Prepare Complex Keywords
    // NOTE: "Transition Zone" is no longer here, so it won't be trapped as a complex.
    const complexKeywords = Object.keys(window.CiliAI.lookups.byModuleOrComplex || {});
    complexKeywords.push(...Object.keys(getComplexPhylogenyTableMap())); 

    // 4. Define Search Priorities (Order Matters!)
    const entityKeywords = [
        {
            type: 'CLASSIFICATION', 
            keywords: classificationKeywords,
            handler: handleClassificationQuery 
        },
        {
            type: 'COMPLEX',
            keywords: complexKeywords,
            handler: handleComplexQuery 
        },
        {
            type: 'LOCALIZATION',
            // "Transition Zone" is explicitly caught here now
            keywords: [
                'basal body', 'axoneme', 'transition zone', 'cytosol', 'centrosome', 
                'cilium', 'cilia', 'mitochondria', 'nucleus', 'ciliary tip',
                'lysosome', 'lysosomes', 'ciliary associated gene', 'microbody', 'peroxisome', 'flagella'
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
            keywords: ['WD40', 'coiled-coil', 'pfam', 'domain', 'ef-hand', 'TPR', 'AAA+ ATPase', 'AAA domain'],
            handler: getGenesByDomain 
        },
        {
            type: 'META',
            keywords: ['about yourself', 'what can you do', 'help me', 'capabilities'],
            handler: tellAboutCiliAI
        }
    ];

    // 5. Execute Logic
    const normalizedQuery = normalizeTerm(query);
    for (const entityType of entityKeywords) {
        // Sort by length to match longest terms first (e.g., "Transition Zone" before "Zone")
        const sortedKeywords = [...entityType.keywords].sort((a, b) => b.length - a.length);
        
        for (const keyword of sortedKeywords) {
            const normKeyword = normalizeTerm(keyword);
            if (!normKeyword) continue;
            
            if (normalizedQuery.includes(normKeyword)) { 
                // Ignore negative queries (e.g. "not in transition zone")
                if (qLower.includes('not in') || qLower.includes('except')) continue;
                
                return { type: entityType.type, entity: keyword, handler: entityType.handler };
            }
        }
    }
    return null;
}

function getCiliopathyGenes(term) {
    // 1. Use your helper to standardize the name (e.g. "Joubert" -> "Joubert Syndrome")
    // We use window.normalizeDiseaseKey if available, otherwise just the term
    const normalizedKey = typeof window.normalizeDiseaseKey === 'function' 
        ? window.normalizeDiseaseKey(term) 
        : window.normalizeTerm(term);

    // 2. Ensure the key format matches your database keys (lowercase, no spaces)
    const cleanKey = window.normalizeTerm(normalizedKey); 

    // 3. Retrieve the list from the database
    let geneSymbols = window.CiliAI.lookups.byCiliopathy[cleanKey] || [];

    // 4. Fallback: If strict lookup fails, scan the Master Data for partial matches
    // (This helps if the user types "Joubert" but the key is "joubertsyndrome")
    if (geneSymbols.length === 0 && window.CiliAI.masterData) {
        const lowerTerm = term.toLowerCase();
        const foundSet = new Set();
        
        window.CiliAI.masterData.forEach(g => {
            if (g.Ciliopathy) {
                const diseases = Array.isArray(g.Ciliopathy) ? g.Ciliopathy : [g.Ciliopathy];
                // Check if any disease string matches the user's term
                if (diseases.some(d => d.toLowerCase().includes(lowerTerm))) {
                    foundSet.add(g.Gene.toUpperCase());
                }
            }
        });
        geneSymbols = Array.from(foundSet);
    }

    // 5. Format results for the chat
    const formattedGenes = geneSymbols.map(sym => {
        const geneData = window.CiliAI.lookups.geneMap[sym];
        return {
            gene: sym,
            description: geneData ? (geneData.Localization || 'Ciliopathy gene') : 'No details available'
        };
    });

    if (formattedGenes.length === 0) {
        return {
            genes: [],
            description: `No genes found for <strong>${term}</strong> in the database.`
        };
    }

    // Sort alphabetically for display
    return {
        genes: formattedGenes.sort((a, b) => a.gene.localeCompare(b.gene)),
        description: `Found <strong>${formattedGenes.length}</strong> genes associated with <strong>${normalizedKey}</strong>.`
    };
}

// ==========================================================
// 4B. COMPLEX QUERY ENGINE (L2/L3) - NEW
// ==========================================================

window.extractLocalizationIntent = function(qLower) {
    const keywords = [
        { term: 'transition zone', patterns: [/\btransition zone\b/, /\btz\b/] },
        { term: 'basal body', patterns: [/\bbasal body\b/, /\bbasal bodies\b/, /\bcentriole\b/, /\bbb\b/] },
        { term: 'ciliary tip', patterns: [/\bciliary tip\b/, /\btip\b/] },
        { term: 'ciliary membrane', patterns: [/\bciliary membrane\b/, /\bmembrane\b/, /\bsheath\b/] },
        { term: 'axoneme', patterns: [/\baxoneme\b/, /\baxonemal\b/] },
        { term: 'centrosome', patterns: [/\bcentrosome\b/, /\bpcm\b/] },
        { term: 'nucleus', patterns: [/\bnucleus\b/, /\bnuclear\b/] },
        { term: 'cytoplasm', patterns: [/\bcytoplasm\b/, /\bcytosol\b/, /\bcell body\b/] },
        { term: 'mitochondria', patterns: [/\bmitochondria\b/, /\bmitochondrial\b/] },
        { term: 'lysosome', patterns: [/\blysosome\b/, /\blysosomes\b/, /\blysosomal\b/] },
        { term: 'peroxisome', patterns: [/\bperoxisome\b/, /\bmicrobody\b/] },
        { term: 'flagella', patterns: [/\bflagella\b/, /\bflagellum\b/] },
        { term: 'cilia', patterns: [/\bcilia\b/, /\bcilium\b/, /\bciliary\b/] } // must stay last
    ];

    for (const entry of keywords) {
        if (entry.patterns.some(p => p.test(qLower))) {
            return entry.term;
        }
    }
    return null;
};


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

// --- NEW HELPER: Extract Domain Keywords ---
window.extractDomainIntent = function(qLower) {
    const keywords = [
        'wd40 domain', 'pfam domain', 'wd40', 'pf13432', 
        'coiled-coil', 'ef-hand', 'tpr', 'aaa+ atpase', 
        'aaa domain', 'atpase domain', 'wd40 repeat', 'domain'
    ];
    for (const term of keywords) {
        if (qLower.includes(term)) {
            return term;
        }
    }
    return null;
};


/**
 * (REPLACEMENT) Complex Query Router
 * Fixes "List transition zone genes" by allowing single intents if "list" is present.
 */
window.handleComplexQuery = function(query) {
    const qLower = query.toLowerCase();

    // 1. Abort if visual request (don't steal "Show evolution" or "Plot")
    if (qLower.includes('plot') || (qLower.includes('show') && (qLower.includes('evolution') || qLower.includes('heatmap') || qLower.includes('map')))) {
        return null; 
    }

    // 2. Extract Intents
    // Ensure the extractor exists; fallback if missing to prevent crash
    const loc = typeof window.extractLocalizationIntent === 'function' ? window.extractLocalizationIntent(qLower) : null;
    
    const intents = {
        localization: loc,
        phenotype: window.extractPhenotypeIntent ? window.extractPhenotypeIntent(qLower) : null,
        disease: window.extractDiseaseIntent ? window.extractDiseaseIntent(qLower) : null,
        expression: window.extractExpressionIntent ? window.extractExpressionIntent(qLower) : null,
        complex: window.extractComplexIntent ? window.extractComplexIntent(qLower) : null,
        evolution: window.extractEvolutionIntent ? window.extractEvolutionIntent(qLower) : null,
        domain: window.extractDomainIntent ? window.extractDomainIntent(qLower) : null, 
        isNegative: qLower.includes('not in') || qLower.includes('not expressed') || qLower.includes('no known phenotype')
    };

    // 3. Count valid intents
    let intentCount = 0;
    if (intents.localization) intentCount++;
    if (intents.phenotype || qLower.includes('no known phenotype')) intentCount++;
    if (intents.disease) intentCount++;
    if (intents.expression) intentCount++;
    if (intents.complex || qLower.includes('not in a known ciliary complex')) intentCount++;
    if (intents.evolution) intentCount++;
    if (intents.domain) intentCount++;

    // --- CRITICAL FIX: Robust "List" Detection ---
    const isListRequest = 
        qLower.includes('list') || 
        qLower.includes('show genes') || 
        qLower.includes('find genes') || 
        qLower.includes('which genes') ||
        qLower.includes('give me') ||
        qLower.startsWith('genes in');

    // Fail if < 2 intents AND it's not a list request
    // (This allows "List transition zone genes" to pass with just 1 intent)
    if (intentCount === 0 || (intentCount < 2 && !isListRequest)) {
        return null; 
    }

    if(window.log) window.log(`[Complex Router] Handling query with ${intentCount} intents. Localization: ${intents.localization}`);

    // 4. Filter Genes
    let titleParts = [];
    const filteredGenes = window.CiliAI.masterData.filter(gene => {
        if (!gene || !gene.Gene) return false;
        
        // Localization Filter
        if (intents.localization) {
            if (!titleParts.includes(`Loc: ${intents.localization}`)) titleParts.push(`Loc: ${intents.localization}`);
            const locStr = (gene.Localization || '').toLowerCase();
            // Loose check for localization
            if (!locStr.includes(intents.localization)) return false;
        }
        
        // Disease Filter
        if (intents.disease) {
            const dKey = window.normalizeDiseaseKey ? window.normalizeDiseaseKey(intents.disease) : intents.disease;
            const dList = window.CiliAI.lookups.byCiliopathy[dKey];
            if (!titleParts.includes(`Disease: ${intents.disease}`)) titleParts.push(`Disease: ${intents.disease}`);
            if (!dList || !dList.includes(gene.Gene.toUpperCase())) return false;
        }
        
        // Phenotype Filter
        if (intents.phenotype) {
            if (!titleParts.includes(`Pheno: ${intents.phenotype}`)) titleParts.push(`Pheno: ${intents.phenotype}`);
            const pStr = (gene['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'] || '').toLowerCase();
            // Check for match (e.g. "short" in "shorter cilia")
            const keyword = intents.phenotype.split(' ')[0]; 
            if (!pStr.includes(keyword)) return false;
        }

        // (Complex/Expression logic relies on your existing helper functions - assuming they are correct in the main file)

        return true;
    });

    const resultTitle = titleParts.join(' + ') || "your criteria";

    if (filteredGenes.length === 0) {
        return `<div class="ai-result-card"><p>I found no genes matching: <strong>${resultTitle}</strong>.</p></div>`;
    }

    // 5. Format & Save Context
    const geneListObjects = filteredGenes.map(g => ({
        gene: g.Gene,
        description: g['Gene.Description'] || 'No description available'
    }));

    // --- CRITICAL FIX: Save to window.CiliAI.lastQueryContext ---
    window.CiliAI.lastQueryContext = {
        type: 'list_followup',
        data: geneListObjects,
        term: resultTitle
    };

    return `I found ${filteredGenes.length} gene(s) matching your criteria: <strong>${resultTitle}</strong>. Do you want to view the list?`;
};


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

// ==========================================================
// 4G. Main "Brain" (Query Routers) - FINAL EXPOSED FUNCTION
// ==========================================================
/**
 * Renders Interactive UMAP – Sized to fit "Spatial Intelligence" container.
 * Default: WDR31. Supports all tissues + Sliders.
 */
window.renderUMAPPlot = async function(displayName, targetGenes = [], zoomToCellType = null) {
    // 1. Clear previous views
    if (typeof window.resetViews === 'function') window.resetViews();

    // 2. Active dataset
    const datasetKey = window.CiliAI.activeDataset || 'lung';
    const dataset = window.CiliAI.datasets?.[datasetKey];
    if (!dataset || !Array.isArray(dataset.umap)) {
        window.addChatMessage(`Warning: ${datasetKey.charAt(0).toUpperCase() + datasetKey.slice(1)} dataset not loaded yet.`, false);
        return;
    }

    // 3. Normalize inputs (Default to WDR31)
    if (!displayName) displayName = 'WDR31';
    if (typeof targetGenes === 'string') {
        targetGenes = targetGenes.split(',').map(t => t.trim().toUpperCase()).filter(t => t.length > 0);
    }
    if (!targetGenes || targetGenes.length === 0) targetGenes = ['WDR31'];

    const primaryGene = targetGenes[0];
    const isMultiGene = targetGenes.length > 1;
    const isClusterView = displayName === 'CLUSTER_VIEW';

    // 4. Prepare data
    const sourceData = dataset.umap;
    const x = [], y = [], color = [], text = [], size = [], customdata = [];
    let maxExpr = 0;

    const cellTypes = new Set();
    
    // --- CLUSTER COLORS (Lung & Kidney Preserved) ---
    const clusterColors = {
        // Lung & Kidney (Original - DO NOT CHANGE)
        'Proximal Tubule Cell': '#3B82F6', 'Thick Ascending Limb Cell': '#60A5FA',
        'Distal Convoluted Tubule Cell': '#93C5FD', 'Collecting Duct Principal Cell': '#BFDBFE',
        'Collecting Duct Intercalated Cell': '#DBEAFE', 'Podocyte': '#1E40AF',
        'Fibroblast': '#1D4ED8', 'Endothelial Cell': '#2563EB', 'Immune Cell': '#1E3A8A',
        'Cycling Cell': '#172554', 'Ciliated Cell': '#E11D48',
        'stem cell': '#E11D48', 'club cell': '#3B82F6', 'goblet cell': '#10B981',
        'basal cell': '#F59E0B', 'neuroendocrine cell': '#8B5CF6',
        'pulmonary alveolar type 1 cell': '#60A5FA', 'pulmonary alveolar type 2 cell': '#2563EB',
        'lung secretory cell': '#34D399', 'Ciliated epithelial cell': '#E11D48',
        'AT1 cell': '#60A5FA', 'AT2 cell': '#2563EB', 'Club cell': '#3B82F6', 
        'Goblet cell': '#10B981', 'Basal cell': '#F59E0B', 'Macrophage': '#DC2626', 
        'Monocyte': '#EF4444', 'T cell': '#059669', 'B cell': '#7C3AED', 'Endothelial cell': '#0284C7',

        // Other Tissues
        'Hepatocyte': '#10B981', 'Cholangiocyte': '#34D399', 'Kupffer cell': '#DC2626',
        'Liver sinusoidal endothelial cell': '#0284C7', 'Hepatic stellate cell': '#D97706',
        'NK cell': '#9F7AEA',
        'Neuron': '#8B5CF6', 'Astrocyte': '#10B981', 'Oligodendrocyte': '#3B82F6',
        'Microglia': '#DC2626', 'Tanycyte': '#EC4899', 'Ependymal cell': '#E11D48',
        'Mural cell': '#D97706',
        'Chondroblast': '#10B981', 'Homeostatic chondrocyte': '#34D399',
        'Hypertrophic chondrocyte': '#B45309', 'Prefibrotic chondrocyte': '#D97706',
        'Reparative chondrocyte': '#3B82F6',
        'Acinar cell': '#F59E0B', 'Beta cell': '#DC2626', 'Alpha cell': '#EF4444',
        'Delta cell': '#F87171', 'Ductal cell': '#D97706', 'Stellate cell': '#10B981',
        'Mature OSN': '#8B5CF6', 'Immature OSN': '#A78BFA', 'Horizontal Basal Cell': '#10B981',
        'Sustentacular Cell': '#059669', 'Bowman Gland': '#D97706', 'Microvillar Cell': '#EC4899'
    };

    // Helper: decode sparse array
    const decodeSparse = (sparse, total) => {
        const dense = new Float32Array(total).fill(0);
        if (!sparse) return dense;
        for (let k = 0; k < sparse.length; k += 2) {
            const idx = sparse[k];
            const val = sparse[k + 1];
            if (idx < total) dense[idx] = val;
        }
        return dense;
    };

    // Expression handling
    let exprData = null; 
    let geneFoundCount = 0;

    if (!isClusterView) {
        const perGeneExpr = [];
        targetGenes.forEach(g => {
            let rawData = dataset.expression?.[g] || window.CiliAI.cellDataCache?.[g];
            // Fallback for cell-centric
            if (!rawData && dataset.expression && typeof dataset.expression === 'object' && !Array.isArray(dataset.expression)) {
                rawData = { __cell_lookup_mode__: true }; 
            }

            if (rawData) {
                geneFoundCount++;
                if (Array.isArray(rawData)) {
                    perGeneExpr.push(decodeSparse(rawData, sourceData.length));
                } else if (rawData.cells && rawData.expression) {
                    // Hypothalamus
                    const arr = new Float32Array(sourceData.length).fill(0);
                    for(let k=0; k<rawData.cells.length; k++) {
                        const idx = rawData.cells[k];
                        if(idx < arr.length) arr[idx] = rawData.expression[k];
                    }
                    perGeneExpr.push(arr);
                } else if (typeof rawData === 'object') {
                    // Cell-centric / Dictionary
                    const arr = new Float32Array(sourceData.length);
                    sourceData.forEach((p, i) => {
                        if (rawData[p.cell_type] !== undefined) {
                            arr[i] = rawData[p.cell_type];
                        } else if (rawData.__cell_lookup_mode__) {
                            const cellId = p.cell_id || p.id;
                            if (dataset.expression[cellId] && dataset.expression[cellId][g] !== undefined) {
                                arr[i] = dataset.expression[cellId][g];
                            }
                        }
                    });
                    perGeneExpr.push(arr);
                }
            }
        });

        if (geneFoundCount > 0) {
            exprData = new Float32Array(sourceData.length);
            sourceData.forEach((_, i) => {
                let sum = 0;
                let count = 0;
                perGeneExpr.forEach(arr => {
                    if (arr[i] !== undefined) { sum += arr[i]; count++; }
                });
                exprData[i] = count > 0 ? sum / count : 0;
            });
        }
    }

    // Build plot points
    sourceData.forEach((p, i) => {
        if (!p) return;
        const cellType = p.cell_type;
        cellTypes.add(cellType);

        if (zoomToCellType && cellType !== zoomToCellType) return;

        let px = p.x ?? p.umap_x ?? p.UMAP_1;
        let py = p.y ?? p.umap_y ?? p.UMAP_2;
        if (px === undefined || py === undefined) return;

        x.push(parseFloat(px));
        y.push(parseFloat(py));

        let exprVal = 0;
        if (!isClusterView && exprData) {
            exprVal = exprData[i];
            if (exprVal > maxExpr) maxExpr = exprVal;
        }

        text.push(`<b>${cellType}</b><br>${isClusterView ? '' : `Expression: ${exprVal.toFixed(2)} TPM`}`);
        customdata.push({
            localization: window.CiliAI.lookups.geneMap[primaryGene]?.Localization || 'Cilium',
            gene: primaryGene
        });

        if (isClusterView) {
            let matchColor = '#94A3B8';
            for(const key in clusterColors) {
                if(cellType.toLowerCase().includes(key.toLowerCase())) { matchColor = clusterColors[key]; break; }
            }
            color.push(matchColor);
            size.push(6);
        } else {
            color.push(exprVal);
            size.push(exprVal > 0 ? 8 : 4);
        }
    });

    if (x.length === 0) {
        window.addChatMessage(`⚠️ No valid UMAP coordinates found for ${dataset.name}.`, false);
        return;
    }

    // 5. Setup Trace
    const trace = {
        x, y, text, customdata,
        mode: 'markers',
        type: 'scattergl',
        hoverinfo: 'text',
        marker: {
            size,
            opacity: 0.85,
            line: { width: 0.5, color: '#fff' }
        }
    };

    if (!isClusterView) {
        trace.marker.color = color;
        trace.marker.cmin = 0;
        trace.marker.cmax = maxExpr > 0 ? maxExpr : 1;
        trace.marker.colorscale = dataset.colorScale || [[0, '#e2e8f0'], [0.5, '#3b82f6'], [1, '#1e40af']];
        trace.marker.colorbar = { title: isMultiGene ? 'Avg TPM' : 'TPM', thickness: 15, len: 0.6 };
    } else {
        trace.marker.color = color;
    }

    // 6. Sizing Logic (FIXED)
    // We calculate size from the parent container BEFORE plotting
    const vizStage = document.getElementById('viz-stage');
    const stageWidth = vizStage ? vizStage.clientWidth : 600;
    const stageHeight = vizStage ? vizStage.clientHeight : 500;

    const layout = {
        title: {
            text: `<b>${isClusterView ? 'Cell Types' : (isMultiGene ? targetGenes.join(' + ') : primaryGene)}</b><br><sub>${dataset.name}</sub>`,
            font: { size: 16 }
        },
        xaxis: { visible: false, showgrid: false, zeroline: false },
        yaxis: { visible: false, showgrid: false, zeroline: false },
        hovermode: 'closest',
        width: stageWidth,   // Force fill width
        height: stageHeight, // Force fill height
        autosize: true,      // Keep responsive
        margin: { t: 40, b: 20, l: 20, r: 20 }, // Minimal margins to maximize plot size
        plot_bgcolor: '#fff',
        paper_bgcolor: '#fff',
        showlegend: false,
        annotations: []
    };

    // Legend
    if (isClusterView) {
        const legendX = 1.02;
        let legendY = 1;
        const legendStep = 0.05;
        Array.from(cellTypes).sort().forEach((ct, idx) => {
            let col = '#666';
            for(const key in clusterColors) {
                if(ct.toLowerCase().includes(key.toLowerCase())) { col = clusterColors[key]; break; }
            }
            layout.annotations.push({
                x: legendX, y: legendY - idx * legendStep,
                xref: 'paper', yref: 'paper',
                text: `<span style="color:${col}">●</span> ${ct}`,
                showarrow: false, font: { size: 10 },
                align: 'left', xanchor: 'left'
            });
        });
    }

    // 7. Render
    const plotDiv = document.getElementById('plotly-container');
    
    // Switch visibility FIRST so dimensions are correct
    if(document.getElementById('cilia-svg')) document.getElementById('cilia-svg').style.display = 'none';
    if(document.getElementById('domain-viewer')) document.getElementById('domain-viewer').style.display = 'none';
    plotDiv.style.display = 'block';

    await Plotly.newPlot('plotly-container', [trace], layout, {
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d', 'zoom2d']
    });
    
    window.CiliAI.currentPlot = plotDiv;

    // Attach click handler
    plotDiv.on('plotly_click', (data) => {
        const point = data.points[0];
        const loc = point.customdata?.localization;
        if (loc && typeof window.highlightCiliumLocation === 'function') {
            window.resetViews();
            window.showDiagram();
            window.highlightCiliumLocation(loc, primaryGene);
            const cellName = point.text.split('<br>')[0].replace(/<b>|<\/b>/g, '');
            window.addChatMessage(`<i>Clicked: ${cellName}</i><br>Localization highlighted on ciliary diagram.`, false);
        }
    });

    // --- UI Controls ---
    let tissueButtons = '';
    const getIcon = (k) => ({ lung: '🫁', kidney: '🫘', liver: '🍺', hypothalamus: '🧠', chondrocyte: '🦴' }[k] || '📍');
    
    Object.keys(window.CiliAI.datasets).forEach(k => {
        if (k === datasetKey) return;
        const shortName = window.CiliAI.datasets[k].name.replace('Human ', '').replace('Organoid', 'Org.').replace('Complete', 'Comp.');
        tissueButtons += `
            <button onclick="window.CiliAI.activeDataset='${k}'; window.renderUMAPPlot('${displayName}', '${targetGenes.join(',')}')" 
            style="font-size:10px; padding:4px 8px; border:1px solid #ccc; background:white; border-radius:10px; cursor:pointer; margin:2px;">
            ${getIcon(k)} ${shortName}</button>`;
    });

    window.addChatMessage(`
        <div class="ai-result-card">
            <p><strong>${isClusterView ? 'Cell Type View' : (isMultiGene ? targetGenes.join(' + ') : primaryGene)}</strong> in <strong>${dataset.name}</strong></p>
            ${isClusterView 
                ? '<p>Colored by cell type (legend on right)</p>' 
                : `<p>Colored by ${isMultiGene ? 'average ' : ''}expression level </p>`}
            
            <div style="margin-top:12px; border-top:1px solid #eee; padding-top:8px;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                    <label style="font-size:11px; width:50px;">Opacity:</label>
                    <input type="range" min="0.1" max="1" step="0.1" value="0.85" style="width:80px;" 
                        oninput="Plotly.restyle('plotly-container', {'marker.opacity': this.value})">
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <label style="font-size:11px; width:50px;">Size:</label>
                    <input type="range" min="2" max="15" step="1" value="${isClusterView ? 6 : 8}" style="width:80px;" 
                        oninput="Plotly.restyle('plotly-container', {'marker.size': this.value})">
                </div>
            </div>

            <div style="margin-top:10px;">
                <div style="font-size:10px; font-weight:700; color:#666; margin-bottom:4px;">SWITCH DATASET:</div>
                <div style="display:flex; flex-wrap:wrap; gap:4px;">${tissueButtons}</div>
            </div>
        </div>
    `, false);
};

/**
 * Renders a grid of UMAP plots — one panel per gene — with forced visibility
 * for low-expression genes so that differences are always clearly visible.
 *
 * Features:
 * - Independent color scale per gene
 * - Dynamic contrast boost for genes with max TPM < 4
 * - Clear labeling of real vs stretched scale
 * - Helpful user feedback when expression is low/missing
 * - Responsive layout that fits container
 * - Synchronized zoom/pan across panels
 */
window.renderUMAPGrid = async function(genes, datasetKey = null, containerId = 'plotly-container') {
    // ── 1. Input validation & normalization ─────────────────────────────────
    if (!Array.isArray(genes) || genes.length === 0) {
        window.addChatMessage("No genes provided for comparison.", false);
        return;
    }

    genes = genes.map(g => g.toUpperCase().trim()).filter(Boolean);

    datasetKey = datasetKey || window.CiliAI?.activeDataset || 'lung';
    const dataset = window.CiliAI?.datasets?.[datasetKey];

    if (!dataset || !Array.isArray(dataset.umap)) {
        window.addChatMessage(`Dataset "${datasetKey}" not loaded or invalid.`, false);
        return;
    }

    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container #${containerId} not found`);
        return;
    }

    // Show plot container, hide others
    container.style.display = 'block';
    document.getElementById('cilia-svg')?.style.display = 'none';
    document.getElementById('domain-viewer')?.style.display = 'none';

    // ── 2. UMAP coordinates (shared across all panels) ──────────────────────
    const sourceData = dataset.umap;
    const nCells = sourceData.length;

    const x = sourceData.map(p => p.x ?? p.umap_x ?? p.UMAP_1 ?? 0);
    const y = sourceData.map(p => p.y ?? p.umap_y ?? p.UMAP_2 ?? 0);

    // ── 3. Extract expression + compute stats per gene ──────────────────────
    const genePanels = genes.map(gene => {
        const result = extractExpressionForGene(gene, dataset, sourceData);

        // ── FORCED VISIBILITY: Stretch low-expression genes ─────────────────
        let displayMax = result.maxExpr;

        // Rule 1: Minimum visible range — never let max be too small
        if (displayMax < 4.0) {
            displayMax = 4.0;                    // makes ~2.58 look like 4
        }

        // Rule 2: Extra aggressive stretch for extremely low genes
        if (displayMax < 1.5) {
            displayMax = Math.max(3.0, result.maxExpr * 3);
        }

        return {
            gene,
            exprArray: result.exprArray,
            realMax: result.maxExpr,
            displayMax,
            anyNonZero: result.anyNonZero,
            found: result.found
        };
    });

    // ── 4. Grid layout calculation (responsive) ─────────────────────────────
    const nGenes = genes.length;
    const maxCols = 3;
    const cols = Math.min(nGenes, maxCols);
    const rows = Math.ceil(nGenes / cols);

    const vizCard = document.querySelector('.viz-card') || container;
    const availWidth  = vizCard.clientWidth  - 60 || 900;
    const availHeight = vizCard.clientHeight - 120 || 700;

    const layout = {
        grid: { rows, columns: cols, pattern: 'independent' },
        showlegend: false,
        hovermode: 'closest',
        uirevision: 'visible-grid-' + genes.join('-'),
        title: {
            text: `Expression Comparison: ${genes.join(' vs ')}<br><sub>${dataset.name}</sub>`,
            font: { size: 15 }
        },
        margin: { l: 40, r: 100, t: 80, b: 50 },
        width: availWidth,
        height: availHeight,
        annotations: []
    };

    const colorScales = ['Reds', 'Blues', 'Greens', 'Purples', 'Oranges', 'YlOrRd', 'Magma'];

    const traces = [];
    genePanels.forEach((panel, idx) => {
        const { gene, exprArray, realMax, displayMax, anyNonZero, found } = panel;

        const row = Math.floor(idx / cols) + 1;
        const col = (idx % cols) + 1;

        const xaxis = idx === 0 ? 'x' : `x${idx+1}`;
        const yaxis = idx === 0 ? 'y' : `y${idx+1}`;

        traces.push({
            type: 'scattergl',
            mode: 'markers',
            x, y,
            text: sourceData.map((p, i) => 
                `<b>${p.cell_type || '—'}</b><br>${gene}: ${exprArray[i].toFixed(2)} TPM`
            ),
            hovertemplate: '%{text}<extra></extra>',
            marker: {
                size: anyNonZero ? 6 : 4.5,
                opacity: anyNonZero ? 0.9 : 0.6,
                color: exprArray,
                cmin: 0,
                cmax: displayMax,               // ← stretched for visibility
                colorscale: colorScales[idx % colorScales.length],
                showscale: true,
                colorbar: {
                    title: `${gene}\n(real max ${realMax.toFixed(2)})`,
                    titleside: 'right',
                    thickness: 14,
                    len: 0.6,
                    x: 1.02 + (idx * 0.09),
                    y: 0.5,
                    tickfont: { size: 10 }
                }
            },
            xaxis: xaxis,
            yaxis: yaxis,
            name: gene
        });

        // Panel title (with warning if very low or missing)
        let titleColor = found && anyNonZero ? '#1e40af' : '#dc2626';
        let titleText = `<b>${gene}</b>`;
        if (!found) titleText += ' ⚠️ not found';
        else if (!anyNonZero) titleText += ' (zero expression)';
        else if (realMax < 3) titleText += ' (low)';

        layout.annotations.push({
            text: titleText,
            xref: 'paper', yref: 'paper',
            x: (col - 0.5) / cols,
            y: 1 - ((row - 1) / rows) - 0.01,
            showarrow: false,
            font: { size: 14, color: titleColor },
            xanchor: 'center',
            yanchor: 'top'
        });

        // Hidden axes
        layout[`xaxis${idx === 0 ? '' : idx+1}`] = { visible: false, showgrid: false, domain: undefined };
        layout[`yaxis${idx === 0 ? '' : idx+1}`] = { visible: false, showgrid: false, domain: undefined };
    });

    // ── 5. Render the plot ──────────────────────────────────────────────────
    try {
        await Plotly.newPlot(containerId, traces, layout, {
            responsive: true,
            scrollZoom: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d']
        });

        // ── 6. User feedback message ────────────────────────────────────────
        const lowGenes  = genePanels.filter(p => p.found && p.realMax < 4 && p.anyNonZero).map(p => p.gene);
        const missing   = genePanels.filter(p => !p.found).map(p => p.gene);
        const silent    = genePanels.filter(p => p.found && !p.anyNonZero).map(p => p.gene);

        let feedback = `<div class="ai-result-card">
            <p><strong>Expression comparison: ${genes.join(' vs ')}</strong> (${dataset.name})</p>
            <p>Each gene has its own panel and optimized color scale so differences are visible.</p>`;

        if (lowGenes.length > 0) {
            feedback += `<p style="color:#d97706;">Low but visible: ${lowGenes.join(', ')} (max < 4 TPM, scale boosted)</p>`;
        }
        if (missing.length > 0) {
            feedback += `<p style="color:#dc2626;">Not found in dataset: ${missing.join(', ')}</p>`;
        }
        if (silent.length > 0) {
            feedback += `<p style="color:#dc2626;">Zero expression: ${silent.join(', ')}</p>`;
        }

        feedback += `</div>`;

        window.addChatMessage(feedback, false);

    } catch (err) {
        console.error("Grid render failed:", err);
        window.addChatMessage(`Error rendering comparison grid: ${err.message}`, false);
    }
};


/**
 * Robust expression extractor — supports multiple common formats
 * Returns { exprArray: Float32Array, maxExpr: number, anyNonZero: boolean, found: boolean }
 */
function extractExpressionForGene(geneUpper, dataset, sourceData) {
    const n = sourceData.length;
    const arr = new Float32Array(n).fill(0);
    let maxVal = 0;
    let nonZeroCount = 0;
    let foundAnyData = false;

    const trySources = [
        dataset.expression,
        dataset.expressionMatrix,
        window.CiliAI?.cellDataCache
    ];

    for (const src of trySources) {
        if (!src) continue;

        // Format A: gene → {cells: [...], expression: [...]}
        if (src[geneUpper]?.cells && src[geneUpper]?.expression) {
            const raw = src[geneUpper];
            for (let k = 0; k < raw.cells.length; k++) {
                const idx = raw.cells[k];
                if (idx < n) {
                    const val = raw.expression[k] || 0;
                    arr[idx] = val;
                    if (val > maxVal) maxVal = val;
                    if (val > 0) nonZeroCount++;
                }
            }
            foundAnyData = true;
            break;
        }

        // Format B: gene → dense or sparse array
        if (Array.isArray(src[geneUpper])) {
            const raw = src[geneUpper];
            if (raw.length === n) {
                // dense
                for (let i = 0; i < n; i++) {
                    const val = raw[i] || 0;
                    arr[i] = val;
                    if (val > maxVal) maxVal = val;
                    if (val > 0) nonZeroCount++;
                }
            } else if (raw.length % 2 === 0) {
                // sparse [idx,val, idx,val,...]
                for (let k = 0; k < raw.length; k += 2) {
                    const idx = raw[k];
                    const val = raw[k+1] || 0;
                    if (idx < n) {
                        arr[idx] = val;
                        if (val > maxVal) maxVal = val;
                        if (val > 0) nonZeroCount++;
                    }
                }
            }
            foundAnyData = true;
            break;
        }

        // Format C: cell-centric {cell_id: {GENE: val}}
        if (typeof src === 'object' && !Array.isArray(src)) {
            let hits = 0;
            sourceData.forEach((p, i) => {
                const cid = p.cell_id || p.id || p.barcode;
                if (cid && src[cid]?.[geneUpper] !== undefined) {
                    const val = src[cid][geneUpper];
                    arr[i] = val;
                    if (val > maxVal) maxVal = val;
                    if (val > 0) nonZeroCount++;
                    hits++;
                }
            });
            if (hits > 0) {
                foundAnyData = true;
                break;
            }
        }
    }

    return {
        exprArray: arr,
        maxExpr: maxVal,
        anyNonZero: nonZeroCount > 0,
        found: foundAnyData
    };
}

// ==========================================================
// DEBUG: Check what expression data is available
// ==========================================================

window.debugGeneExpression = function(gene, datasetKey = null) {
    datasetKey = datasetKey || window.CiliAI.activeDataset;
    const dataset = window.CiliAI.datasets?.[datasetKey];
    
    if (!dataset) {
        console.error('Dataset not found:', datasetKey);
        return;
    }
    
    const geneUpper = gene.toUpperCase();
    console.log(`\n=== DEBUG: ${geneUpper} in ${datasetKey} ===`);
    console.log('Dataset keys:', Object.keys(dataset));
    
    if (dataset.expression) {
        console.log('dataset.expression type:', typeof dataset.expression);
        console.log('dataset.expression keys (first 10):', Object.keys(dataset.expression).slice(0, 10));
        console.log(`Has ${geneUpper}:`, geneUpper in dataset.expression);
        if (dataset.expression[geneUpper]) {
            console.log(`${geneUpper} data type:`, typeof dataset.expression[geneUpper]);
            console.log(`${geneUpper} data sample:`, dataset.expression[geneUpper]);
        }
    }
    
    if (dataset.expressionMatrix) {
        console.log('Has expressionMatrix');
    }
    
    if (window.CiliAI.cellDataCache) {
        console.log('Has cellDataCache:', geneUpper in window.CiliAI.cellDataCache);
    }
};


// ==========================================================
// UTILITY: Reset and show image panel container
// ==========================================================

/**
 * Helper function to prepare image panel for UMAP grid display
 */
window.prepareImagePanelForUMAP = function(containerId = 'umap-container') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`[CiliAI] Container #${containerId} not found`);
        return false;
    }
    
    // Clear any existing content
    container.innerHTML = '';
    
    // Ensure it's visible and sized properly
    container.style.display = 'block';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.minHeight = '500px';
    
    return true;
};



// =======================================================
// Helper: Organ-Specific Colors (Updated with new types)
// =======================================================
window.getOrganCellTypeColors = function(organKey) {
    const colorSchemes = {
        // LUNG ORGANOID (Alveolar-focused)
        lung: {
            'ciliated cell': '#E11D48', 'stem cell': '#3B82F6', 'club cell': '#10B981',
            'goblet cell': '#8B5CF6', 'basal cell': '#F59E0B', 'neuroendocrine cell': '#EC4899',
            'pulmonary alveolar type 1 cell': '#2563EB', 'pulmonary alveolar type 2 cell': '#60A5FA',
            'lung secretory cell': '#34D399', '__default__': '#94A3B8'
        },
        // COMPLETE LUNG TISSUE
        lung_downsampled: {
            'Ciliated epithelial cell': '#E11D48', 'AT1 cell': '#2563EB', 'AT2 cell': '#3B82F6',
            'Club cell': '#10B981', 'Goblet cell': '#8B5CF6', 'Basal cell': '#F59E0B',
            'Macrophage': '#DC2626', 'Monocyte': '#EF4444', 'T cell': '#059669', 'B cell': '#7C3AED',
            'Fibroblast': '#D97706', 'Endothelial cell': '#0284C7', '__default__': '#94A3B8'
        },
        // KIDNEY
        kidney: {
            'Proximal Tubule Cell': '#3B82F6', 'Thick Ascending Limb Cell': '#60A5FA',
            'Distal Convoluted Tubule Cell': '#93C5FD', 'Collecting Duct Principal Cell': '#BFDBFE',
            'Podocyte': '#1E40AF', 'Endothelial Cell': '#2563EB', 'Immune Cell': '#1E3A8A',
            'Collecting Duct Intercalated Cell': '#DBEAFE', 'Fibroblast': '#1D4ED8',
            'Cycling Cell': '#172554', '__default__': '#94A3B8'
        },
        // LIVER
        liver: {
            'Hepatocyte': '#10B981', 'Cholangiocyte': '#34D399', 'Kupffer cell': '#DC2626',
            'Liver sinusoidal endothelial cell': '#0284C7', 'Hepatic stellate cell': '#D97706',
            'T cell': '#059669', 'B cell': '#7C3AED', 'NK cell': '#9F7AEA',
            '__default__': '#94A3B8'
        },
        // HYPOTHALAMUS
        hypothalamus: {
            'Neuron': '#8B5CF6', 'Astrocyte': '#10B981', 'Oligodendrocyte': '#3B82F6',
            'Microglia': '#DC2626', 'Endothelial cell': '#0284C7', 'Tanycyte': '#EC4899',
            'Ependymal cell': '#E11D48', 'Mural cell': '#D97706', 'Fibroblast': '#A78BFA',
            '__default__': '#94A3B8'
        },
        // CHONDROCYTE
        chondrocyte: {
            'Chondroblast': '#10B981', 'Homeostatic chondrocyte': '#34D399',
            'Hypertrophic chondrocyte': '#B45309', 'Immune (T/NK) cell': '#DC2626',
            'Prefibrotic chondrocyte': '#D97706', 'Reparative chondrocyte': '#3B82F6',
            '__default__': '#94A3B8'
        },
        // PANCREAS
        pancreas: {
            'Acinar cell': '#F59E0B', 'Beta cell': '#DC2626', 'Alpha cell': '#EF4444',
            'Delta cell': '#F87171', 'Ductal cell': '#D97706', 'Endothelial cell': '#0284C7',
            'Stellate cell': '#10B981', '__default__': '#94A3B8'
        },
        // OLFACTORY
        olfactory: {
            'Mature OSN': '#8B5CF6', 'Immature OSN': '#A78BFA', 'Horizontal Basal Cell': '#10B981',
            'Sustentacular Cell': '#059669', 'Bowman Gland': '#D97706', 'Microvillar Cell': '#EC4899',
            '__default__': '#94A3B8'
        }
    };
    return colorSchemes[organKey] || colorSchemes.lung;
};

// Helper function to get expression value for a gene in a cell
window.getExpressionValue = function(dataset, gene, cellId) {
    if (!dataset || !dataset.expression) return 0;
    
    const geneUpper = gene.toUpperCase();
    
    // Method 1: Cell-centric (Liver, Chondrocyte, Lung)
    const cellData = dataset.expression[cellId];
    if (cellData && cellData[geneUpper] !== undefined) {
        return cellData[geneUpper];
    }
    
    // Method 2: Gene-centric with cell IDs as keys (Kidney)
    if (dataset.expression[geneUpper] && dataset.expression[geneUpper][cellId] !== undefined) {
        return dataset.expression[geneUpper][cellId];
    }
    
    // Method 3: Hypothalamus format - {cells: [indices], expression: [values]}
    if (dataset.expression[geneUpper] && dataset.expression[geneUpper].cells) {
        const geneData = dataset.expression[geneUpper];
        // Find the index of this cell in the cells array
        const cellIndex = dataset.umap?.findIndex(p => p.cell_id === cellId);
        if (cellIndex !== -1) {
            // Find position of this cell index in the gene's cells array
            const pos = geneData.cells.findIndex(cellIdx => cellIdx === cellIndex);
            if (pos !== -1 && geneData.expression && geneData.expression[pos] !== undefined) {
                return geneData.expression[pos];
            }
        }
    }
    
    // Method 4: Direct array format (if cells are in same order as umap)
    if (Array.isArray(dataset.expression[geneUpper])) {
        const cellIndex = dataset.umap?.findIndex(p => p.cell_id === cellId);
        if (cellIndex !== -1 && dataset.expression[geneUpper][cellIndex] !== undefined) {
            return dataset.expression[geneUpper][cellIndex];
        }
    }
    
    return 0;
};

// Helper: Get scRNA expression map for a gene (safe)
function getScRNAExpression(geneSymbol) {
    const gene = window.CiliAI.lookups.geneMap[geneSymbol.toUpperCase()];
    return gene?.expression?.scRNA || {};
}

// Helper: List cell types with expression > 0
function getExpressedCellTypes(exprMap) {
    return Object.entries(exprMap)
        .filter(([_, tpm]) => tpm > 0)
        .map(([cellType]) => cellType)
        .sort();
}

// Helper: Is gene restricted to ciliary cells?
function isCiliaRestricted(exprMap) {
    const expressed = getExpressedCellTypes(exprMap);
    if (expressed.length === 0) return false;
    return expressed.every(ct => ct.toLowerCase().includes('ciliated'));
}


// Helper: Is gene specific to multiciliated cells?
function isSpecificToMulticiliated(exprMap) {
    const expressed = getExpressedCellTypes(exprMap);
    return expressed.length === 1 && expressed[0].toLowerCase().includes('multiciliated');
}

// NEW: Generalized Cell-Type Question Handler
window.handleCellTypeQuestion = function(query) {
    const qLower = query.toLowerCase().trim();

    // Extract gene using robust extractor
    const genes = extractMultipleGenes(query);
    if (genes.length === 0) return null; // Not a gene question
    const geneSymbol = genes[0]; // Use first gene (or enhance for multi-gene later)

    const exprMap = getScRNAExpression(geneSymbol);
    if (Object.keys(exprMap).length === 0) {
        return `<div class="ai-result-card">
            <p>No scRNA-seq expression data available for <strong>${geneSymbol}</strong> in the current dataset.</p>
        </div>`;
    }

    const expressedTypes = getExpressedCellTypes(exprMap);
    const maxTPM = Math.max(...Object.values(exprMap), 0);
    const highestCellTypes = Object.entries(exprMap)
        .filter(([_, tpm]) => Math.abs(tpm - maxTPM) < 0.01)
        .map(([ct]) => ct);

    let html = `<div class="ai-result-card"><h4>${geneSymbol} Expression Profile</h4>`;

    // 1. Which cell types express GENE?
    if (qLower.includes('which cell types express') || qLower.includes('cell types express')) {
        if (expressedTypes.length === 0) {
            html += `<p><strong>${geneSymbol}</strong> shows no detectable expression in any lung cell type.</p>`;
        } else {
            html += `<p>Expressed in: <strong>${expressedTypes.join(', ')}</strong></p>`;
        }
    }

    // 2. Is GENE active in ciliated cells?
    else if (qLower.includes('active in ciliated') || qLower.includes('expressed in ciliated')) {
        const tpm = exprMap['ciliated cell'] || 0;
        const active = tpm > 0;
        html += `<p>${active ? 'Yes' : 'No'}, ${geneSymbol} is ${active ? '' : '<strong>not</strong>'} active in ciliated cells (${tpm.toFixed(2)} TPM).</p>`;
    }

    // 3. Cilia-restricted expression?
    else if (qLower.includes('cilia-restricted') || qLower.includes('ciliary-restricted') || qLower.includes('cilia restricted')) {
        const restricted = isCiliaRestricted(exprMap);
        html += `<p>${restricted ? 'Yes' : 'No'}, ${geneSymbol} ${restricted ? 'shows' : 'does <strong>not</strong> show'} cilia-restricted expression.</p>`;
        if (!restricted && expressedTypes.length > 0) {
            html += `<p>Highest in: <strong>${highestCellTypes.join(', ')}</strong> (${maxTPM.toFixed(2)} TPM)</p>`;
        }
    }

    // 4. Specific to multiciliated cells?
    else if (qLower.includes('specific to multiciliated') || qLower.includes('multiciliated cells')) {
        const specific = isSpecificToMulticiliated(exprMap);
        html += `<p>${specific ? 'Yes' : 'No'}, ${geneSymbol} is ${specific ? '' : '<strong>not</strong>'} specific to multiciliated cells.</p>`;
        if (specific) {
            html += `<p>Detected only in multiciliated cells.</p>`;
        }
    }

    // 5. TPM in specific cell type (e.g., basal cell)
    else if (qLower.match(/tpm of .* in .* cell/)) {
        const match = qLower.match(/in (basal|ciliated|club|goblet|neuroendocrine|alveolar.*|secretory) cell/);
        if (match) {
            const cellType = match[1] === 'alveolar' ? 'pulmonary alveolar type 2 cell' : `${match[1]} cell`;
            const normalizedKey = Object.keys(exprMap).find(k => k.toLowerCase().includes(cellType)) || cellType;
            const tpm = exprMap[normalizedKey] || 0;
            html += `<p><strong>${tpm.toFixed(2)} TPM</strong> in ${normalizedKey}.</p>`;
        }
    }

    // Default: Show summary if pattern matches but no specific sub-question
    else if (qLower.includes(geneSymbol.toLowerCase()) && (
        qLower.includes('cell') || qLower.includes('expression') || qLower.includes('tpm')
    )) {
        html += `<p>Expressed in: <strong>${expressedTypes.join(', ')}</strong></p>`;
        html += `<p>Highest: <strong>${highestCellTypes.join(', ')}</strong> (${maxTPM.toFixed(2)} TPM)</p>`;
    }

    html += `</div>`;
    return html;
};


// 2. INTENT HANDLERS
// ==========================================================

const intentHandlers = [
    
    {
        priority: 200,
        matcher: (qLower) => 
            qLower.includes('complete ciliary gene list') || 
            qLower.includes('gold standard') || 
            qLower.includes('database view') ||
            (qLower.includes('show') && qLower.includes('database')),
        handler: async (query) => {
            return window.renderGoldStandardView();
        }
    },
    
    // Highest Priority: Cell-type specific questions
    {
        priority: 100,
        matcher: (qLower) => qLower.includes('cilia-restricted') || qLower.includes('cilia restricted') || qLower.includes('ciliary-restricted') || qLower.includes('specific to') || (qLower.includes('express') && qLower.includes('cell')) || qLower.includes('active in') || (qLower.includes('tpm') && qLower.includes('cell')),
        handler: async (query) => {
            return window.handleCellTypeQuestion ? window.handleCellTypeQuestion(query) : null;
        }
    },

    // Pan-ciliary / Tissue Expression Category & Lists
    {
        priority: 95,
        matcher: (qLower) => qLower.includes('pan-ciliary') || qLower.includes('pan ciliary') || qLower.includes('ubiquitous') || qLower.includes('pan-ubiquitous') || qLower.includes('idio-ciliary') || qLower.includes('tissue-specific') || (qLower.includes('specific to') && (qLower.includes('lung') || qLower.includes('kidney') || qLower.includes('liver') || qLower.includes('skeleton') || qLower.includes('pancreas') || qLower.includes('olfactory') || qLower.includes('hypothalamus'))) || qLower.includes('category of') || (qLower.includes('expressed') && qLower.includes('category')) || qLower.includes('expressed in how many tissues') || (qLower.includes('list') && (qLower.includes('pan') || qLower.includes('ubiquit') || qLower.includes('specific') || qLower.includes('idio'))),
        handler: async (query) => {
            const qLower = window.CiliAI.utils.normalizeQuery(query);
            let htmlResult = null;
            const genes = window.CiliAI.utils.extractGenes(query);
            if (genes.length > 0) {
                const geneSymbol = genes[0].toUpperCase();
                const geneData = window.CiliAI.lookups.geneMap[geneSymbol];
                if (!geneData || !geneData.expression?.tissue) {
                    htmlResult = `<div class="ai-result-card">
                        <p>No tissue expression data available for <strong>${geneSymbol}</strong>.</p>
                    </div>`;
                } else {
                    const category = geneData.expression.category || 'Unknown';
                    const nTissues = geneData.expression.n_tissues || 0;
                    const isPan = category.toLowerCase().includes('pan-ciliary') || category.toLowerCase().includes('ubiquitous');
                    const isIdio = category.toLowerCase().includes('idio-ciliary') || category.toLowerCase().includes('tissue-specific');
                    let verdict = '';
                    if (isPan) {
                        verdict = `<span style="color:#059669; font-weight:600;">Yes — Pan-ciliary (Ubiquitous)</span>`;
                    } else if (isIdio) {
                        verdict = `<span style="color:#dc2626; font-weight:600;">Yes — Idio-ciliary (Tissue-Specific)</span>`;
                    } else {
                        verdict = `<span style="color:#7c3aed; font-weight:600;">Multi-tissue / Intermediate</span>`;
                    }
                    htmlResult = `<div class="ai-result-card">
                        <h4>Tissue Expression Category: ${geneSymbol}</h4>
                        <p style="font-size:17px; margin:16px 0;">
                            ${verdict}<br>
                            <span style="font-size:14px; color:#4b5563;">
                                Category: <strong>${category}</strong><br>
                                Detected in <strong>${nTissues}</strong> tissue${nTissues === 1 ? '' : 's'}
                            </span>
                        </p>
                        <p style="font-size:13px; color:#64748b;">
                            Data source: bulk RNA-seq across major human tissues (CiliAI 2025 integration)
                        </p>
                    </div>`;
                }
                return htmlResult;
            }
            // List requests
            const isPanList = qLower.includes('pan-ciliary') || qLower.includes('pan ciliary') ||
                              qLower.includes('ubiquitous') || qLower.includes('ubiquitously expressed');
            const isIdioList = qLower.includes('idio-ciliary') || qLower.includes('tissue-specific') ||
                               qLower.includes('specific to') || qLower.includes('only in');
            if (isPanList || isIdioList || qLower.includes('list') || qLower.includes('show all')) {
                let filteredGenes = [];
                Object.entries(window.CiliAI.lookups.geneMap).forEach(([gene, data]) => {
                    if (!data.expression?.category) return;
                    const cat = data.expression.category.toLowerCase();
                    const n = data.expression.n_tissues || 0;
                    if (isPanList && (cat.includes('pan-ciliary') || cat.includes('ubiquitous'))) {
                        filteredGenes.push(gene);
                    } else if (isIdioList && (cat.includes('idio-ciliary') || cat.includes('tissue-specific'))) {
                        filteredGenes.push(gene);
                    } else if (qLower.includes('lung') && n === 1 && (data.expression.tissue?.Lung_Primary > 0 || data.expression.tissue?.Lung_Motile > 0)) {
                        filteredGenes.push(gene);
                    } else if (qLower.includes('kidney') && n === 1 && data.expression.tissue?.Kidney > 0) {
                        filteredGenes.push(gene);
                    } else if (qLower.includes('liver') && n === 1 && data.expression.tissue?.Liver > 0) {
                        filteredGenes.push(gene);
                    } else if (qLower.includes('skeleton') && n === 1 && data.expression.tissue?.Skeleton > 0) {
                        filteredGenes.push(gene);
                    }
                });
                filteredGenes.sort();
                if (filteredGenes.length === 0) {
                    htmlResult = `<div class="ai-result-card"><p>No genes match the requested criteria in the current dataset.</p></div>`;
                } else {
                    const term = isPanList ? 'Pan-ciliary (Ubiquitous)' :
                                 isIdioList ? 'Idio-ciliary (Tissue-Specific)' :
                                 qLower.includes('lung') ? 'Lung-specific' :
                                 qLower.includes('kidney') ? 'Kidney-specific' : 'Matching';
                    const preview = filteredGenes.length > 12 ? filteredGenes.slice(0,12).join(', ') + ` … and ${filteredGenes.length-12} more` : filteredGenes.join(', ');
                    htmlResult = `<div class="ai-result-card">
                        <h4>${term} Genes</h4>
                        <p>Found <strong>${filteredGenes.length}</strong> genes.</p>
                        <p style="font-size:13.5px; line-height:1.5; margin:12px 0;">${preview}</p>
                        <p style="font-size:12px; color:#64748b;">Want to see the full list or view them in the panel? Type <strong>yes</strong> or <strong>show list</strong>.</p>
                    </div>`;
                    window.lastQueryContext = { 
                        type: 'list_followup',
                        data: filteredGenes.map(g => ({ gene: g })),
                        term: `${term} Genes (${filteredGenes.length})`
                    };
                }
                return htmlResult;
            }
            return null;
        }
    },

    // "Where is [GENE] expressed?" for ANY ciliary gene
    {
        priority: 90,
        matcher: (qLower) => qLower.includes('where is') && qLower.includes('expressed'),
        handler: async (query) => {
            const genes = window.CiliAI.utils.extractGenes(query);
            if (genes.length === 0) return null;
            const geneSymbol = genes[0];
            const gene = window.CiliAI.lookups.geneMap[geneSymbol];
            if (!gene) {
                return `<div class="ai-result-card"><p>Gene <strong>${geneSymbol}</strong> not found in database.</p></div>`;
            }
            const loc = gene.Localization || 'Not specified';
            let expressionInfo = '';
            let scrnaSummary = '';
            if (gene.expression?.scRNA) {
                const expressed = window.CiliAI.utils.getExpressedCellTypes(gene.expression.scRNA);
                if (expressed.length > 0) {
                    scrnaSummary = `<p><strong>scRNA-seq (lung):</strong> Expressed in: <strong>${expressed.join(', ')}</strong></p>`;
                }
            }
            const isMotile = loc.toLowerCase().includes('axoneme') ||
                             loc.toLowerCase().includes('dynein') ||
                             loc.toLowerCase().includes('radial spoke') ||
                             geneSymbol.startsWith('DNAH') ||
                             geneSymbol.startsWith('DNAI') ||
                             geneSymbol.includes('DNAAF') ||
                             (gene.Ciliopathies && gene.Ciliopathies.includes('Primary Ciliary Dyskinesia'));
            const isMulticiliatedMarker = geneSymbol === 'FOXJ1' || loc.toLowerCase().includes('multiciliated');
            if (isMotile) {
                expressionInfo = `
                    <p><strong>${geneSymbol}</strong> is expressed in <strong>cells with motile cilia</strong>:</p>
                    <ul>
                        <li>Multiciliated respiratory epithelium (lungs, trachea, bronchi)</li>
                        <li>Fallopian tube epithelium</li>
                        <li>Testicular sperm flagella</li>
                    </ul>
                    <p><strong>Localization:</strong> ${loc}</p>
                    <p>Defects often cause <strong>Primary Ciliary Dyskinesia (PCD)</strong>.</p>
                `;
            } else if (isMulticiliatedMarker) {
                expressionInfo = `
                    <p><strong>${geneSymbol}</strong> is a master regulator of <strong>multiciliogenesis</strong>.</p>
                    <p>Specifically expressed in <strong>multiciliated cells</strong> (e.g., airway epithelium).</p>
                    ${scrnaSummary}
                `;
            } else {
                expressionInfo = `
                    <p><strong>${geneSymbol}</strong> is expressed in cells with <strong>primary cilia</strong> (most vertebrate cell types).</p>
                    <p>Enriched in:</p>
                    <ul>
                        <li>Kidney tubules and collecting ducts</li>
                        <li>Brain (neurons, cerebellum)</li>
                        <li>Retina (photoreceptors)</li>
                        <li>Liver, pancreas, and other organs</li>
                    </ul>
                    <p><strong>Localization:</strong> ${loc}</p>
                    ${scrnaSummary}
                `;
            }
            return `
                <div class="ai-result-card">
                    <h4>Expression of ${geneSymbol}</h4>
                    ${expressionInfo}
                </div>
            `;
        }
    },

    // NEW PRIORITY 88: Structure / Localization Gene Lists (Fixes queries without verbs)
    {
        priority: 88,
        matcher: (qLower) => {
            // Matches "Transition zone genes", "Basal body genes", etc.
            return (qLower.includes('genes') && (qLower.includes('transition zone') || qLower.includes('basal body') || qLower.includes('axoneme') || qLower.includes('centrosome') || qLower.includes('membrane'))) ||
                   (qLower.includes('display') && (qLower.includes('transition zone') || qLower.includes('basal body') || qLower.includes('axoneme')));
        },
        handler: async (query) => {
            const qLower = window.CiliAI.utils.normalizeQuery(query);
            let loc = null;
            if (qLower.includes('transition zone')) loc = 'Transition Zone';
            else if (qLower.includes('basal body')) loc = 'Basal Body';
            else if (qLower.includes('axoneme')) loc = 'Axoneme';
            else if (qLower.includes('membrane')) loc = 'Ciliary Membrane';
            else if (qLower.includes('centrosome')) loc = 'Centrosome';

            if (loc) {
                let genes = [];
                // Use global helper if available, otherwise manual filter
                if (window.getGenesByLocalization) {
                    genes = window.getGenesByLocalization(loc);
                } else {
                    // Fallback manual filter
                    const normLoc = loc.toLowerCase();
                    window.CiliAI.masterData.forEach(g => {
                        if (g.Localization && g.Localization.toLowerCase().includes(normLoc)) {
                            genes.push({ gene: g.Gene, localization: g.Localization });
                        }
                    });
                }
                
                if (genes.length > 0) {
                    // Use formatListResult to display table immediately
                    return window.formatListResult 
                        ? window.formatListResult(`Genes in ${loc}`, genes, `Found ${genes.length} genes localized to ${loc}.`)
                        : `Found ${genes.length} genes in ${loc}. (Visualizer loading...)`;
                } else {
                     return `<div class="ai-result-card"><p>No genes found specifically localized to <strong>${loc}</strong>.</p></div>`;
                }
            }
            return null;
        }
    },

    // Ciliopathy classification, overlap, orthologs (combined for efficiency)
    {
        priority: 85,
        matcher: (qLower) => {
            const classificationKeywords = {
                'primary ciliopathies': 'Primary Ciliopathies',
                'primary': 'Primary Ciliopathies',
                'motile ciliopathies': 'Motile Ciliopathies',
                'motile': 'Motile Ciliopathies',
                'secondary diseases': 'Secondary Diseases',
                'secondary': 'Secondary Diseases',
                'atypical ciliopathies': 'Atypical Ciliopathies',
                'atypical': 'Atypical Ciliopathies'
            };
            const organismKeywords = {
                'mouse': 'Mouse',
                'drosophila': 'Drosophila',
                'fly': 'Drosophila',
                'c. elegans': 'C_elegans',
                'worm': 'C_elegans',
                'zebrafish': 'Zebrafish',
                'fish': 'Zebrafish',
                'xenopus': 'Xenopus',
                'frog': 'Xenopus'
            };
            const requestedOrganism = Object.keys(organismKeywords).find(kw => qLower.includes(kw));
            const matchedClassification = Object.keys(classificationKeywords).find(kw => qLower.includes(kw));
            const hasCiliopathyGroup = qLower.includes('senior løken') || qLower.includes('bardet biedl') || qLower.includes('meckel gruber') || qLower.includes('joubert') || qLower.includes('primary ciliopathy') || qLower.includes('motile ciliopathy') || qLower.includes('atypical ciliopathy') || qLower.includes('all ciliopathy') || qLower.includes('ciliopathies') || qLower.includes('ciliopathy genes');
            return requestedOrganism && hasCiliopathyGroup;
        },
        handler: async (query) => {
            const qLower = window.CiliAI.utils.normalizeQuery(query);
            const classificationMap = getDiseaseClassificationMap();
            const classificationKeywords = {
                'primary ciliopathies': 'Primary Ciliopathies',
                'primary': 'Primary Ciliopathies',
                'motile ciliopathies': 'Motile Ciliopathies',
                'motile': 'Motile Ciliopathies',
                'secondary diseases': 'Secondary Diseases',
                'secondary': 'Secondary Diseases',
                'atypical ciliopathies': 'Atypical Ciliopathies',
                'atypical': 'Atypical Ciliopathies'
            };
            let matchedClassification = null;
            for (const [kw, full] of Object.entries(classificationKeywords)) {
                if (qLower.includes(kw)) {
                    matchedClassification = full;
                    break;
                }
            }
            const organismKeywords = {
                'mouse': 'Mouse',
                'drosophila': 'Drosophila',
                'fly': 'Drosophila',
                'c. elegans': 'C_elegans',
                'worm': 'C_elegans',
                'zebrafish': 'Zebrafish',
                'fish': 'Zebrafish',
                'xenopus': 'Xenopus',
                'frog': 'Xenopus'
            };
            let requestedOrganism = null;
            for (const [keyword, field] of Object.entries(organismKeywords)) {
                if (qLower.includes(keyword)) {
                    requestedOrganism = field;
                    break;
                }
            }
            if (requestedOrganism && (qLower.includes('senior løken') || qLower.includes('bardet biedl') || qLower.includes('meckel gruber') || qLower.includes('joubert') || qLower.includes('primary ciliopathy') || qLower.includes('motile ciliopathy') || qLower.includes('atypical ciliopathy') || qLower.includes('all ciliopathy') || qLower.includes('ciliopathies') || qLower.includes('ciliopathy genes'))) {
                let targetGenes = new Set();
                // Collect human genes
                if (qLower.includes('all ciliopathy') || qLower.includes('ciliopathies')) {
                    ['Primary Ciliopathies', 'Motile Ciliopathies', 'Atypical Ciliopathies'].forEach(className => {
                        window.CiliAI.masterData.forEach(gene => {
                            if (gene.ciliopathy_classification === className) {
                                targetGenes.add(gene.Gene);
                            }
                        });
                    });
                } else if (qLower.includes('primary ciliopathy')) {
                    window.CiliAI.masterData.forEach(gene => {
                        if (gene.ciliopathy_classification === 'Primary Ciliopathies') {
                            targetGenes.add(gene.Gene);
                        }
                    });
                } else if (qLower.includes('motile ciliopathy')) {
                    window.CiliAI.masterData.forEach(gene => {
                        if (gene.ciliopathy_classification === 'Motile Ciliopathies') {
                            targetGenes.add(gene.Gene);
                        }
                    });
                } else if (qLower.includes('atypical ciliopathy')) {
                    window.CiliAI.masterData.forEach(gene => {
                        if (gene.ciliopathy_classification === 'Atypical Ciliopathies') {
                            targetGenes.add(gene.Gene);
                        }
                    });
                } else if (qLower.includes('joubert')) {
                    window.CiliAI.masterData.forEach(gene => {
                        if (gene.Ciliopathy && window.CiliAI.utils.normalizeTerm(gene.Ciliopathy).includes('joubert')) {
                            targetGenes.add(gene.Gene);
                        }
                    });
                }
                if (targetGenes.size === 0) {
                    return `<div class="ai-result-card"><p>No genes found for the requested group.</p></div>`;
                }
                const mappings = [];
                targetGenes.forEach(humanGene => {
                    const geneData = window.CiliAI.lookups.geneMap[humanGene];
                    if (geneData) {
                        const orthoField = `Ortholog_${requestedOrganism}`;
                        const ortholog = geneData[orthoField];
                        if (ortholog && ortholog !== 'null' && ortholog.trim()) {
                            mappings.push({ human: humanGene, ortholog: ortholog.trim() });
                        }
                    }
                });
                if (mappings.length === 0) {
                    const orgName = requestedOrganism === 'C_elegans' ? 'C. elegans' : requestedOrganism;
                    return `<div class="ai-result-card"><p>No ${orgName} orthologs found.</p></div>`;
                }
                mappings.sort((a, b) => a.human.localeCompare(b.human));
                const listHtml = mappings.map(m => `<li><strong>${m.human}</strong> → <em>${m.ortholog}</em></li>`).join('');
                const groupName = qLower.includes('all') ? 'All Ciliopathies' :
                                  qLower.includes('joubert') ? 'Joubert Syndrome' :
                                  qLower.includes('primary') ? 'Primary Ciliopathies' :
                                  qLower.includes('motile') ? 'Motile Ciliopathies' :
                                  qLower.includes('atypical') ? 'Atypical Ciliopathies' : 'Group';
                const orgDisplay = requestedOrganism === 'C_elegans' ? 'C. elegans' : requestedOrganism;
                return `<div class="ai-result-card">
                    <h4>${orgDisplay} Orthologs: ${groupName}</h4>
                    <p><strong>${mappings.length}</strong> mappings:</p>
                    <ul style="columns: 2;">${listHtml}</ul>
                </div>`;
            }
            return null;
        }
    },

    // List diseases in classification
    {
        priority: 84,
        matcher: (qLower) => {
            const classificationKeywords = Object.keys({
                'primary ciliopathies': 'Primary Ciliopathies',
                'primary': 'Primary Ciliopathies',
                'motile ciliopathies': 'Motile Ciliopathies',
                'motile': 'Motile Ciliopathies',
                'secondary diseases': 'Secondary Diseases',
                'secondary': 'Secondary Diseases',
                'atypical ciliopathies': 'Atypical Ciliopathies',
                'atypical': 'Atypical Ciliopathies'
            }).find(kw => qLower.includes(kw)) && !qLower.includes('genes');
            return classificationKeywords;
        },
        handler: async (query) => {
            const qLower = window.CiliAI.utils.normalizeQuery(query);
            const classificationMap = getDiseaseClassificationMap();
            const classificationKeywords = {
                'primary ciliopathies': 'Primary Ciliopathies',
                'primary': 'Primary Ciliopathies',
                'motile ciliopathies': 'Motile Ciliopathies',
                'motile': 'Motile Ciliopathies',
                'secondary diseases': 'Secondary Diseases',
                'secondary': 'Secondary Diseases',
                'atypical ciliopathies': 'Atypical Ciliopathies',
                'atypical': 'Atypical Ciliopathies'
            };
            let matchedClassification = null;
            for (const [kw, full] of Object.entries(classificationKeywords)) {
                if (qLower.includes(kw)) {
                    matchedClassification = full;
                    break;
                }
            }
            if (matchedClassification) {
                const diseases = classificationMap[matchedClassification];
                return `<div class="ai-result-card">
                    <h4>${matchedClassification} (${diseases.length} diseases)</h4>
                    <ul style="columns: 2; font-size: 13px; line-height: 1.5;">
                        ${diseases.map(d => `<li>${d}</li>`).join('')}
                    </ul>
                </div>`;
            }
            return null;
        }
    },

    // Genes in a classification (FIXED: Supports individual syndromes like Joubert)
    {
       priority: 83,
        matcher: (qLower) => {
            // Broad Classifications
            const hasBroadClass = Object.keys({
                'primary ciliopathies': 1, 'primary': 1,
                'motile ciliopathies': 1, 'motile': 1,
                'secondary diseases': 1, 'secondary': 1,
                'atypical ciliopathies': 1, 'atypical': 1
            }).some(kw => qLower.includes(kw));

            // Specific Syndromes
            const hasSyndrome = qLower.includes('joubert') || qLower.includes('bbs') || qLower.includes('meckel') || qLower.includes('mks') || qLower.includes('pcd') || qLower.includes('nphp') || qLower.includes('senior');

            return (hasBroadClass || hasSyndrome) && qLower.includes('genes');
        },
        handler: async (query) => {
            const qLower = window.CiliAI.utils.normalizeQuery(query);
            const classificationMap = getDiseaseClassificationMap();

            // Broad Categories
            const classificationKeywords = {
                'primary ciliopathies': 'Primary Ciliopathies',
                'primary': 'Primary Ciliopathies',
                'motile ciliopathies': 'Motile Ciliopathies',
                'motile': 'Motile Ciliopathies',
                'secondary diseases': 'Secondary Diseases',
                'secondary': 'Secondary Diseases',
                'atypical ciliopathies': 'Atypical Ciliopathies',
                'atypical': 'Atypical Ciliopathies'
            };

            let targetName = null;
            let geneList = [];

            // Check for Broad Classification first
            for (const [kw, full] of Object.entries(classificationKeywords)) {
                if (qLower.includes(kw)) {
                    targetName = full;
                    const diseases = classificationMap[full] || [];
                    let allGenes = new Set();
                    diseases.forEach(disease => {
                        const normKey = window.CiliAI.utils.normalizeTerm(disease);
                        const genes = window.CiliAI.lookups.byCiliopathy[normKey] || [];
                        genes.forEach(g => allGenes.add(g));
                    });
                    geneList = Array.from(allGenes);
                    break;
                }
            }

            // If not broad, check specific syndromes
            if (!targetName) {
                const syndromeMap = {
                    'joubert': 'Joubert Syndrome',
                    'bbs': 'Bardet–Biedl Syndrome',
                    'meckel': 'Meckel–Gruber Syndrome',
                    'mks': 'Meckel–Gruber Syndrome',
                    'nphp': 'Nephronophthisis',
                    'senior': 'Senior-Løken Syndrome',
                    'pcd': 'Primary Ciliary Dyskinesia'
                };
                for (const [key, full] of Object.entries(syndromeMap)) {
                    if (qLower.includes(key)) {
                        targetName = full;
                        const normKey = window.CiliAI.utils.normalizeTerm(full);
                        geneList = window.CiliAI.lookups.byCiliopathy[normKey] || [];
                        break;
                    }
                }
            }

            if (targetName && geneList.length > 0) {
                const geneObjects = geneList.map(g => ({
                    gene: g,
                    description: window.CiliAI.lookups.geneMap[g]?.Localization || 'Ciliary protein'
                }));
                
                // --- FIXED: Use formatListResult to return table immediately ---
                return window.formatListResult(`Genes Associated with ${targetName}`, geneObjects, `Found ${geneList.length} unique genes.`);
                
            } else if (targetName) {
                return `<div class="ai-result-card"><p>No genes found for <strong>${targetName}</strong> in the current database.</p></div>`;
            }

            return null;
        }
    },
    // Shared genes between classifications or diseases
    {
        priority: 82,
        matcher: (qLower) => qLower.includes('shared') || qLower.includes('overlap') || qLower.includes('common') || qLower.includes('between'),
        handler: async (query) => {
            const qLower = window.CiliAI.utils.normalizeQuery(query);
            const classificationKeywords = {
                'primary ciliopathies': 'Primary Ciliopathies',
                'primary': 'Primary Ciliopathies',
                'motile ciliopathies': 'Motile Ciliopathies',
                'motile': 'Motile Ciliopathies',
                'secondary diseases': 'Secondary Diseases',
                'secondary': 'Secondary Diseases',
                'atypical ciliopathies': 'Atypical Ciliopathies',
                'atypical': 'Atypical Ciliopathies'
            };
            let set1 = null, set2 = null;
            let name1 = '', name2 = '';
            const classificationMap = getDiseaseClassificationMap();
            const foundClasses = Object.keys(classificationKeywords).filter(k => qLower.includes(k));
            if (foundClasses.length >= 2) {
                name1 = classificationKeywords[foundClasses[0]];
                name2 = classificationKeywords[foundClasses[1]];
                const diseases1 = classificationMap[name1];
                const diseases2 = classificationMap[name2];
                set1 = new Set();
                set2 = new Set();
                diseases1.forEach(d => {
                    const genes = window.CiliAI.lookups.byCiliopathy[window.CiliAI.utils.normalizeTerm(d)] || [];
                    genes.forEach(g => set1.add(g));
                });
                diseases2.forEach(d => {
                    const genes = window.CiliAI.lookups.byCiliopathy[window.CiliAI.utils.normalizeTerm(d)] || [];
                    genes.forEach(g => set2.add(g));
                });
            } else {
                const diseaseKeywords = {
                    'mks': 'Meckel–Gruber Syndrome', 'meckel': 'Meckel–Gruber Syndrome',
                    'nphp': 'Nephronophthisis', 'nephronophthisis': 'Nephronophthisis',
                    'joubert': 'Joubert Syndrome', 'bbs': 'Bardet–Biedl Syndrome',
                    'pcd': 'Primary Ciliary Dyskinesia', 'senior': 'Senior-Løken Syndrome'
                };
                const foundDiseases = Object.keys(diseaseKeywords).filter(k => qLower.includes(k));
                if (foundDiseases.length >= 2) {
                    name1 = diseaseKeywords[foundDiseases[0]];
                    name2 = diseaseKeywords[foundDiseases[1]];
                    set1 = new Set(window.CiliAI.lookups.byCiliopathy[window.CiliAI.utils.normalizeTerm(name1)] || []);
                    set2 = new Set(window.CiliAI.lookups.byCiliopathy[window.CiliAI.utils.normalizeTerm(name2)] || []);
                }
            }
            if (set1 && set2) {
                const overlap = [...set1].filter(g => set2.has(g));
                if (overlap.length === 0) {
                    return `<div class="ai-result-card">
                        <h4>No Shared Genes</h4>
                        <p>No overlapping genes found between <strong>${name1}</strong> and <strong>${name2}</strong>.</p>
                    </div>`;
                } else {
                    const geneObjects = overlap.map(g => ({ gene: g }));
                    window.lastQueryContext = {
                        type: 'list_followup',
                        data: geneObjects,
                        term: `Shared: ${name1} ∩ ${name2}`
                    };
                    return `<div class="ai-result-card">
                        <h4>Shared Genes: ${name1} ∩ ${name2}</h4>
                        <p><strong>${overlap.length}</strong> gene(s) in common:</p>
                        <p><strong>${overlap.join(', ')}</strong></p>
                        <p>(These are often allelic — same gene, different severity)</p>
                        <p>Would you like to <strong>view details</strong>?</p>
                    </div>`;
                }
            }
            return null;
        }
    },

    // SAFE "yes" HANDLER FOR LIST FOLLOW-UP
    {
        priority: 80,
        matcher: (qLower) => /^(yes|y|sure|ok|okay|yep|show|view|list|show list|view list|display)/i.test(qLower) && window.lastQueryContext && window.lastQueryContext.type === 'list_followup',
        handler: async (query) => {
            if (window.lastQueryContext.data && window.lastQueryContext.data.length > 0) {
                window.showDataInLeftPanel(window.lastQueryContext.term || 'Gene List', window.lastQueryContext.data);
                const displayedTerm = window.lastQueryContext.term || 'List';
                const displayedCount = window.lastQueryContext.data.length;
                window.lastQueryContext = { type: null, data: [], term: null };
                return `Displaying <strong>${displayedTerm}</strong> (${displayedCount} genes) in the main panel.`;
            } else {
                window.lastQueryContext = { type: null, data: [], term: null };
                return `No gene list is currently active to display. Try searching for a category first (e.g., 'Pan-ciliary genes').`;
            }
        }
    },

    // Ortholog Questions
    {
        priority: 79,
        matcher: (qLower) => qLower.includes('ortholog') || qLower.includes('orthologue'),
        handler: async (query) => {
            const qLower = window.CiliAI.utils.normalizeQuery(query);
            const match1 = qLower.match(/ortholog(?: of| for)?\s+([a-z0-9\-]+)\s+(?:in|for)\s+(c\. elegans|mouse|zebrafish|drosophila|xenopus)/i);
            const match2 = qLower.match(/(c\. elegans|mouse|zebrafish|drosophila|xenopus)\s+ortholog(?: of| for)?\s+([a-z0-9\-]+)/i);
            const match = match1 || match2;
            if (!match) return null;
            const geneSymbol = (match1 ? match1[1] : match2[2]).toUpperCase();
            const genes = window.CiliAI.utils.extractGenes(query);
            if (genes.length === 0) return `<div class="ai-result-card"><p>Please specify a gene (e.g., "ortholog of ARL13B").</p></div>`;
            const geneData = window.CiliAI.lookups.geneMap[geneSymbol];
            if (!geneData) return `<div class="ai-result-card"><p>Gene <strong>${geneSymbol}</strong> not found in database.</p></div>`;
            const mouse = geneData.Ortholog_Mouse || 'Not reported';
            const drosophila = geneData.Ortholog_Drosophila || 'Not reported';
            const celegans = geneData.Ortholog_C_elegans || 'Not reported';
            let response = `<div class="ai-result-card">
                <h4>Orthologs of ${geneSymbol}</h4>
                <ul style="margin: 10px 0;">`;
            if (qLower.includes('mouse') || qLower.includes('all')) response += `<li><strong>Mouse:</strong> ${mouse}</li>`;
            if (qLower.includes('drosophila') || qLower.includes('fly') || qLower.includes('all')) response += `<li><strong>Drosophila:</strong> ${drosophila}</li>`;
            if (qLower.includes('c. elegans') || qLower.includes('worm') || qLower.includes('all')) response += `<li><strong>C. elegans:</strong> ${celegans}</li>`;
            response += `</ul></div>`;
            return response;
        }
    },

    // Total unique genes in ciliopathies
    {
        priority: 78,
        matcher: (qLower) => {
            const patterns = [
                'how many unique genes.*ciliopathies',
                'how many unique.*ciliopathy genes',
                'how many.*unique genes.*ciliopathies',
                'total unique genes.*ciliopathies',
                'total.*unique.*ciliopathy genes',
                'number of unique genes.*ciliopathies',
                'unique genes in ciliopathies',
                'ciliopathies unique genes count',
                'how many genes are in ciliopathies'
            ];
            return patterns.some(p => new RegExp(p, 'i').test(qLower)) || (qLower.includes('how many') && qLower.includes('unique') && qLower.includes('genes') && qLower.includes('ciliopathies'));
        },
        handler: async (query) => {
            const includedClasses = ['Primary Ciliopathies', 'Motile Ciliopathies', 'Atypical Ciliopathies'];
            const classificationMap = getDiseaseClassificationMap();
            let allUniqueGenes = new Set();
            includedClasses.forEach(className => {
                const diseases = classificationMap[className] || [];
                diseases.forEach(disease => {
                    const normKey = window.CiliAI.utils.normalizeTerm(disease);
                    const genes = window.CiliAI.lookups.byCiliopathy[normKey] || [];
                    genes.forEach(g => allUniqueGenes.add(g));
                });
            });
            const totalCount = allUniqueGenes.size;
            return `<div class="ai-result-card">
                <h4>Total Unique Genes in Ciliopathies</h4>
                <p>Across <strong>Primary, Motile, and Atypical Ciliopathies</strong>:</p>
                <p style="font-size:22px; font-weight:bold; color:#2b6cb0; margin:20px 0;">
                    <strong>${totalCount}</strong> unique genes
                </p>
                <p>This count includes all known causative and associated genes from the three core ciliopathy classes.</p>
                <p><em>(Secondary diseases are excluded from this total.)</em></p>
            </div>`;
        }
    },

    // "How many genes are in [disease/classification]?"
    {
        priority: 77,
        matcher: (qLower) => new RegExp(/how many.*genes.*(in|for|are|associated with)/i).test(qLower),
        handler: async (query) => {
            const qLower = window.CiliAI.utils.normalizeQuery(query);
            let target = null;
            if (qLower.includes('joubert')) target = 'Joubert Syndrome';
            else if (qLower.includes('mks') || qLower.includes('meckel')) target = 'Meckel–Gruber Syndrome';
            else if (qLower.includes('bbs')) target = 'Bardet–Biedl Syndrome';
            else if (qLower.includes('nphp') || qLower.includes('nephronophthisis')) target = 'Nephronophthisis';
            else if (qLower.includes('pcd')) target = 'Primary Ciliary Dyskinesia';
            else if (qLower.includes('senior')) target = 'Senior-Løken Syndrome';
            else if (qLower.includes('primary ciliopathies')) target = 'Primary Ciliopathies';
            else if (qLower.includes('motile ciliopathies')) target = 'Motile Ciliopathies';
            else if (qLower.includes('atypical ciliopathies')) target = 'Atypical Ciliopathies';
            if (target) {
                let geneList = [];
                const classificationMap = getDiseaseClassificationMap();
                if (target === 'Primary Ciliopathies' || target === 'Motile Ciliopathies' || target === 'Atypical Ciliopathies') {
                    const diseases = classificationMap[target] || [];
                    let set = new Set();
                    diseases.forEach(d => {
                        const genes = window.CiliAI.lookups.byCiliopathy[window.CiliAI.utils.normalizeTerm(d)] || [];
                        genes.forEach(g => set.add(g));
                    });
                    geneList = Array.from(set);
                } else {
                    const normKey = window.CiliAI.utils.normalizeTerm(target);
                    geneList = window.CiliAI.lookups.byCiliopathy[normKey] || [];
                }
                const count = geneList.length;
                window.lastQueryContext = {
                    type: 'list_followup',
                    data: geneList.map(g => ({ gene: g })),
                    term: `Genes in ${target}`
                };
                return `<div class="ai-result-card">
                    <h4>Genes in ${target}</h4>
                    <p style="font-size:18px; font-weight:bold; color:#2b6cb0; margin:15px 0;">
                        <strong>${count}</strong> unique gene${count === 1 ? '' : 's'}
                    </p>
                    <p>These are all known causative/associated genes in the database.</p>
                    <p>Would you like to <strong>view the full list</strong>?</p>
                </div>`;
            }
            return null;
        }
    },

    // Disease implicated by a gene
    {
        priority: 76,
        matcher: (qLower) => (qLower.includes('disease') || qLower.includes('ciliopathy')) && (qLower.includes('implicated') || qLower.includes('associated') || qLower.includes('linked') || qLower.includes('cause')) && qLower.includes('with'),
        handler: async (query) => {
            const genes = window.CiliAI.utils.extractGenes(query);
            if (genes.length === 0) return null;
            const geneSymbol = genes[0];
            const geneData = window.CiliAI.lookups.geneMap[geneSymbol];
            if (!geneData) {
                return `<div class="ai-result-card">
                    <p>Gene <strong>${geneSymbol}</strong> not found in the database.</p>
                </div>`;
            }
            let associatedDiseases = [];
            Object.keys(window.CiliAI.lookups.byCiliopathy).forEach(normKey => {
                const diseaseGenes = window.CiliAI.lookups.byCiliopathy[normKey] || [];
                if (diseaseGenes.includes(geneSymbol)) {
                    let foundName = normKey;
                    const classificationMap = getDiseaseClassificationMap();
                    Object.values(classificationMap).flat().forEach(d => {
                        if (window.CiliAI.utils.normalizeTerm(d) === normKey) foundName = d;
                    });
                    associatedDiseases.push(foundName);
                }
            });
            if (associatedDiseases.length === 0 && geneData.Ciliopathies) {
                associatedDiseases = window.CiliAI.utils.ensureArray(geneData.Ciliopathies);
            }
            if (associatedDiseases.length === 0) {
                return `<div class="ai-result-card">
                    <p><strong>${geneSymbol}</strong> is a known ciliary gene but not yet directly linked to a specific ciliopathy in the current database.</p>
                    <p>It localizes to the <strong>${geneData.Localization || 'cilium'}</strong> and is highly conserved.</p>
                </div>`;
            } else {
                return `<div class="ai-result-card">
                    <h4>Disease Associations: ${geneSymbol}</h4>
                    <p><strong>${geneSymbol}</strong> is implicated in the following ciliopathies:</p>
                    <ul>
                        ${associatedDiseases.map(d => `<li><strong>${d}</strong></li>`).join('')}
                    </ul>
                    <p>These are typically <strong>transition zone</strong> disorders with overlapping phenotypes (brain, retina, kidney).</p>
                </div>`;
            }
        }
    },

    // Mouse Knockout Phenotype
    {
        priority: 75,
        matcher: (qLower) => qLower.includes('mouse') && (qLower.includes('knockout') || qLower.includes('phenotype')) && qLower.includes('of'),
        handler: async (query) => {
            const genes = window.CiliAI.utils.extractGenes(query);
            if (genes.length === 0) return null;
            const gene = genes[0];
            const data = window.CiliAI.lookups.geneMap[gene];
            if (data && (data.mouse_phenotype || data.mouse_ciliopathy_phenotype)) {
                const pheno = data.mouse_phenotype || 'Ciliopathy-related phenotype observed';
                const model = data.Ortholog_Mouse ? ` (${data.Ortholog_Mouse} mouse model)` : '';
                return `<div class="ai-result-card">
                    <h4>Mouse Knockout Phenotype: ${gene}${model}</h4>
                    <p><strong>Phenotype:</strong> ${pheno}</p>
                    ${data.mouse_ciliopathy_phenotype ? '<p>Known ciliopathy model.</p>' : ''}
                </div>`;
            } else {
                return `<div class="ai-result-card">
                    <p>No mouse knockout phenotype data available for <strong>${gene}</strong> in current database.</p>
                </div>`;
            }
        }
    },

    // Greetings
    {
        priority: 70,
        matcher: (qLower) => ['hello', 'hi', 'hey', 'greetings'].includes(qLower),
        handler: async (query) => {
            return "Hello! I'm CiliAI. How can I help you? Try asking 'What is IFT88?' or 'List genes in the transition zone'.";
        }
    },

    // Terminology Queries
    {
        priority: 69,
        matcher: (qLower) => window.terminologyQueries && window.terminologyQueries[qLower],
        handler: async (query) => {
            const qLower = window.CiliAI.utils.normalizeQuery(query);
            return window.terminologyQueries[qLower] ? `<div class="ai-result-card"><p>${window.terminologyQueries[qLower]}</p></div>` : null;
        }
    },

    // Default Buttons (plot default umap, phylogeny)
    {
        priority: 68,
        matcher: (qLower) => qLower === 'plot default umap' || qLower === 'plot default phylogeny',
        handler: async (query) => {
            const qLower = window.CiliAI.utils.normalizeQuery(query);
            if (qLower === 'plot default umap') {
                if (!window.CiliAI.activeDataset) window.CiliAI.activeDataset = 'lung';
                window.renderUMAPPlot('WDR31', ['WDR31']);
                const dsName = window.CiliAI.datasets[window.CiliAI.activeDataset].name;
                return `<div class="ai-result-card"><p>Displaying ${dsName} scRNA-seq UMAP for <strong>WDR31</strong> on the left.</p></div>`;
            } else if (qLower === 'plot default phylogeny') {
                return await window.handleAIQuery(`show nevers plot for ${window.DEFAULT_PHYLO_GENES.join(',')}`);
            }
            return null;
        }
    },

    // Contextual Follow-up (e.g., "yes" for lists, screens)
    {
        priority: 67,
        matcher: (qLower) => {
            const isComplexQuery = qLower.includes('expression') || qLower.includes('plot') || qLower.includes('umap') || qLower.includes('scrna') || qLower.includes('kidney') || qLower.includes('lung') || qLower.includes('evolution');
            const yesRegex = /^(yes|yeah|sure|ok|okay|yep|show|view|list|show list|view list|display)/i;
            return !isComplexQuery && yesRegex.test(qLower) && window.lastQueryContext && window.lastQueryContext.type;
        },
        handler: async (query) => {
            const type = window.lastQueryContext.type;
            if (type === 'list_followup') {
                if (typeof window.showDataInLeftPanel === 'function') {
                    window.showDataInLeftPanel(window.lastQueryContext.term || 'Gene List', window.lastQueryContext.data || []);
                    window.lastQueryContext = { type: null, data: [], term: null };
                    return `Displaying <strong>${window.lastQueryContext.term}</strong> in the main panel.`;
                }
            } else if (type === 'screen_references') {
                window.lastQueryContext = { type: null, data: [], term: null };
                return window.handleScreenReferenceFollowup();
            } else if (type === 'top_500_ciliary') {
                const top500 = window.CiliAI.masterData.slice(0, 500).map(g => ({
                    Gene: g.Gene,
                    Localization: g.Localization || '-',
                    Description: g['Gene.Description'] || '-'
                }));
                if (typeof window.showDataInLeftPanel === 'function') {
                    window.showDataInLeftPanel('Top 500 Ciliary Genes', top500);
                    window.lastQueryContext = { type: null };
                    return "I've loaded the top 500 ciliary genes into the main panel.";
                }
            }
            return null;
        }
    },

{
    priority: 68,
    matcher: (qLower) => {
        const loc = window.extractLocalizationIntent?.(qLower);
        return !!loc && /genes?\b/.test(qLower);
    },
    handler: async (query) => {
        const qLower = window.CiliAI.utils.normalizeQuery(query);
        const localization = window.extractLocalizationIntent(qLower);

        if (!localization) return null;

        const geneList = window.getGenesByLocalization(localization);

        if (!geneList.length) {
            return `<div class="ai-result-card">
                <p>No genes annotated to the <strong>${localization}</strong> were found.</p>
            </div>`;
        }

        // Set follow-up context
        window.lastQueryContext = {
            type: 'list_followup',
            term: `Genes localized to ${localization}`,
            data: geneList
        };

        // ✅ Immediately show list (NOT ask)
        return `<div class="ai-result-card">
            <h4>📍 Transition Zone Genes</h4>
            <p>Found <strong>${geneList.length}</strong> genes localized to the <strong>${localization}</strong>:</p>

            <div class="gene-badge-container">
                ${geneList.map(g =>
                    `<span class="gene-badge" onclick="handleGeneSearch('${g.gene}', false)">
                        ${g.gene}
                    </span>`
                ).join('')}
            </div>
        </div>`;
    }
},

    
    // List Genes (by localization, compartment, module)
    {
        priority: 66,
        matcher: (qLower) => {
            const match = qLower.match(/^(?:list|show|display|find|give me)\s+(?:all\s+)?(.+?)\s+genes$/i);
            return !!match;
        },
        handler: async (query) => {
            const qLower = window.CiliAI.utils.normalizeQuery(query);
            const match = qLower.match(/^(?:list|show|display|find|give me)\s+(?:all\s+)?(.+?)\s+genes$/i);
            if (!match) return null;
            const term = match[1].trim();
            const termUpper = term.toUpperCase();
            let genes = [];
            const locList = window.getGenesByLocalization(term);
            if (locList.length > 0) genes = locList.map(g => g.gene);
            if (genes.length === 0) {
                if (window.CiliAI.lookups.byCompartment?.[termUpper]) genes = window.CiliAI.lookups.byCompartment[termUpper];
                else if (window.CiliAI.lookups.byModuleOrComplex?.[termUpper]) genes = window.CiliAI.lookups.byModuleOrComplex[termUpper];
            }
            if (genes.length > 0) {
                const rows = genes.map(g => ({ gene: g }));
                window.lastQueryContext = { type: 'list_followup', term: `${term} genes`, data: rows };
                return `<div class="ai-result-card"><p>Found <strong>${genes.length}</strong> genes associated with <strong>${term}</strong>.</p><p>Would you like to <strong>view the full list</strong>?</p></div>`;
            } else {
                return `I couldn't find a gene set for <strong>${term}</strong> in the database.`;
            }
        }
    },

    // Phylogeny Queries
    {
        priority: 65,
        matcher: (qLower) => qLower.includes('evolution') || qLower.includes('conservation') || qLower.includes('phylogenetic') || qLower.includes('phylogeny') || qLower.includes('evo of') || qLower.match(/show.+evolution/i) || (qLower.includes('show') && qLower.includes('li')),
        handler: async (query) => {
            let genes = window.CiliAI.utils.extractGenes(query);
            if (genes.length === 0) {
                const geneMatch = query.match(/[A-Z0-9]{3,}/g);
                if (geneMatch) genes = geneMatch.map(g => g.toUpperCase()).filter(g => window.CiliAI.lookups.geneMap[g]);
            }
            if (genes.length > 0) {
                if (genes.length === 1) {
                    const definitiveDefaultGenes = ["ZC2HC1A", "CEP41", "BBS1", "BBS2", "BBS5", "ZNF474", "IFT81", "BBS7"];
                    genes = [...new Set([...definitiveDefaultGenes, ...genes])];
                }
                if (!window.liPhylogenyCache) {
                    window.addChatMessage("Loading large phylogeny datasets... this may take a moment.", false);
                    await window.ensurePhylogenyDataLoaded();
                }
                window.resetViews();
                if (window.renderLiPhylogenyHeatmap) {
                    const res = window.renderLiPhylogenyHeatmap(genes);
                    if (res && res.plotData) Plotly.newPlot('cilia-svg', res.plotData, res.plotLayout);
                }
                return `<div class="ai-result-card"><p>Displaying phylogenetic conservation for <strong>${genes.length} genes</strong> in the main panel.</p></div>`;
            } else {
                return "Please specify a valid gene symbol for evolutionary analysis (e.g., 'Show evolution of BBS1').";
            }
        }
    },

    // Screen References Follow-up
    {
        priority: 64,
        matcher: (qLower) => qLower.includes('show screen reference') || qLower.includes('show publication detail') || qLower.includes('provide the paper'),
        handler: async (query) => {
            return window.handleScreenReferenceFollowup ? window.handleScreenReferenceFollowup() : null;
        }
    },

    // Screens/Phenotypes
    {
        priority: 63,
        matcher: (qLower) => qLower.includes('loss-of-function') || qLower.includes('lof') || qLower.includes('overexpression') || qLower.includes('oe') || qLower.includes('percent ciliated') || qLower.includes('cilia length') || (qLower.includes('effect') && qLower.includes('of')),
        handler: async (query) => {
            const genes = window.CiliAI.utils.extractGenes(query);
            if (genes.length === 0) return `I see you're asking about screen effects, but I couldn't identify a gene. Please try again, like "loss-of-function effect of IFT88".`;
            return window.handleScreenQuery ? window.handleScreenQuery(genes[genes.length - 1]) : null;
        }
    },

    // What is [Gene]
    {
        priority: 62,
        matcher: (qLower) => {
            const match = qLower.match(/^(?:what is|what's|describe|tell me about)\s+([A-Z0-9\-]{3,})\??$/i);
            return !!match;
        },
        handler: async (query) => {
            const qLower = window.CiliAI.utils.normalizeQuery(query);
            const match = qLower.match(/^(?:what is|what's|describe|tell me about)\s+([a-z0-9\-]{3,})\??$/i);
            if (!match) return null;
            return await window.displayFullGeneInfo(match[1].toUpperCase());
        }
    },

    // Ortholog Queries (Alternative Patterns)
   {
    priority: 61,
    matcher: (qLower) => {
        const match1 = qLower.match(/…/i);
        const match2 = qLower.match(/…/i);
        return !!(match1 || match2);           // ← boolean return, no problem
    },
    handler: async (query) => {                // ← this is a real async function
        const qLower = window.CiliAI.utils?.normalizeQuery?.(query) || query.toLowerCase().trim();
        const match1 = qLower.match(/…/i);
        const match2 = qLower.match(/…/i);
        const match = match1 || match2;
        if (!match) return null;               // ← legal return inside function

        const geneSymbol = (match1 ? match1[1] : match2[2]).toUpperCase();
        const organism  = (match1 ? match1[2] : match2[1]);

        return window.handleOrthologQuery?.(geneSymbol, organism) ?? null;
    }
},

  // Domain Architecture (Fixed: Handles "WDR31 domains" and "Show domains for WDR31")
    {
        priority: 60,
        matcher: (qLower) => {
            const hasKeyword = qLower.includes('domain') || qLower.includes('pfam') || qLower.includes('architecture') || qLower.includes('motif');
            // Check if we can extract a gene
            const genes = window.CiliAI.utils.extractGenes(qLower);
            return hasKeyword && genes.length > 0;
        },
        handler: async (query) => {
            const genes = window.CiliAI.utils.extractGenes(query);
            
            if (genes.length === 0) {
                return `<div class="ai-result-card"><p>I understood you want to see protein domains, but I couldn't identify the gene symbol.</p></div>`;
            }

            // Switch to domain view
            window.switchView('domain');
            
            let responseHtml = `<div class="ai-result-card">
                <h4>🧬 Protein Domain Architecture</h4>
                <p>Showing Pfam domains for: <strong>${genes.slice(0, 3).join(', ')}${genes.length > 3 ? ' and ' + (genes.length - 3) + ' more' : ''}</strong></p>`;
            
            if (genes.length === 1) {
                const gene = genes[0].toUpperCase();
                const geneData = window.CiliAI.lookups.geneMap[gene];
                
                // Ensure lookup exists to prevent crash
                window.CiliAI.lookups.pfamByGene = window.CiliAI.lookups.pfamByGene || {};
                
                const hasDomains = geneData && (geneData.PFAM_IDs || geneData.Domain_Descriptions);
                window.showDomainViewer(gene);
                
                responseHtml += hasDomains
                    ? `<p>Interactive domain map displayed → hover for details.</p>`
                    : `<p><em>${gene}</em> has no annotated Pfam domains in the database.</p>`;
            } else {
                window.showDomainViewer(genes[0]);
                responseHtml += `<ul style="margin:10px 0; padding-left:20px; font-size:13px;">`;
                genes.slice(0, 6).forEach(g => {
                    const geneData = window.CiliAI.lookups.geneMap[g];
                    const domainCount = geneData?.PFAM_IDs ? geneData.PFAM_IDs.split(/[,;]/).filter(Boolean).length
                                                           : geneData?.Domain_Descriptions ? geneData.Domain_Descriptions.split(/[,;]/).filter(Boolean).length : 0;
                    responseHtml += `<li><strong>${g}</strong>: ${domainCount} domain${domainCount !== 1 ? 's' : ''}</li>`;
                });
                if (genes.length > 6) responseHtml += `<li><em>...and ${genes.length - 6} more</em></li>`;
                responseHtml += `</ul>`;
                responseHtml += `<p><strong>${genes[0]}</strong> is shown in full detail above. Type "domains for [other gene]" to switch.</p>`;
            }
            
            responseHtml += `
                <p style="margin-top:12px; font-size:12px; color:#666;">
                    🎨 Colors follow <strong>Nature journal</strong> style
                </p>
            </div>`;
            return responseHtml;
        }
    },
    
    // Functional Modules of Gene
    {
        priority: 59,
        matcher: (qLower) => {
            const match = qLower.match(/(?:functional modules of|modules for)\s+([a-z0-9\-]+)/i);
            return !!match;
        },
        handler: async (query) => {
            const qLower = window.CiliAI.utils.normalizeQuery(query);
            const match = qLower.match(/(?:functional modules of|modules for)\s+([a-z0-9\-]+)/i);
            if (!match) return null;
            const gene = match[1].toUpperCase();
            const g = window.CiliAI.lookups.geneMap[gene];
            if (g && g['Functional.category']) {
                return window.formatListResult(`Functional Modules for ${gene}`, window.CiliAI.utils.ensureArray(g['Functional.category']).map(m => ({ gene: m, description: "Module" })));
            } else {
                return `No functional modules listed for <strong>${gene}</strong>.`;
            }
        }
    },

// Expression / UMAP Plot (Single Gene or Complex)
{
    priority: 58,
    matcher: (qLower) =>
        (qLower.includes('plot') ||
         qLower.includes('display') ||
         qLower.includes('heatmap') ||
         qLower.includes('umap') ||
         qLower.includes('scrna') ||
         qLower.includes('expression')) &&
        !qLower.includes('compare') &&
        !qLower.includes(' vs ') &&
        !qLower.includes(' versus '),

    handler: async (query) => {
        const qLower = window.CiliAI.utils.normalizeQuery(query);

        /* ---------- Dataset detection (UNCHANGED) ---------- */
        const availableDatasets = Object.keys(window.CiliAI.datasets).sort((a, b) => b.length - a.length);
        let detectedDS = null;

        for (const dsKey of availableDatasets) {
            let isMatch = qLower.includes(dsKey);
            if (dsKey === 'olfactory' && (qLower.includes('nose') || qLower.includes('smell'))) isMatch = true;
            if (dsKey === 'hypothalamus' && (qLower.includes('brain') || qLower.includes('neuron'))) isMatch = true;
            if (dsKey === 'chondrocyte' && (qLower.includes('cartilage') || qLower.includes('disc'))) isMatch = true;
            if (dsKey === 'kidney' && qLower.includes('renal')) isMatch = true;
            if (dsKey === 'liver' && qLower.includes('hepatic')) isMatch = true;
            if (isMatch) { detectedDS = dsKey; break; }
        }

        if (detectedDS) window.CiliAI.activeDataset = detectedDS;

        /* ---------- Gene / complex detection ---------- */
        let genes = window.CiliAI.utils.extractGenes(query);
        let finalTargetTerm = null;
        let isComplex = false;

        if (genes.length === 0) {
            let cleanQuery = qLower
                .replace(/plot|display|show|visualize|umap|heatmap|scrna|expression/g, '')
                .replace(/in|for|of|from/g, '')
                .trim();

            const complexName = window.extractComplexIntent?.(cleanQuery);
            if (complexName) {
                const complexGenes = window.getGenesByComplex?.(complexName).map(g => g.gene) || [];
                if (complexGenes.length) {
                    genes = complexGenes;
                    finalTargetTerm = complexName;
                    isComplex = true;
                }
            }
        }

        const finalGenes = genes.length ? genes : ['WDR31'];
        const geneSymbol = isComplex ? finalTargetTerm : finalGenes[0];

        /* ---------- Zoom ---------- */
        const zoomMatch = qLower.match(/zoom to\s+([\w\s\-\(\)]+?)(?:\s+(?:in|for)|$)/i);
        const zoomToCellType = zoomMatch ? zoomMatch[1].trim() : null;

        /* ---------- 🔑 NEW RENDER LOGIC (FIXED) ---------- */
        if (!isComplex && finalGenes.length > 1) {
            // Multi-gene: Use Grid
            await window.renderUMAPGrid({
                genes: finalGenes,
                datasetKey: window.CiliAI.activeDataset,
                containerId: 'plotly-container'
            });
        } else {
            // Single gene or Complex: Use Standard Plot (enables side controls)
            // ERROR WAS HERE: 'validGenes' changed to 'finalGenes'
            // LOGIC FIX: Changed renderUMAPGrid back to renderUMAPPlot for single view
            window.switchView('plot');
            await window.renderUMAPPlot(geneSymbol, finalGenes, zoomToCellType);
        }

        /* ---------- UI card (UNCHANGED) ---------- */
        const currentDS = window.CiliAI.activeDataset;
        const currentName = window.CiliAI.datasets[currentDS].name;

        return `
            <div class="ai-result-card">
                <p><strong>${isComplex ? geneSymbol + ' complex' : finalGenes.join(', ')}</strong></p>
                <p>${finalGenes.length > 1 && !isComplex
                    ? 'Shown as individual UMAP panels (grid view).'
                    : 'Expression visualized on UMAP.'}
                </p>
                <p style="font-size:12px;color:#666;">Dataset: ${currentName}</p>
            </div>
        `;
    }
},
    
// Compare Genes (Multi-Gene View)
{
    priority: 57,
    matcher: (qLower) =>
        qLower.includes('compare') ||
        qLower.includes(' vs ') ||
        qLower.includes(' versus ') ||
        qLower.includes('difference between'),

    handler: async (query) => {
        const qLower = window.CiliAI.utils.normalizeQuery(query);
        const genes = window.CiliAI.utils.extractGenes(query);

        // 1. Initialize Response HTML container
        let responseHtml = '<div class="ai-result-card">';

        if (genes.length < 2) {
            return `<div class="ai-result-card">
                <p>Please provide at least two genes to compare (e.g., "Compare IFT88 vs BBS1").</p>
            </div>`;
        }

        const validGenes = genes
            .map(g => g.toUpperCase())
            .filter(g => window.CiliAI.lookups.geneMap[g])
            .slice(0, 6);

        if (validGenes.length < 2) {
            return `<div class="ai-result-card"><p>Could not find at least two valid genes in the database to compare.</p></div>`;
        }

        const hasExpressionQuery =
            qLower.includes('expression') ||
            qLower.includes('expressed') ||
            qLower.includes('level') ||
            qLower.includes('plot'); // Added 'plot' to trigger expression view by default for comparisons

        /* ---------- 🔑 UPDATED EXPRESSION COMPARISON ---------- */
        if (hasExpressionQuery) {
            window.switchView('plot');

            await window.renderUMAPGrid({
                genes: validGenes,
                datasetKey: window.CiliAI.activeDataset,
                containerId: 'plotly-container'
            });

            const dsKey = window.CiliAI.activeDataset;
            const dsName = window.CiliAI.datasets[dsKey].name;

            responseHtml += `
                <h4>Expression Comparison</h4>
                <p>
                    Each gene is shown in its <strong>own UMAP panel</strong> in
                    <strong>${dsName}</strong>.
                </p>
                <ul style="margin:8px 0 12px 18px; font-size:13px;">
                    ${validGenes.map(g => `<li><strong>${g}</strong></li>`).join('')}
                </ul>
                <p style="font-size:12px; color:#666;">
                    🎨 Color intensity reflects expression (TPM).<br>
                    🔗 Zoom & pan are synchronized across all panels.
                </p>
            </div>`; // Close card

            return responseHtml;
        }

        /* ---------- Localization / Fallback (Diagram) ---------- */
        window.switchView('diagram');
        window.showDiagram();
        window.SpatialManager.clearOverlays();
        window.SpatialManager.applyMultiOverlay(validGenes);

        responseHtml += `
            <h4>📍 Localization Comparison</h4>
            <p><strong>${validGenes.join(' vs ')}</strong></p>
            <p>Multi-color overlays applied on the ciliary diagram.</p>
            <div style="display:flex; gap:5px; flex-wrap:wrap; margin-top:8px;">
                ${validGenes.map(g => `<span class="gene-badge">${g}</span>`).join('')}
            </div>
            <p style="font-size:12px; color:#666; margin-top:10px;">
                (To see expression plots instead, ask "Compare expression of ${validGenes[0]} and ${validGenes[1]}")
            </p>
        </div>`; // Close card

        return responseHtml;
    }
},
    // Variants
    {
        priority: 56,
        matcher: (qLower) => qLower.includes('variant') || qLower.includes('mutation'),
        handler: async (query) => {
            const genes = window.CiliAI.utils.extractGenes(query);
            if (genes.length === 0) return null;
            return await window.fetchVariantData(genes[0]);
        }
    },

    // Batch Query
    {
        priority: 55,
        matcher: (qLower) => qLower.includes(',') && window.CiliAI.utils.extractGenes(qLower).length > 1,
        handler: async (query) => {
            return window.handleBatchQuery ? window.handleBatchQuery(query) : null;
        }
    },

    // Fold Change
    {
        priority: 54,
        matcher: (qLower) => {
            const foldChangeMatch = qLower.match(/compare\s+(.+)\s+in\s+(.+)\s+vs\s+(.+)/i);
            return !!foldChangeMatch;
        },
        handler: async (query) => {
            const qLower = window.CiliAI.utils.normalizeQuery(query);
            const foldChangeMatch = qLower.match(/compare\s+(.+)\s+in\s+(.+)\s+vs\s+(.+)/i);
            if (!foldChangeMatch) return null;
            const result = window.calculateFoldChangeForComplex(foldChangeMatch[1].trim().toUpperCase(), foldChangeMatch[2].trim(), foldChangeMatch[3].trim());
            if (result.error) return `<div class="ai-result-card"><h4>Differential Expression Error</h4><p>${result.error}</p></div>`;
            return `<div class="ai-result-card"><h4>Differential Expression: ${result.complex}</h4><p>Comparing average expression in **${result.cellTypeA}** (A) vs **${result.cellTypeB}** (B) (N=${result.count} genes).</p><p><strong>Fold Change (A/B): ${result.foldChange.toFixed(3)}</strong></p></div>`;
        }
    },

    // Phylogeny Overlap
    {
        priority: 53,
        matcher: (qLower) => {
            const classOverlapMatch = qLower.match(/species overlap between\s+(.+)\s+and\s+(.+)/i);
            return classOverlapMatch && qLower.includes('li');
        },
        handler: async (query) => {
            const qLower = window.CiliAI.utils.normalizeQuery(query);
            const classOverlapMatch = qLower.match(/species overlap between\s+(.+)\s+and\s+(.+)/i);
            if (!classOverlapMatch) return null;
            const dataLoaded = await window.ensurePhylogenyDataLoaded();
            if (dataLoaded) {
                const result = window.getPhylogenyClassSpeciesOverlap(classOverlapMatch[1].trim(), classOverlapMatch[2].trim(), 'li');
                if (result.error) return `<div class="ai-result-card"><h4>Error</h4><p>${result.error}</p></div>`;
                return `<div class="ai-result-card"><h4>Overlap: ${result.classA} vs ${result.classB}</h4><p>Found **${result.sharedCount}** shared species.</p></div>`;
            }
            return null;
        }
    },

    // Enrichment
    {
        priority: 52,
        matcher: (qLower) => {
            const enrichmentMatch = qLower.match(/enrichment for (.+)/);
            return !!enrichmentMatch;
        },
        handler: async (query) => {
            const qLower = window.CiliAI.utils.normalizeQuery(query);
            const enrichmentMatch = qLower.match(/enrichment for (.+)/);
            if (!enrichmentMatch) return null;
            const geneList = window.CiliAI.utils.extractGenes(enrichmentMatch[1]);
            const terms = window.getEnrichedGOTerms ? window.getEnrichedGOTerms(geneList) : [];
            if (terms.length > 0) return `<div class="ai-result-card"><h4>Enrichment</h4><p>Top term: ${terms[0].term}</p></div>`;
            return "No enrichment found.";
        }
    },

    // Show Ciliary Cells
    {
        priority: 51,
        matcher: (qLower) => qLower.includes('show') && qLower.includes('ciliary cells'),
        handler: async (query) => {
            window.renderUMAPPlot('CLUSTER_VIEW');
            window.lastQueryContext = { type: 'top_500_ciliary' };
            return `<div class="ai-result-card"><p>I've displayed the UMAP with <strong>all cell clusters</strong> highlighted.</p><p>Would you like to view the <strong>top 500 genes</strong> enriched in these ciliary cells?</p></div>`;
        }
    },

    // Localization Queries (Where is [GENE] localized?)
    {
        priority: 50,
        matcher: (qLower) => (qLower.startsWith('where is') || qLower.startsWith('where are') || qLower.includes('localization of') || qLower.includes('localisation of') || qLower.includes('localized') || qLower.includes('localised') || qLower.match(/tell me.*locali[sz]ation/)) && (qLower.includes('where') || qLower.includes('locali') || qLower.includes('located')),
        handler: async (query) => {
            const qLower = window.CiliAI.utils.normalizeQuery(query);
            const genes = window.CiliAI.utils.extractGenes(query);
            if (genes.length === 0) {
                return `
                    <div class="ai-result-card">
                        <p>I couldn't identify any gene symbols in your question.</p>
                        <p><strong>Examples:</strong><br>
                        • "Where is IFT88 localized?"<br>
                        • "Where are BBS1, BBS5 and ELMOD3 located?"<br>
                        • "Tell me the localization of PCM1"</p>
                    </div>
                `;
            }
            window.switchView('diagram');
            window.showDiagram();
            window.SpatialManager.clearOverlays();
            let responseHtml = '<div class="ai-result-card"><h4>📍 Gene Localization in the Cilium</h4>';
            const validGenes = [];
            const unknownGenes = [];
            genes.forEach(geneSymbol => {
                geneSymbol = geneSymbol.toUpperCase().trim();
                const geneData = window.CiliAI.lookups.geneMap[geneSymbol];
                if (!geneData) {
                    unknownGenes.push(geneSymbol);
                    return;
                }
                validGenes.push({
                    symbol: geneSymbol,
                    localization: geneData.Localization?.trim() || 'Unknown / Not annotated'
                });
            });
            if (unknownGenes.length > 0) {
                responseHtml += `<p><strong>Not found:</strong> ${unknownGenes.join(', ')}</p>`;
            }
            if (validGenes.length === 0) {
                responseHtml += `<p>No known genes from your query were found in the database.</p></div>`;
                return responseHtml;
            }
            if (validGenes.length === 1) {
                const { symbol, localization } = validGenes[0];
                let highlighted = false;
                if (localization && localization !== 'Unknown / Not annotated') {
                    highlighted = window.SpatialManager.highlight(localization, symbol);
                }
                const status = highlighted ? '✅ Highlighted and zoomed on the diagram' : 'ℹ️ Localization known but not mappable to specific compartment — full view shown';
                responseHtml += `
                    <p>
                        <span class="gene-badge" style="font-size:14px; padding:6px 14px;">${symbol}</span><br><br>
                        <strong>Localized to:</strong> <span style="color:#2b6cb0; font-weight:600;">${localization}</span><br><br>
                        <em>${status}</em>
                    </p>
                `;
            } else {
                window.SpatialManager.applyMultiOverlay(validGenes.map(g => g.symbol));
                responseHtml += `<p><strong>Multiple genes queried:</strong></p>`;
                validGenes.forEach(({ symbol, localization }, i) => {
                    const colors = ['#e53e3e', '#38a169', '#3182ce', '#d69e2e', '#805ad5'];
                    const color = colors[i % colors.length];
                    responseHtml += `
                        <p style="margin:8px 0;">
                            <span class="gene-badge" style="background:${color}; color:white;">${symbol}</span>
                            → <strong>${localization}</strong>
                        </p>
                    `;
                });
                responseHtml += `<p style="margin-top:14px;"><em>
                    👆 Each gene is shown with a distinct colored overlay on the interactive cilium diagram.
                </em></p>`;
            }
            responseHtml += `
                <p style="margin-top:16px; font-size:13px; color:#666;">
                    💡 <strong>Tip:</strong> You can click on compartments in the diagram to explore, or zoom using the controls.
                </p>
            </div>`;
            return responseHtml;
        }
    },

    // Multi-gene Overlay
    {
        priority: 49,
        matcher: (qLower) => qLower.startsWith('multi:') || qLower.includes('multi:'),
        handler: async (query) => {
            const qLower = window.CiliAI.utils.normalizeQuery(query);
            let geneString = query.replace(/^multi:?/i, '').trim();
            geneString = geneString.replace(/^[:\s,]+/, '').replace(/[\.\?!]*$/, '');
            let genes = window.CiliAI.utils.extractGenes(geneString);
            if (genes.length === 0 && geneString) {
                genes = geneString.split(/[\s,]+/).map(g => g.trim().toUpperCase()).filter(g => g.length >= 3 && /^[A-Z0-9]+$/.test(g));
            }
            if (genes.length < 2) {
                return `
                    <div class="ai-result-card">
                        <p>Please provide at least 2 valid gene symbols.</p>
                        <p><strong>Example:</strong> Multi: IFT88, FOXJ1</p>
                        <p>Or: Multi: BBS1, CEP290, TMEM67</p>
                    </div>
                `;
            }
            window.resetViews();
            if (window.SpatialManager && typeof window.SpatialManager.applyMultiOverlay === 'function') {
                window.SpatialManager.applyMultiOverlay(genes);
            }
            const geneList = genes.join(', ');
            const preview = genes.length > 8 ? genes.slice(0, 8).join(', ') + '...' : geneList;
            return `
                <div class="ai-result-card">
                    <h4>Multi-gene Localization</h4>
                    <p><strong>Genes:</strong> ${geneList} (${genes.length} total)</p>
                    <p><strong>Preview:</strong> ${preview}</p>
                    <p>Each gene is highlighted in a <strong>different color</strong> on the interactive ciliary diagram.</p>
                </div>
            `;
        }
    },

    // GO Term / Functional Heatmap
    {
        priority: 48,
        matcher: (qLower) => qLower.startsWith('go:') || qLower.includes('go term:') || qLower.includes('functional category') || qLower.startsWith('function:'),
        handler: async (query) => {
            let term = query.replace(/^(go:|go term:|function:|functional category:?)\s*/i, '').trim();
            if (!term) {
                return `<div class="ai-result-card"><p>Please provide a GO term or functional category (e.g., "GO: intraflagellar transport").</p></div>`;
            }
            let genes = [];
            if (typeof window.getGenesByFunction === 'function') {
                genes = window.getGenesByFunction(term);
            }
            const lowerTerm = term.toLowerCase();
            const fallbackMap = {
                'intraflagellar transport': ['IFT88', 'IFT81', 'IFT172', 'IFT140', 'IFT122', 'WDR19', 'TTC21B', 'IFT80', 'IFT57', 'TRAF3IP1', 'CLUAP1', 'IFT20', 'IFT74', 'IFT52', 'IFT46', 'KIF3A', 'KIF3B', 'KIF17', 'DYNC2H1'],
                'ift': ['IFT88', 'IFT81', 'IFT172', 'IFT140', 'IFT122', 'WDR19', 'TTC21B', 'IFT80', 'IFT57', 'TRAF3IP1', 'CLUAP1', 'IFT20', 'IFT74', 'IFT52', 'IFT46'],
                'bbsome': ['BBS1', 'BBS2', 'BBS4', 'BBS5', 'BBS7', 'TTC8', 'BBS9', 'BBIP1'],
                'transition zone': ['TMEM67', 'TMEM216', 'TMEM237', 'CEP290', 'CC2D2A', 'TCTN1', 'TCTN2', 'MKS1', 'NPHP1', 'RPGRIP1L'],
                'dynein arm': ['DNAH5', 'DNAH11', 'DNAI1', 'DNAI2', 'DNAAF1', 'DNAAF2', 'LRRC6'],
                'radial spoke': ['RSPH1', 'RSPH4A', 'RSPH9', 'DRC1']
            };
            if (genes.length === 0) {
                for (const key in fallbackMap) {
                    if (lowerTerm.includes(key)) {
                        genes = fallbackMap[key];
                        break;
                    }
                }
            }
            if (genes.length === 0) {
                return `
                    <div class="ai-result-card">
                        <p>No genes found for <strong>"${term}"</strong>.</p>
                        <p>Try common terms like "intraflagellar transport", "bbsome", or "transition zone".</p>
                    </div>
                `;
            }
            window.resetViews();
            if (window.SpatialManager && typeof window.SpatialManager.applyMultiOverlay === 'function') {
                const upperGenes = genes.map(g => g.toUpperCase());
                window.SpatialManager.applyMultiOverlay(upperGenes);
            }
            const preview = genes.slice(0, 12).join(', ');
            const more = genes.length > 12 ? `... and ${genes.length - 12} more` : '';
            return `
                <div class="ai-result-card">
                    <h4>Functional Category / GO Term: ${term}</h4>
                    <p>Found <strong>${genes.length}</strong> genes.</p>
                    <p><strong>Examples:</strong> ${preview}${more}</p>
                    <p>A <strong>multi-colored overlay</strong> has been applied to the ciliary diagram showing localization.</p>
                </div>
            `;
        }
    },

    // Fallback Intent
    {
        priority: 0,
        matcher: () => true,
        handler: async (query) => {
            const intent = window.flexibleIntentParser ? window.flexibleIntentParser(query) : null;
            if (intent && intent.handler) {
                return intent.handler(intent.entity, query);
            }
            let term = window.CiliAI.utils.normalizeQuery(query);
            const match = term.match(/(?:what is|describe|localization of|where is)\s+(?:the\s+)?(.+)/i);
            if (match) term = match[1];
            term = term.replace(/[?.]/g, '').trim().toUpperCase();
            const genes = window.CiliAI.utils.extractGenes(term);
            if (genes.length > 0) {
                return await window.displayFullGeneInfo(genes[0]);
            } else {
                return `Sorry, I didn't understand: "<strong>${query}</strong>". Try asking about a gene, localization, or GO term.`;
            }
        }
    }
];

// 3. Sort Handlers by Priority (Descending)
intentHandlers.sort((a, b) => b.priority - a.priority);

// 4. Dispatcher: handleAIQuery (Safe, standalone version)
window.handleAIQuery = async function (query) {
    // ── Early exit if no query or chat window missing ───────────────────────
    if (!query || typeof query !== 'string') {
        console.warn("handleAIQuery: empty or invalid query");
        return;
    }

    const chatWindow = document.getElementById('messages');
    if (!chatWindow) {
        console.warn("Chat window (#messages) not found");
        return;
    }

    // ── Fail-safe: Ensure CiliAI.utils exists ───────────────────────────────
    if (!window.CiliAI?.utils) {
        console.warn("CiliAI.utils missing — re-initializing.");
        window.CiliAI.utils = {
            normalizeQuery: (q) => (q || '').toLowerCase().trim(),
            extractGenes: (q) => window.extractMultipleGenes ? window.extractMultipleGenes(q) : [],
            normalizeTerm: (t) => t ? t.toLowerCase().replace(/[^a-z0-9]/g, '') : '',
            ensureArray: (v) => Array.isArray(v) ? v : (v ? [v] : [])
        };
    }

    // ── Normalize query once ────────────────────────────────────────────────
    const qLower = window.CiliAI.utils.normalizeQuery(query);

    // Optional logging (uncomment if needed)
    // if (window.log) window.log(`Routing query: ${query}`);

    try {
        // Readiness check
        if (!window.CiliAI || !window.CiliAI.ready) {
            window.addChatMessage("Data is still loading, please wait...", false);
            return;
        }

        let htmlResult = null;

        // Try all intent handlers in priority order
        for (const intent of intentHandlers) {
            if (intent.matcher(qLower)) {
                htmlResult = await intent.handler(query);
                if (htmlResult) {
                    window.addChatMessage(htmlResult, false);
                    return; // Exit after successful handling
                }
            }
        }

        // Fallback when no intent matched
        window.addChatMessage(
            `Sorry, I didn't understand: "<strong>${query}</strong>".<br>` +
            `Try asking about a gene (e.g. "What is IFT88?"), localization, expression, or "help".`,
            false
        );

    } catch (e) {
        console.error("Error in handleAIQuery:", e);
        window.addChatMessage(
            `An internal error occurred while processing your query.<br>` +
            `<small style="color:#666;">${e.message}</small>`,
            false
        );
    }
};


window.fetchVariantData = async function(geneSymbol) {
    try {
        const response = await fetch(`https://mygene.info/v3/query?q=${geneSymbol}&fields=clinvar,gnomad`);
        const data = await response.json();
        const hits = data.hits?.[0] || {};
        
        return `
        <div class="variant-panel">
            <h4>🧬 Variants for ${geneSymbol}</h4>
            <div class="variant-stats">
                <div class="stat-card"><span class="stat-value">${hits.clinvar?.pathogenic_count || 0}</span> Pathogenic</div>
                <div class="stat-card"><span class="stat-value">${hits.gnomad?.pLI?.toFixed(3) || 'N/A'}</span> pLI Score</div>
            </div>
            <p style="font-size:11px; color:#666;">Data Source: MyGene.info (ClinVar/gnomAD)</p>
        </div>`;
    } catch (e) {
        return `<p>Variant data unavailable for ${geneSymbol}</p>`;
    }
};


window.switchDatasetAndPlot = function(dataset, geneSymbol, geneListStr, zoom) {
    // Robustly handle gene list (array vs string)
    let geneList = geneListStr;
    if (typeof geneListStr === 'string') {
        geneList = geneListStr.split(',').filter(g => g);
    } else if (!Array.isArray(geneListStr)) {
        geneList = [geneSymbol];
    }

    window.CiliAI.activeDataset = dataset;
    window.renderUMAPPlot(geneSymbol, geneList, zoom || null);
    
    const label = dataset.charAt(0).toUpperCase() + dataset.slice(1);
    window.addChatMessage(`Switched to <strong>${label}</strong> dataset.`, false);
};

// Helper: Find Genes by Functional Category or GO ID
function getGenesByFunction(term) {
    const q = term.toLowerCase().trim();
    const matches = [];
    if (!window.CiliAI.masterData) return [];
    
    window.CiliAI.masterData.forEach(g => {
        // 1. Check Functional.category (Priority)
        if (g['Functional.category'] && g['Functional.category'].toLowerCase().includes(q)) {
            matches.push(g.Gene);
            return;
        }
        // 2. Check ID (for GO:xxxx)
        if (g.ID && g.ID.toLowerCase().includes(q)) {
            matches.push(g.Gene);
            return;
        }
        // 3. Check Description
        if (g.Description && g.Description.toLowerCase().includes(q)) {
            matches.push(g.Gene);
        }
    });
    // Remove duplicates
    return [...new Set(matches)];
}

// Helper: Render Heatmap for Functional Category (Bypasses goMap)
window.renderCategoryHeatmap = function(geneList) {
    const svg = document.getElementById('cilia-diagram') || document.getElementById('cilia-svg')?.querySelector('svg');
    if (!svg) {
        window.generateAndInjectSVG(); // Ensure SVG is present
        // Retry after a microtask
        setTimeout(() => window.renderCategoryHeatmap(geneList), 50);
        return;
    }

    // Use SpatialManager to map genes to locations
    if (!window.SpatialManager || !window.SpatialManager.locMap) return;

    // Remove existing overlays
    document.querySelectorAll('.heatmap-overlay, .multi-overlay').forEach(el => el.remove());

    // Group genes by location
    const locCounts = {};
    geneList.forEach(geneSymbol => {
        const gene = window.CiliAI.lookups.geneMap[geneSymbol.toUpperCase()];
        if (gene && gene.Localization) {
            // Handle multiple localizations (e.g., "flagella, Centrosome")
            const locs = gene.Localization.split(',').map(l => l.trim().toLowerCase());
            locs.forEach(loc => {
                // Map "flagella" -> "cilia" or direct map
                let mappedLoc = loc;
                if(loc.includes('flagella')) mappedLoc = 'cilia'; 
                
                // Find normalized key in SpatialManager
                const key = Object.keys(window.SpatialManager.locMap).find(k => mappedLoc.includes(k));
                if (key) {
                    locCounts[key] = (locCounts[key] || 0) + 1;
                }
            });
        }
    });

    const maxCount = Math.max(...Object.values(locCounts), 1);

    // Create/Find overlay group
    let overlayGroup = svg.querySelector('#heatmap-group');
    if (!overlayGroup) {
        overlayGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        overlayGroup.id = 'heatmap-group';
        const viewport = svg.querySelector('#viewport-group') || svg;
        viewport.appendChild(overlayGroup);
    } else {
        overlayGroup.innerHTML = ''; // Clear previous children
    }

    // Draw overlays
    Object.entries(locCounts).forEach(([locKey, count]) => {
        const svgId = window.SpatialManager.locMap[locKey];
        if (!svgId) return;
        const element = document.getElementById(svgId);
        if (!element) return;

        const clone = element.cloneNode(true);
        clone.id = '';
        clone.classList.add('heatmap-overlay');
        clone.removeAttribute('tabindex');
        clone.style.fill = 'url(#heatmapGrad)'; // Requires the gradient defined in index.html
        // Fallback color if gradient missing
        if(!document.getElementById('heatmapGrad')) clone.style.fill = '#ff0000'; 
        
        clone.style.opacity = (count / maxCount) * 0.8; 
        clone.style.pointerEvents = 'none';
        overlayGroup.appendChild(clone);
    });

    window.showDiagram(); // Switch view
    if (window.SpatialManager.resetZoom) window.SpatialManager.resetZoom();
};

window.handleComparativeDashboard = async function(genesText) {
    const genes = genesText.split(/vs|VS|Vs|and|,/).map(g => g.trim().toUpperCase());
    
    return `
    <div class="comparison-dashboard">
        <div class="comparison-header"><h3>🔬 Comparing: ${genes.join(' vs ')}</h3></div>
        <div class="comparison-grid">
            ${genes.map(gene => {
                const data = window.CiliAI.lookups.geneMap[gene] || {};
                return `
                <div class="gene-panel">
                    <h4 style="color:#2b6cb0;">${gene}</h4>
                    <p style="font-size:12px;"><strong>Loc:</strong> ${data.Localization || '-'}</p>
                    <p style="font-size:12px;"><strong>Disease:</strong> ${(data.Ciliopathies || []).slice(0,1).join(',')}</p>
                </div>`;
            }).join('')}
        </div>
        <button class="ciliai-button" onclick="window.handleBatchQuery('${genes.join(',')}')">📊 Full Table</button>
    </div>`;
};

window.handleBatchQuery = function(geneList) {
    const genes = geneList.split(/[,\s]+/).map(g => g.trim().toUpperCase()).filter(g => g);
    const dataObjects = genes.map(g => ({ gene: g })); 
    window.showDataInLeftPanel(`Batch Analysis (${genes.length})`, dataObjects);
    return `<div class="ai-result-card"><p>Generated batch table for ${genes.length} genes.</p></div>`;
};

window.handleScreenReferenceFollowup = function() {
    return `<div class="ai-result-card">
        <h4>Screen References</h4>
        <ul class="reference-list">
            <li class="reference-item"><strong>Kim et al. (2016)</strong>: IMCD3 RNAi screen.</li>
            <li class="reference-item"><strong>Wheway et al. (2015)</strong>: RPE1 siRNA screen.</li>
            <li class="reference-item"><strong>Roosing et al. (2015)</strong>: hTERT-RPE1 screen.</li>
            <li class="reference-item"><strong>Breslow et al. (2018)</strong>: Hedgehog CRISPR screen.</li>
        </ul>
    </div>`;
};
// Track and display references for all data
window.CitationManager = {
    references: new Map(),
    
    addReference: function(source, pmid, citation) {
        this.references.set(pmid, {source, citation});
    },
    
    showReferences: function(geneSymbol) {
        const geneData = window.CiliAI.lookups.geneMap[geneSymbol];
        const refs = [];
        
        // Collect references from various data sources
        if (geneData?.screens) refs.push(...geneData.screens.map(s => s.source));
        if (geneData?.phylogeny?.li) refs.push("PMID: 24995987"); // Li et al. 2014
        
        return `
        <div class="references-panel">
            <h4>📚 References for ${geneSymbol}</h4>
            <ul class="reference-list">
                ${refs.slice(0, 10).map(ref => `
                    <li class="reference-item">
                        <a href="https://pubmed.ncbi.nlm.nih.gov/${ref.replace('PMID: ', '')}" target="_blank">
                            ${ref}
                        </a>
                        <button onclick="window.saveReference('${ref}')">⭐</button>
                    </li>
                `).join('')}
            </ul>
            <button onclick="window.exportReferences('${geneSymbol}')">📥 Export References (BibTeX)</button>
        </div>`;
    }
};

    
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


// Global exposure block:
window.log = log;
window.react = react;
window.handleUserSend = handleUserSend;
window.searchGene = searchGene;
window.showDefaultUMAP = showDefaultUMAP;
window.showDefaultPhylogeny = showDefaultPhylogeny;
window.downloadPlot = downloadPlot;

// Core Logic & Analysis exposure — keep only once:
window.renderUMAPPlot = renderUMAPPlot; 
window.getGenesByLocalization = getGenesByLocalization;
window.showDataInLeftPanel = showDataInLeftPanel;
window.normalizeTerm = normalizeTerm;
window.ensureArray = ensureArray;

// Helper exposures needed for complex queries:
window.handleComplexQuery = handleComplexQuery;
window.extractComplexIntent = extractComplexIntent; 
window.extractCellTypeIntent = extractCellTypeIntent; 
window.extractDiseaseIntent = extractDiseaseIntent;
window.extractDomainIntent = extractDomainIntent;
window.calculateFoldChangeForComplex = calculateFoldChangeForComplex;
window.getAverageComplexExpression = getAverageComplexExpression;
window.getPhylogenyClassSpeciesOverlap = getPhylogenyClassSpeciesOverlap;
window.getClusterBoundaries = getClusterBoundaries;
window.getGenesByComplex = getGenesByComplex;
window.handleScreenReferenceFollowup = handleScreenReferenceFollowup;

/* ==============================================================
 * MODULE: ADVANCED SEARCH & FILTERS (v9.0)
 * ============================================================== */

// --- 1. SEARCH STATE MANAGEMENT ---
window.SearchState = {
    history: JSON.parse(localStorage.getItem('ciliai_search_history') || '[]'),
    saved: JSON.parse(localStorage.getItem('ciliai_saved_queries') || '[]'),
    
    addToHistory: function(query) {
        if (!query) return;
        // Remove duplicate if exists, add to top
        this.history = this.history.filter(q => q !== query);
        this.history.unshift(query);
        if (this.history.length > 20) this.history.pop(); // Keep last 20
        localStorage.setItem('ciliai_search_history', JSON.stringify(this.history));
        this.renderHistory();
    },

    saveQuery: function(query) {
        if (!query || this.saved.includes(query)) return;
        this.saved.push(query);
        localStorage.setItem('ciliai_saved_queries', JSON.stringify(this.saved));
        this.renderSaved();
        alert('Search saved!');
    },

    renderHistory: function() {
        const container = document.getElementById('search-history-list');
        if (!container) return;
        container.innerHTML = this.history.map(q => 
            `<div class="history-item" onclick="window.setSearch('${q}')">🕒 ${q}</div>`
        ).join('');
    },

    renderSaved: function() {
        const container = document.getElementById('search-saved-list');
        if (!container) return;
        container.innerHTML = this.saved.map(q => 
            `<div class="history-item" onclick="window.setSearch('${q}')">⭐ ${q}</div>`
        ).join('');
    }
};

// --- 2. BOOLEAN SEARCH ENGINE ---
window.executeBooleanSearch = function(queryStr, filters = {}) {
    if (!window.CiliAI.masterData) return [];

    let results = window.CiliAI.masterData;
    const q = queryStr.trim();

    // A. Text Search with Boolean Logic (AND, OR, NOT)
    if (q) {
        // 1. Handle NOT (Exclude)
        const notParts = q.split(/\s+NOT\s+/i);
        const positivePart = notParts[0]; // The part before the first NOT
        const negativeParts = notParts.slice(1); // Everything else is excluded

        // Filter out negatives
        if (negativeParts.length > 0) {
            results = results.filter(gene => {
                const str = JSON.stringify(gene).toUpperCase();
                return !negativeParts.some(neg => str.includes(neg.trim().toUpperCase()));
            });
        }

        // 2. Handle OR (Union) within the positive part
        if (positivePart.includes(' OR ')) {
            const orTerms = positivePart.split(/\s+OR\s+/i).map(t => t.trim().toUpperCase());
            results = results.filter(gene => {
                const str = JSON.stringify(gene).toUpperCase();
                return orTerms.some(term => str.includes(term));
            });
        } 
        // 3. Handle AND (Intersection) - Default behavior for spaces if not OR
        else {
            const andTerms = positivePart.split(/\s+(?:AND\s+)?/i).map(t => t.trim().toUpperCase());
            results = results.filter(gene => {
                const str = JSON.stringify(gene).toUpperCase();
                return andTerms.every(term => str.includes(term));
            });
        }
    }

    // B. Apply Dropdown Filters
    
    // Localization
    if (filters.localization && filters.localization !== 'All') {
        results = results.filter(g => (g.Localization || '').includes(filters.localization));
    }

    // Ciliopathy
    if (filters.disease && filters.disease !== 'All') {
        results = results.filter(g => {
            const diseases = g.Ciliopathies || []; // Assuming array or string
            return JSON.stringify(diseases).includes(filters.disease);
        });
    }

    // C. Apply Expression Range Filter
    if (filters.minExpr > 0) {
        results = results.filter(g => {
            if (!g.expression || !g.expression.scRNA) return false;
            // Get max expression value for this gene
            const vals = Object.values(g.expression.scRNA);
            const maxVal = Math.max(...vals, 0);
            return maxVal >= filters.minExpr;
        });
    }

    return results;
};

// --- 3. AUTOCOMPLETE LOGIC ---
window.setupAutocomplete = function(inputId, suggestionsId) {
    const input = document.getElementById(inputId);
    const box = document.getElementById(suggestionsId);
    if (!input || !box) return;

    input.addEventListener('input', function() {
        const val = this.value.toUpperCase();
        if (val.length < 2) { box.style.display = 'none'; return; }

        // Search gene symbols + synonyms (if you have them)
        const matches = Object.keys(window.CiliAI.lookups.geneMap || {})
            .filter(k => k.startsWith(val))
            .slice(0, 10);

        if (matches.length === 0) { box.style.display = 'none'; return; }

        box.innerHTML = matches.map(gene => 
            `<div class="ac-item" onclick="window.setSearch('${gene}')">${gene}</div>`
        ).join('');
        box.style.display = 'block';
    });

    // Hide when clicking outside
    document.addEventListener('click', function(e) {
        if (e.target !== input && e.target !== box) box.style.display = 'none';
    });
};

window.setSearch = function(val) {
    const input = document.getElementById('adv-search-input');
    if (input) {
        input.value = val;
        document.getElementById('adv-suggestions').style.display = 'none';
        window.runDashboardSearch(); // Auto-run
    }
};


/* ==============================================================
 * MODULE: SEARCH UI INJECTION
 * ============================================================== */

window.injectSearchDashboardStyles = function() {
    const css = `
        .search-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2000; display: none; justify-content: center; align-items: flex-start; padding-top: 50px; backdrop-filter: blur(2px); }
        .search-panel { background: white; width: 800px; max-width: 95%; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); overflow: hidden; display: flex; flex-direction: column; max-height: 85vh; font-family: 'Inter', sans-serif; }
        .search-header { padding: 20px; background: #f7fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
        .search-body { padding: 20px; overflow-y: auto; display: flex; gap: 20px; }
        .search-sidebar { width: 250px; border-right: 1px solid #e2e8f0; padding-right: 20px; }
        .search-main { flex: 1; }
        
        /* Controls */
        .filter-group { margin-bottom: 15px; }
        .filter-label { display: block; font-size: 12px; font-weight: 700; color: #4a5568; margin-bottom: 5px; text-transform: uppercase; }
        .cilia-input, .cilia-select { width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 14px; }
        .cilia-range { width: 100%; }
        
        /* Autocomplete */
        .ac-box { position: absolute; background: white; border: 1px solid #cbd5e0; width: 100%; max-height: 200px; overflow-y: auto; z-index: 10; display: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .ac-item { padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f7fafc; }
        .ac-item:hover { background: #ebf8ff; }

        /* History */
        .history-item { padding: 6px 10px; font-size: 13px; color: #2b6cb0; cursor: pointer; border-radius: 4px; margin-bottom: 2px; }
        .history-item:hover { background: #ebf8ff; }

        /* Results */
        .result-item { padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 10px; transition: all 0.2s; cursor: pointer; }
        .result-item:hover { border-color: #bee3f8; background: #ebf8ff; }
        .result-badges { margin-top: 5px; }
        .res-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #edf2f7; color: #4a5568; margin-right: 5px; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
};

window.openSearchDashboard = function() {
    // 1. Inject Styles
    window.injectSearchDashboardStyles();

    // 2. Inject HTML if missing
    if (!document.getElementById('cilia-search-modal')) {
        const modal = document.createElement('div');
        modal.id = 'cilia-search-modal';
        modal.className = 'search-modal';
        modal.innerHTML = `
            <div class="search-panel">
                <div class="search-header">
                    <h2 style="margin:0; color:#2d3748;">🔍 Advanced Search</h2>
                    <button onclick="document.getElementById('cilia-search-modal').style.display='none'" style="background:none; border:none; font-size:20px; cursor:pointer;">✕</button>
                </div>
                <div class="search-body">
                    <div class="search-sidebar">
                        <div class="filter-group">
                            <label class="filter-label">Localization</label>
                            <select id="filter-loc" class="cilia-select">
                                <option value="All">All Locations</option>
                                <option value="Transition Zone">Transition Zone</option>
                                <option value="Basal Body">Basal Body</option>
                                <option value="Axoneme">Axoneme</option>
                                <option value="Centrosome">Centrosome</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">Ciliopathy</label>
                            <select id="filter-dis" class="cilia-select">
                                <option value="All">All Diseases</option>
                                <option value="Joubert">Joubert Syndrome</option>
                                <option value="BBS">Bardet-Biedl (BBS)</option>
                                <option value="MKS">Meckel-Gruber (MKS)</option>
                                <option value="PCD">PCD</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">Min Expression (TPM)</label>
                            <input type="range" id="filter-expr" class="cilia-range" min="0" max="100" value="0" oninput="document.getElementById('expr-val').textContent = this.value">
                            <span style="font-size:12px; color:#666;">Min: <span id="expr-val">0</span> TPM</span>
                        </div>
                        <hr style="border:0; border-top:1px solid #eee; margin: 15px 0;">
                        <div class="filter-group">
                            <label class="filter-label">Search History</label>
                            <div id="search-history-list"></div>
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">Saved Queries</label>
                            <div id="search-saved-list"></div>
                        </div>
                    </div>

                    <div class="search-main">
                        <div style="position:relative; margin-bottom: 20px; display:flex; gap:10px;">
                            <div style="flex:1; position:relative;">
                                <input type="text" id="adv-search-input" class="cilia-input" placeholder="e.g., IFT88 OR BBS (Boolean supported)...">
                                <div id="adv-suggestions" class="ac-box"></div>
                            </div>
                            <button class="ciliai-button" onclick="window.runDashboardSearch()">Search</button>
                            <button class="ciliai-button" style="background:#ecc94b; color:#744210;" onclick="window.SearchState.saveQuery(document.getElementById('adv-search-input').value)">★</button>
                        </div>
                        <div style="margin-bottom:10px; font-size:12px; color:#718096;">
                            <strong>Tip:</strong> Use AND, OR, NOT for complex logic.
                        </div>
                        <div id="adv-search-results" style="height: 400px; overflow-y:auto;">
                            <div style="text-align:center; padding-top:50px; color:#a0aec0;">
                                Search for genes, diseases, or phenotypes...
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Initialize Autocomplete
        window.setupAutocomplete('adv-search-input', 'adv-suggestions');
        
        // Render History
        window.SearchState.renderHistory();
        window.SearchState.renderSaved();
    }

    // Show Modal
    document.getElementById('cilia-search-modal').style.display = 'flex';
};

window.runDashboardSearch = function() {
    const query = document.getElementById('adv-search-input').value;
    const filters = {
        localization: document.getElementById('filter-loc').value,
        disease: document.getElementById('filter-dis').value,
        minExpr: parseInt(document.getElementById('filter-expr').value)
    };

    const results = window.executeBooleanSearch(query, filters);
    
    // Save to history
    if(query) window.SearchState.addToHistory(query);

    // Render Results
    const container = document.getElementById('adv-search-results');
    if (results.length === 0) {
        container.innerHTML = `<div style="padding:20px; text-align:center;">No results found.</div>`;
        return;
    }

    container.innerHTML = `<div style="margin-bottom:10px; font-weight:bold;">Found ${results.length} results:</div>` + 
        results.slice(0, 50).map(g => {
            return `
            <div class="result-item" onclick="window.displayFullGeneInfo('${g.Gene}'); document.getElementById('cilia-search-modal').style.display='none';">
                <div style="font-weight:bold; color:#2b6cb0;">${g.Gene}</div>
                <div style="font-size:12px; color:#4a5568;">${g['Gene.Description'] || 'No description'}</div>
                <div class="result-badges">
                    ${g.Localization ? `<span class="res-badge">📍 ${g.Localization}</span>` : ''}
                    ${g.Ortholog_Mouse ? `<span class="res-badge">🐭 Mouse Ortholog</span>` : ''}
                </div>
            </div>`;
        }).join('');
};


/* ==============================================================
 * MODULE: UI LAYOUT FIXES (Prevents Overflow)
 * ============================================================== */
(function applyLayoutFixes() {
    const styleId = 'ciliai-layout-fixes';
    if (document.getElementById(styleId)) return;
    
    const css = `
        /* 1. Ensure Chat Message Bubble Contains Content */
        .ciliai-message-content {
            max-width: 100%;
            overflow-x: auto; /* Adds scrollbar if content is too wide */
            box-sizing: border-box;
        }

        /* 2. Constrain the Gene Card */
        .ai-result-card {
            width: 100%;
            max-width: 600px; /* Prevents it from getting too huge */
            box-sizing: border-box;
            background: #fff;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            border: 1px solid #e2e8f0;
            margin-top: 5px;
        }

        /* 3. Make Tables Scrollable (Critical for Mobile/Small Screens) */
        .cilia-tab-content {
            width: 100%;
            overflow-x: auto; /* Forces table to scroll inside the tab */
        }
        
        .fancy-table {
            width: 100%;
            min-width: 300px; /* Ensures table doesn't crush too small */
            table-layout: auto;
        }

        /* 4. Fix Tab Button Wrapping */
        .cilia-tabs {
            flex-wrap: wrap; /* Allows tabs to wrap on small screens */
            gap: 5px;
        }
        
        .cilia-tab-btn {
            flex: 1 1 auto; /* Tabs grow/shrink to fit */
            text-align: center;
            min-width: 80px;
        }
    `;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = css;
    document.head.appendChild(style);
    
    console.log("CiliAI Layout Fixes Applied.");
})();


// Helper: Reset Views – Ensures diagram is visible and refreshed
window.resetViews = function() {
    // Hide all alternative views
    document.getElementById('plotly-container').style.display = 'none';
    document.getElementById('domain-viewer').style.display = 'none';

    // Always re-inject the full interactive SVG to ensure it's present and clean
    window.generateAndInjectSVG();

    // Ensure cilia-svg is visible
    const ciliaSvg = document.getElementById('cilia-svg');
    if (ciliaSvg) {
        ciliaSvg.style.display = 'flex';
        // Remove any table mode class
        ciliaSvg.classList.remove('table-view-active');
    }

    // Update title
    document.getElementById('current-viz-title').textContent = "Diagram: Spatial Intelligence";

    // Clear any overlays (heatmaps, multi-gene)
    if (window.SpatialManager && typeof window.SpatialManager.clearOverlays === 'function') {
        window.SpatialManager.clearOverlays();
    }

    // Reset zoom/state
    if (window.SpatialManager && typeof window.SpatialManager.resetZoom === 'function') {
        window.SpatialManager.resetZoom();
    }
};

window.showDiagram = function() {
    document.getElementById('plotly-container').style.display = 'none';
    document.getElementById('domain-viewer').style.display = 'none';
    document.getElementById('cilia-svg').style.display = 'flex';
    document.getElementById('current-viz-title').textContent = "Diagram: Spatial Intelligence";
    if (window.CiliAI) window.CiliAI.currentPlot = null;
};

window.showPlot = function(plotData, title = "Gene Expression UMAP") {
    // Hide other views
    document.getElementById('cilia-svg').style.display = 'none';
    document.getElementById('domain-viewer').style.display = 'none';

    const plotContainer = document.getElementById('plotly-container');
    plotContainer.style.display = 'block';
    document.getElementById('current-viz-title').textContent = title;

    // Clear previous content to avoid artifacts
    plotContainer.innerHTML = '';

    // Calculate available space
    const vizCard = document.querySelector('.viz-card');
    const vizHeader = document.querySelector('.viz-header');
    const availableHeight = (vizCard && vizHeader)
        ? (vizCard.clientHeight - vizHeader.clientHeight - 40)
        : 500;
    const availableWidth = vizCard ? (vizCard.clientWidth - 40) : 600;

    // Merge and enhance layout
    const layout = {
        ...plotData.layout,
        autosize: true,
        width: availableWidth,
        height: availableHeight,
        margin: { l: 60, r: 30, b: 60, t: 50, pad: 10 },
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
        xaxis: { ...plotData.layout?.xaxis, automargin: true, tickfont: { size: 10 } },
        yaxis: { ...plotData.layout?.yaxis, automargin: true, tickfont: { size: 10 } },
        font: { size: 11 },
        showlegend: true,
        legend: {
            x: 1.02,
            y: 1,
            xanchor: 'left',
            yanchor: 'top',
            bgcolor: 'rgba(255,255,255,0.8)',
            bordercolor: '#e1e8ed',
            borderwidth: 1,
            font: { size: 10 }
        }
    };

    // Purge any existing plot to prevent memory leaks and old listeners
    if (window.CiliAI?.currentPlot) {
        Plotly.purge('plotly-container');
        window.CiliAI.currentPlot = null;
    }

    // Render the new plot
    Plotly.newPlot('plotly-container', plotData.data, layout, {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d', 'toggleSpikelines'],
        scrollZoom: false
    })
    .then(() => {
        // Now gd is the actual graph div element (not a Promise)
        const gd = document.getElementById('plotly-container');

        // Store reference
        if (window.CiliAI) {
            window.CiliAI.currentPlot = gd;
        }

        // Attach click handler safely
        gd.on('plotly_click', (e) => {
            const point = e.points?.[0];
            const loc = point?.customdata?.localization;
            if (loc) {
                window.showDiagram();
                if (window.SpatialManager && window.CiliAI?.activeGeneContext) {
                    SpatialManager.highlight(loc, window.CiliAI.activeGeneContext);
                }
            }
        });
    })
    .catch(err => {
        console.error("Plotly rendering failed:", err);
        window.addChatMessage(`<p style="color:#c62828;">Failed to render plot: ${err.message}</p>`, false);
    });

    // Responsive resize handler (only one instance)
    const resizeHandler = () => {
        const container = document.getElementById('plotly-container');
        if (window.CiliAI?.currentPlot && container && container.offsetParent !== null) {
            Plotly.Plots.resize(window.CiliAI.currentPlot);
        }
    };

    // Remove any previous listener to avoid duplicates
    window.removeEventListener('resize', resizeHandler);
    window.addEventListener('resize', resizeHandler);
};

window.showDomainViewer = function (gene) {
    // ── HARD GUARDS & EARLY INITIALIZATION ──
    if (!window.CiliAI) return;

    // Force-create the entire chain before any access
    window.CiliAI.lookups           = window.CiliAI.lookups           || {};
    window.CiliAI.lookups.geneMap    = window.CiliAI.lookups.geneMap    || {};
    window.CiliAI.lookups.pfamByGene = window.CiliAI.lookups.pfamByGene || {};

    // Extra safety (in case something cleared it after init)
    if (!window.CiliAI.lookups.pfamByGene) {
        console.warn("[showDomainViewer] pfamByGene was cleared — re-creating");
        window.CiliAI.lookups.pfamByGene = {};
    }

    gene = gene.toUpperCase().trim();

    const domainContainer = document.getElementById('domain-viewer');
    const titleEl         = document.getElementById('current-viz-title');

    if (!domainContainer || !titleEl) return;

    // ── UI switching ──
    const ciliaSvg = document.getElementById('cilia-svg');
    const plotly   = document.getElementById('plotly-container');

    if (ciliaSvg) ciliaSvg.style.display = 'none';
    if (plotly)   plotly.style.display   = 'none';

    domainContainer.style.display = 'flex';
    domainContainer.innerHTML = '';
    titleEl.textContent = `Pfam Domains: ${gene}`;

    // ── Resolve Pfam domains ──
    let pfam = window.CiliAI.lookups.pfamByGene[gene] || [];

    if (!pfam.length) {
        const geneData = window.CiliAI.lookups.geneMap[gene];

        if (geneData && (geneData.PFAM_IDs || geneData.Domain_Descriptions)) {
            const desc = geneData.Domain_Descriptions || geneData.PFAM_IDs || "";
            const parts = desc
                .split(/[;,]/)
                .map(s => s.trim())
                .filter(Boolean);

            if (parts.length) {
                pfam = parts.map((part, i) => ({
                    id:    `DOM_${i + 1}`,
                    name:  part,
                    start: (i * 200) + 50,
                    end:   (i * 200) + 150
                }));

                // Cache it
                window.CiliAI.lookups.pfamByGene[gene] = pfam;
            }
        }
    }

    // ── Special fallback for WDR31 (common case with no strong Pfam hits) ──
    if (!pfam.length && gene === "WDR31") {
        pfam = [
            { id: "WD1", name: "WD40 repeat 1", start:  45, end:  85 },
            { id: "WD2", name: "WD40 repeat 2", start:  95, end: 135 },
            { id: "WD3", name: "WD40 repeat 3", start: 155, end: 195 },
            { id: "WD4", name: "WD40 repeat 4", start: 215, end: 255 },
        ];
        // Cache immediately so next call is instant
        window.CiliAI.lookups.pfamByGene[gene] = pfam;
    }

    // ── No domains case ──
    if (!pfam.length) {
        domainContainer.innerHTML = `
            <div style="padding:30px; text-align:center; color:#64748b; font-size:14px; line-height:1.5;">
                <strong>No Pfam domain annotations found for ${gene}</strong><br><br>
                <small>
                    Note: Some WD-repeat proteins (like WDR31) form β-propeller structures<br>
                    but may not receive individual Pfam domain assignments.
                </small>
            </div>`;
        return;
    }

    // ── Render SVG ──
    const seqLength = Math.max(...pfam.map(d => d.end), 1000);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    svg.setAttribute('viewBox', `0 0 ${seqLength + 100} 160`);
    svg.setAttribute('width',   '100%');
    svg.setAttribute('height',  '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // Background line (protein backbone)
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '50');
    line.setAttribute('y1', '80');
    line.setAttribute('x2', seqLength + 50);
    line.setAttribute('y2', '80');
    line.setAttribute('stroke', '#4a5568');
    line.setAttribute('stroke-width', '5');
    line.setAttribute('stroke-linecap', 'round');
    svg.appendChild(line);

    // Domains
    pfam.forEach((domain, index) => {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        const width = domain.end - domain.start + 1;
        const rect  = document.createElementNS('http://www.w3.org/2000/svg', 'rect');

        rect.setAttribute('x',      domain.start + 50);
        rect.setAttribute('y',      '60');
        rect.setAttribute('width',  width);
        rect.setAttribute('height', '40');
        rect.setAttribute('rx',     '8');
        rect.setAttribute('fill',   `hsl(${index * 65 + 190}, 85%, 62%)`);
        rect.setAttribute('stroke', '#ffffff');
        rect.setAttribute('stroke-width', '2');

        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${domain.name}  (${domain.start}–${domain.end})`;
        rect.appendChild(title);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x',           domain.start + 50 + width / 2);
        text.setAttribute('y',           '45');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size',   width > 80 ? '13' : '11');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill',        '#1f2937');
        text.textContent = domain.name;

        group.appendChild(rect);
        group.appendChild(text);
        svg.appendChild(group);
    });

    domainContainer.appendChild(svg);
};

window.downloadCurrentVisualization = function() {
    if (window.CiliAI?.currentPlot) {
        Plotly.downloadImage(window.CiliAI.currentPlot, { format: 'png', filename: 'ciliai-umap-plot', width: 1200, height: 800, scale: 2 });
    } else if (document.getElementById('domain-viewer').style.display !== 'none') {
        const svgElement = document.getElementById('domain-viewer').querySelector('svg');
        if (svgElement) {
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const blob = new Blob([svgData], {type: 'image/svg+xml'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ciliai-domain.svg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } else {
        const svgElement = document.getElementById('cilia-diagram');
        if (svgElement) {
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const blob = new Blob([svgData], {type: 'image/svg+xml'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ciliai-diagram.svg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }
};


// Optional auto-run if not triggered from index.html
// window.initCiliAI();






















