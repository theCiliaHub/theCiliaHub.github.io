
// ✨ THE NEW PLUGIN CODE RIGHT HERE for PLOT ✨
Chart.register({
  id: 'customCanvasBackgroundColor',
  beforeDraw: (chart, args, options) => {
    const {ctx} = chart;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = options.color || '#ffffff'; // White background
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  }
});


/**
 * Sanitizes any string by removing invisible characters and normalizing it.
 */
function sanitize(input) {
    if (typeof input !== 'string') return '';
    // Removes zero-width spaces, non-printable characters, trims, and normalizes case
    return input.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
                .replace(/[^\x20-\x7E]/g, '') // Remove non-printable ASCII
                .trim()
                .toUpperCase();
}

/**
 * Loads, sanitizes, and prepares the gene database into an efficient lookup map.
 */
async function loadAndPrepareDatabase() {
    if (geneDataCache) return true;
    try {
        const resp = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/ciliahub_data.json');
        if (!resp.ok) throw new Error(`HTTP Error ${resp.status}`);
        const rawGenes = await resp.json();

        if (!Array.isArray(rawGenes)) {
            throw new Error('Invalid data format: expected array');
        }

        geneDataCache = rawGenes;
        allGenes = rawGenes;
        geneMapCache = new Map();

        allGenes.forEach(g => {
            if (!g.gene || typeof g.gene !== 'string') {
                console.warn('Skipping entry with invalid gene name:', g);
                return;
            }

            // 1. Index by the primary gene name
            const nameKey = sanitize(g.gene);
            if (nameKey) geneMapCache.set(nameKey, g);

            // 2. Index by all synonyms (handles comma or semicolon separators)
            if (g.synonym) {
                String(g.synonym).split(/[,;]/).forEach(syn => {
                    const key = sanitize(syn);
                    if (key && !geneMapCache.has(key)) geneMapCache.set(key, g);
                });
            }

            // 3. Index by all Ensembl IDs (handles comma or semicolon separators)
          // This part of your code already handles Ensembl IDs
if (g.ensembl_id) {
    String(g.ensembl_id).split(/[,;]/).forEach(id => {
        const key = sanitize(id);
        if (key) geneMapCache.set(key, g);
    });
} 
            
            // 4. Prepare localization data for SVG mapping - MODIFIED: Sanitize input to filter non-ciliary terms and add debug logging for ACTN2
            if (g.localization) {
                // Sanitize: Only pass valid ciliary localizations to mapLocalizationToSVG to prevent additions like "Cytosol"
                const validCiliaryLocalizations = ['transition zone', 'cilia', 'basal body', 'axoneme', 'ciliary membrane', 'centrosome', 'autophagosomes', 'endoplasmic reticulum', 'flagella', 'golgi apparatus', 'lysosome', 'microbody', 'microtubules', 'mitochondrion', 'nucleus', 'peroxisome']; // Expanded list based on common terms in plots.js
                let sanitizedLocalization = Array.isArray(g.localization) 
                    ? g.localization.map(loc => loc ? loc.trim().toLowerCase() : '').filter(loc => loc && validCiliaryLocalizations.includes(loc))
                    : (g.localization ? g.localization.split(/[,;]/).map(loc => loc ? loc.trim().toLowerCase() : '').filter(loc => loc && validCiliaryLocalizations.includes(loc)) : []);
                
                // Debug logging for ACTN2
                if (g.gene === 'ACTN2') {
                    console.log('ACTN2 Raw localization from JSON:', g.localization);
                    console.log('ACTN2 Sanitized localization before mapping:', sanitizedLocalization);
                }
                
                geneLocalizationData[g.gene] = mapLocalizationToSVG(sanitizedLocalization); // Use sanitized input
                
                // Additional debug for mapped output
                if (g.gene === 'ACTN2') {
                    console.log('ACTN2 Mapped localization from mapLocalizationToSVG:', geneLocalizationData[g.gene]);
                }
            }
        });

        console.log(`Loaded ${allGenes.length} genes into database`);
        return true;
    } catch (e) {
        console.error('Data load error:', e);
        // Fallback logic remains the same
        allGenes = getDefaultGenes();
        currentData = allGenes;
        geneMapCache = new Map();
        allGenes.forEach(g => {
            if (g.gene) geneMapCache.set(sanitize(g.gene), g);
        });
        return false;
    }
}

