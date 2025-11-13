/* ==============================================================
   CiliAI – Updated Full Implementation for GitHub Pages
   ==============================================================
   Version: 1.0 (November 13, 2025)
   Integration: Drop this file into /ciliai/ciliai.js
   Usage: Include <script src="ciliai/ciliai.js"></script> in your index.html
   Then call window.displayCiliAIPage() to render the UI.
   Dependencies: Plotly.js (loaded dynamically), Cytoscape (loaded dynamically)
   ============================================================== */

(function () {
    'use strict';

    // Global CiliAI object
    window.CiliAI = {
        data: {},
        lookups: {},
        ready: false,
        masterData: []
    };

    // Initialize on load
    async function initCiliAI() {
        console.log('CiliAI: Initializing...');
        await loadCiliAIData();
        buildLookups();
        setupEventListeners(); // For dynamic UI interactions
        window.CiliAI.ready = true;
        console.log('CiliAI: Ready!');
        // Auto-display if on ciliAI page
        if (window.location.hash === '#/ciliai' || document.querySelector('.content-area')) {
            setTimeout(displayCiliAIPage, 500);
        }
    }

    // ——————————————————————————————————————
    // 1. DATA LOADER (Enhanced from original)
    // ——————————————————————————————————————
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
                if (!res.ok) throw new Error(`HTTP ${res.status} - ${url}`);
                if (type === 'json') return await res.json();
                return await res.text();
            } catch (err) {
                clearTimeout(id);
                console.warn(`safeFetch failed for ${url}:`, err.message || err);
                return null;
            }
        }

        console.log('CiliAI: Fetching all data (parallel)...');

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

        // Set global caches for plots (as in original)
        window.liPhylogenyCache = liRaw;
        window.neversPhylogenyCache = neversRaw;
        window.umapDataCache = umapRaw;
        window.cellxgeneDataCache = cellxgeneRaw;
        window.CiliAI_UMAP = umapRaw || [];
        window.CiliAI_snRNA = cellxgeneRaw || {};

        // Process screens data
        const screensByGene = {};
        if (screensRaw && typeof screensRaw === 'object') {
            Object.keys(screensRaw).forEach(geneKey => {
                const key = geneKey.toUpperCase();
                screensByGene[key] = screensRaw[geneKey].map(screen => ({
                    dataset: screen.source || screen.dataset || 'Unknown',
                    classification: screen.result || screen.classification || 'Not Reported',
                    paper_link: screen.paper_link || screen.paper || null,
                    mean_percent_ciliated: screen.mean_percent_ciliated ?? screen.mean ?? null,
                    sd_percent_ciliated: screen.sd_percent_ciliated ?? screen.sd ?? null,
                    z_score: screen.z_score ?? screen.z ?? null
                }));
            });
        }

        // Process single-cell expression data
        const scExpressionByGene = {};
        if (cellxgeneRaw && typeof cellxgeneRaw === 'object') {
            Object.keys(cellxgeneRaw).forEach(geneKey => {
                scExpressionByGene[geneKey.toUpperCase()] = cellxgeneRaw[geneKey];
            });
        }

        // Process tissue expression data
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
                normalizedHeader.forEach((key, index) => {
                    obj[key] = cols[index] ?? '';
                });
                return obj;
            });
        }
        const rnaRows = parseTsvToObjects(rnaTsv);
        rnaRows.forEach(row => {
            const geneName = row.gene_name || row.gene || row.gene_symbol || row.geneid || row.gene_id;
            if (!geneName) return;
            const key = geneName.toUpperCase();
            const tissue = row.tissue || row.tissue_name || row.tissue_type || row.sample || 'unknown';
            const expressionValue = parseFloat(row.ntpm ?? row.ntpms ?? row.tpm ?? row.value ?? NaN);
            if (!tissueExpressionByGene[key]) {
                tissueExpressionByGene[key] = {};
            }
            tissueExpressionByGene[key][tissue] = Number.isFinite(expressionValue) ? expressionValue : null;
        });

        // Process CORUM complexes
        const corumByGene = {};
        if (Array.isArray(corumRaw)) {
            corumRaw.forEach(complex => {
                const complexName = complex.complex_name || complex.name || complex.complex || 'Unnamed Complex';
                const subunits = Array.isArray(complex.subunits) ? complex.subunits : [];
                const geneNames = subunits.map(subunit =>
                    (subunit.gene_name || subunit.gene || subunit.name || '').toString().toUpperCase()
                ).filter(name => name);
                geneNames.forEach(geneName => {
                    if (!corumByGene[geneName]) {
                        corumByGene[geneName] = {};
                    }
                    corumByGene[geneName][complexName] = geneNames;
                });
            });
        }

        // Process domain data
        const domainsByGene = {};
        if (domainRaw && typeof domainRaw === 'object') {
            Object.keys(domainRaw).forEach(geneKey => {
                const key = geneKey.toUpperCase();
                const domainEntries = domainRaw[geneKey];
                if (Array.isArray(domainEntries)) {
                    domainsByGene[key] = {
                        pfam_ids: [...new Set(domainEntries.map(d => d.domain_id).filter(Boolean))],
                        domain_descriptions: [...new Set(domainEntries.map(d => d.description).filter(Boolean))]
                    };
                }
            });
        }

        // Process Li 2014 phylogeny data
        const liMap = {};
        if (liRaw?.genes) {
            Object.keys(liRaw.genes).forEach(entrezId => {
                const geneData = liRaw.genes[entrezId];
                const geneSymbol = geneData.g || geneData.gene;
                if (geneSymbol) {
                    const key = geneSymbol.toUpperCase();
                    liMap[key] = {
                        class: (Array.isArray(liRaw.summary?.class_list) && liRaw.summary.class_list[geneData.c]) || 'Unknown',
                        class_id: geneData.c,
                        species_data: geneData.s || [],
                        entrez_id: geneData.e || entrezId
                    };
                }
            });
        }

        // Process Nevers 2017 phylogeny data
        const neversMap = {};
        if (neversRaw?.genes) {
            Object.keys(neversRaw.genes).forEach(geneSymbol => {
                if (geneSymbol === 'Gene Name') return;
                const geneData = neversRaw.genes[geneSymbol];
                const key = geneSymbol.toUpperCase();
                if (geneData && geneData.s && Array.isArray(geneData.s) && geneData.s.length > 0) {
                    neversMap[key] = {
                        species_count: geneData.s.length,
                        species_data: geneData.s,
                        in_ciliated_organisms: calculateCiliatedOrganisms(geneData.s, neversRaw)
                    };
                }
            });
        }
        function calculateCiliatedOrganisms(speciesIndices, neversData) {
            if (!neversData?.organism_groups?.ciliated_organisms) return speciesIndices.length;
            let ciliatedCount = 0;
            speciesIndices.forEach(idx => {
                if (idx < neversData.organism_groups.ciliated_organisms.length) {
                    ciliatedCount++;
                }
            });
            return ciliatedCount;
        }

        // Main data integration (from original)
        function extractCiliopathyInfo(geneObj) {
            const splitString = (str) => String(str).split(';').map(s => s.trim()).filter(Boolean);
            const ciliopathies = new Set();
            const classifications = new Set();
            if (Array.isArray(geneObj.ciliopathy)) {
                geneObj.ciliopathy.forEach(item => splitString(item).forEach(c => ciliopathies.add(c)));
            } else if (typeof geneObj.ciliopathy === 'string') {
                splitString(geneObj.ciliopathy).forEach(c => ciliopathies.add(c));
            }
            if (Array.isArray(geneObj.ciliopathy_classification)) {
                geneObj.ciliopathy_classification.forEach(item => splitString(item).forEach(c => classifications.add(c)));
            } else if (typeof geneObj.ciliopathy_classification === 'string') {
                splitString(geneObj.ciliopathy_classification).forEach(c => classifications.add(c));
            }
            return {
                ciliopathy: Array.from(ciliopathies),
                ciliopathy_classification: Array.from(classifications)
            };
        }

        const hubData = Array.isArray(ciliahubRaw) ? ciliahubRaw : [];
        if (!hubData.length) {
            console.error('ciliahub_data.json empty or missing');
            window.CiliAI_MasterData = [];
            return [];
        }

        const masterData = hubData.map(gene => {
            const geneSymbol = gene.gene ?? gene.g ?? gene.name ?? gene.symbol ?? null;
            const geneKey = geneSymbol ? geneSymbol.toUpperCase() : null;
            const explicitFields = {
                gene: geneSymbol,
                ensembl_id: gene.ensembl_id || null,
                lof_effects: gene.lof_effects || "Not Reported",
                percent_ciliated_cells_effects: gene.percent_ciliated_cells_effects || "Not Reported",
                overexpression_effects: gene.overexpression_effects || "Not Reported",
                description: gene.description || null,
                omim_id: gene.omim_id || null,
                functional_summary: gene.functional_summary || null,
                localization: gene.localization || null,
                reference: gene.reference || null,
                pfam_ids: Array.isArray(gene.pfam_ids) ? gene.pfam_ids : [],
                domain_descriptions: Array.isArray(gene.domain_descriptions) ? gene.domain_descriptions : [],
                synonym: gene.synonym || null,
                evidence_source: gene.evidence_source || "CiliaMiner",
                functional_category: gene.functional_category || null,
                string_link: gene.string_link || null
            };
            const orthologs = {
                ortholog_mouse: gene.ortholog_mouse || null,
                ortholog_c_elegans: gene.ortholog_c_elegans || null,
                ortholog_xenopus: gene.ortholog_xenopus || null,
                ortholog_zebrafish: gene.ortholog_zebrafish || null,
                ortholog_drosophila: gene.ortholog_drosophila || null
            };
            const { ciliopathy, ciliopathy_classification } = extractCiliopathyInfo(gene);
            const originalScreens = Array.isArray(gene.screens) ? gene.screens : [];
            const additionalScreens = geneKey ? (screensByGene[geneKey] || []) : [];
            const allScreens = [...originalScreens, ...additionalScreens];
            const externalDomains = geneKey ? (domainsByGene[geneKey] || { pfam_ids: [], domain_descriptions: [] }) : { pfam_ids: [], domain_descriptions: [] };
            const originalComplexes = gene.complex_components && typeof gene.complex_components === 'object' ? gene.complex_components : {};
            const corumComplexes = geneKey ? (corumByGene[geneKey] || {}) : {};
            const mergedComplexes = { ...originalComplexes, ...corumComplexes };
            const scExpression = geneKey ? (scExpressionByGene[geneKey] || null) : null;
            const tissueExpression = geneKey ? (tissueExpressionByGene[geneKey] || null) : null;
            const modules = [];
            if (geneKey && liMap[geneKey]) {
                const className = liMap[geneKey].class;
                if (className && className !== 'No_data' && className !== 'Other') {
                    modules.push(className.replace(/_/g, ' '));
                }
            }
            const phylogeny = {
                li_2014: geneKey ? (liMap[geneKey] || null) : null,
                nevers_2017: geneKey ? (neversMap[geneKey] || null) : null
            };
            return {
                ...gene,
                ...explicitFields,
                ...orthologs,
                ciliopathy,
                ciliopathy_classification,
                screens: allScreens,
                expression: {
                    scRNA: scExpression,
                    tissue: tissueExpression
                },
                complex_components: mergedComplexes,
                pfam_ids: Array.from(new Set([
                    ...explicitFields.pfam_ids,
                    ...externalDomains.pfam_ids
                ])),
                domain_descriptions: Array.from(new Set([
                    ...explicitFields.domain_descriptions,
                    ...externalDomains.domain_descriptions
                ])),
                functional_modules: modules,
                phylogeny
            };
        });

        // Add phylogeny-only genes
        function addPhylogenyOnlyGenes(masterData, liMap, neversMap) {
            const existingGenes = new Set(masterData.map(g => g.gene?.toUpperCase()));
            const phylogenyOnlyGenes = [];
            Object.keys(liMap).forEach(geneSymbol => {
                if (!existingGenes.has(geneSymbol)) {
                    phylogenyOnlyGenes.push({
                        gene: geneSymbol,
                        description: `Gene found in Li et al. 2014 evolutionary analysis`,
                        evidence_source: "Li_2014_Phylogeny",
                        phylogeny: {
                            li_2014: liMap[geneSymbol],
                            nevers_2017: neversMap[geneSymbol] || null
                        },
                        is_phylogeny_only: true
                    });
                }
            });
            Object.keys(neversMap).forEach(geneSymbol => {
                if (!existingGenes.has(geneSymbol) && !phylogenyOnlyGenes.find(g => g.gene === geneSymbol)) {
                    phylogenyOnlyGenes.push({
                        gene: geneSymbol,
                        description: `Gene found in Nevers et al. 2017 evolutionary analysis`,
                        evidence_source: "Nevers_2017_Phylogeny",
                        phylogeny: {
                            li_2014: liMap[geneSymbol] || null,
                            nevers_2017: neversMap[geneSymbol]
                        },
                        is_phylogeny_only: true
                    });
                }
            });
            console.log(`Added ${phylogenyOnlyGenes.length} phylogeny-only genes to master data`);
            return [...masterData, ...phylogenyOnlyGenes];
        }

        window.CiliAI.masterData = addPhylogenyOnlyGenes(masterData, liMap, neversMap);
        window.CiliAI.data = {
            screensByGene,
            scExpressionByGene,
            tissueExpressionByGene,
            corumByGene,
            domainsByGene,
            liMap,
            neversMap,
            umap: umapRaw || []
        };

        console.log(`CiliAI: ${window.CiliAI.masterData.length} genes successfully integrated`);
    }

    // ——————————————————————————————————————
    // 2. LOOKUP BUILDERS (Enhanced)
    // ——————————————————————————————————————
    function buildLookups() {
        const L = window.CiliAI.lookups = {};
        const master = window.CiliAI.masterData;

        // Gene Map
        L.geneMap = {};
        master.forEach(g => {
            const sym = (g.gene || '').toUpperCase();
            if (sym) L.geneMap[sym] = g;
        });

        // Complex by Gene and Name
        L.complexByGene = {};
        L.complexByName = {};
        master.forEach(g => {
            const key = g.gene?.toUpperCase();
            if (key && g.complex_components) {
                Object.keys(g.complex_components).forEach(comp => {
                    if (!L.complexByGene[key]) L.complexByGene[key] = [];
                    if (!L.complexByGene[key].includes(comp)) L.complexByGene[key].push(comp);
                    if (!L.complexByName[comp]) L.complexByName[comp] = [];
                    const genes = g.complex_components[comp];
                    genes.forEach(gg => {
                        if (!L.complexByName[comp].includes(gg)) L.complexByName[comp].push(gg);
                    });
                });
            }
        });

        // Localization, Modules, Ciliopathy indexes
        L.byLocalization = {};
        L.byModules = {};
        L.byCiliopathy = {};
        master.forEach(g => {
            const key = g.gene?.toUpperCase();
            if (key) {
                // Localization
                const loc = g.localization || '';
                if (loc) {
                    if (!L.byLocalization[loc]) L.byLocalization[loc] = [];
                    if (!L.byLocalization[loc].includes(key)) L.byLocalization[loc].push(key);
                }
                // Modules
                if (g.functional_modules) {
                    g.functional_modules.forEach(m => {
                        if (!L.byModules[m]) L.byModules[m] = [];
                        if (!L.byModules[m].includes(key)) L.byModules[m].push(key);
                    });
                }
                // Ciliopathy
                if (g.ciliopathy) {
                    g.ciliopathy.forEach(c => {
                        const cLower = c.toLowerCase();
                        if (!L.byCiliopathy[cLower]) L.byCiliopathy[cLower] = [];
                        if (!L.byCiliopathy[cLower].includes(key)) L.byCiliopathy[cLower].push(key);
                    });
                }
            }
        });

        // UMAP by Gene
        L.umapByGene = {};
        (window.CiliAI.data.umap || []).forEach(pt => {
            if (pt.gene) L.umapByGene[pt.gene.toUpperCase()] = pt;
        });

        console.log('CiliAI: Lookups built');
    }

    // ——————————————————————————————————————
    // 3. QUERY PARSER & ENGINE
    // ——————————————————————————————————————
    function parseQuery(input) {
        const q = input.trim().toLowerCase();
        const tokens = input.split(/\s+/).map(t => t.toUpperCase());
        const geneMatch = input.match(/\b([A-Z]{2,}[0-9]?)\b/g) || []; // Better gene regex
        const genes = [...new Set(geneMatch.map(g => g.toUpperCase()))];

        // Intent detection (covers all 20 basic + 10 structured)
        if (q.includes('what is') || q.includes('describe') && genes.length === 1) {
            return { type: 'gene_info', gene: genes[0] };
        }
        if (q.includes('list genes in') && (q.includes('complex=') || q.includes('bbsome'))) {
            return { type: 'complex_genes', complex: extractParam(q, 'complex') || 'BBSome' };
        }
        if (q.includes('localization=') || q.includes('genes localized to')) {
            return { type: 'localization', loc: extractParam(q, 'localization') || 'cilia' };
        }
        if (q.includes('localization of') && genes.length === 1) {
            return { type: 'gene_localization', gene: genes[0] };
        }
        if (q.includes('screens for') || q.includes('gene=') && q.includes('screens')) {
            return { type: 'screens', gene: genes[0] || extractParam(q, 'gene') };
        }
        if (q.includes('domains of') && genes.length === 1) {
            return { type: 'domains', gene: genes[0] };
        }
        if (q.includes('functional modules of') && genes.length === 1) {
            return { type: 'modules', gene: genes[0] };
        }
        if (q.includes('complex components of') && genes.length === 1) {
            return { type: 'gene_complexes', gene: genes[0] };
        }
        if (q.includes('percent ciliated') && genes.length === 1) {
            return { type: 'ciliation_effect', gene: genes[0] };
        }
        if (q.includes('ortholog') && genes.length === 1) {
            const species = extractSpecies(q);
            return { type: 'ortholog', gene: genes[0], species };
        }
        if (q.includes('omim') && genes.length === 1) {
            return { type: 'omim', gene: genes[0] };
        }
        if (q.includes('ciliopathy=') || q.includes('joubert syndrome')) {
            return { type: 'ciliopathy', name: extractParam(q, 'ciliopathy') || 'Joubert' };
        }
        if (q.includes('is') && q.includes('ciliary') && genes.length === 1) {
            return { type: 'is_ciliary', gene: genes[0] };
        }
        if (q.includes('what does') && genes.length === 1) {
            return { type: 'function', gene: genes[0] };
        }
        if (q.includes('functional_modules=') && genes.length === 0) {
            return { type: 'module_genes', module: extractParam(q, 'functional_modules') || 'Ciliary tip' };
        }
        if (q.includes('complexes') && genes.length > 1) {
            return { type: 'shared_complexes', genes };
        }
        if (q.includes('umap=true') || q.includes('plot umap')) {
            return { type: 'umap', gene: genes[0] || extractParam(q, 'gene') };
        }
        if (q.includes('compare expression') && genes.length >= 2) {
            return { type: 'compare_expr', genes, tissue: extractTissue(q) };
        }
        if (q.includes('scRNA_tissue=') || q.includes('expressed in')) {
            const tissue = extractParam(q, 'scRNA_tissue') || extractTissue(q);
            if (q.includes('complex=')) {
                return { type: 'complex_expr', complex: extractParam(q, 'complex'), tissue };
            }
            if (q.includes('functional_modules=')) {
                return { type: 'module_expr', module: extractParam(q, 'functional_modules'), tissue };
            }
            if (q.includes('ciliopathy=')) {
                return { type: 'ciliopathy_expr', ciliopathy: extractParam(q, 'ciliopathy'), tissue };
            }
            if (q.includes('localization=')) {
                return { type: 'localization_expr', loc: extractParam(q, 'localization'), tissue: tissue || 'kidney' };
            }
        }
        if (q.includes('top expressed') && q.includes('cilia')) {
            return { type: 'top_ciliary', tissue: extractTissue(q) || 'kidney' };
        }

        return { type: 'unknown', raw: input };
    }

    function extractParam(q, param) {
        const match = q.match(new RegExp(`${param}=([^\\s,]+)`));
        return match ? match[1] : '';
    }

    function extractSpecies(q) {
        if (q.includes('elegans')) return 'c_elegans';
        if (q.includes('mouse')) return 'mouse';
        if (q.includes('xenopus')) return 'xenopus';
        if (q.includes('zebrafish')) return 'zebrafish';
        if (q.includes('drosophila')) return 'drosophila';
        return null;
    }

    function extractTissue(q) {
        const tissues = ['lung', 'kidney', 'brain', 'testis', 'cerebellum', 'retina', 'colon', 'colonic'];
        for (let t of tissues) {
            if (q.includes(t)) return t.charAt(0).toUpperCase() + t.slice(1);
        }
        return null;
    }

    // Answer generator (covers all queries)
    function generateAnswer(query) {
        const L = window.CiliAI.lookups;
        let html = '';
        let plotData = null;
        const data = {};

        switch (query.type) {
            case 'gene_info':
            case 'describe':
            case 'function': {
                const g = L.geneMap[query.gene];
                if (!g) return { html: `<p>Gene ${query.gene} not found.</p>` };
                const screens = g.screens || [];
                const domains = g.domain_descriptions || [];
                const complexes = L.complexByGene[query.gene] || [];
                const modules = g.functional_modules || [];
                html = `
                    <div class="result-card">
                        <h3>${query.gene}</h3>
                        <p><strong>Description:</strong> ${g.description || g.functional_summary || 'N/A'}</p>
                        <p><strong>Localization:</strong> ${g.localization || 'Unknown'}</p>
                        <p><strong>Functional Modules:</strong> ${modules.join(', ') || 'None'}</p>
                        <p><strong>Complexes:</strong> ${complexes.join(', ') || 'None'}</p>
                        ${screens.length ? `<h4>Screens</h4><table><tr><th>Dataset</th><th>Classification</th><th>Z-Score</th><th>% Ciliated</th></tr>${screens.map(s => `<tr><td>${s.dataset}</td><td>${s.classification}</td><td>${s.z_score || '-'}</td><td>${s.mean_percent_ciliated || '-'}</td></tr>`).join('')}</table>` : ''}
                        ${domains.length ? `<h4>Domains</h4><ul>${domains.map(d => `<li>${d}</li>`).join('')}</ul>` : ''}
                        <p><strong>OMIM:</strong> ${g.omim_id || 'N/A'}</p>
                        <p><strong>Orthologs:</strong> Mouse: ${g.ortholog_mouse || 'N/A'}, C. elegans: ${g.ortholog_c_elegans || 'N/A'}</p>
                    </div>`;
                data.gene = g;
                break;
            }
            case 'complex_genes': {
                const genes = L.complexByName[query.complex] || [];
                html = `<div class="result-card"><h3>Genes in ${query.complex}</h3><p>${genes.join(', ') || 'None found'}</p></div>`;
                data.genes = genes;
                break;
            }
            case 'localization': {
                const genes = L.byLocalization[query.loc] || [];
                html = `<div class="result-card"><h3>Genes localized to ${query.loc}</h3><p>${genes.slice(0, 50).join(', ')}${genes.length > 50 ? ` (showing ${50} of ${genes.length})` : ''}</p></div>`;
                data.genes = genes;
                break;
            }
            case 'gene_localization': {
                const g = L.geneMap[query.gene];
                html = `<div class="result-card"><h3>Localization of ${query.gene}</h3><p>${g?.localization || 'Unknown'}</p><p><strong>Modules:</strong> ${g?.functional_modules?.join(', ') || 'None'}</p></div>`;
                break;
            }
            case 'screens': {
                const screens = L.geneMap[query.gene]?.screens || [];
                html = `<div class="result-card"><h3>Screens for ${query.gene}</h3>${screens.length ? `<table><tr><th>Dataset</th><th>Classification</th><th>Z-Score</th></tr>${screens.map(s => `<tr><td>${s.dataset}</td><td>${s.classification}</td><td>${s.z_score || '-'}</td></tr>`).join('')}</table>` : '<p>No screens found.</p>'}</div>`;
                break;
            }
            case 'domains': {
                const domains = L.geneMap[query.gene]?.domain_descriptions || [];
                html = `<div class="result-card"><h3>Domains of ${query.gene}</h3><ul>${domains.map(d => `<li>${d}</li>`).join('') || '<li>None</li>'}</ul></div>`;
                break;
            }
            case 'modules': {
                const modules = L.geneMap[query.gene]?.functional_modules || [];
                html = `<div class="result-card"><h3>Functional Modules for ${query.gene}</h3><p>${modules.join(', ') || 'None'}</p></div>`;
                break;
            }
            case 'gene_complexes': {
                const complexes = L.complexByGene[query.gene] || [];
                html = `<div class="result-card"><h3>Complexes containing ${query.gene}</h3><p>${complexes.join(', ') || 'None'}</p></div>`;
                break;
            }
            case 'ciliation_effect': {
                const effect = L.geneMap[query.gene]?.percent_ciliated_cells_effects || 'Not Reported';
                html = `<div class="result-card"><h3>% Ciliated Cells Effect for ${query.gene}</h3><p>${effect}</p></div>`;
                break;
            }
            case 'ortholog': {
                const g = L.geneMap[query.gene];
                const orth = g[`ortholog_${query.species}`] || 'N/A';
                html = `<div class="result-card"><h3>${query.species} Ortholog of ${query.gene}</h3><p>${orth}</p></div>`;
                break;
            }
            case 'omim': {
                const omim = L.geneMap[query.gene]?.omim_id || 'N/A';
                html = `<div class="result-card"><h3>OMIM ID for ${query.gene}</h3><p>${omim}</p></div>`;
                break;
            }
            case 'ciliopathy': {
                const genes = L.byCiliopathy[query.name.toLowerCase()] || [];
                html = `<div class="result-card"><h3>Genes in ${query.name} Syndrome</h3><p>${genes.slice(0, 50).join(', ')}${genes.length > 50 ? ` (showing ${50} of ${genes.length})` : ''}</p></div>`;
                break;
            }
            case 'is_ciliary': {
                const loc = L.geneMap[query.gene]?.localization || '';
                const isCiliary = loc.toLowerCase().includes('cilia');
                html = `<div class="result-card"><h3>Is ${query.gene} a Ciliary Gene?</h3><p>${isCiliary ? 'Yes' : 'No'} (Localization: ${loc})</p></div>`;
                break;
            }
            case 'module_genes': {
                const genes = L.byModules[query.module] || [];
                html = `<div class="result-card"><h3>Genes with Module "${query.module}"</h3><p>${genes.join(', ')}</p></div>`;
                break;
            }
            case 'umap': {
                const pt = L.umapByGene[query.gene];
                if (!pt) {
                    html = `<div class="result-card"><h3>UMAP for ${query.gene}</h3><p>No UMAP data available.</p></div>`;
                } else {
                    html = `<div class="result-card"><h3>UMAP Position for ${query.gene}</h3><div id="umap-plot-${Date.now()}" class="plot-container" style="width:100%;height:400px;"></div></div>`;
                    plotData = {
                        id: `umap-plot-${Date.now()}`,
                        data: [{
                            x: [pt.x], y: [pt.y], mode: 'markers+text', type: 'scatter',
                            marker: { size: 15, color: 'red' },
                            text: [query.gene], textposition: 'middle center',
                            name: query.gene
                        }],
                        layout: {
                            title: `${query.gene} in Expression UMAP`,
                            xaxis: { title: 'UMAP 1' },
                            yaxis: { title: 'UMAP 2' },
                            width: 600, height: 400
                        }
                    };
                }
                break;
            }
            case 'compare_expr': {
                const tissue = query.tissue || 'lung';
                html = `<div class="result-card"><h3>Expression Comparison in ${tissue}</h3><table><tr><th>Gene</th><th>scRNA Expression</th><th>Tissue RNA</th></tr>`;
                query.genes.forEach(gene => {
                    const g = L.geneMap[gene];
                    const sc = g?.expression?.scRNA?.[tissue] || 0;
                    const tissueVal = g?.expression?.tissue?.[tissue] || 0;
                    html += `<tr><td>${gene}</td><td>${sc.toFixed(2)}</td><td>${tissueVal.toFixed(2)}</td></tr>`;
                });
                html += '</table></div>';
                break;
            }
            case 'complex_expr': {
                const genes = L.complexByName[query.complex] || [];
                const tissue = query.tissue || 'kidney';
                const expressed = genes.filter(gene => {
                    const g = L.geneMap[gene];
                    return g?.expression?.scRNA?.[tissue] > 0;
                });
                html = `<div class="result-card"><h3>${query.complex} Genes Expressed in ${tissue}</h3><p>${expressed.join(', ') || 'None'}</p></div>`;
                break;
            }
            case 'module_expr':
            case 'ciliopathy_expr':
            case 'localization_expr': {
                let genes = [];
                if (query.type === 'module_expr') genes = L.byModules[query.module] || [];
                else if (query.type === 'ciliopathy_expr') genes = L.byCiliopathy[query.ciliopathy.toLowerCase()] || [];
                else genes = L.byLocalization[query.loc] || [];
                const tissue = query.tissue || 'kidney';
                const expressed = genes.filter(gene => {
                    const g = L.geneMap[gene];
                    return g?.expression?.scRNA?.[tissue] > 0;
                }).sort((a, b) => {
                    const ga = L.geneMap[a]?.expression?.scRNA?.[tissue] || 0;
                    const gb = L.geneMap[b]?.expression?.scRNA?.[tissue] || 0;
                    return gb - ga;
                });
                const title = query.type === 'module_expr' ? `${query.module} in ${tissue}` :
                              query.type === 'ciliopathy_expr' ? `${query.ciliopathy} in ${tissue}` :
                              `${query.loc} in ${tissue}`;
                html = `<div class="result-card"><h3>Top Expressed ${title}</h3><table><tr><th>Gene</th><th>Expression</th></tr>${expressed.slice(0, 20).map(g => {
                    const expr = L.geneMap[g]?.expression?.scRNA?.[tissue] || 0;
                    return `<tr><td>${g}</td><td>${expr.toFixed(2)}</td></tr>`;
                }).join('')}</table></div>`;
                break;
            }
            case 'top_ciliary': {
                const genes = L.byLocalization['cilia'] || Object.keys(L.geneMap);
                const tissue = query.tissue || 'kidney';
                const sorted = genes.filter(g => L.geneMap[g])
                    .sort((a, b) => {
                        const ea = L.geneMap[a]?.expression?.scRNA?.[tissue] || 0;
                        const eb = L.geneMap[b]?.expression?.scRNA?.[tissue] || 0;
                        return eb - ea;
                    }).slice(0, 20);
                html = `<div class="result-card"><h3>Top Ciliary Genes in ${tissue}</h3><table><tr><th>Rank</th><th>Gene</th><th>Expression</th></tr>${sorted.map((g, i) => {
                    const expr = L.geneMap[g]?.expression?.scRNA?.[tissue] || 0;
                    return `<tr><td>${i+1}</td><td>${g}</td><td>${expr.toFixed(2)}</td></tr>`;
                }).join('')}</table></div>`;
                break;
            }
            case 'shared_complexes': {
                const common = query.genes.reduce((acc, gene) => {
                    const comps = L.complexByGene[gene] || [];
                    return acc.filter(c => comps.includes(c));
                }, L.complexByGene[query.genes[0]] || []);
                html = `<div class="result-card"><h3>Shared Complexes for ${query.genes.join(', ')}</h3><p>${common.join(', ') || 'None'}</p></div>`;
                break;
            }
            default:
                html = `<div class="result-card"><h3>Query: ${query.raw}</h3><p>Parsing in progress... (Type: ${query.type})</p></div>`;
        }

        // Download button for data
        html += `<button class="download-button" onclick="downloadData(${JSON.stringify(data).replace(/"/g, '&quot;')})">Download JSON</button>`;

        return { html, plot: plotData };
    }

    function downloadData(dataObj) {
        const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ciliai-result.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    // ——————————————————————————————————————
    // 4. UI & EVENTS
    // ——————————————————————————————————————
    window.displayCiliAIPage = async function () {
        const area = document.querySelector('.content-area');
        if (!area) {
            console.error('[CiliAI] .content-area not found.');
            return;
        }
        area.className = 'content-area content-area-full';
        const ciliaPanel = document.querySelector('.cilia-panel');
        if (ciliaPanel) ciliaPanel.style.display = 'none';

        // Load dependencies
        if (!window.Plotly) {
            const plotlyScript = document.createElement('script');
            plotlyScript.src = 'https://cdn.plot.ly/plotly-latest.min.js';
            document.head.appendChild(plotlyScript);
            await new Promise(resolve => plotlyScript.onload = resolve);
        }
        if (!window.cytoscape) {
            const cytoScript = document.createElement('script');
            cytoScript.src = 'https://cdn.jsdelivr.net/npm/cytoscape@3.23.0/dist/cytoscape.min.js';
            document.head.appendChild(cytoScript);
            await new Promise(resolve => cytoScript.onload = resolve);
        }

        area.innerHTML = `
            <div class="ciliai-container">
                <div class="ciliai-header">
                    <h1>CiliAI</h1>
                    <p>Your AI-powered partner for discovering gene-cilia relationships. (Updated Nov 2025)</p>
                </div>
                <div class="ciliai-main-content">
                    <div class="ai-query-section">
                        <h3>Ask a Question</h3>
                        <div class="ai-input-group autocomplete-wrapper">
                            <input type="text" id="aiQueryInput" class="ai-query-input" placeholder="e.g., What is IFT88? Or gene=IFT88 umap=true">
                            <div id="aiQuerySuggestions" class="suggestions-container"></div>
                            <button class="ai-query-btn" id="aiQueryBtn">Ask CiliAI</button>
                        </div>
                        <div class="example-queries">
                            <p><strong>Examples:</strong>
                                ${[
                                    'What is AAMP?', 'List genes in the BBSome', 'Genes localized to cilia',
                                    'Screens for IFT88', 'Domains of CEP290', 'Joubert syndrome genes',
                                    'C. elegans ortholog for IFT52', 'Plot UMAP for FOXJ1',
                                    'Compare ARL13B and FOXJ1 in lung', 'Top ciliary genes in kidney'
                                ].map(ex => `<span data-question="${ex}">${ex}</span>`).join(', ')}
                            </p>
                        </div>
                        <div id="ai-result-area" class="results-section" style="display:none;"></div>
                    </div>
                </div>
            </div>
            <style>
                .ciliai-container { font-family: Arial, sans-serif; max-width: 950px; margin: 2rem auto; padding: 2rem; background: #f9f9f9; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,.1); }
                .ciliai-header { text-align: center; margin-bottom: 2rem; }
                .ciliai-header h1 { font-size: 2.8rem; color: #2c5aa0; margin: 0; }
                .ciliai-header p { font-size: 1.2rem; color: #555; margin-top: .5rem; }
                .ai-query-section { background: #e8f4fd; border: 1px solid #bbdefb; padding: 1.5rem 2rem; border-radius: 8px; margin-bottom: 2rem; }
                .ai-query-section h3 { margin-top: 0; color: #2c5aa0; }
                .ai-input-group { position: relative; display: flex; gap: 10px; align-items: stretch; }
                .ai-query-input { flex-grow: 1; padding: .8rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
                .ai-query-btn { padding: .8rem 1.2rem; font-size: 1rem; background: #2c5aa0; color: #fff; border: none; border-radius: 4px; cursor: pointer; transition: background .2s; }
                .ai-query-btn:hover { background: #1e4273; }
                .example-queries { margin-top: 1rem; font-size: .9rem; color: #555; text-align: left; }
                .example-queries span { background: #d1e7fd; padding: 4px 10px; border-radius: 12px; cursor: pointer; margin: 4px; display: inline-block; transition: background .2s; border: 1px solid #b1d7fc; }
                .example-queries span:hover { background: #b1d7fc; }
                .results-section { margin-top: 2rem; padding: 2rem; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.05); }
                .result-card { border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; background: #fdfdfd; }
                .result-card h3 { margin-top: 0; color: #2c5aa0; border-bottom: 1px solid #eee; padding-bottom: .5rem; }
                table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: .95rem; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background: #e8f4fd; color: #2c5aa0; font-weight: 600; }
                .suggestions-container { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #ccc; z-index: 1000; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 6px rgba(0,0,0,.1); display: none; }
                .suggestion-item { padding: 10px; cursor: pointer; border-bottom: 1px solid #eee; }
                .suggestion-item:hover { background: #f0f0f0; }
                .download-button { background: #28a745; color: #fff; padding: 8px 14px; border: none; border-radius: 4px; cursor: pointer; font-size: .9em; font-weight: bold; margin-top: 15px; transition: background .3s; }
                .download-button:hover { background: #218838; }
                .plot-container { margin: 20px 0; }
            </style>
        `;

        // Setup interactions
        setupEventListeners();
        console.log('CiliAI: Page displayed successfully.');
    }

    function setupEventListeners() {
        const input = document.getElementById('aiQueryInput');
        const btn = document.getElementById('aiQueryBtn');
        const results = document.getElementById('ai-result-area');
        const suggestions = document.getElementById('aiQuerySuggestions');

        if (!input || !btn || !results) return;

        // Autocomplete: Suggest genes
        input.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val.length < 2) {
                suggestions.style.display = 'none';
                return;
            }
            const matches = Object.keys(window.CiliAI.lookups.geneMap)
                .filter(g => g.toLowerCase().includes(val.toLowerCase()))
                .slice(0, 10);
            suggestions.innerHTML = matches.map(g => `<div class="suggestion-item" data-gene="${g}">${g}</div>`).join('');
            suggestions.style.display = matches.length ? 'block' : 'none';
        });

        suggestions.addEventListener('click', (e) => {
            if (e.target.classList.contains('suggestion-item')) {
                input.value = `What is ${e.target.dataset.gene}?`;
                suggestions.style.display = 'none';
                handleQuery();
            }
        });

        // Example queries
        document.querySelectorAll('.example-queries span').forEach(span => {
            span.addEventListener('click', () => {
                input.value = span.dataset.question;
                handleQuery();
            });
        });

        // Submit
        btn.addEventListener('click', handleQuery);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleQuery();
        });

        function handleQuery() {
            const q = input.value.trim();
            if (!q || !window.CiliAI.ready) {
                results.innerHTML = '<p>Loading data...</p>';
                results.style.display = 'block';
                return;
            }
            const parsed = parseQuery(q);
            const answer = generateAnswer(parsed);
            results.innerHTML = answer.html;
            results.style.display = 'block';
            if (answer.plot && window.Plotly) {
                Plotly.newPlot(answer.plot.id, answer.plot.data, answer.plot.layout);
            }
        }
    }

    // Init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCiliAI);
    } else {
        initCiliAI();
    }

    // Export for global use
    window.CiliAI.parseQuery = parseQuery;
    window.CiliAI.generateAnswer = generateAnswer;
    window.CiliAI.downloadData = downloadData;

})();
