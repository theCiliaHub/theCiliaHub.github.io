// =============================================================================
// globals.js
// =============================================================================
// This file defines global variables and controls the page routing.
// It MUST be loaded AFTER script.js in your HTML.
// =============================================================================

// --- GLOBAL VARIABLES ---
let allGenes = [];
let geneDataCache = null;
let geneMapCache = new Map();
let currentData = [];
let searchResults = [];
const geneLocalizationData = {};
let localizationChartInstance; // For Chart.js

const allPartIds = [
    "cell-body", "nucleus", "basal-body",
    "transition-zone", "axoneme", "ciliary-membrane"
];
const defaultGenesNames = [
    "ACE2", "ADAMTS20", "ADAMTS9", "IFT88",
    "CEP290", "WDR31", "ARL13B", "BBS1"
];

// --- NAVIGATION & ROUTING ---

function navigateTo(event, path) {
    if (event) {
        event.preventDefault();
    }
    window.location.hash = path;
}

async function handleRouteChange() {
    let path = window.location.hash.replace(/^#/, '').toLowerCase().trim();
    if (!path || path === '/' || path === '/index.html') {
        path = '/';
    }

    // Ensure the database is loaded before doing anything else
    await loadAndPrepareDatabase();
    
    updateActiveNav(path);

    const geneName = sanitize(path.split('/').pop());
    const isGenePath = path.startsWith('/') && geneName && !['batch-query', 'compare', 'download', 'contact', 'expression', 'ciliaplot', 'analysis', ''].includes(geneName);
    const gene = isGenePath ? geneMapCache.get(geneName) : null;

    switch (true) {
        case path === '/':
            displayHomePage();
            setTimeout(displayLocalizationChart, 0);
            break;
        case path === '/batch-query':
            displayBatchQueryTool();
            break;
        case path === '/ciliaplot' || path === '/analysis':
            displayCiliaPlotPage();
            break;
        case path === '/compare':
            displayComparePage();
            break;
        case path === '/expression':
            displayExpressionPage();
            break;
        case path === '/download':
            displayDownloadPage();
            break;
        case path === '/contact':
            displayContactPage();
            break;
        case !!gene: // If a gene object was successfully found
            displayIndividualGenePage(gene);
            break;
        default:
            displayNotFoundPage();
            break;
    }
}

// --- GLOBAL EVENT LISTENERS ---

function initGlobalEventListeners() {
    window.addEventListener('scroll', handleStickySearch);
    // Add other global listeners here if needed
}

// Kick off the application
window.addEventListener("load", handleRouteChange);
window.addEventListener("hashchange", handleRouteChange);
document.addEventListener('DOMContentLoaded', initGlobalEventListeners);
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
