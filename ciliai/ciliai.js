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
window.ciliAI_MasterDatabase = [];
/* -------------------------------------------------------------------------- */
/* 2. GATEKEEPER FUNCTION: GET ALL DATA FOR A GENE                             */
/* -------------------------------------------------------------------------- */
async function ciliAI_getGeneData(geneName) {
    const upperGeneName = geneName.toUpperCase();

    // Check cache first (this cache is for *single-gene lookups*)
    if (ciliAI_geneCache.has(upperGeneName)) {
        return ciliAI_geneCache.get(upperGeneName);
    }

    console.log(`[CiliAI Cache MISS] Finding ${upperGeneName} in Master Database...`);

    // Find the gene in the master database
    if (!window.ciliAI_MasterDatabase || window.ciliAI_MasterDatabase.length === 0) {
        console.error("[CiliAI] Master Database is not built! Cannot get gene data.");
        return { notFound: true, error: "Master Database not loaded." };
    }

    const geneData = window.ciliAI_MasterDatabase.find(g => g.gene.toUpperCase() === upperGeneName);

    if (geneData) {
        // We found it. Store it in the single-gene cache for next time.
        // We create a "Promise.resolve" to mimic the old async behavior.
        const combinedData = {
            geneInfo: geneData, // The 'geneInfo' is the root of the master entry
            phylogeny: geneData.phylogeny,
            domains: geneData.domains,
            complex: geneData.complexes, // Note: 'complexes' (plural) from master
            tissue: geneData.tissue,
            scRNA: geneData.scRNA,
            screens: geneData.screens,
            umap: geneData.umap,
            lastFetched: new Date().toISOString()
        };
        
        ciliAI_geneCache.set(upperGeneName, Promise.resolve(combinedData));
        return combinedData;
    } else {
        // Gene not found in the master database
        console.warn(`[CiliAI] Gene ${upperGeneName} not found in Master Database.`);
        const notFound = { notFound: true };
        ciliAI_geneCache.set(upperGeneName, Promise.resolve(notFound)); // Cache the "not found" result
        return notFound;
    }
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

/**
 * Fetches and parses the entire tissue consensus TSV file.
 * Returns an object keyed by gene: { "TSPAN6": { "adipose tissue": 28.6, ... }, "TNPO1": ... }
 */
async function ciliAI_fetchAllTissueData_internal() {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/rna_tissue_consensus.tsv';
    
    try {
        const txt = await fetch(url).then(r => r.text());
        const lines = txt.split('\n');
        if (lines.length < 2) return null;
        
        const headers = lines[0].split('\t');
        
        // --- CORRECTED COLUMN FINDERS ---
        // Find columns by their exact, case-insensitive names
        const gIdx = headers.findIndex(h => h.toLowerCase() === "gene name"); 
        const tIdx = headers.findIndex(h => h.toLowerCase() === "tissue");
        const vIdx = headers.findIndex(h => h.toLowerCase() === "ntpm");
        // --- END CORRECTION ---

        if (gIdx === -1 || tIdx === -1 || vIdx === -1) {
            console.error(`[CiliAI] Could not parse tissue headers. Required: "Gene name", "Tissue", "nTPM".`);
            return null;
        }

        const masterTissueObj = {}; 

        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split('\t');
            
            // Get data from the correct columns
            const geneName = cols[gIdx]?.toUpperCase(); // This will be "TSPAN6"
            const tissueName = cols[tIdx]?.toLowerCase(); // This will be "adipose tissue"
            const nTPM = parseFloat(cols[vIdx]); // This will be 28.6

            if (geneName && tissueName && !isNaN(nTPM)) {
                if (!masterTissueObj[geneName]) {
                    masterTissueObj[geneName] = {};
                }
                // Assign the nTPM value
                masterTissueObj[geneName][tissueName] = nTPM;
            }
        }
        
        console.log(`[CiliAI] Master Tissue data parsed for ${Object.keys(masterTissueObj).length} genes.`);
        return masterTissueObj;
        
    } catch (e) {
        console.error(`[CiliAI] Master Tissue fetch error:`, e); 
        return null; 
    }
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

// --- Add this to your main script (e.g., script.js or globals.js) ---

/**
 * Fetches and parses the entire tissue consensus TSV file.
 * Returns an object keyed by gene: { "GENE1": { "lung": 10.5, ... }, "GENE2": ... }
 */
async function ciliAI_fetchAllTissueData_internal() {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/rna_tissue_consensus.tsv';
    try {
        const txt = await fetch(url).then(r => r.text());
        const lines = txt.split('\n');
        if (lines.length < 2) return null;
        
        const headers = lines[0].split('\t');
        // Find column indices
        const gIdx = headers.findIndex(h => /gene/i.test(h));
        const tIdx = headers.findIndex(h => /tissue/i.test(h));
        const vIdx = headers.findIndex(h => /nTPM/i.test(h));
        if (gIdx === -1 || tIdx === -1 || vIdx === -1) {
            console.error("[CiliAI] Could not parse tissue headers.");
            return null;
        }

        const masterTissueObj = {}; // This will be { "GENE1": { "tissue1": 1.0, ... }, "GENE2": ... }

        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split('\t');
            const geneName = cols[gIdx]?.toUpperCase();
            const tissueName = cols[tIdx];
            const nTPM = parseFloat(cols[vIdx]);

            if (geneName && tissueName && !isNaN(nTPM)) {
                if (!masterTissueObj[geneName]) {
                    masterTissueObj[geneName] = {};
                }
                masterTissueObj[geneName][tissueName] = nTPM;
            }
        }
        console.log(`[CiliAI] Master Tissue data parsed for ${Object.keys(masterTissueObj).length} genes.`);
        return masterTissueObj;
    } catch (e) {
        console.error(`[CiliAI] Master Tissue fetch error:`, e); 
        return null; 
    }
}


