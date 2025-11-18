/* globals.js - Global Utilities & Routing (v5.5) */

(function() {
    'use strict';

    // =============================================================================
    // GLOBAL VARIABLES & CACHES
    // =============================================================================
    window.geneDataCache = {};          
    window.ciliaHubDataCache = null;    
    window.screenDataCache = null;      
    window.phylogenyDataCache = null;   
    window.tissueDataCache = null;      
    window.geneMapCache = null;         

    // =============================================================================
    // ROUTING LOGIC
    // =============================================================================

    async function handleRouteChange() {
        let path = window.location.hash.replace(/^#/, '').toLowerCase().trim();
        if (!path || path === '/' || path === '/index.html') path = '/';

        console.log(`[Router] Navigating to: ${path}`);

        // 1. Hide all legacy page containers (if they exist)
        const pages = [
            '#home-page', '#analysis-page', '#batch-query-page',
            '#ciliaplot-page', '#compare-page', '#expression-page',
            '#download-page', '#contact-page', '#notfound-page'
        ];
        pages.forEach(id => {
            const el = document.querySelector(id);
            if (el) el.style.display = 'none';
        });

        // 2. Specific Route Handling
        switch (path) {
            case '/ciliai':
            case '/': // Default to CiliAI for this unified view
                // Ensure CiliAI layout is active
                if (window.displayCiliAIPage) {
                    await window.displayCiliAIPage();
                }
                // Ensure Data is loaded
                if (window.loadCiliAIData && (!window.CiliAI || !window.CiliAI.ready)) {
                    await window.loadCiliAIData();
                }
                break;

            default:
                console.warn("Route not handled in Unified Explorer:", path);
                // Fallback to CiliAI
                if (window.displayCiliAIPage) await window.displayCiliAIPage();
                break;
        }
    }

    // =============================================================================
    // EVENT LISTENERS
    // =============================================================================

    function initGlobalEventListeners() {
        // Listen for URL hash changes
        window.addEventListener('hashchange', handleRouteChange);
        
        // Optional: Global key listeners or analytics hooks can go here
    }

    // =============================================================================
    // INITIALIZATION
    // =============================================================================
    
    // Wait for DOM before attaching listeners
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initGlobalEventListeners();
            handleRouteChange(); // Trigger initial route
        });
    } else {
        initGlobalEventListeners();
        handleRouteChange();
    }

    // Expose helper for manual navigation
    window.navigateTo = function(event, path) {
        if (event) event.preventDefault();
        window.location.hash = path;
    };

    // Global sanitization helper
    window.sanitize = function(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, function(m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
    };

})();
