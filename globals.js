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

// Flag to prevent multiple database loads
let isDatabaseLoaded = false;

// =============================================================================
// DATABASE LOADING (Placeholder for actual implementation)
// =============================================================================
async function loadAndPrepareDatabase() {
    if (isDatabaseLoaded) return; // Prevent reloading
    try {
        // Placeholder: Fetch gene data and populate allGenes and geneMapCache
        // Example: const response = await fetch('data/genes.json');
        // allGenes = await response.json();
        // geneMapCache = new Map(allGenes.map(g => [g.name.toLowerCase(), g]));
        // geneDataCache = ...;
        console.log("Database loaded");
        isDatabaseLoaded = true;
    } catch (err) {
        console.error("Failed to load database:", err);
        isDatabaseLoaded = false;
        throw err;
    }
}

// =============================================================================
// NAVIGATION
// =============================================================================
function navigateTo(event, path) {
    if (event) {
        event.preventDefault(); // Prevents browser reload
    }
    window.location.hash = path;
}

// Sanitize input to prevent injection (basic implementation)
function sanitize(input) {
    return input.replace(/[<>&;]/g, '');
}

// Update active navigation item
function updateActiveNav(path) {
    // Placeholder: Update nav UI to reflect active route
    console.log("Updating nav for path:", path);
}

// =============================================================================
// ROUTER
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

    // Try to resolve gene from path
    let gene = null;
    if (geneMapCache && path.startsWith('/gene/')) {
        const geneName = sanitize(path.split('/').pop().replace('.html', ''));
        gene = geneMapCache.get(geneName.toLowerCase());
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
                displayNotFoundPage();
            }
            break;
    }

    console.log("Routing completed. Path:", path, "Gene:", gene ? gene.name : "N/A");
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================
window.addEventListener('load', async () => {
    await handleRouteChange();
});

window.addEventListener('hashchange', async () => {
    await handleRouteChange();
});

document.addEventListener('DOMContentLoaded', async () => {
    await loadAndPrepareDatabase();
    initGlobalEventListeners();
    await handleRouteChange();
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

// Placeholder for sticky search handler
function handleStickySearch() {
    // Placeholder: Implement sticky search bar logic
    console.log("Handling sticky search");
}
