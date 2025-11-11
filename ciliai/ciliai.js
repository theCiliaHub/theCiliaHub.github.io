/**
 * ============================================================================
 * CiliAI.js – FINAL INTEGRATED & FIXED VERSION
 * ============================================================================
 *
 * What was broken?
 *   • ciliAI_waitForElements() was called **before** the HTML was injected.
 *   • The interval kept logging “element not found” forever.
 *
 * What is fixed?
 *   • ciliAI_waitForElements() is now **exported** and must be called
 *     **after** `displayCiliAIPage()` injects the HTML.
 *   • A robust MutationObserver + fallback timer guarantees the listeners
 *     are attached even if the DOM is slow to settle.
 *   • All console warnings are now meaningful and stop after success/failure.
 *
 * How to use
 *   1. Keep your `displayCiliAIPage()` exactly as you had it.
 *   2. **After** the line that sets `contentArea.innerHTML = `…`;`,
 *      call `ciliAI_waitForElements();` (see the tiny addition in the
 *      comment at the very bottom of this file).
 *
 * Version: 6.1 (Fixed DOM-initialisation)
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* 1. CILIARY GENE CACHE                                                      */
/* -------------------------------------------------------------------------- */
const ciliAI_geneCache = new Map();

/* -------------------------------------------------------------------------- */
/* 2. GATEKEEPER FUNCTION: GET ALL DATA FOR A GENE                             */
/* -------------------------------------------------------------------------- */
async function ciliAI_getGeneData(geneName) {
    const upperGeneName = geneName.toUpperCase();
    if (ciliAI_geneCache.has(upperGeneName)) return ciliAI_geneCache.get(upperGeneName);

    const dataPromise = (async () => {
        console.log(`[CiliAI Cache MISS] Fetching all data for ${upperGeneName}...`);

        const results = await Promise.allSettled([
            ciliAI_fetchCiliaHubData_internal(upperGeneName),
            ciliAI_fetchPhylogenyData_internal(upperGeneName),
            ciliAI_fetchDomainData_internal(upperGeneName),
            ciliAI_fetchComplexData_internal(upperGeneName),
            ciliAI_fetchTissueData_internal(upperGeneName),
            ciliAI_fetchScRnaData_internal(upperGeneName),
            ciliAI_fetchScreenData_internal(upperGeneName),
            ciliAI_fetchUMAPData_internal(upperGeneName)
        ]);

        const combinedData = {
            ...(results[0].status === 'fulfilled' ? results[0].value : { geneInfo: null, expression: null }),
            phylogeny: results[1].status === 'fulfilled' ? results[1].value : null,
            domains  : results[2].status === 'fulfilled' ? results[2].value : null,
            complex  : results[3].status === 'fulfilled' ? results[3].value : null,
            tissue   : results[4].status === 'fulfilled' ? results[4].value : null,
            scRNA    : results[5].status === 'fulfilled' ? results[5].value : null,
            screens  : results[6].status === 'fulfilled' ? results[6].value : null,
            umap     : results[7].status === 'fulfilled' ? results[7].value : null,
            lastFetched: new Date().toISOString()
        };

        if (!combinedData.geneInfo) {
            const notFound = { notFound: true, ...combinedData };
            ciliAI_geneCache.set(upperGeneName, Promise.resolve(notFound));
            return notFound;
        }

        return combinedData;
    })().catch(err => {
        console.error(`[CiliAI] Fatal fetch error for ${upperGeneName}:`, err);
        ciliAI_geneCache.delete(upperGeneName);
        return { notFound: true, error: err.message };
    });

    ciliAI_geneCache.set(upperGeneName, dataPromise);
    dataPromise.then(d => ciliAI_geneCache.set(upperGeneName, Promise.resolve(d)));
    return dataPromise;
}

/* -------------------------------------------------------------------------- */
/* 3. INTERNAL FETCH HELPERS                                                   */
/* -------------------------------------------------------------------------- */

// 3a. CiliaHub gene info & screens
async function ciliAI_fetchCiliaHubData_internal(gene) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/ciliahub_data.json';
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr = await res.json();
        const entry = arr.find(e => e.gene?.toUpperCase() === gene);
        return entry ? { geneInfo: entry, expression: entry.screens || null } : null;
    } catch (e) { console.error(`[CiliAI] CiliaHub fetch error:`, e); return null; }
}

// 3b. Phylogeny (Nevers / Li)
async function ciliAI_fetchPhylogenyData_internal(gene) {
    const urls = [
        'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/nevers_et_al_2017_matrix_optimized.json',
        'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/li_et_al_2014_matrix_optimized.json'
    ];
    try {
        const [n, l] = await Promise.allSettled(urls.map(u => fetch(u).then(r => r.json())));
        const out = {};
        if (n.status === 'fulfilled' && n.value?.[gene]) out.nevers = n.value[gene];
        if (l.status === 'fulfilled' && l.value?.[gene]) out.li = l.value[gene];
        return Object.keys(out).length ? out : null;
    } catch (e) { console.error(`[CiliAI] Phylogeny fetch error:`, e); return null; }
}

// 3c. Protein domains
async function ciliAI_fetchDomainData_internal(gene) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cili_ai_domain_database.json';
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const obj = await res.json();
        return obj[gene] || null;
    } catch (e) { console.error(`[CiliAI] Domain fetch error:`, e); return null; }
}

// 3d. Protein complexes (CORUM)
async function ciliAI_fetchComplexData_internal(gene) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/corum_humanComplexes.json';
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr = await res.json();
        const c = arr.filter(comp => comp.subunits?.some(s => s.gene_name?.toUpperCase() === gene));
        return c.map(cmp => ({
            complex_id: cmp.complex_id,
            complex_name: cmp.complex_name,
            members: cmp.subunits.map(s => s.gene_name)
        }));
    } catch (e) { console.error(`[CiliAI] Complex fetch error:`, e); return null; }
}

// 3e. Tissue expression
async function ciliAI_fetchTissueData_internal(gene) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/rna_tissue_consensus.tsv';
    try {
        const txt = await fetch(url).then(r => r.text());
        const lines = txt.split('\n');
        if (lines.length < 2) return null;
        const headers = lines[0].split('\t');
        const gIdx = headers.findIndex(h => /gene/i.test(h));
        const tIdx = headers.findIndex(h => /tissue/i.test(h));
        const vIdx = headers.findIndex(h => /nTPM/i.test(h));
        if (gIdx === -1 || tIdx === -1 || vIdx === -1) return null;
        const out = {};
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split('\t');
            if (cols[gIdx]?.toUpperCase() === gene) {
                out[cols[tIdx]] = parseFloat(cols[vIdx]);
            }
        }
        return Object.keys(out).length ? out : null;
    } catch (e) { console.error(`[CiliAI] Tissue fetch error:`, e); return null; }
}

// 3f. scRNA / CellXGene data
async function ciliAI_fetchScRnaData_internal(gene) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cellxgene_data.json';
    try {
        const obj = await fetch(url).then(r => r.json());
        const key = Object.keys(obj).find(k => k.toUpperCase() === gene);
        return key ? obj[key] : null;
    } catch (e) { console.error(`[CiliAI] scRNA fetch error:`, e); return null; }
}

// 3g. Screens / effects
async function ciliAI_fetchScreenData_internal(gene) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cilia_screens_data.json';
    try {
        const obj = await fetch(url).then(r => r.json());
        const key = Object.keys(obj).find(k => k.toUpperCase() === gene);
        return key ? obj[key] : null;
    } catch (e) { console.error(`[CiliAI] Screen fetch error:`, e); return null; }
}

// 3h. UMAP data
async function ciliAI_fetchUMAPData_internal(gene) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/umap_data.json';
    try {
        const obj = await fetch(url).then(r => r.json());
        const key = Object.keys(obj).find(k => k.toUpperCase() === gene);
        return key ? obj[key] : null;
    } catch (e) { console.error(`[CiliAI] UMAP fetch error:`, e); return null; }
}


