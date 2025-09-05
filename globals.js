
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
// MODIFY YOUR EXISTING handleRouteChange FUNCTION
// Replace the existing handleRouteChange function with this enhanced version
// =============================================================================

async function handleRouteChange() {
    try {
        await loadAndPrepareDatabase(); // Ensure data is loaded
    } catch (err) {
        console.error("Database loading failed:", err);
        displayHomePage(); // Fallback to Home page
        setTimeout(displayLocalizationChart, 0);
        return;
    }

    // Normalize path
    let path = window.location.hash.replace(/^#/, '').toLowerCase().trim();
    if (!path || path === '/' || path === '/index.html') {
        path = '/';
    }

    console.log('Handling route change for path:', path);

    // Try to resolve gene from path
    let gene = null;
    if (geneMapCache && path.startsWith('/gene/')) {
        const geneName = sanitize(path.split('/').pop().replace('.html', '')).toLowerCase();
        console.log('Looking for gene with name:', geneName);
        
        // Try direct lookup
        gene = geneMapCache.get(geneName);
        
        // If not found, try case variations
        if (!gene) {
            for (let [key, value] of geneMapCache.entries()) {
                if (key.toLowerCase() === geneName) {
                    gene = value;
                    break;
                }
            }
        }
        
        if (!gene) {
            console.warn(`Gene not found in geneMapCache for name: ${geneName}`);
            console.log("Available keys in geneMapCache:", Array.from(geneMapCache.keys()).slice(0, 10));
        } else {
            console.log('Found gene:', gene.name);
        }
    } else if (!geneMapCache) {
        console.warn("geneMapCache is not initialized");
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
            // Set up search listeners when home page is displayed
            setTimeout(setupSearchListeners, 100);
            break;
        case '/batch-query':
            displayBatchQueryTool();
            break;
        case '/enrichment':
        case '/analysis':
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
                console.warn("No gene found, falling back to not found page");
                displayNotFoundPage();
            }
            break;
    }

    console.log("Routing completed. Path:", path, "Gene:", gene ? gene.name : "N/A");
}

// =============================================================================
// MODIFY YOUR EXISTING initGlobalEventListeners FUNCTION
// Add setupSearchListeners call to the existing function
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

    // ADD THIS LINE: Set up search listeners
    setupSearchListeners();
}

// =============================================================================
// DEBUGGING HELPER - Add this for troubleshooting
// =============================================================================

// Debug function to check current state
window.debugCiliaHub = function() {
    console.log('=== CiliaHub Debug Info ===');
    console.log('Current path:', window.location.hash);
    console.log('isDatabaseLoaded:', isDatabaseLoaded);
    console.log('allGenes count:', allGenes ? allGenes.length : 'undefined');
    console.log('geneMapCache size:', geneMapCache ? geneMapCache.size : 'undefined');
    
    if (geneMapCache && geneMapCache.size > 0) {
        console.log('Sample geneMapCache keys:', Array.from(geneMapCache.keys()).slice(0, 5));
    }
    
    const searchForm = document.querySelector('form');
    const searchInput = document.getElementById('geneSearch') || document.querySelector('input[type="search"]');
    console.log('Search form found:', !!searchForm);
    console.log('Search input found:', !!searchInput);
    
    console.log('=========================');
};

// Test search function
window.testGeneSearch = function(geneName) {
    console.log('Testing search for:', geneName);
    const searchInput = document.getElementById('geneSearch') || document.querySelector('input[type="search"]');
    if (searchInput) {
        searchInput.value = geneName;
        performSingleSearch();
    } else {
        console.error('Search input not found');
    }
};
