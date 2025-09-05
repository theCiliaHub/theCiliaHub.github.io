
// globals.js
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


/**
 * Handles SPA navigation by updating the URL hash.
 * This triggers the 'hashchange' event listener, which calls handleRouteChange.
 * @param {Event | null} event - The click event, used to prevent default link behavior.
 * @param {string} path - The new path to navigate to (e.g., '/', '/ACE2').
 */
function navigateTo(event, path) {
    if (event) {
        event.preventDefault(); // Prevents the browser from reloading the page
    }
    // Set the new hash, which will be detected by the 'hashchange' event listener
    window.location.hash = path;
}


// =============================================================================
// ROUTER
// =============================================================================
async function handleRouteChange() {
    // Normalize path
    let path = window.location.hash.replace(/^#/, '').toLowerCase().trim();
    if (!path || path === '/' || path === '/index.html') {
        path = '/';
    }

    // Load database if not loaded
    try {
        await loadAndPrepareDatabase(); // must populate geneMapCache + geneDataCache
    } catch (err) {
        console.error("Database loading failed:", err);
        console.log("DEBUG hash:", window.location.hash);
        console.log("DEBUG path:", path);
    }

    // Try to resolve gene from path
    let gene = null;
    if (geneMapCache) {
        const geneName = sanitize(path.split('/').pop().replace('.html', ''));
        gene = geneMapCache.get(geneName);
    } else {
        console.warn("geneMapCache is not initialized yet.");
    }

    // Update active nav item
    updateActiveNav(path);

    // Hide all main content sections
    const pages = [
        '#home-page', '#analysis-page', '#batch-query-page',
        '#enrichment-page', '#compare-page', '#expression-page',
        '#download-page', '#contact-page', '#notfound-page'
    ];
    pages.forEach(id => {
        const el = document.querySelector(id);
        if (el) el.style.display = 'none';
    });

    // Show the correct page
    switch (path) {
        case '/':
            displayHomePage();
            setTimeout(displayLocalizationChart, 0);
            break;
        case '/batch-query':
            displayBatchQueryTool();
            break;
        case '/enrichment':
        case '/analysis': // handle both routes
            displayEnrichmentPage();
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

    console.log("Routing completed. Path:", path, "Gene:", gene ? gene.name : "N/A");
}

// ----------------------------
// Intercept search form submission
// ----------------------------
document.getElementById('search-form').addEventListener('submit', function (e) {
    e.preventDefault(); // prevent default form submit

    const searchTerm = document.getElementById('search-input').value.trim();
    if (!searchTerm) return;

    // Split by comma, semicolon, or space
    const genes = searchTerm.split(/[\s,;]+/).filter(Boolean);

    // Redirect depending on number of genes
    if (genes.length === 1) {
        // Single gene -> gene page
        window.location.hash = `#/gene/${encodeURIComponent(genes[0])}`;
    } else {
        // Multiple genes -> batch query
        window.location.hash = `#/batch?genes=${encodeURIComponent(genes.join(","))}`;
    }
});


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
    // Sticky search handler
    window.addEventListener('scroll', handleStickySearch);

    // Keyboard interaction for .cilia-part elements
    document.querySelectorAll('.cilia-part').forEach(part => {
        part.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                part.classList.toggle('highlighted');
            }
        });
    });

    // Panzoom setup for interactive cilium
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
