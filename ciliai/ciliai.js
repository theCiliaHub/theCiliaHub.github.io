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

    let lastQueryContext = { type: null, data: [], term: null, descriptionHeader: 'Description' };

    // Phylogeny data is lazy-loaded, so it starts as null
    window.liPhylogenyCache = null;
    window.neversPhylogenyCache = null;
    window.CiliAI_UMAP = null; // This will be populated from the master DB

    // --- Data Maps (These are now just for the AI brain) ---

    function getComplexPhylogenyTableMap() {
        // This is a static helper, it doesn't need to be in the database
        return {
            "IFT COMPLEX": ["WDR19","IFT140","TTC21B","IFT122","WDR35","IFT43","IFT172","IFT80","IFT57","TRAF3IP1","CLUAP1","IFT20","IFT88","IFT81","IFT74","IFT70A","IFT70B","IFT56","IFT52","IFT46","IFT27","IFT25","IFT22"],
            "IFT-A COMPLEX": ["WDR19","IFT140","TTC21B","IFT122","WDR35","IFT43"],
            "IFT-B COMPLEX": ["IFT172","IFT80","IFT57","TRAF3IP1","CLUAP1","IFT20","IFT88","IFT81","IFT74","IFT70A","IFT70B","IFT56","IFT52","IFT46","IFT27","IFT25","IFT22"],
            "BBSOME": ["BBS1","BBS2","BBS4","BBS5","BBS7","TTC8","BBS9","BBIP1"],
            "TRANSITION ZONE": ["NPHP1","MKS1","CEP290","AHI1","RPGRIP1L","TMEM67","CC2D2A","B9D1","B9D2"],
            "MKS MODULE": ["MKS1","TMEM17","TMEM67","TMEM138","B9D2","B9D1","CC2D2A","TMEM107","TMEM237","TMEM231","TMEM216","TCTN1","TCTN2","TCTN3"],
            "NPHP MODULE": ["NPHP1","NPHP3","NPHP4","RPGRIP1L","IQCB1","CEP290","SDCCAG8"],
            "BASAL BODY": ["CEP164","CEP83","SCLT1","CEP89","LRRC45","ODF2","CEP128","CEP135","CETN2","CETN3","POC1B","FBF1","CCDC41","CCDC120","OFD1"],
            "CILIARY TIP": ["HYDIN","IQCA1","CATSPER2","KIF19A","KIF7","CCDC78","CCDC33","SPEF1","CEP104","CSPP1"],
            "RADIAL SPOKE": ["RSPH1","RSPH3","RSPH4A","RSPH6A","RSPH9","RSPH10B","RSPH23","RSPH16"],
            "CENTRAL PAIR": ["HYDIN","SPAG6","SPAG16","SPAG17","POC1A","CEP131"],
            "DYNEIN ARM": ["DNAH1","DNAH2","DNAH5","DNAH6","DNAH7","DNAH8","DNAH9","DNAH10","DNAH11","DNALI1","DNAI1","DNAI2"],
            "OUTER DYNEIN ARM": ["DNAH5","DNAH11","DNAH17","DNAI1","DNAI2"],
            "INNER DYNEIN ARM": ["DNAH2","DNAH7","DNAH10","DNALI1"],
            "SHH SIGNALING": ["SMO","PTCH1","GLI1","GLI2","GLI3","SUFU","KIF7","TULP3"],
            "CENTROSOME": ["CEP152","CEP192","PLK4","STIL","SAS6","CEP135","CETN2","PCNT"],
            "CILIARY ROOTLET": ["ROOTLET1", "CROCC"],
            "CPLANE COMPLEX": ["INTU", "FUZ", "WDPCP"],
            "SEPTIN RING": ["SEPTIN2", "SEPTIN7", "SEPTIN9", "SEPTIN11"],
            "DYNEIN ASSEMBLY FACTORS": ["DNAAF1", "DNAAF2", "DNAAF3", "DNAAF4", "DNAAF5", "DNAAF6", "DNAAF7", "DNAAF8", "DNAAF9", "DNAAF10", "DNAAF11", "LRRC6", "ZMYND10", "PIH1D3", "HEATR2"],
            "CILIOGENESIS REGULATORS": ["FOXJ1", "RFX1", "RFX2", "RFX3", "RFX4", "RFX5"],
            "PCP CORE": ["VANGL1", "VANGL2", "DVL1", "DVL2", "DVL3", "PRICKLE1", "CELSR1", "FZD3", "FZD6"]
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
    // 2. DATA LOADING & PROCESSING
    // ==========================================================

    async function initCiliAI() {
        console.log('CiliAI: Initializing (v5.1 Pre-compiled)...');
        await loadCiliAIData(); 
        
        if (!window.CiliAI.masterData || window.CiliAI.masterData.length === 0) {
            console.error("CiliAI: Master data is empty. Database load failed.");
            window.CiliAI.ready = false;
            return;
        }
        
        // NO buildLookups() needed!
        window.CiliAI.ready = true;
        console.log('CiliAI: Ready! Pre-compiled database loaded.');

        if (window.location.hash.includes('/ciliai')) {
            setTimeout(displayCiliAIPage, 100);
        }
    }

    /**
     * Fetches the pre-compiled database files from GitHub.
     */
    async function loadCiliAIData(timeoutMs = 60000) {
        const baseUrl = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/';
        const mainDbUrl = baseUrl + 'ciliAI_master_database.json';
        const lookupsUrl = baseUrl + 'ciliAI_lookups.json';

        try {
            console.log(`Fetching main database: ${mainDbUrl}`);
            console.log(`Fetching lookups: ${lookupsUrl}`);
            
            const [mainRes, lookupsRes] = await Promise.all([
                fetch(mainDbUrl),
                fetch(lookupsUrl)
            ]);

            if (!mainRes.ok) throw new Error(`HTTP ${mainRes.status} for main database`);
            if (!lookupsRes.ok) throw new Error(`HTTP ${lookupsRes.status} for lookups`);
            
            const mainData = await mainRes.json();
            const lookupData = await lookupsRes.json();
            
            // Assign all the pre-processed data
            window.CiliAI.masterData = mainData.masterData;
            window.CiliAI.lookups = lookupData.lookups;
            
            // Assign the raw UMAP data
            window.CiliAI_UMAP = mainData.umapData;
            window.CiliAI.data.umap = mainData.umapData; 
            
            // Create a GeneMap from the masterData list for fast lookups by gene name
            window.CiliAI.lookups.geneMap = {};
            for (const gene of mainData.masterData) {
                if (gene.Gene) {
                    window.CiliAI.lookups.geneMap[gene.Gene.toUpperCase()] = gene;
                }
            }

            console.log(`CiliAI: ${window.CiliAI.masterData.length} genes integrated.`);
            console.log('CiliAI: Lookups successfully loaded.');

        } catch (err) {
            console.error("Failed to load CiliAI master database:", err);
            window.CiliAI.ready = false;
        }
    }
    
    /**
     * Normalizes a term for keyword matching.
     */
    function normalizeTerm(term) {
        if (typeof term !== 'string') return '';
        return term.toLowerCase().replace(/[\W_]/g, '').replace(/s$/, '');
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

    window.displayCiliAIPage = async function () {
        console.log("CiliAI: displayCiliAIPage() called.");
        const area = document.querySelector('.content-area');
        if (!area) {
            console.error('CiliAI: .content-area not found.');
            return;
        }

        area.className = 'content-area content-area-full';
        const panel = document.querySelector('.cilia-panel');
        if (panel) panel.style.display = 'none';

        injectPageCSS();
        area.innerHTML = getPageHTML();
        generateAndInjectSVG();
        setupPageEventListeners();

        const status = document.getElementById('dataStatus');
        if (window.CiliAI.ready) {
            status.textContent = `Ready (${window.CiliAI.masterData.length} genes)`;
            status.className = 'status ready';
            addChatMessage(`Database loaded! ${window.CiliAI.masterData.length} genes available. Try searching for IFT88 or click on the cilium.`, false);
        } else {
            status.textContent = 'Load failed';
            status.className = 'status error';
            addChatMessage('Failed to load database. Some features may be limited.', false);
        }

        console.log("CiliAI: Page displayed.");
    };

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
            .header { padding: 20px 30px; background: white; color: #2c3e50; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-bottom: 1px solid #e1e8ed; }
            .header h1 { font-size: 28px; font-weight: 600; margin-bottom: 5px; color: #2c3e50; }
            .header p { font-size: 14px; color: #666; }
            .toolbar { padding: 15px 30px; background: white; border-bottom: 1px solid #e1e8ed; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
            .toolbar input { flex: 1; min-width: 200px; padding: 10px 15px; border: 1px solid #d1d9e0; border-radius: 6px; font-size: 14px; }
            .toolbar button { padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; transition: all 0.2s; font-size: 14px; }
            .toolbar button:hover { background: #5568d3; }
            .status { font-size: 12px; padding: 5px 10px; border-radius: 4px; font-weight: 500; }
            .status.loading { background: #fff3cd; color: #856404; }
            .status.ready { background: #d4edda; color: #155724; }
            .status.error { background: #f8d7da; color: #721c24; }
            .diagram-container { flex: 1; padding: 20px; overflow: auto; display: flex; justify-content: center; align-items: center; background: white; }
            .interactive-cilium { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); max-width: 600px; width: 100%; border: 1px solid #e1e8ed; }
            .cilia-part { cursor: pointer; transition: all 0.2s ease; }
            .cilia-part:hover { opacity: 0.8; }
            .cilia-part:focus { outline: 2px solid #667eea; outline-offset: 2px; }
            .cilia-part.selected, .cilia-part.active { filter: brightness(1.2); stroke: #ff6b00 !important; stroke-width: 4 !important; }
            .bottom-bar { padding: 20px 30px; background: white; border-top: 1px solid #e1e8ed; min-height: 150px; max-height: 250px; overflow-y: auto; }
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
                    <button onclick="showUMAP()">Show UMAP</button>
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

    function generateAndInjectSVG() {
        const svgContainer = document.getElementById('cilia-svg');
        if (!svgContainer) return;
        const wrapper = svgContainer.closest('.interactive-cilium');
        if (wrapper) wrapper.classList.remove('table-view-active');
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
            const aiAction = e.target.closest('.ai-action');
            if (aiAction) {
                e.preventDefault();
                const action = aiAction.dataset.action;
                const genes = aiAction.dataset.genes || "";
                let query = "";
                if (action === 'show-li-heatmap') query = `show li phylogeny for ${genes}`;
                else if (action === 'show-nevers-heatmap') query = `show nevers phylogeny for ${genes}`;
                else if (action === 'show-table-view') query = `show data table for ${genes}`;
                if (query) {
                    addChatMessage(query, true);
                    handleAIQuery(query);
                }
                return;
            }
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
     * (FIXED) Extracts all valid gene symbols from a query string, ignoring common words.
     */
    function extractMultipleGenes(query) {
        if (!query) return [];
        const geneRegex = /\b([A-Z0-9\-\.]{3,})\b/gi;
        let matches = query.match(geneRegex) || [];
        // Filter out common English words that look like gene names
        const stopWords = new Set(["THE", "AND", "FOR", "NOT", "ARE", "WHAT", "SHOW", "LIST", "GENE", "GENES", "PLOT", "COMPARE", "WHAT'S", "DESCRIBE", "OF", "IN"]);
        matches = matches.filter(m => !stopWords.has(m.toUpperCase()));
        
        const upperMatches = matches.map(g => g.toUpperCase());
        const geneMap = window.CiliAI.lookups.geneMap;
        if (!geneMap) return [];
        
        // Return only the words that are actual genes in our map
        return upperMatches.filter(g => geneMap[g]);
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
    
    function showDataInLeftPanel(title, geneList, descriptionHeader = 'Description') {
        const container = document.getElementById('cilia-svg'); 
        if (!container) {
            console.error("Cannot find 'cilia-svg' container to draw table in.");
            return;
        }
        const wrapper = container.closest('.interactive-cilium');
        if (wrapper) wrapper.classList.add('table-view-active');

        let tableHTML = `
            <table class="ciliai-data-table">
                <thead>
                    <tr>
                        <th>Gene</th>
                        <th>${descriptionHeader}</th>
                    </tr>
                </thead>
                <tbody>
        `;
        geneList.forEach(item => {
            tableHTML += `
                <tr>
                    <td><strong>${item.gene}</strong></td>
                    <td>${item.description}</td>
                </tr>
            `;
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

        document.getElementById('ciliai-download-btn').addEventListener('click', () => {
            downloadTableAsCSV(title, geneList, descriptionHeader);
        });
        document.getElementById('ciliai-back-btn').addEventListener('click', () => {
            generateAndInjectSVG();
        });
    }

    function downloadTableAsCSV(title, geneList, descriptionHeader = 'Description') {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += `Gene,${descriptionHeader}\r\n`;
        geneList.forEach(item => {
            const gene = item.gene;
            const desc = `"${String(item.description).replace(/"/g, '""')}"`;
            csvContent += `${gene},${desc}\r\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${title.replace(/\s+/g, '_')}_genelist.csv`);
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

    function handleScreenQuery(geneSymbol) {
        const gene = geneSymbol.toUpperCase();
        const g = window.CiliAI.lookups.geneMap[gene];
        if (!g) return `Sorry, I could not find data for "${gene}".`;
        let html = `<h4>Screen Results for <strong>${gene}</strong></h4>`;
        
        // Use the exact column names from your CSV
        const percEffect = g['Percentage of ciliated cells (increase/decrease/no effect)'];
        const lofEffect = g['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'];
        const oeEffect = g['Overexpression effects on cilia length (increase/decrease/no effect)'];

        if (percEffect && percEffect !== "Not Reported") {
            html += `<p><strong>Percent Ciliated Cells Effect:</strong> ${percEffect}</p>`;
        }
        if (lofEffect && lofEffect !== "Not Reported") {
            html += `<p><strong>Loss-of-Function Effect:</strong> ${lofEffect}</p>`;
        }
        if (oeEffect && oeEffect !== "Not Reported") {
            html += `<p><strong>Overexpression Effect:</strong> ${oeEffect}</p>`;
        }

        if (g.screens && g.screens.length > 0) {
            html += '<strong>All Screen Data:</strong><ul>';
            g.screens.forEach(s => {
                html += `<li>[${s.dataset || 'Unknown'}] <strong>${s.classification}</strong> (Z-score: ${s.z_score || 'N/A'})</li>`;
            });
            html += '</ul>';
        } else if (percEffect === "Not Reported" && lofEffect === "Not Reported" && oeEffect === "Not Reported") {
            html += '<p>No specific screen data found in the database.</p>';
        }
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
        lastQueryContext = {
            type: 'list_followup',
            data: geneList, 
            term: `Genes localized to ${term}`,
            descriptionHeader: 'Localization'
        };
        return `According to the latest data, ${count} genes are enriched in the ${term}. Do you want to view the list?`;
    }

    function handleComplexQuery(term, query) {
        // This function now *only* handles "List genes in [COMPLEX]"
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
            const geneListObjects = geneList.map(gene => ({
                gene: gene,
                description: geneMap[gene]?.ciliopathy_classification || 'No classification listed'
            })).sort((a, b) => a.gene.localeCompare(b.gene)); 

            lastQueryContext = {
                type: 'list_followup',
                data: geneListObjects,
                term: `Genes for ${casedClassificationName}`,
                descriptionHeader: 'Classification(s)'
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
    
    // --- 4E. Plotting Handlers (UMAP & Phylogeny) ---
    
    async function handleUmapPlot(highlightGene = null) {
        const plotDivId = 'cilia-svg';
        const umapData = window.CiliAI_UMAP;
        const umapLookup = window.CiliAI.lookups.umapByGene; 

        if (!umapData || umapData.length === 0) {
            generateAndInjectSVG();
            addChatMessage('UMAP data is not available to plot.', false);
            return;
        }
        
        generateAndInjectSVG();
        const plotDiv = document.getElementById(plotId);
        if (!plotDiv) return;

        // Add class to wrapper
        const wrapper = plotDiv.closest('.interactive-cilium');
        if (wrapper) wrapper.classList.add('table-view-active');

        const backgroundTrace = {
            x: [], y: [], text: [],
            mode: 'markers', type: 'scatter', name: 'All Genes',
            marker: { color: '#d3d3d3', size: 5, opacity: 0.5 },
            hoverinfo: 'text'
        };
        const highlightTrace = {
            x: [], y: [], text: [],
            mode: 'markers', type: 'scatter', name: highlightGene || 'Highlighted',
            marker: { color: '#2c5aa0', size: 10, opacity: 1, line: { color: 'black', width: 1 } },
            hoverinfo: 'text'
        };

        let title = 'UMAP of Ciliary Genes';
        const geneUpper = highlightGene ? highlightGene.toUpperCase() : null;
        const highlightedPoint = geneUpper ? umapLookup[geneUpper] : null; 

        umapData.forEach(d => {
            if (highlightedPoint && d.gene === highlightedPoint.gene) {
                // Skip
            } else {
                backgroundTrace.x.push(d.x);
                backgroundTrace.y.push(d.y);
                backgroundTrace.text.push(`<b>${d.gene}</b><br>${d.cluster}`);
            }
        });

        const plotData = [backgroundTrace];

        if (highlightedPoint) {
            highlightTrace.x.push(highlightedPoint.x);
            highlightTrace.y.push(highlightedPoint.y);
            highlightTrace.text.push(`<b>${highlightedPoint.gene}</b><br>${highlightedPoint.cluster}`);
            plotData.push(highlightTrace);
            title = `UMAP: ${highlightedPoint.gene}`;
        } else if (highlightGene) {
            addChatMessage(`Sorry, I could not find <strong>${highlightGene}</strong> in the UMAP data. Displaying all genes.`, false);
        }

        const layout = {
            title: title,
            xaxis: { title: 'UMAP 1', zeroline: false, showticklabels: false },
            yaxis: { title: 'UMAP 2', zeroline: false, showticklabels: false },
            showlegend: false,
            hovermode: 'closest',
            margin: { t: 40, b: 40, l: 40, r: 20 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        };

        Plotly.newPlot(plotDivId, plotData, layout, { responsive: true });
        
        // Add a "Back" button to the plot
        const backButton = document.createElement('button');
        backButton.id = 'ciliai-back-btn';
        backButton.className = 'ciliai-button';
        backButton.style.background = '#718096';
        backButton.style.position = 'absolute';
        backButton.style.top = '10px';
        backButton.style.right = '10px';
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
            const source = qLower.includes('nevers') ? 'nevers' : 'li';
            const finalGenes = genes.length >= 1 ? genes : ["IFT88", "BBS1", "CEP290"]; 

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
        generateAndInjectSVG(); 
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
            
            const backButton = document.createElement('button');
            backButton.id = 'ciliai-back-btn';
            backButton.className = 'ciliai-button';
            backButton.style.background = '#718096';
            backButton.style.position = 'absolute';
            backButton.style.top = '10px';
            backButton.style.right = '10px';
            backButton.textContent = 'Back to Diagram';
            backButton.onclick = () => generateAndInjectSVG();
            plotDiv.prepend(backButton); 

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
            title: `Phylogenetic Conservation (Nevers et al. 2017) - ${genes.join(', ')}`,
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

    /**
     * NEW INTEGRATED FUNCTION
     * Replaces getComprehensiveDetails with the detailed HTML formatter
     * provided by the user.
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
        html += `<p><strong>OMIM ID:</strong> ${g.OMIM.ID || '—'}</p>`;
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

    function getCiliopathyGenes(term) {
        let key = normalizeTerm(term);
        if (key === normalizeTerm('BBS')) key = normalizeTerm('Bardet–Biedl Syndrome');
        if (key === normalizeTerm('MKS')) key = normalizeTerm('Meckel–Gruber Syndrome');
        if (key === normalizeTerm('Joubert')) key = normalizeTerm('Joubert Syndrome');
        if (key === normalizeTerm('NPHP')) key = normalizeTerm('Nephronophthisis');
        if (key === normalizeTerm('Bardet Biedel Syndrome')) {
            key = normalizeTerm('Bardet–Biedl Syndrome');
        }

        const geneSymbols = window.CiliAI.lookups.byCiliopathy[key] || [];
        const geneMap = window.CiliAI.lookups.geneMap;
        
        const classification = window.CiliAI.lookups.byCiliopathyClassification[key];
        let desc = "";
        if (classification) {
            desc = `This disease is classified as a: <strong>${classification}</strong>.`;
        }

        return {
            genes: geneSymbols.map(g => {
                const geneData = geneMap[g];
                return {
                    gene: g,
                    description: geneData?.['Gene.Description'] || 'No description available.'
                };
            }),
            description: desc
        };
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
            return {
                gene: gene,
                description: geneData?.Localization || `Found in ${term}`
            };
        });
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
    
    function getGenesByDomain(domainTerm, query) {
        const normTerm = normalizeTerm(domainTerm);
        const results = [];
        window.CiliAI.masterData.forEach(g => {
            if (!g.Gene) return;
            const allDomains = [...ensureArray(g.pfam_ids), ...ensureArray(g.domain_descriptions)];
            
            const matchingDomain = allDomains.find(d => d && normalizeTerm(d).includes(normTerm));
            if (matchingDomain) {
                results.push({ gene: g.Gene, description: `Contains ${matchingDomain}` });
            }
        });
        
        if (results.length === 0) {
            return `Sorry, I could not find any genes with a "${domainTerm}" domain.`;
        }

        lastQueryContext = {
            type: 'list_followup',
            data: results,
            term: `Genes containing "${domainTerm}"`,
            descriptionHeader: 'Domain'
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

    // REPLACE your current handleAIQuery (lines 1167-1349) with this:

    async function handleAIQuery(query) {
        const chatWindow = document.getElementById('messages');
        if (!chatWindow) return;
        const qLower = query.toLowerCase().trim();
        if (!query) return;

        log(`Routing query: ${query}`);

        try {
            if (!window.CiliAI.ready) {
                addChatMessage("Data is still loading, please wait...", false);
                return;
            }

            let htmlResult = null; 
            let match;

            // =( 1 )= INTENT: CONTEXTUAL FOLLOW-UP ("Yes")
            const isFollowUp = qLower === 'yes' || qLower === 'ok' || qLower === 'sure' || 
                                 qLower.includes('view the list') || qLower.includes('show') || 
                                 qLower.includes('please') || qLower.includes('display');
            
            if (htmlResult === null && isFollowUp && lastQueryContext.type === 'list_followup') {
                log('Routing via: Intent (Follow-up: Show List)');
                showDataInLeftPanel(lastQueryContext.term, lastQueryContext.data, lastQueryContext.descriptionHeader);
                lastQueryContext = { type: null, data: [], term: null, descriptionHeader: 'Description' };
                htmlResult = ""; // No chat message needed, panel updates
            }

            // =( 2 )= INTENT: HIGH-PRIORITY "WHAT IS [GENE]?"
            else if (htmlResult === null && (match = qLower.match(/^(?:what is|what's|describe|tell me about)\s+([A-Z0-9\-]{3,})\b/i))) {
                log('Routing via: Intent (High-Priority Get Details)');
                htmlResult = await displayFullGeneInfo(match[1].toUpperCase());
            }

            // =( 3 )= INTENT: SCREENS / PHENOTYPES (FIXED & HIGH PRIORITY)
            // This now correctly handles "loss-of-function effect of KIF3A"
            else if (htmlResult === null && (
                qLower.includes('loss-of-function') || qLower.includes('lof') || 
                qLower.includes('overexpression') || qLower.includes('oe') || 
                qLower.includes('percent ciliated') || qLower.includes('cilia length') || 
                (qLower.includes('effect') && qLower.includes('of')) 
            )) {
                log('Routing via: Intent (Screens/Effects)');
                const genes = extractMultipleGenes(query); // Use the good extractor
                if (genes.length > 0) {
                    // Use the last gene found in the query
                    htmlResult = handleScreenQuery(genes[genes.length - 1]); 
                } else {
                    htmlResult = `I see you're asking about screen effects, but I couldn't identify a gene. Please try again, like "loss-of-function effect of IFT88".`;
                }
            }

            // =( 4 )= INTENT: ORTHOLOGS
            else if (htmlResult === null && (match = qLower.match(/ortholog(?: of| for)?\s+([a-z0-9\-]+)\s+(?:in|for)\s+(c\. elegans|mouse|zebrafish|drosophila|xenopus)/i))) {
                log('Routing via: Intent (Ortholog)');
                htmlResult = handleOrthologQuery(match[1].toUpperCase(), match[2]);
            }
            else if (htmlResult === null && (match = qLower.match(/(c\. elegans|mouse|zebrafish|drosophila|xenopus)\s+ortholog(?: of| for)?\s+([a-z0-9\-]+)/i))) {
                log('Routing via: Intent (Ortholog)');
                htmlResult = handleOrthologQuery(match[2].toUpperCase(), match[1]);
            }

            //=( 5 )= INTENT: COMPLEX / MODULE MEMBERS (Split Logic)
            else if (htmlResult === null && (match = qLower.match(/(?:components of|genes in|members of)\s+(.+)/i))) {
                const term = match[1].replace(/^(the|a|an)\s/i, '').trim();
                log('Routing via: Intent (Get Genes in Complex)');
                htmlResult = handleComplexQuery(term, query); 
            }
            else if (htmlResult === null && (match = qLower.match(/(?:complexes for|complexes of|part of|in complex)\s+(.+)/i))) {
                log('Routing via: Intent (Get Complexes for Gene)');
                const genes = extractMultipleGenes(match[1]);
                if (genes.length > 0) {
                    htmlResult = handleGeneInComplexQuery(genes[0]);
                }
            }

            //=( 6 )= INTENT: DOMAINS
            else if (htmlResult === null && (match = qLower.match(/(?:domains of|domain architecture for)\s+(.+)/i))) {
                log('Routing via: Intent (Domains)');
                const genes = extractMultipleGenes(match[1]);
                if (genes.length > 0) {
                    htmlResult = handleDomainQuery(genes);
                }
            }

            //=( 7 )= INTENT: PHYLOGENY / EVOLUTION
            else if (htmlResult === null && (
                qLower.includes('phylogen') || qLower.includes('evolution') || qLower.includes('conservation') ||
                qLower.includes('heatmap') || qLower.includes('taxa') || qLower.includes('vertebrate specific') ||
                qLower.includes('mammalian specific') || qLower.includes('ciliary specific') ||
                qLower.includes('table')
            )) {
                log('Routing via: Intent (Phylogeny Engine)');
                htmlResult = await routePhylogenyAnalysis(query); // Now Awaited
            }

            //=( 8 )= INTENT: FUNCTIONAL MODULES
            else if (htmlResult === null && (match = qLower.match(/(?:functional modules of|modules for)\s+([a-z0-9\-]+)/i))) {
                log('Routing via: Intent (Get Modules)');
                const gene = match[1].toUpperCase();
                const g = window.CiliAI.lookups.geneMap[gene];
                if (g && g['Functional.category']) { // Use CSV column name
                    htmlResult = formatListResult(`Functional Modules for ${gene}`, ensureArray(g['Functional.category']).map(m => ({ gene: m, description: "Module" })));
                } else {
                    htmlResult = `No functional modules listed for <strong>${gene}</strong>.`;
                }
            }

            //=( 9 )= INTENT: scRNA Expression
            else if (htmlResult === null && (qLower.includes('scrna') || qLower.includes('expression in') || qLower.includes('compare expression'))) {
                log('Routing via: Intent (scRNA)');
                const genes = extractMultipleGenes(query);
                if (genes.length > 0) {
                    htmlResult = handleScRnaQuery(genes);
                } else {
                    htmlResult = `Please specify which gene(s) you want to check expression for.`;
                }
            }

            //=( 10 )= INTENT: UMAP (VISUAL)
            else if (htmlResult === null && (match = qLower.match(/(?:show|plot)\s+(?:me\s+the\s+)?umap(?: expression)?(?: for\s+([a-z0-9\-]+))?/i))) {
                log('Routing via: Intent (UMAP Plot)');
                const gene = match[1] ? match[1].toUpperCase() : null;
                handleUmapPlot(gene);
                htmlResult = ""; 
            }

            //=( 11 )= INTENT: SIMPLE KEYWORD LISTS
            if (htmlResult === null) { 
                const intent = flexibleIntentParser(query); 
                if (intent) {
                    log(`Routing via: Intent (Simple Keyword: ${intent.type})`);
                    htmlResult = intent.handler(intent.entity, query); 
                }
            }

            //=( 12 )= INTENT: FALLBACK (GET DETAILS)
            if (htmlResult === null) { 
                log(`Routing via: Fallback (Get Details)`);
                let term = qLower;
                if ((match = qLower.match(/(?:what is|what does|describe|localization of|omim id for|where is|cellular location of|subcellular localization of)\s+(?:the\s+)?(.+)/i))) {
                    term = match[1];
                }
                term = term.replace(/[?.]/g, '').replace(/\bdo\b/i, '').trim().toUpperCase();
                
                const genes = extractMultipleGenes(term); // Use the good extractor
                
                if (genes.length > 0) {
                    htmlResult = await displayFullGeneInfo(genes[0]);
                }
            }
            //=( 13 )= FINAL FALLBACK (ERROR)
            if (htmlResult === null) { 
                log(`Routing via: Final Fallback (Error)`);
                // Try to find *any* gene, even if it's a fallback
                const genes = extractMultipleGenes(query);
                if (genes.length > 0) {
                     log(`Final fallback, found gene: ${genes[0]}`);
                     htmlResult = await displayFullGeneInfo(genes[0]);
                } else {
                     htmlResult = `Sorry, I didn't understand the query: "<strong>${query}</strong>". Please try a simpler term.`;
                }
            }
            if (htmlResult) { 
                addChatMessage(htmlResult, false);
            }

        } catch (e) {
            console.error("Error in handleAIQuery:", e);
            addChatMessage(`An internal CiliAI error occurred: ${e.message}`, false);
        }
    }
    
    // ==========================================================
    // 5. GLOBAL UI WRAPPERS & STARTUP
    // ==========================================================

    window.selectComp = function (id) {
        generateAndInjectSVG(); 
        
        document.querySelectorAll('.cilia-part').forEach(el => el.classList.remove('selected', 'active'));
        const el = document.getElementById(id);
        if (el) el.classList.add('selected');

        const data = structureInfoMap[id];
        if (!data) return;

        const genes = getGenesByLocalization(data.title);

        const bar = document.getElementById('bottomBar');
        if (genes.length > 0) {
            bar.innerHTML = `<h3>${data.title} (${genes.length} genes)</h3>
            <div class="gene-list">${genes.slice(0, 40).map(g =>
                `<span class="gene-badge" data-gene="${g.gene}">${g.gene}</span>`
            ).join('')}${genes.length > 40 ? `<span style="font-size:11px;color:#666;padding:5px;">...+${genes.length - 40} more</span>` : ''}</div>`;
        } else {
            bar.innerHTML = `<h3>${data.title}</h3><p style="color:#666;font-size:12px;">No genes found in database. Try searching directly.</p>`;
        }
    }

    window.searchGene = function (name) {
        const query = name || document.getElementById('geneSearch').value.trim().toUpperCase();
        if (!query) return;
        addChatMessage(`Tell me about ${query}`, true); 
        handleGeneSearch(query, true);
    }

    window.showUMAP = function () {
        addChatMessage('Show UMAP', true);
        handleAIQuery('Plot UMAP');
    }

    window.sendMsg = function () {
        handleUserSend();
    }

    window.react = function (type) {
        if (type === 'up') {
            addChatMessage('Thanks for the feedback! 🙏', false);
        } else {
            addChatMessage('Sorry about that. What specifically would help?', false);
        }
    }

    window.clearChat = function () {
        if (confirm('Start new conversation?')) {
            document.getElementById('messages').innerHTML = '';
            generateAndInjectSVG(); 
            document.querySelectorAll('.cilia-part').forEach(el => el.classList.remove('selected', 'active'));
            addChatMessage('Welcome back! How can I help?', false);
        }
    }

    window.downloadPlot = function (divId, filename) {
        const plotDiv = document.getElementById(divId);
        if (plotDiv && window.Plotly) {
            Plotly.downloadImage(plotDiv, { format: 'png', filename: filename, width: 1200, height: 800 });
        }
    }

    // --- STARTUP ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCiliAI);
    } else {
        initCiliAI();
    }

})();
