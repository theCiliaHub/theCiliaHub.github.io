// =============================================================================
// GLOBAL VARIABLES & INITIAL SETUP
// =============================================================================
const geneLocalizationData = {};
let allGenes = [];
let currentData = [];
let searchResults = [];
let currentChartInstance; // Manages the active Chart.js instance for all pages
const allPartIds = ["cell-body", "nucleus", "basal-body", "transition-zone", "axoneme", "ciliary-membrane"];
const defaultGenesNames = ["ACE2", "ADAMTS20", "ADAMTS9", "IFT88", "CEP290", "WDR31", "ARL13B", "BBS1"];

Chart.register({
    id: 'customCanvasBackgroundColor',
    beforeDraw: (chart, args, options) => {
        const { ctx } = chart;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = options.color || '#ffffff';
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
    }
});

// =============================================================================
// CORE DATA LOADING AND SEARCH SYSTEM (UPGRADED)
// =============================================================================
let geneDataCache = null;
let geneMapCache = null;

function sanitize(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim().toUpperCase();
}

/**
 * Loads the database and builds an efficient, multi-identifier search map.
 * This new version indexes genes by Name, Synonyms, and Ensembl ID.
 */
async function loadAndPrepareDatabase() {
    if (geneDataCache) return true;
    try {
        const resp = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/ciliahub_data.json');
        if (!resp.ok) throw new Error(`HTTP Error ${resp.status}`);
        const rawGenes = await resp.json();
        
        geneDataCache = rawGenes;
        allGenes = rawGenes;
        geneMapCache = new Map();

        allGenes.forEach(g => {
            if (!g || !g.gene) return; // Skip invalid gene objects

            const geneObject = g;

            // ✨ NEW: Create a comprehensive list of all identifiers for a gene
            const identifiers = [
                g.gene,
                g.ensembl_id,
                ...(String(g.synonym || '').split(','))
            ];
            
            identifiers.forEach(id => {
                const key = sanitize(id);
                // Ensure key is valid and not already pointing to a different gene
                if (key && !geneMapCache.has(key)) {
                    geneMapCache.set(key, geneObject);
                }
            });
            
            if (g.localization) {
                geneLocalizationData[g.gene] = mapLocalizationToSVG(g.localization);
            }
        });

        currentData = allGenes.filter(g => defaultGenesNames.includes(g.gene));
        return true;
    } catch (e) {
        console.error('Data load error', e);
        allGenes = getDefaultGenes();
        currentData = allGenes;
        geneMapCache = new Map();
        allGenes.forEach(g => geneMapCache.set(sanitize(g.gene), g));
        return false;
    }
}

/**
 * Central search function for exact matches (used by search buttons).
 */
function findGenes(queries) {
    const foundGenes = new Set();
    const notFound = [];
    queries.forEach(query => {
        const result = geneMapCache.get(sanitize(query));
        if (result) {
            foundGenes.add(result);
        } else {
            notFound.push(query);
        }
    });
    return { foundGenes: Array.from(foundGenes), notFoundGenes: notFound };
}

/**
 * ✨ NEW: Autocomplete search function for partial matches.
 * Finds genes where any identifier starts with the user's query.
 */
function findGenesAutocomplete(query) {
    if (query.length < 2) return [];

    const sanitizedQuery = sanitize(query);
    const suggestions = new Set();
    
    // Iterate through the search map keys for partial matches
    for (const key of geneMapCache.keys()) {
        if (key.startsWith(sanitizedQuery)) {
            suggestions.add(geneMapCache.get(key));
            if (suggestions.size >= 10) break; // Limit to 10 suggestions
        }
    }
    
    return Array.from(suggestions);
}
// Add this function to help with debugging
function debugSearch(query) {
    console.log("Searching for:", query);
    console.log("Cache has key?", geneMapCache.has(query));
    
    if (!geneMapCache.has(query)) {
        console.log("Available keys matching query:");
        for (let key of geneMapCache.keys()) {
            if (key.includes(query) || query.includes(key)) {
                console.log(`- ${key}`);
            }
        }
    }
}

/**
 * Handles the UI for the Batch Gene Query page.
 */
function performBatchSearch() {
    const inputElement = document.getElementById('batch-genes-input');
    const resultDiv = document.getElementById('batch-results');
    if (!inputElement || !resultDiv) return;

    const queries = inputElement.value.split(/[\s,;\n\r\t]+/).map(sanitize).filter(Boolean);
    if (queries.length === 0) {
        resultDiv.innerHTML = '<p class="status-message error-message">Please enter one or more gene names.</p>';
        return;
    }

    const { foundGenes, notFoundGenes } = findGenes(queries);
    displayBatchResults(foundGenes, notFoundGenes);
}

/**
 * Handles the UI for the Single Gene Search on the Home page.
 */
function performSingleSearch() {
    const query = document.getElementById('single-gene-search')?.value || '';
    // The query is sanitized by findGenes, so we pass it directly
    const { foundGenes } = findGenes([query]);
    if (!statusDiv) return;
    
    statusDiv.style.display = 'block';
    if (!query) {
        statusDiv.innerHTML = `<span class="error-message">Please enter a gene name.</span>`;
        return;
    }
    statusDiv.innerHTML = '<span>Searching...</span>';

    const { foundGenes } = findGenes([query]);

    if (foundGenes.length === 1) {
        navigateTo(null, `/${foundGenes[0].gene}`);
    } else if (foundGenes.length > 1) {
        navigateTo(null, '/batch-query');
        setTimeout(() => {
            const batchInput = document.getElementById('batch-genes-input');
            if (batchInput) {
                batchInput.value = foundGenes.map(r => r.gene).join('\n');
                performBatchSearch();
            }
        }, 100);
    } else {
        statusDiv.innerHTML = `<span class="error-message">No exact match found for "${query}".</span>`;
    }
}

/**
 * Displays batch results.
 */
function displayBatchResults(foundGenes, notFoundGenes) {
    const resultDiv = document.getElementById('batch-results');
    if (!resultDiv) return;

    let html = `<h3>Search Results (${foundGenes.length} gene${foundGenes.length !== 1 ? 's' : ''} found)</h3>`;

    if (foundGenes.length > 0) {
        html += '<table><thead><tr><th>Gene</th><th>Ensembl ID</th><th>Localization</th><th>Function Summary</th></tr></thead><tbody>';
        foundGenes.forEach(item => {
            // Join localization array for display
            const localizationText = Array.isArray(item.localization) ? item.localization.join(', ') : (item.localization || '-');
            html += `<tr>
                <td><a href="/${item.gene}" onclick="navigateTo(event, '/${item.gene}')">${item.gene}</a></td>
                <td>${item.ensembl_id || '-'}</td>
                <td>${localizationText}</td>
                <td>${item.functional_summary ? item.functional_summary.substring(0, 100) + '...' : '-'}</td>
            </tr>`;
        });
        html += '</tbody></table>';
    }

    if (notFoundGenes && notFoundGenes.length > 0) {
        html += `
            <div style="margin-top: 20px; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                <h4>Genes Not Found (${notFoundGenes.length}):</h4>
                <p>${notFoundGenes.join(', ')}</p>
            </div>
        `;
    }
    
    resultDiv.innerHTML = html;
    const cardsContainer = document.getElementById('gene-cards-container');
    if (cardsContainer) cardsContainer.innerHTML = '';
}

// Default gene set as fallback if loading fails
function getDefaultGenes() {
    return [
        {
            gene: "IFT88",
            ensembl_id: "ENSG00000032742",
            description: "Intraflagellar transport protein 88. Key component of the IFT-B complex.",
            synonym: "BBS20, D13S840E, TG737, TTC10",
            omim_id: "605484",
            functional_summary: "Essential for intraflagellar transport and ciliary assembly. It is a component of the IFT complex B and is required for cilium biogenesis.",
            localization: ["axoneme", "basal body"],
            reference: ["https://pubmed.ncbi.nlm.nih.gov/9724754/"],
            protein_complexes: "IFT-B",
            gene_annotation: "",
            functional_category: ["Intraflagellar transport", "Ciliary assembly/disassembly"],
            ciliopathy: "Bardet-Biedl syndrome 20"
        },
        {
            gene: "CEP290",
            ensembl_id: "ENSG00000198707",
            description: "Centrosomal protein 290. Critical component of the ciliary transition zone.",
            synonym: "BBS14, JBTS5, MKS4, NPHP6, SLSN6",
            omim_id: "610142",
            functional_summary: "Regulates ciliary gating and ciliopathy-related pathways. Acts as a gatekeeper for proteins entering and exiting the cilium.",
            localization: ["transition zone"],
            reference: ["https://pubmed.ncbi.nlm.nih.gov/16971477/"],
            protein_complexes: "NPHP-MKS-JBTS complex",
            gene_annotation: "",
            functional_category: ["Transition zone", "Ciliary gating"],
            ciliopathy: "Joubert syndrome 5, Meckel syndrome 4, Bardet-Biedl syndrome 14, Leber congenital amaurosis 10"
        },
        {
            gene: "WDR31",
            ensembl_id: "ENSG00000106459",
            description: "WD repeat domain 31. Involved in ciliary assembly and maintenance.",
            synonym: "C14orf148",
            omim_id: "",
            functional_summary: "Required for proper ciliary structure and function. It is thought to be involved in the regulation of ciliogenesis.",
            localization: ["axoneme"],
            reference: ["https://pubmed.ncbi.nlm.nih.gov/22114125/"],
            protein_complexes: "",
            gene_annotation: "",
            functional_category: ["Ciliary assembly/disassembly"],
            ciliopathy: ""
        },
        {
            gene: "ARL13B",
            ensembl_id: "ENSG00000169379",
            description: "ADP-ribosylation factor-like protein 13B. Involved in ciliary membrane biogenesis.",
            synonym: "ARL2L2, JBTS8",
            omim_id: "608922",
            functional_summary: "Critical for ciliary signaling and membrane trafficking. It is a small G protein that localizes to the ciliary membrane and regulates the traffic of ciliary proteins.",
            localization: ["ciliary membrane"],
            reference: ["https://pubmed.ncbi.nlm.nih.gov/19732862/"],
            protein_complexes: "",
            gene_annotation: "",
            functional_category: ["Ciliary membrane", "Signal transduction"],
            ciliopathy: "Joubert syndrome 8"
        },
        {
            gene: "BBS1",
            ensembl_id: "ENSG00000166246",
            description: "Bardet-Biedl syndrome 1 protein. Part of the BBSome complex.",
            synonym: "BBS",
            omim_id: "209901",
            functional_summary: "Involved in ciliary trafficking and BBSome assembly. The BBSome complex is a key regulator of protein trafficking to and from the cilium.",
            localization: ["basal body", "ciliary membrane"],
            reference: ["https://pubmed.ncbi.nlm.nih.gov/11058628/"],
            protein_complexes: "BBSome",
            gene_annotation: "",
            functional_category: ["Ciliary trafficking", "BBSome complex"],
            ciliopathy: "Bardet-Biedl syndrome 1"
        },
        {
            gene: "ACE2",
            ensembl_id: "ENSG00000130234",
            description: "Angiotensin-converting enzyme 2. Serves as the entry point for SARS-CoV-2.",
            synonym: "ACEH",
            omim_id: "300335",
            functional_summary: "Regulates blood pressure and acts as a receptor for coronaviruses in respiratory cilia. Its expression on ciliated cells is a key factor in COVID-19 infection.",
            localization: ["cilia"],
            reference: ["https://pubmed.ncbi.nlm.nih.gov/32142651/"],
            protein_complexes: "",
            gene_annotation: "",
            functional_category: ["Cell surface receptor", "Ciliary membrane"],
            ciliopathy: ""
        },
        {
            gene: "PKD2",
            ensembl_id: "ENSG00000118762",
            description: "Polycystin-2, a calcium-permeable ion channel.",
            synonym: "TRPP2",
            omim_id: "173910",
            functional_summary: "Ion channel important for mechanosensation in primary cilia.",
            localization: ["axoneme", "endoplasmic reticulum"],
            reference: ["https://pubmed.ncbi.nlm.nih.gov/11285250/"],
            protein_complexes: ["Polycystin complex"],
            gene_annotation: "",
            functional_category: ["Ion transport", "Ciliary signaling"],
            ciliopathy: "Autosomal dominant polycystic kidney disease"
        }
    ];
}