// ============================================================================
// 4. 🧠 CiliAI DUAL-STAGE INTENT RESOLVER (FINAL)
// ============================================================================

// --- Main CiliAI query function ---
// ---------------------- Full ciliAI_queryGenes ----------------------
async function ciliAI_queryGenes(filters = {}) {
    // Ensure data is loaded
    if (!window.ciliaHubData || !Array.isArray(window.ciliaHubData)) {
        console.error("CiliaHub data not loaded!");
        return [];
    }

    // --- Complexes ---
    const complexes = {
        "BBSOME": ["BBS1","BBS2","BBS4","BBS5","BBS7","TTC8","BBS9","BBIP1"],
        "IFT COMPLEX": ["WDR19","IFT140","TTC21B","IFT122","WDR35","IFT43","IFT172","IFT80","IFT57","TRAF3IP1","CLUAP1","IFT20","IFT88","IFT81","IFT74","IFT70A","IFT70B","IFT56","IFT52","IFT46","IFT27","IFT25","IFT22"],
        "IFT-A COMPLEX": ["WDR19","IFT140","TTC21B","IFT122","WDR35","IFT43"],
        "IFT-B COMPLEX": ["IFT172","IFT80","IFT57","TRAF3IP1","CLUAP1","IFT20","IFT88","IFT81","IFT74","IFT70A","IFT70B","IFT56","IFT52","IFT46","IFT27","IFT25","IFT22"],
        "IFT-B1 COMPLEX": ["IFT172","IFT80","IFT57","TRAF3IP1","CLUAP1","IFT20"],
        "IFT-B2 COMPLEX": ["IFT88","IFT81","IFT74","IFT70A","IFT70B","IFT56","IFT52","IFT46","IFT27","IFT25","IFT22"],
        "IFT MOTOR COMPLEX": ["KIF3A","KIF3B","KIF17","DYNC2H1","DYNC2LI1","WDR34","WDR60"],
        "INTRAFLAGELLAR TRANSPORT MOTORS": ["KIF3A","KIF3B","KIF17","DYNC2H1","DYNC2LI1","WDR34","WDR60"],
        "EXOCYST": ["EXOC1","EXOC2","EXOC3","EXOC4","EXOC5","EXOC6","EXOC7","EXOC8"],
        "TRANSITION ZONE": ["NPHP1","MKS1","CEP290","AHI1","RPGRIP1L","TMEM67","CC2D2A","B9D1","B9D2"],
        "MKS MODULE": ["MKS1","TMEM17","TMEM67","TMEM138","B9D2","B9D1","CC2D2A","TMEM107","TMEM237","TMEM231","TMEM216","TCTN1","TCTN2","TCTN3"],
        "NPHP MODULE": ["NPHP1","NPHP3","NPHP4","RPGRIP1L","IQCB1","CEP290","SDCCAG8"],
        "BASAL BODY": ["CEP164","CEP83","SCLT1","CEP89","LRRC45","ODF2","CEP128","CEP135","CETN2","CETN3","POC1B","FBF1","CCDC41","CCDC120","OFD1"],
        "CENTRIOLE DISTAL APPENDAGES": ["CEP164","SCLT1","CEP89","LRRC45","CEP123","ANKRD26","FOPNL","CEP128","CEP135","FBF1","CCDC41","CCDC120"],
        "CENTRIOLE SUBDISTAL APPENDAGES": ["CEP128","ODF2","CCDC120","NIN","NINL","CEP170","CCDC68","CCDC102B"],
        "CENTRIOLAR SATELLITES": ["PCM1","CEP131","CEP290","OFD1","AZI1","CEP72","SSX2IP"],
        "TRANSITION FIBER": ["CEP164","CEP83","SCLT1","CEP89","LRRC45","CEP123","CEP350","CEP44"],
        "CILIARY TIP": ["HYDIN","IQCA1","CATSPER2","KIF19A","KIF7","CCDC78","CCDC33","SPEF1","CEP104","CSPP1","TOGARAM1","ARMC9","MAPRE1","MAPRE3","CCDC66"],
        "RADIAL SPOKE": ["RSPH1","RSPH3","RSPH4A","RSPH6A","RSPH9","RSPH10B","RSPH23","RSPH16","DRC1","DRC3","DRC4","DRC5"],
        "CENTRAL PAIR": ["HYDIN","SPAG6","SPAG16","SPAG17","POC1A","CEP131","CFAP43","CFAP44","CFAP45","CFAP47"],
        "DYNEIN ARM": ["DNAH1","DNAH2","DNAH5","DNAH6","DNAH7","DNAH8","DNAH9","DNAH10","DNAH11","DNALI1","DNAI1","DNAI2","DNAAF1","DNAAF2","DNAAF3","DNAAF4","LRRC6","CCDC103"],
        "OUTER DYNEIN ARM": ["DNAH5","DNAH11","DNAH17","DNAH18","DNAI1","DNAI2","DNAAF1","DNAAF2","DNAAF3","DNAAF4","LRRC6","CCDC103","WDR63"],
        "INNER DYNEIN ARM": ["DNAH2","DNAH7","DNAH10","DNALI1","DNAL4","DNAAF5","CCDC40","CCDC114","CCDC151"],
        "NEXIN-DYNEIN REGULATORY COMPLEX": ["GAS8","GAS2L2","CCDC39","CCDC40","CCDC164","CCDC65"],
        "ROOTLETIN COMPLEX": ["CROCC","CROCC2","CEP68","CEP44","ODF2"],
        "CENTRIOLE LINKER": ["CEP68","CEP250","C-NAP1","ROCK1","NEK2"],
        "SHH SIGNALING": ["SMO","PTCH1","GLI1","GLI2","GLI3","SUFU","KIF7","TULP3","IFT172","IFT81","ARL13B"],
        "GPCR COMPLEX": ["GPR161","GPR175","GPR22","GPR83","ADCY3","RXFP2","SSTR3","NPY2R","HTR6"],
        "HEDGEHOG TRAFFICKING COMPLEX": ["ARL13B","INPP5E","TULP3","IFT172","KIF7","BBS4","BBS5","SMO"],
        "CENTROSOME": ["CEP152","CEP192","PLK4","STIL","SAS6","CEP135","CETN2","PCNT","CDK5RAP2","CEP215"],
        "PEROXISOMAL COMPLEX": ["PEX1","PEX2","PEX3","PEX5","PEX6","PEX10","PEX12","PEX13","PEX14","PEX19"]
    };

    // --- Disease Classes ---
    const classifiedDiseases = {
        "Primary Ciliopathies": [ "Acrocallosal Syndrome","Alström Syndrome","Autosomal Dominant Polycystic Kidney Disease","Autosomal Recessive Polycystic Kidney Disease","Bardet–Biedl Syndrome","COACH Syndrome","Cranioectodermal Dysplasia","Ellis-van Creveld Syndrome","Hydrolethalus Syndrome","Infantile Polycystic Kidney Disease","Joubert Syndrome","Leber Congenital Amaurosis","Meckel–Gruber Syndrome","Nephronophthisis","Orofaciodigital Syndrome","Senior-Løken Syndrome","Short-rib Thoracic Dysplasia","Skeletal Ciliopathy","Retinal Ciliopathy","Syndromic Ciliopathy","Al-Gazali-Bakalinova Syndrome","Bazex-Dupré-Christol Syndrome","Bilateral Polycystic Kidney Disease","Biliary, Renal, Neurologic, and Skeletal Syndrome","Caroli Disease","Carpenter Syndrome","Complex Lethal Osteochondrodysplasia","Greig Cephalopolysyndactyly Syndrome","Kallmann Syndrome","Lowe Oculocerebrorenal Syndrome","McKusick-Kaufman Syndrome","Morbid Obesity and Spermatogenic Failure","Polycystic Kidney Disease","RHYNS Syndrome","Renal-hepatic-pancreatic Dysplasia","Retinal Dystrophy","STAR Syndrome","Smith-Lemli-Opitz Syndrome","Spondylometaphyseal Dysplasia","Stromme Syndrome","Weyers Acrofacial Dysostosis","Hydrocephalus" ], 
        "Motile Ciliopathies": [ "Primary Ciliary Dyskinesia","Birt-Hogg-Dubé Syndrome","Juvenile Myoclonic Epilepsy" ],
        "Secondary Diseases": [ "Ataxia-telangiectasia-like Disorder","Birt-Hogg-Dubé Syndrome","Cone-Rod Dystrophy","Cornelia de Lange Syndrome","Holoprosencephaly","Juvenile Myoclonic Epilepsy","Medulloblastoma","Retinitis Pigmentosa","Spinocerebellar Ataxia","Bazex-Dupré-Christol Syndrome","Lowe Oculocerebrorenal Syndrome","McKusick-Kaufman Syndrome","Pallister-Hall Syndrome","Simpson-Golabi-Behmel Syndrome","Townes-Brocks Syndrome","Usher Syndrome","Visceral Heterotaxy" ],
        "Atypical Ciliopathies": [ "Biliary Ciliopathy","Chronic Obstructive Pulmonary Disease","Ciliopathy","Ciliopathy - Retinal dystrophy","Golgipathies or Ciliopathy","Hepatic Ciliopathy","Male Infertility and Ciliopathy","Male infertility","Microcephaly and Chorioretinopathy Type 3","Mucociliary Clearance Disorder","Notch-mediated Ciliopathy","Primary Endocardial Fibroelastosis","Retinal Ciliopathy","Retinal Degeneration","Skeletal Ciliopathy","Syndromic Ciliopathy" ]
    };

    // --- Organism Keywords ---
    const organismKeywords = ["human","mouse","fly","zebrafish","yeast","worm","prokaryote","E.cuniculi","E.histolytica","E.dispar","G.lamblia","T.vaginalis","T.brucei","T.cruzi","L.infantum","L.major","L.braziliensis","T.gondii","C.hominis","C.parvum","B.bovis","T.annulata","T.parva","P.knowlesi","P.vivax","P.falciparum","P.chabaudi","P.berghei","P.yoelii","P.tetraurelia","T.thermophila","P.infestans","T.pseudonana","P.tricornutum","C.merolae","N.gruberi","O.lucimarinus","O.tauri","C.reinhardtii","V.carteri","P.patens","S.moellendorffii","S.bicolor","Z.mays","O.sativa","B.distachyon","A.lyrata","A.thaliana","L.japonicus","M.truncatula","V.vinifera","P.trichocarpa","R.communis","T.trahens","D.discoideum","A.macrogynus","S.punctatus","M.globosa","U.maydis","C.neoformans","P.chrysosporium","S.commune","C.cinerea","L.bicolor","S.pombe","B.fuckeliana","S.sclerotiorum","F.graminearum","M.grisea","N.crassa","P.anserina","P.chrysogenum","A.clavatus","A.fumigatus","N.fischeri","A.flavus","A.oryzae","A.niger","A.nidulans","U.reesii","C.immitis","C.posadasii","P.nodorum","T.melanosporum","Y.lipolytica","P.pastoris","C.lusitaniae","D.hansenii","M.guilliermondii","S.stipitis","L.elongisporus","C.tropicalis","C.albicans","C.dubliniensis","K.lactis","A.gossypii","K.waltii","L.thermotolerans","Z.rouxii","V.polyspora","C.glabrata","S.bayanus","S.mikatae","S.cerevisiae","S.paradoxus","S.arctica","C.owczarzaki","M.brevicollis","S.rosetta","S.mansoni","B.malayi","C.briggsae","C.elegans","D.pulex","A.pisum","P.humanus","A.mellifera","N.vitripennis","B.mori","T.castaneum","D.melanogaster","D.pseudoobscura","A.gambiae","A.aegypti","C.quinquefasciatus","B.floridae","T.adhaerens","S.purpuratus","H.magnipapillata","N.vectensis","C.intestinalis","D.rerio","O.latipes","F.rubripes","T.nigroviridis","X.tropicalis","G.gallus","M.gallopavo","O.anatinus","M.domestica","S.scrofa","M.musculus","C.familiaris","B.taurus","H.sapiens"];

    // --- Expand complexes into member genes ---
    let filterGenes = filters.genes || [];
    if (filters.complex) {
        filters.complex.forEach(cpx => {
            if (complexes[cpx]) filterGenes.push(...complexes[cpx]);
        });
    }
    filterGenes = [...new Set(filterGenes.map(g => g.toUpperCase()))]; // unique uppercase

    // --- Expand disease classes into diseases ---
    let filterDiseases = [];
    if (filters.disease_class) {
        filters.disease_class.forEach(dc => {
            if (classifiedDiseases[dc]) filterDiseases.push(...classifiedDiseases[dc]);
        });
    }
    if (filters.disease) filterDiseases.push(...filters.disease);
    filterDiseases = [...new Set(filterDiseases.map(d => d.toLowerCase()))];

    // --- Organism filter ---
    let filterOrganisms = [];
    if (filters.organism) {
        filterOrganisms = Array.isArray(filters.organism) ? filters.organism.map(o => o.toLowerCase()) : [filters.organism.toLowerCase()];
    }

    // --- LOF / OE / Screens / Domains ---
    const lofFilter = filters.lof_effects ? filters.lof_effects.toLowerCase() : null;
    const oeFilter = filters.overexpression_effects ? filters.overexpression_effects.toLowerCase() : null;
    const screenFilter = filters.screens ? filters.screens.map(s => s.toLowerCase()) : [];
    const domainFilter = filters.domains ? filters.domains.map(d => d.toLowerCase()) : [];

    // --- Filtering ---
    const results = window.ciliaHubData.filter(gene => {
        // Gene name / complex membership
        if (filterGenes.length && !filterGenes.includes(gene.gene.toUpperCase())) return false;

        // Organism
        if (filterOrganisms.length && !filterOrganisms.some(org => (gene.organism || "").toLowerCase().includes(org))) return false;

        // Diseases
        if (filterDiseases.length && !gene.associated_diseases?.some(d => filterDiseases.includes(d.toLowerCase()))) return false;

        // LOF
        if (lofFilter && !(gene.lof_effects || "").toLowerCase().includes(lofFilter)) return false;

        // Overexpression
        if (oeFilter && !(gene.overexpression_effects || "").toLowerCase().includes(oeFilter)) return false;

        // Screens
        if (screenFilter.length && !gene.screens?.some(s => screenFilter.includes(s.toLowerCase()))) return false;

        // Domains / PFAM
        if (domainFilter.length && !gene.domain_descriptions?.some(d => domainFilter.includes(d.toLowerCase()))) return false;

        return true;
    });

    return results;
}
// -------------------------------------------------------------------

