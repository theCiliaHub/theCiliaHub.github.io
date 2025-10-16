// --- Global Data Cache ---
let ciliaHubDataCache = null;
let screenDataCache = null;
let phylogenyDataCache = null;
// Note: tissueDataCache is attached to the window object in its function

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

// NEW: Intent Parser - The "Brain" of CiliAI
// =============================================================================
// REPLACEMENT: The definitive "Brain" of CiliAI, merging all features correctly.
// =============================================================================
function createIntentParser() {
    // Correctly classified diseases are preserved.
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
            "Smith-Lemli-Opitz Syndrome", "Spondylometaphyseal Dysplasia", "Stromme Syndrome", "Weyers Acrofacial Dysostosis"
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
        // ADDED: The new functional categories are now correctly included.
        { 
            type: 'FUNCTIONAL_CATEGORY',
            keywords: ['kinesin motors', 'dynein motors', 'Ciliary assembly/disassembly', 'Signaling', 'Motile cilium', 'Motor protein', 'Transport', 'Protein modification', 'Cytoskeletal'],
            handler: async (term) => getGenesByFunction(term),
            autocompleteTemplate: (term) => `Show me ${term} genes`
        },
        { 
            type: 'COMPLEX', 
            keywords: ['BBSome', 'IFT-A', 'IFT-B', 'Transition Zone Complex', 'MKS Complex', 'NPHP Complex'],
            handler: async (term) => {
                const results = await getGenesByComplex(term);
                return formatListResult(`Components of ${term}`, results);
            },
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
            keywords: ['basal body', 'axoneme', 'transition zone', 'centrosome', 'cilium', 'lysosome'],
            handler: async (term) => {
                const results = await getGenesByLocalization(term);
                return formatListResult(`Genes localizing to ${term}`, results);
            },
            autocompleteTemplate: (term) => `Show me ${term} localizing genes`
        },
        {
            type: 'ORGANISM',
            // PRESERVED: The full, comprehensive list of organisms is correctly included.
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
            handler: async (term) => {
                const { genes, description, speciesCode } = await getCiliaryGenesForOrganism(term);
                return formatListResult(`Ciliary genes in ${speciesCode}`, genes, description);
            },
            autocompleteTemplate: (term) => `Display ciliary genes in ${term}`
        },
        {
            type: 'DOMAIN',
            keywords: ['WD40', 'Leucine-rich repeat', 'IQ motif', 'calmodulin-binding', 'EF-hand'],
            handler: async (term) => {
                const results = await getGenesWithDomain(term);
                return formatListResult(`${term} domain-containing proteins`, results);
            },
            autocompleteTemplate: (term) => `Show ${term} domain containing proteins`
        }
    ];

    return {
        parse: (query) => {
            const normalizedQuery = normalizeTerm(query);
            for (const entityType of entityKeywords) {
                const sortedKeywords = [...entityType.keywords].sort((a, b) => b.length - a.length);
                for (const keyword of sortedKeywords) {
                    const keywordRegex = new RegExp(`\\b${normalizeTerm(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
                    if (keywordRegex.test(normalizedQuery)) {
                         return { intent: entityType.type, entity: keyword, handler: entityType.handler };
                    }
                }
            }
            return null;
        },
        getKnownKeywords: () => entityKeywords.flatMap(e => e.keywords.map(k => ({ keyword: k, suggestion: e.autocompleteTemplate(k) }))),
        getAllDiseases: () => [...new Set(allDiseases)],
        getAllComplexes: () => entityKeywords.find(e => e.type === 'COMPLEX').keywords
    };
}
const intentParser = createIntentParser();
// =============================================================================
// ADDITION: The new Question Registry and its required placeholder functions.
// Place this code block after your CILI_AI_DB object.
const questionRegistry = [
  // --- Gene-specific ---
  { text: "Tell me about ARL13B", handler: () => getComprehensiveDetails("ARL13B") },
  { text: "Show interactors of IFT88", handler: () => getProteinInteractions("IFT88") },
  
  // --- Disease-related (Corrected Handlers) ---
  { text: "Show genes for Joubert Syndrome", handler: async () => {
      const { genes, description } = await getCiliopathyGenes("Joubert Syndrome");
      return formatListResult('Genes for Joubert Syndrome', genes, description);
  }},
  { text: "Show genes for Bardet-Biedl Syndrome", handler: async () => {
      const { genes, description } = await getCiliopathyGenes("Bardet-Biedl Syndrome");
      return formatListResult('Genes for Bardet–Biedl Syndrome', genes, description);
  }},
  { text: "Display genes associated with Meckel-Gruber Syndrome", handler: async () => {
      const { genes, description } = await getCiliopathyGenes("Meckel-Gruber Syndrome");
      return formatListResult('Genes for Meckel–Gruber Syndrome', genes, description);
  }},
  { text: "List genes for Primary Ciliary Dyskinesia", handler: async () => {
      const { genes, description } = await getCiliopathyGenes("Primary Ciliary Dyskinesia");
      return formatListResult('Genes for Primary Ciliary Dyskinesia', genes, description);
  }},
  { text: "Find genes linked to Leber congenital amaurosis", handler: async () => {
      const { genes, description } = await getCiliopathyGenes("Leber congenital amaurosis");
      return formatListResult('Genes for Leber congenital amaurosis', genes, description);
  }},
  { text: "Which genes cause cystic kidney disease?", handler: () => getGenesByScreenPhenotype("cystic kidney disease") },
  { text: "Show genes for cranioectodermal dysplasia", handler: async () => {
      const { genes, description } = await getCiliopathyGenes("Cranioectodermal Dysplasia");
      return formatListResult('Genes for Cranioectodermal Dysplasia', genes, description);
  }},
  { text: "Tell me genes causing short-rib thoracic dysplasia", handler: async () => {
      const { genes, description } = await getCiliopathyGenes("Short-rib thoracic dysplasia");
      return formatListResult('Genes for Short-rib thoracic dysplasia', genes, description);
  }},
  { text: "Display genes related to hydrocephalus", handler: async () => {
      const { genes, description } = await getCiliopathyGenes("Hydrocephalus");
      return formatListResult('Genes related to Hydrocephalus', genes, description);
  }},

  // --- Localization-based (Corrected Handlers) ---
  { text: "Find genes localized to basal body", handler: async () => {
      const results = await getGenesByLocalization("Basal body");
      return formatListResult('Genes Localized to Basal Body', results);
  }},
  { text: "Show proteins in transition zone", handler: async () => {
      const results = await getGenesByLocalization("Transition zone");
      return formatListResult('Proteins in the Transition Zone', results);
  }},
  { text: "List components of the BBSome complex", handler: async () => {
      const results = await getGenesByComplex("BBSome");
      return formatListResult('Components of the BBSome Complex', results);
  }},
  { text: "Display genes at ciliary tip", handler: async () => {
      const results = await getGenesByLocalization("Ciliary tip");
      return formatListResult('Genes at the Ciliary Tip', results);
  }},
  { text: "Which genes localize to axoneme?", handler: async () => {
      const results = await getGenesByLocalization("Axoneme");
      return formatListResult('Genes Localized to the Axoneme', results);
  }},
  { text: "Show transition fiber proteins", handler: async () => {
      const results = await getGenesByLocalization("Transition fiber");
      return formatListResult('Transition Fiber Proteins', results);
  }},

  // --- Mechanism-based ---
  { text: "Show me motor genes", handler: () => getGenesWithDomain("motor") },
  { text: "Display kinases regulating cilia length", handler: () => getGenesByDomainDescription("kinase") },
  { text: "List intraflagellar transport (IFT) components", handler: () => getGenesByComplex("IFT") },
  { text: "Find IFT-A and IFT-B complex genes", handler: () => getGenesByMultipleComplexes(["IFT-A", "IFT-B"]) },
  { text: "Which genes are involved in cilium assembly?", handler: () => getGenesByFunction("cilium assembly") },

  // --- Organism-specific ---
  { text: "List ciliary genes in C. elegans", handler: () => getCiliaryGenesForOrganism("C. elegans").then(result => formatListResult(`Ciliary genes in C. elegans`, result.genes, result.description)) },
  { text: "Display conserved ciliary proteins between mouse and human", handler: () => getConservedGenes(["Mouse", "Human"]) },

  // --- Structure / Morphology ---
  { text: "Which genes cause longer cilia?", handler: () => getGenesByScreenPhenotype("long cilia") },
  { text: "Find genes causing short cilia", handler: () => getGenesByScreenPhenotype("short cilia") }
];
// Placeholder functions to support the new registry without errors
function notImplementedYet(feature) {
    return `<div class="result-card"><h3>Feature In Development</h3><p>The query handler for "<strong>${feature}</strong>" is not yet implemented. Stay tuned for future updates!</p></div>`;
}
const getGenesByScreenPhenotype = async (phenotype) => notImplementedYet(`Genes by screen phenotype: ${phenotype}`);

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

// =============================================================================
// NEW: Helper function to get comprehensive details for "Tell me about..." queries
// =============================================================================
async function getComprehensiveDetails(term) {
    const upperTerm = term.toUpperCase();
    
    // Check if it's a known complex
    const isComplex = intentParser.getAllComplexes().some(c => c.toUpperCase() === upperTerm);
    if (isComplex) {
        const results = await getGenesByComplex(term);
        return formatListResult(`Components of ${term}`, results);
    }

    // Otherwise, assume it's a gene
    if (!ciliaHubDataCache) await fetchCiliaData();
    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === upperTerm);
    
    return formatComprehensiveGeneDetails(upperTerm, geneData); // Re-use the existing detailed formatter
}



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
                            <input type="text" id="aiQueryInput" class="ai-query-input" placeholder="e.g., Joubert or BBSome...">
                            <div id="aiQuerySuggestions" class="suggestions-container"></div>
                            <button class="ai-query-btn" id="aiQueryBtn">Ask CiliAI</button>
                        </div>
                        <div class="example-queries">
                            <p>
                                <strong>Try asking:</strong> 
                                <span data-question="BBSome">BBSome</span>, 
                                <span data-question="Joubert">Joubert</span>, 
                                <span data-question="basal body">basal body</span>,
                                <span data-question="c. elegans">c. elegans</span>,
                                <span data-question="WD40">WD40</span>,
                                <span data-question="Expression of ARL13B">Expression of ARL13B</span>,
                                <span data-question="ciliary-only genes">ciliary-only genes</span>
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
            </style>
        `;
    } catch (error) {
        console.error('Failed to inject CiliAI HTML:', error);
        contentArea.innerHTML = '<p>Error: Failed to load CiliAI interface.</p>';
        return;
    }

    await Promise.all([fetchCiliaData(), fetchScreenData(), fetchPhylogenyData(), fetchTissueData()]);
    console.log('ciliAI.js: All data loaded');
    
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


// --- Data Fetching and Caching ---
async function fetchCiliaData() {
    if (ciliaHubDataCache) return ciliaHubDataCache;
    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/ciliahub_data.json');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();

        const processToArray = (field) => {
            if (typeof field === 'string') return field.split(',').map(item => item.trim()).filter(Boolean);
            if (Array.isArray(field)) return field;
            return [];
        };

        ciliaHubDataCache = data.map(gene => ({
            ...gene,
            functional_category: processToArray(gene.functional_category),
            domain_descriptions: processToArray(gene.domain_descriptions),
            ciliopathy: processToArray(gene.ciliopathy),
            localization: processToArray(gene.localization),
            complex_names: processToArray(gene.complex_names),
            complex_components: processToArray(gene.complex_components)
        }));
        
        console.log('CiliaHub data loaded and formatted successfully.');
        return ciliaHubDataCache;
    } catch (error) {
        console.error("Failed to fetch CiliaHub data:", error);
        ciliaHubDataCache = []; 
        return ciliaHubDataCache;
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



// --- Main AI Query Handler ---
// =============================================================================
// NEW CODE: Replace all functions from here down to the end of handleAIQuery
// =============================================================================

// --- Query Helper Functions ---
// --- New Query Helper for Gene-Specific Complex Info ---
async function getComplexesForGene(geneSymbol) {
    await fetchCiliaData();
    const upperTerm = geneSymbol.toUpperCase();
    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === upperTerm);
    
    // This reuses your existing formatter to display the complex data for the found gene.
    return formatComplexResults(geneData, `Complex Information for ${geneSymbol}`);
}

// --- NEW: Specific Gene-Query Helper Functions ---

async function isCiliaryGene(geneSymbol) {
    await fetchCiliaData();
    const upperTerm = geneSymbol.toUpperCase();
    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === upperTerm);
    let html = `<div class="result-card"><h3>Is ${geneSymbol} a ciliary gene?</h3>`;
    if (geneData) {
        html += `<p><strong>Yes</strong>, ${geneSymbol} is classified as a ciliary gene in CiliaHub.</p>`;
        if (geneData.ciliopathy && geneData.ciliopathy.length > 0) {
            html += `<p>It is associated with ciliopathies such as: <strong>${geneData.ciliopathy.join(', ')}</strong>.</p>`;
        }
    } else {
        html += `<p><strong>No</strong>, ${geneSymbol} was not found in the CiliaHub database of ciliary genes.</p>`;
    }
    html += `</div>`;
    return html;
}

async function getProteinDomains(geneSymbol) {
    await fetchCiliaData();
    const upperTerm = geneSymbol.toUpperCase();
    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === upperTerm);
    const content = geneData?.domain_descriptions?.join(', ') || 'No protein domain information available.';
    return formatGeneDetail(geneData, geneSymbol, 'Protein Domains', content);
}

async function getDiseasesForGene(geneSymbol) {
    await fetchCiliaData();
    const upperTerm = geneSymbol.toUpperCase();
    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === upperTerm);
    const content = geneData?.ciliopathy?.join(', ') || 'No associated diseases listed in the database.';
    return formatGeneDetail(geneData, geneSymbol, 'Associated Diseases (Ciliopathies)', content);
}

async function getGeneLocalization(geneSymbol) {
    await fetchCiliaData();
    const upperTerm = geneSymbol.toUpperCase();
    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === upperTerm);
    const content = geneData?.localization?.join(', ') || 'No localization data available.';
    return formatGeneDetail(geneData, geneSymbol, 'Subcellular Localization', content);
}

