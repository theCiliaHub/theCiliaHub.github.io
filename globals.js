'use strict';

// =============================================================================
// GLOBAL VARIABLES & STATE
// =============================================================================

// Data Storage - These are used by multiple scripts
let allGenes = [];
let geneDataCache = null;
let geneMapCache = null;
let pfamNameMap = new Map();
const geneLocalizationData = {};

// Plotting - Holds the active plot instance for a page
let currentPlotInstance = null;

// IDs and defaults for other parts of the site
const allPartIds = [
    "cell-body", "nucleus", "basal-body",
    "transition-zone", "axoneme", "ciliary-membrane"
];
const defaultGenesNames = [
    "ACE2", "ADAMTS20", "ADAMTS9", "IFT88",
    "CEP290", "WDR31", "ARL13B", "BBS1"
];

// =============================================================================
// GLOBAL NAVIGATION UTILITY
// =============================================================================

/**
 * Handles SPA navigation by updating the URL hash.
 * This triggers the 'hashchange' event listener in script.js.
 */
function navigateTo(event, path) {
    if (event) {
        event.preventDefault();
    }
    window.location.hash = path;
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