/**
 * Parses the user's query and calls the appropriate handler function.
 * This is the main entry point for all user input *to CiliAI*.
 *
 * @param {string} query - The raw user input.
 */
async function ciliAI_resolveIntent(query) {
    console.log("[CiliAI LOG] 4. ciliAI_resolveIntent started.");
    const qLower = query.toLowerCase().trim();
    
    ciliAI_updateChatWindow("Thinking...", "system");

    try {
        // --- STAGE 1: Check for complex, list-based, or non-gene queries ---
        console.log("[CiliAI LOG] 5. Trying Stage 1 (Complex Intent)...");
        const complexResult = await ciliAI_resolveComplexIntent(qLower, query); 
        
        if (complexResult !== null) {
            console.log("[CiliAI LOG] 5a. Stage 1 Matched. Result:", complexResult);
            if (typeof complexResult === 'string') {
                ciliAI_updateChatWindow(complexResult, "ciliai");
            }
            return; // Intent was handled. Stop here.
        }

        console.log("[CiliAI LOG] 5b. Stage 1 Failed. Proceeding to Stage 2 (Single Gene)...");
        
        // --- STAGE 2: Fallback to single-gene query resolution ---
        
        // This RegEx looks for all-caps words (3+ chars) OR
        // words with letters and numbers (like IFT88).
        // It explicitly IGNORES common English words.
        const geneRegex = /\b(?!show\b|me\b|what\b|is\b|tell\b|about\b|for\b|genes\b)([A-Z]{3,}|[A-Z0-9-]{3,})\b/i;
        const geneMatch = query.match(geneRegex); // Match against the *original* query to preserve case
        const geneName = geneMatch ? geneMatch[1].toUpperCase() : null;

        console.log(`[CiliAI LOG] 6. Gene parsed: ${geneName}`);

        let intent = null;
        let params = { gene: geneName };

        // --- Intent Matching (for single-gene queries) ---
        if (qLower.includes("phylogeny") || qLower.includes("evolution") || qLower.includes("ortholog")) {
            intent = "getPhylogeny";
        } else if (qLower.includes("domain") || qLower.includes("structure")) {
            intent = "getDomains";
        } else if (qLower.includes("length") || qLower.includes("long") || qLower.includes("short")) {
            intent = "getCiliaLength";
        } else if (qLower.includes("complex") || qLower.includes("interact")) {
            intent = "getComplex";
        } else if (qLower.includes("expression") || qLower.includes("tissue") || qLower.includes("scrna")) {
            intent = "getExpression"; // New consolidated intent
        } else if (qLower.includes("summary") || qLower.includes("what is") || qLower.includes("tell me about")) {
            intent = "getSummary"; 
        } else if (geneName) {
            intent = "getSummary"; // Default action
        } else if (qLower.includes("hello") || qLower.includes("hi")) {
            intent = "greet";
        } else {
            intent = "unknown";
        }

        console.log(`[CiliAI LOG] 7. Intent parsed: ${intent}`);

        // --- Action Dispatch (for single-gene queries) ---
        if (intent !== "greet" && intent !== "unknown" && !params.gene) {
            console.warn("[CiliAI LOG] 7a. Intent needs gene, but none found.");
            ciliAI_updateChatWindow("Please specify a gene name for that request.", "ciliai");
            return;
        }

        switch (intent) {
            case "getSummary":
                await ciliAI_handleGeneSummary(params.gene);
                break;
            case "getPhylogeny":
                await ciliAI_handlePhylogeny(params.gene);
                break;
            case "getDomains":
                await ciliAI_handleDomains(params.gene);
                break;
            case "getCiliaLength":
                await ciliAI_handleCiliaLength(params.gene);
                break;
            case "getComplex":
                await ciliAI_handleComplex(params.gene);
                break;
            case "getExpression": // Handles both tissue and scRNA
                await ciliAI_handleExpression(params.gene);
                break;
            case "greet":
                ciliAI_updateChatWindow("Hello! I am CiliAI. How can I help you learn about ciliary genes?", "ciliai");
                break;
            default: // unknown
                console.warn("[CiliAI LOG] 7b. Unknown intent.");
                ciliAI_updateChatWindow("I'm sorry, I didn't understand that. Please ask about a specific gene (e.g., 'What is IFT88?') or a complex topic (e.g., 'List genes for Joubert Syndrome').", "ciliai");
        }
    
    } catch (err) {
        console.error("[CiliAI] Error handling intent: ", err);
        ciliAI_updateChatWindow(`An unexpected error occurred: ${err.message}`, "error");
    }
}

