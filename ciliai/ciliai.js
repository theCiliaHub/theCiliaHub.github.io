/* ==============================================================
 * CiliAI – Interactive Explorer (v5.3 – Fixed Layout Injection)
 * ============================================================== */

(function () {
    'use strict';

    // ==========================================================
    // 1. GLOBAL STATE & CONSTANTS
    // ==========================================================

    window.CiliAI = {
        data: { umap: [] },
        masterData: [],
        ready: false,
        lookups: {},
        cellDataCache: {}
    };

    let lastQueryContext = { type: null, data: [], term: null };
    window.liPhylogenyCache = null;
    window.neversPhylogenyCache = null;
    window.CiliAI_UMAP = null;

   
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

    function log(message) {
        console.log(`[CiliAI] ${message}`);
    }

    // ==========================================================
    // 2. DATA LOADING
    // ==========================================================

    window.loadCiliAIData = async function(timeoutMs = 60000) {
        const baseUrl = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/';
        try {
            console.log(`[CiliAI] Fetching database...`);
            const [mainRes, lookupsRes] = await Promise.all([
                fetch(baseUrl + 'ciliAI_master_database.json'),
                fetch(baseUrl + 'ciliAI_lookups.json')
            ]);
            if (!mainRes.ok || !lookupsRes.ok) throw new Error('HTTP error during fetch');
            
            const mainData = await mainRes.json();
            const lookupData = await lookupsRes.json();

            window.CiliAI.masterData = mainData.masterData;
            window.CiliAI.lookups = lookupData.lookups;
            window.CiliAI.data.umap = mainData.umapData;
            window.CiliAI_UMAP = mainData.umapData;

            window.CiliAI.lookups.geneMap = {};
            mainData.masterData.forEach(g => { if(g.Gene) window.CiliAI.lookups.geneMap[g.Gene.toUpperCase()] = g; });

            window.CiliAI.lookups.umapByGene = {};
            if(window.CiliAI_UMAP) window.CiliAI_UMAP.forEach(p => { if(p.Gene) window.CiliAI.lookups.umapByGene[p.Gene.toUpperCase()] = p; });

            log("Building scRNA cache...");
            window.CiliAI.cellDataCache = {};
            mainData.masterData.forEach(g => { if(g.Gene && g.expression?.scRNA) window.CiliAI.cellDataCache[g.Gene.toUpperCase()] = g.expression.scRNA; });

            window.CiliAI.ready = true;
            console.log(`[CiliAI] Ready: ${window.CiliAI.masterData.length} genes.`);
            
            // Notify UI if waiting
            if (typeof window.CiliAI_UI_OnReady === 'function') window.CiliAI_UI_OnReady();

        } catch (err) {
            console.error("[CiliAI] Load failed:", err);
            window.CiliAI.ready = false;
        }
    };

    window.initCiliAI = async function() { await window.loadCiliAIData(); };

    // ==========================================================
    // 3. DISPLAY LOGIC (Updated to Fix .content-area error)
    // ==========================================================

    /**
     * This function is called by globals.js routing.
     * We update it to inject the NEW UI structure.
     */
    window.displayCiliAIPage = async function () {
        console.log("CiliAI: displayCiliAIPage() called.");

        // 1. Try to find a container. Old routing looked for .content-area
        let area = document.querySelector('.content-area') || document.getElementById('content-area');
        
        // 2. If not found, use #ciliai-app or fallback to main/body (Safety Net)
        if (!area) {
            area = document.getElementById('ciliai-app');
            if (!area) {
                // Create the root container if it doesn't exist
                area = document.createElement('div');
                area.id = 'ciliai-app';
                // Replace main content
                const main = document.querySelector('main') || document.body;
                main.innerHTML = ''; 
                main.appendChild(area);
                console.log("CiliAI: Created #ciliai-app container.");
            }
        }

        // 3. Inject the Layout Skeleton for ciliai_ui.js
        // This provides the IDs: #sidebar, #left-panel, #right-panel
        area.innerHTML = `
            <div id="ciliai-layout" style="display:flex; width:100%; height:calc(100vh - 60px);">
                <aside id="sidebar" style="width:260px; background:#1e293b; color:white; overflow-y:auto; flex-shrink:0;"></aside>
                <section id="left-panel" style="width:380px; background:white; border-right:1px solid #ddd; overflow-y:auto; flex-shrink:0; display:flex; flex-direction:column;"></section>
                <main id="right-panel" style="flex-grow:1; background:#f4f6f9; padding:20px; overflow-y:auto; display:flex; flex-direction:column; gap:20px;">
                    <div id="dataStatus">Initializing...</div>
                </main>
            </div>
        `;

        // 4. Trigger UI Build if ciliai_ui.js is loaded
        if (window.CiliAI_UI && typeof window.CiliAI_UI.renderPlotHome === 'function') {
             // Re-run boot process since we wiped the DOM
             // We can assume ciliai_ui.js is listening for DOMContentLoaded, but since we just changed the DOM dynamically:
             if (typeof window.bootCiliAI_UI === 'function') {
                 window.bootCiliAI_UI(); // Call exposed boot function if available
             } else {
                 // Fallback: reload the script or rely on event listeners if attached to document body
                 location.reload(); // Hard reset ensures UI scripts re-bind to new DOM
                 return; 
             }
        }

        console.log("CiliAI: Layout injected.");
    };


    /**
     * Normalizes a term for keyword matching.
     */
    function normalizeTerm(term) {
        if (typeof term !== 'string') return '';
        return term.toLowerCase().replace(/[\W_]/g, '').replace(/s$/, '');
    }


/* ==============================================================
 * CiliAI – Interactive Explorer (v5.1 – Nov 15, 2025)
 * ==============================================================
 * • BUILT FROM SCRATCH based on user's question list.
 * • Loads the pre-compiled 'ciliAI_master_database.json' + 'ciliAI_lookups.json'
 * • Lazy-loads the large phylogeny files only when needed.
 * • Fixes all known layout, normalization, and query routing bugs.
 * • INTEGRATED: displayFullGeneInfo (Nov 15, 2025)
 * ============================================================== */

(function () {
    'use strict';

    // ==========================================================
    // 1. GLOBAL STATE & CONSTANTS
    // ==========================================================

    window.CiliAI = {
        data: {
            umap: [] // Init umap data
        },
        masterData: [],
        ready: false,
        lookups: {}
    };

    let lastQueryContext = { type: null, data: [], term: null };

    // Phylogeny data is lazy-loaded, so it starts as null
    window.liPhylogenyCache = null;
    window.neversPhylogenyCache = null;
    window.CiliAI_UMAP = null; // This will be populated from the master DB

    // --- Data Maps (These are now just for the AI brain) ---


// ===========================================================
// INIT — Loads all precompiled CiliAI datasets
// ===========================================================
async function initCiliAI() {
    console.log('CiliAI: Initializing (v5.2 Pre-compiled)…');

    await loadCiliAIData();

    if (!window.CiliAI.masterData || window.CiliAI.masterData.length === 0) {
        console.error("CiliAI: Master data is empty. Database load failed.");
        window.CiliAI.ready = false;
        return;
    }

    window.CiliAI.ready = true;
    console.log('CiliAI: Ready! Pre-compiled database loaded.');

    // Tell UI layer that data is ready
    if (typeof window.CiliAI_UI_OnReady === "function") {
        window.CiliAI_UI_OnReady();
    }
}


    // ==========================================================
    // 3. STATIC UI & PAGE DISPLAY
    // ==========================================================

    const structureInfoMap = {
        'basal-body': { title: 'Basal Body', description: "The cilium's 'anchor'...", genes: ['CEP164', 'OFD1'] },
        'transition-zone': { title: 'Transition Zone', description: "The 'ciliary gate'...", genes: ['NPHP1', 'MKS1'] },
        'axoneme': { title: 'Axoneme', description: 'The microtubule core...', genes: ['IFT88', 'DNAH5'] },
        'ciliary-membrane': { title: 'Ciliary Membrane', description: 'Specialized membrane...', genes: ['PKD1', 'ARL13B'] },
        "nucleus": { title: "Nucleus", description: "Contains the cell's DNA..." },
        "cell-body": { title: "Cell Body / Cytoplasm", description: "The main body of the cell..." },
    };

    
    function getPageHTML() {
        return `
        <div class="container">
            <div class="left-panel">
                <div class="header">
                    <h1>🔬 CiliAI Explorer</h1>
                    <p>Interactive ciliary biology and gene function explorer</p>
                </div>
                <div class="toolbar">
                    <input type="text" id="geneSearch" placeholder="Search gene (e.g., IFT88, NPHP1, CEP290)">
                    <button onclick="searchGene()">Find Gene</button>
                    <span id="dataStatus" class="status loading">Initializing...</span>
                </div>
                <div class="diagram-container">
                    <div class="interactive-cilium">
                        <div id="cilia-svg"></div>
                    </div>
                </div>
                <div class="bottom-bar" id="bottomBar">
                    <h3>Click on a compartment or search for a gene</h3>
                    <div class="legend">
                        <div class="legend-item" onclick="selectComp('axoneme')"><div class="legend-color" style="background: #4A5568;"></div><span>Axoneme</span></div>
                        <div class="legend-item" onclick="selectComp('transition-zone')"><div class="legend-color" style="background: #718096;"></div><span>Transition Zone</span></div>
                        <div class="legend-item" onclick="selectComp('basal-body')"><div class="legend-color" style="background: #4A5568;"></div><span>Basal Body</span></div>
                        <div class="legend-item" onclick="selectComp('ciliary-membrane')"><div class="legend-color" style="background: #A0AEC0;"></div><span>Ciliary Membrane</span></div>
                        <div class="legend-item" onclick="selectComp('cell-body')"><div class="legend-color" style="background: #E9EDF2;"></div><span>Cell Body</span></div>
                        <div class="legend-item" onclick="selectComp('nucleus')"><div class="legend-color" style="background: #C8D0DD;"></div><span>Nucleus</span></div>
                    </div>
                </div>
            </div>
            <div class="right-panel">
                <div class="welcome-section">
                    <h2>Welcome to CiliAI! 🎉</h2>
                    <p><strong>CiliAI</strong> is an AI-powered tool to explore ciliary biology, gene function, and disease data.</p>
                    
                    <div class="ciliai-quick-start">
                        <strong>Quick Start Plots:</strong>
                        <button class="welcome-action-btn" onclick="showDefaultUMAP()">Display FOXJ1 in Lung scRNA-seq</button>
                        <button class="welcome-action-btn" onclick="showDefaultPhylogeny()">View Default Phylogenetics</button>
                    </div>
                    <ol class="steps">
                        <li>Type <strong>"What is IFT88?"</strong> in the text box below.</li>
                        <li>Click on the <strong>"Transition Zone"</strong> in the cilia diagram.</li>
                        <li>Search for a gene like <strong>CEP290</strong> in the search bar.</li>
                        <li>Ask questions like <strong>"List genes in the axoneme"</strong></li>
                        <li>Press 👎 if a response doesn't make sense.</li>
                        <li>Press 👍 for helpful answers.</li>
                        <li>Use 📝 to start a new conversation.</li>
                    </ol>
                    <div class="disclaimer">
                        <strong>⚠️ Disclaimer:</strong> CiliAI is an AI system and may produce misleading results. Use it for data exploration and hypothesis generation, not as a replacement for curated databases.
                    </div>
                </div>
                <div class="chat-container">
                    <div class="messages" id="messages"></div>
                    <div class="input-area">
                        <div class="input-container">
                            <input type="text" id="chatInput" placeholder="Ask CiliAI...">
                            <button onclick="sendMsg()">Send</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }
function injectPageCSS() {
        const styleId = 'ciliai-dynamic-styles';
        if (document.getElementById(styleId)) return;

        const css = `
            * { margin: 0; padding: 0; box-sizing: border-box; }
            .content-area.content-area-full {
                height: calc(100vh - 110px); /* Assumes 60px header + 50px footer */
                padding: 0 !important; margin: 0 !important; overflow: hidden;
            }
            .container { display: grid; grid-template-columns: 1fr 450px; height: 100%; width: 100%; gap: 0; overflow: hidden; }
            .interactive-cilium.table-view-active { max-width: none !important; padding: 0 !important; border: none !important; box-shadow: none !important; height: 100%; }
            .ciliai-table-container { width: 100%; height: 100%; display: flex; flex-direction: column; padding: 0; background: #fff; }
            .ciliai-table-container h3 { font-size: 16px; color: #2d3748; margin-bottom: 10px; padding: 10px 10px 0 10px; }
            .ciliai-button { padding: 8px 12px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; transition: all 0.2s; font-size: 12px; margin-bottom: 10px; margin-left: 10px; width: 150px; }
            .ciliai-button:hover { background: #5568d3; }
            .ciliai-table-scroll-wrapper { flex: 1; overflow-y: auto; border-top: 1px solid #e1e8ed; border-bottom: 1px solid #e1e8ed; margin: 0 0 10px 0; }
            .ciliai-data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .ciliai-data-table th, .ciliai-data-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e1e8ed; }
            .ciliai-data-table th { background: #f8f9fa; position: sticky; top: 0; z-index: 1; }
            .ciliai-data-table tr:last-child td { border-bottom: none; }
            .ciliai-data-table td strong { color: #667eea; font-weight: 600; }
            .ciliai-message { margin-bottom: 15px; animation: fadeIn 0.3s ease; }
            .ciliai-message.user { text-align: right; }
            .ciliai-message-content { display: inline-block; max-width: 85%; padding: 12px 16px; border-radius: 8px; font-size: 13px; line-height: 1.5; }
            .ciliai-message.user .ciliai-message-content { background: #667eea; color: white; border-radius: 18px 18px 4px 18px; }
            .ciliai-message.assistant .ciliai-message-content { background: #f8f9fa; color: #2d3748; border: 1px solid #e1e8ed; border-radius: 18px 18px 18px 4px; }
            .ciliai-reaction-buttons { display: flex; gap: 8px; margin-top: 8px; font-size: 16px; }
            .ciliai-reaction-btn { cursor: pointer; opacity: 0.6; transition: all 0.2s; user-select: none; }
            .ciliai-reaction-btn:hover { opacity: 1; transform: scale(1.15); }
            .ai-result-card { font-size: 12px; line-height: 1.6; margin-top: 8px; }
            .ai-result-card h4 { font-size: 1.1em; color: #2d3748; margin-bottom: 5px; }
            .ai-result-card h3 { font-size: 1.05em; color: #2d3748; margin-bottom: 5px; margin-top: 8px; }
            .ai-result-card strong { color: #667eea; }
            .ai-result-card ul { margin-left: 20px; margin-top: 5px; }
            .ai-result-card table { width: 100%; font-size: 11px; margin-top: 5px; border-collapse: collapse; }
            .ai-result-card table th, .ai-result-card table td { border: 1px solid #e1e8ed; padding: 4px 6px; text-align: left; }
            .ai-result-card table th { background: #f8f9fa; }
            .ai-action { color: #667eea; text-decoration: none; font-weight: 600; }
            .ai-action:hover { text-decoration: underline; }
            .left-panel { display: flex; flex-direction: column; background: #f5f7fa; border-right: 1px solid #e1e8ed; overflow: hidden; }
            
            /* --- MODIFIED: Squashed header --- */
            .header { padding: 10px 20px; background: white; color: #2c3e50; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-bottom: 1px solid #e1e8ed; }
            .header h1 { font-size: 20px; font-weight: 600; margin-bottom: 2px; color: #2c3e50; }
            .header p { font-size: 12px; color: #666; }
            
            /* --- MODIFIED: Squashed toolbar --- */
            .toolbar { padding: 10px 20px; background: white; border-bottom: 1px solid #e1e8ed; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
            .toolbar input { flex: 1; min-width: 200px; padding: 8px 12px; border: 1px solid #d1d9e0; border-radius: 6px; font-size: 13px; }
            .toolbar button { padding: 8px 15px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; transition: all 0.2s; font-size: 13px; }
            .toolbar button:hover { background: #5568d3; }
            .status { font-size: 11px; padding: 4px 8px; border-radius: 4px; font-weight: 500; }
            /* --- END OF MODIFICATIONS --- */

            .status.loading { background: #fff3cd; color: #856404; }
            .status.ready { background: #d4edda; color: #155724; }
            .status.error { background: #f8d7da; color: #721c24; }
            .diagram-container { flex: 1; padding: 20px; overflow: auto; display: flex; justify-content: center; align-items: center; background: white; }
            .interactive-cilium { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); max-width: 600px; width: 100%; border: 1px solid #e1e8ed; }
            .cilia-part { cursor: pointer; transition: all 0.2s ease; }
            .cilia-part:hover { opacity: 0.8; }
            .cilia-part:focus { outline: 2px solid #667eea; outline-offset: 2px; }
            .cilia-part.selected, .cilia-part.active { filter: brightness(1.2); stroke: #ff6b00 !important; stroke-width: 4 !important; }
            
            /* --- MODIFIED: Reduced padding and height --- */
            .bottom-bar { padding: 15px 20px; background: white; border-top: 1px solid #e1e8ed; min-height: 90px; max-height: 150px; overflow-y: auto; }
            
            .bottom-bar h3 { font-size: 16px; color: #2d3748; margin-bottom: 12px; }
            .right-panel { display: flex; flex-direction: column; background: #f5f7fa; overflow: hidden; }
            .welcome-section { padding: 25px; background: white; border-bottom: 1px solid #e1e8ed; max-height: 35vh; overflow-y: auto; flex-shrink: 0; }
            .welcome-section h2 { font-size: 20px; color: #2c3e50; margin-bottom: 12px; font-weight: 600; }
            .welcome-section p { font-size: 13px; line-height: 1.6; color: #4a5568; margin-bottom: 15px; }
            .steps { font-size: 12px; line-height: 1.7; color: #4a5568; padding-left: 20px; }
            .steps li { margin-bottom: 10px; }
            .disclaimer { margin-top: 15px; padding: 12px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px; font-size: 12px; color: #856404; }
            .chat-container { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
            .messages { flex: 1; padding: 20px; overflow-y: auto; background: white; }
            .input-area { padding: 15px 20px; background: white; border-top: 1px solid #e1e8ed; }
            .input-container { display: flex; gap: 10px; }
            .input-container input { flex: 1; padding: 12px 16px; border: 1px solid #d1d9e0; border-radius: 8px; font-size: 14px; }
            .input-container button { padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; transition: all 0.2s; }
            .input-container button:hover { background: #5568d3; }
            .legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
            .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #4a5568; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: all 0.2s; }
            .legend-item:hover { background: #f7fafc; }
            .legend-color { width: 14px; height: 14px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.2); }
            .gene-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
            .gene-badge { padding: 5px 10px; background: #667eea15; color: #667eea; border-radius: 5px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
            .gene-badge:hover { background: #667eea; color: white; }

            /* --- NEW STYLES for welcome panel buttons --- */
            .ciliai-quick-start {
                margin-top: 15px;
                padding-top: 15px;
                border-top: 1px solid #e1e8ed;
            }
            .ciliai-quick-start strong {
                display: block;
                font-size: 13px;
                color: #2d3748;
                margin-bottom: 10px;
            }
            .welcome-action-btn {
                display: inline-block;
                width: 100%;
                padding: 10px 15px;
                margin-bottom: 8px;
                font-size: 12px;
                font-weight: 500;
                text-align: left;
                background: #f8f9fa;
                color: #667eea;
                border: 1px solid #e1e8ed;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .welcome-action-btn:hover {
                background: #667eea;
                color: white;
                border-color: #667eea;
            }
            /* --- END NEW STYLES --- */

            @media (max-width: 992px) {
                .container { 
                    grid-template-columns: 1fr;
                    height: calc(100vh - 110px);
                }
            }
        `;

        const styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
    }
    

   function generateAndInjectSVG() {
        const svgContainer = document.getElementById('cilia-svg');
        if (!svgContainer) return;
        
        // --- THIS IS THE FIX ---
        // Ensure the panel is not in full-width mode when drawing the SVG
        const wrapper = svgContainer.closest('.interactive-cilium');
        if (wrapper) wrapper.classList.remove('table-view-active');
        // --- END OF FIX ---
        
        const svgHTML = `
        <svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto;">
            <defs>
                <linearGradient id="cytosolGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#F5F7FA;" /><stop offset="100%" style="stop-color:#E9EDF2;" /></linearGradient>
                <radialGradient id="nucleusGradient" cx="50%" cy="50%" r="50%"><stop offset="0%" style="stop-color:#D8DEE9;" /><stop offset="100%" style="stop-color:#C8D0DD;" /></radialGradient>
            </defs>
            <path id="cell-body" class="cilia-part" fill="url(#cytosolGradient)" stroke="#D8DEE9" stroke-width="2" d="M 50,380 C -20,300 20,200 150,200 C 280,200 320,300 250,380 Z"/>
            <circle id="nucleus" class="cilia-part" fill="url(#nucleusGradient)" stroke="#B0B8C8" stroke-width="2" cx="150" cy="320" r="40"/>
            <rect id="basal-body" class="cilia-part" fill="#4A5568" x="140" y="195" width="20" height="15"/>
            <path id="transition-zone" class="cilia-part" fill="#718096" stroke="#4A5568" stroke-width="2" d="M 142,195 L 138,180 L 162,180 L 158,195 Z"/>
            <path id="ciliary-membrane" class="cilia-part" fill="none" stroke="#A0AEC0" stroke-width="2" stroke-dasharray="4,4" d="M 138,180 L 145,10 L 155,10 L 162,180 Z"/>
            <path id="axoneme" class="cilia-part" fill="none" stroke="#4A5568" stroke-width="3" d="M 145,180 L 148,15 L 152,15 L 155,180 Z"/>
        </svg>`;
        svgContainer.innerHTML = svgHTML;
        setupSVGInteraction();
    }

    function setupSVGInteraction() {
        ['axoneme', 'transition-zone', 'basal-body', 'ciliary-membrane', 'cell-body', 'nucleus'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.onclick = () => selectComp(id);
            }
        });
    }

   function setupPageEventListeners() {
        document.body.addEventListener('click', e => {
            const feedbackBtn = e.target.closest('.ciliai-reaction-btn');
            if (feedbackBtn) {
                const type = feedbackBtn.textContent.includes('👍') ? 'up' : 'down';
                react(type);
                return;
            }
            const geneBadge = e.target.closest('.gene-badge');
            if (geneBadge) {
                const gene = geneBadge.textContent.trim();
                if (gene) searchGene(gene);
                return;
            }

            // --- THIS IS THE CORRECTED BLOCK ---
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
                    
                    // --- THIS IS THE FIX ---
                    // This block catches the click on "View [GENE] on UMAP"
                    else if (action === 'show-umap-plot') {
                        log(`Action: show-umap-plot for ${genes}`);
                        handleUmapPlot(genes); // This will now show the plot
                        return; // Stop processing
                    }
                    // --- END OF FIX ---

                    if (query) {
                        addChatMessage(query, true);
                        handleAIQuery(query);
                    }
                    return;
                }
                // (NEW) If there is no 'data-action', it's a normal link
                // (e.g., "View Publication"). We do NOT call e.preventDefault(),
                // so the browser will follow the href and target="_blank".
            }
            // --- END OF CORRECTION ---
        });

        const geneSearchInput = document.getElementById('geneSearch');
        if (geneSearchInput) geneSearchInput.addEventListener('keyup', e => {
            if (e.key === 'Enter') searchGene();
        });
        const chatInput = document.getElementById('chatInput');
        if (chatInput) chatInput.addEventListener('keyup', e => {
            if (e.key === 'Enter') sendMsg();
        });
        console.log("CiliAI: Page event listeners set up.");
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

    // --- 4B. Table & Panel Display ---
    
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
            .interactive-cilium.table-view-active { max-width: none !important; padding: 0 !important; border: none !important; box-shadow: none !important; height: 100%; }
            .ciliai-table-container { width: 100%; height: 100%; display: flex; flex-direction: column; padding: 0; background: #fff; }
            .ciliai-table-container h3 { font-size: 16px; color: #2d3748; margin-bottom: 10px; padding: 10px 10px 0 10px; }
            .ciliai-button { padding: 8px 12px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; transition: all 0.2s; font-size: 12px; margin-bottom: 10px; margin-left: 10px; width: 150px; }
            .ciliai-button:hover { background: #5568d3; }
            .ciliai-table-scroll-wrapper { flex: 1; overflow-y: auto; border-top: 1px solid #e1e8ed; border-bottom: 1px solid #e1e8ed; margin: 0 0 10px 0; }
            .ciliai-data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .ciliai-data-table th, .ciliai-data-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e1e8ed; }
            .ciliai-data-table th { background: #f8f9fa; position: sticky; top: 0; z-index: 1; }
            .ciliai-data-table tr:last-child td { border-bottom: none; }
            .ciliai-data-table td strong { color: #667eea; font-weight: 600; }
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
        const gene = geneSymbol.toUpperCase();
        const g = window.CiliAI.lookups.geneMap[gene];
        if (!g) return `Sorry, I could not find data for "${gene}".`;
        
        let html = `<div class="ai-result-card"><h4>Screen Results for <strong>${gene}</strong></h4>`;
        let foundScreenKeys = []; // (NEW) Store keys for follow-up

        // Use the exact column names from your CSV
        const percEffect = g['Percentage of ciliated cells (increase/decrease/no effect)'];
        const lofEffect = g['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'];
        const oeEffect = g['Overexpression effects on cilia length (increase/decrease/no effect)'];

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
                    foundScreenKeys.push(s.source); // (NEW) Add key to list
                    html += `<li><strong>${s.source}</strong>: ${s.result || 'No result'}</li>`;
                }
            });
            html += '</ul>';

            // (NEW) Add follow-up question
            html += `<p style="margin-top:10px;"><em>Would you like the references for these screens?</em></p>`;
            
            // (NEW) Set context for the next turn
            lastQueryContext = {
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
     * (REPLACEMENT) Displays a UMAP plot where each cell is colored by the expression of a specific gene,
     * AND clusters are labeled by cell type.
     * Adapted from user-provided 'displayUmapGeneExpression' function.
     */
    async function handleUmapPlot(geneSymbol) {
        const plotDivId = 'cilia-svg';
        const umapData = window.CiliAI_UMAP;
        const cellData = window.CiliAI.cellDataCache; // Use the cache
        const plotDiv = document.getElementById(plotDivId);

        if (!plotDiv) {
             console.error('UMAP plot container "cilia-svg" not found.');
            return;
        }

        if (!umapData || !cellData) {
            addChatMessage('UMAP or scRNA expression data is not available to plot.', false);
            return;
        }
        
        // --- Integration Step: Clear panel and set to full-width ---
        plotDiv.innerHTML = ''; // Clear the SVG
        const wrapper = plotDiv.closest('.interactive-cilium');
        if (wrapper) wrapper.classList.add('table-view-active');
        // --- End Integration Step ---

        const geneUpper = geneSymbol ? geneSymbol.toUpperCase() : 'FOXJ1'; // Default to FOXJ1 if no gene
        const geneExpressionMap = cellData[geneUpper];

        if (!geneExpressionMap) {
            addChatMessage(`Sorry, I could not find <strong>${geneSymbol}</strong> in the scRNA expression data. Displaying all clusters.`, false);
            // Fallback: Show plot colored by cluster/cell_type if gene not found
            // For now, just show the uncolored plot
            geneSymbol = 'Unknown';
        }

        const sampleSize = 15000;
        const sampledData = []; 

        if (umapData.length > sampleSize) {
            const usedIndices = new Set();
            while (sampledData.length < sampleSize) {
                const randomIndex = Math.floor(Math.random() * umapData.length);
                if (!usedIndices.has(randomIndex)) {
                    sampledData.push(umapData[randomIndex]);
                    usedIndices.add(randomIndex);
                }
            }
        } else {
            sampledData.push(...umapData);
        }

        // --- IMPORTANT: Assumes umapData has 'cell_type' property ---
        // If your umapData has 'cluster', change 'cell.cell_type' to 'cell.cluster' here.
        const expressionValues = sampledData.map(cell => geneExpressionMap ? (geneExpressionMap[cell.cell_type] || 0) : 0);
        const cellTypes = [...new Set(sampledData.map(d => d.cell_type))];
        const annotations = [];

        // Helper to find the median (center) of a cluster
        const median = (arr) => {
            const mid = Math.floor(arr.length / 2);
            const nums = [...arr].sort((a, b) => a - b);
            return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
        };

        for (const cellType of cellTypes) {
            if (!cellType) continue; // Skip undefined/null cell types
            const points = sampledData.filter(d => d.cell_type === cellType);
            if (points.length > 0) {
                const xCoords = points.map(p => p.x);
                const yCoords = points.map(p => p.y);
                
                annotations.push({
                    x: median(xCoords),
                    y: median(yCoords),
                    text: cellType,
                    showarrow: false,
                    font: {
                        color: '#FFFFFF',
                        size: 10,
                        family: 'Arial, sans-serif'
                    },
                    bgcolor: 'rgba(0,0,0,0.4)',
                    borderpad: 2,
                    bordercolor: 'rgba(0,0,0,0.4)',
                    borderwidth: 1,
                    xref: 'x',
                    yref: 'y'
                });
            }
        }

        const plotData = [{
            x: sampledData.map(p => p.x),
            y: sampledData.map(p => p.y),
            mode: 'markers',
            type: 'scattergl',
            hovertext: sampledData.map((p, i) => `Cell Type: ${p.cell_type}<br>Expression: ${expressionValues[i].toFixed(4)}`),
            hoverinfo: 'text',
            marker: {
                color: expressionValues,
                colorscale: 'Plasma',
                showscale: true,
                colorbar: { 
                    title: { 
                        text: 'Expression',
                        side: 'right' 
                    } 
                },
                size: 5,
                opacity: 0.8
            }
        }];

        const layout = {
            title: `UMAP Colored by ${geneUpper} Expression (Sample of ${sampleSize} cells)`,
            xaxis: { title: 'UMAP 1', zeroline: false, showgrid: false },
            yaxis: { title: 'UMAP 2', zeroline: false, showgrid: false },
            hovermode: 'closest',
            margin: { t: 50, b: 50, l: 50, r: 50 },
            plot_bgcolor: '#FFFFFF',
            paper_bgcolor: '#FFFFFF',
            annotations: annotations,
            showlegend: false
        };

        Plotly.newPlot(plotDivId, plotData, layout, { responsive: true });

        // --- Integration Step: Add "Back" button ---
        const backButton = document.createElement('button');
        backButton.id = 'ciliai-back-btn';
        backButton.className = 'ciliai-button';
        backButton.style.cssText = 'background: #718096; position: absolute; top: 10px; right: 10px; z-index: 10;';
        backButton.textContent = 'Back to Diagram';
        backButton.onclick = () => generateAndInjectSVG();
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
    async function displayFullGeneInfo(geneSymbol) {
        const gm = window.CiliAI.lookups && window.CiliAI.lookups.geneMap;
        if (!gm || !gm[geneSymbol]) {
            return `<div class="ai-result-card">No data found for gene ${geneSymbol}</div>`;
        }
        const g = gm[geneSymbol];
        
        // Use <h4> to match the chat window's existing style
        let html = `<div class="ai-result-card"><h4>Gene: ${geneSymbol}</h4>`;
        
        html += `<p><strong>Description:</strong> ${g['Gene.Description'] || '—'}</p>`;
        html += `<p><strong>Synonyms:</strong> ${g['Synonym.'] || '—'}</p>`;
        
        // --- THIS IS THE FIXED LINE ---
        html += `<p><strong>OMIM ID:</strong> ${g.OMIM?.ID || '—'}</p>`;
        // --- END OF FIX ---
        
        html += `<p><strong>Localization:</strong> ${g.Localization || '—'}</p>`;
        html += `<p><strong>Functional category:</strong> ${g['Functional.category'] || '—'}</p>`;
        
        html += `<h3>Cilia Effects</h3>`;
        html += `<p><strong>Overexpression effect:</strong> ${g['Overexpression effects on cilia length (increase/decrease/no effect)'] || '—'}</p>`;
        html += `<p><strong>Loss-of-Function effect:</strong> ${g['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'] || '—'}</p>`;
        html += `<p><strong>Percentage of ciliated cells effect:</strong> ${g['Percentage of ciliated cells (increase/decrease/no effect)'] || '—'}</p>`;
        
        html += `<h3>Screens</h3>`;
        if (Array.isArray(g.screens) && g.screens.length > 0) {
            html += `<ul>`;
            for (const s of g.screens) {
                html += `<li><strong>${s.source}</strong>: ${s.result}</li>`;
            }
            html += `</ul>`;
        } else {
            html += `<p>None</p>`;
        }
        
        html += `<h3>Expression Data (scRNA-seq)</h3>`;
        if (g.expression && g.expression.scRNA) {
            html += `<table><tr><th>Cell type</th><th>Value</th></tr>`;
            for (const [ct, val] of Object.entries(g.expression.scRNA)) {
                html += `<tr><td>${ct}</td><td>${val}</td></tr>`;
            }
            html += `</table>`;
        } else {
             html += `<p>None</p>`;
        }
        
        html += `<h3>Expression Data (Tissue)</h3>`;
        if (g.expression && g.expression.tissue) {
            html += `<table><tr><th>Tissue</th><th>Value</th></tr>`;
            for (const [t, val] of Object.entries(g.expression.tissue)) {
                html += `<tr><td>${t}</td><td>${val}</td></tr>`;
            }
            html += `</table>`;
        } else {
             html += `<p>None</p>`;
        }
        
        html += `<h3>Orthologs & Mouse Phenotype</h3>`;
        html += `<p><strong>Mouse ortholog:</strong> ${g.Ortholog_Mouse || '—'}</p>`;
        html += `<p><strong>C. elegans ortholog:</strong> ${g.Ortholog_C_elegans || '—'}</p>`;
        html += `<p><strong>Zebrafish ortholog:</strong> ${g.Ortholog_Zebrafish || '—'}</p>`;
        html += `<p><strong>Mouse phenotype:</strong> ${g.mouse_phenotype || '—'}</p>`;
        html += `<p><strong>Mouse ciliopathy phenotype:</strong> ${g.mouse_ciliopathy_phenotype || '—'}</p>`;
        
        html += `<h3>Phylogeny</h3>`;
        if (g.phylogeny) {
            for (const [pkey, pval] of Object.entries(g.phylogeny)) {
                html += `<p><strong>${pkey}</strong>: class=${pval.class}, class_id=${pval.class_id}</p>`;
                if (pval.species_data) {
                    html += `<p>Species data (length ${pval.species_data.length})</p>`;
                }
            }
        }
        
        html += `<h3>Complexes</h3>`;
        if (g.complex_components) {
            html += `<ul>`;
            for (const [ cname, members ] of Object.entries(g.complex_components)) {
                html += `<li><strong>${cname}</strong>: ${members.join(', ')}</li>`;
            }
            html += `</ul>`;
        } else {
            html += `<p>None listed</p>`;
        }

        html += `<p style="margin-top: 10px;"><a href="#" class="ai-action" data-action="show-li-heatmap" data-genes="${geneSymbol}">Show Conservation Plot</a></p>`;
        
        html += `</div>`; // Close ai-result-card
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
                handler: handleComplexQuery 
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
     * (REPLACEMENT) The Main "Level 1" Query Router
     * (FIXED Nov 17 2025): Moved query check to top, integrated new terminology map.
     */
   async function handleAIQuery(query) {
        const chatWindow = document.getElementById('messages');
        if (!chatWindow) return;

        // Validate query *before* any routing
        if (!query) return;
        const qLower = query.toLowerCase().trim();

        log(`Routing query: ${query}`);

        // =( 0 )= INTENT: GREETINGS & TERMINOLOGY
        const simpleGreetings = ['hello', 'hi', 'hey', 'greetings'];
        if (simpleGreetings.includes(qLower)) {
            log('Routing via: Intent (Greeting)');
            addChatMessage("Hello! I am CiliAI. How can I help you? Try asking 'What is IFT88?' or 'List genes in the transition zone'.", false);
            return;
        }
        
        const terminologyQueries = {
            // --- BASIC DEFINITIONS ---
            "what is a cilium": "A cilium is a microtubule-based organelle extending from the cell surface. Primary cilia sense extracellular signals; motile cilia generate fluid flow. (Rosenbaum & Witman 2002)",
            "what are cilia": "Cilia are conserved organelles on most eukaryotic cells. They function in sensory signaling (primary cilia) or motility (motile cilia). (Reiter, Blacque & Leroux 2012)",
            "tell me about cilia": "Cilia detect environmental cues or move fluids, depending on type. Defects cause human genetic disorders called ciliopathies. (Hildebrandt & Benzing 2011)",
            // --- IFT / TRAFFICKING --- 
            "explain ift":  "Intraflagellar Transport (IFT) is the bidirectional movement of protein complexes along the axoneme, essential for assembling and maintaining cilia. (Kozminski et al. 1993; Cole 2003)",
            "who discovered ift": "Keith Kozminski discovered Intraflagellar Transport in 1993 in Joel Rosenbaum’s lab using Chlamydomonas. (Kozminski et al. 1993)",
            "what is ift-a": "IFT-A (Intraflagellar Transport A) is the retrograde IFT complex required for returning cargo from tip to base and for membrane protein gating. (Behal et al. 2012; Mukhopadhyay et al. 2010)",
            "what is ift-b": "IFT-B is the anterograde IFT complex delivering axonemal building blocks from the base to the tip. It is essential for ciliogenesis. (Cole et al. 1998; Taschner & Lorentzen 2016)",
            "what is ift88": "IFT88 is an IFT-B core protein required for cilium assembly. Mutation causes cilia loss and polycystic kidney disease in mouse. (Pazour et al. 2000)",
            // --- BBSOME / CARGO TRAFFICKING ---
            "what is the bbsome": "The BBSome, a protein complex of 8 Bardet-Biedl syndrome (BBS) proteins, is a trafficking complex that ferries membrane proteins, including GPCRs, into and out of cilia. Mutations cause Bardet-Biedl Syndrome. (Jin et al. 2010; Nachury et al. 2007)",
            "list genes in bbsome": "The BBSome consists of BBS1, BBS2, BBS4, BBS5, BBS7, BBS8 (TTC8), BBS9, and BBIP1. (Nachury et al. 2007)",
            // --- TRANSITION ZONE & BASE ---
            "explain the transition zone": "The transition zone is the gate at the ciliary base that controls protein entry and exit via MKS and NPHP modules. (Garcia-Gonzalo & Reiter 2017)",
            "what is the basal body": "The basal body is the modified mother centriole that nucleates and anchors the axoneme. (Reiter et al. 2012)",
            "what is the transition fibre": "Transition fibres link the basal body to the membrane and help dock proteins entering the cilium. (Reiter et al. 2012)",
            "what is the mks complex": "The Meckel–Gruber Syndrome (MKS) complex forms part of the transition zone architecture and maintains ciliary gating. (Garcia-Gonzalo & Reiter 2017)",
            "what is the nphp complex": "The Nephronophthisis (NPHP) complex is a transition zone module required for proper gating and kidney function. (Reiter et al. 2012)",
            // --- AXONEME / STRUCTURE ---
            "what is the axoneme":  "The axoneme is the microtubule core of the cilium, usually organized as 9 outer doublets with or without a central pair. (Satir & Christensen 2007)",
            "what is the 9+0 structure": "A 9+0 axoneme has nine microtubule doublets and no central pair, characteristic of primary cilia. (Satir & Christensen 2007)",
            "what is the 9+2 structure": "A 9+2 axoneme has nine doublets plus a central pair, found in motile cilia. (Satir & Christensen 2007)",
            // --- SIGNALING ---
            "what is hedgehog signaling":  "Hedgehog signaling requires the primary cilium for Smoothened activation and Gli processing. (Goetz & Anderson 2010)",
            "what are ciliary gpcrs":  "Ciliary G Protein-Coupled Receptors are signaling receptors enriched in the ciliary membrane, including SSTR3, GPR161, and MCHR1. (Mukhopadhyay et al. 2013)",
            // --- MOTILE CILIA COMPONENTS ---
            "what are dynein arms": "Dynein arms are ATP-powered motor complexes that drive motile cilia beating. Their loss causes Primary Ciliary Dyskinesia. (Fliegauf et al. 2007)",
            "what is radial spoke": "The radial spoke is a structural complex linking outer doublets to the central pair, coordinating motility. (Warner 1976)",
            "what is the central pair": "The central pair is the two microtubules in the 9+2 axoneme required for proper waveform regulation. (Satir & Christensen 2007)",
            // --- CILIOGENESIS ---
            "what is ciliogenesis":  "Ciliogenesis is the process of assembling a cilium, starting at the basal body and extending the axoneme. (Ishikawa & Marshall 2011)",
            "what is distal appendage":  "Distal appendages are structures on the mother centriole required for docking to the membrane and initiating ciliogenesis. (Tanos et al. 2013)",
            // --- DISEASES ---
            "what are ciliopathies": "Ciliopathies are disorders caused by defects in cilia. They affect the brain, kidney, liver, eye, and skeleton. (Hildebrandt & Benzing 2011)",
            "help me understand ciliopathies": "Ciliopathies result from structural or functional ciliary defects. Examples include Joubert Syndrome, MKS, BBS, NPHP, and PCD. (Reiter & Leroux 2017)",
            "what is joubert syndrome":  "Joubert Syndrome is a ciliopathy with cerebellar vermis hypoplasia and the ‘molar tooth sign,’ caused by mutations in transition zone and IFT genes. (Romani et al. 2013)",
            "what is meckel-gruber syndrome":  "MKS is a severe ciliopathy with brain malformations, kidney cysts, and polydactyly caused by MKS module gene defects. (Hartill et al. 2017)",
            "what is primary ciliary dyskinesia": "PCD is caused by defects in motile cilia, leading to chronic infections, infertility, and left-right asymmetry defects. (Fliegauf et al. 2007)",
            "what is polycystic kidney disease": "Polycystic Kidney Disease arises from defective ciliary signaling, commonly involving PKD1/PKD2 in the ciliary membrane. (Nauli et al. 2003)"
        };

        if (terminologyQueries[qLower]) {
            log('Routing via: Intent (Terminology)');
            addChatMessage(`<div class="ai-result-card"><p>${terminologyQueries[qLower]}</p></div>`, false);
            return;
        }

        try {
            if (!window.CiliAI.ready) {
                addChatMessage("Data is still loading, please wait...", false);
                return;
            }

            let htmlResult = null;
            let match;

            // --- MODIFIED: Button intents moved to the TOP for priority ---
            if (qLower === 'plot default umap') {
                log('Routing via: Intent (Default UMAP Plot)');
                handleUmapPlot('FOXJ1');
                htmlResult = `<div class="ai-result-card"><p>Displaying Lung scRNA-seq UMAP for <strong>FOXJ1</strong> on the left.</p></div>`;
            }
            else if (qLower === 'plot default phylogeny') {
                log('Routing via: Intent (Default Phylogeny Plot)');
                const defaultGenes = ["ZC2HC1A", "CEP41", "BBS1", "BBS2", "BBS5", "ZNF474", "IFT81", "BBS7"];
                htmlResult = await routePhylogenyAnalysis(`show nevers plot for ${defaultGenes.join(',')}`);
            }
            // --- END OF MOVED BLOCK ---

            // =( 1 )= INTENT: COMPLEX (L2/L3) QUERIES
            else if (htmlResult === null) {
                htmlResult = handleComplexQuery(query);
                if (htmlResult) {
                    log('Routing via: Complex Query Engine (L2/L3)');
                }
            }

            // =( 2 )= INTENT: CONTEXTUAL FOLLOW-UP ("Yes")
            
            // --- THIS IS THE FIX ---
            // Added exclusions for "phylogen", "umap", and "scrna" to prevent misfiring
            const isFollowUp = (
                qLower === 'yes' || qLower === 'ok' || qLower === 'sure' ||
                qLower.includes('view the list') || qLower.includes('show') ||
                qLower.includes('please') || qLower.includes('display') || 
                qLower.includes('yes please') || qLower.includes('provide the paper')
            ) && 
            !qLower.includes('phylogen') && 
            !qLower.includes('umap') && 
            !qLower.includes('scrna');
            // --- END OF FIX ---

            if (htmlResult === null && (qLower === 'yes' || qLower === 'ok') && lastQueryContext.type === null) {
                log('Routing via: Intent (Ignored standalone "yes")');
                return; // Do nothing, just stop processing
            }

            if (htmlResult === null && isFollowUp && lastQueryContext.type === 'list_followup') {
                log('Routing via: Intent (Follow-up: Show List)');
                showDataInLeftPanel(lastQueryContext.term, lastQueryContext.data);
                lastQueryContext = { type: null, data: [], term: null };
                return; // No chat message needed
            }
            
            // =( 3 )= INTENT: CONTEXTUAL FOLLOW-UP (Screen References)
            else if (htmlResult === null && isFollowUp && lastQueryContext.type === 'screen_references') {
                log('Routing via: Intent (Follow-up: Screen References)');
                htmlResult = handleScreenReferenceFollowup();
            }

            // =( 4 )= INTENT: SCREENS / PHENOTYPES (HIGH PRIORITY)
            else if (htmlResult === null && (
                qLower.includes('loss-of-function') || qLower.includes('lof') ||
                qLower.includes('overexpression') || qLower.includes('oe') ||
                qLower.includes('percent ciliated') || qLower.includes('cilia length') ||
                (qLower.includes('effect') && qLower.includes('of'))
            )) {
                log('Routing via: Intent (Screens/Effects)');
                const genes = extractMultipleGenes(query);
                if (genes.length > 0) {
                    htmlResult = handleScreenQuery(genes[genes.length - 1]);
                } else {
                    htmlResult = `I see you're asking about screen effects, but I couldn't identify a gene. Please try again, like "loss-of-function effect of IFT88".`;
                }
            }

            // =( 5 )= INTENT: HIGH-PRIORITY "WHAT IS [GENE]?" (STRICTER REGEX)
            else if (htmlResult === null && (match = qLower.match(/^(?:what is|what's|describe|tell me about)\s+([A-Z0-9\-]{3,})\??$/i))) {
                log('Routing via: Intent (High-Priority Get Details)');
                htmlResult = await displayFullGeneInfo(match[1].toUpperCase());
            }

            // =( 6 )= INTENT: ORTHOLOGS
            else if (htmlResult === null && (match = qLower.match(/ortholog(?: of| for)?\s+([a-z0-9\-]+)\s+(?:in|for)\s+(c\. elegans|mouse|zebrafish|drosophila|xenopus)/i))) {
                log('Routing via: Intent (Ortholog)');
                htmlResult = handleOrthologQuery(match[1].toUpperCase(), match[2]);
            }
            else if (htmlResult === null && (match = qLower.match(/(c\. elegans|mouse|zebrafish|drosophila|xenopus)\s+ortholog(?: of| for)?\s+([a-z0-9\-]+)/i))) {
                log('Routing via: Intent (Ortholog)');
                htmlResult = handleOrthologQuery(match[2].toUpperCase(), match[1]);
            }

            //=( 7 )= INTENT: COMPLEX / MODULE MEMBERS (Split Logic)
            else if (htmlResult === null && (match = qLower.match(/(?:components of|genes in|members of)\s+(.+)/i))) {
                const term = match[1].replace(/^(the|a|an)\s/i, '').trim();
                log('Routing via: Intent (Get Genes in Complex)');
                htmlResult = handleSimpleComplexQuery(term, query); 
            }
            else if (htmlResult === null && (match = qLower.match(/(?:complexes for|complexes of|part of|in complex)\s+(.+)/i))) {
                log('Routing via: Intent (Get Complexes for Gene)');
                const genes = extractMultipleGenes(match[1]);
                if (genes.length > 0) {
                    htmlResult = handleGeneInComplexQuery(genes[0]);
                }
            }

            //=( 8 )= INTENT: DOMAINS
            else if (htmlResult === null && (match = qLower.match(/(?:domains of|domain architecture for)\s+(.+)/i))) {
                log('Routing via: Intent (Domains)');
                const genes = extractMultipleGenes(match[1]);
                if (genes.length > 0) {
                    htmlResult = handleDomainQuery(genes);
                }
            }

            //=( 9 )= INTENT: PHYLOGENY / EVOLUTION
            else if (htmlResult === null && (
                qLower.includes('phylogen') || qLower.includes('evolution') || qLower.includes('conservation') ||
                qLower.includes('heatmap') || qLower.includes('taxa') || qLower.includes('vertebrate specific') ||
                qLower.includes('mammalian specific') || qLower.includes('ciliary specific') ||
                qLower.includes('table')
            )) {
                log('Routing via: Intent (Phylogeny Engine)');
                htmlResult = await routePhylogenyAnalysis(query);
            }

            //=( 10 )= INTENT: FUNCTIONAL MODULES
            else if (htmlResult === null && (match = qLower.match(/(?:functional modules of|modules for)\s+([a-z0-9\-]+)/i))) {
                log('Routing via: Intent (Get Modules)');
                const gene = match[1].toUpperCase();
                const g = window.CiliAI.lookups.geneMap[gene];
                if (g && g['Functional.category']) {
                    htmlResult = formatListResult(`Functional Modules for ${gene}`, ensureArray(g['Functional.category']).map(m => ({ gene: m, description: "Module" })));
                } else {
                    htmlResult = `No functional modules listed for <strong>${gene}</strong>.`;
                }
            }

            //=( 11 )= INTENT: scRNA Expression
            else if (htmlResult === null && (qLower.includes('scrna') || qLower.includes('expression in') || qLower.includes('compare expression') || qLower.includes('expression of'))) {
                log('Routing via: Intent (scRNA)');
                const genes = extractMultipleGenes(query);
                if (genes.length > 0) {
                    htmlResult = handleScRnaQuery(genes); // This is the text summary
                    htmlResult = htmlResult.replace(`</div>`, 
                        `<p style="margin-top: 10px;"><a href="#" class="ai-action" data-action="show-umap-plot" data-genes="${genes[0]}">View ${genes[0]} on UMAP</a></p></div>`);
                } else {
                    htmlResult = `Please specify which gene(s) you want to check expression for.`;
                }
            }
                
           //=( 12 )= INTENT: UMAP (VISUAL)
            else if (htmlResult === null && (match = qLower.match(/(?:show|plot|display)\s+(?:me\s+the\s+)?(?:umap|lung scrna)(?: expression)?(?: for\s+([a-z0-9\-]+)|(?: of| in)\s+([a-z0-9\-]+))?/i))) {
                log('Routing via: Intent (UMAP Plot)');
                let gene = (match[1] || match[2]) ? (match[1] || match[2]).toUpperCase() : null;
                
                if (!gene && (qLower.includes('umap') || qLower.includes('lung scrna'))) {
                    gene = 'FOXJ1';
                    log('Defaulting UMAP plot to FOXJ1');
                }
                handleUmapPlot(gene);
                htmlResult = `<div class="ai-result-card"><p>Displaying Lung scRNA-seq UMAP for <strong>${gene || 'all genes'}</strong> on the left.</p></div>`;
            }

            //=( 13 )= INTENT: SIMPLE KEYWORD LISTS
            if (htmlResult === null) {
                const intent = flexibleIntentParser(query);
                if (intent) {
                    log(`Routing via: Intent (Simple Keyword: ${intent.type})`);
                    htmlResult = intent.handler(intent.entity, query);
                }
            }

            //=( 14 )= INTENT: FALLBACK (GET DETAILS)
            if (htmlResult === null) {
                log(`Routing via: Fallback (Get Details)`);
                let term = qLower;
                if ((match = qLower.match(/(?:what is|what does|describe|localization of|omim id for|where is|cellular location of|subcellular localization of)\s+(?:the\s+)?(.+)/i))) {
                    term = match[1];
                }
                term = term.replace(/[?.]/g, '').replace(/\bdo\b/i, '').trim().toUpperCase();
                
                const genes = extractMultipleGenes(term);
                
                if (genes.length > 0) {
                    htmlResult = await displayFullGeneInfo(genes[0]);
                }
            }

            //=( 15 )= FINAL FALLBACK (ERROR)
            if (htmlResult === null) {
                log(`Routing via: Final Fallback (Error)`);
                const genes = extractMultipleGenes(query);
                if (genes.length > 0) {
                    log(`Final fallback, found gene: ${genes[0]}`);
                    htmlResult = await displayFullGeneInfo(genes[0]);
                } else {
                    htmlResult = `Sorry, I didn't understand the query: "<strong>${query}</strong>". Please try a simpler term.`;
                }
            }

            // Send the final result to chat
            if (htmlResult) {
                addChatMessage(htmlResult, false);
            }

        } catch (e) {
            console.error("Error in handleAIQuery:", e);
            addChatMessage(`An internal CiliAI error occurred: ${e.message}`, false);
        }
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
     * (REPLACEMENT) Handles the "yes" follow-up for screen references.
     * Now displays the full summary and link for each paper.
     */
    function handleScreenReferenceFollowup() {
        const screenKeys = lastQueryContext.data;
        if (!screenKeys || screenKeys.length === 0) {
            return "Sorry, I lost track of which references you wanted. Please ask again.";
        }

        const refMap = getScreenCitationMap(); // <-- Uses the new map
        let html = `<div class="ai-result-card"><h4>Screen References</h4><ul style="list-style-type: none; padding-left: 0;">`;

        // Use Set to ensure unique references
        const uniqueKeys = [...new Set(screenKeys)];

        uniqueKeys.forEach(key => {
            const ref = refMap[key];
            if (ref) {
                // (NEW) Build the rich HTML block
                html += `<li style="margin-bottom: 15px;">
                    <strong>${ref.name}</strong> (${ref.citation})
                    <p style="margin-top: 5px; margin-bottom: 5px;">${ref.summary}</p>
                    ${ref.link ? `<a href="${ref.link}" target="_blank" class="ai-action">View Publication</a>` : ''}
                </li>`;
            } else {
                html += `<li style="margin-bottom: 10px;"><strong>${key}</strong>: No reference details found.</li>`;
            }
        });

        html += `</ul></div>`;
        
        // Clear the context
        lastQueryContext = { type: null, data: [], term: null, descriptionHeader: 'Description' };
        return html;
    }

    
// ==========================================================
// 5. GLOBAL UI WRAPPERS & STARTUP
// ==========================================================

window.selectComp = function (id) {
    generateAndInjectSVG(); 
    
    document.querySelectorAll('.cilia-part')
        .forEach(el => el.classList.remove('selected', 'active'));

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

    addChatMessage(`Tell me about ${query}`, true); 
    handleGeneSearch(query, true);
};

// ----------------------------------------------------------
// Buttons: Default UMAP & Default Phylogeny
// ----------------------------------------------------------

window.showDefaultUMAP = function () {
    addChatMessage('Display gene expression in Lung scRNA-seq (Default: FOXJ1)', true);
    handleAIQuery('plot default umap');
};

window.showDefaultPhylogeny = function () {
    addChatMessage('Show Phylogenetics Analysis (Default Genes)', true);
    handleAIQuery('plot default phylogeny');
};

// ----------------------------------------------------------
// Chat + Feedback Controls
// ----------------------------------------------------------

window.sendMsg = function () {
    handleUserSend();
};

window.react = function (type) {
    if (type === 'up') {
        addChatMessage('Thanks for the feedback! 🙏', false);
    } else {
        addChatMessage('Sorry about that. What specifically would help?', false);
    }
};

// ----------------------------------------------------------
// Clear Chat
// ----------------------------------------------------------

window.clearChat = function () {
    if (confirm('Start new conversation?')) {
        document.getElementById('messages').innerHTML = '';
        
        generateAndInjectSVG(); 
        document.querySelectorAll('.cilia-part')
            .forEach(el => el.classList.remove('selected', 'active'));

        addChatMessage('Welcome back! How can I help?', false);
    }
};

// ----------------------------------------------------------
// Plot Downloader
// ----------------------------------------------------------

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

// ----------------------------------------------------------
// STARTUP: Initialize CiliAI when DOM ready
// ----------------------------------------------------------

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCiliAI);
} else {
    initCiliAI();
}

// ===========================================================
// UI HOOK — Called from UI layer once browser loads ciliai_ui.js
// ===========================================================

window.CiliAI_UI_OnReady = window.CiliAI_UI_OnReady || function () {
    console.warn("CiliAI_UI_OnReady called but ciliai_ui.js is not loaded yet.");
};

// Auto-run only if this script is loaded by /ciliai index
if (document.body && document.body.dataset?.ciliai === "enabled") {
    // Defer start so UI loads first
    setTimeout(() => {
        if (typeof initCiliAI === "function") {
            initCiliAI();
        }
    }, 10);
}

})();
