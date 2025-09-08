// =================================================================
// globals.js
// This file declares global variables and controls the page router.
// IT MUST BE LOADED AFTER script.js IN YOUR HTML.
// =================================================================

// --- GLOBAL VARIABLES ---
let allGenes = [];
let geneDataCache = null;
let geneMapCache = new Map();
let currentData = [];
let searchResults = [];
const geneLocalizationData = {};
let localizationChartInstance;

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

    // This now works because loadAndPrepareDatabase is defined in script.js (loaded first)
    await loadAndPrepareDatabase();
    
    // This now works because updateActiveNav is defined in script.js
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
            // displayCiliaPlotPage(); // Make sure this function exists in script.js
            break;
        case path === '/compare':
            displayComparePage();
            break;
        case path === '/expression':
            // displayExpressionPage(); // Make sure this function exists in script.js
            break;
        case path === '/download':
            displayDownloadPage();
            break;
        case path === '/contact':
            displayContactPage();
            break;
        case !!gene:
            displayIndividualGenePage(gene);
            break;
        default:
            displayNotFoundPage();
            break;
    }
}

// --- INITIALIZATION ---

function initGlobalEventListeners() {
    // This now works because handleStickySearch is defined in script.js
    window.addEventListener('scroll', handleStickySearch);
}

// Kick off the application router and event listeners
window.addEventListener("load", handleRouteChange);
window.addEventListener("hashchange", handleRouteChange);
document.addEventListener('DOMContentLoaded', initGlobalEventListeners);
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