function mapLocalizationToSVG(localizationArray) {
    const mapping = {
        "ciliary membrane": ["ciliary-membrane", "axoneme"],
        "axoneme": ["ciliary-membrane", "axoneme"],
        "basal body": ["basal-body"],
        "transition zone": ["transition-zone"],
        "cilia": ["ciliary-membrane", "axoneme"],
        "flagella": ["ciliary-membrane", "axoneme"],
        "ciliary associated gene": ["ciliary-membrane", "axoneme"],
        "nucleus": ["nucleus"],
        "centrosome": ["basal-body"],
        "cytosol": ["cell-body"],
        "mitochondrion": ["cell-body"],
        "endoplasmic reticulum": ["cell-body"],
        "golgi apparatus": ["cell-body"],
        "lysosome": ["cell-body"],             // ✨ NEW
        "microbody": ["cell-body"],             // ✨ NEW
        "peroxisome": ["cell-body"],            // ✨ NEW
        "microtubules": ["cell-body"],          // ✨ NEW
        "autophagosomes": ["cell-body"]         // ✨ NEW
    };
    if (!Array.isArray(localizationArray)) return [];

    return localizationArray.flatMap(loc => {
        // If 'loc' is not a string (e.g., it's null), skip it.
        if (typeof loc !== 'string') return []; 

        const normalized = loc.trim().toLowerCase().replace(/[-_]/g, ' ');
        return mapping[normalized] || [];

    }).filter(id => allPartIds.includes(id));
}

async function handleRouteChange() {
    await loadAndPrepareDatabase(); // Use the new, efficient data loader
    const path = window.location.hash.replace('#', '').toLowerCase() || '/';
    const geneName = sanitize(path.split('/').pop().replace('.html', ''));
    const gene = geneMapCache.get(geneName);
    
    updateActiveNav(path);
    
    if (path === '/' || path === '/index.html') {
        displayHomePage();
        setTimeout(displayLocalizationChart, 0);
    } else if (path === '/batch-query') {
        displayBatchQueryTool();
    } else if (path === '/enrichment') {
        displayEnrichmentPage();
    } else if (path === '/compare') {
        displayComparePage();
    } else if (path === '/expression') {
        displayExpressionPage();
    } else if (path === '/download') {
        displayDownloadPage();
    } else if (path === '/contact') {
        displayContactPage();
    } else if (gene) {
        displayIndividualGenePage(gene);
    } else {
        // Don't show "not found" for the homepage
        if (path !== '/' && path !== '/index.html') {
            displayNotFoundPage();
        }
    }
}
    
function initGlobalEventListeners() {
    window.addEventListener('scroll', handleStickySearch);
    document.querySelectorAll('.cilia-part').forEach(part => {
        part.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                part.classList.toggle('highlighted');
            }
        });
    });
    
    const ciliaSvg = document.querySelector('.interactive-cilium svg');
    if (ciliaSvg) {
        Panzoom(ciliaSvg, {
            maxZoom: 3,
            minZoom: 0.5,
            contain: 'outside'
        });
        ciliaSvg.parentElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            const panzoom = Panzoom(ciliaSvg);
            panzoom.zoom(panzoom.getScale() * (e.deltaY > 0 ? 0.9 : 1.1));
        });
    }
}

function displayHomePage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area';
    document.querySelector('.cilia-panel').style.display = 'block';
    contentArea.innerHTML = `
        <div class="page-section">
            <h1>The CiliaHub: An Updated Database of Gold Standard Genes with Ciliary Functions</h1>
            <p style="font-size: 1.1rem; color: #555;">CiliaHub is an advanced <strong>bioinformatics</strong> platform that hosts a detailed database of <strong>gold standard cilia genes</strong> and their role in various <strong>ciliopathies</strong>. Our comprehensive collection includes the most reliable and well-established genes linked to ciliary function, with reference papers also provided. With our user-friendly search tool, researchers can explore <strong>genome</strong>-wide data, focusing on both known and novel ciliary genes. Discover their contributions to the biology of cilia and the mechanisms behind ciliary-related disorders. Search for a single gene below or use the Batch Query tool to analyze multiple genes.</p>
            <div class="search-container">
                <div class="search-wrapper" style="flex: 1;">
                    <input type="text" id="single-gene-search" placeholder="Search for a single gene (e.g., ACE2, IFT88)" aria-label="Search for a single gene" autocomplete="off">
                    <div id="search-suggestions"></div>
                </div>
                <button id="single-search-btn" class="search-btn btn btn-primary" aria-label="Search for the entered gene name">Search</button>
            </div>
            <div id="gene-cards-container" class="gene-cards"></div>
            <div id="status-message" class="status-message" style="display: none;"></div>
        </div>`;
    
    document.getElementById('single-search-btn').onclick = performSingleSearch;
    const searchInput = document.getElementById('single-gene-search');
    const suggestionsContainer = document.getElementById('search-suggestions');

    // --- HELPER FUNCTION to hide suggestions ---
    const hideSuggestions = () => {
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.style.display = 'none'; // ADDED: Ensure it's hidden
    };
    
    searchInput.addEventListener('input', function() {
        const query = this.value.trim().toUpperCase();
        if (query.length < 1) {
            hideSuggestions();
            return;
        }
        
        const filteredGenes = allGenes.filter(g => 
            (g.gene && g.gene.toUpperCase().startsWith(query)) || 
            (g.synonym && g.synonym.toUpperCase().includes(query))
        ).slice(0, 10);
        
        if (filteredGenes.length > 0) {
            suggestionsContainer.innerHTML = '<ul>' + 
                filteredGenes.map(g => `<li>${g.gene}${g.synonym ? ` (${g.synonym})` : ''}</li>`).join('') + 
                '</ul>';
            
            // CHANGE: Use event delegation for better performance
            suggestionsContainer.querySelector('ul').addEventListener('click', function(event) {
                if (event.target && event.target.nodeName === "LI") {
                    searchInput.value = event.target.textContent.split(' ')[0]; // Get just the gene name
                    hideSuggestions();
                    performSingleSearch();
                }
            });

            suggestionsContainer.style.display = 'block'; // ADDED: Make suggestions visible
        } else {
            hideSuggestions();
        }
    });
    
    searchInput.addEventListener('keydown', function(event) {
        const suggestions = suggestionsContainer.querySelectorAll('li');
        if (suggestions.length === 0 && event.key !== 'Enter') return;
        
        let activeElement = suggestionsContainer.querySelector('.active');

        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent form submission
            if (activeElement) {
                searchInput.value = activeElement.textContent.split(' ')[0];
            }
            hideSuggestions();
            performSingleSearch();
            return;
        }
        
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            let nextElement = activeElement ? activeElement.nextElementSibling : suggestions[0];
            if (nextElement) {
                activeElement?.classList.remove('active');
                nextElement.classList.add('active');
            }
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            let prevElement = activeElement ? activeElement.previousElementSibling : suggestions[suggestions.length - 1];
            if (prevElement) {
                activeElement?.classList.remove('active');
                prevElement.classList.add('active');
            }
        }
    });
    
    document.addEventListener('click', function(event) {
        // CHANGE: Also check if the click is inside the suggestions container
        if (!searchInput.contains(event.target) && !suggestionsContainer.contains(event.target)) {
            hideSuggestions();
        }
    });
    
    displayGeneCards(currentData, [], 1, 10);


 // ✨ NEW: Autocomplete logic
    const searchInput = document.getElementById('single-gene-search');
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toUpperCase();
        if (query.length < 2) {
            // hide suggestions
            return;
        }
        
        let suggestions = [];
        // Use the keys from the map for fast autocomplete
        for (const key of geneMapCache.keys()) {
            if (key.startsWith(query)) {
                suggestions.push(geneMapCache.get(key));
                if (suggestions.length >= 10) break;
            }
        }
        // Remove duplicates by gene name
        suggestions = [...new Map(suggestions.map(item => [item.gene, item])).values()];
        // ... code to display suggestions dropdown ...
    });
}

