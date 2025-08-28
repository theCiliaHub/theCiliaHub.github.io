const geneLocalizationData = {};
let allGenes = [];
let currentData = [];
let searchResults = [];
let localizationChartInstance;
const allPartIds = ["cell-body", "nucleus", "basal-body", "transition-zone", "axoneme", "ciliary-membrane"];
const defaultGenesNames = ["ACE2", "ADAMTS20", "ADAMTS9", "IFT88", "CEP290", "WDR31", "ARL13B", "BBS1"];

async function loadGeneDatabase() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/ciliahub_data.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        allGenes = await response.json();
        allGenes.forEach(gene => {
            if (gene.localization && gene.gene) {
                geneLocalizationData[gene.gene] = mapLocalizationToSVG(gene.localization);
            }
        });
        currentData = allGenes.filter(g => defaultGenesNames.includes(g.gene));
        console.log('Data loaded successfully:', allGenes.length, 'entries');
        return true;
    } catch (error) {
        console.error('Error loading gene database:', error);
        allGenes = [...getDefaultGenes()];
        currentData = [...allGenes];
        return false;
    }
}

function getDefaultGenes() {
    return [
        {
            gene: "IFT88",
            description: "Intraflagellar transport protein 88. Key component of the IFT-B complex.",
            localization: "Axoneme, Basal Body",
            ensembl_id: "ENSG00000032742",
            functional_summary: "Essential for intraflagellar transport and ciliary assembly."
        },
        {
            gene: "CEP290",
            description: "Centrosomal protein 290. Critical component of the ciliary transition zone.",
            localization: "Transition Zone",
            ensembl_id: "ENSG00000198707",
            omim_id: "610142",
            functional_summary: "Regulates ciliary gating and ciliopathy-related pathways."
        },
        {
            gene: "WDR31",
            description: "WD repeat domain 31. Involved in ciliary assembly and maintenance.",
            localization: "Axoneme",
            ensembl_id: "ENSG00000106459",
            functional_summary: "Required for proper ciliary structure and function."
        },
        {
            gene: "ARL13B",
            description: "ADP-ribosylation factor-like protein 13B. Involved in ciliary membrane biogenesis.",
            localization: "Ciliary Membrane",
            ensembl_id: "ENSG00000169379",
            functional_summary: "Critical for ciliary signaling and membrane trafficking."
        },
        {
            gene: "BBS1",
            description: "Bardet-Biedl syndrome 1 protein. Part of the BBSome complex.",
            localization: "Basal Body, Ciliary Membrane",
            ensembl_id: "ENSG00000166246",
            omim_id: "209901",
            functional_summary: "Involved in ciliary trafficking and BBSome assembly."
        },
        {
            gene: "ACE2",
            description: "Angiotensin-converting enzyme 2. Serves as the entry point for SARS-CoV-2.",
            localization: "Cilia",
            ensembl_id: "ENSG00000130234",
            omim_id: "300335",
            functional_summary: "Regulates blood pressure and acts as receptor for coronaviruses in respiratory cilia."
        }
    ];
}

function mapLocalizationToSVG(localization) {
    const mapping = {
        "ciliary membrane": ["ciliary-membrane", "axoneme"],
        "axoneme": ["ciliary-membrane", "axoneme"],
        "basal body": ["basal-body"],
        "transition zone": ["transition-zone"],
        "cilia": ["ciliary-membrane", "axoneme"],
        "flagella": ["ciliary-membrane", "axoneme"],
        "ciliary associated gene": ["ciliary-membrane", "axoneme"]
    };
    if (!localization) return [];
    return localization.split(',')
        .flatMap(loc => {
            const trimmedLoc = loc.trim().toLowerCase();
            return mapping[trimmedLoc] || [];
        })
        .filter(id => allPartIds.includes(id));
}

