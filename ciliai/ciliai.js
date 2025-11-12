// ==========================================================
// CiliAI Complete Integrated Code
// ==========================================================
// ==========================================================
// 1. UNIFIED Data Loading - Integrates ALL datasets
// ==========================================================
let liPhylogenyCache = null;
let neversPhylogenyCache = null;
let umapDataCache = null;
let cellxgeneDataCache = null;

// Replace your entire loadCiliAIData function with this fixed version:

async function loadCiliAIData(timeoutMs = 30000) {
    const urls = {
        ciliahub: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/ciliahub_data.json',
        umap: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/umap_data.json',
        screens: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cilia_screens_data.json',
        cellxgene: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cellxgene_data.json',
        rna_tissue: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/rna_tissue_consensus.tsv',
        corum: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/corum_humanComplexes.json',
        domains: 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cili_ai_domain_database.json',
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

    console.log('CiliAI: fetching all data (parallel)...');
    
    // Fetch all data sources
    const [
        ciliahubRaw, umapRaw, screensRaw, cellxgeneRaw,
        rnaTsv, corumRaw, domainRaw, neversRaw, liRaw
    ] = await Promise.all([
        safeFetch(urls.ciliahub, 'json'),
        safeFetch(urls.umap, 'json'),
        safeFetch(urls.screens, 'json'),
        safeFetch(urls.cellxgene, 'json'),
        safeFetch(urls.rna_tissue, 'tsv'),
        safeFetch(urls.corum, 'json'),
        safeFetch(urls.domains, 'json'),
        safeFetch(urls.nevers2017, 'json'),
        safeFetch(urls.li2014, 'json')
    ]);

    console.log('Data fetch results:', {
        ciliahub: ciliahubRaw ? `Array(${ciliahubRaw.length})` : 'failed',
        umap: umapRaw ? 'loaded' : 'failed',
        screens: screensRaw ? 'loaded' : 'failed',
        cellxgene: cellxgeneRaw ? 'loaded' : 'failed',
        rnaTissue: rnaTsv ? 'loaded' : 'failed',
        corum: corumRaw ? 'loaded' : 'failed',
        domains: domainRaw ? 'loaded' : 'failed',
        nevers: neversRaw ? 'loaded' : 'failed',
        li: liRaw ? 'loaded' : 'failed'
    });

    // ========== PROCESS INDIVIDUAL DATASETS ==========

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
    console.log(`Processed screens data: ${Object.keys(screensByGene).length} genes`);

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
    console.log(`Processed CORUM data: ${Object.keys(corumByGene).length} genes`);

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
    console.log(`Processed domain data: ${Object.keys(domainsByGene).length} genes`);

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
    console.log(`Processed Li 2014 data: ${Object.keys(liMap).length} genes`);

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
    console.log(`Processed Nevers 2017 data: ${Object.keys(neversMap).length} genes`);

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

    // ========== SET GLOBAL VARIABLES FOR PARSER ==========
    
    // Set global variables BEFORE main data integration
    window.screensByGene = screensByGene;
    window.corumByGene = corumByGene;
    window.domainsByGene = domainsByGene;
    window.liMap = liMap;
    window.neversMap = neversMap;
    window.CiliAI_UMAP = umapRaw || [];
    window.CiliAI_snRNA = cellxgeneRaw || {};

    console.log('Global datasets set for parser:', {
        screens: Object.keys(screensByGene).length,
        corum: Object.keys(corumByGene).length,
        domains: Object.keys(domainsByGene).length,
        liMap: Object.keys(liMap).length,
        neversMap: Object.keys(neversMap).length
    });

    // ========== MAIN DATA INTEGRATION ==========

    // Process ciliopathy information
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

    // Main data integration
    const hubData = Array.isArray(ciliahubRaw) ? ciliahubRaw : [];
    if (!hubData.length) {
        console.error('ciliahub_data.json empty or missing');
        window.CiliAI_MasterData = [];
        return [];
    }

    const masterData = hubData.map(gene => {
        const geneSymbol = gene.gene ?? gene.g ?? gene.name ?? gene.symbol ?? null;
        const geneKey = geneSymbol ? geneSymbol.toUpperCase() : null;

        // Extract explicit fields
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

        // Orthologs
        const orthologs = {
            ortholog_mouse: gene.ortholog_mouse || null,
            ortholog_c_elegans: gene.ortholog_c_elegans || null,
            ortholog_xenopus: gene.ortholog_xenopus || null,
            ortholog_zebrafish: gene.ortholog_zebrafish || null,
            ortholog_drosophila: gene.ortholog_drosophila || null
        };

        // Ciliopathy info
        const { ciliopathy, ciliopathy_classification } = extractCiliopathyInfo(gene);

        // Merge screens data
        const originalScreens = Array.isArray(gene.screens) ? gene.screens : [];
        const additionalScreens = geneKey ? (screensByGene[geneKey] || []) : [];
        const allScreens = [...originalScreens, ...additionalScreens];

        // Merge domain data
        const externalDomains = geneKey ? (domainsByGene[geneKey] || { pfam_ids: [], domain_descriptions: [] }) : { pfam_ids: [], domain_descriptions: [] };
        
        // Merge complex data
        const originalComplexes = gene.complex_components && typeof gene.complex_components === 'object' ? gene.complex_components : {};
        const corumComplexes = geneKey ? (corumByGene[geneKey] || {}) : {};
        const mergedComplexes = { ...originalComplexes, ...corumComplexes };

        // Expression data
        const scExpression = geneKey ? (scExpressionByGene[geneKey] || null) : null;
        const tissueExpression = geneKey ? (tissueExpressionByGene[geneKey] || null) : null;

        // Functional modules from Li data
        const modules = [];
        if (geneKey && liMap[geneKey]) {
            const className = liMap[geneKey].class;
            if (className && className !== 'No_data' && className !== 'Other') {
                modules.push(className.replace(/_/g, ' '));
            }
        }

        // Phylogeny data
        const phylogeny = {
            li_2014: geneKey ? (liMap[geneKey] || null) : null,
            nevers_2017: geneKey ? (neversMap[geneKey] || null) : null
        };

        // Return integrated gene object
        return {
            // Original data
            ...gene,
            
            // Explicit fields
            ...explicitFields,
            ...orthologs,
            
            // Processed arrays
            ciliopathy,
            ciliopathy_classification,
            screens: allScreens,
            
            // Expression data
            expression: {
                scRNA: scExpression,
                tissue: tissueExpression
            },
            
            // Complex data
            complex_components: mergedComplexes,
            
            // Domain data (merged)
            pfam_ids: Array.from(new Set([
                ...explicitFields.pfam_ids,
                ...externalDomains.pfam_ids
            ])),
            domain_descriptions: Array.from(new Set([
                ...explicitFields.domain_descriptions,
                ...externalDomains.domain_descriptions
            ])),
            
            // Functional modules
            functional_modules: modules,
            
            // Phylogeny data
            phylogeny
        };
    });

    // Add genes from phylogeny data that are missing from master data
    function addPhylogenyOnlyGenes(masterData, liMap, neversMap) {
        const existingGenes = new Set(masterData.map(g => g.gene?.toUpperCase()));
        const phylogenyOnlyGenes = [];
        
        // Add genes from Li 2014 that are missing
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
        
        // Add genes from Nevers 2017 that are missing (and not already added from Li)
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

    const enhancedMasterData = addPhylogenyOnlyGenes(masterData, liMap, neversMap);
    window.CiliAI_MasterData = enhancedMasterData;

    console.log(`CiliAI: ${enhancedMasterData.length} genes successfully integrated`);
    console.log('Data integration complete:', {
        totalGenes: enhancedMasterData.length,
        withScreens: enhancedMasterData.filter(g => g.screens && g.screens.length > 0).length,
        withDomains: enhancedMasterData.filter(g => g.pfam_ids && g.pfam_ids.length > 0).length,
        withComplexes: enhancedMasterData.filter(g => Object.keys(g.complex_components || {}).length > 0).length,
        withPhylogeny: enhancedMasterData.filter(g => g.phylogeny.li_2014 || g.phylogeny.nevers_2017).length
    });

    return enhancedMasterData;
}

/* ==============================================================
   2. QUESTION PARSER (recognises Joubert, BBSome, etc.)
   ============================================================== */
async function parseCiliAIQuestion(question, masterData) {
    const q = question.toLowerCase().trim();
    console.log('Parsing question:', q);
    
    const structured = {
        genes: [],
        filters: {},
        intent: {},
        comparison: false,
        species: null,
        plotType: null,
        question: question
    };

    // Build comprehensive gene map from ALL data sources
    const geneMap = await buildComprehensiveGeneMap(masterData);
    
    // Extract genes using the comprehensive map
    structured.genes = extractGenesFromQuestion(q, geneMap);
    console.log('Extracted genes:', structured.genes);

    // Intent detection (your existing code)
    if (q.includes('localize') || q.includes('localization') || q.includes('located')) {
        structured.intent.localization = true;
    }
    if (q.includes('cilia') || q.includes('ciliary')) {
        structured.filters.localization = 'cilia';
    }
    if (q.includes('basal body')) {
        structured.filters.localization = 'basal body';
    }
    if (q.includes('centrosome')) {
        structured.filters.localization = 'centrosome';
    }
    if (q.includes('screen') || q.includes('percent ciliated')) {
        structured.intent.screens = true;
    }
    if (q.includes('domain') || q.includes('pfam')) {
        structured.intent.domains = true;
    }
    if (q.includes('complex') || q.includes('complexes')) {
        structured.intent.complexes = true;
    }

    // Complex detection
    const complexMap = getComplexPhylogenyTableMap();
    for (const name in complexMap) {
        if (q.includes(name.toLowerCase())) {
            if (name.includes('MODULE') || name.includes('TIP') || name.includes('ZONE') || name.includes('PAIR')) {
                structured.filters.functional_modules = name;
            } else {
                structured.filters.complexes = name;
            }
            break;
        }
    }
    if (!structured.filters.complexes && q.includes('bbsome')) {
        structured.filters.complexes = 'BBSOME';
    }

    if (q.includes('ortholog') || q.includes('orthologue')) {
        structured.intent.orthologs = true;
    }
    if (q.includes('c. elegans') || q.includes('worm') || q.includes('elegans')) {
        structured.species = 'c_elegans';
    }
    if (q.includes('mouse') || q.includes('mus musculus')) {
        structured.species = 'mouse';
    }
    if (q.includes('human') || q.includes('homo sapiens')) {
        structured.species = 'human';
    }
    if (q.includes('zebrafish') || q.includes('danio')) {
        structured.species = 'zebrafish';
    }
    if (q.includes('drosophila') || q.includes('fly')) {
        structured.species = 'drosophila';
    }

    if (q.includes('ciliopathy') || q.includes('disease') || q.includes('syndrome')) {
        structured.intent.ciliopathy = true;
    }
    if (q.includes('joubert') || q.includes('jbts')) {
        structured.filters.ciliopathy = 'joubert syndrome';
    }
    if (q.includes('bbs') || q.includes('bardet')) {
        structured.filters.ciliopathy = 'bardet-biedl syndrome';
    }
    if (q.includes('nephronophthisis') || q.includes('nphp')) {
        structured.filters.ciliopathy = 'nephronophthisis';
    }

    if (q.includes('omim')) {
        structured.intent.omim = true;
    }
    if (q.includes('describe') || q.startsWith('what is') || q.startsWith('what does') || q.includes('summary')) {
        structured.intent.description = true;
    }

    if (q.includes('express') || q.includes('expression')) {
        structured.intent.expression = true;
    }
    if (q.includes('lung')) {
        structured.filters.tissue = 'lung';
    }
    if (q.includes('kidney')) {
        structured.filters.tissue = 'kidney';
    }
    if (q.includes('brain')) {
        structured.filters.tissue = 'brain';
    }
    if (q.includes('ciliated cell')) {
        structured.filters.cell_type = 'ciliated cell';
    }

    // Plot type detection
    if (q.includes('umap') && q.includes('expression')) {
        structured.plotType = 'umap_expression';
        structured.intent.umap = true;
    } else if (q.includes('umap')) {
        structured.plotType = 'umap_cluster';
        structured.intent.umap = true;
    }
    
    // Phylogeny detection
    if (q.includes('phylogen') || q.includes('evolution') || q.includes('conservation') || 
        q.includes('evolutionary') || q.includes('history')) {
        structured.plotType = 'phylogeny';
        structured.intent.phylogeny = true;
    }

    // Fallback intents
    if (structured.genes.length > 0 && Object.keys(structured.intent).length === 0) {
        structured.intent.description = true;
    }
    if (structured.genes.length === 0 && Object.keys(structured.filters).length > 0) {
        structured.intent.list_genes = true;
    }
    
    if (q.includes('compare') || q.includes('comparison') || q.includes('vs') || q.includes('versus')) {
        structured.comparison = true;
    }
    
    if ((q.startsWith('is') || q.startsWith('are')) && (q.includes('cilia') || q.includes('ciliary'))) {
        structured.intent.localization = true;
    }

    console.log('Final structured query:', JSON.stringify(structured, null, 2));
    return structured;
}

// NEW: Build comprehensive gene map from ALL data sources
async function buildComprehensiveGeneMap(masterData) {
    const geneMap = new Map();
    
    // 1. Add genes from master data (CiliaHub)
    if (masterData && Array.isArray(masterData)) {
        masterData.forEach(g => {
            const geneSymbol = g.gene;
            if (geneSymbol) {
                const key = geneSymbol.toUpperCase();
                geneMap.set(key, {
                    symbol: geneSymbol.toUpperCase(),
                    source: 'ciliahub',
                    data: g
                });
                
                // Add synonyms from master data
                if (g.synonym) {
                    const syns = Array.isArray(g.synonym) ? g.synonym : g.synonym.split(/[,;]\s*/);
                    syns.forEach(s => {
                        if (s && s.trim()) {
                            const synKey = s.trim().toUpperCase();
                            geneMap.set(synKey, {
                                symbol: geneSymbol.toUpperCase(),
                                source: 'ciliahub_synonym',
                                original: s.trim(),
                                data: g
                            });
                        }
                    });
                }
            }
        });
    }
    
    // 2. Add genes from phylogeny maps
    if (window.liMap) {
        Object.keys(window.liMap).forEach(geneSymbol => {
            if (geneSymbol) {
                const key = geneSymbol.toUpperCase();
                if (!geneMap.has(key)) {
                    geneMap.set(key, {
                        symbol: geneSymbol.toUpperCase(),
                        source: 'li_phylogeny',
                        data: { phylogeny: { li_2014: window.liMap[geneSymbol] } }
                    });
                }
            }
        });
    }
    
    if (window.neversMap) {
        Object.keys(window.neversMap).forEach(geneSymbol => {
            if (geneSymbol) {
                const key = geneSymbol.toUpperCase();
                if (!geneMap.has(key)) {
                    geneMap.set(key, {
                        symbol: geneSymbol.toUpperCase(),
                        source: 'nevers_phylogeny',
                        data: { phylogeny: { nevers_2017: window.neversMap[geneSymbol] } }
                    });
                } else {
                    // Add Nevers data to existing entry
                    const existing = geneMap.get(key);
                    if (existing.data && !existing.data.phylogeny) {
                        existing.data.phylogeny = {};
                    }
                    if (existing.data.phylogeny) {
                        existing.data.phylogeny.nevers_2017 = window.neversMap[geneSymbol];
                    }
                }
            }
        });
    }
    
    // 3. Add genes from screens data
    if (window.screensByGene) {
        Object.keys(window.screensByGene).forEach(geneSymbol => {
            if (geneSymbol) {
                const key = geneSymbol.toUpperCase();
                if (!geneMap.has(key)) {
                    geneMap.set(key, {
                        symbol: geneSymbol.toUpperCase(),
                        source: 'screens',
                        data: { screens: window.screensByGene[geneSymbol] }
                    });
                } else {
                    // Add screens data to existing entry
                    const existing = geneMap.get(key);
                    if (!existing.data.screens) {
                        existing.data.screens = [];
                    }
                    existing.data.screens.push(...window.screensByGene[geneSymbol]);
                }
            }
        });
    }
    
    // 4. Add genes from CORUM complexes
    if (window.corumByGene) {
        Object.keys(window.corumByGene).forEach(geneSymbol => {
            if (geneSymbol) {
                const key = geneSymbol.toUpperCase();
                if (!geneMap.has(key)) {
                    geneMap.set(key, {
                        symbol: geneSymbol.toUpperCase(),
                        source: 'corum',
                        data: { complex_components: window.corumByGene[geneSymbol] }
                    });
                } else {
                    // Add complex data to existing entry
                    const existing = geneMap.get(key);
                    if (!existing.data.complex_components) {
                        existing.data.complex_components = {};
                    }
                    Object.assign(existing.data.complex_components, window.corumByGene[geneSymbol]);
                }
            }
        });
    }
    
    // 5. Add genes from domain data
    if (window.domainsByGene) {
        Object.keys(window.domainsByGene).forEach(geneSymbol => {
            if (geneSymbol) {
                const key = geneSymbol.toUpperCase();
                if (!geneMap.has(key)) {
                    geneMap.set(key, {
                        symbol: geneSymbol.toUpperCase(),
                        source: 'domains',
                        data: { 
                            pfam_ids: window.domainsByGene[geneSymbol]?.pfam_ids || [],
                            domain_descriptions: window.domainsByGene[geneSymbol]?.domain_descriptions || []
                        }
                    });
                } else {
                    // Add domain data to existing entry
                    const existing = geneMap.get(key);
                    if (!existing.data.pfam_ids) {
                        existing.data.pfam_ids = [];
                    }
                    if (!existing.data.domain_descriptions) {
                        existing.data.domain_descriptions = [];
                    }
                    
                    const domainData = window.domainsByGene[geneSymbol];
                    if (domainData) {
                        if (domainData.pfam_ids) {
                            existing.data.pfam_ids.push(...domainData.pfam_ids);
                        }
                        if (domainData.domain_descriptions) {
                            existing.data.domain_descriptions.push(...domainData.domain_descriptions);
                        }
                        
                        // Remove duplicates
                        existing.data.pfam_ids = [...new Set(existing.data.pfam_ids)];
                        existing.data.domain_descriptions = [...new Set(existing.data.domain_descriptions)];
                    }
                }
            }
        });
    }
    
    // 6. Add genes from predefined complex map
    const complexMap = getComplexPhylogenyTableMap();
    Object.keys(complexMap).forEach(complexName => {
        const genes = complexMap[complexName];
        if (Array.isArray(genes)) {
            genes.forEach(geneSymbol => {
                if (geneSymbol) {
                    const key = geneSymbol.toUpperCase();
                    if (!geneMap.has(key)) {
                        geneMap.set(key, {
                            symbol: geneSymbol.toUpperCase(),
                            source: 'predefined_complex',
                            data: { 
                                complex_membership: [complexName],
                                is_predefined_complex: true
                            }
                        });
                    } else {
                        // Add complex membership to existing entry
                        const existing = geneMap.get(key);
                        if (!existing.data.complex_membership) {
                            existing.data.complex_membership = [];
                        }
                        if (!existing.data.complex_membership.includes(complexName)) {
                            existing.data.complex_membership.push(complexName);
                        }
                    }
                }
            });
        }
    });
    
    console.log(`Comprehensive gene map built with ${geneMap.size} entries from multiple sources`);
    
    // Log sources breakdown
    const sources = {};
    geneMap.forEach((value, key) => {
        if (!sources[value.source]) {
            sources[value.source] = 0;
        }
        sources[value.source]++;
    });
    console.log('Gene sources breakdown:', sources);
    
    return geneMap;
}

// NEW: Extract genes from question using comprehensive map
function extractGenesFromQuestion(question, geneMap) {
    const foundGenes = new Set();
    const q = question.toLowerCase();
    
    // Method 1: Direct word matching
    const words = q.split(/\s+/);
    words.forEach(word => {
        const cleanWord = word.replace(/[.,;!?()]/g, '').toLowerCase();
        if (cleanWord.length >= 2) { // Avoid single letters
            // Exact match
            if (geneMap.has(cleanWord.toUpperCase())) {
                const geneInfo = geneMap.get(cleanWord.toUpperCase());
                foundGenes.add(geneInfo.symbol);
            }
        }
    });
    
    // Method 2: Substring scanning for longer gene names
    Object.keys(geneMap).forEach(geneKey => {
        const geneLower = geneKey.toLowerCase();
        if (q.includes(geneLower) && geneLower.length >= 3) {
            foundGenes.add(geneKey);
        }
    });
    
    // Method 3: Look for common gene patterns (all caps in original question)
    const originalQuestion = question;
    const capsMatches = originalQuestion.match(/\b[A-Z][A-Z0-9]{1,9}\b/g);
    if (capsMatches) {
        capsMatches.forEach(match => {
            const matchUpper = match.toUpperCase();
            if (geneMap.has(matchUpper)) {
                foundGenes.add(matchUpper);
            }
        });
    }
    
    // Method 4: Handle specific known genes mentioned in the question
    const commonGenes = ['YWHAB', 'IFT88', 'BBS1', 'CEP290', 'ARL13B', 'FOXJ1'];
    commonGenes.forEach(gene => {
        if (q.includes(gene.toLowerCase())) {
            foundGenes.add(gene);
        }
    });
    
    return Array.from(foundGenes);
}

// NEW: Enhanced data integration in loadCiliAIData
// Add this to your loadCiliAIData function after processing all individual datasets:

// Make the processed datasets globally available for the parser
window.screensByGene = screensByGene;
window.corumByGene = corumByGene;
window.domainsByGene = domainsByGene;
window.liMap = liMap;
window.neversMap = neversMap;

console.log('Global datasets available for parser:', {
    screens: Object.keys(screensByGene).length,
    corum: Object.keys(corumByGene).length,
    domains: Object.keys(domainsByGene).length,
    liMap: Object.keys(liMap).length,
    neversMap: Object.keys(neversMap).length
});


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
            if(f.localization && !(g.localization||'').toLowerCase().includes(f.localization.toLowerCase())) return false;

            if(f.complexes){
                const txt = f.complexes.toLowerCase();
                const own = Object.keys(g.complex_components||{}).some(n=>n.toLowerCase().includes(txt));
                if(own) return true;
                const map = getComplexPhylogenyTableMap()[f.complexes.toUpperCase()]||[];
                if(map.includes(g.gene.toUpperCase())) return true;
                return false;
            }

            if(f.functional_modules){
                const txt = f.functional_modules.toLowerCase();
                const own = (g.functional_modules||[]).some(m=>m.toLowerCase().includes(txt));
                if(own) return true;
                const map = getComplexPhylogenyTableMap()[f.functional_modules.toUpperCase()]||[];
                if(map.includes(g.gene.toUpperCase())) return true;
                return false;
            }

            if(f.ciliopathy){
                const txt = f.ciliopathy.toLowerCase();
                if(!(g.ciliopathy||[]).some(c=>c.toLowerCase().includes(txt))) return false;
            }

            if(f.tissue && g.expression?.tissue){
                const t = Object.keys(g.expression.tissue).find(k=>k.toLowerCase().includes(f.tissue.toLowerCase()));
                if(!t || (g.expression.tissue[t]||0)<=0) return false;
            }
            if(f.cell_type && g.expression?.scRNA){
                if((g.expression.scRNA[f.cell_type]||0)<=0) return false;
            }

            if(f.species){
                const key = `ortholog_${f.species}`;
                if(!g[key]) return false;
            }
            return true;
        });
    }

    if(structured.intent.expression && f.tissue && !structured.genes.length){
        results.sort((a,b)=>{
            const ta = Object.keys(a.expression?.tissue||{}).find(k=>k.toLowerCase().includes(f.tissue));
            const tb = Object.keys(b.expression?.tissue||{}).find(k=>k.toLowerCase().includes(f.tissue));
            return (b.expression?.tissue?.[tb]||0) - (a.expression?.tissue?.[ta]||0);
        }).slice(0,10);
    }
    return results;
}

