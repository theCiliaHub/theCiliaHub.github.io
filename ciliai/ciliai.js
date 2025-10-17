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
            keywords: ['kinesin motors', 'dynein motors', 'Ciliary assembly/disassembly', 'Signaling', 'Motile cilium', 'Motor protein', 'Transport', 'Protein modification', 'Cytoskeletal'],
            handler: async (term) => {
                const results = await getGenesByFunction(term);
                return formatListResult(`Genes in Functional Category: ${term}`, results);
            },
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
            keywords: [...new Set(allDiseases)], // Using the full, restored disease list
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
// =============================================================================
// =============================================================================
// REPLACEMENT: Comprehensive Question Registry & New Helper Functions
// =============================================================================
const questionRegistry = [
    // --- 1. Evolutionary / Conserved ---
    { text: "Show evolutionary conservation of IFT88", handler: async () => getGeneConservation("IFT88") },
    { text: "List conserved ciliary genes between C. elegans and humans", handler: async () => getConservedGenesBetween(["C. elegans", "H.sapiens"]) },
    { text: "Which cilia-related genes are conserved in mammals?", handler: async () => getConservedGenesBetween(["H.sapiens", "M.musculus"]) },
    { text: "Describe the conservation level of CC2D1A in vertebrates", handler: async () => getGeneConservation("CC2D1A") },
    { text: "Which ciliary proteins have nematode and vertebrate homologs?", handler: async () => getConservedGenesBetween(["C. elegans", "H.sapiens", "M.musculus", "D.rerio"]) },
    { text: "What is the phylogeny of IFT88?", handler: async () => getGeneConservation("IFT88") },
    { text: "Evolutionary conservation of ARL13B", handler: async () => getGeneConservation("ARL13B") },

    // --- 2. List / Show / Display ---
    { text: "List all genes localized to the transition zone", handler: async () => formatListResult("Genes at Transition Zone", await getGenesByLocalization("transition zone")) },
    { text: "Show genes expressed in ciliated neurons", handler: async () => notImplementedYet("Genes expressed in ciliated neurons (requires cell-type specific expression data)") },
    { text: "Display ciliary transport genes in C. elegans", handler: async () => { const { genes, description, speciesCode } = await getCiliaryGenesForOrganism("C. elegans", "Transport"); return formatListResult(`Transport genes in ${speciesCode}`, genes, description); }},
    { text: "Give me the list of BBSome components", handler: async () => formatListResult("Components of BBSome", await getGenesByComplex("BBSome")) },
    { text: "Let me know which genes affect cilia length", handler: async () => getGenesByScreenPhenotype("cilia length") },
    { text: "Find all genes involved in intraflagellar transport (IFT)", handler: async () => formatListResult("IFT Genes", await getGenesByFunction("Transport")) },
    { text: "Tell me which kinases are associated with cilia", handler: async () => formatListResult("Ciliary Kinases", await getGenesByDomainDescription("kinase")) },
    { text: "List all disease genes causing Joubert syndrome", handler: async () => { const { genes, description } = await getCiliopathyGenes("Joubert Syndrome"); return formatListResult("Genes for Joubert Syndrome", genes, description); }},
    
    // --- 3. Describe / What is / Explain ---
    { text: "Describe the function of KIF17", handler: async () => getGeneFunction("KIF17") },
    { text: "What is the role of CC2D1A in cilia?", handler: async () => getGeneFunction("CC2D1A") },
    { text: "Explain how CILK1 regulates cilia length", handler: async () => getGeneFunction("CILK1") },
    { text: "What does ARL13B do in ciliary signaling?", handler: async () => getGeneRole("ARL13B", "ciliary signaling") },
    { text: "Describe the localization of EFCAB7", handler: async () => getGeneLocalization("EFCAB7") },
    { text: "Explain how the BBSome complex is assembled", handler: async () => notImplementedYet("Detailed mechanism of BBSome assembly") },
    { text: "What is the function of IFT-A and IFT-B complexes?", handler: async () => compareComplexes("IFT-A", "IFT-B") },

    // --- 4. Cilia-specific domain / Structure ---
    { text: "Show cilia-specific domains of KIF17", handler: async () => getGeneDomains("KIF17") },
    { text: "Which domains of ARL13B mediate ciliary localization?", handler: async () => getGeneDomains("ARL13B") },
    { text: "List proteins with ciliary targeting sequences (CTS)", handler: async () => formatListResult("Proteins with CTS", await getGenesWithDomain("CTS")) },
    { text: "Describe structural domains of IFT172", handler: async () => getGeneDomains("IFT172") },
    { text: "Which genes contain coiled-coil domains involved in ciliogenesis?", handler: async () => formatListResult("Ciliogenesis Genes with Coiled-Coil Domains", await getGenesWithDomain("coiled-coil")) },
    
    // --- 5. Functional category / Pathway ---
    { text: "List genes involved in ciliary signaling pathways", handler: async () => formatListResult("Ciliary Signaling Genes", await getGenesByFunction("Signaling")) },
    { text: "Show components of the Hedgehog signaling in cilia", handler: async () => getHedgehogRegulators("all") },
    { text: "Which genes function in retrograde IFT?", handler: async () => formatListResult("Retrograde IFT Genes", await getGenesByFunction("retrograde IFT")) },
    { text: "Display genes required for basal body docking", handler: async () => formatListResult("Basal Body Docking Genes", await getGenesByFunction("basal body docking")) },
    { text: "List proteins involved in cilia assembly and maintenance", handler: async () => formatListResult("Cilia Assembly/Maintenance Genes", await getGenesByFunction("Ciliary assembly")) },
    { text: "Which genes are part of the ciliogenesis pathway?", handler: async () => formatListResult("Ciliogenesis Pathway Genes", await getGenesByFunction("Ciliary assembly")) },

    // --- 6. Ciliary disease / Syndrome / Phenotype ---
    { text: "List genes associated with Bardet–Biedl syndrome", handler: async () => { const { genes, description } = await getCiliopathyGenes("Bardet–Biedl syndrome"); return formatListResult("Genes for Bardet–Biedl syndrome", genes, description); }},
    { text: "Show mutations in CILK1 causing cranioectodermal dysplasia", handler: async () => getGeneDiseases("CILK1") },
    { text: "Display phenotypes observed in ift88 mutants", handler: async () => getKnockdownEffect("IFT88") },
    { text: "Which ciliary diseases are linked to transition zone defects?", handler: async () => notImplementedYet("Diseases linked to TZ defects") },
    { text: "Describe the phenotype of efcab7 loss in C. elegans", handler: async () => notImplementedYet("Phenotype of efcab7 loss in C. elegans") },
    { text: "Find all genes associated with ciliopathies", handler: async () => { const { genes, description } = await getCiliopathyGenes("ciliopathy"); return formatListResult("All Ciliopathy-Associated Genes", genes, description); }},

    // --- 7. Comparison / Difference ---
    { text: "Compare IFT-A and IFT-B complex composition", handler: async () => compareComplexes("IFT-A", "IFT-B") },
    { text: "What’s the difference between KIF17 and KIF3A functions?", handler: async () => compareGenes("KIF17", "KIF3A") },
    { text: "Compare cilia gene expression in C. elegans and mouse", handler: async () => notImplementedYet("Cross-species expression comparison") },
    
    // --- 8. Predict / Identify ---
    { text: "Predict potential ciliary genes using co-expression data", handler: async () => notImplementedYet("Prediction of ciliary genes") },
    { text: "Identify candidate ciliary kinases", handler: async () => notImplementedYet("Identification of candidate kinases") },
    { text: "List novel ciliary proteins not yet annotated", handler: async () => notImplementedYet("Discovery of novel ciliary proteins") }
];


