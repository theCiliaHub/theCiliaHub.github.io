// =============================================================================
// CiliaHub - Final Integrated Script
// =============================================================================

// =============================================================================
// GLOBAL VARIABLES AND PLUGINS
// =============================================================================

const geneLocalizationData = {};
let allGenes = [];
let currentData = [];
let searchResults = [];
let localizationChartInstance;
let analysisDotPlotInstance;
let analysisBarChartInstance;
const allPartIds = ["cell-body", "nucleus", "basal-body", "transition-zone", "axoneme", "ciliary-membrane"];
const defaultGenesNames = ["ACE2", "ADAMTS20", "ADAMTS9", "IFT88", "CEP290", "WDR31", "ARL13B", "BBS1"];

let geneDataCache = null;
let geneMapCache = null;

Chart.register({
  id: 'customCanvasBackgroundColor',
  beforeDraw: (chart, args, options) => {
    if (options.color) {
        const {ctx} = chart;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = options.color;
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
    }
  }
});

// =============================================================================
// DATA SANITIZATION & MANAGEMENT
// =============================================================================

function sanitize(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim().toUpperCase();
}

async function loadAndPrepareDatabase() {
    if (geneDataCache) return true;
    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/ciliahub_data.json');
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const rawGenes = await response.json();
        
        allGenes = rawGenes.map(gene => {
            if (gene.gene) {
                gene.gene = gene.gene.trim().replace(/(\r\n|\n|\r)/gm, "");
            }
            return gene;
        });
        geneDataCache = allGenes;

        const map = new Map();
        allGenes.forEach(gene => {
            const saneGene = sanitize(gene.gene);
            if (saneGene) map.set(saneGene, gene);
            if (gene.synonym) {
                gene.synonym.split(',').forEach(syn => {
                    const saneSyn = sanitize(syn);
                    if (saneSyn && !map.has(saneSyn)) map.set(saneSyn, gene);
                });
            }
        });
        geneMapCache = map;

        allGenes.forEach(gene => {
            if (gene.localization && gene.gene) {
                geneLocalizationData[gene.gene] = mapLocalizationToSVG(gene.localization);
            }
        });
        currentData = allGenes.filter(g => defaultGenesNames.includes(g.gene));
        console.log('Data loaded and sanitized successfully.');
        return true;
    } catch (error) {
        console.error("Failed to load and prepare gene database:", error);
        allGenes = [...getDefaultGenes()];
        currentData = [...allGenes];
        createGeneMap(allGenes);
        return false;
    }
}

function findGenes(queries) {
    const foundGenes = new Set();
    const notFound = [];
    if (!geneMapCache) {
        console.error("Gene map is not ready for searching.");
        return { foundGenes: [], notFoundGenes: queries };
    }
    queries.forEach(query => {
        const result = geneMapCache.get(query);
        if (result) {
            foundGenes.add(result);
        } else {
            notFound.push(query);
        }
    });
    return { foundGenes: Array.from(foundGenes), notFoundGenes: notFound };
}

function createGeneMap(geneData) {
    const map = new Map();
    geneData.forEach(gene => {
        const saneGene = sanitize(gene.gene);
        if (saneGene) map.set(saneGene, gene);
        if (gene.synonym) {
            gene.synonym.split(',').forEach(syn => {
                const saneSyn = sanitize(syn);
                if (saneSyn && !map.has(saneSyn)) map.set(saneSyn, gene);
            });
        }
    });
    geneMapCache = map;
}


// =============================================================================
// SEARCH FUNCTIONS
// =============================================================================

function performBatchSearch() {
    const inputElement = document.getElementById('batch-genes-input');
    const resultDiv = document.getElementById('batch-results');
    if (!inputElement || !resultDiv) return;

    const queries = inputElement.value.split(/[\s,;\n\r\t]+/).map(sanitize).filter(Boolean);
    if (queries.length === 0) {
        resultDiv.innerHTML = '<p class="status-message error-message">Please enter one or more gene names.</p>';
        return;
    }

    const { foundGenes, notFoundGenes } = findGenes(queries);
    displayBatchResults(foundGenes, notFoundGenes);
}

function performSingleSearch() {
    const query = sanitize(document.getElementById('single-gene-search')?.value || '');
    const statusDiv = document.getElementById('status-message');
    if (!statusDiv) return;
    
    statusDiv.style.display = 'block';
    if (!query) {
        statusDiv.innerHTML = `<span class="error-message">Please enter a gene name.</span>`;
        return;
    }
    statusDiv.innerHTML = '<span>Searching...</span>';

    const { foundGenes } = findGenes([query]);

    if (foundGenes.length === 1) {
        navigateTo(null, `/${foundGenes[0].gene}`);
    } else if (foundGenes.length > 1) {
        navigateTo(null, '/batch-query');
        setTimeout(() => {
            const batchInput = document.getElementById('batch-genes-input');
            if (batchInput) {
                batchInput.value = foundGenes.map(r => r.gene).join('\n');
                performBatchSearch();
            }
        }, 100);
    } else {
        const partialMatches = allGenes.filter(g => 
            (g.gene && g.gene.toUpperCase().includes(query)) ||
            (g.synonym && g.synonym.toUpperCase().includes(query))
        );

        if (partialMatches.length === 0) {
            statusDiv.innerHTML = `<span class="error-message">No gene found matching "${query}".</span>`;
        } else {
            navigateTo(null, '/batch-query');
            setTimeout(() => {
                const batchInput = document.getElementById('batch-genes-input');
                if (batchInput) {
                    batchInput.value = partialMatches.map(r => r.gene).join('\n');
                    performBatchSearch();
                }
            }, 100);
        }
    }
}


// =============================================================================
// ROUTING AND PAGE DISPLAY
// =============================================================================

async function handleRouteChange() {
    await loadAndPrepareDatabase();
    const path = window.location.hash.replace('#', '').toLowerCase() || '/';
    const geneName = sanitize(path.split('/').pop().replace('.html', ''));
    const gene = geneMapCache ? geneMapCache.get(geneName) : null;
    
    updateActiveNav(path);
    
    // Default to a visible state for the cilia panel
    const ciliaPanel = document.querySelector('.cilia-panel');
    if (ciliaPanel) ciliaPanel.style.display = 'block';

    if (path === '/' || path === '/index.html' || path === '') {
        displayHomePage();
    } else if (path === '/batch-query') {
        displayBatchQueryTool();
    } else if (path === '/compare') {
        displayComparePage();
    } else if (path === '/expression') {
        displayExpressionPage();
    } else if (path === '/analysis') {
        displayAnalysisPage();
    } else if (path === '/download') {
        displayDownloadPage();
    } else if (path === '/contact') {
        displayContactPage();
    } else if (gene) {
        displayIndividualGenePage(gene);
    } else {
        displayNotFoundPage();
    }
}

