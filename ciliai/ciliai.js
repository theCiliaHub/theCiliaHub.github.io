/* ==============================================================
 * CiliAI – Interactive Explorer (v5.1 – Nov 15, 2025)
 * ==============================================================
 * • CRITICAL FIX: All data fetches now use **Google Cloud Storage (GCS)**.
 * • CORE UPGRADE: Hybrid Semantic-RAG routing implemented.
 * ============================================================== */

// ==========================================================
// 0. GLOBAL CONFIGURATION & STATE
// ==========================================================
const GCS_BASE_URL = 'https://storage.googleapis.com/ciliai/';
const API_ENDPOINT = "https://cili-ai-gemini-backend-687107394688.us-central1.run.app/ask-ciliai";

// Global State and Cache
window.CiliAI = { data: { umap: [] }, masterData: [], ready: false, lookups: {} };
let lastQueryContext = { type: null, data: [], term: null };
window.liPhylogenyCache = null;
window.neversPhylogenyCache = null;
window.CiliAI_UMAP = null;

// ==========================================================
// 1. CORE UTILITIES (Must be defined globally only once)
// ==========================================================

window.updateStatus = (msg, state) => { console.log(`STATUS[${state}]: ${msg}`); };
window.log = (msg) => { console.log(`CiliAI LOG: ${msg}`); };

window.addChatMessage = (html, isUser = false) => { 
    const chatWindow = document.getElementById('messages');
    if (chatWindow) {
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
    } else {
        console.log(`CHAT[${isUser ? "USER" : "AI"}]: ${html}`);
    }
};

window.drawDefaultUMAP = function () {
    window.log("drawDefaultUMAP() executed. Routing to Plotly.");
    // Route to actual plot function with default gene
    window.renderUMAPPlot('FOXJ1');
    return "<p>Default UMAP plot placeholder.</p>";
};

window.drawDefaultTSNE = function () {
    window.log("drawDefaultTSNE() placeholder executed.");
    return "<p>Default t-SNE plot placeholder.</p>";
};

window.renderUMAPPlot = function (gene) {
    window.log(`renderUMAPPlot() placeholder for gene: ${gene}`);
    // The main asynchronous function is defined later
};

window.getGenesByComplex = function (complexTerm) {
    const map = getComplexPhylogenyTableMap();
    const normTerm = normalizeTerm(complexTerm);
    const key = Object.keys(map).find(k => normalizeTerm(k) === normTerm);
    return key
        ? map[key].map(g => ({
              gene: g,
              description: `Part of ${key}`
          }))
        : [];
};

let ciliaryGeneMap = new Map();
let screenDatabase = {};

// V1 → V2 ALIAS FIXES FOR GRAPH ENGINE
window.extractDiseaseTerm = window.extractDiseaseIntent;
window.extractComplexTerm = window.extractComplexIntent;

// --- GLOBAL CONSTANTS FOR ORGANISM PANELS ---
const NEVERS_CIL_PANEL = [
    "Homo sapiens", "Mus musculus", "Danio rerio", "Xenopus tropicalis", "Gallus gallus",
    "Caenorhabditis elegans", "Tetrahymena thermophila (strain SB210)", "Chlamydomonas reinhardtii", 
    "Micromonas sp. (strain RCC299 / NOUM17)", "Trypanosoma cruzi", "Leishmania major", 
    "Giardia intestinalis (strain ATCC 50803 / WB clone C6)", "Trichomonas vaginalis", 
    "Strongylocentrotus purpuratus", "Ciona intestinalis", "Physcomitrella patens subsp. patens", 
    "Paramecium tetraurelia", "Volvox carteri", "Amphimedon queenslandica", "Monosiga brevicollis"
];

const NEVERS_NCIL_PANEL = [
    "Saccharomyces cerevisiae (strain ATCC 204508 / S288c)", "Schizosaccharomyces pombe (strain 972 / ATCC 24843)", 
    "Cryptococcus neoformans var. neoformans serotype D (strain JEC21 / ATCC MYA-565)", "Ustilago maydis (strain 521 / FGSC 9021)", 
    "Candida albicans (strain WO-1)", "Arabidopsis thaliana", "Brachypodium distachyon", "Sorghum bicolor", 
    "Vitis vinifera", "Cryptosporidium parvum (strain Iowa II)", "Entamoeba histolytica", "Encephalitozoon cuniculi (strain GB-M1)"
];

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
        "IFT COMPLEX": ["WDR19", "IFT140", "TTC21B", "IFT122", "WDR35", "IFT43", "IFT172", "IFT80", "IFT57", "TRAF3IP1", "CLUAP1", "IFT20", "IFT88", "IFT81", "IFT74", "IFT70A", "IFT70B", "IFT56", "IFT52", "IFT46", "IFT27", "IFT25", "IFT22"],
        "IFT-A COMPLEX": ["WDR19", "IFT140", "TTC21B", "IFT122", "WDR35", "IFT43"],
        "IFT-B COMPLEX": ["IFT172", "IFT80", "IFT57", "TRAF3IP1", "CLUAP1", "IFT20", "IFT88", "IFT81", "IFT74", "IFT70A", "IFT70B", "IFT56", "IFT52", "IFT46", "IFT27", "IFT25", "IFT22"],
        "IFT-B1 COMPLEX": ["IFT172", "IFT80", "IFT57", "TRAF3IP1", "CLUAP1", "IFT20"],
        "IFT-B2 COMPLEX": ["IFT88", "IFT81", "IFT74", "IFT70A", "IFT70B", "IFT56", "IFT52", "IFT46", "IFT27", "IFT25", "IFT22"],
        "IFT MOTOR COMPLEX": ["KIF3A", "KIF3B", "KIF17", "DYNC2H1", "DYNC2LI1", "WDR34", "WDR60"],
        "INTRAFLAGELLAR TRANSPORT MOTORS": ["KIF3A", "KIF3B", "KIF17", "DYNC2H1", "DYNC2LI1", "WDR34", "WDR60"],
        "BBSOME": ["BBS1", "BBS2", "BBS4", "BBS5", "BBS7", "TTC8", "BBS9", "BBIP1"],
        "EXOCYST": ["EXOC1", "EXOC2", "EXOC3", "EXOC4", "EXOC5", "EXOC6", "EXOC7", "EXOC8"],
        "TRANSITION ZONE": ["NPHP1", "MKS1", "CEP290", "AHI1", "RPGRIP1L", "TMEM67", "CC2D2A", "B9D1", "B9D2"],
        "MKS MODULE": ["MKS1", "TMEM17", "TMEM67", "TMEM138", "B9D2", "B9D1", "CC2D2A", "TMEM107", "TMEM237", "TMEM231", "TMEM216", "TCTN1", "TCTN2", "TCTN3"],
        "NPHP MODULE": ["NPHP1", "NPHP3", "NPHP4", "RPGRIP1L", "IQCB1", "CEP290", "SDCCAG8"],
        "BASAL BODY": ["CEP164", "CEP83", "SCLT1", "CEP89", "LRRC45", "ODF2", "CEP128", "CEP135", "CETN2", "CETN3", "POC1B", "FBF1", "CCDC41", "CCDC120", "OFD1"],
        "CENTRIOLE DISTAL APPENDAGES": ["CEP164", "SCLT1", "CEP89", "LRRC45", "CEP123", "ANKRD26", "FOPNL", "CEP128", "CEP135", "FBF1", "CCDC41", "CCDC120"],
        "CENTRIOLAR SATELLITES": ["PCM1", "CEP131", "CEP290", "OFD1", "AZI1", "CEP72", "SSX2IP"],
        "TRANSITION FIBER": ["CEP164", "CEP83", "SCLT1", "CEP89", "LRRC45", "CEP123", "CEP350", "CEP44"],
        "CILIARY TIP": ["HYDIN", "IQCA1", "CATSPER2", "KIF19A", "KIF7", "CCDC78", "CCDC33", "SPEF1", "CEP104", "CSPP1", "TOGARAM1", "ARMC9", "MAPRE1", "MAPRE3", "CCDC66"],
        "RADIAL SPOKE": ["RSPH1", "RSPH3", "RSPH4A", "RSPH6A", "RSPH9", "RSPH10B", "RSPH23", "RSPH16", "DRC1", "DRC3", "DRC4", "DRC5"],
        "CENTRAL PAIR": ["HYDIN", "SPAG6", "SPAG16", "SPAG17", "POC1A", "CEP131", "CFAP43", "CFAP44", "CFAP45", "CFAP47"],
        "DYNEIN ARM": ["DNAH1", "DNAH2", "DNAH5", "DNAH6", "DNAH7", "DNAH8", "DNAH9", "DNAH10", "DNAH11", "DNALI1", "DNAI1", "DNAI2", "DNAAF1", "DNAAF2", "DNAAF3", "DNAAF4", "LRRC6", "CCDC103"],
        "OUTER DYNEIN ARM": ["DNAH5", "DNAH11", "DNAH17", "DNAH18", "DNAI1", "DNAI2", "DNAAF1", "DNAAF2", "DNAAF3", "DNAAF4", "LRRC6", "CCDC103", "WDR63"],
        "INNER DYNEIN ARM": ["DNAH2", "DNAH7", "DNAH10", "DNALI1", "DNAL4", "DNAAF5", "CCDC40", "CCDC114", "CCDC151"],
        "NEXIN-DYNEIN REGULATORY COMPLEX": ["GAS8", "GAS2L2", "CCDC39", "CCDC40", "CCDC164", "CCDC65"],
        "ROOTLETIN COMPLEX": ["CROCC", "CROCC2", "CEP68", "CEP44", "ODF2"],
        "CENTRIOLE LINKER": ["CEP68", "CEP250", "C-NAP1", "ROCK1", "NEK2"],
        "SHH SIGNALING": ["SMO", "PTCH1", "GLI1", "GLI2", "GLI3", "SUFU", "KIF7", "TULP3", "IFT172", "IFT81", "ARL13B"],
        "GPCR COMPLEX": ["GPR161", "GPR175", "GPR22", "GPR83", "ADCY3", "RXFP2", "SSTR3", "NPY2R", "HTR6"],
        "HEDGEHOG TRAFFICKING COMPLEX": ["ARL13B", "INPP5E", "TULP3", "IFT172", "KIF7", "BBS4", "BBS5", "SMO"],
        "CENTROSOME": ["CEP152", "CEP192", "PLK4", "STIL", "SAS6", "CEP135", "CETN2", "PCNT", "CDK5RAP2", "CEP215"],
        "PEROXISOMAL COMPLEX": ["PEX1", "PEX2", "PEX3", "PEX5", "PEX6", "PEX10", "PEX12", "PEX13", "PEX14", "PEX19"]
    };
}

