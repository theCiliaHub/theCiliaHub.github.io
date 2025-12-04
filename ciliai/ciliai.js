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

    // --- Global variables to hold your data ---
let ciliaryGeneMap = new Map();
let screenDatabase = {};
let lastQueryContext = { type: null, data: [], term: null };
// Phylogeny data is lazy-loaded, so it starts as null
window.liPhylogenyCache = null;
window.neversPhylogenyCache = null;
window.CiliAI_UMAP = null; // This will be populated from the master DB

   
    // --- Data Maps (These are now just for the AI brain) ---

// --- CRITICAL FIX: Missing Structure Info Map ---
const structureInfoMap = {
    'basal-body': { title: 'Basal Body', description: 'Anchors the ciliary axoneme to the cell cortex.' },
    'transition-zone': { title: 'Transition Zone', description: 'Acts as a ciliary gate, regulating entry and exit of proteins.' },
    'axoneme': { title: 'Axoneme', description: 'The microtubule core providing structural support and motility.' },
    'ciliary-tip': { title: 'Ciliary Tip', description: 'The site of IFT turnaround and a major signaling hub.' },
    'ciliary-membrane': { title: 'Ciliary Membrane', description: 'Houses ciliary GPCRs and ion channels for signaling.' },
    'nucleus': { title: 'Nucleus', description: 'Gene transcription location (non-ciliary element).' },
    'cell-body': { title: 'Cell Body/Cytoplasm', description: 'Protein synthesis and trafficking machinery location.' }
    // Add other relevant SVG IDs as keys here
};
// --- END CRITICAL FIX ---

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

// --- NEW FUNCTION: Feedback Email Sender ---
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

// Section 4A. Core Helper Functions

