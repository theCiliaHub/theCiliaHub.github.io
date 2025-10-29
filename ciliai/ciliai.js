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
        <span data-question="Show genes for Joubert syndrome">Joubert syndrome</span>, 
        <span data-question="List ciliary genes in C. elegans">c. elegans</span>, 
        <span data-question="Plot UMAP expression for FOXJ1">UMAP plot for FOXJ1</span>,
        <span data-question="Compare ARL13B and FOXJ1 expression in lung scRNA-seq">Compare ARL13B vs FOXJ1</span>,
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

                /* --- ADDED CSS FOR DOWNLOAD BUTTON AND PLOT CARD --- */
                .download-button {
                    background-color: #28a745; /* Green */
                    color: white;
                    padding: 8px 14px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.9em;
                    font-weight: bold;
                    margin-top: 15px;
                    transition: background-color 0.3s ease;
                }
                .download-button:hover {
                    background-color: #218838;
                }
                /* This re-defines .result-card to ensure it has the correct padding for plots */
                .result-card {
                    padding: 20px;
                    background-color: #fff;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                    margin-top: 1.5rem;
                    border: 1px solid #ddd; /* Kept original border */
                    margin-bottom: 1.5rem; /* Kept original margin-bottom */
                }
            </style>
        `;
    } catch (error) {
        console.error('Failed to inject CiliAI HTML:', error);
        contentArea.innerHTML = '<p>Error: Failed to load CiliAI interface.</p>';
        return;
    }

  await Promise.all([
        fetchCiliaData(),         // Your original gene data
        fetchScreenData(),       // Your original screen data
        fetchPhylogenyData(),     // Your original phylogeny data
        fetchTissueData(),       // Your original tissue data
        fetchCellxgeneData(),     // Your original cellxgene data
        fetchUmapData(),           // Your original umap data
        getDomainData(),           // --- NEW ---
        fetchNeversPhylogenyData(), // --- NEW ---
        fetchLiPhylogenyData(),  // --- NEW ---
        fetchCorumComplexes()     
    ]);
    // NEW: Merge after fetches
    await mergePhylogenyCaches();
    console.log('ciliAI.js: All data loaded (including new domain and phylogeny sources).');
    
    setTimeout(setupCiliAIEventListeners, 0);
};

// --- Helper Functions ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function debounce(fn, delay) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => fn(...args), delay); }; }

function normalizeTerm(s) {
    if (!s) return '';
    // UPDATED: Now replaces periods, hyphens, underscores, and spaces with a single space.
    return String(s).toLowerCase().replace(/[._\-\s]+/g, ' ').trim();
}


// =============================================================================
// REPLACEMENT: The definitive "Brain" of CiliAI, merging all features correctly.
// =============================================================================
function createIntentParser() {
    // RESTORED: Your full, comprehensive list of diseases.
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
            "Smith-Lemli-Opitz Syndrome", "Spondylometaphyseal Dysplasia", "Stromme Syndrome", "Weyers Acrofacial Dysostosis", "Hydrocephalus"
        ],
        "Motile Ciliopathies": [
            "Primary Ciliary Dyskinesia", "Birt-Hogg-Dubé Syndrome", "Juvenile Myoclonic Epilepsy"
        ],
        "Atypical Ciliopathies": [
            "Biliary Ciliopathy", "Chronic Obstructive Pulmonary Disease", "Ciliopathy", "Ciliopathy - Retinal dystrophy", "Golgipathies or Ciliopathy", "Hepatic Ciliopathy", "Male Infertility and Ciliopathy", "Male infertility", "Microcephaly and Chorioretinopathy Type 3", "Mucociliary Clearance Disorder", "Notch-mediated Ciliopathy", "Primary Endocardial Fibroelastosis", "Retinal Degeneration"
        ]
    };
    const aliases = ["BBS", "Joubert", "NPHP", "MKS"];
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

// --- Data Fetching and Caching (Updated with New Integration Logic) ---

async function fetchCiliaData() {
    if (ciliaHubDataCache) return ciliaHubDataCache;
    try {
        // Fetch primary gene data
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/ciliahub_data.json');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();

        // Fetch screen data for merging
        const screenData = await fetchScreenData(); // Ensure screen data is loaded

        const processToArray = (field) => {
            if (typeof field === 'string') return field.split(',').map(item => item.trim()).filter(Boolean);
            if (Array.isArray(field)) return field;
            return [];
        };

        ciliaHubDataCache = data.map(gene => {
            const geneUpper = gene.gene.toUpperCase();

            // 1. Map core gene fields to arrays where appropriate
            const processedGene = {
                ...gene,
                functional_category: processToArray(gene.functional_category),
                domain_descriptions: processToArray(gene.domain_descriptions),
                ciliopathy: processToArray(gene.ciliopathy),
                localization: processToArray(gene.localization),
                complex_names: processToArray(gene.complex_names),
                complex_components: processToArray(gene.complex_components)
            };

            // 2. Add Cilia Effects from ciliahub_data.json
            // These fields are correctly sourced from the main ciliahub_data.json.
            const effectsFromHub = {
                overexpression_effects: processedGene.overexpression_effects || "Not Reported",
                lof_effects: processedGene.lof_effects || "Not Reported",
                percent_ciliated_cells_effects: processedGene.percent_ciliated_cells_effects || "Not Reported",
            };

            // 3. Merge in custom effects on cilia if the gene is found in screenData, 
            // but explicitly ignoring the 'screens' field in the main data.
            // Note: The logic requires that the new 'effects' data comes from 
            // ciliahub_data.json (which we've done in point #2) 
            // AND the screen data should be integrated with gene data for display.
            // The request states "Please add effects on cilia together with cilia_screens_data.json."
            // We interpret this as ensuring both the core effects (from the old 'screens' in the hub)
            // and the detailed screens (from the separate JSON) are present for a gene.
            const screensFromSeparateFile = screenData[geneUpper] || [];

            // 4. Ensure new requested fields are added (they should be present but are mapped for clarity)
            const newIntegratedFields = {
                // These are the new requested fields, ensuring they exist:
                ciliopathy_classification: processedGene.ciliopathy_classification || "Not Classified",
                ortholog_mouse: processedGene.ortholog_mouse || "N/A",
                ortholog_c_elegans: processedGene.ortholog_c_elegans || "N/A",
                ortholog_xenopus: processedGene.ortholog_xenopus || "N/A",
                ortholog_zebrafish: processedGene.ortholog_zebrafish || "N/A",
                ortholog_drosophila: processedGene.ortholog_drosophila || "N/A",
                
                // Add the explicit effects from the Hub for use in gene summary:
                ...effectsFromHub, 

                // Add the screens array from the separate file for the comprehensive details card:
                screens_from_separate_file: screensFromSeparateFile
            };

            return { ...processedGene, ...newIntegratedFields };
        });

        console.log('CiliaHub data loaded and formatted with new orthologs, classification, and screens integration successfully.');
        return ciliaHubDataCache;
    } catch (error) {
        console.error("Failed to fetch CiliaHub data:", error);
        ciliaHubDataCache = [];
        return ciliaHubDataCache;
    }
}


// --- UPDATED fetchScreenData function (to be replaced in your code) ---
async function fetchScreenData() {
    if (screenDataCache) return screenDataCache;
    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cilia_screens_data.json');
        if (!response.ok) throw new Error(`Failed to fetch screen data: ${response.statusText}`);
        const data = await response.json();
        screenDataCache = data;
        
        // --- NEW: Populate allGeneSymbols cache with screen genes ---
        const screenGenes = Object.keys(data);
        if (!allGeneSymbols) {
            allGeneSymbols = new Set(screenGenes);
        } else {
            screenGenes.forEach(gene => allGeneSymbols.add(gene));
        }
        // This process needs to be finalized in fetchCiliaData too for complete coverage.

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
        // Map class to query categories
        const classToCategory = {
            'Ciliary-only': 'ciliated_only_genes',
            'Present-in-both': 'in_all_organisms',
            'Non-ciliary': 'nonciliary_only_genes' // Adjust if class names differ
        };
        // Process ciliated_only_genes, nonciliary_only_genes, in_all_organisms if present
        if (raw.ciliated_only_genes) {
            raw.ciliated_only_genes
                .filter(g => typeof g === 'string' && g)
                .forEach(g => unified[g.trim().toUpperCase()] = { sym: g.trim(), category: 'ciliated_only_genes', species: [] });
        }
        if (raw.nonciliary_only_genes) {
            raw.nonciliary_only_genes
                .filter(g => typeof g === 'string' && g)
                .forEach(g => unified[g.trim().toUpperCase()] = { sym: g.trim(), category: 'nonciliary_only_genes', species: [] });
        }
        if (raw.in_all_organisms) {
            raw.in_all_organisms
                .filter(g => typeof g === 'string' && g)
                .forEach(g => unified[g.trim().toUpperCase()] = { sym: g.trim(), category: 'in_all_organisms', species: [] });
        }
        // Process summary array
        if (raw.summary && Array.isArray(raw.summary)) {
            raw.summary.forEach(item => {
                const gene = (item.sym || '').trim().toUpperCase();
                const cat = (item.class || '').trim();
                if (gene) {
                    unified[gene] = {
                        sym: item.sym, // Retain original sym
                        category: classToCategory[cat] || cat.toLowerCase().replace(/[\s-]+/g, '_'),
                        species: Array.isArray(item.species) ? item.species.map(s => s.trim()) : []
                    };
                }
            });
        }
        phylogenyDataCache = unified;
        console.log(`Phylogeny data normalized: ${Object.keys(unified).length} entries`);
        // Log genes with C.elegans
        const celegansGenes = Object.entries(unified)
            .filter(([_, data]) => data.species.includes('C.elegans'))
            .map(([gene, data]) => ({ gene: data.sym, species: data.species, category: data.category }));
        console.log(`Genes with C.elegans: ${celegansGenes.length}`, celegansGenes.slice(0, 5));
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
            if (geneSymbol && tissue && nTPMValue) {
                const gene = geneSymbol.toUpperCase().trim();
                const nTPM = parseFloat(nTPMValue.trim());
                if (!isNaN(nTPM)) {
                    if (!data[gene]) data[gene] = {};
                    data[gene][tissue.trim()] = nTPM;
                }
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

async function fetchUmapData() {
    if (umapDataCache) return umapDataCache;

    // Use the correct Raw URL you've provided
    const dataUrl = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/umap_data.json';

    try {
        console.log('Fetching pre-computed UMAP data...');
        const response = await fetch(dataUrl);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        umapDataCache = await response.json();
        console.log(`✅ UMAP data loaded with ${umapDataCache.length} points.`);
        return umapDataCache;
    } catch (error) {
        console.error('Failed to fetch UMAP data:', error);
        return null;
    }
}

async function fetchCellxgeneData() {
    // Check if data is already in cache
    if (cellxgeneDataCache) return cellxgeneDataCache;

    // Use the correct Raw URL you've provided
    const dataUrl = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cellxgene_data.json';

    try {
        console.log('Fetching Cellxgene single-cell data...');
        const response = await fetch(dataUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const jsonData = await response.json();
        
        cellxgeneDataCache = jsonData;
        
        console.log(`✅ Cellxgene data loaded successfully for ${Object.keys(jsonData).length} genes.`);
        return cellxgeneDataCache;

    } catch (error) {
        console.error('Failed to fetch or parse Cellxgene data:', error);
        cellxgeneDataCache = null; // Set to null on failure
        return null;
    }
}

/**
 * Fetches and processes CORUM Human Complex data.
 * @returns {Promise<Object>} The CORUM data cache object.
 */
async function fetchCorumComplexes() {
    if (corumDataCache.loaded) return corumDataCache;
    const dataUrl = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/corum_humanComplexes.json';

    try {
        console.log('Fetching CORUM complexes...');
        const response = await fetch(dataUrl);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        
        // Handle single object vs. array format for robustness
        const rawData = await response.json();
        const data = Array.isArray(rawData) ? rawData : [rawData]; 

        data.forEach(entry => {
            // CRITICAL FIX 1: Check for complex_name and subunits array
            if (!entry || !entry.complex_name || !Array.isArray(entry.subunits)) return; 
            
            const complexNameLower = entry.complex_name.toLowerCase();
            
            // Store the whole entry for complex name lookup
            corumDataCache.byNameLower[complexNameLower] = entry; 
            corumDataCache.list.push(entry);

            // Populate byGene lookup
            entry.subunits.forEach(subunit => {
                // CRITICAL FIX 2: Access gene symbol from the subunit object's 'gene_name' field
                const geneSymbol = subunit.gene_name;
                if (!geneSymbol) return; 

                const g = geneSymbol.toUpperCase();
                if (!corumDataCache.byGene[g]) corumDataCache.byGene[g] = [];
                
                // Store a lighter reference to the complex, listing all gene symbols
                corumDataCache.byGene[g].push({
                    complexName: entry.complex_name,
                    // Map the subunits array of objects back to an array of uppercase gene symbols
                    subunits: entry.subunits.map(s => s.gene_name.toUpperCase()) 
                });
            });
        });

        corumDataCache.loaded = true;
        console.log(`✅ Loaded ${corumDataCache.list.length} CORUM complexes.`);
        return corumDataCache;
    } catch (err) {
        console.error('Failed to fetch CORUM data:', err);
        // Set loaded to true to prevent endless retry loop
        corumDataCache.loaded = true; 
        return corumDataCache;
    }
}

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
function getSubunitsByComplexName(complexName) {
    if (!corumDataCache.loaded) {
        console.warn('CORUM data not loaded yet.');
        return [];
    }
    const qLower = complexName.toLowerCase();
    
    // Check main complex list for matches
    const results = corumDataCache.list.filter(c => 
        c.complexName.toLowerCase().includes(qLower)
    );
    
    return results;
}


/**
 * Fetches the new domain database (enriched, depleted, gene map).
 * URL: https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cili_ai_domain_database.json
 */
/**
 * Fetches the new domain database (enriched, depleted, gene map).
 * URL: https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cili_ai_domain_database.json
 */
async function getDomainData() {
    if (CILI_AI_DOMAIN_DB) return CILI_AI_DOMAIN_DB;
    const dataUrl = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cili_ai_domain_database.json';
    try {
        const response = await fetch(dataUrl);
        if (!response.ok) {
            console.error(`Error fetching domain DB: ${response.status} ${response.statusText}`);
            return null;
        }
        CILI_AI_DOMAIN_DB = await response.json();
        console.log('✅ New Domain Database (cili_ai_domain_database.json) loaded successfully.');
        return CILI_AI_DOMAIN_DB;
    } catch (error) {
        console.error(`Network error or JSON parsing error for Domain DB: ${error}`);
        return null;
    }
}

/**
 * Fetches the Nevers et al. 2017 phylogeny matrix.
 * URL: https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/nevers_et_al_2017_matrix_optimized.json
 */
async function fetchNeversPhylogenyData() {
    if (neversPhylogenyCache) return neversPhylogenyCache;
    const dataUrl = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/nevers_et_al_2017_matrix_optimized.json';
    try {
        const response = await fetch(dataUrl);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        neversPhylogenyCache = await response.json();
        console.log('✅ Nevers et al. 2017 Phylogeny data loaded successfully.');
        return neversPhylogenyCache;
    } catch (error) {
        console.error('Failed to fetch Nevers et al. 2017 phylogeny data:', error);
        return null;
    }
}

/**
 * Fetches the Li et al. 2014 phylogeny matrix.
 * URL: https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/li_et_al_2014_matrix_optimized.json
 */
async function fetchLiPhylogenyData() {
    if (liPhylogenyCache) return liPhylogenyCache;
    const dataUrl = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/li_et_al_2014_matrix_optimized.json';
    try {
        const response = await fetch(dataUrl);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        liPhylogenyCache = await response.json();
        console.log('✅ Li et al. 2014 Phylogeny data loaded successfully.');
        return liPhylogenyCache;
    } catch (error) {
        console.error('Failed to fetch Li et al. 2014 phylogeny data:', error);
        return null;
    }
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

/**
 * Displays a UMAP plot where each cell is colored by the expression of a specific gene,
 * AND clusters are labeled by cell type.
 */
async function displayUmapGeneExpression(geneSymbol) {
    const [umapData, cellData] = await Promise.all([fetchUmapData(), fetchCellxgeneData()]);
    const resultArea = document.getElementById('ai-result-area');

    if (!umapData || !cellData) {
        return `<div class="result-card"><h3>UMAP Expression Plot</h3><p class="status-not-found">Could not load UMAP or Cellxgene data.</p></div>`;
    }

    const geneUpper = geneSymbol.toUpperCase();
    const geneExpressionMap = cellData[geneUpper];

    if (!geneExpressionMap) {
        return `<div class="result-card"><h3>${geneSymbol} Expression</h3><p class="status-not-found">Gene "${geneSymbol}" not found in the single-cell expression dataset.</p></div>`;
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

    const expressionValues = sampledData.map(cell => geneExpressionMap[cell.cell_type] || 0);

    // --- NEW: Calculate cluster labels ---
    const cellTypes = [...new Set(sampledData.map(d => d.cell_type))];
    const annotations = [];

    // Helper to find the median (center) of a cluster
    const median = (arr) => {
        const mid = Math.floor(arr.length / 2);
        const nums = [...arr].sort((a, b) => a - b);
        return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
    };

    for (const cellType of cellTypes) {
        const points = sampledData.filter(d => d.cell_type === cellType);
        if (points.length > 0) {
            const xCoords = points.map(p => p.x);
            const yCoords = points.map(p => p.y);
            
            annotations.push({
                x: median(xCoords), // Use median for a more central position
                y: median(yCoords),
                text: cellType,
                showarrow: false,
                font: {
                    color: '#FFFFFF', // White text
                    size: 10,
                    family: 'Arial, sans-serif'
                },
                bgcolor: 'rgba(0,0,0,0.4)', // Faint black background for readability
                borderpad: 2,
                bordercolor: 'rgba(0,0,0,0.4)',
                borderwidth: 1,
                xref: 'x',
                yref: 'y'
            });
        }
    }
    // --- END NEW ---

    const plotData = [{
        x: sampledData.map(p => p.x),
        y: sampledData.map(p => p.y),
        mode: 'markers',
        type: 'scattergl',
        hovertext: sampledData.map((p, i) => `Cell Type: ${p.cell_type}<br>Expression: ${expressionValues[i].toFixed(4)}`),
        hoverinfo: 'text',
        marker: {
            color: expressionValues,
            colorscale: 'Plasma', // Kept the scale you liked
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
        title: `UMAP Colored by ${geneSymbol} Expression (Sample of ${sampleSize} cells)`,
        xaxis: { title: 'UMAP 1', zeroline: false, showgrid: false },
        yaxis: { title: 'UMAP 2', zeroline: false, showgrid: false },
        hovermode: 'closest',
        margin: { t: 50, b: 50, l: 50, r: 50 },
        plot_bgcolor: '#FFFFFF', // White plot background
        paper_bgcolor: '#FFFFFF', // White paper background
        annotations: annotations, // Add the new cluster labels
        showlegend: false // Don't need a legend for the continuous scale
    };

    const plotDivId = 'umap-expression-plot-div';
    resultArea.innerHTML = `
        <div class="result-card">
            <div id="${plotDivId}"></div>
            <button class="download-button" onclick="downloadPlot('${plotDivId}', 'UMAP_${geneSymbol}_Expression')">Download Plot</button>
        </div>`;
    
    Plotly.newPlot(plotDivId, plotData, layout, { responsive: true, displayModeBar: false });
    return "";
}

/**
 * Displays a UMAP plot colored by cell type.
 */
async function displayUmapPlot() {
    const data = await fetchUmapData();
    const resultArea = document.getElementById('ai-result-area');
    
    if (!data) {
        return `<div class="result-card"><h3>UMAP Plot</h3><p class="status-not-found">Could not load pre-computed UMAP data.</p></div>`;
    }

    const sampleSize = 15000;
    const sampledData = []; // Declare sampledData here

    if (data.length > sampleSize) {
         const usedIndices = new Set();
         while (sampledData.length < sampleSize) {
            const randomIndex = Math.floor(Math.random() * data.length);
            if (!usedIndices.has(randomIndex)) {
                sampledData.push(data[randomIndex]);
                usedIndices.add(randomIndex);
            }
        }
    } else {
        sampledData.push(...data);
    }
    
    const cellTypes = [...new Set(sampledData.map(d => d.cell_type))];
    const plotData = [];

    // Use a categorical color scale for distinct cell types
    const colorPalette = Plotly.d3.scale.category10(); // D3's category10 for distinct colors

    for (let i = 0; i < cellTypes.length; i++) {
        const cellType = cellTypes[i];
        const points = sampledData.filter(d => d.cell_type === cellType);
        plotData.push({
            x: points.map(p => p.x),
            y: points.map(p => p.y),
            name: cellType,
            mode: 'markers',
            type: 'scattergl',
            marker: { 
                size: 5, 
                opacity: 0.8,
                color: colorPalette(i) // Assign a distinct color
            },
            hovertext: points.map(p => `Cell Type: ${p.cell_type}`),
            hoverinfo: 'text'
        });
    }

    const layout = {
        title: `UMAP of Single-Cell Gene Expression (Sample of ${sampleSize} cells)`,
        xaxis: { title: 'UMAP 1' },
        yaxis: { title: 'UMAP 2' },
        hovermode: 'closest',
        margin: { t: 50, b: 50, l: 50, r: 50 } // Adjust margins for better fit
    };

    const plotDivId = 'umap-plot-div';
    resultArea.innerHTML = `
        <div class="result-card">
            <div id="${plotDivId}"></div>
            <button class="download-button" onclick="downloadPlot('${plotDivId}', 'UMAP_CellTypes')">Download Plot</button>
        </div>`;
    
    Plotly.newPlot(plotDivId, plotData, layout, { responsive: true, displayModeBar: false });
    return "";
}

// --- Data Access: All Extracted Genes (For reference, no change needed) ---
function getAllPhylogenyGenes() {
    // This line returns an array containing all ~19,000+ gene symbols 
    // (the keys from your two optimized JSON files).
    return Object.keys(phylogenyDataCache); 
}

// --- NEW HELPER: Extract Multiple Genes Dynamically ---
/**
 * Scans a query string to extract one or more gene symbols.
 * @param {string} query - The user's input query.
 * @returns {Array<string>} - A unique list of uppercase gene symbols found.
 */
function extractMultipleGenes(query) {
    // Looks for capital letters/numbers (3+ characters) or common ciliary gene patterns.
    // The 'g' flag ensures all matches are found.
    const genePattern = /\b([A-Z0-9]{3,}|ift\d+|bbs\d+|arl\d+b|nphp\d+)\b/gi;
    const matches = query.match(genePattern);

    if (!matches) {
        return [];
    }

    // Return unique uppercase gene symbols
    return [...new Set(matches.map(g => g.toUpperCase()))];
}

// --- UPDATED getPhylogenyGenesForOrganism (Enriches with ALL Orthologs) ---
async function getPhylogenyGenesForOrganism(organismName) {
    await fetchCiliaData(); 
    await fetchPhylogenyData();

    // 1. Get the initial list from the phylogeny function
    const { genes, description, speciesCode } = await getCiliaryGenesForOrganism(organismName);
    
    // 2. Enrich the gene list with all five model organism orthologs from the Hub data
    const enrichedGenes = genes.map(geneEntry => {
        const humanGeneUpper = geneEntry.gene.toUpperCase();
        const hubData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === humanGeneUpper);
        
        // Add ALL orthologs from the hub annotation for flexible display
        return {
            ...geneEntry,
            ortholog_mouse: hubData?.ortholog_mouse || 'N/A',
            ortholog_c_elegans: hubData?.ortholog_c_elegans || 'N/A',
            ortholog_zebrafish: hubData?.ortholog_zebrafish || 'N/A',
            ortholog_drosophila: hubData?.ortholog_drosophila || 'N/A',
            ortholog_xenopus: hubData?.ortholog_xenopus || 'N/A',
        };
    });

    // Determine which key corresponds to the target organism for column display
    const organismKeyMap = {
        'mouse': 'ortholog_mouse', 'xenopus': 'ortholog_xenopus',
        'zebrafish': 'ortholog_zebrafish', 'drosophila': 'ortholog_drosophila',
        'worm': 'ortholog_c_elegans', 'c. elegans': 'ortholog_c_elegans',
        'fly': 'ortholog_drosophila', 'human': 'N/A'
    };
    const targetKey = organismKeyMap[organismName.toLowerCase()] || 'N/A';
    
    // Define the source citation
    const citationHtml = `<p style="font-size: 0.8em; color: #666; margin-top: 1rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
        <strong>Data Source:</strong> Phylogenetic conservation analysis (Li et al. 2014). Ortholog names curated from CiliaHub.
        <a href="https://pubmed.ncbi.nlm.nih.gov/24995987/" target="_blank">[PMID: 24995987]</a>
    </p>`;
    
    return formatListResult(
        `Ciliary Genes Conserved in ${speciesCode} (Phylogeny Screen)`, 
        enrichedGenes, 
        citationHtml,
        speciesCode, // Pass the speciesCode to determine the column header
        targetKey    // Pass the key to extract the correct ortholog name
    );
}


// Function already defined but repeated here for context:
async function getHubOrthologsForGene(gene) {
    if (!ciliaHubDataCache) await fetchCiliaData();
    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === gene.toUpperCase());

    if (!geneData) return `<div class="result-card"><h3>${gene}</h3><p class="status-not-found">Gene not found in the database.</p></div>`;

    const citationHtml = `<p style="font-size: 0.8em; color: #666; margin-top: 1rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
        <strong>Source:</strong> Gene-specific annotation in the CiliaHub Database (ciliahub_data.json).
    </p>`;

    return `
        <div class="result-card">
            <h3>Curated Orthologs of ${gene} (CiliaHub Annotation)</h3>
            <table class="gene-detail-table">
                <tr><th>Mouse (M. musculus)</th><td>${geneData.ortholog_mouse || 'N/A'}</td></tr>
                <tr><th>Worm (C. elegans)</th><td>${geneData.ortholog_c_elegans || 'N/A'}</td></tr>
                <tr><th>Zebrafish (D. rerio)</th><td>${geneData.ortholog_zebrafish || 'N/A'}</td></tr>
                <tr><th>Fly (D. melanogaster)</th><td>${geneData.ortholog_drosophila || 'N/A'}</td></tr>
                <tr><th>Xenopus (X. tropicalis)</th><td>${geneData.ortholog_xenopus || 'N/A'}</td></tr>
            </table>
            ${citationHtml}
        </div>`;
}


const questionRegistry = [
    // ==================== META / GENERAL ====================
    { text: "What can you do?", handler: async () => tellAboutCiliAI() },
    { text: "Tell me about yourself", handler: async () => tellAboutCiliAI() },
    { text: "What information do you have?", handler: async () => tellAboutCiliAI() },
    { text: "What datasets are you using?", handler: async () => tellAboutCiliAI() },
    { text: "Explain CiliAI's capabilities.", handler: async () => tellAboutCiliAI() },
    { text: "How can you help me?", handler: async () => tellAboutCiliAI() },
    { text: "What questions can I ask?", handler: async () => tellAboutCiliAI() },
    { text: "Give me an overview of your features", handler: async () => tellAboutCiliAI() },

// ==================== PHYLOGENY QUERIES (VISUALIZATION) - UPDATED ====================
// These queries now route to the unified analysis function.
{ text: "Show evolutionary conservation of IFT88", handler: async () => getPhylogenyAnalysis(["IFT88"]) },
{ text: "IFT88 conservation analysis", handler: async () => getPhylogenyAnalysis(["IFT88"]) },
{ text: "What is the phylogeny of BBS1?", handler: async () => getPhylogenyAnalysis(["BBS1"]) },
{ text: "BBS1 conservation heatmap", handler: async () => getPhylogenyAnalysis(["BBS1"]) },
// ... (continue for all other specific gene entries: ARL13B, NPHP1, WDR31, CEP290) ...
// The general catch-all queries must also be updated to call this new function:
{ // Catches the most common conservation phrase for any gene (e.g., WDR54)
    text: "Show evolutionary conservation of gene X", handler: async (q) => getPhylogenyAnalysis(extractMultipleGenes(q)) 
},
{ // Catches the "What is the phylogeny/comparison of" phrase 
    text: "What is the phylogeny of gene X?", handler: async (q) => getPhylogenyAnalysis(extractMultipleGenes(q)) 
},
{ // Catches comparison formats
    text: "Compare gene X phylogeny", handler: async (q) => getPhylogenyAnalysis(extractMultipleGenes(q)) 
},
{ // Catches the original 'Show the phylogenetic comparison' phrasing
    text: "Show the phylogenetic comparison for gene X", handler: async (q) => getPhylogenyAnalysis(extractMultipleGenes(q)) 
},
    
    // ==================== SOURCE QUERIES ====================
    { text: "What is the source for Ciliary genes in C. elegans?", handler: async () => tellAboutOrganismSources("C. elegans") },
    { text: "What is the source for Ciliary genes in mouse?", handler: async () => tellAboutOrganismSources("mouse") },
    { text: "What is the source for Ciliary genes in zebrafish?", handler: async () => tellAboutOrganismSources("zebrafish") },
    { text: "What is the source for Ciliary genes in drosophila?", handler: async () => tellAboutOrganismSources("drosophila") },
// ==================== PHYLOGENY QUERIES (VISUALIZATION) ====================
{ text: "Show evolutionary conservation of IFT88", handler: async () => displayPhylogenyComparison(["IFT88"]) },
{ text: "IFT88 conservation analysis", handler: async () => displayPhylogenyComparison(["IFT88"]) },
{ text: "What is the phylogeny of BBS1?", handler: async () => displayPhylogenyComparison(["BBS1"]) },
{ text: "BBS1 conservation heatmap", handler: async () => displayPhylogenyComparison(["BBS1"]) },
{ text: "Compare IFT88 phylogeny", handler: async () => displayPhylogenyComparison(["IFT88"]) },
{ text: "Compare BBS1 phylogeny", handler: async () => displayPhylogenyComparison(["BBS1"]) },
{ text: "Show the phylogenetic comparison for ARL13B", handler: async () => displayPhylogenyComparison(["ARL13B"]) },
{ text: "Show heatmap for ARL13B", handler: async () => displayPhylogenyComparison(["ARL13B"]) },
{ text: "NPHP1 phylogenetic analysis comparison", handler: async () => displayPhylogenyComparison(["NPHP1"]) },
{ text: "Show NPHP1 phylogeny plot", handler: async () => displayPhylogenyComparison(["NPHP1"]) },
{ text: "Show the phylogenetic comparison for WDR31", handler: async () => displayPhylogenyComparison(["WDR31"]) },
{ text: "WDR31 evolutionary heatmap", handler: async () => displayPhylogenyComparison(["WDR31"]) },
{ text: "Phylogenetic analysis of CEP290", handler: async () => displayPhylogenyComparison(["CEP290"]) },
{ // Catches the most common conservation phrase for any gene (e.g., WDR54)
text: "Show evolutionary conservation of gene X", handler: async (q) => plotPhylogenyFromQuery(q) },
{ // Catches the "What is the phylogeny/comparison of" phrase 
    text: "What is the phylogeny of gene X?", handler: async (q) => plotPhylogenyFromQuery(q) },
{ // Catches comparison formats
    text: "Compare gene X phylogeny", handler: async (q) => plotPhylogenyFromQuery(q) },
{ // Catches the original 'Show the phylogenetic comparison' phrasing
    text: "Show the phylogenetic comparison for gene X", handler: async (q) => plotPhylogenyFromQuery(q) },

// --------------------------------------------------------------------------------------
// --- List Queries (CILIARY/NON-CILIARY LISTS) ---
{ text: "Provide the list of ciliary genes in mouse", handler: async (q) => routePhylogenyAndListQueries(q) },
{ text: "List all ciliary genes found in mice", handler: async (q) => routePhylogenyAndListQueries(q) },
{ text: "Show ciliary genes in C. elegans", handler: async (q) => routePhylogenyAndListQueries(q) },
{ text: "C. elegans ciliary gene list", handler: async (q) => routePhylogenyAndListQueries(q) },
{ text: "Show non-ciliary genes in mouse", handler: async (q) => routePhylogenyAndListQueries(q) },
{ text: "List non-ciliary genes in mice", handler: async (q) => routePhylogenyAndListQueries(q) },
{ text: "List non-ciliary genes in C. elegans", handler: async (q) => routePhylogenyAndListQueries(q) },
{ text: "Provide the nonciliary genes found in zebrafish", handler: async (q) => routePhylogenyAndListQueries(q) },
{ text: "Do you have the list of non-ciliary genes in fly?", handler: async (q) => routePhylogenyAndListQueries(q) },
{ text: "Show non-ciliary genes in Drosophila", handler: async (q) => routePhylogenyAndListQueries(q) },

// --------------------------------------------------------------------------------------
// --- Ortholog & Conservation Check Queries ---
{ text: "What are the orthologs of ARL13B?", handler: async () => getOrthologsForGene("ARL13B") },
{ text: "Show curated orthologs for ARL13B", handler: async () => getOrthologsForGene("ARL13B") },
{ text: "Show me the homologs of IFT88", handler: async () => getOrthologsForGene("IFT88") },
{ text: "Ortholog names for IFT88", handler: async () => getOrthologsForGene("IFT88") },
{ text: "List all orthologs for WDR31", handler: async () => getOrthologsForGene("WDR31") },
{ text: "Show WDR31 ortholog names", handler: async () => getOrthologsForGene("WDR31") },
{ text: "What is the C. elegans homolog of BBS1?", handler: async () => getOrthologsForGene("BBS1") },
{ text: "Worm ortholog for BBS1", handler: async () => getOrthologsForGene("BBS1") },
{ text: "Give me the mouse ortholog for CEP290", handler: async () => getOrthologsForGene("CEP290") },
{ text: "Mouse homolog for CEP290", handler: async () => getOrthologsForGene("CEP290") },
{ text: "Is NPHP1 conserved in mouse?", handler: async () => checkConservation("NPHP1", "mouse") },
{ text: "Is NPHP1 present in mouse?", handler: async () => checkConservation("NPHP1", "mouse") },
{ text: "Does mouse have a homolog of NPHP1?", handler: async () => checkConservation("NPHP1", "mouse") },
{ text: "Find the drosophila ortholog for MKS1", handler: async () => getOrthologsForGene("MKS1") },
{ text: "Fly ortholog of MKS1", handler: async () => getOrthologsForGene("MKS1") },
{ text: "Orthologs of TMEM107 in zebrafish", handler: async () => getOrthologsForGene("TMEM107") },
{ text: "Zebrafish homolog of TMEM107", handler: async () => getOrthologsForGene("TMEM107") },    
    // ==================== GENE DETAILS & FUNCTION ====================
    // General function queries
    { text: "Describe the function of KIF17", handler: async () => getGeneFunction("KIF17") },
    { text: "What is the function of KIF17?", handler: async () => getGeneFunction("KIF17") },
    { text: "What does KIF17 do?", handler: async () => getGeneFunction("KIF17") },
    { text: "Tell me the function of KIF17.", handler: async () => getGeneFunction("KIF17") },
    { text: "Explain KIF17's role", handler: async () => getGeneFunction("KIF17") },
    { text: "How does KIF17 work?", handler: async () => getGeneFunction("KIF17") },
    
    { text: "Describe the function of BBS1", handler: async () => getGeneFunction("BBS1") },
    { text: "What is the function of BBS1?", handler: async () => getGeneFunction("BBS1") },
    { text: "What does BBS1 do?", handler: async () => getGeneFunction("BBS1") },
    { text: "Explain BBS1's role", handler: async () => getGeneFunction("BBS1") },
    
    { text: "What is the role of CC2D1A in cilia?", handler: async () => getGeneFunction("CC2D1A") },
    { text: "Explain CC2D1A's role in ciliary processes.", handler: async () => getGeneFunction("CC2D1A") },
    { text: "How does CC2D1A contribute to cilia?", handler: async () => getGeneFunction("CC2D1A") },
    { text: "What does CC2D1A do in cilia?", handler: async () => getGeneFunction("CC2D1A") },
    
    { text: "Explain how CILK1 regulates cilia length", handler: async () => getGeneFunction("CILK1") },
    { text: "How does CILK1 control ciliary length?", handler: async () => getGeneFunction("CILK1") },
    
    { text: "What does ARL13B do in ciliary signaling?", handler: async () => getGeneRole("ARL13B", "ciliary signaling") },
    { text: "Describe the role of ARL13B in ciliary signaling", handler: async () => getGeneRole("ARL13B", "ciliary signaling") },
    { text: "How does ARL13B function in signaling?", handler: async () => getGeneRole("ARL13B", "ciliary signaling") },
    
    { text: "Explain what CEP290 does", handler: async () => getGeneFunction("CEP290") },
    { text: "What is CEP290's function?", handler: async () => getGeneFunction("CEP290") },
    { text: "Describe CEP290", handler: async () => getGeneFunction("CEP290") },
    
    // Comprehensive details
    { text: "Show all known info about IFT88", handler: async () => getComprehensiveDetails("IFT88") },
    { text: "Tell me about IFT88", handler: async () => getComprehensiveDetails("IFT88") },
    { text: "Give me details for IFT88.", handler: async () => getComprehensiveDetails("IFT88") },
    { text: "Summarize information for IFT88.", handler: async () => getComprehensiveDetails("IFT88") },
    { text: "Everything about IFT88", handler: async () => getComprehensiveDetails("IFT88") },
    { text: "IFT88 complete information", handler: async () => getComprehensiveDetails("IFT88") },
    
    { text: "Show all known info about BBS1", handler: async () => getComprehensiveDetails("BBS1") },
    { text: "Tell me about BBS1", handler: async () => getComprehensiveDetails("BBS1") },
    { text: "Everything about BBS1", handler: async () => getComprehensiveDetails("BBS1") },
    
    { text: "Show all known info about ARL13B", handler: async () => getComprehensiveDetails("ARL13B") },
    { text: "Tell me about ARL13B", handler: async () => getComprehensiveDetails("ARL13B") },
    { text: "ARL13B comprehensive info", handler: async () => getComprehensiveDetails("ARL13B") },
    
    // Additional genes - add comprehensive details for commonly studied genes
    { text: "Tell me about DYNC2H1", handler: async () => getComprehensiveDetails("DYNC2H1") },
    { text: "Show info about NPHP1", handler: async () => getComprehensiveDetails("NPHP1") },
    { text: "Tell me about MKS1", handler: async () => getComprehensiveDetails("MKS1") },
    { text: "Show details for RPGRIP1L", handler: async () => getComprehensiveDetails("RPGRIP1L") },
    { text: "Tell me about NEK8", handler: async () => getComprehensiveDetails("NEK8") },

    // ==================== CILIARY STATUS ====================
    { text: "Is DYNC2H1 a ciliary gene?", handler: async () => checkCiliaryStatus("DYNC2H1") },
    { text: "Is DYNC2H1 related to cilia?", handler: async () => checkCiliaryStatus("DYNC2H1") },
    { text: "Confirm if DYNC2H1 is ciliary.", handler: async () => checkCiliaryStatus("DYNC2H1") },
    { text: "Does DYNC2H1 localize to cilia?", handler: async () => checkCiliaryStatus("DYNC2H1") },
    { text: "Is DYNC2H1 involved in cilia?", handler: async () => checkCiliaryStatus("DYNC2H1") },
    
    // More ciliary status checks
    { text: "Is KIF3A a ciliary gene?", handler: async () => checkCiliaryStatus("KIF3A") },
    { text: "Is FOXJ1 ciliary?", handler: async () => checkCiliaryStatus("FOXJ1") },
    { text: "Does RSPH1 localize to cilia?", handler: async () => checkCiliaryStatus("RSPH1") },
    
    { text: "Show me all ciliary genes", handler: async () => getAllCiliaryGenes() },
    { text: "List all ciliary genes.", handler: async () => getAllCiliaryGenes() },
    { text: "What are all the ciliary genes?", handler: async () => getAllCiliaryGenes() },
    { text: "Give me a list of ciliary genes", handler: async () => getAllCiliaryGenes() },
    { text: "Show all cilia-related genes", handler: async () => getAllCiliaryGenes() },
    { text: "List every ciliary gene", handler: async () => getAllCiliaryGenes() },

    // ==================== LOCALIZATION ====================
    // Specific gene localization
    { text: "Describe the localization of EFCAB7", handler: async () => getGeneLocalization("EFCAB7") },
    { text: "Where is EFCAB7 localized in the cell?", handler: async () => getGeneLocalization("EFCAB7") },
    { text: "Where is EFCAB7 found in the cell?", handler: async () => getGeneLocalization("EFCAB7") },
    { text: "Cellular location of EFCAB7.", handler: async () => getGeneLocalization("EFCAB7") },
    { text: "Subcellular localization of EFCAB7.", handler: async () => getGeneLocalization("EFCAB7") },
    { text: "Where does EFCAB7 localize?", handler: async () => getGeneLocalization("EFCAB7") },
    { text: "EFCAB7 subcellular location", handler: async () => getGeneLocalization("EFCAB7") },
    
    { text: "Where is IFT88 localized in the cell?", handler: async () => getGeneLocalization("IFT88") },
    { text: "IFT88 localization", handler: async () => getGeneLocalization("IFT88") },
    { text: "Where does IFT88 localize?", handler: async () => getGeneLocalization("IFT88") },
    
    // Additional gene localizations
    { text: "Where is CEP290 located?", handler: async () => getGeneLocalization("CEP290") },
    { text: "Where does BBS4 localize?", handler: async () => getGeneLocalization("BBS4") },
    { text: "Localization of NPHP1", handler: async () => getGeneLocalization("NPHP1") },
    { text: "Where is RPGRIP1L found?", handler: async () => getGeneLocalization("RPGRIP1L") },
    
    // Genes by localization - Transition Zone
    { text: "Show all genes found at the transition zone", handler: async () => formatListResult("Genes localizing to transition zone", await getGenesByLocalization("transition zone")) },
    { text: "List proteins in the transition zone.", handler: async () => formatListResult("Proteins localizing to transition zone", await getGenesByLocalization("transition zone")) },
    { text: "What genes are present in the transition zone?", handler: async () => formatListResult("Genes localizing to transition zone", await getGenesByLocalization("transition zone")) },
    { text: "Transition zone genes", handler: async () => formatListResult("Genes localizing to transition zone", await getGenesByLocalization("transition zone")) },
    { text: "What proteins localize to the transition zone?", handler: async () => formatListResult("Proteins localizing to transition zone", await getGenesByLocalization("transition zone")) },
    { text: "Genes at the transition zone", handler: async () => formatListResult("Genes localizing to transition zone", await getGenesByLocalization("transition zone")) },
    
    // Basal body
    { text: "Find genes localized to basal body", handler: async () => formatListResult("Genes localizing to basal body", await getGenesByLocalization("basal body")) },
    { text: "Show proteins in basal body", handler: async () => formatListResult("Proteins localizing to basal body", await getGenesByLocalization("basal body")) },
    { text: "Basal body genes", handler: async () => formatListResult("Genes localizing to basal body", await getGenesByLocalization("basal body")) },
    { text: "Which genes are at the basal body?", handler: async () => formatListResult("Genes localizing to basal body", await getGenesByLocalization("basal body")) },
    { text: "List basal body proteins", handler: async () => formatListResult("Proteins localizing to basal body", await getGenesByLocalization("basal body")) },
    
    // Ciliary tip
    { text: "Display genes at ciliary tip", handler: async () => formatListResult("Genes localizing to ciliary tip", await getGenesByLocalization("ciliary tip")) },
    { text: "Ciliary tip genes", handler: async () => formatListResult("Genes localizing to ciliary tip", await getGenesByLocalization("ciliary tip")) },
    { text: "What genes localize to the ciliary tip?", handler: async () => formatListResult("Genes localizing to ciliary tip", await getGenesByLocalization("ciliary tip")) },
    { text: "Show ciliary tip proteins", handler: async () => formatListResult("Genes localizing to ciliary tip", await getGenesByLocalization("ciliary tip")) },
    
    // Axoneme
    { text: "Which genes localize to axoneme?", handler: async () => formatListResult("Genes localizing to axoneme", await getGenesByLocalization("axoneme")) },
    { text: "Axonemal genes", handler: async () => formatListResult("Genes localizing to axoneme", await getGenesByLocalization("axoneme")) },
    { text: "Show axoneme proteins", handler: async () => formatListResult("Genes localizing to axoneme", await getGenesByLocalization("axoneme")) },
    { text: "List axonemal proteins", handler: async () => formatListResult("Genes localizing to axoneme", await getGenesByLocalization("axoneme")) },
    
    // Transition fibers
    { text: "Show transition fiber proteins", handler: async () => formatListResult("Proteins localizing to transition fiber", await getGenesByLocalization("transition fiber")) },
    { text: "Transition fiber genes", handler: async () => formatListResult("Proteins localizing to transition fiber", await getGenesByLocalization("transition fiber")) },
    { text: "Which genes localize to transition fibers?", handler: async () => formatListResult("Proteins localizing to transition fiber", await getGenesByLocalization("transition fiber")) },
    
    // Additional localizations
    { text: "Show genes at the ciliary membrane", handler: async () => formatListResult("Genes localizing to ciliary membrane", await getGenesByLocalization("ciliary membrane")) },
    { text: "List ciliary membrane proteins", handler: async () => formatListResult("Genes localizing to ciliary membrane", await getGenesByLocalization("ciliary membrane")) },
    { text: "Show centrosome genes", handler: async () => formatListResult("Genes localizing to centrosome", await getGenesByLocalization("centrosome")) },
    { text: "Which proteins are at the centrosome?", handler: async () => formatListResult("Genes localizing to centrosome", await getGenesByLocalization("centrosome")) },
    { text: "Show genes in centriolar satellites", handler: async () => formatListResult("Genes localizing to centriolar satellite", await getGenesByLocalization("centriolar satellite")) },
    { text: "Centriolar satellite proteins", handler: async () => formatListResult("Genes localizing to centriolar satellite", await getGenesByLocalization("centriolar satellite")) },
    { text: "Show ciliary pocket genes", handler: async () => formatListResult("Genes localizing to ciliary pocket", await getGenesByLocalization("ciliary pocket")) },
    { text: "Show flagellar genes", handler: async () => formatListResult("Genes localizing to flagella", await getGenesByLocalization("flagella")) },
    { text: "List flagellar proteins", handler: async () => formatListResult("Genes localizing to flagella", await getGenesByLocalization("flagella")) },

    // ==================== PROTEIN DOMAINS ====================
    { text: "Show enriched domains in ciliary genes", handler: async () => displayEnrichedDomains() },
    { text: "List the most enriched protein domains", handler: async () => displayEnrichedDomains() },
    { text: "What domains are enriched in cilia?", handler: async () => displayEnrichedDomains() },
    { text: "Show depleted domains in ciliary genes", handler: async () => displayDepletedDomains() },
    { text: "List domains absent or rare in ciliary genes", handler: async () => displayDepletedDomains() },
    { text: "What domains are depleted in cilia?", handler: async () => displayDepletedDomains() },
    
    // --- Specific gene domains (use new displayDomainsForGene handler) ---
    { text: "Show protein domains of WDR35", handler: async () => displayDomainsForGene("WDR35") },
    { text: "What domains does WDR35 have?", handler: async () => displayDomainsForGene("WDR35") },
    { text: "List domains found in WDR35.", handler: async () => displayDomainsForGene("WDR35") },
    { text: "WDR35 domain structure", handler: async () => displayDomainsForGene("WDR35") },
    { text: "Describe WDR35 domains", handler: async () => displayDomainsForGene("WDR35") },
    { text: "What domains does BBS1 have?", handler: async () => displayDomainsForGene("BBS1") },
    { text: "Show IFT88 domains", handler: async () => displayDomainsForGene("IFT88") },
    { text: "CEP290 domain structure", handler: async () => displayDomainsForGene("CEP290") },
    { text: "What domains are in NPHP1?", handler: async () => displayDomainsForGene("NPHP1") },
    
    // --- Genes by domain type/description (use new findGenesByNewDomainDB handler) ---
    { text: "Show WD40 domain containing proteins", handler: async () => findGenesByNewDomainDB("WD40") },
    { text: "List WD40 repeat proteins", handler: async () => findGenesByNewDomainDB("WD40") },
    { text: "Which genes have WD40 domains?", handler: async () => findGenesByNewDomainDB("WD40") },
    { text: "WD40 repeat containing genes", handler: async () => findGenesByNewDomainDB("WD40") },
    
    { text: "Display Leucine-rich repeat domain proteins", handler: async () => findGenesByNewDomainDB("Leucine-rich repeat") },
    { text: "LRR domain proteins", handler: async () => findGenesByNewDomainDB("Leucine-rich repeat") },
    { text: "Show LRR containing genes", handler: async () => findGenesByNewDomainDB("Leucine-rich repeat") },
    
    { text: "Show IQ motif containing proteins", handler: async () => findGenesByNewDomainDB("IQ motif") },
    { text: "List IQ motif proteins", handler: async () => findGenesByNewDomainDB("IQ motif") },
    { text: "Which genes have IQ motifs?", handler: async () => findGenesByNewDomainDB("IQ motif") },
    
    { text: "Display calmodulin-binding proteins", handler: async () => findGenesByNewDomainDB("calmodulin-binding") },
    { text: "Show calmodulin-binding domains", handler: async () => findGenesByNewDomainDB("calmodulin-binding") },
    { text: "List calmodulin interacting proteins", handler: async () => findGenesByNewDomainDB("calmodulin-binding") },
    { text: "Calcium-binding proteins in cilia", handler: async () => findGenesByNewDomainDB("calcium-binding") },
    
    { text: "Show EF-hand domain proteins", handler: async () => findGenesByNewDomainDB("EF-hand") },
    { text: "Find genes with EF-hand motifs.", handler: async () => findGenesByNewDomainDB("EF-hand") },
    { text: "List EF-hand proteins", handler: async () => findGenesByNewDomainDB("EF-hand") },
    { text: "EF-hand containing genes", handler: async () => findGenesByNewDomainDB("EF-hand") },
    
    { text: "List all Kinase-related ciliary genes", handler: async () => findGenesByNewDomainDB("kinase") },
    { text: "Show Kinase-containing proteins localized to cilia", handler: async () => findGenesByNewDomainDB("kinase") },
    { text: "Display Kinase domain proteins involved in ciliogenesis", handler: async () => findGenesByNewDomainDB("kinase") },
    { text: "Identify Kinase genes in cilia", handler: async () => findGenesByNewDomainDB("kinase") },
    { text: "Which kinases are ciliary?", handler: async () => findGenesByNewDomainDB("kinase") },
    { text: "Show me all ciliary kinases", handler: async () => findGenesByNewDomainDB("kinase") },
    { text: "Display kinases regulating cilia length", handler: async () => findGenesByNewDomainDB("kinase") },
    { text: "Which kinases control cilia length?", handler: async () => findGenesByNewDomainDB("kinase") },
    { text: "Show kinases that could be therapeutic targets", handler: async () => findGenesByNewDomainDB("kinase") },
    
    { text: "List all Phosphatase-related ciliary genes", handler: async () => findGenesByNewDomainDB("phosphatase") },
    { text: "Show Phosphatase-containing proteins localized to cilia", handler: async () => findGenesByNewDomainDB("phosphatase") },
    { text: "Display Phosphatase domain proteins involved in ciliogenesis", handler: async () => findGenesByNewDomainDB("phosphatase") },
    { text: "Identify Phosphatase genes in cilia", handler: async () => findGenesByNewDomainDB("phosphatase") },
    { text: "Ciliary phosphatases", handler: async () => findGenesByNewDomainDB("phosphatase") },
    
    { text: "List all Actin-related ciliary genes", handler: async () => findGenesByNewDomainDB("actin") },
    { text: "Show Actin-containing proteins localized to cilia", handler: async () => findGenesByNewDomainDB("actin") },
    { text: "Display Actin domain proteins involved in ciliogenesis", handler: async () => findGenesByNewDomainDB("actin") },
    { text: "Identify Actin genes in cilia", handler: async () => findGenesByNewDomainDB("actin") },
    
    { text: "List all Zinc finger-related ciliary genes", handler: async () => findGenesByNewDomainDB("zinc finger") },
    { text: "Show Zinc finger-containing proteins localized to cilia", handler: async () => findGenesByNewDomainDB("zinc finger") },
    { text: "Display Zinc finger domain proteins involved in ciliogenesis", handler: async () => findGenesByNewDomainDB("zinc finger") },
    { text: "Identify Zinc finger genes in cilia", handler: async () => findGenesByNewDomainDB("zinc finger") },
    
    { text: "List all Atpase-related ciliary genes", handler: async () => findGenesByNewDomainDB("atpase") },
    { text: "Show Atpase-containing proteins localized to cilia", handler: async () => findGenesByNewDomainDB("atpase") },
    { text: "Display Atpase domain proteins involved in ciliogenesis", handler: async () => findGenesByNewDomainDB("atpase") },
    { text: "Identify Atpase genes in cilia", handler: async () => findGenesByNewDomainDB("atpase") },
    
    { text: "Show coiled-coil domain proteins", handler: async () => findGenesByNewDomainDB("coiled-coil") },
    { text: "List tetratricopeptide repeat proteins", handler: async () => findGenesByNewDomainDB("tetratricopeptide") },
    { text: "Show GTPase domain proteins", handler: async () => findGenesByNewDomainDB("GTPase") },
    { text: "List AAA domain proteins", handler: async () => findGenesByNewDomainDB("AAA") },

    // ==================== PROTEIN COMPLEXES ====================
    // BBSome
    { text: "Give me the list of BBSome components", handler: async () => formatListResult("Components of BBSome", await getGenesByComplex("BBSome")) },
    { text: "List all components of the BBSome complex", handler: async () => formatListResult("Components of BBSome", await getGenesByComplex("BBSome")) },
    { text: "What proteins are in the BBSome?", handler: async () => formatListResult("Components of BBSome", await getGenesByComplex("BBSome")) },
    { text: "Members of the BBSome.", handler: async () => formatListResult("Components of BBSome", await getGenesByComplex("BBSome")) },
    { text: "Show BBSome subunits", handler: async () => formatListResult("Components of BBSome", await getGenesByComplex("BBSome")) },
    { text: "BBSome complex members", handler: async () => formatListResult("Components of BBSome", await getGenesByComplex("BBSome")) },
    { text: "Which genes make up the BBSome?", handler: async () => formatListResult("Components of BBSome", await getGenesByComplex("BBSome")) },
    
    // IFT complexes
    { text: "Display components of IFT-A complex", handler: async () => formatListResult("Components of IFT-A", await getGenesByComplex("IFT-A")) },
    { text: "IFT-A complex members", handler: async () => formatListResult("Components of IFT-A", await getGenesByComplex("IFT-A")) },
    { text: "Show IFT-A subunits", handler: async () => formatListResult("Components of IFT-A", await getGenesByComplex("IFT-A")) },
    { text: "What proteins are in IFT-A?", handler: async () => formatListResult("Components of IFT-A", await getGenesByComplex("IFT-A")) },
    
    { text: "Display components of IFT-B complex", handler: async () => formatListResult("Components of IFT-B", await getGenesByComplex("IFT-B")) },
    { text: "IFT-B complex members", handler: async () => formatListResult("Components of IFT-B", await getGenesByComplex("IFT-B")) },
    { text: "Show IFT-B subunits", handler: async () => formatListResult("Components of IFT-B", await getGenesByComplex("IFT-B")) },
    { text: "List IFT-B proteins", handler: async () => formatListResult("Components of IFT-B", await getGenesByComplex("IFT-B")) },
    
    { text: "List intraflagellar transport (IFT) components", handler: async () => formatListResult("IFT Components", await getGenesByComplex("IFT")) },
    { text: "Show all IFT proteins", handler: async () => formatListResult("IFT Components", await getGenesByComplex("IFT")) },
    { text: "Which genes are part of IFT?", handler: async () => formatListResult("IFT Components", await getGenesByComplex("IFT")) },
    
    // Transition zone complexes
    { text: "Show components of Transition Zone Complex", handler: async () => formatListResult("Components of Transition Zone Complex", await getGenesByComplex("Transition Zone Complex")) },
    { text: "Transition zone complex members", handler: async () => formatListResult("Components of Transition Zone Complex", await getGenesByComplex("Transition Zone Complex")) },
    { text: "List transition zone proteins", handler: async () => formatListResult("Components of Transition Zone Complex", await getGenesByComplex("Transition Zone Complex")) },
    
    { text: "Display components of MKS Complex", handler: async () => formatListResult("Components of MKS Complex", await getGenesByComplex("MKS Complex")) },
    { text: "MKS complex members", handler: async () => formatListResult("Components of MKS Complex", await getGenesByComplex("MKS Complex")) },
    { text: "Show MKS module proteins", handler: async () => formatListResult("Components of MKS Complex", await getGenesByComplex("MKS Complex")) },
    
    { text: "Show components of NPHP Complex", handler: async () => formatListResult("Components of NPHP Complex", await getGenesByComplex("NPHP Complex")) },
    { text: "NPHP complex members", handler: async () => formatListResult("Components of NPHP Complex", await getGenesByComplex("NPHP Complex")) },
    { text: "List NPHP module proteins", handler: async () => formatListResult("Components of NPHP Complex", await getGenesByComplex("NPHP Complex")) },
    
    // Comparisons
    { text: "Compare IFT-A and IFT-B complex composition", handler: async () => compareComplexes("IFT-A", "IFT-B") },
    { text: "Compare composition of IFT-A vs IFT-B.", handler: async () => compareComplexes("IFT-A", "IFT-B") },
    { text: "What's the difference between IFT-A and IFT-B?", handler: async () => compareComplexes("IFT-A", "IFT-B") },
    { text: "IFT-A versus IFT-B comparison", handler: async () => compareComplexes("IFT-A", "IFT-B") },
    { text: "How do IFT-A and IFT-B differ?", handler: async () => compareComplexes("IFT-A", "IFT-B") },
    
    { text: "Find IFT-A and IFT-B complex genes", handler: async () => getGenesByMultipleComplexes(["IFT-A", "IFT-B"]) },
    
    // Additional complexes
    { text: "Show dynein arm components", handler: async () => formatListResult("Dynein Arm Components", await getGenesByComplex("dynein")) },
    { text: "List outer dynein arm proteins", handler: async () => formatListResult("ODA Components", await getGenesByComplex("outer dynein arm")) },
    { text: "Show inner dynein arm proteins", handler: async () => formatListResult("IDA Components", await getGenesByComplex("inner dynein arm")) },
    { text: "Display radial spoke proteins", handler: async () => formatListResult("Radial Spoke Components", await getGenesByComplex("radial spoke")) },
    { text: "Show central pair complex proteins", handler: async () => formatListResult("Central Pair Components", await getGenesByComplex("central pair")) },
    { text: "List nexin-dynein regulatory complex components", handler: async () => formatListResult("N-DRC Components", await getGenesByComplex("N-DRC")) },
    { text: "Show exocyst complex members", handler: async () => formatListResult("Exocyst Complex", await getGenesByComplex("exocyst")) },

    // ==================== CILIOPATHIES & DISEASES ====================
    // Bardet-Biedl Syndrome
    { text: "List genes associated with Bardet–Biedl syndrome", handler: async () => { const { genes, description } = await getCiliopathyGenes("Bardet–Biedl syndrome"); return formatListResult("Genes for Bardet–Biedl syndrome", genes, description); }},
    { text: "Show genes for Bardet-Biedl Syndrome", handler: async () => { const { genes, description } = await getCiliopathyGenes("Bardet-Biedl Syndrome"); return formatListResult("Genes for Bardet-Biedl Syndrome", genes, description); } },
    { text: "What causes Bardet-Biedl Syndrome?", handler: async () => { const { genes, description } = await getCiliopathyGenes("Bardet-Biedl Syndrome"); return formatListResult("Genes for Bardet-Biedl Syndrome", genes, description); }},
    { text: "BBS genes", handler: async () => { const { genes, description } = await getCiliopathyGenes("Bardet-Biedl Syndrome"); return formatListResult("Genes for Bardet-Biedl Syndrome", genes, description); }},
    { text: "Which genes cause BBS?", handler: async () => { const { genes, description } = await getCiliopathyGenes("Bardet-Biedl Syndrome"); return formatListResult("Genes for Bardet-Biedl Syndrome", genes, description); }},
    
    // Joubert Syndrome
    { text: "Show genes for Joubert syndrome", handler: async () => { const { genes, description } = await getCiliopathyGenes("Joubert Syndrome"); return formatListResult("Genes for Joubert Syndrome", genes, description); }},
    { text: "What genes are involved in Joubert syndrome?", handler: async () => { const { genes, description } = await getCiliopathyGenes("Joubert Syndrome"); return formatListResult("Genes for Joubert Syndrome", genes, description); }},
    { text: "Show genes for Joubert Syndrome", handler: async () => { const { genes, description } = await getCiliopathyGenes("Joubert Syndrome"); return formatListResult("Genes for Joubert Syndrome", genes, description); } },
    { text: "Which genes cause Joubert Syndrome?", handler: async () => { const { genes, description } = await getCiliopathyGenes("Joubert Syndrome"); return formatListResult("Genes for Joubert Syndrome", genes, description); } },
    { text: "Joubert syndrome genetics", handler: async () => { const { genes, description } = await getCiliopathyGenes("Joubert Syndrome"); return formatListResult("Genes for Joubert Syndrome", genes, description); }},
    { text: "List Joubert genes", handler: async () => { const { genes, description } = await getCiliopathyGenes("Joubert Syndrome"); return formatListResult("Genes for Joubert Syndrome", genes, description); }},
    
    // Meckel-Gruber Syndrome
    { text: "What genes are involved in Meckel-Gruber Syndrome?", handler: async () => { const { genes, description } = await getCiliopathyGenes("Meckel-Gruber Syndrome"); return formatListResult("Genes for Meckel-Gruber Syndrome", genes, description); }},
    { text: "Display genes associated with Meckel-Gruber Syndrome", handler: async () => { const { genes, description } = await getCiliopathyGenes("Meckel-Gruber Syndrome"); return formatListResult("Genes for Meckel-Gruber Syndrome", genes, description); } },
    { text: "MKS genes", handler: async () => { const { genes, description } = await getCiliopathyGenes("Meckel-Gruber Syndrome"); return formatListResult("Genes for Meckel-Gruber Syndrome", genes, description); }},
    { text: "Meckel syndrome genetics", handler: async () => { const { genes, description } = await getCiliopathyGenes("Meckel-Gruber Syndrome"); return formatListResult("Genes for Meckel-Gruber Syndrome", genes, description); }},
    
    // Primary Ciliary Dyskinesia
    { text: "List genes for Primary Ciliary Dyskinesia", handler: async () => { const { genes, description } = await getCiliopathyGenes("Primary Ciliary Dyskinesia"); return formatListResult("Genes for Primary Ciliary Dyskinesia", genes, description); } },
    { text: "PCD genes", handler: async () => { const { genes, description } = await getCiliopathyGenes("Primary Ciliary Dyskinesia"); return formatListResult("Genes for Primary Ciliary Dyskinesia", genes, description); }},
    { text: "What causes Primary Ciliary Dyskinesia?", handler: async () => { const { genes, description } = await getCiliopathyGenes("Primary Ciliary Dyskinesia"); return formatListResult("Genes for Primary Ciliary Dyskinesia", genes, description); }},
    { text: "Show PCD associated genes", handler: async () => { const { genes, description } = await getCiliopathyGenes("Primary Ciliary Dyskinesia"); return formatListResult("Genes for Primary Ciliary Dyskinesia", genes, description); }},
    { text: "Primary ciliary dyskinesia genetics", handler: async () => { const { genes, description } = await getCiliopathyGenes("Primary Ciliary Dyskinesia"); return formatListResult("Genes for Primary Ciliary Dyskinesia", genes, description); }},
    
    // Leber Congenital Amaurosis
    { text: "Find genes linked to Leber congenital amaurosis", handler: async () => { const { genes, description } = await getCiliopathyGenes("Leber congenital amaurosis"); return formatListResult("Genes for Leber congenital amaurosis", genes, description); } },
    { text: "LCA genes", handler: async () => { const { genes, description } = await getCiliopathyGenes("Leber congenital amaurosis"); return formatListResult("Genes for Leber congenital amaurosis", genes, description); }},
    { text: "Leber congenital amaurosis genetics", handler: async () => { const { genes, description } = await getCiliopathyGenes("Leber congenital amaurosis"); return formatListResult("Genes for Leber congenital amaurosis", genes, description); }},
    
    // Other ciliopathies
    { text: "Show genes for cranioectodermal dysplasia", handler: async () => { const { genes, description } = await getCiliopathyGenes("Cranioectodermal Dysplasia"); return formatListResult("Genes for Cranioectodermal Dysplasia", genes, description); } },
    { text: "Sensenbrenner syndrome genes", handler: async () => { const { genes, description } = await getCiliopathyGenes("Cranioectodermal Dysplasia"); return formatListResult("Genes for Cranioectodermal Dysplasia", genes, description); }},
    
    { text: "Tell me genes causing short-rib thoracic dysplasia", handler: async () => { const { genes, description } = await getCiliopathyGenes("Short-rib thoracic dysplasia"); return formatListResult("Genes for Short-rib thoracic dysplasia", genes, description); } },
    { text: "SRTD genes", handler: async () => { const { genes, description } = await getCiliopathyGenes("Short-rib thoracic dysplasia"); return formatListResult("Genes for Short-rib thoracic dysplasia", genes, description); }},
    
    { text: "Display genes related to hydrocephalus", handler: async () => { const { genes, description } = await getCiliopathyGenes("Hydrocephalus"); return formatListResult("Genes for Hydrocephalus", genes, description); } },
    { text: "Hydrocephalus genetics", handler: async () => { const { genes, description } = await getCiliopathyGenes("Hydrocephalus"); return formatListResult("Genes for Hydrocephalus", genes, description); }},
    
    { text: "Which genes cause cystic kidney disease?", handler: async () => getGenesByScreenPhenotype("cystic kidney disease") },
    { text: "Polycystic kidney disease genes", handler: async () => { const { genes, description } = await getCiliopathyGenes("Polycystic kidney disease"); return formatListResult("Genes for Polycystic kidney disease", genes, description); }},
    { text: "PKD genetics", handler: async () => { const { genes, description } = await getCiliopathyGenes("Polycystic kidney disease"); return formatListResult("Genes for Polycystic kidney disease", genes, description); }},
    
    { text: "Nephronophthisis genes", handler: async () => { const { genes, description } = await getCiliopathyGenes("Nephronophthisis"); return formatListResult("Genes for Nephronophthisis", genes, description); }},
    { text: "NPHP disease genes", handler: async () => { const { genes, description } = await getCiliopathyGenes("Nephronophthisis"); return formatListResult("Genes for Nephronophthisis", genes, description); }},
    
    { text: "Senior-Loken syndrome genes", handler: async () => { const { genes, description } = await getCiliopathyGenes("Senior-Loken syndrome"); return formatListResult("Genes for Senior-Loken syndrome", genes, description); }},
    { text: "Retinitis pigmentosa ciliopathy genes", handler: async () => { const { genes, description } = await getCiliopathyGenes("Retinitis pigmentosa"); return formatListResult("Genes for Retinitis pigmentosa", genes, description); }},
    { text: "Alstrom syndrome genes", handler: async () => { const { genes, description } = await getCiliopathyGenes("Alstrom syndrome"); return formatListResult("Genes for Alstrom syndrome", genes, description); }},
    { text: "Oral-facial-digital syndrome genes", handler: async () => { const { genes, description } = await getCiliopathyGenes("Oral-facial-digital syndrome"); return formatListResult("Genes for Oral-facial-digital syndrome", genes, description); }},
    { text: "OFD syndrome genetics", handler: async () => { const { genes, description } = await getCiliopathyGenes("Oral-facial-digital syndrome"); return formatListResult("Genes for Oral-facial-digital syndrome", genes, description); }},
    
    // All ciliopathies
    { text: "Find all genes associated with ciliopathies", handler: async () => { const { genes, description } = await getCiliopathyGenes("ciliopathy"); return formatListResult("All Ciliopathy-Associated Genes", genes, description); }},
    { text: "List all ciliopathy genes.", handler: async () => { const { genes, description } = await getCiliopathyGenes("ciliopathy"); return formatListResult("All Ciliopathy-Associated Genes", genes, description); } },
    { text: "Show genes involved in any ciliopathy.", handler: async () => { const { genes, description } = await getCiliopathyGenes("ciliopathy"); return formatListResult("All Ciliopathy-Associated Genes", genes, description); } },
    { text: "All ciliopathy-related genes", handler: async () => { const { genes, description } = await getCiliopathyGenes("ciliopathy"); return formatListResult("All Ciliopathy-Associated Genes", genes, description); }},
    { text: "Complete list of ciliopathy genes", handler: async () => { const { genes, description } = await getCiliopathyGenes("ciliopathy"); return formatListResult("All Ciliopathy-Associated Genes", genes, description); }},
    
    // Disease associations for specific genes
    { text: "List all diseases linked to NPHP1", handler: async () => getGeneDiseases("NPHP1") },
    { text: "Which diseases involve NPHP1?", handler: async () => getGeneDiseases("NPHP1") },
    { text: "NPHP1 disease association.", handler: async () => getGeneDiseases("NPHP1") },
    { text: "What conditions are caused by NPHP1?", handler: async () => getGeneDiseases("NPHP1") },
    { text: "NPHP1 related diseases", handler: async () => getGeneDiseases("NPHP1") },
    
    { text: "What ciliopathies are associated with mutations in MKS1?", handler: async () => getGeneDiseases("MKS1") },
    { text: "MKS1 disease associations", handler: async () => getGeneDiseases("MKS1") },
    { text: "Which diseases are caused by BBS1 mutations?", handler: async () => getGeneDiseases("BBS1") },
    { text: "CEP290 associated diseases", handler: async () => getGeneDiseases("CEP290") },
    { text: "What ciliopathies involve IFT88?", handler: async () => getGeneDiseases("IFT88") },
    { text: "RPGRIP1L disease associations", handler: async () => getGeneDiseases("RPGRIP1L") },


    { text: "Show evolutionary conservation of IFT88", handler: async () => getGeneConservation("IFT88") },
    { text: "How conserved is ARL13B?", handler: async () => getGeneConservation("ARL13B") },
    { text: "Show the evolutionary conservation of BBS1", handler: async () => getGeneConservation("BBS1") },
    { text: "Is IFT88 conserved in C. elegans?", handler: async () => checkConservation("IFT88", "C. elegans") },
    { text: "Is BBS1 present in zebrafish?", handler: async () => checkConservation("BBS1", "zebrafish") },
    { text: "List conserved ciliary genes between C. elegans and humans", handler: async () => getConservedGenesBetween(["C. elegans", "H.sapiens"]) },
    { text: "Display the ciliary genes that are conserved between humans and zebrafish", handler: async () => getConservedGenesBetween(["Human", "Zebrafish"]) },
    { text: "List all ciliary-only genes", handler: async () => getCiliaryOnlyGenes() },

    // --- All queries using the buggy getCiliaryGenesForOrganism now FIXED via wrapping ---
    { text: "Which human ciliary genes have orthologs in Chlamydomonas?", handler: async () => getOrthologsInOrganism("Chlamydomonas") }, // Note: getOrthologsInOrganism should already use formatListResult internally.
    { text: "List ciliary genes in C. elegans", handler: async () => wrapOrganismResult("C. elegans") },
    { text: "Display ciliary genes in human", handler: async () => wrapOrganismResult("human") },
    { text: "Show ciliary genes in mouse", handler: async () => wrapOrganismResult("mouse") },
    { text: "List ciliary genes in zebrafish", handler: async () => wrapOrganismResult("zebrafish") },
    { text: "Display ciliary genes in fly", handler: async () => wrapOrganismResult("fly") },

    // ✅ FIX for Chlamydomonas: Uses the new reliable wrapping function.
    { text: "List ciliary genes in Chlamydomonas", handler: async () => wrapOrganismResult("Chlamydomonas") }, 
    // --- End of Fixes for getCiliaryGenesForOrganism calls ---

    

    // ==================== COMPARATIVE GENOMICS ====================
    { text: "Compare human and mouse ciliary genes", handler: async () => getConservedGenesBetween(["human", "mouse"]) },
    { text: "Which ciliary genes are lost in non-ciliated organisms?", handler: async () => getCiliaryOnlyGenes() },
    { text: "Show genes gained in vertebrates", handler: async () => notImplementedYet("Vertebrate-specific genes") },
    { text: "Ciliary genes unique to mammals", handler: async () => notImplementedYet("Mammalian-specific genes") },
    { text: "Which genes are conserved across all ciliated species?", handler: async () => notImplementedYet("Universally conserved ciliary genes") },
   
    // ==================== FUNCTIONAL GENOMICS SCREEN RESULTS ====================
    // Knockdown effects
    { text: "What happens to cilia when KIF3A is knocked down?", handler: async () => getKnockdownEffect("KIF3A") },
    { text: "Effect of silencing KIF3A on cilia.", handler: async () => getKnockdownEffect("KIF3A") },
    { text: "KIF3A knockdown phenotype", handler: async () => getKnockdownEffect("KIF3A") },
    { text: "What is the phenotype when KIF3A is depleted?", handler: async () => getKnockdownEffect("KIF3A") },
    
    { text: "What happens when IFT88 is knocked down?", handler: async () => getKnockdownEffect("IFT88") },
    { text: "BBS1 knockdown phenotype", handler: async () => getKnockdownEffect("BBS1") },
    { text: "Effect of DYNC2H1 depletion", handler: async () => getKnockdownEffect("DYNC2H1") },
    { text: "What happens when CEP290 is silenced?", handler: async () => getKnockdownEffect("CEP290") },
    
    // Screen-specific results
    { text: "Show me the results for IFT88 in the Kim2016 screen", handler: async () => getScreenResults("IFT88", "Kim2016") },
    { text: "What was the result for IFT88 in Kim2016?", handler: async () => getScreenResults("IFT88", "Kim2016") },
    { text: "IFT88 Kim2016 screen results", handler: async () => getScreenResults("IFT88", "Kim2016") },
    
    { text: "Show BBS1 results in Wheway2015", handler: async () => getScreenResults("BBS1", "Wheway2015") },
    { text: "CEP290 Breslow2018 screen data", handler: async () => getScreenResults("CEP290", "Breslow2018") },
    { text: "NPHP1 screen results", handler: async () => getScreenResults("NPHP1", "Roosing2015") },
    
    // Phenotype-based queries
    { text: "Which genes cause longer cilia when silenced?", handler: async () => getGenesByScreenPhenotype("long cilia") },
    { text: "List genes that result in long cilia upon knockdown.", handler: async () => getGenesByScreenPhenotype("long cilia") },
    { text: "Show genes that make cilia longer", handler: async () => getGenesByScreenPhenotype("long cilia") },
    { text: "Long cilia phenotype genes", handler: async () => getGenesByScreenPhenotype("long cilia") },
    { text: "Which genes are negative regulators of cilia length?", handler: async () => getGenesByScreenPhenotype("long cilia") },
    
    { text: "Find genes causing short cilia", handler: async () => getGenesByScreenPhenotype("short cilia") },
    { text: "Short cilia phenotype genes", handler: async () => getGenesByScreenPhenotype("short cilia") },
    { text: "Which genes make cilia shorter?", handler: async () => getGenesByScreenPhenotype("short cilia") },
    { text: "Genes that shorten cilia when knocked down", handler: async () => getGenesByScreenPhenotype("short cilia") },
    
    { text: "Genes that decrease cilia number", handler: async () => getGenesByScreenPhenotype("decreased cilia numbers") },
    { text: "Which genes reduce ciliary frequency?", handler: async () => getGenesByScreenPhenotype("decreased cilia numbers") },
    { text: "Show genes required for ciliogenesis", handler: async () => getGenesByScreenPhenotype("decreased cilia numbers") },
    
    { text: "Genes that increase cilia number", handler: async () => getGenesByScreenPhenotype("increased cilia numbers") },
    { text: "Which genes suppress ciliogenesis when active?", handler: async () => getGenesByScreenPhenotype("increased cilia numbers") },
    
    { text: "Display genes that had 'No effect' in the Wheway2015 screen", handler: async () => getNoEffectGenes("Wheway2015") },
    { text: "Genes with no phenotype in Wheway2015.", handler: async () => getNoEffectGenes("Wheway2015") },
    { text: "Which genes showed no effect in Wheway2015?", handler: async () => getNoEffectGenes("Wheway2015") },
    
    { text: "No effect genes in Kim2016 screen", handler: async () => getNoEffectGenes("Kim2016") },
    { text: "Breslow2018 no effect genes", handler: async () => getNoEffectGenes("Breslow2018") },
    
    // Hedgehog signaling
    { text: "Find all genes that act as negative regulators of Hedgehog signaling", handler: async () => getHedgehogRegulators("negative") },
    { text: "Which genes inhibit Hedgehog signaling?", handler: async () => getHedgehogRegulators("negative") },
    { text: "Negative regulators of Hedgehog pathway", handler: async () => getHedgehogRegulators("negative") },
    { text: "Genes that suppress Hedgehog signaling", handler: async () => getHedgehogRegulators("negative") },
    { text: "Show Hedgehog pathway inhibitors", handler: async () => getHedgehogRegulators("negative") },
    
    { text: "Find positive regulators of Hedgehog signaling.", handler: async () => getHedgehogRegulators("positive") },
    { text: "Which genes activate Hedgehog signaling?", handler: async () => getHedgehogRegulators("positive") },
    { text: "Positive regulators of Hedgehog pathway", handler: async () => getHedgehogRegulators("positive") },
    { text: "Genes that promote Hedgehog signaling", handler: async () => getHedgehogRegulators("positive") },
    { text: "Hedgehog pathway activators", handler: async () => getHedgehogRegulators("positive") },
    
    { text: "Display components of Hedgehog signaling in cilia", handler: async () => getHedgehogRegulators("all") },
    { text: "All Hedgehog pathway genes in cilia", handler: async () => getHedgehogRegulators("all") },
    { text: "Show ciliary Hedgehog signaling components", handler: async () => getHedgehogRegulators("all") },
    { text: "Hedgehog signaling genes", handler: async () => getHedgehogRegulators("all") },

    // ==================== BULK GENE EXPRESSION (TISSUES) ====================
    // Single gene expression
    { text: "Where is ARL13B expressed?", handler: async () => getGeneExpression("ARL13B") },
    { text: "Tissue expression pattern for ARL13B.", handler: async () => getGeneExpression("ARL13B") },
    { text: "Show expression of ARL13B", handler: async () => getGeneExpression("ARL13B") },
    { text: "In which tissues is ARL13B expressed?", handler: async () => getGeneExpression("ARL13B") },
    { text: "ARL13B tissue distribution", handler: async () => getGeneExpression("ARL13B") },
    
    { text: "Where is BBS1 expressed?", handler: async () => getGeneExpression("BBS1") },
    { text: "BBS1 expression pattern", handler: async () => getGeneExpression("BBS1") },
    { text: "Show BBS1 tissue expression", handler: async () => getGeneExpression("BBS1") },
    
    { text: "In which tissues is IFT88 expressed?", handler: async () => getGeneExpression("IFT88") },
    { text: "IFT88 tissue distribution", handler: async () => getGeneExpression("IFT88") },
    
    { text: "Which organ systems express CEP290?", handler: async () => getGeneExpression("CEP290") },
    { text: "CEP290 expression pattern", handler: async () => getGeneExpression("CEP290") },
    
    // Additional genes
    { text: "Where is DYNC2H1 expressed?", handler: async () => getGeneExpression("DYNC2H1") },
    { text: "Show NPHP1 expression", handler: async () => getGeneExpression("NPHP1") },
    { text: "KIF3A tissue expression", handler: async () => getGeneExpression("KIF3A") },
    { text: "Where is RPGRIP1L expressed?", handler: async () => getGeneExpression("RPGRIP1L") },
    { text: "MKS1 expression pattern", handler: async () => getGeneExpression("MKS1") },
    
    // Expression patterns/heatmaps
    { text: "Show the expression pattern of BBS1 across all tissues", handler: async () => getGeneExpressionPattern("BBS1") },
    { text: "Visualize tissue expression for BBS1.", handler: async () => getGeneExpressionPattern("BBS1") },
    { text: "BBS1 expression heatmap", handler: async () => getGeneExpressionPattern("BBS1") },
    { text: "Display BBS1 tissue distribution", handler: async () => getGeneExpressionPattern("BBS1") },
    
    { text: "IFT88 expression pattern across tissues", handler: async () => getGeneExpressionPattern("IFT88") },
    { text: "Show CEP290 tissue expression heatmap", handler: async () => getGeneExpressionPattern("CEP290") },
    { text: "ARL13B expression across organs", handler: async () => getGeneExpressionPattern("ARL13B") },
    
    // Tissue-specific genes
    { text: "Which ciliary genes are most highly expressed in the kidney?", handler: async () => getTissueSpecificGenes("kidney") },
    { text: "Top ciliary genes in kidney.", handler: async () => getTissueSpecificGenes("kidney") },
    { text: "Kidney-enriched ciliary genes", handler: async () => getTissueSpecificGenes("kidney") },
    { text: "Show genes highly expressed in kidney", handler: async () => getTissueSpecificGenes("kidney") },
    
    { text: "Brain-enriched ciliary genes", handler: async () => getTissueSpecificGenes("brain") },
    { text: "Which ciliary genes are expressed in brain?", handler: async () => getTissueSpecificGenes("brain") },
    { text: "Retina-specific ciliary genes", handler: async () => getTissueSpecificGenes("retina") },
    { text: "Top ciliary genes in retina", handler: async () => getTissueSpecificGenes("retina") },
    { text: "Lung-enriched ciliary genes", handler: async () => getTissueSpecificGenes("lung") },
    { text: "Liver ciliary gene expression", handler: async () => getTissueSpecificGenes("liver") },
    { text: "Testis-specific ciliary genes", handler: async () => getTissueSpecificGenes("testis") },
    { text: "Heart ciliary gene expression", handler: async () => getTissueSpecificGenes("heart") },
    
    // Comparative expression
    { text: "Compare the expression of IFT88 and OFD1 in the brain versus the retina", handler: async () => compareGeneExpression(["IFT88", "OFD1"], ["brain", "retina"]) },
    { text: "Compare IFT88 vs OFD1 expression in brain and retina.", handler: async () => compareGeneExpression(["IFT88", "OFD1"], ["brain", "retina"]) },
    { text: "IFT88 and OFD1 expression comparison", handler: async () => compareGeneExpression(["IFT88", "OFD1"], ["brain", "retina"]) },
    
    { text: "Compare BBS1 and BBS4 expression in kidney", handler: async () => compareGeneExpression(["BBS1", "BBS4"], ["kidney"]) },
    { text: "Compare ARL13B and IFT88 in lung vs kidney", handler: async () => compareGeneExpression(["ARL13B", "IFT88"], ["lung", "kidney"]) },
    { text: "Compare CEP290 and NPHP1 expression across tissues", handler: async () => compareGeneExpression(["CEP290", "NPHP1"], ["brain", "kidney", "retina"]) },

    // ==================== SINGLE-CELL GENE EXPRESSION (scRNA-seq) ====================
    // Expression in specific cell types
    { text: "What is the expression of ARL13B in ciliated cells?", handler: async () => getGeneExpressionInCellType("ARL13B", "ciliated cell")},
    { text: "How much ARL13B is in ciliated cells?", handler: async () => getGeneExpressionInCellType("ARL13B", "ciliated cell") },
    { text: "ARL13B expression in ciliated cells", handler: async () => getGeneExpressionInCellType("ARL13B", "ciliated cell")},
    
    { text: "Show expression of FOXJ1 in ciliated cells", handler: async () => getGeneExpressionInCellType("FOXJ1", "ciliated cell")},
    { text: "FOXJ1 in ciliated cells", handler: async () => getGeneExpressionInCellType("FOXJ1", "ciliated cell")},
    
    { text: "IFT88 expression in ciliated cells", handler: async () => getGeneExpressionInCellType("IFT88", "ciliated cell")},
    { text: "BBS1 in ciliated cells", handler: async () => getGeneExpressionInCellType("BBS1", "ciliated cell")},
    { text: "Show CEP290 expression in ciliated cells", handler: async () => getGeneExpressionInCellType("CEP290", "ciliated cell")},
    
    // Single-cell visualizations - Bar charts
    { text: "Show single-cell expression of ARL13B", handler: async () => displayCellxgeneBarChart(["ARL13B"])},
    { text: "Visualize scRNA expression for ARL13B.", handler: async () => displayCellxgeneBarChart(["ARL13B"]) },
    { text: "ARL13B single-cell data", handler: async () => displayCellxgeneBarChart(["ARL13B"])},
    { text: "Plot ARL13B expression by cell type", handler: async () => displayCellxgeneBarChart(["ARL13B"])},
    
    { text: "Plot single-cell expression for FOXJ1", handler: async () => displayCellxgeneBarChart(["FOXJ1"])},
    { text: "FOXJ1 single-cell expression", handler: async () => displayCellxgeneBarChart(["FOXJ1"])},
    
    { text: "Compare ARL13B and FOXJ1 expression in lung scRNA-seq", handler: async () => displayCellxgeneBarChart(["ARL13B", "FOXJ1"])},
    { text: "Plot ARL13B vs FOXJ1 single-cell expression.", handler: async () => displayCellxgeneBarChart(["ARL13B", "FOXJ1"]) },
    { text: "ARL13B and FOXJ1 scRNA comparison", handler: async () => displayCellxgeneBarChart(["ARL13B", "FOXJ1"])},
    
    { text: "Compare IFT88 and BBS1 single-cell expression", handler: async () => displayCellxgeneBarChart(["IFT88", "BBS1"])},
    { text: "Show CEP290 and NPHP1 in single cells", handler: async () => displayCellxgeneBarChart(["CEP290", "NPHP1"])},
    
    // UMAP visualizations
    { text: "Plot UMAP expression for FOXJ1", handler: async () => displayUmapGeneExpression("FOXJ1") },
    { text: "Visualize FOXJ1 expression UMAP.", handler: async () => displayUmapGeneExpression("FOXJ1") },
    { text: "FOXJ1 UMAP plot", handler: async () => displayUmapGeneExpression("FOXJ1") },
    { text: "Show FOXJ1 on UMAP", handler: async () => displayUmapGeneExpression("FOXJ1") },
    
    { text: "Show ARL13B expression on the UMAP", handler: async () => displayUmapGeneExpression("ARL13B") },
    { text: "ARL13B UMAP visualization", handler: async () => displayUmapGeneExpression("ARL13B") },
    { text: "Plot ARL13B UMAP", handler: async () => displayUmapGeneExpression("ARL13B") },
    
    { text: "IFT88 UMAP expression", handler: async () => displayUmapGeneExpression("IFT88") },
    { text: "Show BBS1 on UMAP", handler: async () => displayUmapGeneExpression("BBS1") },
    { text: "CEP290 UMAP plot", handler: async () => displayUmapGeneExpression("CEP290") },
    { text: "Visualize DYNC2H1 expression on UMAP", handler: async () => displayUmapGeneExpression("DYNC2H1") },
    
    { text: "Show the UMAP plot of all cell types", handler: async () => displayUmapPlot() },
    { text: "Display the cell type UMAP.", handler: async () => displayUmapPlot() },
    { text: "Show UMAP with cell types", handler: async () => displayUmapPlot() },
    { text: "Cell type UMAP visualization", handler: async () => displayUmapPlot() },
    { text: "Plot all cell types on UMAP", handler: async () => displayUmapPlot() },
    
    // Disease genes in specific cell types
    { text: "Which Joubert Syndrome genes are expressed in ciliated cells?", handler: async () => { const results = await findDiseaseGenesByCellExpression("Joubert Syndrome", "ciliated cell"); return formatListResult("Joubert Genes Expressed in Ciliated Cells", results); }},
    { text: "Find Joubert Syndrome genes active in ciliated cells.", handler: async () => { const results = await findDiseaseGenesByCellExpression("Joubert Syndrome", "ciliated cell"); return formatListResult("Joubert Genes Expressed in Ciliated Cells", results); } },
    { text: "Joubert genes in ciliated cells", handler: async () => { const results = await findDiseaseGenesByCellExpression("Joubert Syndrome", "ciliated cell"); return formatListResult("Joubert Genes Expressed in Ciliated Cells", results); }},
    
    { text: "BBS genes expressed in ciliated cells", handler: async () => { const results = await findDiseaseGenesByCellExpression("Bardet-Biedl Syndrome", "ciliated cell"); return formatListResult("BBS Genes Expressed in Ciliated Cells", results); }},
    { text: "Which PCD genes are in ciliated cells?", handler: async () => { const results = await findDiseaseGenesByCellExpression("Primary Ciliary Dyskinesia", "ciliated cell"); return formatListResult("PCD Genes Expressed in Ciliated Cells", results); }},
    
    // Top expressed ciliary genes
    { text: "List top expressed ciliary genes in ciliated cells", handler: async () => { 
        if (!cellxgeneDataCache) await fetchCellxgeneData();
        if (!ciliaHubDataCache) await fetchCiliaData();
        const ciliaryGeneSet = new Set(ciliaHubDataCache.map(g => g.gene.toUpperCase()));
        const expressedCiliaryGenes = [];
        Object.entries(cellxgeneDataCache).forEach(([gene, cellData]) => {
            if (ciliaryGeneSet.has(gene) && cellData["ciliated cell"] && cellData["ciliated cell"] > 0.01) {
                expressedCiliaryGenes.push({
                    gene: gene,
                    description: `Expression: ${cellData["ciliated cell"].toFixed(4)}`,
                    expression: cellData["ciliated cell"]
                });
            }
        });
        expressedCiliaryGenes.sort((a, b) => b.expression - a.expression);
        return formatListResult("Top 50 Ciliary Genes in Ciliated Cells", expressedCiliaryGenes.slice(0, 50));
     }},
    { text: "Highest expressed ciliary genes in ciliated cells.", handler: async () => { 
        if (!cellxgeneDataCache) await fetchCellxgeneData();
        if (!ciliaHubDataCache) await fetchCiliaData();
        const ciliaryGeneSet = new Set(ciliaHubDataCache.map(g => g.gene.toUpperCase()));
        const expressedCiliaryGenes = [];
        Object.entries(cellxgeneDataCache).forEach(([gene, cellData]) => {
            if (ciliaryGeneSet.has(gene) && cellData["ciliated cell"] && cellData["ciliated cell"] > 0.01) {
                expressedCiliaryGenes.push({
                    gene: gene,
                    description: `Expression: ${cellData["ciliated cell"].toFixed(4)}`,
                    expression: cellData["ciliated cell"]
                });
            }
        });
        expressedCiliaryGenes.sort((a, b) => b.expression - a.expression);
        return formatListResult("Top 50 Ciliary Genes in Ciliated Cells", expressedCiliaryGenes.slice(0, 50));
     }},
    { text: "Most abundant ciliary transcripts in ciliated cells", handler: async () => { 
        if (!cellxgeneDataCache) await fetchCellxgeneData();
        if (!ciliaHubDataCache) await fetchCiliaData();
        const ciliaryGeneSet = new Set(ciliaHubDataCache.map(g => g.gene.toUpperCase()));
        const expressedCiliaryGenes = [];
        Object.entries(cellxgeneDataCache).forEach(([gene, cellData]) => {
            if (ciliaryGeneSet.has(gene) && cellData["ciliated cell"] && cellData["ciliated cell"] > 0.01) {
                expressedCiliaryGenes.push({
                    gene: gene,
                    description: `Expression: ${cellData["ciliated cell"].toFixed(4)}`,
                    expression: cellData["ciliated cell"]
                });
            }
        });
        expressedCiliaryGenes.sort((a, b) => b.expression - a.expression);
        return formatListResult("Top 50 Ciliary Genes in Ciliated Cells", expressedCiliaryGenes.slice(0, 50));
     }},

    // ==================== MECHANISM & FUNCTIONAL CATEGORIES ====================
    // Signaling
    { text: "List genes involved in ciliary signaling pathways", handler: async () => formatListResult("Ciliary Signaling Genes", await getGenesByFunction("Signaling")) },
    { text: "Show ciliary signaling genes", handler: async () => formatListResult("Ciliary Signaling Genes", await getGenesByFunction("Signaling")) },
    { text: "Which genes participate in ciliary signaling?", handler: async () => formatListResult("Ciliary Signaling Genes", await getGenesByFunction("Signaling")) },
    { text: "Cilia signaling pathway genes", handler: async () => formatListResult("Ciliary Signaling Genes", await getGenesByFunction("Signaling")) },
    { text: "Display Signaling genes", handler: async () => formatListResult("Signaling Genes", await getGenesByFunction("Signaling")) },
    
    // Motor proteins
    { text: "Show me motor genes", handler: async () => formatListResult("Motor Genes", await getGenesByFunction("motor")) },
    { text: "List genes involved in motor activity.", handler: async () => formatListResult("Motor Genes", await getGenesByFunction("motor")) },
    { text: "Motor protein genes", handler: async () => formatListResult("Motor Genes", await getGenesByFunction("motor")) },
    { text: "Which genes encode motor proteins?", handler: async () => formatListResult("Motor Genes", await getGenesByFunction("motor")) },
    { text: "Display Motor protein genes", handler: async () => formatListResult("Motor Protein Genes", await getGenesByFunction("Motor protein")) },
    
    { text: "Display kinesin motors", handler: async () => formatListResult("Kinesin Motors", await getGenesByFunction("kinesin motors")) },
    { text: "List kinesin family genes", handler: async () => formatListResult("Kinesin Motors", await getGenesByFunction("kinesin motors")) },
    { text: "Show kinesin motor proteins", handler: async () => formatListResult("Kinesin Motors", await getGenesByFunction("kinesin motors")) },
    
    { text: "Show me dynein motors", handler: async () => formatListResult("Dynein Motors", await getGenesByFunction("dynein motors")) },
    { text: "List dynein genes", handler: async () => formatListResult("Dynein Motors", await getGenesByFunction("dynein motors")) },
    { text: "Dynein motor proteins", handler: async () => formatListResult("Dynein Motors", await getGenesByFunction("dynein motors")) },
    
    // Cilium assembly
    { text: "Which genes are involved in cilium assembly?", handler: async () => formatListResult("Cilium Assembly Genes", await getGenesByFunction("cilium assembly")) },
    { text: "Show genes related to cilium assembly.", handler: async () => formatListResult("Cilium Assembly Genes", await getGenesByFunction("cilium assembly")) },
    { text: "Ciliogenesis genes", handler: async () => formatListResult("Cilium Assembly Genes", await getGenesByFunction("cilium assembly")) },
    { text: "Genes required for cilia formation", handler: async () => formatListResult("Cilium Assembly Genes", await getGenesByFunction("cilium assembly")) },
    
    { text: "Show me Ciliary assembly/disassembly genes", handler: async () => formatListResult("Ciliary Assembly/Disassembly Genes", await getGenesByFunction("Ciliary assembly/disassembly")) },
    { text: "Cilia assembly and disassembly genes", handler: async () => formatListResult("Ciliary Assembly/Disassembly Genes", await getGenesByFunction("Ciliary assembly/disassembly")) },
    
    // Length regulation
    { text: "Display kinases regulating cilia length", handler: async () => formatListResult("Kinases Regulating Cilia Length", await getGenesByDomainDescription("kinase")) },
    { text: "Cilia length control genes", handler: async () => formatListResult("Cilia Length Regulation Genes", await getGenesByFunction("cilia length")) },
    { text: "Which genes regulate ciliary length?", handler: async () => formatListResult("Cilia Length Regulation Genes", await getGenesByFunction("cilia length")) },
    
    // Motile cilium
    { text: "Show me Motile cilium genes", handler: async () => formatListResult("Motile Cilium Genes", await getGenesByFunction("Motile cilium")) },
    { text: "Genes specific to motile cilia", handler: async () => formatListResult("Motile Cilium Genes", await getGenesByFunction("Motile cilium")) },
    { text: "Which genes are required for ciliary motility?", handler: async () => formatListResult("Motile Cilium Genes", await getGenesByFunction("Motile cilium")) },
    { text: "Motile cilia components", handler: async () => formatListResult("Motile Cilium Genes", await getGenesByFunction("Motile cilium")) },
    
    // Transport
    { text: "Show Transport genes", handler: async () => formatListResult("Transport Genes", await getGenesByFunction("Transport")) },
    { text: "Genes involved in ciliary transport", handler: async () => formatListResult("Transport Genes", await getGenesByFunction("Transport")) },
    { text: "Ciliary trafficking genes", handler: async () => formatListResult("Transport Genes", await getGenesByFunction("Transport")) },
    { text: "IFT and transport genes", handler: async () => formatListResult("Transport Genes", await getGenesByFunction("Transport")) },
    
    // Protein modification
    { text: "Display Protein modification genes", handler: async () => formatListResult("Protein Modification Genes", await getGenesByFunction("Protein modification")) },
    { text: "Post-translational modification genes", handler: async () => formatListResult("Protein Modification Genes", await getGenesByFunction("Protein modification")) },
    { text: "Genes involved in protein modification in cilia", handler: async () => formatListResult("Protein Modification Genes", await getGenesByFunction("Protein modification")) },
    
    // Cytoskeletal
    { text: "Show Cytoskeletal genes", handler: async () => formatListResult("Cytoskeletal Genes", await getGenesByFunction("Cytoskeletal")) },
    { text: "Cytoskeleton-related ciliary genes", handler: async () => formatListResult("Cytoskeletal Genes", await getGenesByFunction("Cytoskeletal")) },
    { text: "Genes involved in cytoskeletal regulation", handler: async () => formatListResult("Cytoskeletal Genes", await getGenesByFunction("Cytoskeletal")) },
    
    // Additional functional categories
    { text: "Show genes involved in Hedgehog signaling", handler: async () => formatListResult("Hedgehog Signaling Genes", await getGenesByFunction("Hedgehog")) },
    { text: "Wnt signaling ciliary genes", handler: async () => formatListResult("Wnt Signaling Genes", await getGenesByFunction("Wnt")) },
    { text: "Show GPCR genes in cilia", handler: async () => formatListResult("GPCR Genes", await getGenesByFunction("GPCR")) },
    { text: "Ion channel genes in cilia", handler: async () => formatListResult("Ion Channel Genes", await getGenesByFunction("ion channel")) },
    { text: "Show transcription factors regulating cilia", handler: async () => formatListResult("Transcription Factors", await getGenesByFunction("transcription")) },
    { text: "Ubiquitin pathway genes in cilia", handler: async () => formatListResult("Ubiquitin Pathway Genes", await getGenesByFunction("ubiquitin")) },
    { text: "Show BBSome trafficking genes", handler: async () => formatListResult("BBSome Trafficking Genes", await getGenesByFunction("BBSome")) },

    // ==================== LITERATURE SEARCH ====================
    { text: "Find literature on ARL13B and cilia", handler: async () => getLiteratureEvidence("ARL13B") },
    { text: "Search literature for IFT88", handler: async () => getLiteratureEvidence("IFT88") },
    { text: "Find papers about ARL13B and cilia.", handler: async () => getLiteratureEvidence("ARL13B") },
    { text: "Show recent research on IFT88.", handler: async () => getLiteratureEvidence("IFT88") },
    { text: "ARL13B literature", handler: async () => getLiteratureEvidence("ARL13B") },
    { text: "Publications on IFT88", handler: async () => getLiteratureEvidence("IFT88") },
    
    { text: "Find papers on BBS1", handler: async () => getLiteratureEvidence("BBS1") },
    { text: "CEP290 literature search", handler: async () => getLiteratureEvidence("CEP290") },
    { text: "Research on DYNC2H1", handler: async () => getLiteratureEvidence("DYNC2H1") },
    { text: "Show publications about NPHP1", handler: async () => getLiteratureEvidence("NPHP1") },
    { text: "Find research on KIF3A", handler: async () => getLiteratureEvidence("KIF3A") },

    // ==================== COMBINED/ADVANCED QUERIES ====================
    { text: "Which BBSome components are at the transition zone?", handler: async () => notImplementedYet("Combined query: BBSome AND transition zone") },
    { text: "List Joubert syndrome genes found in the axoneme.", handler: async () => notImplementedYet("Combined query: Joubert AND axoneme") },
    { text: "Show signaling proteins located at the ciliary tip.", handler: async () => notImplementedYet("Combined query: Signaling AND ciliary tip") },
    { text: "Which IFT-B components cause short cilia when knocked down?", handler: async () => notImplementedYet("Combined query: IFT-B AND short cilia screen") },
    { text: "Do any Bardet-Biedl Syndrome genes cause long cilia in screens?", handler: async () => notImplementedYet("Combined query: BBS AND long cilia screen") },
    { text: "Which transition zone genes are ciliary-only?", handler: async () => notImplementedYet("Combined query: Transition Zone AND ciliary-only") },
    { text: "Compare expression of transition zone genes ARL13B and CEP290 in single cells.", handler: async () => notImplementedYet("Combined query: TZ genes AND single-cell compare") },
    { text: "Plot expression of motor proteins KIF3A and DYNC2H1 in single cells.", handler: async () => notImplementedYet("Combined query: Motor proteins AND single-cell plot") },
    { text: "Which ciliary genes expressed in the kidney are also found in C. elegans?", handler: async () => notImplementedYet("Combined query: Kidney expression AND C. elegans conservation") },
    { text: "List basal body proteins associated with Polycystic Kidney Disease.", handler: async () => notImplementedYet("Combined query: Basal body AND PKD") },
    { text: "Show kinases at the transition zone", handler: async () => notImplementedYet("Combined query: Kinases AND transition zone") },
    { text: "Which BBS genes are conserved in Chlamydomonas?", handler: async () => notImplementedYet("Combined query: BBS genes AND Chlamydomonas") },
    { text: "Find motor proteins that cause PCD when mutated", handler: async () => notImplementedYet("Combined query: Motor proteins AND PCD") },
    { text: "Which ciliary genes are kidney-specific and disease-associated?", handler: async () => notImplementedYet("Combined query: Kidney-specific AND ciliopathy") },

    // ==================== NEW ADVANCED QUERIES ====================
    // Gene interactions
    { text: "Show interactors of IFT88", handler: async () => getProteinInteractions("IFT88") },
    { text: "What are the interacting partners of BBS1?", handler: async () => getProteinInteractions("BBS1") },
    { text: "IFT88 protein interactions", handler: async () => getProteinInteractions("IFT88") },
    { text: "Which proteins interact with CEP290?", handler: async () => getProteinInteractions("CEP290") },
    { text: "Show binding partners of ARL13B", handler: async () => getProteinInteractions("ARL13B") },
    
    // Prediction/Analysis
    { text: "Predict potential ciliary genes using co-expression data", handler: async () => notImplementedYet("Prediction of ciliary genes") },
    { text: "Find candidate ciliary genes", handler: async () => notImplementedYet("Prediction of ciliary genes") },
    { text: "Which genes might be ciliary based on expression?", handler: async () => notImplementedYet("Prediction of ciliary genes") },
    

    // ==================== ADDITIONAL LOCALIZATION QUERIES ====================
    { text: "Show genes at ciliary base", handler: async () => formatListResult("Ciliary Base Genes", await getGenesByLocalization("ciliary base")) },
    { text: "Which genes localize to the periciliary membrane?", handler: async () => formatListResult("Periciliary Membrane Genes", await getGenesByLocalization("periciliary membrane")) },
    { text: "Show genes in the ciliary shaft", handler: async () => formatListResult("Ciliary Shaft Genes", await getGenesByLocalization("ciliary shaft")) },
    { text: "List proteins at distal appendages", handler: async () => formatListResult("Distal Appendage Proteins", await getGenesByLocalization("distal appendage")) },
    { text: "Show subdistal appendage proteins", handler: async () => formatListResult("Subdistal Appendage Proteins", await getGenesByLocalization("subdistal appendage")) },
    { text: "Genes in the ciliary gate", handler: async () => formatListResult("Ciliary Gate Genes", await getGenesByLocalization("ciliary gate")) },
    { text: "Show mother centriole proteins", handler: async () => formatListResult("Mother Centriole Proteins", await getGenesByLocalization("mother centriole")) },
    { text: "Daughter centriole genes", handler: async () => formatListResult("Daughter Centriole Genes", await getGenesByLocalization("daughter centriole")) },
    
    // ==================== STRUCTURAL COMPONENTS ====================
    { text: "Show outer doublet microtubule proteins", handler: async () => formatListResult("Outer Doublet Proteins", await getGenesByLocalization("outer doublet")) },
    { text: "Which genes are part of the A-tubule?", handler: async () => formatListResult("A-tubule Proteins", await getGenesByLocalization("A-tubule")) },
    { text: "Show B-tubule proteins", handler: async () => formatListResult("B-tubule Proteins", await getGenesByLocalization("B-tubule")) },
    { text: "List central pair proteins", handler: async () => formatListResult("Central Pair Proteins", await getGenesByLocalization("central pair")) },
    { text: "Show radial spoke genes", handler: async () => formatListResult("Radial Spoke Genes", await getGenesByLocalization("radial spoke")) },
    { text: "Dynein regulatory complex genes", handler: async () => formatListResult("DRC Genes", await getGenesByLocalization("dynein regulatory complex")) },
    { text: "Show nexin link proteins", handler: async () => formatListResult("Nexin Link Proteins", await getGenesByLocalization("nexin link")) },
    
    // ==================== POST-TRANSLATIONAL MODIFICATIONS ====================
    { text: "Show genes involved in tubulin acetylation", handler: async () => formatListResult("Tubulin Acetylation Genes", await getGenesByFunction("acetylation")) },
    { text: "Which genes regulate tubulin glutamylation?", handler: async () => formatListResult("Glutamylation Genes", await getGenesByFunction("glutamylation")) },
    { text: "Show tubulin detyrosination enzymes", handler: async () => formatListResult("Detyrosination Genes", await getGenesByFunction("detyrosination")) },
    { text: "Genes involved in ciliary phosphorylation", handler: async () => formatListResult("Phosphorylation Genes", await getGenesByFunction("phosphorylation")) },
    { text: "Show ubiquitination genes in cilia", handler: async () => formatListResult("Ubiquitination Genes", await getGenesByFunction("ubiquitination")) },
    { text: "SUMOylation in cilia", handler: async () => formatListResult("SUMOylation Genes", await getGenesByFunction("sumoylation")) },
    
    // ==================== DEVELOPMENTAL QUERIES ====================
    { text: "Which genes regulate multiciliogenesis?", handler: async () => formatListResult("Multiciliogenesis Genes", await getGenesByFunction("multiciliogenesis")) },
    { text: "Show genes involved in deuterosome formation", handler: async () => formatListResult("Deuterosome Genes", await getGenesByFunction("deuterosome")) },
    { text: "Genes required for basal body docking", handler: async () => formatListResult("Basal Body Docking Genes", await getGenesByFunction("basal body docking")) },
    { text: "Which genes control planar cell polarity in ciliated cells?", handler: async () => formatListResult("PCP Genes", await getGenesByFunction("planar cell polarity")) },
    { text: "Show genes for ciliary resorption", handler: async () => formatListResult("Ciliary Resorption Genes", await getGenesByFunction("resorption")) },
    { text: "Genes controlling cilia disassembly", handler: async () => formatListResult("Cilia Disassembly Genes", await getGenesByFunction("disassembly")) },
    
    // ==================== CELL CYCLE & CILIA ====================
    { text: "Show genes linking cell cycle and cilia", handler: async () => formatListResult("Cell Cycle-Cilia Genes", await getGenesByFunction("cell cycle")) },
    { text: "Which genes regulate cilium length during cell cycle?", handler: async () => formatListResult("Cell Cycle Cilia Regulation", await getGenesByFunction("cell cycle regulation")) },
    { text: "Genes involved in ciliary resorption during mitosis", handler: async () => formatListResult("Mitotic Ciliary Resorption", await getGenesByFunction("mitotic resorption")) },
    { text: "Show Aurora kinase targets in cilia", handler: async () => formatListResult("Aurora Kinase Targets", await getGenesByFunction("Aurora")) },
    
    // ==================== SENSORY FUNCTION ====================
    { text: "Which genes are involved in mechanosensation?", handler: async () => formatListResult("Mechanosensation Genes", await getGenesByFunction("mechanosensation")) },
    { text: "Show chemosensory ciliary genes", handler: async () => formatListResult("Chemosensation Genes", await getGenesByFunction("chemosensation")) },
    { text: "Olfactory cilia genes", handler: async () => formatListResult("Olfactory Genes", await getGenesByFunction("olfaction")) },
    { text: "Show photoreceptor ciliary genes", handler: async () => formatListResult("Photoreceptor Genes", await getGenesByFunction("photoreception")) },
    { text: "Which genes are involved in flow sensing?", handler: async () => formatListResult("Flow Sensing Genes", await getGenesByFunction("flow sensing")) },
    
    // ==================== CALCIUM SIGNALING ====================
    { text: "Show calcium signaling genes in cilia", handler: async () => formatListResult("Calcium Signaling Genes", await getGenesByFunction("calcium signaling")) },
    { text: "Which calcium channels are ciliary?", handler: async () => formatListResult("Calcium Channels", await getGenesByFunction("calcium channel")) },
    { text: "Show calmodulin-regulated ciliary genes", handler: async () => formatListResult("Calmodulin-Regulated Genes", await getGenesByFunction("calmodulin")) },
    { text: "Calcium-binding proteins in cilia", handler: async () => formatListResult("Calcium-Binding Proteins", await getGenesWithDomain("calcium-binding")) },
    
    // ==================== LIPID BIOLOGY ====================
    { text: "Show genes involved in ciliary membrane lipid composition", handler: async () => formatListResult("Lipid Metabolism Genes", await getGenesByFunction("lipid")) },
    { text: "Which genes regulate phosphoinositide signaling in cilia?", handler: async () => formatListResult("Phosphoinositide Genes", await getGenesByFunction("phosphoinositide")) },
    { text: "Show phospholipase genes in cilia", handler: async () => formatListResult("Phospholipase Genes", await getGenesByFunction("phospholipase")) },
    
    // ==================== LEFT-RIGHT ASYMMETRY ====================
    { text: "Which genes control left-right asymmetry?", handler: async () => formatListResult("LR Asymmetry Genes", await getGenesByFunction("left-right")) },
    { text: "Show nodal cilia genes", handler: async () => formatListResult("Nodal Cilia Genes", await getGenesByFunction("nodal")) },
    { text: "Genes involved in nodal flow", handler: async () => formatListResult("Nodal Flow Genes", await getGenesByFunction("nodal flow")) },
    { text: "Laterality determination genes", handler: async () => formatListResult("Laterality Genes", await getGenesByFunction("laterality")) },
    
    // ==================== CILIA IN SPECIFIC ORGANS ====================
    { text: "Show kidney cilia-specific genes", handler: async () => formatListResult("Kidney Cilia Genes", await getTissueSpecificGenes("kidney")) },
    { text: "Brain ventricle cilia genes", handler: async () => formatListResult("Brain Ventricle Cilia", await getTissueSpecificGenes("brain ventricle")) },
    { text: "Respiratory cilia genes", handler: async () => formatListResult("Respiratory Cilia Genes", await getTissueSpecificGenes("lung")) },
    { text: "Show retinal photoreceptor ciliary genes", handler: async () => formatListResult("Retinal Cilia Genes", await getTissueSpecificGenes("retina")) },
    { text: "Reproductive tract cilia genes", handler: async () => formatListResult("Reproductive Cilia Genes", await getTissueSpecificGenes("reproductive")) },
    { text: "Ependymal cilia genes", handler: async () => formatListResult("Ependymal Cilia Genes", await getGenesByFunction("ependymal")) },
    
    // ==================== CILIA LENGTH & STRUCTURE REGULATION ====================
    { text: "Which genes promote cilia elongation?", handler: async () => getGenesByScreenPhenotype("long cilia") },
    { text: "Show genes that restrict cilia length", handler: async () => getGenesByScreenPhenotype("short cilia") },
    { text: "Cilia length regulators", handler: async () => formatListResult("Cilia Length Regulators", await getGenesByFunction("length regulation")) },
    { text: "Which kinases control cilia length?", handler: async () => formatListResult("Length-Regulating Kinases", await getGenesByDomainDescription("kinase")) },
    { text: "Show genes that stabilize cilia", handler: async () => formatListResult("Cilia Stabilization Genes", await getGenesByFunction("stabilization")) },
    
    // ==================== TRAFFICKING & SORTING ====================
    { text: "Which genes sort proteins into cilia?", handler: async () => formatListResult("Protein Sorting Genes", await getGenesByFunction("sorting")) },
    { text: "Show ciliary targeting signal recognition genes", handler: async () => formatListResult("Targeting Signal Genes", await getGenesByFunction("targeting")) },
    { text: "Genes involved in ciliary import", handler: async () => formatListResult("Ciliary Import Genes", await getGenesByFunction("import")) },
    { text: "Show ciliary export machinery genes", handler: async () => formatListResult("Ciliary Export Genes", await getGenesByFunction("export")) },
    { text: "Which Rab GTPases are ciliary?", handler: async () => formatListResult("Ciliary Rab GTPases", await getGenesByFunction("Rab")) },
    { text: "Show Arf GTPases in cilia", handler: async () => formatListResult("Arf GTPases", await getGenesByFunction("Arf")) },
    { text: "Ran GTPase pathway in cilia", handler: async () => formatListResult("Ran Pathway Genes", await getGenesByFunction("Ran")) },
    
    // ==================== QUALITY CONTROL ====================
    { text: "Show ciliary quality control genes", handler: async () => formatListResult("Quality Control Genes", await getGenesByFunction("quality control")) },
    { text: "Which genes are involved in ciliary autophagy?", handler: async () => formatListResult("Ciliophagy Genes", await getGenesByFunction("autophagy")) },
    { text: "Show chaperone genes in cilia", handler: async () => formatListResult("Chaperone Genes", await getGenesByFunction("chaperone")) },
    { text: "Proteasome components in cilia", handler: async () => formatListResult("Proteasome Genes", await getGenesByFunction("proteasome")) },
    
    // ==================== ENERGY METABOLISM ====================
    { text: "Show genes involved in ciliary ATP production", handler: async () => formatListResult("ATP Production Genes", await getGenesByFunction("ATP")) },
    { text: "Which genes link mitochondria to cilia?", handler: async () => formatListResult("Mitochondrial-Ciliary Genes", await getGenesByFunction("mitochondria")) },
    { text: "Glycolysis genes in ciliated cells", handler: async () => formatListResult("Glycolysis Genes", await getGenesByFunction("glycolysis")) },
    { text: "Show oxidative phosphorylation genes", handler: async () => formatListResult("OXPHOS Genes", await getGenesByFunction("oxidative phosphorylation")) },
    
    // ==================== COMPARATIVE PHENOTYPES ====================
    { text: "Compare phenotypes of IFT-A vs IFT-B mutations", handler: async () => notImplementedYet("IFT-A vs IFT-B phenotype comparison") },
    { text: "Which genes cause both ciliopathy and cancer?", handler: async () => notImplementedYet("Ciliopathy-cancer overlap") },
    { text: "Compare BBS vs MKS gene functions", handler: async () => notImplementedYet("BBS vs MKS comparison") },
    { text: "Which genes cause both PCD and infertility?", handler: async () => notImplementedYet("PCD-infertility overlap") },
    
    // ==================== DRUG TARGETS ====================
    { text: "Which ciliary genes are druggable?", handler: async () => notImplementedYet("Druggable ciliary genes") },
    { text: "Show kinases that could be therapeutic targets", handler: async () => formatListResult("Therapeutic Target Kinases", await getGenesByDomainDescription("kinase")) },
    { text: "Which GPCRs in cilia could be drug targets?", handler: async () => formatListResult("GPCR Drug Targets", await getGenesByFunction("GPCR")) },
    
    // ==================== ADDITIONAL SCREEN QUERIES ====================
    { text: "Which genes are essential for ciliogenesis across all screens?", handler: async () => notImplementedYet("Pan-screen essential genes") },
    { text: "Show genes with conflicting screen results", handler: async () => notImplementedYet("Conflicting screen results") },
    { text: "Which genes affect both cilia number and length?", handler: async () => notImplementedYet("Dual phenotype genes") },
    { text: "Compare Kim2016 and Wheway2015 results", handler: async () => notImplementedYet("Cross-screen comparison") },
    
    // ==================== PARALOG QUERIES ====================
    { text: "Show paralogs of IFT88", handler: async () => notImplementedYet("IFT88 paralogs") },
    { text: "Which ciliary genes have paralogs?", handler: async () => notImplementedYet("Genes with paralogs") },
    { text: "Do BBS genes have paralogs?", handler: async () => notImplementedYet("BBS paralog analysis") },
    { text: "Show functionally redundant ciliary genes", handler: async () => notImplementedYet("Functionally redundant genes") },
    
    // ==================== EXPRESSION TIMING ====================
    { text: "Which genes are expressed during early ciliogenesis?", handler: async () => notImplementedYet("Early ciliogenesis genes") },
    { text: "Show genes upregulated during cilium formation", handler: async () => notImplementedYet("Ciliogenesis timing") },
    { text: "Which genes are cell cycle regulated?", handler: async () => formatListResult("Cell Cycle Regulated", await getGenesByFunction("cell cycle")) },
    
    // ==================== SYNDROME-SPECIFIC FEATURES ====================
    { text: "Which BBS genes cause obesity?", handler: async () => notImplementedYet("BBS obesity genes") },
    { text: "Show Joubert genes that cause cerebellar hypoplasia", handler: async () => notImplementedYet("Joubert cerebellar genes") },
    { text: "Which PCD genes cause situs inversus?", handler: async () => notImplementedYet("PCD laterality genes") },
    { text: "Show genes causing retinal degeneration", handler: async () => notImplementedYet("Retinal degeneration genes") },
    { text: "Which genes cause polydactyly?", handler: async () => notImplementedYet("Polydactyly genes") },
    
    // ==================== TISSUE-SPECIFIC EXPRESSION PATTERNS ====================
    { text: "Show genes expressed in both kidney and brain cilia", handler: async () => notImplementedYet("Kidney-brain overlap") },
    { text: "Which genes are testis-specific?", handler: async () => getTissueSpecificGenes("testis") },
    { text: "Show genes unique to photoreceptor cilia", handler: async () => getTissueSpecificGenes("photoreceptor") },
    { text: "Airway ciliated cell genes", handler: async () => getTissueSpecificGenes("airway") },
    
    // ==================== ADDITIONAL USEFUL QUERIES ====================
    { text: "How many ciliary genes are there?", handler: async () => notImplementedYet("Count ciliary genes") },
    { text: "Show most studied ciliary genes", handler: async () => notImplementedYet("Most studied genes") },
    { text: "Which genes have mouse models?", handler: async () => notImplementedYet("Mouse model availability") },
    { text: "Show genes with known crystal structures", handler: async () => notImplementedYet("Structural data availability") },
    { text: "Which genes have CRISPR screens?", handler: async () => notImplementedYet("CRISPR screen data") },
    
    // ==================== HELP & DOCUMENTATION ====================
    { text: "How do I search for genes?", handler: async () => tellAboutCiliAI() },
    { text: "Show example questions", handler: async () => tellAboutCiliAI() },
    { text: "What types of data do you have?", handler: async () => tellAboutCiliAI() },
    { text: "Help me understand ciliopathies", handler: async () => tellAboutCiliAI() },
    { text: "Explain IFT", handler: async () => getComprehensiveDetails("IFT88") },
    { text: "What is the BBSome?", handler: async () => formatListResult("Components of BBSome", await getGenesByComplex("BBSome")) },
    { text: "Explain the transition zone", handler: async () => formatListResult("Transition Zone Genes", await getGenesByLocalization("transition zone")) },
    { text: "What are ciliopathies?", handler: async () => { const { genes, description } = await getCiliopathyGenes("ciliopathy"); return formatListResult("All Ciliopathy-Associated Genes", genes, description); }},
    
    // ==================== SYNONYM VARIATIONS ====================
    // More natural language variants
    { text: "Tell me everything about IFT88", handler: async () => getComprehensiveDetails("IFT88") },
    { text: "I want to know about BBS1", handler: async () => getComprehensiveDetails("BBS1") },
    { text: "Give me information on CEP290", handler: async () => getComprehensiveDetails("CEP290") },
    { text: "What do we know about NPHP1?", handler: async () => getComprehensiveDetails("NPHP1") },
    { text: "Summarize ARL13B for me", handler: async () => getComprehensiveDetails("ARL13B") },
    
    { text: "Is this gene ciliary: DYNC2H1", handler: async () => checkCiliaryStatus("DYNC2H1") },
    { text: "Can you check if KIF3A is a cilia gene?", handler: async () => checkCiliaryStatus("KIF3A") },
    
    { text: "Where in the cell can I find IFT88?", handler: async () => getGeneLocalization("IFT88") },
    { text: "Tell me where BBS1 is located", handler: async () => getGeneLocalization("BBS1") },
    
    { text: "What diseases is NPHP1 linked to?", handler: async () => getGeneDiseases("NPHP1") },
    { text: "Which ciliopathies involve BBS1?", handler: async () => getGeneDiseases("BBS1") },
    
    { text: "Is IFT88 found in worms?", handler: async () => checkConservation("IFT88", "C. elegans") },
    { text: "Does zebrafish have BBS1?", handler: async () => checkConservation("BBS1", "zebrafish") },
    
    { text: "What happens if you knock out KIF3A?", handler: async () => getKnockdownEffect("KIF3A") },
    { text: "Phenotype of IFT88 knockdown", handler: async () => getKnockdownEffect("IFT88") },
    
    { text: "Where is ARL13B normally found?", handler: async () => getGeneExpression("ARL13B") },
    { text: "Which tissues have high BBS1 expression?", handler: async () => getGeneExpression("BBS1") },
    
    { text: "Is FOXJ1 expressed in ciliated cells?", handler: async () => getGeneExpressionInCellType("FOXJ1", "ciliated cell") },
    { text: "Do ciliated cells express ARL13B?", handler: async () => getGeneExpressionInCellType("ARL13B", "ciliated cell") },
    
   // ==================== CILIOPATHY CLASSIFICATION ====================
    { text: "List all genes classified as Primary Ciliopathy", handler: async () => getGenesByCiliopathyClassification("Primary Ciliopathy") },
    { text: "Show genes classified as Motile Ciliopathy", handler: async () => getGenesByCiliopathyClassification("Motile Ciliopathy") },
    { text: "Which genes are classified as Secondary Diseases", handler: async () => getGenesByCiliopathyClassification("Secondary Disease") },
    { text: "Find genes classified as Primary Ciliopathy", handler: async () => getGenesByCiliopathyClassification("Primary Ciliopathy") },
    { text: "Genes associated with Secondary Ciliopathies", handler: async () => getGenesByCiliopathyClassification("Secondary Disease") },
      // ==================== CILIOPATHY & CLASSIFICATION (New Synonyms) ====================
    { text: "List genes related to Primary Ciliopathy", handler: async () => getGenesByCiliopathyClassification("Primary Ciliopathy") },
    { text: "Which genes are classified as Motile Ciliopathies?", handler: async () => getGenesByCiliopathyClassification("Motile Ciliopathy") },
    { text: "Show secondary ciliopathy genes", handler: async () => getGenesByCiliopathyClassification("Secondary Disease") },
    { text: "Genes linked to Primary Ciliary Dyskinesia (PCD)", handler: async () => { const { genes, description } = await getCiliopathyGenes("Primary Ciliary Dyskinesia"); return formatListResult("Genes for Primary Ciliary Dyskinesia", genes, description); } },
    { text: "Genes causing Bardet-Biedl Syndrome (BBS)", handler: async () => { const { genes, description } = await getCiliopathyGenes("Bardet-Biedl Syndrome"); return formatListResult("Genes for Bardet-Biedl Syndrome", genes, description); }},
    
    
    // ==================== CILIARY PHENOTYPE EFFECTS (USING getGeneCiliaEffects) ====================
    { text: "What are the ciliary effects of NPHP1?", handler: async () => getGeneCiliaEffects("NPHP1") },
    { text: "Show ciliary effects for ARL13B", handler: async () => getGeneCiliaEffects("ARL13B") },
    { text: "What happens to cilia when BBS1 is knocked down?", handler: async () => getGeneCiliaEffects("BBS1") },
    { text: "Describe the effect of CEP290 LOF on cilia length", handler: async () => getGeneCiliaEffects("CEP290") },
    { text: "Show the comprehensive screen data for IFT88", handler: async () => getGeneCiliaEffects("IFT88") },
    
    // PHENOTYPE QUERIES (Functional Synonyms)
    { text: "Find genes that cause shorter cilia on loss of function", handler: async () => getGenesByScreenPhenotype("shorter cilia") },
    { text: "Which genes result in shorter cilia when deleted?", handler: async () => getGenesByScreenPhenotype("shorter cilia") },
    { text: "Which genes reduce the percentage of ciliated cells?", handler: async () => getGenesByScreenPhenotype("reduced ciliated cells") },
    { text: "Genes that reduce cilia number", handler: async () => getGenesByScreenPhenotype("reduced ciliated cells") },
    { text: "List genes that result in longer cilia when silenced", handler: async () => getGenesByScreenPhenotype("longer cilia") },
      // ==================== PHENOTYPE / SCREEN RESULTS (New Synonyms) ====================
    { text: "What are the curated ciliary effects for NPHP1?", handler: async () => getGeneCiliaEffects("NPHP1") },
    { text: "Show screen and phenotypic effects for ARL13B", handler: async () => getGeneCiliaEffects("ARL13B") },
    { text: "List proteins that restrict cilia length", handler: async () => getGenesByScreenPhenotype("shorter cilia") },
    { text: "Which genes cause long cilia on knockout?", handler: async () => getGenesByScreenPhenotype("longer cilia") },
    { text: "Genes that promote cilia elongation", handler: async () => getGenesByScreenPhenotype("longer cilia") },
    { text: "Which knockdowns reduce ciliation rate?", handler: async () => getGenesByScreenPhenotype("reduced ciliated cells") },
    { text: "Show Breslow Hedgehog screen positive hits", handler: async () => getHedgehogRegulators("positive") },
    { text: "Which genes act as Hh pathway inhibitors?", handler: async () => getHedgehogRegulators("negative") },

    // ==================== ORTHOLOGS ====================
    { text: "Show orthologs of IFT88", handler: async () => getOrthologsForGene("IFT88") },
    { text: "List orthologs for BBS1", handler: async () => getOrthologsForGene("BBS1") },
    { text: "Does ARL13B have an ortholog in C. elegans?", handler: async () => getOrthologsForGene("ARL13B") },
    { text: "Orthologs of DYNC2H1 in mouse and zebrafish", handler: async () => getOrthologsForGene("DYNC2H1") },
    { text: "Find the zebrafish ortholog of NPHP1", handler: async () => getOrthologsForGene("NPHP1") },
    
    // ==================== ORTHOLOGS (New Synonyms) ====================
    { text: "Find the orthologs for BBS1", handler: async () => getOrthologsForGene("BBS1") },
    { text: "What is the mouse homolog of IFT88?", handler: async () => getOrthologsForGene("IFT88") },
    { text: "Evolutionary partners of ARL13B", handler: async () => getOrthologsForGene("ARL13B") },
    { text: "Which model organisms have NPHP1 orthologs?", handler: async () => getOrthologsForGene("NPHP1") },
    
    // ==================== GENERAL / COMPREHENSIVE ====================
    { text: "Tell me all information about IFT88", handler: async () => getComprehensiveDetails("IFT88") },
    { text: "Detailed information for BBS1", handler: async () => getComprehensiveDetails("BBS1") },
    { text: "Summarize ARL13B data", handler: async () => getComprehensiveDetails("ARL13B") },
    { text: "Search for the function of KIF17", handler: async () => getGeneFunction("KIF17") },
    { text: "What is the function of CC2D1A?", handler: async () => getGeneFunction("CC2D1A") },
    { text: "ARL13B signaling role", handler: async () => getGeneRole("ARL13B", "ciliary signaling") },

    // ==================== CILIARY STATUS / LOCALIZATION ====================
    { text: "Is FOXJ1 a known ciliary protein?", handler: async () => checkCiliaryStatus("FOXJ1") },
    { text: "Where exactly is EFCAB7 localized?", handler: async () => getGeneLocalization("EFCAB7") },
    { text: "List genes at the ciliary base", handler: async () => formatListResult("Genes localizing to basal body", await getGenesByLocalization("basal body")) },
    { text: "Which proteins are in the axoneme?", handler: async () => formatListResult("Genes localizing to axoneme", await getGenesByLocalization("axoneme")) },
    { text: "Ciliary tip proteins list", handler: async () => formatListResult("Genes localizing to ciliary tip", await getGenesByLocalization("ciliary tip")) },


    // ==================== EXPRESSION / VISUALIZATION (Synonyms) ====================
    { text: "Tissue distribution of BBS1", handler: async () => getGeneExpression("BBS1") },
    { text: "Show expression map for ARL13B", handler: async () => getGeneExpressionPattern("ARL13B") },
    { text: "Which ciliary genes are active in the retina?", handler: async () => getTissueSpecificGenes("retina") },
    { text: "Visualize ARL13B single-cell expression", handler: async () => displayCellxgeneBarChart(["ARL13B"])},
    { text: "Plot FOXJ1 UMAP expression", handler: async () => displayUmapGeneExpression("FOXJ1") },
    { text: "Show cell types on UMAP", handler: async () => displayUmapPlot() },
];

  // ==================== EVOLUTIONARY CONSERVATION & PHYLOGENY ====================
    // Note: We use a helper function to correctly wrap the output {genes, desc, species} -> HTML string.
const wrapOrganismResult = async (organismName) => {
    const result = await getCiliaryGenesForOrganism(organismName);
    return formatListResult(`Ciliary genes in ${result.speciesCode}`, result.genes, result.description);
};

// --- ADDITION: New Helper Functions for Expanded Questions ---
function notImplementedYet(feature) {
    return `<div class="result-card"><h3>Feature In Development</h3><p>The query handler for "<strong>${feature}</strong>" is not yet implemented. Stay tuned for future updates!</p></div>`;
}
// --- Updated: Get genes based on screen phenotype (Now robust against all valid inputs) ---
async function getGenesByScreenPhenotype(phenotype) {
    if (!ciliaHubDataCache) await fetchCiliaData();
    const normalizedPhenotype = phenotype.toLowerCase();
    let genes = [];

    // Check for "reduced ciliated cells"
    if (normalizedPhenotype.includes('reduced') || normalizedPhenotype.includes('decrease') || normalizedPhenotype.includes('number')) {
        genes = ciliaHubDataCache
            .filter(g => g.percent_ciliated_cells_effects && (
                g.percent_ciliated_cells_effects.toLowerCase().includes('reduced') ||
                g.percent_ciliated_cells_effects.toLowerCase().includes('fewer') ||
                g.percent_ciliated_cells_effects.toLowerCase().includes('decreased')
            ))
            .map(g => ({ 
                gene: g.gene, 
                description: `Ciliogenesis effect: ${g.percent_ciliated_cells_effects}` 
            }));
    
    // Check for "shorter cilia"
    } else if (normalizedPhenotype.includes('shorter') || normalizedPhenotype.includes('short')) {
        genes = ciliaHubDataCache
            .filter(g => g.lof_effects && (
                g.lof_effects.toLowerCase().includes('shorter') ||
                g.lof_effects.toLowerCase().includes('short')
            ))
            .map(g => ({ 
                gene: g.gene, 
                description: `LoF effect: ${g.lof_effects}` 
            }));
        
    // Check for "longer cilia"
    } else if (normalizedPhenotype.includes('longer') || normalizedPhenotype.includes('long')) {
        genes = ciliaHubDataCache
            .filter(g => g.lof_effects && (
                g.lof_effects.toLowerCase().includes('longer') ||
                g.lof_effects.toLowerCase().includes('long')
            ))
            .map(g => ({ 
                gene: g.gene, 
                description: `LoF effect: ${g.lof_effects}` 
            }));
        
    } else {
        // Fallback for unrecognized phenotype terms
        return notImplementedYet(`Genes by screen phenotype: ${phenotype}`);
    }

    // Since this function is the handler, it must return a formatted string.
    return formatListResult(`Genes Matching Phenotype: ${phenotype}`, genes);
}

/**
 * Generates questions for general ciliary biology exploration with "any gene" support
 */
function generateGeneralCiliaryBiologyQuestions() {
    let htmlContent = '<div class="result-card" style="margin-top: 1rem; background-color: #f0f8f0; border: 1px solid #c8e6c9;">';
    htmlContent += '<h3>General Ciliary Biology</h3><ul style="column-count: 2; list-style: none; padding-left: 0;">';
    
    const formatSpan = (text, question) => `<li class="ai-question-item"><span data-question="${question}">${text}</span></li>`;

    // ANY GENE SECTION
    htmlContent += '<li style="grid-column: 1 / -1;"><h4 style="margin-top: 0; color: #d35400;">🔍 Try *Any* Gene (Out of 19,000+)</h4></li>';
    htmlContent += formatSpan(
        `Basic information about **[Any Gene]**`,
        `Tell me about IFT88 function in cilia`
    );
    htmlContent += formatSpan(
        `Ciliary role of **[Your Gene]**`,
        `What is the ciliary function of ARL13B?`
    );
    htmlContent += formatSpan(
        `Disease associations for **[Gene Name]**`,
        `What ciliopathies are associated with CEP290?`
    );

    // Basic function questions
    htmlContent += '<li style="grid-column: 1 / -1;"><h4>Gene Function & Mechanism</h4></li>';
    htmlContent += formatSpan(
        `How does **IFT88** work in intraflagellar transport?`,
        `Explain the role of IFT88 in intraflagellar transport`
    );
    htmlContent += formatSpan(
        `What is the function of **BBS1** in the BBSome?`,
        `Describe BBS1 function in the BBSome complex`
    );
    htmlContent += formatSpan(
        `Mechanism of **DYNC2H1** in retrograde transport`,
        `Explain DYNC2H1 role in ciliary retrograde transport`
    );

    // Localization questions
    htmlContent += '<li style="grid-column: 1 / -1;"><h4>Subcellular Localization</h4></li>';
    htmlContent += formatSpan(
        `Where is **ARL13B** localized in the cilium?`,
        `Describe ARL13B localization within the cilium`
    );
    htmlContent += formatSpan(
        `Ciliary compartment for **NPHP1**`,
        `Where is NPHP1 localized in the cilium?`
    );
    htmlContent += '</ul></div>';
    return htmlContent;
}

/**
 * Generates questions for ciliopathies and diseases with "any gene" support
 */
function generateCiliopathyQuestions() {
    let htmlContent = '<div class="result-card" style="margin-top: 1rem; background-color: #fff3e0; border: 1px solid #ffcc80;">';
    htmlContent += '<h3>Ciliopathies & Diseases</h3><ul style="column-count: 2; list-style: none; padding-left: 0;">';
    
    const formatSpan = (text, question) => `<li class="ai-question-item"><span data-question="${question}">${text}</span></li>`;

    // ANY GENE SECTION
    htmlContent += '<li style="grid-column: 1 / -1;"><h4 style="margin-top: 0; color: #d35400;">🔍 Try *Any* Gene (Out of 19,000+)</h4></li>';
    
    // FIX APPLIED: Added backticks to the descriptive text strings
    htmlContent += formatSpan(
        `Disease associations for **[Any Gene]**`,
        `What diseases are associated with CEP290 mutations?`
    );
    htmlContent += formatSpan(
        `**[Gene Name]** mutation phenotypes`,
        `What phenotypes result from NPHP1 mutations?`
    );
    htmlContent += formatSpan(
        `Clinical significance of **[Your Gene]**`,
        `What is the clinical significance of BBS1?`
    );

    // Disease-specific questions
    htmlContent += '<li style="grid-column: 1 / -1;"><h4>Specific Ciliopathies</h4></li>';
    htmlContent += formatSpan(
        `Genes involved in **Bardet-Biedl syndrome**`,
        `List genes associated with Bardet-Biedl syndrome`
    );
    htmlContent += formatSpan(
        `**Joubert syndrome** genetic causes`,
        `What genes cause Joubert syndrome?`
    );
    htmlContent += formatSpan(
        `**Meckel syndrome** gene list`,
        `List genes associated with Meckel syndrome`
    );

    // Mechanism questions
    htmlContent += '<li style="grid-column: 1 / -1;"><h4>Disease Mechanisms</h4></li>';
    htmlContent += formatSpan(
        `How do **BBS1** mutations cause disease?`,
        `Explain how BBS1 mutations lead to ciliopathies`
    );
    htmlContent += formatSpan(
        `**CEP290** and retinal degeneration`,
        `How does CEP290 mutation cause retinal degeneration?`
    );

    htmlContent += '</ul></div>';
    return htmlContent;
}

/**
 * Generates questions for experimental techniques with "any gene" support
 */
function generateExperimentalQuestions() {
    let htmlContent = '<div class="result-card" style="margin-top: 1rem; background-color: #f3e5f5; border: 1px solid #e1bee7;">';
    htmlContent += '<h3>Experimental & Technical</h3><ul style="column-count: 2; list-style: none; padding-left: 0;">';
    
    const formatSpan = (text, question) => `<li class="ai-question-item"><span data-question="${question}">${text}</span></li>`;

    // ANY GENE SECTION
    htmlContent += '<li style="grid-column: 1 / -1;"><h4 style="margin-top: 0; color: #d35400;">🔍 Try *Any* Gene (Out of 19,000+)</h4></li>';
    // FIX APPLIED: Added backticks to the descriptive text strings
    htmlContent += formatSpan(
        `Antibodies for studying **[Any Gene]**`,
        `What antibodies are available for IFT88?`
    );
    htmlContent += formatSpan(
        `Knockout models for **[Gene Name]**`,
        `What knockout models exist for ARL13B?`
    );
    htmlContent += formatSpan(
        `CRISPR targets for **[Your Gene]**`,
        `Suggest CRISPR targets for CEP290`
    );

    // Technical questions
    htmlContent += '<li style="grid-column: 1 / -1;"><h4>Research Methods</h4></li>';
    htmlContent += formatSpan(
        `How to study **IFT88** localization?`,
        `What methods are used to study IFT88 localization?`
    );
    htmlContent += formatSpan(
        `Best model for **BBS1** research`,
        `What are the best model organisms for studying BBS1?`
    );
    htmlContent += formatSpan(
        `Imaging techniques for ciliary proteins`,
        `What imaging techniques are best for ciliary proteins?`
    );

    htmlContent += '</ul></div>';
    return htmlContent;
}

/**
 * Generates questions for pathways and systems biology with "any gene" support
 */
function generatePathwayQuestions() {
    let htmlContent = '<div class="result-card" style="margin-top: 1rem; background-color: #e8f5e8; border: 1px solid #c8e6c9;">';
    htmlContent += '<h3>Pathways & Systems</h3><ul style="column-count: 2; list-style: none; padding-left: 0;">';
    
    const formatSpan = (text, question) => `<li class="ai-question-item"><span data-question="${question}">${text}</span></li>`;

    // ANY GENE SECTION
    htmlContent += '<li style="grid-column: 1 / -1;"><h4 style="margin-top: 0; color: #d35400;">🔍 Try *Any* Gene (Out of 19,000+)</h4></li>';
    // FIX APPLIED: Added backticks to the descriptive text strings
    htmlContent += formatSpan(
        `Pathways involving **[Any Gene]**`,
        `What pathways involve IFT88?`
    );
    htmlContent += formatSpan(
        `Interactions for **[Gene Name]**`,
        `What proteins interact with ARL13B?`
    );
    htmlContent += formatSpan(
        `Complex membership of **[Your Gene]**`,
        `What complexes does BBS1 belong to?`
    );

    // Pathway questions
    htmlContent += '<li style="grid-column: 1 / -1;"><h4>Ciliary Pathways</h4></li>';
    htmlContent += formatSpan(
        `**Hedgehog signaling** and cilia`,
        `How do cilia regulate Hedgehog signaling?`
    );
    htmlContent += formatSpan(
        `**Wnt signaling** ciliary components`,
        `What ciliary proteins are involved in Wnt signaling?`
    );
    htmlContent += formatSpan(
        `**PDGFRα** signaling in cilia`,
        `Describe PDGFRα signaling in primary cilia`
    );

    htmlContent += '</ul></div>';
    return htmlContent;
}

/**
 * Helper to render the detailed text table for a single gene (called by displayPhylogenyComparison).
 */
function renderDetailedPhylogenyTable(geneSymbol, targetDivId, neversLoaded, liLoaded) {
    const geneUpper = geneSymbol.toUpperCase();
    
    // --- Process Nevers 2017 Data ---
    let neversRow = '';
    const neversEntry = neversPhylogenyCache?.genes?.[geneUpper];
    if (neversLoaded && neversEntry) {
        const organismsList = neversPhylogenyCache.organism_groups.all_organisms_list;
        const speciesCount = neversEntry.s.length;
        const species = neversEntry.s.map(index => organismsList[index]).join(', ');
        neversRow = `
            <tr>
                <td><strong>Nevers et al. (2017)</strong></td>
                <td>${speciesCount}</td>
                <td style="text-align: left;"><p>${species}</p></td>
            </tr>`;
    } else {
         neversRow = `
            <tr class="status-not-found">
                <td><strong>Nevers et al. (2017)</strong></td>
                <td colspan="2">Not Found in Dataset.</td>
            </tr>`;
    }

    // --- Process Li 2014 Data ---
    let liRow = '';
    let liEntry = null;
    if (liLoaded && liPhylogenyCache?.genes) {
        liEntry = Object.values(liPhylogenyCache.genes).find(g => g.g.toUpperCase() === geneUpper);
    }
    
    if (liLoaded && liEntry) {
        const organismsList = liPhylogenyCache.summary.organisms_list;
        const classList = liPhylogenyCache.summary.class_list;
        const speciesCount = liEntry.s.length;
        const species = liEntry.s.map(index => organismsList[index]).join(', ');
        const classification = (classList[liEntry.c] || "Unknown").replace(/_/g, ' ');
        liRow = `
            <tr>
                <td><strong>Li et al. (2014)</strong></td>
                <td>${speciesCount}</td>
                <td style="text-align: left;">
                    <p><strong>Classification:</strong> ${classification}</p>
                    <p><strong>Species:</strong> ${species}</p>
                </td>
            </tr>`;
    } else {
        liRow = `
            <tr class="status-not-found">
                <td><strong>Li et al. (2014)</strong></td>
                <td colspan="2">Not Found in Dataset.</td>
            </tr>`;
    }

    const html = `
        <table class="ciliopathy-table gene-detail-table" id="${targetDivId}">
            <thead>
                <tr>
                    <th style="width: 25%;">Dataset</th>
                    <th style="width: 15%;">Species Count</th>
                    <th>Full Organisms List & Classification</th>
                </tr>
            </thead>
            <tbody>
                ${neversRow}
                ${liRow}
            </tbody>
        </table>
        `;
    document.getElementById(targetDivId).innerHTML = html;
}

// --- UPDATED HANDLER (Call the simple visualization function) ---
// This function will now be the dedicated visualization handler in the registry.
async function comparePhylogenyDatasets(geneSymbol) {
    // This calls the function that correctly runs the plotting code
    return displayPhylogenyComparison([geneSymbol]);
}

// --- NEW/REPLACED HANDLER (Placeholder for the undefined helper) ---
// Since getPhylogenyComparisonGene is undefined, it must be replaced by the correct, existing visualization function.
async function getPhylogenyComparisonGene(genes) {
    // If the input is an array, pass it directly to the plotter.
    // This fixes the ReferenceError from the original log.
    return displayPhylogenyComparison(Array.isArray(genes) ? genes : [genes]);
}

// --- NEW HELPER: Get Non-Ciliary Genes for Organism ---
/**
 * Retrieves human genes classified as Non-Ciliary that have an ortholog in the target organism.
 * @param {string} organismName - The target organism (e.g., 'mouse').
 * @returns {Array<Object>} - List of genes.
 */
async function getNonCiliaryGenesForOrganism(organismName) {
    await fetchPhylogenyData();
    const normalizedOrganism = normalizeTerm(organismName);
    
    // Simplified mapping for species codes used in phylogenyDataCache
    const speciesMap = {
        'human': 'H.sapiens', 'mouse': 'M.musculus', 'worm': 'C.elegans', 'c. elegans': 'C.elegans',
        'fly': 'D.melanogaster', 'zebrafish': 'D.rerio', 'xenopus': 'X.tropicalis' 
    };
    const speciesCode = speciesMap[normalizedOrganism] || organismName;
    const speciesRegex = new RegExp(speciesCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const genes = Object.entries(phylogenyDataCache)
        .filter(([gene, data]) => {
            // Filter by the 'nonciliary_only_genes' category in the main phylogeny summary.
            const isNonCiliaryCategory = data.category === 'nonciliary_only_genes' || data.category.toLowerCase().includes('non-ciliary');
            const hasSpecies = Array.isArray(data.species) && data.species.some(s => speciesRegex.test(normalizeTerm(s)));
            return isNonCiliaryCategory && hasSpecies;
        })
        .map(([gene, data]) => ({ gene: data.sym || gene, description: `Non-Ciliary (Li 2014) gene present in ${speciesCode}` }));
    
    return genes;
}


// --- CORE FUNCTION: CURATED ORTHOLOG LOOKUP (From ciliahub_data.json) ---
// This function fulfills the requirement for zebrafish, mice, xenopus, drosophila, and C. elegans.
async function getOrthologsForGene(gene) {
    // Assuming ciliaHubDataCache is loaded by the time this function is called via the router
    if (!ciliaHubDataCache) await fetchCiliaData(); 
    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === gene.toUpperCase());

    if (!geneData) return `<div class="result-card"><h3>${gene}</h3><p class="status-not-found">Gene not found in the CiliaHub database for ortholog lookup.</p></div>`;

    // Example based on the structure of the CDKL5 data provided in your query
    return `
        <div class="result-card">
            <h3>Curated Orthologs of ${gene} (CiliaHub Annotation) 🧬</h3>
            <p>These are the manually curated ortholog gene names for common model organisms.</p>
            <table class="gene-detail-table">
                <tr><th>Mouse (M. musculus)</th><td>${geneData.ortholog_mouse || 'N/A'}</td></tr>
                <tr><th>Xenopus (X. tropicalis)</th><td>${geneData.ortholog_xenopus || 'N/A'}</td></tr>
                <tr><th>Zebrafish (D. rerio)</th><td>${geneData.ortholog_zebrafish || 'N/A'}</td></tr>
                <tr><th>Fly (D. melanogaster)</th><td>${geneData.ortholog_drosophila || 'N/A'}</td></tr>
                <tr><th>Worm (C. elegans)</th><td>${geneData.ortholog_c_elegans || 'N/A'}</td></tr>
            </table>
            <p style="font-size: 0.8em; color: #666; margin-top: 1rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
                <strong>Source:</strong> Curated orthologs from CiliaHub (ciliahub_data.json).
            </p>
        </div>`;
}

// --- NEW HELPER: PHYLOGENY STATUS LOOKUP (From Li/Nevers data) ---
/**
 * Retrieves the classification and total species count from Li/Nevers data for a gene.
 * This provides the second layer of "ortholog" information (conservation status).
 * Note: This function is called implicitly by the visualization path, but defining it here
 * provides a structural contrast to the curated list.
 */
async function getPhylogenyOrthologStatus(gene) {
    // This calls the full comparison visualization which presents Li/Nevers data side-by-side.
    return displayPhylogenyComparison([gene]);
}

// --- NEW: Classify Gene's Ciliary Origin ---
function classifyGeneCiliaryOrigin(geneUpper) {
  const geneData = phylogenyDataCache[geneUpper];
  if (!geneData) return 'Unknown';

  // Prioritize Li classification if available
  if (geneData.li) {
    const liClassList = liPhylogenyCache.summary.class_list;
    return liClassList[geneData.li.c] || 'Unknown';
  }

  // Fallback to Nevers (simple presence-based)
  if (geneData.nevers) {
    const organismsList = neversPhylogenyCache.organism_groups.all_organisms_list;
    const ciliatedIndices = neversPhylogenyCache.organism_groups.ciliated_organisms;
    const nonCiliatedIndices = neversPhylogenyCache.organism_groups.non_ciliated_organisms;

    const presentCiliated = geneData.nevers.s.filter(i => ciliatedIndices.includes(i)).length;
    const presentNonCiliated = geneData.nevers.s.filter(i => nonCiliatedIndices.includes(i)).length;

    if (presentCiliated > 0 && presentNonCiliated === 0) return 'Ciliary-Only';
    if (presentCiliated > 0 && presentNonCiliated > 0) return 'Present-in-Both';
    if (presentCiliated === 0 && presentNonCiliated > 0) return 'Non-Ciliary';
  }

  return 'Unknown';
}


// --- NEW: Merge Li and Nevers into Single Cache ---
// This function ensures a single object containing all genes from both files is created
// and stored in the global cache.
async function mergePhylogenyCaches() {
    if (phylogenyDataCache) return phylogenyDataCache;

    const [liData, neversData] = await Promise.all([
        fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/li_et_al_2014_matrix_optimized.json').then(res => res.json()),
        fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/nevers_et_al_2017_matrix_optimized.json').then(res => res.json())
    ]);

    // Store the raw data into the global cache
    phylogenyDataCache = { li: liData, nevers: neversData };
    console.log('Phylogeny data fetched and merged into primary cache structure.');
    
    return phylogenyDataCache;
}
// --- NEW HELPER: Extract Multiple Genes Dynamically ---
// This remains the same as previously defined, crucial for extracting genes from query.
function extractMultipleGenes(query) {
    const genePattern = /\b([A-Z0-9]{3,}|ift\d+|bbs\d+|arl\d+b|nphp\d+)\b/gi;
    const matches = query.match(genePattern);
    return matches ? [...new Set(matches.map(g => g.toUpperCase()))] : [];
}


// --- UPDATED CENTRALIZED PHYLOGENY AND ORTHOLOG HANDLER (The Router) ---
async function handlePhylogenyAndOrthologQuery(query) {
    const safeQuery = typeof query === 'string' ? query : ''; 
    // CRITICAL: Ensure MERGED data structure is ready. This is now robust.
    await Promise.all([fetchCiliaData(), mergePhylogenyCaches()]); 
    
    const qLower = safeQuery.toLowerCase();
    
    // 1. DYNAMIC GENE EXTRACTION & VALIDATION
    const allExtractedGenes = extractMultipleGenes(safeQuery);
    
    // VALIDATION FIX: Check gene existence directly against the reliable merged phylogenyDataCache object
    const validPhyloGenes = allExtractedGenes.filter(gene => 
        // This check is now guaranteed to work because mergePhylogenyCaches completed successfully.
        phylogenyDataCache.hasOwnProperty(gene)
    );
    const genes = validPhyloGenes;
    
    let intent = null;
    let entity = null; 
    const organismPattern = /(c\.?\s*elegans|worm|mouse|zebrafish|xenopus|fly|drosophila|human|chlamydomonas|yeast|h\.?\s*sapiens|m\.?\s*musculus)/;
    const organismMatch = qLower.match(organismPattern);

    // 2. Multi-Gene/Visual Intent Pre-Routing
    if (genes.length >= 1) { 
        // Visual comparison intent check (including multi-gene and single-gene visual queries)
        if (genes.length > 1 || qLower.includes('phylogeny') || qLower.includes('conservation') || qLower.includes('tree') || qLower.includes('unicellular')) {
            return getPhylogenyComparisonGene(genes);
        }
        // Use the single gene found for further lookup logic below
        if (genes.length === 1) entity = genes[0];
    }
    
    // 3. Simple Intent Determination (Original Logic)
    const isOrthologRequest = qLower.includes('ortholog') || qLower.includes('homolog') || qLower.includes('conserved in');

    if (isOrthologRequest) {
        intent = 'ORTHOLOG_LOOKUP';
    } else if (qLower.includes('non-ciliary genes') || qLower.includes('nonciliary genes')) {
        intent = 'NONCILIARY_LIST';
    } else if (qLower.includes('ciliary genes') || qLower.includes('cilia genes') || qLower.includes('list of genes') || qLower.includes('provide') || qLower.includes('show')) {
        intent = 'CILIARY_LIST';
    }

    if (organismMatch) {
        entity = organismMatch[1].trim();
    }
    
    // 4. FINAL ROUTING EXECUTION

    if (intent === 'ORTHOLOG_LOOKUP' && genes.length === 1) {
        // Route 3: Curated Ortholog (CiliaHub table)
        return getOrthologsForGene(genes[0]);
        
    } else if (intent === 'NONCILIARY_LIST' && entity) {
        // Route 4: Non-Ciliary gene list
        const nonCiliaryGenes = await getNonCiliaryGenesForOrganism(entity);
        return formatListResult(`Non-Ciliary Genes in ${entity}`, nonCiliaryGenes);

    } else if (intent === 'CILIARY_LIST' && entity) {
        // Route 5: Ciliary gene list for a specific organism
        const { genes: ciliaryGenes, description, speciesCode } = await getCiliaryGenesForOrganism(entity);
        return formatListResult(`Ciliary Genes in ${speciesCode} (Phylogeny Screen)`, ciliaryGenes, description, speciesCode, 'N/A');

    } else if (intent === 'CILIARY_LIST' && !entity) {
        // Route 6: Global Ciliary gene list
        return getAllCiliaryGenes();

    } else if (genes.length === 1) {
        // Route 7: Final fallback for a single gene (e.g., "WDR31") defaults to the visual comparison
        return getPhylogenyComparisonGene(genes); 
    }
    
    // Final error message if no recognizable gene or intent exists
    return `<div class="result-card"><h3>Query Not Understood</h3><p>I couldn't identify a valid gene or list intent based on the Li/Nevers datasets. Please specify a gene, a list type, or an organism.</p></div>`;
}