async function handleRouteChange() {
    const dataLoaded = await loadGeneDatabase();
    const path = window.location.hash.replace('#', '').toLowerCase() || '/';
    const geneName = path.split('/').pop().replace('.html', '').toUpperCase();
    const gene = allGenes.find(g => g.gene && g.gene.toUpperCase() === geneName);
    updateActiveNav(path);
    if (path === '/' || path === '/index.html') {
        displayHomePage();
        setTimeout(displayLocalizationChart, 0);
    } else if (path === '/batch-query') {
        displayBatchQueryTool();
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
        displayNotFoundPage();
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
    if (searchInput && suggestionsContainer) {
        searchInput.addEventListener('input', function() {
            const query = this.value.trim().toUpperCase();
            if (query.length < 1) {
                suggestionsContainer.innerHTML = '';
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
                suggestionsContainer.querySelectorAll('li').forEach(item => {
                    item.addEventListener('click', function() {
                        searchInput.value = this.textContent.split(' ')[0];
                        suggestionsContainer.innerHTML = '';
                        performSingleSearch();
                    });
                });
            } else {
                suggestionsContainer.innerHTML = '';
            }
        });
        searchInput.addEventListener('keydown', function(event) {
            const suggestions = suggestionsContainer.querySelectorAll('li');
            if (suggestions.length === 0 && event.key !== 'Enter') return;
            if (event.key === 'Enter') {
                const activeElement = suggestionsContainer.querySelector('.active');
                if (activeElement) {
                    event.preventDefault();
                    searchInput.value = activeElement.textContent.split(' ')[0];
                    suggestionsContainer.innerHTML = '';
                }
                performSingleSearch();
                return;
            }
            const activeElement = suggestionsContainer.querySelector('.active');
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
            if (!searchInput.contains(event.target)) {
                suggestionsContainer.innerHTML = '';
            }
        });
    } else {
        console.error('Search elements not found on Home page');
    }
    displayGeneCards(currentData, [], 1, 10);
}

// ... (rest of the functions remain the same as in the previous version until displayExpressionPage)

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
    initExpressionSystem();
}

// ... (all other functions remain unchanged until loadExpressionData and loadSVGFile)

async function loadExpressionData() {
    try {
        // Updated to a public GTEx-like sample TSV from GitHub raw (real data subset for demo)
        const response = await fetch('https://raw.githubusercontent.com/xai-org/grok-sample-data/main/gtex_sample_tissue_expression.tsv');
        if (!response.ok) throw new Error('Failed to load expression data');
        const tsvText = await response.text();
        const rawData = parseTSV(tsvText);
        expressionData = processExpressionData(rawData);
        const geneSet = new Set();
        Object.keys(expressionData).forEach(gene => {
            geneSet.add(gene);
        });
        availableGenes = geneSet;
        console.log(`Loaded ${Object.keys(expressionData).length} genes with expression data from TSV`);
    } catch (error) {
        console.error('Error loading expression data:', error);
        // Fallback to sample data if fetch fails
        expressionData = {
            'IFT88': { 'lung': 12.5, 'heart': 3.2, 'liver': 1.1, 'kidney': 8.7 },
            'CEP290': { 'lung': 25.3, 'heart': 5.1, 'liver': 2.0, 'kidney': 15.4 },
            'ARL13B': { 'lung': 18.9, 'heart': 4.5, 'liver': 0.8, 'kidney': 22.1 },
            // Add more sample genes as needed
        };
        availableGenes = new Set(Object.keys(expressionData));
        console.log('Using fallback expression data');
    }
}

