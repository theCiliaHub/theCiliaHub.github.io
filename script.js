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
            const query = this.value.trim();
            if (query.length < 1) {
                suggestionsContainer.style.display = 'none';
                suggestionsContainer.innerHTML = '';
                return;
            }
            const filteredGenes = allGenes.filter(g => 
                (g.gene && g.gene.toLowerCase().startsWith(query.toLowerCase())) || 
                (g.synonym && g.synonym.toLowerCase().includes(query.toLowerCase()))
            ).slice(0, 10);
            suggestionsContainer.innerHTML = filteredGenes.length > 0
                ? '<ul>' + filteredGenes.map(g => `<li data-gene="${g.gene}">${g.gene}${g.synonym ? ` (${g.synonym})` : ''}</li>`).join('') + '</ul>'
                : '<div style="padding: 0.8rem; color: #666;">No matches found</div>';
            suggestionsContainer.style.display = filteredGenes.length > 0 ? 'block' : 'none';
            suggestionsContainer.querySelectorAll('li').forEach((item, index) => {
                item.addEventListener('click', () => {
                    searchInput.value = item.dataset.gene;
                    suggestionsContainer.style.display = 'none';
                    performSingleSearch();
                });
                item.addEventListener('mouseover', () => {
                    suggestionsContainer.querySelectorAll('li').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                });
            });
        });
        searchInput.addEventListener('keydown', function(event) {
            const suggestions = suggestionsContainer.querySelectorAll('li');
            if (suggestions.length === 0) return;
            let activeIndex = Array.from(suggestions).findIndex(item => item.classList.contains('active'));
            if (event.key === 'Enter') {
                event.preventDefault();
                if (activeIndex >= 0) {
                    searchInput.value = suggestions[activeIndex].dataset.gene;
                    suggestionsContainer.style.display = 'none';
                    performSingleSearch();
                }
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (activeIndex < suggestions.length - 1) {
                    suggestions[activeIndex]?.classList.remove('active');
                    suggestions[activeIndex + 1].classList.add('active');
                } else {
                    suggestions[activeIndex]?.classList.remove('active');
                    suggestions[0].classList.add('active');
                }
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (activeIndex > 0) {
                    suggestions[activeIndex]?.classList.remove('active');
                    suggestions[activeIndex - 1].classList.add('active');
                } else {
                    suggestions[activeIndex]?.classList.remove('active');
                    suggestions[suggestions.length - 1].classList.add('active');
                }
            }
        });
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length > 0) {
                searchInput.dispatchEvent(new Event('input'));
            }
        });
        document.addEventListener('click', function(event) {
            if (!searchInput.contains(event.target) && !suggestionsContainer.contains(event.target)) {
                suggestionsContainer.style.display = 'none';
            }
        });
    } else {
        console.error('Search elements not found on Home page');
    }
    displayGeneCards(currentData, [], 1, 10);
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
    const results = allGenes.filter(g => 
        (g.gene && g.gene.toUpperCase().includes(query)) || 
        (g.synonym && g.synonym.toUpperCase().includes(query))
    );
    if (results.length === 0) {
        const closeMatches = allGenes.filter(g => 
            g.gene && g.gene.toUpperCase().startsWith(query.slice(0, 3))
        ).slice(0, 3);
        statusDiv.innerHTML = `<span class="error-message">No genes found for "${query}". ${closeMatches.length > 0 ? 'Did you mean: ' + closeMatches.map(g => g.gene).join(', ') + '?' : 'No close matches found.'}</span>`;
        return;
    }
    if (results.length === 1) {
        navigateTo(null, `/${results[0].gene}`);
    } else {
        navigateTo(null, '/batch-query');
        setTimeout(() => {
            document.getElementById('batch-genes-input').value = results.map(r => r.gene).join('\n');
            performBatchSearch();
        }, 100);
    }
}

// ... (all other functions from previous script.js remain unchanged until updateExpressionVisualization)

function updateExpressionVisualization(geneName) {
    console.log('Updating visualization for gene:', geneName);
    const organs = document.querySelectorAll('.organ');
    organs.forEach(organ => {
        const originalColor = organ.getAttribute('data-original-color') || '#D3D3D3';
        organ.setAttribute('fill', originalColor);
        organ.style.filter = 'brightness(1)';
    });
    const geneExpression = findGeneExpression(geneName);
    if (geneExpression) {
        console.log('Expression data found:', geneExpression);
        Object.entries(geneExpression).forEach(([tissue, nTPM]) => {
            const organElement = findOrganElement(tissue);
            if (organElement) {
                const color = getExpressionColor(nTPM);
                console.log(`Applying color ${color} to tissue ${tissue} (nTPM: ${nTPM})`);
                organElement.setAttribute('fill', color);
            } else {
                console.warn(`No organ element found for tissue: ${tissue}`);
            }
        });
    } else {
        console.warn('No expression data for gene:', geneName);
    }
}

// ... (rest of the functions remain unchanged)

function loadExpressionData() {
    try {
        // Using sample GTEx-like TSV
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
        // Fallback data
        expressionData = {
            'IFT88': { 'lung': 12.5, 'heart muscle': 3.2, 'liver': 1.1, 'kidney': 8.7, 'cerebral cortex': 5.0 },
            'CEP290': { 'lung': 25.3, 'heart muscle': 5.1, 'liver': 2.0, 'kidney': 15.4, 'cerebral cortex': 10.0 },
            'ARL13B': { 'lung': 18.9, 'heart muscle': 4.5, 'liver': 0.8, 'kidney': 22.1, 'cerebral cortex': 7.5 },
        };
        availableGenes = new Set(Object.keys(expressionData));
        console.log('Using fallback expression data');
    }
}

async function loadSVGFile() {
    try {
        const response = await fetch('https://upload.wikimedia.org/wikipedia/commons/5/54/220px-Human_body_silhouette.svg');
        if (!response.ok) throw new Error('Failed to load SVG file');
        let svgText = await response.text();
        svgText = svgText.replace('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="330">', 
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 220 330">'
        );
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
            <!-- Testis -->
            <path class="organ" data-tissue="testis" fill="#E49BDC" d="M100 310 L110 320 L110 330 L100 320 Z" data-original-color="#E49BDC"/>
        `;
        svgText += '</svg>';
        const container = document.getElementById('svg-container');
        if (container) {
            container.innerHTML = svgText;
            setTimeout(prepareOrgansForExpression, 100);
        }
    } catch (error) {
        console.error('Error loading SVG file:', error);
        const container = document.getElementById('svg-container');
        if (container) {
            container.innerHTML = `<div style="text-align: center; padding: 2rem; color: #666;">Failed to load visualization. Using fallback.</div>`;
            container.innerHTML += `
                <svg width="400" height="600" viewBox="0 0 220 330">
                    <rect x="80" y="20" width="60" height="40" fill="#BE0405" class="organ" data-tissue="cerebral cortex" data-original-color="#BE0405"/>
                    <rect x="90" y="100" width="40" height="40" fill="#F07070" class="organ" data-tissue="heart muscle" data-original-color="#F07070"/>
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

window.selectExpressionGene = selectExpressionGene;
window.handleOrganClick = handleOrganClick;

function navigateTo(event, path) {
    if (event) event.preventDefault();
    window.location.hash = path;
}

window.addEventListener('hashchange', handleRouteChange);
window.addEventListener('load', () => {
    initGlobalEventListeners();
    handleRouteChange();
});
