/* ==============================================================
 * CiliAI – Interactive Explorer (v3.5 – Nov 13, 2025)
 * ==============================================================
 * • MERGED: Combines the v2.1 data engine (with buildLookups fix)
 * with the v3.5 interactive SVG layout.
 * • COMPOSITE SVG: Integrates the minimal gray cilium with the
 * actual <g> paths for organelles from Furkan.html.
 * • All text is in English.
 * ============================================================== */

(function () {
    'use strict';

    // --- 1. GLOBAL & HELPER ---

    // Global CiliAI object
    window.CiliAI = {
        data: {},
        lookups: {},
        ready: false,
        masterData: []
    };
    
    /**
     * Helper function to ensure a value is an array.
     * Moved to global scope to be shared by loadCiliAIData and buildLookups.
     */
    function ensureArray(value) {
        if (Array.isArray(value)) return value;
        if (value === null || value === undefined) return [];
        return [value];
    }

    // --- 2. DATA LOADING & PROCESSING (v2.1 - with fix) ---

    /**
     * Initializes the CiliAI module: loads data, builds lookups,
     * and then displays the page.
     */
    async function initCiliAI() {
        console.log('CiliAI: Initializing (v3.5)...');
        await loadCiliAIData();
        if (!Array.isArray(window.CiliAI.masterData)) {
            console.warn('masterData not array. Initializing empty.');
            window.CiliAI.masterData = [];
        }
        buildLookups();
        // setupEventListeners() is now called inside displayCiliAIPage()
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
     * *** INCLUDES THE FIX FOR THE TPYEERROR ***
     */
    function buildLookups() {
        const L = window.CiliAI.lookups = {};
        const master = Array.isArray(window.CiliAI.masterData) ? window.CiliAI.masterData : [];

        L.geneMap = {};
        master.forEach(g => {
            const sym = (g.gene || '').toUpperCase();
            if (sym) L.geneMap[sym] = g;
        });

        L.complexByGene = {};
        L.complexByName = {};
        master.forEach(g => {
            const key = g.gene?.toUpperCase();
            if (key && g.complex_components) {
                Object.keys(g.complex_components).forEach(name => {
                    if (!L.complexByGene[key]) L.complexByGene[key] = [];
                    if (!L.complexByGene[key].includes(name)) L.complexByGene[key].push(name);
                    
                    if (!L.complexByName[name]) L.complexByName[name] = [];
                    
                    // --- THIS IS THE FIX ---
                    // Use ensureArray() to prevent the .forEach error
                    ensureArray(g.complex_components[name]).forEach(gg => {
                        if (gg && !L.complexByName[name].includes(gg)) {
                            L.complexByName[name].push(gg);
                        }
                    });
                    // --- END FIX ---
                });
            }
        });

        L.byLocalization = {};
        L.byModules = {};
        L.byCiliopathy = {};
        master.forEach(g => {
            const key = g.gene?.toUpperCase();
            if (!key) return;
            if (g.localization) {
                // FIX: Use ensureArray on localization as well
                ensureArray(g.localization).forEach(loc => {
                    if (!L.byLocalization[loc]) L.byLocalization[loc] = [];
                    if (!L.byLocalization[loc].includes(key)) L.byLocalization[loc].push(key);
                });
            }
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

        console.log('CiliAI: Lookups built');
    }

    // --- 3. STATIC UI DATA ---

    // This data is for the UI, not from the gene map.
    // It's static info about the structures themselves.
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
        // Organelles (from Furkan.html)
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
         "cell-body": { // Added alias for click handler
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

 // --- 4. MAIN PAGE DISPLAY FUNCTION (v3.5) ---

    /**
     * This is the primary function CiliaHub will call to build the page.
     * It injects all HTML, CSS, and SVG content.
     */
    window.displayCiliAIPage = async function () {
        console.log("CiliAI: displayCiliAIPage() (v3.5) called.");
        const area = document.querySelector('.content-area');
        if (!area) {
            console.error('CiliAI: .content-area not found. Aborting.');
            return;
        }

        // Set page to full-width mode
        area.className = 'content-area content-area-full';
        const panel = document.querySelector('.cilia-panel');
        if (panel) panel.style.display = 'none';

        // 1. Inject HTML Structure
        area.innerHTML = getPageHTML();

        // 2. Inject CSS
        injectPageCSS();

        // 3. Generate and Inject the custom SVG
        generateAndInjectSVG();

        // 4. Setup all event listeners
        // This function MUST be called *after* getPageHTML()
        setupPageEventListeners(); 

        // 5. Add initial welcome message to chat
        setTimeout(() => {
            addChatMessage(`Hello! Ask me about any ciliary gene or click a structure to explore. Try: <em>"What is IFT88?"</em>`, false);
        }, 500);

        console.log("CiliAI: Page displayed and listeners attached.");
    };

    // --- 5. HTML & CSS INJECTION (v3.5) ---

    /**
     * Injects the page's CSS into the <head>.
     */
    function injectPageCSS() {
        const styleId = 'ciliai-dynamic-styles';
        if (document.getElementById(styleId)) return; // Already injected

        const css = `
            :root {
                --primary: #2c5aa0;
                --primary-dark: #1e4273;
                --bg: #f8fbfd;
                --card: #ffffff;
                --text: #1a1a1a;
                --text-light: #555;
                --border: #e1e5e9;
                /* Cilia Colors */
                --cilia-axoneme: #ff6b6b;
                --cilia-basal-body: #4ecdc4;
                --cilia-tz: #45b7d1;
                --cilia-membrane: #A0AEC0; /* Gray for dash */
                /* Organelle Colors (compatible) */
                --org-nucleus: #B0B8C8; /* Gray */
                --org-nucleolus: #4A5568; /* Dark Gray */
                --org-mitochondria: #4A5568; /* Dark Gray */
                --org-golgi: #4A5568; /* Dark Gray */
                --org-vesicle: #66b7ff; /* Blue */
                --org-lysosome: #718096; /* Gray */
                --org-peroxisome: #A0AEC0; /* Gray */
                --org-ribosome: #4A5568; /* Dark Gray */
                --org-cytoplasm: #F5F7FA; /* Lightest Gray */
                --org-pm: #E9EDF2; /* Light Gray */
                --org-microtubule: #4A5568; /* Dark Gray */
            }
            .ciliai-page {
                max-width: 1400px;
                margin: 0 auto;
                padding: 1.5rem;
                font-family: 'Inter', sans-serif;
                line-height: 1.6;
            }
            .ciliai-header { text-align: center; margin-bottom: 2.5rem; }
            .ciliai-header h1 { font-size: 2.8rem; color: var(--primary); font-weight: 700; }
            .ciliai-header p { color: var(--text-light); font-size: 1.15rem; margin-top: 0.5rem; }
            .ciliai-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 3rem; }
            @media (max-width: 992px) { .ciliai-grid { grid-template-columns: 1fr; } }

            /* Panels */
            .diagram-panel, .info-panel {
                background: var(--card);
                border-radius: 16px;
                padding: 1.8rem;
                box-shadow: 0 6px 20px rgba(0,0,0,.08);
            }
            .diagram-panel h3, .info-panel h3 {
                margin: 0 0 1rem;
                color: var(--primary);
                font-size: 1.5rem;
            }
            
            /* Left Panel: Cilia Diagram */
            .diagram-toolbar { display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
            .gene-search { display: flex; gap: 0.5rem; flex: 1; max-width: 400px; }
            .gene-input { flex: 1; padding: 0.7rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem; }
            .btn {
                padding: 0.7rem 1.2rem; background: var(--primary); color: white; border: none;
                border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.95rem; transition: 0.2s;
            }
            .btn:hover { background: var(--primary-dark); }
            .btn-outline { background: transparent; border: 1px solid var(--primary); color: var(--primary); }
            .btn-outline:hover { background: rgba(44, 90, 160, 0.1); }
            
            /* SVG Container */
            .svg-container {
                height: 560px; overflow: hidden; border: 1px solid var(--border);
                border-radius: 12px; background: var(--org-cytoplasm); padding: 0;
            }
            #cilia-svg svg { width: 100%; height: 100%; }
            #cilia-svg .compartment { cursor: pointer; transition: all 0.2s; }
            #cilia-svg .compartment:hover { opacity: 0.8; filter: brightness(1.1); }
            #cilia-svg .compartment.active {
                stroke-width: 4px;
                stroke: #000000;
                filter: drop-shadow(0 0 8px currentColor) drop-shadow(0 0 5px rgba(0,0,0,0.5));
            }

            /* --- Cilia & Organelle Colors --- */
            /* Cilia */
            .structure-axoneme { fill: none !important; stroke: var(--cilia-axoneme) !important; stroke-width: 4px; color: var(--cilia-axoneme); }
            .structure-basal-body { fill: var(--cilia-basal-body) !important; color: var(--cilia-basal-body); }
            .structure-transition-zone { fill: var(--cilia-tz) !important; color: var(--cilia-tz); }
            .structure-ciliary-membrane { stroke: var(--cilia-membrane) !important; fill: none; stroke-width: 3px; stroke-dasharray: 6, 6; color: var(--cilia-membrane); }
            /* Organelles (from v3.5 diagram style) */
            .structure-nucleus { fill: var(--org-nucleus) !important; color: var(--org-nucleus); }
            .structure-nucleolus { fill: var(--org-nucleolus) !important; color: var(--org-nucleolus); }
            .structure-mitochondria { fill: var(--org-mitochondria) !important; color: var(--org-mitochondria); }
            .structure-golgi-apparatus { fill: none !important; stroke: var(--org-golgi) !important; stroke-width: 4px; color: var(--org-golgi); }
            .structure-golgi-vesicle { fill: var(--org-vesicle) !important; color: var(--org-vesicle); }
            .structure-lysosome { fill: var(--org-lysosome) !important; color: var(--org-lysosome); }
            .structure-peroxisome { fill: var(--org-peroxisome) !important; color: var(--org-peroxisome); }
            .structure-ribosomes { fill: var(--org-ribosome) !important; color: var(--org-ribosome); }
            .structure-cytoplasm { fill: var(--org-cytoplasm) !important; stroke: #D8DEE9; stroke-width: 3px; color: var(--org-cytoplasm); opacity: 1.0; }
             .structure-cell-body { fill: var(--org-cytoplasm) !important; stroke: #D8DEE9; stroke-width: 3px; color: var(--org-cytoplasm); opacity: 1.0; }
            .structure-plasma-membrane { fill: var(--org-pm) !important; color: var(--org-pm); opacity: 1.0; }
            .structure-microtubule { stroke: var(--org-microtubule) !important; fill: none; stroke-width: 2px; color: var(--org-microtubule); }
            /* --- End Colors --- */

            /* Right Panel: Info */
            .info-panel {
                display: flex;
                flex-direction: column;
                height: fit-content;
            }
            .info-lists {
                margin-bottom: 1.5rem;
            }
            .organelle-info-panel {
                background: #e8f4fd;
                border: 1px solid #bbdefb;
                border-radius: 12px;
                padding: 1rem 1.2rem;
                min-height: 100px;
            }
            .organelle-info-panel h3 {
                margin: 0 0 0.5rem 0;
                color: var(--primary);
                font-size: 1.25rem;
            }
            .organelle-info-panel p {
                margin: 0;
                font-size: 0.95rem;
                line-height: 1.6;
            }
            .organelle-info-panel .gene-list {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
                font-size: 0.9rem;
                margin-top: 0.75rem;
            }
            .organelle-info-panel .gene-tag {
                background: white; padding: 0.3rem 0.6rem; border-radius: 6px;
                border: 1px solid #bbdefb; cursor: pointer;
            }
            .organelle-info-panel .gene-tag:hover { background: #d0ebff; }

            /* AI Chat (placed below info) */
            .chat-panel {
                margin-top: 2rem;
                padding: 1.5rem;
            }
            .disclaimer {
                font-size: 0.85rem; color: #e74c3c; background: #fdf2f2; padding: 0.8rem;
                border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #e74c3c;
            }
            .chat-window {
                flex: 1; max-height: 400px; overflow-y: auto; padding: 1rem; background: #f8f9fa;
                border-radius: 12px; margin-bottom: 1rem; border: 1px solid var(--border);
            }
            .message { margin: 0.75rem 0; padding: 0.75rem 1rem; border-radius: 12px; max-width: 85%; position: relative; }
            .user-message { background: var(--primary); color: white; margin-left: auto; border-bottom-right-radius: 4px; }
            .ai-message { background: white; border: 1px solid var(--border); margin-right: auto; border-bottom-left-radius: 4px; }
            .ai-message strong { color: var(--primary); }
            .ai-message em { font-style: italic; color: var(--text-light); }
            .feedback { font-size: 0.8rem; margin-top: 0.5rem; display: flex; gap: 0.5rem; }
            .feedback button { background: none; border: none; cursor: pointer; font-size: 1.2rem; opacity: 0.5; }
            .feedback button:hover { opacity: 1; }
            
            .chat-input-group { display: flex; gap: 0.75rem; }
            .chat-input { flex: 1; padding: 0.9rem; font-size: 1rem; border: 1px solid var(--border); border-radius: 8px; }
            .send-btn {
                background: var(--primary); color: white; padding: 0.9rem 1.8rem; border: none;
                border-radius: 8px; cursor: pointer; font-weight: 600;
            }
            .send-btn:hover { background: var(--primary-dark); }
        `;
        
        const styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
    }

    /**
     * Returns the full HTML string for the page content. (v3.5)
     */
    function getPageHTML() {
        return `
        <div class="ciliai-page">
            <div class="ciliai-header">
                <h1>CiliAI Explorer</h1>
                <p>Interactive ciliary biology and gene function explorer</p>
            </div>

            <div class="ciliai-grid">
                <div class="diagram-panel">
                    <div class="diagram-toolbar">
                        <div class="gene-search">
                            <input type="text" id="geneSearchInput" class="gene-input" placeholder="Search gene (e.g., IFT88, NPHP1, CEP290)">
                            <button id="findGeneBtn" class="btn">Find Gene</button>
                        </div>
                        <button id="showUmapBtn" class="btn btn-outline">Show UMAP</button>
                    </div>
                    <div class="svg-container">
                        <div id="cilia-svg"></div>
                    </div>
                </div>

                <div class="info-panel">
                    <div class="info-lists">
                        <div class="organelle-info-panel">
                            <h3 id="organelle-info-title">Click a structure or search a gene</h3>
                            <div id="organelle-info-text"></div>
                        </div>
                    </div>

                    <div class="chat-panel">
                        <div class="disclaimer">
                            <strong>Disclaimer:</strong> CiliAI is an AI system and may produce misleading results. Use for exploration only.
                        </div>
                        <div id="chatWindow" class="chat-window"></div>
                        <div class="chat-input-group">
                            <input type="text" id="chatInput" class="chat-input" placeholder="Ask CiliAI...">
                            <button id="sendBtn" class="send-btn">Send</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }

    
    // --- 6. SVG GENERATION & INTERACTION ---

    /**
     * Generates and injects the custom SVG.
     * This version combines the gray v3.5 diagram with the
     * colorful, scaled <g> elements from Furkan.html.
     */
    function generateAndInjectSVG() {
        const svgContainer = document.getElementById('cilia-svg');
        if (!svgContainer) return;

        // This SVG combines the v3.5 layout with the vFurkan.html <g> groups.
        // I have scaled and positioned them to fit.
        const svgHTML = `
        <svg viewBox="0 0 600 650" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">
            <defs>
                <linearGradient id="cytosolGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#F5F7FA"/>
                    <stop offset="100%" stop-color="#E9EDF2"/>
                </linearGradient>
            </defs>

            <g id="plasma-membrane" class="compartment" transform="translate(140, 290) scale(0.7)">
                 <path d="M312.5,390c121.17-55.19,183.28-179.8,138.4-279S291.42-35.42,150,30.65C29.33,87-25.82,228,11.56,309.68,56.87,408.72,215.6,434.12,312.5,390Z"/>
            </g>
            <g id="cell-body" class="compartment" transform="translate(140, 290) scale(0.7)">
                 <path d="M309.16,383.61C425.36,330.7,484.91,211.2,441.88,116.05S289-24.33,153.3,39C37.62,93.06-15.27,228.22,20.58,306.59,64,401.57,216.24,425.93,309.16,383.61Z"/>
            </g>

            <g id="nucleus" class="compartment" transform="translate(140, 380) scale(0.9)">
                <path d="M272.61,126.91c0,33.57-29,60.79-64.77,60.79s-64.76-27.22-64.76-60.79,29-60.78,64.76-60.78S272.61,93.34,272.61,126.91Z"/>
            </g>
            <g id="nucleolus" class="compartment" transform="translate(140, 380) scale(0.9)">
                <path d="M245.56,124.91c0,11.77-10.64,21.3-23.76,21.3S198,136.68,198,124.91s10.64-21.29,23.76-21.29S245.56,113.15,245.56,124.91Z"/>
            </g>

            <g id="golgi-apparatus" class="compartment" transform="translate(20, 350) scale(0.5)">
                <path d="M328.65,64a18.25,18.25,0,0,1,8.9,7.36c1.17,1.92,2,4.11,3.79,5.55,1.43,1.14,3.34,1.69,4.76,2.85a10.74,10.74,0,0,1,2.3,2.94c2.05,3.48,3.59,6.68,3.34,10.73a5.43,5.43,0,0,1-.9,3c-1.62,2.15-5.57,1.21-7.07-.47a9.53,9.53,0,0,1-2-5.24,40.9,40.9,0,0,1-.39-7.17,5.05,5.05,0,0,0-.19-2,1.86,1.86,0,0,0-1.62-1.25,3,3,0,0,0-1.83.86c-1.84,1.48-3.73,3.13-6.13,3.55s-5.3-1.15-5-3.35c.17-1.27,1.28-2.24,2.23-3.2a19.87,19.87,0,0,0,2.67-3.34c1-1.56,1.63-3.78.16-4.94-1.07-.84-2.75-.62-4,0S325.31,71.43,324,72s-3,.74-4-.16a3,3,0,0,1-.22-3.63c.77-1.38,2.15-3,1.13-4.2-.67-.8-2-.74-3.11-.61l-7.42.87a4.85,4.85,0,0,1-3-.29,2.5,2.5,0,0,1-.69-3.39c1.71-3,8.86-4.45,11.71-2.37,1.12.81,1.72,2.1,2.77,3,1.5,1.28,3.68,1.6,5.66,2.16C327.45,63.58,328.06,63.79,328.65,64Z"/>
                <path d="M299,44.74c-2.53.9-4.77,2.45-5.51,4.95a3.8,3.8,0,0,0,.18,2.85c.83,1.54,3.38,2.53,5,2.47,8-.29,15.83-2.24,23.8-2.11s16.56,2.88,20.8,9.64c1.26,2,2.06,4.27,3.12,6.4a46.06,46.06,0,0,0,7.69,10.53,14.69,14.69,0,0,1,2.54,3.29c1.13,2.25.94,4.9.72,7.41l-1,11a10.91,10.91,0,0,0,.19,4.23c.38,1.34,1.5,2.9,1.65,4.25,2.12,4.22,7.87,5.13,9.87.18a9.55,9.55,0,0,0,.28-4.84,17.85,17.85,0,0,0-1.38-5.2c-.93-2-2.41-3.68-3.41-5.64a26.65,26.65,0,0,1-1.95-6c-1.12-4.73-1.87-9.52-4.13-13.79-2.18-4.1-3.95-8.21-7-11.77-4.68-5.41-11.21-8.92-17.94-11.35-10.11-3.65-19.15-9-30.34-7.31A17.76,17.76,0,0,0,299,44.74Z"/>
                <path d="M297.31,32l-.18.09c-2.9,1.46-7.26,5.56-2.75,7.89a7.26,7.26,0,0,0,5,.23c6.27-1.59,13.17-3.16,19.66-2.29A45.29,45.29,0,0,1,324.21,39c6.23,1.55,12.73,3.32,17.26,7.63,2.44,2.31,4.15,5.22,6.5,7.61,3.74,3.82,8.8,6.08,12.93,9.46,4.5,3.67,6.19,9.65,7.05,15.17.62,4-.66,9.95,2.32,13.2a4.73,4.73,0,0,0,2.52,1.36c3.16.64,6.49-1.65,7.61-4.58s.39-6.22-1.15-8.9a37.54,37.54,0,0,0-6-7.12c-3.79-3.89-6.55-8.63-10.49-12.25-4.84-4.45-9.19-9.52-13.89-14.12A40.33,40.33,0,0,0,342.46,41c-4.32-2.74-9.74-4.19-14.65-5.72-2.71-.84-5.47-1.3-8.22-1.95s-5.47-2.06-8.32-2.8A20.44,20.44,0,0,0,297.31,32Z"/>
            </g>
            <g id="golgi-vesicle" class="compartment" transform="translate(40, 340) scale(0.5)">
                <path d="M301.15,61.82A2.81,2.81,0,1,1,298,59.34,2.81,2.81,0,0,1,301.15,61.82Z"/>
                <path d="M342.29,102.94a3,3,0,1,1-3.32-2.63A3,3,0,0,1,342.29,102.94Z"/>
                <path d="M339,92.19a3.86,3.86,0,1,1-4.28-3.4A3.86,3.86,0,0,1,339,92.19Z"/>
            </g>

            <g id="mitochondria" class="compartment" transform="translate(280,260) scale(0.7)">
                 <path d="M352.23,315.07a8.2,8.2,0,0,1-.91,8.09c-1.92,2.31-5.14,3-8.11,3.46a53.58,53.58,0,0,0-10.06,2.21c-3.24,1.18-7.07,3.4-8.54,6.67-1.55,3.47-3.33,7-6.45,9.36a22.36,22.36,0,0,1-14.52,3.89A10.82,10.82,0,0,1,296,345c-1.91-2.35-2.31-5.95-2-8.85.74-7,5.31-13.15,11-17.26s12.47-6.45,19.22-8.42c6.27-1.83,13.37-3.57,19.88-2A11.13,11.13,0,0,1,352.23,315.07Z"/>
            </g>
            
            <g id="lysosome" class="compartment" transform="translate(280, 350) scale(0.7)">
                <ellipse cx="234.02" cy="332.54" rx="9.83" ry="11.32" transform="translate(-143.2 484.37) rotate(-76.79)"/>
            </g>
             <g id="peroxisome" class="compartment" transform="translate(300, 300) scale(0.7)">
                <ellipse cx="162.77" cy="344.7" rx="7.6" ry="6.3"/>
            </g>

            <g id="ribosomes" class="compartment" transform="translate(150, 350) scale(1)">
                <path d="M141.07,73.92a1.56,1.56,0,1,1-1.56-1.46A1.52,1.52,0,0,1,141.07,73.92Z"/>
                <path d="M136.66,78.94a1.56,1.56,0,1,1-1.56-1.46A1.52,1.52,0,0,1,136.66,78.94Z"/>
                <path d="M127.48,90.68a1.56,1.56,0,1,1-1.56-1.47A1.51,1.51,0,0,1,127.48,90.68Z"/>
                <path d="M123.59,96.47A1.56,1.56,0,1,1,122,95,1.52,1.52,0,0,1,123.59,96.47Z"/>
            </g>

            <g id="microtubule" class="compartment" transform="translate(150, 280) scale(0.5)">
                 <path d="M81.25,195.08l-2.31,1.52s14.77,17.33,24.75,32.11S125.36,267,125.36,267l2.32-1.53s-5.89-15.25-20.42-37.47A268.48,268.48,0,0,0,81.25,195.08Z"/>
                 <path d="M299.5,292.48l2.31,1.53s-12.12,13.31-20,24.92-16.53,30.51-16.53,30.51L263,347.91s4-12.42,15.44-29.92A168.22,168.22,0,0,1,299.5,292.48Z"/>
            </g>

            <g id="basal-body" class="compartment">
                <rect x="285" y="300" width="30" height="22"/>
            </g>
            <g id="transition-zone" class="compartment">
                <path d="M 287,300 L 280,280 L 320,280 L 313,300 Z"/>
            </g>
            <g id="ciliary-membrane" class="compartment">
                <path d="M 280,280 L 295,80 L 305,80 L 320,280 Z"/>
            </g>
            <g id="axoneme" class="compartment">
                <path d="M 295,280 L 298,85 L 302,85 L 305,280 Z"/>
            </g>
        </svg>`;
        
        svgContainer.innerHTML = svgHTML;
        setupSVGInteraction();
    }

 /**
     * Attaches click listeners to the SVG compartments.
     */
    function setupSVGInteraction() {
        Object.keys(structureInfoMap).forEach(id => {
            const el = document.getElementById(id);
            if (!el) {
                console.warn(`CiliAI: SVG structure #${id} not found.`);
                return;
            }
            
            // Add compartment class for coloring
            el.classList.add('compartment', `structure-${id}`);

            el.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent click on cytoplasm from triggering body click
                activateStructure(id);
            });
        });
    }

    /**
     * Clears all visual highlights from SVG and lists.
     */
    function clearAllHighlights() {
        // Clear SVG active states
        document.querySelectorAll('#cilia-svg .compartment.active').forEach(el => {
            el.classList.remove('active');
        });

        // Clear list active states (if any)
        document.querySelectorAll('.legend-item.active').forEach(li => {
            li.classList.remove('active');
        });
    }

    /**
     * Displays information in the info panel.
     */
    function showInfoPanel(title, description, genes = []) {
        const infoTitle = document.getElementById('organelle-info-title');
        const infoText = document.getElementById('organelle-info-text');
        if (!infoTitle || !infoText) return; // Guard clause

        infoTitle.textContent = title;
        infoText.innerHTML = `<p>${description}</p>`; // Use innerHTML for description
        
        if (genes && genes.length > 0) {
            // Check real gene data
            const realGenes = genes.filter(g => window.CiliAI.lookups.geneMap[g.toUpperCase()]);
            const geneListHTML = '<div class="gene-list">' + 
                realGenes.map(g => `<span class="gene-tag" data-gene="${g}">${g}</span>`).join('') + 
                '</div>';
            infoText.innerHTML += geneListHTML;
        }
    }
    
    /**
     * Handles activating any structure (from SVG or list)
     */
    function activateStructure(id) {
        const data = structureInfoMap[id];
        if (!data) return;

        clearAllHighlights();

        // Highlight SVG
        const svgEl = document.getElementById(id);
        if (svgEl) svgEl.classList.add('active');
        
        // Show info
        showInfoPanel(data.title, data.description, data.genes);
    }
    
    // --- 7. CHAT & QUERY LOGIC (DATA-AWARE) ---

    /**
     * Adds a message to the chat window.
     */
    function addChatMessage(html, isUser = false) {
        const chatWindow = document.getElementById('chatWindow');
        if (!chatWindow) return; // Guard clause
        const msg = document.createElement('div');
        msg.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
        
        msg.innerHTML = `<div class="message-content">${html}</div>`; // Use innerHTML to allow <em>, <strong>, etc.
        
        if (!isUser) {
            msg.querySelector('.message-content').innerHTML += `
                <div class="feedback">
                    <button title="Good answer" data-feedback="good">👍</button>
                    <button title="Bad answer" data-feedback="bad">👎</button>
                </div>`;
        }
        
        chatWindow.appendChild(msg);
        chatWindow.scrollTop = chatWindow.scrollHeight; // Auto-scroll
    }

    /**
     * Handles the user sending a message.
     */
    function handleUserSend() {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput) return; // Guard clause
        const query = chatInput.value.trim();
        if (!query) return;

        addChatMessage(query, true); // Add user's message
        chatInput.value = ''; // Clear input

        // Process the query
        handleAIQuery(query);
    }
    
    /**
     * Finds a gene and highlights it.
     */
    function handleGeneSearch(geneSymbol, queryAI = true) {
        const gene = geneSymbol.trim().toUpperCase();
        if (!gene) return;

        // Use the CiliAI lookup
        if (!window.CiliAI || !window.CiliAI.ready || !window.CiliAI.lookups || !window.CiliAI.lookups.geneMap) {
            console.warn("CiliAI data is not ready for gene search.");
            return;
        }
        
        const geneData = window.CiliAI.lookups.geneMap[gene];
        
        if (!geneData) {
            clearAllHighlights();
            showInfoPanel(`Gene Not Found: ${gene}`, `This gene is not in the CiliAI database.`);
            return;
        }

        // Find localization
        let loc = 'unknown';
        let locString = 'Unknown';
        if (geneData.localization) {
            // Use the already-normalized array
            const locArray = ensureArray(geneData.localization);
            locString = locArray.join(', ');
            const locLower = locString.toLowerCase();
            
            // Match in order of specificity
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
        clearAllHighlights();
        if (loc !== 'unknown' && document.getElementById(loc)) {
            document.getElementById(loc).classList.add('active');
        }
        showInfoPanel(`Gene: ${gene}`, (geneData.description || 'No description available.') + `<br><strong>Localization:</strong> ${locString}`, [gene]);

        // Also ask the AI about it if triggered by user
        if (queryAI) {
            addChatMessage(`Tell me about ${gene}`, true);
            handleAIQuery(`Tell me about ${gene}`);
        }
    }


    // --- 8. EVENT LISTENER SETUP ---

    /**
     * Attaches all primary event listeners for the page.
     */
    function setupPageEventListeners() {
        // Guard against elements not existing
        const sendBtn = document.getElementById('sendBtn');
        const chatInput = document.getElementById('chatInput');
        const findGeneBtn = document.getElementById('findGeneBtn');
        const geneSearchInput = document.getElementById('geneSearchInput');
        const showUmapBtn = document.getElementById('showUmapBtn');
        const bottomBar = document.getElementById('bottomBar');
        
        // Chat
        if (sendBtn) sendBtn.addEventListener('click', handleUserSend);
        if (chatInput) chatInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') handleUserSend();
        });

        // Gene Search
        if (findGeneBtn) findGeneBtn.addEventListener('click', () => {
            if (geneSearchInput) handleGeneSearch(geneSearchInput.value, true);
        });
        if (geneSearchInput) geneSearchInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') handleGeneSearch(geneSearchInput.value, true);
        });

        // UMAP Button
        if (showUmapBtn) showUmapBtn.addEventListener('click', () => {
            console.log("CiliAI: 'Show UMAP' clicked.");
            addChatMessage("Show me the UMAP plot.", true);
            handleAIQuery("Show me the UMAP plot.");
        });

        // Event delegation for dynamic content (gene tags, feedback)
        document.body.addEventListener('click', e => {
            // Gene tags in info panel
            const geneTag = e.target.closest('.gene-tag');
            if (geneTag) {
                const gene = geneTag.dataset.gene;
                if (chatInput) chatInput.value = `What is ${gene}?`;
                handleUserSend();
                return;
            }

            // Feedback buttons
            const feedbackBtn = e.target.closest('.feedback button');
            if (feedbackBtn) {
                console.log(`CiliAI Feedback: ${feedbackBtn.dataset.feedback}`);
                feedbackBtn.parentElement.querySelectorAll('button').forEach(b => b.style.opacity = 0.3);
                feedbackBtn.style.opacity = 1;
                return;
            }
            
            // Legend items in bottom bar
            const legendItem = e.target.closest('.legend-item');
            if (legendItem) {
                const id = legendItem.dataset.id;
                if (id) activateStructure(id);
                return;
            }
            
            // Gene badges in bottom bar
            const geneBadge = e.target.closest('.gene-badge');
            if (geneBadge) {
                const gene = geneBadge.dataset.gene;
                if (gene) handleGeneSearch(gene, true);
            }
            
            // AI Action Links (for plot switching, etc.)
            const aiAction = e.target.closest('.ai-action');
            if (aiAction) {
                e.preventDefault();
                const action = aiAction.dataset.action;
                const genesString = aiAction.dataset.genes;
                const genes = genesString ? genesString.split(',').map(g => g.trim()).filter(Boolean) : [];
                const resultArea = document.getElementById('chatWindow');

                if (action === 'show-nevers-heatmap' || action === 'show-li-heatmap') {
                    const source = action.includes('nevers') ? 'nevers' : 'li';
                    addChatMessage(`Switching to ${source.toUpperCase()} comparison...`, false);
                    handlePhylogenyVisualizationQuery(genes, source, 'heatmap');
                }  
                else if (action === 'show-table-view') {
                    addChatMessage(`Generating phylogenetic data table...`, false);
                    handlePhylogenyVisualizationQuery(genes, 'li', 'table');
                }
                else if (action === 'visualize-heatmap') {
                    addChatMessage(`Generating heatmap...`, false);
                    handlePhylogenyVisualizationQuery(genes, 'li', 'heatmap');
                }
            }
        });
    }

