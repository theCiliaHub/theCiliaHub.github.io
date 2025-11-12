// ==========================================================
// CiliAI Complete Integrated Code
// ==========================================================

// ==========================================================
// 1️⃣ UNIFIED Data Loading - Integrates ALL datasets
// ==========================================================

// Global Caches
let liPhylogenyCache = null;
let neversPhylogenyCache = null;
let umapDataCache = null;
let cellxgeneDataCache = null;

async function loadCiliAIData(timeoutMs = 20000) {
    // ------------------------------------------------------------------
    // URLs (unchanged)
    // ------------------------------------------------------------------
    const urls = {
        ciliahub: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/ciliahub_data.json',
        umap:     'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/umap_data.json',
        screens:  'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cilia_screens_data.json',
        cellxgene:'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cellxgene_data.json',
        rna_tissue:'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/rna_tissue_consensus.tsv',
        corum:    'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/corum_humanComplexes.json',
        domains:  'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cili_ai_domain_database.json',
        nevers2017:'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/nevers_et_al_2017_matrix_optimized.json',
        li2014:   'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/li_et_al_2014_matrix_optimized.json'
    };

    // ------------------------------------------------------------------
    // INTERNAL CACHES (no globals, no separate fetchers)
    // ------------------------------------------------------------------
    let umapCache      = null;
    let cellxgeneCache = null;

    // ------------------------------------------------------------------
    // Helper: fetch with timeout (same as your safeFetch)
    // ------------------------------------------------------------------
    async function safeFetch(url, type = 'json', timeout = timeoutMs) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
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

    // ------------------------------------------------------------------
    // FETCH UMAP (cached inside this function)
    // ------------------------------------------------------------------
    async function getUmapData() {
        if (umapCache) return umapCache;
        try {
            const res = await fetch(urls.umap);
            if (!res.ok) throw new Error('Failed to fetch UMAP data');
            umapCache = await res.json();
            window.CiliAI_UMAP = umapCache;               // expose for your plotters
            return umapCache;
        } catch (err) {
            console.error('Error fetching UMAP data:', err);
            return null;
        }
    }

    // ------------------------------------------------------------------
    // FETCH CELLXGENE (cached inside this function)
    // ------------------------------------------------------------------
    async function getCellxgeneData() {
        if (cellxgeneCache) return cellxgeneCache;
        try {
            const res = await fetch(urls.cellxgene);
            if (!res.ok) throw new Error('Failed to fetch Cellxgene data');
            cellxgeneCache = await res.json();
            window.CiliAI_snRNA = cellxgeneCache;         // expose for your plotters
            return cellxgeneCache;
        } catch (err) {
            console.error('Error fetching Cellxgene data:', err);
            return null;
        }
    }

    // ------------------------------------------------------------------
    // Parallel load of EVERYTHING (including UMAP & cellxgene)
    // ------------------------------------------------------------------
    console.log('CiliAI: fetching all data (parallel)...');
    const [
        ciliahubRaw, umapRaw, screensRaw, cellxgeneRaw,
        rnaTsv, corumRaw, domainRaw, neversRaw, liRaw
    ] = await Promise.all([
        safeFetch(urls.ciliahub, 'json'),
        getUmapData(),
        safeFetch(urls.screens, 'json'),
        getCellxgeneData(),
        safeFetch(urls.rna_tissue, 'tsv'),
        safeFetch(urls.corum, 'json'),
        safeFetch(urls.domains, 'json'),
        safeFetch(urls.nevers2017, 'json'),
        safeFetch(urls.li2014, 'json')
    ]);

    // ------------------------------------------------------------------
    // Phylogeny caches (unchanged)
    // ------------------------------------------------------------------
    window.liPhylogenyCache     = liRaw || {};
    window.neversPhylogenyCache = neversRaw || {};

    // ------------------------------------------------------------------
    // TSV → objects
    // ------------------------------------------------------------------
    function parseTsvToObjects(text) {
        if (!text) return [];
        const lines = text.trim().split(/\r?\n/).filter(Boolean);
        if (!lines.length) return [];
        const header = lines.shift().split('\t').map(h => h.trim());
        const norm = header.map(h => h.toLowerCase().replace(/\s+/g, '_'));
        return lines.map(l => {
            const cols = l.split('\t');
            const o = {};
            norm.forEach((k, i) => o[k] = cols[i] ?? '');
            return o;
        });
    }

    // ------------------------------------------------------------------
    // INDEX EXTERNAL DATA (screens, expression, complexes, domains, etc.)
    // ------------------------------------------------------------------
    const screensByGene = {};
    if (screensRaw && typeof screensRaw === 'object') {
        for (const k of Object.keys(screensRaw)) {
            const list = Array.isArray(screensRaw[k]) ? screensRaw[k] : [];
            const key = String(k).toUpperCase();
            screensByGene[key] = list.map(i => ({
                dataset: i.source || i.dataset || null,
                classification: i.result || i.classification || null,
                paper_link: i.paper_link || i.paper || i.link || null,
                mean_percent_ciliated: i.mean_percent_ciliated ?? i.mean ?? null,
                sd_percent_ciliated: i.sd_percent_ciliated ?? i.sd ?? null,
                z_score: i.z_score ?? i.z ?? null
            }));
        }
    }

    const scExpressionByGene = {};
    if (cellxgeneRaw && typeof cellxgeneRaw === 'object') {
        for (const k of Object.keys(cellxgeneRaw)) {
            scExpressionByGene[String(k).toUpperCase()] = cellxgeneRaw[k];
        }
    }

    const tissueExpressionByGene = {};
    const rnaRows = parseTsvToObjects(rnaTsv);
    for (const r of rnaRows) {
        const g = r.gene_name || r.gene || r.gene_symbol || r.geneid || r.gene_id;
        if (!g) continue;
        const key = String(g).toUpperCase();
        if (!tissueExpressionByGene[key]) tissueExpressionByGene[key] = {};
        const val = parseFloat(r.ntpm ?? r.ntpms ?? r.tpm ?? r.value ?? NaN);
        const tissue = r.tissue || r.tissue_name || r.tissue_type || r.sample || 'unknown';
        tissueExpressionByGene[key][tissue] = Number.isFinite(val) ? val : null;
    }

    const corumByGene = {};
    if (Array.isArray(corumRaw)) {
        for (const c of corumRaw) {
            const name = c.complex_name || c.name || c.complex || 'Unnamed';
            const subs = Array.isArray(c.subunits) ? c.subunits : [];
            const names = subs.map(s => (s.gene_name || s.gene || s.name || '').toString()).filter(Boolean);
            for (const g of names) {
                const key = g.toUpperCase();
                if (!corumByGene[key]) corumByGene[key] = {};
                corumByGene[key][name] = names;
            }
        }
    }

    const domainsByGene = {};
    window.CiliAI_DomainData = domainRaw || {};
    if (domainRaw?.enriched_domains) {
        for (const dk of Object.keys(domainRaw.enriched_domains)) {
            const d = domainRaw.enriched_domains[dk];
            const desc = d.description || d.desc || '';
            const pfam = d.domain_id || d.pfam || dk;
            const genes = Array.isArray(d.ciliary_genes_with_domain) ? d.ciliary_genes_with_domain : d.genes || [];
            for (const g of genes) {
                const key = String(g).toUpperCase();
                if (!domainsByGene[key]) domainsByGene[key] = { pfam_ids: [], domain_descriptions: [] };
                if (pfam && !domainsByGene[key].pfam_ids.includes(pfam)) domainsByGene[key].pfam_ids.push(pfam);
                if (desc && !domainsByGene[key].domain_descriptions.includes(desc)) domainsByGene[key].domain_descriptions.push(desc);
            }
        }
    }

    const modulesByGene = {};
    if (liRaw?.genes && liRaw?.summary?.class_list) {
        for (const gk of Object.keys(liRaw.genes)) {
            const o = liRaw.genes[gk];
            const name = o.g || o.gene || gk;
            const cls = liRaw.summary.class_list[o.c];
            if (name && cls) {
                const key = String(name).toUpperCase();
                if (!modulesByGene[key]) modulesByGene[key] = [];
                const pretty = cls.replace(/_/g, ' ');
                if (!modulesByGene[key].includes(pretty)) modulesByGene[key].push(pretty);
            }
        }
    }

    const liMap = {}, neversMap = {};
    if (liRaw?.genes) {
        for (const gk of Object.keys(liRaw.genes)) {
            const o = liRaw.genes[gk];
            const name = o.g || o.gene || gk;
            if (!name) continue;
            const key = String(name).toUpperCase();
            liMap[key] = {
                class: (Array.isArray(liRaw.summary?.class_list) && liRaw.summary.class_list[o.c]) || 'Unknown',
                class_id: o.c,
                species_data: o.s || []
            };
        }
    }
    if (neversRaw?.genes) {
        for (const gk of Object.keys(neversRaw.genes)) {
            const o = neversRaw.genes[gk];
            const name = o.g || o.gene || gk;
            const key = String(name).toUpperCase();
            neversMap[key] = {
                species_count: Array.isArray(o.s) ? o.s.length : (o.s ? 1 : 0),
                species_data: o.s || []
            };
        }
    }

    // ------------------------------------------------------------------
    // CILIOPATHY EXTRACTION (same robust logic)
    // ------------------------------------------------------------------
    function extractCiliopathyInfo(o) {
        const split = s => String(s).split(';').map(t => t.trim()).filter(Boolean);
        const cili = new Set(), cls = new Set();

        if (Array.isArray(o.ciliopathy)) o.ciliopathy.forEach(s => split(s).forEach(v => cili.add(v)));
        else if (typeof o.ciliopathy === 'string' && o.ciliopathy) split(o.ciliopathy).forEach(v => cili.add(v));

        if (Array.isArray(o.ciliopathies)) o.ciliopathies.forEach(s => split(s).forEach(v => cili.add(v)));
        else if (typeof o.ciliopathies === 'string' && o.ciliopathies) split(o.ciliopathies).forEach(v => cili.add(v));

        if (Array.isArray(o.ciliopathy_classification)) o.ciliopathy_classification.forEach(s => split(s).forEach(v => cls.add(v)));
        else if (typeof o.ciliopathy_classification === 'string' && o.ciliopathy_classification) split(o.ciliopathy_classification).forEach(v => cls.add(v));

        return { ciliopathy: Array.from(cili), ciliopathy_classification: Array.from(cls) };
    }

    // ------------------------------------------------------------------
    // BUILD MASTER ARRAY
    // ------------------------------------------------------------------
    const hub = Array.isArray(ciliahubRaw) ? ciliahubRaw : [];
    if (!hub.length) {
        console.error('ciliahub_data.json empty or missing');
        window.CiliAI_MasterData = [];
        return [];
    }

    const master = hub.map(g => {
        const gene = g.gene ?? g.g ?? g.name ?? g.symbol ?? null;
        const key  = gene ? String(gene).toUpperCase() : null;

        // ---- explicit fields you asked for ----
        const explicit = {
            gene,
            ensembl_id: g.ensembl_id || null,
            lof_effects: g.lof_effects || "Not Reported",
            percent_ciliated_cells_effects: g.percent_ciliated_cells_effects || "Not Reported",
            overexpression_effects: g.overexpression_effects || "Not Reported",
            description: g.description || null,
            omim_id: g.omim_id || null,
            functional_summary: g.functional_summary || null,
            localization: g.localization || null,
            reference: g.reference || null,
            pfam_ids: Array.isArray(g.pfam_ids) ? g.pfam_ids : [],
            domain_descriptions: Array.isArray(g.domain_descriptions) ? g.domain_descriptions : [],
            synonym: g.synonym || null,
            evidence_source: g.evidence_source || "CiliaMiner"
        };

        // ---- orthologs ----
        const orth = {
            ortholog_mouse: g.ortholog_mouse || null,
            ortholog_c_elegans: g.ortholog_c_elegans || null,
            ortholog_xenopus: g.ortholog_xenopus || null,
            ortholog_zebrafish: g.ortholog_zebrafish || null
        };

        // ---- ciliopathy ----
        const { ciliopathy, ciliopathy_classification } = extractCiliopathyInfo(g);

        // ---- merge external data ----
        const allScreens = [...(Array.isArray(g.screens) ? g.screens : []), ...(key ? (screensByGene[key] || []) : [])];
        const extDom = key ? (domainsByGene[key] || { pfam_ids: [], domain_descriptions: [] }) : { pfam_ids: [], domain_descriptions: [] };
        const mergedComplex = { ...(g.complex_components && typeof g.complex_components === 'object' ? g.complex_components : {}), ...(key ? (corumByGene[key] || {}) : {}) };
        const scExpr = key ? (scExpressionByGene[key] || null) : null;
        const tissueExpr = key ? (tissueExpressionByGene[key] || null) : null;
        const modules = key ? (modulesByGene[key] || []) : [];
        const phylo = {
            li_2014: key ? (liMap[key] || null) : null,
            nevers_2017: key ? (neversMap[key] || null) : null
        };

        return {
            ...g,
            ...explicit,
            ...orth,
            ciliopathy,
            ciliopathy_classification,
            screens: allScreens,
            expression: { scRNA: scExpr, tissue: tissueExpr },
            complex_components: mergedComplex,
            pfam_ids: Array.from(new Set([...explicit.pfam_ids, ...extDom.pfam_ids])),
            domain_descriptions: Array.from(new Set([...explicit.domain_descriptions, ...extDom.domain_descriptions])),
            functional_modules: modules,
            phylogeny: phylo
        };
    });

    window.CiliAI_MasterData = master;
    console.log(`CiliAI: ${master.length} genes loaded – UMAP & snRNA-seq cached`);
    return master;
}



