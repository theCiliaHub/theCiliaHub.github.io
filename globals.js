// globals.js
// =============================================================================
// GLOBAL STATE & CONFIGURATION
// This file defines shared variables that all other scripts can access.
// By attaching them to the 'window' object, they are explicitly made global.
// =============================================================================

// --- Data Caches ---
window.geneDataCache = null;
window.geneMapCache = null;
window.ciliaHubDataCache = null;
window.screenDataCache = null;
window.phylogenyDataCache = null;
window.tissueDataCache = null;

// --- Application State ---
window.allGenes = [];
window.currentData = [];
window.searchResults = [];
window.geneLocalizationData = {};
window.currentPlotInstance = null;

// --- Constants ---
window.ALL_PART_IDS = [
    "cell-body", "nucleus", "basal-body",
    "transition-zone", "axoneme", "ciliary-membrane"
];
window.DEFAULT_GENE_NAMES = [
    "ACE2", "ADAMTS20", "ADAMTS9", "IFT88",
    "CEP290", "WDR31", "ARL13B", "BBS1"
];

// =============================================================================
// GLOBAL UTILITY FUNCTIONS
// Self-contained helper functions that can be used by any script.
// =============================================================================

function navigateTo(event, path) {
    if (event) {
        event.preventDefault();
    }
    window.location.hash = path;
}

function getGeneFromURL() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('gene');
    if (fromQuery) return fromQuery;

    const hashPath = window.location.hash.replace(/^#/, '');
    const pathParts = hashPath.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    if (pathParts.length > 1 && lastPart) {
        if (!['ciliaplot', 'analysis', 'ciliai'].includes(lastPart.toLowerCase())) {
            return lastPart;
        }
    }
    return null;
}

// =============================================================================
// IMPORTANT: The router and event listeners were moved to script.js
// to ensure all files are loaded before the application starts.
// =============================================================================

