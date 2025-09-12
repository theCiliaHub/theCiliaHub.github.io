// =============================================================================
// GLOBAL VARIABLES
// =============================================================================

// Data storage
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
        // Make sure database is loaded before any gene lookup
        await loadAndPrepareDatabase();
    } catch (err) {
        console.error("Database loading failed:", err);
    }

    // Initialize gene as null
    let gene = null;

    // Only try to get a gene if geneMapCache exists
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

    // Clear any residual chart elements
    const contentArea = document.querySelector('.content-area');
    const existingChart = contentArea?.querySelector('#locChart');
    if (existingChart) {
        existingChart.closest('.page-section')?.remove();
    }

    // Show the correct page
    switch (path) {
        case '/':
            displayHomePage();
            break;
        case '/batch-query':
            displayBatchQueryTool();
            break;
        case '/ciliaplot':
        case '/analysis':
            displayCiliaPlotPage();
            // If a gene was found, pass it to the plots logic
            if (gene) {
                renderDomainEnrichment([gene]);
                computeProteinComplexLinks([gene]);
            }
            break;
        case '/compare':
            displayComparePage();
            break;
        case '/expression':
            displayExpressionPage();
            break;
        case '/download':
            displayDownloadPage();
            break;
        case '/contact':
            displayContactPage();
            break;
        default:
            if (gene) {
                displayIndividualGenePage(gene);
            } else {
                displayNotFoundPage();
            }
            break;
    }

    console.log("Routing completed. Path:", path, "Gene:", gene ? gene.gene : "N/A");
}

// =============================================================================
// URL HELPERS
// =============================================================================
function getGeneFromURL() {
    // Try query string first: /ciliaplot?gene=ACTN2
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('gene');
    if (fromQuery) return fromQuery;

    // Fallback: last part of hash or path: /ciliaplot/ACTN2
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
}