function displayHomePage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area';
    contentArea.innerHTML = `
        <div class="page-section">
            <h1>The CiliaHub: A Database of Genes with Ciliary Functions</h1>
            <p style="font-size: 1.1rem; color: #555;">CiliaHub is an advanced bioinformatics platform that hosts a detailed database of gold standard cilia genes and their role in various ciliopathies. Our comprehensive collection includes the most reliable and well-established genes linked to ciliary function, with reference papers also provided. With our user-friendly search tool, researchers can explore genome-wide data, focusing on both known and novel ciliary genes. Discover their contributions to the biology of cilia and the mechanisms behind ciliary-related disorders. Search for a single gene below or use the Batch Query tool to analyze multiple genes.</p>
            <div class="search-container">
                <div class="search-wrapper" style="flex: 1;">
                    <input type="text" id="single-gene-search" placeholder="Search for a single gene (e.g., ACE2, IFT88)" aria-label="Search for a single gene" autocomplete="off">
                </div>
                <button id="single-search-btn" class="search-btn btn btn-primary">Search</button>
            </div>
            <div id="status-message" class="status-message" style="display: none;"></div>
            <div id="gene-cards-container" class="gene-cards"></div>
        </div>`;
    
    document.getElementById('single-search-btn').onclick = performSingleSearch;
    displayGeneCards(currentData, [], 1, 10);
    setTimeout(displayLocalizationChart, 0);
}

function displayBatchQueryTool() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area';
    contentArea.innerHTML = `
        <div class="page-section">
            <h2>Batch Gene Query</h2>
            <p style="font-size: 1rem; color: #555;">Enter multiple gene names (comma, space, or newline separated) OR upload a CSV file.</p>
            <textarea id="batch-genes-input" placeholder="e.g., ACE2, IFT88, CEP290" aria-label="Enter multiple gene names" style="width: 100%; min-height: 150px;"></textarea>
            <div style="margin-top: 1rem;">
                <label for="csv-upload" style="font-weight: 600;">Or upload CSV file:</label>
                <input type="file" id="csv-upload" accept=".csv" />
            </div>
            <button id="batch-search-btn" class="search-btn btn btn-primary">Search Genes</button>
            <button id="export-results-btn" class="search-btn btn btn-primary" style="margin-left: 1rem;">Export Results</button>
            <div id="batch-results" style="margin-top: 2rem;"></div>
        </div>`;
    
    document.getElementById('csv-upload').addEventListener('change', handleCSVUpload);
    document.getElementById('batch-search-btn').onclick = performBatchSearch;
    document.getElementById('export-results-btn').onclick = exportSearchResults;
}

function displayBatchResults(foundGenes, notFoundGenes) {
    const resultDiv = document.getElementById('batch-results');
    if (!resultDiv) return;
    let html = `<h3>Search Results (${foundGenes.length} gene${foundGenes.length !== 1 ? 's' : ''} found)</h3>`;
    if (foundGenes.length > 0) {
        html += '<table><thead><tr><th>Gene</th><th>Ensembl ID</th><th>Localization</th><th>Function Summary</th></tr></thead><tbody>';
        foundGenes.forEach(item => {
            html += `<tr>
                <td><a href="/#/${item.gene}" onclick="navigateTo(event, '/${item.gene}')">${item.gene}</a></td>
                <td>${item.ensembl_id || '-'}</td>
                <td>${item.localization || '-'}</td>
                <td>${item.functional_summary ? item.functional_summary.substring(0, 100) + '...' : '-'}</td>
            </tr>`;
        });
        html += '</tbody></table>';
    }
    if (notFoundGenes && notFoundGenes.length > 0) {
        html += `<div style="margin-top: 20px; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"><h4>Genes Not Found (${notFoundGenes.length}):</h4><p>${notFoundGenes.join(', ')}</p></div>`;
    }
    resultDiv.innerHTML = html;
}


// =============================================================================
// ANALYSIS PAGE PLOTTING & DOWNLOAD
// =============================================================================

function displayAnalysisPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    document.querySelector('.cilia-panel').style.display = 'none';
    contentArea.innerHTML = `
        <div class="page-section">
            <h2>Gene Localization Analysis</h2>
            <p>Paste a list of human gene names to visualize their localization data.</p>
            <textarea id="analysis-genes-input" placeholder="e.g., TMEM17, IFT88, WDR31..." style="width: 100%; min-height: 150px; padding: 1rem; border: 2px solid #e1ecf4; border-radius: 10px; font-size: 1rem; margin-top: 1rem; resize: vertical;"></textarea>
            
            <div id="analysis-controls" style="margin-top: 1rem; display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                <div>
                    <strong>Plot Type:</strong>
                    <input type="radio" id="plot-bubble" name="plot-type" value="bubble" checked>
                    <label for="plot-bubble" style="margin-right: 10px;">Enrichment</label>
                    <input type="radio" id="plot-matrix" name="plot-type" value="matrix">
                    <label for="plot-matrix" style="margin-right: 10px;">Gene Matrix</label>
                    <input type="radio" id="plot-upset" name="plot-type" value="upset">
                    <label for="plot-upset">Set Overlaps (Upset)</label>
                </div>
                <button id="generate-plot-btn" class="btn btn-primary">Generate Plot</button>
                <button id="download-plot-btn" class="btn btn-secondary" style="display:none;">Download Plot</button>
            </div>

            <details style="margin-top: 20px; border: 1px solid #e1ecf4; border-radius: 5px; padding: 10px;">
                <summary style="font-weight: bold; cursor: pointer;">Plot Customization</summary>
                <div id="plot-settings-panel" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 10px;">
                    <div>
                        <label for="setting-font-family" style="display: block; margin-bottom: 5px;">Font Family</label>
                        <select id="setting-font-family"><option value="Arial">Arial</option><option value="Tahoma">Tahoma</option><option value="Times New Roman">Times New Roman</option></select>
                    </div>
                    <div>
                        <label for="setting-font-size" style="display: block; margin-bottom: 5px;">Label Font Size</label>
                        <input type="number" id="setting-font-size" value="12" min="8" max="20" style="width: 60px;">
                    </div>
                    <div>
                        <label for="setting-font-weight" style="display: block; margin-bottom: 5px;">Label Weight</label>
                        <select id="setting-font-weight"><option value="normal">Normal</option><option value="bold" selected>Bold</option></select>
                    </div>
                </div>
            </details>

            <div id="analysis-status" class="status-message" style="display: none; padding: 1rem;"></div>
            
            <div id="plot-container" style="display:none; margin-top: 2rem;">
                <div id="bubble-enrichment-container" style="display: flex; align-items: flex-start; gap: 20px;">
                    <div class="plot-wrapper" style="position: relative; height: 600px; flex-grow: 1;"><canvas id="analysis-bubble-plot"></canvas></div>
                    <div id="legend-container" style="flex-shrink: 0; width: 150px; padding-top: 50px;"></div>
                </div>
                <div id="matrix-plot-container" style="display: none;">
                     <div class="plot-wrapper" style="position: relative; height: 600px;"><canvas id="analysis-matrix-plot"></canvas></div>
                </div>
                <div id="upset-plot-container" style="display: none;">
                     <div id="upset-plot-wrapper"></div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('generate-plot-btn').addEventListener('click', generateAnalysisPlots);
    document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
}

function getPlotSettings() {
    return {
        fontFamily: document.getElementById('setting-font-family')?.value || 'Arial',
        fontSize: parseInt(document.getElementById('setting-font-size')?.value, 10) || 12,
        fontWeight: document.getElementById('setting-font-weight')?.value || 'bold',
    };
}

function generateAnalysisPlots() {
    ['bubble-enrichment-container', 'matrix-plot-container', 'upset-plot-container'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    document.getElementById('download-plot-btn').style.display = 'none';
    const statusDiv = document.getElementById('analysis-status');
    if (statusDiv) statusDiv.style.display = 'none';

    const input = document.getElementById('analysis-genes-input').value || '';
    const geneNames = input.split(/[\s,;\n]+/).map(sanitize).filter(Boolean);
    if (geneNames.length === 0) return;

    const { foundGenes, notFoundGenes } = findGenes(geneNames);
    if (foundGenes.length === 0) {
        if(statusDiv) {
            statusDiv.innerHTML = `<span class="error-message">None of the entered genes were found.</span>`;
            statusDiv.style.display = 'block';
        }
        return;
    }
    
    document.getElementById('plot-container').style.display = 'block';
    
    const selectedPlot = document.querySelector('input[name="plot-type"]:checked').value;
    if (selectedPlot === 'bubble') {
        renderEnrichmentBubblePlot(foundGenes);
    } else if (selectedPlot === 'matrix') {
        renderBubbleMatrix(foundGenes);
    } else if (selectedPlot === 'upset') {
        renderUpsetPlot(foundGenes);
    }
    
    document.getElementById('download-plot-btn').style.display = 'inline-block';
}

function renderEnrichmentBubblePlot(foundGenes) {
    document.getElementById('bubble-enrichment-container').style.display = 'flex';
    if (window.analysisDotPlotInstance) window.analysisDotPlotInstance.destroy();
    
    const settings = getPlotSettings();
    const yCategories = [ 'Cilia', 'Basal Body', 'Transition Zone', 'Axoneme', 'Ciliary Membrane', 'Lysosome', 'Peroxisome', 'Plasma Membrane', 'Cytoplasm', 'Nucleus', 'Endoplasmic Reticulum', 'Mitochondria', 'Ribosome', 'Golgi' ];
    const localizationCounts = {};
    foundGenes.forEach(gene => {
        (gene.localization || '').split(',').forEach(loc => {
            const matchingCategory = yCategories.find(cat => cat.toLowerCase() === loc.trim().toLowerCase());
            if (matchingCategory) {
                localizationCounts[matchingCategory] = (localizationCounts[matchingCategory] || 0) + 1;
            }
        });
    });

    const categoriesWithData = yCategories.filter(cat => localizationCounts[cat] > 0);
    if (categoriesWithData.length === 0) return;

    const maxCount = Math.max(...Object.values(localizationCounts), 1);
    const colorPalette = ['#edf8fb', '#b2e2e2', '#66c2a4', '#2ca25f', '#006d2c'];
    const getColor = count => {
        if (count === 0) return '#f0f0f0';
        const ratio = maxCount > 1 ? (count - 1) / (maxCount - 1) : 1;
        const index = Math.min(Math.floor(ratio * (colorPalette.length - 1)), colorPalette.length - 1);
        return colorPalette[index];
    };
    const getRadius = count => 8 + (count / maxCount) * 12;

    const dataset = {
        data: categoriesWithData.map(loc => ({ x: 0, y: loc, r: getRadius(localizationCounts[loc]), count: localizationCounts[loc] })),
        backgroundColor: categoriesWithData.map(loc => getColor(localizationCounts[loc]))
    };
    
    const legendContainer = document.getElementById('legend-container');
    if (legendContainer) {
        const midCount = Math.ceil(maxCount / 2);
        const sizeLegendHTML = `
            <div style="font-family: ${settings.fontFamily};">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">Gene Count</h4>
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <div style="width: ${getRadius(maxCount)*2}px; height: ${getRadius(maxCount)*2}px; background-color: #ccc; border-radius: 50%; margin-right: 10px;"></div>
                    <span>${maxCount}</span>
                </div>
                ${ midCount > 1 && midCount < maxCount ? `
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <div style="width: ${getRadius(midCount)*2}px; height: ${getRadius(midCount)*2}px; background-color: #ccc; border-radius: 50%; margin-right: 10px;"></div>
                    <span>${midCount}</span>
                </div>` : '' }
                <div style="display: flex; align-items: center; margin-bottom: 25px;">
                    <div style="width: ${getRadius(1)*2}px; height: ${getRadius(1)*2}px; background-color: #ccc; border-radius: 50%; margin-right: 10px;"></div>
                    <span>1</span>
                </div>
                <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">Enrichment</h4>
                <div style="width: 100%; height: 20px; background: linear-gradient(to right, ${colorPalette.join(', ')}); border: 1px solid #ccc;"></div>
                <div style="display: flex; justify-content: space-between; font-size: 12px;">
                    <span>Low</span><span>High</span>
                </div>
            </div>`;
        legendContainer.innerHTML = sizeLegendHTML;
    }
    
    const ctx = document.getElementById('analysis-bubble-plot').getContext('2d');
    window.analysisDotPlotInstance = new Chart(ctx, {
        type: 'bubble', data: { datasets: [dataset] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => `${c.raw.y}: ${c.raw.count} gene(s)` } }
            },
            scales: {
                x: { display: false },
                y: {
                    type: 'category', labels: categoriesWithData,
                    grid: { display: false, drawBorder: false },
                    ticks: { font: { size: settings.fontSize, weight: settings.fontWeight, family: settings.fontFamily } }
                }
            }
        }
    });
}

function renderBubbleMatrix(foundGenes) {
    document.getElementById('matrix-plot-container').style.display = 'block';
    if (window.analysisBarChartInstance) window.analysisBarChartInstance.destroy();

    const settings = getPlotSettings();
    const yCategories = ['Basal Body', 'Transition Zone', 'Axoneme', 'Ciliary Membrane', 'Cilia', 'Golgi'];
    const xLabels = [...new Set(foundGenes.map(g => g.gene))].sort();
    const colorPalette = ['#377eb8', '#ff7f00', '#4daf4a', '#f781bf', '#a65628', '#984ea3', '#999999', '#e41a1c', '#dede00'];
    
    const datasets = foundGenes.map((gene, index) => ({
        label: gene.gene,
        data: (gene.localization || '').split(',').map(locString => {
            const matchingCategory = yCategories.find(cat => cat.toLowerCase() === locString.trim().toLowerCase());
            return matchingCategory ? { x: gene.gene, y: matchingCategory, r: 10 } : null;
        }).filter(Boolean),
        backgroundColor: colorPalette[index % colorPalette.length]
    }));

    const ctx = document.getElementById('analysis-matrix-plot').getContext('2d');
    window.analysisBarChartInstance = new Chart(ctx, {
        type: 'bubble', data: { datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'right', labels: { font: { family: settings.fontFamily, size: settings.fontSize } } },
                tooltip: { callbacks: { label: (context) => `${context.dataset.label} - ${context.raw.y}` } },
            },
            scales: {
                x: {
                    type: 'category', labels: xLabels,
                    title: { display: true, text: 'Genes', font: { family: settings.fontFamily, size: 16, weight: 'bold' } },
                    ticks: { font: { family: settings.fontFamily, size: settings.fontSize, weight: settings.fontWeight }, autoSkip: false, maxRotation: 90, minRotation: 45 },
                },
                y: {
                    type: 'category', labels: yCategories,
                    title: { display: true, text: 'Ciliary Localization', font: { family: settings.fontFamily, size: 16, weight: 'bold' } },
                    ticks: { font: { family: settings.fontFamily, size: settings.fontSize, weight: settings.fontWeight } },
                }
            }
        }
    });
}

function renderUpsetPlot(foundGenes) {
    document.getElementById('upset-plot-container').style.display = 'block';
    const wrapper = document.getElementById('upset-plot-wrapper');
    wrapper.innerHTML = '';
    
    const sets = [];
    const uniqueLocalizations = new Set();
    foundGenes.forEach(gene => {
        if (gene.localization) {
            const localizations = gene.localization.split(',').map(l => l.trim()).filter(l => l);
            if (localizations.length > 0) {
                sets.push({ name: gene.gene, sets: localizations });
                localizations.forEach(loc => uniqueLocalizations.add(loc));
            }
        }
    });

    if (sets.length === 0) return;

    const setDefinitions = Array.from(uniqueLocalizations).map(name => ({ name, elems: [] }));
    sets.forEach(elem => { setDefinitions.forEach(set => { if (elem.sets.includes(set.name)) set.elems.push(elem.name); }); });

    if (typeof UpsetJS !== 'undefined') {
        const upset = UpsetJS.fromExpression(setDefinitions);
        UpsetJS.render(wrapper, upset);
    } else {
        wrapper.innerHTML = '<p class="error-message">Upset.js library is not loaded. Please check index.html.</p>';
    }
}

function downloadPlot() {
    const selectedPlot = document.querySelector('input[name="plot-type"]:checked').value;
    let canvas, fileName, chartInstance;

    if (selectedPlot === 'bubble') {
        canvas = document.getElementById('analysis-bubble-plot');
        fileName = 'CiliaHub_Enrichment_Plot.png';
        chartInstance = window.analysisDotPlotInstance;
    } else if (selectedPlot === 'matrix') {
        canvas = document.getElementById('analysis-matrix-plot');
        fileName = 'CiliaHub_Matrix_Plot.png';
        chartInstance = window.analysisBarChartInstance;
    }

    if (canvas && chartInstance) {
        const a = document.createElement('a');
        chartInstance.options.plugins.customCanvasBackgroundColor = { color: 'white' };
        chartInstance.update('none');
        a.href = chartInstance.toBase64Image('image/png', 1.0);
        delete chartInstance.options.plugins.customCanvasBackgroundColor;
        chartInstance.update('none');
        a.download = fileName;
        a.click();
    } else if (selectedPlot === 'upset') {
        const svgElement = document.querySelector('#upset-plot-wrapper svg');
        if (!svgElement) { alert("Could not find the Upset plot to download."); return; }
        
        const svgClone = svgElement.cloneNode(true);
        const serializer = new XMLSerializer();
        let source = serializer.serializeToString(svgClone);
        if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
            source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        const blob = new Blob([source], {type: "image/svg+xml;charset=utf-8"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'CiliaHub_Upset_Plot.svg';
        a.click();
        URL.revokeObjectURL(url);
    }
}



function displayIndividualGenePage(gene) {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area';
    document.querySelector('.cilia-panel').style.display = 'block';
    contentArea.innerHTML = `
        <div class="page-section gene-detail-page">
            <div class="breadcrumb" style="margin-bottom: 2rem;">
                <a href="/" onclick="navigateTo(event, '/')" aria-label="Back to Home">← Back to Home</a>
            </div>
            <h1 class="gene-name">${gene.gene}</h1>
            <p class="gene-description">${gene.description || 'No description available.'}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin-top: 2rem;">
                ${gene.ensembl_id ? `<div class="gene-info"><strong>Ensembl ID:</strong> <a href="https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${gene.ensembl_id}" target="_blank">${gene.ensembl_id}</a></div>` : ''}
                ${gene.omim_id ? `<div class="gene-info"><strong>OMIM ID:</strong> <a href="https://www.omim.org/entry/${gene.omim_id}" target="_blank">${gene.omim_id}</a></div>` : ''}
                ${gene.synonym ? `<div class="gene-info"><strong>Synonym:</strong> ${gene.synonym}</div>` : ''}
                ${gene.localization ? `<div class="gene-info"><strong>Localization:</strong> <span style="color: #27ae60; font-weight: 600;">${gene.localization}</span></div>` : ''}
            </div>
            <div class="functional-summary" style="margin-top: 2rem;">
                <h2 style="color: #2c3e50; margin-bottom: 1rem;">Functional Summary</h2>
                <p style="line-height: 1.7; color: #34495e;">${gene.functional_summary || 'No functional summary available.'}</p>
                ${gene.reference ? `
                    <div style="margin-top: 2rem; padding: 1rem; background: #f8f9fa; border-radius: 10px;">
                        <strong>Reference:</strong> <a href="${gene.reference}" target="_blank" style="word-break: break-all;">${gene.reference}</a>
                    </div>
                ` : ''}
            </div>
        </div>`;
    
    updateGeneButtons([...currentData, gene], [gene]);  
    showLocalization(gene.gene, true);
}

function displayNotFoundPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    document.querySelector('.cilia-panel').style.display = 'none';
    contentArea.innerHTML = `
        <div class="page-section status-message">
            <h2>404 - Gene Not Found</h2>
            <p style="font-size: 1rem; color: #555;">The requested gene was not found in our database.</p>
            <a href="/" onclick="navigateTo(event, '/')" style="display: inline-block; padding: 1rem 2rem; background: #2c5aa0; color: white; text-decoration: none; border-radius: 10px; margin-top: 1rem;" aria-label="Back to Home">Back to Home</a>
        </div>`;
}

function performSingleSearch() {
    const query = document.getElementById('single-gene-search').value.trim().toUpperCase();
    const statusDiv = document.getElementById('status-message');
    statusDiv.innerHTML = '<span>Loading...</span>';
    statusDiv.style.display = 'block';

    if (!query) {
        statusDiv.innerHTML = `<span class="error-message">Please enter a gene name.</span>`;
        return;
    }

    const results = allGenes.filter(g => {
        // Use sanitized gene field directly, no need for replace(/\s/g, '')
        if (g.gene && g.gene.toUpperCase().includes(query)) {
            return true;
        }
        if (g.synonym) {
            const synonyms = g.synonym.toUpperCase().split(',').map(s => s.trim());
            if (synonyms.includes(query)) {
                return true;
            }
        }
        return false;
    });

    if (results.length === 0) {
        const closeMatches = allGenes.filter(g =>
            g.gene && g.gene.toUpperCase().startsWith(query.slice(0, 3))
        ).slice(0, 3);

        statusDiv.innerHTML = `<span class="error-message">No genes found for "${query}". ${closeMatches.length > 0 ? 'Did you mean: ' + closeMatches.map(g => g.gene).join(', ') + '?' : 'No close matches found.'}</span>`;
        return;
    }

    if (results.length === 1 && results[0].gene.toUpperCase() === query) {
        navigateTo(null, `/${results[0].gene}`);
    } else {
        navigateTo(null, '/batch-query');
        setTimeout(() => {
            document.getElementById('batch-genes-input').value = results.map(r => r.gene).join('\n');
            performBatchSearch();
        }, 100);
    }
}

function performBatchSearch() {
    const queries = document.getElementById('batch-genes-input').value
        .split(/[\s,\n]+/)
        .filter(Boolean)
        .map(q => q.trim().toUpperCase());
    const localizationFilter = document.getElementById('localization-filter')?.value;
    const keywordFilter = document.getElementById('keyword-filter')?.value.toLowerCase();
    const statusDiv = document.getElementById('status-message');

    if (queries.length === 0) {
        statusDiv.innerHTML = `<span class="error-message">Please enter at least one gene name.</span>`;
        statusDiv.style.display = 'block';
        return;
    }

    let results = allGenes.filter(g =>
        queries.some(q => {
            // Use sanitized gene field directly, no need for replace(/\s/g, '')
            if (g.gene && g.gene.toUpperCase() === q) {
                return true;
            }
            if (g.synonym) {
                const synonyms = g.synonym.toUpperCase().split(',').map(s => s.trim());
                if (synonyms.includes(q)) {
                    return true;
                }
            }
            return false;
        })
    );

    if (localizationFilter) {
        results = results.filter(g => g.localization && g.localization.includes(localizationFilter));
    }

    if (keywordFilter) {
        results = results.filter(g =>
            (g.functional_summary && g.functional_summary.toLowerCase().includes(keywordFilter)) ||
            (g.description && g.description.toLowerCase().includes(keywordFilter))
        );
    }

    statusDiv.style.display = 'none';
    searchResults = results;

    if (results.length > 0) {
        displayBatchResults(results);
        displayGeneCards(currentData, results, 1, 10);
    } else {
        statusDiv.innerHTML = `<span class="error-message">No genes found matching your query.</span>`;
        statusDiv.style.display = 'block';
        displayGeneCards(currentData, [], 1, 10);
    }
}

function displayBatchResults(results) {
    const batchResults = document.getElementById('batch-results');
    if (!batchResults) return;
    
    if (results.length === 0) {
        batchResults.innerHTML = '<p class="error-message">No matching genes found</p>';
        return;
    }
    
    let html = `
        <h3>Search Results (${results.length} genes found)</h3>
        <table>
            <tr>
                <th>Gene</th>
                <th>Ensembl ID</th>
                <th>Localization</th>
                <th>Function Summary</th>
            </tr>`;
    
    results.forEach(item => {
        html += `<tr>
            <td><a href="/${item.gene}" onclick="navigateTo(event, '/${item.gene}')">${item.gene}</a></td>
            <td>${item.ensembl_id || '-'}</td>
            <td>${item.localization || '-'}</td>
            <td>${item.functional_summary ? item.functional_summary.substring(0, 100) + '...' : '-'}</td>
        </tr>`;
    });
    
    html += '</table>';
    batchResults.innerHTML = html;
}

function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const genes = text.split(/[\n,]+/).map(g => g.trim()).filter(Boolean);
        const input = document.getElementById('batch-genes-input');
        input.value += (input.value ? '\n' : '') + genes.join('\n');
    };
    reader.readAsText(file);
}

function displayGeneCards(defaults, searchResults, page = 1, perPage = 10) {
    const container = document.getElementById('gene-cards-container');
    if (!container) return;
    
    const uniqueDefaults = defaults.filter(d => !searchResults.some(s => s.gene === d.gene));
    const allGenesToDisplay = [...searchResults, ...uniqueDefaults];
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const paginatedGenes = allGenesToDisplay.slice(start, end);
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const gene = JSON.parse(entry.target.dataset.gene);
                const isSearchResult = searchResults.some(s => s.gene === gene.gene);
                
                entry.target.innerHTML = `
                    <div class="gene-name">${gene.gene}</div>
                    <div class="gene-description">${gene.description || 'No description available.'}</div>
                    ${gene.localization ? `
                        <div class="gene-info">
                            <strong>Localization:</strong> 
                            <span style="color: ${isSearchResult ? '#27ae60' : '#1e90ff'}; font-weight: 600;">
                                ${gene.localization}
                            </span>
                        </div>` : ''}
                    ${gene.ensembl_id ? `
                        <div class="gene-info"><strong>Ensembl:</strong> 
                            <a href="https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${gene.ensembl_id}" target="_blank">
                                ${gene.ensembl_id}
                            </a>
                        </div>` : ''}
                    ${gene.omim_id ? `
                        <div class="gene-info"><strong>OMIM:</strong> 
                            <a href="https://www.omim.org/entry/${gene.omim_id}" target="_blank">${gene.omim_id}</a>
                        </div>` : ''}
                    ${gene.synonym ? `<div class="gene-info"><strong>Synonym:</strong> ${gene.synonym}</div>` : ''}
                    <div style="margin-top: 1rem; padding: 0.5rem; background: ${isSearchResult ? '#d5f4e6' : '#e8f4fd'}; 
                            border-radius: 5px; font-size: 0.9rem; color: ${isSearchResult ? '#27ae60' : '#1e90ff'};">
                        Click to view detailed information →
                    </div>
                `;
                
                entry.target.classList.add(isSearchResult ? 'search-result' : 'default');
                entry.target.onclick = () => navigateTo(event, `/${gene.gene}`);
                entry.target.setAttribute('aria-label', `View details for ${gene.gene}`);
                observer.unobserve(entry.target);
            }
        });
    }, { rootMargin: '100px' });
    
    container.innerHTML = paginatedGenes.map(gene => `
        <div class="gene-card" data-gene='${JSON.stringify(gene)}'></div>
    `).join('');
    
    container.querySelectorAll('.gene-card').forEach(card => observer.observe(card));
    
    const paginationDiv = document.createElement('div');
    paginationDiv.className = 'pagination';
    paginationDiv.innerHTML = `
        <button onclick="displayGeneCards(${JSON.stringify(defaults)}, ${JSON.stringify(searchResults)}, ${page - 1}, ${perPage})" ${page === 1 ? 'disabled' : ''}>Previous</button>
        <span>Page ${page} of ${Math.ceil(allGenesToDisplay.length / perPage)}</span>
        <button onclick="displayGeneCards(${JSON.stringify(defaults)}, ${JSON.stringify(searchResults)}, ${page + 1}, ${perPage})" ${end >= allGenesToDisplay.length ? 'disabled' : ''}>Next</button>
    `;
    container.appendChild(paginationDiv);
    
    updateGeneButtons(allGenesToDisplay, searchResults);
}

function updateGeneButtons(genesToDisplay, searchResults = []) {
    const container = document.getElementById('geneButtons');
    if (!container) return;
    
    container.innerHTML = '';
    
    const defaultGenesButtons = defaultGenesNames
        .map(geneName => genesToDisplay.find(g => g.gene === geneName))
        .filter(Boolean);
        
    const searchGenes = searchResults
        .map(s => genesToDisplay.find(g => g.gene === s.gene))
        .filter(g => g && !defaultGenesNames.includes(g.gene));
        
    const genesToShow = [...defaultGenesButtons, ...searchGenes].slice(0, 10);
    
    genesToShow.forEach(gene => {
        if (geneLocalizationData[gene.gene]) {
            const isSearch = searchResults.some(s => s.gene === gene.gene);
            const button = document.createElement('button');
            button.className = `gene-btn ${isSearch ? 'search-gene' : 'default'}`;
            button.textContent = gene.gene;
            button.setAttribute('aria-label', `Highlight localization of ${gene.gene} in the cilium diagram`);
            button.onclick = () => showLocalization(gene.gene, isSearch);
            container.appendChild(button);
        }
    });
    
    const resetButton = document.createElement('button');
    resetButton.className = 'gene-btn reset-btn';
    resetButton.textContent = 'Reset Diagram';
    resetButton.setAttribute('aria-label', 'Reset cilia diagram');
    resetButton.onclick = () => showLocalization('reset');
    container.appendChild(resetButton);
}

let selectedGenes = [];
function showLocalization(geneName, isSearchGene = false) {
    if (geneName === 'reset') {
        selectedGenes = [];
    } else {
        if (!selectedGenes.includes(geneName)) {
            selectedGenes.push(geneName);
        } else {
            selectedGenes = selectedGenes.filter(g => g !== geneName);
        }
    }
    
    const ciliaParts = document.querySelectorAll('.cilia-part');
    ciliaParts.forEach(part => part.classList.remove('highlighted', 'search-gene', 'cilia'));
    
    document.querySelectorAll('.gene-btn').forEach(btn => btn.classList.remove('selected'));
    
    selectedGenes.forEach(g => {
        if (geneLocalizationData[g]) {
            const isCiliary = geneLocalizationData[g].some(id => ['ciliary-membrane', 'axoneme'].includes(id));
            
            geneLocalizationData[g].forEach(id => {
                const el = document.getElementById(id);
                if (el && id !== 'cell-body') {
                    el.classList.add('highlighted');
                    if (isCiliary) {
                        el.classList.add('cilia');
                    } else if (isSearchGene) {
                        el.classList.add('search-gene');
                    }
                }
            });
        }
        
        const btn = [...document.querySelectorAll('.gene-btn')].find(b => b.textContent === g);
        if (btn) btn.classList.add('selected');
    });
}

function updateActiveNav(path) {
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        const linkPath = link.getAttribute('href').toLowerCase();
        
        if (linkPath === path || 
            (path.startsWith('/') && path !== '/' && path !== '/index.html' && 
             linkPath === '/batch-query' && !['/download', '/contact', '/compare', '/expression', '/analysis'].includes(path))) {
            link.classList.add('active');
        }
    });
}

function handleStickySearch() {
    const searchContainer = document.querySelector('.search-container');
    if (searchContainer && window.scrollY > 100) {
        searchContainer.classList.add('sticky');
    } else if (searchContainer) {
        searchContainer.classList.remove('sticky');
    }
}

function displayLocalizationChart() {
    const categories = ['Cilia', 'Basal Body', 'Transition Zone', 'Flagella', 'Ciliary Associated Gene'];
    const localizationCounts = categories.reduce((acc, category) => {
        acc[category] = allGenes.filter(g => {
            if (!g.localization) return false;
            const localizations = g.localization.split(',').map(l => l.trim().toLowerCase());
            return localizations.includes(category.toLowerCase()) || 
                   (category === 'Cilia' && localizations.includes('ciliary membrane')) ||
                   (category === 'Flagella' && localizations.includes('axoneme')) ||
                   (category === 'Ciliary Associated Gene' && localizations.includes('ciliary associated gene'));
        }).length;
        return acc;
    }, {});
    
    const chartContainer = document.createElement('div');
    chartContainer.className = 'page-section';
    chartContainer.innerHTML = `<h2>Gene Localization Distribution</h2><canvas id="locChart" style="max-height: 300px;"></canvas>`;
    
    const contentArea = document.querySelector('.content-area');
    const existingChart = contentArea.querySelector('#locChart');
    if (existingChart) existingChart.parentElement.remove();
    
    contentArea.appendChild(chartContainer);
    
    const ctx = document.getElementById('locChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: categories,
            datasets: [{
                label: 'Number of Genes',
                data: categories.map(category => localizationCounts[category] || 0),
                backgroundColor: ['#005566', '#66C2A5', '#D81B60', '#FF7F00', '#6BAED6'],
                borderColor: ['#005566', '#66C2A5', '#D81B60', '#FF7F00', '#6BAED6'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true, 
                    title: { display: true, text: 'Number of Genes' },
                    ticks: { stepSize: 1 }
                },
                x: { 
                    title: { display: true, text: 'Localization' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.raw} genes`;
                        }
                    }
                }
            }
        }
    });
}