/* ==============================================================
   4. RESULT RENDERING
   ============================================================== */
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

    // LIST QUERIES
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

    // COMPARISON
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

    // GENE CARD
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
            ciliopathy: build('Ciliopathies', g.ciliopathy),
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

/* ==============================================================
   5. Complex Map (required for BBSome etc.)
   ============================================================== */
function getComplexPhylogenyTableMap() {
    return {
        "IFT COMPLEX": ["WDR19","IFT140","TTC21B","IFT122","WDR35","IFT43","IFT172","IFT80","IFT57","TRAF3IP1","CLUAP1","IFT20","IFT88","IFT81","IFT74","IFT70A","IFT70B","IFT56","IFT52","IFT46","IFT27","IFT25","IFT22"],
        "IFT-A COMPLEX": ["WDR19","IFT140","TTC21B","IFT122","WDR35","IFT43"],
        "IFT-B COMPLEX": ["IFT172","IFT80","IFT57","TRAF3IP1","CLUAP1","IFT20","IFT88","IFT81","IFT74","IFT70A","IFT70B","IFT56","IFT52","IFT46","IFT27","IFT25","IFT22"],
        "IFT-B1 COMPLEX": ["IFT172","IFT80","IFT57","TRAF3IP1","CLUAP1","IFT20"],
        "IFT-B2 COMPLEX": ["IFT88","IFT81","IFT74","IFT70A","IFT70B","IFT56","IFT52","IFT46","IFT27","IFT25","IFT22"],
        "IFT MOTOR COMPLEX": ["KIF3A","KIF3B","KIF17","DYNC2H1","DYNC2LI1","WDR34","WDR60"],
        "BBSOME": ["BBS1","BBS2","BBS4","BBS5","BBS7","TTC8","BBS9","BBIP1"],
        "EXOCYST": ["EXOC1","EXOC2","EXOC3","EXOC4","EXOC5","EXOC6","EXOC7","EXOC8"],
        "TRANSITION ZONE": ["NPHP1","MKS1","CEP290","AHI1","RPGRIP1L","TMEM67","CC2D2A","B9D1","B9D2"],
        "MKS MODULE": ["MKS1","TMEM17","TMEM67","TMEM138","B9D2","B9D1","CC2D2A","TMEM107","TMEM237","TMEM231","TMEM216","TCTN1","TCTN2","TCTN3"],
        "NPHP MODULE": ["NPHP1","NPHP3","NPHP4","RPGRIP1L","IQCB1","CEP290","SDCCAG8"],
        "BASAL BODY": ["CEP164","CEP83","SCLT1","CEP89","LRRC45","ODF2","CEP128","CEP135","CETN2","CETN3","POC1B","FBF1","CCDC41","CCDC120","OFD1"],
        "CILIARY TIP": ["HYDIN","IQCA1","CATSPER2","KIF19A","KIF7","CCDC78","CCDC33","SPEF1","CEP104","CSPP1"],
        "RADIAL SPOKE": ["RSPH1","RSPH3","RSPH4A","RSPH6A","RSPH9","RSPH10B","RSPH23","RSPH16"],
        "CENTRAL PAIR": ["HYDIN","SPAG6","SPAG16","SPAG17","POC1A","CEP131"],
        "DYNEIN ARM": ["DNAH1","DNAH2","DNAH5","DNAH6","DNAH7","DNAH8","DNAH9","DNAH10","DNAH11","DNALI1","DNAI1","DNAI2"],
        "OUTER DYNEIN ARM": ["DNAH5","DNAH11","DNAH17","DNAI1","DNAI2"],
        "INNER DYNEIN ARM": ["DNAH2","DNAH7","DNAH10","DNALI1"],
        "SHH SIGNALING": ["SMO","PTCH1","GLI1","GLI2","GLI3","SUFU","KIF7","TULP3"],
        "CENTROSOME": ["CEP152","CEP192","PLK4","STIL","SAS6","CEP135","CETN2","PCNT"]
    };
}