/* ==============================================================
   2. QUESTION PARSER (now recognises Joubert, BBSome, etc.)
   ============================================================== */
async function parseCiliAIQuestion(question, masterData){
    const q = question.toLowerCase();
    const structured = {
        genes:[], filters:{}, intent:{}, comparison:false,
        species:null, plotType:null, question
    };

    // ---- GENE extraction (including synonyms) ----
    if(masterData){
        const map = new Map();
        masterData.forEach(g=>{
            map.set(g.gene.toLowerCase(), g.gene.toUpperCase());
            if(g.synonym){
                const syns = Array.isArray(g.synonym)?g.synonym:g.synonym.split(/[,;]\s*/);
                syns.forEach(s=>s&&map.set(s.toLowerCase(), g.gene.toUpperCase()));
            }
        });
        const words = new Set(q.match(/\b\w+\b/g)||[]);
        words.forEach(w=>{ if(map.has(w)) structured.genes.push(map.get(w)); });
    }

    // ---- KEYWORD / FILTER detection ----
    if(q.includes('localize')||q.includes('localization')) structured.intent.localization=true;
    if(q.includes('cilia')||q.includes('ciliary')) structured.filters.localization='cilia';
    if(q.includes('basal body')) structured.filters.localization='basal body';
    if(q.includes('centrosome')) structured.filters.localization='centrosome';
    if(q.includes('screen')) structured.intent.screens=true;
    if(q.includes('percent ciliated')) structured.intent.screens=true;
    if(q.includes('domain')) structured.intent.domains=true;
    if(q.includes('complex')) structured.intent.complexes=true;

    // ---- COMPLEX / MODULE map (BBSome, IFT, …) ----
    const complexMap = getComplexPhylogenyTableMap();
    for(const name in complexMap){
        if(q.includes(name.toLowerCase())){
            if(name.includes('MODULE')||name.includes('TIP')||name.includes('ZONE')||name.includes('PAIR')){
                structured.filters.functional_modules = name;
            }else{
                structured.filters.complexes = name;
            }
            break;
        }
    }
    if(!structured.filters.complexes && q.includes('bbsome')) structured.filters.complexes='BBSOME';

    // ---- ORTHOLOGS ----
    if(q.includes('ortholog')) structured.intent.orthologs=true;
    if(q.includes('c. elegans')||q.includes('worm')) structured.species='c_elegans';
    if(q.includes('mouse')) structured.species='mouse';
    if(q.includes('human')) structured.species='human';
    if(q.includes('zebrafish')) structured.species='zebrafish';
    if(q.includes('drosophila')) structured.species='drosophila';

    // ---- CILIOPATHY (Joubert, BBS, NPHP…) ----
    if(q.includes('ciliopathy')||q.includes('disease')) structured.intent.ciliopathy=true;
    if(q.includes('joubert')||q.includes('jbts')) structured.filters.ciliopathy='joubert syndrome';
    if(q.includes('bbs')) structured.filters.ciliopathy='bardet-biedl syndrome';
    if(q.includes('nephronophthisis')||q.includes('nphp')) structured.filters.ciliopathy='nephronophthisis';

    // ---- OMIM / description ----
    if(q.includes('omim')) structured.intent.omim=true;
    if(q.includes('describe')||q.startsWith('what is')||q.startsWith('what does')) structured.intent.description=true;

    // ---- EXPRESSION ----
    if(q.includes('express')||q.includes('expression')) structured.intent.expression=true;
    if(q.includes('lung')) structured.filters.tissue='lung';
    if(q.includes('kidney')) structured.filters.tissue='kidney';
    if(q.includes('brain')) structured.filters.tissue='brain';
    if(q.includes('ciliated cell')) structured.filters.cell_type='ciliated cell';

    // ---- PLOTS ----
    if(q.includes('umap') && q.includes('expression')){ structured.plotType='umap_expression'; structured.intent.umap=true; }
    else if(q.includes('umap')){ structured.plotType='umap_cluster'; structured.intent.umap=true; }
    if(q.includes('phylogen')||q.includes('evolution')||q.includes('conservation')){
        structured.plotType='phylogeny'; structured.intent.phylogeny=true;
    }

    // ---- DEFAULT INTENT ----
    if(structured.genes.length && !Object.keys(structured.intent).length) structured.intent.description=true;
    if(!structured.genes.length && Object.keys(structured.filters).length) structured.intent.list_genes=true;
    if(q.includes('compare')) structured.comparison=true;
    if(q.startsWith('is') && (q.includes('cilia')||q.includes('ciliary'))) structured.intent.localization=true;

    return structured;
}