function react(type) {
    if (type === 'up') {
        addChatMessage('Thanks for the feedback! 🙏', false);
    } else {
        addChatMessage('Sorry about that. What specifically would help?', false);
    }
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

   // --- MODIFIED: tellAboutCiliAI (Gemini branding added back) ---
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
            <p style="font-size: 11px; margin-top: 10px; padding-top: 5px; border-top: 1px solid #e0e0e0;">
                **Powered by Gemini**: This CiliAI interface utilizes the Gemini model for its natural language understanding and conversational structure.
            </p>
        </div>
    `;
}
// --- END MODIFIED BLOCK ---

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

   function flexibleIntentParser(query) {
    const qLower = query.toLowerCase().trim();
    
    // --- Define Keywords that require Synthesis ---
    const SYNTHESIS_KEYWORDS = [
        'compare', 'role', 'mechanism', 'explain', 'associated with', 'which proteins are',
        'joubert', 'meckel', 'bbs', 'nphp', 'mks', 'localization' 
        // Including 'localization' now ensures complex localization queries hit Gemini
    ];

    // Check if the query contains any synthesis keywords OR is long enough to be complex.
    const isSynthesisQuery = SYNTHESIS_KEYWORDS.some(k => qLower.includes(k));
    const isLongQuery = qLower.split(/\s+/).filter(w => w.length > 0).length > 6;

    if (isSynthesisQuery || isLongQuery) {
        window.log('Routing via: Intent (COMPLEX_SYNTHESIS_TRIGGER)');
        // Returning a placeholder object with a null handler forces it to fall through 
        // to the outer 'htmlResult === null' check, which triggers Gemini.
        return { type: 'COMPLEX_SYNTHESIS', entity: query, handler: (term, q) => null };
    }
    
    // Fall back to null if no simple command or complex intent is found
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
     * (REPLACEMENT) The main "Level 2/3" query router.
     * This is the new "brain" that handles multi-intent queries.
     * @param {string} query - The original user query.
     * @returns {string|null} An HTML string if a complex query is handled, or null to fall back.
     */
    function handleComplexQuery(query) {
        const qLower = query.toLowerCase();

        // 1. Extract all possible intents
        const intents = {
            localization: extractLocalizationIntent(qLower),
            phenotype: extractPhenotypeIntent(qLower),
            disease: extractDiseaseIntent(qLower),
            expression: extractExpressionIntent(qLower),
            complex: extractComplexIntent(qLower),
            evolution: extractEvolutionIntent(qLower),
            isNegative: qLower.includes('not in') || qLower.includes('not expressed') || qLower.includes('no known phenotype')
        };

        // 2. Count how many intents we found (excluding isNegative flag)
        let intentCount = 0;
        if (intents.localization) intentCount++;
        if (intents.phenotype) intentCount++;
        if (intents.disease) intentCount++;
        if (intents.expression) intentCount++;
        if (intents.complex) intentCount++;
        if (intents.evolution) intentCount++;


        // 3. If it's not a multi-intent query (at least 2 criteria), fall back to the simple router
        if (intentCount < 2) {
            log(`[Complex Router] Only ${intentCount} intent(s) found. Falling back to simple router.`);
            return null;
        }

        log(`[Complex Router] Handling complex query with ${intentCount} intents:`, intents);
        
        // 4. Build a filter chain
        let titleParts = []; // For formatting the response
        
        const filteredGenes = window.CiliAI.masterData.filter(gene => {
            if (!gene || !gene.Gene) return false; // Ensure gene object and Gene name exist

            // Filter by Localization
            if (intents.localization) {
                if (!titleParts.includes(`Loc: ${intents.localization}`)) titleParts.push(`Loc: ${intents.localization}`);
                const geneLoc = (gene.Localization || '').toLowerCase();
                if (!geneLoc.includes(intents.localization)) return false;
            }

            // Filter by Phenotype
            if (intents.phenotype) {
                if (!titleParts.includes(`Pheno: ${intents.phenotype}`)) titleParts.push(`Pheno: ${intents.phenotype}`);
                const genePheno = (gene['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'] || '').toLowerCase();
                // This logic is flawed. "short cilia" is not the same as "no effect". 
                // Let's fix this to be more precise.
                let phenoMatch = false;
                if (intents.phenotype === 'short cilia' && (genePheno.includes('short') || genePheno.includes('absent'))) {
                    phenoMatch = true;
                } else if (intents.phenotype === 'longer cilia' && genePheno.includes('long')) {
                     phenoMatch = true;
                } else if (intents.phenotype === 'loss of cilia' && (genePheno.includes('absent') || genePheno.includes('no cilia'))) {
                     phenoMatch = true;
                } else if (intents.phenotype === 'no effect' && (genePheno.includes('no effect') || genePheno === '')) {
                     phenoMatch = true;
                }
                
                if (!phenoMatch) return false;
            }

            // Filter by Disease
            if (intents.disease) {
                if (!titleParts.includes(`Disease: ${intents.disease}`)) titleParts.push(`Disease: ${intents.disease}`);
                const diseaseKey = normalizeDiseaseKey(intents.disease);
                const diseaseGenes = window.CiliAI.lookups.byCiliopathy[diseaseKey];
                if (!diseaseGenes || !diseaseGenes.includes(gene.Gene.toUpperCase())) return false;
            }

            // Filter by Expression
            if (intents.expression) {
                const hasExpr = hasExpressionInTissue(gene, intents.expression);
                const title = `Expr: ${intents.isNegative ? 'NOT ' : ''}${intents.expression}`;
                if (!titleParts.includes(title)) titleParts.push(title);

                // If query is negative (NOT expressed) and gene HAS expression, filter it out
                if (intents.isNegative && hasExpr) return false;
                // If query is positive (IS expressed) and gene does NOT have expression, filter it out
                if (!intents.isNegative && !hasExpr) return false;
            }

            // Filter by Complex
            if (intents.complex) {
                const title = `Complex: ${intents.isNegative ? 'NOT ' : ''}${intents.complex}`;
                if (!titleParts.includes(title)) titleParts.push(title);
                
                const inComplex = gene.complex_components && Object.keys(gene.complex_components).some(comp => 
                    comp.toLowerCase().includes(intents.complex)
                );
                
                if (intents.isNegative && inComplex) return false;
                if (!intents.isNegative && !inComplex) return false;
            }

            // Filter by Evolution
            if (intents.evolution) {
                if (intents.evolution === 'conserved_in_elegans') {
                    if (!titleParts.includes("Conserved in C. elegans")) titleParts.push("Conserved in C. elegans");
                    if (!isGeneConserved(gene)) return false;
                }
                // (Future: Add 'ciliary_specific' logic here if needed)
            }
            
            // All filters passed
            return true;
        });

        // 5. Format the results
        const resultTitle = titleParts.join(' + ');

        if (filteredGenes.length === 0) {
            return `I found no genes that match all of your criteria (${resultTitle}).`;
        }
        
        // (MODIFIED) Dynamically build the gene list objects based on the intents
        const geneListObjects = filteredGenes.map(g => {
            const geneObject = {
                gene: g.Gene
            };

            // Add localization if it was part of the query
            if (intents.localization) {
                geneObject.localization = g.Localization || '—';
            }

            // Add phenotype if it was part of the query
            if (intents.phenotype) {
                geneObject.phenotype = g['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'] || '—';
            }
            
            // Add other intents if they exist
            if (intents.disease) {
                const diseaseKey = normalizeDiseaseKey(intents.disease);
                // Find the specific disease name from the gene's data, if available
                const diseaseList = (g.Ciliopathies || []).map(d => d.name);
                geneObject.disease = diseaseList.find(d => normalizeTerm(d) === diseaseKey) || intents.disease;
            }

            if (intents.expression) {
                 geneObject.expression = `Data available for ${intents.expression}`;
            }

            // (MODIFIED) Add description *only if* no other data columns were added
            if (Object.keys(geneObject).length === 1) { // Only 'gene' is present
                geneObject.description = g['Gene.Description'] || 'No description available.';
            }

            return geneObject;
        });

        // (MODIFIED) Remove the static 'descriptionHeader'
        lastQueryContext = {
            type: 'list_followup', 
            data: geneListObjects, 
            term: `Genes matching: ${resultTitle}`
        };
        
        return `I found ${filteredGenes.length} gene(s) matching your criteria: <strong>${resultTitle}</strong>. Do you want to view the list?`;
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
 * (REPLACEMENT) The Main "Level 1" Query Router
 * (FINAL FIX): Consolidated all logic blocks and ensured correct prioritization and async handling.
 */
async function handleAIQuery(query) {
    const chatWindow = document.getElementById('messages');
    if (!chatWindow) return;

    if (!query) return;
    const qLower = query.toLowerCase().trim();

    window.log(`Routing query: ${query}`);

    try {
        if (!window.CiliAI.ready) {
            window.addChatMessage("Data is still loading, please wait...", false);
            return;
        }

        let htmlResult = null;
        let match;

        // =( 0 )= INTENT: GREETINGS & TERMINOLOGY (Handle locally for speed)
        const simpleGreetings = ['hello', 'hi', 'hey', 'greetings'];
        const terminologyQueries = window.terminologyQueries || {};
        
        if (simpleGreetings.includes(qLower)) {
            window.log('Routing via: Intent (Greeting)');
            window.addChatMessage("Hello! I am CiliAI. How can I help you? Try asking 'What is IFT88?' or 'List genes in the transition zone'.", false);
            return;
        }
        
        if (terminologyQueries[qLower]) {
            window.log('Routing via: Intent (Terminology)');
            window.addChatMessage(`<div class="ai-result-card"><p>${terminologyQueries[qLower]}</p></div>`, false);
            return;
        }

        // --- High Priority Plot Buttons (Immediate Actions) ---
        // (Keep these local as they are direct commands, not synthesis requests)
        if (qLower === 'plot default umap') {
             // ... (logic remains here) ...
             window.log('Routing via: Intent (Default UMAP Plot)');
             window.renderUMAPPlot('FOXJ1');
             htmlResult = `<div class="ai-result-card"><p>Displaying Lung scRNA-seq UMAP for <strong>FOXJ1</strong> on the left.</p></div>`;
        }
        else if (qLower === 'plot default phylogeny') {
             // ... (logic remains here) ...
             window.log('Routing via: Intent (Default Phylogeny Plot)');
             const defaultGenes = ["ZC2HC1A", "CEP41", "BBS1", "BBS2", "BBS5", "ZNF474", "IFT81", "BBS7"];
             htmlResult = await window.routePhylogenyAnalysis(`show nevers plot for ${defaultGenes.join(',')}`);
        }
        
        // =( 1 )= COMPLEX SYNTHESIS (NEW CENTRAL ROUTING)
        // If the query is complex, it is routed to Gemini immediately.
        const complexIntent = window.flexibleIntentParser(query);

        if (htmlResult === null && complexIntent?.type === 'COMPLEX_SYNTHESIS') {
            window.log('Routing via: Intent (COMPLEX_SYNTHESIS) - Delegating to Gemini.');
            const genes = window.extractMultipleGenes(query);
            
            // This is the primary synthesis path now.
            if (window.attemptGeminiFallback(query, genes)) {
                return; 
            }
        }
        
        // (Blocks 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 are all REMOVED)
        // The remaining blocks are simplified down to the final fallback.
        
        // =( 13 )= FINAL FALLBACK / SINGLE-GENE DETAILS
        // If we reach here, it wasn't a plot, a follow-up, or a complex synthesis request. 
        // It's likely a simple gene or keyword lookup that failed to match any explicit simple handler.
        
        if (htmlResult === null) {
            window.log(`Routing via: Final Local Fallback (Get Gene Details/Error)`);
            let term = qLower;
            // Attempt to clean the term
            if ((match = qLower.match(/(?:what is|describe|localization of)\s+(?:the\s+)?(.+)/i))) {
                term = match[1];
            }
            term = term.replace(/[?.]/g, '').trim().toUpperCase();
            
            const genes = window.extractMultipleGenes(term);
            
            if (genes.length > 0) {
                // For simple single-gene questions ("What is IFT88?"), we still do the fast local lookup.
                window.log(`Final local lookup for gene: ${genes[0]}`);
                htmlResult = await window.displayFullGeneInfo(genes[0]);
            } else {
                // Generic error handler
                window.log(`Routing via: Final Fallback (Error)`);
                htmlResult = `Sorry, I didn't understand the query: "<strong>${query}</strong>". I'm sending complex queries to the Gemini synthesis engine, but I couldn't identify a target gene or topic in this case.`;
            }
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
// 4H. GEMINI INTEGRATION AND FALLBACK
// ==========================================================
async function sendQueryToGemini(query, genes, geneData) {
    window.log(`Sending query to Gemini backend: ${query} (Genes: ${genes.join(', ')})`);

    // --- CRITICAL FIX: PRODUCTION GEMINI ENDPOINT ---
    const GEMINI_ENDPOINT_URL = "https://cili-ai-gemini-backend-687107394688.us-central1.run.app/ask-ciliai";
    // --- END CRITICAL FIX ---
    
    // Prepare the context: serialize the complex data structure to JSON
    const context_json = JSON.stringify(geneData, null, 2); 

    try {
        window.addChatMessage(`🧠 Handing off to CiliAI (Gemini) for synthesis...`, false);
        
        const response = await fetch(GEMINI_ENDPOINT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question: query,
                context: context_json,
                detected_genes: genes,
            }),
        });

        if (!response.ok) {
            throw new Error(`Backend request failed with status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.answer) {
            // Display the rich markdown answer from Gemini
            window.addChatMessage(result.answer, false);
            
            // Add a footer indicating the source/model used
            window.addChatMessage(`<div style="font-size: 10px; color: #718096; text-align: right; padding-top: 5px;">
                Synthesized by ${result.model}
            </div>`, false);
        } else {
            window.addChatMessage(`Sorry, the Gemini synthesis engine did not return an answer. Error: ${result.error || 'Unknown'}`, false);
        }
        
    } catch (e) {
        console.error("Gemini connection error:", e);
        window.addChatMessage(`An error occurred while connecting to the CiliAI Gemini service. Please check the backend URL and status. (${e.message})`, false);
    }
}

// ------------------------------
// MODIFIED FALLBACK HANDLER
// ------------------------------

/**
 * Determines if a query is complex enough for Gemini, collects required data, and routes the query.
 * @param {string} query The user's question.
 * @param {Array<string>} genes An array of gene symbols detected by local logic.
 * @returns {boolean} True if the query was handled and sent to Gemini, false otherwise.
 */
function attemptGeminiFallback(query, genes) {
    const qLower = query.toLowerCase();

    // Condition 1: Synthesis or Comparison Queries
    if (qLower.includes('compare') || qLower.includes('role') || qLower.includes('mechanism') || qLower.includes('explain how') || qLower.includes('significance')) {
        
        // Ensure we have at least one gene to provide context for synthesis
        if (genes.length === 0) {
            // This is a complex conceptual question without a gene context, Gemini is the best path.
            // Send the raw question with minimal context.
            sendQueryToGemini(query, [], {});
            return true;
        }

        // Collect comprehensive data for all detected genes
        const geneData = genes.map(gene => window.CiliAI.lookups.geneMap[gene]).filter(g => g);
        
        if (geneData.length > 0) {
            sendQueryToGemini(query, genes, {
                query: query,
                genes_for_synthesis: geneData
            });
            return true;
        }
    }
    
    // Condition 2: Deep detail queries (handled by local code for single genes, 
    // but Gemini can improve synthesis for multiple genes if local handling fails)
    if (qLower.includes('tell me about') && genes.length > 1) {
        const geneData = genes.map(gene => window.CiliAI.lookups.geneMap[gene]).filter(g => g);
        if (geneData.length > 0) {
            sendQueryToGemini(query, genes, {
                query: query,
                genes_for_synthesis: geneData
            });
            return true;
        }
    }
    
    return false; // Let the local fallback take over (simple single gene info, lookup error, etc.)
}



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