function displayBatchQueryTool() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area';
    document.querySelector('.cilia-panel').style.display = 'block';
    contentArea.innerHTML = `
        <div class="page-section">
            <h2>Batch Gene Query</h2>
            <p style="font-size: 1rem; color: #555;">
                Enter multiple gene names (comma, space, or newline separated) OR upload a CSV file.
                <span class="tooltip" aria-label="Help">
                    <span class="tooltip-icon">?</span>
                    <span class="tooltip-text">Enter gene names like: ACE2, IFT88, CEP290. For CSV, use a single column with gene names. <a href="/sample_genes.csv" download>Download sample CSV</a>.</span>
                </span>
            </p>
            <div style="margin-bottom: 1rem;">
                <label for="localization-filter" style="font-weight: 600;">Filter by Localization:</label>
                <select id="localization-filter" aria-label="Filter by localization">
                    <option value="">All Localizations</option>
                    <option value="Axoneme">Axoneme</option>
                    <option value="Basal Body">Basal Body</option>
                    <option value="Transition Zone">Transition Zone</option>
                    <option value="Ciliary Membrane">Ciliary Membrane</option>
                    <option value="Cilia">Cilia</option>
                </select>
            </div>
            <div class="filters">
                <label for="keyword-filter">Keyword Search:</label>
                <input type="text" id="keyword-filter" placeholder="e.g., transport, ciliopathy" aria-label="Filter by keyword">
            </div>
            <label for="batch-genes-input" style="font-weight: 600;">Enter gene names:</label>
            <textarea id="batch-genes-input" placeholder="e.g., ACE2, IFT88, CEP290" aria-label="Enter multiple gene names"></textarea>
            <div style="margin-top: 1rem;">
                <label for="csv-upload" style="font-weight: 600;">Or upload CSV file:</label>
                <input type="file" id="csv-upload" accept=".csv" />
            </div>
            <button id="batch-search-btn" class="search-btn btn btn-primary" aria-label="Search genes">Search Genes</button>
            <button id="export-results-btn" class="search-btn btn btn-primary" style="margin-left: 1rem;" aria-label="Export search results as CSV">Export Results</button>
            <div id="batch-results"></div>
            <div id="gene-cards-container" class="gene-cards"></div>
            <div id="status-message" class="status-message" style="display: none;"></div>
        </div>`;
    
    document.getElementById('csv-upload').addEventListener('change', handleCSVUpload);
    document.getElementById('batch-search-btn').onclick = performBatchSearch;
    document.getElementById('batch-genes-input').onkeydown = e => { if (e.key === 'Enter' && e.ctrlKey) performBatchSearch(); };
    document.getElementById('export-results-btn').onclick = exportSearchResults;
    
    displayGeneCards(currentData, [], 1, 10);
}

function exportSearchResults() {
    const results = searchResults.length > 0 ? searchResults : currentData;
    // ✨ FIX: Use .join() to correctly handle arrays for CSV output
    const csv = ['Gene,Description,Localization,Ensembl ID,OMIM ID,Functional Summary,Reference']
        .concat(results.map(g => `"${g.gene}","${g.description || ''}","${Array.isArray(g.localization) ? g.localization.join('; ') : (g.localization || '')}","${g.ensembl_id || ''}","${g.omim_id || ''}","${g.functional_summary || ''}","${Array.isArray(g.reference) ? g.reference.join('; ') : (g.reference || '')}"`))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ciliahub_results.csv';
    a.click();
    URL.revokeObjectURL(url);
}

function displayComparePage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    document.querySelector('.cilia-panel').style.display = 'none';
    contentArea.innerHTML = `
        <div class="page-section">
            <h2>Gene Comparison Tool</h2>
            <p>Search for and select up to 10 genes to generate a side-by-side comparison of their properties, functions, and localizations.</p>
            
            <div class="comparison-tool">
                <div class="gene-selector">
                    <div class="search-wrapper">
                        <input type="text" id="compare-gene-search" placeholder="Search for a gene (e.g., IFT88)" autocomplete="off">
                        <div id="compare-search-suggestions"></div>
                    </div>
                    <div id="selected-genes-tags" class="gene-tags-container"></div>
                    <div id="gene-limit-message" class="error-message" style="display: none; margin-top: 0.5rem;">Maximum 10 genes can be compared.</div>
                </div>
                
                <div id="comparison-output" style="display:none; margin-top: 2rem;">
                    <div class="comparison-controls">
                        <div class="tabs">
                            <button class="tab-link active" data-tab="table-view">Table View</button>
                            <button class="tab-link" data-tab="visual-analysis">Visual Analysis</button>
                            <button class="tab-link" data-tab="functional-comparison">Functional Comparison</button>
                        </div>
                        <button id="clear-comparison-btn" class="btn btn-secondary">Clear All</button>
                    </div>

                    <div id="table-view" class="tab-content active">
                        <div id="comparison-table-wrapper"></div>
                    </div>
                    <div id="visual-analysis" class="tab-content">
                        <div class="chart-container" style="position: relative; height:400px; width:100%;">
                            <canvas id="localization-chart"></canvas>
                        </div>
                    </div>
                    <div id="functional-comparison" class="tab-content">
                        <div id="functional-cards-grid" class="functional-comparison-grid"></div>
                    </div>
                </div>
                <div id="comparison-placeholder" class="status-message">
                    <p>Add genes to begin comparison.</p>
                </div>
            </div>
        </div>`;
    
    let selectedCompareGenes = [];
    const MAX_GENES = 10;
    const searchInput = document.getElementById('compare-gene-search');
    const suggestionsContainer = document.getElementById('compare-search-suggestions');
    const tagsContainer = document.getElementById('selected-genes-tags');
    const outputContainer = document.getElementById('comparison-output');
    const placeholder = document.getElementById('comparison-placeholder');
    const limitMessage = document.getElementById('gene-limit-message');
    const clearButton = document.getElementById('clear-comparison-btn');

    searchInput.addEventListener('input', handleSearchInput);
    clearButton.addEventListener('click', clearComparison);
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });

    function handleSearchInput() {
         const query = searchInput.value.trim().toUpperCase(); // ✨ FIX: Changed to toUpperCase()
    if (query.length < 1) {
        suggestionsContainer.style.display = 'none';
        return;
    }

        const filteredGenes = allGenes.filter(g =>
        g.gene.toUpperCase().startsWith(query) && // ✨ FIX: Use startsWith for better performance
        !selectedCompareGenes.some(sg => sg.gene === g.gene)
    ).slice(0, 10);
    
        if (filteredGenes.length > 0) {
            suggestionsContainer.innerHTML = filteredGenes.map(g => `<div data-gene="${g.gene}">${g.gene}</div>`).join('');
            suggestionsContainer.style.display = 'block';
            suggestionsContainer.querySelectorAll('div').forEach(item => {
                item.addEventListener('click', () => addGeneToComparison(item.dataset.gene));
            });
        } else {
            suggestionsContainer.style.display = 'none';
        }
    }

    function addGeneToComparison(geneName) {
        if (selectedCompareGenes.length >= MAX_GENES) {
            limitMessage.style.display = 'block';
            setTimeout(() => { limitMessage.style.display = 'none'; }, 3000);
            return;
        }
        const geneToAdd = allGenes.find(g => g.gene === geneName);
        if (geneToAdd && !selectedCompareGenes.some(sg => sg.gene === geneName)) {
            selectedCompareGenes.push(geneToAdd);
            searchInput.value = '';
            suggestionsContainer.style.display = 'none';
            renderComparison();
        }
    }

    function removeGeneFromComparison(geneName) {
        selectedCompareGenes = selectedCompareGenes.filter(g => g.gene !== geneName);
        renderComparison();
    }

    function clearComparison() {
        selectedCompareGenes = [];
        renderComparison();
    }

    function renderComparison() {
        renderTags();
        if (selectedCompareGenes.length > 0) {
            outputContainer.style.display = 'block';
            placeholder.style.display = 'none';
            renderComparisonTable();
            renderFunctionalSummaries();
            renderLocalizationChart();
            setupTabSwitching();
        } else {
            outputContainer.style.display = 'none';
            placeholder.style.display = 'block';
        }
    }

    function renderTags() {
        tagsContainer.innerHTML = selectedCompareGenes.map(g => `
            <div class="gene-tag">
                ${g.gene}
                <span class="remove-tag" data-gene="${g.gene}" title="Remove ${g.gene}">&times;</span>
            </div>`).join('');
        tagsContainer.querySelectorAll('.remove-tag').forEach(tag => {
            tag.addEventListener('click', (e) => removeGeneFromComparison(e.target.dataset.gene));
        });
    }
    
    function renderComparisonTable() {
        const container = document.getElementById('comparison-table-wrapper');
        const features = ['Description', 'Ensembl ID', 'OMIM ID', 'Synonym', 'Localization', 'Functional Summary', 'Reference'];
        let tableHTML = '<table id="comparison-table"><thead><tr><th>Feature</th>';
        selectedCompareGenes.forEach(g => {
            tableHTML += `<th><a href="/${g.gene}" onclick="navigateTo(event, '/${g.gene}')">${g.gene}</a></th>`;
        });
        tableHTML += '</tr></thead><tbody>';
        
        features.forEach(feature => {
            tableHTML += `<tr><td>${feature}</td>`;
            selectedCompareGenes.forEach(gene => {
                let value = '-';
                switch(feature) {
                    case 'Description': value = gene.description || '-'; break;
                    case 'Ensembl ID': value = gene.ensembl_id ? `<a href="https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${gene.ensembl_id}" target="_blank">${gene.ensembl_id}</a>` : '-'; break;
                    case 'OMIM ID': value = gene.omim_id ? `<a href="https://www.omim.org/entry/${gene.omim_id}" target="_blank">${gene.omim_id}</a>` : '-'; break;
                    case 'Synonym': value = gene.synonym || '-'; break;
                    case 'Localization': value = gene.localization || '-'; break;
                    case 'Functional Summary': value = gene.functional_summary || '-'; break;
                    case 'Reference': value = gene.reference ? `<a href="${gene.reference}" target="_blank">View Reference</a>` : '-'; break;
                }
                tableHTML += `<td>${value}</td>`;
            });
            tableHTML += '</tr>';
        });
        tableHTML += '</tbody></table>';
        container.innerHTML = tableHTML;
    }
    
    function renderFunctionalSummaries() {
        const container = document.getElementById('functional-cards-grid');
        container.innerHTML = selectedCompareGenes.map(g => `
            <div class="function-card">
                <h4>${g.gene}</h4>
                <p>${g.functional_summary || 'No functional summary available.'}</p>
            </div>`).join('');
    }
    
    function renderLocalizationChart() {
        const ctx = document.getElementById('localization-chart').getContext('2d');
        const localizationCounts = {};
        selectedCompareGenes.forEach(gene => {
        // ✨ CHANGE IS HERE ✨
        if (Array.isArray(gene.localization)) { // Check if it's an array
            gene.localization.forEach(loc => {     // Loop directly over the array
                const term = loc.trim();
                if (term) {
                    localizationCounts[term] = (localizationCounts[term] || 0) + 1;
                }
            });
        }
    });
        
        const labels = Object.keys(localizationCounts);
        const data = Object.values(localizationCounts);

        if (localizationChartInstance) {
            localizationChartInstance.destroy();
        }

        localizationChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Number of Genes',
                    data: data,
                    backgroundColor: 'rgba(44, 90, 160, 0.7)',
                    borderColor: 'rgba(44, 90, 160, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                plugins: { legend: { display: false }, title: { display: true, text: 'Localization Distribution of Selected Genes' } }
            }
        });
    }

    function setupTabSwitching() {
        const tabLinks = document.querySelectorAll('.tab-link');
        const tabContents = document.querySelectorAll('.tab-content');
        tabLinks.forEach(link => {
            link.addEventListener('click', () => {
                tabLinks.forEach(l => l.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                link.classList.add('active');
                document.getElementById(link.dataset.tab).classList.add('active');
                if (link.dataset.tab === 'visual-analysis') {
                    renderLocalizationChart();
                }
            });
        });
    }
}