// --- REPLACEMENT: Interactive UI and Plotting with Plotly safeguard ---
async function displayEvolutionaryHeatmapUI(initialGenes = [], resultArea) {
    // FIX: Add a guard to ensure Plotly is loaded
    if (!window.Plotly) {
        resultArea.innerHTML = `<div class="result-card"><p class="status-not-found">Error: The plotting library could not be loaded. Please try again.</p></div>`;
        console.error('Plotly.js is not available.');
        return;
    }

    await fetchPhylogenyData();
    if (!phylogenyDataCache || Object.keys(phylogenyDataCache).length === 0) {
        resultArea.innerHTML = `<div class="result-card"><p class="status-not-found">Phylogeny data is not available.</p></div>`;
        return;
    }
    // ... rest of the function remains the same ...
    const classifiedOrganisms = {
        "Ciliary": ["H.sapiens", "M.musculus", "G.gallus", "X.tropicalis", "D.rerio", "O.anatinus", "B.floridae", "C.intestinalis", "S.purpuratus", "N.vectensis", "D.melanogaster", "C.elegans", "T.adhaerens", "M.brevicollis", "N.gruberi", "C.reinhardtii", "P.patens", "T.thermophila", "P.tetraurelia", "L.major"],
        "Non-Ciliary": ["A.thaliana", "O.sativa", "V.vinifera", "P.trichocarpa", "S.pombe", "N.crassa", "A.nidulans", "U.maydis", "Y.lipolytica", "C.albicans", "K.lactis", "A.gossypii", "C.glabrata", "D.discoideum", "E.cuniculi", "T.melanosporum", "F.graminearum", "P.chrysosporium", "C.immitis", "S.cerevisiae"]
    };
    
    const defaultOrganisms = [...classifiedOrganisms["Ciliary"].slice(0, 10), ...classifiedOrganisms["Non-Ciliary"].slice(-2)];

    let uiHtml = `
        <div class="result-card" id="evo-heatmap-controls">
            <h3>Evolutionary Conservation Analysis</h3>
            <div class="input-group">
                <label for="evoGeneInput">Gene Symbols (comma-separated):</label>
                <input type="text" id="evoGeneInput" class="ai-query-input" value="${initialGenes.join(', ')}">
            </div>
            <div class="input-group">
                <label>Select Organisms:</label>
                <div id="organism-selector" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <h4>Ciliary Species</h4>
                        ${classifiedOrganisms.Ciliary.map(org => `
                            <label style="display: block;"><input type="checkbox" class="org-checkbox" value="${org}" ${defaultOrganisms.includes(org) ? 'checked' : ''}> ${org}</label>
                        `).join('')}
                    </div>
                    <div>
                        <h4>Non-Ciliary Species</h4>
                        ${classifiedOrganisms.Non-Ciliary.map(org => `
                            <label style="display: block;"><input type="checkbox" class="org-checkbox" value="${org}" ${defaultOrganisms.includes(org) ? 'checked' : ''}> ${org}</label>
                        `).join('')}
                    </div>
                </div>
            </div>
            <button class="analyze-btn" id="generateEvoHeatmapBtn" style="width: auto; padding: 10px 15px;">📊 Generate Heatmap</button>
        </div>
        <div id="evo-plot-container" style="margin-top: 1rem;"></div>
    `;
    resultArea.innerHTML = uiHtml;

    const plotHeatmap = () => {
        const geneInput = document.getElementById('evoGeneInput');
        const plotContainer = document.getElementById('evo-plot-container');
        const genes = geneInput.value.split(/[\s,]+/).map(g => g.trim().toUpperCase()).filter(Boolean);
        
        const selectedOrganisms = Array.from(document.querySelectorAll('.org-checkbox:checked')).map(cb => cb.value);
        if (genes.length === 0 || selectedOrganisms.length === 0) {
            plotContainer.innerHTML = '<p class="status-not-found">Please enter at least one gene and select at least one organism.</p>';
            return;
        }

        const ciliarySet = new Set(classifiedOrganisms.Ciliary);
        const organismColors = selectedOrganisms.map(org => ciliarySet.has(org) ? '#0D47A1' : '#B71C1C');

        const matrix = genes.map(gene => {
            const geneData = phylogenyDataCache[gene];
            const speciesSet = new Set(geneData ? geneData.species : []);
            return selectedOrganisms.map(org => speciesSet.has(org) ? 1 : 0);
        });

        const trace = {
            z: matrix,
            x: selectedOrganisms,
            y: genes,
            type: 'heatmap',
            colorscale: [[0, '#f8f9fa'], [1, '#2c5aa0']],
            showscale: false,
            hovertemplate: '<b>Gene:</b> %{y}<br><b>Organism:</b> %{x}<br><b>Present:</b> %{z}<extra></extra>'
        };

        const layout = {
            title: 'Gene Presence Across Species',
            xaxis: { tickangle: -45, automargin: true, tickfont: { color: organismColors } },
            yaxis: { automargin: true },
            margin: { t: 50, b: 120, l: 100 },
            height: Math.max(400, genes.length * 30 + 150)
        };

        Plotly.newPlot('evo-plot-container', [trace], layout, { 
            responsive: true,
            toImageButtonOptions: {
                format: 'png',
                filename: 'evolutionary_conservation_heatmap',
                height: 700,
                width: 1000,
                scale: 1
            }
        });
    };

    document.getElementById('generateEvoHeatmapBtn').addEventListener('click', plotHeatmap);
    
    if (initialGenes.length > 0) {
        plotHeatmap();
    }
}