// --- Expression Visualization System ---
let expressionData = {};
let availableGenes = new Set();
const organCache = new Map();

async function initExpressionSystem() {
    try {
        if (Object.keys(expressionData).length === 0) {
            await loadExpressionData();
        }
        setupExpressionEventListeners();
        await loadSVGFile();
        prepareOrgansForExpression();
        console.log('Expression system initialized successfully');
    } catch (error) {
        console.error('Failed to initialize expression system:', error);
    }
}

async function loadExpressionData() {
    try {
        const response = await fetch('rna_tissue_consensus.tsv');
        if (!response.ok) throw new Error('Failed to load expression data');

        const tsvText = await response.text();
        const rawData = parseTSV(tsvText);
        expressionData = processExpressionData(rawData);

        const geneSet = new Set();
        Object.keys(expressionData).forEach(gene => {
            geneSet.add(gene); // Gene names are now already uppercase
        });
        availableGenes = geneSet;

        console.log(`Loaded ${Object.keys(expressionData).length} genes with expression data from TSV`);
    } catch (error) {
        console.error('Error loading expression data:', error);
    }
}

function parseTSV(tsvText) {
    const lines = tsvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split('\t');
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('\t');
        if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index] ? values[index].trim() : '';
            });
            data.push(row);
        }
    }
    return data;
}

