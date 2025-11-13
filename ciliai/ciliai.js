/* ==============================================================
   CiliAI – Interactive Explorer (v3.3 – Nov 13, 2025)
   ==============================================================
   • MERGED: Combines the v2.1 data engine (loadCiliAIData, etc.)
     with the v3.2 interactive SVG layout.
   • DATA-AWARE: Uses real `window.CiliAI.lookups.geneMap` and
     `window.parseQuery` instead of mock data.
   • CUSTOM SVG: Still generates the custom SVG showing the
     cilium in context with its surrounding organelles.
   • All text is in English.
   ============================================================== */

(function () {
    'use strict';

    // --- 1. GLOBAL & DATA-LOADING (from v2.1) ---
    function ensureArray(value) {
            if (Array.isArray(value)) return value;
            if (value === null || value === undefined) return [];
            return [value];
        }

    // Global CiliAI object
    window.CiliAI = {
        data: {},
        lookups: {},
        ready: false,
        masterData: []
    };

    /**
     * Initializes the CiliAI module: loads data, builds lookups,
     * and then displays the page.
     */
    async function initCiliAI() {
        console.log('CiliAI: Initializing (v3.3)...');
        await loadCiliAIData();
        if (!Array.isArray(window.CiliAI.masterData)) {
            console.warn('masterData not array. Initializing empty.');
            window.CiliAI.masterData = [];
        }
        buildLookups();
        // Note: setupEventListeners() is now called inside displayCiliAIPage()
        // because the elements don't exist yet.
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
                    ensureArray(g.complex_components[name]).forEach(gg => {
                      if (!L.complexByName[name].includes(gg)) L.complexByName[name].push(gg);
               });
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
                const loc = String(g.localization);
                if (!L.byLocalization[loc]) L.byLocalization[loc] = [];
                if (!L.byLocalization[loc].includes(key)) L.byLocalization[loc].push(key);
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


    // --- 2. STATIC UI DATA (from v3.2) ---

    // ==============================================================
// 4. NEW PAGE DISPLAY (v3.4 - Composite SVG)
//    (Replace your old displayCiliAIPage function with this)
// ==============================================================

    // --- Data for the SVG and UI ---
    // This is static info about the structures themselves.
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
     * This is the primary function CiliaHub will call to build the page.
     * It injects all HTML, CSS, and SVG content.
     */
    window.displayCiliAIPage = async function () {
        console.log("CiliAI: displayCiliAIPage() (v3.4) called.");
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

    // --- 5. HTML & CSS INJECTION ---

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
              --cilia-membrane: #96ceb4;
              /* Organelle Colors (compatible) */
              --org-nucleus: #1a6fb3;
              --org-nucleolus: #003e80;
              --org-mitochondria: #0097b2;
              --org-golgi: #1e81ce;
              --org-vesicle: #66b7ff;
              --org-lysosome: #2fa0e5;
              --org-peroxisome: #5fb9ff;
              --org-ribosome: #7fc8ff;
              --org-cytoplasm: #0e84b8;
              --org-pm: #004c8c;
              --org-microtubule: #6ecbff;
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
              height: 560px; overflow: auto; border: 1px solid var(--border);
              border-radius: 12px; background: #fdfdfd; padding: 0;
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
            .structure-axoneme { fill: var(--cilia-axoneme) !important; color: var(--cilia-axoneme); }
            .structure-basal-body { fill: var(--cilia-basal-body) !important; color: var(--cilia-basal-body); }
            .structure-transition-zone { fill: var(--cilia-tz) !important; color: var(--cilia-tz); }
            .structure-ciliary-membrane { stroke: var(--cilia-membrane) !important; fill: none; stroke-width: 5px; color: var(--cilia-membrane); }
            .structure-nucleus { fill: var(--org-nucleus) !important; color: var(--org-nucleus); }
            .structure-nucleolus { fill: var(--org-nucleolus) !important; color: var(--org-nucleolus); }
            .structure-mitochondria { fill: var(--org-mitochondria) !important; color: var(--org-mitochondria); }
            .structure-golgi-apparatus { fill: var(--org-golgi) !important; color: var(--org-golgi); }
            .structure-golgi-vesicle { fill: var(--org-vesicle) !important; color: var(--org-vesicle); }
            .structure-lysosome { fill: var(--org-lysosome) !important; color: var(--org-lysosome); }
            .structure-peroxisome { fill: var(--org-peroxisome) !important; color: var(--org-peroxisome); }
            .structure-ribosomes { fill: var(--org-ribosome) !important; color: var(--org-ribosome); }
            .structure-cytoplasm { fill: var(--org-cytoplasm) !important; opacity: 0.1; color: var(--org-cytoplasm); }
            .structure-plasma-membrane { fill: var(--org-pm) !important; color: var(--org-pm); }
            .structure-microtubule { stroke: var(--org-microtubule) !important; fill: none; stroke-width: 2px; color: var(--org-microtubule); }
            /* --- End Colors --- */


            /* Right Panel: Info */
            .info-panel {
              display: flex;
              flex-direction: column;
              height: fit-content;
            }
            .info-lists h4 {
              font-size: 1.1rem;
              color: var(--primary-dark);
              margin-bottom: 0.75rem;
              border-bottom: 2px solid var(--border);
              padding-bottom: 0.25rem;
            }
            .anat-list {
              list-style: none;
              padding: 0;
              margin: 0;
              max-height: 200px;
              overflow-y: auto;
              border: 1px solid var(--border);
              border-radius: 8px;
            }
            .anat-list li {
              padding: 0.5rem 0.75rem;
              cursor: pointer;
              font-size: 0.95rem;
              border-bottom: 1px solid var(--border);
            }
            .anat-list li:last-child { border-bottom: none; }
            .anat-list li:hover {
              background: #e8f4fd;
            }
            .anat-list li.active {
              background: var(--primary);
              color: white;
              font-weight: 600;
            }

            /* Info Display Panel */
            .organelle-info-panel {
              background: #e8f4fd;
              border: 1px solid #bbdefb;
              border-radius: 12px;
              padding: 1rem 1.2rem;
              min-height: 100px;
              margin-top: 1.5rem;
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
     * Returns the full HTML string for the page content.
     */
   /* -------------------------------------------------------------
   1.  Remove the “Interactive Structures” list
   ------------------------------------------------------------- */
function getPageHTML() {
    return `
    <div class="interactive-cilium">
    <svg viewBox="0 0 600 650" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">
        <!-- ==== GRADIENTS (same colours as the original cilium) ==== -->
        <defs>
            <linearGradient id="cytosolGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#F5F7FA"/>
                <stop offset="100%" stop-color="#E9EDF2"/>
            </linearGradient>
            <radialGradient id="nucleusGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#D8DEE9"/>
                <stop offset="100%" stop-color="#C8D0DD"/>
            </radialGradient>
        </defs>

        <!-- ==== 1. CELL BODY (cytoplasm) ==== -->
        <path id="cell-body" class="cilia-part"
              fill="url(#cytosolGradient)" stroke="#D8DEE9" stroke-width="3"
              d="M 80,620 C -20,520 40,340 300,320 C 560,340 620,520 520,620 Z"/>

        <!-- ==== 2. NUCLEUS ==== -->
        <circle id="nucleus" class="cilia-part"
                fill="url(#nucleusGradient)" stroke="#B0B8C8" stroke-width="3"
                cx="300" cy="520" r="70"/>

        <!-- ==== 3. OTHER ORGANELLES (same colours as original cilium) ==== -->
        <!-- Golgi -->
        <g id="golgi-apparatus" class="cilia-part" transform="translate(120,380) scale(0.9)">
            <path d="M 0,0 C 15,30 60,30 75,0 M 10,20 C 25,50 65,50 80,20 M 20,40 C 35,70 70,70 85,40"
                  fill="none" stroke="#4A5568" stroke-width="4"/>
        </g>

        <!-- Mitochondrion (next to basal body) -->
        <g id="mitochondria" class="cilia-part" transform="translate(280,260)">
            <ellipse cx="0" cy="0" rx="55" ry="28" fill="#4A5568"/>
            <path d="M -40,-8 C -20,8 20,-8 40,8" fill="none" stroke="#E9EDF2" stroke-width="3"/>
            <path d="M -40,8 C -20,-8 20,8 40,-8" fill="none" stroke="#E9EDF2" stroke-width="3"/>
        </g>

        <!-- Lysosome -->
        <circle id="lysosome" class="cilia-part" cx="420" cy="460" r="22"
                fill="#718096" stroke="#4A5568" stroke-width="2"/>

        <!-- Peroxisome -->
        <circle id="peroxisome" class="cilia-part" cx="460" cy="510" r="15"
                fill="#A0AEC0" stroke="#718096" stroke-width="2"/>

        <!-- Ribosomes (tiny dots) -->
        <g id="ribosomes" class="cilia-part">
            <circle cx="150" cy="480" r="3" fill="#4A5568"/>
            <circle cx="165" cy="485" r="3" fill="#4A5568"/>
            <circle cx="155" cy="495" r="3" fill="#4A5568"/>
            <circle cx="380" cy="380" r="3" fill="#4A5568"/>
            <circle cx="395" cy="385" r="3" fill="#4A5568"/>
        </g>

        <!-- Microtubules (cytoskeleton) -->
        <g id="microtubule" class="cilia-part">
            <path d="M 200,600 L 270,340" stroke="#4A5568" stroke-width="2"/>
            <path d="M 400,600 L 330,340" stroke="#4A5568" stroke-width="2"/>
        </g>

        <!-- ==== 4. CILIUM (exact same colours & IDs as before) ==== -->
        <!-- Basal body -->
        <rect id="basal-body" class="cilia-part"
              fill="#4A5568" x="285" y="300" width="30" height="22"/>

        <!-- Transition zone -->
        <path id="transition-zone" class="cilia-part"
              fill="#718096" stroke="#4A5568" stroke-width="2"
              d="M 287,300 L 280,280 L 320,280 L 313,300 Z"/>

        <!-- Ciliary membrane (dashed) -->
        <path id="ciliary-membrane" class="cilia-part"
              fill="none" stroke="#A0AEC0" stroke-width="3" stroke-dasharray="6,6"
              d="M 280,280 L 295,80 L 305,80 L 320,280 Z"/>

        <!-- Axoneme (core) -->
        <path id="axoneme" class="cilia-part"
              fill="none" stroke="#4A5568" stroke-width="4"
              d="M 295,280 L 298,85 L 302,85 L 305,280 Z"/>
    </svg>
</div>            
</div>
            </div>
        </div>
    </div>`;
}
   
    // --- 6. SVG GENERATION & INTERACTION ---
/* -------------------------------------------------------------
   2.  Full-cell SVG (cilium + organelles)
   ------------------------------------------------------------- */
function generateAndInjectSVG() {
    const svgContainer = document.getElementById('cilia-svg');
    if (!svgContainer) return;

    const svgHTML = `
    <svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
        <style>
            .svg-label      {font-size:10px; font-family:'Inter',sans-serif; fill:#000; text-anchor:middle;}
            .svg-label-light{font-size:10px; font-family:'Inter',sans-serif; fill:#fff; text-anchor:middle;}
        </style>

        <!-- Cytoplasm (background) -->
        <g id="cytoplasm" class="compartment structure-cytoplasm">
            <rect width="500" height="500"/>
        </g>

        <!-- Nucleus & Nucleolus -->
        <g id="nucleus" class="compartment structure-nucleus">
            <circle cx="250" cy="400" r="80"/>
            <text x="250" y="405" class="svg-label-light">Nucleus</text>
        </g>
        <g id="nucleolus" class="compartment structure-nucleolus">
            <circle cx="275" cy="385" r="25"/>
            <text x="275" y="388" class="svg-label-light">Nucleolus</text>
        </g>

        <!-- Plasma membrane -->
        <g id="plasma-membrane" class="compartment structure-plasma-membrane">
            <path d="M 0,200 Q 250,180 500,200 V 500 H 0 Z"/>
        </g>

        <!-- Golgi -->
        <g id="golgi-apparatus" class="compartment structure-golgi-apparatus"
            transform="translate(70,250) scale(0.8)">
            <path d="M 0,0 C 10,20 40,20 50,0 M 10,15 C 20,35 50,35 60,15 M 20,30 C 30,50 60,50 70,30"
                  fill="none" stroke="#fff" stroke-width="5"/>
            <text x="35" y="60" class="svg-label-light">Golgi</text>
        </g>
        <g id="golgi-vesicle" class="compartment structure-golgi-vesicle">
            <circle cx="150" cy="260" r="8"/>
            <circle cx="140" cy="280" r="5"/>
        </g>

        <!-- Lysosome & Peroxisome -->
        <g id="lysosome" class="compartment structure-lysosome">
            <circle cx="380" cy="280" r="15"/>
            <text x="380" y="283" class="svg-label-light">Lysosome</text>
        </g>
        <g id="peroxisome" class="compartment structure-peroxisome">
            <circle cx="400" cy="320" r="10"/>
        </g>

        <!-- Ribosomes -->
        <g id="ribosomes" class="compartment structure-ribosomes">
            <circle cx="100" cy="320" r="2"/> <circle cx="105" cy="325" r="2"/>
            <circle cx="110" cy="318" r="2"/> <circle cx="95"  cy="330" r="2"/>
            <circle cx="300" cy="250" r="2"/> <circle cx="305" cy="255" r="2"/>
            <circle cx="310" cy="248" r="2"/> <circle cx="295" cy="260" r="2"/>
        </g>

        <!-- Microtubules -->
        <g id="microtubule" class="compartment structure-microtubule">
            <path d="M 150,450 L 220,220"/>
            <path d="M 350,450 L 280,220"/>
        </g>

        <!-- Mitochondrion (next to basal body) -->
        <g id="mitochondria" class="compartment structure-mitochondria"
            transform="translate(140,195)">
            <ellipse cx="0" cy="0" rx="40" ry="20"/>
            <path d="M -30,-5 C -10,5 10,-5 30,5" stroke="#fff" fill="none" stroke-width="2"/>
            <text x="0" y="3" class="svg-label-light">Mitochondrion</text>
        </g>

        <!-- CILIUM (centered at top) -->
        <g id="ciliary-membrane" class="compartment structure-ciliary-membrane"
            transform="translate(0,-20)">
            <path d="M 220,210 Q 200,100 250,20 Q 300,100 280,210"/>
        </g>
        <g id="axoneme" class="compartment structure-axoneme"
            transform="translate(0,-20)">
            <path d="M 235,190 Q 240,100 250,30 Q 260,100 265,190 Z"/>
            <text x="250" y="120" class="svg-label-light">Axoneme</text>
        </g>
        <g id="transition-zone" class="compartment structure-transition-zone"
            transform="translate(0,-20)">
            <rect x="230" y="190" width="40" height="20" rx="5"/>
            <text x="250" y="204" class="svg-label-light">TZ</text>
        </g>
        <g id="basal-body" class="compartment structure-basal-body"
            transform="translate(0,-20)">
            <rect x="225" y="210" width="50" height="30" rx="5"/>
            <text x="250" y="228" class="svg-label-light">Basal Body</text>
        </g>
    </svg>`;

    svgContainer.innerHTML = svgHTML;
    setupSVGInteraction();          // makes every <g> clickable
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

        // Clear list active states
        document.querySelectorAll('.anat-list li.active').forEach(li => {
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

        // Highlight List
        const listEl = document.querySelector(`#structure-list li[data-structure-id="${id}"]`);
        if (listEl) listEl.classList.add('active');
        
        // Show info (pass title, description, and *potential* genes)
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
        
        msg.innerHTML = html; // Use innerHTML to allow <em>, <strong>, etc.
        
        if (!isUser) {
            msg.innerHTML += `
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
     * Processes the user's query and generates an AI response.
     * This now uses the *REAL* data-aware functions.
     */
    function handleAIQuery(query) {
        // Check if CiliAI engine is ready
        if (!window.CiliAI || !window.CiliAI.ready || !window.parseQuery || !window.generateAnswer) {
            addChatMessage(`<em>Error: CiliAI engine is not loaded. Please wait or refresh.</em>`, false);
            return;
        }

        // 1. Parse the query
        const parsedIntent = window.parseQuery(query);

        // 2. Generate the answer
        const answer = window.generateAnswer(parsedIntent);

        // 3. Add the AI's response to the chat
        addChatMessage(answer.html, false);

        // 4. Handle side-effects
        if (answer.highlightGene) {
            handleGeneSearch(answer.highlightGene, false); // false = don't re-query AI
        }
    }

    // --- 8. EVENT LISTENER SETUP ---

    /**
     * Attaches all primary event listeners for the page.
     * Renamed to avoid conflict with v2.1's `setupEventListeners`.
     */
    function setupPageEventListeners() {
        // Guard against elements not existing
        const sendBtn = document.getElementById('sendBtn');
        const chatInput = document.getElementById('chatInput');
        const findGeneBtn = document.getElementById('findGeneBtn');
        const geneSearchInput = document.getElementById('geneSearchInput');
        const showUmapBtn = document.getElementById('showUmapBtn');
        const structureList = document.getElementById('structure-list');

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

        // Structure List
        if (structureList) structureList.addEventListener('click', e => {
            const li = e.target.closest('li');
            if (li && li.dataset.structureId) {
                activateStructure(li.dataset.structureId);
            }
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
        });
    }

    /**
     * Handles the "Find Gene" button click or AI highlight request.
     * This is now DATA-AWARE.
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
            locString = String(geneData.localization);
            const locLower = locString.toLowerCase();
            
            // Match in order of specificity
            if (locLower.includes('transition zone')) loc = 'transition-zone';
            else if (locLower.includes('axoneme')) loc = 'axoneme';
            else if (locLower.includes('basal body')) loc = 'basal-body';
            else if (locLower.includes('membrane')) loc = 'ciliary-membrane';
            else if (locLower.includes('nucleus')) loc = 'nucleus';
            else if (locLower.includes('mitochondrion')) loc = 'mitochondria';
            else if (locLower.includes('golgi')) loc = 'golgi-apparatus';
            else if (locLower.includes('cytoplasm')) loc = 'cytoplasm';
        }
        
        // Highlight and show info
        clearAllHighlights();
        if (loc !== 'unknown' && document.getElementById(loc)) {
            document.getElementById(loc).classList.add('active');
        }
        showInfoPanel(`Gene: ${gene}`, (geneData.description || 'No description available.') + `<br><strong>Localization:</strong> ${locString}`, [gene]);

        // Also ask the AI about it if triggered by user
        if (queryAI) {
            addChatMessage(`What is ${gene}?`, true);
            handleAIQuery(`What is ${gene}?`);
        }
    }

    // --- 9. AI QUERY ENGINE PLACEHOLDERS (from v2.1) ---
    // These functions are expected to exist in your *other* CiliAI JS file.
    // The placeholder warnings from your console log indicate they are missing.
    // You MUST include your *real* parseQuery and generateAnswer functions.
    
    if (!window.parseQuery) {
        console.warn("CiliAI: `parseQuery` is not defined! Using placeholder.");
        window.parseQuery = function(query) {
            console.log("Using placeholder parseQuery");
            let gene = null;
            const geneMatch = query.match(/what is (\w+)/i) || query.match(/(\w+)/i);
            if (geneMatch) gene = geneMatch[1].toUpperCase();
            return { query, gene, highlightGene: gene };
        }
    }
    
    if (!window.generateAnswer) {
        console.warn("CiliAI: `generateAnswer` is not defined! Using placeholder.");
        window.generateAnswer = function(intent) {
            console.log("Using placeholder generateAnswer");
            let html = `I received your query about: <strong>${intent.query}</strong>. `;
            let highlightGene = intent.highlightGene;
            
            if (intent.gene && window.CiliAI.ready) {
                const geneData = window.CiliAI.lookups.geneMap[intent.gene];
                if (geneData) {
                    html = `<strong>${intent.gene}</strong>: ${geneData.description || 'No description found.'} <br><strong>Localization:</strong> ${geneData.localization || 'Unknown'}`;
                } else {
                    html = `Sorry, I don't have information on <strong>${intent.gene}</strong>.`;
                    highlightGene = null;
                }
            } else if (intent.query.toLowerCase().includes('umap')) {
                html = "Displaying the UMAP plot is not yet fully integrated in this view, but the 'Show UMAP' button can trigger this action.";
            } else {
                html = "Sorry, I can only provide gene information right now. Try 'What is IFT88?'.";
                highlightGene = null;
            }
            
            return { html, highlightGene };
        }
    }
    
    // --- 10. EVENT LISTENERS & STARTUP (from v2.1) ---
    // This function from v2.1 is NO LONGER NEEDED, as setupPageEventListeners() replaces it.
    /*
    function setupEventListeners() {
        // This function is intentionally left blank
        // as the new UI (v3.4) handles its own listeners
        // inside setupPageEventListeners()
    }
    */
   // We must replace the empty `setupEventListeners` from v2.1
   // with a new one that does nothing, to avoid breaking the init flow.
   function setupEventListeners() {
        console.log("CiliAI: v2.1 setupEventListeners() called (and ignored). Page listeners are set by displayCiliAIPage().");
   }


    // This listener replaces the v3.2 listeners
    window.addEventListener('hashchange', () => {
        if (window.location.hash.includes('/ciliai')) {
            // Check if data is ready. If not, init will handle it.
            // If data IS ready, we need to re-display the page.
            if (window.CiliAI.ready && !document.querySelector('.ciliai-page')) {
                displayCiliAIPage();
            }
        }
    });

    // Initial load check
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCiliAI);
    } else {
        initCiliAI();
    }

})();