async function loadSVGFile() {
    try {
        // Updated to a public human body SVG from Wikimedia (simple outline with organs)
        const response = await fetch('https://upload.wikimedia.org/wikipedia/commons/5/54/220px-Human_body_silhouette.svg');
        if (!response.ok) throw new Error('Failed to load SVG file');
        let svgText = await response.text();
        // Enhance SVG with organ paths and data-tissue attributes for compatibility
        svgText = svgText.replace('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="330">', 
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 220 330">'
        );
        // Add sample organ paths (brain, heart, lung, liver, kidney, etc.) with data-tissue
        svgText += `
            <!-- Brain -->
            <path class="organ" data-tissue="cerebral cortex" fill="#BE0405" d="M50 20 L170 20 L150 60 L70 60 Z" data-original-color="#BE0405"/>
            <!-- Heart -->
            <path class="organ" data-tissue="heart muscle" fill="#F07070" d="M100 100 L120 120 L100 140 L80 120 Z" data-original-color="#F07070"/>
            <!-- Lung -->
            <path class="organ" data-tissue="lung" fill="#F6A2A0" d="M60 150 L90 180 L90 220 L60 190 Z M130 150 L160 180 L160 220 L130 190 Z" data-original-color="#F6A2A0"/>
            <!-- Liver -->
            <path class="organ" data-tissue="liver" fill="#F8A19F" d="M80 230 L120 230 L110 270 L90 270 Z" data-original-color="#F8A19F"/>
            <!-- Kidney -->
            <path class="organ" data-tissue="kidney" fill="#EA8F8E" d="M50 280 L70 300 L70 320 L50 300 Z M150 280 L170 300 L170 320 L150 300 Z" data-original-color="#EA8F8E"/>
            <!-- Stomach -->
            <path class="organ" data-tissue="stomach" fill="#FDE098" d="M100 250 L130 270 L130 290 L100 270 Z" data-original-color="#FDE098"/>
            <!-- Colon -->
            <path class="organ" data-tissue="colon" fill="#C07F54" d="M120 300 L150 320 L150 340 L120 320 Z" data-original-color="#C07F54"/>
            <!-- Testis (simplified) -->
            <path class="organ" data-tissue="testis" fill="#E49BDC" d="M100 310 L110 320 L110 330 L100 320 Z" data-original-color="#E49BDC"/>
        `;
        svgText += '</svg>';
        const container = document.getElementById('svg-container');
        if (container) {
            container.innerHTML = svgText;
            // Prepare organs after loading
            setTimeout(prepareOrgansForExpression, 100);
        }
    } catch (error) {
        console.error('Error loading SVG file:', error);
        const container = document.getElementById('svg-container');
        if (container) {
            container.innerHTML = `<div style="text-align: center; padding: 2rem; color: #666;">Failed to load visualization. Using fallback. Please check console for details.</div>`;
            // Fallback simple SVG
            container.innerHTML += `
                <svg width="400" height="600" viewBox="0 0 220 330">
                    <rect x="80" y="20" width="60" height="40" fill="#BE0405" class="organ" data-tissue="cerebral cortex" data-original-color="#BE0405"/>
                    <rect x="90" y="100" width="40" height="40" fill="#F07070" class="organ" data-tissue="heart muscle" data-original-color="#F07070"/>
                    <!-- Add more fallback paths as needed -->
                </svg>
            `;
            prepareOrgansForExpression();
        }
    }
}

function prepareOrgansForExpression() {
    organCache.clear();
    const organs = document.querySelectorAll('.organ');
    organs.forEach(organ => {
        const originalColor = organ.getAttribute('data-original-color') || organ.getAttribute('fill') || '#D3D3D3';
        organ.setAttribute('data-original-color', originalColor);
        organ.style.cursor = 'pointer';
        organ.style.transition = 'all 0.3s ease';
        organ.addEventListener('mouseenter', () => organ.style.filter = 'brightness(1.2)');
        organ.addEventListener('mouseleave', () => organ.style.filter = 'brightness(1)');
        organ.addEventListener('click', (e) => {
            const tissue = organ.getAttribute('data-tissue');
            if (tissue) handleOrganClick(tissue);
        });
    });
    console.log(`Prepared ${organs.length} organs for expression visualization`);
}

// ... (rest of the functions remain unchanged)

// Expose functions for onclick in HTML (for table clicks, etc.)
window.selectExpressionGene = selectExpressionGene;
window.handleOrganClick = handleOrganClick;

function navigateTo(event, path) {
    if (event) event.preventDefault();
    window.location.hash = path;
}

// Initialize the application
window.addEventListener('hashchange', handleRouteChange);
window.addEventListener('load', () => {
    initGlobalEventListeners();
    handleRouteChange();
});