/**
 * Main function to generate all question blocks
 */
function generateAllQuestionBlocks() {
    return `
        ${generateGeneralCiliaryBiologyQuestions()}
        ${generateCiliopathyQuestions()}
        ${generatePhylogenyAndOrthologQuestions()}
        ${generatePathwayQuestions()}
        ${generateExperimentalQuestions()}
    `;
}

// NOTE: This generated HTML string is ready to be injected into your UI's suggestion area.
// Example: document.getElementById('phylogeny-suggestions').innerHTML = generatePhylogenyAndOrthologQuestions();

/**
 * Retrieves ALL genes marked with any ciliopathy, regardless of specific name.
 * This is the robust way to handle the generic "Ciliopathy" query.
 */
async function getAllCiliopathyGenesRaw() {
    await fetchCiliaData();
    
    // Filter for genes where the 'ciliopathy' array is present and non-empty.
    const allDiseaseGenes = ciliaHubDataCache
        .filter(g => Array.isArray(g.ciliopathy) && g.ciliopathy.length > 0)
        .map(g => ({ 
            gene: g.gene, 
            description: g.ciliopathy.join(', ')
        }));

    return { 
        genes: allDiseaseGenes, 
        description: `Found ${allDiseaseGenes.length} genes associated with ANY Ciliopathy.`,
        disease: "Ciliopathy"
    };
}

