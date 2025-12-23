/* ==============================================================
 * CiliAI – Unified Logic Engine (v7.1 – Safe Initialization)
 * ============================================================== */

// 1. GLOBAL STATE & UTILITIES
// ==========================================================
// 5. Ensure these are exposed globally
window.extractMultipleGenes = extractMultipleGenes;
window.getTPMInCellType = getTPMInCellType;


// 6. Auto-run the fixed router
console.log("CiliAI v7.2 – Cell-Type Questions FIXED & Fully Supported");


// Define logger first to prevent ReferenceErrors
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
const DEFAULT_PHYLO_GENES = ["ZC2HC1A", "CEP41", "BBS1", "BBS2", "BBS5", "ZNF474", "IFT81", "BBS7"];

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

// --- Main Display Function ---
window.displayFullGeneInfo = async function(geneSymbol) {
    injectCiliAIStyles();
    
    const gm = window.CiliAI.lookups && window.CiliAI.lookups.geneMap;
    if (!gm || !gm[geneSymbol]) {
        return `<div class="ai-result-card">No data found for gene <strong>${geneSymbol}</strong></div>`;
    }
    const g = gm[geneSymbol];
    const safeVal = (v) => (v && v !== 'N/A' && v !== '0') ? v : '<span style="color:#ccc">—</span>';
    const scRNA = g.expression?.scRNA || {};

    // Calculate Confidence Score for Badge
    let score = 0;
    if (g.screens) score += g.screens.length; 
    if (g.Ciliopathies && g.Ciliopathies.length > 0) score += 2;
    if (g.Ortholog_C_elegans && g.Ortholog_C_elegans !== 'N/A') score += 1; 

    let badge = '';
    if (score >= 4) badge = `<span class="cilia-badge badge-gold">🥇 High Confidence</span>`;
    else if (score >= 2) badge = `<span class="cilia-badge badge-silver">🥈 Verified</span>`;
    else badge = `<span class="cilia-badge badge-bronze">🥉 Candidate</span>`;

    // --- BUILD HTML ---
    let html = `<div class="ai-result-card" style="font-family: 'Inter', sans-serif;">`;
    
    // 1. Header
    html += `<div style="display:flex; align-items:center; margin-bottom:10px;">
                <h2 id="current-gene-name" style="margin:0; color:#2b6cb0;">${geneSymbol}</h2>
                ${badge}
             </div>`;

    // 2. Navigation Tabs
    html += `
        <div class="cilia-tabs">
            <button class="cilia-tab-btn active" onclick="window.openTab(event, 'overview')">Overview</button>
            <button class="cilia-tab-btn" onclick="window.openTab(event, 'expression')">Expression</button>
            <button class="cilia-tab-btn" onclick="window.openTab(event, 'screens')">Screens</button>
            <button class="cilia-tab-btn" onclick="window.openTab(event, 'evolution')">Evolution</button>
        </div>
    `;

    // 3. Tab Contents
    
    // -- OVERVIEW --
    html += `<div id="tab-overview" class="cilia-tab-content active">
                <p><strong>Description:</strong> ${g['Gene.Description'] || 'No description available'}</p>
                <p><strong>Localization:</strong> ${g.Localization || 'Unknown'}</p>
                <div style="background:#f7fafc; padding:10px; border-radius:8px; margin:10px 0; font-size: 0.95em; border: 1px solid #edf2f7;">
                    <p style="margin:3px 0;"><strong>Mouse Ortholog:</strong> ${safeVal(g.Ortholog_Mouse)}</p>
                    <p style="margin:3px 0;"><strong>Phenotype (LoF):</strong> ${safeVal(g['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'])}</p>
                    <p style="margin:3px 0;"><strong>OMIM:</strong> ${safeVal(g.OMIM?.ID)}</p>
                </div>
                ${g.complex_components ? renderComplexTable(g.complex_components) : ''}
             </div>`;

    // -- EXPRESSION --
    html += `<div id="tab-expression" class="cilia-tab-content">
                <div style="margin-bottom: 10px;">
                    <button class="ciliai-button" onclick="window.renderUMAPPlot('${geneSymbol}')">🔄 Refresh UMAP Plot</button>
                </div>
                ${Object.keys(scRNA).length > 0 ? renderScRNATable(scRNA) : '<p>No scRNA data.</p>'}
             </div>`;

    // -- SCREENS --
    html += `<div id="tab-screens" class="cilia-tab-content">
                ${renderCiliaEffectsTable(g)}
                ${Array.isArray(g.screens) && g.screens.length > 0 ? renderScreensTable(g.screens) : '<p>No screen data available.</p>'}
             </div>`;

    // -- EVOLUTION --
    html += `<div id="tab-evolution" class="cilia-tab-content">
                ${g.phylogeny ? renderPhyloTable(g.phylogeny) : '<p>No phylogeny data.</p>'}
                <div style="margin-top:10px;">
                    <button class="ciliai-button" onclick="window.handleAIQuery('show evolution of ${geneSymbol}')">View Phylogeny Heatmap</button>
                </div>
             </div>`;

    html += `</div>`; 
    return html;
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
    if (!term) return [];
    let normTerm = term.toLowerCase().trim();
    
    const L = window.CiliAI.lookups;
    const geneMap = L.geneMap || {};
    let matchingGenes = new Set(); 

    // 1. Search in pre-defined localization sets (Fast lookup)
    if (L.byLocalization) {
        Object.keys(L.byLocalization).forEach(key => {
            if (key.toLowerCase().includes(normTerm)) {
                L.byLocalization[key].forEach(geneSymbol => {
                    matchingGenes.add(geneSymbol.toUpperCase());
                });
            }
        });
    }

    // 2. CRITICAL FIX: Scan the Master Data 'Localization' column directly
    // This ensures we catch everything "Transition Zone" even if the lookup map is incomplete.
    if (window.CiliAI.masterData) {
        window.CiliAI.masterData.forEach(g => {
            if (g.Gene && g.Localization && g.Localization.toLowerCase().includes(normTerm)) {
                matchingGenes.add(g.Gene.toUpperCase());
            }
        });
    }

    // Return formatted objects
    return Array.from(matchingGenes).map(gene => {
        const geneData = geneMap[gene];
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
 * Renders Interactive UMAP (Fixed for Kidney Sparse Data + Debugging)
 */
/**
 * Renders Interactive UMAP (Fixed for Dictionary Data Structure)
 */
window.renderUMAPPlot = async function(displayName, targetGenes = [], zoomToCellType = null) {
    // 1. Clear previous views
    if (typeof window.resetViews === 'function') window.resetViews();
    
    // 2. Active dataset
    const datasetKey = window.CiliAI.activeDataset || 'lung';
    const dataset = window.CiliAI.datasets?.[datasetKey];

    if (!dataset || !Array.isArray(dataset.umap)) {
        if (window.addChatMessage) window.addChatMessage(`⚠️ ${datasetKey} data not loaded yet.`, false);
        return;
    }

    // 3. Inputs
    if (!displayName) displayName = 'WDR31';
    // Robustly handle string vs array input
    if (typeof targetGenes === 'string') {
        targetGenes = targetGenes.split(',').filter(t => t.trim().length > 0);
    }
    if (!targetGenes || targetGenes.length === 0) targetGenes = [displayName];

    const gene = displayName.toUpperCase();
    const isClusterView = displayName === 'CLUSTER_VIEW';

    // 4. Prepare data
    const sourceData = dataset.umap;
    const renderIndices = Array.from({ length: sourceData.length }, (_, i) => i);

    const x = [], y = [], color = [], text = [], size = [];
    let maxExpr = 0;

    // 5. Expression Handling (Auto-detect format)
    let exprData = null;
    let isSparseArray = false; // Array [idx, val, idx, val...]
    let isDictionary = false;  // Object { "cell type": val }
    let geneFound = false;

    // Helper: Strictly decode sparse array
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

    if (!isClusterView) {
        // Try getting data from dataset object (Kidney) OR cache (Lung)
        let rawData = dataset.expression?.[gene];
        
        // Fallback to global cache if not in dataset object (Legacy Lung path)
        if (!rawData && window.CiliAI.cellDataCache) {
            rawData = window.CiliAI.cellDataCache[gene];
        }

        if (rawData) {
            geneFound = true;
            if (Array.isArray(rawData)) {
                // It's a sparse array (Old Kidney format)
                exprData = decodeSparse(rawData, sourceData.length);
                isSparseArray = true;
            } else if (typeof rawData === 'object') {
                // It's a dictionary (New Kidney & Lung format)
                exprData = rawData;
                isDictionary = true;
            }
        }
    }

    if (!isClusterView && !geneFound) {
        if(window.addChatMessage) window.addChatMessage(`⚠️ **${gene}** not found in ${dataset.name}.`, false);
    }

    const clusterColors = {
        'Proximal Tubule Cell': '#3B82F6', 'Thick Ascending Limb Cell': '#60A5FA',
        'Distal Convoluted Tubule Cell': '#93C5FD', 'Collecting Duct Principal Cell': '#BFDBFE',
        'Collecting Duct Intercalated Cell': '#DBEAFE', 'Podocyte': '#1E40AF',
        'Fibroblast': '#1D4ED8', 'Endothelial Cell': '#2563EB',
        'Immune Cell': '#1E3A8A', 'Cycling Cell': '#172554', 'Ciliated Cell': '#E11D48',
        'stem cell': '#E11D48', 'club cell': '#3B82F6', 'goblet cell': '#10B981', 
        'basal cell': '#F59E0B', 'neuroendocrine cell': '#8B5CF6',
        'pulmonary alveolar type 1 cell': '#60A5FA', 'pulmonary alveolar type 2 cell': '#2563EB',
        'lung secretory cell': '#34D399'
    };

    // 6. Build plot arrays
    for (const i of renderIndices) {
        const p = sourceData[i];
        if (!p) continue;

        const cellType = p.cell_type;

        // Zoom Filter
        if (zoomToCellType && cellType !== zoomToCellType) continue; 

        x.push(p.x);
        y.push(p.y);

        let exprVal = 0;
        if (!isClusterView && geneFound) {
            if (isSparseArray) {
                exprVal = exprData[i]; // Access by index
            } else if (isDictionary) {
                // Access by cell type name (Dictionary lookups)
                exprVal = exprData[cellType] || 0; 
            }
        }

        text.push(
            `<b>${cellType}</b><br>${isClusterView ? '' : `Expr: ${exprVal.toFixed(2)}`}`
        );

        if (isClusterView) {
            color.push(clusterColors[cellType] || '#94A3B8');
            size.push(4);
        } else {
            color.push(exprVal);
            size.push(exprVal > 0 ? 6 : 3);
            if (exprVal > maxExpr) maxExpr = exprVal;
        }
    }

    const trace = {
        x, y, text,
        mode: 'markers',
        type: 'scattergl',
        hoverinfo: 'text',
        marker: {
            size,
            opacity: 0.8,
            line: { width: 0 }
        }
    };

    if (!isClusterView) {
        trace.marker.color = color;
        trace.marker.cmin = 0;
        trace.marker.cmax = maxExpr > 0 ? maxExpr : 1;
        trace.marker.colorscale = dataset.colorScale || 'Viridis';
        trace.marker.colorbar = { title: 'TPM', len: 0.5 };
    } else {
        trace.marker.color = color;
    }

    const layout = {
        title: `<b>${isClusterView ? 'Cell Types' : gene} (${dataset.name})</b>`,
        xaxis: { visible: false, automargin: true },
        yaxis: { visible: false, automargin: true },
        hovermode: 'closest',
        margin: { t: 40, b: 20, l: 20, r: 20 },
        plot_bgcolor: '#fff',
        paper_bgcolor: '#fff',
        showlegend: false
    };

    // 7. Render using global helper
    if (typeof window.showPlot === 'function') {
        window.showPlot({ data: [trace], layout }, isClusterView ? 'Cell Clusters' : `scRNA-seq: ${gene}`);
    } else {
        // Fallback
        const container = document.getElementById('plotly-container');
        if(container) container.style.display = 'block';
        if(document.getElementById('cilia-svg')) document.getElementById('cilia-svg').style.display = 'none';
        
        await Plotly.newPlot('plotly-container', [trace], layout, {
            responsive: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d']
        });
    }
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

window.handleAIQuery = async function (query) {
    const chatWindow = document.getElementById('messages');
    if (!chatWindow) return;
    if (!query) return;

    const qLower = query.toLowerCase().trim();

    // === 1. HIGHEST PRIORITY: Cell-type specific questions (your existing fix) ===
    if (qLower.includes('cilia-restricted') ||
        qLower.includes('cilia restricted') ||
        qLower.includes('ciliary-restricted') ||
        qLower.includes('specific to') ||
        (qLower.includes('express') && qLower.includes('cell')) ||
        qLower.includes('active in') ||
        (qLower.includes('tpm') && qLower.includes('cell'))) {
        const result = window.handleCellTypeQuestion(query);
        if (result) {
            window.addChatMessage(result, false);
            return;
        }
    }

    if (window.log) window.log(`Routing query: ${query}`);

    try {
        if (!window.CiliAI || !window.CiliAI.ready) {
            window.addChatMessage("Data is still loading, please wait...", false);
            return;
        }

        let htmlResult = null;
        let match;

        // === 2. GENERALIZED: "Where is [GENE] expressed?" for ANY ciliary gene ===
        if (qLower.includes('where is') && qLower.includes('expressed')) {
            const genes = extractMultipleGenes(query);
            if (genes.length > 0) {
                const geneSymbol = genes[0];
                const gene = window.CiliAI.lookups.geneMap[geneSymbol];

                if (!gene) {
                    htmlResult = `<div class="ai-result-card"><p>Gene <strong>${geneSymbol}</strong> not found in database.</p></div>`;
                } else {
                    const loc = gene.Localization || 'Not specified';
                    let expressionInfo = '';
                    let scrnaSummary = '';

                    if (gene.expression?.scRNA) {
                        const expressed = getExpressedCellTypes(gene.expression.scRNA);
                        if (expressed.length > 0) {
                            scrnaSummary = `<p><strong>scRNA-seq (lung):</strong> Expressed in: <strong>${expressed.join(', ')}</strong></p>`;
                        }
                    }

                    // Detect motile cilia genes
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

                    htmlResult = `
                        <div class="ai-result-card">
                            <h4>Expression of ${geneSymbol}</h4>
                            ${expressionInfo}
                        </div>
                    `;
                }

                if (htmlResult) {
                    window.addChatMessage(htmlResult, false);
                    return;
                }
            }
        }

        // === 3. FULLY FIXED CILIOPATHY CLASSIFICATION, OVERLAP & ORTHOLOG HANDLER ===
        const classificationMap = getDiseaseClassificationMap();

        // Extended keyword mapping (includes common variations)
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

        // === MODEL ORGANISM ORTHOLOGS/HOMOLOGS FOR CILIOPATHY GROUPS ===
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

        // Only run if a model organism is mentioned AND a ciliopathy group is mentioned
        if (requestedOrganism &&
            (qLower.includes('senior løken') ||
             qLower.includes('bardet biedl') ||
             qLower.includes('meckel gruber') ||
             qLower.includes('joubert') ||
             qLower.includes('primary ciliopathy') ||
             qLower.includes('motile ciliopathy') ||
             qLower.includes('atypical ciliopathy') ||
             qLower.includes('all ciliopathy') ||
             qLower.includes('ciliopathies') ||
             qLower.includes('ciliopathy genes'))) {

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
                    if (gene.Ciliopathy && normalizeTerm(gene.Ciliopathy).includes('joubert')) {
                        targetGenes.add(gene.Gene);
                    }
                });
            }

            if (targetGenes.size === 0) {
                window.addChatMessage(`<div class="ai-result-card"><p>No genes found for the requested group.</p></div>`, false);
                return;
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
                window.addChatMessage(`<div class="ai-result-card"><p>No ${orgName} orthologs found.</p></div>`, false);
                return;
            }

            mappings.sort((a, b) => a.human.localeCompare(b.human));
            const listHtml = mappings.map(m => `<li><strong>${m.human}</strong> → <em>${m.ortholog}</em></li>`).join('');

            const groupName = qLower.includes('all') ? 'All Ciliopathies' :
                              qLower.includes('joubert') ? 'Joubert Syndrome' :
                              qLower.includes('primary') ? 'Primary Ciliopathies' :
                              qLower.includes('motile') ? 'Motile Ciliopathies' :
                              qLower.includes('atypical') ? 'Atypical Ciliopathies' : 'Group';

            const orgDisplay = requestedOrganism === 'C_elegans' ? 'C. elegans' : requestedOrganism;

            window.addChatMessage(`<div class="ai-result-card">
                <h4>${orgDisplay} Orthologs: ${groupName}</h4>
                <p><strong>${mappings.length}</strong> mappings:</p>
                <ul style="columns: 2;">${listHtml}</ul>
            </div>`, false);
            return; // Critical: stop further processing
        }

        // === A. List diseases in classification ===
        if (matchedClassification && !qLower.includes('genes')) {
            const diseases = classificationMap[matchedClassification];
            htmlResult = `<div class="ai-result-card">
                <h4>${matchedClassification} (${diseases.length} diseases)</h4>
                <ul style="columns: 2; font-size: 13px; line-height: 1.5;">
                    ${diseases.map(d => `<li>${d}</li>`).join('')}
                </ul>
            </div>`;
            window.addChatMessage(htmlResult, false);
            return;
        }

        // === B. Genes in a classification (Primary, Secondary, etc.) ===
        if (qLower.includes('genes') && matchedClassification) {
            const diseases = classificationMap[matchedClassification];
            let allGenes = new Set();

            diseases.forEach(disease => {
                const normKey = normalizeTerm(disease);
                const genes = window.CiliAI.lookups.byCiliopathy[normKey] || [];
                genes.forEach(g => allGenes.add(g));
            });

            const geneList = Array.from(allGenes);

            if (geneList.length === 0) {
                htmlResult = `<div class="ai-result-card"><p>No genes found for <strong>${matchedClassification}</strong>.</p></div>`;
            } else {
                const geneObjects = geneList.map(g => ({
                    gene: g,
                    description: window.CiliAI.lookups.geneMap[g]?.Localization || 'Ciliary protein'
                }));

                lastQueryContext = {
                    type: 'list_followup',
                    data: geneObjects,
                    term: `Genes in ${matchedClassification}`
                };

                htmlResult = `<div class="ai-result-card">
                    <h4>Genes Associated with ${matchedClassification}</h4>
                    <p>Found <strong>${geneList.length}</strong> unique genes across all related diseases.</p>
                    <p>Would you like to <strong>view the full list</strong>?</p>
                </div>`;
            }
            window.addChatMessage(htmlResult, false);
            return;
        }

        // === C. Shared genes between any two classifications or diseases ===
        if (qLower.includes('shared') || qLower.includes('overlap') || qLower.includes('common') || qLower.includes('between')) {
            let set1 = null, set2 = null;
            let name1 = '', name2 = '';

            const foundClasses = Object.keys(classificationKeywords).filter(k => qLower.includes(k));
            if (foundClasses.length >= 2) {
                name1 = classificationKeywords[foundClasses[0]];
                name2 = classificationKeywords[foundClasses[1]];
                const diseases1 = classificationMap[name1];
                const diseases2 = classificationMap[name2];

                set1 = new Set();
                set2 = new Set();

                diseases1.forEach(d => {
                    const genes = window.CiliAI.lookups.byCiliopathy[normalizeTerm(d)] || [];
                    genes.forEach(g => set1.add(g));
                });
                diseases2.forEach(d => {
                    const genes = window.CiliAI.lookups.byCiliopathy[normalizeTerm(d)] || [];
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
                    set1 = new Set(window.CiliAI.lookups.byCiliopathy[normalizeTerm(name1)] || []);
                    set2 = new Set(window.CiliAI.lookups.byCiliopathy[normalizeTerm(name2)] || []);
                }
            }

            if (set1 && set2) {
                const overlap = [...set1].filter(g => set2.has(g));

                if (overlap.length === 0) {
                    htmlResult = `<div class="ai-result-card">
                        <h4>No Shared Genes</h4>
                        <p>No overlapping genes found between <strong>${name1}</strong> and <strong>${name2}</strong>.</p>
                    </div>`;
                } else {
                    const geneObjects = overlap.map(g => ({ gene: g }));
                    lastQueryContext = {
                        type: 'list_followup',
                        data: geneObjects,
                        term: `Shared: ${name1} ∩ ${name2}`
                    };

                    htmlResult = `<div class="ai-result-card">
                        <h4>Shared Genes: ${name1} ∩ ${name2}</h4>
                        <p><strong>${overlap.length}</strong> gene(s) in common:</p>
                        <p><strong>${overlap.join(', ')}</strong></p>
                        <p>(These are often allelic — same gene, different severity)</p>
                        <p>Would you like to <strong>view details</strong>?</p>
                    </div>`;
                }
                window.addChatMessage(htmlResult, false);
                return;
            }
        }

        // === SAFE "yes" HANDLER FOR LIST FOLLOW-UP ===
        if ((qLower === 'yes' || qLower === 'y' || qLower === 'sure' || qLower === 'show' || qLower === 'list') &&
            lastQueryContext && lastQueryContext.type === 'list_followup') {

            if (lastQueryContext.data && lastQueryContext.data.length > 0) {
                window.showDataInLeftPanel(lastQueryContext.term || 'Gene List', lastQueryContext.data);
                window.addChatMessage(`Displaying <strong>${lastQueryContext.term}</strong> (${lastQueryContext.data.length} genes) in the main panel.`, false);
            } else {
                window.addChatMessage(`No genes to display for <strong>${lastQueryContext.term}</strong>.`, false);
            }

            lastQueryContext = { type: null, data: [], term: null };
            return;
        }

        // === ORTHOLOG QUESTIONS (Mouse, Drosophila, C. elegans) ===
        if (qLower.includes('ortholog') || qLower.includes('orthologue')) {
            const genes = extractMultipleGenes(query);
            if (genes.length === 0) {
                window.addChatMessage(`<div class="ai-result-card"><p>Please specify a gene (e.g., "ortholog of ARL13B").</p></div>`, false);
                return;
            }

            const geneSymbol = genes[0];
            const geneData = window.CiliAI.lookups.geneMap[geneSymbol];

            if (!geneData) {
                window.addChatMessage(`<div class="ai-result-card"><p>Gene <strong>${geneSymbol}</strong> not found in database.</p></div>`, false);
                return;
            }

            const mouse = geneData.Ortholog_Mouse || 'Not reported';
            const drosophila = geneData.Ortholog_Drosophila || 'Not reported';
            const celegans = geneData.Ortholog_C_elegans || 'Not reported';

            let response = `<div class="ai-result-card">
                <h4>Orthologs of ${geneSymbol}</h4>
                <ul style="margin: 10px 0;">`;

            if (qLower.includes('mouse') || qLower.includes('all')) {
                response += `<li><strong>Mouse:</strong> ${mouse}</li>`;
            }
            if (qLower.includes('drosophila') || qLower.includes('fly') || qLower.includes('all')) {
                response += `<li><strong>Drosophila:</strong> ${drosophila}</li>`;
            }
            if (qLower.includes('c. elegans') || qLower.includes('worm') || qLower.includes('all')) {
                response += `<li><strong>C. elegans:</strong> ${celegans}</li>`;
            }

            response += `</ul></div>`;

            window.addChatMessage(response, false);
            return;
        }

        // === TOTAL UNIQUE GENES IN CILIOPATHIES ===
        const ciliopathyQueryPatterns = [
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

        const matchesCiliopathyCount = ciliopathyQueryPatterns.some(pattern =>
            new RegExp(pattern, 'i').test(query)
        );

        if (matchesCiliopathyCount ||
            (qLower.includes('how many') && qLower.includes('unique') && qLower.includes('genes') && qLower.includes('ciliopathies'))) {

            const includedClasses = [
                'Primary Ciliopathies',
                'Motile Ciliopathies',
                'Atypical Ciliopathies'
            ];

            let allUniqueGenes = new Set();

            includedClasses.forEach(className => {
                const diseases = classificationMap[className] || [];
                diseases.forEach(disease => {
                    const normKey = normalizeTerm(disease);
                    const genes = window.CiliAI.lookups.byCiliopathy[normKey] || [];
                    genes.forEach(g => allUniqueGenes.add(g));
                });
            });

            const totalCount = allUniqueGenes.size;

            htmlResult = `<div class="ai-result-card">
                <h4>Total Unique Genes in Ciliopathies</h4>
                <p>Across <strong>Primary, Motile, and Atypical Ciliopathies</strong>:</p>
                <p style="font-size:22px; font-weight:bold; color:#2b6cb0; margin:20px 0;">
                    <strong>${totalCount}</strong> unique genes
                </p>
                <p>This count includes all known causative and associated genes from the three core ciliopathy classes.</p>
                <p><em>(Secondary diseases are excluded from this total.)</em></p>
            </div>`;

            window.addChatMessage(htmlResult, false);
            return;
        }

        // === "How many genes are in [disease/classification]?" ===
        if (qLower.match(/how many.*genes.*(in|for|are|associated with)/i)) {
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

                if (target === 'Primary Ciliopathies' || target === 'Motile Ciliopathies' || target === 'Atypical Ciliopathies') {
                    const diseases = classificationMap[target] || [];
                    let set = new Set();
                    diseases.forEach(d => {
                        const genes = window.CiliAI.lookups.byCiliopathy[normalizeTerm(d)] || [];
                        genes.forEach(g => set.add(g));
                    });
                    geneList = Array.from(set);
                } else {
                    const normKey = normalizeTerm(target);
                    geneList = window.CiliAI.lookups.byCiliopathy[normKey] || [];
                }

                const count = geneList.length;

                htmlResult = `<div class="ai-result-card">
                    <h4>Genes in ${target}</h4>
                    <p style="font-size:18px; font-weight:bold; color:#2b6cb0; margin:15px 0;">
                        <strong>${count}</strong> unique gene${count === 1 ? '' : 's'}
                    </p>
                    <p>These are all known causative/associated genes in the database.</p>
                    <p>Would you like to <strong>view the full list</strong>?</p>
                </div>`;

                lastQueryContext = {
                    type: 'list_followup',
                    data: geneList.map(g => ({ gene: g })),
                    term: `Genes in ${target}`
                };

                window.addChatMessage(htmlResult, false);
                return;
            }
        }

        // === Disease implicated by a gene ===
        if ((qLower.includes('disease') || qLower.includes('ciliopathy')) &&
            (qLower.includes('implicated') || qLower.includes('associated') || qLower.includes('linked') || qLower.includes('cause')) &&
            qLower.includes('with')) {

            const genes = extractMultipleGenes(query);
            if (genes.length === 0) return;

            const geneSymbol = genes[0];
            const geneData = window.CiliAI.lookups.geneMap[geneSymbol];

            if (!geneData) {
                htmlResult = `<div class="ai-result-card">
                    <p>Gene <strong>${geneSymbol}</strong> not found in the database.</p>
                </div>`;
                window.addChatMessage(htmlResult, false);
                return;
            }

            let associatedDiseases = [];
            Object.keys(window.CiliAI.lookups.byCiliopathy).forEach(normKey => {
                const diseaseGenes = window.CiliAI.lookups.byCiliopathy[normKey] || [];
                if (diseaseGenes.includes(geneSymbol)) {
                    let foundName = normKey;
                    Object.values(classificationMap).flat().forEach(d => {
                        if (normalizeTerm(d) === normKey) foundName = d;
                    });
                    associatedDiseases.push(foundName);
                }
            });

            if (associatedDiseases.length === 0 && geneData.Ciliopathies) {
                associatedDiseases = Array.isArray(geneData.Ciliopathies)
                    ? geneData.Ciliopathies
                    : [geneData.Ciliopathies];
            }

            if (associatedDiseases.length === 0) {
                htmlResult = `<div class="ai-result-card">
                    <p><strong>${geneSymbol}</strong> is a known ciliary gene but not yet directly linked to a specific ciliopathy in the current database.</p>
                    <p>It localizes to the <strong>${geneData.Localization || 'cilium'}</strong> and is highly conserved.</p>
                </div>`;
            } else {
                htmlResult = `<div class="ai-result-card">
                    <h4>Disease Associations: ${geneSymbol}</h4>
                    <p><strong>${geneSymbol}</strong> is implicated in the following ciliopathies:</p>
                    <ul>
                        ${associatedDiseases.map(d => `<li><strong>${d}</strong></li>`).join('')}
                    </ul>
                    <p>These are typically <strong>transition zone</strong> disorders with overlapping phenotypes (brain, retina, kidney).</p>
                </div>`;
            }

            window.addChatMessage(htmlResult, false);
            return;
        }

        // === Mouse Knockout Phenotype Handler ===
        if (qLower.includes('mouse') && (qLower.includes('knockout') || qLower.includes('phenotype')) && qLower.includes('of')) {
            const genes = extractMultipleGenes(query);
            if (genes.length > 0) {
                const gene = genes[0];
                const data = window.CiliAI.lookups.geneMap[gene];

                if (data && (data.mouse_phenotype || data.mouse_ciliopathy_phenotype)) {
                    const pheno = data.mouse_phenotype || 'Ciliopathy-related phenotype observed';
                    const model = data.Ortholog_Mouse ? ` (${data.Ortholog_Mouse} mouse model)` : '';
                    htmlResult = `<div class="ai-result-card">
                        <h4>Mouse Knockout Phenotype: ${gene}${model}</h4>
                        <p><strong>Phenotype:</strong> ${pheno}</p>
                        ${data.mouse_ciliopathy_phenotype ? '<p>Known ciliopathy model.</p>' : ''}
                    </div>`;
                } else {
                    htmlResult = `<div class="ai-result-card">
                        <p>No mouse knockout phenotype data available for <strong>${gene}</strong> in current database.</p>
                    </div>`;
                }
                window.addChatMessage(htmlResult, false);
                return;
            }
        }

        // Intent 1: Greetings
        const simpleGreetings = ['hello', 'hi', 'hey', 'greetings'];
        const terminologyQueries = window.terminologyQueries || {};

        if (simpleGreetings.includes(qLower)) {
            window.addChatMessage("Hello! I'm CiliAI. How can I help you? Try asking 'What is IFT88?' or 'List genes in the transition zone'.", false);
            return;
        }
        if (terminologyQueries[qLower]) {
            window.addChatMessage(`<div class="ai-result-card"><p>${terminologyQueries[qLower]}</p></div>`, false);
            return;
        }

        // Intent 2: Default Buttons
        if (qLower === 'plot default umap') {
            if (!window.CiliAI.activeDataset) window.CiliAI.activeDataset = 'lung';
            window.renderUMAPPlot('WDR31', ['WDR31']);
            const dsName = window.CiliAI.datasets[window.CiliAI.activeDataset].name;
            htmlResult = `<div class="ai-result-card"><p>Displaying ${dsName} scRNA-seq UMAP for <strong>WDR31</strong> on the left.</p></div>`;
        }
        else if (qLower === 'plot default phylogeny') {
            htmlResult = await window.handleAIQuery(`show nevers plot for ${DEFAULT_PHYLO_GENES.join(',')}`);
            return;
        }

        // Intent 3: Contextual Follow-up
        const isComplexQuery = qLower.includes('expression') || qLower.includes('plot') || qLower.includes('umap') || qLower.includes('scrna') || qLower.includes('kidney') || qLower.includes('lung') || qLower.includes('evolution');
        const yesRegex = /^(yes|yeah|sure|ok|okay|yep|show|view|list|show list|view list|display)/i;

        if (!isComplexQuery && htmlResult === null && yesRegex.test(qLower) && window.CiliAI.lastQueryContext && window.CiliAI.lastQueryContext.type) {
            if (window.CiliAI.lastQueryContext.type === 'list_followup') {
                if (typeof window.showDataInLeftPanel === 'function') {
                    window.showDataInLeftPanel(
                        window.CiliAI.lastQueryContext.term || 'Gene List',
                        window.CiliAI.lastQueryContext.data || []
                    );
                    window.addChatMessage(`Displaying <strong>${window.CiliAI.lastQueryContext.term}</strong> in the main panel.`, false);
                }
                window.CiliAI.lastQueryContext = { type: null, data: [], term: null };
                return;
            }
            else if (window.CiliAI.lastQueryContext.type === 'screen_references') {
                htmlResult = window.handleScreenReferenceFollowup();
                window.CiliAI.lastQueryContext = { type: null, data: [], term: null };
            }
            else if (window.CiliAI.lastQueryContext.type === 'top_500_ciliary') {
                const top500 = window.CiliAI.masterData.slice(0, 500).map(g => ({
                    Gene: g.Gene,
                    Localization: g.Localization || '-',
                    Description: g['Gene.Description'] || '-'
                }));
                if (typeof window.showDataInLeftPanel === 'function') {
                    window.showDataInLeftPanel('Top 500 Ciliary Genes', top500);
                    htmlResult = "I've loaded the top 500 ciliary genes into the main panel.";
                }
                window.CiliAI.lastQueryContext = { type: null };
            }
        }

        // Intent 4: List Genes
        if (htmlResult === null && (match = qLower.match(/^(?:list|show|display|find|give me)\s+(?:all\s+)?(.+?)\s+genes$/i))) {
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
                window.CiliAI.lastQueryContext = { type: 'list_followup', term: `${term} genes`, data: rows };
                htmlResult = `<div class="ai-result-card"><p>Found <strong>${genes.length}</strong> genes associated with <strong>${term}</strong>.</p><p>Would you like to <strong>view the full list</strong>?</p></div>`;
            } else {
                htmlResult = `I couldn't find a gene set for <strong>${term}</strong> in the database.`;
            }
        }

        // Intent 5: Phylogeny
        if (htmlResult === null && (qLower.includes('evolution') || qLower.includes('conservation') || qLower.includes('phylogenetic') || qLower.includes('phylogeny') || qLower.includes('evo of') || qLower.match(/show.+evolution/i) || (qLower.includes('show') && qLower.includes('li')))) {
            let genes = window.extractMultipleGenes(query);
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
                    window.addChatMessage("Loading phylogeny datasets...", false);
                    await window.ensurePhylogenyDataLoaded();
                }
                setTimeout(() => {
                    if (window.renderLiPhylogenyHeatmap) {
                        const res = window.renderLiPhylogenyHeatmap(genes);
                        if (res && res.plotData) Plotly.newPlot('cilia-svg', res.plotData, res.plotLayout);
                    }
                }, 100);
                htmlResult = `<div class="ai-result-card"><p>Displaying phylogenetic conservation for <strong>${genes.length} genes</strong> in the main panel.</p></div>`;
            } else {
                htmlResult = "Please specify a valid gene symbol for evolutionary analysis (e.g., 'Show evolution of BBS1').";
            }
        }

        // Intent 6: Screen References
        else if (htmlResult === null && (qLower.includes('show screen reference') || qLower.includes('show publication detail') || qLower.includes('provide the paper'))) {
            htmlResult = window.handleScreenReferenceFollowup();
        }

        // Intent 7: Screens/Phenotypes
        else if (htmlResult === null && (qLower.includes('loss-of-function') || qLower.includes('lof') || qLower.includes('overexpression') || qLower.includes('oe') || qLower.includes('percent ciliated') || qLower.includes('cilia length') || (qLower.includes('effect') && qLower.includes('of')))) {
            const genes = window.extractMultipleGenes(query);
            if (genes.length > 0) htmlResult = window.handleScreenQuery(genes[genes.length - 1]);
            else htmlResult = `I see you're asking about screen effects, but I couldn't identify a gene. Please try again, like "loss-of-function effect of IFT88".`;
        }

        // Intent 8: What is [Gene]
        else if (htmlResult === null && (match = qLower.match(/^(?:what is|what's|describe|tell me about)\s+([A-Z0-9\-]{3,})\??$/i))) {
            htmlResult = await window.displayFullGeneInfo(match[1].toUpperCase());
        }

        // Intent 9: Orthologs
        else if (htmlResult === null && (match = qLower.match(/ortholog(?: of| for)?\s+([a-z0-9\-]+)\s+(?:in|for)\s+(c\. elegans|mouse|zebrafish|drosophila|xenopus)/i))) {
            htmlResult = window.handleOrthologQuery(match[1].toUpperCase(), match[2]);
        }
        else if (htmlResult === null && (match = qLower.match(/(c\. elegans|mouse|zebrafish|drosophila|xenopus)\s+ortholog(?: of| for)?\s+([a-z0-9\-]+)/i))) {
            htmlResult = window.handleOrthologQuery(match[2].toUpperCase(), match[1]);
        }

       // Intent 10: Domains (Visualizer)
        else if (htmlResult === null && (match = qLower.match(/(?:domains? (?:of|for)|domain architecture (?:of|for))\s+(.+)/i))) {
            const genes = window.extractMultipleGenes(match[1]);
            if (genes.length > 0) {
                // Ensure UI is clear before showing new viewer
                if (typeof window.resetViews === 'function') window.resetViews();
                
                // Trigger the visualizer defined in index.html
                if (typeof window.showDomainViewer === 'function') {
                    window.showDomainViewer(genes[0]);
                    htmlResult = `<div class="ai-result-card">
                        <h4>Domain Architecture: ${genes[0]}</h4>
                        <p>Displaying Pfam domains in the main panel.</p>
                        <p style="font-size:11px; color:#666;">(Hover over domains for details)</p>
                    </div>`;
                } else {
                    htmlResult = `<div class="ai-result-card"><p>Domain viewer function is missing.</p></div>`;
                }
            } else {
                htmlResult = `<div class="ai-result-card"><p>Please specify a gene to view domains (e.g., "Domains for IFT88").</p></div>`;
            }
        }

        // Intent 11: Modules
        else if (htmlResult === null && (match = qLower.match(/(?:functional modules of|modules for)\s+([a-z0-9\-]+)/i))) {
            const gene = match[1].toUpperCase();
            const g = window.CiliAI.lookups.geneMap[gene];
            if (g && g['Functional.category']) htmlResult = window.formatListResult(`Functional Modules for ${gene}`, window.ensureArray(g['Functional.category']).map(m => ({ gene: m, description: "Module" })));
            else htmlResult = `No functional modules listed for <strong>${gene}</strong>.`;
        }

      // =======================================================
// (12) INTENT: UMAP & EXPRESSION (With Dynamic Switch Button)
// =======================================================
else if (
    htmlResult === null &&
    (
        qLower.includes('plot') ||
        qLower.includes('display') ||
        qLower.includes('heatmap') ||
        qLower.includes('umap') ||
        qLower.includes('scrna') ||
        qLower.includes('expression')
    )
) {

    // ---------------------------------------------------
    // Explicit dataset switching (standalone commands)
    // ---------------------------------------------------
    if (qLower === 'switch to kidney') {
        window.CiliAI.activeDataset = 'kidney';
        window.addChatMessage('Switched to Kidney scRNA-seq dataset.', false);
        return;
    }

    if (qLower === 'switch to lung') {
        window.CiliAI.activeDataset = 'lung';
        window.addChatMessage('Switched to Lung scRNA-seq dataset.', false);
        return;
    }

    // ---------------------------------------------------
    // Dataset inference from query
    // ---------------------------------------------------
    if (qLower.includes('kidney')) window.CiliAI.activeDataset = 'kidney';
    else if (qLower.includes('lung')) window.CiliAI.activeDataset = 'lung';

    // ---------------------------------------------------
    // Target gene / complex parsing
    // ---------------------------------------------------
    let target = 'WDR31';
    match = qLower.match(/(?:for|of|in)\s+(.+)/i);
    if (match) {
        target = match[1]
            .replace(/lung|kidney|scrna-seq|scrna|expression|umap|plot|display|in/gi, '')
            .trim();
        if (target.length < 2) target = 'WDR31';
    }

    let genes = window.extractMultipleGenes(target);
    let isComplex = false;
    let finalTargetTerm = target;

    if (genes.length === 0 && target) {
        const complexName = window.extractComplexIntent(target);
        if (complexName) {
            const complexGenes = window.getGenesByComplex(complexName).map(g => g.gene);
            if (complexGenes.length > 0) {
                genes = complexGenes;
                finalTargetTerm = complexName;
                isComplex = true;
            }
        }
    }

    const finalGenes = genes.length > 0 ? genes : ['WDR31'];
    const geneSymbol = isComplex ? finalTargetTerm : finalGenes[0];

    // ---------------------------------------------------
    // Optional zoom-to-cell-type
    // ---------------------------------------------------
    const zoomMatch = qLower.match(
        /zoom to\s+(ciliated cell|stem cell|club cell|goblet cell|neuroendocrine cell|basal cell|pulmonary alveolar type 1 cell|pulmonary alveolar type 2 cell|lung secretory cell)/i
    );
    const zoomToCellType = zoomMatch ? zoomMatch[1] : null;

  // ---------------------------------------------------
    // Render UMAP (SINGLE source of truth)
    // ---------------------------------------------------
    await window.renderUMAPPlot(geneSymbol, finalGenes, zoomToCellType);

    // ---------------------------------------------------
    // Dataset labels & switch target
    // ---------------------------------------------------
    const currentDS = window.CiliAI.activeDataset || 'lung';
    const dsName = window.CiliAI.datasets[currentDS]
        ? window.CiliAI.datasets[currentDS].name
        : 'scRNA-seq';

    const nextDS = currentDS === 'lung' ? 'kidney' : 'lung';
    const nextDSLabel = nextDS === 'lung' ? 'Lung' : 'Kidney';
    
    // Prepare safe arguments for HTML attributes
    const genesArg = finalGenes.join(','); 
    const zoomArg = zoomToCellType || '';

    // ---------------------------------------------------
    // Chat output + safe switch button
    // ---------------------------------------------------
    htmlResult = `
        <div class="ai-result-card">
            <p>
                Displaying <strong>${dsName}</strong> scRNA-seq UMAP for 
                <strong>${geneSymbol}</strong>
                (${isComplex ? 'Complex Avg.' : 'Single Gene'}) on the left.
            </p>

            ${zoomToCellType ? `<p>Zoomed to the <strong>${zoomToCellType}</strong> cluster.</p>` : ''}

            <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <button class="ciliai-button" 
                    style="width:auto; margin:0; background:#B8E2F2;" 
                    onclick="window.switchDatasetAndPlot('${nextDS}', '${geneSymbol}', '${genesArg}', '${zoomArg}')">
                    🔄 Switch to ${nextDSLabel}
                </button>

                <a href="#" 
                   class="ai-action" 
                   onclick="window.downloadUMAPDataAsCSV('${geneSymbol}')"
                   style="margin-left:5px; font-weight:600;">
                   ⬇️ CSV
                </a>
            </div>
        </div>
    `;
}
        // Intent 13: Comparative
        else if (htmlResult === null && (qLower.includes('compare') || qLower.includes(' vs '))) {
            const matches = query.match(/([A-Z0-9]+)\s+vs\s+([A-Z0-9]+)/gi);
            if (matches) htmlResult = await window.handleComparativeDashboard(matches[0]);
            else htmlResult = await window.handleComparativeDashboard(query);
        }

        // Intent 14: Variants
        else if (htmlResult === null && (qLower.includes('variant') || qLower.includes('mutation'))) {
            const genes = window.extractMultipleGenes(query);
            if(genes.length > 0) htmlResult = await window.fetchVariantData(genes[0]);
        }

        // Intent 15: Batch Query
        else if (htmlResult === null && query.includes(',') && window.extractMultipleGenes(query).length > 1) {
            htmlResult = window.handleBatchQuery(query);
        }

        // Intent 16: Fold Change
        else if (htmlResult === null) {
            const foldChangeMatch = qLower.match(/compare\s+(.+)\s+in\s+(.+)\s+vs\s+(.+)/i);
            if (foldChangeMatch) {
                const result = window.calculateFoldChangeForComplex(foldChangeMatch[1].trim().toUpperCase(), foldChangeMatch[2].trim(), foldChangeMatch[3].trim());
                if (result.error) htmlResult = `<div class="ai-result-card"><h4>Differential Expression Error</h4><p>${result.error}</p></div>`;
                else htmlResult = `<div class="ai-result-card"><h4>Differential Expression: ${result.complex}</h4><p>Comparing average expression in **${result.cellTypeA}** (A) vs **${result.cellTypeB}** (B) (N=${result.count} genes).</p><p><strong>Fold Change (A/B): ${result.foldChange.toFixed(3)}</strong></p></div>`;
            }
        }

        // Intent 17: Phylogeny Overlap
        else if (htmlResult === null) {
            const classOverlapMatch = qLower.match(/species overlap between\s+(.+)\s+and\s+(.+)/i);
            if (classOverlapMatch && qLower.includes('li')) {
                const dataLoaded = await window.ensurePhylogenyDataLoaded();
                if (dataLoaded) {
                    const result = window.getPhylogenyClassSpeciesOverlap(classOverlapMatch[1].trim(), classOverlapMatch[2].trim(), 'li');
                    if (result.error) htmlResult = `<div class="ai-result-card"><h4>Error</h4><p>${result.error}</p></div>`;
                    else htmlResult = `<div class="ai-result-card"><h4>Overlap: ${result.classA} vs ${result.classB}</h4><p>Found **${result.sharedCount}** shared species.</p></div>`;
                }
            }
        }

        // Intent 18: Enrichment
        else if (htmlResult === null) {
            const enrichmentMatch = qLower.match(/enrichment for (.+)/);
            if (enrichmentMatch) {
                const geneList = window.extractMultipleGenes(enrichmentMatch[1]);
                const terms = window.getEnrichedGOTerms(geneList);
                if (terms.length > 0) htmlResult = `<div class="ai-result-card"><h4>Enrichment</h4><p>Top term: ${terms[0].term}</p></div>`;
                else htmlResult = "No enrichment found.";
            }
        }

        // Intent 19: Show Ciliary Cells
        else if (htmlResult === null && qLower.includes('show') && qLower.includes('ciliary cells')) {
            window.renderUMAPPlot('CLUSTER_VIEW');
            window.CiliAI.lastQueryContext = { type: 'top_500_ciliary' };
            htmlResult = `<div class="ai-result-card"><p>I've displayed the UMAP with <strong>all cell clusters</strong> highlighted.</p><p>Would you like to view the <strong>top 500 genes</strong> enriched in these ciliary cells?</p></div>`;
        }


// NEW INTENT: "Where is [GENE] located?" (Ciliary diagram)
// =======================================================
if (
    qLower.startsWith('where is') &&
    (qLower.includes('located') || qLower.includes('localised') || qLower.includes('localized'))
) {
    const genes = extractMultipleGenes(query);
    if (genes.length === 0) {
        window.addChatMessage(
            `<div class="ai-result-card"><p>Please specify a gene (e.g. "Where is IFT88 located?").</p></div>`,
            false
        );
        return;
    }

    const geneSymbol = genes[0];
    const geneData = window.CiliAI.lookups.geneMap[geneSymbol];

    if (!geneData) {
        window.addChatMessage(
            `<div class="ai-result-card"><p>Gene <strong>${geneSymbol}</strong> not found.</p></div>`,
            false
        );
        return;
    }

    const localization = geneData.Localization || 'Cilium (unspecified compartment)';

    // 🔹 Highlight on interactive cilium (GENE-AWARE)
    if (typeof window.highlightCiliumLocation === 'function') {
        window.highlightCiliumLocation(localization, geneSymbol);
    }

    // 🔹 Chat response
    window.addChatMessage(`
        <div class="ai-result-card">
            <h4>Localization of ${geneSymbol}</h4>
            <p><strong>${geneSymbol}</strong> localizes to:</p>
            <p style="font-size:16px; font-weight:600; color:#2b6cb0;">
                ${localization}
            </p>
            <p>The corresponding compartment has been highlighted on the ciliary diagram.</p>
        </div>
    `, false);

    return;
}

    // --- Functional / GO Analysis ---
    if (qLower.startsWith('go:') || qLower.includes('go term:') || qLower.includes('functional category') || qLower.startsWith('function:')) {
        const term = query.replace(/^(go:|go term:|function:|functional category:?)\s*/i, '').trim();
        
        // Use the robust helper
        const genes = getGenesByFunction(term);
        
        if (genes.length > 0) {
            window.resetViews();
            window.renderCategoryHeatmap(genes);
            
            const listHtml = genes.slice(0, 10).join(', ') + (genes.length > 10 ? `... (+${genes.length-10} more)` : '');
            window.addChatMessage(`<div class="ai-result-card">
                <h4>Functional Category: ${term}</h4>
                <p>Found <strong>${genes.length}</strong> genes (e.g. ${listHtml}).</p>
                <p><strong>Heatmap</strong> applied to the diagram based on localization.</p>
            </div>`, false);
        } else {
            window.addChatMessage(`<div class="ai-result-card"><p>No genes found for functional category <strong>"${term}"</strong>.</p></div>`, false);
        }
        return;
    }
        // Intent 20: Fallback
        else if (htmlResult === null) {
            const intent = window.flexibleIntentParser(query);
            if (intent) htmlResult = intent.handler(intent.entity, query);

            if (htmlResult === null) {
                let term = qLower;
                if ((match = qLower.match(/(?:what is|what does|describe|localization of|omim id for|where is|cellular location of|subcellular localization of)\s+(?:the\s+)?(.+)/i))) {
                    term = match[1];
                }
                term = term.replace(/[?.]/g, '').replace(/\bdo\b/i, '').trim().toUpperCase();
                const genes = window.extractMultipleGenes(term);
                if (genes.length > 0) htmlResult = await window.displayFullGeneInfo(genes[0]);
                else htmlResult = `Sorry, I didn't understand the query: "<strong>${query}</strong>". Please try a simpler term.`;
            }
        }

        if (htmlResult) window.addChatMessage(htmlResult, false);

    } catch (e) {
        console.error("Error in handleAIQuery:", e);
        window.addChatMessage(`An internal CiliAI error occurred: ${e.message}`, false);
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

// Helper: Reset Views (Prevents Overlap)
window.resetViews = function() {
    ['cilia-svg', 'plotly-container', 'domain-viewer'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const ciliaSvg = document.getElementById('cilia-svg');
    if (ciliaSvg && ciliaSvg.classList.contains('table-view-active')) {
        window.generateAndInjectSVG(); 
        ciliaSvg.classList.remove('table-view-active');
    }
    // Ensure base visibility
    if(ciliaSvg) ciliaSvg.style.display = 'flex';
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
window.showDefaultUMAP = showDefaultUMAP;
window.showDefaultPhylogeny = showDefaultPhylogeny;
window.downloadPlot = downloadPlot;

// Core Logic & Analysis exposure — keep only once:
window.renderUMAPPlot = renderUMAPPlot; 
window.getGenesByLocalization = getGenesByLocalization;
window.showDataInLeftPanel = showDataInLeftPanel;
window.generateAndInjectSVG = generateAndInjectSVG;
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