// REPLACE displayAnalysisPage() with this function
function displayEnrichmentPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    document.querySelector('.cilia-panel').style.display = 'none';
    contentArea.innerHTML = `
        <div class="page-section">
    <h2>Ciliary Gene Enrichment Analysis</h2>
    
    <p><strong>One-Click Enrichment Analysis &amp; Visualization</strong></p>
    <p>
        Upload or paste your list of genes (e.g., from a differential expression analysis or a CRISPR screen), 
        and CiliaHub will calculate how enriched your list is for known ciliary genes.
    </p>

    <h3>How it works:</h3>
    <ol>
        <li>User pastes or uploads their gene list.</li>
        <li>The tool compares it to the full ciliome (~2,000 genes) and a background set (e.g., all human genes).</li>
        <li>Results are visualized in interactive plots and downloadable tables.</li>
    </ol>

    <textarea id="enrichment-genes-input" 
        placeholder="e.g., TMEM17, IFT88, WDR31..." 
        style="width: 100%; min-height: 150px; padding: 1rem; border: 2px solid #e1ecf4; border-radius: 10px; font-size: 1rem; margin-top: 1rem; resize: vertical;">
    </textarea>
    
    <div id="enrichment-controls" style="margin-top: 1rem; display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
        <div>
           <strong>Plot Type:</strong>
            <input type="radio" id="plot-bubble" name="plot-type" value="bubble" checked>
            <label for="plot-bubble" style="margin-right: 10px;">Localization</label>
            <input type="radio" id="plot-matrix" name="plot-type" value="matrix">
            <label for="plot-matrix" style="margin-right: 10px;">Gene Matrix</label>
                        <input type="radio" id="plot-ciliome" name="plot-type" value="ciliome">
            <label for="plot-ciliome">Ciliome Enrichment</label>
        </div>
        <button id="generate-plot-btn" class="btn btn-primary">Generate Plot</button>
        <select id="download-format">
            <option value="png">PNG</option>
            <option value="pdf">PDF</option>
        </select>
        <button id="download-plot-btn" class="btn btn-secondary" style="display:none;">Download Plot</button>
    </div>
</div>
            <div style="margin-top: 20px; border: 1px solid #e1ecf4; border-radius: 5px; padding: 10px;">
                <h3 style="font-weight: bold; margin-bottom: 10px;">Plot Customization</h3>
                <p style="font-size: 0.9rem; color: #555;">Please click "Generate Plot" after making changes to apply them.</p>
                <div id="plot-settings-panel" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 10px;">
                    <div>
                        <label for="setting-font-family" style="display: block; margin-bottom: 5px;">Font Family</label>
                        <select id="setting-font-family">
                            <option value="Arial">Arial</option>
                            <option value="Tahoma">Tahoma</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Helvetica">Helvetica</option>
                            <option value="Verdana">Verdana</option>
                        </select>
                    </div>
                    <div>
                        <label for="setting-font-size" style="display: block; margin-bottom: 5px;">Label Font Size</label>
                        <input type="number" id="setting-font-size" value="20" min="8" max="30" style="width: 60px;">
                    </div>
                    <div>
                        <label for="setting-font-weight" style="display: block; margin-bottom: 5px;">Label Weight</label>
                        <select id="setting-font-weight">
                            <option value="normal">Normal</option>
                            <option value="bold" selected>Bold</option>
                            <option value="lighter">Lighter</option>
                        </select>
                    </div>
                    <div>
                        <label for="setting-text-color" style="display: block; margin-bottom: 5px;">Text Color</label>
                        <input type="color" id="setting-text-color" value="#000000">
                    </div>
                    <div>
                        <label for="setting-axis-color" style="display: block; margin-bottom: 5px;">Axis Color</label>
                        <input type="color" id="setting-axis-color" value="#000000">
                    </div>
                    <div>
                        <label for="setting-y-axis-title" style="display: block; margin-bottom: 5px;">Y Axis Title</label>
                        <input type="text" id="setting-y-axis-title" value="Localization">
                    </div>
                    <div>
                        <label for="setting-enrichment-color1" style="display: block; margin-bottom: 5px;">Enrichment Color 1 (Low)</label>
                        <input type="color" id="setting-enrichment-color1" value="#edf8fb">
                    </div>
                    <div>
                        <label for="setting-enrichment-color2" style="display: block; margin-bottom: 5px;">Enrichment Color 2</label>
                        <input type="color" id="setting-enrichment-color2" value="#b2e2e2">
                    </div>
                    <div>
                        <label for="setting-enrichment-color3" style="display: block; margin-bottom: 5px;">Enrichment Color 3</label>
                        <input type="color" id="setting-enrichment-color3" value="#66c2a4">
                    </div>
                    <div>
                        <label for="setting-enrichment-color4" style="display: block; margin-bottom: 5px;">Enrichment Color 4</label>
                        <input type="color" id="setting-enrichment-color4" value="#2ca25f">
                    </div>
                    <div>
                        <label for="setting-enrichment-color5" style="display: block; margin-bottom: 5px;">Enrichment Color 5 (High)</label>
                        <input type="color" id="setting-enrichment-color5" value="#006d2c">
                    </div>
                </div>
            </div>

            <div id="enrichment-status" class="status-message" style="display: none; padding: 1rem;"></div>
            
            <div id="plot-container" style="display:none; margin-top: 2rem;">
                <div id="bubble-enrichment-container" style="display: none; align-items: flex-start; gap: 0px;">
                    <div class="plot-wrapper" style="position: relative; height: 600px; flex-grow: 1;"><canvas id="enrichment-bubble-plot"></canvas></div>
                    <div id="legend-container" style="flex-shrink: 0; width: 150px; padding-top: 20px; padding-left: 5px;"></div>
                </div>
                <div id="matrix-plot-container" style="display: none;">
                     <div class="plot-wrapper" style="position: relative; height: 600px;"><canvas id="enrichment-matrix-plot"></canvas></div>
                </div>
                                                <div id="ciliome-plot-container" style="display: none; padding: 20px; text-align: center;"></div>
            </div>
            </div>
        </div>
    `;

    document.getElementById('generate-plot-btn').addEventListener('click', generateEnrichmentPlots);
    document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
}


function displayDownloadPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    document.querySelector('.cilia-panel').style.display = 'none';
    contentArea.innerHTML = `
        <div class="page-section">
            <h2>Download CiliaHub Data</h2>
            <p style="font-size: 1rem; color: #555;">Download the complete ciliary gene database in your preferred format.</p>
            <div class="download-options">
                <a href="https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/ciliahub_data.json" download="ciliahub_data.json" aria-label="Download JSON file">Download JSON</a>
                <button id="download-csv" class="search-btn btn btn-primary" aria-label="Download CSV file">Download CSV</button>
            </div>
            <p style="font-size: 0.9rem; color: #7f8c8d;">The JSON file contains the full dataset with all fields. The CSV file includes gene names, Ensembl IDs, descriptions, localizations, and functional summaries.</p>
        </div>`;
    
    document.getElementById('download-csv').onclick = () => {
        // ✨ FIX: Use .join() to correctly handle arrays for CSV output
        const csv = ['Gene,Ensembl ID,Description,Synonym,OMIM ID,Functional Summary,Localization,Reference']
            .concat(allGenes.map(g => `"${g.gene}","${g.ensembl_id || ''}","${g.description || ''}","${g.synonym || ''}","${g.omim_id || ''}","${g.functional_summary || ''}","${Array.isArray(g.localization) ? g.localization.join('; ') : (g.localization || '')}","${Array.isArray(g.reference) ? g.reference.join('; ') : (g.reference || '')}"`))
            .join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ciliahub_data.csv';
        a.click();
        URL.revokeObjectURL(url);
    };
}

function displayContactPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    document.querySelector('.cilia-panel').style.display = 'none';
    contentArea.innerHTML = `
        <div class="page-section">
            <h2>Contact & Cite</h2>
            <div class="contact-info">
                <h3>Contact Us</h3>
                <p style="font-size: 1rem; color: #555; margin-bottom: 1rem;">Reach out to our team for questions, collaborations, or feedback.</p>
                <ul>
                    <li><strong>Dr. Oktay I. Kaplan Lab:</strong> <a href="mailto:oktay.kaplan@agu.edu.tr">oktay.kaplan@agu.edu.tr</a></li>
                    <li><strong>Ferhan Yenisert:</strong> <a href="mailto:ferhan.yenisert@agu.edu.tr">ferhan.yenisert@agu.edu.tr</a></li>
                </ul>
                <p style="font-size: 0.9rem; color: #7f8c8d; margin-top: 1rem;">We aim to respond within 48 hours. Please include your affiliation and query details.</p>
            </div>
            <div class="cite-list">
                <h3>Cite CiliaHub</h3>
                <p style="font-size: 1rem; color: #555; margin-bottom: 1rem;">Please cite the following papers when using CiliaHub data in your research:</p>
                <ul>
                    <li>
                        Ferhan Yenisert &amp; Oktay I. Kaplan; 
                        <strong>Expanded Catalog of Gold Standard Ciliary Gene List. Integration of Novel Ciliary Genes into the Ciliome.</strong>
                        bioRxiv preprint:
                        <a href="https://www.biorxiv.org/content/10.1101/2025.08.22.671678v1"
                        target="_blank" rel="noopener noreferrer"
                        aria-label="Open bioRxiv preprint in a new tab">
                        https://www.biorxiv.org/content/10.1101/2025.08.22.671678v1
                        </a>
                    </li>
                </ul>
                <p style="font-size: 0.9rem; color: #7f8c8d; margin-top: 1rem;">The reference related to ciliary function of genes can be found on the gene specific page.</p>
            </div>
            <div class="feedback-form">
                <h3>Feedback</h3>
                <p style="font-size: 1rem; color: #555; margin-bottom: 1rem;">We value your input to improve CiliaHub.</p>
                <form id="feedback-form">
                    <label for="feedback-text" style="font-weight: 600;">Your Feedback:</label>
                    <textarea id="feedback-text" name="feedback" required aria-label="Enter your feedback"></textarea>
                    <button type="submit" class="search-btn btn btn-primary" aria-label="Submit feedback">Submit Feedback</button>
                </form>
                <div id="feedback-status" class="status-message" style="display: none;"></div>
            </div>
        </div>`;
    
    document.getElementById('feedback-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const feedback = document.getElementById('feedback-text').value;
        const statusDiv = document.getElementById('feedback-status');
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '<span>Loading...</span>';
        
        // Simulate form submission (replace with actual form submission code)
        setTimeout(() => {
            statusDiv.innerHTML = '<span class="success-message">Thank you for your feedback! It has been sent successfully.</span>';
            document.getElementById('feedback-text').value = '';
            setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
        }, 1000);
    });
}

/**
 * Displays a visually appealing and detailed page for a single gene.
 * Updated with Complex Info (CORUM), Medium Persian Blue color scheme, 
 * and adjusted layout (Identifiers/Localization/Complex Info → right, 
 * Functional Info/Category/References → left).
 */
function displayIndividualGenePage(gene) {
  const contentArea = document.querySelector('.content-area');
  contentArea.className = 'content-area max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8';
  document.querySelector('.cilia-panel').style.display = 'block';

  // --- Helper Functions ---
  const formatAsTags = (data, className = 'tag-default') => {
    if (!Array.isArray(data) || data.length === 0) return 'Not available';
    return data.map(item => `
      <span class="tag ${className} inline-block bg-[#e6f0f7] text-[#0067A5] text-sm font-medium px-2.5 py-0.5 rounded-full mr-2 mb-2">
        ${item}
      </span>
    `).join('');
  };

  const formatReferences = (gene) => {
    if (!gene.reference || !Array.isArray(gene.reference) || gene.reference.length === 0) {
      return '<li class="text-[#0067A5]">No reference information available.</li>';
    }
    const allRefs = gene.reference
      .flatMap(item => String(item).split(/[,;]\s*/))
      .map(s => s.trim())
      .filter(Boolean);
    if (allRefs.length === 0) return '<li class="text-[#0067A5]">No reference information available.</li>';

    return allRefs.map(ref => {
      if (/^\d+$/.test(ref)) {
        return `<li><a href="https://pubmed.ncbi.nlm.nih.gov/${ref}" target="_blank" class="text-[#0067A5] hover:underline">PMID: ${ref}</a></li>`;
      }
      if (ref.toLowerCase().includes('proteinatlas.org')) {
        return `<li><a href="https://www.proteinatlas.org/${gene.ensembl_id}" target="_blank" class="text-[#0067A5] hover:underline">Human Protein Atlas</a></li>`;
      }
      if (ref.toLowerCase().startsWith('http')) {
        return `<li><a href="${ref}" target="_blank" class="text-[#0067A5] hover:underline">${ref}</a></li>`;
      }
      return `<li class="text-[#0067A5]">${ref}</li>`;
    }).join('');
  };

  // Prepare data
  const localizationTags = formatAsTags(gene.localization, 'tag-localization');
  const functionalCategoryTags = formatAsTags(gene.functional_category, 'tag-category');
  const referenceHTML = formatReferences(gene);

  // --- Main Template ---
  contentArea.innerHTML = `
    <div class="page-section gene-detail-page bg-white shadow-lg rounded-lg overflow-hidden">
      <!-- Breadcrumb -->
      <div class="breadcrumb px-6 py-4 bg-[#e6f0f7] border-b border-[#c2d9e6]">
        <a href="/" onclick="navigateTo(event, '/')" aria-label="Back to Home" class="text-[#0067A5] hover:underline text-sm font-medium">← Back to Home</a>
      </div>

      <!-- Header -->
      <header class="gene-header px-6 py-8 bg-gradient-to-r from-[#e6f0f7] to-white">
        <h1 class="gene-name text-3xl font-bold text-[#0067A5] mb-2">${gene.gene}</h1>
        <p class="gene-description text-[#0067A5] text-lg">${gene.description || 'No description available.'}</p>
      </header>

      <!-- Gene Details Grid -->
      <div class="gene-details-grid grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        <!-- Left Column -->
        <div class="details-column space-y-6">
          <!-- Functional Info -->
          <div class="detail-card bg-white border border-[#c2d9e6] rounded-lg p-6 shadow-sm">
            <h3 class="card-title text-xl font-semibold text-[#0067A5] mb-4">Functional Information</h3>
            <div class="info-item mb-3">
              <strong class="font-medium text-[#0067A5]">Functional Summary:</strong>
              <p class="text-[#0067A5]">${gene.functional_summary || 'Not available.'}</p>
            </div>
            <div class="info-item mb-3">
              <strong class="font-medium text-[#0067A5]">Functional Category:</strong>
              <div class="tags-container">${functionalCategoryTags}</div>
            </div>
            ${gene.ciliopathy ? `<div class="info-item"><strong class="font-medium text-[#0067A5]">Associated Ciliopathy:</strong> <p class="text-[#0067A5]">${gene.ciliopathy}</p></div>` : ''}
            ${gene.gene_annotation ? `<div class="info-item"><strong class="font-medium text-[#0067A5]">Gene Annotation:</strong> <p class="text-[#0067A5]">${gene.gene_annotation}</p></div>` : ''}
          </div>

          <!-- References -->
          <div class="detail-card bg-white border border-[#c2d9e6] rounded-lg p-6 shadow-sm">
            <h3 class="card-title text-xl font-semibold text-[#0067A5] mb-4">References</h3>
            <ul class="reference-list list-disc pl-5 text-[#0067A5]">${referenceHTML}</ul>
          </div>
        </div>

        <!-- Right Column -->
        <div class="details-column space-y-6">
          <!-- Identifiers -->
          <div class="detail-card bg-white border border-[#c2d9e6] rounded-lg p-6 shadow-sm">
            <h3 class="card-title text-xl font-semibold text-[#0067A5] mb-4">Identifiers</h3>
            <div class="space-y-3">
              ${gene.ensembl_id ? `<div><strong class="text-[#0067A5]">Ensembl ID:</strong> <a href="https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${gene.ensembl_id}" target="_blank" class="text-[#0067A5] hover:underline">${gene.ensembl_id}</a></div>` : ''}
              ${gene.omim_id ? `<div><strong class="text-[#0067A5]">OMIM ID:</strong> <a href="https://www.omim.org/entry/${gene.omim_id}" target="_blank" class="text-[#0067A5] hover:underline">${gene.omim_id}</a></div>` : ''}
              ${gene.synonym ? `<div><strong class="text-[#0067A5]">Synonym(s):</strong> <span class="text-[#0067A5]">${gene.synonym}</span></div>` : ''}
            </div>
          </div>

          <!-- Subcellular Localization -->
          <div class="detail-card bg-white border border-[#c2d9e6] rounded-lg p-6 shadow-sm">
            <h3 class="card-title text-xl font-semibold text-[#0067A5] mb-4">Subcellular Localization</h3>
            <div class="tags-container">${localizationTags}</div>
          </div>

          <!-- Complex Info -->
          ${gene.complex_names ? `
            <div class="detail-card bg-white border border-[#c2d9e6] rounded-lg p-6 shadow-sm">
              <h3 class="card-title text-xl font-semibold text-[#0067A5] mb-4">
                Complex Info 
                <a href="https://mips.helmholtz-muenchen.de/corum/" target="_blank" class="ml-2 text-sm text-[#0067A5] hover:underline">(Source: CORUM)</a>
              </h3>
              <div class="mb-3">
                <strong class="text-[#0067A5]">Complex Names:</strong>
                <p class="text-[#0067A5]">${gene.complex_names.replace(/; /g, '<br>')}</p>
              </div>
              <div>
                <strong class="text-[#0067A5]">Complex Components:</strong>
                <p class="text-[#0067A5]">${gene.complex_components.replace(/ \| /g, '<br>')}</p>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  updateGeneButtons([gene], [gene]);
  showLocalization(gene.gene, true);
}


function displayNotFoundPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    document.querySelector('.cilia-panel').style.display = 'none';
    contentArea.innerHTML = `
        <div class="page-section status-message">
            <h2>404 - Gene Not Found</h2>
            <p style="font-size: 1rem; color: #555;">The requested gene was not found in our database.</p>
            <a href="/" onclick="navigateTo(event, '/')" style="display: inline-block; padding: 1rem 2rem; background: #2c5aa0; color: white; text-decoration: none; border-radius: 10px; margin-top: 1rem;" aria-label="Back to Home">Back to Home</a>
        </div>`;
}