/**
 * STAGE 1 HANDLER: Resolves complex, list-based, and non-gene queries.
 * @param {string} qLower - The lowercased query.
 * @param {string} query - The original query (for case-sensitive parts).
 * @returns {Promise<string | null>} An HTML string for display, or null if no intent is matched.
 */
async function ciliAI_resolveComplexIntent(qLower, query) {
    // --- Define semantic clusters for major biological contexts ---
    const intentClusters = {
        ciliary_tip: ["ciliary tip", "distal tip", "tip proteins", "tip components", "tip composition", "proteins at the ciliary tip", "ciliary tip complex", "enriched at the tip", "distal region", "ciliary tip proteome"],
        domain: ["domain", "motif", "architecture", "protein fold", "domain organization", "enriched", "depleted"],
        phylogeny: ["phylogeny", "evolution", "conservation", "ortholog", "paralog", "species tree", "evolutionary profile", "conservation heatmap", "conserved"],
        complex: ["complex", "interactome", "binding partners", "corum", "protein interaction", "ift", "bbsome", "dynein", "mks", "nphp", "radial spoke", "axoneme", "transition zone"],
        expression: ["expression", "umap", "tissue", "cell type", "where expressed", "scRNA", "single-cell", "transcript", "abundance", "expression pattern", "plot"],
        disease: ["mutation", "variant", "pathogenic", "ciliopathy", "disease", "syndrome", "bbs", "joubert", "mks", "pcd", "lca", "nephronophthisis", "polycystic kidney disease"],
        disease_classification: ["primary ciliopathy", "secondary ciliopathy", "motile ciliopathy", "atypical ciliopathy", "primary disease", "secondary disease", "motile disease", "atypical disease", "ciliopathy classification"],
        localization: ["localize", "location", "subcellular", "basal body", "transition zone", "centrosome", "axoneme", "ciliary membrane"],
        phenotype: ["knockdown", "phenotype", "effect", "shorter cilia", "longer cilia", "cilia length", "cilia number", "decreased ciliation", "loss of cilia"]
    };

    // --- Terms for Priority Checks ---
    const localizationTerms = [
        "basal body", "transition zone", "cilia", "axoneme", "centrosome",  
        "ciliary membrane", "nucleus", "lysosome", "mitochondria", "ciliary tip"
    ];
    const phenotypeTerms = [
        "short cilia", "longer cilia", "cilia length", "cilia defects",  
        "decreased ciliation", "loss of cilia", "reduced cilia", "increase", "decrease", "no effect"
    ];
    const diseaseNames = ["bardet-biedl syndrome", "joubert syndrome", "meckel-gruber syndrome", "primary ciliary dyskinesia", "leber congenital amaurosis", "nephronophthisis", "polycystic kidney disease", "autosomal dominant polycystic kidney disease", "autosomal recessive polycystic kidney disease", "short-rib thoracic dysplasia", "senior-løken syndrome", "cranioectodermal dysplasia", "nphp", "bbs", "mks", "pcd", "ciliopathy", "syndrome"];
    const strictPhenotypeTerms = ["phenotype", "short cilia", "long cilia", "cilia length", "cilia number", "decreased ciliation", "loss of cilia", "reduced cilia", "increase", "decrease"];

    // --- Check for gene name ---
    const geneRegex = /\b(?!show\b|me\b|what\b|is\b|tell\b|about\b|for\b|genes\b)([A-Z]{3,}|[A-Z0-9-]{3,})\b/i;
    const hasGene = geneRegex.test(qLower);

    // --- Priority Rule 1: Combined "disease" + "phenotype" ---
    const matchedDisease = diseaseNames.find(name => qLower.includes(name));
    const matchedStrictPhenotype = strictPhenotypeTerms.find(term => qLower.includes(term));

    if (matchedDisease && matchedStrictPhenotype) {
        const standardDisease =
            matchedDisease.toUpperCase() === "BBS" ? "Bardet–Biedl Syndrome" :
            matchedDisease.toUpperCase() === "MKS" ? "Meckel–Gruber Syndrome" :
            matchedDisease.toUpperCase() === "PCD" ? "Primary Ciliary Dyskinesia" :
            matchedDisease.toUpperCase() === "NPHP" ? "Nephronophthisis" :
            matchedDisease;
        console.log(`[CiliAI Complex] getDiseaseGenesByPhenotype("${standardDisease}", "${matchedStrictPhenotype}")`);
        return `<p>Functionality for 'getDiseaseGenesByPhenotype' (Disease: ${standardDisease}, Phenotype: ${matchedStrictPhenotype}) is not yet implemented.</p>`; // Placeholder
    }

    // --- Priority Rule 2: Combined "localization" + "phenotype" ---
    const matchedLocalization = localizationTerms.find(name => qLower.includes(name));
    const matchedPhenotype = phenotypeTerms.find(term => qLower.includes(term));

    if (matchedLocalization && matchedPhenotype) {
        console.log(`[CiliAI Complex] getLocalizationPhenotypeGenes("${matchedLocalization}", "${matchedPhenotype}")`);
        return `<p>Functionality for 'getLocalizationPhenotypeGenes' (Location: ${matchedLocalization}, Phenotype: ${matchedPhenotype}) is not yet implemented.</p>`; // Placeholder
    }
    
    // --- Rule-based fuzzy detection (Fallback) ---
    let detectedIntent = null;
    for (const [intent, phrases] of Object.entries(intentClusters)) {
        if (phrases.some(p => qLower.includes(p))) {
            detectedIntent = intent;
            break;
        }
    }

    // --- If an intent is detected BUT a gene is also present, FALL BACK ---
    if (hasGene && detectedIntent && 
        ["phylogeny", "domain", "complex", "expression", "localization", "phenotype"].includes(detectedIntent)) {
        return null; // Let Stage 2 (single-gene handler) take it
    }

    // --- Intent Resolution Logic (No gene present) ---

    if (detectedIntent === "ciliary_tip") {
        console.log("[CiliAI Complex] getCuratedComplexComponents('CILIARY TIP')");
        return `<p>Functionality for 'getCuratedComplexComponents' (CILIARY TIP) is not yet implemented.</p>`; // Placeholder
    }

    // --- Disease Classification Handler ---
    else if (detectedIntent === "disease_classification") {
        let classification = null;
        if (qLower.includes('primary ciliopathy') || qLower.includes('primary disease')) {
            classification = "Primary Ciliopathies";
        } else if (qLower.includes('motile ciliopathy') || qLower.includes('motile disease')) {
            classification = "Motile Ciliopathies";
        } else if (qLower.includes('secondary ciliopathy') || qLower.includes('secondary disease')) {
            classification = "Secondary Diseases";
        } else if (qLower.includes('atypical ciliopathy') || qLower.includes('atypical disease')) {
            classification = "Atypical Ciliopathies";
        }

        if (classification) {
            console.log(`[CiliAI Complex] getGenesByCiliopathyClassification("${classification}")`);
            return `<p>Functionality for 'getGenesByCiliopathyClassification' (${classification}) is not yet implemented.</p>`; // Placeholder
        }
    }

    // --- Specific Disease Handler (Generic List) ---
    else if (detectedIntent === "disease") {
        const diseaseList = ["bardet-biedl syndrome", "joubert syndrome", "meckel-gruber syndrome", "primary ciliary dyskinesia", "leber congenital amaurosis", "nephronophthisis", "polycystic kidney disease", "autosomal dominant polycystic kidney disease", "autosomal recessive polycystic kidney disease", "short-rib thoracic dysplasia", "senior-løken syndrome", "cranioectodermal dysplasia", "nphp", "bbs", "mks", "pcd", "ciliopathy", "syndrome"];

        let targetDisease = null;
        for (const name of diseaseList.sort((a, b) => b.length - a.length)) {
            if (qLower.includes(name)) {
                targetDisease = name;
                break;
            }
        }

        if (targetDisease) {
            const standardName =
                targetDisease.toUpperCase() === "BBS" ? "Bardet–Biedl Syndrome" :
                targetDisease.toUpperCase() === "MKS" ? "Meckel–Gruber Syndrome" :
                targetDisease.toUpperCase() === "PCD" ? "Primary Ciliary Dyskinesia" :
                targetDisease.toUpperCase() === "NPHP" ? "Nephronophthisis" :
                targetDisease;
            console.log(`[CiliAI Complex] getCiliopathyGenes("${standardName}")`);
            return `<p>Functionality for 'getCiliopathyGenes' (${standardName}) is not yet implemented.</p>`; // Placeholder
        }

        return `<p>🩺 Disease query detected, but no specific disease or classification was identified for listing genes. Please try a query like "List genes for Joubert Syndrome".</p>`;
    }

    // --- Domain Handler (No Gene) ---
    else if (detectedIntent === "domain") {
        console.log(`[CiliAI Complex] resolveDomainQuery("${query}")`);
        return `<p>Functionality for 'resolveDomainQuery' (without a gene) is not yet implemented.</p>`; // Placeholder
    }

    // --- Phylogeny Handler (No Gene) ---
    else if (detectedIntent === "phylogeny") {
        console.log(`[CiliAI Complex] resolvePhylogeneticQuery("${query}")`);
        return `<p>Functionality for 'resolvePhylogeneticQuery' (without a gene) is not yet implemented.</p>`; // Placeholder
    }

    // --- Complex Handler (No Gene) ---
    else if (detectedIntent === "complex") {
        console.log(`[CiliAI Complex] routeComplexPhylogenyAnalysis("${query}")`);
        return `<p>Functionality for 'routeComplexPhylogenyAnalysis' (without a gene) is not yet implemented.</p>`; // Placeholder
    }

    // --- Expression Handler (No Gene) ---
    else if (detectedIntent === "expression") {
        return `<p>🧬 Please specify a gene to show expression data.</p>`;
    }

    // --- Localization Handler (Generic List) ---
    else if (detectedIntent === "localization") {
        const locationMatch = qLower.match(/(basal body|transition zone|axoneme|centrosome|ciliary membrane)/);
        if (locationMatch && locationMatch[1]) {
            console.log(`[CiliAI Complex] getGenesByLocalization("${locationMatch[1]}")`);
            return `<p>Functionality for 'getGenesByLocalization' (${locationMatch[1]}) is not yet implemented.</p>`; // Placeholder
        } else {
            return `<p>📍 Localization query detected. Please be more specific (e.g., "genes in the basal body").</p>`;
        }
    }
    // --- Phenotype Handler (Generic List) ---
    else if (detectedIntent === "phenotype") {
        return `<p>🔎 Phenotype/Screen query detected. Please use a specific gene (e.g., "What happens to cilia when KIF3A is knocked down?") or a specific phenotype (e.g., "Find genes causing short cilia").</p>`;
    }

    // --- Default fallback ---
    return null;
}