/**
 * ============================================================================
 * [CiliAI] MASTER DATABASE BUILDER (v11 - Domain Key Fix)
 *
 * WHAT IS FIXED:
 * 1. (CRITICAL) "IFT88 Domain Check: ❌ FAILED TO LINK"
 * - This bug implies the keys in `domains_raw` do not match the
 * `geneEntry.gene` key (e.g., "IFT88").
 * - This version adds a new "pre-processing" step that creates a
 * `domains_by_gene` object, forcing ALL keys from the raw domain
 * file to be uppercase, just like our main gene key.
 * - This ensures that `domains_by_gene["IFT88"]` will always
 * match, regardless of the original file's casing.
 * ============================================================================
 */
async function buildMasterDatabase() {
    console.log("[CiliAI] Building Master Database...");

    try {
        // 1. Define all data source URLs
        const urls = {
            mainGeneList: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/ciliahub_data.json',
            domains: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cili_ai_domain_database.json',
            complexes: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/corum_humanComplexes.json',
            scRNA: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cellxgene_data.json',
            screens_extra: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cilia_screens_data.json',
            nevers: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/nevers_et_al_2017_matrix_optimized.json',
            li: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/li_et_al_2014_matrix_optimized.json'
        };

        // 2. Fetch all data sources in parallel
        const [
            mainGeneList,
            domains_raw, // This is {"IFT88": [...], "ift57": [...], etc}
            complexes,
            scRNA,
            screens_extra,
            nevers_raw,
            li_raw,
            tissue
        ] = await Promise.all([
            fetch(urls.mainGeneList).then(r => r.json()),
            fetch(urls.domains).then(r => r.json()),
            fetch(urls.complexes).then(r => r.json()),
            fetch(urls.scRNA).then(r => r.json()),
            fetch(urls.screens_extra).then(r => r.json()),
            fetch(urls.nevers).then(r => r.json()),
            fetch(urls.li).then(r => r.json()),
            ciliAI_fetchAllTissueData_internal()
        ]);

        // 3. --- PRE-PROCESSING (THE CRITICAL FIXES) ---

        // Fix 1: Standardize Domain Keys (NEW!)
        // Create a new object where all keys are guaranteed uppercase.
        const domains_by_gene = {};
        for (const key in domains_raw) {
            const upperKey = key.toUpperCase();
            domains_by_gene[upperKey] = domains_raw[key];
        }
        console.log(`[CiliAI] Processed Domain data. ${Object.keys(domains_by_gene).length} genes standardized.`);


        // Fix 2: Pre-process Li et al. data (keyed by Entrez ID)
        const li_by_gene = {};
        for (const entrez_id in li_raw.genes) {
            const geneData = li_raw.genes[entrez_id];
            if (geneData && geneData.g) {
                const geneSymbol = geneData.g.toUpperCase();
                li_by_gene[geneSymbol] = geneData;
            }
        }
        console.log(`[CiliAI] Processed Li et al. (Entrez ID) data for ${Object.keys(li_by_gene).length} genes.`);

        // Fix 3: Get the correct sub-object from Nevers
        const nevers_by_gene = nevers_raw.genes;
        
        // Fix 4: Helper to find a gene's complex(es) from the CORUM array
        const getComplexes = (geneSymbol) => {
            return complexes.filter(comp => 
                comp.subunits?.some(s => s.gene_name?.toUpperCase() === geneSymbol)
            );
        };
        
        // 4. --- COMBINE THE DATABASE ---
        window.ciliAI_MasterDatabase = mainGeneList.map(geneEntry => {
            
            // This is our clean, standard key
            const gene = geneEntry.gene.toUpperCase().trim(); 
            
            // --- Screen data fix (from v10) ---
            const screens_from_main = Array.isArray(geneEntry.screens) ? geneEntry.screens : [];
            const screens_from_extra = screens_extra[gene] || [];
            const combined_screens = [...screens_from_main, ...screens_from_extra];

            // --- !! THIS IS THE FIX !! ---
            // Use the new standardized `domains_by_gene` object
            const domain_data = domains_by_gene[gene] || null;
            // --- END OF FIX ---

            const phylogeny = {
                nevers: nevers_by_gene[gene] || null,
                li: li_by_gene[gene] || null
            };

            return {
                ...geneEntry, 
                gene: gene, 
                domains: domain_data, // Now correctly linked
                complexes: getComplexes(gene),
                tissue: tissue[gene] || null,
                scRNA: scRNA[gene] || null,
                screens: combined_screens,
                phylogeny: (phylogeny.nevers || phylogeny.li) ? phylogeny : null
            };
        });
    
        console.log(`✅ [CiliAI] Master Database built. ${window.ciliAI_MasterDatabase.length} genes integrated.`);
        
        // --- Post-build sanity check ---
        const ift88_check = window.ciliAI_MasterDatabase.find(g => g.gene === "IFT88");
        if (ift88_check) {
            console.log("[CiliAI] IFT88 Domain Check:", ift88_check.domains ? "✅ Data Linked" : "❌ FAILED TO LINK");
            console.log("[CiliAI] IFT88 Phylogeny Check:", ift88_check.phylogeny ? "✅ Data Linked" : "❌ FAILED TO LINK");
            console.log("[CiliAI] IFT88 Screens Check:", ift88_check.screens.length > 0 ? "✅ Data Linked" : "❌ FAILED TO LINK");
            console.log("[CiliAI] IFT88 Complex Check:", ift88_check.complexes.length > 0 ? "✅ Data Linked" : "❌ FAILED TO LINK");
        } else {
            console.error("[CiliAI] FATAL: IFT88 not found in main gene list.");
        }

    } catch (e) {
        console.error("❌ [CiliAI] FATAL ERROR building Master Database:", e);
    }
}