function performSingleSearch() {
    const query = document.getElementById('single-gene-search').value.trim().toUpperCase();
    const statusDiv = document.getElementById('status-message');
    statusDiv.innerHTML = '<span>Loading...</span>';
    statusDiv.style.display = 'block';

    if (!query) {
        statusDiv.innerHTML = `<span class="error-message">Please enter a gene name.</span>`;
        return;
    }

    const results = allGenes.filter(g => {
        // Use sanitized gene field directly, no need for replace(/\s/g, '')
        if (g.gene && g.gene.toUpperCase().includes(query)) {
            return true;
        }
        if (g.synonym) {
            const synonyms = g.synonym.toUpperCase().split(',').map(s => s.trim());
            if (synonyms.includes(query)) {
                return true;
            }
        }
        return false;
    });

    if (results.length === 0) {
        const closeMatches = allGenes.filter(g =>
            g.gene && g.gene.toUpperCase().startsWith(query.slice(0, 3))
        ).slice(0, 3);

        statusDiv.innerHTML = `<span class="error-message">No genes found for "${query}". ${closeMatches.length > 0 ? 'Did you mean: ' + closeMatches.map(g => g.gene).join(', ') + '?' : 'No close matches found.'}</span>`;
        return;
    }

    if (results.length === 1 && results[0].gene.toUpperCase() === query) {
        navigateTo(null, `/${results[0].gene}`);
    } else {
        navigateTo(null, '/batch-query');
        setTimeout(() => {
            document.getElementById('batch-genes-input').value = results.map(r => r.gene).join('\n');
            performBatchSearch();
        }, 100);
    }
}

function performBatchSearch() {
    const queries = document.getElementById('batch-genes-input').value
        .split(/[\s,\n]+/)
        .filter(Boolean)
        .map(q => q.trim().toUpperCase());
    const localizationFilter = document.getElementById('localization-filter')?.value;
    const keywordFilter = document.getElementById('keyword-filter')?.value.toLowerCase();
    const statusDiv = document.getElementById('status-message');

    if (queries.length === 0) {
        statusDiv.innerHTML = `<span class="error-message">Please enter at least one gene name.</span>`;
        statusDiv.style.display = 'block';
        return;
    }

    let results = allGenes.filter(g =>
        queries.some(q => {
            // Use sanitized gene field directly, no need for replace(/\s/g, '')
            if (g.gene && g.gene.toUpperCase() === q) {
                return true;
            }
            if (g.synonym) {
                const synonyms = g.synonym.toUpperCase().split(',').map(s => s.trim());
                if (synonyms.includes(q)) {
                    return true;
                }
            }
            return false;
        })
    );

    if (localizationFilter) {
        results = results.filter(g => g.localization && g.localization.includes(localizationFilter));
    }

    if (keywordFilter) {
        results = results.filter(g =>
            (g.functional_summary && g.functional_summary.toLowerCase().includes(keywordFilter)) ||
            (g.description && g.description.toLowerCase().includes(keywordFilter))
        );
    }

    statusDiv.style.display = 'none';
    searchResults = results;

    if (results.length > 0) {
        displayBatchResults(results);
        displayGeneCards(currentData, results, 1, 10);
    } else {
        statusDiv.innerHTML = `<span class="error-message">No genes found matching your query.</span>`;
        statusDiv.style.display = 'block';
        displayGeneCards(currentData, [], 1, 10);
    }
}

function displayBatchResults(results) {
    const batchResults = document.getElementById('batch-results');
    if (!batchResults) return;
    
    if (results.length === 0) {
        batchResults.innerHTML = '<p class="error-message">No matching genes found</p>';
        return;
    }
    
    let html = `
        <h3>Search Results (${results.length} genes found)</h3>
        <table>
            <tr>
                <th>Gene</th>
                <th>Ensembl ID</th>
                <th>Localization</th>
                <th>Function Summary</th>
            </tr>`;
    
    results.forEach(item => {
        html += `<tr>
            <td><a href="/${item.gene}" onclick="navigateTo(event, '/${item.gene}')">${item.gene}</a></td>
            <td>${item.ensembl_id || '-'}</td>
            <td>${item.localization || '-'}</td>
            <td>${item.functional_summary ? item.functional_summary.substring(0, 100) + '...' : '-'}</td>
        </tr>`;
    });
    
    html += '</table>';
    batchResults.innerHTML = html;
}

function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const genes = text.split(/[\n,]+/).map(g => g.trim()).filter(Boolean);
        const input = document.getElementById('batch-genes-input');
        input.value += (input.value ? '\n' : '') + genes.join('\n');
    };
    reader.readAsText(file);
}

function displayGeneCards(defaults, searchResults, page = 1, perPage = 10) {
    const container = document.getElementById('gene-cards-container');
    if (!container) return;

    let uniqueDefaults = defaults.filter(d => !searchResults.some(s => s.gene === d.gene));
    let allGenesToDisplay = [...searchResults, ...uniqueDefaults];

    // ✨ FIX IS HERE: If no genes are provided for the homepage, proactively get the default set.
    if (allGenesToDisplay.length === 0 && searchResults.length === 0) {
        allGenesToDisplay = allGenes.filter(g => defaultGenesNames.includes(g.gene));
    }
    // End of fix

    const start = (page - 1) * perPage;
    const end = start + perPage;
    const paginatedGenes = allGenesToDisplay.slice(start, end);
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const gene = JSON.parse(entry.target.dataset.gene);
                const isSearchResult = searchResults.some(s => s.gene === gene.gene);
                const localizationText = Array.isArray(gene.localization) ? gene.localization.join(', ') : (gene.localization || '');

                entry.target.innerHTML = `
                    <div class="gene-name">${gene.gene}</div>
                    <div class="gene-description">${gene.description || 'No description available.'}</div>
                    ${localizationText ? `
                        <div class="gene-info">
                            <strong>Localization:</strong> 
                            <span style="color: ${isSearchResult ? '#27ae60' : '#1e90ff'}; font-weight: 600;">
                                ${localizationText}
                            </span>
                        </div>` : ''}
                    ${gene.ensembl_id ? `
                        <div class="gene-info"><strong>Ensembl:</strong> 
                            <a href="https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${gene.ensembl_id}" target="_blank">
                                ${gene.ensembl_id}
                            </a>
                        </div>` : ''}
                    ${gene.omim_id ? `
                        <div class="gene-info"><strong>OMIM:</strong> 
                            <a href="https://www.omim.org/entry/${gene.omim_id}" target="_blank">${gene.omim_id}</a>
                        </div>` : ''}
                    ${gene.synonym ? `<div class="gene-info"><strong>Synonym:</strong> ${gene.synonym}</div>` : ''}
                    <div style="margin-top: 1rem; padding: 0.5rem; background: ${isSearchResult ? '#d5f4e6' : '#e8f4fd'}; 
                            border-radius: 5px; font-size: 0.9rem; color: ${isSearchResult ? '#27ae60' : '#1e90ff'};">
                        Click to view detailed information →
                    </div>
                `;
                
                entry.target.classList.add(isSearchResult ? 'search-result' : 'default');
                entry.target.onclick = (e) => navigateTo(e, `/${gene.gene}`);
                entry.target.setAttribute('aria-label', `View details for ${gene.gene}`);
                observer.unobserve(entry.target);
            }
        });
    }, { rootMargin: '100px' });
    
    container.innerHTML = paginatedGenes.map(gene => `
        <div class="gene-card" data-gene='${JSON.stringify(gene)}'></div>
    `).join('');
    
    container.querySelectorAll('.gene-card').forEach(card => observer.observe(card));
    
    const paginationDiv = document.createElement('div');
    paginationDiv.className = 'pagination';
    
    // Stringify the data once to prevent issues in the onclick attribute
    const defaultsStr = JSON.stringify(defaults);
    const searchResultsStr = JSON.stringify(searchResults);
    
    paginationDiv.innerHTML = `
        <button onclick='displayGeneCards(${defaultsStr}, ${searchResultsStr}, ${page - 1}, ${perPage})' ${page === 1 ? 'disabled' : ''}>Previous</button>
        <span>Page ${page} of ${Math.ceil(allGenesToDisplay.length / perPage)}</span>
        <button onclick='displayGeneCards(${defaultsStr}, ${searchResultsStr}, ${page + 1}, ${perPage})' ${end >= allGenesToDisplay.length ? 'disabled' : ''}>Next</button>
    `;
    if (allGenesToDisplay.length > perPage) {
        container.appendChild(paginationDiv);
    }
    
    updateGeneButtons(allGenesToDisplay, searchResults);
}

function updateGeneButtons(genesToDisplay, searchResults = []) {
    const container = document.getElementById('geneButtons');
    if (!container) return;
    
    container.innerHTML = '';
    
    const defaultGenesButtons = defaultGenesNames
        .map(geneName => genesToDisplay.find(g => g.gene === geneName))
        .filter(Boolean);
        
    const searchGenes = searchResults
        .map(s => genesToDisplay.find(g => g.gene === s.gene))
        .filter(g => g && !defaultGenesNames.includes(g.gene));
        
    const genesToShow = [...defaultGenesButtons, ...searchGenes].slice(0, 10);
    
    genesToShow.forEach(gene => {
        if (geneLocalizationData[gene.gene]) {
            const isSearch = searchResults.some(s => s.gene === gene.gene);
            const button = document.createElement('button');
            button.className = `gene-btn ${isSearch ? 'search-gene' : 'default'}`;
            button.textContent = gene.gene;
            button.setAttribute('aria-label', `Highlight localization of ${gene.gene} in the cilium diagram`);
            button.onclick = () => showLocalization(gene.gene, isSearch);
            container.appendChild(button);
        }
    });
    
    const resetButton = document.createElement('button');
    resetButton.className = 'gene-btn reset-btn';
    resetButton.textContent = 'Reset Diagram';
    resetButton.setAttribute('aria-label', 'Reset cilia diagram');
    resetButton.onclick = () => showLocalization('reset');
    container.appendChild(resetButton);
}