function processExpressionData(rawData) {
    const processedData = {};
    rawData.forEach(row => {
        const geneName = row['Gene name'] || row['Gene'];
        if (geneName) {
            const upperGeneName = geneName.toUpperCase(); // Standardize to uppercase
            const tissue = row['Tissue'];
            const nTPM = parseFloat(row['nTPM']);

            if (tissue && !isNaN(nTPM)) {
                if (!processedData[upperGeneName]) {
                    processedData[upperGeneName] = {};
                }
                processedData[upperGeneName][tissue] = nTPM;
            }
        }
    });
    return processedData;
}

function setupExpressionEventListeners() {
    const searchInput = document.getElementById('gene-search');
    const suggestionsDiv = document.getElementById('suggestions');
    const resetButton = document.getElementById('reset-organs-btn');

    if (!searchInput || !suggestionsDiv || !resetButton) return;

    searchInput.addEventListener('input', handleExpressionSearchInput);
    searchInput.addEventListener('focus', () => showExpressionSuggestions());
    searchInput.addEventListener('blur', () => {
        setTimeout(() => suggestionsDiv.style.display = 'none', 200);
    });
    resetButton.addEventListener('click', resetOrganSelection);

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
            suggestionsDiv.style.display = 'none';
        }
    });
}

let searchTimeout;
function handleExpressionSearchInput(e) {
    const query = e.target.value.trim().toUpperCase();
    if (query.length < 2) {
        hideExpressionSuggestions();
        return;
    }
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const suggestions = getExpressionGeneSuggestions(query);
        showExpressionSuggestions(suggestions);
    }, 150);
}

