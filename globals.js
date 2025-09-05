
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

// CiliaHub Router Fix - Add this to your globals.js or main script file



// Enhanced route handler
function handleRouteChange() {
    const hash = window.location.hash || '#/';
    console.log('Route changed to:', hash);

    // Remove the leading '#' and split by '/'
    const pathParts = hash.substring(1).split('/');
    const route = pathParts[1] || 'home';
    const param = pathParts[2];

    console.log('Route parts:', { route, param });

    // Hide all main sections first
    const sections = ['home-section', 'gene-section', 'batch-query-section', 'about-section'];
    sections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = 'none';
        }
    });

    // Route handling
    switch (route) {
        case 'home':
        case '':
            showSection('home-section');
            break;
            
        case 'gene':
            if (param) {
                // Decode the gene name from URL
                const geneName = decodeURIComponent(param);
                console.log('Loading gene page for:', geneName);
                
                // Look for the gene in our data
                let gene = geneMapCache[geneName];
                
                if (!gene) {
                    // Try case-insensitive lookup
                    const lowerGeneName = geneName.toLowerCase();
                    for (let [key, value] of Object.entries(geneMapCache)) {
                        if (key.toLowerCase() === lowerGeneName) {
                            gene = value;
                            break;
                        }
                    }
                }
                
                if (!gene) {
                    // Try searching in allGenes array
                    gene = allGenes.find(g => {
                        const name = (g.name || g.gene_name || g.symbol || '').toLowerCase();
                        return name === geneName.toLowerCase();
                    });
                }
                
                if (gene) {
                    // Display the gene page
                    if (typeof displayIndividualGenePage === 'function') {
                        displayIndividualGenePage(gene);
                    } else {
                        console.error('displayIndividualGenePage function not found');
                        showSection('home-section');
                    }
                } else {
                    console.error('Gene not found:', geneName);
                    alert(`Gene "${geneName}" not found in database.`);
                    window.location.hash = '#/home';
                }
            } else {
                // No gene specified, redirect to home
                window.location.hash = '#/home';
            }
            break;
            
        case 'batch':
        case 'batch-query':
            showSection('batch-query-section');
            break;
            
        case 'about':
            showSection('about-section');
            break;
            
        default:
            // Unknown route, redirect to home
            console.warn('Unknown route:', route);
            window.location.hash = '#/home';
            break;
    }
}

// Helper function to show a section
function showSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
        console.log('Showing section:', sectionId);
    } else {
        console.error('Section not found:', sectionId);
    }
}

// Initialize router and search functionality
function initializeRouter() {
    console.log('Initializing CiliaHub router...');
    
    // Set up hash change listener
    window.addEventListener('hashchange', handleRouteChange);
    
    // Set up search form listener
    const searchForm = document.getElementById('search-form') || document.querySelector('form');
    const searchInput = document.getElementById('geneSearch') || document.querySelector('input[type="search"]') || document.querySelector('#search-input');
    
    if (searchForm && searchInput) {
        console.log('Setting up search form listener');
        
        // Prevent form submission and handle search
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            e.stopPropagation();
            performSingleSearch();
            return false;
        });
        
        // Also handle Enter key in search input
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSingleSearch();
            }
        });
        
    } else {
        console.warn('Search form or input not found during initialization');
        
        // Try to find search elements after DOM is fully loaded
        document.addEventListener('DOMContentLoaded', function() {
            const form = document.getElementById('search-form') || document.querySelector('form');
            const input = document.getElementById('geneSearch') || document.querySelector('input[type="search"]') || document.querySelector('#search-input');
            
            if (form && input) {
                console.log('Setting up search form listener after DOM loaded');
                
                form.addEventListener('submit', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    performSingleSearch();
                    return false;
                });
                
                input.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        performSingleSearch();
                    }
                });
            }
        });
    }
    
    // Handle initial route
    setTimeout(() => {
        handleRouteChange();
    }, 100);
}

// Auto-initialize when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeRouter);
} else {
    initializeRouter();
}

// Also expose functions globally for debugging
window.CiliaHubRouter = {
    handleRouteChange,
    performSingleSearch,
    initializeRouter
};
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