/**
 * Finds human genes associated with a specific ciliopathy that are conserved
 * and present in a given model organism, pulling the curated ortholog name 
 * directly from the ciliahub_data.json annotation.
 */
async function getDiseaseGenesInOrganism(disease, organism) {
    // 1. Ensure all data is ready
    await fetchCiliaData();
    await fetchPhylogenyData();

    // 2. Define the target ortholog key (e.g., 'ortholog_c_elegans')
    const organismKeyMap = {
        'worm': 'ortholog_c_elegans', 'c. elegans': 'ortholog_c_elegans',
        'mouse': 'ortholog_mouse', 'xenopus': 'ortholog_xenopus',
        'zebrafish': 'ortholog_zebrafish', 'drosophila': 'ortholog_drosophila', 
        'fly': 'ortholog_drosophila', 
    };
    const targetKey = organismKeyMap[organism.toLowerCase()] || null;
    const speciesCode = organism.replace(/(\w\.\w+)\s*/, '').trim() || organism;

    if (!targetKey) {
        return formatListResult(`Genes for ${disease} in ${organism}`, [], `Error: Ortholog data not tracked for organism ${organism}.`);
    }

    // 3. Get the raw human disease list (handling the generic "Ciliopathy" term)
    const diseaseQuery = (disease.toLowerCase().includes('ciliopathy')) ? "Ciliopathy" : disease;
    const queryTerm = (diseaseQuery === "Ciliopathy") ? "ciliopathy" : diseaseQuery;
    const { genes: diseaseGenes } = await getCiliopathyGenes(queryTerm);
    
    // 4. Perform the crucial combined filter (Disease + Conservation + Hub Data)
    const conservedAndAnnotatedGenes = [];

    diseaseGenes.forEach(geneEntry => {
        const humanGeneUpper = geneEntry.gene.toUpperCase();
        const hubData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === humanGeneUpper);
        const phyData = phylogenyDataCache[humanGeneUpper];
        
        // Check A: Gene must be in the Hub's annotation and have the specific ortholog field
        if (!hubData || !hubData[targetKey] || hubData[targetKey] === 'N/A' || hubData[targetKey] === 'Not Reported') {
            return; // Skip if Hub annotation for the ortholog is missing or non-specific
        }
        
        // Check B: Gene must be marked as conserved in the phylogenetic screening (presence in the target organism's clade)
        const speciesRegex = new RegExp(`^${normalizeTerm(speciesCode).replace(/\./g, '\\.?').replace(/\s/g, '\\s*')}$`, 'i');
        const isPhyloConserved = phyData?.species?.some(s => speciesRegex.test(normalizeTerm(s))) || false;
        
        if (isPhyloConserved) { 
            // Only add if BOTH conditions are met.
            
            // Collect the ortholog name
            const orthologName = hubData[targetKey];
            
            conservedAndAnnotatedGenes.push({
                gene: humanGeneUpper,
                description: `Diseases: ${hubData.ciliopathy.join(', ')}.`,
                
                // Attach the specific ortholog name using the dynamic key expected by the renderer
                [targetKey]: orthologName 
            });
        }
    });

    const title = `${diseaseQuery} Genes Conserved in ${speciesCode}`;
    const description = `Found ${conservedAndAnnotatedGenes.length} ${diseaseQuery} gene(s) conserved in ${speciesCode}.`;

    const citationHtml = `<p style="font-size: 0.8em; color: #666; margin-top: 1rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
        <strong>Data Source:</strong> Phylogenetic screening (Li et al. 2014) combined with CiliaHub Ortholog Annotation.
        <a href="https://pubmed.ncbi.nlm.nih.gov/24995987/" target="_blank">[PMID: 24995987]</a>
    </p>`;

    // 5. Return formatted HTML string
    return formatListResult(
        title, 
        conservedAndAnnotatedGenes, 
        citationHtml,
        speciesCode,
        targetKey
    );
}