/* ==============================================================
   6. Page HTML Injector
   ============================================================== */
window.displayCiliAIPage = async function () {
    const area = document.querySelector('.content-area');
    if (!area) { console.error('[CiliAI] .content-area not found.'); return; }
    area.className = 'content-area content-area-full';
    const ciliaPanel = document.querySelector('.cilia-panel');
    if (ciliaPanel) ciliaPanel.style.display = 'none';

    if (!window.Plotly) {
        const s = document.createElement('script');
        s.src = 'https://cdn.plot.ly/plotly-latest.min.js';
        document.head.appendChild(s);
    }
    if (!window.cytoscape) {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/cytoscape@3.23.0/dist/cytoscape.min.js';
        document.head.appendChild(s);
    }

    area.innerHTML = `
        <div class="ciliai-container">
            <div class="ciliai-header"><h1>CiliAI</h1><p>Your AI-powered partner for discovering gene-cilia relationships.</p></div>
            <div class="ciliai-main-content">
                <div class="ai-query-section">
                    <h3>Ask a Question</h3>
                    <div class="ai-input-group autocomplete-wrapper">
                        <input type="text" id="aiQueryInput" class="ai-query-input" placeholder="What's on your mind? Try a gene name or a question...">
                        <div id="aiQuerySuggestions" class="suggestions-container"></div>
                        <button class="ai-query-btn" id="aiQueryBtn">Ask CiliAI</button>
                    </div>
                    <div class="example-queries">
                        <p><strong>Try asking:</strong>
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
                    <div id="ai-result-area" class="results-section" style="display:none;"></div>
                </div>
            </div>
        </div>
        <style>
            /* (all the CSS you already had – unchanged) */
            .ciliai-container{font-family:Arial,sans-serif;max-width:950px;margin:2rem auto;padding:2rem;background:#f9f9f9;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,.1)}
            .ciliai-header{text-align:center;margin-bottom:2rem}
            .ciliai-header h1{font-size:2.8rem;color:#2c5aa0;margin:0}
            .ciliai-header p{font-size:1.2rem;color:#555;margin-top:.5rem}
            .ai-query-section{background:#e8f4fd;border:1px solid #bbdefb;padding:1.5rem 2rem;border-radius:8px;margin-bottom:2rem}
            .ai-query-section h3{margin-top:0;color:#2c5aa0}
            .ai-input-group{position:relative;display:flex;gap:10px;align-items:stretch}
            .ai-query-input{flex-grow:1;padding:.8rem;border:1px solid #ccc;border-radius:4px;font-size:1rem}
            .ai-query-btn{padding:.8rem 1.2rem;font-size:1rem;background:#2c5aa0;color:#fff;border:none;border-radius:4px;cursor:pointer;transition:background .2s}
            .ai-query-btn:hover{background:#1e4273}
            .example-queries{margin-top:1rem;font-size:.9rem;color:#555;text-align:left}
            .example-queries span{background:#d1e7fd;padding:4px 10px;border-radius:12px;cursor:pointer;margin:4px;display:inline-block;transition:background .2s;border:1px solid #b1d7fc}
            .example-queries span:hover{background:#b1d7fc}
            .results-section{margin-top:2rem;padding:2rem;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.05)}
            .result-card{border:1px solid #ddd;border-radius:8px;padding:1.5rem;margin-bottom:1.5rem;background:#fdfdfd}
            .result-card h3{margin-top:0;color:#2c5aa0;border-bottom:1px solid #eee;padding-bottom:.5rem}
            table{width:100%;border-collapse:collapse;margin-top:1rem;font-size:.95rem}
            th,td{border:1px solid #ddd;padding:8px;text-align:left}
            th{background:#e8f4fd;color:#2c5aa0;font-weight:600}
            .suggestions-container{position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #ccc;z-index:1000;max-height:200px;overflow-y:auto;box-shadow:0 4px 6px rgba(0,0,0,.1);display:none}
            .suggestion-item{padding:10px;cursor:pointer;border-bottom:1px solid #eee}
            .suggestion-item:hover{background:#f0f0f0}
            .download-button{background:#28a745;color:#fff;padding:8px 14px;border:none;border-radius:4px;cursor:pointer;font-size:.9em;font-weight:bold;margin-top:15px;transition:background .3s}
            .download-button:hover{background:#218838}
        </style>
    `;

    console.log('CiliAI: Page HTML injected successfully.');
    setTimeout(ciliAI_waitForElements, 100);
};