/**
 * Search genes using symbols, synonyms, or ENSG IDs.
 * Handles multiple IDs per gene.
 */
/**
 * Search genes using symbols, synonyms, or Ensembl IDs from the pre-built cache.
 * Handles multiple queries efficiently.
 *
 * @param {string[]} queries - An array of sanitized, uppercase gene identifiers.
 * @returns {{foundGenes: object[], notFoundGenes: string[]}} - An object containing found gene objects and not-found queries.
 */
function findGenes(queries) {
    const foundGenes = new Map(); // Use a Map to store unique genes by their canonical name
    const notFound = [];

    queries.forEach(query => {
        // The query is expected to be sanitized (trimmed, uppercased) before being passed.
        const result = geneMapCache.get(query);
        
        if (result) {
            // Use the canonical gene name as the key to prevent duplicates
            if (!foundGenes.has(result.gene)) {
                foundGenes.set(result.gene, result);
            }
        } else {
            // The original, unsanitized query should be returned for user feedback.
            // This requires the calling function to manage the original queries.
            notFound.push(query); 
        }
    });
    
    return { 
        foundGenes: Array.from(foundGenes.values()), 
        notFoundGenes: notFound 
    };
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
/**
 * Handles the UI for the Batch Gene Query page.
 */
/**
 * Handles the UI for the Batch Gene Query page, supporting all identifier types and filters.
 */
function performBatchSearch() {
    const inputElement = document.getElementById('batch-genes-input');
    const localizationFilter = document.getElementById('localization-filter')?.value;
    const keywordFilter = document.getElementById('keyword-filter')?.value.toLowerCase();
    const statusDiv = document.getElementById('status-message');
    const resultDiv = document.getElementById('batch-results');

    if (!inputElement || !resultDiv) return;

    // 1. Get all unique, sanitized queries from the input box
    const originalQueries = inputElement.value.split(/[\s,;\n\r\t]+/).filter(Boolean);
    // Use a Set to automatically handle duplicate inputs
    const sanitizedQueries = [...new Set(originalQueries.map(sanitize))];

    if (sanitizedQueries.length === 0) {
        resultDiv.innerHTML = '<p class="status-message error-message">Please enter one or more gene names, synonyms, or Ensembl IDs.</p>';
        return;
    }

    // 2. Use the central `findGenes` function that correctly finds all ID types
    const { foundGenes } = findGenes(sanitizedQueries);
    let results = foundGenes;

    // 3. Apply the optional localization and keyword filters to the results
    if (localizationFilter) {
        results = results.filter(g =>
            g.localization && g.localization.some(l => l && l.toLowerCase() === localizationFilter.toLowerCase())
        );
    }

    if (keywordFilter) {
        results = results.filter(g =>
            (g.functional_summary && g.functional_summary.toLowerCase().includes(keywordFilter)) ||
            (g.description && g.description.toLowerCase().includes(keywordFilter))
        );
    }

    // 4. Determine which of the original, user-entered queries were not found in the final results
    const foundIds = new Set();
    results.forEach(gene => {
        // Add all known identifiers for the found genes to a set for quick lookup
        foundIds.add(gene.gene.toUpperCase());
        if (gene.synonym) {
            String(gene.synonym).split(/[,;]/).forEach(s => foundIds.add(sanitize(s)));
        }
        if (gene.ensembl_id) {
            String(gene.ensembl_id).split(/[,;]/).forEach(id => foundIds.add(sanitize(id)));
        }
    });

    const notFoundOriginalQueries = originalQueries.filter(q => !foundIds.has(sanitize(q)));

    // 5. Display the final, filtered results
    statusDiv.style.display = 'none';
    searchResults = results; // Update global variable for exports

    if (results.length > 0 || notFoundOriginalQueries.length > 0) {
        displayBatchResults(results, notFoundOriginalQueries);
        displayGeneCards(currentData, results, 1, 10);
    } else {
        resultDiv.innerHTML = '<p class="status-message error-message">No genes found matching your query and filters.</p>';
        displayGeneCards(currentData, [], 1, 10); // Clear the gene cards
    }
}

// --- HOME PAGE SEARCH HANDLER (FIXED) ---
// This function handles user input to show a list of suggestions.
function handleHomeSearchInput() {
    const query = homeSearchInput.value.trim().toUpperCase();
    if (query.length < 1) {
        homeSuggestionsContainer.style.display = 'none';
        return;
    }

    // Filter genes using the same successful logic as the Compare Page
    const filteredGenes = allGenes.filter(g => {
        const geneMatch = g.gene && g.gene.toUpperCase().startsWith(query);
        const synonymMatch = g.synonym && g.synonym.toUpperCase().includes(query);
        const ensemblMatch = g.ensembl_id && g.ensembl_id.toUpperCase().startsWith(query);
        return geneMatch || synonymMatch || ensemblMatch;
    }).slice(0, 10);

    if (filteredGenes.length > 0) {
        // Build and display the suggestion list
        homeSuggestionsContainer.innerHTML = filteredGenes.map(g => {
            const details = [g.ensembl_id, g.synonym].filter(Boolean).join(', ');
            return `<div class="suggestion-item" data-gene="${g.gene}">${g.gene}${details ? ` (${details})` : ''}</div>`;
        }).join('');

        // Add a click listener to each suggestion
        homeSuggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                // On click, navigate to the specific gene page
                navigateToGenePage(item.dataset.gene);
            });
        });
        homeSuggestionsContainer.style.display = 'block';
    } else {
        homeSuggestionsContainer.innerHTML = `<div class="suggestion-item-none">No results found</div>`;
        homeSuggestionsContainer.style.display = 'block';
    }
}