function getExpressionGeneSuggestions(query) {
    const suggestions = [];
    const queryUpper = query.toUpperCase();
    const allGeneNames = [...availableGenes];

    for (const gene of allGeneNames) {
        if (gene.startsWith(queryUpper)) {
            suggestions.push(gene);
            if (suggestions.length >= 10) break;
        }
    }
    return suggestions;
}

function showExpressionSuggestions(suggestions = null) {
    const suggestionsDiv = document.getElementById('suggestions');
    if (!suggestionsDiv || !suggestions || suggestions.length === 0) {
        if (suggestionsDiv) suggestionsDiv.style.display = 'none';
        return;
    }

    suggestionsDiv.innerHTML = suggestions.map(gene => `
        <div class="suggestion-item" onclick="selectExpressionGene('${gene}')">
            <div class="suggestion-gene">${gene}</div>
        </div>
    `).join('');
    suggestionsDiv.style.display = 'block';
}

function hideExpressionSuggestions() {
    const suggestionsDiv = document.getElementById('suggestions');
    if (suggestionsDiv) suggestionsDiv.style.display = 'none';
}

function selectExpressionGene(geneName) {
    const searchInput = document.getElementById('gene-search');
    if (searchInput) searchInput.value = geneName;
    hideExpressionSuggestions();
    showExpressionGeneInfo(geneName);
    updateExpressionVisualization(geneName);
    updateExpressionTable(geneName);
}

