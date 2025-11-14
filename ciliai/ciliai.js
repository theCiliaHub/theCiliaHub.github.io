/* ==============================================================
 * CiliAI – Interactive Explorer (v4.0 – Nov 14, 2025)
 * ==============================================================
 * • MERGED: Combines the v2.1 data engine (with buildLookups fix)
 * with the v3.5 interactive SVG layout and the v4.0 CiliBrain.
 * • All duplicate functions have been removed.
 * • All syntax errors have been fixed.
 * ============================================================== */

(function () {
    'use strict';

    // ==========================================================
    // 1. GLOBAL STATE & CONSTANTS
    // ==========================================================

    window.CiliAI = {
        data: {},
        masterData: [],
        ready: false,
        lookups: {}
    };

    let selectedCompartment = null;
    let umapData = null;
    let cellxgeneData = null;

    // --- Phylogeny Constants ---
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
        "Cryptococcus neoformans var. neoformans serotype D (strain JEC21 / ATCC MYA-565)",
        "Ustilago maydis (strain 521 / FGSC 9021)", "Candida albicans (strain WO-1)",
        "Arabidopsis thaliana", "Brachypodium distachyon", "Sorghum bicolor", "Vitis vinifera",
        "Cryptosporidium parvum (strain Iowa II)", "Entamoeba histolytica", "Encephalitozoon cuniculi (strain GB-M1)"
    ];

    /**
     * Helper function to ensure a value is an array.
     */
    function ensureArray(value) {
        if (Array.isArray(value)) return value;
        if (value === null || value === undefined) return [];
        return [value];
    }

    // ==========================================================
    // 2. DATA LOADING & PROCESSING
    // ==========================================================

    /**
     * Initializes the CiliAI module: loads data, builds lookups,
     * and then displays the page.
     */
    async function initCiliAI() {
        console.log('CiliAI: Initializing (v4.0 Merged)...');
        await loadCiliAIData();
        if (!Array.isArray(window.CiliAI.masterData)) {
            console.warn('masterData not array. Initializing empty.');
            window.CiliAI.masterData = [];
        }
        buildLookups();
        window.CiliAI.ready = true;
        console.log('CiliAI: Ready! Data loaded.');

        // If on the CiliAI page, display it.
        if (window.location.hash.includes('/ciliai')) {
            // Small delay to ensure CiliaHub's DOM is settled
            setTimeout(displayCiliAIPage, 100);
        }
    }

    /**
     * Fetches all required data from GitHub repositories.
     */
    async function loadCiliAIData(timeoutMs = 30000) {
        const urls = {
            ciliahub: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/ciliahub_data.json',
            umap: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/umap_data.json',
            screens: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cilia_screens_data.json',
            cellxgene: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cellxgene_data.json',
            rna_tissue: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/rna_tissue_consensus.tsv',
            corum: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/corum_humanComplexes.json',
            domains: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cili_ai_domain_database_FIXED.json',
            nevers2017: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/nevers_et_al_2017_matrix_optimized.json',
            li2014: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/li_et_al_2014_matrix_optimized.json'
        };

        async function safeFetch(url, type = 'json', timeout = timeoutMs) {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            try {
                console.log(`Fetching: ${url}`);
                const res = await fetch(url, { signal: controller.signal });
                clearTimeout(id);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return type === 'json' ? await res.json() : await res.text();
            } catch (err) {
                clearTimeout(id);
                console.warn(`Failed: ${url}`, err.message);
                return null;
            }
        }

        console.log('CiliAI: Parallel data fetch...');
        const [
            ciliahubRaw, umapRaw, screensRaw, cellxgeneRaw,
            rnaTsv, corumRaw, domainRaw, neversRaw, liRaw
        ] = await Promise.all([
            safeFetch(urls.ciliahub, 'json'),
            safeFetch(urls.umap, 'json'),
            safeFetch(urls.screens, 'json'),
            safeFetch(urls.cellxgene, 'json'),
            safeFetch(urls.rna_tissue, 'text'),
            safeFetch(urls.corum, 'json'),
            safeFetch(urls.domains, 'json'),
            safeFetch(urls.nevers2017, 'json'),
            safeFetch(urls.li2014, 'json')
        ]);

        // Cache for UMAP (if needed by other pages)
        window.CiliAI_UMAP = umapRaw || [];
        window.CiliAI_snRNA = cellxgeneRaw || {};
        window.liPhylogenyCache = liRaw;
        window.neversPhylogenyCache = neversRaw;

        // === Process screens ===
        const screensByGene = {};
        if (screensRaw && typeof screensRaw === 'object') {
            Object.keys(screensRaw).forEach(geneKey => {
                const key = geneKey.toUpperCase();
                const entries = Array.isArray(screensRaw[geneKey]) ? screensRaw[geneKey] : [];
                screensByGene[key] = entries.map(s => ({
                    dataset: s.source || s.dataset || 'Unknown',
                    classification: s.result || s.classification || 'Not Reported',
                    paper_link: s.paper_link || s.paper || null,
                    mean_percent_ciliated: s.mean_percent_ciliated ?? s.mean ?? null,
                    sd_percent_ciliated: s.sd_percent_ciliated ?? s.sd ?? null,
                    z_score: s.z_score ?? s.z ?? null
                }));
            });
        }

        // === Process scRNA expression ===
        const scExpressionByGene = {};
        if (cellxgeneRaw && typeof cellxgeneRaw === 'object') {
            Object.keys(cellxgeneRaw).forEach(geneKey => {
                scExpressionByGene[geneKey.toUpperCase()] = cellxgeneRaw[geneKey];
            });
        }

        // === Process tissue RNA ===
        const tissueExpressionByGene = {};
        function parseTsvToObjects(text) {
            if (!text) return [];
            const lines = text.trim().split(/\r?\n/).filter(Boolean);
            if (!lines.length) return [];
            const header = lines.shift().split('\t').map(h => h.trim());
            const normalizedHeader = header.map(h => h.toLowerCase().replace(/\s+/g, '_'));
            return lines.map(line => {
                const cols = line.split('\t');
                const obj = {};
                normalizedHeader.forEach((key, i) => obj[key] = cols[i] ?? '');
                return obj;
            });
        }
        const rnaRows = parseTsvToObjects(rnaTsv);
        rnaRows.forEach(row => {
            const gene = row.gene_name || row.gene || row.gene_symbol || row.geneid || row.gene_id;
            if (!gene) return;
            const key = gene.toUpperCase();
            const tissue = row.tissue || row.tissue_name || 'unknown';
            const val = parseFloat(row.ntpm ?? row.ntpms ?? row.tpm ?? row.value ?? NaN);
            if (!tissueExpressionByGene[key]) tissueExpressionByGene[key] = {};
            if (Number.isFinite(val)) tissueExpressionByGene[key][tissue] = val;
        });

        // === CORUM complexes ===
        const corumByGene = {};
        if (Array.isArray(corumRaw)) {
            corumRaw.forEach(complex => {
                const name = complex.complex_name || complex.name || 'Unnamed';
                const subunits = Array.isArray(complex.subunits) ? complex.subunits : [];
                const genes = subunits.map(s => (s.gene_name || s.gene || '').toUpperCase()).filter(Boolean);
                genes.forEach(g => {
                    if (!corumByGene[g]) corumByGene[g] = {};
                    corumByGene[g][name] = genes;
                });
            });
        }

        // === Domains ===
        const domainsByGene = {};
        if (domainRaw && typeof domainRaw === 'object') {
            Object.keys(domainRaw).forEach(geneKey => {
                const key = geneKey.toUpperCase();
                const entries = Array.isArray(domainRaw[geneKey]) ? domainRaw[geneKey] : [];
                domainsByGene[key] = {
                    pfam_ids: [...new Set(entries.map(d => d.domain_id).filter(Boolean))],
                    domain_descriptions: [...new Set(entries.map(d => d.description).filter(Boolean))]
                };
            });
        }

        // === Li 2014 ===
        const liMap = {};
        if (liRaw?.genes) {
            Object.keys(liRaw.genes).forEach(entrez => {
                const d = liRaw.genes[entrez];
                const sym = d.g || d.gene;
                if (sym) {
                    const key = sym.toUpperCase();
                    liMap[key] = {
                        class: (liRaw.summary?.class_list?.[d.c]) || 'Unknown',
                        class_id: d.c,
                        species_data: d.s || [],
                        entrez_id: d.e || entrez
                    };
                }
            });
        }

        // === Nevers 2017 ===
        const neversMap = {};
        if (neversRaw?.genes) {
            Object.keys(neversRaw.genes).forEach(sym => {
                if (sym === 'Gene Name') return;
                const d = neversRaw.genes[sym];
                const key = sym.toUpperCase();
                if (d?.s?.length) {
                    neversMap[key] = {
                        species_count: d.s.length,
                        species_data: d.s,
                        in_ciliated_organisms: d.s.filter(idx =>
                            neversRaw.organism_groups?.ciliated_organisms?.includes(idx)
                        ).length
                    };
                }
            });
        }

        // === Build masterData ===
        const hubData = Array.isArray(ciliahubRaw) ? ciliahubRaw : [];
        if (!hubData.length) {
            console.error('ciliahub_data.json empty');
            window.CiliAI.masterData = [];
            return;
        }

        function extractCiliopathyInfo(gene) {
            const split = str => String(str).split(';').map(s => s.trim()).filter(Boolean);
            const ciliopathies = new Set(), classifications = new Set();
            ensureArray(gene.ciliopathy).forEach(c => split(c).forEach(v => ciliopathies.add(v)));
            ensureArray(gene.ciliopathy_classification).forEach(c => split(c).forEach(v => classifications.add(v)));
            return { ciliopathy: Array.from(ciliopathies), ciliopathy_classification: Array.from(classifications) };
        }

        const masterData = hubData.map(gene => {
            const sym = gene.gene ?? gene.g ?? gene.name ?? gene.symbol ?? null;
            const key = sym ? sym.toUpperCase() : null;
            const { ciliopathy, ciliopathy_classification } = extractCiliopathyInfo(gene);

            const explicit = {
                gene: sym,
                ensembl_id: gene.ensembl_id || null,
                description: gene.description || null,
                functional_summary: gene.functional_summary || null,
                localization: gene.localization || null,
                reference: gene.reference || null,
                pfam_ids: ensureArray(gene.pfam_ids),
                domain_descriptions: ensureArray(gene.domain_descriptions),
                synonym: gene.synonym || null,
                evidence_source: gene.evidence_source || "CiliaMiner",
                functional_category: gene.functional_category || null,
                string_link: gene.string_link || null,
                lof_effects: gene.lof_effects || "Not Reported",
                percent_ciliated_cells_effects: gene.percent_ciliated_cells_effects || "Not Reported",
                overexpression_effects: gene.overexpression_effects || "Not Reported"
            };

            const orthologs = {
                ortholog_mouse: gene.ortholog_mouse || null,
                ortholog_c_elegans: gene.ortholog_c_elegans || null,
                ortholog_xenopus: gene.ortholog_xenopus || null,
                ortholog_zebrafish: gene.ortholog_zebrafish || null,
                ortholog_drosophila: gene.ortholog_drosophila || null
            };

            const originalScreens = ensureArray(gene.screens);
            const additionalScreens = key ? (screensByGene[key] || []) : [];
            const allScreens = [...originalScreens, ...additionalScreens];

            const domains = key ? (domainsByGene[key] || { pfam_ids: [], domain_descriptions: [] }) : { pfam_ids: [], domain_descriptions: [] };
            const corum = key ? (corumByGene[key] || {}) : {};
            const complexes = { ...(gene.complex_components || {}), ...corum };

            const modules = [];
            if (key && liMap[key]?.class && !['No_data', 'Other'].includes(liMap[key].class)) {
                modules.push(liMap[key].class.replace(/_/g, ' '));
            }

            return {
                ...gene,
                ...explicit,
                ...orthologs,
                ciliopathy,
                ciliopathy_classification,
                screens: allScreens,
                expression: {
                    scRNA: key ? (scExpressionByGene[key] || null) : null,
                    tissue: key ? (tissueExpressionByGene[key] || null) : null
                },
                complex_components: complexes,
                pfam_ids: Array.from(new Set([...explicit.pfam_ids, ...domains.pfam_ids])),
                domain_descriptions: Array.from(new Set([...explicit.domain_descriptions, ...domains.domain_descriptions])),
                functional_modules: modules,
                phylogeny: {
                    li_2014: key ? (liMap[key] || null) : null,
                    nevers_2017: key ? (neversMap[key] || null) : null
                }
            };
        });

        // === Add phylogeny-only genes ===
        function addPhylogenyOnlyGenes(master, liMap, neversMap) {
            const existing = new Set(master.map(g => g.gene?.toUpperCase()).filter(Boolean));
            const extra = [];

            Object.keys(liMap).forEach(sym => {
                if (!existing.has(sym)) {
                    extra.push({
                        gene: sym,
                        description: "From Li et al. 2014 phylogeny",
                        evidence_source: "Li_2014_Phylogeny",
                        phylogeny: { li_2014: liMap[sym] },
                        is_phylogeny_only: true
                    });
                }
            });

            Object.keys(neversMap).forEach(sym => {
                if (!existing.has(sym) && !extra.find(g => g.gene === sym)) {
                    extra.push({
                        gene: sym,
                        description: "From Nevers et al. 2017 phylogeny",
                        evidence_source: "Nevers_2017_Phylogeny",
                        phylogeny: { nevers_2017: neversMap[sym] },
                        is_phylogeny_only: true
                    });
                }
            });

            console.log(`Added ${extra.length} phylogeny-only genes`);
            return [...master, ...extra];
        }

        window.CiliAI.masterData = addPhylogenyOnlyGenes(masterData, liMap, neversMap);
        window.CiliAI.data = { screensByGene, scExpressionByGene, tissueExpressionByGene, corumByGene, domainsByGene, liMap, neversMap, umap: umapRaw || [] };
        console.log(`CiliAI: ${window.CiliAI.masterData.length} genes integrated`);
    }

    /**
     * Builds the lookup maps (like geneMap) from the masterData.
     * (FIXED: Now integrates data from getComplexPhylogenyTableMap)
     */
    /**
     * Builds the lookup maps (like geneMap) from the masterData.
     * (FIXED: Now correctly splits localization strings into individual keys)
     * (FIXED: Now integrates data from getComplexPhylogenyTableMap)
     */
    function buildLookups() {
        const L = window.CiliAI.lookups = {};
        const master = Array.isArray(window.CiliAI.masterData) ? window.CiliAI.masterData : [];

        // 1. Build GeneMap (no change)
        L.geneMap = {};
        master.forEach(g => {
            const sym = (g.gene || '').toUpperCase();
            if (sym) L.geneMap[sym] = g;
        });

        // 2. Build Complex Lookups from masterData (no change)
        L.complexByGene = {};
        L.complexByName = {};
        master.forEach(g => {
            const key = g.gene?.toUpperCase();
            if (key && g.complex_components) {
                Object.keys(g.complex_components).forEach(name => {
                    if (isNaN(parseInt(name))) { // Filter out numeric-only keys
                        if (!L.complexByGene[key]) L.complexByGene[key] = [];
                        if (!L.complexByGene[key].includes(name)) L.complexByGene[key].push(name);
                        
                        if (!L.complexByName[name]) L.complexByName[name] = [];
                        
                        ensureArray(g.complex_components[name]).forEach(gg => {
                            if (gg && !L.complexByName[name].includes(gg)) {
                                L.complexByName[name].push(gg);
                            }
                        });
                    }
                });
            }
        });

        // 3. --- THIS IS THE FIX ---
        // Build L.byLocalization from masterData, splitting strings
        L.byLocalization = {};
        const localizationSplitter = (value) => {
            if (Array.isArray(value)) return value; // It's already an array
            
            if (typeof value === 'string') {
                // --- NEW CLEANING STEP ---
                // Fixes "basal body,flagella" -> "basal body, flagella"
                let cleanedValue = value.replace("basal body,flagella", "basal body, flagella"); 
                // --- END CLEANING STEP ---
                
                return cleanedValue.split(/, ?|; ?/); // Split string by comma or semicolon
            }
            return []; // It's null or undefined
        };

        master.forEach(g => {
            const key = g.gene?.toUpperCase();
            if (!key) return;
            
            const localizations = localizationSplitter(g.localization); // Use the splitter
            localizations.forEach(loc => {
                const locKey = loc.trim(); // Trim whitespace
                if (locKey) {
                    if (!L.byLocalization[locKey]) L.byLocalization[locKey] = [];
                    if (!L.byLocalization[locKey].includes(key)) {
                        L.byLocalization[locKey].push(key);
                    }
                }
            });
        });
        // --- END FIX ---


        // 4. Augment Lookups with your Complex Map (no change from last step)
        const complexMap = getComplexPhylogenyTableMap();
        L.byModuleOrComplex = {}; // For "BBSome", "IFT-A"
        
        const localizationKeys = [
            "TRANSITION ZONE", "MKS MODULE", "NPHP MODULE", "BASAL BODY", "CILIARY TIP", 
            "RADIAL SPOKE", "CENTRAL PAIR", "DYNEIN ARM", "OUTER DYNEIN ARM", 
            "INNER DYNEIN ARM", "CENTROSOME"
        ];
        
        for (const key in complexMap) {
            const upperKey = key.toUpperCase(); // e.g., "CILIARY TIP"
            const genes = complexMap[key].map(g => g.toUpperCase());

            // 4a. Add to the byModuleOrComplex lookup
            L.byModuleOrComplex[upperKey] = genes;
            
            // 4b. Add to byLocalization lookup if it's a localization key
            if (localizationKeys.includes(upperKey)) {
                // Format the key to match existing data (e.g., "Ciliary Tip")
                const locKey = key.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                
                if (!L.byLocalization[locKey]) {
                    L.byLocalization[locKey] = [];
                }
                
                // Add genes to the localization lookup, ensuring uniqueness
                genes.forEach(gene => {
                    if (!L.byLocalization[locKey].includes(gene)) {
                        L.byLocalization[locKey].push(gene);
                    }
                });
            }
        }
        
        // 5. Build other lookups from masterData (no change)
        L.byModules = {}; 
        L.byCiliopathy = {};
        master.forEach(g => {
            const key = g.gene?.toUpperCase();
            if (!key) return;
            if (g.functional_modules) {
                g.functional_modules.forEach(m => {
                    if (!L.byModules[m]) L.byModules[m] = [];
                    if (!L.byModules[m].includes(key)) L.byModules[m].push(key);
                });
            }
            if (g.ciliopathy) {
                g.ciliopathy.forEach(c => {
                    const cl = c.toLowerCase();
                    if (!L.byCiliopathy[cl]) L.byCiliopathy[cl] = [];
                    if (!L.byCiliopathy[cl].includes(key)) L.byCiliopathy[cl].push(key);
                });
            }
        });

        L.umapByGene = {};
        (window.CiliAI.data.umap || []).forEach(pt => {
            if (pt.gene) L.umapByGene[pt.gene.toUpperCase()] = pt;
        });

        console.log('CiliAI: Lookups built and normalized.');
    }

    
    // ==========================================================
    // 3. STATIC UI & PAGE DISPLAY
    // ==========================================================

    // Static info about the structures themselves.
    const structureInfoMap = {
        // Cilia Parts
        'basal-body': {
            title: 'Basal Body',
            description: "The cilium's 'anchor', derived from the centriole. It templates the axoneme.",
            genes: ['CEP164', 'OFD1', 'CCP110', 'CEP290', 'MKS1']
        },
        'transition-zone': {
            title: 'Transition Zone',
            description: "The 'ciliary gate' that controls protein entry and exit.",
            genes: ['NPHP1', 'MKS1', 'CEP290', 'TMEM67', 'B9D1', 'RPGRIP1L']
        },
        'axoneme': {
            title: 'Axoneme',
            description: 'The microtubule core (9+0 or 9+2). Site of IFT.',
            genes: ['IFT88', 'IFT81', 'IFT172', 'KIF3A', 'DNAH5', 'ARL13B']
        },
        'ciliary-membrane': {
            title: 'Ciliary Membrane',
            description: 'Specialized membrane rich in receptors and channels.',
            genes: ['PKD1', 'PKD2', 'ARL13B', 'INPP5E', 'ADGRV1']
        },
        // Organelles
        "nucleus": {
            title: "Nucleus",
            description: "Contains the cell's DNA; the control center for gene expression and cell division."
        },
        "nucleolus": {
            title: "Nucleolus",
            description: "The dense structure inside the nucleus; site of rRNA synthesis and ribosome subunit assembly."
        },
        "golgi-apparatus": {
            title: "Golgi Apparatus",
            description: "Processes, packages, and sorts proteins and lipids for transport to other organelles or for secretion."
        },
        "golgi-vesicle": {
            title: "Golgi Vesicle",
            description: "Small, membrane-bound sacs that transport materials from the Golgi apparatus."
        },
        "cytoplasm": {
            title: "Cytoplasm",
            description: "The jelly-like substance filling the cell, enclosing the organelles and serving as the site for many metabolic reactions."
        },
        "cell-body": { // Alias for click handler
            title: "Cell Body / Cytoplasm",
            description: "The main body of the cell, enclosing the organelles and serving as the site for many metabolic reactions."
        },
        "peroxisome": {
            title: "Peroxisome",
            description: "Small organelle involved in fatty acid metabolism and the breakdown of reactive oxygen species."
        },
        "lysosome": {
            title: "Lysosome",
            description: "The cell's 'recycling center'; contains enzymes to break down waste materials and cellular debris."
        },
        "microtubule": {
            title: "Microtubule",
            description: "A component of the cytoskeleton; involved in intracellular transport, cell shape, and forms the core of the cilium."
        },
        "plasma-membrane": {
            title: "Plasma Membrane",
            description: "The semipermeable barrier that separates the cell's interior from the outside environment."
        },
        "mitochondria": {
            title: "Mitochondrion",
            description: "Generates most of the cell's ATP via oxidative phosphorylation; the 'powerhouse' of the cell. Often found near the basal body."
        },
        "ribosomes": {
            title: "Ribosomes",
            description: "Synthesizes proteins from mRNA templates. Shown here as small dots, often on the Endoplasmic Reticulum."
        }
    };

    /**
     * Main page display function
     */
    window.displayCiliAIPage = async function () {
        console.log("CiliAI: displayCiliAIPage() called.");
        const area = document.querySelector('.content-area');
        if (!area) {
            console.error('CiliAI: .content-area not found.');
            return;
        }

        // Set page to full-width mode
        area.className = 'content-area content-area-full';
        const panel = document.querySelector('.cilia-panel');
        if (panel) panel.style.display = 'none';

        // Inject CSS & HTML
        injectPageCSS();
        area.innerHTML = getPageHTML();

        // Generate SVG
        generateAndInjectSVG();

        // Setup event listeners
        setupPageEventListeners();

        // ** THIS IS THE FIX **
        // Data is already loaded by initCiliAI(). Just update the status.
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

/**
 * Injects the dynamic CSS for the page.
 */
function injectPageCSS() {
    const styleId = 'ciliai-dynamic-styles';
    if (document.getElementById(styleId)) return;

    const css = `
        /* GLOBAL RESET */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        html, body {
            height: 100%;
            overflow: hidden; /* No browser scrolling */
        }

        /* --- FIX: FULL-SCREEN WRAPPER WITH CORRECT NAVBAR OFFSET --- */
        .content-area.content-area-full {
            position: fixed;

            /* REAL HEIGHT OF BLUE NAVBAR */
            top: 95px !important;     

            /* Sidebar width */
            left: 250px;
            right: 0;
            bottom: 0;

            width: calc(100vw - 250px);
            height: calc(100vh - 95px) !important;

            padding: 0 !important;
            margin: 0 !important;

            overflow: hidden !important; 
            background: white;
        }

        /* Mobile: no sidebar, smaller navbar */
        @media (max-width: 992px) {
            .content-area.content-area-full {
                left: 0 !important;
                width: 100vw !important;
                top: 70px !important; 
                height: calc(100vh - 70px) !important;
            }
        }

        /* --- MAIN TWO-PANEL LAYOUT --- */
        .container {
            display: grid;
            grid-template-columns: 1fr 450px;
            height: 100%;
            width: 100%;
            gap: 0;
            overflow: hidden; 
        }

        @media (max-width: 992px) {
            .container {
                grid-template-columns: 1fr;
            }
        }

        /* LEFT PANEL */
        .left-panel {
            display: flex;
            flex-direction: column;
            background: #f5f7fa;
            border-right: 1px solid #e1e8ed;
            overflow: hidden; 
        }

        .header {
            padding: 20px 30px;
            background: white;
            color: #2c3e50;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            border-bottom: 1px solid #e1e8ed;
            z-index: 2;
        }

        .toolbar {
            padding: 15px 30px;
            background: white;
            border-bottom: 1px solid #e1e8ed;
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
            z-index: 1;
        }

        .diagram-container {
            flex: 1;
            padding: 20px;
            overflow: auto;
            display: flex;
            justify-content: center;
            align-items: center;
            background: white;
        }

        /* RIGHT PANEL */
        .right-panel {
            display: flex;
            flex-direction: column;
            background: #f5f7fa;
            overflow: hidden;
        }

        .welcome-section {
            padding: 25px;
            background: white;
            border-bottom: 1px solid #e1e8ed;
            max-height: 35vh;
            overflow-y: auto;
            flex-shrink: 0;
        }

        .chat-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            background: white;
        }

        .input-area {
            padding: 15px 20px;
            background: white;
            border-top: 1px solid #e1e8ed;
        }

        /* CHAT UI */
        .ciliai-message {
            margin-bottom: 15px;
            animation: fadeIn 0.3s ease;
        }

        .ciliai-message.user {
            text-align: right;
        }

        .ciliai-message-content {
            display: inline-block;
            max-width: 85%;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 13px;
            line-height: 1.5;
        }

        .ciliai-message.user .ciliai-message-content {
            background: #667eea;
            color: white;
            border-radius: 18px 18px 4px 18px;
        }

        .ciliai-message.assistant .ciliai-message-content {
            background: #f8f9fa;
            color: #2d3748;
            border: 1px solid #e1e8ed;
            border-radius: 18px 18px 18px 4px;
        }

        .ciliai-reaction-buttons {
            display: flex;
            gap: 8px;
            margin-top: 8px;
            font-size: 16px;
        }

        .ciliai-reaction-btn {
            cursor: pointer;
            opacity: 0.6;
            transition: all 0.2s;
            user-select: none;
        }

        .ciliai-reaction-btn:hover {
            opacity: 1;
            transform: scale(1.15);
        }

        /* GENE PANEL + LEGEND */
        .legend {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 12px;
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: #4a5568;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            transition: all 0.2s;
        }

        .legend-item:hover {
            background: #f7fafc;
        }

        .legend-color {
            width: 14px;
            height: 14px;
            border-radius: 3px;
            border: 1px solid rgba(0,0,0,0.2);
        }

        .gene-list {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 10px;
        }

        .gene-badge {
            padding: 5px 10px;
            background: #667eea15;
            color: #667eea;
            border-radius: 5px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .gene-badge:hover {
            background: #667eea;
            color: white;
        }
    `;

    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
}

    
    /**
     * Generates the main page HTML.
     */
    function getPageHTML() {
        // This HTML uses onclick attributes which are wired up to
        // window.searchGene, window.selectComp, etc.
        // Those functions are defined at the end of this file as
        // wrappers for the new v4.0 brain.
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
                        <div class="legend-item" onclick="selectComp('axoneme')">
                            <div class="legend-color" style="background: #4A5568;"></div>
                            <span>Axoneme</span>
                        </div>
                        <div class="legend-item" onclick="selectComp('transition-zone')">
                            <div class="legend-color" style="background: #718096;"></div>
                            <span>Transition Zone</span>
                        </div>
                        <div class="legend-item" onclick="selectComp('basal-body')">
                            <div class="legend-color" style="background: #4A5568;"></div>
                            <span>Basal Body</span>
                        </div>
                        <div class="legend-item" onclick="selectComp('ciliary-membrane')">
                            <div class="legend-color" style="background: #A0AEC0;"></div>
                            <span>Ciliary Membrane</span>
                        </div>
                        <div class="legend-item" onclick="selectComp('cell-body')">
                            <div class="legend-color" style="background: #E9EDF2;"></div>
                            <span>Cell Body</span>
                        </div>
                        <div class="legend-item" onclick="selectComp('nucleus')">
                            <div class="legend-color" style="background: #C8D0DD;"></div>
                            <span>Nucleus</span>
                        </div>
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

    /**
     * Generates and injects the cilium SVG.
     */
    function generateAndInjectSVG() {
        const svgContainer = document.getElementById('cilia-svg');
        if (!svgContainer) return;

        const svgHTML = `
        <svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto;">
            <defs>
                <linearGradient id="cytosolGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#F5F7FA;" />
                    <stop offset="100%" style="stop-color:#E9EDF2;" />
                </linearGradient>
                <radialGradient id="nucleusGradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" style="stop-color:#D8DEE9;" />
                    <stop offset="100%" style="stop-color:#C8D0DD;" />
                </radialGradient>
            </defs>

            <path id="cell-body" class="cilia-part"
                  fill="url(#cytosolGradient)" stroke="#D8DEE9" stroke-width="2"
                  d="M 50,380 C -20,300 20,200 150,200 C 280,200 320,300 250,380 Z"/>

            <circle id="nucleus" class="cilia-part"
                    fill="url(#nucleusGradient)" stroke="#B0B8C8" stroke-width="2"
                    cx="150" cy="320" r="40"/>

            <rect id="basal-body" class="cilia-part" 
                  fill="#4A5568" x="140" y="195" width="20" height="15"/>

            <path id="transition-zone" class="cilia-part"
                  fill="#718096" stroke="#4A5568" stroke-width="2"
                  d="M 142,195 L 138,180 L 162,180 L 158,195 Z"/>

            <path id="ciliary-membrane" class="cilia-part"
                  fill="none" stroke="#A0AEC0" stroke-width="2" stroke-dasharray="4,4"
                  d="M 138,180 L 145,10 L 155,10 L 162,180 Z"/>

            <path id="axoneme" class="cilia-part"
                  fill="none" stroke="#4A5568" stroke-width="3"
                  d="M 145,180 L 148,15 L 152,15 L 155,180 Z"/>
        </svg>`;

        svgContainer.innerHTML = svgHTML;
        setupSVGInteraction();
    }

    /**
     * Wires up the SVG elements to the `selectComp` function.
     */
    function setupSVGInteraction() {
        ['axoneme', 'transition-zone', 'basal-body', 'ciliary-membrane', 'cell-body', 'nucleus'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                // This calls the global window.selectComp wrapper
                el.onclick = () => selectComp(id);
            }
        });
    }

    /**
     * Sets up global event listeners for the page (event delegation).
     */
    function setupPageEventListeners() {
        document.body.addEventListener('click', e => {
            const chatInput = document.getElementById('chatInput');

            // Feedback buttons (reaction buttons)
            const feedbackBtn = e.target.closest('.ciliai-reaction-btn');
            if (feedbackBtn) {
                const type = feedbackBtn.textContent.includes('👍') ? 'up' : 'down';
                react(type); // Calls window.react
                return;
            }

            // Gene badges in bottom bar
            const geneBadge = e.target.closest('.gene-badge');
            if (geneBadge) {
                const gene = geneBadge.textContent.trim();
                if (gene) searchGene(gene); // Calls window.searchGene
                return;
            }

            // AI Action Links (for plot switching, etc.)
            const aiAction = e.target.closest('.ai-action');
            if (aiAction) {
                e.preventDefault();
                const action = aiAction.dataset.action;
                const genes = aiAction.dataset.genes || "";
                let query = "";
                if (action === 'show-li-heatmap') {
                    query = `show li phylogeny for ${genes}`;
                } else if (action === 'show-nevers-heatmap') {
                    query = `show nevers phylogeny for ${genes}`;
                } else if (action === 'show-table-view') {
                    query = `show data table for ${genes}`;
                }
                if (query) {
                    addChatMessage(query, true);
                    handleAIQuery(query); // Calls the brain directly
                }
                return;
            }
        });

        // --- Wire up static buttons and inputs ---
        
        // Note: The HTML already has onclick attributes, but this
        // is a more robust way to handle it. We'll wire up the 'Enter' key.
        const geneSearchInput = document.getElementById('geneSearch');
        if (geneSearchInput) geneSearchInput.addEventListener('keyup', e => {
            if (e.key === 'Enter') searchGene(); // Calls window.searchGene
        });

        const chatInput = document.getElementById('chatInput');
        if (chatInput) chatInput.addEventListener('keyup', e => {
            if (e.key === 'Enter') sendMsg(); // Calls window.sendMsg
        });

        console.log("CiliAI: Page event listeners set up.");
    }


    // ==========================================================
    // 4. CILIBRAIN v4.0 - QUERY & PLOTTING ENGINE
    // ==========================================================

    // --- 4A. Core Helper Functions ---

    /**
     * Simple logger
     */
    function log(message) {
        console.log(`[CiliAI] ${message}`);
    }

    /**
     * Normalizes a term for keyword matching
     */
    function normalizeTerm(term) {
        if (typeof term !== 'string') return '';
        return term.toLowerCase().replace(/[\s\-\_]/g, '');
    }

    /**
     * Extracts all valid gene symbols from a query string
     */
    function extractMultipleGenes(query) {
        if (!query) return [];
        const geneRegex = /\b([A-Z0-9\-\.]{3,})\b/gi;
        const matches = query.match(geneRegex) || [];
        const upperMatches = matches.map(g => g.toUpperCase());

        // Filter against the master gene map
        const geneMap = window.CiliAI.lookups.geneMap;
        if (!geneMap) return [];

        return upperMatches.filter(g => geneMap[g]);
    }
    
    /**
     * Creates a standard HTML list for the chat window.
     */
    function formatListResult(title, genes, description = "") {
        let geneListHtml = '';

        if (genes && genes.length > 0) {
            geneListHtml = genes.map(g =>
                `<li><strong>${g.gene}</strong>: ${g.description || 'No details available.'}</li>`
            ).join('');
            geneListHtml = `<ul>${geneListHtml}</ul>`;
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

    /**
     * Adds a message to the chat window.
     */
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
     * Handles the user sending a message.
     */
    function handleUserSend() {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput) return;
        const query = chatInput.value.trim();
        if (!query) return;

        addChatMessage(query, true); // Add user's message
        chatInput.value = ''; // Clear input

        // Process the query
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
     * Finds a gene and highlights it.
     */
    function handleGeneSearch(geneSymbol, queryAI = true) {
        const gene = geneSymbol.trim().toUpperCase();
        if (!gene) return;

        if (!window.CiliAI || !window.CiliAI.ready || !window.CiliAI.lookups || !window.CiliAI.lookups.geneMap) {
            console.warn("CiliAI data is not ready for gene search.");
            return;
        }

        const geneData = window.CiliAI.lookups.geneMap[gene];

        if (!geneData) {
            // clearAllHighlights(); // This function isn't defined, let's skip it
            addChatMessage(`Gene Not Found: ${gene}. This gene is not in the CiliAI database.`, false);
            return;
        }

        // Find localization
        let loc = 'unknown';
        let locString = 'Unknown';
        if (geneData.localization) {
            const locArray = ensureArray(geneData.localization);
            locString = locArray.join(', ');
            const locLower = locString.toLowerCase();

            if (locLower.includes('transition zone')) loc = 'transition-zone';
            else if (locLower.includes('axoneme')) loc = 'axoneme';
            else if (locLower.includes('basal body')) loc = 'basal-body';
            else if (locLower.includes('membrane')) loc = 'ciliary-membrane';
            else if (locLower.includes('nucleus')) loc = 'nucleus';
            else if (locLower.includes('mitochondrion')) loc = 'mitochondria';
            else if (locLower.includes('golgi')) loc = 'golgi-apparatus';
            else if (locLower.includes('cytoplasm')) loc = 'cell-body';
        }

        // Highlight and show info
        // clearAllHighlights();
        document.querySelectorAll('.cilia-part').forEach(el => el.classList.remove('active', 'selected'));
        if (loc !== 'unknown' && document.getElementById(loc)) {
            document.getElementById(loc).classList.add('active');
        }
        
        // Also ask the AI about it if triggered by user
        if (queryAI) {
            // addChatMessage(`Tell me about ${gene}`, true); // This is handled by window.searchGene
            handleAIQuery(`Tell me about ${gene}`);
        }
    }

    // --- 4B. Specific Data Handlers ---

    /**
     * Handles queries for screen data.
     */
    function handleScreenQuery(geneSymbol) {
        const gene = geneSymbol.toUpperCase();
        const g = window.CiliAI.lookups.geneMap[gene];
        if (!g) return `Sorry, I could not find data for "${gene}".`;

        let html = `<h4>Screen Results for <strong>${gene}</strong></h4>`;

        if (g.percent_ciliated_cells_effects && g.percent_ciliated_cells_effects !== "Not Reported") {
            html += `<p><strong>Percent Ciliated Cells Effect:</strong> ${g.percent_ciliated_cells_effects}</p>`;
        }
        if (g.lof_effects && g.lof_effects !== "Not Reported") {
            html += `<p><strong>Loss-of-Function Effect:</strong> ${g.lof_effects}</p>`;
        }
        if (g.overexpression_effects && g.overexpression_effects !== "Not Reported") {
            html += `<p><strong>Overexpression Effect:</strong> ${g.overexpression_effects}</p>`;
        }

        if (g.screens && g.screens.length > 0) {
            html += '<strong>All Screen Data:</strong><ul>';
            g.screens.forEach(s => {
                html += `<li>[${s.dataset || 'Unknown'}] <strong>${s.classification}</strong> (Z-score: ${s.z_score || 'N/A'})</li>`;
            });
            html += '</ul>';
        } else {
            html += '<p>No specific screen data found in the database.</p>';
        }
        return html;
    }

    /**
     * Handles queries for domain data (for one or more genes).
     */
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

            if (g.pfam_ids && g.pfam_ids.length > 0) {
                html += '<p><strong>PFAM Domains:</strong></p><ul>';
                g.pfam_ids.forEach((id, index) => {
                    const desc = g.domain_descriptions[index] || 'No description';
                    html += `<li><strong>${id}:</strong> ${desc}</li>`;
                });
                html += '</ul>';
            } else {
                html += '<p>No PFAM domain data found for this gene.</p>';
            }
        });
        return html;
    }

   /**
     * (NEW) Handles the first step of a complex/module query.
     * Returns a summary string and stores the gene list in context.
     */
    function handleComplexQuery(term) {
        const geneList = getGenesByComplex(term); // Get the full, fixed list
        const count = geneList.length;

        if (count === 0) {
            return `Sorry, I could not find any genes for the complex "${term}".`;
        }

        // Store the context for a "yes" follow-up
        lastQueryContext = {
            type: 'localization_list', // We can reuse the same follow-up type
            data: geneList, 
            term: term
        };

        // Return the summary string
        return `I found ${count} genes in the ${term} complex. Do you want to view the list?`;
    }

    /**
     * Handles queries for ortholog data.
     */
    function handleOrthologQuery(geneSymbol, organism) {
        const gene = geneSymbol.toUpperCase();
        const g = window.CiliAI.lookups.geneMap[gene];
        if (!g) return `Sorry, I could not find data for "${gene}".`;

        const orgKey = `ortholog_${organism.toLowerCase().replace(/[\.\s]/g, '_')}`;

        if (g[orgKey] && g[orgKey] !== 'N/A') {
            return formatListResult(`Ortholog for ${gene} in ${organism}`, [{
                gene: gene,
                description: `${organism} Ortholog: <strong>${g[orgKey]}</strong>`
            }]);
        } else {
            return `Sorry, I could not find a ${organism} ortholog for <strong>${gene}</strong>.`;
        }
    }

    /**
     * Handles all UMAP plotting requests and draws to the left panel.
     */
    /**
     * Handles all UMAP plotting requests and draws to the left panel.
     * (FIXED: Uses umapByGene lookup map)
     */
    function handleUmapPlot(highlightGene = null) {
        const plotDivId = 'cilia-svg'; // Draw on the left panel
        const umapData = window.CiliAI.data.umap;
        const umapLookup = window.CiliAI.lookups.umapByGene; // <-- FIX: Use the lookup

        if (!umapData || umapData.length === 0) {
            document.getElementById(plotDivId).innerHTML = '<p style="padding: 20px;">UMAP data not loaded.</p>';
            return;
        }

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
        const highlightedPoint = geneUpper ? umapLookup[geneUpper] : null; // <-- FIX: Check the lookup

        // Iterate the raw data for the background
        umapData.forEach(d => {
            // Check if this point is the one we're highlighting
            if (highlightedPoint && d.gene === highlightedPoint.gene) {
                // Skip, it will be added in the highlight trace
            } else {
                backgroundTrace.x.push(d.x);
                backgroundTrace.y.push(d.y);
                backgroundTrace.text.push(`<b>${d.gene}</b><br>${d.cluster}`);
            }
        });

        const plotData = [backgroundTrace];

        if (highlightedPoint) { // <-- FIX: Check if the lookup was successful
            highlightTrace.x.push(highlightedPoint.x);
            highlightTrace.y.push(highlightedPoint.y);
            highlightTrace.text.push(`<b>${highlightedPoint.gene}</b><br>${highlightedPoint.cluster}`);
            
            plotData.push(highlightTrace);
            title = `UMAP: ${highlightedPoint.gene}`; // Use the cased name from data
        } else if (highlightGene) { // Gene was requested but not in the lookup
            addChatMessage(`Sorry, I could not find <strong>${highlightGene}</strong> in the UMAP data. Displaying all genes.`, false);
        }

        const layout = {
            title: title,
            xaxis: { title: 'UMAP 1', zeroline: false, showticklabels: false },
            yaxis: { title: 'UMAP 2', zeroline: false, showticklabels: false },
            showlegend: false,
            hovermode: 'closest',
            margin: { t: 40, b: 40, l: 40, r: 20 }
        };

        Plotly.newPlot(plotDivId, plotData, layout, { responsive: true });
    }
    // --- 4C. Phylogeny Engine ---

    /**
     * [HELPER] Gets conservation data from Li et al. 2014.
     */
    function getLiConservation(geneSymbol) {
        const geneUpper = geneSymbol.toUpperCase();

        if (!window.liPhylogenyCache || !window.liPhylogenyCache.genes) {
            return `<div class="result-card"><h3>${geneSymbol} (Li et al. 2014)</h3><p class="status-not-found">Could not load the Li et al. 2014 dataset.</p></div>`;
        }

        const geneEntry = Object.values(window.liPhylogenyCache.genes).find(g => g.g.toUpperCase() === geneUpper);

        if (!geneEntry) {
            return `<div class="result-card"><h3>${geneSymbol} (Li et al. 2014)</h3><p class="status-not-found">Gene not found in the Li et al. 2014 dataset.</p></div>`;
        }

        return formatLiGeneData(geneSymbol, geneEntry, window.liPhylogenyCache.summary);
    }

    /**
     * [HELPER] Formats the output for the Li et al. 2014 data
     */
    function formatLiGeneData(geneSymbol, geneData, summary) {
        const organismsList = summary.organisms_list;
        const classList = summary.class_list;

        const species = geneData.s.map(index => organismsList[index]).join(', ');
        const category = (classList[geneData.c] || "Unknown").replace(/_/g, ' ');

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

    /**
     * [HELPER] Renders the phylogenetic heatmap based on Nevers et al. 2017 data.
     */
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

    /**
     * [HELPER] Renders the Li et al. 2014 heatmap.
     */
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
                return; // Skip this gene
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
                geneLabels.push(geneUpper); // Add label only if data was added
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

    /**
     * [HELPER] Renders raw phylogenetic data for a list of genes into a detailed table.
     */
    function renderPhylogenyTable(genes) {
        if (!window.liPhylogenyCache || !window.neversPhylogenyCache) {
            return `<div class="result-card"><h3>Table Error</h3><p>Phylogenetic data is not fully loaded.</p></div>`;
        }

        const tableRows = genes.map(gene => {
            const geneUpper = gene.toUpperCase();

            const liEntry = Object.values(window.liPhylogenyCache.genes).find(g => g.g && g.g.toUpperCase() === geneUpper);
            const liClass = liEntry
                ? window.liPhylogenyCache.summary.class_list[liEntry.c].replace(/_/g, ' ')
                : 'N/A';
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
            <div class="result-card">
                <h3>Phylogenetic Data Table for ${genes.join(', ')}</h3>
                <table class="ciliopathy-table gene-detail-table" id="phylogeny-table" style="width: 100%; border-collapse: collapse; font-size: 11px;">
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

    /**
     * [HELPER] Retrieves lists of genes based on Li et al. (2014) phylogenetic classification.
     */
    function getPhylogenyList(classification) {
        if (!window.liPhylogenyCache || !window.liPhylogenyCache.summary || !window.liPhylogenyCache.genes) {
            return `<div class="result-card"><h3>List Error</h3><p>Phylogenetic classification data is currently unavailable.</p></div>`;
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
            return `<div class="result-card"><h3>List Error</h3><p class="status-not-found">Classification keyword not recognized for list generation: ${classification}.</p></div>`;
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
            return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No genes found matching this classification.</p></div>`;
        }

        let resultHtml = formatListResult(title, filteredGenes);

        if (fallbackHtml) {
            resultHtml = resultHtml.replace(/<\/div>$/, `${fallbackHtml}</div>`);
        }

        return resultHtml;
    }

    /**
     * [HELPER] Finds the intersection of species lists between two genes.
     */
    function compareGeneSpeciesOverlap(geneA, geneB) {
        if (!window.liPhylogenyCache) {
            return `<div class="result-card"><h3>Comparison Failed</h3><p class="status-not-found">Li et al. 2014 dataset not loaded.</p></div>`;
        }

        const dataA = Object.values(window.liPhylogenyCache.genes).find(k => k.g.toUpperCase() === geneA.toUpperCase());
        const dataB = Object.values(window.liPhylogenyCache.genes).find(k => k.g.toUpperCase() === geneB.toUpperCase());

        if (!dataA || !dataB) {
            return `<div class="result-card"><h3>Comparison Failed</h3><p class="status-not-found">One or both genes (${geneA}, ${geneB}) were not found in the Li et al. 2014 dataset.</p></div>`;
        }

        const speciesList = window.liPhylogenyCache.summary.organisms_list;
        const speciesAIndices = new Set(dataA.s || []);
        const speciesBIndices = new Set(dataB.s || []);

        const overlapIndices = [...speciesAIndices].filter(index => speciesBIndices.has(index));

        const overlappingSpecies = overlapIndices.map(index => speciesList[index]).join(', ');

        return `
            <div class="result-card">
                <h3>Shared Conservation: ${geneA} and ${geneB}</h3>
                <p><strong>Total Shared Species:</strong> ${overlapIndices.length}</p>
                <p><strong>Overlapping Species List:</strong> ${overlappingSpecies || 'None found.'}</p>
            </div>
        `;
    }

    /**
     * [CONTROLLER] Main router for all phylogenetic analysis.
     */
    function routePhylogenyAnalysis(query) {
        const genes = extractMultipleGenes(query);
        const qLower = query.toLowerCase();

        // 1. COMPLEX LIST INTENT
        if (qLower.includes('list') || qLower.includes('show ciliary genes') || qLower.includes('which genes are') || qLower.includes('find genes with') || qLower.includes('every ciliary gene')) {
            if (qLower.includes('vertebrate')) return getPhylogenyList('Vertebrate_specific');
            if (qLower.includes('mammalian') || qLower.includes('recently evolved')) return getPhylogenyList('Mammalian_specific');
            if (qLower.includes('ciliary specific') || qLower.includes('ciliary genes') || qLower.includes('every ciliary gene')) return getPhylogenyList('Ciliary_specific');
            if (qLower.includes('absent in fungi') || qLower.includes('not in fungi')) return getPhylogenyList('absent_in_fungi');
            if (qLower.includes('all organisms') || qLower.includes('universally conserved') || qLower.includes('broadest conservation spectrum')) return getPhylogenyList('in_all_organisms');
        }

        // 2. SPECIES OVERLAP QUERY
        if (genes.length === 2 && (qLower.includes('share') || qLower.includes('both') || qLower.includes('overlap'))) {
            return compareGeneSpeciesOverlap(genes[0], genes[1]);
        }

        // 3. TABLE VIEW INTENT
        if (qLower.includes('table') || qLower.includes('view data') || qLower.includes('species count')) {
            if (genes.length >= 1) {
                return renderPhylogenyTable(genes);
            }
        }

        // 4. VISUALIZATION INTENT (Default)
        const isPhylogenyMandate = qLower.includes('evolution') || qLower.includes('taxa') || qLower.includes('phylogenetic') || qLower.includes('heatmap') || qLower.includes('conservation');

        if (genes.length >= 1 || isPhylogenyMandate) {
            const source = qLower.includes('nevers') ? 'nevers' : 'li';
            const finalGenes = genes.length >= 1 ? genes : ["IFT88", "BBS1", "CEP290"]; // Default

            const plotResult = handlePhylogenyVisualizationQuery(finalGenes, source, 'heatmap');

            // Return the HTML links (if any) to the chat window
            return `<div class="result-card">
                        <p>Displaying ${source.toUpperCase()} phylogenetic heatmap for <strong>${finalGenes.join(', ')}</strong> on the left panel.</p>
                        ${plotResult.htmlLinks || ''}
                    </div>`;
        }
        return null;
    }

    /**
     * [CONTROLLER] Plots phylogenetic heatmaps to the left panel ('cilia-svg').
     */
    function handlePhylogenyVisualizationQuery(genes, source = 'li', type = 'heatmap') {
        const plotId = 'cilia-svg'; // <-- Draw to the left panel
        const plotDiv = document.getElementById(plotId);

        if (!plotDiv) {
            console.error("Phylogeny Error: plot container 'cilia-svg' not found.");
            return { htmlLinks: "" }; // Return empty links
        }

        log(`Plotting ${source} heatmap for ${genes.join(', ')} to ${plotId}`);
        plotDiv.innerHTML = `<div style="padding: 40px; text-align: center;">Loading ${source.toUpperCase()} phylogeny plot for ${genes.join(', ')}...</div>`;

        try {
            let plotResult;

            if (type === 'table') {
                plotDiv.innerHTML = `<div style="padding: 20px;">Table view is not available in this panel. Please ask in the chat.</div>`;
                return { htmlLinks: "" };
            }

            if (source === 'nevers') {
                plotResult = renderNeversPhylogenyHeatmap(genes);
            } else {
                plotResult = renderLiPhylogenyHeatmap(genes);
            }

            if (!plotResult || !plotResult.plotData) {
                throw new Error(plotResult.html || 'The plot renderer returned no data.');
            }

            Plotly.newPlot(plotId, plotResult.plotData, plotResult.plotLayout, { responsive: true });

            return { htmlLinks: plotResult.htmlLinks || "" };

        } catch (e) {
            console.error("handlePhylogenyVisualizationQuery Error:", e);
            plotDiv.innerHTML = `<p style="padding: 20px;"><strong>Error generating plot:</strong> ${e.message}</p>`;
            addChatMessage(`<strong>Error generating plot:</strong> ${e.message}`, false);
            return { htmlLinks: "" };
        }
    }


    // --- 4D. Data Getter Helpers ---
/**
     * Fetches and formats a comprehensive summary for a single gene.
     * (FIXED: Filters numeric complex keys)
     */
    async function getComprehensiveDetails(term) {
        const gene = term.trim().toUpperCase();
        const g = window.CiliAI.lookups.geneMap[gene];

        if (!g) {
            return `Sorry, I could not find any data for "<strong>${gene}</strong>".`;
        }

        let html = `<h4>Details for <strong>${g.gene}</strong></h4>`;
        html += `<p>${g.description || g.functional_summary || 'No description available.'}</p>`;
        html += '<ul>';

        if (g.localization) {
            html += `<li><strong>Localization:</strong> ${ensureArray(g.localization).join(', ')}</li>`;
        }
        if (g.ciliopathy && g.ciliopathy.length > 0) {
            html += `<li><strong>Ciliopathy:</strong> ${g.ciliopathy.join(', ')}</li>`;
        }
        
        // FIX: Filter out numeric keys
        const complexes = Object.keys(g.complex_components || {})
                              .filter(name => isNaN(parseInt(name)));
        if (complexes.length > 0) {
            html += `<li><strong>Complexes:</strong> ${complexes.join(', ')}</li>`;
        }

        if (g.pfam_ids && g.pfam_ids.length > 0) {
            html += `<li><strong>Domains:</strong> ${g.pfam_ids.join(', ')}</li>`;
        }
        const orthologs = [
            g.ortholog_c_elegans ? `<em>C. elegans</em> (${g.ortholog_c_elegans})` : null,
            g.ortholog_mouse ? `Mouse (${g.ortholog_mouse})` : null,
            g.ortholog_zebrafish ? `Zebrafish (${g.ortholog_zebrafish})` : null
        ].filter(Boolean).join(', ');
        if (orthologs) {
            html += `<li><strong>Orthologs:</strong> ${orthologs}</li>`;
        }
        html += `
            <li><strong>Phylogeny:</strong> 
                <a href="#" class="ai-action" data-action="show-li-heatmap" data-genes="${g.gene}">Show Conservation</a>
            </li>`;
        html += '</ul>';
        return html;
    }

    /**
     * Generic getter for ciliopathy
     * (FIXED: Fetches gene descriptions)
     */
    function getCiliopathyGenes(term) {
        const normTerm = term.toLowerCase();
        let key = normTerm;

        // Handle aliases
        if (normTerm === 'bbs') key = 'bardet–biedl syndrome';
        if (normTerm === 'mks') key = 'meckel–gruber syndrome';
        if (normTerm === 'joubert') key = 'joubert syndrome';
        if (normTerm === 'nphp') key = 'nephronophthisis';

        const geneSymbols = window.CiliAI.lookups.byCiliopathy[key] || [];
        const geneMap = window.CiliAI.lookups.geneMap; // Get geneMap
        
        let desc = ""; // Classification info not available, skip for now.

        return {
            genes: geneSymbols.map(g => { // 'g' is a gene SYMBOL
                const geneData = geneMap[g];
                return {
                    gene: g,
                    // FETCH THE DESCRIPTION
                    description: geneData?.description || 'No description available.'
                };
            }),
            description: desc
        };
    }

    /**
     * Generic getter for localization
     * (FIXED: Iterates all keys instead of .find() to get complete lists)
     * (FIXED: Fetches descriptions, adds "ciliary tip" alias)
     */
    function getGenesByLocalization(term) {
        let normTerm = term.toLowerCase();
        const L = window.CiliAI.lookups;
        const geneMap = L.geneMap;
        let matchingGenes = new Set(); // Use a Set to avoid duplicates

        if (normTerm.includes('ciliary tip')) {
            normTerm = 'ciliary tip'; // Be specific to match the new key
        }
        if (normTerm === 'cilia') {
             normTerm = 'cilia'; // Matches 'cilia', 'ciliary', etc.
        }
        
        // --- THIS IS THE FIX ---
        // Simplified logic: just check if the key *includes* the term.
        // This will now find "Mitochondria" when the user asks for "mitochondria"
        // and it will find "basal body" from the cleaned ABCB6 data.
        const allLocKeys = Object.keys(L.byLocalization);
        allLocKeys.forEach(key => {
            if (key.toLowerCase().includes(normTerm)) {
                L.byLocalization[key].forEach(geneSymbol => {
                    matchingGenes.add(geneSymbol);
                });
            }
        });
        // --- END FIX ---

        // Convert the Set back to an array of objects
        return Array.from(matchingGenes).map(gene => {
            const geneData = geneMap[gene];
            return {
                gene: gene,
                // Use the full localization string from the gene data for the description
                description: geneData?.localization || `Found in ${term}`
            };
        });
    }
    
   /**
    /**
     * Simple keyword spotter
     * (FIXED: Added 'lysosome' and 'flagella' to the keywords list)
     */
    function flexibleIntentParser(query) {
        const qLower = query.toLowerCase().trim();
        const entityKeywords = [
            {
                type: 'COMPLEX',
                keywords: [
                    'BBSome', 'IFT-A', 'IFT-B', 'IFT COMPLEX', 'MKS MODULE', 'NPHP MODULE', 
                    'IFT MOTOR', 'EXOCYST', 'DYNEIN ARM', 'RADIAL SPOKE', 'CENTRAL PAIR',
                    'CILIARY ROOTLET', 'CPLANE COMPLEX', 'SEPTIN RING', 'DYNEIN ASSEMBLY FACTORS',
                    'CILIOGENESIS REGULATORS', 'PCP CORE'
                ],
                handler: (term) => handleComplexQuery(term) // Point to the new UX handler
            },
            {
                type: 'LOCALIZATION',
                keywords: [
                    'basal body', 'axoneme', 'transition zone', 'centrosome', 
                    'cilium', 'cilia', 'mitochondria', 'nucleus', 'ciliary tip',
                    'lysosome', 'lysosomes', 'flagella' // <-- FIX IS HERE
                ],
                handler: (term) => handleLocalizationQuery(term) // This is already correct
            },
            {
                type: 'CILIOPATHY',
                keywords: ['Joubert Syndrome', 'BBS', 'Bardet–Biedl Syndrome', 'NPHP', 'Nephronophthisis', 'MKS', 'Meckel–Gruber Syndrome'],
                handler: (term) => formatListResult(`Genes for ${term}`, (getCiliopathyGenes(term)).genes)
            },
            {
                type: 'DOMAIN',
                keywords: ['WD40', 'coiled-coil', 'pfam', 'domain', 'ef-hand'],
                handler: (term) => getGenesByDomain(term)
            }
        ];

        const normalizedQuery = normalizeTerm(query);
        for (const entityType of entityKeywords) {
            // Sort keywords by length, longest first, to match "IFT-A COMPLEX" before "IFT-A"
            const sortedKeywords = [...entityType.keywords].sort((a, b) => b.length - a.length);
            for (const keyword of sortedKeywords) {
                const keywordRegex = new RegExp(normalizeTerm(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                // Use .includes() for partial matching (e.g., "genes in the bbsome")
                if (normalizedQuery.includes(normalizeTerm(keyword))) { 
                    if (qLower.includes('not in') || qLower.includes('except')) continue;
                    return { type: entityType.type, entity: keyword, handler: entityType.handler };
                }
            }
        }
        return null;
    }


    /* ==============================================================
 * 5. Complex Map (required for BBSome etc.)
 * ============================================================== */
function getComplexPhylogenyTableMap() {
    return {
        // --- IFT & MOTORS ---
        "IFT COMPLEX": ["WDR19","IFT140","TTC21B","IFT122","WDR35","IFT43","IFT172","IFT80","IFT57","TRAF3IP1","CLUAP1","IFT20","IFT88","IFT81","IFT74","IFT70A","IFT70B","IFT56","IFT52","IFT46","IFT27","IFT25","IFT22"],
        "IFT-A COMPLEX": ["WDR19","IFT140","TTC21B","IFT122","WDR35","IFT43"],
        "IFT-B COMPLEX": ["IFT172","IFT80","IFT57","TRAF3IP1","CLUAP1","IFT20","IFT88","IFT81","IFT74","IFT70A","IFT70B","IFT56","IFT52","IFT46","IFT27","IFT25","IFT22"],
        "IFT-B1 COMPLEX": ["IFT172","IFT80","IFT57","TRAF3IP1","CLUAP1","IFT20"],
        "IFT-B2 COMPLEX": ["IFT88","IFT81","IFT74","IFT70A","IFT70B","IFT56","IFT52","IFT46","IFT27","IFT25","IFT22"],
        "IFT MOTOR COMPLEX": ["KIF3A","KIF3B","KIF17","DYNC2H1","DYNC2LI1","WDR34","WDR60"],

        // --- CORE CILIOPATHY COMPLEXES ---
        "BBSOME": ["BBS1","BBS2","BBS4","BBS5","BBS7","TTC8","BBS9","BBIP1"],
        "TRANSITION ZONE": ["NPHP1","MKS1","CEP290","AHI1","RPGRIP1L","TMEM67","CC2D2A","B9D1","B9D2"],
        "MKS MODULE": ["MKS1","TMEM17","TMEM67","TMEM138","B9D2","B9D1","CC2D2A","TMEM107","TMEM237","TMEM231","TMEM216","TCTN1","TCTN2","TCTN3"],
        "NPHP MODULE": ["NPHP1","NPHP3","NPHP4","RPGRIP1L","IQCB1","CEP290","SDCCAG8"],

        // --- STRUCTURAL & AXONEMAL ---
        "BASAL BODY": ["CEP164","CEP83","SCLT1","CEP89","LRRC45","ODF2","CEP128","CEP135","CETN2","CETN3","POC1B","FBF1","CCDC41","CCDC120","OFD1"],
        "CENTROSOME": ["CEP152","CEP192","PLK4","STIL","SAS6","CEP135","CETN2","PCNT"],
        "CILIARY TIP": ["HYDIN","IQCA1","CATSPER2","KIF19A","KIF7","CCDC78","CCDC33","SPEF1","CEP104","CSPP1"],
        "RADIAL SPOKE": ["RSPH1","RSPH3","RSPH4A","RSPH6A","RSPH9","RSPH10B","RSPH23","RSPH16"],
        "CENTRAL PAIR": ["HYDIN","SPAG6","SPAG16","SPAG17","POC1A","CEP131"],
        "DYNEIN ARM": ["DNAH1","DNAH2","DNAH5","DNAH6","DNAH7","DNAH8","DNAH9","DNAH10","DNAH11","DNALI1","DNAI1","DNAI2"],
        "OUTER DYNEIN ARM": ["DNAH5","DNAH11","DNAH17","DNAI1","DNAI2"],
        "INNER DYNEIN ARM": ["DNAH2","DNAH7","DNAH10","DNALI1"],

        // --- OTHER SIGNALING & MEMBRANE ---
        "EXOCYST": ["EXOC1","EXOC2","EXOC3","EXOC4","EXOC5","EXOC6","EXOC7","EXOC8"],
        "SHH SIGNALING": ["SMO","PTCH1","GLI1","GLI2","GLI3","SUFU","KIF7","TULP3"],
        
        // --- NEW ADDITIONS (STRUCTURAL) ---
        "CILIARY ROOTLET": ["ROOTLET1", "CROCC"],
        "CPLANE COMPLEX": ["INTU", "FUZ", "WDPCP"],
        "SEPTIN RING": ["SEPTIN2", "SEPTIN7", "SEPTIN9", "SEPTIN11"],
        
        // --- NEW ADDITIONS (MOTILE CILIA / PCD) ---
        "DYNEIN ASSEMBLY FACTORS": ["DNAAF1", "DNAAF2", "DNAAF3", "DNAAF4", "DNAAF5", "DNAAF6", "DNAAF7", "DNAAF8", "DNAAF9", "DNAAF10", "DNAAF11", "LRRC6", "ZMYND10", "PIH1D3", "HEATR2"],

        // --- NEW ADDITIONS (REGULATORY & POLARITY) ---
        "CILIOGENESIS REGULATORS": ["FOXJ1", "RFX1", "RFX2", "RFX3", "RFX4", "RFX5"],
        "PCP CORE": ["VANGL1", "VANGL2", "DVL1", "DVL2", "DVL3", "PRICKLE1", "CELSR1", "FZD3", "FZD6"]
    };
}

    /**
     * (NEW/FIXED) Generic getter for complexes
     */
    function getGenesByComplex(term) {
        const normTerm = normalizeTerm(term);
        const L = window.CiliAI.lookups;
        const geneMap = L.geneMap;

        // Find the key in the new lookup (e.g., "BBSOME")
        const complexKey = Object.keys(L.byModuleOrComplex).find(key => normalizeTerm(key).includes(normTerm));
        
        if (complexKey) {
            const geneSymbols = L.byModuleOrComplex[complexKey];
            return geneSymbols.map(gene => ({
                gene: gene,
                description: geneMap[gene]?.description || `Component of ${complexKey}`
            }));
        }
        return [];
    }
    
    /**
     * (NEW) Generic getter for modules
     */
    function getGenesByModule(term) {
        const normTerm = term.toLowerCase();
        const L = window.CiliAI.lookups;
        const geneMap = L.geneMap;
        
        const modKey = Object.keys(L.byModules).find(key => key.toLowerCase().includes(normTerm));
        
        if (modKey && L.byModules[modKey]) {
            return L.byModules[modKey].map(gene => ({ 
                gene: gene, 
                description: geneMap[gene]?.description || `Part of ${modKey}`
            }));
        }
        return [];
    }
    
    /**
     * (NEW) Handler for scRNA queries
     */
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
            html += `<strong>${gene}:</strong> `;
            
            if (exp) {
                 const topTissues = Object.entries(exp)
                    .sort(([,a], [,b]) => b - a) // Sort by expression, descending
                    .slice(0, 3) // Get top 3
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
    /**
     * Generic getter for ciliopathy
     */
    function getCiliopathyGenes(term) {
        const normTerm = term.toLowerCase();
        let key = normTerm;

        // Handle aliases
        if (normTerm === 'bbs') key = 'bardet–biedl syndrome';
        if (normTerm === 'mks') key = 'meckel–gruber syndrome';
        if (normTerm === 'joubert') key = 'joubert syndrome';
        if (normTerm === 'nphp') key = 'nephronophthisis';

        const genes = window.CiliAI.lookups.byCiliopathy[key] || [];

        // Classification info isn't available in this context, skip for now.
        let desc = "";

        return {
            genes: genes.map(g => ({ gene: g })),
            description: desc
        };
    }

    /**
     * Generic getter for localization
     */
    function getGenesByLocalization(term) {
        const normTerm = term.toLowerCase();
        const L = window.CiliAI.lookups;

        // Find the matching key (e.g., "cilia" should match "Cilium")
        const locKey = Object.keys(L.byLocalization).find(key => key.toLowerCase().includes(normTerm));

        if (locKey && L.byLocalization[locKey]) {
            return L.byLocalization[locKey].map(gene => ({ gene: gene, description: `Found in ${locKey}` }));
        }
        return [];
    }
    
    /**
     * Handles queries for genes containing a specific domain.
     */
    function getGenesByDomain(domainTerm) {
        const normTerm = domainTerm.toLowerCase();
        const results = [];
        window.CiliAI.masterData.forEach(g => {
            if (!g.gene) return;
            const allDomains = [...(g.pfam_ids || []), ...(g.domain_descriptions || [])];
            const matchingDomain = allDomains.find(d => d.toLowerCase().includes(normTerm));
            if (matchingDomain) {
                results.push({ gene: g.gene, description: `Contains ${matchingDomain}` });
            }
        });
        return formatListResult(`Genes containing "${domainTerm}" domain`, results);
    }
    

    // --- 4E. Main "Brain" (Query Routers) ---

    /**
     * Simple keyword spotter (Synchronous)
     */
    function flexibleIntentParser(query) {
        const qLower = query.toLowerCase().trim();
        const entityKeywords = [
            // {
            //     type: 'COMPLEX',
            //     keywords: ['BBSome', 'IFT-A', 'IFT-B', 'Transition Zone', 'MKS Complex', 'NPHP Complex'],
            //     handler: (term) => `Sorry, getComplexPhylogenyTable is not defined.`
            // },
            {
                type: 'CILIOPATHY',
                keywords: ['Joubert Syndrome', 'BBS', 'Bardet–Biedl Syndrome', 'NPHP', 'Nephronophthisis', 'MKS', 'Meckel–Gruber Syndrome'],
                handler: (term) => formatListResult(`Genes for ${term}`, (getCiliopathyGenes(term)).genes)
            },
            {
                type: 'LOCALIZATION',
                keywords: ['basal body', 'axoneme', 'transition zone', 'centrosome', 'cilium', 'cilia', 'ciliary tip', 'mitochondria', 'nucleus'],
                handler: (term) => formatListResult(`Genes localizing to ${term}`, getGenesByLocalization(term))
            },
             {
                type: 'DOMAIN',
                keywords: ['WD40', 'coiled-coil', 'pfam', 'domain', 'ef-hand'],
                handler: (term) => getGenesByDomain(term)
            }
        ];

        const normalizedQuery = normalizeTerm(query);
        for (const entityType of entityKeywords) {
            const sortedKeywords = [...entityType.keywords].sort((a, b) => b.length - a.length);
            for (const keyword of sortedKeywords) {
                const keywordRegex = new RegExp(normalizeTerm(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                if (keywordRegex.test(normalizedQuery)) {
                    if (qLower.includes('not in') || qLower.includes('except')) continue;
                    return { type: entityType.type, entity: keyword, handler: entityType.handler };
                }
            }
        }
        return null;
    }

   /**
     * This is the main router that implements the Priority Waterfall.
     */
    async function handleAIQuery(query) {
        const chatWindow = document.getElementById('messages');
        if (!chatWindow) {
            console.warn('handleAIQuery called before UI elements were ready. Aborting.');
            return;
        }

        const qLower = query.toLowerCase().trim();
        if (!query) return;

        log(`Routing query: ${query}`);

        try {
            if (!window.CiliAI.ready) {
                addChatMessage("Data is still loading, please wait...", false);
                return;
            }

            let htmlResult = null; // <-- FIX: Initialize to null
            let match;

            // =( 1 )= INTENT: HIGH-PRIORITY "WHAT IS [GENE]?" ==============
            if (htmlResult === null && (match = qLower.match(/^(?:what is|what's|describe)\s+([A-Z0-9\-]{3,})\b/i))) {
                log('Routing via: Intent (High-Priority Get Details)');
                htmlResult = await getComprehensiveDetails(match[1].toUpperCase());
            }

            // =( 2 )= INTENT: ORTHOLOGS ===================================
            else if (htmlResult === null && (match = qLower.match(/ortholog(?: of| for)?\s+([a-z0-9\-]+)\s+(?:in|for)\s+(c\. elegans|mouse|zebrafish|drosophila|xenopus)/i))) {
                log('Routing via: Intent (Ortholog)');
                htmlResult = handleOrthologQuery(match[1].toUpperCase(), match[2]);
            }
            else if (htmlResult === null && (match = qLower.match(/(c\. elegans|mouse|zebrafish|drosophila|xenopus)\s+ortholog(?: of| for)?\s+([a-z0-9\-]+)/i))) {
                log('Routing via: Intent (Ortholog)');
                htmlResult = handleOrthologQuery(match[2].toUpperCase(), match[1]);
            }

            //=( 3 )= INTENT: COMPLEX / MODULE MEMBERS ======================
            else if (htmlResult === null && (match = qLower.match(/(?:complexes for|complexes of|complexes containing|complex components of)\s+([a-z0-9\-]+)/i))) {
                log('Routing via: Intent (Find Gene in Complex)');
                htmlResult = handleComplexQuery(match[1].toUpperCase());
            }

            //=( 4 )= INTENT: DOMAINS =======================================
            else if (htmlResult === null && (match = qLower.match(/(?:domains of|domain architecture for)\s+(.+)/i))) {
                log('Routing via: Intent (Domains)');
                const genes = extractMultipleGenes(match[1]);
                if (genes.length > 0) {
                    htmlResult = handleDomainQuery(genes);
                }
            }

            //=( 5 )= INTENT: SCREENS / PHENOTYPES ==========================
            else if (htmlResult === null && (match = qLower.match(/(?:screens for|screens where|effect of)\s+([a-z0-9\-]+)/i))) {
                log('Routing via: Intent (Screens)');
                htmlResult = handleScreenQuery(match[1].toUpperCase());
            }

            //=( 6 )= INTENT: PHYLOGENY / EVOLUTION (All queries) ==========
            else if (htmlResult === null && (
                qLower.includes('phylogen') || qLower.includes('evolution') || qLower.includes('conservation') ||
                qLower.includes('heatmap') || qLower.includes('taxa') || qLower.includes('vertebrate specific') ||
                qLower.includes('mammalian specific') || qLower.includes('ciliary specific') ||
                qLower.includes('table')
            )) {
                log('Routing via: Intent (Phylogeny Engine)');
                htmlResult = routePhylogenyAnalysis(query);
            }

            //=( 7 )= INTENT: FUNCTIONAL MODULES ========================
            else if (htmlResult === null && (match = qLower.match(/(?:functional modules of|modules for)\s+([a-z0-9\-]+)/i))) {
                log('Routing via: Intent (Get Modules)');
                const gene = match[1].toUpperCase();
                const g = window.CiliAI.lookups.geneMap[gene];
                if (g && g.functional_modules && g.functional_modules.length > 0) {
                    htmlResult = formatListResult(`Functional Modules for ${gene}`, g.functional_modules.map(m => ({ gene: m, description: "Module" })));
                } else {
                    htmlResult = `No functional modules listed for <strong>${gene}</strong>.`;
                }
            }

            //=( 8 )= INTENT: scRNA Expression ============================
            else if (htmlResult === null && (qLower.includes('scrna') || qLower.includes('expression in') || qLower.includes('compare expression'))) {
                log('Routing via: Intent (scRNA)');
                const genes = extractMultipleGenes(query);
                if (genes.length > 0) {
                    htmlResult = handleScRnaQuery(genes);
                } else {
                    htmlResult = `Please specify which gene(s) you want to check expression for.`;
                }
            }

            //=( 9 )= INTENT: UMAP (VISUAL) =================================
            else if (htmlResult === null && (match = qLower.match(/(?:show|plot)\s+(?:me\s+the\s+)?umap(?: expression)?(?: for\s+([a-z0-9\-]+))?/i))) {
                log('Routing via: Intent (UMAP Plot)');
                const gene = match[1] ? match[1].toUpperCase() : null;
                handleUmapPlot(gene); // Draws to left panel
                htmlResult = ""; // FIX: Signal that the query was handled visually
            }

            //=( 10 )= INTENT: SIMPLE KEYWORD LISTS ==========================
            if (htmlResult === null) { // <-- FIX: Check for null
                const intent = flexibleIntentParser(query);
                if (intent) {
                    log(`Routing via: Intent (Simple Keyword: ${intent.type})`);
                    htmlResult = intent.handler(intent.entity);
                }
            }

            //=( 11 )= INTENT: FALLBACK (GET DETAILS) ========================
            if (htmlResult === null) { // <-- FIX: Check for null
                log(`Routing via: Fallback (Get Details)`);
                let term = qLower;

                if ((match = qLower.match(/(?:what is|what does|describe|localization of|omim id for|where is|cellular location of|subcellular localization of)\s+(.+)/i))) {
                    term = match[1];
                }

                term = term.replace(/[?.]/g, '').replace(/\bdo\b/i, '').trim().toUpperCase();

                const genes = extractMultipleGenes(term);
                if (genes.length > 0) {
                    htmlResult = await getComprehensiveDetails(genes[0]);
                }
            }

            //=( 12 )= FINAL FALLBACK (ERROR) ================================
            if (htmlResult === null) { // <-- FIX: Check for null
                log(`Routing via: Final Fallback (Error)`);
                htmlResult = `Sorry, I didn't understand the query: "<strong>${query}</strong>". Please try a simpler term.`;
            }

            if (htmlResult) { // Only add a message if it's not ""
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

    /**
     * Handles activating any structure (from SVG or list)
     */
    window.selectComp = function (id) {
        document.querySelectorAll('.cilia-part').forEach(el => el.classList.remove('selected', 'active'));
        const el = document.getElementById(id);
        if (el) el.classList.add('selected');

        const data = structureInfoMap[id];
        if (!data) return;

        const genes = window.CiliAI.lookups.byLocalization[data.title] ||
            window.CiliAI.lookups.byLocalization[data.title.toLowerCase()] ||
            data.genes || []; // Fallback to static list

        const bar = document.getElementById('bottomBar');
        if (genes.length > 0) {
            bar.innerHTML = `<h3>${data.title} (${genes.length} genes)</h3>
            <div class="gene-list">${genes.slice(0, 40).map(g =>
                `<span class="gene-badge" data-gene="${g}">${g}</span>` // Removed onclick
            ).join('')}${genes.length > 40 ? `<span style="font-size:11px;color:#666;padding:5px;">...+${genes.length - 40} more</span>` : ''}</div>`;
        } else {
            bar.innerHTML = `<h3>${data.title}</h3><p style="color:#666;font-size:12px;">No genes found in database. Try searching directly.</p>`;
        }

        addChatMessage(`Selected <strong>${data.title}</strong>. Found ${genes.length} genes.`, false);
    }

    /**
     * Called by the "Find Gene" button
     */
    window.searchGene = function (name) {
        const query = name || document.getElementById('geneSearch').value.trim().toUpperCase();
        if (!query) return;
        addChatMessage(`Tell me about ${query}`, true); // Add user message
        handleGeneSearch(query, true); // Call the brain
    }

    /**
     * Called by "Show UMAP" button
     */
    window.showUMAP = function () {
        addChatMessage('Show UMAP', true);
        handleAIQuery('Plot UMAP');
    }

    /**
     * Called by "Send" button
     */
    window.sendMsg = function () {
        handleUserSend();
    }

    /**
     * Called by feedback buttons
     */
    window.react = function (type) {
        if (type === 'up') {
            addChatMessage('Thanks for the feedback! 🙏', false);
        } else {
            addChatMessage('Sorry about that. What specifically would help?', false);
        }
    }

    /**
     * Called by "New Chat" button (if added)
     */
    window.clearChat = function () {
        if (confirm('Start new conversation?')) {
            document.getElementById('messages').innerHTML = '';
            document.querySelectorAll('.cilia-part').forEach(el => el.classList.remove('selected', 'active'));
            addChatMessage('Welcome back! How can I help?', false);
        }
    }

    /**
     * Called by heatmap download buttons
     */
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
