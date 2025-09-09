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

function navigateTo(event, path) {
    if (event) {
        event.preventDefault();
    }
    window.location.hash = path;
}

// =============================================================================
// ROUTER
// =============================================================================
async function handleRouteChange() {
    let path = window.location.hash.replace(/^#/, '').toLowerCase().trim();
    if (!path || path === '/' || path === '/index.html') {
        path = '/';
    }

    try {
        await loadAndPrepareDatabase();
    } catch (err) {
        console.error("Database loading failed:", err);
    }

    let gene = null;
    if (geneMapCache) {
        const geneName = sanitize(path.split('/').pop().replace('.html', ''));
        gene = geneMapCache.get(geneName);
    } else {
        console.warn("geneMapCache is not initialized yet.");
    }

    updateActiveNav(path);

    // This part is likely superseded by your dynamic page functions,
    // but we will keep it as requested.
    const pages = [
        '#home-page', '#analysis-page', '#batch-query-page',
        '#ciliaplot-page', '#compare-page', '#expression-page',
        '#download-page', '#contact-page', '#notfound-page'
    ];
    pages.forEach(id => {
        const el = document.querySelector(id);
        if (el) el.style.display = 'none';
    });

    switch (path) {
        case '/':
            displayHomePage();
            setTimeout(displayLocalizationChart, 0);
            break;
        case '/batch-query':
            displayBatchQueryTool();
            break;
        case '/ciliaplot':
        case '/analysis':
            displayCiliaPlotPage();
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
window.addEventListener("load", handleRouteChange);
window.addEventListener("hashchange", handleRouteChange);

document.addEventListener('DOMContentLoaded', () => {
    initGlobalEventListeners();
});

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

// =============================================================================
// PAGE RENDERER (MODIFIED TO RENDER THE NEW UI DESIGN)
// =============================================================================
function displayCiliaPlotPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    if (document.querySelector('.cilia-panel')) {
        document.querySelector('.cilia-panel').style.display = 'none';
    }

    // This function now generates the complete, updated CiliaPlot UI
    contentArea.innerHTML = `
    <div class="page-section ciliaplot-page">
        <div class="ciliaplot-header">
            <h1>CiliaPlot Gene Set Analysis</h1>
            <div class="info">
                <strong>Interactive Gene Analysis:</strong> Enter a gene list to generate visualizations. Use the controls to select an analysis type and customize the appearance. Download publication-ready plots in PNG or PDF format.
            </div>
        </div>

        <div class="ciliaplot-container-new">
            <div class="ciliaplot-left-panel-new">
                <div class="control-section">
                    <h3>1. Input Genes</h3>
                    <div class="control-section-content">
                        <textarea id="ciliaplot-genes-input" placeholder="Enter one gene per line..."></textarea>
                    </div>
                </div>
                <div class="control-section">
                    <h3>2. Select Analysis</h3>
                    <div class="control-section-content">
                        <div class="plot-option"><label><input type="radio" name="plot-type" value="bubble" checked> Key Localizations</label></div>
                        <div class="plot-option"><label><input type="radio" name="plot-type" value="matrix"> Gene Matrix</label></div>
                        <div class="plot-option"><label><input type="radio" name="plot-type" value="enrichment_factor"> Domain Enrichment</label></div>
                        <div class="plot-option"><label><input type="radio" name="plot-type" value="multi_dim_network"> Gene Network</label></div>
                    </div>
                </div>
                <div class="control-section">
                     <h3>3. Customize Plot</h3>
                     <details id="plot-customization-details"><summary>Expand Options</summary>
                         <div class="control-section-content" id="plot-settings-grid">
                            <div><label>Main Title <input type="text" id="setting-main-title" value="CiliaHub Analysis"></label></div>
                            <div><label>X-Axis Title <input type="text" id="setting-x-axis-title" value="X-Axis"></label></div>
                            <div><label>Y-Axis Title <input type="text" id="setting-y-axis-title" value="Y-Axis"></label></div>
                            <div><label>Font <select id="setting-font-family"><option>Arial</option><option>Verdana</option><option>Times New Roman</option></select></label></div>
                            <div><label>Title Font Size <input type="number" id="setting-title-font-size" value="18" step="1"></label></div>
                            <div><label>Axis Font Size <input type="number" id="setting-axis-title-font-size" value="14" step="1"></label></div>
                            <div><label>Tick Font Size <input type="number" id="setting-tick-font-size" value="12" step="1"></label></div>
                            <div><label>Background <input type="color" id="setting-bg-color" value="#ffffff"></label></div>
                            <div><label>Font Color <input type="color" id="setting-font-color" value="#333333"></label></div>
                            <div><label>Gridline Color <input type="color" id="setting-grid-color" value="#e0e0e0"></label></div>
                            <div><label><input type="checkbox" id="setting-show-grid" checked> Show Gridlines</label></div>
                         </div>
                     </details>
                </div>
                <div class="control-section">
                    <h3>4. Generate & Download</h3>
                    <div class="control-section-content">
                        <button id="generate-plot-btn" class="btn btn-primary" style="width: 100%; margin-bottom: 10px;">Run Analysis</button>
                        <select id="download-format" style="width:100%;padding:8px;margin-bottom:10px;"><option value="png">PNG</option><option value="pdf">PDF</option></select>
                        <button id="download-plot-btn" class="btn btn-secondary" style="width: 100%;">Download Plot</button>
                    </div>
                </div>
            </div>

            <div class="ciliaplot-right-panel-new">
                <div id="ciliaplot-stats-container" class="stats-container">
                    </div>
                <div id="plot-display-area" class="plot-container-new">
                    <p class="status-message">Enter a gene list and click "Run Analysis" to see your results.</p>
                </div>
                <div id="ciliaplot-legend-container" class="legend">
                    </div>
                 <div id="ciliaplot-results-container" class="results-section" style="margin-top: 2rem;">
                    </div>
            </div>
        </div>
    </div>`;

    // Re-attach event listeners
    document.getElementById('generate-plot-btn').addEventListener('click', generateAnalysisPlots);
    document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
    
    document.querySelectorAll('input[name="plot-type"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const plotArea = document.getElementById('plot-display-area');
            if (plotArea && !plotArea.querySelector('.status-message')) {
                generateAnalysisPlots();
            }
        });
    });
}
