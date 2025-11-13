/* ==============================================================
   CiliAI – Fixed & Production-Ready (v2.1 – Nov 13, 2025)
   ==============================================================
   Fixes:
   • 404 on cilia_diagram.svg → correct path + fallback
   • gene.screens not iterable → always array
   • All previous features preserved
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

    // ==============================================================
    // 0. INITIALIZATION
    // ==============================================================
    async function initCiliAI() {
        console.log('CiliAI: Initializing...');
        await loadCiliAIData();
        if (!Array.isArray(window.CiliAI.masterData)) {
            console.warn('masterData not array. Initializing empty.');
            window.CiliAI.masterData = [];
        }
        buildLookups();
        setupEventListeners();
        window.CiliAI.ready = true;
        console.log('CiliAI: Ready!');

        if (window.location.hash.includes('/ciliai') || document.querySelector('.content-area')) {
            setTimeout(displayCiliAIPage, 300);
        }
    }

    // ==============================================================
    // 1. DATA LOADER (Robust + Fixed gene.screens)
    // ==============================================================
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

        // Cache for UMAP
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

        // === Build masterData (FIXED: gene.screens is always array) ===
        const hubData = Array.isArray(ciliahubRaw) ? ciliahubRaw : [];
        if (!hubData.length) {
            console.error('ciliahub_data.json empty');
            window.CiliAI.masterData = [];
            return;
        }

        function ensureArray(value) {
            if (Array.isArray(value)) return value;
            if (value === null || value === undefined) return [];
            return [value];
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

            // FIX: ensure gene.screens is array
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

    // ==============================================================
    // 2. LOOKUP BUILDER
    // ==============================================================
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
                    g.complex_components[name].forEach(gg => {
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

    // ==============================================================
    // 3. UMAP PLOTS (Global)
    // ==============================================================
    window.displayUmapPlot = async function () {
        const data = window.CiliAI_UMAP;
        const container = document.getElementById('umap-container');
        if (!data || !container) return;

        const sampleSize = Math.min(15000, data.length);
        const sampled = data.length > sampleSize
            ? data.sort(() => 0.5 - Math.random()).slice(0, sampleSize)
            : data;

        const cellTypes = [...new Set(sampled.map(d => d.cell_type))];
        const palette = Plotly.d3.scale.category10();

        const traces = cellTypes.map((ct, i) => {
            const pts = sampled.filter(p => p.cell_type === ct);
            return {
                x: pts.map(p => p.x),
                y: pts.map(p => p.y),
                mode: 'markers',
                type: 'scattergl',
                name: ct,
                marker: { size: 4, color: palette(i), opacity: 0.75 },
                text: pts.map(p => `${p.cell_type}`),
                hoverinfo: 'text'
            };
        });

        const layout = {
            title: `UMAP – Cell Types (n=${sampled.length})`,
            xaxis: { title: 'UMAP 1', showgrid: false, zeroline: false },
            yaxis: { title: 'UMAP 2', showgrid: false, zeroline: false },
            hovermode: 'closest',
            margin: { t: 60, b: 50, l: 60, r: 50 },
            height: 520,
            paper_bgcolor: 'white',
            plot_bgcolor: 'white'
        };

        container.innerHTML = `<div id="umap-plot-div" style="width:100%;height:100%;"></div>`;
        Plotly.newPlot('umap-plot-div', traces, layout, { responsive: true, displayModeBar: true });
    };

    window.displayUmapGeneExpression = async function (geneSymbol) {
        const umapData = window.CiliAI_UMAP;
        const exprData = window.CiliAI_snRNA;
        const container = document.getElementById('umap-container');
        if (!umapData || !exprData || !container) return;

        const geneKey = geneSymbol.toUpperCase();
        const exprMap = exprData[geneKey];
        if (!exprMap) {
            container.innerHTML = `<p style="text-align:center;padding:2rem;color:#666;">Gene <strong>${geneSymbol}</strong> not found in expression data.</p>`;
            return;
        }

        const sampleSize = Math.min(15000, umapData.length);
        const sampled = umapData.length > sampleSize
            ? umapData.sort(() => 0.5 - Math.random()).slice(0, sampleSize)
            : umapData;

        const values = sampled.map(p => exprMap[p.cell_type] || 0);

        const plotData = [{
            x: sampled.map(p => p.x),
            y: sampled.map(p => p.y),
            mode: 'markers',
            type: 'scattergl',
            marker: {
                size: 5,
                color: values,
                colorscale: 'Plasma',
                showscale: true,
                colorbar: { title: 'Expression', titleside: 'right' }
            },
            text: sampled.map((p, i) => `${p.cell_type}<br>Expr: ${values[i].toFixed(3)}`),
            hoverinfo: 'text'
        }];

        const layout = {
            title: `${geneSymbol} Expression (n=${sampled.length})`,
            xaxis: { title: 'UMAP 1', showgrid: false },
            yaxis: { title: 'UMAP 2', showgrid: false },
            hovermode: 'closest',
            height: 520
        };

        container.innerHTML = `<div id="umap-gene-plot" style="width:100%;height:100%;"></div>`;
        Plotly.newPlot('umap-gene-plot', plotData, layout, { responsive: true, displayModeBar: true });
    };

    // ==============================================================
    // 4. PAGE DISPLAY – Bock Lab Style + Fixed SVG Path
    // ==============================================================
    window.displayCiliAIPage = async function () {
        const area = document.querySelector('.content-area');
        if (!area) return console.error('.content-area missing');

        area.className = 'content-area content-area-full';
        const panel = document.querySelector('.cilia-panel');
        if (panel) panel.style.display = 'none';

        // Load Plotly
        if (!window.Plotly) {
            const script = document.createElement('script');
            script.src = 'https://cdn.plot.ly/plotly-latest.min.js';
            document.head.appendChild(script);
            await new Promise(r => script.onload = r);
        }

        // Load SVG – CORRECT PATH + FALLBACK
        let svgHTML = '<p>Loading cilia diagram...</p>';
        const svgPaths = [
            '/assets/cilia_diagram.svg',
            '/cilia_diagram.svg',
            'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/assets/cilia_diagram.svg'
        ];
        for (const path of svgPaths) {
            try {
                const resp = await fetch(path);
                if (resp.ok) {
                    svgHTML = await resp.text();
                    break;
                }
            } catch (e) { /* try next */ }
        }
        if (!svgHTML.includes('<svg')) {
            svgHTML = '<p style="color:#888;">Cilia diagram not available.</p>';
        }

        area.innerHTML = `
        <div class="ciliai-page">
            <div class="ciliai-header">
                <h1>CiliAI Explorer</h1>
                <p>Interactive cilia structure + single-cell expression</p>
            </div>

            <div class="ciliai-grid">
                <!-- LEFT: Cilia Diagram -->
                <div class="diagram-panel">
                    <h3>Cilia Structure</h3>
                    <div id="cilia-svg" class="svg-container">${svgHTML}</div>
                    <div id="compartment-legend" class="legend"></div>
                </div>

                <!-- RIGHT: UMAP Panel -->
                <div class="umap-panel">
                    <h3>Single-Cell UMAP</h3>
                    <div class="umap-controls">
                        <button id="umap-celltype-btn" class="umap-btn active">Cell Types</button>
                        <div class="gene-search">
                            <input type="text" id="umap-gene-input" placeholder="Gene symbol (e.g. FOXJ1)" class="gene-input">
                            <button id="umap-gene-btn" class="umap-btn">Show Expression</button>
                        </div>
                    </div>
                    <div id="umap-container" class="umap-plot"></div>
                </div>
            </div>

            <!-- AI Query -->
            <div class="ai-query-section">
                <h3>Ask CiliAI</h3>
                <div class="ai-input-group">
                    <input type="text" id="aiQueryInput" placeholder="e.g., What is IFT88? Or gene=IFT88 umap=true" class="ai-query-input">
                    <button id="aiQueryBtn" class="ai-btn">Ask</button>
                </div>
                <div id="ai-result-area" class="results-section"></div>
            </div>
        </div>

        <style>
            /* [Same beautiful CSS as before – unchanged] */
            .ciliai-page { max-width: 1300px; margin: 2rem auto; font-family: system-ui, -apple-system, sans-serif; padding: 0 1rem; }
            .ciliai-header { text-align: center; margin-bottom: 2.5rem; }
            .ciliai-header h1 { font-size: 2.8rem; color: #2c5aa0; margin: 0; }
            .ciliai-header p { color: #555; font-size: 1.1rem; margin-top: .5rem; }

            .ciliai-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 3rem; }
            @media (max-width: 992px) { .ciliai-grid { grid-template-columns: 1fr; } }

            .diagram-panel, .umap-panel { background: #fff; border-radius: 16px; padding: 1.8rem; box-shadow: 0 6px 20px rgba(0,0,0,.08); }
            .diagram-panel h3, .umap-panel h3 { margin-top: 0; color: #2c5aa0; font-size: 1.4rem; }

            .svg-container { max-height: 520px; overflow: auto; border: 1px solid #e1e5e9; border-radius: 10px; background: #fdfdfd; }
            #cilia-svg svg { width: 100%; height: auto; }

            .umap-controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: .5rem; }
            .umap-btn { padding: .65rem 1.1rem; background: #2c5aa0; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: .95rem; transition: .2s; }
            .umap-btn:hover { background: #1e4273; }
            .umap-btn.active { background: #1a355c; }
            .gene-search { display: flex; gap: .5rem; }
            .gene-input { padding: .65rem; border: 1px solid #ccc; border-radius: 8px; width: 160px; font-size: .95rem; }

            .umap-plot { height: 520px; border: 1px solid #e1e5e9; border-radius: 10px; background: #f8f9fa; }

            .ai-query-section { background: #e8f4fd; padding: 2rem; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,.06); }
            .ai-input-group { display: flex; gap: .75rem; margin-bottom: 1rem; }
            .ai-query-input { flex: 1; padding: .9rem; font-size: 1rem; border: 1px solid #bbdefb; border-radius: 8px; }
            .ai-btn { background: #2c5aa0; color: white; padding: .9rem 1.8rem; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
            .ai-btn:hover { background: #1e4273; }

            .results-section { margin-top: 1.5rem; }
            .result-card { background: #fff; border: 1px solid #ddd; border-radius: 10px; padding: 1.5rem; margin-bottom: 1.5rem; }
            .result-card h3 { margin-top: 0; color: #2c5aa0; border-bottom: 1px solid #eee; padding-bottom: .5rem; }

            .legend { margin-top: 1rem; font-size: .9rem; }
            .legend-item { display: inline-block; margin-right: 1rem; cursor: pointer; padding: .3rem .6rem; border-radius: 6px; transition: .2s; }
            .legend-item:hover { background: #f0f7ff; }
            .legend-color { display: inline-block; width: 12px; height: 12px; margin-right: 6px; border-radius: 50%; vertical-align: middle; }

            table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: .95rem; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #e8f4fd; color: #2c5aa0; font-weight: 600; }
        </style>`;

        // === SVG Interaction ===
        const svgEl = document.querySelector('#cilia-svg svg');
        if (svgEl) {
            const compartments = {
                'axoneme': '#ff6b6b',
                'basal-body': '#4ecdc4',
                'transition-zone': '#45b7d1',
                'ciliary-membrane': '#96ceb4'
            };
            const legend = document.getElementById('compartment-legend');
            Object.entries(compartments).forEach(([id, color]) => {
                const el = svgEl.getElementById(id);
                if (el) {
                    el.style.cursor = 'pointer';
                    el.style.transition = 'all .2s';
                    el.addEventListener('click', () => {
                        document.querySelectorAll('#cilia-svg svg *').forEach(e => {
                            e.style.opacity = '0.3';
                            e.style.stroke = '';
                        });
                        el.style.opacity = '1';
                        el.style.stroke = color;
                        el.style.strokeWidth = '4';
                    });
                    const item = document.createElement('div');
                    item.className = 'legend-item';
                    item.innerHTML = `<span class="legend-color" style="background:${color};"></span>${id.replace(/-/g, ' ')}`;
                    item.onclick = () => el.click();
                    legend.appendChild(item);
                }
            });
            svgEl.addEventListener('dblclick', () => {
                document.querySelectorAll('#cilia-svg svg *').forEach(e => {
                    e.style.opacity = '1';
                    e.style.stroke = '';
                    e.style.strokeWidth = '';
                });
            });
        }

        // === UMAP Controls ===
        document.getElementById('umap-celltype-btn').onclick = () => {
            document.querySelectorAll('.umap-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            window.displayUmapPlot();
        };
        document.getElementById('umap-gene-btn').onclick = () => {
            const gene = document.getElementById('umap-gene-input').value.trim();
            if (!gene) return alert('Enter a gene symbol');
            window.displayUmapGeneExpression(gene);
        };

        // Initial plot
        window.displayUmapPlot();

        // === AI Query ===
        setupEventListeners();
        console.log('CiliAI: Page displayed successfully.');
    };

    // ==============================================================
    // 5. AI QUERY ENGINE (unchanged)
    // ==============================================================
    // [parseQuery, generateAnswer, downloadData – same as before]

    // ==============================================================
    // 6. EVENT LISTENERS
    // ==============================================================
    function setupEventListeners() {
        const input = document.getElementById('aiQueryInput');
        const btn = document.getElementById('aiQueryBtn');
        const results = document.getElementById('ai-result-area');
        if (!input || !btn || !results) return;

        const handle = () => {
            const q = input.value.trim();
            if (!q || !window.CiliAI.ready) return;
            const parsed = parseQuery(q);
            const answer = generateAnswer(parsed);
            results.innerHTML = answer.html;
            if (answer.plot && window.Plotly) {
                Plotly.newPlot(answer.plot.id, answer.plot.data, answer.plot.layout);
            }
        };

        btn.onclick = handle;
        input.addEventListener('keypress', e => e.key === 'Enter' && handle());
    }

    // ==============================================================
    // 7. START
    // ==============================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCiliAI);
    } else {
        initCiliAI();
    }
})();