// --- IMPORTANT: Call the function to build the database ---
// --- Place this in your main script's initialization logic ---
buildMasterDatabase();


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

// --- Place in CiliAI.js ---

/**
 * Queries the pre-built master database.
 * @param {object} filters - An object of filters, e.g.,
 * { localization: "lysosome", phenotype: "short cilia", tissue: "lung", cell_type: "ciliated" }
 */
function ciliAI_masterQuery(filters) {
    
    if (!window.ciliAI_MasterDatabase || window.ciliAI_MasterDatabase.length === 0) {
        console.error("[CiliAI] Master Database is not built or is empty!");
        return [];
    }
    
    return window.ciliAI_MasterDatabase.filter(gene => {
        
        // 1. Localization Filter
        if (filters.localization) {
            // Assuming localization is in 'gene.localization' or 'gene.functional_summary'
            const loc = (gene.localization || "").toLowerCase();
            const summary = (gene.functional_summary || "").toLowerCase();
            if (!loc.includes(filters.localization) && !summary.includes(filters.localization)) {
                 return false;
            }
        }
        
        // 2. Phenotype Filter (from lof_effects and screens)
        if (filters.phenotype) {
            const lof = (gene.lof_effects || "").toLowerCase();
            const oe = (gene.overexpression_effects || "").toLowerCase();
            
            // Check main file
            let hasPhenotype = lof.includes(filters.phenotype) || oe.includes(filters.phenotype);
            
            // Check detailed screens file if not found
            if (!hasPhenotype && gene.screens) {
                hasPhenotype = gene.screens.some(s => 
                    s.result?.toLowerCase().includes(filters.phenotype) ||
                    s.classification?.toLowerCase().includes(filters.phenotype)
                );
            }
            if (!hasPhenotype) return false;
        }
        
        // 3. Tissue Expression Filter (Threshold > 1 nTPM)
        if (filters.tissue) {
            if (!gene.tissue || !gene.tissue[filters.tissue] || gene.tissue[filters.tissue] < 1.0) {
                 return false;
            }
        }
        
        // 4. scRNA Cell Type Filter (Threshold > 5% of cells)
        if (filters.cell_type) {
            // Find the cell type key (case-insensitive)
            const cellTypeKey = Object.keys(gene.scRNA || {}).find(k => k.toLowerCase().includes(filters.cell_type));
            
            if (!cellTypeKey || !gene.scRNA[cellTypeKey] || gene.scRNA[cellTypeKey] < 0.05) {
                 return false;
            }
        }
        
        // 5. Disease Filter
        if (filters.disease) {
             const diseases = (gene.associated_diseases || []).map(d => d.toLowerCase());
             if (!diseases.some(d => d.includes(filters.disease))) {
                 return false;
             }
        }

        // If it passed all filters, keep it!
        return true;
    });
}


