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

    // Clear all chart, plot, and pagination elements
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
        const elementsToRemove = contentArea.querySelectorAll(
            '#locChart, .page-section, .plot-container-new, .chart-container, canvas, .stats-container, .legend, .pagination'
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
                renderDomainEnrichment([gene]);
                computeProteinComplexLinks([gene]);
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

    // Neutralize any dynamically added pagination buttons
    setTimeout(() => {
        const buttons = document.querySelectorAll('.pagination button');
        buttons.forEach(btn => {
            btn.style.background = 'var(--neutral-bg-alt)';
            btn.style.color = 'var(--text-dark)';
            btn.style.border = '1px solid var(--border-color)';
        });
    }, 100);

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
}