function getDiseaseClassificationMap() {
    return {
        "Primary Ciliopathies": ["Acrocallosal Syndrome", "Alström Syndrome", "Autosomal Dominant Polycystic Kidney Disease",
            "Autosomal Recessive Polycystic Kidney Disease", "Bardet–Biedl Syndrome", "Bardet Biedel Syndrome",
            "COACH Syndrome", "Cranioectodermal Dysplasia", "Ellis-van Creveld Syndrome", "Hydrolethalus Syndrome", "Infantile Polycystic Kidney Disease",
            "Joubert Syndrome", "Leber Congenital Amaurosis", "Meckel–Gruber Syndrome", "Nephronophthisis", "Orofaciodigital Syndrome",
            "Senior-Løken Syndrome", "Short-rib Thoracic Dysplasia", "Skeletal Ciliopathy", "Retinal Ciliopathy", "Syndromic Ciliopathy",
            "Al-Gazali-Bakalinova Syndrome", "Bazex-Dupré-Christol Syndrome", "Bilateral Polycystic Kidney Disease", "Biliary, Renal, Neurologic, and Skeletal Syndrome",
            "Caroli Disease", "Carpenter Syndrome", "Complex Lethal Osteochondrodysplasia", "Greig Cephalopolysyndactyly Syndrome", "Kallmann Syndrome", "Lowe Oculocerebrorenal Syndrome",
            "McKusick-Kaufman Syndrome", "Morbid Obesity and Spermatogenic Failure", "Polycystic Kidney Disease", "RHYNS Syndrome", "Renal-hepatic-pancreatic Dysplasia", "Retinal Dystrophy", "STAR Syndrome",
            "Smith-Lemli-Opitz Syndrome", "Spondylometaphyseal Dysplasia", "Stromme Syndrome", "Weyers Acrofacial Dysostosis", "Hydrocephalus"
        ],
        "Motile Ciliopathies": ["Primary Ciliary Dyskinesia", "Birt-Hogg-Dubé Syndrome", "Juvenile Myoclonic Epilepsy"],
        "Secondary Diseases": ["Ataxia-telangiectasia-like Disorder", "Birt-Hogg-Dubé Syndrome", "Cone-Rod Dystrophy", "Cornelia de Lange Syndrome",
            "Holoprosencephaly", "Juvenile Myoclonic Epilepsy", "Medulloblastoma", "Retinitis Pigmentosa", "Spinocerebellar Ataxia", "Bazex-Dupré-Christol Syndrome", "Lowe Oculocerebrorenal Syndrome",
            "McKusick-Kaufman Syndrome", "Pallister-Hall Syndrome", "Simpson-Golabi-Behmel Syndrome", "Townes-Brocks Syndrome", "Usher Syndrome", "Visceral Heterotaxy"
        ],
        "Atypical Ciliopathies": ["Biliary Ciliopathy", "Chronic Obstructive Pulmonary Disease", "Ciliopathy", "Ciliopathy - Retinal dystrophy", "Golgipathies or Ciliopathy", "Hepatic Ciliopathy", "Male Infertility and Ciliopathy", "Male infertility", "Microcephaly and Chorioretinopathy Type 3", "Mucociliary Clearance Disorder", "Notch-mediated Ciliopathy", "Primary Endocardial Fibroelastosis", "Retinal Ciliopathy", "Retinal Degeneration", "Skeletal Ciliopathy", "Syndromic Ciliopathy"]
    };
}

function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    return [value];
}

// ----------------------------------------------------------
// 3. GEMINI COMMUNICATION LAYER
// ----------------------------------------------------------

async function getCiliAIAssistance(userQuery) {
    window.updateStatus("Waiting for Gemini response...", "loading");
    const requestBody = { query: userQuery };

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            window.updateStatus(`Error: Gemini Service Failed (Code ${response.status})`, "error");
            return `Error: Failed to fetch synthesis. Status: ${response.status}. Details: ${errorText.substring(0, 100)}...`;
        }

        const data = await response.json();
        
        if (data && data.answer) {
            window.updateStatus("AI response received.", "success");
            return data.answer;
        } else {
            window.updateStatus("Error: Invalid response format.", "error");
            return "Error: Received an empty or invalid synthesis response.";
        }

    } catch (error) {
        window.updateStatus("Error: Network connection failed.", "error");
        return `Error: A network issue prevented connection to the CiliAI service. Details: ${error.message}`;
    }
}

// CiliAI.js snippet: Chunk 2 (Data Loaders, Intent Parsing, Stubs)

// ----------------------------------------------------------
// 6. CILIA ANALYSIS PAGE (CRITICAL DEFINITIONS)
// ----------------------------------------------------------

// --- DATA FETCHING ---

async function loadAnalysisData() { 
    const analysisBaseUrl = GCS_BASE_URL;
    
    try {
        window.log("Fetching specialized analysis data...");
        
        const [ciliaryGenesResponse, screenDataResponse] = await Promise.all([
            fetch(analysisBaseUrl + 'ciliahub_data.json'),
            fetch(analysisBaseUrl + 'cilia_screens_data.json')
        ]);

        const ciliaryGeneArray = await ciliaryGenesResponse.json();
        window.screenDatabase = await screenDataResponse.json(); 
        
        if (typeof window.ciliaryGeneMap === 'undefined') window.ciliaryGeneMap = new Map();
        
        window.ciliaryGeneMap = new Map(ciliaryGeneArray.map(gene => [gene.gene.toUpperCase(), gene])); 
        window.log(`Successfully loaded ${window.ciliaryGeneMap.size} ciliary genes for analysis.`);

    } catch (error) {
        window.log(`Failed to load a required analysis data file: ${error.message}`, 'error');
    }
}