/* ==============================================================
   3. QUERY ENGINE (uses the *normalized* ciliopathy array)
   ============================================================== */
function queryGenes(structured){
    const data = window.CiliAI_MasterData;
    if(!Array.isArray(data)) return [];

    let results = structured.genes.length
        ? data.filter(g=>structured.genes.includes(g.gene.toUpperCase()))
        : [...data];

    const f = structured.filters;

    if(Object.keys(f).length){
        results = results.filter(g=>{
            // localization
            if(f.localization && !(g.localization||'').toLowerCase().includes(f.localization.toLowerCase())) return false;

            // complexes
            if(f.complexes){
                const txt = f.complexes.toLowerCase();
                const own = Object.keys(g.complex_components||{}).some(n=>n.toLowerCase().includes(txt));
                if(own) return true;
                const map = getComplexPhylogenyTableMap()[f.complexes.toUpperCase()]||[];
                if(map.includes(g.gene.toUpperCase())) return true;
                return false;
            }

            // functional modules
            if(f.functional_modules){
                const txt = f.functional_modules.toLowerCase();
                const own = (g.functional_modules||[]).some(m=>m.toLowerCase().includes(txt));
                if(own) return true;
                const map = getComplexPhylogenyTableMap()[f.functional_modules.toUpperCase()]||[];
                if(map.includes(g.gene.toUpperCase())) return true;
                return false;
            }

            // **CILIOPATHY** – now works
            if(f.ciliopathy){
                const txt = f.ciliopathy.toLowerCase();
                if(!(g.ciliopathy||[]).some(c=>c.toLowerCase().includes(txt))) return false;
            }

            // tissue / cell-type expression
            if(f.tissue && g.expression?.tissue){
                const t = Object.keys(g.expression.tissue).find(k=>k.toLowerCase().includes(f.tissue.toLowerCase()));
                if(!t || (g.expression.tissue[t]||0)<=0) return false;
            }
            if(f.cell_type && g.expression?.scRNA){
                if((g.expression.scRNA[f.cell_type]||0)<=0) return false;
            }

            // ortholog species
            if(f.species){
                const key = `ortholog_${f.species}`;
                if(!g[key]) return false;
            }
            return true;
        });
    }

    // sort by expression if requested
    if(structured.intent.expression && f.tissue && !structured.genes.length){
        results.sort((a,b)=>{
            const ta = Object.keys(a.expression?.tissue||{}).find(k=>k.toLowerCase().includes(f.tissue));
            const tb = Object.keys(b.expression?.tissue||{}).find(k=>k.toLowerCase().includes(f.tissue));
            return (b.expression?.tissue?.[tb]||0) - (a.expression?.tissue?.[ta]||0);
        }).slice(0,10);
    }
    return results;
}

