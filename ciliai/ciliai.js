// CiliAI Complete Integrated Code
// ==========================================================

// --- Global Caches for Phylogenetic Data ---
let liPhylogenyCache = null;
let neversPhylogenyCache = null;

// ==========================================================
// 1️⃣ Data Loading
// ==========================================================
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

    // --- Fetch all data in parallel ---
    const [
        ciliahubData, umapData, screensData, cellxgeneData,
        rnaTissueData, corumData, domainData, neversData, liData
    ] = await Promise.all([
        fetchData(urls.ciliahub), fetchData(urls.umap), fetchData(urls.screens),
        fetchData(urls.cellxgene), fetchData(urls.rna_tissue, 'tsv'), fetchData(urls.corum),
        fetchData(urls.domains), fetchData(urls.nevers2017), fetchData(urls.li2014)
    ]);

    // --- Cache Phylogenetic Data ---
    // (We cache these separately for the phylogeny-specific functions)
    liPhylogenyCache = liData;
    neversPhylogenyCache = neversData;

    // --- Indexing for fast access ---

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
    } else {
        console.warn('CiliAI: screensData was not in the expected object format. Skipping screen indexing.', screensData);
    }

    const umapByGene = {}; // This file doesn't seem to be gene-based, but UMAP-point-based
    
    const scExpressionByGene = {};
    if (cellxgeneData && typeof cellxgeneData === 'object') {
        for (const geneName in cellxgeneData) {
            if (cellxgeneData.hasOwnProperty(geneName)) {
                scExpressionByGene[geneName.toUpperCase()] = cellxgeneData[geneName];
            }
        }
    } else {
        console.warn('CiliAI: cellxgeneData was not an object. Skipping scExpression indexing.', cellxgeneData);
    }
    
    const tissueExpressionByGene = {};
    if (Array.isArray(rnaTissueData)) {
        for (const row of rnaTissueData) {
            const geneName = row['Gene name']; // Use 'Gene name' from TSV
            if (geneName) {
                if (!tissueExpressionByGene[geneName]) {
                    tissueExpressionByGene[geneName] = {};
                }
                tissueExpressionByGene[geneName][row.Tissue] = parseFloat(row.nTPM);
            }
        }
    } else {
        console.warn('CiliAI: rnaTissueData was not an array. Skipping tissueExpression indexing.', rnaTissueData);
    }

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
    } else {
        console.warn('CiliAI: corumData was not an array. Skipping CORUM indexing.', corumData);
    }

    const domainsByGene = {};
    // This file is domain-centric, so we'll store it for reverse lookups
    window.CiliAI_DomainData = domainData; 
    // We can also build a gene-centric map from it
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

    const modulesByGene = {};
    for (const dataset of [neversData, liData]) {
        if (dataset && dataset.genes && typeof dataset.genes === 'object') {
            for (const geneKey in dataset.genes) {
                const geneData = dataset.genes[geneKey];
                const geneName = geneData.g; // 'g' is the gene symbol
                
                if (geneName && geneData.c !== undefined && dataset.summary?.class_list) {
                    // From Li et al. (2014)
                    const classification = dataset.summary.class_list[geneData.c];
                    if (classification) {
                        if (!modulesByGene[geneName]) modulesByGene[geneName] = [];
                        if (!modulesByGene[geneName].includes(classification)) {
                             modulesByGene[geneName].push(classification.replace(/_/g, ' '));
                        }
                    }
                } else if (geneName && Array.isArray(geneData.s) && dataset.organism_groups) {
                    // From Nevers et al. (2017)
                    // This file is better for presence/absence, not modules.
                    // We'll let the phylogeny functions handle this.
                }
            }
        }
    }
    
    // --- Build master data ---
    if (!Array.isArray(ciliahubData)) {
        console.error("CiliAI: CRITICAL ERROR - ciliahub_data.json is not an array.", ciliahubData);
        return [];
    }

    const masterData = ciliahubData.map(geneObj => {
        const gene = geneObj.gene;
        const geneUpper = gene.toUpperCase();
        
        // Combine screens from ciliahub_data.json and cilia_screens_data.json
        const hubScreens = geneObj.screens || [];
        const externalScreens = screensByGene[gene] || [];
        const allScreens = [...hubScreens, ...externalScreens];

        return {
            ...geneObj, // Base data from ciliahub (description, omim_id, localization, etc.)
            
            // --- Merged & Indexed Data ---
            screens: allScreens, // Combined screens
            expression: {
                scRNA: scExpressionByGene[geneUpper] || null, // From cellxgene_data.json
                tissue: tissueExpressionByGene[gene] || null  // From rna_tissue_consensus.tsv
            },
            complex_components: { ...geneObj.complex_components, ...corumByGene[gene] }, // Combined complexes
            pfam_ids: domainsByGene[gene]?.pfam_ids || geneObj.pfam_ids || [],
            domain_descriptions: domainsByGene[gene]?.domain_descriptions || geneObj.domain_descriptions || [],
            functional_modules: modulesByGene[gene] || []
        };
    });

    window.CiliAI_MasterData = masterData; // Global storage
    console.log('✅ CiliAI: Master data loaded', masterData.length, 'genes');
    return masterData;
}

