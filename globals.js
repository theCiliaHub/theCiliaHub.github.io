// =============================================================================
// globals.js
// =============================================================================

// -------------------------------
// GLOBAL VARIABLES
// -------------------------------
let allGenes = [];
let currentData = [];
let searchResults = [];
const geneLocalizationData = {};

let currentPlot = null;

let localizationChartInstance;
let analysisDotPlotInstance;
let analysisBarChartInstance;

const allPartIds = [
    "cell-body", "nucleus", "basal-body",
    "transition-zone", "axoneme", "ciliary-membrane"
];
const defaultGenesNames = [
    "ACE2", "ADAMTS20", "ADAMTS9", "IFT88",
    "CEP290", "WDR31", "ARL13B", "BBS1"
];

let geneDataCache = null;
let geneMapCache = null;

// -------------------------------
// ROUTER
// -------------------------------
async function handleRouteChange() {
    let path = window.location.hash.replace(/^#/, '').toLowerCase().trim();
    if (!path || path === '/' || path === '/index.html') path = '/';

    try {
        await loadAndPrepareDatabase();
    } catch (err) {
        console.error("Database loading failed:", err);
    }

    let gene = null;
    if (geneMapCache) {
        const geneName = sanitize(path.split('/').pop().replace('.html', ''));
        gene = geneMapCache.get(geneName);
    } else {
        console.warn("geneMapCache is not initialized yet.");
    }

    updateActiveNav(path);

    // Hide all pages before displaying the correct one
    hideAllPages();

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
         case '/ciliAI':
        displayCiliAIPage();
        break;
        default:
            if (gene) {
                displayIndividualGenePage(gene);
            } else {
                displayNotFoundPage();
            }
            break;
    }
    console.log("Routing completed. Path:", path, "Gene:", gene ? gene.name : "N/A");
}

// -------------------------------
// EVENT LISTENERS
// -------------------------------
window.addEventListener("load", handleRouteChange);
window.addEventListener("hashchange", handleRouteChange);

document.addEventListener('DOMContentLoaded', () => {
    initGlobalEventListeners();
});

// -------------------------------
// GLOBAL UI HELPERS
// -------------------------------
function initGlobalEventListeners() {
    window.addEventListener('scroll', handleStickySearch);

    document.querySelectorAll('.cilia-part').forEach(part => {
        part.addEventListener('keydown', (e) => {});
    });

    const ciliaSvg = document.querySelector('.interactive-cilium svg');
    if (ciliaSvg) {
        Panzoom(ciliaSvg, {
            maxZoom: 3,
            minZoom: 0.5,
            contain: 'outside'
        });
        ciliaSvg.parentElement.addEventListener('wheel', (e) => {});
    }
}

// -------------------------------
// NAVIGATION HELPERS
// -------------------------------
function navigateTo(event, path) {}
function navigateToGenePage(geneName) {}

// -------------------------------
// DATABASE & SEARCH HELPERS
// -------------------------------
async function loadAndPrepareDatabase() {}
function sanitize(str) { return str; }
function updateActiveNav(path) {}

// -------------------------------
// PAGE DISPLAY HELPERS
// -------------------------------
function hideAllPages() {}
function displayHomePage() {}
function displayBatchQueryTool() {}
function displayCiliaPlotPage() {}
function displayComparePage() {}
function displayExpressionPage() {}
function displayDownloadPage() {}
function displayContactPage() {}
function displayCiliAIPage() {}
function displayIndividualGenePage(gene) {}
function displayNotFoundPage() {}

// -------------------------------
// UI & INTERACTIVE HELPERS
// -------------------------------
function handleStickySearch() {}