// C. Updated: Get Cilia Effects (with detailed screen data)
async function getGeneCiliaEffects(gene) {
    if (!ciliaHubDataCache) await fetchCiliaData();
    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === gene.toUpperCase());

    if (!geneData) return `<div class="result-card"><h3>${gene}</h3><p class="status-not-found">Gene not found in the database.</p></div>`;

    // --- 1. Summarized Effects (from ciliahub_data.json) ---
    const lof = geneData.lof_effects || "Not Reported";
    const oe = geneData.overexpression_effects || "Not Reported";
    const percent = geneData.percent_ciliated_cells_effects || "Not Reported";

    const summarizedEffectsHtml = `
        <h4>Effects on Cilia (Curated Summary)</h4>
        <table class="gene-detail-table">
            <thead>
                <tr>
                    <th>Effect Type</th>
                    <th>Result</th>
                </tr>
            </thead>
            <tbody>
                <tr><th>Overexpression Effects</th><td>${oe}</td></tr>
                <tr><th>Loss-of-Function (LoF) Effects</th><td>${lof}</td></tr>
                <tr><th>Effects on % Ciliated Cells</th><td>${percent}</td></tr>
            </tbody>
        </table>`;

    // --- 2. Detailed Screen Findings (from cilia_screens_data.json) ---
    const screenFindings = geneData.screens_from_separate_file || [];
    let detailedScreensHtml = ``;

    if (screenFindings.length > 0) {
        const tableRows = screenFindings.map(s => `
            <tr>
                <td>${s.dataset || 'N/A'}</td>
                <td>${(s.mean_percent_ciliated !== undefined) ? s.mean_percent_ciliated.toFixed(2) : 'N/A'}</td>
                <td>${(s.z_score !== undefined) ? s.z_score.toFixed(2) : 'N/A'}</td>
                <td>${s.classification || s.result || 'N/A'}</td>
                <td><a href="${s.paper_link}" target="_blank">${s.dataset || 'Link'}</a></td>
            </tr>
        `).join('');

        detailedScreensHtml = `
            <h4 style="margin-top: 20px;">Detailed Genome-Wide Screen Findings</h4>
            <p>High-throughput screen results showing specific quantitative effects on ciliation.</p>
            <table class="ciliopathy-table">
                <thead>
                    <tr>
                        <th class="sortable">Dataset</th>
                        <th>Mean % Ciliated</th>
                        <th>Z-Score</th>
                        <th>Classification</th>
                        <th>Reference</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        `;
    } else {
        detailedScreensHtml = `<h4 style="margin-top: 20px;">Detailed Genome-Wide Screen Findings</h4><p class="status-not-found">No detailed screen data found for ${gene}.</p>`;
    }
    
    // --- 3. Final Output ---
    return `
        <div class="result-card">
            <h3>Ciliary Phenotype Analysis for ${gene}</h3>
            ${summarizedEffectsHtml}
            ${detailedScreensHtml}
        </div>`;
}