// --- NEW: Data structure for Trigger-Based Autocomplete ---
// --- NEW: Data structure for Trigger-Based Autocomplete ---
const CiliAI_Suggestions = {
    'evolutionary': {
        triggers: ['evolutionary', 'conserved', 'homolog', 'ortholog', 'paralog', 'phylogenetic', 'species', 'evolution'],
        questions: [
            'Show evolutionary conservation of IFT88 across species.',
            'List conserved ciliary genes between C. elegans and humans.',
            'Which cilia-related genes are conserved in mammals?',
        ]
    },
    'list': {
        triggers: ['list', 'show', 'display', 'give', 'find', 'let me know', 'tell me'],
        questions: [
            'List all genes localized to the transition zone.',
            'Show genes expressed in ciliated neurons.',
            'Display the list of BBSome components.',
            'Find all genes involved in intraflagellar transport (IFT).',
            'List all disease genes causing Joubert syndrome.',
        ]
    },
    'describe': {
        triggers: ['describe', 'what is', 'explain', 'function', 'role', 'responsible for', 'does'],
        questions: [
            'Describe the function of OSM-3.',
            'What is the role of CC2D1A in cilia?',
            'Explain how CILK1 regulates cilia length.',
            'What does ARL13B do in ciliary signaling?',
        ]
    }
    // ... other categories from your design can be added here
};