// ============================================================================
// 5. 💬 CiliAI "CONSUMER" HANDLER FUNCTIONS (FINAL)
// ============================================================================
// These functions are called by ciliAI_resolveIntent (Stage 2).
// They all use the SAME `ciliAI_getGeneData` function.

/* -------------------------------------------------------------------------- */
/* HELPER FUNCTION: SHORT CILIA GENES HIGH IN LUNG + COMPLEXES               */
/* -------------------------------------------------------------------------- */
async function getShortCiliaGenesHighLung(threshold = 10) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/ciliahub_data.json';
    
    try {
        const allGenes = await fetch(url).then(r => r.json());
        const result = [];

        for (const geneEntry of allGenes) {
            const geneName = geneEntry.gene.toUpperCase();
            const geneData = await ciliAI_getGeneData(geneName);

            if (!geneData || geneData.notFound) continue;

            // 1. Check screens for "short cilia" effect
            const screens = geneData.screens || [];
            const hasShortCilia = screens.some(s =>
                s.result?.toLowerCase().includes('short') ||
                s.classification?.toLowerCase().includes('short') ||
                s.mean_percent_ciliated < 0 // optional: negative values indicate reduced cilia
            );
            if (!hasShortCilia) continue;

            // 2. Check tissue expression for Lung
            const lungExpr = geneData.tissue?.lung || 0;
            if (lungExpr < threshold) continue;

            // 3. Collect complexes
            const complexes = geneData.complex || [];

            // 4. Combine info
            result.push({
                gene: geneName,
                description: geneData.geneInfo.description || '',
                lungExpression: lungExpr,
                screens: screens,
                complexes: complexes
            });
        }

        return result;
    } catch (e) {
        console.error('[CiliAI Helper] Error fetching short cilia genes:', e);
        return [];
    }
}