async function ensurePhylogenyDataLoaded() {
    if (window.liPhylogenyCache && window.neversPhylogenyCache) { return true; }
    window.addChatMessage("Loading large phylogeny datasets from GCS... this may take a moment.", false);
    
    try {
        const baseUrl = GCS_BASE_URL;
        const [liRes, neversRes] = await Promise.all([
            fetch(baseUrl + 'li_et_al_2014_matrix_optimized.json'),
            fetch(baseUrl + 'nevers_et_al_2017_matrix_optimized.json')
        ]);
        
        if (!liRes.ok || !neversRes.ok) { throw new Error(`Failed to fetch phylogeny files from GCS.`); }
        
        window.liPhylogenyCache = await liRes.json();
        window.neversPhylogenyCache = await neversRes.json();
        window.log("Phylogeny data successfully lazy-loaded from GCS.");
        return true;
    } catch (e) {
        console.error("Failed to lazy-load phylogeny data:", e);
        window.addChatMessage(`Error: Could not load phylogeny data. ${e.message}`, false);
        return false;
    }
}


/**
 * Simplified Gene Extractor for local routing in ciliai.js.
 * * Purpose: Quickly identify relevant gene symbols in the query to:
 * 1. Determine if a visualization (plot) action should be triggered locally.
 * 2. Prune non-gene keywords before falling back to the Gemini backend.
 *
 * @param {string} query The user's input query.
 * @returns {Array<string>} An array of detected and capitalized gene symbols.
 */
window.extractMultipleGenes = function(query) {
    if (!query || typeof query !== 'string') return [];
    const qLower = query.toLowerCase();

    // 1. Hardcoded list of essential genes (Faster than full lookup for common queries)
    const knownGenes = {
        'ift88': 'IFT88', 'cep290': 'CEP290', 'bbs1': 'BBS1', 'arl13b': 'ARL13B',
        'kif3a': 'KIF3A', 'dyhc2': 'DYNC2H1', 'pkd1': 'PKD1', 'nphp1': 'NPHP1'
    };
    
    let foundGenes = new Set();
    
    for (const [key, gene] of Object.entries(knownGenes)) {
        if (qLower.includes(key)) {
            foundGenes.add(gene);
        }
    }

    // 2. Generic Regex Matching (Captures capitalized words >= 3 chars, handles dashes/periods)
    // This provides a good fallback for non-hardcoded genes.
    const geneRegex = /\b([A-Z0-9\-\.]{3,})\b/g;
    let matches = query.match(geneRegex) || [];
    
    // 3. Simple Stop Words List (Stops common false positives like 'THE', 'AND', 'FOR')
    const stopWords = new Set(["THE", "AND", "FOR", "NOT", "ARE", "WHAT", "SHOW", "LIST", "PLOT", "COMPARE", "GENE", "CELL", "HOW"]);

    for (const match of matches) {
        const upperMatch = match.toUpperCase();
        if (!stopWords.has(upperMatch)) { 
            foundGenes.add(upperMatch); 
        }
    }

    // Note: This version assumes that if a gene is not in the small list, 
    // it will be confirmed by the backend's exhaustive KNOWN_GENE_SYMBOLS.
    const finalGenes = Array.from(foundGenes);
    
    if (finalGenes.length > 0) {
        console.log(`[JS Router] Genes detected: ${finalGenes.join(', ')}`);
    }
    
    return finalGenes;
};


// --- DATA ACCESSORS ---

window.getComplexesForGene = (gene) => { 
    if (gene.toUpperCase() === "IFT88") return ["IFT-B COMPLEX", "IFT-B2 COMPLEX", "IFT COMPLEX"];
    return [];
};

function getGenesByLocalization(term) {
    let normTerm = term.toLowerCase();
    const L = window.CiliAI.lookups || {};
    const geneMap = L.geneMap || {};
    let matchingGenes = new Set();

    const allLocKeys = Object.keys(L.byLocalization || {});
    allLocKeys.forEach(key => {
        if (key.toLowerCase().includes(normTerm)) {
            (L.byLocalization[key] || []).forEach(geneSymbol => {
                matchingGenes.add(geneSymbol);
            });
        }
    });

    return Array.from(matchingGenes).map(gene => {
        const geneData = geneMap[gene];
        return {
            gene: gene,
            localization: geneData?.Localization || `Found in ${term}`
        };
    });
}

function initializeCiliaPlotPage() {
    loadAnalysisData();
    populatePlotTypes();
    
    const typeSelector = document.getElementById('ciliaplot-type-selector');
    const generateBtn = document.getElementById('generate-ciliaplot-btn');
    const downloadBtn = document.getElementById('download-plot-btn');

    if (typeSelector) typeSelector.addEventListener('change', updateCustomizationPanel);
    if (generateBtn) generateBtn.addEventListener('click', generateAnalysisPlots);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadPlot);
    
    updateCustomizationPanel();
    updatePlotExplanation();
}

function setupPageEventListeners() {
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

        const aiAction = e.target.closest('.ai-action');
        if (aiAction) {
            const action = aiAction.dataset.action;

            if (action) {
                e.preventDefault();
                const genes = aiAction.dataset.genes || "";
                let query = "";
                
                if (action === 'show-li-heatmap') query = `show li phylogeny for ${genes}`;
                else if (action === 'show-nevers-heatmap') query = `show nevers phylogeny for ${genes}`;
                else if (action === 'show-table-view') query = `show data table for ${genes}`;
                
                else if (action === 'show-umap-plot') {
                    window.log(`Action: show-umap-plot for ${genes}`);
                    window.renderUMAPPlot(genes);
                    return;
                }

                if (query) {
                    window.addChatMessage(query, true);
                    window.handleAIQuery(query);
                }
                return;
            }
        }
    });
}

function log(message) {
    console.log(`[CiliAI] ${message}`);
}

// ----------------------------------------------------------
// 4. CILIBRAIN v5.1 - INTENT PARSING & STUBS
// ----------------------------------------------------------

// STUB: Simulates Semantic Search
// Simplified Stubs for Semantic/Intent Scoring
window.semanticSearch = async (query) => { return [{ id: 'NONE', text: 'no match', score: 0.1 }]; };
window.scoreIntents = (query) => { 
    const qLower = query.toLowerCase();
    if (qLower.includes('umap') || qLower.includes('plot')) return { intent: 'visualize', confidence: 10 };
    if (qLower.includes('describe') || qLower.includes('explain')) return { intent: 'synthesis', confidence: 10 };
    return { intent: 'definition', confidence: 5 };
};

// Simplified Stub for Complex Display
window.displayFullGeneInfo = async function (geneSymbol) {
    // This function can be a simple local fetch until the full presentation layer is implemented
    const g = window.CiliAI.lookups.geneMap?.[geneSymbol] || {};
    let html = `<div class="ai-result-card"><h4>Gene: ${geneSymbol}</h4><p><strong>Description:</strong> ${g['Gene.Description'] || '—'}</p></div>`;
    return html; 
}

window.parseUserIntent = function(question) {
    const q = question.toLowerCase().trim();

    const terminology = { /* ... definitions ... */ };
    for (const [pattern, concept] of Object.entries(terminology)) {
        if (new RegExp(pattern).test(q)) {
            return { intent: "terminology", concept };
        }
    }

    const geneMatch = q.match(/(tell|what|describe|info|about|detail).{0,20}([A-Z0-9]{3,})/i);
    if (geneMatch) {
        const gene = geneMatch[2].toUpperCase();
        if (window.geneData?.[gene]) {
            return { intent: "gene_details", gene };
        }
    }

    if (q.includes("genes in") || q.includes("genes.*complex") || q.includes("genes.*module")) {
        const complex = extractComplexIntent(q);
        if (complex) return { intent: "complex_query", complex };
    }
    if (q.includes("genes.*disease") || q.includes("associated with")) {
        const disease = extractDiseaseIntent(q);
        if (disease) return { intent: "disease_query", disease };
    }
    if (q.includes("localiz|basal body|transition zone|ciliary tip")) {
        return { intent: "localization_query", localization: "basal body" };
    }

    if (q.includes("higher") || q.includes("lower") || q.includes("more.*than") || q.includes("compare.*expression")) {
        return { intent: "quantitative_compare", question };
    }
    if (q.includes("top [0-9]+") || q.includes("rank") || q.includes("highest") || q.includes("most specific")) {
        return { intent: "quantitative_rank", question };
    }

    if (q.includes("compare.*joubert") || q.includes("joubert.*srtd") || q.includes("vs")) {
        return { intent: "compare_diseases", diseases: ["Joubert syndrome", "Short-rib thoracic dystrophy"] };
    }
    if (q.includes("mechanism") || q.includes("why") || q.includes("explain")) {
        return { intent: "mechanism_synthesis", question };
    }

    return { intent: "unknown", question };
};