/* ==============================================================
   7. Event Listener Glue
   ============================================================== */
function ciliAI_waitForElements() {
    console.log('[CiliAI] Binding event listeners...');
    const aiBtn = document.getElementById('aiQueryBtn');
    const aiInput = document.getElementById('aiQueryInput');
    const exampleQueries = document.querySelectorAll('.example-queries span');
    const resultArea = document.getElementById('ai-result-area');

    // Update the handleQuery function to use enhanced parsing
const handleQuery = async () => {
    const input = aiInput.value.trim();
    if (!input) return;
    resultArea.style.display = 'block';
    resultArea.innerHTML = '<p>Processing your question...</p>';

    try {
        let masterData = window.CiliAI_MasterData;
        if (!masterData) {
            console.log('[CiliAI] Data not loaded, fetching now...');
            masterData = await loadCiliAIData();
        }

        const structuredQuery = await parseCiliAIQuestion(input, masterData);
        console.log('Structured query with multi-source genes:', structuredQuery);

        // Handle queries for genes that only exist in external sources
        if (structuredQuery.genes.length > 0) {
            // Check if we need to create temporary gene entries for external-only genes
            const enhancedResults = await enhanceResultsWithExternalData(structuredQuery.genes, structuredQuery);
            
            if (enhancedResults.length > 0) {
                if (structuredQuery.plotType === 'phylogeny') {
                    console.log('Running phylogeny analysis for:', structuredQuery.genes);
                    const html = await getPhylogenyAnalysis(structuredQuery.genes);
                    resultArea.innerHTML = html;
                } else if (structuredQuery.plotType === 'umap_expression' && structuredQuery.genes.length > 0) {
                    await displayUmapGeneExpression(structuredQuery.genes[0]);
                } else if (structuredQuery.plotType === 'umap_cluster') {
                    await displayUmapPlot();
                } else {
                    displayCiliAIResults(enhancedResults, structuredQuery);
                }
                return;
            }
        }

        // Original logic for genes in master data
        if (structuredQuery.plotType === 'phylogeny') {
            console.log('Running phylogeny analysis for:', structuredQuery.genes);
            const html = await getPhylogenyAnalysis(structuredQuery.genes);
            resultArea.innerHTML = html;
        } else if (structuredQuery.plotType === 'umap_expression' && structuredQuery.genes.length > 0) {
            await displayUmapGeneExpression(structuredQuery.genes[0]);
        } else if (structuredQuery.plotType === 'umap_cluster') {
            await displayUmapPlot();
        } else {
            const results = queryGenes(structuredQuery);
            console.log(`Query returned ${results.length} results`);
            displayCiliAIResults(results, structuredQuery);
        }
    } catch (err) {
        console.error('CiliAI query failed:', err);
        resultArea.innerHTML = `
            <div class="result-card">
                <h3>Error</h3>
                <p>Failed to process your question: ${err.message}</p>
            </div>`;
    }
};

    if (aiBtn) aiBtn.addEventListener('click', handleQuery);
    else console.error('[CiliAI] aiQueryBtn not found.');

    if (aiInput) {
        aiInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); handleQuery(); }
        });
    } else console.error('[CiliAI] aiQueryInput not found.');

    if (exampleQueries.length) {
        exampleQueries.forEach(span => {
            span.addEventListener('click', () => {
                const q = span.dataset.question;
                if (aiInput && q) { aiInput.value = q; aiInput.focus(); handleQuery(); }
            });
        });
    } else console.warn('[CiliAI] No example queries found.');

    console.log('[CiliAI] Event listeners bound successfully.');
}

