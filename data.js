// data.js

/**
 * Sanitizes any string by removing invisible characters and normalizing it.
 */
function sanitize(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
        .replace(/[^\x20-\x7E]/g, '')
        .trim()
        .toUpperCase();
}

/**
 * Loads, sanitizes, and prepares the gene database into an efficient lookup map.
 */
async function loadAndPrepareDatabase() {
    if (geneDataCache) return true;
    try {
        const resp = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/ciliahub_data.json');
        if (!resp.ok) throw new Error(`HTTP Error ${resp.status}`);
        const rawGenes = await resp.json();

        if (!Array.isArray(rawGenes)) {
            throw new Error('Invalid data format: expected array');
        }

        geneDataCache = rawGenes;
        allGenes = rawGenes;
        geneMapCache = new Map();

        allGenes.forEach(g => {
            if (!g.gene || typeof g.gene !== 'string') {
                console.warn('Skipping entry with invalid gene name:', g);
                return;
            }
            const nameKey = sanitize(g.gene);
            if (nameKey) geneMapCache.set(nameKey, g);

            if (g.synonym) {
                String(g.synonym).split(/[,;]/).forEach(syn => {
                    const key = sanitize(syn);
                    if (key && !geneMapCache.has(key)) geneMapCache.set(key, g);
                });
            }

            if (g.ensembl_id) {
                String(g.ensembl_id).split(/[,;]/).forEach(id => {
                    const key = sanitize(id);
                    if (key) geneMapCache.set(key, g);
                });
            }

            if (g.localization) {
                const validLocalizations = [
                    'cilia', 'basal body', 'transition zone', 'axoneme', 'ciliary membrane',
                    'centrosome', 'flagella', 'nucleus', 'cytosol', 'mitochondrion',
                    'endoplasmic reticulum', 'golgi apparatus', 'lysosome', 'microbody',
                    'peroxisome', 'microtubules', 'autophagosomes', 'ribosome', 'p-body'
                ];
                let sanitizedLocalization = (Array.isArray(g.localization) ? g.localization : String(g.localization).split(/[,;]/))
                    .map(loc => loc ? loc.trim().toLowerCase() : '')
                    .filter(loc => loc && validLocalizations.includes(loc));
                geneLocalizationData[g.gene] = mapLocalizationToSVG(sanitizedLocalization);
            }
        });

        console.log(`Loaded ${allGenes.length} genes into database`);
        return true;
    } catch (e) {
        console.error('Data load error:', e);
        allGenes = getDefaultGenes();
        geneMapCache = new Map();
        allGenes.forEach(g => {
            if (g.gene) geneMapCache.set(sanitize(g.gene), g);
        });
        return false;
    }
}

/**
 * Search genes using symbols, synonyms, or Ensembl IDs from the pre-built cache.
 */
function findGenes(queries) {
    const foundGenes = new Map();
    const notFound = [];
    queries.forEach(query => {
        const result = geneMapCache.get(query);
        if (result) {
            if (!foundGenes.has(result.gene)) {
                foundGenes.set(result.gene, result);
            }
        } else {
            notFound.push(query);
        }
    });
    return {
        foundGenes: Array.from(foundGenes.values()),
        notFoundGenes: notFound
    };
}

// ✨ --- MOVED HERE FROM SCRIPT.JS --- ✨
/**
 * Maps semantic localization terms to specific SVG element IDs.
 * @param {string[]} localizationArray - An array of sanitized, lowercase localization terms.
 * @returns {string[]} An array of corresponding SVG part IDs.
 */
function mapLocalizationToSVG(localizationArray) {
    const mapping = {
        "ciliary membrane": ["ciliary-membrane", "axoneme"],
        "axoneme": ["ciliary-membrane", "axoneme"],
        "basal body": ["basal-body"],
        "transition zone": ["transition-zone"],
        "cilia": ["ciliary-membrane", "axoneme"],
        "flagella": ["ciliary-membrane", "axoneme"],
        "nucleus": ["nucleus"],
        "centrosome": ["basal-body"],
        "cytosol": ["cell-body"],
        "mitochondrion": ["cell-body"],
        "endoplasmic reticulum": ["cell-body"],
        "golgi apparatus": ["cell-body"],
        "lysosome": ["cell-body"],
        "microbody": ["cell-body"],
        "peroxisome": ["cell-body"],
        "microtubules": ["cell-body"],
        "autophagosomes": ["cell-body"]
    };
    if (!Array.isArray(localizationArray)) return [];
    return [...new Set(localizationArray.flatMap(loc => mapping[loc] || []))];
}

/**
 * Provides a default set of genes as a fallback if the main database fails to load.
 */