function showExpressionGeneInfo(geneName) {
    const geneDetailsDiv = document.getElementById('gene-details');
    const selectedGeneInfoDiv = document.getElementById('selected-gene-info');

    if (geneDetailsDiv && selectedGeneInfoDiv) {
        const geneExpression = expressionData[geneName] || {};
        const tissueCount = Object.keys(geneExpression).length;
        const geneInfo = allGenes.find(g => g.gene === geneName);

        geneDetailsDiv.innerHTML = `
            <div style="margin-bottom: 1rem;"><strong>Gene:</strong> ${geneName}</div>
            <div style="margin-bottom: 1rem;"><strong>Expression Data:</strong> Available in ${tissueCount} tissues</div>
            ${geneInfo?.description ? `<div style="margin-bottom: 1rem;"><strong>Description:</strong> ${geneInfo.description}</div>` : ''}
        `;
        selectedGeneInfoDiv.style.display = 'block';
    }
}

function updateExpressionVisualization(geneName) {
    const organs = document.querySelectorAll('.organ');
    organs.forEach(organ => {
        const originalColor = organ.getAttribute('data-original-color');
        if (originalColor) organ.setAttribute('fill', originalColor);
        organ.style.filter = 'brightness(1)';
    });

    const geneExpression = findGeneExpression(geneName);
    if (geneExpression) {
        Object.entries(geneExpression).forEach(([tissue, nTPM]) => {
            const organElement = findOrganElement(tissue);
            if (organElement) {
                organElement.setAttribute('fill', getExpressionColor(nTPM));
            }
        });
    }
}

function findGeneExpression(geneName) {
    if (!expressionData || !geneName) return null;
    return expressionData[geneName] || null;
}

function findOrganElement(tissueName) {
    if (organCache.has(tissueName)) return organCache.get(tissueName);

    const organs = document.querySelectorAll('.organ');
    const tissueLower = tissueName.toLowerCase();

    for (let organ of organs) {
        const tissue = organ.getAttribute('data-tissue');
        if (tissue && tissueLower === tissue.toLowerCase()) {
            organCache.set(tissueName, organ);
            return organ;
        }
    }
    organCache.set(tissueName, null);
    return null;
}

function getExpressionColor(nTPM) {
    if (nTPM <= 5) return '#A8E6A1';
    if (nTPM <= 15) return '#6CC96C';
    if (nTPM <= 30) return '#3FAF3F';
    return '#1E7B1E';
}