// NEW: Enhance results with external data for genes not in master data
async function enhanceResultsWithExternalData(genes, structuredQuery) {
    const enhancedResults = [];
    
    for (const gene of genes) {
        const geneUpper = gene.toUpperCase();
        
        // Check if gene exists in master data
        let geneData = window.CiliAI_MasterData?.find(g => g.gene?.toUpperCase() === geneUpper);
        
        if (!geneData) {
            // Create a temporary gene entry from external sources
            geneData = await createGeneFromExternalSources(geneUpper);
        }
        
        if (geneData) {
            enhancedResults.push(geneData);
        }
    }
    
    console.log(`Enhanced ${enhancedResults.length} results with external data`);
    return enhancedResults;
}

// NEW: Create gene data from external sources
async function createGeneFromExternalSources(geneSymbol) {
    const geneData = {
        gene: geneSymbol,
        evidence_source: "MultiSource_Integration",
        is_external_integration: true
    };
    
    // Add phylogeny data
    if (window.liMap?.[geneSymbol]) {
        if (!geneData.phylogeny) geneData.phylogeny = {};
        geneData.phylogeny.li_2014 = window.liMap[geneSymbol];
    }
    if (window.neversMap?.[geneSymbol]) {
        if (!geneData.phylogeny) geneData.phylogeny = {};
        geneData.phylogeny.nevers_2017 = window.neversMap[geneSymbol];
    }
    
    // Add screens data
    if (window.screensByGene?.[geneSymbol]) {
        geneData.screens = window.screensByGene[geneSymbol];
    }
    
    // Add complex data
    if (window.corumByGene?.[geneSymbol]) {
        geneData.complex_components = window.corumByGene[geneSymbol];
    }
    
    // Add domain data
    if (window.domainsByGene?.[geneSymbol]) {
        geneData.pfam_ids = window.domainsByGene[geneSymbol]?.pfam_ids || [];
        geneData.domain_descriptions = window.domainsByGene[geneSymbol]?.domain_descriptions || [];
    }
    
    // Only return if we have at least some data
    if (Object.keys(geneData).length > 2) { // More than just gene and evidence_source
        return geneData;
    }
    
    return null;
}