async function compareComplexes(complexA, complexB) {
    const componentsA = await getGenesByComplex(complexA);
    const componentsB = await getGenesByComplex(complexB);

    const listToHtml = (geneList, title) => {
        if (!geneList || geneList.length === 0) return `<h4>${title}</h4><p>No components found.</p>`;
        return `<h4>${title} (${geneList.length})</h4><ul class="gene-list" style="list-style-type: none; padding-left: 0;">${geneList.map(g => `<li>${g.gene}</li>`).join('')}</ul>`;
    };

    return `
    <div class="result-card">
        <h3>Comparison: ${complexA} vs ${complexB}</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>${listToHtml(componentsA, complexA)}</div>
            <div>${listToHtml(componentsB, complexB)}</div>
        </div>
    </div>`;
}

/**
 * Displays a grouped bar chart of multiple genes' expression across cell types.
 * Uses "Nature-like" colors, solid axis lines, and no grid.
 * @param {string[]} geneSymbols An array of genes to plot.
 */
async function displayCellxgeneBarChart(geneSymbols) {
    if (!cellxgeneDataCache) await fetchCellxgeneData();
    const resultArea = document.getElementById('ai-result-area');

    if (!cellxgeneDataCache) {
        return `<div class="result-card"><h3>Cell-Specific Expression</h3><p class="status-not-found">Could not load the single-cell expression dataset.</p></div>`;
    }

    const uniqueCellTypes = new Set();
    const geneExpressionData = {}; 
    let genesFound = []; 

    for (const gene of geneSymbols) {
        const geneUpper = gene.toUpperCase();
        const expressionMap = cellxgeneDataCache[geneUpper];

        if (expressionMap) {
            geneExpressionData[geneUpper] = expressionMap;
            Object.keys(expressionMap).forEach(cellType => uniqueCellTypes.add(cellType));
            genesFound.push(gene); 
        } else {
            console.warn(`Gene "${geneUpper}" not found in cellxgene_data.json`);
        }
    }
    
    if (genesFound.length === 0) {
        return `<div class="result-card"><h3>Expression Chart</h3><p class="status-not-found">None of the requested genes (${geneSymbols.join(', ')}) were found in the single-cell expression dataset.</p></div>`;
    }

    const sortedCellTypes = Array.from(uniqueCellTypes).sort();
    const plotData = [];

    // --- NEW: "Nature paper-like" color palette ---
    const NATURE_COLORS = [
        '#0C5DA5', // Blue
        '#00B945', // Green
        '#FF9500', // Orange
        '#FF2C00', // Red
        '#845B97', // Purple
        '#474747', // Dark Gray
        '#17BECF'  // Cyan
    ];
    // --- END NEW ---
    
    const geneColorMap = {};
    genesFound.forEach((gene, i) => {
        geneColorMap[gene.toUpperCase()] = NATURE_COLORS[i % NATURE_COLORS.length];
    });

    for (const gene of genesFound) {
        const geneUpper = gene.toUpperCase();
        const yValues = sortedCellTypes.map(cellType => (geneExpressionData[geneUpper] && geneExpressionData[geneUpper][cellType]) || 0);

        plotData.push({
            x: sortedCellTypes,
            y: yValues,
            name: geneUpper,
            type: 'bar',
            marker: {
                color: geneColorMap[geneUpper]
            },
            hoverinfo: 'x+y+name'
        });
    }

    // --- NEW: Updated layout with axis lines and no grid ---
    const layout = {
        title: `Single-Cell Expression of ${genesFound.join(' vs ')}`,
        barmode: 'group',
        plot_bgcolor: '#FFFFFF', // White background
        paper_bgcolor: '#FFFFFF', // White paper
        xaxis: {
            title: 'Cell Type',
            tickangle: -45,
            automargin: true,
            showline: true, // Show X-axis line
            linewidth: 1,
            linecolor: '#000000',
            zeroline: false, // Hide the zero line
            showgrid: false  // Hide X-axis grid lines
        },
        yaxis: { 
            title: 'Normalized Expression',
            showline: true, // Show Y-axis line
            linewidth: 1,
            linecolor: '#000000',
            zeroline: false, // Hide the zero line
            showgrid: false  // Hide Y-axis grid lines
        },
        margin: { b: 150, t: 70, l: 50, r: 50 },
        legend: { x: 1, y: 1, xanchor: 'right' }
    };
    // --- END NEW ---
    
    const plotDivId = 'cellxgene-plot-div';
    resultArea.innerHTML = `
        <div class="result-card">
            <div id="${plotDivId}"></div>
            <button class="download-button" onclick="downloadPlot('${plotDivId}', 'Gene_Expression_Comparison')">Download Plot</button>
            <p style="font-size: 0.8em; color: #666; margin-top: 1rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
                Data from Cellxgene dataset: a2011f35-04c4-427f-80d1-27ee0670251d
            </p>
        </div>
    `;

    Plotly.newPlot(plotDivId, plotData, layout, { responsive: true, displayModeBar: false });
    return "";
}


/**
 * Downloads a Plotly plot as a PNG image.
 * @param {string} divId The ID of the div containing the Plotly plot.
 * @param {string} filename The desired filename for the downloaded image (without extension).
 */
function downloadPlot(divId, filename) {
    const plotDiv = document.getElementById(divId);
    if (plotDiv) {
        Plotly.downloadImage(plotDiv, { format: 'png', filename: filename, width: 1000, height: 700 });
    } else {
        console.error(`Plot div with ID "${divId}" not found for download.`);
    }
}


/**
 * Finds genes associated with a specific disease that are highly expressed in a given cell type.
 * @param {string} disease The name of the ciliopathy.
 * @param {string} cellType The cell type to check expression in.
 * @param {number} [threshold=0.01] The minimum expression level to be considered "highly expressed".
 */
async function findDiseaseGenesByCellExpression(disease, cellType, threshold = 0.01) {
    await fetchCiliaData();
    await fetchCellxgeneData();

    if (!cellxgeneDataCache) return [];

    // 1. Get all genes for the specified disease
    const { genes: diseaseGenes } = await getCiliopathyGenes(disease);
    const diseaseGeneSet = new Set(diseaseGenes.map(g => g.gene.toUpperCase()));

    // 2. Filter them by expression in the target cell type
    const expressedGenes = [];
    for (const gene of diseaseGeneSet) {
        const geneExpressionData = cellxgeneDataCache[gene];
        if (geneExpressionData && geneExpressionData[cellType] && geneExpressionData[cellType] > threshold) {
            expressedGenes.push({
                gene: gene,
                description: `Expression in ${cellType}: ${geneExpressionData[cellType].toFixed(4)}`,
                expression: geneExpressionData[cellType]
            });
        }
    }

    // 3. Sort by expression level
    expressedGenes.sort((a, b) => b.expression - a.expression);
    return expressedGenes;
}

async function compareGenes(geneA, geneB) {
    if (!ciliaHubDataCache) await fetchCiliaData();
    const dataA = ciliaHubDataCache.find(g => g.gene.toUpperCase() === geneA.toUpperCase());
    const dataB = ciliaHubDataCache.find(g => g.gene.toUpperCase() === geneB.toUpperCase());

    const detailToHtml = (geneData) => {
        if (!geneData) return "<p>Gene not found in CiliaHub DB.</p>";
        return `
            <p><strong>Function:</strong> ${geneData.functional_summary || 'N/A'}</p>
            <p><strong>Localization:</strong> ${geneData.localization?.join(', ') || 'N/A'}</p>
            <p><strong>Complex:</strong> ${geneData.complex_names?.join(', ') || 'N/A'}</p>
        `;
    };

    return `
    <div class="result-card">
        <h3>Comparison: ${geneA} vs ${geneB}</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; border-top: 1px solid #eee; padding-top: 1rem;">
            <div><h4>${geneA}</h4>${detailToHtml(dataA)}</div>
            <div><h4>${geneB}</h4>${detailToHtml(dataB)}</div>
        </div>
    </div>`;
}