function updateExpressionTable(geneName) {
    const tableWrapper = document.getElementById('expression-table-wrapper');
    if (!tableWrapper) return;

    const geneExpression = findGeneExpression(geneName);
    if (!geneExpression || Object.keys(geneExpression).length === 0) {
        tableWrapper.innerHTML = '<div style="text-align: center; padding: 2rem; color: #666; font-style: italic;">No expression data available for this gene</div>';
        return;
    }

    const sortedTissues = Object.entries(geneExpression).sort(([,a], [,b]) => b - a);

    const tableHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
            <thead>
                <tr>
                    <th style="padding: 0.8rem; text-align: left; border-bottom: 1px solid #e1ecf4; background: #2c5aa0; color: white;">Tissue</th>
                    <th style="padding: 0.8rem; text-align: left; border-bottom: 1px solid #e1ecf4; background: #2c5aa0; color: white;">nTPM</th>
                    <th style="padding: 0.8rem; text-align: left; border-bottom: 1px solid #e1ecf4; background: #2c5aa0; color: white;">Level</th>
                </tr>
            </thead>
            <tbody>
                ${sortedTissues.map(([tissue, nTPM]) => `
                    <tr>
                        <td style="padding: 0.8rem; border-bottom: 1px solid #e1ecf4;">${tissue}</td>
                        <td style="padding: 0.8rem; border-bottom: 1px solid #e1ecf4;">${nTPM.toFixed(2)}</td>
                        <td style="padding: 0.8rem; border-bottom: 1px solid #e1ecf4;">${getExpressionLevel(nTPM)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
    tableWrapper.innerHTML = tableHTML;
}

function getExpressionLevel(nTPM) {
    if (nTPM <= 5) return 'Low';
    if (nTPM <= 15) return 'Medium';
    if (nTPM <= 30) return 'High';
    return 'Very High';
}

function handleOrganClick(tissueName) {
    highlightClickedOrgan(tissueName);
    displayTissueExpressionData(tissueName);
}

function highlightClickedOrgan(tissueName) {
    const organs = document.querySelectorAll('.organ');
    organs.forEach(organ => {
        organ.style.stroke = organ.getAttribute('data-tissue') === tissueName ? '#e74c3c' : '#2c5aa0';
        organ.style.strokeWidth = organ.getAttribute('data-tissue') === tissueName ? '3' : '2';
    });
}

function displayTiceExpressionData(tissueName) {
    const tableWrapper = document.getElementById('expression-table-wrapper');
    if (!tableWrapper) return;

    const tissueExpressionData = [];
    Object.entries(expressionData).forEach(([geneName, tissueData]) => {
        if (tissueData[tissueName] !== undefined) {
            tissueExpressionData.push({ gene: geneName, nTPM: tissueData[tissueName] });
        }
    });

    tissueExpressionData.sort((a, b) => b.nTPM - a.nTPM);

    if (tissueExpressionData.length === 0) {
        tableWrapper.innerHTML = `<div style="text-align: center; padding: 2rem; color: #666;">No expression data for ${tissueName}</div>`;
        return;
    }

    const tableHTML = `
        <h5 style="color: #2c5aa0; margin-bottom: 1rem;">Top Expressed Genes in ${tissueName}</h5>
        <table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
            <thead>
                <tr>
                    <th style="padding: 0.8rem; text-align: left; border-bottom: 1px solid #e1ecf4; background: #2c5aa0; color: white;">Gene</th>
                    <th style="padding: 0.8rem; text-align: left; border-bottom: 1px solid #e1ecf4; background: #2c5aa0; color: white;">nTPM</th>
                </tr>
            </thead>
            <tbody>
                ${tissueExpressionData.slice(0, 50).map(item => `
                    <tr style="cursor: pointer;" onclick="selectExpressionGene('${item.gene}')">
                        <td style="padding: 0.8rem; border-bottom: 1px solid #e1ecf4;">${item.gene}</td>
                        <td style="padding: 0.8rem; border-bottom: 1px solid #e1ecf4;">${item.nTPM.toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
    tableWrapper.innerHTML = tableHTML;
}

function resetOrganSelection() {
    const organs = document.querySelectorAll('.organ');
    organs.forEach(organ => {
        const originalColor = organ.getAttribute('data-original-color');
        if (originalColor) organ.setAttribute('fill', originalColor);
        organ.style.stroke = '#2c5aa0';
        organ.style.strokeWidth = '2';
    });
    const tableWrapper = document.getElementById('expression-table-wrapper');
    if (tableWrapper) {
        tableWrapper.innerHTML = `<div style="text-align: center; padding: 2rem; color: #666;">Click an organ or search for a gene.</div>`;
    }
    const selectedGeneInfoDiv = document.getElementById('selected-gene-info');
    if (selectedGeneInfoDiv) selectedGeneInfoDiv.style.display = 'none';
    const searchInput = document.getElementById('gene-search');
    if (searchInput) searchInput.value = '';
}

async function loadSVGFile() {
    try {
        const response = await fetch('file.svg');
        if (!response.ok) throw new Error('Failed to load SVG file');
        const svgText = await response.text();
        const container = document.getElementById('svg-container');
        if (container) container.innerHTML = svgText;
    } catch (error) {
        console.error('Error loading SVG file:', error);
    }
}

function prepareOrgansForExpression() {
    organCache.clear(); // <-- THE FIX: Clear stale cache before setting up the SVG.
    const organMappings = [
        { tissue: 'cerebral cortex', selector: 'path[fill="#BE0405"]' },
        { tissue: 'heart muscle', selector: 'path[fill="#F07070"]' },
        { tissue: 'lung', selector: 'path[fill="#F6A2A0"]' },
        { tissue: 'liver', selector: 'path[fill="#F8A19F"]' },
        { tissue: 'stomach', selector: 'path[fill="#FDE098"]' },
        { tissue: 'kidney', selector: 'path[fill="#EA8F8E"]' },
        { tissue: 'colon', selector: 'path[fill="#C07F54"]' },
        { tissue: 'testis', selector: 'path[fill="#E49BDC"]' },
    ];

    const svg = document.querySelector('#svg-container svg');
    if (!svg) return;

    organMappings.forEach(mapping => {
        const pathElements = svg.querySelectorAll(mapping.selector);
        pathElements.forEach(path => {
            path.classList.add('organ');
            path.setAttribute('data-tissue', mapping.tissue);
            path.setAttribute('data-original-color', path.getAttribute('fill'));
            path.style.cursor = 'pointer';
            path.style.transition = 'all 0.3s ease';
            path.addEventListener('mouseenter', () => path.style.filter = 'brightness(1.2)');
            path.addEventListener('mouseleave', () => path.style.filter = 'brightness(1)');
            path.addEventListener('click', () => handleOrganClick(mapping.tissue));
        });
    });
}

function displayExpressionPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    document.querySelector('.cilia-panel').style.display = 'none';
    contentArea.innerHTML = `
        <div class="page-section">
            <div style="text-align: center; margin-bottom: 2rem;">
                <h1 style="color: #2c5aa0; margin-bottom: 1rem;">Gene Expression Visualization</h1>
                <p style="color: #555; font-size: 1.1rem;">Explore tissue-specific gene expression patterns across human organs and tissues.</p>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 2rem; align-items: start;">
                <div style="background: white; padding: 2rem; border-radius: 15px; box-shadow: 0 8px 32px rgba(44, 90, 160, 0.1); height: fit-content; position: relative;">
                    <h3 style="color: #2c5aa0; margin-bottom: 1.5rem; font-size: 1.3rem;">Gene Search</h3>
                    <div style="margin-bottom: 1.5rem;">
                        <input type="text" id="gene-search" style="width: 100%; padding: 1rem; border: 2px solid #e1ecf4; border-radius: 10px; font-size: 1rem; margin-bottom: 1rem;" placeholder="Search for a gene (e.g., ARL13B, IFT88)" autocomplete="off">
                        <div id="suggestions"></div>
                    </div>
                    <div id="selected-gene-info" style="display: none;">
                        <h4 style="color: #2c5aa0; margin-bottom: 1rem;">Selected Gene</h4>
                        <div id="gene-details"></div>
                    </div>
                </div>
                <div style="background: white; padding: 2rem; border-radius: 15px; box-shadow: 0 8px 32px rgba(44, 90, 160, 0.1);">
                    <h3 style="color: #2c5aa0; margin-bottom: 1.5rem; font-size: 1.3rem;">Expression Visualization</h3>
                    <div style="text-align: center; margin-bottom: 2rem;">
                        <div id="svg-container" style="max-width: 100%; height: auto;">
                            <div style="text-align: center; padding: 2rem; color: #666;">
                                <p>Loading human body visualization...</p>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: center; gap: 1rem; margin: 1.5rem 0; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;"><div style="width: 20px; height: 20px; border-radius: 4px; border: 1px solid #ccc; background-color: #A8E6A1;"></div><span>Low (0-5 nTPM)</span></div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;"><div style="width: 20px; height: 20px; border-radius: 4px; border: 1px solid #ccc; background-color: #6CC96C;"></div><span>Medium (5-15 nTPM)</span></div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;"><div style="width: 20px; height: 20px; border-radius: 4px; border: 1px solid #ccc; background-color: #3FAF3F;"></div><span>High (15-30 nTPM)</span></div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;"><div style="width: 20px; height: 20px; border-radius: 4px; border: 1px solid #ccc; background-color: #1E7B1E;"></div><span>Very High (>30 nTPM)</span></div>
                    </div>
                    <div style="margin-top: 2rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h4 style="color: #2c5aa0; margin: 0;">Expression Data Table</h4>
                            <button id="reset-organs-btn" style="padding: 0.5rem 1rem; background: #95a5a6; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 0.9rem;">Reset Organ Selection</button>
                        </div>
                        <div id="expression-table-wrapper">
                            <div style="text-align: center; padding: 2rem; color: #666; font-style: italic;">Click on an organ to see its gene expression data, or search for a specific gene</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    // Initialize all interactive elements for the Expression page
    initExpressionSystem();
}

window.navigateTo = function(event, path) {
    if (event) event.preventDefault();
    window.location.hash = path;
    handleRouteChange();
};

window.addEventListener('hashchange', handleRouteChange);
document.addEventListener('DOMContentLoaded', () => {
    initGlobalEventListeners();
    handleRouteChange();
});