let selectedGenes = [];
function showLocalization(geneName, isSearchGene = false) {
    if (geneName === 'reset') {
        selectedGenes = [];
    } else {
        if (!selectedGenes.includes(geneName)) {
            selectedGenes.push(geneName);
        } else {
            selectedGenes = selectedGenes.filter(g => g !== geneName);
        }
    }
    
    const ciliaParts = document.querySelectorAll('.cilia-part');
    ciliaParts.forEach(part => part.classList.remove('highlighted', 'search-gene', 'cilia'));
    
    document.querySelectorAll('.gene-btn').forEach(btn => btn.classList.remove('selected'));
    
    selectedGenes.forEach(g => {
        if (geneLocalizationData[g]) {
            const isCiliary = geneLocalizationData[g].some(id => ['ciliary-membrane', 'axoneme'].includes(id));
            
            geneLocalizationData[g].forEach(id => {
                const el = document.getElementById(id);
                if (el && id !== 'cell-body') {
                    el.classList.add('highlighted');
                    if (isCiliary) {
                        el.classList.add('cilia');
                    } else if (isSearchGene) {
                        el.classList.add('search-gene');
                    }
                }
            });
        }
        
        const btn = [...document.querySelectorAll('.gene-btn')].find(b => b.textContent === g);
        if (btn) btn.classList.add('selected');
    });
}

function updateActiveNav(path) {
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        const linkPath = link.getAttribute('href').toLowerCase();
        
        if (linkPath === path || 
            (path.startsWith('/') && path !== '/' && path !== '/index.html' && 
             linkPath === '/batch-query' && !['/download', '/contact', '/compare', '/expression', '/enrichment'].includes(path))) {
            link.classList.add('active');
        }
    });
}

function handleStickySearch() {
    const searchContainer = document.querySelector('.search-container');
    if (searchContainer && window.scrollY > 100) {
        searchContainer.classList.add('sticky');
    } else if (searchContainer) {
        searchContainer.classList.remove('sticky');
    }
}