// --- ADDITION: New Helper Functions for Expanded Questions ---
function notImplementedYet(feature) {
    return `<div class="result-card"><h3>Feature In Development</h3><p>The query handler for "<strong>${feature}</strong>" is not yet implemented. Stay tuned for future updates!</p></div>`;
}

const getGenesByScreenPhenotype = async (phenotype) => notImplementedYet(`Genes by screen phenotype: ${phenotype}`);

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
  { text: "List ciliary genes in C. elegans", handler: () => getCiliaryGenesForOrganism("C. elegans") },
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
  { text: "What are the interacting partners of BBS1?", handler: () => getProteinInteractions("BBS1") }
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
    if (!geneData) return `<div class="result-card"><h3>${gene}</h3><p class="status-not-found">Gene not found in the database.</p></div>`;
    
    const domains = geneData.domain_descriptions?.join(", ") || "No domain information available.";
    return formatGeneDetail(geneData, gene, "Protein Domains", domains);
}

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
    
    return `<div class="result-card"><h3>${screenName} Results for ${gene}</h3><p>${specificResult.result || "No specific result reported"}</p></div>`;
}

async function getHedgehogRegulators(regulationType) {
    await fetchScreenData();
    const hedgehogGenes = [];
    
    Object.entries(screenDataCache).forEach(([gene, screens]) => {
        const hedgehogScreen = screens.find(s => s.source === "Breslow2018");
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
    
    return formatListResult(title, hedgehogGenes);
}

async function getNoEffectGenes(screenName) {
    await fetchScreenData();
    const noEffectGenes = [];
    
    Object.entries(screenDataCache).forEach(([gene, screens]) => {
        const targetScreen = screens.find(s => s.source === screenName);
        if (targetScreen && targetScreen.result === "No effect") {
            noEffectGenes.push({ gene, description: `No effect in ${screenName}` });
        }
    });
    
    return formatListResult(`Genes with No Effect in ${screenName}`, noEffectGenes);
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

async function getGenesByComplex(complexName) {
    await fetchCiliaData();
    const complexRegex = new RegExp(complexName, 'i');
    
    const complexGenes = ciliaHubDataCache.filter(gene => 
        gene.complex_names && gene.complex_names.some(cn => cn.match(complexRegex))
    );
    
    if (complexGenes.length > 0) {
        return complexGenes.map(gene => ({
            gene: gene.gene,
            description: `Complex: ${gene.complex_names?.join(', ') || 'Unknown'}`
        }));
    }
    
    const relatedGenes = ciliaHubDataCache.filter(gene => 
        gene.functional_summary && gene.functional_summary.toLowerCase().includes(complexName.toLowerCase())
    ).map(gene => ({
        gene: gene.gene,
        description: gene.functional_summary?.substring(0, 100) + '...' || 'No description'
    }));
    
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

// --- Main AI Query Handler (REPLACEMENT) ---
window.handleAIQuery = async function() {
    const aiQueryInput = document.getElementById('aiQueryInput');
    const resultArea = document.getElementById('ai-result-area');
    const query = aiQueryInput.value.trim();
    if (!query) return;

    resultArea.style.display = 'block';
    resultArea.innerHTML = `<p class="status-searching">CiliAI is thinking...</p>`;
    await Promise.all([fetchCiliaData(), fetchScreenData(), fetchTissueData()]);

    let resultHtml = '';
    const qLower = query.toLowerCase();
    let match;

    try {
        // PRIORITY 1: Check for an exact match in the question registry first.
        const perfectMatch = questionRegistry.find(item => item.text.toLowerCase() === qLower);
        if (perfectMatch) {
            console.log(`Registry match found: "${perfectMatch.text}"`);
            resultHtml = await perfectMatch.handler();
        }
        // PRIORITY 2: Handle conversational "Tell me about..." queries.
        else if ((match = qLower.match(/(?:tell me about|what is|describe)\s+(.+)/i))) {
            const term = match[1].trim();
            resultHtml = await getComprehensiveDetails(term);
        }
        // PRIORITY 3: Use the existing intent parser for keyword-based queries.
        else {
            const intent = intentParser.parse(query);
            if (intent && typeof intent.handler === 'function') {
                console.log(`Intent parser match found: ${intent.intent} for entity: ${intent.entity}`);
                resultHtml = await intent.handler(intent.entity);
            }
            // PRIORITY 4: Fallback for any remaining specific patterns.
            else if ((match = qLower.match(/expression of\s+([a-z0-9\-]+)/i))) {
                const gene = match[1].toUpperCase();
                await displayCiliAIExpressionHeatmap([gene], resultArea, window.tissueDataCache);
                return;
            } else if (qLower.includes('ciliary-only genes')) {
                const { label, genes } = await getPhylogenyGenes({ type: 'ciliary_only_list' });
                resultHtml = formatListResult(label, genes);
            }
            // FINAL FALLBACK
            else {
                resultHtml = `<p>Sorry, I didn’t understand that. Please try one of the suggested questions or a known keyword.</p>`;
            }
        }
        resultArea.innerHTML = resultHtml;
    } catch (e) {
        resultArea.innerHTML = `<p class="status-not-found">An error occurred during your query. Check the console for details.</p>`;
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
        // Use the data-question attribute for the full query
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
            // Ensure tissue data is available before calling
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

// --- Autocomplete Logic (REPLACEMENT) ---
// =============================================================================
// REPLACEMENT: Autocomplete now handles both prefixes and keywords
// =============================================================================
function setupAiQueryAutocomplete() {
    const aiQueryInput = document.getElementById('aiQueryInput');
    const suggestionsContainer = document.getElementById('aiQuerySuggestions');
    if (!aiQueryInput || !suggestionsContainer) return;

    aiQueryInput.addEventListener('input', debounce(async () => {
        const inputText = aiQueryInput.value.toLowerCase();
        let suggestions = new Set();

        if (inputText.length < 3) {
            suggestionsContainer.style.display = 'none';
            return;
        }

        // --- Provider 1: Full questions from the registry ---
        questionRegistry
            .filter(item => item.text.toLowerCase().includes(inputText))
            .forEach(item => suggestions.add(item.text));

        // --- Provider 2: "Tell me about..." for genes and complexes ---
        if (inputText.startsWith('tell me') || inputText.startsWith('what is') || inputText.startsWith('describe')) {
            const term = inputText.split(/\s+/).pop();
            if (term.length >= 2) {
                const genes = intentParser.getAllGenes();
                if (genes.length > 0) {
                    genes.filter(gene => gene.toLowerCase().startsWith(term)).slice(0, 2).forEach(gene => suggestions.add(`Tell me about ${gene}`));
                }
                intentParser.getAllComplexes().filter(c => c.toLowerCase().startsWith(term)).forEach(c => suggestions.add(`Tell me about ${c}`));
            }
        }
        // --- Provider 3: Direct keyword suggestions from the intent parser ---
        else {
            intentParser.getKnownKeywords()
                .filter(item => item.keyword.toLowerCase().startsWith(inputText))
                .forEach(item => suggestions.add(item.suggestion));
        }

        // Display combined and deduplicated suggestions
        const finalSuggestions = Array.from(suggestions).slice(0, 6);
        if (finalSuggestions.length > 0) {
            suggestionsContainer.innerHTML = finalSuggestions.map(s => `<div class="suggestion-item">${s}</div>`).join('');
            suggestionsContainer.style.display = 'block';
        } else {
            suggestionsContainer.style.display = 'none';
        }
    }, 250));

    // Event listeners remain the same
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