/**
 * Handles the "getSummary" intent. Provides a full overview.
 * @param {string} geneName 
 */
async function ciliAI_handleGeneSummary(geneName) {
    const geneData = await ciliAI_getGeneData(geneName);
    if (geneData.notFound) {
        ciliAI_updateChatWindow(`Sorry, I could not find any data for the gene "${geneName}".`, "error");
        return;
    }

    const geneSymbol = geneData.geneInfo?.gene || geneName.toUpperCase();
    let responses = [];
    responses.push(`Here's a summary for **${geneSymbol}**:`);

    if (geneData.geneInfo?.functional_summary) {
        responses.push(`**Summary:** ${geneData.geneInfo.functional_summary}`);
    } else {
        responses.push(`**Summary:** No summary is available for this gene.`);
    }

    let details = [];
    if (geneData.geneInfo?.lof_effects && geneData.geneInfo.lof_effects !== "Not Reported") {
        details.push(`**Cilia Effect (Loss-of-function):** ${geneData.geneInfo.lof_effects}.`);
    }
    if (geneData.geneInfo?.overexpression_effects && geneData.geneInfo.overexpression_effects !== "Not Reported") {
        details.push(`**Cilia Effect (Overexpression):** ${geneData.geneInfo.overexpression_effects}.`);
    }
    if (geneData.complex) details.push(`It is part of the **${geneData.complex.name}** protein complex.`);
    if (geneData.domains) details.push(`It has known protein domains.`);
    if (geneData.phylogeny) details.push(`Phylogenetic data is available.`);
    if (geneData.tissue) details.push(`Tissue expression data is available.`);
    if (geneData.scRNA) details.push(`Single-cell expression data is available.`);
    
    if (details.length > 0) {
        responses.push("\n**Key Details:**\n* " + details.join('\n* '));
    }

    ciliAI_updateChatWindow(responses.join('\n\n'), "ciliai");
}

/**
 * Handles the "getPhylogeny" intent.
 * @param {string} geneName 
 */
async function ciliAI_handlePhylogeny(geneName) {
    const geneData = await ciliAI_getGeneData(geneName);
    if (geneData.notFound) {
        ciliAI_updateChatWindow(`Sorry, I could not find data for "${geneName}".`, "error");
        return;
    }

    if (!geneData.phylogeny) {
        ciliAI_updateChatWindow(`No phylogeny data was found for **${geneName}**.`, "ciliai");
        return;
    }

    let responses = [];
    if (geneData.phylogeny.nevers) {
        responses.push(`**Nevers et al. (2017) data found.**`);
        // if (window.plotNeversPhylogeny) window.plotNeversPhylogeny(geneData.phylogeny.nevers);
        console.log("[CiliAI PLOTTER] Plotting Nevers data for", geneName);
    }
    if (geneData.phylogeny.li) {
        responses.push(`**Li et al. (2016) data found.**`);
        // if (window.plotLiPhylogeny) window.plotLiPhylogeny(geneData.phylogeny.li);
        console.log("[CiliAI PLOTTER] Plotting Li data for", geneName);
    }

    ciliAI_updateChatWindow(responses.join('\n'), "ciliai");
}

/**
 * Handles the "getDomains" intent.
 * @param {string} geneName 
 */
async function ciliAI_handleDomains(geneName) {
    const geneData = await ciliAI_getGeneData(geneName);
    if (geneData.notFound) {
        ciliAI_updateChatWindow(`Sorry, I could not find data for "${geneName}".`, "error");
        return;
    }

    // Assumes geneData.domains is an array of objects: [{name: "PF0001", ...}, ...]
    if (!geneData.domains || geneData.domains.length === 0) {
        ciliAI_updateChatWindow(`No protein domain information was found for **${geneName}**.`, "ciliai");
        return;
    }

    const domainNames = geneData.domains.map(d => d.name).join(', ');
    ciliAI_updateChatWindow(`**${geneName}** contains the following domains: **${domainNames}**.`, "ciliai");
    
    // Example: Trigger a domain plotting function
    // if (window.plotDomains) window.plotDomains(geneData.domains);
}

/**
 * Handles the "getCiliaLength" intent.
 * @param {string} geneName 
 */
async function ciliAI_handleCiliaLength(geneName) {
    const geneData = await ciliAI_getGeneData(geneName);
    if (geneData.notFound) {
        ciliAI_updateChatWindow(`Sorry, I could not find data for "${geneName}".`, "error");
        return;
    }

    // *** CORRECTION ***
    // This data now lives inside the geneInfo object, fetched from ciliahub_data.json
    if (!geneData.geneInfo) {
        ciliAI_updateChatWindow(`No cilia length data was found for **${geneName}**.`, "ciliai");
        return;
    }
    
    const lof = geneData.geneInfo.lof_effects || "Not Reported";
    const oe = geneData.geneInfo.overexpression_effects || "Not Reported";
    const perc = geneData.geneInfo.percent_ciliated_cells_effects || "Not Reported";

    let responses = [];
    responses.push(`Cilia phenotype effects for **${geneName}**:`);
    responses.push(`* **Loss-of-function:** ${lof}`);
    responses.push(`* **Overexpression:** ${oe}`);
    responses.push(`* **% Ciliated Cells:** ${perc}`);

    ciliAI_updateChatWindow(responses.join('\n'), "ciliai");
}

/**
 * Handles the "getComplex" intent.
 * @param {string} geneName 
 */
async function ciliAI_handleComplex(geneName) {
    const geneData = await ciliAI_getGeneData(geneName);
    if (geneData.notFound) {
        ciliAI_updateChatWindow(`Sorry, I could not find data for "${geneName}".`, "error");
        return;
    }

    if (!geneData.complex) {
        ciliAI_updateChatWindow(`**${geneName}** is not listed as part of a known CORUM complex in our data.`, "ciliai");
        return;
    }

    const complexName = geneData.complex.name;
    const memberCount = geneData.complex.members.length;
    ciliAI_updateChatWindow(`**${geneName}** is a member of the **${complexName}** complex, which has ${memberCount} members.`, "ciliai");
}

/**
 * *** NEWLY ADDED ***
 * Handles the "getExpression" intent (for tissue and scRNA).
 * @param {string} geneName 
 */
async function ciliAI_handleExpression(geneName) {
    const geneData = await ciliAI_getGeneData(geneName);
    if (geneData.notFound) {
        ciliAI_updateChatWindow(`Sorry, I could not find data for "${geneName}".`, "error");
        return;
    }

    let responses = [];
    responses.push(`Expression data for **${geneName}**:`);
    
    // 1. Check for Tissue Data
    if (geneData.tissue) {
        responses.push(`\n**Tissue Consensus Data:**`);
        // Find top 3 tissues
        const tissues = Object.entries(geneData.tissue)
            .map(([tissue, nTPM]) => ({ tissue, nTPM: parseFloat(nTPM) }))
            .filter(t => !isNaN(t.nTPM))
            .sort((a, b) => b.nTPM - a.nTPM);
            
        if (tissues.length > 0) {
            responses.push(`* Highest expression in: **${tissues[0].tissue}** (${tissues[0].nTPM} nTPM)`);
            if (tissues.length > 1) responses.push(`* Second highest: **${tissues[1].tissue}** (${tissues[1].nTPM} nTPM)`);
            if (tissues.length > 2) responses.push(`* Third highest: **${tissues[2].tissue}** (${tissues[2].nTPM} nTPM)`);
        } else {
            responses.push(`* No tissue consensus data found.`);
        }
    } else {
        responses.push(`\n* No tissue consensus data found.`);
    }
    
    // 2. Check for scRNA-seq Data
    if (geneData.scRNA) {
        responses.push(`\n**Single-Cell (scRNA-seq) Data:**`);
        // Find top 3 cell types
         const cells = Object.entries(geneData.scRNA)
            .map(([cell, pct]) => ({ cell, pct: parseFloat(pct) }))
            .filter(c => !isNaN(c.pct))
            .sort((a, b) => b.pct - a.pct);
            
        if (cells.length > 0) {
            responses.push(`* Highest expression in: **${cells[0].cell}** (${cells[0].pct.toFixed(2)}% of cells)`);
            if (cells.length > 1) responses.push(`* Second highest: **${cells[1].cell}** (${cells[1].pct.toFixed(2)}% of cells)`);
            if (cells.length > 2) responses.push(`* Third highest: **${cells[2].cell}** (${cells[2].pct.toFixed(2)}% of cells)`);
        } else {
            responses.push(`* No scRNA-seq data found.`);
        }
    } else {
        responses.push(`\n* No scRNA-seq data found.`);
    }

    ciliAI_updateChatWindow(responses.join('\n'), "ciliai");
}