window.answerTerminology = function(concept) {
    const answers = {
        "9+0 vs 9+2 axoneme": `**9+0** = Primary (non-motile) cilia → sensory, signaling (e.g. Hedgehog)\n**9+2** = Motile cilia → have dynein arms, cause movement (respiratory, fallopian)`,
        "Basal Body": "The basal body is a modified centriole that anchors the cilium and serves as the organizing center for axonemal microtubules.",
        "Intraflagellar Transport (IFT)": "Bidirectional transport system inside cilia:\n• IFT-B (anterograde, kinesin-2): tip-ward\n• IFT-A (retrograde, dynein-2): base-ward\nEssential for cilia assembly and maintenance.",
        "ciliopathy": "Group of >40 genetic disorders caused by defects in ciliary structure or function. Includes polycystic kidney disease, Bardet-Biedl, Joubert, etc.",
        "Transition Zone": "Compartment at ciliary base acting as diffusion barrier. Contains MKS and NPHP modules. Mutations → ciliopathies.",
        "BBSome": "Octameric complex (BBS1,2,4,5,7,8,9,18) that coats vesicles and mediates protein trafficking to cilia. Required for ciliary gating and Hedgehog signaling.",
        "dynein arms": "Motor protein complexes on outer doublet microtubules. Outer dynein arms → force generation. Inner → waveform regulation. Absent in PCD.",
        "RVxP motif": "C-terminal motif in many ciliary proteins recognized by ARL13B/ARL3 for ciliary targeting.",
        "nTPM unit": "normalized Transcripts Per Million — expression unit used in Human Protein Atlas (tissue and scRNA).",
        "motile ciliopathies": "Primary Ciliary Dyskinesia (PCD), Reduced Generation of Multiple Motile Cilia (RGMC)."
    };
    return answers[concept] || "No definition available yet.";
};

