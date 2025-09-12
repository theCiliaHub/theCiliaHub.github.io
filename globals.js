// =============================================================================
// GLOBAL VARIABLES
// =============================================================================
let allGenes = [];
let currentData = [];
let searchResults = [];
const geneLocalizationData = {};

// Plotting
let currentPlot = null;

// Chart instances
let localizationChartInstance;
let analysisDotPlotInstance;
let analysisBarChartInstance;

// IDs and defaults
const allPartIds = [
    "cell-body", "nucleus", "basal-body",
    "transition-zone", "axoneme", "ciliary-membrane"
];
const defaultGenesNames = [
    "ACE2", "ADAMTS20", "ADAMTS9", "IFT88",
    "CEP290", "WDR31", "ARL13B", "BBS1"
];

// Caches
let geneDataCache = null;
let geneMapCache = null;

function navigateTo(event, path) {
    if (event) {
        event.preventDefault();
    }
    window.location.hash = path;
}

// =============================================================================
// ROUTER
// =============================================================================
async function handleRouteChange() {
    let path = window.location.hash.replace(/^#/, '').toLowerCase().trim();
    if (!path || path === '/' || path === '/index.html') {
        path = '/';
    }

    try {
        await loadAndPrepareDatabase(); // Defined in script.js
    } catch (err) {
        console.error('Database loading failed:', err);
        const contentArea = document.querySelector('.content-area');
        if (contentArea) {
            contentArea.innerHTML += `<p class="status-message error">Error loading database: ${err.message}</p>`;
        }
    }

    let gene = null;
    if (geneMapCache) {
        const geneName = getGeneFromURL();
        if (geneName && geneName.toLowerCase() !== 'ciliaplot') {
            const safeName = sanitize(geneName);
            gene = geneMapCache.get(safeName);
            if (!gene) {
                console.warn(`Gene "${safeName}" not found in database.`);
            }
        }
    } else {
        console.warn("geneMapCache is not initialized yet.");
    }

    updateActiveNav(path);

    // Hide all pages
    const pages = [
        '#home-page', '#analysis-page', '#batch-query-page',
        '#ciliaplot-page', '#compare-page', '#expression-page',
        '#download-page', '#contact-page', '#notfound-page'
    ];
    pages.forEach(id => {
        const el = document.querySelector(id);
        if (el) el.style.display = 'none';
    });

    // Clear plot-related elements, preserve home page and search
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
        const elementsToRemove = contentArea.querySelectorAll(
            '#locChart, .page-section:not(#home-page .page-section), .plot-container-new, .chart-container, canvas, .stats-container:not(.ciliahub-stats), .legend, .pagination, #ciliaplot-stats-container, #plot-display-area'
        );
        elementsToRemove.forEach(el => el.closest('.page-section, .plot-container-new, .ciliaplot-container-new')?.remove() || el.remove());
        contentArea.style.background = 'var(--panel-bg)';
        contentArea.style.minHeight = 'calc(100vh - 100px)';
    }

    // Show the correct page
    switch (path) {
        case '/':
            document.querySelector('#home-page').style.display = 'block';
            displayHomePage();
            break;
        case '/batch-query':
            document.querySelector('#batch-query-page').style.display = 'block';
            displayBatchQueryTool();
            break;
        case '/ciliaplot':
        case '/analysis':
            document.querySelector('#ciliaplot-page').style.display = 'block';
            displayCiliaPlotPage();
            if (gene) {
                try {
                    renderDomainEnrichment([gene]);
                    computeProteinComplexLinks([gene]);
                } catch (err) {
                    console.error('Error in renderDomainEnrichment or computeProteinComplexLinks:', err);
                    const plotArea = document.getElementById('plot-display-area');
                    if (plotArea) {
                        plotArea.innerHTML = `<p class="status-message error">Error processing gene data: ${err.message}</p>`;
                    }
                }
            }
            break;
        case '/compare':
            document.querySelector('#compare-page').style.display = 'block';
            displayComparePage();
            break;
        case '/expression':
            document.querySelector('#expression-page').style.display = 'block';
            displayExpressionPage();
            break;
        case '/download':
            document.querySelector('#download-page').style.display = 'block';
            displayDownloadPage();
            break;
        case '/contact':
            document.querySelector('#contact-page').style.display = 'block';
            displayContactPage();
            break;
        default:
            if (gene) {
                document.querySelector('#home-page').style.display = 'block';
                displayIndividualGenePage(gene);
            } else {
                document.querySelector('#notfound-page').style.display = 'block';
                displayNotFoundPage();
            }
            break;
    }

    // Restore search event listener
    const searchInput = document.getElementById('single-gene-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim().toUpperCase();
            const suggestionsContainer = document.getElementById('search-suggestions');
            if (query.length < 1) {
                suggestionsContainer.innerHTML = '';
                suggestionsContainer.style.display = 'none';
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
                suggestionsContainer.style.display = 'block';
            } else {
                suggestionsContainer.innerHTML = '';
                suggestionsContainer.style.display = 'none';
            }
        });
    }

    console.log("Routing completed. Path:", path, "Gene:", gene ? gene.gene : "N/A");
}

// =============================================================================
// URL HELPERS
// =============================================================================
function getGeneFromURL() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('gene');
    if (fromQuery) return fromQuery;

    const hashPath = window.location.hash.replace(/^#/, '');
    const pathParts = hashPath.split('/');
    if (pathParts.length > 1 && pathParts[pathParts.length - 1].toLowerCase() !== 'ciliaplot') {
        return pathParts[pathParts.length - 1];
    }

    return null;
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================
window.addEventListener("load", handleRouteChange);
window.addEventListener("hashchange", handleRouteChange);

document.addEventListener('DOMContentLoaded', () => {
    initGlobalEventListeners();
});

// =============================================================================
// GLOBAL UI HELPERS
// =============================================================================
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

    // Ensure search event listener
    const searchInput = document.getElementById('single-gene-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim().toUpperCase();
            const suggestionsContainer = document.getElementById('search-suggestions');
            if (query.length < 1) {
                suggestionsContainer.innerHTML = '';
                suggestionsContainer.style.display = 'none';
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
                suggestionsContainer.style.display = 'block';
            } else {
                suggestionsContainer.innerHTML = '';
                suggestionsContainer.style.display = 'none';
            }
        });
    }
}
