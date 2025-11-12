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

async function loadCiliAIData() {
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

    async function fetchData(url, type = 'json') {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch ${url}`);
        if (type === 'json') return res.json();
        else if (type === 'tsv') {
            const text = await res.text();
            const lines = text.trim().split('\n');
            const header = lines.shift().split('\t');
            return lines.map(line => {
                const row = line.split('\t');
                const obj = {};
                header.forEach((h, i) => obj[h] = row[i]);
                return obj;
            });
        }
    }

    // --- Fetch ALL data in parallel ---
    console.log('🔄 CiliAI: Loading all datasets...');
    const [
        ciliahubData, umapData, screensData, cellxgeneData,
        rnaTissueData, corumData, domainData, neversData, liData
    ] = await Promise.all([
        fetchData(urls.ciliahub),
        fetchData(urls.umap),
        fetchData(urls.screens),
        fetchData(urls.cellxgene),
        fetchData(urls.rna_tissue, 'tsv'),
        fetchData(urls.corum),
        fetchData(urls.domains),
        fetchData(urls.nevers2017),
        fetchData(urls.li2014)
    ]);

    // ✅ Cache Phylogenetic Data Globally
    liPhylogenyCache = liData;
    neversPhylogenyCache = neversData;
    console.log('✅ Phylogenetic data cached (Li 2014, Nevers 2017)');

    // ==========================================================
    // PHASE 1: Build Lookup Indices
    // ==========================================================

    // --- 1. Screen Data ---
    const screensByGene = {};
    if (screensData && typeof screensData === 'object') {
        for (const geneName in screensData) {
            if (screensData.hasOwnProperty(geneName) && Array.isArray(screensData[geneName])) {
                screensByGene[geneName] = screensData[geneName].map(screen => ({
                    dataset: screen.source,
                    classification: screen.result,
                    paper_link: screen.paper_link || '#',
                    mean_percent_ciliated: screen.mean_percent_ciliated,
                    sd_percent_ciliated: screen.sd_percent_ciliated,
                    z_score: screen.z_score
                }));
            }
        }
    }
    console.log(`✅ Indexed ${Object.keys(screensByGene).length} genes with screen data`);

    // --- 2. Single-Cell Expression ---
    const scExpressionByGene = {};
    if (cellxgeneData && typeof cellxgeneData === 'object') {
        for (const geneName in cellxgeneData) {
            if (cellxgeneData.hasOwnProperty(geneName)) {
                scExpressionByGene[geneName.toUpperCase()] = cellxgeneData[geneName];
            }
        }
    }
    console.log(`✅ Indexed ${Object.keys(scExpressionByGene).length} genes with scRNA-seq data`);

    // --- 3. Tissue Expression ---
    const tissueExpressionByGene = {};
    if (Array.isArray(rnaTissueData)) {
        for (const row of rnaTissueData) {
            const geneName = row['Gene name'];
            if (geneName) {
                if (!tissueExpressionByGene[geneName]) {
                    tissueExpressionByGene[geneName] = {};
                }
                tissueExpressionByGene[geneName][row.Tissue] = parseFloat(row.nTPM);
            }
        }
    }
    console.log(`✅ Indexed ${Object.keys(tissueExpressionByGene).length} genes with tissue expression`);

    // --- 4. CORUM Complexes ---
    const corumByGene = {};
    if (Array.isArray(corumData)) {
        for (const complex of corumData) {
            const complexName = complex.complex_name;
            const subunits = complex.subunits;
            if (complexName && Array.isArray(subunits)) {
                const subunitNames = subunits.map(s => s.gene_name).filter(Boolean);
                for (const geneName of subunitNames) {
                    if (geneName) {
                        if (!corumByGene[geneName]) corumByGene[geneName] = {};
                        corumByGene[geneName][complexName] = subunitNames;
                    }
                }
            }
        }
    }
    console.log(`✅ Indexed ${Object.keys(corumByGene).length} genes in CORUM complexes`);

    // --- 5. Protein Domains ---
    const domainsByGene = {};
    window.CiliAI_DomainData = domainData;
    if (domainData && domainData.enriched_domains) {
        for (const domain of Object.values(domainData.enriched_domains)) {
            const domainDesc = domain.description;
            const pfamId = domain.domain_id;
            if (Array.isArray(domain.ciliary_genes_with_domain)) {
                for (const geneName of domain.ciliary_genes_with_domain) {
                    if (!domainsByGene[geneName]) {
                        domainsByGene[geneName] = { pfam_ids: [], domain_descriptions: [] };
                    }
                    if (!domainsByGene[geneName].pfam_ids.includes(pfamId)) {
                        domainsByGene[geneName].pfam_ids.push(pfamId);
                        domainsByGene[geneName].domain_descriptions.push(domainDesc);
                    }
                }
            }
        }
    }
    console.log(`✅ Indexed ${Object.keys(domainsByGene).length} genes with domain annotations`);

    // --- 6. Functional Modules (from Phylogeny Data) ---
    const modulesByGene = {};
    if (liData && liData.genes && typeof liData.genes === 'object') {
        for (const geneKey in liData.genes) {
            const geneData = liData.genes[geneKey];
            const geneName = geneData.g;

            if (geneName && geneData.c !== undefined && liData.summary?.class_list) {
                const classification = liData.summary.class_list[geneData.c];
                if (classification) {
                    if (!modulesByGene[geneName]) modulesByGene[geneName] = [];
                    if (!modulesByGene[geneName].includes(classification)) {
                        modulesByGene[geneName].push(classification.replace(/_/g, ' '));
                    }
                }
            }
        }
    }
    console.log(`✅ Indexed ${Object.keys(modulesByGene).length} genes with functional modules`);

// --- 7. Phylogenetic Conservation Data ---
    const liGenesMap = {};
    if (liData && liData.genes) {
        Object.values(liData.genes).forEach(geneObj => {
            if (geneObj.g) {
                liGenesMap[geneObj.g.toUpperCase()] = {
                    class: liData.summary?.class_list?.[geneObj.c] || 'Unknown',
                    class_id: geneObj.c,
                    species_data: geneObj.s || []
                };
            }
        });
    }
    const neversGenesMap = {};
    if (neversData && neversData.genes) {
        Object.keys(neversData.genes).forEach(geneKey => {
            const geneData = neversData.genes[geneKey];
            neversGenesMap[geneKey.toUpperCase()] = {
                species_count: geneData.s?.length || 0,
                species_data: geneData.s || []
            };
        });
    }
    console.log(`✅ Indexed phylogeny summaries for ${Object.keys(liGenesMap).length} (Li) and ${Object.keys(neversGenesMap).length} (Nevers) genes`);

    // ==========================================================
    // PHASE 2: Build Master Data with ALL Integrations
    // ==========================================================

    if (!Array.isArray(ciliahubData)) {
        console.error("❌ CRITICAL ERROR - ciliahub_data.json is not an array.", ciliahubData);
        return [];
    }

    const masterData = ciliahubData.map(geneObj => {
        const gene = geneObj.gene;
        const geneUpper = gene.toUpperCase();

        // --- Merge Screens ---
        const hubScreens = Array.isArray(geneObj.screens) ? geneObj.screens : [];
        const externalScreens = screensByGene[gene] || [];
        const allScreens = [...hubScreens, ...externalScreens];

        // ⬇️ --- FIX for Ciliopathy Normalization --- ⬇️
        let ciliopathies = [];
        const splitAndTrim = (str) => str.split(';').map(s => s.trim()).filter(Boolean);

        if (Array.isArray(geneObj.ciliopathy)) {
            ciliopathies = geneObj.ciliopathy;
        } else if (typeof geneObj.ciliopathy === 'string' && geneObj.ciliopathy) {
            ciliopathies = splitAndTrim(geneObj.ciliopathy); // <-- This was the bug
        }
        if (Array.isArray(geneObj.ciliopathies)) {
            ciliopathies = [...ciliopathies, ...geneObj.ciliopathies];
        } else if (typeof geneObj.ciliopathies === 'string' && geneObj.ciliopathies) {
            ciliopathies = [...ciliopathies, ...splitAndTrim(geneObj.ciliopathies)];
        }
        ciliopathies = [...new Set(ciliopathies.filter(Boolean))]; // Unique, non-empty
        // ⬆️ --- END OF FIX --- ⬆️

        // --- Merge Domains ---
        const hubDomains = {
            pfam_ids: Array.isArray(geneObj.pfam_ids) ? geneObj.pfam_ids : [],
            domain_descriptions: Array.isArray(geneObj.domain_descriptions) ? geneObj.domain_descriptions : []
        };
        const externalDomains = domainsByGene[gene] || { pfam_ids: [], domain_descriptions: [] };

        // --- Build Complete Gene Object ---
        return {
            ...geneObj,
            
           // ✅ Screens (merged)
            screens: allScreens,
            
            // ✅ Expression (scRNA + tissue)
            expression: {
                scRNA: scExpressionByGene[geneUpper] || null,
                tissue: tissueExpressionByGene[gene] || null
            },
            
            // ✅ Complexes (CORUM + existing)
            complex_components: {
                ...geneObj.complex_components,
                ...corumByGene[gene]
            },
            
            // ✅ Domains (merged)
            pfam_ids: [...new Set([...hubDomains.pfam_ids, ...externalDomains.pfam_ids])],
            domain_descriptions: [...new Set([...hubDomains.domain_descriptions, ...externalDomains.domain_descriptions])],
            
            // ✅ Functional Modules
            functional_modules: modulesByGene[gene] || [],
            
            // ✅ Ciliopathies (normalized to array)
            ciliopathies: ciliopathies,
            
            // ✅ Phylogenetic Data
          _ phylogeny: {
                li_2014: liGenesMap[geneUpper] || null,
                nevers_2017: neversGenesMap[geneUpper] || null
            }
        };
    });

    window.CiliAI_MasterData = masterData;
    console.log(`✅ CiliAI: Master data built with ${masterData.length} genes`);
    console.log('📊 Data integration complete: screens, expression, complexes, domains, modules, phylogeny, ciliopathies');
    
    return masterData;
}

// ==========================================================
// 2️⃣ Question Parsing (The "Brain")
// ==========================================================
async function parseCiliAIQuestion(question, masterData) {
    const q = question.toLowerCase();
    
    const structuredQuery = {
        genes: [],
        filters: {},
        intent: {},
        comparison: false,
        species: null,
        plotType: null,
        question: question // Store original question
    };

    // --- 1. Extract Genes ---
    if (masterData && masterData.length > 0) {
        // Build a temporary map of ALL gene names and synonyms
        const geneMap = new Map();
        for (const g of masterData) {
            const geneUpper = g.gene.toUpperCase();
            geneMap.set(g.gene.toLowerCase(), geneUpper);
            // Add synonyms from the 'synonym' field
            if (g.synonym) {
                // Handle both array and string synonyms
                const synonyms = Array.isArray(g.synonym) ? g.synonym : g.synonym.split(/[,;]\s*/);
                for (const syn of synonyms) {
                    if (syn) geneMap.set(syn.toLowerCase(), geneUpper);
                }
            }
        }

        // Use regex to find whole words in the query
        const words = new Set(q.match(/\b\w+\b/g) || []);
        for (const word of words) {
            if (geneMap.has(word)) {
                const gene = geneMap.get(word);
                if (!structuredQuery.genes.includes(gene)) {
                    structuredQuery.genes.push(gene);
                }
            }
        }
    } else {
        console.error("CiliAI Parser Error: Master data is empty or not provided. Gene parsing failed.");
    }

    // --- 2. Extract Keywords, Filters & Intents ---
    
    // Localization
    if (q.includes('localize') || q.includes('localization')) structuredQuery.intent.localization = true;
    if (q.includes('cilia') || q.includes('ciliary')) structuredQuery.filters.localization = 'cilia';
    if (q.includes('basal body')) structuredQuery.filters.localization = 'basal body';
    if (q.includes('centrosome')) structuredQuery.filters.localization = 'centrosome';

    // Screens
    if (q.includes('screen')) structuredQuery.intent.screens = true;
    if (q.includes('percent ciliated')) structuredQuery.intent.screens = true;

    // Domains
    if (q.includes('domain')) structuredQuery.intent.domains = true;
    
    // Complexes
    if (q.includes('complex')) structuredQuery.intent.complexes = true;
    
    // ⬇️ --- FIX for BBSome / Joubert ---
    // We get the map HERE to check all known complex/module names
    const complexMap = getComplexPhylogenyTableMap(); 
    for (const complexName in complexMap) {
        if (q.includes(complexName.toLowerCase())) {
            // Check for modules vs complexes
            if (complexName.includes('MODULE') || complexName.includes('TIP') || complexName.includes('ZONE') || complexName.includes('PAIR')) {
                 structuredQuery.filters.functional_modules = complexName;
            } else {
                 structuredQuery.filters.complexes = complexName;
            }
            break; // Stop at first match
        }
    }
    // Fallbacks for common names
    if (!structuredQuery.filters.complexes && q.includes('bbsome')) {
         structuredQuery.filters.complexes = 'BBSOME';
    }
     if (!structuredQuery.filters.functional_modules && q.includes('ciliary specific')) {
         structuredQuery.filters.functional_modules = 'Ciliary specific'; // From Li 2014
    }
    // ⬆️ --- END OF FIX ---

    // Orthologs
    if (q.includes('ortholog')) structuredQuery.intent.orthologs = true;
    if (q.includes('c. elegans') || q.includes('worm')) structuredQuery.species = 'c_elegans';
    if (q.includes('mouse')) structuredQuery.species = 'mouse';
    if (q.includes('human')) structuredQuery.species = 'human';
    if (q.includes('zebrafish')) structuredQuery.species = 'zebrafish';
    if (q.includes('drosophila')) structuredQuery.species = 'drosophila';

    // Ciliopathy
    if (q.includes('ciliopathy') || q.includes('disease')) structuredQuery.intent.ciliopathy = true;
    // ⬇️ --- FIX for Joubert ---
    // Use lowercase for matching. This is what the query engine will check.
    if (q.includes('joubert') || q.includes('jbts')) structuredQuery.filters.ciliopathy = 'joubert syndrome';
    if (q.includes('bbs')) structuredQuery.filters.ciliopathy = 'bardet-biedl syndrome';
    if (q.includes('nephronophthisis') || q.includes('nphp')) structuredQuery.filters.ciliopathy = 'nephronophthisis';
    // ⬆️ --- END OF FIX ---
    
    // Other Intents
    if (q.includes('omim')) structuredQuery.intent.omim = true;
    if (q.includes('describe') || q.startsWith('what is') || q.startsWith('what does')) structuredQuery.intent.description = true;
    
    // Expression
    if (q.includes('express') || q.includes('expression')) structuredQuery.intent.expression = true;
    if (q.includes('lung')) structuredQuery.filters.tissue = 'lung';
    if (q.includes('kidney')) structuredQuery.filters.tissue = 'kidney';
    if (q.includes('brain')) structuredQuery.filters.tissue = 'brain';
    if (q.includes('ciliated cell')) structuredQuery.filters.cell_type = 'ciliated cell';
    
    // Plotting Intents
    if (q.includes('umap') && q.includes('expression')) {
        structuredQuery.plotType = 'umap_expression';
        structuredQuery.intent.umap = true;
    } else if (q.includes('umap')) {
        structuredQuery.plotType = 'umap_cluster';
        structuredQuery.intent.umap = true;
    }
    if (q.includes('phylogen') || q.includes('evolution') || q.includes('conservation')) {
        structuredQuery.plotType = 'phylogeny';
        structuredQuery.intent.phylogeny = true;
    }

    // --- 3. Determine Final Intent ---
    
    if (structuredQuery.genes.length > 0 && Object.keys(structuredQuery.intent).length === 0) {
        structuredQuery.intent.description = true; // Default to full card
    }
    
    if (structuredQuery.genes.length === 0 && Object.keys(structuredQuery.filters).length > 0) {
        structuredQuery.intent.list_genes = true;
    }

    if (q.includes('compare')) {
        structuredQuery.comparison = true;
    }
    
    if (q.startsWith('is') && (q.includes('cilia') || q.includes('ciliary'))) {
        structuredQuery.intent.localization = true;
    }

    console.log('[CiliAI Parser] Query:', q, 'Result:', structuredQuery);
    return structuredQuery;
}

// ==========================================================
// 3️⃣ Query Execution (The "Engine")
// ==========================================================
function queryGenes(structuredQuery) {
    const data = window.CiliAI_MasterData;
    if (!data || !Array.isArray(data)) {
        console.error("CiliAI_MasterData is not loaded or invalid!");
        return [];
    }

    let results = [];
    const complexMap = getComplexPhylogenyTableMap(); // Get the complex-to-gene map

    // 1. Start with specified genes or all genes
    if (structuredQuery.genes && structuredQuery.genes.length > 0) {
        const geneSet = new Set(structuredQuery.genes.map(g => g.toUpperCase()));
        results = data.filter(g => geneSet.has(g.gene.toUpperCase()));
    } else {
        results = [...data];
    }

    // 2. Apply filters
    const filters = structuredQuery.filters || {};
    if (Object.keys(filters).length > 0) {
        results = results.filter(g => {
            
            if (filters.localization) {
                const loc = (g.localization || "").toLowerCase();
                if (!loc.includes(filters.localization.toLowerCase())) return false;
            }

            // ⬇️ --- FIX FOR BBSome --- ⬇️
            if (filters.complexes) {
                const filterText = filters.complexes.toLowerCase();
                // Check 1: Gene's own `complex_components`
                const complexNames = Object.keys(g.complex_components || {});
                let inComplex = complexNames.some(name =>
                    name.toLowerCase().includes(filterText)
                );
                
                // Check 2: The hard-coded `getComplexPhylogenyTableMap`
                if (!inComplex) {
                    const targetGenes = complexMap[filters.complexes.toUpperCase()] || [];
                    if (targetGenes.includes(g.gene.toUpperCase())) {
                        inComplex = true;
                    }
                }
                if (!inComplex) return false;
            }
            // ⬆️ --- END OF FIX --- ⬆️

            if (filters.functional_modules) {
                const filterText = filters.functional_modules.toLowerCase();
                let inModule = false;
                // Check 1: Gene's `functional_modules` (from Li 2014)
                const modules = g.functional_modules || [];
                if (modules.some(mod => mod.toLowerCase().includes(filterText))) {
                    inModule = true;
                }
                
                // Check 2: The hard-coded `getComplexPhylogenyTableMap`
                if (!inModule) {
                    const targetGenes = complexMap[filters.functional_modules.toUpperCase()] || [];
                    if (targetGenes.includes(g.gene.toUpperCase())) {
                        inModule = true;
                    }
                }
                if (!inModule) return false;
            }

            // ⬇️ --- FIX FOR CILIOPATHY --- ⬇️
            if (filters.ciliopathy) {
                const filterText = filters.ciliopathy.toLowerCase();
                // Use the normalized 'ciliopathies' array
                const ciliopathies = g.ciliopathies || []; 
                if (!Array.isArray(ciliopathies) || !ciliopathies.some(c => c.toLowerCase().includes(filterText))) {
                    return false;
                }
            }
            // ⬆️ --- END OF FIX --- ⬆️

            if (filters.tissue && g.expression?.tissue) {
                const tissueName = Object.keys(g.expression.tissue).find(t =>
                    t.toLowerCase().includes(filters.tissue.toLowerCase())
                );
                if (!tissueName || parseFloat(g.expression.tissue[tissueName]) <= 0) {
                    return false;
                }
            }

            if (filters.cell_type && g.expression?.scRNA) {
                if (!g.expression.scRNA[filters.cell_type] ||
                    parseFloat(g.expression.scRNA[filters.cell_type]) <= 0) {
                    return false;
                }
            }
            
            if (filters.species) {
                const key = `ortholog_${filters.species}`; // e.g., ortholog_c_elegans
                if (!g[key]) return false;
            }

            return true;
        });
    }

    // 3. Apply sorting (unchanged)
    if (structuredQuery.intent?.expression && filters.tissue && structuredQuery.genes.length === 0) {
        results.sort((a, b) => {
            const tissueA = Object.keys(a.expression?.tissue || {}).find(t => t.toLowerCase().includes(filters.tissue.toLowerCase()));
            const tissueB = Object.keys(b.expression?.tissue || {}).find(t => t.toLowerCase().includes(filters.tissue.toLowerCase()));
            const valA = parseFloat(a.expression?.tissue?.[tissueA] || 0);
            const valB = parseFloat(b.expression?.tissue?.[tissueB] || 0);
            return valB - valA;
        });
        results = results.slice(0, 10);
    }

    return results;
}

// ==========================================================
// 4️⃣ Results Rendering (The "Voice")
// ==========================================================
function displayCiliAIResults(results, structuredQuery) {
    const resultArea = document.getElementById('ai-result-area');
    resultArea.style.display = 'block';

    if (!results || results.length === 0) {
        resultArea.innerHTML = '<p>No results found for your query.</p>';
        return;
    }

    const q = structuredQuery;
    const intent = q.intent;

    // ⬇️ --- FIX FOR ORTHOLOGS (and other strings) --- ⬇️
    const buildSection = (title, content) => {
        let displayContent = '';
        if (Array.isArray(content)) {
            displayContent = content.filter(Boolean).join(', '); 
        } else if (typeof content === 'object' && content !== null) {
            displayContent = Object.keys(content).join(', '); 
        } else if (content) { // Handles strings, numbers
            displayContent = content;
        }
        // ⬆️ --- END OF FIX --- ⬆️
        
        if (displayContent) {
            return `<p><strong>${title}:</strong> ${displayContent}</p>`;
        }
        return ''; 
    };

    // --- 1. Handle "List" queries ---
    if (intent.list_genes && results.length > 1) {
        let title = "Found the following genes:";
        if (q.filters.ciliopathy) title = `Genes associated with ${q.filters.ciliopathy}:`;
        if (q.filters.complexes) title = `Genes in ${q.filters.complexes}:`;
        if (q.filters.functional_modules) title = `Genes in module: ${q.filters.functional_modules}:`;
        if (q.filters.localization) title = `Genes localized to ${q.filters.localization}:`;

        const geneList = results.map(g => g.gene).join(', ');
        resultArea.innerHTML = `
            <div class="result-card">
                <h3>${title} (${results.length} genes)</h3>
                <p>${geneList}</p>
            </div>
        `;
        return;
    }

    // --- 2. Handle "Comparison" queries ---
    if (q.comparison && results.length > 1) {
        let tableHtml = '<table><thead><tr><th>Gene</th>';
        if (q.filters.tissue) tableHtml += `<th>Expression in ${q.filters.tissue} (nTPM)</th>`;
        if (q.filters.cell_type) tableHtml += `<th>Expression in ${q.filters.cell_type}</th>`;
        if (intent.localization) tableHtml += '<th>Localization</th>';
        if (intent.modules) tableHtml += '<th>Modules</th>';
        tableHtml += '</tr></thead><tbody>';

        for (const g of results) {
            tableHtml += `<tr><td><strong>${g.gene}</strong></td>`;
            if (q.filters.tissue) {
                const tissueName = Object.keys(g.expression?.tissue || {}).find(t => t.toLowerCase().includes(q.filters.tissue));
                tableHtml += `<td>${g.expression?.tissue?.[tissueName]?.toFixed(2) || 'N/A'}</td>`;
            }
             if (q.filters.cell_type) {
                tableHtml += `<td>${g.expression?.scRNA?.[q.filters.cell_type]?.toFixed(4) || 'N/A'}</td>`;
            }
            if (intent.localization) {
                tableHtml += `<td>${g.localization || 'N/A'}</td>`;
            }
            if (intent.modules) {
                tableHtml += `<td>${(g.functional_modules || []).join(', ') || 'N/A'}</td>`;
            }
            tableHtml += '</tr>';
        }
        tableHtml += '</tbody></table>';
        resultArea.innerHTML = `<div class="result-card">${tableHtml}</div>`;
        return;
    }
    
    // --- 3. Handle "Gene Card" queries ---
    const html = results.map(g => {
        // Special Case: "is X a ciliary gene?"
        if (intent.localization && q.genes.length > 0 && (q.question?.startsWith('is') || q.question?.includes('ciliary'))) {
            const locs = (g.localization || "").toLowerCase();
            const answer = locs.includes('cilia') 
                ? `Yes, ${g.gene} is localized to the ${g.localization}.` 
                : `No, ${g.gene} is localized to the ${g.localization || 'an unknown location'}.`;
            return `<div class="result-card"><h3>${g.gene}</h3><p>${answer}</p></div>`;
        }
        
        // --- Build Full Card or Intent-Specific Card ---
        const cardSections = [];
        const hasSpecificIntent = Object.keys(intent).length > 0 && !intent.description;

        // Build all possible sections from the merged gene object 'g'
        const allSections = {
            description: buildSection("Description", g.description),
            functional_summary: buildSection("Functional Summary", g.functional_summary),
            localization: buildSection("Localization", g.localization),
            omim: buildSection("OMIM ID", g.omim_id),
            ciliopathy: buildSection("Associated Ciliopathies", g.ciliopathies), // Use the normalized array
            ciliopathy_classification: buildSection("Ciliopathy Classification", g.ciliopathy_classification),
            complexes: buildSection("Complexes", Object.keys(g.complex_components || {})),
            domains: buildSection("Domains", g.domain_descriptions),
            modules: buildSection("Functional Modules", g.functional_modules),
            screens: buildSection("Screens", [...new Set( (g.screens || []).map(s => s.dataset).filter(Boolean) )] ),
            
            // Orthologs (all fields)
            ortholog_mouse: buildSection("Mouse Ortholog", g.ortholog_mouse),
            ortholog_c_elegans: buildSection("C. elegans Ortholog", g.ortholog_c_elegans),
            ortholog_zebrafish: buildSection("Zebrafish Ortholog", g.ortholog_zebrafish),
            ortholog_drosophila: buildSection("Drosophila Ortholog", g.ortholog_drosophila),
            
            // Phenotype Effects
            lof_effects: buildSection("Loss-of-Function Effects", g.lof_effects),
            overexpression_effects: buildSection("Overexpression Effects", g.overexpression_effects),
            percent_ciliated_cells_effects: buildSection("Ciliated Cell Effects", g.percent_ciliated_cells_effects),

            // Expression (if requested)
            expression_tissue: buildSection(`Expression in ${q.filters.tissue}`, g.expression?.tissue?.[Object.keys(g.expression?.tissue || {}).find(t => t.toLowerCase().includes(q.filters.tissue))]?.toFixed(2)),
            expression_cell: buildSection(`Expression in ${q.filters.cell_type}`, g.expression?.scRNA?.[q.filters.cell_type]?.toFixed(4))
        };
        
        // --- Decide what to show ---
        if (!hasSpecificIntent || intent.description) {
            // Show the full, default card
            cardSections.push(
                allSections.description,
                allSections.functional_summary,
                allSections.localization,
                allSections.ciliopathy,
                allSections.ciliopathy_classification,
                allSections.complexes,
                allSections.domains,
                allSections.modules,
                allSections.screens,
                allSections.omim,
                allSections.ortholog_mouse,
                allSections.ortholog_c_elegans,
                allSections.ortholog_zebrafish,
                allSections.ortholog_drosophila,
                allSections.lof_effects,
                allSections.overexpression_effects,
                allSections.percent_ciliated_cells_effects
            );
        } else {
            // Only show sections that match the user's intent
            if (intent.localization) cardSections.push(allSections.localization);
            if (intent.screens) cardSections.push(allSections.screens);
            if (intent.domains) cardSections.push(allSections.domains);
            if (intent.complexes) cardSections.push(allSections.complexes);
            if (intent.modules) cardSections.push(allSections.modules);
            if (intent.omim) cardSections.push(allSections.omim);
            if (intent.ciliopathy) cardSections.push(allSections.ciliopathy, allSections.ciliopathy_classification);
            
            // ⬇️ --- FIX FOR ORTHOLOGS --- ⬇️
            if (intent.orthologs) {
                if (q.species === 'c_elegans') cardSections.push(allSections.ortholog_c_elegans);
                else if (q.species === 'mouse') cardSections.push(allSections.ortholog_mouse);
                else if (q.species === 'zebrafish') cardSections.push(allSections.ortholog_zebrafish);
                else if (q.species === 'drosophila') cardSections.push(allSections.ortholog_drosophila);
                else {
                    // If no species specified, show all
                    cardSections.push(
                        allSections.ortholog_mouse, 
                        allSections.ortholog_c_elegans, 
                        allSections.ortholog_zebrafish, 
                        allSections.ortholog_drosophila
                    );
                }
            }
            // ⬆️ --- END OF FIX --- ⬆️

            if (intent.expression && q.filters.tissue) cardSections.push(allSections.expression_tissue);
            if (intent.expression && q.filters.cell_type) cardSections.push(allSections.expression_cell);
        }
        
        return `
            <div class="result-card">
                <h3>${g.gene}</h3>
                ${cardSections.filter(Boolean).join('\n') || '<p>No specific data found for this intent.</p>'}
            </div>
        `;
    }).join('');

    resultArea.innerHTML = html;
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
// 6️⃣ Page HTML Injector
// ==========================================================
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
                .results-section { margin-top: 2rem; padding: 2rem; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
                .result-card { border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
                .result-card h3 { margin-top: 0; color: #2c5aa0; }
                .ciliopathy-table, .expression-table, .gene-detail-table, .results-section table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                .ciliopathy-table th, .ciliopathy-table td, .expression-table th, .expression-table td, .gene-detail-table th, .gene-detail-table td, .results-section th, .results-section td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                .ciliopathy-table th, .expression-table th, .gene-detail-table th, .results-section th { background-color: #e8f4fd; color: #2c5aa0; }
                .suggestions-container { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #ccc; z-index: 1000; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .suggestion-item { padding: 10px; cursor: pointer; }
                .suggestion-item:hover { background-color: #f0f0f0; }
                .download-button { background-color: #28a745; color: white; padding: 8px 14px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em; font-weight: bold; margin-top: 15px; transition: background-color 0.3s ease; }
                .download-button:hover { background-color: #218838; }
            </style>
        `;

        console.log('✅ CiliAI: Page HTML injected successfully.');

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

// ==========================================================
// 7️⃣ Event Listener "Glue"
// ==========================================================
function ciliAI_waitForElements() {
    console.log('[CiliAI] Binding event listeners...');

    const aiBtn = document.getElementById('aiQueryBtn');
    const aiInput = document.getElementById('aiQueryInput');
    const exampleQueries = document.querySelectorAll('.example-queries span');

   // --- Main Query Function ---
   const handleQuery = async () => {
    const input = aiInput.value.trim();
    if (!input) return;

    const resultArea = document.getElementById('ai-result-area');
    resultArea.style.display = 'block';
    resultArea.innerHTML = '<p>Processing...</p>';

    try {
        // ✅ Ensure data is loaded and get reference
        let masterData = window.CiliAI_MasterData;
        if (!masterData) {
            console.log('[CiliAI] Data not found, loading now...');
            masterData = await loadCiliAIData(); // This returns the data
        }
        
        // ✅ Pass masterData to parser
        const structuredQuery = await parseCiliAIQuestion(input, masterData);
        
        // 3. Route query to correct function
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
        console.error('❌ CiliAI query failed:', err);
        resultArea.innerHTML = `<p>Error: Failed to process your question.</p><pre>${err.message}\n${err.stack}</pre>`;
    }
};

    // 1. Bind to "Ask CiliAI" Button
    if (aiBtn) {
        aiBtn.addEventListener('click', handleQuery);
    } else {
        console.error('[CiliAI] Error: aiQueryBtn not found.');
    }

    // 2. Bind to "Enter" key in input
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

    // 3. Bind to Example Questions
    if (exampleQueries.length > 0) {
        exampleQueries.forEach(span => {
            span.addEventListener('click', () => {
                const question = span.getAttribute('data-question');
                if (aiInput) {
                    aiInput.value = question;
                    aiInput.focus();
                    handleQuery(); 
                }
            });
        });
    } else {
        console.error('[CiliAI] Error: No example queries found.');
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
    // Data should be pre-cached by loadCiliAIData
    const umapData = umapDataCache; 
    const cellData = cellxgeneDataCache;
    const resultArea = document.getElementById('ai-result-area');

    if (!umapData || !cellData) {
        resultArea.innerHTML = `<div class="result-card"><h3>UMAP Expression Plot</h3><p class="status-not-found">Could not load UMAP or Cellxgene data. Caches are empty.</p></div>`;
        return;
    }

    const geneUpper = geneSymbol.toUpperCase();
    const geneExpressionMap = cellData[geneUpper];

    if (!geneExpressionMap) {
        resultArea.innerHTML = `<div class="result-card"><h3>${geneSymbol} Expression</h3><p class="status-not-found">Gene "${geneSymbol}" not found in the single-cell expression dataset.</p></div>`;
        return;
    }

    const sampleSize = 15000;
    const sampledData = []; 

    if (umapData.length > sampleSize) {
        const usedIndices = new Set();
        while (sampledData.length < sampleSize) {
            const randomIndex = Math.floor(Math.random() * umapData.length);
            if (!usedIndices.has(randomIndex)) {
                sampledData.push(umapData[randomIndex]);
                usedIndices.add(randomIndex);
            }
        }
    } else {
        sampledData.push(...umapData);
    }

    const expressionValues = sampledData.map(cell => geneExpressionMap[cell.cell_type] || 0);

    const cellTypes = [...new Set(sampledData.map(d => d.cell_type))];
    const annotations = [];

    const median = (arr) => {
        const mid = Math.floor(arr.length / 2);
        const nums = [...arr].sort((a, b) => a - b);
        return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
    };

    for (const cellType of cellTypes) {
        const points = sampledData.filter(d => d.cell_type === cellType);
        if (points.length > 0) {
            const xCoords = points.map(p => p.x);
            const yCoords = points.map(p => p.y);
            
            annotations.push({
                x: median(xCoords), 
                y: median(yCoords),
                text: cellType,
                showarrow: false,
                font: { color: '#FFFFFF', size: 10, family: 'Arial, sans-serif' },
                bgcolor: 'rgba(0,0,0,0.4)', 
                borderpad: 2,
                bordercolor: 'rgba(0,0,0,0.4)',
                borderwidth: 1,
                xref: 'x',
                yref: 'y'
            });
        }
    }

    const plotData = [{
        x: sampledData.map(p => p.x),
        y: sampledData.map(p => p.y),
        mode: 'markers',
        type: 'scattergl',
        hovertext: sampledData.map((p, i) => `Cell Type: ${p.cell_type}<br>Expression: ${expressionValues[i].toFixed(4)}`),
        hoverinfo: 'text',
        marker: {
            color: expressionValues,
            colorscale: 'Plasma', 
            showscale: true,
            colorbar: { 
                title: { 
                    text: 'Expression',
                    side: 'right' 
                } 
            },
            size: 5,
            opacity: 0.8
        }
    }];

    const layout = {
        title: `UMAP Colored by ${geneSymbol} Expression (Sample of ${sampleSize} cells)`,
        xaxis: { title: 'UMAP 1', zeroline: false, showgrid: false },
        yaxis: { title: 'UMAP 2', zeroline: false, showgrid: false },
        hovermode: 'closest',
        margin: { t: 50, b: 50, l: 50, r: 50 },
        plot_bgcolor: '#FFFFFF',
        paper_bgcolor: '#FFFFFF',
        annotations: annotations, 
        showlegend: false 
    };

    const plotDivId = 'umap-expression-plot-div';
    resultArea.innerHTML = `
        <div class="result-card">
            <div id="${plotDivId}"></div>
            <button class="download-button" onclick="downloadPlot('${plotDivId}', 'UMAP_${geneSymbol}_Expression')">Download Plot</button>
        </div>`;
    
    Plotly.newPlot(plotDivId, plotData, layout, { responsive: true, displayModeBar: false });
}

async function displayUmapPlot() {
    const data = umapDataCache; // Use the global cache
    const resultArea = document.getElementById('ai-result-area');
    
    if (!data) {
        resultArea.innerHTML = `<div class="result-card"><h3>UMAP Plot</h3><p class="status-not-found">Could not load pre-computed UMAP data.</p></div>`;
        return;
    }

    const sampleSize = 15000;
    const sampledData = []; 

    if (data.length > sampleSize) {
         const usedIndices = new Set();
         while (sampledData.length < sampleSize) {
            const randomIndex = Math.floor(Math.random() * data.length);
            if (!usedIndices.has(randomIndex)) {
                sampledData.push(data[randomIndex]);
                usedIndices.add(randomIndex);
            }
        }
    } else {
        sampledData.push(...data);
    }
    
    const cellTypes = [...new Set(sampledData.map(d => d.cell_type))];
    const plotData = [];

    const colorPalette = Plotly.d3.scale.category10(); 

    for (let i = 0; i < cellTypes.length; i++) {
        const cellType = cellTypes[i];
        const points = sampledData.filter(d => d.cell_type === cellType);
        plotData.push({
            x: points.map(p => p.x),
            y: points.map(p => p.y),
            name: cellType,
            mode: 'markers',
            type: 'scattergl',
            marker: { 
                size: 5, 
                opacity: 0.8,
                color: colorPalette(i) 
            },
            hovertext: points.map(p => `Cell Type: ${p.cell_type}`),
            hoverinfo: 'text'
        });
    }

    const layout = {
        title: `UMAP of Single-Cell Gene Expression (Sample of ${sampleSize} cells)`,
        xaxis: { title: 'UMAP 1' },
        yaxis: { title: 'UMAP 2' },
        hovermode: 'closest',
        margin: { t: 50, b: 50, l: 50, r: 50 }
    };

    const plotDivId = 'umap-plot-div';
    resultArea.innerHTML = `
        <div class="result-card">
            <div id="${plotDivId}"></div>
            <button class="download-button" onclick="downloadPlot('${plotDivId}', 'UMAP_CellTypes')">Download Plot</button>
        </div>`;
    
    Plotly.newPlot(plotDivId, plotData, layout, { responsive: true, displayModeBar: false });
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