// ==========================================================
    // 9A. AI HELPER FUNCTIONS (Data Query & Formatting)
    // (This block was missing and is required by handleAIQuery)
    // ==========================================================

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
     * @param {string} title - The title of the card.
     * @param {Array<{gene: string, description: string}>} genes - Array of gene objects.
     * @param {string} [description=""] - Optional intro text.
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
     * Fetches and formats a comprehensive summary for a single gene.
     * @param {string} term - The gene symbol.
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
        
        // Localization
        if (g.localization) {
            html += `<li><strong>Localization:</strong> ${ensureArray(g.localization).join(', ')}</li>`;
        }
        
        // Ciliopathy
        if (g.ciliopathy && g.ciliopathy.length > 0) {
            html += `<li><strong>Ciliopathy:</strong> ${g.ciliopathy.join(', ')}</li>`;
        }
        
        // Complexes
        const complexes = Object.keys(g.complex_components || {});
        if (complexes.length > 0) {
            html += `<li><strong>Complexes:</strong> ${complexes.join(', ')}</li>`;
        }

        // Orthologs
        const orthologs = [
            g.ortholog_c_elegans ? `<em>C. elegans</em> (${g.ortholog_c_elegans})` : null,
            g.ortholog_mouse ? `Mouse (${g.ortholog_mouse})` : null,
            g.ortholog_zebrafish ? `Zebrafish (${g.ortholog_zebrafish})` : null
        ].filter(Boolean).join(', ');
        if (orthologs) {
            html += `<li><strong>Orthologs:</strong> ${orthologs}</li>`;
        }
        
        // Phylogeny Links
        html += `
            <li><strong>Phylogeny:</strong> 
                <a href="#" class="ai-action" data-action="show-li-heatmap" data-genes="${g.gene}">Show Conservation</a>
            </li>`;

        html += '</ul>';
        return html;
    }

    /**
     * Generic getter for functional category
     */
    async function getGenesByFunction(term) {
        const normTerm = normalizeTerm(term);
        const results = [];
        window.CiliAI.masterData.forEach(g => {
            if (normalizeTerm(g.functional_category).includes(normTerm)) {
                results.push({ gene: g.gene, description: g.functional_category });
            }
        });
        return results;
    }

    /**
     * Generic getter for complexes
     */
    async function getGenesByComplex(term) {
        const normTerm = normalizeTerm(term);
        const L = window.CiliAI.lookups;
        
        // Check if term IS a complex
        const complexName = Object.keys(L.complexByName).find(name => normalizeTerm(name).includes(normTerm));
        if (complexName) {
            return L.complexByName[complexName].map(gene => ({
                gene: gene,
                description: `Subunit of ${complexName}`
            }));
        }
        
        // Check if term IS a gene
        const geneName = term.toUpperCase();
        if (L.complexByGene[geneName]) {
            return L.complexByGene[geneName].map(name => ({
                gene: name,
                description: `Contains ${geneName}`
            }));
        }
        return [];
    }

    /**
     * Generic getter for ciliopathy
     */
    async function getCiliopathyGenes(term) {
        const normTerm = term.toLowerCase();
        let key = normTerm;
        
        // Handle aliases
        if (normTerm === 'bbs') key = 'bardet–biedl syndrome';
        if (normTerm === 'mks') key = 'meckel–gruber syndrome';
        if (normTerm === 'joubert') key = 'joubert syndrome';
        if (normTerm === 'nphp') key = 'nephronophthisis';
        
        const genes = window.CiliAI.lookups.byCiliopathy[key] || [];
        
        // Find classification
        let desc = "";
        for (const [classification, diseases] of Object.entries(intentParser.classifiedDiseases)) {
            if (diseases.map(d => d.toLowerCase()).includes(key)) {
                desc = `This is classified as a: <strong>${classification}</strong>.`;
                break;
            }
        }
        
        return {
            genes: genes.map(g => ({ gene: g })),
            description: desc
        };
    }

    /**
     * Generic getter for localization
     */
    async function getGenesByLocalization(term) {
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
     * Generic getter for organisms (from phylogeny)
     */
    async function getCiliaryGenesForOrganism(term) {
        const liData = window.liPhylogenyCache;
        if (!liData) return { genes: [], description: "Li (2014) data not loaded.", speciesCode: term };

        const normTerm = term.toLowerCase();
        let speciesIndex = -1;
        let speciesCode = term;

        // Find the species index
        for (let i = 0; i < liData.summary.species_list.length; i++) {
            const species = liData.summary.species_list[i];
            if (species.s.toLowerCase().includes(normTerm) || species.c.toLowerCase().includes(normTerm)) {
                speciesIndex = i;
                speciesCode = species.c; // Use the code (e.g., "H.sapiens")
                break;
            }
        }

        if (speciesIndex === -1) {
            return { genes: [], description: `Organism "${term}" not found in Li (2014) phylogeny.`, speciesCode: term };
        }

        // Find all genes present in this species
        const genes = [];
        Object.values(liData.genes).forEach(geneData => {
            if (geneData.s && geneData.s.includes(speciesIndex)) {
                genes.push({ gene: geneData.g, description: `Present in ${speciesCode}` });
            }
        });

        const isCiliated = liData.summary.ciliated_species.includes(speciesIndex);
        const description = `Found ${genes.length} ciliary genes. This organism is considered: <strong>${isCiliated ? "Ciliated" : "Non-Ciliated"}</strong>.`;

        return { genes, description, speciesCode };
    }

    /**
     * Generic getter for domains
     */
    async function getGenesByDomain(term) {
        const normTerm = term.toLowerCase();
        const results = [];
        window.CiliAI.masterData.forEach(g => {
            const domains = [...(g.pfam_ids || []), ...(g.domain_descriptions || [])];
            const matchingDomain = domains.find(d => d.toLowerCase().includes(normTerm));
            if (matchingDomain) {
                results.push({ gene: g.gene, description: `Contains ${matchingDomain}` });
            }
        });
        return results;
    }

    /**
     * Handler for semantic intent: Localization + Phenotype
     */
    async function getLocalizationPhenotypeGenes(localization, phenotype) {
        const normLoc = localization.toLowerCase();
        const normPheno = phenotype.toLowerCase(); // "short" or "long"
        
        const results = [];
        window.CiliAI.masterData.forEach(g => {
            const geneLoc = (g.localization || '').toLowerCase();
            let phenoEffect = '';
            
            if (normPheno.includes("short")) {
                phenoEffect = (g.percent_ciliated_cells_effects || '').toLowerCase();
            } else if (normPheno.includes("long")) {
                 phenoEffect = (g.overexpression_effects || '').toLowerCase(); // Example, adjust as needed
            }

            if (geneLoc.includes(normLoc) && (phenoEffect.includes(normPheno) || phenoEffect.includes("decrease"))) {
                results.push({
                    gene: g.gene,
                    description: `Localizes to ${localization} and shows ${phenotype} cilia phenotype.`
                });
            }
        });

        return formatListResult(`Genes at ${localization} with ${phenotype} cilia`, results);
    }

 /**
     * Handler for all phylogeny plot requests
     */
    async function handlePhylogenyVisualizationQuery(genes, source = 'li', type = 'heatmap') {
        const plotDivId = 'cilia-svg'; // Use the main SVG container
        const plotDiv = document.getElementById(plotDivId);
        if (!plotDiv) return "Could not find plot area.";

        // Clear the SVG and show a loading message
        plotDiv.innerHTML = `<div style="padding: 40px; text-align: center;">Loading ${source.toUpperCase()} phylogeny plot...</div>`;
        
        const data = (source === 'nevers') ? window.neversPhylogenyCache : window.liPhylogenyCache;
        if (!data) return `Error: ${source.toUpperCase()} phylogeny data is not loaded.`;
        
        // Ensure genes is an array
        if (!Array.isArray(genes)) genes = [];

        // If no genes specified, use a default set (e.g., BBSome)
        let geneList = genes.length > 0 ? genes : ['BBS1', 'BBS2', 'BBS4', 'BBS5', 'BBS7', 'BBS8', 'BBS9', 'ARL6'];
        let title = genes.length > 0 ? `Phylogenetic Profile for ${genes.join(', ')}` : 'Phylogenetic Profile for BBSome';

        if (type === 'table') {
            // ... (Logic to render an HTML table would go here) ...
            plotDiv.innerHTML = "Table view is not yet implemented. Switching to heatmap.";
        }

        // --- Render Heatmap ---
        try {
            if (source === 'nevers') {
                // Call the Nevers-specific plot function (if you have one)
                // This is a placeholder; you'd need to adapt your 'plotNeversHeatmap'
                plotDiv.innerHTML = `Nevers plot for ${geneList.join(', ')} (Plotting function not fully wired)`;
                // Example: plotNeversHeatmap(geneList, plotDivId); 
            } else {
                // Call the Li-specific plot function
                // This assumes you have a function 'plotLiHeatmap'
                // We'll use a simplified version for this example
                plotLiHeatmap(geneList, plotDivId, title);
            }
            // Return an empty string because the message was already added by the click handler
            return ""; 
        } catch (e) {
            console.error("Plotting error:", e);
            return `Error generating plot: ${e.message}`;
        }
    }

    /**
     * Renders the Li et al. 2014 heatmap.
     * This is a required helper for handlePhylogenyVisualizationQuery.
     */
    function plotLiHeatmap(geneList, divId, title) {
        const data = window.liPhylogenyCache;
        if (!data || !data.genes || !data.summary) {
            document.getElementById(divId).innerHTML = "Error: Li (2014) data not loaded or malformed.";
            return;
        }

        const speciesList = data.summary.species_list.map(s => s.c); // "H.sapiens", "M.musculus", etc.
        const ciliatedSpecies = data.summary.ciliated_species; // array of indices
        
        let z = []; // The heatmap data (rows = genes, cols = species)
        let yLabels = []; // Gene names

        geneList.forEach(geneSymbol => {
            const geneUpper = geneSymbol.toUpperCase();
            const geneData = Object.values(data.genes).find(g => g.g.toUpperCase() === geneUpper);
            
            if (geneData) {
                let row = new Array(speciesList.length).fill(0); // 0 = Absent
                geneData.s.forEach(speciesIndex => {
                    row[speciesIndex] = 1; // 1 = Present
                });
                z.push(row);
                yLabels.push(geneSymbol);
            }
        });

        if (z.length === 0) {
            document.getElementById(divId).innerHTML = "Error: None of the requested genes were found in the Li (2014) data.";
            return;
        }

        // Add ciliated/non-ciliated info trace
        let ciliatedTrace = speciesList.map((_, i) => ciliatedSpecies.includes(i) ? 1 : 0);
        z.push(ciliatedTrace);
        yLabels.push('<b>Ciliated</b>'); // Add a label for the trace

        const plotData = [{
            z: z,
            x: speciesList,
            y: yLabels,
            type: 'heatmap',
            colorscale: [
                [0, '#eef2f9'],  // Absent
                [1, '#2c5aa0']   // Present
            ],
            showscale: false,
            xgap: 1,
            ygap: 1
        }];

        const layout = {
            title: title,
            xaxis: {
                type: 'category',
                tickangle: -90,
                automargin: true,
                ticks: 'outside',
                tickfont: { size: 8 }
            },
            yaxis: {
                type: 'category',
                automargin: true,
                ticks: 'outside'
            },
            margin: { l: 80, r: 20, b: 150, t: 60 }
        };

        Plotly.newPlot(divId, plotData, layout, { responsive: true });
    }


    /**
     * Handler for domain queries
     */
    async function resolveDomainQuery(query) {
        const genes = extractMultipleGenes(query);
        if (genes.length > 0) {
            // You would need a domain plotting function here, e.g., plotDomains(genes)
            return `Domain visualization for <strong>${genes.join(', ')}</strong> is not yet implemented.`;
        }
        
        // Fallback to simple keyword search
        const intent = intentParser.parse(query);
        if (intent && intent.type === 'DOMAIN') {
             return await intent.handler(intent.entity);
        }
        
        return "I couldn't find a gene or a domain in your query. Try 'domains for IFT88' or 'show WD40 domain genes'.";
    }

    /**
     * This is the list of exact-match, high-priority, "solid" questions.
     * This is Priority 1.
     */
    const questionRegistry = [
        // ... (This would be populated with your full registry) ...
        { text: "what can you do?", handler: async () => formatListResult("About CiliAI", [], "I am an AI assistant combining multiple genomic and functional datasets (CiliaHub, Domain DB, scRNA-seq, Phylogeny) to answer questions about ciliary biology.") },
        { text: "list genes for joubert syndrome", handler: async () => formatListResult("Joubert Syndrome Genes", (await getCiliopathyGenes("Joubert Syndrome")).genes) },
    ];

    /**
     * This is the semantic router for patterns (e.g., [LOCATION] + [PHENOTYPE]).
     * This is Priority 2.
     */
    async function resolveSemanticIntent(query) {
        const qLower = query.toLowerCase().trim();

        const localizationTerms = ["basal body", "transition zone", "cilia", "axoneme", "centrosome", "ciliary membrane", "nucleus", "lysosome", "mitochondria", "ciliary tip"];
        const phenotypeTerms = ["short cilia", "shorter", "longer cilia", "long cilia", "cilia length", "cilia defects", "decreased ciliation", "loss of cilia", "reduced cilia", "no effect"];
        const diseaseNames = ["joubert syndrome", "meckel-gruber syndrome", "primary ciliary dyskinesia", "nephronophthisis", "bbs", "pcd", "ciliopathy"];

        const matchedLocalization = localizationTerms.find(name => qLower.includes(name));
        const matchedPhenotype = phenotypeTerms.find(term => qLower.includes(term));
        const matchedDisease = diseaseNames.find(name => qLower.includes(name));

        // Priority 2a: Disease + Phenotype
        if (matchedDisease && matchedPhenotype) {
            return await getLocalizationPhenotypeGenes(matchedDisease, matchedPhenotype.includes("short") ? "short" : "long");
        }
        
        // Priority 2b: Localization + Phenotype (The one we fixed)
        if (matchedLocalization && matchedPhenotype) {
            return await getLocalizationPhenotypeGenes(matchedLocalization, matchedPhenotype.includes("short") ? "short" : "long");
        }
        
        return null; // No semantic pattern found
    }


    /**
     * REPLACEMENT: The new, unified "Brain" of CiliAI
     * This function contains both the simple keyword parser (.parse)
     * and the new complex query helpers (.getJoubertGenesInCiliatedCells, .getOrthologs)
     */
    function createIntentParser() {
        // --- Disease Classification Map ---
        const classifiedDiseases = {
            "Primary Ciliopathies": [ "Acrocallosal Syndrome", "Alström Syndrome", "Autosomal Dominant Polycystic Kidney Disease", "Autosomal Recessive Polycystic Kidney Disease", "Bardet–Biedl Syndrome", "COACH Syndrome", "Cranioectodermal Dysplasia", "Ellis-van Creveld Syndrome", "Hydrolethalus Syndrome", "Infantile Polycystic Kidney Disease", "Joubert Syndrome", "Leber Congenital Amaurosis", "Meckel–Gruber Syndrome", "Nephronophthisis", "Orofaciodigital Syndrome", "Senior-Løken Syndrome", "Short-rib Thoracic Dysplasia", "Skeletal Ciliopathy", "Retinal Ciliopathy", "Syndromic Ciliopathy", "Al-Gazali-Bakalinova Syndrome", "Bazex-Dupré-Christol Syndrome", "Bilateral Polycystic Kidney Disease", "Biliary, Renal, Neurologic, and Skeletal Syndrome", "Caroli Disease", "Carpenter Syndrome", "Complex Lethal Osteochondrodysplasia", "Greig Cephalopolysyndactyly Syndrome", "Kallmann Syndrome", "Lowe Oculocerebrorenal Syndrome", "McKusick-Kaufman Syndrome", "Morbid Obesity and Spermatogenic Failure", "Polycystic Kidney Disease", "RHYNS Syndrome", "Renal-hepatic-pancreatic Dysplasia", "Retinal Dystrophy", "STAR Syndrome", "Smith-Lemli-Opitz Syndrome", "Spondylometaphyseal Dysplasia", "Stromme Syndrome", "Weyers Acrofacial Dysostosis", "Hydrocephalus"], 
            "Motile Ciliopathies": [ "Primary Ciliary Dyskinesia", "Birt-Hogg-Dubé Syndrome", "Juvenile Myoclonic Epilepsy" ],
            "Secondary Diseases": [ "Ataxia-telangiectasia-like Disorder", "Birt-Hogg-Dubé Syndrome", "Cone-Rod Dystrophy", "Cornelia de Lange Syndrome", "Holoprosencephaly", "Juvenile Myoclonic Epilepsy", "Medulloblastoma", "Retinitis Pigmentosa", "Spinocerebellar Ataxia", "Bazex-Dupré-Christol Syndrome", "Lowe Oculocerebrorenal Syndrome", "McKusick-Kaufman Syndrome", "Pallister-Hall Syndrome", "Simpson-Golabi-Behmel Syndrome", "Townes-Brocks Syndrome", "Usher Syndrome", "Visceral Heterotaxy" ],
            "Atypical Ciliopathies": [ "Biliary Ciliopathy", "Chronic Obstructive Pulmonary Disease", "Ciliopathy", "Ciliopathy - Retinal dystrophy", "Golgipathies or Ciliopathy", "Hepatic Ciliopathy", "Male Infertility and Ciliopathy", "Male infertility", "Microcephaly and Chorioretinopathy Type 3", "Mucociliary Clearance Disorder", "Notch-mediated Ciliopathy", "Primary Endocardial Fibroelastosis", "Retinal Ciliopathy", "Retinal Degeneration", "Skeletal Ciliopathy", "Syndromic Ciliopathy"]
        };
        const aliases = ["BBS", "Joubert", "NPHP", "MKS"];
        const allDiseases = [...Object.values(classifiedDiseases).flat(), ...aliases];

        // --- Core Function: Joubert Genes in Ciliated Cells (Uses GLOBAL helpers) ---
        async function getJoubertGenesInCiliatedCells() {
            // Data is already loaded by initCiliAI()
            const { genes: joubertGenes } = await getCiliopathyGenes("Joubert Syndrome"); 
            const joubertGeneSet = new Set(joubertGenes.map(g => g.gene.toUpperCase()));
            const results = [];
            if (window.CiliAI.data.scExpressionByGene) { // Use new data structure
                joubertGeneSet.forEach(gene => {
                    const expData = window.CiliAI.data.scExpressionByGene[gene]; 
                    if (expData && expData["ciliated cell"] && expData["ciliated cell"] > 0.1) {
                        results.push({
                            gene: gene,
                            description: `Expression: ${expData["ciliated cell"].toFixed(4)}`
                        });
                    }
                });
            }
            results.sort((a, b) => parseFloat(b.description.split(': ')[1]) - parseFloat(a.description.split(': ')[1]));
            return formatListResult("Joubert Genes Expressed in Ciliated Cells", results); 
        }

        // --- Function: Orthologs Finder (Uses GLOBAL helpers) ---
        async function getOrthologs(disease, organism) {
            // Data is already loaded by initCiliAI()
            const { genes: diseaseGenes } = await getCiliopathyGenes(disease); 
            const orthologKeyMap = {
                'c. elegans': 'ortholog_c_elegans',
                'mouse': 'ortholog_mouse',
                'zebrafish': 'ortholog_zebrafish',
                'xenopus': 'ortholog_xenopus',
                'drosophila': 'ortholog_drosophila'
            };
            const orthologKey = orthologKeyMap[organism.toLowerCase()];
            if (!orthologKey) {
                return formatListResult(`${disease} Orthologs in ${organism}`, [], `Ortholog key for "${organism}" not found.`);
            }
            const results = diseaseGenes
                .map(g => window.CiliAI.masterData.find(cg => cg.gene === g.gene)) // Use new data structure
                .filter(g => g && g[orthologKey] && g[orthologKey] !== 'N/A')
                .map(g => ({ gene: g.gene, description: `${organism} Ortholog: ${g[orthologKey]}` }));
            return formatListResult(`${disease} Orthologs in ${organism}`, results);
        }

        // --- Entity Keywords for simple parsing (from OLD parser) ---
        const entityKeywords = [
            {
                type: 'FUNCTIONAL_CATEGORY',
                keywords: ['kinesin motors', 'dynein motors', 'Ciliary assembly/disassembly', 'Signaling', 'Motile cilium', 'Motor protein', 'Transport', 'Protein modification', 'Cytoskeletal', 'cilium assembly', 'basal body docking', 'retrograde IFT'],
                handler: async (term) => formatListResult(`Genes in Functional Category: ${term}`, await getGenesByFunction(term)),
                autocompleteTemplate: (term) => `Show me ${term} genes`
            },
            {
                type: 'COMPLEX',
                keywords: ['BBSome', 'IFT-A', 'IFT-B', 'Transition Zone Complex', 'MKS Complex', 'NPHP Complex'],
                handler: async (term) => formatListResult(`Components of ${term}`, await getGenesByComplex(term)),
                autocompleteTemplate: (term) => `Display components of ${term} complex`
            },
            {
                type: 'CILIOPATHY',
                keywords: [...new Set(allDiseases)], // USES THE NEW LARGE LIST
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
                // FIX: Add all localization terms here for the simple parser
                keywords: [
                    'basal body', 'axoneme', 'transition zone', 'centrosome', 
                    'cilium', 'cilia', 'lysosome', 'ciliary tip', 'transition fiber',
                    'mitochondria', 'nucleus', 'flagella'
                ],
                handler: async (term) => formatListResult(`Genes localizing to ${term}`, await getGenesByLocalization(term)),
                autocompleteTemplate: (term) => `Show me ${term} localizing genes`
            },
            {
                type: 'ORGANISM',
                keywords: [ "Prokaryote", "E.cuniculi", "E.histolytica", "E.dispar", "G.lamblia", "T.vaginalis", "T.brucei", "T.cruzi", "L.infantum", "L.major", "L.braziliensis", "T.gondii", "C.hominis", "C.parvum", "B.bovis", "T.annulata", "T.parva", "P.knowlesi", "P.vivax", "P.falciparum", "P.chabaudi", "P.berghei", "P.yoelii", "P.tetraurelia", "T.thermophila", "P.infestans", "T.pseudonana", "P.tricornutum", "C.merolae", "N.gruberi", "O.lucimarinus", "O.tauri", "C.reinhardtii", "V.carteri", "P.patens", "S.moellendorffii", "S.bicolor", "Z.mays", "O.sativa", "B.distachyon", "A.lyrata", "A.thaliana", "L.japonicus", "M.truncatula", "V.vinifera", "P.trichocarpa", "R.communis", "T.trahens", "D.discoideum", "A.macrogynus", "S.punctatus", "M.globosa", "U.maydis", "C.neoformans", "P.chrysosporium", "S.commune", "C.cinerea", "L.bicolor", "S.pombe", "B.fuckeliana", "S.sclerotiorum", "F.graminearum", "M.grisea", "N.crassa", "P.anserina", "P.chrysogenum", "A.clavatus", "A.fumigatus", "N.fischeri", "A.flavus", "A.oryzae", "A.niger", "A.nidulans", "U.reesii", "C.immitis", "C.posadasii", "P.nodorum", "T.melanosporum", "Y.lipolytica", "P.pastoris", "C.lusitaniae", "D.hansenii", "M.guilliermondii", "S.stipitis", "L.elongisporus", "C.tropicalis", "C.albicans", "C.dubliniensis", "K.lactis", "A.gossypii", "K.waltii", "L.thermotolerans", "Z.rouxii", "V.polyspora", "C.glabrata", "S.bayanus", "S.mikatae", "S.cerevisiae", "S.paradoxus", "S.arctica", "C.owczarzaki", "M.brevicollis", "S.rosetta", "S.mansoni", "B.malayi", "C.briggsae", "C.elegans", "D.pulex", "A.pisum", "P.humanus", "A.mellifera", "N.vitripennis", "B.mori", "T.castaneum", "D.melanogaster", "D.pseudoobscura", "A.gambiae", "A.aegypti", "C.quinquefasciatus", "B.floridae", "T.adhaerens", "S.purpuratus", "H.magnipapillata", "N.vectensis", "C.intestinalis", "D.rerio", "O.latipes", "F.rubripes", "T.nigroviridis", "X.tropicalis", "G.gallus", "M.gallopavo", "O.anatinus", "M.domestica", "S.scrofa", "M.musculus", "C.familiaris", "B.taurus", "H.sapiens", "worm", "human", "mouse", "zebrafish", "fly", "yeast" ],
                handler: async (term) => {
                    // This function 'getCiliaryGenesForOrganism' needs to be defined globally
                    // or passed into this module. Assuming it's global for now.
                    const { genes, description, speciesCode } = await getCiliaryGenesForOrganism(term);
                    return formatListResult(`Ciliary genes in ${speciesCode}`, genes, description); 
                },
                autocompleteTemplate: (term) => `Display ciliary genes in ${term}`
            },
            {
                type: 'DOMAIN',
                keywords: ['WD40', 'Leucine-rich repeat', 'IQ motif', 'calmodulin-binding', 'EF-hand', 'coiled-coil', 'CTS', 'ciliary targeting sequences', 'ciliary localization signals'],
                handler: async (term) => formatListResult(`${term} domain-containing proteins`, await getGenesByDomain(term)),
                autocompleteTemplate: (term) => `Show ${term} domain containing proteins`
            }
        ];

        // --- Return Public API (Unified) ---
        return {
            // --- New Module Methods ---
            classifiedDiseases,
            allDiseases,
            getJoubertGenesInCiliatedCells,
            getOrthologs,
            
            // --- Old Parser Methods ---
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
            getAllGenes: () => window.CiliAI.masterData ? window.CiliAI.masterData.map(g => g.gene) : []
        };
    }

    // --- Initialize the new, unified intent parser ---
    const intentParser = createIntentParser();


    /**
     * This is the main router that implements the Priority Waterfall.
     */
    async function handleAIQuery(query) {
        const resultArea = document.getElementById('chatWindow'); // Use chat window for output
        
        // --- FIX: Guard Clause ---
        if (!resultArea) {
            console.warn('handleAIQuery called before UI elements were ready. Aborting.');
            return; 
        }
        
        const qLower = query.toLowerCase();
        if (!query) return;

        // --- Purge Plotly from the *diagram* container ---
        try { 
            const plotDiv = document.getElementById('cilia-svg');
            if (plotDiv && window.Plotly) Plotly.purge(plotDiv); 
        } catch (e) {}

        log(`Routing query: ${query}`);
        
        try {
            // Data is loaded by initCiliAI(), so we can proceed.
            if (!window.CiliAI.ready) {
                 addChatMessage("Data is still loading, please wait...", false);
                 return;
            }

            let htmlResult = '';
            let match;

            // =================================================================
            // PRIORITY 1: Exact Match in questionRegistry (Your 13 test queries)
            // =================================================================
            const perfectMatch = questionRegistry.find(item => item.text.toLowerCase() === qLower);
            if (perfectMatch) {
                console.log(`Routing via: Priority 1 (questionRegistry)`);
                htmlResult = await perfectMatch.handler();
            }

            // =================================================================
            // PRIORITY 2: Semantic Intent (Location + Phenotype, Disease + Phenotype)
            // =================================================================
            if (!htmlResult) {
                const semanticResult = await resolveSemanticIntent(query);
                if (semanticResult) {
                    console.log(`Routing via: Priority 2 (resolveSemanticIntent)`);
                    htmlResult = semanticResult;
                }
            }
            
            // =================================================================
            // PRIORITY 3: New Module Helpers & Dedicated Routers
            // =================================================================
            if (!htmlResult) {
                console.log(`Routing via: Priority 3 (Dedicated Routers & New Helpers)`);
                
                // --- Ciliopathy Module Queries (from new intentParser) ---
                if (qLower.includes('joubert') && qLower.includes('ciliated cells')) {
                    htmlResult = await intentParser.getJoubertGenesInCiliatedCells();
                } 
                else if (qLower.includes('ortholog') && (qLower.includes('joubert') || qLower.includes('ciliopathy'))) {
                    const diseaseMatch = qLower.includes('joubert') ? "Joubert Syndrome" : "ciliopathy";
                    const organismMatch = qLower.match(/(c\. elegans|zebrafish|mouse|drosophila|xenopus)/i);
                    if (organismMatch) {
                        htmlResult = await intentParser.getOrthologs(diseaseMatch, organismMatch[1]);
                    }
                }
                
                // --- CORUM Queries (Integrated from patchAIQueryHandler) ---
                else if (qLower.includes('subunits of') || qLower.includes('components of') || qLower.includes('members of')) {
                    const complexMatch = qLower.match(/(?:subunits|components|members)\s+of\s+(.+)/i);
                    if (complexMatch) {
                        const complexes = await getGenesByComplex(complexMatch[1].trim());
                        htmlResult = formatListResult(`Components of ${complexMatch[1].trim()}`, complexes);
                    }
                }
                else if (qLower.includes('complexes for') || qLower.includes('complexes of') || qLower.includes('complexes containing')) {
                    const geneMatch = qLower.match(/(?:complexes|subunits)\s+(?:for|of|containing)\s+([A-Za-z0-9\-]+)/i);
                    if (geneMatch) {
                        const complexes = await getGenesByComplex(geneMatch[1].toUpperCase());
                        htmlResult = formatListResult(`Complexes containing ${geneMatch[1].toUpperCase()}`, complexes);
                    }
                }

                // --- Phylogenetic Table/Heatmap Router ---
                else if (qLower.includes('phylogeny') || qLower.includes('conservation') || qLower.includes('evolutionary')) {
                    const genes = extractMultipleGenes(query);
                    htmlResult = await handlePhylogenyVisualizationQuery(genes, 'li', 'heatmap');
                } 
                // --- Domain Query Router ---
                else if (qLower.includes('domain') || qLower.includes('architecture')) {
                    htmlResult = await resolveDomainQuery(query);
                }
            }

            // =================================================================
            // PRIORITY 4: Simple Keyword Parser
            // =================================================================
            if (!htmlResult) {
                // This now uses the .parse() method of our NEW unified intentParser
                const intent = intentParser.parse(query);
                if (intent && typeof intent.handler === 'function') {
                    console.log(`Routing via: Priority 4 (intentParser.parse()) - Matched ${intent.intent}`);
                    htmlResult = await intent.handler(intent.entity);
                }
            }

            // =================================================================
            // PRIORITY 5: Fallback (Gene Details or Error)
            // =================================================================
            if (!htmlResult) {
                console.log(`Routing via: Priority 5 (Fallback)`);
                if ((match = qLower.match(/(?:tell me about|what is|describe)\s+(.+)/i))) {
                    const term = match[1].trim();
                    htmlResult = await getComprehensiveDetails(term);
                } else {
                    const potentialGenes = (query.match(/\b([A-Z0-9\-\.]{3,})\b/gi) || []).map(g => g.toUpperCase());
                    if (potentialGenes.length === 1 && qLower.length < (potentialGenes[0].length + 5)) {
                         if (window.CiliAI.lookups.geneMap[potentialGenes[0]]) {
                            htmlResult = await getComprehensiveDetails(potentialGenes[0]);
                         }
                    } 
                    
                    if (!htmlResult) {
                        htmlResult = `Sorry, I didn't understand the query: "<strong>${query}</strong>". Please try a simpler term or one of the suggested questions.`;
                    }
                }
            }
            
            // Only add a message if htmlResult is not empty
            // (Plotting functions return "" and add their own messages)
            if (htmlResult) {
                addChatMessage(htmlResult, false);
            }

        } catch (e) {
            console.error("Error in handleAIQuery:", e);
            addChatMessage(`An internal CiliAI error occurred: ${e.message}`, false);
        }
    }


    // ==========================================================
    // 10. EVENT LISTENERS & STARTUP
    // ==========================================================

 // --- Placeholder functions from old script, to be replaced by new handlers ---
    // These are the *real* handlers for the new UI
    
    // Called by the simple SVG diagram click
    window.selectComp = function(id) {
        document.querySelectorAll('.cilia-part').forEach(el => el.classList.remove('selected'));
        const el = document.getElementById(id);
        if(el) el.classList.add('selected');
        
        const data = structureInfoMap[id];
        if (!data) return;

        const genes = window.CiliAI.lookups.byLocalization[data.title] || 
                      window.CiliAI.lookups.byLocalization[data.title.toLowerCase()] || 
                      data.genes || []; // Fallback to static list

        const bar = document.getElementById('bottomBar');
        if (genes.length > 0) {
            bar.innerHTML = `<h3>${data.title} (${genes.length} genes)</h3>
            <div class="gene-list">${genes.slice(0, 40).map(g => 
                `<span class="gene-badge" data-gene="${g}" onclick="searchGene('${g}')">${g}</span>`
            ).join('')}${genes.length > 40 ? `<span style="font-size:11px;color:#666;padding:5px;">...+${genes.length-40} more</span>` : ''}</div>`;
        } else {
            bar.innerHTML = `<h3>${data.title}</h3><p style="color:#666;font-size:12px;">No genes found in database. Try searching directly.</p>`;
        }
        
        addChatMessage(`Selected <strong>${data.title}</strong>. Found ${genes.length} genes.`, false);
    }

    // Called by the "Find Gene" button
    window.searchGene = function(name) {
        const query = name || document.getElementById('geneSearch').value.trim().toUpperCase();
        if (!query) return;
        handleGeneSearch(query, true);
    }
    
    // Called by "Show UMAP" button
    window.showUMAP = function() {
        addChatMessage('Show UMAP', true);
        handleAIQuery('Plot UMAP expression for FOXJ1'); // Example query
    }

    // Called by "Send" button
    window.sendMsg = function() {
        handleUserSend();
    }
    
    // Called by feedback buttons
    window.react = function(type) {
        if (type === 'up') {
            addChatMessage('Thanks for the feedback! 🙏', false);
        } else {
            addChatMessage('Sorry about that. What specifically would help?', false);
        }
    }
    
    // Called by "New Chat" button (if added)
    window.clearChat = function() {
        if (confirm('Start new conversation?')) {
            document.getElementById('messages').innerHTML = '';
            document.querySelectorAll('.cilia-part').forEach(el => el.classList.remove('selected'));
            addChatMessage('Welcome back! How can I help?', false);
        }
    }
    
    // Called by heatmap download buttons
    window.downloadPlot = function(divId, filename) {
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