/**
 * --------------------------------------------------------------------------
 * 2. (FIXED) CILI-AI DUAL-STAGE INTENT RESOLVER
 *
 * This function now has a "pre-check" for greetings and a smarter
 * gene-parsing regex in Stage 2.
 * --------------------------------------------------------------------------
 */
async function ciliAI_resolveIntent(query) {
    console.log("[CiliAI LOG] 4. ciliAI_resolveIntent started.");
    const qLower = query.toLowerCase().trim();
    
    ciliAI_updateChatWindow("Thinking...", "system");

    try {
        // --- PRE-CHECK: Check for simple greetings or "about" ---
        if (qLower.includes("hello") || qLower.includes("hi") || qLower.includes("what can you do") || qLower.includes("about ciliai")) {
             console.log("[CiliAI LOG] 4a. Greeting/About matched.");
             ciliAI_updateChatWindow("Hello! I am CiliAI. I can answer questions about ciliary genes by integrating data on phylogeny, protein domains, expression, and phenotypes. How can I help?", "ciliai");
             return;
        }

        // --- STAGE 1: Check for complex, list-based, or non-gene queries ---
        console.log("[CiliAI LOG] 5. Trying Stage 1 (Complex Intent)...");
        const complexResult = await ciliAI_resolveComplexIntent(qLower, query); 
        
        if (complexResult !== null) {
            console.log("[CiliAI LOG] 5a. Stage 1 Matched.");
            if (typeof complexResult === 'string') {
                ciliAI_updateChatWindow(complexResult, "ciliai");
            }
            return; // Intent was handled. Stop here.
        }

        console.log("[CiliAI LOG] 5b. Stage 1 Failed. Proceeding to Stage 2 (Single Gene)...");
        
        // --- STAGE 2: Fallback to single-gene query resolution ---
        
        // --- (FIXED) SMARTER GENE REGEX ---
        // This regex now:
        // 1. Excludes the problematic words (list, plot, compare, joubert, etc.)
        // 2. Prioritizes gene-like patterns (e.g., ARL13B, IFT88, CEP290)
        // 3. Tries to find genes after keywords like "for", "of", "about"
        let geneName = null;
        const stopWords = /\b(show|me|what|is|tell|about|for|genes|list|plot|compare|joubert|syndrome|proteins|phylogeny|expression|ciliai|can)\b/i;

        // Try to find a gene-like word NOT in the stopWords list
        // This looks for words with letters AND numbers (IFT88) or all-caps (BBS1)
        const geneRegex = /\b([A-Z]{2,}[0-9]{1,}|[A-Z0-9]{3,6})\b/g;
        let geneMatch;
        let potentialGenes = [];
        
        while ((geneMatch = geneRegex.exec(query.toUpperCase())) !== null) {
            if (!stopWords.test(geneMatch[1])) {
                potentialGenes.push(geneMatch[1]);
            }
        }
        
        // If we found potential genes, pick the first one.
        // This is still a simple heuristic but much better than before.
        if (potentialGenes.length > 0) {
             // Heuristic: prefer genes *after* a keyword if possible
            const afterKeyword = query.match(/(?:for|of|about|gene)\s+([A-Z0-9-]{3,})/i);
             if (afterKeyword && afterKeyword[1]) {
                geneName = afterKeyword[1].toUpperCase();
             } else {
                geneName = potentialGenes[0]; // Default to the first valid one found
             }
        }
        // --- END OF REGEX FIX ---

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
            intent = "getExpression"; 
        } else if (qLower.includes("summary") || qLower.includes("what is") || qLower.includes("tell me about")) {
            intent = "getSummary"; 
        } else if (geneName) {
            intent = "getSummary"; // Default action
        } else {
            intent = "unknown";
        }

        console.log(`[CiliAI LOG] 7. Intent parsed: ${intent}`);

        // --- Action Dispatch (for single-gene queries) ---
        if (intent !== "unknown" && !params.gene) {
            console.warn("[CiliAI LOG] 7a. Intent needs gene, but none found.");
            // This happens for "compare phylogeny" - Stage 1 should handle this!
            ciliAI_updateChatWindow("I understood the topic but couldn't find a specific gene name in your query. Please try again, for example: 'What is IFT88?'", "ciliai");
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
    
    // --- Define filter keywords ---
    const localizationTerms = ["lysosome", "lysosomal", "basal body", "transition zone", "cilia", "axoneme", "centrosome", "ciliary membrane", "nucleus", "mitochondria", "ciliary tip"];
    const phenotypeTerms = ["short cilia", "long cilia", "cilia length", "cilia defects", "decreased ciliation", "loss of cilia", "reduced cilia", "no cilia"];
    const tissueTerms = ["lung", "kidney", "retina", "brain", "liver", "testis"];
    const cellTypeTerms = ["ciliated cell", "epithelial cell", "neuron", "rod", "cone"];
    const diseaseTerms = ["joubert", "bardet-biedl", "bbs", "mks", "meckel-gruber", "pcd", "nephronophthisis", "nphp", "polycystic kidney"];

    // --- Filter Parsing ---
    let filters = {};
    
    const locMatch = localizationTerms.find(name => qLower.includes(name));
    if (locMatch) filters.localization = locMatch.replace("lysosomal", "lysosome"); // Standardize
    
    const phenoMatch = phenotypeTerms.find(term => qLower.includes(term));
    if (phenoMatch) filters.phenotype = phenoMatch.replace("decreased ciliation", "reduced cilia"); // Standardize
    
    const tissueMatch = tissueTerms.find(term => qLower.includes(`in ${term}`) || qLower.includes(`in the ${term}`));
    if (tissueMatch) filters.tissue = tissueMatch;
    
    const cellTypeMatch = cellTypeTerms.find(term => qLower.includes(term));
    if (cellTypeMatch) filters.cell_type = cellTypeMatch.replace("ciliated cell", "ciliated"); // Standardize
    
    const diseaseMatch = diseaseTerms.find(term => qLower.includes(term));
    if (diseaseMatch) filters.disease = diseaseMatch;

    // --- Query Execution ---
    // If we found more than one filter, use the master query.
    if (Object.keys(filters).length > 1) {
        
        console.log("[CiliAI Master Query] Running with filters:", filters);
        const results = ciliAI_masterQuery(filters);
        
        if (results.length === 0) {
            return `<p>No genes matched all criteria: ${JSON.stringify(filters)}</p>`;
        }
        
        // Format the results
        let html = `<p>Found <strong>${results.length}</strong> genes matching your criteria (<em>${Object.values(filters).join(', ')}</em>):</p>
                    <table class="gene-detail-table">
                        <thead><tr><th>Gene</th><th>Description</th></tr></thead>
                        <tbody>`;
        html += results.map(g => `<tr><td><strong>${g.gene}</strong></td><td>${g.description || 'No description.'}</td></tr>`).join('');
        html += `   </tbody>
                    </table>`;
        return html;
    }
    
    // ... (rest of your existing logic for single disease/complex lists) ...
    // e.g., if (qLower.includes("joubert syndrome")) { ... }
    
    // --- Fallback ---
    return null; // Let Stage 2 (single-gene) handle it
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