// Test the enhanced parser with various queries
async function testEnhancedParser() {
    console.log('=== Testing Enhanced Parser ===');
    
    const testQueries = [
        'Analyze the evolutionary history of YWHAB',
        'What domains does IFT88 have?',
        'Show me screens for BBS1',
        'What complexes is IFT74 in?',
        'Compare evolution of YWHAB and IFT88',
        'List genes in the BBSome complex',
        'What is the C. elegans ortholog for IFT52?'
    ];
    
    for (const query of testQueries) {
        console.log(`\nTesting: "${query}"`);
        const structured = await parseCiliAIQuestion(query, window.CiliAI_MasterData);
        console.log('Detected genes:', structured.genes);
        console.log('Intent:', structured.intent);
        console.log('Filters:', structured.filters);
    }
}

// Run the test
testEnhancedParser();

/* ==============================================================
   8. Plotting Helpers
   ============================================================== */
async function displayUmapGeneExpression(geneSymbol) {
    const [umapData, cellData] = await Promise.all([
        window.CiliAI_UMAP ? Promise.resolve(window.CiliAI_UMAP) : loadCiliAIData().then(() => window.CiliAI_UMAP),
        window.CiliAI_snRNA ? Promise.resolve(window.CiliAI_snRNA) : loadCiliAIData().then(() => window.CiliAI_snRNA)
    ]);
    const resultArea = document.getElementById('ai-result-area');
    if (!umapData || !cellData) {
        resultArea.innerHTML = `<div class="result-card"><h3>UMAP Expression Plot</h3><p class="status-not-found">Could not load data.</p></div>`;
        return;
    }

    const geneUpper = geneSymbol.toUpperCase();
    const geneExpressionMap = cellData[geneUpper];
    if (!geneExpressionMap) {
        resultArea.innerHTML = `<div class="result-card"><h3>${geneSymbol} Expression</h3><p class="status-not-found">Gene not found.</p></div>`;
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

function testGeneLookup(geneSymbol) {
    const geneUpper = geneSymbol.toUpperCase();
    console.log(`=== Testing ${geneUpper} ===`);
    
    console.log('In Li map:', window.liMap ? (window.liMap[geneUpper] ? '✓' : '✗') : 'No liMap');
    console.log('In Nevers map:', window.neversMap ? (window.neversMap[geneUpper] ? '✓' : '✗') : 'No neversMap');
    
    if (window.liMap && window.liMap[geneUpper]) {
        console.log('Li data:', window.liMap[geneUpper]);
    }
    if (window.neversMap && window.neversMap[geneUpper]) {
        console.log('Nevers data:', window.neversMap[geneUpper]);
    }
    
    return {
        li: !!(window.liMap && window.liMap[geneUpper]),
        nevers: !!(window.neversMap && window.neversMap[geneUpper])
    };
}

// Test specific genes
testGeneLookup('YWHAB');
testGeneLookup('IFT88');
testGeneLookup('BBS1');

/* ==============================================================
   9. Phylogeny Analysis
   ============================================================== */
async function getPhylogenyAnalysis(genes) {
    console.log('Phylogeny analysis requested for:', genes);
    
    const liCache = window.liPhylogenyCache;
    const neversCache = window.neversPhylogenyCache;
    const liMap = window.liMap || {};
    const neversMap = window.neversMap || {};
    
    if (!liCache && !neversCache) {
        return `
            <div class="result-card">
                <h3>Phylogenetic Data Not Available</h3>
                <p>Evolutionary analysis data could not be loaded.</p>
                <button onclick="location.reload()" class="download-button">Reload Page</button>
            </div>`;
    }

    const validGenes = [];
    const analysisResults = [];

    genes.forEach(gene => {
        const geneUpper = gene.toUpperCase();
        
        // Look up in our pre-built maps
        const liData = liMap[geneUpper];
        const neversData = neversMap[geneUpper];
        
        if (liData || neversData) {
            validGenes.push(geneUpper);
            analysisResults.push({
                gene: geneUpper,
                liData: liData,
                neversData: neversData
            });
        } else {
            console.log(`Gene ${geneUpper} not found in phylogeny maps`);
        }
    });

    if (validGenes.length === 0) {
        return `
            <div class="result-card">
                <h3>Genes Not Found in Phylogenetic Databases</h3>
                <p>The gene(s) "${genes.join(', ')}" were not found in available evolutionary datasets.</p>
                <div style="margin-top: 15px;">
                    <p><strong>Troubleshooting:</strong></p>
                    <ul>
                        <li>Check that the gene symbol is correct (e.g., YWHAB)</li>
                        <li>Try using the official HGNC symbol</li>
                        <li>Some genes may not be included in phylogenetic analyses</li>
                    </ul>
                </div>
                <p><strong>Available datasets:</strong></p>
                <ul>
                    <li>Li et al. 2014: ${Object.keys(liMap).length} genes mapped</li>
                    <li>Nevers et al. 2017: ${Object.keys(neversMap).length} genes mapped</li>
                </ul>
                <div style="margin-top: 15px; font-size: 0.9em; color: #666;">
                    <p><strong>Debug info:</strong></p>
                    <p>Li cache: ${liCache ? 'loaded' : 'missing'}, Li map: ${Object.keys(liMap).length} entries</p>
                    <p>Nevers cache: ${neversCache ? 'loaded' : 'missing'}, Nevers map: ${Object.keys(neversMap).length} entries</p>
                </div>
            </div>`;
    }

    // Generate results table
    let html = `<div class="result-card">
        <h3>Evolutionary Analysis: ${validGenes.join(', ')}</h3>
        <table class="gene-detail-table">
            <thead>
                <tr>
                    <th>Gene</th>
                    ${Object.keys(liMap).length > 0 ? '<th>Li 2014 Classification</th>' : ''}
                    ${Object.keys(neversMap).length > 0 ? '<th>Nevers 2017 Species Count</th>' : ''}
                    <th>Data Sources</th>
                </tr>
            </thead>
            <tbody>`;

    analysisResults.forEach(({ gene, liData, neversData }) => {
        const liClass = liData ? (liCache?.summary?.class_list?.[liData.class_id] || 'Unknown').replace(/_/g, ' ') : 'Not found';
        const neversCount = neversData ? neversData.species_count : 'Not found';
        const sources = [];
        if (liData) sources.push('Li 2014');
        if (neversData) sources.push('Nevers 2017');
        const sourceText = sources.length > 0 ? sources.join(' + ') : 'No data';
        
        html += `<tr>
            <td><strong>${gene}</strong></td>
            ${Object.keys(liMap).length > 0 ? `<td>${liClass}</td>` : ''}
            ${Object.keys(neversMap).length > 0 ? `<td>${neversCount}</td>` : ''}
            <td>${sourceText}</td>
        </tr>`;
    });

    html += `</tbody></table>`;

    // Add detailed information for single gene analysis
    if (validGenes.length === 1) {
        const gene = validGenes[0];
        const { liData, neversData } = analysisResults[0];
        
        html += `<div style="margin-top: 20px;">`;
        
        if (liData) {
            const speciesCount = liData.species_data ? liData.species_data.length : 0;
            const className = liCache.summary.class_list[liData.class_id] || 'Unknown';
            const totalOrganisms = liCache.summary.total_organisms || 140;
            
            html += `<div style="margin-bottom: 15px; padding: 15px; background: #f0f8ff; border-radius: 8px;">
                <h4>📊 Li et al. 2014 Analysis</h4>
                <p><strong>Evolutionary Classification:</strong> ${className.replace(/_/g, ' ')}</p>
                <p><strong>Species Present:</strong> ${speciesCount} out of ${totalOrganisms} species</p>
                <p><strong>Entrez ID:</strong> ${liData.entrez_id || 'N/A'}</p>
                <p style="font-size: 0.9em; color: #666;"><em>${liCache.references.paper} (Cell 2014)</em></p>
            </div>`;
        }
        
        if (neversData) {
            const totalSpecies = neversData.species_count;
            const ciliatedSpecies = neversData.in_ciliated_organisms;
            const totalCiliated = neversCache?.organism_groups?.ciliated_organisms?.length || 'Unknown';
            
            html += `<div style="margin-bottom: 15px; padding: 15px; background: #fff0f0; border-radius: 8px;">
                <h4>🌍 Nevers et al. 2017 Analysis</h4>
                <p><strong>Total Species:</strong> ${totalSpecies}</p>
                <p><strong>Ciliated Species:</strong> ${ciliatedSpecies} out of ${totalCiliated} ciliated organisms</p>
                <p style="font-size: 0.9em; color: #666;"><em>${neversCache.references.paper} (Mol Biol Evol 2017)</em></p>
            </div>`;
        }
        
        html += `</div>`;
    }

    html += `</div>`;
    return html;
}
/* ==============================================================
   10. Download Helper
   ============================================================== */
function downloadPlot(divId, filename) {
    Plotly.toImage(divId, {format: 'png', width: 1200, height: 800})
        .then(url => {
            const a = document.createElement('a');
            a.href = url; a.download = `${filename}.png`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        });
}

/* ==============================================================
   11. BOOTSTRAP – inject UI & preload data
   ============================================================== */
document.addEventListener('DOMContentLoaded', async () => {
    await displayCiliAIPage();           // builds the UI
    await loadCiliAIData();              // pre-loads everything (caches are now ready)
});