// ==========================================================
// 2️⃣ Question Parsing (The "Brain")
// ==========================================================
async function parseCiliAIQuestion(question) {
    const q = question.toLowerCase();
    
    const structuredQuery = {
        genes: [],            // Genes to search for (e.g., [ARL13B, FOXJ1])
        filters: {},          // Strict filters (e.g., { localization: "cilia" })
        intent: {},           // What the user wants to see (e.g., { screens: true, domains: true })
        comparison: false,    // Is this a "compare A and B" query?
        species: null,        // e.g., "human", "mouse", "c. elegans"
        plotType: null        // 'umap_expression', 'umap_cluster', 'phylogeny'
    };

    // --- 1. Extract Genes ---
    if (window.CiliSearchMap) { // Assuming CiliSearchMap is built by script.js
        for (const [key, gene] of window.CiliSearchMap.entries()) {
            const regex = new RegExp(`\\b${key}\\b`, 'i');
            if (regex.test(q)) {
                if (!structuredQuery.genes.includes(gene)) {
                    structuredQuery.genes.push(gene);
                }
            }
        }
    } else {
        console.warn("CiliSearchMap not found. Gene parsing may be slow or incomplete.");
        // Fallback or error
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
    if (q.includes('bbsome')) structuredQuery.filters.complexes = 'BBSome';
    if (q.includes('condensin i')) structuredQuery.filters.complexes = 'Condensin I complex';

    // Functional Modules (from Li et al.)
    if (q.includes('module')) structuredQuery.intent.modules = true;
    if (q.includes('ciliary tip')) structuredQuery.filters.functional_modules = 'Ciliary tip'; // Note: This data isn't in your files
    if (q.includes('transition zone')) structuredQuery.filters.functional_modules = 'Transition zone'; // Note: This data isn't in your files
    if (q.includes('ciliary specific')) structuredQuery.filters.functional_modules = 'Ciliary specific';

    // Orthologs
    if (q.includes('ortholog')) structuredQuery.intent.orthologs = true;
    if (q.includes('c. elegans') || q.includes('worm')) structuredQuery.species = 'c_elegans';
    if (q.includes('mouse')) structuredQuery.species = 'mouse';
    if (q.includes('human')) structuredQuery.species = 'human';
    if (q.includes('zebrafish')) structuredQuery.species = 'zebrafish';
    if (q.includes('drosophila')) structuredQuery.species = 'drosophila';

    // Ciliopathy
    if (q.includes('ciliopathy') || q.includes('disease')) structuredQuery.intent.ciliopathy = true;
    if (q.includes('joubert') || q.includes('jbts')) structuredQuery.filters.ciliopathy = 'Joubert syndrome';
    if (q.includes('bbs')) structuredQuery.filters.ciliopathy = 'Bardet-Biedl syndrome';
    if (q.includes('nephronophthisis') || q.includes('nphp')) structuredQuery.filters.ciliopathy = 'Nephronophthisis';
    
    // Other Intents
    if (q.includes('omim')) structuredQuery.intent.omim = true;
    if (q.includes('describe') || q.startsWith('what is') || q.startsWith('what does')) structuredQuery.intent.description = true;
    
    // Expression
    if (q.includes('express') || q.includes('expression')) structuredQuery.intent.expression = true;
    if (q.includes('lung')) structuredQuery.filters.tissue = 'lung'; // For bulk
    if (q.includes('kidney')) structuredQuery.filters.tissue = 'kidney';
    if (q.includes('brain')) structuredQuery.filters.tissue = 'brain';
    if (q.includes('ciliated cell')) structuredQuery.filters.cell_type = 'ciliated cell'; // For scRNA
    
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
    
    // If genes are mentioned, default to showing a description unless other intents are specified
    if (structuredQuery.genes.length > 0 && Object.keys(structuredQuery.intent).length === 0) {
        structuredQuery.intent.description = true; // This will trigger the full card
    }
    
    // If no genes are mentioned, the filter *is* the intent (e.g., "List genes in the BBSome")
    if (structuredQuery.genes.length === 0 && Object.keys(structuredQuery.filters).length > 0) {
        structuredQuery.intent.list_genes = true;
    }

    // Handle "compare" keyword
    if (q.includes('compare')) {
        structuredQuery.comparison = true;
    }
    
    // Handle "is X a ciliary gene?"
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
    if (!data) {
        console.error("CiliAI_MasterData is not loaded!");
        return [];
    }

    // 1. If genes are specified, start with just those genes
    let results = [];
    if (structuredQuery.genes.length > 0) {
        const geneSet = new Set(structuredQuery.genes.map(g => g.toUpperCase()));
        results = data.filter(g => geneSet.has(g.gene.toUpperCase()));
    } else {
        // Otherwise, start with all genes
        results = [...data];
    }

    // 2. Apply all filters
    const filters = structuredQuery.filters;
    if (Object.keys(filters).length > 0) {
        results = results.filter(g => {
            // Check localization
            if (filters.localization) {
                const locs = (g.localization || "").toLowerCase();
                if (!locs.includes(filters.localization)) return false;
            }
            
            // Check complex (e.g., "BBSome")
            if (filters.complexes) {
                const complexNames = Object.keys(g.complex_components || {});
                if (!complexNames.some(name => name.toLowerCase().includes(filters.complexes.toLowerCase()))) {
                    return false;
                }
            }

            // Check functional module (e.g., "Ciliary specific")
            if (filters.functional_modules) {
                const modules = g.functional_modules || [];
                if (!modules.some(mod => mod.toLowerCase().includes(filters.functional_modules.toLowerCase()))) {
                    return false;
                }
            }

            // Check ciliopathy (e.g., "Joubert syndrome")
            if (filters.ciliopathy) {
                const ciliopathies = (g.ciliopathy || []).concat(g.ciliopathies || []); // Combine fields if necessary
                if (!ciliopathies.some(c => c.toLowerCase().includes(filters.ciliopathy.toLowerCase()))) {
                    return false;
                }
            }
            
            // Check bulk tissue expression
            if (filters.tissue) {
                const tissueName = Object.keys(g.expression?.tissue || {}).find(t => t.toLowerCase().includes(filters.tissue));
                if (!tissueName || !g.expression.tissue[tissueName] || parseFloat(g.expression.tissue[tissueName]) <= 0) {
                    return false;
                }
            }

            // Check scRNA cell type expression
            if (filters.cell_type) {
                if (!g.expression?.scRNA?.[filters.cell_type] || parseFloat(g.expression.scRNA[filters.cell_type]) <= 0) {
                    return false;
                }
            }
            
            // Check species (for orthologs)
            if (filters.species) {
                const key = `ortholog_${filters.species}`;
                if (!g[key]) return false;
            }

            return true;
        });
    }
    
    // 3. Handle specific sorting
    if (structuredQuery.intent.expression && filters.tissue && structuredQuery.genes.length === 0) {
        const tissueName = filters.tissue; // This is simplified
        results.sort((a, b) => {
            const valA = parseFloat(a.expression?.tissue?.[tissueName] || 0); // Needs exact match
            const valB = parseFloat(b.expression?.tissue?.[tissueName] || 0);
            return valB - valA;
        });
        results = results.slice(0, 10); // Return top 10
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

    const q = structuredQuery; // Shorthand
    const intent = q.intent;

    // --- Helper function to build HTML snippets ---
    const buildSection = (title, content) => {
        if (content && (!Array.isArray(content) || content.length > 0) && (typeof content !== 'object' || Object.keys(content).length > 0)) {
            // Special formatting for arrays
            if (Array.isArray(content)) {
                content = content.join(', ');
            }
            return `<p><strong>${title}:</strong> ${content}</p>`;
        }
        return '';
    };

    // --- 1. Handle "List" queries ---
    if (intent.list_genes && results.length > 1) {
        let title = "Found the following genes:";
        if (q.filters.ciliopathy) title = `Genes associated with ${q.filters.ciliopathy}:`;
        if (q.filters.complexes) title = `Genes in the ${q.filters.complexes}:`;
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
        let tableHtml = '<table><tr><th>Gene</th>';
        if (q.filters.tissue) tableHtml += `<th>Expression in ${q.filters.tissue} (nTPM)</th>`;
        if (q.filters.cell_type) tableHtml += `<th>Expression in ${q.filters.cell_type}</th>`;
        if (intent.localization) tableHtml += '<th>Localization</th>';
        if (intent.modules) tableHtml += '<th>Modules</th>';
        tableHtml += '</tr>';

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
        tableHtml += '</table>';
        resultArea.innerHTML = `<div class="result-card">${tableHtml}</div>`;
        return;
    }
    
    // --- 3. Handle "Gene Card" queries ---
    const html = results.map(g => {
        // --- Special Case: "is X a ciliary gene?" ---
        if (q.intent.localization && (structuredQuery.genes.length > 0) && (q.question?.startsWith('is') || q.question?.includes('ciliary'))) {
            const locs = (g.localization || "").toLowerCase();
            const answer = locs.includes('cilia') 
                ? `Yes, ${g.gene} is localized to the ${g.localization}.` 
                : `No, ${g.gene} is localized to the ${g.localization || 'an unknown location'}.`;
            return `<div class="result-card"><h3>${g.gene}</h3><p>${answer}</p></div>`;
        }
        
        // --- Build Full Card or Intent-Specific Card ---
        const cardSections = [];
        const hasSpecificIntent = Object.keys(intent).length > 0 && !intent.description;

        // Build all possible sections
        const allSections = {
            description: buildSection("Description", g.description),
            localization: buildSection("Localization", g.localization),
            omim: buildSection("OMIM ID", g.omim_id),
            ciliopathy: buildSection("Associated Ciliopathies", g.ciliopathy || g.ciliopathies),
            screens: buildSection("Screens", (g.screens || []).map(s => s.dataset).filter(Boolean).join(', ')),
            domains: buildSection("Domains", (g.domain_descriptions || []).join(', ')),
            complexes: buildSection("Complexes", Object.keys(g.complex_components || {}).join(', ')),
            modules: buildSection("Functional Modules", (g.functional_modules || []).join(', ')),
            orthologs: buildSection(q.species ? `Ortholog (${q.species})` : "Orthologs", 
                q.species ? g[`ortholog_${q.species}`] : 
                [`Mouse: ${g.ortholog_mouse || 'N/A'}`, `C. elegans: ${g.ortholog_c_elegans || 'N/A'}`].join(', ')
            ),
            expression_tissue: buildSection(`Expression in ${q.filters.tissue}`, g.expression?.tissue?.[Object.keys(g.expression?.tissue || {}).find(t => t.toLowerCase().includes(q.filters.tissue))]?.toFixed(2)),
            expression_cell: buildSection(`Expression in ${q.filters.cell_type}`, g.expression?.scRNA?.[q.filters.cell_type]?.toFixed(4))
        };

        if (!hasSpecificIntent || intent.description) {
            // Show the full, default card
            cardSections.push(
                allSections.description,
                allSections.localization,
                allSections.ciliopathy,
                allSections.complexes,
                allSections.domains,
                allSections.modules,
                allSections.screens
            );
        } else {
            // Only show sections that match the user's intent
            if (intent.localization) cardSections.push(allSections.localization);
            if (intent.screens) cardSections.push(allSections.screens);
            if (intent.domains) cardSections.push(allSections.domains);
            if (intent.complexes) cardSections.push(allSections.complexes);
            if (intent.modules) cardSections.push(allSections.modules);
            if (intent.omim) cardSections.push(allSections.omim);
            if (intent.ciliopathy) cardSections.push(allSections.ciliopathy);
            if (intent.orthologs) cardSections.push(allSections.orthologs);
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
// 3️⃣ Query Execution
// ==========================================================
function queryGenes(structuredQuery) {
    const data = window.CiliAI_MasterData;
    return data.filter(g => {
        if (structuredQuery.genes.length && !structuredQuery.genes.includes(g.gene)) return false;
        if (structuredQuery.localization && g.localization !== structuredQuery.localization) return false;
        if (structuredQuery.complexes.length) {
            const hasComplex = structuredQuery.complexes.some(c => g.complex_components[c]);
            if (!hasComplex) return false;
        }
        if (structuredQuery.functional_modules.length) {
            const hasModule = structuredQuery.functional_modules.some(m => g.functional_modules.includes(m));
            if (!hasModule) return false;
        }
        if (structuredQuery.species) {
            const speciesGenes = ['C. elegans', 'mouse', 'human', 'zebrafish', 'xenopus', 'drosophila'];
            if (!speciesGenes.includes(structuredQuery.species)) return false;
        }
        return true;
    });
}


// ==========================================================
// 5️⃣ Page HTML Injector
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
                                <span data-question="What is AAMP?">What is AAMP?</span>, 
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

        // --- Wait for elements and bind listeners ---
        // This safe call ensures ciliAI_waitForElements (defined below) is called
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
// 6️⃣ Event Listener "Glue"
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
            // 1. Load data if not already loaded
            if (!window.CiliAI_MasterData) {
                console.log('[CiliAI] Data not found, loading now...');
                await loadCiliAIData();
            }
            
            // 2. Parse the question
            const structuredQuery = await parseCiliAIQuestion(input);
            
            // --- 3. Route query to the correct function ---
            if (structuredQuery.plotType === 'phylogeny') {
                const html = await getPhylogenyAnalysis(structuredQuery.genes);
                resultArea.innerHTML = html;
            } else if (structuredQuery.plotType === 'umap_expression' && structuredQuery.genes.length > 0) {
                // Plot UMAP expression for the first gene
                await displayUmapGeneExpression(structuredQuery.genes[0]);
            } else if (structuredQuery.plotType === 'umap_cluster') {
                await displayUmapPlot();
            } else {
                // Default to standard gene query
                const results = queryGenes(structuredQuery);
                displayCiliAIResults(results, structuredQuery);
            }

        } catch (err) {
            console.error('❌ CiliAI query failed:', err);
            resultArea.innerHTML = `<p>Error: Failed to process your question.</p><pre>${err.message}</pre>`;
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
// 7️⃣ New Plotting & Helper Functions
// ==========================================================

// --- Phylogeny Functions ---

/**
 * Fetches and caches Li et al. 2014 data.
 */
async function fetchLiPhylogenyData() {
    if (liPhylogenyCache) return liPhylogenyCache;
    try {
        const res = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/li_et_al_2014_matrix_optimized.json');
        if (!res.ok) throw new Error('Failed to fetch Li 2014 data');
        liPhylogenyCache = await res.json();
        console.log('✅ Li 2014 Phylogeny data loaded and cached.');
        return liPhylogenyCache;
    } catch (error) {
        console.error('Error loading Li 2014 data:', error);
        return null;
    }
}

/**
 * Fetches and caches Nevers et al. 2017 data.
 */
async function fetchNeversPhylogenyData() {
    if (neversPhylogenyCache) return neversPhylogenyCache;
    try {
        const res = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/nevers_et_al_2017_matrix_optimized.json');
        if (!res.ok) throw new Error('Failed to fetch Nevers 2017 data');
        neversPhylogenyCache = await res.json();
        console.log('✅ Nevers 2017 Phylogeny data loaded and cached.');
        return neversPhylogenyCache;
    } catch (error) {
        console.error('Error loading Nevers 2017 data:', error);
        return null;
    }
}

/**
 * Renders the initial summary for phylogenetic queries.
 */
async function getPhylogenyAnalysis(genes) {
    // 1. Data loading and validation 
    await Promise.all([fetchLiPhylogenyData(), fetchNeversPhylogenyData()]);

    if (!liPhylogenyCache || !neversPhylogenyCache) {
        return `<div class="result-card"><h3>Analysis Error</h3><p>Phylogenetic data sources (Li 2014 or Nevers 2017) failed to load.</p></div>`;
    }
    
    // Get all HUGO gene symbols available in the Li database
    const liGenesSet = new Set(Object.values(liPhylogenyCache.genes).map(g => g.g.toUpperCase()).filter(Boolean));
    const validGeneSymbols = genes.map(g => g.toUpperCase()).filter(g => liGenesSet.has(g));
    
    if (validGeneSymbols.length === 0) {
        const neversGenesSet = new Set(Object.keys(neversPhylogenyCache.genes).map(g => g.toUpperCase()));
        const validNeversGenes = genes.map(g => g.toUpperCase()).filter(g => neversGenesSet.has(g));
        if (validNeversGenes.length === 0) {
             return `<div class="result-card"><h3>Analysis Error</h3><p>None of the requested genes were found in the phylogenetic datasets (Li 2014, Nevers 2017).</p></div>`;
        }
        // If found in Nevers but not Li, we can still proceed
        validGeneSymbols.push(...validNeversGenes);
    }

    const finalGenes = [...new Set(validGeneSymbols)]; // Unique genes

    // --- 2. Determine Output Mode: Single vs. Comparison ---
    if (finalGenes.length > 1) {
        // --- MULTI-GENE COMPARISON MODE ---
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
            const liEntry = Object.values(liPhylogenyCache.genes).find(g => g.g && g.g.toUpperCase() === gene);
            const neversEntry = neversPhylogenyCache.genes?.[gene];

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
        
        summaryHtml += `
                    </tbody>
                </table>
                <p class="ai-suggestion">
                    The visualization below provides the detailed species map for comparison.
                </p>
            </div>
        `;
        
        // Note: handlePhylogenyVisualizationQuery is not defined in the provided code.
        // This will just return the summary table for now.
        // const visualizationHtml = await handlePhylogenyVisualizationQuery(`Show heatmap for ${finalGenes.join(',')}`, 'li', 'heatmap');
        // return summaryHtml + visualizationHtml;
        return summaryHtml; // Returning only summary

    } else {
        // --- SINGLE-GENE ANALYSIS MODE ---
        const geneSymbol = finalGenes[0];
        const liEntry = Object.values(liPhylogenyCache.genes).find(g => g.g && g.g.toUpperCase() === geneSymbol);
        const neversEntry = neversPhylogenyCache?.genes?.[geneSymbol];

        const liSummary = liEntry ? (liPhylogenyCache.summary.class_list[liEntry.c] || 'Classification Unavailable').replace(/_/g, ' ') : 'Not found in Li et al. (2014)';
        const neversSpeciesCount = neversEntry?.s?.length || 0;
        const neversStatus = neversEntry ? `Found in ${neversSpeciesCount} species (Nevers et al. 2017)` : 'Not found in Nevers et al. (2017)';

        const generalSummary = `
            <div class="result-card">
                <h3>Evolutionary Summary: ${geneSymbol} 🧬</h3>
                <table class="gene-detail-table">
                    <tr><th>Li et al. (2014) Classification</th><td><strong>${liSummary}</strong></td></tr>
                    <tr><th>Nevers et al. (2017) Status</th><td>${neversStatus}</td></tr>
                </table>
            </div>
        `;
        
        // Note: handlePhylogenyVisualizationQuery is not defined.
        // const visualizationHtml = await handlePhylogenyVisualizationQuery(`Show heatmap for ${geneSymbol}`, 'li', 'heatmap');
        // return generalSummary + visualizationHtml;
        return generalSummary; // Returning only summary
    }
}


// --- UMAP Functions ---
// (We need separate caches for these as they are large and not part of the main masterData)
let umapDataCache = null;
let cellxgeneDataCache = null;

async function fetchUmapData() {
    if (umapDataCache) return umapDataCache;
    try {
        const res = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/umap_data.json');
        if (!res.ok) throw new Error('Failed to fetch UMAP data');
        umapDataCache = await res.json();
        return umapDataCache;
    } catch (err) {
        console.error('Error fetching UMAP data:', err);
        return null;
    }
}

async function fetchCellxgeneData() {
    if (cellxgeneDataCache) return cellxgeneDataCache;
    try {
        const res = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cellxgene_data.json');
        if (!res.ok) throw new Error('Failed to fetch Cellxgene data');
        cellxgeneDataCache = await res.json();
        return cellxgeneDataCache;
    } catch (err) {
        console.error('Error fetching Cellxgene data:', err);
        return null;
    }
}

/**
 * Displays a UMAP plot where each cell is colored by the expression of a specific gene.
 */
async function displayUmapGeneExpression(geneSymbol) {
    const [umapData, cellData] = await Promise.all([fetchUmapData(), fetchCellxgeneData()]);
    const resultArea = document.getElementById('ai-result-area');

    if (!umapData || !cellData) {
        resultArea.innerHTML = `<div class="result-card"><h3>UMAP Expression Plot</h3><p class="status-not-found">Could not load UMAP or Cellxgene data.</p></div>`;
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

/**
 * Displays a UMAP plot colored by cell type.
 */
async function displayUmapPlot() {
    const data = await fetchUmapData();
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

/**
 * Helper function to download Plotly plots.
 * This should be globally accessible or part of your main script.
 */
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

// NOTE: The other helper functions (formatLiGeneData, formatComparisonResult, formatComprehensiveGeneDetails)
// were not included in your request, but the advanced `displayCiliAIResults` function 
// incorporates their logic.


/**
 * Binds all event listeners to the CiliAI interface after it's been injected.
 * This is the function that was previously missing.
 */
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
            // 1. Load data if not already loaded
            if (!window.CiliAI_MasterData) {
                console.log('[CiliAI] Data not found, loading now...');
                await loadCiliAIData();
            }
            
            // 2. Parse the question
            const structuredQuery = await parseCiliAIQuestion(input);
            
            // 3. Get results
            const results = queryGenes(structuredQuery);
            
            // 4. Display results
            displayCiliAIResults(results, structuredQuery); // Pass query to renderer

        } catch (err) {
            console.error('❌ CiliAI query failed:', err);
            resultArea.innerHTML = '<p>Error: Failed to process your question.</p>';
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
                event.preventDefault(); // Stop form submission
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
                    aiInput.value = question; // Set input value
                    aiInput.focus();
                    handleQuery(); // Run the query
                }
            });
        });
    } else {
        console.error('[CiliAI] Error: No example queries found.');
    }

    console.log('[CiliAI] Event listeners bound successfully.');
}