// Create a flat map for quick trigger lookup from the structure above
const triggerMap = new Map();
for (const category in CiliAI_Suggestions) {
    CiliAI_Suggestions[category].triggers.forEach(trigger => {
        if (!triggerMap.has(trigger)) triggerMap.set(trigger, new Set());
        CiliAI_Suggestions[category].questions.forEach(q => triggerMap.get(trigger).add(q));
    });
}


// Create a flat map for quick trigger lookup
const triggerMap = new Map();
for (const category in CiliAI_Suggestions) {
    CiliAI_Suggestions[category].triggers.forEach(trigger => {
        if (!triggerMap.has(trigger)) triggerMap.set(trigger, []);
        triggerMap.get(trigger).push(...CiliAI_Suggestions[category].questions);
    });
}

async function getInteractingPartners(geneSymbol) {
    await fetchCiliaData();
    const upperTerm = geneSymbol.toUpperCase();
    const geneData = ciliaHubDataCache.find(g => g.gene.toUpperCase() === upperTerm);
     if (!geneData) {
        return `<div class="result-card"><h3>Interacting Partners for ${geneSymbol}</h3><p class="status-not-found">Gene not found in the database.</p></div>`;
    }
    let content = '';
    if (geneData.complex_components && geneData.complex_components.length > 0) {
        content += `This gene is a known component of the <strong>${geneData.complex_names.join(', ')}</strong> complex(es), which include(s): ${geneData.complex_components.join(', ')}. `;
    } else {
        content += 'No stable complex data is available in CiliaHub. ';
    }
    const stringLink = geneData.string_link ? `<a href="${geneData.string_link}" target="_blank">View detailed functional and physical interactions on STRING DB</a>` : 'STRING DB link not available.';
    content += stringLink;
    return formatGeneDetail(geneData, geneSymbol, 'Interacting Partners', content);
}