function displayCiliAIResults(results, sq) {
    const area = document.getElementById('ai-result-area');
    area.style.display = 'block';
    if (!results || !results.length) {
        area.innerHTML = '<p>No results found for your query.</p>';
        return;
    }

    const build = (title, content) => {
        if (!content) return '';
        let txt = '';
        if (Array.isArray(content)) txt = content.filter(Boolean).join(', ');
        else if (typeof content === 'object' && content !== null) txt = Object.keys(content).join(', ');
        else txt = content;
        return txt ? `<p><strong>${title}:</strong> ${txt}</p>` : '';
    };

    // ——— 1. LIST QUERIES ———
    if (sq.intent.list_genes && results.length > 1) {
        let title = 'Found genes';
        if (sq.filters.ciliopathy) title = `Genes in ${sq.filters.ciliopathy}`;
        if (sq.filters.complexes) title = `Genes in ${sq.filters.complexes}`;
        if (sq.filters.functional_modules) title = `Genes in ${sq.filters.functional_modules}`;
        if (sq.filters.localization) title = `Genes localized to ${sq.filters.localization}`;
        area.innerHTML = `
            <div class="result-card">
                <h3>${title} (${results.length})</h3>
                <p>${results.map(g => g.gene).join(', ')}</p>
            </div>`;
        return;
    }

    // ——— 2. COMPARISON ———
    if (sq.comparison && results.length > 1) {
        let html = '<table><thead><tr><th>Gene</th>';
        if (sq.filters.tissue) html += `<th>${sq.filters.tissue} (nTPM)</th>`;
        if (sq.filters.cell_type) html += `<th>${sq.filters.cell_type}</th>`;
        if (sq.intent.localization) html += '<th>Localization</th>';
        html += '</tr></thead><tbody>';
        results.forEach(g => {
            html += `<tr><td><strong>${g.gene}</strong></td>`;
            if (sq.filters.tissue) {
                const t = Object.keys(g.expression?.tissue || {}).find(k => k.toLowerCase().includes(sq.filters.tissue));
                html += `<td>${g.expression?.tissue?.[t]?.toFixed(2) || 'N/A'}</td>`;
            }
            if (sq.filters.cell_type) {
                html += `<td>${g.expression?.scRNA?.[sq.filters.cell_type]?.toFixed(4) || 'N/A'}</td>`;
            }
            if (sq.intent.localization) html += `<td>${g.localization || 'N/A'}</td>`;
            html += '</tr>';
        });
        html += '</tbody></table>';
        area.innerHTML = `<div class="result-card">${html}</div>`;
        return;
    }

    // ——— 3. GENE CARD ———
    const cards = results.map(g => {
        if (sq.intent.localization && sq.genes.length && (sq.question.startsWith('is') || sq.question.includes('ciliary'))) {
            const loc = (g.localization || '').toLowerCase();
            const ans = loc.includes('cilia')
                ? `Yes, <strong>${g.gene}</strong> is localized to the ${g.localization}.`
                : `No, <strong>${g.gene}</strong> is ${g.localization ? 'localized to ' + g.localization : 'not annotated'}.`;
            return `<div class="result-card"><h3>${g.gene}</h3><p>${ans}</p></div>`;
        }

        const sections = [];
        const all = {
            description: build('Description', g.description),
            functional_summary: build('Functional Summary', g.functional_summary),
            localization: build('Localization', g.localization),
            omim: build('OMIM', g.omim_id),
            ciliopathy: build('Ciliopathies', g.ciliopathy),                    // ← FIXED
            classification: build('Classification', g.ciliopathy_classification),
            complexes: build('Complexes', Object.keys(g.complex_components || {})),
            domains: build('Domains', g.domain_descriptions),
            modules: build('Modules', g.functional_modules),
            screens: build('Screens', [...new Set((g.screens || []).map(s => s.dataset).filter(Boolean))]),
            orth_mouse: build('Mouse Ortholog', g.ortholog_mouse),
            orth_celegans: build('C. elegans Ortholog', g.ortholog_c_elegans),
            orth_zebrafish: build('Zebrafish Ortholog', g.ortholog_zebrafish),
            lof: build('Loss-of-Function', g.lof_effects),
            over: build('Overexpression', g.overexpression_effects),
            ciliated: build('Ciliated Cell Effect', g.percent_ciliated_cells_effects)
        };

        // Full card or intent-specific
        if (!Object.keys(sq.intent).length || sq.intent.description) {
            sections.push(
                all.description, all.functional_summary, all.localization,
                all.ciliopathy, all.classification, all.complexes, all.domains,
                all.modules, all.screens, all.omim, all.orth_mouse,
                all.orth_celegans, all.orth_zebrafish, all.lof, all.over, all.ciliated
            );
        } else {
            if (sq.intent.localization) sections.push(all.localization);
            if (sq.intent.screens) sections.push(all.screens);
            if (sq.intent.domains) sections.push(all.domains);
            if (sq.intent.complexes) sections.push(all.complexes);
            if (sq.intent.ciliopathy) sections.push(all.ciliopathy, all.classification);
            if (sq.intent.omim) sections.push(all.omim);
            if (sq.intent.orthologs) {
                if (sq.species === 'c_elegans') sections.push(all.orth_celegans);
                else if (sq.species === 'mouse') sections.push(all.orth_mouse);
                else if (sq.species === 'zebrafish') sections.push(all.orth_zebrafish);
                else sections.push(all.orth_mouse, all.orth_celegans, all.orth_zebrafish);
            }
            if (sq.intent.expression && sq.filters.tissue) {
                const t = Object.keys(g.expression?.tissue || {}).find(k => k.toLowerCase().includes(sq.filters.tissue));
                sections.push(build(`Expression in ${sq.filters.tissue}`, g.expression?.tissue?.[t]?.toFixed(2)));
            }
            if (sq.intent.expression && sq.filters.cell_type) {
                sections.push(build(`Expression in ${sq.filters.cell_type}`, g.expression?.scRNA?.[sq.filters.cell_type]?.toFixed(4)));
            }
        }

        return `<div class="result-card"><h3>${g.gene}</h3>${sections.filter(Boolean).join('') || '<p>No data.</p>'}</div>`;
    }).join('');

    area.innerHTML = cards;
}
// ==========================================================
// 5️⃣ Complex Map (Required for BBSome etc.)
// ==========================================================
function getComplexPhylogenyTableMap() {
    return {
        // --- Core IFT machinery ---
        "IFT COMPLEX": ["WDR19", "IFT140", "TTC21B", "IFT122", "WDR35", "IFT43", "IFT172", "IFT80", "IFT57", "TRAF3IP1", "CLUAP1", "IFT20", "IFT88", "IFT81", "IFT74", "IFT70A", "IFT70B", "IFT56", "IFT52", "IFT46", "IFT27", "IFT25", "IFT22"],
        "IFT-A COMPLEX": ["WDR19", "IFT140", "TTC21B", "IFT122", "WDR35", "IFT43"],
        "IFT-B COMPLEX": ["IFT172", "IFT80", "IFT57", "TRAF3IP1", "CLUAP1", "IFT20", "IFT88", "IFT81", "IFT74", "IFT70A", "IFT70B", "IFT56", "IFT52", "IFT46", "IFT27", "IFT25", "IFT22"],
        "IFT-B1 COMPLEX": ["IFT172", "IFT80", "IFT57", "TRAF3IP1", "CLUAP1", "IFT20"],
        "IFT-B2 COMPLEX": ["IFT88", "IFT81", "IFT74", "IFT70A", "IFT70B", "IFT56", "IFT52", "IFT46", "IFT27", "IFT25", "IFT22"],
        
        "IFT MOTOR COMPLEX": ["KIF3A", "KIF3B", "KIF17", "DYNC2H1", "DYNC2LI1", "WDR34", "WDR60"],
        
        // --- BBSome and trafficking ---
        "BBSOME": ["BBS1", "BBS2", "BBS4", "BBS5", "BBS7", "TTC8", "BBS9", "BBIP1"],
        "EXOCYST": ["EXOC1", "EXOC2", "EXOC3", "EXOC4", "EXOC5", "EXOC6", "EXOC7", "EXOC8"],

        // --- Transition zone modules ---
        "TRANSITION ZONE": ["NPHP1", "MKS1", "CEP290", "AHI1", "RPGRIP1L", "TMEM67", "CC2D2A", "B9D1", "B9D2"],
        "MKS MODULE": ["MKS1", "TMEM17", "TMEM67", "TMEM138", "B9D2", "B9D1", "CC2D2A", "TMEM107", "TMEM237", "TMEM231", "TMEM216", "TCTN1", "TCTN2", "TCTN3"],
        "NPHP MODULE": ["NPHP1", "NPHP3", "NPHP4", "RPGRIP1L", "IQCB1", "CEP290", "SDCCAG8"],

        // --- Basal body & appendages ---
        "BASAL BODY": ["CEP164", "CEP83", "SCLT1", "CEP89", "LRRC45", "ODF2", "CEP128", "CEP135", "CETN2", "CETN3", "POC1B", "FBF1", "CCDC41", "CCDC120", "OFD1"],
        
        // --- Axonemal machinery ---
        "CILIARY TIP": ["HYDIN", "IQCA1", "CATSPER2", "KIF19A", "KIF7", "CCDC78", "CCDC33", "SPEF1", "CEP104", "CSPP1"],
        "RADIAL SPOKE": ["RSPH1", "RSPH3", "RSPH4A", "RSPH6A", "RSPH9", "RSPH10B", "RSPH23", "RSPH16"],
        "CENTRAL PAIR": ["HYDIN", "SPAG6", "SPAG16", "SPAG17", "POC1A", "CEP131"],
        "DYNEIN ARM": ["DNAH1", "DNAH2", "DNAH5", "DNAH6", "DNAH7", "DNAH8", "DNAH9", "DNAH10", "DNAH11", "DNALI1", "DNAI1", "DNAI2"],
        "OUTER DYNEIN ARM": ["DNAH5", "DNAH11", "DNAH17", "DNAI1", "DNAI2"],
        "INNER DYNEIN ARM": ["DNAH2", "DNAH7", "DNAH10", "DNALI1"],
        
        // --- Signaling ---
        "SHH SIGNALING": ["SMO", "PTCH1", "GLI1", "GLI2", "GLI3", "SUFU", "KIF7", "TULP3"],
        
        // --- Centrosome ---
        "CENTROSOME": ["CEP152", "CEP192", "PLK4", "STIL", "SAS6", "CEP135", "CETN2", "PCNT"]
    };
}


