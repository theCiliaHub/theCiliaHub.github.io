
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
    // 1. Load the database and get the returned object with genes and the geneMap.
    // This replaces reliance on multiple global cache variables.
    const database = await loadAndPrepareDatabase();

    // Normalize the path from the URL hash.
    let path = window.location.hash.replace(/^#/, '').trim();
    if (!path || path === '/' || path === '/index.html') {
        path = '/';
    }

    // Update the active navigation link based on the current path.
    updateActiveNav(path);

    // Get all page elements to manage their visibility.
    const pages = document.querySelectorAll('.main-content-section'); // A class is better for this
    pages.forEach(page => {
        page.style.display = 'none';
    });

    const pathLowerCase = path.toLowerCase();

    // 2. The routing logic is now a single, clear switch statement.
    switch (true) {
        case pathLowerCase === '/':
            displayHomePage();
            setTimeout(displayLocalizationChart, 0); // Ensures chart renders after page is visible
            break;

        // --- THIS IS THE CRITICAL FIX ---
        // 3. Handle gene-specific pages as a primary route.
        case pathLowerCase.startsWith('/gene/'):
            const geneNameFromURL = decodeURIComponent(path.substring(6)); // Get everything after "/gene/"
            const sanitizedGeneKey = sanitize(geneNameFromURL); // Sanitize it for lookup.
            const gene = database.geneMap.get(sanitizedGeneKey); // Look it up in the correct map.

            if (gene) {
                displayIndividualGenePage(gene);
            } else {
                console.warn(`Gene not found in map for key: "${sanitizedGeneKey}"`);
                displayNotFoundPage();
            }
            break;
        // --- END OF FIX ---

        case pathLowerCase === '/batch-query' || pathLowerCase.startsWith('/batch?genes='):
            displayBatchQueryTool();
            break;

        case pathLowerCase === '/enrichment' || pathLowerCase === '/analysis':
            displayEnrichmentPage();
            break;

        case pathLowerCase === '/compare':
            displayComparePage();
            break;

        case pathLowerCase === '/expression':
            displayExpressionPage();
            break;

        case pathLowerCase === '/download':
            displayDownloadPage();
            break;

        case pathLowerCase === '/contact':
            displayContactPage();
            break;

        default:
            // If no other route matches, display the "Not Found" page.
            displayNotFoundPage();
            break;
    }
    console.log("Routing completed. Path:", path);
}


// ----------------------------
// Intercept search form submission
// ----------------------------
document.addEventListener('DOMContentLoaded', function () {
    const searchForm = document.getElementById('search-form');
    if (!searchForm) return; // safety check

    searchForm.addEventListener('submit', function (e) {
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
