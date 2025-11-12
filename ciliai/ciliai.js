// ==========================================================
// 1️⃣ Data Loading
// ==========================================================
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

    async function fetchData(url, type='json') {
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
                header.forEach((h,i) => obj[h] = row[i]);
                return obj;
            });
        }
    }

    const [
        ciliahubData,
        umapData,
        screensData,
        cellxgeneData,
        rnaTissueData,
        corumData,
        domainData,
        neversData,
        liData
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

    // --- Indexing for fast access ---
    const screensByGene = {};
    // ⬇️ **FIX: Added Array.isArray() check**
    if (Array.isArray(screensData)) {
        for (const screen of screensData) {
            if (!screensByGene[screen.gene]) screensByGene[screen.gene] = [];
            screensByGene[screen.gene].push(screen);
        }
    } else {
        console.warn('CiliAI: screensData was not an array. Skipping screen indexing.', screensData);
    }

    const umapByGene = {};
    // ⬇️ **FIX: Added Array.isArray() check**
    if (Array.isArray(umapData)) {
        for (const u of umapData) umapByGene[u.gene] = {x: u.x, y: u.y};
    } else {
        console.warn('CiliAI: umapData was not an array. Skipping UMAP indexing.', umapData);
    }

    const scExpressionByGene = {};
    // ⬇️ **FIX: Added Array.isArray() check**
    if (Array.isArray(cellxgeneData)) {
        for (const row of cellxgeneData) scExpressionByGene[row.gene] = row.expression;
    } else {
        console.warn('CiliAI: cellxgeneData was not an array. Skipping scExpression indexing.', cellxgeneData);
    }

    const tissueExpressionByGene = {};
    // ⬇️ **FIX: Added Array.isArray() check** (rnaTissueData should be safe, but good practice)
    if (Array.isArray(rnaTissueData)) {
        for (const row of rnaTissueData) tissueExpressionByGene[row.gene] = row;
    } else {
        console.warn('CiliAI: rnaTissueData was not an array. Skipping tissueExpression indexing.', rnaTissueData);
    }

    const corumByGene = {};
    // ⬇️ **FIX: Added Array.isArray() check**
    if (Array.isArray(corumData)) {
        for (const complex of corumData) {
            for (const g of complex.subunits) {
                if (!corumByGene[g]) corumByGene[g] = {};
                corumByGene[g][complex.name] = complex.subunits;
            }
        }
    } else {
        console.warn('CiliAI: corumData was not an array. Skipping CORUM indexing.', corumData);
G    }

    const domainsByGene = {};
    // ⬇️ **FIX: Added Array.isArray() check**
    if (Array.isArray(domainData)) {
        for (const d of domainData) domainsByGene[d.gene] = {pfam_ids: d.pfam_ids, domain_descriptions: d.domain_descriptions};
    } else {
        console.warn('CiliAI: domainData was not an array. Skipping domain indexing.', domainData);
    }

    const modulesByGene = {};
    // This loop is safe because neversData and liData are objects and are iterated with `for...in`
    for (const dataset of [neversData, liData]) {
        if (dataset && typeof dataset === 'object') { // Added check for safety
            for (const g in dataset) {
                if (!modulesByGene[g]) modulesByGene[g] = [];
                // Ensure dataset[g].modules is iterable before spreading
                if (Array.isArray(dataset[g]?.modules)) {
                    modulesByGene[g].push(...dataset[g].modules);
                }
            }
        }
    }

    // This masterData mapping should now be safe, as the indexed objects 
    // (e.g., screensByGene) will be empty if the data failed to load.
    const masterData = ciliahubData.map(geneObj => {
        const gene = geneObj.gene;
        return {
            ...geneObj,
            screens: screensByGene[gene] || [],
            umap: umapByGene[gene] || null,
            expression: {
                scRNA: scExpressionByGene[gene] || null,
                tissue: tissueExpressionByGene[gene] || null
            },
            complex_components: corumByGene[gene] || {},
            pfam_ids: domainsByGene[gene]?.pfam_ids || [],
            domain_descriptions: domainsByGene[gene]?.domain_descriptions || [],
            functional_modules: modulesByGene[gene] || []
  .       };
    });

    window.CiliAI_MasterData = masterData; // Global storage
    console.log('✅ CiliAI: Master data loaded', masterData.length, 'genes');
    return masterData;
}