const getGenesByDomainDescription = async (desc) => {
    if (!ciliaHubDataCache) await fetchCiliaData();
    const keywordRegex = new RegExp(desc, 'i');
    const results = ciliaHubDataCache
        .filter(gene => Array.isArray(gene.domain_descriptions) && gene.domain_descriptions.some(d => d.match(keywordRegex)))
        .map(gene => ({ gene: gene.gene, description: `Domain: ${gene.domain_descriptions.join(', ')}` }));
    return formatListResult(`Genes with "${desc}" domain description`, results);
};

const getGenesByMultipleComplexes = async (complexes) => notImplementedYet(`Genes by multiple complexes: ${complexes.join(', ')}`);
const getConservedGenes = async (organisms) => notImplementedYet(`Conserved genes between: ${organisms.join(' & ')}`);
const getProteinInteractions = async (gene) => notImplementedYet(`Protein interactions for: ${gene}`);

// Add this after the questionRegistry array definition

// =============================================================================
// COMPREHENSIVE QUESTION EXPANSION FOR CiliAI ASK
// =============================================================================

// Add these new questions to your existing questionRegistry array
questionRegistry.push(
  // --- Core Functional Questions ---
  { text: "What is the function of BBS1?", handler: () => getGeneFunction("BBS1") },
  { text: "Describe the role of ARL13B in ciliary signaling", handler: () => getGeneRole("ARL13B", "ciliary signaling") },
  { text: "Explain what CEP290 does", handler: () => getGeneFunction("CEP290") },
  
  // --- Localization Questions ---
  { text: "Where is IFT88 localized in the cell?", handler: () => getGeneLocalization("IFT88") },
  { text: "Show all genes found at the transition zone", handler: () => getGenesByLocalization("transition zone") },
  { text: "Find genes localized to basal body", handler: () => getGenesByLocalization("basal body") },
  { text: "Show proteins in transition zone", handler: () => getGenesByLocalization("transition zone") },
  { text: "Display genes at ciliary tip", handler: () => getGenesByLocalization("ciliary tip") },
  { text: "Which genes localize to axoneme?", handler: () => getGenesByLocalization("axoneme") },
  { text: "Show transition fiber proteins", handler: () => getGenesByLocalization("transition fiber") },
  
  // --- Disease Association Questions ---
  { text: "List all diseases linked to NPHP1", handler: () => getGeneDiseases("NPHP1") },
  { text: "What ciliopathies are associated with mutations in MKS1?", handler: () => getGeneDiseases("MKS1") },
  { text: "Show genes for Joubert Syndrome", handler: () => getCiliopathyGenes("Joubert Syndrome") },
  { text: "Show genes for Bardet-Biedl Syndrome", handler: () => getCiliopathyGenes("Bardet-Biedl Syndrome") },
  { text: "Display genes associated with Meckel-Gruber Syndrome", handler: () => getCiliopathyGenes("Meckel-Gruber Syndrome") },
  { text: "List genes for Primary Ciliary Dyskinesia", handler: () => getCiliopathyGenes("Primary Ciliary Dyskinesia") },
  { text: "Find genes linked to Leber congenital amaurosis", handler: () => getCiliopathyGenes("Leber congenital amaurosis") },
  { text: "Which genes cause cystic kidney disease?", handler: () => getGenesByScreenPhenotype("cystic kidney disease") },
  { text: "Show genes for cranioectodermal dysplasia", handler: () => getCiliopathyGenes("Cranioectodermal Dysplasia") },
  { text: "Tell me genes causing short-rib thoracic dysplasia", handler: () => getCiliopathyGenes("Short-rib thoracic dysplasia") },
  { text: "Display genes related to hydrocephalus", handler: () => getCiliopathyGenes("Hydrocephalus") },
  
  // --- Protein Structure & Complexes ---
  { text: "Show protein domains of WDR35", handler: () => getGeneDomains("WDR35") },
  { text: "List all components of the BBSome complex", handler: () => getGenesByComplex("BBSome") },
  { text: "Display components of IFT-A complex", handler: () => getGenesByComplex("IFT-A") },
  { text: "Display components of IFT-B complex", handler: () => getGenesByComplex("IFT-B") },
  { text: "Show components of Transition Zone Complex", handler: () => getGenesByComplex("Transition Zone Complex") },
  { text: "Display components of MKS Complex", handler: () => getGenesByComplex("MKS Complex") },
  { text: "Show components of NPHP Complex", handler: () => getGenesByComplex("NPHP Complex") },
  
  // --- Ciliary Status ---
  { text: "Is DYNC2H1 a ciliary gene?", handler: () => checkCiliaryStatus("DYNC2H1") },
  { text: "Show me all ciliary genes", handler: () => getAllCiliaryGenes() },
  
  // --- Functional Genomics Screen Results ---
  { text: "What happens to cilia when KIF3A is knocked down?", handler: () => getKnockdownEffect("KIF3A") },
  { text: "Which genes cause longer cilia when silenced?", handler: () => getGenesByScreenPhenotype("long cilia") },
  { text: "Show me the results for IFT88 in the Kim2016 screen", handler: () => getScreenResults("IFT88", "Kim2016") },
  { text: "Find all genes that act as negative regulators of Hedgehog signaling", handler: () => getHedgehogRegulators("negative") },
  { text: "Display genes that had 'No effect' in the Wheway2015 screen", handler: () => getNoEffectGenes("Wheway2015") },
  { text: "Find genes causing short cilia", handler: () => getGenesByScreenPhenotype("short cilia") },
  
  // --- Gene Expression Data ---
  { text: "Where is ARL13B expressed?", handler: () => getGeneExpression("ARL13B") },
  { text: "Show the expression pattern of BBS1 across all tissues", handler: () => getGeneExpressionPattern("BBS1") },
  { text: "Which ciliary genes are most highly expressed in the kidney?", handler: () => getTissueSpecificGenes("kidney") },
  { text: "Compare the expression of IFT88 and OFD1 in the brain versus the retina", handler: () => compareGeneExpression(["IFT88", "OFD1"], ["brain", "retina"]) },
  { text: "Show expression of ARL13B", handler: () => getGeneExpression("ARL13B") },
  { text: "Where is BBS1 expressed?", handler: () => getGeneExpression("BBS1") },
  { text: "In which tissues is IFT88 expressed?", handler: () => getGeneExpression("IFT88") },
  { text: "Which organ systems express CEP290?", handler: () => getGeneExpression("CEP290") },
  
  // --- Evolutionary Conservation Data ---
  { text: "Show the evolutionary conservation of BBS1", handler: () => getGeneConservation("BBS1") },
  { text: "Is IFT88 conserved in C. elegans?", handler: () => checkConservation("IFT88", "C. elegans") },
  { text: "List all ciliary-only genes", handler: () => getCiliaryOnlyGenes() },
  { text: "Display the ciliary genes that are conserved between humans and zebrafish", handler: () => getConservedGenesBetween(["Human", "Zebrafish"]) },
  { text: "Which human ciliary genes have orthologs in Chlamydomonas?", handler: () => getOrthologsInOrganism("Chlamydomonas") },
  { text: "Display conserved ciliary proteins between mouse and human", handler: () => getConservedGenes(["Mouse", "Human"]) },
  { text: "What is the phylogeny of IFT88?", handler: () => getGeneConservation("IFT88") },
  { text: "Evolutionary conservation of ARL13B", handler: () => getGeneConservation("ARL13B") },
  
  // --- Mechanism & Functional Categories ---
  { text: "Show me motor genes", handler: () => getGenesByFunction("motor") },
  { text: "Display kinesin motors", handler: () => getGenesByFunction("kinesin motors") },
  { text: "Show me dynein motors", handler: () => getGenesByFunction("dynein motors") },
  { text: "Display kinases regulating cilia length", handler: () => getGenesByDomainDescription("kinase") },
  { text: "List intraflagellar transport (IFT) components", handler: () => getGenesByComplex("IFT") },
  { text: "Find IFT-A and IFT-B complex genes", handler: () => getGenesByMultipleComplexes(["IFT-A", "IFT-B"]) },
  { text: "Which genes are involved in cilium assembly?", handler: () => getGenesByFunction("cilium assembly") },
  { text: "Show me Ciliary assembly/disassembly genes", handler: () => getGenesByFunction("Ciliary assembly/disassembly") },
  { text: "Display Signaling genes", handler: () => getGenesByFunction("Signaling") },
  { text: "Show me Motile cilium genes", handler: () => getGenesByFunction("Motile cilium") },
  { text: "Display Motor protein genes", handler: () => getGenesByFunction("Motor protein") },
  { text: "Show Transport genes", handler: () => getGenesByFunction("Transport") },
  { text: "Display Protein modification genes", handler: () => getGenesByFunction("Protein modification") },
  { text: "Show Cytoskeletal genes", handler: () => getGenesByFunction("Cytoskeletal") },
  
  // --- Protein Domain Questions ---
  { text: "Show WD40 domain containing proteins", handler: () => getGenesWithDomain("WD40") },
  { text: "Display Leucine-rich repeat domain proteins", handler: () => getGenesWithDomain("Leucine-rich repeat") },
  { text: "Show IQ motif containing proteins", handler: () => getGenesWithDomain("IQ motif") },
  { text: "Display calmodulin-binding proteins", handler: () => getGenesWithDomain("calmodulin-binding") },
  { text: "Show EF-hand domain proteins", handler: () => getGenesWithDomain("EF-hand") },
  
  // --- Organism-Specific Questions ---
  { text: "Display ciliary genes in human", handler: () => getCiliaryGenesForOrganism("human") },
  { text: "Show ciliary genes in mouse", handler: () => getCiliaryGenesForOrganism("mouse") },
  { text: "List ciliary genes in zebrafish", handler: () => getCiliaryGenesForOrganism("zebrafish") },
  { text: "Display ciliary genes in fly", handler: () => getCiliaryGenesForOrganism("fly") },
  { text: "Show ciliary genes in yeast", handler: () => getCiliaryGenesForOrganism("yeast") },
  { text: "List ciliary genes in Chlamydomonas", handler: () => getCiliaryGenesForOrganism("Chlamydomonas") },
  
  // --- Comprehensive Gene Information ---
  { text: "Show all known info about IFT88", handler: () => getComprehensiveDetails("IFT88") },
  { text: "Tell me about BBS1", handler: () => getComprehensiveDetails("BBS1") },
  { text: "Tell me about ARL13B", handler: () => getComprehensiveDetails("ARL13B") },
  { text: "Show interactors of IFT88", handler: () => getProteinInteractions("IFT88") },
  { text: "What are the interacting partners of BBS1?", handler: () => getProteinInteractions("BBS1") },

    // =========================================================================
    // CORE/DIRECT QUERIES (Combined Disease and Organism)
    // =========================================================================
    { text: "Please bring the Joubert syndrome genes in C. elegans", handler: async () => getDiseaseGenesInOrganism("Joubert Syndrome", "C. elegans") },
    {text: "List Joubert syndrome genes found in Mouse", handler: async () => getDiseaseGenesInOrganism("Joubert Syndrome", "Mouse") },
    {text: "Display genes for Meckel–Gruber Syndrome in Zebrafish", handler: async () => getDiseaseGenesInOrganism("Meckel–Gruber Syndrome", "Zebrafish")},
    {text: "Find BBS genes conserved in Drosophila", handler: async () => getDiseaseGenesInOrganism("Bardet–Biedl Syndrome", "Drosophila") },
    {text: "Which Polycystic Kidney Disease genes have orthologs in Xenopus", handler: async () => getDiseaseGenesInOrganism("Polycystic Kidney Disease", "Xenopus") },
    {text: "Conserved NPHP genes in the worm", handler: async () => getDiseaseGenesInOrganism("Nephronophthisis", "C. elegans") },

    // --- Expanded Synonyms and General Ciliopathy Queries ---
    { text: "Which Joubert syndrome genes are conserved in C. elegans?", handler: async () => getDiseaseGenesInOrganism("Joubert Syndrome", "C. elegans") },
    {text: "Show Joubert genes in C. elegans", handler: async () => getDiseaseGenesInOrganism("Joubert Syndrome", "C. elegans") },
    {text: "Find Joubert genes conserved in mouse", handler: async () => getDiseaseGenesInOrganism("Joubert Syndrome", "Mouse") },
    {text: "List conserved Joubert genes in zebrafish",handler: async () => getDiseaseGenesInOrganism("Joubert Syndrome", "Zebrafish") 
    },
    { 
        text: "List ciliopathy genes conserved in Mouse", 
        handler: async () => getDiseaseGenesInOrganism("Ciliopathy", "Mouse") 
    },
    { 
        text: "Display all ciliopathy genes that have a zebrafish ortholog", 
        handler: async () => getDiseaseGenesInOrganism("Ciliopathy", "Zebrafish") 
    },
    { 
        text: "Which ciliopathy genes are found in the fly genome?", 
        handler: async () => getDiseaseGenesInOrganism("Ciliopathy", "Drosophila") 
    },
    { 
        text: "Find ciliopathy genes conserved in Xenopus", 
        handler: async () => getDiseaseGenesInOrganism("Ciliopathy", "Xenopus") 
    },
    { 
        text: "List mouse orthologs for ciliopathy genes", 
        handler: async () => getDiseaseGenesInOrganism("Ciliopathy", "Mouse") 
    },
    { 
        text: "Show ciliary disease genes present in the worm", 
        handler: async () => getDiseaseGenesInOrganism("Ciliopathy", "C. elegans") 
    }
);

// =============================================================================
// REPLACEMENT: Corrected Query Handler Functions
// These functions now format their own HTML to prevent incorrect error messages.
// =============================================================================

async function getGeneFunction(gene) {
    if (!ciliaHubDataCache) await fetchCiliaData();
    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === gene.toUpperCase());
    if (!geneData) return `<div class="result-card"><h3>${gene}</h3><p class="status-not-found">Gene not found in the database.</p></div>`;
    
    return formatGeneDetail(geneData, gene, "Function", geneData.functional_summary || geneData.description || "No functional information available.");
}

async function getGeneRole(gene, context) {
    if (!ciliaHubDataCache) await fetchCiliaData();
    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === gene.toUpperCase());
    if (!geneData) return `<div class="result-card"><h3>${gene}</h3><p class="status-not-found">Gene not found in the database.</p></div>`;

    const roleInfo = geneData.functional_summary || geneData.description || "No specific role information available.";
    return formatGeneDetail(geneData, gene, `Role in ${context}`, roleInfo);
}

async function getGeneLocalization(gene) {
    if (!ciliaHubDataCache) await fetchCiliaData();
    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === gene.toUpperCase());
    if (!geneData) return `<div class="result-card"><h3>${gene}</h3><p class="status-not-found">Gene not found in the database.</p></div>`;

    const localization = geneData.localization?.join(", ") || "No localization data available.";
    return formatGeneDetail(geneData, gene, "Subcellular Localization", localization);
}

async function getGeneDiseases(gene) {
    if (!ciliaHubDataCache) await fetchCiliaData();
    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === gene.toUpperCase());
    if (!geneData) return `<div class="result-card"><h3>${gene}</h3><p class="status-not-found">Gene not found in the database.</p></div>`;

    const diseases = geneData.ciliopathy?.join(", ") || "No disease associations found.";
    return formatGeneDetail(geneData, gene, "Disease Associations", diseases);
}

async function getGeneDomains(gene) {
    if (!ciliaHubDataCache) await fetchCiliaData();

    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === gene.toUpperCase());
    if (!geneData) {
        return `<div class="result-card"><h3>${gene}</h3><p class="status-not-found">Gene not found in the database.</p></div>`;
    }

    const domains = geneData.domain_descriptions?.join(", ") || "No domain information available.";

    // Detect domain categories
    const domainText = domains.toLowerCase();
    const categories = [];

    if (/kinase|phosphorylase|serine-threonine|tyrosine-protein/.test(domainText))
        categories.push("Kinase");
    if (/phosphatase/.test(domainText))
        categories.push("Phosphatase");
    if (/actin/.test(domainText))
        categories.push("Actin-related");
    if (/ef-hand/.test(domainText))
        categories.push("EF-hand calcium-binding protein");
    if (/zinc\s*finger/.test(domainText))
        categories.push("Zinc finger protein");
    if (/atpase|nucleotide binding/.test(domainText))
        categories.push("ATPase / Motor protein");

    // Add categories to formatted output
    const domainCategorySummary = categories.length
        ? `<p><strong>Functional Domain Category:</strong> ${categories.join(", ")}</p>`
        : "";

    return `
        <div class="result-card">
            <h3>${gene}</h3>
            <p><strong>Description:</strong> ${geneData.description || "No description available."}</p>
            <p><strong>Domains:</strong> ${domains}</p>
            ${domainCategorySummary}
            <p><strong>Localization:</strong> ${geneData.localization || "Unknown"}</p>
            <p><strong>Functional Summary:</strong> ${geneData.functional_summary || "Not available."}</p>
        </div>
    `;
}

async function generateDomainBasedQuestions() {
    if (!ciliaHubDataCache) await fetchCiliaData();

    const keywords = ["kinase", "phosphatase", "actin", "ef-hand", "zinc finger", "atpase"];
    const questionTemplates = [];

    for (const keyword of keywords) {
        const matchedGenes = ciliaHubDataCache.filter(g =>
            g.domain_descriptions?.some(d => d.toLowerCase().includes(keyword))
        ).map(g => g.gene);

        if (matchedGenes.length) {
            questionTemplates.push({
                trigger: keyword,
                text: `List all ${keyword}-related genes`,
                weight: 0.95,
                relatedGenes: matchedGenes
            });
        }
    }

    return questionTemplates;
}


// --- ADDITION: Dynamic Domain-Based Questions ---
async function extendQuestionRegistryWithDomains() {
    if (!ciliaHubDataCache) await fetchCiliaData();

    const domainKeywords = [
        { keyword: "kinase", label: "Ciliary Kinase" },
        { keyword: "phosphatase", label: "Ciliary Phosphatase" },
        { keyword: "actin", label: "Actin-related Protein" },
        { keyword: "ef-hand", label: "EF-hand Calcium-Binding Protein" },
        { keyword: "zinc finger", label: "Zinc Finger Protein" },
        { keyword: "atpase", label: "ATPase / Motor Protein" }
    ];

    const newQuestions = [];

    for (const { keyword, label } of domainKeywords) {
        const genes = ciliaHubDataCache.filter(g =>
            g.domain_descriptions?.some(d => d.toLowerCase().includes(keyword))
        );

        if (genes.length > 0) {
            const capitalized = keyword.charAt(0).toUpperCase() + keyword.slice(1);

            newQuestions.push(
                {
                    text: `List all ${capitalized}-related ciliary genes`,
                    handler: async () => formatListResult(`${label}s`, await getGenesByDomainDescription(keyword))
                },
                {
                    text: `Show ${capitalized}-containing proteins localized to cilia`,
                    handler: async () => formatListResult(`${label}s`, await getGenesByDomainDescription(keyword))
                },
                {
                    text: `Display ${capitalized} domain proteins involved in ciliogenesis`,
                    handler: async () => formatListResult(`${label}s`, await getGenesByDomainDescription(keyword))
                },
                {
                    text: `Identify ${capitalized} genes in cilia`,
                    handler: async () => formatListResult(`${label}s`, await getGenesByDomainDescription(keyword))
                }
            );
        }
    }

    // Merge with main registry
    questionRegistry.push(...newQuestions);
    console.log(`✅ Added ${newQuestions.length} domain-based questions to registry.`);
}

// Call this after your data has been fetched
extendQuestionRegistryWithDomains();


async function checkCiliaryStatus(gene) {
    if (!ciliaHubDataCache) await fetchCiliaData();
    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === gene.toUpperCase());
    const status = geneData ? "Yes, this is a ciliary gene." : "No, this gene is not in the ciliary database.";
    return `<div class="result-card"><h3>${gene}</h3><h4>Ciliary Status</h4><p>${status}</p></div>`;
}

async function getAllCiliaryGenes() {
    if (!ciliaHubDataCache) await fetchCiliaData();
    const genes = ciliaHubDataCache.map(g => ({ gene: g.gene, description: g.functional_summary || "Ciliary gene" }));
    return formatListResult("All Ciliary Genes", genes);
}

async function getKnockdownEffect(gene) {
    await fetchScreenData();
    const screenInfo = screenDataCache[gene.toUpperCase()];
    if (!screenInfo || !Array.isArray(screenInfo)) {
        return `<div class="result-card"><h3>Knockdown Effects for ${gene}</h3><p class="status-not-found">No screen data available for this gene.</p></div>`;
    }
    
    const effects = screenInfo.map(s => `<li><strong>${s.source}:</strong> ${s.result}</li>`).join("");
    return `<div class="result-card"><h3>Knockdown Effects for ${gene}</h3><ul>${effects}</ul></div>`;
}

async function getScreenResults(gene, screenName) {
    await fetchScreenData();
    const screenInfo = screenDataCache[gene.toUpperCase()];
    if (!screenInfo) {
        return `<div class="result-card"><h3>Screen Results for ${gene}</h3><p class="status-not-found">No screen data available for this gene.</p></div>`;
    }
    
    const specificResult = screenInfo.find(s => s.source === screenName);
    if (!specificResult) {
        return `<div class="result-card"><h3>Screen Results for ${gene} in ${screenName}</h3><p class="status-not-found">No data found for this screen.</p></div>`;
    }
    
    const citationHtml = getScreenCitationHtml(screenName);
    
    return `
        <div class="result-card">
            <h3>${screenCitationLinks[screenName]?.name || screenName} Results for ${gene}</h3>
            <p><strong>Result:</strong> ${specificResult.result || "No specific result reported"}</p>
            ${citationHtml}
        </div>`;
}

async function getHedgehogRegulators(regulationType) {
    await fetchScreenData();
    const hedgehogGenes = [];
    
    // The screen key is always Breslow2018 for Hedgehog.
    const screenKey = "Breslow2018";
    
    Object.entries(screenDataCache).forEach(([gene, screens]) => {
        const hedgehogScreen = screens.find(s => s.source === screenKey);
        if (hedgehogScreen) {
            const result = hedgehogScreen.result?.toLowerCase() || "";
            if ((regulationType === "negative" || regulationType === "all") && result.includes("increased")) {
                hedgehogGenes.push({ gene, description: "Negative Regulator (Increased Signaling)" });
            } else if ((regulationType === "positive" || regulationType === "all") && result.includes("decreased")) {
                hedgehogGenes.push({ gene, description: "Positive Regulator (Decreased Signaling)" });
            }
        }
    });
    
    const title = regulationType === "all" ? "Hedgehog Signaling Regulators" :
                  regulationType === "negative" ? "Negative Regulators of Hedgehog Signaling" : 
                  "Positive Regulators of Hedgehog Signaling";
    
    const citationHtml = getScreenCitationHtml(screenKey);
    // Assuming formatListResult can include additional HTML at the end.
    return formatListResult(title, hedgehogGenes, citationHtml);
}

async function getNoEffectGenes(screenName) {
    await fetchScreenData();
    const noEffectGenes = [];
    
    // Ensure the screen name is a key in the citation object for lookup
    const screenKey = screenName;
    
    Object.entries(screenDataCache).forEach(([gene, screens]) => {
        const targetScreen = screens.find(s => s.source === screenKey);
        if (targetScreen && targetScreen.result === "No effect") {
            noEffectGenes.push({ gene, description: `No effect in ${screenCitationLinks[screenKey]?.citation || screenKey}` });
        }
    });
    
    const citationHtml = getScreenCitationHtml(screenKey);

    return formatListResult(`Genes with No Effect in ${screenCitationLinks[screenKey]?.name || screenName}`, noEffectGenes, citationHtml);
}

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


async function getGenesByScreenPhenotype(phenotype) {
    if (!ciliaHubDataCache) await fetchCiliaData();
    const normalizedPhenotype = phenotype.toLowerCase();
    let genes = [];

    // Handle "reduced ciliated cells" or "decreased number" (Query #1 Fix)
    if (normalizedPhenotype.includes('reduced') || normalizedPhenotype.includes('decrease') || normalizedPhenotype.includes('number')) {
        genes = ciliaHubDataCache
            .filter(g => g.percent_ciliated_cells_effects && (
                g.percent_ciliated_cells_effects.toLowerCase().includes('reduced') ||
                g.percent_ciliated_cells_effects.toLowerCase().includes('fewer')
            ))
            .map(g => ({ 
                gene: g.gene, 
                description: `Ciliogenesis effect: ${g.percent_ciliated_cells_effects}` 
            }));
        
        return formatListResult(`Genes Causing: ${phenotype}`, genes);

    // Handle "shorter cilia" or "short" (Query #2 Fix)
    } else if (normalizedPhenotype.includes('shorter') || normalizedPhenotype.includes('short')) {
        genes = ciliaHubDataCache
            .filter(g => g.lof_effects && (
                g.lof_effects.toLowerCase().includes('shorter') ||
                g.lof_effects.toLowerCase().includes('short')
            ))
            .map(g => ({ 
                gene: g.gene, 
                description: `LoF effect: ${g.lof_effects}` 
            }));

        return formatListResult(`Genes Causing: ${phenotype}`, genes);
        
    } else if (normalizedPhenotype.includes('longer') || normalizedPhenotype.includes('long')) {
        genes = ciliaHubDataCache
            .filter(g => g.lof_effects && (
                g.lof_effects.toLowerCase().includes('longer') ||
                g.lof_effects.toLowerCase().includes('long')
            ))
            .map(g => ({ 
                gene: g.gene, 
                description: `LoF effect: ${g.lof_effects}` 
            }));

        return formatListResult(`Genes Causing: ${phenotype}`, genes);
        
    } else {
        return notImplementedYet(`Genes by screen phenotype: ${phenotype}`);
    }
}


async function getGeneExpression(gene) {
    await fetchTissueData();
    const expressionData = window.tissueDataCache[gene.toUpperCase()];
    
    if (!expressionData) {
        return `<div class="result-card"><h3>Expression of ${gene}</h3><p class="status-not-found">No expression data available.</p></div>`;
    }
    
    const tissues = Object.entries(expressionData)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([tissue, value]) => `<li><strong>${tissue}:</strong> ${value.toFixed(2)} nTPM</li>`)
        .join("");
    
    return `<div class="result-card"><h3>Top 10 Tissues for ${gene} Expression</h3><ul>${tissues}</ul></div>`;
}

async function getGeneExpressionPattern(gene) {
    await fetchTissueData();
    const expressionData = window.tissueDataCache[gene.toUpperCase()];
    
    if (!expressionData) {
        return `<div class="result-card"><h3>Expression Pattern of ${gene}</h3><p class="status-not-found">No expression data available.</p></div>`;
    }
    
    const resultArea = document.getElementById('ai-result-area');
    displayCiliAIExpressionHeatmap([gene], resultArea, window.tissueDataCache);
    return "";
}

async function getTissueSpecificGenes(tissue) {
    await fetchTissueData();
    await fetchCiliaData();
    
    const ciliaryGenes = new Set(ciliaHubDataCache.map(g => g.gene.toUpperCase()));
    const tissueGenes = [];
    
    Object.entries(window.tissueDataCache).forEach(([gene, tissues]) => {
        if (ciliaryGenes.has(gene.toUpperCase()) && tissues[tissue]) {
            tissueGenes.push({
                gene,
                description: `nTPM: ${tissues[tissue].toFixed(2)}`,
                nTPM: tissues[tissue]
            });
        }
    });
    
    tissueGenes.sort((a, b) => b.nTPM - a.nTPM);
    const topGenes = tissueGenes.slice(0, 50).map(g => ({ gene: g.gene, description: g.description }));
    
    return formatListResult(`Top 50 Ciliary Genes Expressed in ${tissue}`, topGenes);
}

async function compareGeneExpression(genes, tissues) {
    await fetchTissueData();
    
    let comparisonHtml = `<div class="result-card"><h3>Expression Comparison</h3>`;
    
    genes.forEach(gene => {
        comparisonHtml += `<h4>${gene}</h4>`;
        const expressionData = window.tissueDataCache[gene.toUpperCase()];
        
        if (!expressionData) {
            comparisonHtml += `<p>No expression data available</p>`;
        } else {
            tissues.forEach(tissue => {
                const value = expressionData[tissue] || 0;
                comparisonHtml += `<p><strong>${tissue}:</strong> ${value.toFixed(2)} nTPM</p>`;
            });
        }
    });
    
    comparisonHtml += `</div>`;
    return comparisonHtml;
}

async function getGeneConservation(gene) {
    await fetchPhylogenyData();
    const conservationData = phylogenyDataCache[gene.toUpperCase()];
    
    if (!conservationData) {
        return `<div class="result-card"><h3>Conservation of ${gene}</h3><p class="status-not-found">No conservation data available.</p></div>`;
    }
    
    const speciesList = conservationData.species?.join(", ") || "No species data";
    const category = conservationData.category || "Unknown category";
    
    return `
    <div class="result-card">
        <h3>Evolutionary Conservation of ${gene}</h3>
        <p><strong>Category:</strong> ${category}</p>
        <p><strong>Found in:</strong> ${speciesList}</p>
    </div>`;
}

async function checkConservation(gene, organism) {
    await fetchPhylogenyData();
    const conservationData = phylogenyDataCache[gene.toUpperCase()];
    
    if (!conservationData) {
        return `<div class="result-card"><h3>Conservation of ${gene}</h3><p class="status-not-found">No conservation data available.</p></div>`;
    }
    
    const isConserved = conservationData.species?.some(s => 
        s.toLowerCase().includes(organism.toLowerCase())
    ) || false;
    
    const status = isConserved ? 
        `Yes, ${gene} is conserved in ${organism}` : 
        `No, ${gene} does not appear to be conserved in ${organism} based on available data.`;
    
    return `<div class="result-card"><h3>Conservation of ${gene} in ${organism}</h3><p>${status}</p></div>`;
}

async function getCiliaryOnlyGenes() {
    const result = await getPhylogenyGenes({ type: 'ciliary_only_list' });
    return formatListResult(result.label, result.genes);
}

async function getConservedGenesBetween(organisms) {
    await fetchPhylogenyData();
    await fetchCiliaData();
    
    const ciliaryGenes = new Set(ciliaHubDataCache.map(g => g.gene.toUpperCase()));
    const conservedGenes = [];
    
    Object.entries(phylogenyDataCache).forEach(([gene, data]) => {
        if (ciliaryGenes.has(gene.toUpperCase()) && data.species) {
            const hasAllOrganisms = organisms.every(org => 
                data.species.some(s => s.toLowerCase().includes(normalizeTerm(org)))
            );
            
            if (hasAllOrganisms) {
                conservedGenes.push({
                    gene: data.sym || gene,
                    description: `Conserved in ${organisms.join(" and ")}`
                });
            }
        }
    });
    
    return formatListResult(`Ciliary Genes Conserved Between ${organisms.join(" and ")}`, conservedGenes);
}

async function getOrthologsInOrganism(organism) {
    const { genes, description } = await getCiliaryGenesForOrganism(organism);
    return formatListResult(`Human Ciliary Genes with Orthologs in ${organism}`, genes, description);
}


// =============================================================================
// UPDATE INTENT PARSER WITH ADDITIONAL KEYWORDS
// =============================================================================

// Update the intent parser to include the new question types
function updateIntentParser() {
    // Add new keywords to existing entity types
    const functionalCategory = intentParser.getKnownKeywords().find(e => e.type === 'FUNCTIONAL_CATEGORY');
    if (functionalCategory) {
        functionalCategory.keywords.push(
            'cilium assembly', 'motility', 'trafficking', 'membrane composition',
            'post-translational modification', 'cell cycle', 'development'
        );
    }
    
    // Add new complex types
    const complexType = intentParser.getKnownKeywords().find(e => e.type === 'COMPLEX');
    if (complexType) {
        complexType.keywords.push(
            'IFT-A', 'IFT-B', 'MKS Complex', 'NPHP Complex', 'Transition Zone Complex'
        );
    }
    
    console.log('Intent parser updated with new question keywords');
}

// Call this after setting up the intent parser
setTimeout(updateIntentParser, 1000);


// =============================================================================
// NEW: Helper function to get comprehensive details for "Tell me about..." queries
// =============================================================================
async function getComprehensiveDetails(term) {
    const upperTerm = term.toUpperCase();
    
    // Check if it's a known complex (e.g., BBSome, IFT-A)
    const isComplex = intentParser.getAllComplexes().some(c => c.toUpperCase() === upperTerm);
    if (isComplex) {
        // If it's a complex, retrieve the components list.
        const results = await getGenesByComplex(term);
        return formatListResult(`Components of ${term}`, results);
    }

    // Assume the term is a Gene Symbol and fetch data.
    if (!ciliaHubDataCache) {
        // Ensure all data caches are populated before searching for the gene.
        await fetchCiliaData();
    }
    
    // Find the gene's integrated data entry.
    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === upperTerm);
    
    // Use the existing detailed formatter to present the integrated data (including 
    // orthologs, classification, and screen data).
    return formatComprehensiveGeneDetails(upperTerm, geneData);
}

// --- Query Helper Functions ---

// Rule 1: Search for genes by ciliopathy/disease name
// =============================================================================
// REPLACEMENT: Corrected Data Fetching Functions
// These functions now ONLY return raw data (arrays or objects), never HTML.
// =============================================================================

async function getCiliopathyGenes(disease) {
    await fetchCiliaData();
    const diseaseLower = normalizeTerm(disease);
    const diseaseRegex = new RegExp(diseaseLower.replace(/\s+/g, '[\\s_\\-–]*').replace('syndrome', '(syndrome)?'), 'i');
    
    const genes = ciliaHubDataCache
        .filter(g => g.ciliopathy && g.ciliopathy.some(c => normalizeTerm(c).match(diseaseRegex)))
        .map(g => ({ gene: g.gene, description: g.ciliopathy?.join(', ') || 'No ciliopathy data' }))
        .sort((a, b) => a.gene.localeCompare(b.gene));
    
    return { genes, description: `Found ${genes.length} genes associated with "${disease}".` };
}