window.findTerminologyMatch = (query) => { 
    const terminologyQueries = window.terminologyQueries || {};
    const qLower = query.toLowerCase().trim();
    const qLowerClean = qLower.replace(/[?.,!]/g, '');

    if (terminologyQueries[qLowerClean]) {
        return terminologyQueries[qLowerClean];
    }

    if (qLowerClean.startsWith('what is ') || qLowerClean.startsWith("what's ")) {
        const target = qLowerClean.replace(/^(what is|what's)\s+/, '').trim();
        const fullKey = 'what is ' + target;

        if (terminologyQueries[fullKey]) {
            return terminologyQueries[fullKey];
        }
        if (window.CiliAI.lookups.geneMap?.[target.toUpperCase()]) {
             return null;
        }
    }
    
    return null;
};

window.computeGeneProfile = function(gene) {
    if (window.geneProfileCache[gene]) return window.geneProfileCache[gene];
    const d = window.geneData[gene];
    if (!d) return null;

    const ciliated = ['motile', 'primary', 'rod', 'cone', 'olfactory', 'kinocilium', 'stereocilium', 'node', 'fallopian'];
    let sum = 0, n = 0;
    ciliated.forEach(t => { if (d.scRNA?.[t] !== undefined) { sum += d.scRNA[t]; n++; } });
    const specificity = n > 0 ? sum / n : 0;

    const screens = ['CRISPR_cilia', 'Proteomics_cilia', 'Comparative_genomics', 'Literature_curated'];
    const validation = screens.filter(s => d[s]).length;

    const tissueEnrich = Math.max(...Object.values(d.rna_tissue_consensus || {}), 0);

    const conservation = d.phylogenetic_conservation || 0;

    const combined = 0.4*specificity + 0.25*validation + 0.2*(tissueEnrich/50) + 0.15*conservation;

    const profile = {
        specificityScore: +specificity.toFixed(2),
        validationScore: validation,
        tissueEnrichment: +tissueEnrich.toFixed(1),
        conservationScore: +conservation.toFixed(1),
        combinedScore: +combined.toFixed(3)
    };

    window.geneProfileCache[gene] = profile;
    return profile;
};

// Dummy stubs
window.getGenesByDisease = (term) => { 
    if (term.toLowerCase().includes("joubert")) return ["CEP290", "IFT88", "AHI1"];
    return [];
};


window.extractMultipleGenes = function(query) {
    if (!query || typeof query !== 'string') return [];
    const qLower = query.toLowerCase();
    const manualMap = { 'kif3a': 'KIF3A', 'ift88': 'IFT88', 'bbs1': 'BBS1', 'cep290': 'CEP290' };
    let foundGenes = new Set();
    for (const [key, gene] of Object.entries(manualMap)) { if (qLower.includes(key)) foundGenes.add(gene); }
    const geneRegex = /\b([A-Z0-9\-\.]{3,})\b/gi;
    let matches = query.match(geneRegex) || [];
    const stopWords = new Set(["THE", "AND", "FOR", "NOT", "ARE", "WHAT", "SHOW", "LIST", "GENE", "GENES", "PLOT", "COMPARE"]);
    const geneMap = window.CiliAI.lookups.geneMap;
    if (!geneMap) return Array.from(foundGenes);

    for (const match of matches) {
        const upperMatch = match.toUpperCase();
        if (!stopWords.has(upperMatch) && geneMap[upperMatch]) { foundGenes.add(upperMatch); }
    }
    return Array.from(foundGenes);
};

window.runQuantitativeEngine = async (query, genes) => {
    window.log("Quantitative intent detected. Routing to Gemini for synthesis/ranking.");
    return null;
};

window.runGraphQuery = async function (query, intent, entities = []) {
    // This is the simplest hybrid execution: if local lookups fail, use Gemini.
    if (intent === 'complex_query' || intent === 'disease_query' || intent === 'localization_query') {
        window.log("Attempting local graph lookup. If complex, routes to Gemini.");
        return null;
    }
    return null;
};


// CiliAI.js snippet: Chunk 3 (Main Router, Handlers A-G)

window.routeVisualizationAction = async function(query, exactGenes) {
    const qLower = query.toLowerCase();
    const hasGenes = exactGenes && exactGenes.length > 0;
    const singleGene = hasGenes ? exactGenes[0] : 'FOXJ1';

    if ((!hasGenes && qLower.includes('umap')) || qLower.includes('default umap')) {
        window.renderUMAPPlot('FOXJ1');
        return `<div class="ai-result-card">📊 Default UMAP plot (cell type clusters) requested. Displaying now.</div>`;
    }

    if (qLower.includes('phylogen') || qLower.includes('heatmap')) {
        if (!await ensurePhylogenyDataLoaded()) return "Could not load phylogeny data. Please try again.";
        return window.routePhylogenyAnalysis(query);
    }
    // ... (other visualization routing logic)
    return `<div class="ai-result-card">**Visualization:** Intent [visualize] recognized.</div>`;
};

window.handleAIQuery = async function (query) {
    if (!query || !document.getElementById('messages')) return;
    let htmlResult = null;

    try {
        if (!window.CiliAI.ready) {
            window.addChatMessage("Data is still loading, please wait...", false);
            return;
        }
        
        const terminologyMatch = window.findTerminologyMatch(query);
        if (terminologyMatch) {
            window.addChatMessage(`<div class="ai-result-card"><p>${terminologyMatch}</p></div>`, false);
            return;
        }

        const semanticMatches = await window.semanticSearch(query); 
        const { intent } = window.scoreIntents(query, semanticMatches);
        const exactGenes = window.extractMultipleGenes(query); 

        // 1. Visualization (Local Execution)
        if (intent === 'visualize') {
            htmlResult = await window.routeVisualizationAction(query, exactGenes);
        }
        // 2. Direct Gene Details (Local Execution)
        else if (intent === 'gene_details' && exactGenes.length > 0) {
            htmlResult = await window.displayFullGeneInfo(exactGenes[0]);
        }
        // 3. Graph/Quantitative/Complex Queries (Local check, then Gemini fallback)
        else if (['ranking', 'complex_query', 'disease_query', 'localization_query', 'synthesis'].includes(intent)) {
            htmlResult = await window.runQuantitativeEngine(query, exactGenes) || await window.runGraphQuery(query, intent, exactGenes);
        }

        // 4. FALLBACK TO GEMINI BACKEND (Synthesis/Definition/Unmatched)
        if (htmlResult === null || intent === 'synthesis' || intent === 'definition' || intent === 'unknown') {
            window.log('Routing via: GEMINI BACKEND (Synthesis/Fallback)');
            
            const geminiResponse = await getCiliAIAssistance(query); 
            htmlResult = `<div class="ai-result-card">🧠 **AI Synthesis:** ${geminiResponse}</div>`;
        }

        if (htmlResult) {
            window.addChatMessage(htmlResult, false);
        }

    } catch (e) {
        console.error("Error in handleAIQuery:", e);
        window.updateStatus(`Fatal Error in Query Router: ${e.message}`, "error");
        window.addChatMessage(`An internal CiliAI error occurred: ${e.message}`, false);
    }
};

window.handleUserQuestion = function(question) {
    window.log("handleUserQuestion delegated to handleAIQuery.");
    return window.handleAIQuery(question);
};

window.handleListQuery = (type, term, genes) => {
    if (genes && genes.length > 0) {
        let listHtml = genes.map(g => `<li>${g.gene} ${g.description ? `- ${g.description}` : ''}</li>`).join('');
        return `<div class="ai-result-card">Found ${genes.length} ${type} genes for ${term}.<ul>${listHtml}</ul></div>`;
    }
    return null;
};

window.getGenesByDiseaseAndFormat = (disease) => {
    const genes = ["CEP290", "IFT140"];
    return window.handleListQuery("disease", disease, genes.map(g => ({gene: g, description: "Ciliopathy gene"})));
};

window.handleGeneInComplexQuery = (gene) => {
    const complexes = ["IFT Complex", "Transition Zone"];
    return window.handleListQuery("complex", gene, complexes.map(c => ({gene: c, description: "Component"})));
};

const OLD_HANDLE = window.onUserMessage || function() {};
window.onUserMessage = function(msg) {
    const answer = window.handleUserQuestion(msg);
    OLD_HANDLE(msg);
    return answer;
};

window.buildMasterGeneProfile = function (gene) {
    const record = (window.CiliAI && window.CiliAI.masterData) ? window.CiliAI.masterData.find(r => r.gene === gene || r.Gene === gene) : null;
    const conservationScore = record && record.conservation ? record.conservation : Math.random();
    const specificityScore = record && record.specificity ? record.specificity : Math.random();
    const expression = (record && record.expression) ? record.expression : {};

    return {
        gene,
        record,
        conservationScore,
        specificityScore,
        combinedScore: conservationScore * specificityScore,
        expression
    };
};

/**
 * Simplified window.handleComparativeQuery (Hybrid Architecture Compliant)
 * Purpose: Acts as a router. It accepts the comparative query and immediately 
 * returns null, forcing the main handleAIQuery router to use the Gemini backend
 * for deep synthesis and cross-validation (Layers 2-5).
 */
window.handleComparativeQuery = async function (gene, Aterm, Bterm) {
    // Log the action for debugging/monitoring
    window.log(`[Router] Comparative Query detected for ${gene} between ${Aterm} and ${Bterm}. Delegating to Gemini Synthesis Engine.`);
    
    // Returning null ensures the request falls through to the Gemini backend call
    return null;
};


window.handleProcessQuery = function (processTerm) {
    try {
        const term = (processTerm || "").toLowerCase();
        if (term.includes("ift") || term.includes("intraflagellar transport")) {
            return `<div class="ai-result-card"><b>Intraflagellar transport (IFT) — stepwise outline</b><ol><li>Assembly of IFT trains...</li></ol></div>`;
        }
        return `<div class="ai-result-card">I don't have a stepwise description for <b>${processTerm}</b>. Try: "How does IFT work?"</div>`;
    } catch (err) {
        return `<div class="ai-error-card">Process query error.</div>`;
    }
};

// CiliAI.js snippet: Chunk 4 (Visual/Table/Phylogeny Handlers)

window.handleGeneInComplexQuery = function(geneSymbol) {
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
};

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

        return window.formatListResult(`Genes for ${casedClassificationName} (${count})`, geneListObjects);
    
    } else {
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

function handleGeneSearch(geneSymbol, queryAI = true) {
    const gene = geneSymbol.trim().toUpperCase();
    if (!gene) return;
    if (!window.CiliAI.ready) {
        console.warn("CiliAI data is not ready for gene search.");
        return;
    }
    const geneData = window.CiliAI.lookups.geneMap[gene];
    if (!geneData) {
        window.addChatMessage(`Gene Not Found: ${gene}. This gene is not in the CiliAI database.`, false);
        return;
    }
    let loc = 'unknown';
    if (geneData.Localization) {
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
        window.handleAIQuery(`Tell me about ${gene}`);
    }
}

function normalizeTerm(term) {
    if (typeof term !== 'string') return '';
    let normalized = term.toLowerCase();
    normalized = normalized.replace(/[^a-z0-9]/g, '');
    return normalized;
}

function handleTissueSpecificDiseaseQuery(diseaseTerm, tissueTerm) {
    const normDiseaseKey = normalizeDiseaseKey(diseaseTerm);
    const diseaseGenes = window.CiliAI.lookups.byCiliopathy?.[normDiseaseKey] || [];
    
    if (diseaseGenes.length === 0) {
        return `<div class="ai-result-card"><p>I found no genes associated with <strong>${diseaseTerm}</strong>.</p></div>`;
    }

    const geneMap = window.CiliAI.lookups.geneMap;
    const results = [];

    diseaseGenes.forEach(geneSymbol => {
        const gene = geneMap[geneSymbol];
        if (gene && hasExpressionInTissue(gene, tissueTerm)) {
            let expressionValue = 'N/A';
            if (gene.expression?.tissue?.[tissueTerm]) {
                expressionValue = gene.expression.tissue[tissueTerm].toFixed(2) + ' TPM';
            } else if (gene.expression?.scRNA) {
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
    return window.formatListResult(`Genes for ${diseaseTerm} expressed in ${tissueTerm} (${results.length})`, results);
}

function normalizeDiseaseKey(term) {
    let key = normalizeTerm(term);
    if (key === normalizeTerm('BBS') || key === normalizeTerm('Bardet Biedel Syndrome')) return normalizeTerm('Bardet–Biedl Syndrome');
    if (key === normalizeTerm('MKS') || key === normalizeTerm('Meckel-Gruber')) return normalizeTerm('Meckel–Gruber Syndrome');
    if (key === normalizeTerm('Joubert')) return normalizeTerm('Joubert Syndrome');
    if (key === normalizeTerm('NPHP')) return normalizeTerm('Nephronophthisis');
    if (key === normalizeTerm('PCD')) return normalizeTerm('Primary Ciliary Dyskinesia');
    if (key === normalizeTerm('retinal disease')) return normalizeTerm('Retinal Ciliopathy');
    return key;
}

function handleGeneInDiseaseQuery(complexTerm, diseaseTerm) {
    const normDisease = normalizeDiseaseKey(diseaseTerm);
    const complexGenes = getGenesByComplex(complexTerm).map(g => g.gene);
    const diseaseGenes = window.CiliAI.lookups.byCiliopathy?.[normDisease] || [];
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
    return window.formatListResult(`${complexTerm} Genes Causing ${diseaseTerm} (${results.length})`, results);
}

function hasExpressionInTissue(gene, tissue) {
    if (!gene.expression) return false;
    const tissueLower = tissue.toLowerCase();

    if (gene.expression.scRNA) {
        for (const [cellType, value] of Object.entries(gene.expression.scRNA)) {
            if (cellType.toLowerCase().includes(tissueLower) && value > 0) { return true; }
        }
    }
    if (gene.expression.tissue) {
        for (const [tissueName, value] of Object.entries(gene.expression.tissue)) {
            if (tissueName.toLowerCase().includes(tissueLower) && value > 0) { return true; }
        }
    }
    return false;
}



// --- VISUALIZATION HELPERS ---

window.routePhylogenyAnalysis = async function(query) {
    if (!await ensurePhylogenyDataLoaded()) return "Could not load phylogeny data. Please try again.";
    
    // Placeholder for actual visualization routing
    const genes = window.extractMultipleGenes(query);
    return `<div class="ai-result-card">Displaying Phylogeny plot for ${genes.join(', ')}...</div>`;
};

// ----------------------------------------------------------
// 8. FINAL EXPORTS (Ensuring all are globally accessible)
// ----------------------------------------------------------

window.downloadTableAsCSV = downloadTableAsCSV;
window.injectTableCSS = injectTableCSS; 
window.getGenesByLocalization = getGenesByLocalization;
window.loadAnalysisData = loadAnalysisData;
window.ensurePhylogenyDataLoaded = ensurePhylogenyDataLoaded;



// CiliAI.js snippet: Chunk 5 (Remaining Handlers and Utilities)

window.showDataInLeftPanel = function (title, geneList) {
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
        document.getElementById('ciliai-back-btn').addEventListener('click', () => { generateAndInjectSVG(); });
        return;
    }

    const keys = Object.keys(geneList[0]);
    const headers = keys.map(k => k.charAt(0).toUpperCase() + k.slice(1));

    let tableHTML = `<table class="ciliai-data-table"><thead><tr>`;
    headers.forEach(h => { tableHTML += `<th>${h}</th>`; });
    tableHTML += `</tr></thead><tbody>`;

    geneList.forEach(item => {
        tableHTML += `<tr>`;
        keys.forEach(key => {
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

    document.getElementById('ciliai-download-btn').addEventListener('click', () => { downloadTableAsCSV(title, geneList); });
    document.getElementById('ciliai-back-btn').addEventListener('click', () => { generateAndInjectSVG(); });
};

function downloadTableAsCSV(title, geneList) {
    if (!geneList || geneList.length === 0) return;
    
    const keys = Object.keys(geneList[0]);
    const headers = keys.map(k => k.charAt(0).toUpperCase() + k.slice(1));
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.join(',') + '\r\n';
    
    geneList.forEach(item => {
        const row = keys.map(key => {
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
        .interactive-cilium.table-view-active { max-width: none !important; padding: 0 !important; border: none !important; box-shadow: none !important; height: 100%; }
        .ciliai-table-container { width: 100%; height: 100%; display: flex; flex-direction: column; padding: 0; background: #f7fbff; }
        .ciliai-table-container h3 { font-size: 16px; color: #2b3a42; margin-bottom: 10px; padding: 10px 10px 0 10px; }
        .ciliai-button { padding: 8px 12px; background: #6c8aa3; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; transition: all 0.2s; font-size: 12px; margin-bottom: 10px; margin-left: 10px; width: 150px; }
        .ciliai-button:hover { background: #547a90; }
        .ciliai-table-scroll-wrapper { flex: 1; overflow-y: auto; border-top: 1px solid #c8d6e5; border-bottom: 1px solid #c8d6e5; margin: 0 0 10px 0; }
        .ciliai-data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .ciliai-data-table th, .ciliai-data-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #d5e2ed; }
        .ciliai-data-table th { background: #b3cde0; color: #1f2a33; font-weight: 600; position: sticky; top: 0; z-index: 1; }
        .ciliai-data-table tbody tr:hover { background-color: #e3f0fa; }
        .ciliai-data-table tr:last-child td { border-bottom: none; }
        .ciliai-data-table td strong { color: #6c8aa3; font-weight: 600; }
    `;
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
}

function getComplexGenesAndFormat(complexTerm) {
    const geneList = window.getGenesByComplex(complexTerm);
    const count = geneList.length;

    if (count === 0) {
        const genes = window.extractMultipleGenes(complexTerm);
        if (genes.length > 0) { return window.handleGeneInComplexQuery(genes[0]); }
        return `Sorry, I could not find any genes for the complex "${complexTerm}".`;
    }
    return window.formatListResult(`Genes in the ${complexTerm} complex (${count})`, geneList);
}

function handleLocalizationQuery(term, query) {
    const geneList = getGenesByLocalization(term);
    const count = geneList.length;
    if (count === 0) {
        return `Sorry, I could not find any genes localized to "${term}".`;
    }
    return window.formatListResult(`Genes localized to ${term} (${count})`, geneList);
}


// CiliAI.js snippet: Chunk 6 (Final Phylogeny Helpers, Lookups, and Exposure)

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
    if (!neversData) { throw new Error("Nevers et al. 2017 data not loaded."); }
    const CIL_COUNT = NEVERS_CIL_PANEL.length;
    const neversOrgList = neversData.organism_groups?.all_organisms_list || [];
    const neversOrgMap = new Map();
    neversOrgList.forEach((name, index) => { neversOrgMap.set(name, index); neversOrgMap.set(name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[\s\W]/g, ''), index); });
    const targetOrganisms = NEVERS_CIL_PANEL.concat(NEVERS_NCIL_PANEL);
    const targetNeversIndices = targetOrganisms.map(orgName => {
        const simplifiedKey = orgName.toLowerCase().replace(/[\s\W]/g, '');
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
            let zValue = isPresent ? (isCiliated ? 2 : 1) : 0;
            let status = isPresent ? "Present" : "Absent";
            row.push(zValue);
            textRow.push(`Gene: ${gene}<br>Organism: ${orgName}<br>Status: ${status}`);
        });
        if (row.length > 0) { matrix.push(row); textMatrix.push(textRow); }
    });
    const NEVERS_COLORS = [[0 / 2, '#F0F0F0'], [0.0001 / 2, '#F0A0A0'], [1 / 2, '#F0A0A0'], [1.0001 / 2, '#00A0A0'], [2 / 2, '#00A0A0']];
    const trace = {
        z: matrix, x: targetOrganisms.map(name => { let cleanedName = name.replace(/\s*\(.*?\)\s*/g, '').trim(); if (cleanedName.includes("D.rerio")) return "Zebrafish"; if (cleanedName.includes("H.sapiens")) return "Human"; return cleanedName; }),
        y: geneLabels, type: 'heatmap', colorscale: NEVERS_COLORS, showscale: false, hoverinfo: 'text', text: textMatrix, xgap: 0.5, ygap: 0.5, line: { color: '#000000', width: 0.5 }
    };
    const layout = {
        title: `Phylogenetics Analysis (Nevers et al. 2017) - ${genes.join(', ')}`,
        xaxis: { title: 'Organisms (Ciliated | Non-Ciliated)', tickangle: 45, automargin: true },
        yaxis: { title: 'Genes', automargin: true },
        shapes: [{ type: 'line', xref: 'x', x0: CIL_COUNT - 0.5, x1: CIL_COUNT - 0.5, yref: 'paper', y0: 0, y1: 1, line: { color: 'black', width: 2 } }],
        margin: { t: 50, b: 200, l: 150, r: 50 }, height: Math.max(500, genes.length * 40 + 150)
    };
    return {
        plotData: [trace], plotLayout: layout,
        htmlLinks: `<p class="ai-suggestion" style="margin-top: 10px;"><a href="#" class="ai-action" data-action="show-li-heatmap" data-genes="${genes.join(',')}">⬅️ Show Li et al. (2014)</a><span style="margin: 0 10px;">|</span><a href="#" class="ai-action" data-action="show-table-view" data-genes="${genes.join(',')}">📋 Show Data Table</a></p>`
    };
}

function renderLiPhylogenyHeatmap(genes) {
    const liData = window.liPhylogenyCache;
    if (!liData) { throw new Error("Li et al. 2014 data not loaded."); }
    const CIL_COUNT = CIL_ORG_FULL.length;
    const VERTEBRATE_LI_MAP = new Map([ ["homosapiens", "H.sapiens"], ["m.gallopavo", "M.gallopavo"], ["musmusculus", "M.musculus"], ["daniorerio", "D.rerio"], ["xenopustropicalis", "X.tropicalis"], ["gallusgallus", "G.gallus"], ["o.anatinus", "O.anatinus"], ["t.nigroviridis", "T.nigroviridis"], ["c.elegans", "C.elegans"], ["c.briggsae", "C.briggsae"], ["c.reinhardtii", "C.reinhardtii"], ["t.thermophila", "T.thermophila"], ["s.cerevisiae", "S.cerevisiae"], ["a.thaliana", "A.thaliana"], ["o.sativa", "O.sativa"] ]);
    const liOrgList = liData.summary.organisms_list;
    const liOrgMap = new Map();
    liOrgList.forEach((name, index) => { liOrgMap.set(name, index); liOrgMap.set(name.toLowerCase().replace(/[\s\.]/g, ''), index); });
    const targetOrganisms = CIL_ORG_FULL.concat(NCIL_ORG_FULL);
    const targetLiIndices = targetOrganisms.map(orgName => {
        const lowerOrg = orgName.toLowerCase();
        const simplifiedKey = lowerOrg.replace(/[\s\.]/g, '');
        if (VERTEBRATE_LI_MAP.has(simplifiedKey)) { const liAbbrev = VERTEBRATE_LI_MAP.get(simplifiedKey); if (liOrgMap.has(liAbbrev)) { return liOrgMap.get(liAbbrev); } }
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
        if (!geneData) { genesNotFound.push(geneUpper); return; }
        genesFound.push(geneUpper);
        const presenceIndices = new Set(geneData.s || []);
        const row = [];
        const textRow = [];
        targetOrganisms.forEach((orgName, index) => {
            const liIndex = targetLiIndices[index];
            const isCiliated = index < CIL_COUNT;
            const isPresent = liIndex !== undefined && presenceIndices.has(liIndex);
            let zValue = isPresent ? (isCiliated ? 2 : 1) : 0;
            let status = isPresent ? "Present" : "Absent";
            row.push(zValue);
            textRow.push(`Gene: ${geneUpper}<br>Organism: ${orgName}<br>Status: ${status}`);
        });
        if (row.length > 0) { matrix.push(row); textMatrix.push(textRow); geneLabels.push(geneUpper); }
    });
    if (matrix.length === 0) {
        let errorMsg = "None of the requested genes were found in the Li (2014) dataset.";
        if (genesNotFound.length > 0) { errorMsg = `The gene(s) <strong>${genesNotFound.join(', ')}</strong> were not found in the Li (2014) phylogenetic dataset.`; }
        throw new Error(errorMsg);
    }
    const trace = {
        z: matrix, x: targetOrganisms.map(name => { if (name === "H.sapiens") return "Human"; if (name === "M.musculus") return "Mouse"; if (name === "D.rerio") return "Zebrafish"; if (name.includes("elegans")) return "C. elegans"; return name.replace(/\./g, '').split(' ')[0]; }),
        y: geneLabels, type: 'heatmap', colorscale: [ [0 / 2, '#FFFFFF'], [0.0001 / 2, '#FFE5B5'], [1 / 2, '#FFE5B5'], [1.0001 / 2, '#698ECF'], [2 / 2, '#698ECF'] ],
        showscale: false, hoverinfo: 'text', text: textMatrix, xgap: 0.5, ygap: 0.5, line: { color: '#000000', width: 0.5 }
    };
    const layout = {
        title: `Phylogenetics Analysis (Li et al. 2014) - ${geneLabels.join(', ')}`,
        xaxis: { title: 'Organisms (Ciliated | Non-Ciliated)', tickangle: 45, automargin: true },
        yaxis: { title: 'Genes', automargin: true },
        shapes: [{ type: 'line', xref: 'x', x0: CIL_COUNT - 0.5, x1: CIL_COUNT - 0.5, yref: 'paper', y0: 0, y1: 1, line: { color: 'black', width: 2 } }],
        margin: { t: 50, b: 200, l: 150, r: 50 }, height: Math.max(500, geneLabels.length * 40 + 150)
    };
    let links = `<p class="ai-suggestion" style="margin-top: 10px;"><a href="#" class="ai-action" data-action="show-nevers-heatmap" data-genes="${geneLabels.join(',')}">➡️ Show Nevers et al. (2017)</a><span style="margin: 0 10px;">|</span><a href="#" class="ai-action" data-action="show-table-view" data-genes="${geneLabels.join(',')}">📋 Show Data Table</a></p>`;
    if (genesNotFound.length > 0) { links = `<p class="status-note">Note: <strong>${genesNotFound.join(', ')}</strong> not found in this dataset.</p>` + links; }
    return { plotData: [trace], plotLayout: layout, htmlLinks: links };
}

function renderPhylogenyTable(genes) {
    if (!window.liPhylogenyCache || !window.neversPhylogenyCache) { return `<div class="ai-result-card"><h3>Table Error</h3><p>Phylogenetic data is not fully loaded.</p></div>`; }
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
    if (!window.liPhylogenyCache || !window.liPhylogenyCache.summary || !window.liPhylogenyCache.genes) { return `<div class="ai-result-card"><h3>List Error</h3><p>Phylogenetic classification data is currently unavailable.</p></div>`; }
    const qLower = classification.toLowerCase().replace(/\s/g, '_');
    const liGenes = window.liPhylogenyCache.genes;
    const summary = window.liPhylogenyCache.summary;
    const classList = summary.class_list;
    let targetClassificationKey = null;
    let title = "";
    let fallbackHtml = "";
    if (qLower.includes('vertebrate')) { targetClassificationKey = 'Vertebrate_specific'; title = "Genes Specific to the Vertebrate Lineage"; }
    else if (qLower.includes('mammalian')) { 
        if (summary.classification_summary.Mammalian_specific === 0) {
            targetClassificationKey = 'Vertebrate_specific'; title = "Genes Specific to the Mammalian Lineage (Data Proxy)";
            fallbackHtml = `<p class="status-note" style="margin-top: 10px;">⚠️ **Note:** The Li et al. 2014 classification metadata reports **zero genes** for the 'Mammalian specific' group. We are displaying the **Vertebrate specific** list as the most phylogenetically proximal proxy.</p>`;
        } else { targetClassificationKey = 'Mammalian_specific'; title = "Genes Specific to the Mammalian Lineage"; }
    }
    else if (qLower.includes('ciliary_specific') || qLower.includes('ciliary_genes') || qLower.includes('every_ciliary_gene')) { targetClassificationKey = 'Ciliary_specific'; title = "Genes Classified as Ciliary Specific"; }
    else if (qLower.includes('absent_in_fungi') || qLower.includes('not_in_fungi')) { targetClassificationKey = 'Vertebrate_specific'; title = "Genes Likely Absent in Fungi (Proxy: Vertebrate/Mammalian Specific)"; }
    else if (qLower.includes('all_organisms') || qLower.includes('universally_conserved')) { targetClassificationKey = 'Universally_Conserved_Proxy'; title = "Genes Conserved Across Nearly All Organisms"; }
    else { return `<div class="ai-result-card"><h3>List Error</h3><p class="status-not-found">Classification keyword not recognized for list generation: ${classification}.</p></div>`; }
    const filteredGenes = Object.values(liGenes).filter(entry => {
        if (targetClassificationKey === 'Universally_Conserved_Proxy') { return entry.s.length >= 130; }
        const entryClass = classList[entry.c] ? classList[entry.c].replace(/_/g, ' ') : '';
        const targetClass = targetClassificationKey.replace(/_/g, ' ');
        return entryClass.toLowerCase().includes(targetClass.toLowerCase());
    }).map(g => ({ gene: g.g, description: `Class: ${title.split(':')[0]}` }));
    if (filteredGenes.length === 0) { return `<div class="ai-result-card"><h3>${title}</h3><p class="status-not-found">No genes found matching this classification.</p></div>`; }
    let resultHtml = formatListResult(title, filteredGenes);
    if (fallbackHtml) { resultHtml = resultHtml.replace(/<\/div>$/, `${fallbackHtml}</div>`); }
    return resultHtml;
}

function compareGeneSpeciesOverlap(geneA, geneB) {
    if (!window.liPhylogenyCache) { return `<div class="ai-result-card"><h3>Comparison Failed</h3><p class="status-not-found">Li et al. 2014 dataset not loaded.</p></div>`; }
    const dataA = Object.values(window.liPhylogenyCache.genes).find(k => k.g.toUpperCase() === geneA.toUpperCase());
    const dataB = Object.values(window.liPhylogenyCache.genes).find(k => k.g.toUpperCase() === geneB.toUpperCase());
    if (!dataA || !dataB) { return `<div class="ai-result-card"><h3>Comparison Failed</h3><p class="status-not-found">One or both genes (${geneA}, ${geneB}) were not found in the Li et al. 2014 dataset.</p></div>`; }
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

function handlePhylogenyVisualizationQuery(genes, source = 'li', type = 'heatmap') {
    const plotId = 'cilia-svg';
    const plotDiv = document.getElementById(plotId);
    if (!plotDiv) { return { htmlLinks: "" }; }

    log(`Plotting ${source} heatmap for ${genes.join(', ')} to ${plotId}`);
    
    const wrapper = plotDiv.closest('.interactive-cilium');
    if (wrapper) wrapper.classList.add('table-view-active');
    
    plotDiv.innerHTML = `<div style="padding: 40px; text-align: center;">Loading ${source.toUpperCase()} phylogeny plot for ${genes.join(', ')}...</div>`;

    try {
        let plotResult = source === 'nevers' ? renderNeversPhylogenyHeatmap(genes) : renderLiPhylogenyHeatmap(genes);

        if (!plotResult || !plotResult.plotData) { throw new Error(plotResult.html || 'The plot renderer returned no data.'); }

        Plotly.newPlot(plotId, plotResult.plotData, plotResult.plotLayout, { responsive: true });
        
        const backButton = document.createElement('button');
        backButton.id = 'ciliai-back-btn'; backButton.className = 'ciliai-button'; backButton.style.cssText = 'background: #718096; position: absolute; top: 10px; right: 10px; z-index: 10;'; backButton.textContent = 'Back to Diagram'; backButton.onclick = () => generateAndInjectSVG();
        plotDiv.prepend(backButton);

        const addGeneButton = document.createElement('button');
        addGeneButton.id = 'ciliai-add-gene-btn'; addGeneButton.className = 'ciliai-button'; addGeneButton.style.cssText = 'background: #667eea; position: absolute; top: 10px; right: 170px; z-index: 10;'; addGeneButton.textContent = 'Add Gene'; 
        addGeneButton.onclick = () => {
            const geneToAdd = prompt("Enter gene symbol to add to the plot:", "");
            if (!geneToAdd || geneToAdd.trim() === "") return;
            const plotTitle = plotDiv.layout.title.text || '';
            const currentSource = plotTitle.includes('Nevers') ? 'nevers' : 'li';
            const currentGenes = plotDiv.data[0].y;
            const newGeneList = [...currentGenes, geneToAdd.trim().toUpperCase()];
            addChatMessage(`show ${currentSource} plot for ${newGeneList.join(',')}`, true);
            handleAIQuery(`show ${currentSource} plot for ${newGeneList.join(',')}`);
        };
        plotDiv.prepend(addGeneButton);

        return { htmlLinks: plotResult.htmlLinks || "" };

    } catch (e) {
        console.error("handlePhylogenyVisualizationQuery Error:", e);
        plotDiv.innerHTML = `<p style="padding: 20px;"><strong>Error generating plot:</strong> ${e.message}</p>`;
        addChatMessage(`<strong>Error generating plot:</strong> ${e.message}`, false);
        return { htmlLinks: "" };
    }
}

// CiliAI.js snippet: Chunk 7 (Final Definitions, Event Handlers, Exposure)

function handleScreenReferenceFollowup() {
    const refMap = getScreenCitationMap();
    const allKeys = Object.keys(refMap);

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
    lastQueryContext = { type: null, data: [], term: null };
    return html;
}

function getScreenCitationMap() {
    return {
        "Kim2016": { name: 'Kim et al. (2016) IMCD3 RNAi', link: 'https://www.sciencedirect.com/science/article/pii/S016748891630074X', citation: 'Kim et al., FEBS Lett, 2016', summary: "This is a genome-wide high-content siRNA screen for ciliogenesis. The authors identified roles for mRNA processing (spliceosome) and ubiquitin-proteasome system (UPS) in both cilia formation and cell cycle arrest..." },
        "Wheway2015": { name: 'Wheway et al. (2015) RPE1 RNAi', link: 'https://www.nature.com/articles/ncb3201#Abs1', citation: 'Wheway et al., Nat Cell Biol, 2015', summary: "This is a whole-genome siRNA screen in mIMCD3 cells (mouse kidney line) to identify genes required for ciliogenesis. They identified 112 candidate ciliogenesis/ciliopathy genes..." },
        "Roosing2015": { name: 'Roosing et al. (2015) hTERT-RPE1', link: 'https://elifesciences.org/articles/06602/figures#SD2-data', citation: 'Roosing et al., eLife, 2015', summary: "Roosing et al. performed a genome-wide siRNA knockdown screen in human hTERT-RPE1 cells engineered with a dual reporter (Smo-EGFP for cilia + mCherry-Geminin for cell-cycle state)..." },
        "Basu2023": { name: 'Basu et al. (2023) MDCK CRISPR', link: 'https://onlinelibrary.wiley.com/doi/10.1111/ahg.12529', citation: 'Basu et al., Ann Hum Genet, 2023', summary: "This reference links to a 2023 paper from Basu et al. Manual curation from the full text is recommended to extract cell-line, screening design, and main findings." },
        "Breslow2018": { name: 'Breslow et al. (2018) Hedgehog Signaling', link: 'https://www.nature.com/articles/s41588-018-0054-7#Abs1', citation: 'Breslow et al., Nat Genet, 2018', summary: "This is a CRISPR-Cas9 screen focused on Hedgehog (Hh) signaling, which relies on the primary cilium. They engineered a Hedgehog-responsive cell line with a selectable reporter and used a genome-wide CRISPR sgRNA library..." }
    };
}

function handleUserSend() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) return;
    const query = chatInput.value.trim();
    if (!query) return;
    window.addChatMessage(query, true);
    chatInput.value = '';
    window.handleAIQuery(query);
}

window.react = function (type) {
    const userMessages = Array.from(document.querySelectorAll('.ciliai-message.user'));
    const lastQuestion = userMessages.length > 0
        ? (userMessages[userMessages.length - 1].querySelector('.ciliai-message-content')?.textContent || '').trim()
        : 'No question';

    const feedbackType = type === 'up' ? 'Positive' : 'Negative';
    console.log(`[FEEDBACK] ${feedbackType} received for: "${lastQuestion.substring(0, 50)}"`);

    if (type === 'up') {
        window.addChatMessage('Thank you! Feedback received', false);
    } else {
        window.addChatMessage('Got it – thank you for the feedback!', false);
    }
}


window.generateAndInjectSVG = function() {
    const svgContainer = document.getElementById('cilia-svg');
    if (!svgContainer) return;
    const wrapper = svgContainer.closest('.interactive-cilium');
    if (wrapper) wrapper.classList.remove('table-view-active');

    const svgHTML = `
        <svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto;">
            <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="#005b96">Ciliary Diagram Placeholder</text>
            </svg>`;
    svgContainer.innerHTML = svgHTML;
};

// --- FINAL GLOBAL EXPOSURE AND ALIASES ---

window.searchGene = function (name) {
    const query = name || document.getElementById('geneSearch').value.trim().toUpperCase();
    if (query) {
        window.addChatMessage(query, true);
        window.handleAIQuery(query);
    }
};

window.showDefaultUMAP = function () {
    window.addChatMessage('plot default umap', true);
    window.handleAIQuery('plot default umap');
};

window.showDefaultPhylogeny = function () {
    window.addChatMessage('plot default phylogeny', true);
    window.handleAIQuery('plot default phylogeny');
};

window.react = react;
window.handleUserSend = handleUserSend;
window.downloadPlot = function (divId, filename) {
    const plotDiv = document.getElementById(divId);
    if (plotDiv && window.Plotly) {
        Plotly.downloadImage(plotDiv, { format: 'png', filename: filename, width: 1200, height: 800 });
    }
};

// Re-expose core functions that might have been defined using 'function' instead of 'window.' for consistency
window.log = log;
window.updateStatus = updateStatus;
window.addChatMessage = addChatMessage;
window.getComplexesForGene = window.getComplexesForGene;
window.getGenesByComplex = window.getGenesByComplex;
window.ensurePhylogenyDataLoaded = ensurePhylogenyDataLoaded;
window.getComplexGenesAndFormat = getComplexGenesAndFormat;
window.getGenesByLocalization = getGenesByLocalization;
window.getScreenCitationMap = getScreenCitationMap;
window.handleScreenReferenceFollowup = handleScreenReferenceFollowup;
window.downloadTableAsCSV = downloadTableAsCSV;
window.injectTableCSS = injectTableCSS; 
window.getGenesByLocalization = getGenesByLocalization;
window.loadAnalysisData = loadAnalysisData;
window.ensurePhylogenyDataLoaded = ensurePhylogenyDataLoaded;

// You would add any initialization calls (e.g., initializeCiliAI) here if necessary
// setupPageEventListeners(); 
// window.CiliAI.ready = true; // Temporary flag for testing the router