// ==========================================================
// 2️⃣ Question Parsing (simple + complex)
// ==========================================================
async function parseCiliAIQuestion(question) {
    question = question.toLowerCase();
    const structuredQuery = {
        genes: [],
        complexes: [],
        domains: [],
        localization: null,
        functional_modules: [],
        species: null,
        umap: false,
        scRNA_tissue: null
    };

    const allGenes = window.CiliAI_MasterData.map(g => g.gene.toLowerCase());
    for (const gene of allGenes) if (question.includes(gene)) structuredQuery.genes.push(gene.toUpperCase());

    // Complex parsing rules
    if (question.includes('bbsome')) structuredQuery.complexes.push('BBSome');
    if (question.includes('c. elegans')) structuredQuery.species = 'C. elegans';
    if (question.includes('mouse')) structuredQuery.species = 'mouse';
    if (question.includes('human')) structuredQuery.species = 'human';
    if (question.includes('cilia')) structuredQuery.localization = 'cilia';
    if (question.includes('umap')) structuredQuery.umap = true;
    if (question.includes('lung') || question.includes('kidney') || question.includes('brain')) {
        structuredQuery.scRNA_tissue = question.match(/lung|kidney|brain/)[0];
    }
    if (question.includes('tip')) structuredQuery.functional_modules.push('Ciliary tip');
    if (question.includes('base')) structuredQuery.functional_modules.push('Ciliary base');

    return structuredQuery;
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
            // optionally could filter orthologs by species
        }
        return true;
    });
}

// ==========================================================
// 4️⃣ Results Rendering (UMAP + expression included)
// ==========================================================
function displayCiliAIResults(results) {
    const resultArea = document.getElementById('ai-result-area');
    resultArea.style.display = 'block';
    if (!results.length) {
        resultArea.innerHTML = '<p>No results found.</p>';
        return;
    }

    const html = results.map(g => `
        <div class="result-card">
            <h3>${g.gene}</h3>
            <p>${g.description || ''}</p>
            <p><strong>Localization:</strong> ${g.localization || 'N/A'}</p>
            <p><strong>Complexes:</strong> ${Object.keys(g.complex_components).join(', ') || 'None'}</p>
            <p><strong>Domains:</strong> ${g.domain_descriptions.join(', ') || 'None'}</p>
            <p><strong>Functional Modules:</strong> ${g.functional_modules.join(', ') || 'None'}</p>
            <p><strong>Screens:</strong> ${g.screens.map(s => s.dataset).join(', ') || 'None'}</p>
            ${g.umap ? `<p><strong>UMAP coordinates:</strong> X=${g.umap?.x}, Y=${g.umap?.y}</p>` : ''}
            ${g.expression?.scRNA && g.expression?.scRNA[structuredQuery.scRNA_tissue] ? `<p><strong>scRNA expression in ${structuredQuery.scRNA_tissue}:</strong> ${g.expression.scRNA[structuredQuery.scRNA_tissue]}</p>` : ''}
        </div>
    `).join('');

    resultArea.innerHTML = html;
}