// ==========================================================
// 6. Page HTML Injector
// ==========================================================
window.displayCiliAIPage = async function () {
    const area = document.querySelector('.content-area');
    if (!area) {
        console.error('[CiliAI] Error: .content-area not found.');
        return;
    }

    area.className = 'content-area content-area-full';
    const ciliaPanel = document.querySelector('.cilia-panel');
    if (ciliaPanel) ciliaPanel.style.display = 'none';

    // === DYNAMICALLY INJECT PLOTLY & CYTOSCAPE ===
    // (Only load once)
    if (!window.Plotly) {
        const plotlyScript = document.createElement('script');
        plotlyScript.src = 'https://cdn.plot.ly/plotly-latest.min.js';
        document.head.appendChild(plotlyScript);
    }
    if (!window.cytoscape) {
        const cytoScript = document.createElement('script');
        cytoScript.src = 'https://cdn.jsdelivr.net/npm/cytoscape@3.23.0/dist/cytoscape.min.js';
        document.head.appendChild(cytoScript);
    }

    // === INJECT FULL HTML + CSS ===
    area.innerHTML = `
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
                            <span data-question="What is IFT52?">What is IFT52?</span>,
                            <span data-question="List genes in the BBSome">List genes in the BBSome</span>,
                            <span data-question="List genes localized to cilia">Genes localized to cilia</span>,
                            <span data-question="Screens for IFT88">Screens for IFT88</span>,
                            <span data-question="Domains of CEP290">Domains of CEP290</span>,
                            <span data-question="List genes in Joubert syndrome">List genes in Joubert syndrome</span>,
                            <span data-question="What is the C. elegans ortholog for IFT52?">C. elegans ortholog for IFT52</span>,
                            <span data-question="Plot UMAP for FOXJ1 expression">Plot UMAP for FOXJ1 expression</span>,
                            <span data-question="Compare expression of ARL13B and FOXJ1 in ciliated cells">Compare ARL13B & FOXJ1 in ciliated cells</span>,
                            <span data-question="Analyze the evolutionary history of YWHAB">Evolution of YWHAB</span>
                        </p>
                    </div>
                    <div id="ai-result-area" class="results-section" style="display: none; margin-top: 1.5rem; padding: 1rem;"></div>
                </div>
            </div>
        </div>

        <style>
            .ciliai-container { 
                font-family: 'Arial', sans-serif; 
                max-width: 950px; 
                margin: 2rem auto; 
                padding: 2rem; 
                background-color: #f9f9f9; 
                border-radius: 12px; 
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            .ciliai-header { text-align: center; margin-bottom: 2rem; }
            .ciliai-header h1 { font-size: 2.8rem; color: #2c5aa0; margin: 0; }
            .ciliai-header p { font-size: 1.2rem; color: #555; margin-top: 0.5rem; }
            .ai-query-section { 
                background-color: #e8f4fd; 
                border: 1px solid #bbdefb; 
                padding: 1.5rem 2rem; 
                border-radius: 8px; 
                margin-bottom: 2rem; 
            }
            .ai-query-section h3 { margin-top: 0; color: #2c5aa0; }
            .ai-input-group { 
                position: relative; 
                display: flex; 
                gap: 10px; 
                align-items: stretch;
            }
            .ai-query-input { 
                flex-grow: 1; 
                padding: 0.8rem; 
                border: 1px solid #ccc; 
                border-radius: 4px; 
                font-size: 1rem; 
            }
            .ai-query-btn { 
                padding: 0.8rem 1.2rem; 
                font-size: 1rem; 
                background-color: #2c5aa0; 
                color: white; 
                border: none; 
                border-radius: 4px; 
                cursor: pointer; 
                transition: background-color 0.2s; 
            }
            .ai-query-btn:hover { background-color: #1e4273; }
            .example-queries { 
                margin-top: 1rem; 
                font-size: 0.9rem; 
                color: #555; 
                text-align: left; 
            }
            .example-queries span { 
                background-color: #d1e7fd; 
                padding: 4px 10px; 
                border-radius: 12px; 
                font-family: 'Arial', sans-serif; 
                cursor: pointer; 
                margin: 4px; 
                display: inline-block; 
                transition: background-color 0.2s; 
                border: 1px solid #b1d7fc;
            }
            .example-queries span:hover { background-color: #b1d7fc; }
            .results-section { 
                margin-top: 2rem; 
                padding: 2rem; 
                background-color: #fff; 
                border-radius: 8px; 
                box-shadow: 0 2px 8px rgba(0,0,0,0.05); 
            }
            .result-card { 
                border: 1px solid #ddd; 
                border-radius: 8px; 
                padding: 1.5rem; 
                margin-bottom: 1.5rem; 
                background: #fdfdfd;
            }
            .result-card h3 { 
                margin-top: 0; 
                color: #2c5aa0; 
                border-bottom: 1px solid #eee; 
                padding-bottom: 0.5rem;
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 1rem; 
                font-size: 0.95rem;
            }
            th, td { 
                border: 1px solid #ddd; 
                padding: 8px; 
                text-align: left; 
            }
            th { 
                background-color: #e8f4fd; 
                color: #2c5aa0; 
                font-weight: 600;
            }
            .suggestions-container { 
                position: absolute; 
                top: 100%; 
                left: 0; 
                right: 0; 
                background: white; 
                border: 1px solid #ccc; 
                z-index: 1000; 
                max-height: 200px; 
                overflow-y: auto; 
                box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
                display: none;
            }
            .suggestion-item { 
                padding: 10px; 
                cursor: pointer; 
                border-bottom: 1px solid #eee;
            }
            .suggestion-item:hover { 
                background-color: #f0f0f0; 
            }
            .download-button { 
                background-color: #28a745; 
                color: white; 
                padding: 8px 14px; 
                border: none; 
                border-radius: 4px; 
                cursor: pointer; 
                font-size: 0.9em; 
                font-weight: bold; 
                margin-top: 15px; 
                transition: background-color 0.3s ease; 
            }
            .download-button:hover { 
                background-color: #218838; 
            }
        </style>
    `;

    console.log('CiliAI: Page HTML injected successfully.');

    // Wait a tick for DOM to settle, then bind events
    setTimeout(ciliAI_waitForElements, 100);
};