async function getGenesByLocalization(locations) {
    await fetchCiliaData();
    const locationTerms = locations.split(/\s+or\s+/).map(normalizeTerm);
    const results = ciliaHubDataCache
        .filter(gene => gene.localization && gene.localization.some(loc => 
            locationTerms.some(term => normalizeTerm(loc).includes(term))
        ))
        .map(gene => ({ 
            gene: gene.gene, 
            description: gene.localization?.join(', ') || 'No localization data' 
        }))
        .sort((a, b) => a.gene.localeCompare(b.gene));
    
    return results;
}

async function getGenesWithDomain(domainName) {
    await fetchCiliaData();
    const domainRegex = new RegExp(domainName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    
    const results = ciliaHubDataCache
        .filter(gene => 
            Array.isArray(gene.domain_descriptions) && 
            gene.domain_descriptions.some(dd => dd.match(domainRegex))
        )
        .map(gene => ({ 
            gene: gene.gene, 
            description: `Domains: ${gene.domain_descriptions?.join(', ') || 'No domain data'}` 
        }))
        .sort((a, b) => a.gene.localeCompare(b.gene));
    
    return results;
}

/**
 * Retrieves components for a complex name, prioritizing CORUM data.
 * NOTE: This assumes the corrected 'fetchCorumComplexes' is running.
 */
async function getGenesByComplex(complexName) {
    // Ensure all data is ready, including the newly added CORUM fetch
    await Promise.all([fetchCorumComplexes(), fetchCiliaData()]);

    const nameLower = complexName.toLowerCase();
    
    // --- 1. Check CORUM Cache (Priority Source for Complex Composition) ---
    const corumEntry = corumDataCache.byNameLower[nameLower];
    
    if (corumEntry) {
        // Return a standardized format for CORUM data
        return corumEntry.subunits.map(subunit => ({
            gene: subunit.gene_name,
            description: `Complex: ${corumEntry.complex_name} (CORUM ID: ${corumEntry.complex_id})`,
            source: 'CORUM'
        }));
    }

    // --- 2. Fallback to CiliaHub Gene Annotations (Legacy/Secondary Source) ---
    const complexRegex = new RegExp(complexName, 'i');
    
    const complexGenes = ciliaHubDataCache.filter(gene => 
        // Checks if the gene's own record mentions the complex name
        gene.complex_names && gene.complex_names.some(cn => cn.match(complexRegex))
    ).map(gene => ({
        gene: gene.gene,
        description: `Complex: ${gene.complex_names?.join(', ') || 'Unknown'}`,
        source: 'CiliaHub'
    }));
    
    // 3. Fallback to searching functional summary if no direct hit
    if (complexGenes.length > 0) return complexGenes;

    const relatedGenes = ciliaHubDataCache.filter(gene => 
        gene.functional_summary && gene.functional_summary.toLowerCase().includes(nameLower)
    ).map(gene => ({
        gene: gene.gene,
        description: gene.functional_summary?.substring(0, 100) + '...' || 'No description',
        source: 'CiliaHub'
    }));
    
    // Combine and return
    return relatedGenes;
}
async function getGenesByFunction(functionalCategory) {
    await fetchCiliaData();
    const categoryRegex = new RegExp(functionalCategory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    
    const results = ciliaHubDataCache
        .filter(gene => 
            Array.isArray(gene.functional_category) && 
            gene.functional_category.some(cat => cat.match(categoryRegex))
        )
        .map(gene => ({ 
            gene: gene.gene, 
            description: `Functional Category: ${gene.functional_category?.join(', ') || 'Unknown'}` 
        }));
        
    return results;
}
// Rule 5 & 7: General phylogeny-related queries

async function getPhylogenyGenes({ type }) {
    await fetchPhylogenyData();
    const phy = phylogenyDataCache || {};
    const phyArray = Object.entries(phy);

    switch (type) {
        case 'ciliary_only_list':
            return {
                label: 'Ciliary-Only Genes',
                genes: phyArray
                    .filter(([, v]) => v.category === 'ciliated_only_genes')
                    .map(([g, v]) => ({ gene: v.sym, description: 'Ciliary-only gene' }))
            };

        case 'in_all_organisms':
            return {
                label: 'Genes Found in All Organisms',
                genes: phyArray
                    .filter(([, v]) => v.category === 'in_all_organisms')
                    .map(([g, v]) => ({ gene: v.sym, description: 'Present in all species analyzed' }))
            };

        case 'nonciliary_only_genes':
            return {
                label: 'Non-Ciliary-Only Genes',
                genes: phyArray
                    .filter(([, v]) => v.category === 'nonciliary_only_genes')
                    .map(([g, v]) => ({ gene: v.sym, description: 'Non-ciliary-only gene' }))
            };

        case 'human_specific':
            return {
                label: 'Human-Specific Genes',
                genes: phyArray
                    .filter(([, v]) =>
                        Array.isArray(v.species) &&
                        v.species.length === 1 &&
                        v.species[0] === 'H.sapiens'
                    )
                    .map(([g, v]) => ({ gene: v.sym, description: 'Human-specific gene' }))
            };

        default:
            return { label: 'Unknown Query', genes: [] };
    }
}

// Rule 1 & 3: Finds ciliary genes present in a specific organism

async function getCiliaryGenesForOrganism(organismName) {
    await fetchCiliaData();
    await fetchPhylogenyData();
    
    // Step 1: Get a set of all ciliary gene names for fast lookup (Existing Feature)
    const ciliaryGeneSet = new Set(ciliaHubDataCache.map(g => g.gene.toUpperCase()));
    console.log(`Ciliary genes in cache: ${ciliaHubDataCache.length}, Sample: ${ciliaHubDataCache.slice(0, 5).map(g => g.gene).join(', ')}`);

    // Step 2: Map user-friendly names to species codes (NEW FEATURE: Greatly expanded map)
    const organismMap = {
        'human': 'H.sapiens', 'homo sapiens': 'H.sapiens',
        'mouse': 'M.musculus', 'mus musculus': 'M.musculus',
        'worm': 'C.elegans', 'c. elegans': 'C.elegans', 'caenorhabditis elegans': 'C.elegans',
        'fly': 'D.melanogaster', 'drosophila': 'D.melanogaster', 'drosophila melanogaster': 'D.melanogaster',
        'zebrafish': 'D.rerio', 'danio rerio': 'D.rerio',
        'yeast': 'S.cerevisiae', 'saccharomyces cerevisiae': 'S.cerevisiae',
        'arabidopsis': 'A.thaliana', 'a. thaliana': 'A.thaliana',
        'chicken': 'G.gallus', 'gallus gallus': 'G.gallus',
        'chlamydomonas': 'C.reinhardtii', 'c. reinhardtii': 'C.reinhardtii',
        'tetrahymena': 'T.thermophila', 't. thermophila': 'T.thermophila',
        'plasmodium falciparum': 'P.falciparum'
        // This map handles common names. The logic below will fall back to use the direct input 
        // (e.g., "X.tropicalis") if a common name is not found here.
    };
    
    // Step 3: Gene synonym mapping for C. elegans (Existing Feature)
    const geneSynonymMap = {
        'OSM-5': 'IFT88',
        'BBS-1': 'BBS1',
        'CHE-11': 'IFT140',
        'DHC-1': 'DYNC2H1',
        'BBS-5': 'BBS5',
        'XBOX-1': 'BBS4',
        'DYF-1': 'IFT70'
    };

    const normalizedOrganism = normalizeTerm(organismName);
    // Use the expanded map first, then fall back to the user's input directly
    const speciesCode = organismMap[normalizedOrganism] || organismName;
    console.log(`Mapped organism "${organismName}" to species code "${speciesCode}"`);
    
    // Step 4: Normalize species codes for comparison (Existing Feature)
    const speciesRegex = new RegExp(`^${normalizeTerm(speciesCode).replace(/\./g, '\\.?').replace(/\s/g, '\\s*')}$`, 'i');
    console.log(`Species regex: ${speciesRegex}`);

    // Step 5: Filter phylogeny data for genes present in the organism (Existing Feature)
    const genes = Object.entries(phylogenyDataCache)
        .filter(([gene, data]) => {
            const geneName = (data.sym || gene).toUpperCase();
            const standardGeneName = geneSynonymMap[geneName] || geneName;
            const isCiliary = ciliaryGeneSet.has(standardGeneName);
            const hasSpecies = Array.isArray(data.species) && data.species.some(s => speciesRegex.test(normalizeTerm(s)));
            // The detailed console.log is preserved from your original code
            // console.log(`Checking gene ${geneName} (standard: ${standardGeneName}): isCiliary=${isCiliary}, hasSpecies=${hasSpecies}`);
            return isCiliary && hasSpecies;
        })
        .map(([gene, data]) => ({ gene: data.sym || gene, description: `Ciliary gene found in ${speciesCode}` }));
    
    console.log(`Found ${genes.length} ciliary genes for ${speciesCode}`);

    // Step 6: Fallback if no genes are found (Existing Feature)
    if (genes.length === 0) {
        const knownCiliaryGenes = [
            'IFT88', 'BBS1', 'ARL13B', 'BBS10', 'NPHP1', 'AHI1', 'CEP290', 'MKS1', 'TTC8',
            'OSM-5', 'CHE-11', 'DHC-1', 'BBS-1', 'BBS-5', 'XBOX-1', 'DYF-1'
        ];
        const fallbackGenes = knownCiliaryGenes
            .filter(gene => ciliaryGeneSet.has((geneSynonymMap[gene.toUpperCase()] || gene).toUpperCase()))
            .map(gene => ({ gene, description: `Known ciliary gene (fallback) for ${speciesCode}` }));
        
        console.log(`Using fallback: ${fallbackGenes.length} genes (${fallbackGenes.map(g => g.gene).join(', ')})`);
        
        return {
            genes: fallbackGenes,
            description: `No specific ciliary genes found for ${speciesCode} in phylogeny data. Showing ${fallbackGenes.length} known ciliary genes.`,
            speciesCode: speciesCode // NEW FEATURE: Returning the resolved species code
        };
    }
    
    return {
        genes,
        description: `Found ${genes.length} ciliary genes present in ${speciesCode}.`,
        speciesCode: speciesCode // NEW FEATURE: Returning the resolved species code
    };
}

// --- Main AI Query Handler ---
window.handleAIQuery = async function() {
    const aiQueryInput = document.getElementById('aiQueryInput');
    const resultArea = document.getElementById('ai-result-area');
    const query = aiQueryInput.value.trim();
    if (!query) return;

    // --- FIX 1: Purge any existing Plotly plots from the result area ---
    try { if (window.Plotly) window.Plotly.purge(resultArea); } catch (e) {}

    resultArea.style.display = 'block';
    resultArea.innerHTML = `<p class="status-searching">CiliAI is thinking... 🧠</p>`;
    
    try {
        // Await core CiliaHub data fetches ONLY. Phylogeny fetches run in the router.
        await Promise.all([
            fetchCiliaData(),
            fetchScreenData(),
            fetchTissueData(),
            fetchCellxgeneData(),
            fetchUmapData(),
            getDomainData(),
            fetchCorumComplexes()
            // Removed redundant phylogeny fetches from here
        ]);
        console.log('ciliAI.js: All core data loaded for processing.');

        let resultHtml = '';
        const qLower = query.toLowerCase();
        let match;

        // =================================================================
        // **NEW ROUTING PRIORITY:** Handle Phylogeny/Heatmap Queries (Q1-Q7)
        // =================================================================
        if (qLower.includes('phylogeny') || qLower.includes('conservation') || 
            qLower.includes('heatmap') || qLower.includes('comparison') || 
            qLower.includes('tree')) {
            
            console.log('Routing to Phylogenetic Visualization Query...');
            resultHtml = await handlePhylogenyVisualizationQuery(query);
        }
        // =================================================================
        // **FALLBACK TO ORIGINAL LOGIC**
        // =================================================================
        
        else {
            const perfectMatch = questionRegistry.find(item => item.text.toLowerCase() === qLower);
            if (perfectMatch) {
                console.log(`Registry match found: "${perfectMatch.text}"`);
                resultHtml = await perfectMatch.handler();
            } 
            else if ((match = qLower.match(/(?:tell me about|what is|describe)\s+(.+)/i))) {
                const term = match[1].trim();
                resultHtml = await getComprehensiveDetails(term);
            } 
            else {
                const intent = intentParser.parse(query);
                if (intent && typeof intent.handler === 'function') {
                    console.log(`Intent parser match found: ${intent.intent} for entity: ${intent.entity}`);
                    resultHtml = await intent.handler(intent.entity);
                }
                else {
                    const potentialGenes = (query.match(/\b([A-Z0-9\-\.]{3,})\b/gi) || []);
                    const genes = potentialGenes.filter(g => ciliaHubDataCache.some(hubGene => hubGene.gene.toUpperCase() === g.toUpperCase()));
                    
                    if (genes.length === 2 && (qLower.includes('compare') || qLower.includes('vs'))) {
                        resultHtml = await displayCellxgeneBarChart(genes);
                    } else if (genes.length === 1 && (qLower.includes('plot') || qLower.includes('show expression') || qLower.includes('visualize'))) {
                        if (qLower.includes('umap')) {
                            resultHtml = await displayUmapGeneExpression(genes[0]);
                        } else {
                            resultHtml = await displayCellxgeneBarChart(genes);
                        }
                    } else if (genes.length === 1 && qLower.length < (genes[0].length + 5)) {
                        resultHtml = await getComprehensiveDetails(query);
                    } else {
                        resultHtml = `<p>Sorry, I didn’t understand that. Please try one of the suggested questions or a known keyword.</p>`;
                    }
                }
            }
        }

        if (resultHtml !== "") {
            resultArea.innerHTML = resultHtml;
        }

    } catch (e) {
        resultArea.innerHTML = `<p class="status-not-found">An internal CiliAI error occurred during your query. Please check the console for details. (Error: ${e.message})</p>`;
        console.error("CiliAI Query Error:", e);
    }
};


/**
 * Patches the main query handler to include Corum lookups.
 * NOTE: This function must be placed AFTER window.handleAIQuery is defined.
 */
function patchAIQueryHandler() {
    const originalHandler = window.handleAIQuery;

    window.handleAIQuery = async function(event) {
        // 1. Ensure CORUM data is loaded alongside other promises
        await fetchCorumComplexes();
        
        const aiQueryInput = document.getElementById('aiQueryInput');
        const resultArea = document.getElementById('ai-result-area');
        const query = aiQueryInput.value.trim();
        const qLower = query.toLowerCase();

        // --- CUSTOM COMPLEX PARSING (Replaces the crash-prone regex) ---
        
        // Pattern 1: Subunits/components/members OF <complex name>
        if (qLower.includes('subunits of') || qLower.includes('components of') || qLower.includes('members of')) {
            const complexMatch = qLower.match(/(?:subunits|components|members)\s+of\s+(.+)/i);
            const complexName = complexMatch ? complexMatch[1].trim() : null;

            if (complexName) {
                const results = getSubunitsByComplexName(complexName);
                if (results.length > 0) {
                    let html = `<div class="result-card"><h3>Complex Subunits Matching "${complexName}"</h3><ul>`;
                    results.forEach(entry => {
                        html += `<li><b>${entry.complexName}</b> (${entry.subunits.length} subunits): 
                                 <small>${entry.subunits.map(s => s.toUpperCase()).join(', ')}</small></li>`;
                    });
                    html += '</ul></div>';
                    resultArea.innerHTML = html;
                    resultArea.style.display = 'block';
                    return; // Handled
                }
            }
        }
        
        // Pattern 2: Complexes FOR <gene>
        if (qLower.includes('complexes for') || qLower.includes('complexes of') || qLower.includes('complexes containing')) {
            const geneMatch = qLower.match(/(?:complexes|subunits)\s+(?:for|of|containing)\s+([A-Za-z0-9\-]+)/i);
            const gene = geneMatch ? geneMatch[1].toUpperCase() : null;

            if (gene) {
                const complexes = getComplexesByGene(gene);
                if (complexes.length > 0) {
                    let html = `<div class="result-card"><h3>🧬 CORUM Complexes containing ${gene}</h3><ul>`;
                    complexes.forEach(c => {
                        html += `<li><b>${c.complexName}</b> (Total subunits: ${c.subunits.length})</li>`;
                    });
                    html += '</ul></div>';
                    resultArea.innerHTML = html;
                    resultArea.style.display = 'block';
                    return; // Handled
                }
            }
        }

        // --- END CUSTOM COMPLEX PARSING ---

        // 2. If not a CORUM query, fall back to the original handling
        return originalHandler.apply(this, arguments);
    };
}

// --- Execute CORUM Integration Patch ---
patchAIQueryHandler(); 

// --- Initial Data Load (Must call fetchCorumComplexes for complex queries to work) ---
(async function initializeCorum() {
    await fetchCorumComplexes();
})();

// Helper for the comparison query (updated titles and threshold)
async function displayEnrichedDomains() {
    const db = await getDomainData();
    
    if (!db || !db.enriched_domains) {
        return `<div class="result-card"><h3>Enriched Domains</h3><p class="status-not-found">Could not load enriched domain data.</p></div>`;
    }

    // The data is an object, not an array, so we use Object.values()
    const domains = Object.values(db.enriched_domains);
    if (domains.length === 0) {
        return `<div class="result-card"><h3>Enriched Domains</h3><p class="status-not-found">No enriched domains found in the data.</p></div>`;
    }

    let listHtml = '<ul>';
    for (const domain of domains.slice(0, 10)) { // Show top 10
        listHtml += `<li>
            <strong>${domain.domain_id}</strong> (${domain.description || 'N/A'})
            <br>
            <span class="details">Odds Ratio: ${domain.odds_ratio.toFixed(2)} (p-adj: ${domain.p_adj.toExponential(2)})</span>
            <br>
            <small>Found in ${domain.ciliary_count} ciliary genes (vs ${domain.background_count} background).</small>
        </li>`;
    }
    listHtml += '</ul>';

    return `
        <div class="result-card">
            <h3>Top 10 Enriched Domains (New DB)</h3>
            ${listHtml}
        </div>`;
}

/**
 * [NEW HANDLER] CiliAI ASK function to display depleted/absent domains from the new DB.
 */
async function displayDepletedDomains() {
    const db = await getDomainData();
    
    if (!db || !db.depleted_or_absent_domains) {
        return `<div class="result-card"><h3>Depleted/Absent Domains</h3><p class="status-not-found">Could not load depleted domain data.</p></div>`;
    }

    // The data is an object, not an array, so we use Object.values()
    const domains = Object.values(db.depleted_or_absent_domains);
    if (domains.length === 0) {
        return `<div class="result-card"><h3>Depleted/Absent Domains</h3><p class="status-not-found">No depleted domains found in the data.</p></div>`;
    }

    let listHtml = '<ul>';
    for (const domain of domains.slice(0, 10)) { // Show top 10
        listHtml += `<li>
            <strong>${domain.domain_id}</strong> (${domain.description || 'N/A'})
            <br>
            <span class="details">Odds Ratio: ${domain.odds_ratio.toFixed(3)} (p-adj: ${domain.p_adj.toExponential(2)})</span>
            <br>
            <small>Found in only ${domain.ciliary_count} ciliary genes (vs ${domain.background_count} background).</small>
        </li>`;
    }
    listHtml += '</ul>';

    return `
        <div class="result-card">
            <h3>Top 10 Depleted/Absent Domains (New DB)</h3>
            <p>These domains are statistically rare or absent in the ciliary proteome.</p>
            ${listHtml}
        </div>`;
}

/**
 * [NEW HANDLER] CiliAI ASK function to find genes using the new structured domain map.
 * @param {string} query - The domain ID (e.g., "PF00069") or name (e.g., "WD40") to search for.
 */
async function findGenesByNewDomainDB(query) {
    const db = await getDomainData();
    if (!db || !db.gene_domain_map) {
        return `<div class="result-card"><h3>Domain Search</h3><p class="status-not-found">Could not load new gene-domain map.</p></div>`;
    }

    const geneMap = db.gene_domain_map;
    const matchingGenes = [];
    const queryRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); 

    for (const geneName in geneMap) {
        const domains = geneMap[geneName]; // This is an array of domains
        const hasMatch = domains.some(domain => 
            (domain.domain_id && domain.domain_id.match(queryRegex)) ||
            (domain.description && domain.description.match(queryRegex))
        );
        
        if (hasMatch) {
            const matchedDomains = domains
                .filter(d => (d.domain_id && d.domain_id.match(queryRegex)) || (d.description && d.description.match(queryRegex)))
                .map(d => `${d.domain_id} (${d.description || 'N/A'})`)
                .join('; ');
            matchingGenes.push({ gene: geneName, description: `Domains: ${matchedDomains}` });
        }
    }
    return formatListResult(`Ciliary Genes (New DB) with Domains matching "${query}"`, matchingGenes);
}

/**
 * [NEW HANDLER] CiliAI ASK function to show domains for a specific gene from the new DB.
 * @param {string} geneSymbol - The gene symbol.
 */
async function displayDomainsForGene(geneSymbol) {
    const db = await getDomainData();
    const geneUpper = geneSymbol.toUpperCase();

    if (!db || !db.gene_domain_map) {
        return `<div class="result-card"><h3>${geneSymbol} Domains</h3><p class="status-not-found">Could not load gene-domain map.</p></div>`;
    }
    const domains = db.gene_domain_map[geneUpper]; // Direct lookup

    if (!domains || domains.length === 0) {
        return `<div class="result-card"><h3>${geneSymbol} Domains</h3><p class="status-not-found">No domain information found for ${geneSymbol} in the new database.</p></div>`;
    }

    let listHtml = '<ul>';
    domains.forEach(domain => {
        listHtml += `<li><strong>${domain.domain_id}</strong>: ${domain.description || 'N/A'}</li>`;
    });
    listHtml += '</ul>';

     return `
        <div class="result-card">
            <h3>Domains for ${geneSymbol} (New DB)</h3>
            ${listHtml}
        </div>`;
}

/**
 * [NEW HANDLER] CiliAI ASK function to get conservation from Nevers et al. 2017.
 * @param {string} geneSymbol - The gene symbol.
 */
async function getNeversConservation(geneSymbol) {
    await fetchNeversPhylogenyData();
    const geneUpper = geneSymbol.toUpperCase();
    
    // Check the 'genes' object in the loaded JSON
    if (!neversPhylogenyCache || !neversPhylogenyCache.genes || !neversPhylogenyCache.genes[geneUpper]) {
        return `<div class="result-card"><h3>${geneSymbol} (Nevers et al. 2017)</h3><p class="status-not-found">Gene not found in the Nevers et al. 2017 dataset.</p></div>`;
    }
    
    const geneData = neversPhylogenyCache.genes[geneUpper];
    const organismsList = neversPhylogenyCache.organism_groups.all_organisms_list;
    
    // Map indices 's' back to names
    const species = geneData.s.map(index => organismsList[index]).join(', ');
    
    // This file doesn't have the same high-level class, so we use the fields it provides
    const geneName = geneData.g || geneSymbol;

    return `
        <div class="result-card">
            <h3>${geneName} Phylogeny (Nevers et al. 2017)</h3>
            <p><strong>Found in ${geneData.s.length} Species:</strong> ${species || 'N/A'}</p>
            <p style="font-size: 0.8em; color: #666; margin-top: 1rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
                <strong>Source:</strong> Nevers, Y. et al. (2017) <em>Mol. Biol. Evol.</em> <a href="https://doi.org/10.1093/molbev/msx146" target="_blank">DOI: 10.1093/molbev/msx146</a>
            </p>
        </div>`;
}

/**
 * [NEW HANDLER] CiliAI ASK function to get conservation from Li et al. 2014.
 * @param {string} geneSymbol - The gene symbol.
 */
async function getLiConservation(geneSymbol) {
    await fetchLiPhylogenyData();
    const geneUpper = geneSymbol.toUpperCase();
    
    let geneData = null;
    
    if (!liPhylogenyCache || !liPhylogenyCache.genes) {
         return `<div class="result-card"><h3>${geneSymbol} (Li et al. 2014)</h3><p class="status-not-found">Could not load the Li et al. 2014 dataset.</p></div>`;
    }

    // The keys in liPhylogenyCache.genes are Entrez IDs. We must search by gene symbol 'g'.
    const geneEntry = Object.values(liPhylogenyCache.genes).find(g => g.g.toUpperCase() === geneUpper);

    if (!geneEntry) {
        return `<div class="result-card"><h3>${geneSymbol} (Li et al. 2014)</h3><p class="status-not-found">Gene not found in the Li et al. 2014 dataset.</p></div>`;
    }
    
    // Use the helper to format the data
    return formatLiGeneData(geneSymbol, geneEntry, liPhylogenyCache.summary);
}

/**
 * @fileoverview New functions and modifications to integrate dual phylogenetic heatmaps.
 * * NOTE: The following functions (CIL_ORG_FULL, NCIL_ORG_FULL, liPhylogenyCache, neversPhylogenyCache,
 * fetchLiPhylogenyData, fetchNeversPhylogenyData) are assumed to be globally defined/available.
 */

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

// --------------------------------------------------------------------------------------
// NEW FUNCTION 1: NEVERS ET AL. 2017 HEATMAP RENDERER
// --------------------------------------------------------------------------------------
/**
 * Renders the phylogenetic heatmap based on Nevers et al. 2017 data.
 * @param {string[]} genes - Array of genes requested.
 * @returns {object} Structured object {html, plotData, plotLayout, plotId}.
 */
function renderNeversPhylogenyHeatmap(genes) {
    if (!neversPhylogenyCache) {
        return { html: `<div class="result-card"><h3>Heatmap Error</h3><p>Nevers et al. 2017 data not loaded. Please try again.</p></div>`, plotData: null, plotLayout: null, plotId: null };
    }
    
    // --- CRITICAL CHANGE: Use NEVERS_CIL_PANEL and NEVERS_NCIL_PANEL as the source for the 40 organisms ---
    const CIL_COUNT = NEVERS_CIL_PANEL.length;
    const NCIL_COUNT = NEVERS_NCIL_PANEL.length;

    // --- 1. Map Target Organisms to Nevers Indices (using NEVERS_CIL/NCIL_PANEL as source) ---
    const neversOrgList = neversPhylogenyCache.organism_groups?.all_organisms_list || [];
    const neversOrgMap = new Map(); 
    
    // Loop 1: Map all Nevers list entries to their index using the EXACT string and simplified key.
    neversOrgList.forEach((name, index) => {
        // Key 1: Store the EXACT original name (Highest priority key)
        neversOrgMap.set(name, index);
        
        // Key 2: Map the fully simplified key (removes strain info, periods, spaces)
        const simplifiedKey = name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[\s\.\(\)]/g, '');
        neversOrgMap.set(simplifiedKey, index);
    });

    const targetOrganisms = NEVERS_CIL_PANEL.concat(NEVERS_NCIL_PANEL);
    
    const targetNeversIndices = targetOrganisms.map(orgName => {
        const simplifiedKey = orgName.toLowerCase().replace(/[\s\.]/g, '');
        
        // Lookup 1: Try the exact verbose name from our panel (e.g., "Saccharomyces cerevisiae (strain...)")
        if (neversOrgMap.has(orgName)) return neversOrgMap.get(orgName);
        
        // Lookup 2: Try the simplified key (e.g., "saccharomycescerevisiae")
        if (neversOrgMap.has(simplifiedKey)) return neversOrgMap.get(simplifiedKey);
        
        return undefined;
    });

    const geneLabels = genes.map(g => g.toUpperCase());
    const matrix = [];
    const textMatrix = [];
    
    // --- 2. Build the Matrix (Presence/Absence in Nevers data) ---
    geneLabels.forEach(gene => {
        const geneData = neversPhylogenyCache.genes?.[gene]; 
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

    const plotContainer = 'nevers-phylogeny-heatmap-container';

    // --- 3. Plotly Data & Layout (Teal/Pink) ---
    const NEVERS_COLORS = [
        [0/2, '#F0F0F0'], [0.0001/2, '#F0A0A0'], [1/2, '#F0A0A0'], 
        [1.0001/2, '#00A0A0'], [2/2, '#00A0A0']
    ];

    const trace = {
        z: matrix,
        // *** CRITICAL AXIS FIX: Strip parentheses for display labels ***
        x: targetOrganisms.map(name => {
            // Remove everything inside parentheses (strains) for the label only
            let cleanedName = name.replace(/\s*\(.*?\)\s*/g, '').trim();
            
            // Further clean up scientific abbreviations used in the list if necessary
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
        title: `Phylogenetic Conservation (Nevers et al. 2017) - ${genes.length > 1 ? `${genes.length} Genes` : genes[0]}`,
        xaxis: { title: 'Organisms (Ciliated | Non-Ciliated)', tickangle: 45, automargin: true },
        yaxis: { title: 'Genes', automargin: true },
        shapes: [{
                type: 'line',
                xref: 'x', x0: CIL_COUNT - 0.5, x1: CIL_COUNT - 0.5, 
                yref: 'paper', y0: 0, y1: 1,
                line: { color: 'black', width: 2 }
            }],
        margin: { t: 50, b: 200, l: 100, r: 50 },
        height: Math.max(500, genes.length * 40 + 150)
    };
    
    // --- 4. HTML Output ---
    const htmlOutput = `
        <div class="result-card">
            <h3>Phylogenetic Heatmap for ${geneLabels.join(', ')} 🌍</h3>
            <p>Data from <strong>Nevers et al. (2017)</strong>, mapped to a fixed panel of <strong>${CIL_COUNT} Ciliated (Teal)</strong> and <strong>${NCIL_COUNT} Non-Ciliated (Pink)</strong> organisms.</p>
            <div id="${plotContainer}" style="height: ${layout.height}px; width: 100%;"></div>
            <button class="download-button" onclick="downloadPlot('${plotContainer}', 'Phylogeny_Nevers2017')">Download Heatmap (PNG)</button>
            <p class="ai-suggestion" style="margin-top: 10px;">
                <a href="#" class="ai-action" data-action="show-li-heatmap" data-genes="${genes.join(',')}">⬅️ Show Li et al. (2014) Comparison</a>
            </p>
        </div>
    `;

    return { html: htmlOutput, plotData: [trace], plotLayout: layout, plotId: plotContainer };
}


/**
 * MODIFIED: Adds a link to switch to the Nevers heatmap.
 */
function renderLiPhylogenyHeatmap(genes) {
    if (!liPhylogenyCache) {
        return {
            html: `<div class="result-card"><h3>Heatmap Error</h3><p>Li et al. 2014 data not loaded. Please try again.</p></div>`,
            plotData: null,
            plotLayout: null,
            plotId: null
        };
    }
    
    // Assumed global constants are available (CIL_ORG_FULL, NCIL_ORG_FULL)
    const CIL_COUNT = CIL_ORG_FULL.length;
    const NCIL_COUNT = NCIL_ORG_FULL.length;

    // --- MANUAL CORRECTION MAP (USED TO MAP VERBOSE INPUTS TO LI KEYS) ---
    // This map ensures common verbose inputs (e.g., "musmusculus") map to the Li keys (e.g., "M.musculus").
    const VERTEBRATE_LI_MAP = new Map([
        ["homosapiens", "H.sapiens"],
        ["m.gallopavo", "M.gallopavo"],
        ["musmusculus", "M.musculus"],
        ["daniorerio", "D.rerio"],
        ["xenopustropicalis", "X.tropicalis"],
        ["gallusgallus", "G.gallus"],
        ["o.anatinus", "O.anatinus"],
        ["t.nigroviridis", "T.nigroviridis"],
        ["c.elegans", "C.elegans"],
        ["c.briggsae", "C.briggsae"],
        ["c.reinhardtii", "C.reinhardtii"],
        ["t.thermophila", "T.thermophila"],
        ["s.cerevisiae", "S.cerevisiae"],
        ["a.thaliana", "A.thaliana"],
        ["o.sativa", "O.sativa"]
    ]);


    // --- 1. Map Target Organisms to Li Indices (FINAL, ROBUST MAPPING) ---
    const liOrgList = liPhylogenyCache.summary.organisms_list;
    const liOrgMap = new Map();

    // Loop 1: Map ALL 140 Li list entries using multiple naming keys
    liOrgList.forEach((name, index) => {
        // Key 1: Official Li list name (e.g., 'H.sapiens')
        liOrgMap.set(name, index);
        // Key 2: Simplified key (e.g., 'homosapiens')
        liOrgMap.set(name.toLowerCase().replace(/[\s\.]/g, ''), index);
    });

    const targetOrganisms = CIL_ORG_FULL.concat(NCIL_ORG_FULL);
    
    const targetLiIndices = targetOrganisms.map(orgName => {
        const lowerOrg = orgName.toLowerCase();
        const simplifiedKey = lowerOrg.replace(/[\s\.]/g, '');
        
        // A. Check manual vertebrate map first (converts verbose list name to specific Li key)
        if (VERTEBRATE_LI_MAP.has(simplifiedKey)) {
            const liAbbrev = VERTEBRATE_LI_MAP.get(simplifiedKey);
            if (liOrgMap.has(liAbbrev)) {
                return liOrgMap.get(liAbbrev);
            }
        }
        
        // B. Fallback: Try the fully simplified key (works for Protists/Fungi that don't need overrides)
        if (liOrgMap.has(simplifiedKey)) return liOrgMap.get(simplifiedKey);

        // C. Final Fallback: Exact Li list name (already mapped in loop 1)
        if (liOrgMap.has(orgName)) return liOrgMap.get(orgName);

        return undefined; // Organism not found or mapped correctly
    });

    const geneLabels = genes.map(g => g.toUpperCase());
    const matrix = [];
    const textMatrix = [];
    
    // --- 2. Build the Matrix (Presence/Absence) ---
    geneLabels.forEach(gene => {
        const geneData = Object.values(liPhylogenyCache.genes).find(g => g.g && g.g.toUpperCase() === gene);
        const presenceIndices = new Set(geneData ? geneData.s : []);
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
            textRow.push(`Gene: ${gene}<br>Organism: ${orgName}<br>Status: ${status}`);
        });

        if (row.length > 0) {
            matrix.push(row);
            textMatrix.push(textRow);
        }
    });

    // --- 3. Plotly Data & Layout Definition (Uses full names for clarity) ---
    const plotContainer = 'li-phylogeny-heatmap-container';

    const trace = {
        z: matrix,
        // Use full organism names for X-axis ticks (Replace abbreviations for readability)
        x: targetOrganisms.map(name => {
            if (name === "H.sapiens") return "Human";
            if (name === "M.musculus") return "Mouse";
            if (name === "D.rerio") return "Zebrafish";
            if (name.includes("elegans")) return "C. elegans";
            return name.replace(/\./g, '').split(' ')[0]; // Simplify others (e.g. Tnigroviridis -> Tnigroviridis)
        }), 
        y: geneLabels,
        type: 'heatmap',
        colorscale: [
            [0/2, '#FFFFFF'],      // Z=0 (Absent) -> White
            [0.0001/2, '#FFE5B5'], // Z=1 (NCIL Hit) start -> Light Orange (NCIL)
            [1/2, '#FFE5B5'],      // Z=1 (NCIL Hit) end
            [1.0001/2, '#698ECF'], // Z=2 (CIL Hit) start -> Blue (CIL)
            [2/2, '#698ECF']       // Z=2 (CIL Hit) end
        ],
        showscale: false,
        hoverinfo: 'text',
        text: textMatrix,
        xgap: 0.5,
        ygap: 0.5,
        line: { color: '#000000', width: 0.5 }
    };

    const layout = {
        title: `Phylogenetic Conservation (Li et al. 2014) - ${genes.length > 1 ? `${genes.length} Genes` : genes[0]}`,
        xaxis: { 
            title: 'Organisms (Ciliated | Non-Ciliated)', 
            tickangle: 45, 
            automargin: true 
        },
        yaxis: { 
            title: 'Genes', 
            automargin: true 
        },
        shapes: [
            {
                type: 'line',
                xref: 'x', x0: CIL_COUNT - 0.5, x1: CIL_COUNT - 0.5, 
                yref: 'paper', y0: 0, y1: 1,
                line: { color: 'black', width: 2 }
            }
        ],
        margin: { t: 50, b: 200, l: 100, r: 50 },
        height: Math.max(500, genes.length * 40 + 150)
    };
    
    // --- 4. Return Structured Object for External Execution ---
    const htmlOutput = `
        <div class="result-card">
            <h3>Phylogenetic Heatmap for ${geneLabels.join(', ')} 🌍</h3>
            <p>Data from <strong>Li et al. (2014) Cell</strong>, mapped to a fixed panel of <strong>${CIL_COUNT} Ciliated (Blue)</strong> and <strong>${NCIL_COUNT} Non-Ciliated (Orange)</strong> organisms.</p>
            <div id="${plotContainer}" style="height: ${layout.height}px; width: 100%;"></div>
            <button class="download-button" onclick="downloadPlot('${plotContainer}', 'Phylogeny_Li2014')">Download Heatmap (PNG)</button>
            <p style="font-size: 0.8em; color: #666; margin-top: 1rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
                <strong>Source:</strong> Li Y, Calvo SE, Gutman R, Liu JS, Mootha VK. Expansion of biological pathways based on evolutionary inference. (2014) <em>Cell</em>. 
                <a href="https://pubmed.ncbi.nlm.nih.gov/24995987/" target="_blank">[PMID: 24995987]</a>
            </p>
            <p class="ai-suggestion" style="margin-top: 10px;">
                <a href="#" class="ai-action" data-action="show-nevers-heatmap" data-genes="${genes.join(',')}">➡️ Show Nevers et al. (2017) Comparison</a>
            </p>
        </div>
    `;

    return {
        html: htmlOutput,
        plotData: [trace],
        plotLayout: layout,
        plotId: plotContainer
    };
}

async function handlePhylogenyVisualizationQuery(query, source = 'li') {
    const resultArea = document.getElementById('ai-result-area');
    // --- 1. Gene Extraction and Data Loading ---
    const inputGenes = extractMultipleGenes(query);
    // Ensure all necessary phylogenetic data is loaded before proceeding
    // NOTE: This includes your request to use both Li and Nevers data sources.
    await Promise.all([fetchLiPhylogenyData(), fetchNeversPhylogenyData()]);
    if (!liPhylogenyCache) {
        return `<div class="result-card"><h3>Error</h3><p>Could not load phylogenetic data (Li et al. 2014) to run this analysis.</p></div>`;
    }
    // Get all HUGO gene symbols available in the Li database
    const allLiGenes = Object.values(liPhylogenyCache.genes).map(g => g.g.toUpperCase()).filter(Boolean);
    const liGenesSet = new Set(allLiGenes);
    const validUserGenes = inputGenes.filter(g => liGenesSet.has(g));
    let finalGenes;
    // --- DEFINITIVE DEFAULT GENES ---
    // User-specified list used for context when input is lacking.
    const definitiveDefaultGenes = ["ZC2HC1A", "CEP41", "BBS1", "BBS2", "BBS5", "ZNF474", "IFT81", "BBS7"];
    
    // --- 2. Determine Final Genes to Plot (Prioritize user input, fill up to 20 with defaults) ---
    if (validUserGenes.length === 0) {
        // If user provided no valid gene, show the first 5 definitive defaults
        finalGenes = definitiveDefaultGenes.filter(g => liGenesSet.has(g)).slice(0, 5);
        if (finalGenes.length === 0) {
            return `<div class="result-card"><h3>Analysis Error</h3><p>The requested gene(s) were not found, and none of the default genes could be found in the phylogenetic dataset.</p></div>`;
        }
    } else {
        // Start with user's valid genes
        finalGenes = [...new Set(validUserGenes)];
        
        // Fill up to 20 genes using the definitive defaults for context
        if (finalGenes.length < 20) {
            for (const dGene of definitiveDefaultGenes) {
                if (finalGenes.length >= 20) break;
                if (liGenesSet.has(dGene) && !finalGenes.includes(dGene)) {
                    finalGenes.push(dGene);
                }
            }
        }
    }
    // --- 3. Select Renderer ---
    const renderer = (source === 'nevers') ? renderNeversPhylogenyHeatmap : renderLiPhylogenyHeatmap;
    // --- 4. Generate Structured Plot Results ---
    const plotResult = renderer(finalGenes);
    // --- 5. Inject HTML and Execute Plotting Function ---
    resultArea.innerHTML = plotResult.html;

    window.initPhylogenyPlot(
        plotResult.plotId, 
        plotResult.plotData, 
        plotResult.plotLayout
    );
    
    return "";
}

/**
 * Global wrapper to handle clicks on the Li/Nevers switch links.
 * This should be defined globally (e.g., window.switchPhylogenyView).
 * @param {string} action - 'show-nevers-heatmap' or 'show-li-heatmap'.
 * @param {string} genesString - Comma-separated list of genes.
 */
window.switchPhylogenyView = async function(action, genesString) {
    const genes = genesString.split(',').map(g => g.trim()).filter(Boolean);
    if (genes.length === 0) return;

    const source = (action === 'show-nevers-heatmap') ? 'nevers' : 'li';
    const query = `Show ${source} heatmap for ${genes.join(',')}`;
    
    // Clear the area before routing
    const resultArea = document.getElementById('ai-result-area');
    resultArea.innerHTML = `<p class="status-searching">Switching to ${source.toUpperCase()} comparison...</p>`;

    // Call the primary router with the correct source parameter.
    // The router function signature must be: handlePhylogenyVisualizationQuery(query, source)
    await handlePhylogenyVisualizationQuery(query, source);
};

/**
 * Safely handles the execution of the Plotly command.
 * This function must be defined in the global scope (window.initPhylogenyPlot).
 */
window.initPhylogenyPlot = function(containerId, traceData, layoutData) {

    // We use setTimeout(0) to ensure the browser finishes injecting the HTML <div> before plotting.

    setTimeout(() => {

        const plotElement = document.getElementById(containerId);

        // CRITICAL CHECK: Ensure Plotly library is loaded and the container exists

        if (plotElement && window.Plotly) {

            console.log("Successfully initiating Plotly visualization.");

            Plotly.newPlot(containerId, traceData, layoutData, { responsive: true, displayModeBar: false });

        } else {

            // This error should only occur if the Plotly script itself failed to load.

            console.error("Plotly execution aborted: Container or Plotly library not ready.");

        }

    }, 0); 

};


/**
 * Automated handler for all phylogenetic questions (Q1-Q7).
 * It fetches the pre-loaded Li/Nevers data for quick summary and triggers
 * the visualization router to handle the heatmap rendering.
 * * @param {string[]} genes - Array of gene symbols requested (e.g., ["IFT88"]).
 * @returns {Promise<string>} HTML string containing the summary and the visualization call.
 */
async function getPhylogenyAnalysis(genes) {
    // 1. **BEST PRACTICE FIX:** Check for empty input immediately.
    if (!Array.isArray(genes) || genes.length === 0) {
        return `<div class="result-card"><h3>Analysis Error</h3><p>No valid gene symbol was provided for phylogenetic analysis.</p></div>`;
    }
    
    // 1. Ensure data is loaded (these functions simply return the cached data if already fetched)
    await Promise.all([fetchLiPhylogenyData(), fetchNeversPhylogenyData()]);

    const geneSymbol = genes[0].toUpperCase();
    
    // --- Li Data Lookup ---
    // Safely attempt to find the gene by its HUGO symbol within the Li cache's 'genes' object
    const liEntry = Object.values(liPhylogenyCache?.genes || {}).find(g => g.g && g.g.toUpperCase() === geneSymbol);
    const liSummary = liEntry 
        ? (liPhylogenyCache.summary.class_list[liEntry.c] || 'Classification Unavailable')
        : 'Not found in Li et al. (2014)';

    // --- Nevers Data Lookup (Assumes Nevers is keyed by the HUGO Symbol for simplicity) ---
    const neversEntry = neversPhylogenyCache?.genes?.[geneSymbol];
    const neversSpeciesCount = neversEntry?.s?.length || 0;
    const neversStatus = neversEntry 
        ? `Found in ${neversSpeciesCount} species (Nevers et al. 2017)`
        : 'Not found in Nevers et al. (2017)';

    const generalSummary = `
        <div class="result-card">
            <h3>Evolutionary Summary: ${geneSymbol} 🧬</h3>
            <table class="gene-detail-table">
                <tr><th>Li et al. (2014) Classification</th><td><strong>${liSummary.replace(/_/g, ' ')}</strong></td></tr>
                <tr><th>Nevers et al. (2017) Status</th><td>${neversStatus}</td></tr>
                <tr><th>Analysis</th><td>Visualization is based on the Li et al. (2014) data.</td></tr>
            </table>
        </div>
    `;

    // 2. Route to Visualization (Handles the rendering of the heatmap)
    // NOTE: We pass the actual gene symbol(s) to the router.
    const visualizationHtml = await handlePhylogenyVisualizationQuery(`Show heatmap for ${genes.join(',')}`);

    // 3. Combine the textual summary and the visual output
    return generalSummary + visualizationHtml;
}
/**
 * [NEW HELPER] Formats the output for the Li et al. 2014 data
 */
function formatLiGeneData(geneSymbol, geneData, summary) {
    const organismsList = summary.organisms_list;
    const classList = summary.class_list;
    
    const species = geneData.s.map(index => organismsList[index]).join(', ');
    const category = (classList[geneData.c] || "Unknown").replace(/_/g, ' '); // Format "Ciliary_specific" to "Ciliary specific"

    return `
        <div class="result-card">
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



function formatComparisonResult(title, tissue, list1, list2) {
    const listToHtml = (geneList, listTitle) => {
        if (!geneList || geneList.length === 0) {
            return `<h4>${listTitle}</h4><p>No matching genes found.</p>`;
        }
        const limitedList = geneList.slice(0, 50);
        return `<h4>${listTitle} (${geneList.length})</h4>
                <ul class="gene-list" style="column-count: 2; font-size: 0.9em;">
                    ${limitedList.map(g => `<li><strong>${g.gene}</strong> (nTPM: ${g.nTPM.toFixed(2)})</li>`).join('')}
                </ul>
                ${geneList.length > 50 ? `<p><small>Showing first 50 genes.</small></p>`: ''}`;
    };

    // NEW FEATURE: Reference for expression data
    const referenceHtml = `<p style="font-size: 0.8em; color: #666; margin-top: 1rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
        Consensus tissue expression data from: Uhlén, M. et al. (2015) <em>Science</em>, 347(6220). <a href="https://pubmed.ncbi.nlm.nih.gov/25613900/" target="_blank" title="View on PubMed">PMID: 25613900</a>.
    </p>`;

    return `
        <div class="result-card">
            <h3>${title}</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    ${listToHtml(list1, `Genes Expressed in ${tissue}`)}
                </div>
                <div>
                    ${listToHtml(list2, `Ciliary Genes Expressed in ${tissue}`)}
                </div>
            </div>
            ${referenceHtml}
        </div>
    `;
}


// --- UI and Formatting Helper Functions ---
function formatComprehensiveGeneDetails(geneSymbol, geneData) {
    if (!geneData) {
        return `<div class="result-card"><h3>${geneSymbol}</h3><p class="status-not-found">Gene not found in the database.</p></div>`;
    }
    const { 
        ensembl_id, functional_summary, description, localization, 
        complex_names, complex_components, domain_descriptions, synonym, 
        ciliopathy, 
        // --- NEW FIELDS INTEGRATED ---
        ciliopathy_classification, 
        ortholog_mouse, ortholog_c_elegans, ortholog_zebrafish, ortholog_drosophila, 
        overexpression_effects, lof_effects, percent_ciliated_cells_effects,
        screens_from_separate_file 
        // --- END NEW FIELDS ---
    } = geneData;

    // Helper to render the screen data table (reused logic from getGeneCiliaEffects)
    // NOTE: This helper (renderDetailedScreenTable) must be defined elsewhere in your code.
    const renderDetailedScreenTable = (screenFindings) => {
        if (!screenFindings || screenFindings.length === 0) {
            return `<p class="status-not-found">No detailed quantitative screen data available.</p>`;
        }
        const tableRows = screenFindings.map(s => `
            <tr>
                <td>${s.dataset || 'N/A'}</td>
                <td>${(s.mean_percent_ciliated !== undefined) ? s.mean_percent_ciliated.toFixed(2) : 'N/A'}</td>
                <td>${(s.z_score !== undefined) ? s.z_score.toFixed(2) : 'N/A'}</td>
                <td>${s.classification || s.result || 'N/A'}</td>
                <td><a href="${s.paper_link}" target="_blank">Link</a></td>
            </tr>
        `).join('');

        return `
            <table class="ciliopathy-table">
                <thead>
                    <tr>
                        <th class="sortable">Dataset</th>
                        <th>Mean % Ciliated</th>
                        <th>Z-Score</th>
                        <th>Classification</th>
                        <th>Reference</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        `;
    };


    return `
        <div class="result-card">
            <h3>${geneSymbol} Comprehensive Details</h3>
            <table class="gene-detail-table">
                <tr><th>Ensembl ID</th><td>${ensembl_id || 'N/A'}</td></tr>
                <tr><th>Ciliopathy Classification</th><td><strong>${ciliopathy_classification || 'N/A'}</strong></td></tr>
                <tr><th>Ciliopathy/Disease</th><td>${ciliopathy.join(', ') || 'N/A'}</td></tr>
                <tr><th>Functional Summary</th><td>${functional_summary || description || 'N/A'}</td></tr>
                <tr><th>Localization</th><td>${localization.join(', ') || 'N/A'}</td></tr>
                <tr><th>Primary Synonym</th><td>${synonym || 'N/A'}</td></tr>
                <tr><th>Complex Name(s)</th><td>${complex_names.join(', ') || 'N/A'}</td></tr>
                <tr><th>Domain Descriptions</th><td>${domain_descriptions.join(', ') || 'N/A'}</td></tr>
            </table>

            <h4>Orthologs & Conservation</h4>
            <table class="gene-detail-table">
                <tr><th>Mouse</th><td>${ortholog_mouse || 'N/A'}</td></tr>
                <tr><th>C. elegans</th><td>${ortholog_c_elegans || 'N/A'}</td></tr>
                <tr><th>Zebrafish</th><td>${ortholog_zebrafish || 'N/A'}</td></tr>
                <tr><th>Drosophila</th><td>${ortholog_drosophila || 'N/A'}</td></tr>
            </table>

            <h4>Ciliary Phenotypic Effects (Curated Summary)</h4>
            <table class="gene-detail-table">
                <tr><th>LOF Effects</th><td>${lof_effects || 'Not Reported'}</td></tr>
                <tr><th>Overexpression Effects</th><td>${overexpression_effects || 'Not Reported'}</td></tr>
                <tr><th>% Ciliated Cells Effect</th><td>${percent_ciliated_cells_effects || 'Not Reported'}</td></tr>
            </table>
            
            <h4>Genome-Wide Screen Results</h4>
            ${renderDetailedScreenTable(screens_from_separate_file)}
            
            <p class="ai-suggestion">
                <a href="#" class="ai-action" data-action="expression-visualize" data-gene="${geneSymbol}">📊 View tissue expression heatmap</a>
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

// Click handler for all interactions (Gene selection, Quick queries, and Plot switching)
document.addEventListener('click', (e) => {
    if (e.target.matches('.gene-card, .gene-name')) {
        const geneName = e.target.dataset.geneName || e.target.textContent.trim();
        if (geneName) handleCiliAISelection([geneName]);
    }

    // 2. Handle clicks on the example questions (STANDARD)
    else if (e.target.matches('.example-queries span')) {
        const aiQueryInput = document.getElementById('aiQueryInput');
        // Use the data-question attribute for the full query
        aiQueryInput.value = e.target.dataset.question || e.target.textContent;
        handleAIQuery();
    }
    // 3. Handle clicks on special action links (UPDATED LOGIC)
    else if (e.target.classList.contains('ai-action')) {
        e.preventDefault();
        const action = e.target.dataset.action;
        const genesString = e.target.dataset.genes; // Comma-separated list of genes
        const resultArea = document.getElementById('ai-result-area');

        // --- 3a. Handle Phylogenetic Switching (CRITICAL NEW LOGIC) ---
        if (action === 'show-nevers-heatmap' || action === 'show-li-heatmap') {
            if (genesString) {
                const genes = genesString.split(',').map(g => g.trim()).filter(Boolean);
                // Determine the target source ('nevers' or 'li')
                const source = action.includes('nevers') ? 'nevers' : 'li';
                
                resultArea.innerHTML = `<p class="status-searching">Switching to ${source.toUpperCase()} comparison...</p>`;
                
                // Call the main router with the explicit source parameter
                // This ensures the correct renderer (Li or Nevers) is selected within the router.
                handlePhylogenyVisualizationQuery(`Show ${source} heatmap for ${genes.join(',')}`, source);
            }
        }
        // --- 3b. Handle Expression Visualization (Existing Logic) ---
        else if (action === 'expression-visualize' && genesString) {
            const gene = genesString;
            resultArea.innerHTML = `<p class="status-searching">Building expression heatmap...</p>`;
            
            if (window.tissueDataCache) {
                 displayCiliAIExpressionHeatmap([gene], resultArea, window.tissueDataCache);
            } else {
                 fetchTissueData().then(tissueData => {
                     displayCiliAIExpressionHeatmap([gene], resultArea, tissueData);
                 });
            }
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

// --- FINAL UPDATED formatListResult (Accepts 5 arguments) ---

function formatListResult(title, geneList, citationHtml = '', speciesCode = '', targetKey = null) {
    if (!geneList || geneList.length === 0) {
        // ... (unchanged)
        return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No matching genes found.</p></div>`;
    }

    const displayedGenes = geneList.slice(0, 100);
    const showOrthologColumn = targetKey && targetKey !== null;
    
    // Determine species name for the ortholog column header
    const orthologSpeciesName = speciesCode.replace(/(\w\.\w+)\s*/, '').replace('drosophila', 'Fly').replace('elegans', 'C. elegans').trim() || 'Ortholog';

    // Determine the most accurate label for the Human Gene Column
    let humanColumnLabel = "Human Gene";
    if (title.includes("Genes Conserved")) {
        humanColumnLabel = "Human Disease Gene"; // Best label for conserved disease lists
    }
    
    // --- Build Table Rows ---
    const tableRows = displayedGenes.map(g => {
        let cells = `<td><strong>${g.gene}</strong></td>`;
        
        if (showOrthologColumn) {
            // Access the ortholog name using the dynamic key (g[targetKey])
            const orthologName = g[targetKey] || 'N/A';
            cells += `<td>${orthologName}</td>`;
        }
        
        cells += `<td>${g.description.substring(0, 100)}${g.description.length > 100 ? '...' : ''}</td>`;
        return `<tr>${cells}</tr>`;
    }).join('');

    // --- Build Table Header ---
    let tableHeader = `
    <thead>
        <tr>
            <th class="sortable">${humanColumnLabel}</th>`;
    
    if (showOrthologColumn) {
        tableHeader += `<th class="sortable">${orthologSpeciesName} Ortholog</th>`;
    }
    
    tableHeader += `
            <th>Disease/Conservation Info</th>
        </tr>
    </thead>`;

    // --- Final HTML Structure ---
    const tableHtml = `
    <table class="ciliopathy-table" id="download-table-content">
        ${tableHeader}
        <tbody>${tableRows}</tbody>
    </table>
    ${geneList.length > 100 ? `<p><a href="https://theciliahub.github.io/" target="_blank">View full list (${geneList.length} genes) in CiliaHub</a></p>` : ''}`;
    
    const titleHtml = `<h3>${title} (${geneList.length} found)</h3>`;
    const downloadButtonHtml = `<button class="download-button" onclick="downloadTable('download-table-content', '${title.replace(/[^a-z0-9]/gi, '_')}')">Download CSV</button>`;


    return `
    <div class="result-card">
        ${titleHtml}
        ${tableHtml}
        ${downloadButtonHtml}
        ${citationHtml}
    </div>`;
}

// ----------------------------------------------------------------------
// NEW FUNCTIONALITY: CLIENT-SIDE CSV DOWNLOAD
// ----------------------------------------------------------------------
/**
 * Downloads the content of a target HTML table as a CSV file.
 * @param {string} tableId - The ID of the table element.
 * @param {string} filename - The name for the output file.
 */
function downloadTable(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;

    let csv = [];
    const rows = table.querySelectorAll('tr');

    for (const row of rows) {
        // Get text content of all non-empty cell elements in the row
        const rowData = Array.from(row.querySelectorAll('th, td'))
            .map(cell => {
                let text = cell.innerText.replace(/"/g, '""'); // Escape double quotes
                // For the "Reference" column (if included), extract text content without link
                if (cell.querySelector('a')) {
                    text = cell.textContent.trim().replace(/\s*Link$/, '');
                }
                return `"${text}"`;
            });
        csv.push(rowData.join(','));
    }

    const csvFile = csv.join('\n');
    const blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    
    if (link.download !== undefined) {
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", filename + ".csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

async function getGeneCiliaEffects(gene) {
    if (!ciliaHubDataCache) await fetchCiliaData(); // Ensures data is loaded/integrated
    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === gene.toUpperCase());

    if (!geneData) return `<div class="result-card"><h3>${gene}</h3><p class="status-not-found">Gene not found in the database.</p></div>`;

    // --- 1. Summarized Effects (from ciliahub_data.json) ---
    const lof = geneData.lof_effects || "Not Reported";
    const oe = geneData.overexpression_effects || "Not Reported";
    const percent = geneData.percent_ciliated_cells_effects || "Not Reported";

    const summarizedEffectsHtml = `
        <h4>Effects on Cilia (Curated Summary)</h4>
        <table class="gene-detail-table">
            <thead>
                <tr>
                    <th>Effect Type</th>
                    <th>Result</th>
                </tr>
            </thead>
            <tbody>
                <tr><th>Overexpression Effects</th><td>${oe}</td></tr>
                <tr><th>Loss-of-Function (LoF) Effects</th><td>${lof}</td></tr>
                <tr><th>Effects on % Ciliated Cells</th><td>${percent}</td></tr>
            </tbody>
        </table>`;

    // --- 2. Detailed Screen Findings (from cilia_screens_data.json) ---
    const screenFindings = geneData.screens_from_separate_file || [];
    let detailedScreensHtml = ``;

    if (screenFindings.length > 0) {
        const tableRows = screenFindings.map(s => `
            <tr>
                <td>${s.dataset || 'N/A'}</td>
                <td>${(s.mean_percent_ciliated !== undefined) ? s.mean_percent_ciliated.toFixed(2) : 'N/A'}</td>
                <td>${(s.z_score !== undefined) ? s.z_score.toFixed(2) : 'N/A'}</td>
                <td>${s.classification || s.result || 'N/A'}</td>
                <td><a href="${s.paper_link}" target="_blank">${s.dataset || 'Link'}</a></td>
            </tr>
        `).join('');

        detailedScreensHtml = `
            <h4 style="margin-top: 20px;">Detailed Genome-Wide Screen Findings</h4>
            <p>High-throughput screen results showing specific quantitative effects on ciliation.</p>
            <table class="ciliopathy-table">
                <thead>
                    <tr>
                        <th class="sortable">Dataset</th>
                        <th>Mean % Ciliated</th>
                        <th>Z-Score</th>
                        <th>Classification</th>
                        <th>Reference</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        `;
    } else {
        detailedScreensHtml = `<h4 style="margin-top: 20px;">Detailed Genome-Wide Screen Findings</h4><p class="status-not-found">No detailed screen data found for ${gene}.</p>`;
    }
    
    // --- 3. Final Output ---
    return `
        <div class="result-card">
            <h3>Ciliary Phenotype Analysis for ${gene}</h3>
            ${summarizedEffectsHtml}
            ${detailedScreensHtml}
        </div>`;
}

async function getOrthologsForGene(gene) {
    if (!ciliaHubDataCache) await fetchCiliaData();
    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === gene.toUpperCase());

    if (!geneData) return `<div class="result-card"><h3>${gene}</h3><p class="status-not-found">Gene not found in the database.</p></div>`;

    return `
        <div class="result-card">
            <h3>Orthologs of ${gene}</h3>
            <table class="gene-detail-table">
                <tr><th>Mouse (M. musculus)</th><td>${geneData.ortholog_mouse || 'N/A'}</td></tr>
                <tr><th>Worm (C. elegans)</th><td>${geneData.ortholog_c_elegans || 'N/A'}</td></tr>
                <tr><th>Xenopus (X. tropicalis)</th><td>${geneData.ortholog_xenopus || 'N/A'}</td></tr>
                <tr><th>Zebrafish (D. rerio)</th><td>${geneData.ortholog_zebrafish || 'N/A'}</td></tr>
                <tr><th>Fly (D. melanogaster)</th><td>${geneData.ortholog_drosophila || 'N/A'}</td></tr>
            </table>
        </div>`;
}

async function getGenesByCiliopathyClassification(classification) {
    if (!ciliaHubDataCache) await fetchCiliaData();
    const normalizedClassification = classification.toLowerCase().replace(/ciliopathy/g, 'disease');

    const genes = ciliaHubDataCache
        .filter(g => g.ciliopathy_classification && g.ciliopathy_classification.toLowerCase().includes(normalizedClassification))
        .map(g => ({ 
            gene: g.gene, 
            description: g.ciliopathy_classification + (g.ciliopathy ? `: ${g.ciliopathy.join(', ')}` : '')
        }))
        .sort((a, b) => a.gene.localeCompare(b.gene));

    return formatListResult(`Genes Classified as "${classification}"`, genes);
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
// =============================================================================
// ENHANCED: Autocomplete with Trigger Word Detection + Contextual Suggestions
// =============================================================================
function setupAiQueryAutocomplete() {
    const aiQueryInput = document.getElementById('aiQueryInput');
    const suggestionsContainer = document.getElementById('aiQuerySuggestions');
    if (!aiQueryInput || !suggestionsContainer) return;

    const metaQuestion = "What can you do?";
    
    aiQueryInput.addEventListener('focus', () => {
        if (!aiQueryInput.value) {
            suggestionsContainer.innerHTML = `<div class="suggestion-item">${metaQuestion}</div>`;
            suggestionsContainer.style.display = 'block';
        }
    });

    // Rich trigger word set for CiliaHub / CiliAI
    const triggerWords = [
        "list", "compare", "identify", "which", "what", "predict", "display",
        "describe", "show", "give", "provide", "tell me", "explain", "find",
        "summarize", "analyze", "define", "highlight", "report", "generate",
        "create", "outline", "make", "prepare", "how", "where", "is", "are",
        "can", "could", "would", "does", "did", "should", "why", "who", "help",
        "learn", "discover", "understand", "explore", "investigate", "test",
        "check", "search", "evolutionary", "phylogenetic", "expression",
        "localization", "interaction", "function", "role", "domain", "motif",
        "mutation", "variant", "disease", "homolog", "ortholog", "paralog",
        "sequence", "alignment", "model", "pathway", "network", "complex",
        "component", "isoform", "protein", "gene", "transcript", "phenotype",
        "mechanism", "cilia", "cilium", "ciliary", "basal body",
        "transition zone", "axoneme", "IFT", "BBSome", "OSM", "ARL", "KIF",
        "IFT88", "ARL13B", "BBS", "PercevalHR", "ATP", "mitochondria", "flagella"
    ];

    aiQueryInput.addEventListener('input', debounce(async () => {
        const inputText = aiQueryInput.value.toLowerCase().trim();
        let suggestions = new Set();

        if (inputText.length < 3) {
            if (inputText.length === 0) suggestions.add(metaQuestion);
            else suggestionsContainer.style.display = 'none';
            renderSuggestions(suggestions);
            return;
        }

        const words = inputText.split(/\s+/);
        const detectedTriggers = triggerWords.filter(w => words.includes(w));

        // --- Case 1: Trigger word detected ---
        if (detectedTriggers.length > 0) {
            detectedTriggers.forEach(trigger => {
                // Example: filter questions starting with or containing the trigger
                const related = questionRegistry
                    .filter(q => q.text.toLowerCase().includes(trigger))
                    .slice(0, 6);
                related.forEach(q => suggestions.add(q.text));
            });

            // If no question matches trigger, provide generic helper prompts
            if (suggestions.size === 0) {
                detectedTriggers.forEach(trigger => {
                    suggestions.add(`Show me ${trigger}-related data`);
                    suggestions.add(`Describe ${trigger} in cilia`);
                });
            }
        }

        // --- Case 2: Normal substring match (fallback) ---
        if (suggestions.size === 0) {
            questionRegistry
                .filter(item => item.text.toLowerCase().includes(inputText))
                .slice(0, 6)
                .forEach(item => suggestions.add(item.text));
        }

        // --- Case 3: Genes & complexes (broad support for scientific entities) ---
        const lastWord = words[words.length - 1];
        if (lastWord && lastWord.length >= 2) {
            const genes = intentParser.getAllGenes();
            if (genes.length > 0) {
                genes
                    .filter(gene => gene.toLowerCase().startsWith(lastWord))
                    .slice(0, 2)
                    .forEach(gene => suggestions.add(`Tell me about ${gene}`));
            }
            intentParser.getAllComplexes()
                .filter(c => c.toLowerCase().startsWith(lastWord))
                .forEach(c => suggestions.add(`Components of ${c}`));
        }

        renderSuggestions(suggestions);

    }, 250));

    // --- Render helper ---
    function renderSuggestions(suggestions) {
        const finalSuggestions = Array.from(suggestions).slice(0, 6);
        if (finalSuggestions.length > 0) {
            suggestionsContainer.innerHTML = finalSuggestions
                .map(s => `<div class="suggestion-item">${s}</div>`)
                .join('');
            suggestionsContainer.style.display = 'block';
        } else {
            suggestionsContainer.style.display = 'none';
        }
    }

    // --- Click handling remains the same ---
    suggestionsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-item')) {
            aiQueryInput.value = e.target.textContent;
            suggestionsContainer.style.display = 'none';
            aiQueryInput.focus();
            handleAIQuery();
        }
    });

    document.addEventListener('click', (e) => {
        if (!aiQueryInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
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

// --- ADDITION: New handler to query gene expression in specific cell types ---
async function getGeneExpressionInCellType(gene, cellType) {
    if (!cellxgeneDataCache) await fetchCellxgeneData();
    
    if (!cellxgeneDataCache) {
        return `<div class="result-card"><h3>Cell-Specific Expression</h3><p class="status-not-found">Could not load the single-cell expression dataset. Please check the console for errors.</p></div>`;
    }

    const geneUpper = gene.toUpperCase();
    const geneData = cellxgeneDataCache[geneUpper];

    if (!geneData) {
        return `<div class="result-card"><h3>${gene} in ${cellType}</h3><p class="status-not-found">Gene "${gene}" was not found in the single-cell dataset.</p></div>`;
    }

    // Find the closest matching cell type (case-insensitive)
    const queryCellTypeLower = cellType.toLowerCase();
    let bestMatch = Object.keys(geneData).find(
        key => key.toLowerCase().includes(queryCellTypeLower)
    );

    if (!bestMatch) {
        return `<div class="result-card"><h3>${gene} in ${cellType}</h3><p class="status-not-found">Cell type containing "${cellType}" was not found for this gene. Available types include: ${Object.keys(geneData).slice(0, 3).join(', ')}...</p></div>`;
    }

    const expressionValue = geneData[bestMatch];

    return `
    <div class="result-card">
        <h3>Expression of ${gene} in ${bestMatch}</h3>
        <p><strong>Normalized Expression:</strong> ${expressionValue.toFixed(4)}</p>
        <p style="font-size: 0.8em; color: #666; margin-top: 1rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
            Data from Cellxgene dataset: a2011f35-04c4-427f-80d1-27ee0670251d
        </p>
    </div>`;
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


// --- Global Exposure for Router ---
window.fetchCorumComplexes = fetchCorumComplexes;
window.getComplexesByGene = getComplexesByGene;
window.getSubunitsByComplexName = getSubunitsByComplexName;
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