// ==========================================================
// 2️⃣ Question Parsing (simple NLP → structured query)
// ==========================================================
async function parseCiliAIQuestion(question) {
    question = question.toLowerCase();
    const structuredQuery = {
        genes: [],
        complexes: [],
        domains: [],
        localization: null,
        functional_modules: [],
        species: null
    };

    const allGenes = window.CiliAI_MasterData.map(g => g.gene.toLowerCase());
    for (const gene of allGenes) if (question.includes(gene)) structuredQuery.genes.push(gene.toUpperCase());

    if (question.includes('bbsome')) structuredQuery.complexes.push('BBSome');
    if (question.includes('c. elegans')) structuredQuery.species = 'C. elegans';
    if (question.includes('cilia')) structuredQuery.localization = 'cilia';

    return structuredQuery;
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


// --- Main Page Display Function (REPLACEMENT) ---
// This function should be in your main script.js or globals.js
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
                                <span data-question="What can you do?">About CiliAI</span>, 
                                <span data-question="Show genes for Joubert syndrome">List genes for Joubert syndrome</span>, 
                                <span data-question="List ciliary genes in C. elegans">List potential ciliary genes in C. elegans (Phylogenetic)</span>, 
                                <span data-question="Plot UMAP expression for FOXJ1">Display expression for FOXJ1 in Lung</span>,
                                <span data-question="Compare ARL13B and FOXJ1 expression in lung scRNA-seq">Compare ARL13B and FOXJ1 expression in lung scRNA-seq</span>,
                                <span data-question="Compare phylogeny of BBS1 and CEP290.">Compare phylogeny of BBS1 and CEP290</span>,
                                <span data-question="What proteins are enriched at the ciliary tip?">What proteins are enriched at the ciliary tip?</span>,
                                <span data-question="Which Joubert Syndrome genes are expressed in ciliated cells?">Joubert genes in ciliated cells</span>
                            </p>
                        </div>
                        <div id="ai-result-area" class="results-section" style="display: none; margin-top: 1.5rem; padding: 1rem;"></div>
                    </div>
                    
                    <div class="input-section" style="display:none;"> 
                        <h3>Analyze Gene Phenotypes</h3>
                        <div class="input-group">
                            <label for="geneInput">Gene Symbols:</label>
                            <div class="autocomplete-wrapper">
                                <textarea id="geneInput" class="gene-input-textarea" placeholder="Start typing a gene symbol (e.g., IFT88)..."></textarea>
                                <div id="geneSuggestions" class="suggestions-container"></div>
                            </div>
                        </div>
                        <div class="input-group">
                            <label>Analysis Mode:</label>
                            <div class="mode-selector"></div>
                        </div>
                        <button class="analyze-btn" id="analyzeBtn">🔍 Analyze Genes</button>
                    </div>
                    <div id="resultsSection" class="results-section" style="display: none;"></div>
                </div>
            </div>
            <style>
                /* Keep all existing CSS exactly as before */
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
                .input-section { background-color: #fff; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
                .input-group { margin-bottom: 1.5rem; }
                .input-group label { display: block; font-weight: bold; margin-bottom: 0.5rem; color: #333; }
                .gene-input-textarea { width: 100%; box-sizing: border-box; padding: 0.8rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; min-height: 80px; resize: vertical; }
                .mode-selector { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
                .mode-option input[type="radio"] { display: none; }
                .mode-option label { display: flex; align-items: center; gap: 10px; padding: 1rem; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
                .mode-option input[type="radio"]:checked + label { border-color: #2c5aa0; background-color: #e8f4fd; box-shadow: 0 0 5px rgba(44, 90, 160, 0.3); }
                .mode-icon { font-size: 1.8rem; }
                .analyze-btn { width: 100%; padding: 1rem; font-size: 1.1rem; font-weight: bold; background-color: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer; transition: background-color 0.2s; }
                .analyze-btn:hover:not([disabled]) { background-color: #218838; }
                .results-section { margin-top: 2rem; padding: 2rem; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
                .result-card { border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
                .result-card h3 { margin-top: 0; color: #2c5aa0; }
                .ciliopathy-table, .expression-table, .gene-detail-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                .ciliopathy-table th, .ciliopathy-table td, .expression-table th, .expression-table td, .gene-detail-table th, .gene-detail-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                .ciliopathy-table th, .expression-table th, .gene-detail-table th { background-color: #e8f4fd; color: #2c5aa0; }
                .suggestions-container { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #ccc; z-index: 1000; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .suggestion-item { padding: 10px; cursor: pointer; }
                .suggestion-item:hover { background-color: #f0f0f0; }
                .download-button { background-color: #28a745; color: white; padding: 8px 14px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em; font-weight: bold; margin-top: 15px; transition: background-color 0.3s ease; }
                .download-button:hover { background-color: #218838; }
            </style>
        `;

        console.log('✅ CiliAI: Page HTML injected successfully.');

        const analyzeSection = contentArea.querySelector('.input-section');
        if (analyzeSection) {
            analyzeSection.style.display = 'none';
            console.log('[CiliAI] Analyze section hidden.');
        }

        // Wait for all elements before proceeding
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


// inside displayCiliAIPage(), right after the innerHTML assignment:
ciliAI_waitForElements(); 
