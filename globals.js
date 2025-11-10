// =============================================================================
// GLOBAL VARIABLES
// =============================================================================

// Data storage
let allGenes = [];
let currentData = [];
let searchResults = [];
const geneLocalizationData = {};

// Global caches
window.geneDataCache = {};          // main gene data cache
window.ciliaHubDataCache = null;    // curated cilia hub data
window.screenDataCache = null;      // screen data
window.phylogenyDataCache = null;   // phylogeny data
window.tissueDataCache = null;      // tissue expression data
window.geneMapCache = null;         // mapping gene names to objects

// Access global caches locally
const geneDataCache = window.geneDataCache;
const tissueDataCache = window.tissueDataCache;

// Plotting - single instance
let currentPlotInstance = null;

// IDs and defaults
const allPartIds = [
    "cell-body", "nucleus", "basal-body",
    "transition-zone", "axoneme", "ciliary-membrane"
];
const defaultGenesNames = [
    "ACE2", "ADAMTS20", "ADAMTS9", "IFT88",
    "CEP290", "WDR31", "ARL13B", "BBS1"
];

// =============================================================================
// NAVIGATION & ROUTING
// =============================================================================
function navigateTo(event, path) {
    if (event) event.preventDefault();
    window.location.hash = path;
}

async function handleRouteChange() {
    let path = window.location.hash.replace(/^#/, '').toLowerCase().trim();
    if (!path || path === '/' || path === '/index.html') path = '/';

    try {
        await loadAndPrepareDatabase(); // Ensure DB ready
    } catch (err) {
        console.error("Database loading failed:", err);
        return;
    }

    updateActiveNav(path);

    // Hide all page containers
    const pages = [
        '#home-page', '#analysis-page', '#batch-query-page',
        '#ciliaplot-page', '#compare-page', '#expression-page',
        '#download-page', '#contact-page', '#notfound-page'
    ];
    pages.forEach(id => {
        const el = document.querySelector(id);
        if (el) el.style.display = 'none';
    });

    // --- SPA Cleanup for CiliAI ---
    clearCiliAI();

    // Determine gene to display if any
    let geneToDisplay = null;

    switch (path) {
        case '/':
            displayHomePage();
            setTimeout(() => window.displayLocalizationChart?.(), 0);
            break;
        case '/batch-query':
            displayBatchQueryTool();
            break;
        case '/ciliaplot':
        case '/analysis':
            displayCiliaPlotPage();
            break;
        case '/ciliai':
            window.displayCiliAIPage?.();
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
            if (window.geneMapCache) {
                const geneName = getGeneFromURL();
                if (geneName) {
                    const safeName = sanitize(geneName);
                    geneToDisplay = window.geneMapCache.get(safeName);
                }
            } else {
                console.warn("geneMapCache is not initialized yet.");
            }

            if (geneToDisplay) displayIndividualGenePage(geneToDisplay);
            else displayNotFoundPage();
            break;
    }

    console.log("Routing completed. Path:", path, "Gene:", geneToDisplay ? geneToDisplay.gene : "N/A");
}


// =============================================================================
// URL HELPERS
// =============================================================================
function getGeneFromURL() {
    const RESERVED_PATHS = [
        'home', 'batch-query', 'ciliaplot', 'analysis',
        'ciliai', 'expression', 'download', 'contact', 'notfound'
    ];

    // Try query string first: /ciliaplot?gene=ACTN2
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('gene');
    if (fromQuery) return fromQuery;

    // Fallback: last part of hash or path: /ciliaplot/ACTN2
    const hashPath = window.location.hash.replace(/^#/, '');
    const pathParts = hashPath.split('/');
    if (pathParts.length > 1) {
        const lastPart = pathParts[pathParts.length - 1].toLowerCase();
        if (!RESERVED_PATHS.includes(lastPart)) {
            return pathParts[pathParts.length - 1];
        }
    }

    return null; // nothing to treat as a gene
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
        Panzoom(ciliaSvg, { maxZoom: 3, minZoom: 0.5, contain: 'outside' });
        ciliaSvg.parentElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            const panzoom = Panzoom(ciliaSvg);
            panzoom.zoom(panzoom.getScale() * (e.deltaY > 0 ? 0.9 : 1.1));
        });
    }
}


// --- Clear CiliAI elements and unbind listeners ---
function clearCiliAI() {
    const aiContainer = document.querySelector('.ciliai-container');
    if (aiContainer) aiContainer.remove(); // remove the whole container

    const btn = document.getElementById('aiQueryButton');
    if (btn) btn.removeEventListener('click', handleAIQuery);

    const input = document.getElementById('aiQueryInput');
    if (input) input.removeEventListener('keypress', handleAIQueryEnterKey);

    const output = document.getElementById('query-output');
    if (output) output.innerHTML = '';
}
