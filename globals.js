// globals.js
// =============================================================================
// GLOBAL VARIABLES
// =============================================================================

// Data storage
let allGenes = [];
let currentData = [];
let searchResults = [];
const geneLocalizationData = {};

// Plotting - Consolidated into a single instance variable
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

// Caches
window.geneDataCache = window.geneDataCache || {};
let geneMapCache = null;

function navigateTo(event, path) {
    if (event) {
        event.preventDefault();
    }
    window.location.hash = path;
}

// =============================================================================
// ROUTER (SAFE VERSION)
// =============================================================================
async function handleRouteChange() {
    let path = window.location.hash.replace(/^#/, '').toLowerCase().trim();
    if (!path || path === '/' || path === '/index.html') {
        path = '/';
    }

    try {
        await loadAndPrepareDatabase(); // Ensure database is ready
    } catch (err) {
        console.error("Database loading failed:", err);
        return; // Stop execution if DB fails
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

    // Gene lookup
    let geneToDisplay = null;

    // Show the correct page safely
    switch (path) {
        case '/':
            safeCall(window.displayHomePage);
            safeCall(window.displayLocalizationChart);
            break;
        case '/batch-query':
            safeCall(window.displayBatchQueryTool);
            break;
        case '/ciliaplot':
        case '/analysis':
            safeCall(window.displayCiliaPlotPage);
            break;
        case '/ciliai':
            safeCall(window.displayCiliAIPage);
            break;
        case '/expression':
            safeCall(window.displayExpressionPage);
            break;
        case '/download':
            safeCall(window.displayDownloadPage);
            break;
        case '/contact':
            safeCall(window.displayContactPage);
            break;
        default:
            // Handle potential gene pages
            if (geneMapCache) {
                const geneName = getGeneFromURL();
                if (geneName) {
                    const safeName = sanitize(geneName);
                    geneToDisplay = geneMapCache.get(safeName);
                }
            } else {
                console.warn("geneMapCache is not initialized yet.");
            }

            if (geneToDisplay) {
                safeCall(window.displayIndividualGenePage, geneToDisplay);
            } else {
                safeCall(window.displayNotFoundPage);
            }
            break;
    }

    console.log("Routing completed. Path:", path, "Gene:", geneToDisplay ? geneToDisplay.gene : "N/A");
}

// =============================================================================
// SAFE CALL HELPER
// =============================================================================
function safeCall(fn, ...args) {
    if (typeof fn === "function") {
        try {
            return fn(...args);
        } catch (err) {
            console.error(`Error while executing ${fn.name}:`, err);
        }
    } else {
        console.warn(`Function ${fn && fn.name ? fn.name : fn} is not defined.`);
    }
    return null;
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
        const panzoom = Panzoom(ciliaSvg, {
            maxZoom: 3,
            minZoom: 0.5,
            contain: 'outside'
        });
        ciliaSvg.parentElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            panzoom.zoom(panzoom.getScale() * (e.deltaY > 0 ? 0.9 : 1.1));
        });
    }
}
