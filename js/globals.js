// ==========================================================
// globals.js
// ==========================================================

// Global variables, maps, and utilities
export const lastQueryContext = { type: null, data: [], term: null, descriptionHeader: 'Description' };
export const structureInfoMap = {}; // Map of ciliary structures
export const CiliAI = { ready: false, lookups: { geneMap: {} } };
window.CiliAI = CiliAI; // attach to global for legacy scripts

// Utility: logging
export function log(msg) {
    console.log(`[CiliAI LOG]: ${msg}`);
}

// Utility: ensure array
export function ensureArray(obj) {
    return Array.isArray(obj) ? obj : [obj];
}

// Utility: debounce
export function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// Utility: extract gene names from a query string
export function extractMultipleGenes(query) {
    if (!query) return [];
    const regex = /\b[A-Z0-9\-]{3,}\b/g;
    const matches = query.match(regex);
    return matches ? matches.map(m => m.toUpperCase()) : [];
}