// ==========================================================
// 7. Event Listener "Glue"
// ==========================================================
function ciliAI_waitForElements() {
    console.log('[CiliAI] Binding event listeners...');

    const aiBtn = document.getElementById('aiQueryBtn');
    const aiInput = document.getElementById('aiQueryInput');
    const exampleQueries = document.querySelectorAll('.example-queries span');
    const resultArea = document.getElementById('ai-result-area');

    // === MAIN QUERY HANDLER ===
    const handleQuery = async () => {
        const input = aiInput.value.trim();
        if (!input) return;

        resultArea.style.display = 'block';
        resultArea.innerHTML = '<p>Processing your question...</p>';

        try {
            // Ensure data is loaded
            let masterData = window.CiliAI_MasterData;
            if (!masterData) {
                console.log('[CiliAI] Data not loaded, fetching now...');
                masterData = await loadCiliAIData();
            }

            // Parse question
            const structuredQuery = await parseCiliAIQuestion(input, masterData);

            // Route to correct handler
            if (structuredQuery.plotType === 'phylogeny') {
                const html = await getPhylogenyAnalysis(structuredQuery.genes);
                resultArea.innerHTML = html;
            } else if (structuredQuery.plotType === 'umap_expression' && structuredQuery.genes.length > 0) {
                await displayUmapGeneExpression(structuredQuery.genes[0]);
            } else if (structuredQuery.plotType === 'umap_cluster') {
                await displayUmapPlot();
            } else {
                const results = queryGenes(structuredQuery);
                displayCiliAIResults(results, structuredQuery);
            }
        } catch (err) {
            console.error('CiliAI query failed:', err);
            resultArea.innerHTML = `
                <div class="result-card">
                    <h3>Error</h3>
                    <p>Failed to process your question.</p>
                    <pre style="background:#f8d7da;padding:10px;border-radius:4px;color:#721c24;">
${err.message}
                    </pre>
                </div>`;
        }
    };

    // === BIND EVENTS ===
    if (aiBtn) {
        aiBtn.addEventListener('click', handleQuery);
    } else {
        console.error('[CiliAI] Error: aiQueryBtn not found.');
    }

    if (aiInput) {
        aiInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleQuery();
            }
        });
    } else {
        console.error('[CiliAI] Error: aiQueryInput not found.');
    }

    if (exampleQueries.length > 0) {
        exampleQueries.forEach(span => {
            span.addEventListener('click', () => {
                const question = span.getAttribute('data-question');
                if (aiInput && question) {
                    aiInput.value = question;
                    aiInput.focus();
                    handleQuery();
                }
            });
        });
    } else {
        console.warn('[CiliAI] No example queries found.');
    }

    console.log('[CiliAI] Event listeners bound successfully.');
}
// ==========================================================
// 8️⃣ Plotting & Helper Functions
// ==========================================================