/* -------------------------------------------------------------------------- */
/* 6. UI / EVENT BINDING                                                    */
/* -------------------------------------------------------------------------- */
async function ciliAI_handleQuery() {
    const input = document.getElementById('aiQueryInput');
    if (!input) return;
    const q = input.value.trim();
    if (!q) return;
    ciliAI_updateChatWindow(q, 'user');
    input.value = '';
    await ciliAI_resolveIntent(q);
}

function ciliAI_updateChatWindow(msg, sender) {
    const box = document.getElementById('ai-result-area');
    if (msg === "Thinking...") {
        if (box) { box.style.display = 'block'; box.innerHTML = `<p class="status-searching">CiliAI is thinking...</p>`; }
        return;
    }
    if (!box) { console.log(`[CiliAI ${sender}] ${msg.replace(/<[^>]*>/g,'')}`); return; }
    box.style.display = 'block';
    const div = document.createElement('div');
    div.className = `ciliai-message ${sender}`;
    div.innerHTML = msg.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    if (sender === 'user') { box.innerHTML = ''; box.appendChild(div); }
    else { box.innerHTML = div.innerHTML; }
    box.scrollTop = box.scrollHeight;
}

/* -------------------------------------------------------------------------- */
/* 7. ROBUST LISTENER INITIALISER (EXPORTED)                                */
/* -------------------------------------------------------------------------- */
function ciliAI_init_listeners() {
    const btn   = document.getElementById('aiQueryBtn');
    const inp   = document.getElementById('aiQueryInput');
    const ex    = document.querySelector('.example-queries');
    let ok = true;

    if (btn) btn.addEventListener('click', ciliAI_handleQuery);
    else { console.warn("[CiliAI] Send button #aiQueryBtn missing"); ok = false; }

    if (inp) {
        inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ciliAI_handleQuery(); }});
    } else { console.warn("[CiliAI] Input #aiQueryInput missing"); ok = false; }

    if (ex) {
        ex.addEventListener('click', ev => {
            const span = ev.target.closest('span');
            if (span) {
                const q = span.dataset.question || span.textContent;
                if (inp) { inp.value = q; ciliAI_handleQuery(); }
            }
        });
    } else { console.warn("[CiliAI] .example-queries missing"); }

    if (ok) console.log("Event listeners attached");
    return ok;
}

/* -------------------------------------------------------------------------- */
/* 8. WAIT FOR ELEMENTS – CALL THIS *AFTER* HTML INJECTION                  */
/* -------------------------------------------------------------------------- */
function ciliAI_waitForElements() {
    console.log("[CiliAI] Waiting for #aiQueryBtn / #aiQueryInput …");

    const ready = () => document.getElementById('aiQueryBtn') && document.getElementById('aiQueryInput');

    if (ready()) { ciliAI_init_listeners(); return; }

    const observer = new MutationObserver(() => { if (ready()) { ciliAI_init_listeners(); observer.disconnect(); }});
    observer.observe(document.body, { childList: true, subtree: true });

    const giveUp = setTimeout(() => {
        if (!ready()) { console.error("[CiliAI] Elements never appeared (5 s timeout)"); observer.disconnect(); }
    }, 5000);
}


/* -------------------------------------------------------------------------- */
/* CiliaAI QUESTIONS                                                */
/* -------------------------------------------------------------------------- */
// ============================================================================

// ===================== CiliAI Universal Question Handler =====================
// Attach this function near your main handleAIQuery() or intent parser logic

async function handleCiliAIQuestion(userQuery) {
    const q = userQuery.trim().toLowerCase();
    const resultArea = document.getElementById("ai-result-area");
    if (!resultArea) return;

    resultArea.style.display = "block";
    resultArea.innerHTML = "<p>🧠 Thinking...</p>";

    try {
        // --- 1. ABOUT / HELP ---
        if (q.includes("what can you do") || q.includes("about ciliai")) {
            resultArea.innerHTML = `
                <div class="result-card">
                    <h3>🤖 What can CiliAI do?</h3>
                    <ul>
                        <li>List and analyze human ciliary genes and their orthologs.</li>
                        <li>Display domain architectures and Pfam/InterPro features.</li>
                        <li>Compare evolutionary conservation using phylogeny heatmaps.</li>
                        <li>Identify genes by function or phenotype (e.g., short cilia).</li>
                        <li>Analyze tissue, single-cell, and disease-specific expression.</li>
                        <li>Integrate multi-omics and complex (CORUM) data.</li>
                    </ul>
                </div>`;
            return;
        }

        // --- 2. DOMAIN QUERIES ---
        if (q.includes("domain")) {
            const genes = extractGenesFromText(q);
            if (genes.length === 0 && q.includes("wd40")) {
                const wd40Genes = await getGenesByDomain("WD40");
                renderDomainGeneList(resultArea, wd40Genes, "WD40 domain");
                return;
            }

            if (genes.length > 1 && q.includes("compare")) {
                const domainData = await Promise.all(genes.map(g => getDomainArchitecture(g)));
                renderDomainComparison(resultArea, genes, domainData);
                return;
            }

            if (genes.length > 1) {
                const domains = await Promise.all(genes.map(g => getDomainArchitecture(g)));
                renderDomainGeneList(resultArea, domains.flat(), `Domains of ${genes.join(", ")}`);
                return;
            }

            if (genes.length === 1) {
                const gene = genes[0];
                const domains = await getDomainArchitecture(gene);
                renderDomainGeneList(resultArea, domains, `Domains of ${gene}`);
                return;
            }
        }

        // --- 3. PHYLOGENY / EVOLUTIONARY QUERIES ---
        if (q.includes("phylogeny") || q.includes("evolution") || q.includes("conservation") || q.includes("heatmap")) {
            const genes = extractGenesFromText(q);
            if (genes.length === 0) {
                resultArea.innerHTML = `<p>No genes detected for phylogeny analysis.</p>`;
                return;
            }

            await getPhylogenyAnalysis(genes);
            return;
        }

        // --- 4. FUNCTIONAL MODULE QUERIES ---
        if (q.includes("vertebrate specific")) {
            const vertebrateGenes = getVertebrateSpecificGenes();
            renderSimpleGeneList(resultArea, vertebrateGenes, "Vertebrate-Specific Ciliary Genes");
            return;
        }

        if (q.includes("short cilia") && !q.includes("mitochondria")) {
            const shortCiliaGenes = getShortCiliaGenes();
            renderSimpleGeneList(resultArea, shortCiliaGenes, "Genes causing short cilia");
            return;
        }

        if (q.includes("mitochondrial") && q.includes("short cilia")) {
            const mitoShort = getMitochondrialShortCiliaGenes();
            renderSimpleGeneList(resultArea, mitoShort, "Mitochondrial genes linked to short cilia");
            return;
        }

        // --- Default fallback ---
        resultArea.innerHTML = `<p>❓ Sorry, I’m not sure how to answer that yet.</p>`;

    } catch (err) {
        console.error("CiliAI query error:", err);
        resultArea.innerHTML = `<p>⚠️ Error processing question.</p>`;
    }
}