// Default gene set as fallback if loading fails
function getDefaultGenes() {
    return [
        {
            gene: "IFT88",
            ensembl_id: "ENSG00000032742",
            description: "Intraflagellar transport protein 88. Key component of the IFT-B complex.",
            synonym: "BBS20, D13S840E, TG737, TTC10",
            omim_id: "605484",
            functional_summary: "Essential for intraflagellar transport and ciliary assembly. It is a component of the IFT complex B and is required for cilium biogenesis.",
            localization: ["axoneme", "basal body"],
            reference: ["https://pubmed.ncbi.nlm.nih.gov/9724754/"],
            protein_complexes: "IFT-B",
            gene_annotation: "",
            functional_category: ["Intraflagellar transport", "Ciliary assembly/disassembly"],
            ciliopathy: "Bardet-Biedl syndrome 20"
        },
        {
            gene: "CEP290",
            ensembl_id: "ENSG00000198707",
            description: "Centrosomal protein 290. Critical component of the ciliary transition zone.",
            synonym: "BBS14, JBTS5, MKS4, NPHP6, SLSN6",
            omim_id: "610142",
            functional_summary: "Regulates ciliary gating and ciliopathy-related pathways. Acts as a gatekeeper for proteins entering and exiting the cilium.",
            localization: ["transition zone"],
            reference: ["https://pubmed.ncbi.nlm.nih.gov/16971477/"],
            protein_complexes: "NPHP-MKS-JBTS complex",
            gene_annotation: "",
            functional_category: ["Transition zone", "Ciliary gating"],
            ciliopathy: "Joubert syndrome 5, Meckel syndrome 4, Bardet-Biedl syndrome 14, Leber congenital amaurosis 10"
        },
        {
            gene: "WDR31",
            ensembl_id: "ENSG00000106459",
            description: "WD repeat domain 31. Involved in ciliary assembly and maintenance.",
            synonym: "C14orf148",
            omim_id: "",
            functional_summary: "Required for proper ciliary structure and function. It is thought to be involved in the regulation of ciliogenesis.",
            localization: ["axoneme"],
            reference: ["https://pubmed.ncbi.nlm.nih.gov/22114125/"],
            protein_complexes: "",
            gene_annotation: "",
            functional_category: ["Ciliary assembly/disassembly"],
            ciliopathy: ""
        },
        {
            gene: "ARL13B",
            ensembl_id: "ENSG00000169379",
            description: "ADP-ribosylation factor-like protein 13B. Involved in ciliary membrane biogenesis.",
            synonym: "ARL2L2, JBTS8",
            omim_id: "608922",
            functional_summary: "Critical for ciliary signaling and membrane trafficking. It is a small G protein that localizes to the ciliary membrane and regulates the traffic of ciliary proteins.",
            localization: ["ciliary membrane"],
            reference: ["https://pubmed.ncbi.nlm.nih.gov/19732862/"],
            protein_complexes: "",
            gene_annotation: "",
            functional_category: ["Ciliary membrane", "Signal transduction"],
            ciliopathy: "Joubert syndrome 8"
        },
        {
            gene: "BBS1",
            ensembl_id: "ENSG00000166246",
            description: "Bardet-Biedl syndrome 1 protein. Part of the BBSome complex.",
            synonym: "BBS",
            omim_id: "209901",
            functional_summary: "Involved in ciliary trafficking and BBSome assembly. The BBSome complex is a key regulator of protein trafficking to and from the cilium.",
            localization: ["basal body", "ciliary membrane"],
            reference: ["https://pubmed.ncbi.nlm.nih.gov/11058628/"],
            protein_complexes: "BBSome",
            gene_annotation: "",
            functional_category: ["Ciliary trafficking", "BBSome complex"],
            ciliopathy: "Bardet-Biedl syndrome 1"
        },
        {
            gene: "ACE2",
            ensembl_id: "ENSG00000130234",
            description: "Angiotensin-converting enzyme 2. Serves as the entry point for SARS-CoV-2.",
            synonym: "ACEH",
            omim_id: "300335",
            functional_summary: "Regulates blood pressure and acts as a receptor for coronaviruses in respiratory cilia. Its expression on ciliated cells is a key factor in COVID-19 infection.",
            localization: ["cilia"],
            reference: ["https://pubmed.ncbi.nlm.nih.gov/32142651/"],
            protein_complexes: "",
            gene_annotation: "",
            functional_category: ["Cell surface receptor", "Ciliary membrane"],
            ciliopathy: ""
        },
        {
            gene: "PKD2",
            ensembl_id: "ENSG00000118762",
            description: "Polycystin-2, a calcium-permeable ion channel.",
            synonym: "TRPP2",
            omim_id: "173910",
            functional_summary: "Ion channel important for mechanosensation in primary cilia.",
            localization: ["axoneme", "endoplasmic reticulum"],
            reference: ["https://pubmed.ncbi.nlm.nih.gov/11285250/"],
            protein_complexes: ["Polycystin complex"],
            gene_annotation: "",
            functional_category: ["Ion transport", "Ciliary signaling"],
            ciliopathy: "Autosomal dominant polycystic kidney disease"
        }
    ];
}


function mapLocalizationToSVG(localizationArray) {
    const mapping = {
        "ciliary membrane": ["ciliary-membrane", "axoneme"],
        "axoneme": ["ciliary-membrane", "axoneme"],
        "basal body": ["basal-body"],
        "transition zone": ["transition-zone"],
        "cilia": ["ciliary-membrane", "axoneme"],
        "flagella": ["ciliary-membrane", "axoneme"],
        "ciliary associated gene": ["ciliary-membrane", "axoneme"],
        "nucleus": ["nucleus"],
        "centrosome": ["basal-body"],
        "cytosol": ["cell-body"],
        "mitochondrion": ["cell-body"],
        "endoplasmic reticulum": ["cell-body"],
        "golgi apparatus": ["cell-body"],
        "lysosome": ["cell-body"],             // ✨ NEW
        "microbody": ["cell-body"],             // ✨ NEW
        "peroxisome": ["cell-body"],            // ✨ NEW
        "microtubules": ["cell-body"],          // ✨ NEW
        "autophagosomes": ["cell-body"]         // ✨ NEW
    };
    if (!Array.isArray(localizationArray)) return [];

    return localizationArray.flatMap(loc => {
        // If 'loc' is not a string (e.g., it's null), skip it.
        if (typeof loc !== 'string') return []; 

        const normalized = loc.trim().toLowerCase().replace(/[-_]/g, ' ');
        return mapping[normalized] || [];

    }).filter(id => allPartIds.includes(id));
}