// --- UMAP Plotting ---
// (fetchUmapData and fetchCellxgeneData are called from loadCiliAIData
//  and cached, but we can call them here again as a fallback if needed)

async function displayUmapGeneExpression(geneSymbol) {
    const [umapData, cellData] = await Promise.all([
        (window.CiliAI_UMAP ? Promise.resolve(window.CiliAI_UMAP) : loadCiliAIData().then(() => window.CiliAI_UMAP)),
        (window.CiliAI_snRNA ? Promise.resolve(window.CiliAI_snRNA) : loadCiliAIData().then(() => window.CiliAI_snRNA))
    ]);

    const resultArea = document.getElementById('ai-result-area');
    if (!umapData || !cellData) {
        resultArea.innerHTML = `<div class="result-card"><h3>UMAP Expression Plot</h3><p class="status-not-found">Could not load UMAP or Cellxgene data.</p></div>`;
        return;
    }

    const geneUpper = geneSymbol.toUpperCase();
    const geneExpressionMap = cellData[geneUpper];
    if (!geneExpressionMap) {
        resultArea.innerHTML = `<div class="result-card"><h3>${geneSymbol} Expression</h3><p class="status-not-found">Gene not found in dataset.</p></div>`;
        return;
    }

    const sampleSize = 15000;
    const sampledData = umapData.length > sampleSize
        ? Array.from({ length: sampleSize }, () => umapData[Math.floor(Math.random() * umapData.length)])
        : umapData;

    const expressionValues = sampledData.map(cell => geneExpressionMap[cell.cell_type] || 0);
    const cellTypes = [...new Set(sampledData.map(d => d.cell_type))];

    const median = arr => {
        const s = [...arr].sort((a,b)=>a-b);
        const m = Math.floor(s.length/2);
        return s.length%2 ? s[m] : (s[m-1]+s[m])/2;
    };
    const annotations = cellTypes.map(ct => {
        const pts = sampledData.filter(p => p.cell_type===ct);
        return pts.length ? {
            x: median(pts.map(p=>p.x)),
            y: median(pts.map(p=>p.y)),
            text: ct,
            showarrow: false,
            font: {color:'#FFF',size:10,family:'Arial'},
            bgcolor:'rgba(0,0,0,0.4)', borderpad:2
        } : null;
    }).filter(Boolean);

    const plotData = [{
        x: sampledData.map(p=>p.x),
        y: sampledData.map(p=>p.y),
        mode:'markers',
        type:'scattergl',
        hovertext: sampledData.map((p,i)=>`Cell Type: ${p.cell_type}<br>Expression: ${expressionValues[i].toFixed(4)}`),
        hoverinfo:'text',
        marker:{color:expressionValues, colorscale:'Plasma', showscale:true,
                colorbar:{title:{text:'Expression',side:'right'}}, size:5, opacity:0.8}
    }];

    const layout = {
        title:`UMAP Colored by ${geneSymbol} Expression (Sample of ${sampleSize} cells)`,
        xaxis:{title:'UMAP 1',zeroline:false,showgrid:false},
        yaxis:{title:'UMAP 2',zeroline:false,showgrid:false},
        hovermode:'closest',
        margin:{t:50,b:50,l:50,r:50},
        plot_bgcolor:'#FFF',paper_bgcolor:'#FFF',
        annotations, showlegend:false
    };

    const divId = 'umap-expression-plot-div';
    resultArea.innerHTML = `<div class="result-card"><div id="${divId}"></div>
        <button class="download-button" onclick="downloadPlot('${divId}','UMAP_${geneSymbol}_Expression')">Download Plot</button></div>`;
    Plotly.newPlot(divId, plotData, layout, {responsive:true, displayModeBar:false});
}