// ===================== Helper Functions =====================

// Extract gene names (very simple text-based matcher)
function extractGenesFromText(text) {
    const geneRegex = /\b([A-Z0-9]{2,6})\b/g;
    const genes = [];
    let match;
    while ((match = geneRegex.exec(text)) !== null) {
        const g = match[1].toUpperCase();
        if (CILI_AI_DOMAIN_DB[g] || ciliaHubDataCache?.has(g)) genes.push(g);
    }
    return [...new Set(genes)];
}

// Domain architecture fetcher (assumes domainDataCache loaded)
async function getDomainArchitecture(gene) {
    if (!domainDataCache || !Object.keys(domainDataCache).length)
        throw new Error("Domain data not loaded.");
    return domainDataCache[gene] || [];
}

// Example query for genes having specific domain (e.g. WD40)
async function getGenesByDomain(domainName) {
    const result = [];
    for (const [gene, domains] of Object.entries(domainDataCache)) {
        if (domains.some(d => d.name?.toLowerCase().includes(domainName.toLowerCase()))) {
            result.push(gene);
        }
    }
    return result;
}




// ===================== Rendering Helpers =====================

function renderDomainGeneList(container, domainData, title) {
    if (!domainData || domainData.length === 0) {
        container.innerHTML = `<p>No domain data found.</p>`;
        return;
    }

    if (Array.isArray(domainData[0])) domainData = domainData.flat();

    container.innerHTML = `
        <div class="result-card">
            <h3>${title}</h3>
            <table class="expression-table">
                <thead><tr><th>Gene</th><th>Domain</th><th>Start</th><th>End</th></tr></thead>
                <tbody>
                    ${domainData.map(d => `
                        <tr><td>${d.gene || ""}</td><td>${d.name}</td><td>${d.start}</td><td>${d.end}</td></tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function renderDomainComparison(container, genes, domainData) {
    container.innerHTML = `
        <div class="result-card">
            <h3>Domain Architecture Comparison</h3>
            ${genes.map((g, i) => `
                <h4>${g}</h4>
                <ul>${domainData[i].map(d => `<li>${d.name} (${d.start}-${d.end})</li>`).join("")}</ul>
            `).join("")}
        </div>
    `;
}

function renderSimpleGeneList(container, genes, title) {
    container.innerHTML = `
        <div class="result-card">
            <h3>${title}</h3>
            <ul>${genes.map(g => `<li>${g}</li>`).join("")}</ul>
        </div>
    `;
}


// --- #########################################################Questions################################################

const query1 = {
    complex: ["IFT-B COMPLEX"],
    disease_class: ["Primary Ciliopathies"],
    organism: ["mouse", "zebrafish"]
};

ciliAI_queryGenes(query1).then(results => {
    console.log("IFT-B + Primary Ciliopathy + Mouse/Zebrafish orthologs:", results);
});

const query2 = {
    lof_effects: ["Reduced cilia numbers"],
    complex: ["TRANSITION FIBER"]
};

ciliAI_queryGenes(query2).then(results => {
    console.log("LOF reduces cilia + Transition Fiber Complex:", results);
});

const query3 = {
    complex: ["SHH SIGNALING"],
    disease_class: ["Secondary Diseases"]
};

ciliAI_queryGenes(query3).then(results => {
    console.log("SHH signaling + Secondary retinal diseases:", results);
});

const query4 = {
    complex: ["BBSOME"],
    organism: ["human", "mouse", "fly"]
};

ciliAI_queryGenes(query4).then(results => {
    console.log("BBSome genes with orthologs in human, mouse, fly:", results);
});

const query5 = {
    complex: ["GPCR COMPLEX"],
    overexpression_effects: ["Reduced cilia numbers"],
    disease_class: ["Motile Ciliopathies"]
};

ciliAI_queryGenes(query5).then(results => {
    console.log("GPCR + Reduced cilia overexpression + Motile ciliopathies:", results);
});


// --- Main Page Display Function (REPLACEMENT) ---
// This function should be in your main script.js or globals.js
window.displayCiliAIPage = async function displayCiliAIPage() {
    const contentArea = document.querySelector('.content-area');
    if (!contentArea) {
        console.error('[CiliAI] Error: .content-area not found.');
        return;
    }

    contentArea.className = 'content-area content-area-full';
    const ciliaPanel = document.querySelector('.cilia-panel');
    if (ciliaPanel) ciliaPanel.style.display = 'none';

    try {
        // --- Inject full CiliAI HTML + CSS ---
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
                                <span data-question="Show genes for Joubert syndrome">List genes for Joubert syndrome</span>, 
                                <span data-question="List ciliary genes in C. elegans">List potential ciliary genes in C. elegans (Phylogenetic)</span>, 
                                <span data-question="Plot UMAP expression for FOXJ1">Display expression for FOXJ1 in Lung</span>,
                                <span data-question="Compare ARL13B and FOXJ1 expression in lung scRNA-seq">Compare ARL13B and FOXJ1 expression in lung scRNA-seq</span>,
                                <span data-question="Compare phylogeny of BBS1 and CEP290.">Compare phylogeny of BBS1 and CEP290</span>,
                                <span data-question="What proteins are enriched at the ciliary tip?">What proteins are enriched at the ciliary tip?</span>,
                                <span data-question="Which Joubert Syndrome genes are expressed in ciliated cells?">Joubert genes in ciliated cells</span>
                            </p>
                        </div>
                        <div id="ai-result-area" class="results-section" style="display: none; margin-top: 1.5rem; padding: 1rem;"></div>
                    </div>
                    
                    <div class="input-section" style="display:none;"> 
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
                            <div class="mode-selector"></div>
                        </div>
                        <button class="analyze-btn" id="analyzeBtn">🔍 Analyze Genes</button>
                    </div>
                    <div id="resultsSection" class="results-section" style="display: none;"></div>
                </div>
            </div>
            <style>
                /* Keep all existing CSS exactly as before */
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
                .download-button { background-color: #28a745; color: white; padding: 8px 14px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em; font-weight: bold; margin-top: 15px; transition: background-color 0.3s ease; }
                .download-button:hover { background-color: #218838; }
            </style>
        `;

        console.log('✅ CiliAI: Page HTML injected successfully.');

        const analyzeSection = contentArea.querySelector('.input-section');
        if (analyzeSection) {
            analyzeSection.style.display = 'none';
            console.log('[CiliAI] Analyze section hidden.');
        }

        // Wait for all elements before proceeding
        if (typeof ciliAI_waitForElements === 'function') {
            ciliAI_waitForElements();
        } else {
            console.warn('[CiliAI] Warning: ciliAI_waitForElements() not found.');
        }

    } catch (err) {
        console.error('❌ CiliAI HTML injection failed:', err);
        contentArea.innerHTML = '<p>Error: Failed to load CiliAI interface.</p>';
    }
};


// inside displayCiliAIPage(), right after the innerHTML assignment:
ciliAI_waitForElements(); 

/* ============================================================================
 *  ✅ CLEAN GLOBAL EXPOSURE BLOCK
 *  (Safe, minimal, and avoids duplication)
 * ============================================================================
 */

function exposeCiliAIGlobals() {
    // Prevent redefining if already initialized
    if (window.CiliAI && window.CiliAI.initialized) return;

    // Define the global interface
    window.CiliAI = {
        // --- Core data access ---
        getGeneData: ciliAI_getGeneData,
        geneCache: ciliAI_geneCache,

        // --- Core AI handlers ---
        resolveIntent: ciliAI_resolveIntent,
        resolveComplexIntent: ciliAI_resolveComplexIntent,

        // --- Optional handlers (used by other modules) ---
        handleGeneSummary: ciliAI_handleGeneSummary,

        // --- Metadata ---
        version: "6.1",
        initialized: true
    };

    console.log("%c✅ CiliAI global interface initialized", "color: #3fb950");
}

// ✅ Call it once to expose the globals
exposeCiliAIGlobals();