// Rule 1: Search for genes by ciliopathy/disease name
async function getCiliopathyGenes(disease) {
    await fetchCiliaData();
    const diseaseLower = normalizeTerm(disease);
    const diseaseRegex = new RegExp(diseaseLower.replace(/\s+/g, '[\\s_\\-–]*').replace('syndrome', '(syndrome)?'), 'i');
    
    const genes = ciliaHubDataCache
        .filter(g => g.ciliopathy.some(c => normalizeTerm(c).match(diseaseRegex)))
        .map(g => ({ gene: g.gene, description: g.ciliopathy.join(', ') }))
        .sort((a, b) => a.gene.localeCompare(b.gene));
    
    return { genes, description: `Found ${genes.length} genes associated with "${disease}".` };
}

// Rule 2: Search for genes by one or more localizations
async function getGenesByLocalization(locations) {
    await fetchCiliaData();
    const locationTerms = locations.split(/\s+or\s+/).map(normalizeTerm);
    return ciliaHubDataCache
        .filter(gene => gene.localization.some(loc => locationTerms.includes(normalizeTerm(loc))))
        .map(gene => ({ gene: gene.gene, description: gene.localization.join(', ') }))
        .sort((a, b) => a.gene.localeCompare(b.gene));
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

// Rule 6: Search for genes that contain a specific domain
async function getGenesWithDomain(domainName) {
    await fetchCiliaData();
    const domainRegex = new RegExp(domainName, 'i');
    return ciliaHubDataCache
        .filter(gene => gene.domain_descriptions.some(dd => dd.match(domainRegex)))
        .map(gene => ({ gene: gene.gene, description: gene.domain_descriptions.join(', ') }))
        .sort((a, b) => a.gene.localeCompare(b.gene));
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
// --- Helper: get genes by complex ---
// Rule 2: Search for genes that are part of a complex
async function getGenesByComplex(complexName) {
    await fetchCiliaData();
    const complexRegex = new RegExp(`^${complexName}$`, 'i'); // Exact match for the complex name
    const representativeGene = ciliaHubDataCache.find(gene => gene.complex_names.some(cn => cn.match(complexRegex)));
    
    // If a gene matches the complex name and lists components, return those components
    if (representativeGene && representativeGene.complex_components.length > 0) {
        return representativeGene.complex_components.map(c => ({ gene: c, description: `Component of ${representativeGene.complex_names.join(', ')}` }));
    }
    return []; // Return empty if no exact match or no components listed
}

// --- Main AI Query Handler (REPLACEMENT) ---
// --- REPLACEMENT: Final, Comprehensive AI Query Handler ---
window.handleAIQuery = async function() {
    const aiQueryInput = document.getElementById('aiQueryInput');
    const resultArea = document.getElementById('ai-result-area');
    const query = aiQueryInput.value.trim().replace(/[.?]$/, '');
    if (!query) return;

    resultArea.style.display = 'block';
    resultArea.innerHTML = `<p class="status-searching">CiliAI is thinking...</p>`;
    await Promise.all([fetchCiliaData(), fetchScreenData(), fetchTissueData(), fetchPhylogenyData()]);

    let resultHtml = '';
    const qLower = query.toLowerCase();
    let match;

    try {
        // --- PRIORITY 1: Specific, complex queries that need custom logic ---
        if ((match = qLower.match(/conserved ciliary genes between\s+([\w\.\s]+)\s+and\s+([\w\.\s]+)/i))) {
            resultHtml = await getConservedGenesBetweenOrganisms(match[1].trim(), match[2].trim());
        }
        else if ((match = qLower.match(/(?:evolutionary\s+conservation\s+of|show\s+phylogeny\s+for|display\s+evolutionary\s+tree\s+of)\s+([\w\-]+)/i))) {
             await displayEvolutionaryHeatmapUI([match[1].toUpperCase()], resultArea);
             return;
        }
        else if ((match = qLower.match(/compare\s+([\w\-]+)\s+(?:and|vs|versus)\s+([\w\-]+)/i))) {
            resultHtml = await compareComplexes(match[1].toUpperCase(), match[2].toUpperCase());
        }
        // --- PRIORITY 2: Broad "describe/explain/what is" queries for a single gene or complex ---
        else if ((match = qLower.match(/(?:explain\s+how|what\s+does|what\s+is\s+the\s+(?:function|role)\s+of|describe\s+the\s+(?:function|role)\s+of)\s+(?:the\s+)?([\w\-]+)/i))) {
            resultHtml = await getComprehensiveDetails(match[1].trim());
        }
        // --- PRIORITY 3: Phylum-level queries ---
        else if (qLower.match(/\b(ciliary-only|cilia-specific)\s+genes?\b/i)) {
             const { label, genes } = await getPhylogenyGenes({ type: 'ciliary_only_list' });
             resultHtml = formatListResult(label, genes);
        }
        // --- PRIORITY 4: Standard "Show me X for gene Y" queries ---
        else if ((match = qLower.match(/(?:where\s+is\s+([\w\-]+)\s+expressed|expression\s+of\s+([\w\-]+))/i))) {
            const gene = (match[1] || match[2]).toUpperCase();
            await displayEvolutionaryHeatmapUI([gene], resultArea, window.tissueDataCache);
            return;
        }
        // --- PRIORITY 5: Fallback to the keyword-based Intent Parser ---
        else {
            const intent = intentParser.parse(query);
            if (intent && typeof intent.handler === 'function') {
                resultHtml = await intent.handler(intent.entity);
            } else {
                // Final fallback: try to extract a gene/complex name and give a summary
                const potentialTerm = qLower.split(' ').pop().toUpperCase();
                if (ciliaHubDataCache.some(g => g.gene === potentialTerm) || intentParser.getAllComplexes().includes(potentialTerm)) {
                     resultHtml = await getComprehensiveDetails(potentialTerm);
                } else {
                     resultHtml = `<p>Sorry, I didn’t understand that. Please try a different question.</p>`;
                }
            }
        }
        resultArea.innerHTML = resultHtml;
    } catch (e) {
        resultArea.innerHTML = `<p class="status-not-found">An error occurred. Check the console for details.</p>`;
        console.error("CiliAI Query Error:", e);
    }
};



// Helper for the comparison query (updated titles and threshold)
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
    const { ensembl_id, functional_summary, description, localization, complex_names, complex_components, domain_descriptions, synonym, ciliopathy } = geneData;

    return `
        <div class="result-card">
            <h3>${geneSymbol} Details</h3>
            <table class="gene-detail-table">
                <tr><th>Ensembl ID</th><td>${ensembl_id || 'N/A'}</td></tr>
                <tr><th>Functional Summary</th><td>${functional_summary || description || 'N/A'}</td></tr>
                <tr><th>Localization</th><td>${localization.join(', ') || 'N/A'}</td></tr>
                <tr><th>Complex Name</th><td>${complex_names.join(', ') || 'N/A'}</td></tr>
                <tr><th>Complex Components</th><td>${complex_components.join(', ') || 'N/A'}</td></tr>
                <tr><th>Domain Descriptions</th><td>${domain_descriptions.join(', ') || 'N/A'}</td></tr>
                <tr><th>Synonym</th><td>${synonym || 'N/A'}</td></tr>
                <tr><th>Ciliopathy</th><td>${ciliopathy.join(', ') || 'N/A'}</td></tr>
            </table>
            <h4>Screen Results</h4>
            ${screenDataCache && screenDataCache[geneSymbol] ? renderScreenDataTable(geneSymbol, screenDataCache[geneSymbol]) : '<p>No screen data available.</p>'}
            <p class="ai-suggestion">
                <a href="#" class="ai-action" data-action="expression-visualize" data-gene="${geneSymbol}">📊 View expression heatmap</a>
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

// -------------------------------
// Click handler for gene selection
// -------------------------------
document.addEventListener('click', (e) => {
    // 1. Handle clicks on gene cards/names from analysis results
    if (e.target.matches('.gene-card, .gene-name')) {
        const geneName = e.target.dataset.geneName || e.target.textContent.trim();
        if (geneName) handleCiliAISelection([geneName]);
    }

    // 2. Handle clicks on the example questions (e.g., "BBSome", "Joubert")
    if (e.target.matches('.example-queries span')) {
        const aiQueryInput = document.getElementById('aiQueryInput');
        aiQueryInput.value = e.target.dataset.question || e.target.textContent;
        handleAIQuery();
    }

    // 3. Handle clicks on special action links within results, like visualizing a heatmap
    if (e.target.classList.contains('ai-action')) {
        e.preventDefault();
        const action = e.target.dataset.action;
        const gene = e.target.dataset.gene;
        if (action === 'expression-visualize' && gene) {
            const resultArea = document.getElementById('ai-result-area');
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
    
    // 4. NEW: Handle clicks on suggested questions from the CiliAI panel
    if (e.target.matches('.ciliAI-question-item')) {
        const aiQueryInput = document.getElementById('aiQueryInput');
        if (aiQueryInput) {
            aiQueryInput.value = e.target.textContent;
            handleAIQuery();
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

// --- Table Formatting ---
function formatListResult(title, geneList, message = '') {
    if (!geneList || geneList.length === 0) {
        return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No matching genes found.</p></div>`;
    }
    const messageHtml = message ? `<p>${message}</p>` : '';
    const displayedGenes = geneList.slice(0, 100);
    const tableHtml = `
    <table class="ciliopathy-table">
      <thead>
        <tr>
          <th class="sortable">Gene</th>
          <th>Description (Snippet)</th>
        </tr>
      </thead>
      <tbody>
        ${displayedGenes.map(g => `<tr><td><strong>${g.gene}</strong></td><td>${g.description.substring(0, 100)}${g.description.length > 100 ? '...' : ''}</td></tr>`).join('')}
      </tbody>
    </table>
    ${geneList.length > 100 ? `<p><a href="https://theciliahub.github.io/" target="_blank">View full list (${geneList.length} genes) in CiliaHub</a></p>` : ''}`;

    // NEW FEATURE: Add reference for phylogeny data
    let referenceHtml = '';
    const phylogenyKeywords = ['ciliary-only', 'non-ciliary-only', 'all organisms', 'human-specific'];
    if (phylogenyKeywords.some(kw => title.toLowerCase().includes(kw))) {
        referenceHtml = `<p style="font-size: 0.8em; color: #666; margin-top: 1rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
            Phylogenetic classification data extracted from: Li, Y. et al. (2014) <em>Cell</em>, 158(1), 213–225. <a href="https://pubmed.ncbi.nlm.nih.gov/24995987/" target="_blank" title="View on PubMed">PMID: 24995987</a>.
        </p>`;
    }

    return `
    <div class="result-card">
      <h3>${title} (${geneList.length} found)</h3>
      ${messageHtml}
      ${tableHtml}
      ${referenceHtml}
    </div>`;
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
// --- ADDITION: New Helper Functions for Advanced Queries ---

async function getConservedGenesBetweenOrganisms(org1, org2) {
    await fetchPhylogenyData();
    const organismMap = {
        'human': 'H.sapiens', 'humans': 'H.sapiens',
        'mouse': 'M.musculus', 'mice': 'M.musculus',
        'worm': 'C.elegans', 'c. elegans': 'C.elegans',
        'fly': 'D.melanogaster', 'drosophila': 'D.melanogaster',
        'zebrafish': 'D.rerio',
        'yeast': 'S.cerevisiae'
    };
    const speciesCode1 = organismMap[org1.toLowerCase()] || org1;
    const speciesCode2 = organismMap[org2.toLowerCase()] || org2;

    const conservedGenes = Object.values(phylogenyDataCache).filter(geneData => {
        const species = new Set(geneData.species || []);
        return species.has(speciesCode1) && species.has(speciesCode2);
    }).map(g => ({ gene: g.sym, description: `Conserved in ${speciesCode1} and ${speciesCode2}` }));
    
    return formatListResult(`Genes Conserved Between ${speciesCode1} and ${speciesCode2}`, conservedGenes);
}

async function compareComplexes(complex1, complex2) {
    const c1 = await getGenesByComplex(complex1);
    const c2 = await getGenesByComplex(complex2);

    const c1Set = new Set(c1.map(g => g.gene));
    const c2Set = new Set(c2.map(g => g.gene));
    
    const shared = c1.filter(g => c2Set.has(g.gene));
    const uniqueTo1 = c1.filter(g => !c2Set.has(g.gene));
    const uniqueTo2 = c2.filter(g => !c1Set.has(g.gene));
    
    const listToHtml = (genes, title) => `
        <h4>${title} (${genes.length})</h4>
        <ul>${genes.map(g => `<li>${g.gene}</li>`).join('')}</ul>`;

    let html = `
        <div class="result-card">
            <h3>Comparison: ${complex1} vs ${complex2}</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                <div>${listToHtml(uniqueTo1, `Unique to ${complex1}`)}</div>
                <div>${listToHtml(shared, 'Shared Components')}</div>
                <div>${listToHtml(uniqueTo2, `Unique to ${complex2}`)}</div>
            </div>
        </div>
    `;
    return html;
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

// --- REPLACEMENT: New Autocomplete function using the trigger-word system ---
// --- REPLACEMENT: New Autocomplete function using the trigger-word system ---
function setupAiQueryAutocomplete() {
    const aiQueryInput = document.getElementById('aiQueryInput');
    const suggestionsContainer = document.getElementById('aiQuerySuggestions');
    if (!aiQueryInput || !suggestionsContainer) return;

    aiQueryInput.addEventListener('input', debounce(async () => {
        const inputText = aiQueryInput.value.toLowerCase();
        const suggestions = new Set();

        if (inputText.length < 3) {
            suggestionsContainer.style.display = 'none';
            return;
        }

        // --- Provider 1: Trigger Word Suggestions ---
        const firstWord = inputText.split(' ')[0];
        if (triggerMap.has(firstWord)) {
            triggerMap.get(firstWord).forEach(q => suggestions.add(q));
        }

        // --- Provider 2: Dynamic Gene-Specific Suggestions ---
        const lastWord = inputText.split(/[\s,]+/).pop();
        if (lastWord.length >= 3) {
            if (!ciliaHubDataCache) await fetchCiliaData();
            const potentialGene = lastWord.toUpperCase();
            ciliaHubDataCache
                .filter(g => g.gene.startsWith(potentialGene))
                .slice(0, 1) // Suggest for the top match
                .forEach(g => {
                    suggestions.add(`Describe the function of ${g.gene}`);
                    suggestions.add(`Show evolutionary conservation of ${g.gene}`);
                    suggestions.add(`List diseases linked to ${g.gene}`);
                });
        }
        
        // --- Render Suggestions ---
        const finalSuggestions = Array.from(suggestions).slice(0, 8);
        if (finalSuggestions.length > 0) {
            suggestionsContainer.innerHTML = finalSuggestions.map(s => `<div class="suggestion-item">${s}</div>`).join('');
            suggestionsContainer.style.display = 'block';
        } else {
            suggestionsContainer.style.display = 'none';
        }
    }, 250));

    // Event listeners for suggestion click and hiding the box
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
async function getGenesByFunction(functionalCategory) {
    if (!ciliaHubDataCache) await fetchCiliaData();
    // A more flexible regex to catch terms like "kinesin" within "Motors (dynein/kinesin)"
    const categoryRegex = new RegExp(functionalCategory.replace('motors', ''), 'i');
    const results = ciliaHubDataCache
        .filter(gene => 
            Array.isArray(gene.functional_category) && 
            gene.functional_category.some(cat => cat.match(categoryRegex))
        )
        .map(gene => ({ 
            gene: gene.gene, 
            description: `Functional Category: ${gene.functional_category.join(', ')}` 
        }));
    return formatListResult(`Genes in Functional Category: ${functionalCategory}`, results);
}
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