// --- ADDED FUNCTION TO HANDLE 'ENTER' KEY ---
// This function should be attached to the 'keydown' event of your search input.
function handleHomeSearchKeyDown(event) {
    if (event.key === 'Enter') {
        const query = homeSearchInput.value.trim().toUpperCase();
        if (query.length === 0) return;

        // Check for an exact match to what the user typed (e.g., "A10")
        const exactMatch = allGenes.find(g => g.gene.toUpperCase() === query);

        if (exactMatch) {
            // If an exact match is found, navigate directly
            navigateToGenePage(exactMatch.gene);
        } else {
            // Otherwise, navigate to the first suggestion as a fallback
            const firstSuggestion = homeSuggestionsContainer.querySelector('.suggestion-item');
            if (firstSuggestion) {
                navigateToGenePage(firstSuggestion.dataset.gene);
            }
        }
    }
}


// --- NAVIGATION FIX ---
// This robust function navigates to the selected gene's page.
function navigateToGenePage(geneName) {
    const selectedGene = allGenes.find(g => g.gene === geneName);

    if (selectedGene) {
        homeSearchInput.value = selectedGene.gene; // Update input field
        homeSuggestionsContainer.style.display = 'none'; // Hide suggestions

        // Your existing navigation logic
        window.location.hash = `#/${selectedGene.gene}`;
        displayGenePage(selectedGene.gene);
    } else {
        console.warn(`Navigation failed: No gene found for "${geneName}"`);
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

/**
 * Renders the content for the home page, including stats, search, and gene cards.
 */
/**
 * Renders the content for the home page, including stats, search, and gene cards.
 */
function displayHomePage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area';
    document.querySelector('.cilia-panel').style.display = 'block';

    // --- Initial render with placeholders ---
    contentArea.innerHTML = `
        <div class="page-section">
            <h1>The CiliaHub: An Updated Database of Gold Standard Genes with Ciliary Functions</h1>

            <!-- CiliaHub V0.1 and Stats Section -->
            <div class="ciliahub-stats" style="margin-top: 1rem; margin-bottom: 2rem; display: flex; gap: 1rem; flex-wrap: wrap; font-family: 'Arial', sans-serif;">
                <!-- Version -->
                <div class="stats-box version-box" style="flex: 1; min-width: 140px; background-color: var(--neutral-bg-alt); color: var(--text-dark); padding: 1rem; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); text-align: center;">
                    <div style="font-size: 1.2rem; font-weight: 700;">CiliaHub V0.1</div>
                </div>
                <!-- Genes -->
                <div class="stats-box" style="flex: 1; min-width: 140px; background-color: var(--neutral-bg-alt); color: var(--primary-blue); padding: 1rem; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); text-align: center;">
                    <div id="gene-count" style="font-size: 1.5rem; font-weight: 700;">0</div>
                    <div>Genes</div>
                </div>
                <!-- Localizations -->
                <div class="stats-box" style="flex: 1; min-width: 140px; background-color: var(--neutral-bg-alt); color: var(--primary-blue); padding: 1rem; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); text-align: center;">
                    <div id="localization-count" style="font-size: 1.5rem; font-weight: 700;">0</div>
                    <div>Localizations</div>
                </div>
                <!-- References -->
                <div class="stats-box" style="flex: 1; min-width: 140px; background-color: var(--neutral-bg-alt); color: var(--primary-blue); padding: 1rem; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); text-align: center;">
                    <div id="reference-count" style="font-size: 1.5rem; font-weight: 700;">0</div>
                    <div>References</div>
                </div>
            </div>

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

    // --- Attach search event listeners ---
    document.getElementById('single-search-btn').onclick = performSingleSearch;
    const searchInput = document.getElementById('single-gene-search');
    const suggestionsContainer = document.getElementById('search-suggestions');
    const hideSuggestions = () => {
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.style.display = 'none';
    };

    searchInput.addEventListener('input', function() {
        const query = this.value.trim().toUpperCase();
        if (query.length < 1) {
            hideSuggestions();
            return;
        }
        const filteredGenes = allGenes.filter(g =>
            (g.gene && g.gene.toUpperCase().startsWith(query)) ||
            (g.synonym && g.synonym.toUpperCase().includes(query)) ||
            (g.ensembl_id && g.ensembl_id.toUpperCase().startsWith(query))
        ).slice(0, 10);
        if (filteredGenes.length > 0) {
            suggestionsContainer.innerHTML = '<ul>' +
                filteredGenes.map(g => {
                    const details = [g.ensembl_id, g.synonym].filter(Boolean).join(', ');
                    return `<li data-gene="${g.gene}">${g.gene}${details ? ` (${details})` : ''}</li>`;
                }).join('') +
                '</ul>';
            suggestionsContainer.querySelector('ul').addEventListener('click', function(event) {
                if (event.target && event.target.nodeName === "LI") {
                    searchInput.value = event.target.dataset.gene;
                    hideSuggestions();
                    performSingleSearch();
                }
            });
            suggestionsContainer.style.display = 'block';
        } else {
            hideSuggestions();
        }
    });

    searchInput.addEventListener('keydown', function(event) {
        const suggestions = suggestionsContainer.querySelectorAll('li');
        if (suggestions.length === 0 && event.key !== 'Enter') return;
        let activeElement = suggestionsContainer.querySelector('.active');
        if (event.key === 'Enter') {
            event.preventDefault();
            if (activeElement) searchInput.value = activeElement.textContent.split(' ')[0];
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
        if (!searchInput.contains(event.target) && !suggestionsContainer.contains(event.target)) {
            hideSuggestions();
        }
    });

    // --- Display initial gene cards (using all genes) ---
    displayGeneCards(allGenes, [], 1, 10);

    // --- Update stats using the globally loaded `allGenes` array ---
    if (allGenes && allGenes.length > 0) {
        const geneCount = allGenes.length;
        const uniqueLocalizations = new Set(allGenes.flatMap(g => getCleanArray(g, 'localization'))).size;
        const uniqueReferences = new Set(allGenes.map(g => g.reference).filter(Boolean)).size;

        document.getElementById('gene-count').textContent = geneCount;
        document.getElementById('localization-count').textContent = uniqueLocalizations;
        document.getElementById('reference-count').textContent = uniqueReferences;
    }

    // --- Do NOT call displayLocalizationChart to prevent chart and potential blue background ---
    // displayLocalizationChart(); // Removed to avoid unwanted section
}

/**
 * Renders the content for the gene details page.
 * @param {string} geneName - The name of the gene to display.
 */
function displayGeneDetailsPage(geneName) {
    // This function can be expanded later
    const contentArea = document.querySelector('.content-area');
    contentArea.innerHTML = `<h1>Details for ${geneName}</h1><p>Details page is under construction.</p>`;
}

/**
 * Renders the content for the batch query page.
 */
function displayBatchQueryPage() {
    // This function can be expanded later
    const contentArea = document.querySelector('.content-area');
    contentArea.innerHTML = `<h1>Batch Query</h1><p>Batch query page is under construction.</p>`;
}

// Note: The main `initializeApp` function in globals.js now starts everything.


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
            <h2>Gene Comparison Tool ⚖️</h2>
            <p>Search for and select up to 10 genes to generate a side-by-side comparison of their properties, functions, and localizations.</p>
           
            <div class="comparison-tool">
                <div class="gene-selector">
                    <div class="search-wrapper">
                        <input type="text" id="compare-gene-search" placeholder="Search by Gene, Synonym, or Ensembl ID" autocomplete="off">
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

    // ✨ THIS FUNCTION IS NOW UPDATED ✨
    function handleSearchInput() {
        const query = searchInput.value.trim().toUpperCase();
        if (query.length < 1) {
            suggestionsContainer.style.display = 'none';
            return;
        }

        const filteredGenes = allGenes.filter(g => {
            // Do not suggest genes that are already selected
            if (selectedCompareGenes.some(sg => sg.gene === g.gene)) {
                return false;
            }
            // Check for a match in the gene name, synonyms, or Ensembl ID
            const geneMatch = g.gene && g.gene.toUpperCase().startsWith(query);
            const synonymMatch = g.synonym && g.synonym.toUpperCase().includes(query);
            const ensemblMatch = g.ensembl_id && g.ensembl_id.toUpperCase().startsWith(query);
            return geneMatch || synonymMatch || ensemblMatch;
        }).slice(0, 10);
       
        if (filteredGenes.length > 0) {
            // Update suggestion display to be more informative
            suggestionsContainer.innerHTML = filteredGenes.map(g => {
                const details = [g.ensembl_id, g.synonym].filter(Boolean).join(', ');
                return `<div data-gene="${g.gene}">${g.gene}${details ? ` (${details})` : ''}</div>`;
            }).join('');

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
   
   /**
 * Renders the comparison table safely with multiple Ensembl IDs handled properly.
 */
function renderComparisonTable() {
    const container = document.getElementById('comparison-table-wrapper');
    if (!container) return console.warn("⚠️ comparison-table-wrapper not found.");

    if (!Array.isArray(selectedCompareGenes) || selectedCompareGenes.length === 0) {
        container.innerHTML = "<p>No genes selected for comparison.</p>";
        return;
    }

    const features = ['Description', 'Ensembl ID', 'OMIM ID', 'Synonym', 'Localization', 'Functional Summary', 'Reference'];
    let tableHTML = '<table id="comparison-table"><thead><tr><th>Feature</th>';

    selectedCompareGenes.forEach(g => {
        tableHTML += `<th><a href="/#/${g.gene}" onclick="navigateTo(event, '/${g.gene}')">${g.gene}</a></th>`;
    });
    tableHTML += '</tr></thead><tbody>';

    features.forEach(feature => {
        tableHTML += `<tr><td>${feature}</td>`;
        selectedCompareGenes.forEach(gene => {
            let value = '-';
            switch (feature) {
                case 'Description':
                    value = gene.description || '-';
                    break;
                case 'Ensembl ID':
                    if (gene.ensembl_id) {
                        const ids = String(gene.ensembl_id).split(/\s*,\s*/).filter(Boolean);
                        value = ids.map(id =>
                            `<a href="https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${id.trim()}" target="_blank" class="text-[#0067A5] hover:underline">${id.trim()}</a>`
                        ).join('<br>');
                    }
                    break;
                case 'OMIM ID':
                    value = gene.omim_id
                        ? `<a href="https://www.omim.org/entry/${gene.omim_id}" target="_blank" class="text-[#0067A5] hover:underline">${gene.omim_id}</a>`
                        : '-';
                    break;
                case 'Synonym':
                    value = gene.synonym || '-';
                    break;
                case 'Localization':
                    value = Array.isArray(gene.localization)
                        ? gene.localization.join(', ')
                        : (gene.localization || '-');
                    break;
                case 'Functional Summary':
                    value = gene.functional_summary || '-';
                    break;
                case 'Reference':
                    if (gene.reference) {
                        const refs = Array.isArray(gene.reference)
                            ? gene.reference
                            : [gene.reference];
                        value = refs.flatMap(r => String(r).split(/[,;]\s*/))
                            .filter(Boolean)
                            .map(ref => {
                                if (/^\d+$/.test(ref)) {
                                    return `<a href="https://pubmed.ncbi.nlm.nih.gov/${ref}" target="_blank" class="text-[#0067A5] hover:underline">PMID: ${ref}</a>`;
                                }
                                if (ref.toLowerCase().startsWith('http')) {
                                    return `<a href="${ref}" target="_blank" class="text-[#0067A5] hover:underline">${ref}</a>`;
                                }
                                return `<span class="text-[#0067A5]">${ref}</span>`;
                            }).join('<br>');
                    }
                    break;
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
            if (Array.isArray(gene.localization)) {
                gene.localization.forEach(loc => {
                    const term = loc.trim();
                    if (term) {
                        const capitalizedTerm = term.charAt(0).toUpperCase() + term.slice(1);
                        localizationCounts[capitalizedTerm] = (localizationCounts[capitalizedTerm] || 0) + 1;
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
                plugins: { 
                    legend: { display: false }, 
                    title: { display: true, text: 'Localization Distribution of Selected Genes' },
                    customCanvasBackgroundColor: { color: '#ffffff' }
                }
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

function displayIndividualGenePage(gene) {
    const contentArea = document.querySelector('.content-area');
    if (!contentArea) return console.warn("⚠️ .content-area not found.");
    contentArea.className = 'content-area max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8';

    const panel = document.querySelector('.cilia-panel');
    if (panel) panel.style.display = 'block';

    const formatAsTags = (data, className = 'tag-default') => {
        if (!data) return 'Not available';
        const arr = Array.isArray(data) ? data : String(data).split(/[;,]\s*/).filter(Boolean);
        return arr.map(item => `<span class="tag ${className}">${item}</span>`).join('');
    };

    const formatReferences = (gene) => {
        if (!gene.reference) return '<li>No reference information available.</li>';
        const allRefs = Array.isArray(gene.reference) ? gene.reference : [gene.reference];
        return allRefs
            .flatMap(item => String(item).split(/[,;]\s*/))
            .map(s => s.trim())
            .filter(Boolean)
            .map(ref => {
                if (/^\d+$/.test(ref)) {
                    return `<li><a href="https://pubmed.ncbi.nlm.nih.gov/${ref}" target="_blank" class="text-[#0067A5] hover:underline">PMID: ${ref}</a></li>`;
                }
                if (ref.toLowerCase().startsWith('http')) {
                    return `<li><a href="${ref}" target="_blank" class="text-[#0067A5] hover:underline">${ref}</a></li>`;
                }
                return `<li class="text-[#0067A5]">${ref}</li>`;
            }).join('');
    };
const formatComplexes = (complexes) => {
    if (!complexes) return '<span class="text-gray-500">No complexes found for this gene.</span>';
    const arr = Array.isArray(complexes) ? complexes.join(';').split(/;\s*/) : String(complexes).split(/;\s*/);
    return arr.map(name => {
        const url = `https://mips.helmholtz-muenchen.de/corum/#search;complex=${encodeURIComponent(name.trim())}`;
        return `<a href="${url}" target="_blank" class="tag tag-complex hover:underline">${name.trim()}</a>`;
    }).join(' ');
};

    const formatPfam = (ids) => {
        if (!ids) return 'Not available';
        const arr = Array.isArray(ids) ? ids.join(';').split(/;\s*/) : String(ids).split(/;\s*/);
        return arr.map(id =>
            `<a href="https://www.ebi.ac.uk/interpro/entry/pfam/${id}" target="_blank" class="text-[#0067A5] hover:underline">${id}</a>`
        ).join('<br>');
    };

    // Prepare data
    const localizationTags = formatAsTags(gene.localization, 'tag-localization');
    const functionalCategoryTags = formatAsTags(gene.functional_category, 'tag-category');
    const referenceHTML = formatReferences(gene);

    let ensemblHTML = 'Not available';
    if (gene.ensembl_id) {
        const ids = String(gene.ensembl_id).split(/\s*,\s*/).filter(Boolean);
        ensemblHTML = ids.map(id =>
            `<a href="https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${id.trim()}" target="_blank" class="text-[#0067A5] hover:underline">${id.trim()}</a>`
        ).join('<br>');
    }

    const pfamHTML = gene.pfam_ids ? formatPfam(gene.pfam_ids) : 'Not available';
    const domainDescriptionsHTML = gene.domain_descriptions ? formatAsTags(gene.domain_descriptions, 'tag-domain') : 'Not available';
    const ciliopathyHTML = gene.ciliopathy ? formatAsTags(gene.ciliopathy, 'tag-ciliopathy') : 'Not available';
    const complexesHTML = formatComplexes(gene.complex_names);

    contentArea.innerHTML = `
      <div class="page-section gene-detail-page space-y-6">
        <h1 class="text-3xl font-bold text-gray-900">${gene.gene || "Unknown Gene"}</h1>
        ${gene.description ? `<p class="text-lg text-gray-700">${gene.description}</p>` : ''}
        ${gene.functional_summary ? `<p class="text-base text-gray-600 italic">${gene.functional_summary}</p>` : ''}

        <div class="details-column space-y-6">

          <div class="detail-card p-4 rounded-2xl shadow-md bg-white">
            <h3 class="card-title text-lg font-semibold">Identifiers</h3>
            <div class="space-y-3">
              <div><strong class="text-[#0067A5]">Ensembl ID(s):</strong> ${ensemblHTML}</div>
              ${gene.omim_id ? `<div><strong class="text-[#0067A5]">OMIM ID:</strong> <a href="https://www.omim.org/entry/${gene.omim_id}" target="_blank" class="text-[#0067A5] hover:underline">${gene.omim_id}</a></div>` : ''}
              ${gene.synonym ? `<div><strong class="text-[#0067A5]">Synonym(s):</strong> <span class="text-[#0067A5]">${gene.synonym}</span></div>` : ''}
            </div>
          </div>

          <div class="detail-card p-4 rounded-2xl shadow-md bg-white">
            <h3 class="card-title text-lg font-semibold">Localization</h3>
            <div>${localizationTags}</div>
          </div>

          <div class="detail-card p-4 rounded-2xl shadow-md bg-white">
            <h3 class="card-title text-lg font-semibold">Functional Category</h3>
            <div>${functionalCategoryTags}</div>
          </div>

          <div class="detail-card p-4 rounded-2xl shadow-md bg-white">
            <h3 class="card-title text-lg font-semibold">Ciliopathies</h3>
            <div>${ciliopathyHTML}</div>
          </div>

          <div class="detail-card p-4 rounded-2xl shadow-md bg-white">
            <h3 class="card-title text-lg font-semibold">PFAM Domains</h3>
            <div>${pfamHTML}</div>
            <div class="mt-2 text-sm text-gray-600">${domainDescriptionsHTML}</div>
          </div>

          <div class="detail-card p-4 rounded-2xl shadow-md bg-white">
            <h3 class="card-title text-lg font-semibold">Protein Complexes</h3>
            <div>${complexesHTML}</div>
          </div>

          <div class="detail-card p-4 rounded-2xl shadow-md bg-white">
            <h3 class="card-title text-lg font-semibold">References</h3>
            <ul>${referenceHTML}</ul>
          </div>
        </div>
      </div>
    `;

    if (typeof updateGeneButtons === "function") updateGeneButtons([gene], [gene]);
    if (typeof showLocalization === "function") showLocalization(gene.gene, true);
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

    // ✅ Filter using exact match (no partial matches)
    const results = allGenes.filter(g => {
        if (g.gene && g.gene.toUpperCase() === query) {
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
        // Show close suggestions (still helpful UX)
        const closeMatches = allGenes.filter(g =>
            g.gene && g.gene.toUpperCase().startsWith(query.slice(0, 3))
        ).slice(0, 3);

        statusDiv.innerHTML = `<span class="error-message">No genes found for "${query}". ${closeMatches.length > 0 ? 'Did you mean: ' + closeMatches.map(g => g.gene).join(', ') + '?' : 'No close matches found.'}</span>`;
        return;
    }

    // ✅ If exactly one match, go directly to gene page
    if (results.length === 1) {
        navigateTo(null, `/${results[0].gene}`);
    } else {
        // Otherwise use batch query mode (multiple exact matches)
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
            if (!Array.isArray(g.localization)) {
                return false;
            }
            const localizations = g.localization
                .map(l => l?.trim().toLowerCase())
                .filter(Boolean);

            if (localizations.length === 0) {
                return false;
            }
            // Logic to count genes remains the same
            return localizations.includes(category.toLowerCase()) ||
                (category === 'Cilia' && localizations.includes('ciliary membrane')) ||
                (category === 'Flagella' && localizations.includes('axoneme')) ||
                (category === 'Ciliary Associated Gene' && localizations.includes('ciliary associated gene'));
        }).length;
        return acc;
    }, {});

    // ✨ Change: Sort data to show the most frequent category on top
    const sortedCategories = categories.sort((a, b) => localizationCounts[b] - localizationCounts[a]);

    const chartContainer = document.createElement('div');
    chartContainer.className = 'page-section';
    // ✨ Change: Updated the title for a cleaner look
    chartContainer.innerHTML = `<h2>Localization in Ciliary Genes</h2><div style="position: relative; height:350px; width:100%;"><canvas id="locChart"></canvas></div>`;

    const contentArea = document.querySelector('.content-area');
    const existingChart = contentArea.querySelector('#locChart');
    if (existingChart) {
        existingChart.closest('.page-section').remove();
    }

    contentArea.appendChild(chartContainer);

    const ctx = document.getElementById('locChart').getContext('2d');
    
    // ✨ Change: Using gradients for a more modern "fancy" look
    const createGradient = (color1, color2) => {
        const gradient = ctx.createLinearGradient(0, 0, 800, 0); // Horizontal gradient
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        return gradient;
    };

    const backgroundColors = [
        createGradient('rgba(0, 85, 102, 0.8)', 'rgba(0, 128, 153, 0.8)'),
        createGradient('rgba(102, 194, 165, 0.8)', 'rgba(140, 212, 194, 0.8)'),
        createGradient('rgba(216, 27, 96, 0.8)', 'rgba(230, 64, 129, 0.8)'),
        createGradient('rgba(255, 127, 0, 0.8)', 'rgba(255, 159, 64, 0.8)'),
        createGradient('rgba(107, 174, 214, 0.8)', 'rgba(141, 190, 223, 0.8)')
    ];
    
    new Chart(ctx, {
        // ✨ Change: Switched to a horizontal bar chart
        type: 'bar',
        data: {
            labels: sortedCategories,
            datasets: [{
                label: 'Number of Genes',
                data: sortedCategories.map(category => localizationCounts[category] || 0),
                backgroundColor: backgroundColors,
                // ✨ Change: Added rounded corners to the bars
                borderRadius: 5,
                borderWidth: 0, // No border for a flatter look
            }]
        },
        options: {
            // ✨ Change: Set to horizontal bar chart
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    // ✨ Change: Cleaner look by removing grid lines
                    grid: {
                        display: false,
                        drawBorder: false,
                    },
                    ticks: {
                        color: '#333', // Darker font for better readability
                        font: {
                            size: 14,
                            family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif"
                        }
                    }
                },
                x: {
                    grid: {
                        display: false,
                        drawBorder: false,
                    },
                    ticks: {
                        display: false // Hide x-axis labels, as count is in the tooltip
                    }
                }
            },
            plugins: {
                // ✨ Fix: This ensures a transparent background for the plot
                customCanvasBackgroundColor: {
                    color: 'transparent',
                },
                legend: {
                    display: false // Legend is not needed for a single dataset
                },
                title: {
                    display: false // Title is now in the HTML h2 tag
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleFont: { size: 16 },
                    bodyFont: { size: 14 },
                    displayColors: false, // Hides the little color box in the tooltip
                    callbacks: {
                        label: function(context) {
                            return ` ${context.raw} genes`;
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

function displayTissueExpressionData(tissueName) {
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


// Init UI helpers (sticky nav, panzoom, etc.)
document.addEventListener('DOMContentLoaded', () => {
    initGlobalEventListeners();
});