async function displayUmapPlot() {
    const data = window.CiliAI_UMAP || (await loadCiliAIData(), window.CiliAI_UMAP);
    const resultArea = document.getElementById('ai-result-area');
    if (!data) { resultArea.innerHTML = `<div class="result-card"><h3>UMAP Plot</h3><p class="status-not-found">Could not load UMAP data.</p></div>`; return; }

    const sampleSize = 15000;
    const sampled = data.length > sampleSize
        ? Array.from({ length: sampleSize }, () => data[Math.floor(Math.random()*data.length)])
        : data;

    const cellTypes = [...new Set(sampled.map(d=>d.cell_type))];
    const palette = Plotly.d3.scale.category10();
    const traces = cellTypes.map((ct,i) => {
        const pts = sampled.filter(p=>p.cell_type===ct);
        return {
            x: pts.map(p=>p.x), y: pts.map(p=>p.y),
            name: ct, mode:'markers', type:'scattergl',
            marker:{size:5, opacity:0.8, color:palette(i)},
            hovertext: pts.map(p=>`Cell Type: ${p.cell_type}`), hoverinfo:'text'
        };
    });

    const layout = {
        title:`UMAP of Single-Cell Gene Expression (Sample of ${sampleSize} cells)`,
        xaxis:{title:'UMAP 1'}, yaxis:{title:'UMAP 2'},
        hovermode:'closest', margin:{t:50,b:50,l:50,r:50}
    };

    const divId = 'umap-plot-div';
    resultArea.innerHTML = `<div class="result-card"><div id="${divId}"></div>
        <button class="download-button" onclick="downloadPlot('${divId}','UMAP_CellTypes')">Download Plot</button></div>`;
    Plotly.newPlot(divId, traces, layout, {responsive:true, displayModeBar:false});
}


// ==========================================================
// (ADD THIS FUNCTION) Phylogeny Analysis
// ==========================================================
async function getPhylogenyAnalysis(genes) {
    // Data is already loaded in global caches
    if (!liPhylogenyCache || !neversPhylogenyCache) {
        return `<div class="result-card"><h3>Analysis Error</h3><p>Phylogenetic data not loaded. Please refresh the page.</p></div>`;
    }

    // Build gene maps from cached data
    const liGenesMap = {};
    if (liPhylogenyCache && liPhylogenyCache.genes) {
        Object.values(liPhylogenyCache.genes).forEach(geneObj => {
            if (geneObj.g) {
                liGenesMap[geneObj.g.toUpperCase()] = geneObj;
            }
        });
    }

    const neversGenesMap = {};
    if (neversPhylogenyCache && neversPhylogenyCache.genes) {
        Object.keys(neversPhylogenyCache.genes).forEach(geneKey => {
            neversGenesMap[geneKey.toUpperCase()] = neversPhylogenyCache.genes[geneKey];
        });
    }

    // Find valid genes
    const validGeneSymbols = genes.map(g => g.toUpperCase()).filter(g =>
        liGenesMap[g] || neversGenesMap[g]
    );

    if (validGeneSymbols.length === 0) {
        return `<div class="result-card"><h3>Analysis Error</h3><p>None of the requested genes (${genes.join(', ')}) were found in phylogenetic datasets.</p></div>`;
    }

    const finalGenes = [...new Set(validGeneSymbols)];

    // --- Multi-gene comparison ---
    if (finalGenes.length > 1) {
        let summaryHtml = `
            <div class="result-card">
                <h3>Phylogenetic Comparison: ${finalGenes.join(' vs ')} 📊</h3>
                <table class="gene-detail-table">
                    <thead>
                        <tr>
                            <th>Gene</th>
                            <th>Li Class (2014)</th>
                            <th>Nevers Species Count (out of 99)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        finalGenes.forEach(gene => {
            const liEntry = liGenesMap[gene];
            const neversEntry = neversGenesMap[gene];

            const liClass = liEntry
                ? (liPhylogenyCache.summary.class_list[liEntry.c] || 'N/A').replace(/_/g, ' ')
                : 'N/A';
            const neversCount = neversEntry?.s?.length || 0;

            summaryHtml += `
                <tr>
                    <td><strong>${gene}</strong></td>
                    <td>${liClass}</td>
                    <td>${neversCount}</td>
                </tr>
            `;
        });

        summaryHtml += `</tbody></table></div>`;
        return summaryHtml;

    } else {
        // --- Single gene analysis ---
        const geneSymbol = finalGenes[0];
        const liEntry = liGenesMap[geneSymbol];
        const neversEntry = neversGenesMap[geneSymbol];

        const liSummary = liEntry
            ? (liPhylogenyCache.summary.class_list[liEntry.c] || 'Classification Unavailable').replace(/_/g, ' ')
            : 'Not found in Li et al. (2014)';
        const neversSpeciesCount = neversEntry?.s?.length || 0;
        const neversStatus = neversEntry
            ? `Found in ${neversSpeciesCount} species (Nevers et al. 2017)`
            : 'Not found in Nevers et al. (2017)';

        return `
            <div class="result-card">
                <h3>Evolutionary Summary: ${geneSymbol} 🧬</h3>
                <table class="gene-detail-table">
                    <tr><th>Li et al. (2014) Classification</th><td><strong>${liSummary}</strong></td></tr>
                    <tr><th>Nevers et al. (2017) Status</th><td>${neversStatus}</td></tr>
                </table>
            </div>
        `;
    }
}

// --- Download Helper ---
function downloadPlot(plotDivId, filename) {
    Plotly.toImage(plotDivId, {format: 'png', width: 1200, height: 800})
        .then(function(dataUrl) {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `${filename}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
}

/* ==============================================================
   10. BOOTSTRAP – inject page & load data on first use
   ============================================================== */
document.addEventListener('DOMContentLoaded', async ()=>{
    await displayCiliAIPage();          // builds UI
    await loadCiliAIData();            // pre-load everything (caches are now ready