function displayLocalizationChart() {
    const categories = ['Cilia', 'Basal Body', 'Transition Zone', 'Flagella', 'Ciliary Associated Gene'];
    const localizationCounts = categories.reduce((acc, category) => {
        acc[category] = allGenes.filter(g => {
            // ✨ FIX: Check if g.localization is an array before processing
            if (!Array.isArray(g.localization)) return false;
            
            const localizations = g.localization.map(l => l.trim().toLowerCase());
            return localizations.includes(category.toLowerCase()) ||
                  (category === 'Cilia' && localizations.includes('ciliary membrane')) ||
                  (category === 'Flagella' && localizations.includes('axoneme')) ||
                  (category === 'Ciliary Associated Gene' && localizations.includes('ciliary associated gene'));
        }).length;
        return acc;
    }, {});
    
    const chartContainer = document.createElement('div');
    chartContainer.className = 'page-section';
    chartContainer.innerHTML = `<h2>Gene Localization Distribution</h2><canvas id="locChart" style="max-height: 300px;"></canvas>`;
    
    const contentArea = document.querySelector('.content-area');
    const existingChart = contentArea.querySelector('#locChart');
    if (existingChart) existingChart.parentElement.remove();
    
    contentArea.appendChild(chartContainer);
    
    const ctx = document.getElementById('locChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: categories,
            datasets: [{
                label: 'Number of Genes',
                data: categories.map(category => localizationCounts[category] || 0),
                backgroundColor: ['#005566', '#66C2A5', '#D81B60', '#FF7F00', '#6BAED6'],
                borderColor: ['#005566', '#66C2A5', '#D81B60', '#FF7F00', '#6BAED6'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true, 
                    title: { display: true, text: 'Number of Genes' },
                    ticks: { stepSize: 1 }
                },
                x: { 
                    title: { display: true, text: 'Localization' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.raw} genes`;
                        }
                    }
                }
            }
        }
    });
}

// --- Expression Visualization System ---
let expressionData = {};
let availableGenes = new Set();
const organCache = new Map();

async function initExpressionSystem() {
    try {
        if (Object.keys(expressionData).length === 0) {
            await loadExpressionData();
        }
        setupExpressionEventListeners();
        await loadSVGFile();
        prepareOrgansForExpression();
        console.log('Expression system initialized successfully');
    } catch (error) {
        console.error('Failed to initialize expression system:', error);
    }
}

async function loadExpressionData() {
    try {
        const response = await fetch('rna_tissue_consensus.tsv');
        if (!response.ok) throw new Error('Failed to load expression data');

        const tsvText = await response.text();
        const rawData = parseTSV(tsvText);
        expressionData = processExpressionData(rawData);

        const geneSet = new Set();
        Object.keys(expressionData).forEach(gene => {
            geneSet.add(gene); // Gene names are now already uppercase
        });
        availableGenes = geneSet;

        console.log(`Loaded ${Object.keys(expressionData).length} genes with expression data from TSV`);
    } catch (error) {
        console.error('Error loading expression data:', error);
    }
}

function parseTSV(tsvText) {
    const lines = tsvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split('\t');
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('\t');
        if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index] ? values[index].trim() : '';
            });
            data.push(row);
        }
    }
    return data;
}

function processExpressionData(rawData) {
    const processedData = {};
    rawData.forEach(row => {
        const geneName = row['Gene name'] || row['Gene'];
        if (geneName) {
            const upperGeneName = geneName.toUpperCase(); // Standardize to uppercase
            const tissue = row['Tissue'];
            const nTPM = parseFloat(row['nTPM']);

            if (tissue && !isNaN(nTPM)) {
                if (!processedData[upperGeneName]) {
                    processedData[upperGeneName] = {};
                }
                processedData[upperGeneName][tissue] = nTPM;
            }
        }
    });
    return processedData;
}

function setupExpressionEventListeners() {
    const searchInput = document.getElementById('gene-search');
    const suggestionsDiv = document.getElementById('suggestions');
    const resetButton = document.getElementById('reset-organs-btn');

    if (!searchInput || !suggestionsDiv || !resetButton) return;

    searchInput.addEventListener('input', handleExpressionSearchInput);
    searchInput.addEventListener('focus', () => showExpressionSuggestions());
    searchInput.addEventListener('blur', () => {
        setTimeout(() => suggestionsDiv.style.display = 'none', 200);
    });
    resetButton.addEventListener('click', resetOrganSelection);

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
            suggestionsDiv.style.display = 'none';
        }
    });
}

let searchTimeout;
function handleExpressionSearchInput(e) {
    const query = e.target.value.trim().toUpperCase();
    if (query.length < 2) {
        hideExpressionSuggestions();
        return;
    }
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const suggestions = getExpressionGeneSuggestions(query);
        showExpressionSuggestions(suggestions);
    }, 150);
}

function getExpressionGeneSuggestions(query) {
    const suggestions = [];
    const queryUpper = query.toUpperCase();
    const allGeneNames = [...availableGenes];

    for (const gene of allGeneNames) {
        if (gene.startsWith(queryUpper)) {
            suggestions.push(gene);
            if (suggestions.length >= 10) break;
        }
    }
    return suggestions;
}

function showExpressionSuggestions(suggestions = null) {
    const suggestionsDiv = document.getElementById('suggestions');
    if (!suggestionsDiv || !suggestions || suggestions.length === 0) {
        if (suggestionsDiv) suggestionsDiv.style.display = 'none';
        return;
    }

    suggestionsDiv.innerHTML = suggestions.map(gene => `
        <div class="suggestion-item" onclick="selectExpressionGene('${gene}')">
            <div class="suggestion-gene">${gene}</div>
        </div>
    `).join('');
    suggestionsDiv.style.display = 'block';
}

function hideExpressionSuggestions() {
    const suggestionsDiv = document.getElementById('suggestions');
    if (suggestionsDiv) suggestionsDiv.style.display = 'none';
}

function selectExpressionGene(geneName) {
    const searchInput = document.getElementById('gene-search');
    if (searchInput) searchInput.value = geneName;
    hideExpressionSuggestions();
    showExpressionGeneInfo(geneName);
    updateExpressionVisualization(geneName);
    updateExpressionTable(geneName);
}

function showExpressionGeneInfo(geneName) {
    const geneDetailsDiv = document.getElementById('gene-details');
    const selectedGeneInfoDiv = document.getElementById('selected-gene-info');

    if (geneDetailsDiv && selectedGeneInfoDiv) {
        const geneExpression = expressionData[geneName] || {};
        const tissueCount = Object.keys(geneExpression).length;
        const geneInfo = allGenes.find(g => g.gene === geneName);

        geneDetailsDiv.innerHTML = `
            <div style="margin-bottom: 1rem;"><strong>Gene:</strong> ${geneName}</div>
            <div style="margin-bottom: 1rem;"><strong>Expression Data:</strong> Available in ${tissueCount} tissues</div>
            ${geneInfo?.description ? `<div style="margin-bottom: 1rem;"><strong>Description:</strong> ${geneInfo.description}</div>` : ''}
        `;
        selectedGeneInfoDiv.style.display = 'block';
    }
}

function updateExpressionVisualization(geneName) {
    const organs = document.querySelectorAll('.organ');
    organs.forEach(organ => {
        const originalColor = organ.getAttribute('data-original-color');
        if (originalColor) organ.setAttribute('fill', originalColor);
        organ.style.filter = 'brightness(1)';
    });

    const geneExpression = findGeneExpression(geneName);
    if (geneExpression) {
        Object.entries(geneExpression).forEach(([tissue, nTPM]) => {
            const organElement = findOrganElement(tissue);
            if (organElement) {
                organElement.setAttribute('fill', getExpressionColor(nTPM));
            }
        });
    }
}

function findGeneExpression(geneName) {
    if (!expressionData || !geneName) return null;
    return expressionData[geneName] || null;
}

function findOrganElement(tissueName) {
    if (organCache.has(tissueName)) return organCache.get(tissueName);

    const organs = document.querySelectorAll('.organ');
    const tissueLower = tissueName.toLowerCase();

    for (let organ of organs) {
        const tissue = organ.getAttribute('data-tissue');
        if (tissue && tissueLower === tissue.toLowerCase()) {
            organCache.set(tissueName, organ);
            return organ;
        }
    }
    organCache.set(tissueName, null);
    return null;
}

function getExpressionColor(nTPM) {
    if (nTPM <= 5) return '#A8E6A1';
    if (nTPM <= 15) return '#6CC96C';
    if (nTPM <= 30) return '#3FAF3F';
    return '#1E7B1E';
}

function updateExpressionTable(geneName) {
    const tableWrapper = document.getElementById('expression-table-wrapper');
    if (!tableWrapper) return;

    const geneExpression = findGeneExpression(geneName);
    if (!geneExpression || Object.keys(geneExpression).length === 0) {
        tableWrapper.innerHTML = '<div style="text-align: center; padding: 2rem; color: #666; font-style: italic;">No expression data available for this gene</div>';
        return;
    }

    const sortedTissues = Object.entries(geneExpression).sort(([,a], [,b]) => b - a);

    const tableHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
            <thead>
                <tr>
                    <th style="padding: 0.8rem; text-align: left; border-bottom: 1px solid #e1ecf4; background: #2c5aa0; color: white;">Tissue</th>
                    <th style="padding: 0.8rem; text-align: left; border-bottom: 1px solid #e1ecf4; background: #2c5aa0; color: white;">nTPM</th>
                    <th style="padding: 0.8rem; text-align: left; border-bottom: 1px solid #e1ecf4; background: #2c5aa0; color: white;">Level</th>
                </tr>
            </thead>
            <tbody>
                ${sortedTissues.map(([tissue, nTPM]) => `
                    <tr>
                        <td style="padding: 0.8rem; border-bottom: 1px solid #e1ecf4;">${tissue}</td>
                        <td style="padding: 0.8rem; border-bottom: 1px solid #e1ecf4;">${nTPM.toFixed(2)}</td>
                        <td style="padding: 0.8rem; border-bottom: 1px solid #e1ecf4;">${getExpressionLevel(nTPM)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
    tableWrapper.innerHTML = tableHTML;
}

function getExpressionLevel(nTPM) {
    if (nTPM <= 5) return 'Low';
    if (nTPM <= 15) return 'Medium';
    if (nTPM <= 30) return 'High';
    return 'Very High';
}

function handleOrganClick(tissueName) {
    highlightClickedOrgan(tissueName);
    displayTissueExpressionData(tissueName);
}

function highlightClickedOrgan(tissueName) {
    const organs = document.querySelectorAll('.organ');
    organs.forEach(organ => {
        organ.style.stroke = organ.getAttribute('data-tissue') === tissueName ? '#e74c3c' : '#2c5aa0';
        organ.style.strokeWidth = organ.getAttribute('data-tissue') === tissueName ? '3' : '2';
    });
}

function displayTiceExpressionData(tissueName) {
    const tableWrapper = document.getElementById('expression-table-wrapper');
    if (!tableWrapper) return;

    const tissueExpressionData = [];
    Object.entries(expressionData).forEach(([geneName, tissueData]) => {
        if (tissueData[tissueName] !== undefined) {
            tissueExpressionData.push({ gene: geneName, nTPM: tissueData[tissueName] });
        }
    });

    tissueExpressionData.sort((a, b) => b.nTPM - a.nTPM);

    if (tissueExpressionData.length === 0) {
        tableWrapper.innerHTML = `<div style="text-align: center; padding: 2rem; color: #666;">No expression data for ${tissueName}</div>`;
        return;
    }

    const tableHTML = `
        <h5 style="color: #2c5aa0; margin-bottom: 1rem;">Top Expressed Genes in ${tissueName}</h5>
        <table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
            <thead>
                <tr>
                    <th style="padding: 0.8rem; text-align: left; border-bottom: 1px solid #e1ecf4; background: #2c5aa0; color: white;">Gene</th>
                    <th style="padding: 0.8rem; text-align: left; border-bottom: 1px solid #e1ecf4; background: #2c5aa0; color: white;">nTPM</th>
                </tr>
            </thead>
            <tbody>
                ${tissueExpressionData.slice(0, 50).map(item => `
                    <tr style="cursor: pointer;" onclick="selectExpressionGene('${item.gene}')">
                        <td style="padding: 0.8rem; border-bottom: 1px solid #e1ecf4;">${item.gene}</td>
                        <td style="padding: 0.8rem; border-bottom: 1px solid #e1ecf4;">${item.nTPM.toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
    tableWrapper.innerHTML = tableHTML;
}

function resetOrganSelection() {
    const organs = document.querySelectorAll('.organ');
    organs.forEach(organ => {
        const originalColor = organ.getAttribute('data-original-color');
        if (originalColor) organ.setAttribute('fill', originalColor);
        organ.style.stroke = '#2c5aa0';
        organ.style.strokeWidth = '2';
    });
    const tableWrapper = document.getElementById('expression-table-wrapper');
    if (tableWrapper) {
        tableWrapper.innerHTML = `<div style="text-align: center; padding: 2rem; color: #666;">Click an organ or search for a gene.</div>`;
    }
    const selectedGeneInfoDiv = document.getElementById('selected-gene-info');
    if (selectedGeneInfoDiv) selectedGeneInfoDiv.style.display = 'none';
    const searchInput = document.getElementById('gene-search');
    if (searchInput) searchInput.value = '';
}

async function loadSVGFile() {
    try {
        const response = await fetch('file.svg');
        if (!response.ok) throw new Error('Failed to load SVG file');
        const svgText = await response.text();
        const container = document.getElementById('svg-container');
        if (container) container.innerHTML = svgText;
    } catch (error) {
        console.error('Error loading SVG file:', error);
    }
}

function prepareOrgansForExpression() {
    organCache.clear(); // <-- THE FIX: Clear stale cache before setting up the SVG.
    const organMappings = [
        { tissue: 'cerebral cortex', selector: 'path[fill="#BE0405"]' },
        { tissue: 'heart muscle', selector: 'path[fill="#F07070"]' },
        { tissue: 'lung', selector: 'path[fill="#F6A2A0"]' },
        { tissue: 'liver', selector: 'path[fill="#F8A19F"]' },
        { tissue: 'stomach', selector: 'path[fill="#FDE098"]' },
        { tissue: 'kidney', selector: 'path[fill="#EA8F8E"]' },
        { tissue: 'colon', selector: 'path[fill="#C07F54"]' },
        { tissue: 'testis', selector: 'path[fill="#E49BDC"]' },
    ];

    const svg = document.querySelector('#svg-container svg');
    if (!svg) return;

    organMappings.forEach(mapping => {
        const pathElements = svg.querySelectorAll(mapping.selector);
        pathElements.forEach(path => {
            path.classList.add('organ');
            path.setAttribute('data-tissue', mapping.tissue);
            path.setAttribute('data-original-color', path.getAttribute('fill'));
            path.style.cursor = 'pointer';
            path.style.transition = 'all 0.3s ease';
            path.addEventListener('mouseenter', () => path.style.filter = 'brightness(1.2)');
            path.addEventListener('mouseleave', () => path.style.filter = 'brightness(1)');
            path.addEventListener('click', () => handleOrganClick(mapping.tissue));
        });
    });
}

function displayExpressionPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    document.querySelector('.cilia-panel').style.display = 'none';
    contentArea.innerHTML = `
        <div class="page-section">
            <div style="text-align: center; margin-bottom: 2rem;">
                <h1 style="color: #2c5aa0; margin-bottom: 1rem;">Gene Expression Visualization</h1>
                <p style="color: #555; font-size: 1.1rem;">Explore tissue-specific gene expression patterns across human organs and tissues.</p>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 2rem; align-items: start;">
                <div style="background: white; padding: 2rem; border-radius: 15px; box-shadow: 0 8px 32px rgba(44, 90, 160, 0.1); height: fit-content; position: relative;">
                    <h3 style="color: #2c5aa0; margin-bottom: 1.5rem; font-size: 1.3rem;">Gene Search</h3>
                    <div style="margin-bottom: 1.5rem;">
                        <input type="text" id="gene-search" style="width: 100%; padding: 1rem; border: 2px solid #e1ecf4; border-radius: 10px; font-size: 1rem; margin-bottom: 1rem;" placeholder="Search for a gene (e.g., ARL13B, IFT88)" autocomplete="off">
                        <div id="suggestions"></div>
                    </div>
                    <div id="selected-gene-info" style="display: none;">
                        <h4 style="color: #2c5aa0; margin-bottom: 1rem;">Selected Gene</h4>
                        <div id="gene-details"></div>
                    </div>
                </div>
                <div style="background: white; padding: 2rem; border-radius: 15px; box-shadow: 0 8px 32px rgba(44, 90, 160, 0.1);">
                    <h3 style="color: #2c5aa0; margin-bottom: 1.5rem; font-size: 1.3rem;">Expression Visualization</h3>
                    <div style="text-align: center; margin-bottom: 2rem;">
                        <div id="svg-container" style="max-width: 100%; height: auto;">
                            <div style="text-align: center; padding: 2rem; color: #666;">
                                <p>Loading human body visualization...</p>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: center; gap: 1rem; margin: 1.5rem 0; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;"><div style="width: 20px; height: 20px; border-radius: 4px; border: 1px solid #ccc; background-color: #A8E6A1;"></div><span>Low (0-5 nTPM)</span></div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;"><div style="width: 20px; height: 20px; border-radius: 4px; border: 1px solid #ccc; background-color: #6CC96C;"></div><span>Medium (5-15 nTPM)</span></div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;"><div style="width: 20px; height: 20px; border-radius: 4px; border: 1px solid #ccc; background-color: #3FAF3F;"></div><span>High (15-30 nTPM)</span></div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;"><div style="width: 20px; height: 20px; border-radius: 4px; border: 1px solid #ccc; background-color: #1E7B1E;"></div><span>Very High (>30 nTPM)</span></div>
                    </div>
                    <div style="margin-top: 2rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h4 style="color: #2c5aa0; margin: 0;">Expression Data Table</h4>
                            <button id="reset-organs-btn" style="padding: 0.5rem 1rem; background: #95a5a6; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 0.9rem;">Reset Organ Selection</button>
                        </div>
                        <div id="expression-table-wrapper">
                            <div style="text-align: center; padding: 2rem; color: #666; font-style: italic;">Click on an organ to see its gene expression data, or search for a specific gene</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    // Initialize all interactive elements for the Expression page
    initExpressionSystem();
}

window.navigateTo = function(event, path) {
    if (event) event.preventDefault();
    window.location.hash = path;
    handleRouteChange();
};

window.addEventListener('hashchange', handleRouteChange);
document.addEventListener('DOMContentLoaded', () => {
    initGlobalEventListeners();
    handleRouteChange();
});
