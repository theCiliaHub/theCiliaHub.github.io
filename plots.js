// =============================================================================
// CiliaHub Plotting Engine (plots.js)
// =============================================================================
// This file contains all functions for generating analytical plots on the
// CiliaPlot page, including localization, domain, network, and expression
// analyses. It now also includes functions to display a summary table of the
// queried genes before rendering the plot.
//
// Dependencies:
// - D3.js (for network plot)
// - Chart.js (for most plots)
// - jsPDF (for PDF downloads)
// - Global variables from script.js (allGenes, expressionData, etc.)
// =============================================================================

"use strict";

let currentPlotInstance = null; // Holds the active Chart.js, D3, etc. instance

/**
 * Safely clears the previous plot, handling both Chart.js and D3.js instances.
 */
function clearPreviousPlot() {
    if (currentPlotInstance) {
        // Check if it's a Chart.js instance
        if (typeof currentPlotInstance.destroy === 'function') {
            currentPlotInstance.destroy();
        }
        // Check if it's a D3.js DOM element (like an SVG)
        else if (currentPlotInstance.nodeType) {
            currentPlotInstance.remove();
        }
    }
    document.getElementById('plot-display-area').innerHTML = ''; // Ensure container is empty
    currentPlotInstance = null; // Reset the variable
}

/**
 * Robustly extracts a clean array of values from a gene object.
 * @param {Object} gene - The gene object from the database.
 * @param {...string} keys - The possible keys to check for the data.
 * @returns {Array<string>} A clean array of strings.
 */
function getCleanArray(gene, ...keys) {
    let data = null;
    for (const key of keys) {
        if (gene[key] != null) {
            data = gene[key];
            break;
        }
    }
    if (data == null) return [];
    const separatorRegex = /[,;]/;
    const initialArray = Array.isArray(data) ? data : String(data).split(separatorRegex);

    return initialArray
        .filter(Boolean)
        .flatMap(item => String(item).split(separatorRegex))
        .map(item => item.trim())
        .filter(Boolean);
}

// =============================================================================
// MAIN PLOT GENERATION & UI
// =============================================================================

async function generateAnalysisPlots() {
    try {
        await loadAndPrepareDatabase();
        await loadExpressionData();

        const plotContainer = document.getElementById('plot-display-area');
        const searchResultsContainer = document.getElementById('ciliaplot-search-results');
        const genesInput = document.getElementById('ciliaplot-genes-input').value.trim();

        if (!genesInput) {
            alert('Please enter a gene list.');
            return;
        }

        clearPreviousPlot();
        if (searchResultsContainer) searchResultsContainer.innerHTML = '';
        const tableContainer = document.getElementById('plot-data-table-container');
        if (tableContainer) tableContainer.innerHTML = '';
        plotContainer.innerHTML = '<p class="status-message">Searching genes and generating plot...</p>';

        const sanitizedQueries = [...new Set(genesInput.split(/[\s,;\n\r\t]+/).filter(Boolean).map(q => q.toUpperCase()))];
        const { foundGenes, notFoundGenes } = findGenes(sanitizedQueries);

        renderCiliaPlotSearchResultsTable(foundGenes, notFoundGenes);

        if (foundGenes.length === 0) {
            plotContainer.innerHTML = '<p class="status-message error">No valid genes were found to generate a plot.</p>';
            updateStatsAndLegend(document.getElementById('plot-type-select').value, []);
            return;
        }

        const plotType = document.getElementById('plot-type-select').value;

        updatePlotInfo(plotType);
        updateStatsAndLegend(plotType, foundGenes);

        // Routing for plot generation
        switch (plotType) {
            case 'expression_localization':
                renderExpressionLocalizationBubble(foundGenes, plotContainer);
                renderGeneDataTable(foundGenes, document.getElementById('plot-data-table-container'));
                break;
            case 'bubble':
                renderKeyLocalizations(foundGenes, plotContainer);
                break;
            case 'matrix':
                renderGeneMatrix(foundGenes, plotContainer);
                break;
            case 'domain_matrix':
                renderDomainMatrixPlot(foundGenes, plotContainer);
                break;
            case 'functional_category':
                renderFunctionalCategoryPlot(foundGenes, plotContainer);
                break;
            case 'network':
                renderComplexNetwork(foundGenes, plotContainer);
                break;
            case 'expression_heatmap':
                renderExpressionHeatmap(foundGenes, plotContainer);
                renderFoundNotFoundTable(sanitizedQueries, document.getElementById('plot-data-table-container'));
                break;
            case 'tissue_profile':
                renderTissueExpressionProfile(foundGenes, plotContainer);
                break;
            case 'top_tissues':
                renderTopExpressingTissues(foundGenes, plotContainer);
                break;
            case 'organelle_radar':
                renderOrganelleRadarPlot(foundGenes, plotContainer);
                break;
            case 'organelle_umap':
                renderOrganelleUMAP(foundGenes, plotContainer);
                break;
            case 'localization_bar':
                renderLocalizationBarPlot(foundGenes, plotContainer);
                break;
            case 'chord_plot':
                renderChordPlot(foundGenes, plotContainer);
                break;
            case 'violin_plot':
                renderViolinPlot(foundGenes, plotContainer);
                break;
            case 'expression_domain_bubble':
                renderExpressionDomainBubblePlot(foundGenes, plotContainer);
                break;
            default:
                plotContainer.innerHTML = `<p class="status-message">Plot type "${plotType}" is not yet implemented.</p>`;
                break;
        }
    } catch (error) {
        console.error('Error generating plots:', error);
        document.getElementById('plot-display-area').innerHTML = `<p class="status-message error">Error generating plot: ${error.message}</p>`;
    }
}

// ====================
// PLOT INFO & STATS
// ====================
function updatePlotInfo(plotType) {
    const infoContainer = document.getElementById('ciliaplot-plot-info');
    if (!infoContainer) return;
    let infoHTML = '';
    switch (plotType) {
        case 'bubble':
            infoHTML = `<strong>Key Localizations:</strong> Bubble plot showing distribution of your genes across ciliary compartments.`;
            break;
        case 'matrix':
            infoHTML = `<strong>Gene-Localization Matrix:</strong> Localization for each gene.`;
            break;
        case 'domain_matrix':
            infoHTML = `<strong>Gene-Domain Matrix:</strong> Domains in each gene.`;
            break;
        case 'functional_category':
            infoHTML = `<strong>Functional Category Bar Chart:</strong> Categorizes genes into functional groups.`;
            break;
        case 'network':
            infoHTML = `<strong>Protein Complex Network:</strong> Shows protein-protein interactions.`;
            break;
        case 'expression_heatmap':
            infoHTML = `<strong>Expression Heatmap:</strong> Displays gene expression across tissues.`;
            break;
        case 'tissue_profile':
            infoHTML = `<strong>Tissue Expression Profile:</strong> Average expression across tissues.`;
            break;
        case 'expression_localization':
            infoHTML = `<strong>Expression vs. Localization:</strong> Bubble plot correlating expression breadth with localization diversity.`;
            break;
        case 'top_tissues':
            infoHTML = `<strong>Top Expressing Tissues:</strong> Bar chart ranking tissues by average expression.`;
            break;
        case 'organelle_radar':
            infoHTML = `<strong>Organellar Profile (Radar):</strong> Average protein abundance across cellular fractions.`;
            break;
        case 'organelle_umap':
            infoHTML = `<strong>Organellar Projection (UMAP):</strong> 2D representation of organellar proteome.`;
            break;
        case 'localization_bar':
            infoHTML = `<strong>Key Localizations (Bar):</strong> Bar chart of gene distribution across compartments.`;
            break;
        case 'chord_plot':
            infoHTML = `<strong>Protein Complex (Chord):</strong> Chord diagram of shared protein complexes.`;
            break;
        case 'violin_plot':
            infoHTML = `<strong>Expression Violin Plot:</strong> Shows expression distribution.`;
            break;
        case 'expression_domain_bubble':
            infoHTML = `<strong>Expression vs. Domain:</strong> Correlates expression breadth with protein domains.`;
            break;
        default:
            infoHTML = `Select a plot type to see a description.`;
            break;
    }
    infoContainer.innerHTML = infoHTML;
}

/**
 * Updates the statistics and legend sections based on the plot type.
 * @param {string} plotType - The selected plot type.
 * @param {Array} foundGenes - The array of gene objects being plotted.
 */
function updateStatsAndLegend(plotType, foundGenes) {
    const statsContainer = document.getElementById('ciliaplot-stats-container');
    const legendContainer = document.getElementById('ciliaplot-legend-container');
    if (!statsContainer || !legendContainer) return;

    // Show containers
    statsContainer.style.display = 'grid';
    legendContainer.style.display = 'flex';

    let statsHTML = '';
    let legendHTML = '';

    // Basic stat: number of input genes found
    statsHTML += `<div class="stat-box">
                      <div class="stat-number">${foundGenes.length}</div>
                      <div class="stat-label">Input Genes Found</div>
                  </div>`;

    if (plotType === 'network') {
        const { links } = computeProteinComplexLinks(foundGenes);
        const complexSet = new Set(foundGenes.flatMap(g => getCleanArray(g, 'complex_names', 'complex')));
        statsHTML += `<div class="stat-box">
                          <div class="stat-number">${complexSet.size}</div>
                          <div class="stat-label">Unique Complexes</div>
                      </div>
                      <div class="stat-box">
                          <div class="stat-number">${links.length}</div>
                          <div class="stat-label">Interactions</div>
                      </div>`;
        legendHTML = `<div class="legend-item">
                          <div class="legend-color" style="background-color: #3498db;"></div>
                          <span>Gene</span>
                      </div>`;
    } else if (plotType === 'functional_category') {
        const categorySet = new Set(foundGenes.flatMap(g => getCleanArray(g, 'functional_category')));
        statsHTML += `<div class="stat-box">
                          <div class="stat-number">${categorySet.size}</div>
                          <div class="stat-label">Unique Categories</div>
                      </div>`;
        legendHTML = `<div class="legend-item">
                          <div class="legend-color" style="background-color: rgba(26, 188, 156, 0.7); border-radius: 4px;"></div>
                          <span>Gene Count</span>
                      </div>`;
    } else if (plotType === 'domain_matrix') {
        const domainSet = new Set(foundGenes.flatMap(g => getCleanArray(g, 'domain_descriptions')));
        statsHTML += `<div class="stat-box">
                          <div class="stat-number">${domainSet.size}</div>
                          <div class="stat-label">Unique Domains</div>
                      </div>`;
        legendContainer.style.display = 'none'; // No legend for this plot
    } else if (plotType.startsWith('expression') || plotType === 'top_tissues' || plotType === 'tissue_profile') {
        const genesWithExpr = foundGenes.filter(g => expressionData[g.gene.toUpperCase()]);
        statsHTML += `<div class="stat-box">
                          <div class="stat-number">${genesWithExpr.length}</div>
                          <div class="stat-label">Genes with Expression Data</div>
                      </div>`;
        legendContainer.style.display = 'none'; // Legends are built into these plots
    } else if (plotType === 'organelle_radar' || plotType === 'organelle_umap') {
        // For organelle plots, you may want to show number of localizations or coverage
        const localizations = new Set(foundGenes.flatMap(g => getCleanArray(g, 'localization'))).size;
        statsHTML += `<div class="stat-box">
                          <div class="stat-number">${localizations}</div>
                          <div class="stat-label">Unique Localizations</div>
                      </div>`;
        legendHTML = `<div class="legend-item">
                          <div class="legend-color" style="background-color: #e67e22;"></div>
                          <span>Organelle</span>
                      </div>`;
    } else if (plotType === 'localization_bar') {
        const localizations = new Set(foundGenes.flatMap(g => getCleanArray(g, 'localization'))).size;
        statsHTML += `<div class="stat-box">
                          <div class="stat-number">${localizations}</div>
                          <div class="stat-label">Unique Localizations</div>
                      </div>`;
        legendHTML = `<div class="legend-item">
                          <div class="legend-color" style="background-color: #1abc9c;"></div>
                          <span>Gene Count</span>
                      </div>`;
    } else if (plotType === 'chord_plot') {
        const links = computeProteinComplexLinks(foundGenes).links;
        statsHTML += `<div class="stat-box">
                          <div class="stat-number">${foundGenes.length}</div>
                          <div class="stat-label">Genes in Chord</div>
                      </div>
                      <div class="stat-box">
                          <div class="stat-number">${links.length}</div>
                          <div class="stat-label">Connections</div>
                      </div>`;
        legendHTML = `<div class="legend-item">
                          <div class="legend-color" style="background-color: #9b59b6;"></div>
                          <span>Gene</span>
                      </div>`;
    } else if (plotType === 'violin_plot') {
        const genesWithExpr = foundGenes.filter(g => expressionData[g.gene.toUpperCase()]);
        statsHTML += `<div class="stat-box">
                          <div class="stat-number">${genesWithExpr.length}</div>
                          <div class="stat-label">Genes with Expression Data</div>
                      </div>`;
        legendContainer.style.display = 'none'; // Legends built into violin plot
    } else if (plotType === 'expression_domain_bubble') {
        const genesWithExpr = foundGenes.filter(g => expressionData[g.gene.toUpperCase()]);
        const domainSet = new Set(foundGenes.flatMap(g => getCleanArray(g, 'domain_descriptions')));
        statsHTML += `<div class="stat-box">
                          <div class="stat-number">${genesWithExpr.length}</div>
                          <div class="stat-label">Genes with Expression Data</div>
                      </div>
                      <div class="stat-box">
                          <div class="stat-number">${domainSet.size}</div>
                          <div class="stat-label">Unique Domains</div>
                      </div>`;
        legendContainer.style.display = 'none';
    } else {
        const localizations = new Set(foundGenes.flatMap(g => getCleanArray(g, 'localization'))).size;
        statsHTML += `<div class="stat-box">
                          <div class="stat-number">${localizations}</div>
                          <div class="stat-label">Unique Localizations</div>
                      </div>`;
        legendContainer.style.display = 'none';
    }

    statsContainer.innerHTML = statsHTML;
    legendContainer.innerHTML = legendHTML;
}

// =============================================================================
// PLOT CUSTOMIZATION & DOWNLOAD
// =============================================================================

function getPlotSettings() {
    const setting = (id, def) => document.getElementById(id)?.value || def;
    return {
        fontFamily: setting('setting-font-family', 'Arial'),
        fontColor: setting('setting-font-color', '#333333'),
        titleFontSize: parseInt(setting('setting-title-font-size', 21)),
        axisTitleFontSize: parseInt(setting('setting-axis-title-font-size', 20)),
        tickFontSize: parseInt(setting('setting-tick-font-size', 20)),
        axisLineWidth: parseFloat(setting('setting-axis-line-width', 2)),
        axisLineColor: setting('setting-axis-line-color', '#333333'),
        backgroundColor: setting('setting-bg-color', '#ffffff'),
        gridColor: setting('setting-grid-color', '#e0e0e0'),
        showGrid: document.getElementById('setting-show-grid')?.checked ?? false,
    };
}

async function downloadPlot() {
    const format = document.getElementById('download-format')?.value || 'png';
    const plotArea = document.getElementById('plot-display-area');
    const plotType = document.getElementById('plot-type-select')?.value;
    if (!plotArea.firstChild || !plotType || plotArea.querySelector('.status-message')) {
        alert("Please generate a plot first.");
        return;
    }
    const fileName = `CiliaHub_${plotType}_plot.${format}`;
    const scale = 3;
    const width = plotArea.clientWidth;
    const height = plotArea.clientHeight;
    try {
        let dataUrl;
        const backgroundColor = getPlotSettings().backgroundColor;
        if (plotArea.querySelector('canvas')) {
            const tempCanvas = document.createElement('canvas');
            const sourceCanvas = plotArea.querySelector('canvas');
            tempCanvas.width = sourceCanvas.width;
            tempCanvas.height = sourceCanvas.height;
            const tempCtx = tempCanvas.getContext('2d');

            if (backgroundColor !== 'transparent') {
                tempCtx.fillStyle = backgroundColor;
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            }
            tempCtx.drawImage(sourceCanvas, 0, 0);
            dataUrl = tempCanvas.toDataURL('image/png');

        } else if (plotArea.querySelector('svg')) {
            const svgElement = plotArea.querySelector('svg');
            const canvas = document.createElement('canvas');
            canvas.width = width * scale;
            canvas.height = height * scale;
            const ctx = canvas.getContext('2d');
            if (backgroundColor !== 'transparent') {
                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            const img = new Image();
            const svgBlob = new Blob([new XMLSerializer().serializeToString(svgElement)], {
                type: "image/svg+xml;charset=utf-8"
            });
            const url = URL.createObjectURL(svgBlob);
            await new Promise((resolve, reject) => {
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(url);
                    dataUrl = canvas.toDataURL('image/png');
                    resolve();
                };
                img.onerror = reject;
                img.src = url;
            });
        }
        if (!dataUrl) throw new Error("Could not generate image data.");
        if (format === 'png') {
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = fileName;
            a.click();
        } else if (format === 'pdf') {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: width > height ? 'l' : 'p',
                unit: 'px',
                format: [width, height]
            });
            pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
            pdf.save(fileName);
        }
    } catch (e) {
        console.error("Download failed:", e);
        alert("An error occurred during download.");
    }
}

// =============================================================================
// PLOTTING FUNCTIONS: LOCALIZATION, DOMAIN & NETWORK
// =============================================================================

function renderKeyLocalizations(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes found.</p>';
        return;
    }
    const yCategories = ['Cilia', 'Basal Body', 'Transition Zone', 'Axoneme', 'Ciliary Membrane', 'Centrosome', 'Microtubules', 'Endoplasmic Reticulum', 'Flagella', 'Cytosol', 'Lysosome', 'Autophagosomes', 'Ribosome', 'Nucleus', 'P-body', 'Peroxisome'];
    const localizationCounts = {};
    foundGenes.forEach(gene => {
        getCleanArray(gene, 'localization').forEach(loc => {
            const match = yCategories.find(cat => cat.toLowerCase() === loc.toLowerCase());
            if (match) localizationCounts[match] = (localizationCounts[match] || 0) + 1;
        });
    });
    const categoriesWithData = yCategories.filter(cat => localizationCounts[cat] > 0);
    if (!categoriesWithData.length) {
        container.innerHTML = '<p class="status-message">No genes in primary ciliary localizations.</p>';
        return;
    }
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Gene Count',
                data: categoriesWithData.map(loc => ({
                    x: localizationCounts[loc],
                    y: loc,
                    r: 8 + localizationCounts[loc] * 2,
                    count: localizationCounts[loc]
                })),
                backgroundColor: 'rgba(52, 152, 219, 0.7)',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: "Key Ciliary Localizations", font: { size: settings.titleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                legend: { display: false },
                tooltip: { callbacks: { label: c => `${c.raw.y}: ${c.raw.count} gene(s)` } }
            },
            scales: {
                x: {
                    title: { display: true, text: "Gene Count", font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor }
                },
                y: {
                    type: 'category', labels: yCategories,
                    title: { display: true, text: "Cellular Compartment", font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor }
                }
            }
        }
    });
}

function renderGeneMatrix(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes to display.</p>';
        return;
    }
    const yCategories = [...new Set(foundGenes.flatMap(g => getCleanArray(g, 'localization')))]
        .filter(Boolean)
        .map(loc => loc.charAt(0).toUpperCase() + loc.slice(1))
        .sort();
    const xLabels = [...new Set(foundGenes.map(g => g.gene))].sort();
    if (yCategories.length === 0) {
        container.innerHTML = '<p class="status-message">Selected genes have no localization data.</p>';
        return;
    }
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: foundGenes.map((gene, index) => ({
                label: gene.gene,
                data: getCleanArray(gene, 'localization').map(loc => ({
                    x: gene.gene,
                    y: loc.charAt(0).toUpperCase() + loc.slice(1),
                    r: 10
                })),
                backgroundColor: d3.schemeTableau10[index % 10]
            }))
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: "Gene Localization Matrix", font: { size: settings.titleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                legend: { display: false },
                tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw.y}` } }
            },
            scales: {
                x: {
                    type: 'category', labels: xLabels,
                    title: { display: true, text: "Genes", font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor, maxRotation: 90, minRotation: 45 }
                },
                y: {
                    type: 'category', labels: yCategories,
                    title: { display: true, text: "Ciliary Compartment", font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor }
                }
            }
        }
    });
}

function renderDomainMatrixPlot(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');

    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes to display.</p>';
        return;
    }
    
    const allDomains = [...new Set(foundGenes.flatMap(g => getCleanArray(g, 'domain_descriptions')))];
    if (allDomains.length === 0) {
        container.innerHTML = '<p class="status-message">No domain description data found for the selected genes.</p>';
        return;
    }

    const yLabelMap = new Map(allDomains.map(domain => [
        domain,
        domain.length > 50 ? domain.substring(0, 47) + '...' : domain
    ]));

    const yCategories = [...yLabelMap.values()].sort();
    const xLabels = [...new Set(foundGenes.map(g => g.gene))].sort();
    
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: foundGenes.map((gene, index) => ({
                label: gene.gene,
                data: getCleanArray(gene, 'domain_descriptions').map(domain => ({
                    x: gene.gene,
                    y: yLabelMap.get(domain),
                    r: 10
                })),
                backgroundColor: d3.schemeCategory10[index % 10]
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: "Genes vs. Domain Descriptions", font: { size: settings.titleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                legend: { display: false },
                tooltip: { callbacks: { label: c => `${c.dataset.label}: ${[...yLabelMap.entries()].find(([k,v]) => v === c.raw.y)[0]}` } }
            },
            scales: {
                x: {
                    type: 'category', labels: xLabels,
                    title: { display: true, text: "Genes", font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor, maxRotation: 90, minRotation: 45 }
                },
                y: {
                    type: 'category', labels: yCategories,
                    title: { display: true, text: "Domain Description", font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor }
                }
            }
        }
    });
}

function renderFunctionalCategoryPlot(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');

    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes found.</p>';
        return;
    }

    const categoryCounts = new Map();
    foundGenes.forEach(gene => {
        const categories = getCleanArray(gene, 'functional_category');
        categories.forEach(cat => {
            categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
        });
    });

    if (categoryCounts.size === 0) {
        container.innerHTML = '<p class="status-message">No functional category data found for the selected genes.</p>';
        return;
    }

    const sortedData = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1]);
    
    const labels = sortedData.map(item => {
        const label = item[0];
        return label.length > 45 ? label.substring(0, 42) + '...' : label;
    });
    const data = sortedData.map(item => item[1]);

    currentPlotInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gene Count',
                data: data,
                backgroundColor: 'rgba(26, 188, 156, 0.7)',
                borderColor: 'rgba(26, 188, 156, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Functional Category Distribution', font: { size: settings.titleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                legend: { display: false },
                tooltip: { callbacks: { title: (c) => sortedData[c[0].dataIndex][0] } } // Show full title on hover
            },
            scales: {
                x: {
                    title: { display: true, text: 'Number of Genes', font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor, stepSize: 1 }
                },
                y: {
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor }
                }
            }
        }
    });
}

function computeProteinComplexLinks(foundGenes) {
    const nodes = foundGenes.map(gene => ({ id: gene.gene }));
    const complexMap = new Map();
    foundGenes.forEach(gene => {
        getCleanArray(gene, 'complex_names', 'complex').forEach(complex => {
            if (!complexMap.has(complex)) {
                complexMap.set(complex, new Set());
            }
            complexMap.get(complex).add(gene.gene);
        });
    });
    const linkMap = new Map();
    complexMap.forEach((genes) => {
        const geneArray = Array.from(genes);
        for (let i = 0; i < geneArray.length; i++) {
            for (let j = i + 1; j < geneArray.length; j++) {
                const key = [geneArray[i], geneArray[j]].sort().join('-');
                if (linkMap.has(key)) {
                    linkMap.get(key).value += 1;
                } else {
                    linkMap.set(key, { source: geneArray[i], target: geneArray[j], value: 1 });
                }
            }
        }
    });
    return { nodes, links: Array.from(linkMap.values()) };
}

function renderComplexNetwork(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    const { nodes, links } = computeProteinComplexLinks(foundGenes);
    if (!nodes.length || !links.length) {
        container.innerHTML = '<p class="status-message">No protein complex links found among the selected genes.</p>';
        return;
    }

    const width = container.clientWidth;
    const height = Math.max(500, container.clientHeight);
    const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);
    svg.append("rect").attr("width", "100%").attr("height", "100%").attr("fill", settings.backgroundColor);

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g").selectAll("line").data(links).enter().append("line").style("stroke", "#999").style("stroke-opacity", 0.6).style("stroke-width", d => Math.sqrt(d.value) * 2);

    const nodeGroup = svg.append("g").selectAll("g").data(nodes).enter().append("g").call(d3.drag().on("start", (e, d) => {
        if (!e.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
    }).on("drag", (e, d) => {
        d.fx = e.x; d.fy = e.y;
    }).on("end", (e, d) => {
        if (!e.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
    }));

    nodeGroup.append("circle").attr("r", 10).style("fill", "#3498db").style("stroke", "#fff").style("stroke-width", 2);
    
    nodeGroup.append("text")
        .text(d => d.id.length > 12 ? d.id.substring(0, 9) + '...' : d.id)
        .attr("x", 15).attr("y", 5)
        .style("font-family", settings.fontFamily)
        .style("font-size", "12px")
        .style("fill", settings.fontColor);

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        nodeGroup.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    currentPlotInstance = svg.node();
}

// =============================================================================
// PLOTTING FUNCTIONS: EXPRESSION ANALYSIS
// =============================================================================

/**
 * Get expression data for a specific gene from the global variable.
 */
function getGeneExpression(geneName) {
    return expressionData[geneName.toUpperCase()] || {};
}

/**
 * Get the master list of tissue names.
 */
function getTissueNames() {
    if (typeof tissueNames !== 'undefined' && tissueNames.length > 0) return tissueNames;
    if (Object.keys(expressionData).length > 0) {
        const firstGene = Object.keys(expressionData)[0];
        return Object.keys(expressionData[firstGene]);
    }
    return [];
}

/**
 * REVISED: Calculate expression statistics, now including standard deviation.
 */
function calculateExpressionStats(genes) {
    const tissues = getTissueNames();
    const stats = { meanExpression: {}, medianExpression: {}, maxExpression: {}, geneCount: {}, stdDevExpression: {} };
    tissues.forEach(tissue => {
        const values = genes.map(gene => {
            const expr = getGeneExpression(gene.gene);
            return expr && expr[tissue] !== undefined && expr[tissue] !== null ? expr[tissue] : 0;
        }).filter(v => v > 0);
        if (values.length > 0) {
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            stats.meanExpression[tissue] = mean;
            stats.medianExpression[tissue] = values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
            stats.maxExpression[tissue] = Math.max(...values);
            stats.geneCount[tissue] = values.length;
            const sumSq = values.reduce((a, b) => a + (b * b), 0);
            stats.stdDevExpression[tissue] = values.length > 1 ? Math.sqrt((sumSq - (mean * mean * values.length)) / (values.length - 1)) : 0;
        } else {
            stats.meanExpression[tissue] = 0;
            stats.medianExpression[tissue] = 0;
            stats.maxExpression[tissue] = 0;
            stats.geneCount[tissue] = 0;
            stats.stdDevExpression[tissue] = 0;
        }
    });
    return stats;
}

/**
 * Renders an expression heatmap with corrected positioning for the new dashboard layout.
 */
function renderExpressionHeatmap(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();

    if (!foundGenes.length || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available for selected genes.</p>';
        return false;
    }

    const tissues = getTissueNames();
    const genesWithExpression = foundGenes.filter(gene => Object.keys(getGeneExpression(gene.gene)).length > 0);

    if (genesWithExpression.length === 0) {
        container.innerHTML = '<p class="status-message">None of the selected genes have expression data.</p>';
        return false;
    }

    // Prepare data and calculate max expression
    let maxExpression = 0;
    const heatmapData = [];
    genesWithExpression.forEach(gene => {
        const expr = getGeneExpression(gene.gene);
        const maxGeneExpr = Math.max(0, ...Object.values(expr));
        maxExpression = Math.max(maxExpression, maxGeneExpr);
        tissues.forEach(tissue => {
            heatmapData.push({ gene: gene.gene, tissue: tissue, expression: expr[tissue] || 0 });
        });
    });

    // Ensure container has sufficient size
    const containerWidth = Math.max(600, container.clientWidth || 600); // Minimum width
    const containerHeight = Math.max(400, container.clientHeight || 400); // Minimum height
    const margin = { top: 60, right: 100, bottom: 150, left: 120 };
    const width = containerWidth - margin.left - margin.right;
    const height = Math.max(100, containerHeight - margin.top - margin.bottom); // Ensure positive height

    if (width <= 0 || height <= 0) {
        container.innerHTML = '<p class="status-message">Container size too small to render heatmap.</p>';
        console.error('Invalid dimensions: width=', width, 'height=', height);
        return false;
    }

    const svg = d3.select(container).append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`)
        .append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Scales
    const xScale = d3.scaleBand().domain(tissues).range([0, width]).padding(0.05);
    const yScale = d3.scaleBand().domain(genesWithExpression.map(g => g.gene)).range([0, height]).padding(0.05);
    const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([0, maxExpression]);

    // Draw heatmap rectangles
    svg.selectAll('.heatmap-rect')
       .data(heatmapData)
       .enter()
       .append('rect')
       .attr('class', 'heatmap-rect')
       .attr('x', d => xScale(d.tissue))
       .attr('y', d => yScale(d.gene))
       .attr('width', xScale.bandwidth())
       .attr('height', yScale.bandwidth())
       .attr('fill', d => colorScale(d.expression || 0));

    // Draw Axes
    svg.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .attr('transform', 'translate(-10,0)rotate(-45)')
        .style('text-anchor', 'end')
        .style('font-family', settings.fontFamily)
        .style('font-size', `${settings.tickFontSize}px`)
        .style('fill', settings.fontColor);

    svg.append('g')
       .call(d3.axisLeft(yScale))
       .selectAll('text')
       .style('font-family', settings.fontFamily)
       .style('font-size', `${settings.tickFontSize}px`)
       .style('fill', settings.fontColor);

    // Axis Labels
    d3.select(container).select('svg').append('text')
        .attr('text-anchor', 'middle')
        .attr('x', margin.left + width / 2)
        .attr('y', containerHeight - margin.bottom / 2 + 30)
        .text('Tissues')
        .attr('font-weight', 'bold')
        .style('font-family', settings.fontFamily)
        .style('font-size', `${settings.axisTitleFontSize}px`)
        .style('fill', settings.fontColor);

    d3.select(container).select('svg').append('text')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('y', margin.left / 2 - 20)
        .attr('x', -(margin.top + height / 2))
        .text('Genes')
        .attr('font-weight', 'bold')
        .style('font-family', settings.fontFamily)
        .style('font-size', `${settings.axisTitleFontSize}px`)
        .style('fill', settings.fontColor);

    // Color Legend
    const legendWidth = 20, legendHeight = height / 2;
    const legendX = width + 40;
    const legendY = height / 4;

    const legend = svg.append('g').attr('transform', `translate(${legendX}, ${legendY})`);
    const defs = legend.append('defs');
    const linearGradient = defs.append('linearGradient').attr('id', 'legend-gradient').attr('gradientTransform', 'rotate(90)');
    linearGradient.selectAll('stop')
        .data(colorScale.ticks().map((t, i, n) => ({ offset: `${100*i/n.length}%`, color: colorScale(t) })))
        .enter().append('stop')
        .attr('offset', d => d.offset)
        .attr('stop-color', d => d.color);

    legend.append('rect')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', 'url(#legend-gradient)');

    const legendScale = d3.scaleLinear().domain(colorScale.domain()).range([legendHeight, 0]);
    legend.append('g')
        .attr('transform', `translate(${legendWidth}, 0)`)
        .call(d3.axisRight(legendScale).ticks(5))
        .selectAll('text')
        .style('font-family', settings.fontFamily)
        .style('font-size', `${settings.tickFontSize}px`)
        .style('fill', settings.fontColor);

    currentPlotInstance = d3.select(container).select('svg').node();
    return true;
}
/**
 * REPLACED: Renders a tissue expression profile as a line chart instead of a radar chart.
 * This version is better for comparing across many categories and is more conventional
 * for scientific publications.
 */
function renderTissueExpressionProfile(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    if (!foundGenes.length || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available.</p>';
        return;
    }
    
    const tissues = getTissueNames();
    const validTissues = tissues.filter(tissue => {
        const isValid = foundGenes.some(gene => {
            const expr = getGeneExpression(gene.gene);
            return expr && typeof expr[tissue] !== 'undefined' && expr[tissue] !== null;
        });
        if (!isValid) console.warn(`Tissue "${tissue}" not found in expression data for any gene.`);
        return isValid;
    });
    
    if (!validTissues.length) {
        container.innerHTML = '<p class="status-message">No valid tissue data for selected genes.</p>';
        return;
    }
    
    const stats = calculateExpressionStats(foundGenes);
    
    // Sort by mean expression, limit to top 20 for readability
    const sortedTissues = validTissues.sort((a, b) => (stats.meanExpression[b] || 0) - (stats.meanExpression[a] || 0));
    const displayTissues = sortedTissues.slice(0, Math.min(20, sortedTissues.length));
    
    const labels = displayTissues.map(tissue => tissue.replace(/(.{15})/g, "$1\n"));
    const means = displayTissues.map(tissue => stats.meanExpression[tissue] || 0);
    const stdDevs = displayTissues.map(tissue => stats.stdDevExpression[tissue] || 0);
    const geneCounts = displayTissues.map(tissue => stats.geneCount[tissue] || 0);
    
    currentPlotInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Mean Expression (±SD, ${foundGenes.length} genes)`,
                data: means,
                backgroundColor: 'rgba(31, 120, 180, 0.2)', // Colorblind-friendly blue
                borderColor: 'rgba(31, 120, 180, 1)',
                borderWidth: 3,
                pointBackgroundColor: 'rgba(31, 120, 180, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                fill: true
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { 
                    display: true, 
                    text: 'Tissue Expression Profile (Top 20 Tissues)', 
                    font: { size: settings.titleFontSize + 4, family: 'Helvetica', weight: 'bold' },
                    color: '#333333'
                },
                legend: { 
                    display: true, position: 'top',
                    labels: { font: { size: settings.tickFontSize, family: 'Helvetica' }, color: '#333333' }
                },
                tooltip: {
                    callbacks: {
                        title: (context) => displayTissues[context[0].dataIndex],
                        label: (context) => [
                            `Mean: ${means[context.dataIndex].toFixed(2)}`,
                            `SD: ${stdDevs[context.dataIndex].toFixed(2)}`,
                            `Genes: ${geneCounts[context.dataIndex]}`
                        ]
                    },
                    bodyFont: { size: 14 }
                }
            },
            scales: {
                x: {
                    title: { 
                        display: true, text: 'Tissues (Sorted by Expression)', 
                        font: { size: settings.axisTitleFontSize + 2, family: 'Helvetica', weight: 'bold' },
                        color: '#333333'
                    },
                    grid: { display: settings.showGrid, color: '#e0e0e0' },
                    border: { display: true, width: settings.axisLineWidth + 1, color: '#333333' },
                    ticks: { 
                        font: { size: settings.tickFontSize + 2, family: 'Helvetica' },
                        color: '#333333', maxRotation: 90, minRotation: 45, padding: 10
                    }
                },
                y: {
                    title: { 
                        display: true, text: 'Mean Expression (nTPM)', 
                        font: { size: settings.axisTitleFontSize + 2, family: 'Helvetica', weight: 'bold' },
                        color: '#333333'
                    },
                    grid: { display: settings.showGrid, color: '#e0e0e0' },
                    border: { display: true, width: settings.axisLineWidth + 1, color: '#333333' },
                    ticks: { 
                        font: { size: settings.tickFontSize + 2, family: 'Helvetica' },
                        color: '#333333'
                    },
                    beginAtZero: true
                }
            },
            elements: { line: { tension: 0.1 } }
        }
    });
}

/**
 * IMPROVED: Renders a bubble plot with conditional gene labels.
 */
function renderExpressionLocalizationBubble(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    if (!foundGenes.length || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available.</p>';
        return;
    }
    
    const tissues = getTissueNames();
    const expressionThreshold = 1.0;
    
    const bubbleData = foundGenes.map(gene => {
        const geneExpr = getGeneExpression(gene.gene);
        const expressingTissues = tissues.filter(tissue => (geneExpr[tissue] || 0) > expressionThreshold);
        const maxExpression = Math.max(0, ...Object.values(geneExpr));
        const localizations = getCleanArray(gene, 'localization');
        
        return {
            x: expressingTissues.length,
            y: localizations.length,
            r: Math.max(5, Math.min(25, Math.sqrt(maxExpression) * 3)),
            gene: gene.gene,
            maxExpression: maxExpression,
            localizations: localizations.join(', ')
        };
    }).filter(d => d.x > 0 || d.y > 0);
    
    if (bubbleData.length === 0) {
        container.innerHTML = '<p class="status-message">No expression or localization data found for selected genes.</p>';
        return;
    }
    
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Genes',
                data: bubbleData,
                backgroundColor: 'rgba(155, 89, 182, 0.6)',
                borderColor: 'rgba(155, 89, 182, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Expression Breadth vs Localization Diversity', font: { size: settings.titleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: context => context[0].raw.gene,
                        label: context => [
                            `Expressing tissues: ${context.raw.x}`,
                            `Localizations: ${context.raw.y}`,
                            `Max expression: ${context.raw.maxExpression.toFixed(1)}`,
                            `Locations: ${context.raw.localizations || 'None'}`
                        ]
                    }
                },
                // NEW: Configuration for the datalabels plugin
                datalabels: {
                    // Only display labels if 15 or fewer genes are plotted
                    display: context => context.chart.data.datasets[0].data.length <= 15 ? 'auto' : false,
                    color: '#2c3e50',
                    anchor: 'end',
                    align: 'top',
                    offset: 4,
                    font: {
                        size: 12,
                        weight: 'bold',
                        family: settings.fontFamily
                    },
                    formatter: (value, context) => {
                        // Use the gene name for the label
                        return value.gene;
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Number of Expressing Tissues (>1.0 nTPM)', font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor, stepSize: 1 }
                },
                y: {
                    title: { display: true, text: 'Number of Subcellular Localizations', font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor, stepSize: 1 }
                }
            }
        }
    });
}

/**
 * Renders a plot-specific data table (e.g., for Expression vs. Localization).
 * This function uses your specified CSS classes.
 */
function renderGeneDataTable(foundGenes, container) {
    if (!container || !foundGenes.length) {
        if (container) container.innerHTML = ''; // Clear if no data
        return;
    }

    // Uses the .table-title class from your CSS
    let tableHTML = `<h3 class="table-title">Gene Data Summary</h3>`;
    
    // Uses the .table-responsive and .data-summary-table classes
    tableHTML += `
        <div class="table-responsive">
            <table class="data-summary-table">
                <thead>
                    <tr>
                        <th>Gene</th>
                        <th>ENSG ID</th>
                        <th>Localizations</th>
                        <th>Max Expression (nTPM)</th>
                    </tr>
                </thead>
                <tbody>`;

    foundGenes.forEach(gene => {
        const localizations = getCleanArray(gene, 'localization').join(', ') || 'N/A';
        const geneExpr = getGeneExpression(gene.gene);
        const maxExpression = Math.max(0, ...Object.values(geneExpr));
        tableHTML += `
            <tr>
                <td><strong>${gene.gene}</strong></td>
                <td>${gene.ensembl_id || 'N/A'}</td>
                <td>${localizations}</td>
                <td>${maxExpression.toFixed(2)}</td>
            </tr>`;
    });

    tableHTML += `</tbody></table></div>`;
    container.innerHTML = tableHTML;
}

function renderFoundNotFoundTable(data, containerOrId = 'table-container') {
    console.log('=== Table Rendering Debug ===');
    console.log('Data:', data);
    console.log('Container or ID:', containerOrId);

    // Determine container
    let container;
    if (typeof containerOrId === 'string') {
        container = document.getElementById(containerOrId);
    } else if (containerOrId instanceof HTMLElement) {
        container = containerOrId;
    } else {
        console.error('Invalid container provided:', containerOrId);
        console.log('Available elements:', document.querySelectorAll('[id*="table"], [id*="container"]'));
        return false;
    }

    if (!container) {
        console.error(`Container not found for: ${containerOrId}`);
        return false;
    }

    console.log('Container found:', container);

    // Clear existing content
    container.innerHTML = '';

    // Validate data
    if (!data || !Array.isArray(data)) {
        console.error('Invalid data provided');
        container.innerHTML = '<div style="color: red; padding: 20px;">Error: Invalid data provided</div>';
        return false;
    }

    try {
        // Determine data type (queries or gene objects)
        const isQueryBased = typeof data[0] === 'string';
        let geneData;
        if (isQueryBased) {
            // Handle queries (from plots.js)
            const foundSet = new Set(data.foundGenes ? data.foundGenes.map(g => g.gene.toUpperCase()) : []);
            geneData = data.map(query => ({
                name: query,
                found: foundSet.has(query.toUpperCase())
            }));
        } else {
            // Handle gene objects (from script.js)
            geneData = data;
        }

        // Create table structure
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-responsive';
        tableWrapper.style.cssText = `
            margin-top: 20px;
            overflow-x: auto;
            border: 1px solid #ddd;
            background: white;
            min-height: 100px;
        `;

        const table = document.createElement('table');
        table.className = 'data-summary-table';
        table.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            font-family: Arial, sans-serif;
        `;

        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th style="padding: 12px; border: 1px solid #ddd; background: #f5f5f5;">Input Gene</th>
            <th style="padding: 12px; border: 1px solid #ddd; background: #f5f5f5;">Status</th>
        `;
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body
        const tbody = document.createElement('tbody');
        geneData.forEach((item, index) => {
            const row = document.createElement('tr');
            const status = item.found ? 'Found' : 'Not Found';
            const statusClass = item.found ? 'status-found' : 'status-not-found';
            row.innerHTML = `
                <td style="padding: 10px; border: 1px solid #ddd;">${item.name || item.gene || 'Unknown'}</td>
                <td style="padding: 10px; border: 1px solid #ddd;"><span class="${statusClass}">${status}</span></td>
            `;
            row.addEventListener('mouseenter', () => row.style.backgroundColor = '#f8f9fa');
            row.addEventListener('mouseleave', () => row.style.backgroundColor = '');
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        // Create download button
        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = 'Download as CSV';
        downloadBtn.className = 'btn btn-secondary';
        downloadBtn.style.cssText = `
            margin-top: 10px;
            padding: 8px 16px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        downloadBtn.addEventListener('click', () => downloadTableAsCSV(geneData));
        downloadBtn.addEventListener('mouseenter', () => downloadBtn.style.background = '#0056b3');
        downloadBtn.addEventListener('mouseleave', () => downloadBtn.style.background = '#007bff');

        // Assemble and append
        tableWrapper.appendChild(table);
        tableWrapper.appendChild(downloadBtn);
        container.appendChild(tableWrapper);

        // Force visibility
        container.style.display = 'block';
        container.style.visibility = 'visible';

        // Scroll to table
        setTimeout(() => {
            tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);

        console.log('Table successfully rendered');
        return true;

    } catch (error) {
        console.error('Error rendering table:', error);
        container.innerHTML = `<div style="color: red; padding: 20px;">Error rendering table: ${error.message}</div>`;
        return false;
    }
}



/**
 * Renders the main gene query summary table at the bottom of the page.
 * This function also uses your specified CSS classes.
 */
function renderCiliaPlotSearchResultsTable(foundGenes, notFoundGenes) {
    const resultDiv = document.getElementById('ciliaplot-search-results');
    if (!resultDiv) return;

    if (foundGenes.length === 0 && notFoundGenes.length === 0) {
        resultDiv.innerHTML = '';
        return;
    }
    
    // Uses the .table-title class
    let html = `<h3 class="table-title">Gene Query Summary</h3>`;

    if (foundGenes.length > 0) {
        // Uses the .table-responsive and .data-summary-table classes
        html += `
            <div class="table-responsive">
                <table class="data-summary-table">
                    <thead>
                        <tr>
                            <th>Gene</th>
                            <th>Ensembl ID</th>
                            <th>Localization Summary</th>
                        </tr>
                    </thead>
                    <tbody>`;
        foundGenes.forEach(item => {
            const localizationText = getCleanArray(item, 'localization').join(', ') || 'N/A';
            html += `
                <tr>
                    <td><a href="/#/${item.gene}" onclick="navigateTo(event, '/${item.gene}')">${item.gene}</a></td>
                    <td>${item.ensembl_id || 'N/A'}</td>
                    <td>${localizationText}</td>
                </tr>`;
        });
        html += '</tbody></table></div>';
    }

    if (notFoundGenes && notFoundGenes.length > 0) {
        // Uses the .not-found-genes class
        html += `
            <div class="not-found-genes">
                <h4>Genes Not Found (${notFoundGenes.length}):</h4>
                <p>${notFoundGenes.join(', ')}</p>
            </div>`;
    }

    resultDiv.innerHTML = html;
}

/**
 * Renders a bar chart of the top expressing tissues.
 */
function renderTopExpressingTissues(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    if (!foundGenes.length || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available.</p>';
        return;
    }
    
    const tissues = getTissueNames();
    const stats = calculateExpressionStats(foundGenes);
    
    const tissueData = tissues.map(tissue => ({
        tissue: tissue,
        meanExpression: stats.meanExpression[tissue],
        geneCount: stats.geneCount[tissue]
    })).filter(d => d.meanExpression > 0)
      .sort((a, b) => b.meanExpression - a.meanExpression)
      .slice(0, 20); 
    
    if (tissueData.length === 0) {
        container.innerHTML = '<p class="status-message">No tissues with expression found for selected genes.</p>';
        return;
    }
    
    const labels = tissueData.map(d => d.tissue.length > 20 ? d.tissue.substring(0, 17) + '...' : d.tissue);
    const data = tissueData.map(d => d.meanExpression);
    
    currentPlotInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Mean Expression',
                data: data,
                backgroundColor: 'rgba(46, 204, 113, 0.7)',
                borderColor: 'rgba(46, 204, 113, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: `Top Expressing Tissues (${foundGenes.length} genes)`, font: { size: settings.titleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const tissueInfo = tissueData[index];
                            return `Mean Expression: ${context.parsed.x.toFixed(2)} (${tissueInfo.geneCount} genes)`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Mean Expression Level (nTPM)', font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor }
                },
                y: {
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: Math.max(10, settings.tickFontSize - 2), family: settings.fontFamily }, color: settings.fontColor }
                }
            }
        }
    });
}

// =============================================================================
// SIMULATED PROTEOMICS DATA FOR ADVANCED PLOTS
// =============================================================================

// This data simulates quantitative profiles for known organellar markers.
// Each array represents normalized abundance across 8 fictional cellular fractions.
const organelleMarkerProfiles = {
    "Cilia":         [0.1, 0.1, 0.2, 0.8, 0.9, 0.6, 0.2, 0.1],
    "Basal Body":    [0.1, 0.2, 0.7, 0.9, 0.8, 0.3, 0.1, 0.1],
    "Mitochondrion": [0.8, 0.9, 0.7, 0.2, 0.1, 0.1, 0.2, 0.3],
    "Nucleus":       [0.9, 0.8, 0.3, 0.1, 0.1, 0.1, 0.1, 0.1],
    "ER":            [0.2, 0.4, 0.8, 0.3, 0.2, 0.1, 0.5, 0.7],
    "Golgi":         [0.1, 0.2, 0.5, 0.2, 0.2, 0.2, 0.8, 0.9],
    "Cytosol":       [0.4, 0.5, 0.3, 0.3, 0.3, 0.4, 0.4, 0.3]
};
const fractionLabels = ['Fr 1', 'Fr 2', 'Fr 3', 'Fr 4', 'Fr 5', 'Fr 6', 'Fr 7', 'Fr 8'];

// This data simulates pre-computed UMAP coordinates for a set of proteins.
// This would typically be calculated from the high-dimensional proteomics data.
const precomputedUMAP = {
    // Each key is an organelle, containing an array of {gene, x, y} points
    "Cilia": Array.from({length: 50}, (_, i) => ({gene: `CILGEN${i}`, x: 8 + Math.random()*2, y: 8 + Math.random()*2})),
    "Basal Body": Array.from({length: 40}, (_, i) => ({gene: `BBGEN${i}`, x: 6 + Math.random()*2, y: 7 + Math.random()*2})),
    "Mitochondrion": Array.from({length: 60}, (_, i) => ({gene: `MTGEN${i}`, x: 1 + Math.random()*2, y: 2 + Math.random()*2})),
    "Nucleus": Array.from({length: 70}, (_, i) => ({gene: `NUCGEN${i}`, x: 9 + Math.random()*1.5, y: 1 + Math.random()*2})),
    "ER": Array.from({length: 50}, (_, i) => ({gene: `ERGEN${i}`, x: 2 + Math.random()*2, y: 8 + Math.random()*2})),
    "Golgi": Array.from({length: 40}, (_, i) => ({gene: `GOLGEN${i}`, x: 1 + Math.random()*2, y: 6 + Math.random()*2})),
    "Cytosol": Array.from({length: 80}, (_, i) => ({gene: `CYTGEN${i}`, x: 5 + Math.random()*3, y: 4 + Math.random()*3})),
};

// =============================================================================
// NEW PLOTTING FUNCTIONS: RADAR and UMAP
// =============================================================================

/**
 * Renders a Radar plot comparing the user's gene set profile to known organellar markers.
 */
function renderOrganelleRadarPlot(foundGenes, container) {
    clearPreviousPlot();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const settings = getPlotSettings();

    // Calculate the average profile for the user's gene set based on localization
    const userProfile = new Array(fractionLabels.length).fill(0);
    let contributingGenes = 0;
    foundGenes.forEach(gene => {
        const localizations = getCleanArray(gene, 'localization');
        let geneAdded = false;
        localizations.forEach(loc => {
            const matchedProfile = Object.keys(organelleMarkerProfiles).find(key => loc.toLowerCase().includes(key.toLowerCase()));
            if (matchedProfile) {
                const profile = organelleMarkerProfiles[matchedProfile];
                profile.forEach((val, i) => userProfile[i] += val);
                geneAdded = true;
            }
        });
        if (geneAdded) contributingGenes++;
    });
    
    if (contributingGenes > 0) {
        userProfile.forEach((val, i) => userProfile[i] /= contributingGenes);
    } else {
        container.innerHTML = '<p class="status-message">None of the input genes could be mapped to a known organellar profile.</p>';
        return;
    }

    const datasets = Object.entries(organelleMarkerProfiles).map(([name, data], index) => ({
        label: name,
        data: data,
        borderColor: d3.schemeTableau10[index],
        backgroundColor: d3.schemeTableau10[index] + '33', // Add transparency
        pointBackgroundColor: d3.schemeTableau10[index],
        hidden: true, // Hide markers by default for clarity
    }));

    // Add the user's gene set as a prominent, visible dataset
    datasets.push({
        label: 'Your Gene Set',
        data: userProfile,
        borderColor: '#e74c3c',
        backgroundColor: '#e74c3c55',
        pointBackgroundColor: '#c0392b',
        borderWidth: 3,
    });

    currentPlotInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: fractionLabels,
            datasets: datasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: "Organellar Profile Comparison", font: { size: settings.titleFontSize } },
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${context.raw.toFixed(2)}`
                    }
                }
            },
            scales: {
                r: {
                    angleLines: { display: true },
                    suggestedMin: 0,
                    suggestedMax: 1,
                    pointLabels: { font: { size: 14 } },
                    grid: { color: settings.gridColor },
                }
            },
            elements: {
                line: { tension: 0.1 }
            }
        }
    });
}


/**
 * Renders a UMAP scatter plot showing organelle clusters and highlighting the user's genes.
 */
function renderOrganelleUMAP(foundGenes, container) {
    clearPreviousPlot();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const settings = getPlotSettings();

    const backgroundDatasets = Object.entries(precomputedUMAP).map(([name, data], index) => ({
        label: name,
        data: data,
        backgroundColor: d3.schemeCategory10[index] + '77', // Semi-transparent background points
        pointRadius: 4,
    }));
    
    // Find the coordinates for the user's genes from our simulated data
    const userGeneData = [];
    let mappedCount = 0;
    foundGenes.forEach(gene => {
        let found = false;
        for (const organelle in precomputedUMAP) {
            // In a real scenario, you'd look up the gene name directly.
            // Here, we simulate by assigning the first available point from the matching organelle.
            const localizations = getCleanArray(gene, 'localization');
            if (localizations.some(loc => organelle.toLowerCase().includes(loc.toLowerCase()))) {
                const availablePoint = precomputedUMAP[organelle][mappedCount % precomputedUMAP[organelle].length];
                if (availablePoint) {
                    userGeneData.push({ ...availablePoint, gene: gene.gene }); // Use real gene name
                    mappedCount++;
                    found = true;
                    break; 
                }
            }
        }
    });
    
    if (userGeneData.length === 0) {
        container.innerHTML = '<p class="status-message">None of the input genes could be mapped to the UMAP projection.</p>';
        return;
    }

    const userDataset = {
        label: 'Your Genes',
        data: userGeneData,
        backgroundColor: '#e74c3c',
        pointRadius: 8,
        borderColor: '#ffffff',
        borderWidth: 2,
    };

    currentPlotInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [...backgroundDatasets, userDataset],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: "UMAP Projection of Organellar Proteomes", font: { size: settings.titleFontSize } },
                legend: { position: 'right' },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                           // context.raw has the {x, y, gene} object
                           return context.raw.gene ? `Gene: ${context.raw.gene}` : `${context.dataset.label}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'UMAP 1' },
                    grid: { display: false },
                    ticks: { display: false },
                },
                y: {
                    title: { display: true, text: 'UMAP 2' },
                    grid: { display: false },
                    ticks: { display: false },
                }
            }
        }
    });
}

// =============================================================================
// NEW PLOTTING FUNCTIONS: Bar, Chord, Violin, Bubble
// =============================================================================

function renderLocalizationBarPlot(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = '<canvas></canvas>';
    const ctx = container.querySelector('canvas').getContext('2d');

    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes found.</p>';
        return;
    }

    const yCategories = ['Cilia', 'Basal Body', 'Transition Zone', 'Axoneme', 'Ciliary Membrane', 'Centrosome', 'Microtubules', 'Endoplasmic Reticulum', 'Flagella', 'Cytosol', 'Lysosome', 'Autophagosomes', 'Ribosome', 'Nucleus', 'P-body', 'Peroxisome'];
    const localizationCounts = {};
    foundGenes.forEach(gene => {
        getCleanArray(gene, 'localization').forEach(loc => {
            const match = yCategories.find(cat => cat.toLowerCase() === loc.toLowerCase());
            if (match) localizationCounts[match] = (localizationCounts[match] || 0) + 1;
        });
    });

    const categoriesWithData = yCategories.filter(cat => localizationCounts[cat] > 0);
    if (!categoriesWithData.length) {
        container.innerHTML = '<p class="status-message">No genes in primary ciliary localizations.</p>';
        return;
    }

    currentPlotInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: categoriesWithData,
            datasets: [{
                label: 'Gene Count',
                data: categoriesWithData.map(loc => localizationCounts[loc]),
                backgroundColor: 'rgba(52, 152, 219, 0.7)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Key Ciliary Localizations (Bar)',
                    font: { size: settings.titleFontSize, family: settings.fontFamily },
                    color: settings.fontColor
                },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: c => `${c.label}: ${c.raw} gene(s)`
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Cellular Compartment',
                        font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' },
                        color: settings.fontColor
                    },
                    grid: { display: false },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: {
                        font: { size: settings.tickFontSize, family: settings.fontFamily },
                        color: settings.fontColor,
                        maxRotation: 90,
                        minRotation: 45
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Gene Count',
                        font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' },
                        color: settings.fontColor
                    },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor }
                }
            }
        }
    });
}

function renderViolinPlot(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = '<canvas></canvas>';
    const ctx = container.querySelector('canvas').getContext('2d');

    if (!foundGenes.length || typeof expressionData === 'undefined' || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">Expression data is not available for this plot.</p>';
        return;
    }

    const tissues = getTissueNames();
    const tissueExpressionData = {};
    tissues.forEach(tissue => { tissueExpressionData[tissue] = []; });

    foundGenes.forEach(gene => {
        const expr = getGeneExpression(gene.gene);
        tissues.forEach(tissue => {
            if (expr && expr[tissue] != null) {
                tissueExpressionData[tissue].push(expr[tissue]);
            }
        });
    });

    const plotData = tissues
        .map(tissue => ({ tissue: tissue, values: tissueExpressionData[tissue] }))
        .filter(d => d.values.length > 0)
        .sort((a, b) => d3.median(b.values) - d3.median(a.values))
        .slice(0, 25);

    if (plotData.length === 0) {
        container.innerHTML = '<p class="status-message">No expression data found for selected genes.</p>';
        return;
    }

    currentPlotInstance = new Chart(ctx, {
        type: 'boxplot', // Fallback to boxplot (requires chartjs-chart-boxplot plugin)
        data: {
            labels: plotData.map(d => d.tissue),
            datasets: [{
                label: `Expression Distribution (${foundGenes.length} genes)`,
                data: plotData.map(d => d.values),
                backgroundColor: 'rgba(155, 89, 182, 0.5)',
                borderColor: 'rgba(155, 89, 182, 1)',
                borderWidth: 1,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Gene Expression Distribution Across Tissues',
                    font: { size: settings.titleFontSize, family: settings.fontFamily },
                    color: settings.fontColor
                },
                legend: { display: false }
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Expression (nTPM)',
                        font: { size: settings.axisTitleFontSize, family: settings.fontFamily },
                        color: settings.fontColor
                    },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor }
                },
                x: {
                    grid: { display: false },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: {
                        font: { size: settings.tickFontSize - 4, family: settings.fontFamily },
                        color: settings.fontColor,
                        maxRotation: 90,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

function renderExpressionDomainBubblePlot(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = '<canvas></canvas>';
    const ctx = container.querySelector('canvas').getContext('2d');

    if (!foundGenes.length || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression or domain data available.</p>';
        return;
    }

    const tissues = getTissueNames();
    const expressionThreshold = 1.0;

    const bubbleData = foundGenes.map(gene => {
        const geneExpr = getGeneExpression(gene.gene);
        const expressingTissues = tissues.filter(tissue => (geneExpr[tissue] || 0) > expressionThreshold);
        const maxExpression = Math.max(0, ...Object.values(geneExpr));
        const domains = getCleanArray(gene, 'domain_descriptions');
        return {
            x: expressingTissues.length,
            y: domains.length,
            r: Math.max(5, Math.min(25, Math.sqrt(maxExpression) * 3)),
            gene: gene.gene,
            maxExpression: maxExpression,
            domains: domains.join(', ')
        };
    }).filter(d => d.x > 0 || d.y > 0);

    if (bubbleData.length === 0) {
        container.innerHTML = '<p class="status-message">No expression or domain data found for selected genes.</p>';
        return;
    }

    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Genes',
                data: bubbleData,
                backgroundColor: 'rgba(46, 204, 113, 0.6)',
                borderColor: 'rgba(46, 204, 113, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Expression Breadth vs Domain Diversity',
                    font: { size: settings.titleFontSize, family: settings.fontFamily },
                    color: settings.fontColor
                },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: context => context[0].raw.gene,
                        label: context => [
                            `Expressing tissues: ${context.raw.x}`,
                            `Domains: ${context.raw.y}`,
                            `Max expression: ${context.raw.maxExpression.toFixed(1)}`,
                            `Domains: ${context.raw.domains || 'None'}`
                        ]
                    }
                },
                datalabels: {
                    display: context => context.chart.data.datasets[0].data.length <= 15 ? 'auto' : false,
                    color: '#2c3e50',
                    anchor: 'end',
                    align: 'top',
                    offset: 4,
                    font: {
                        size: 12,
                        weight: 'bold',
                        family: settings.fontFamily
                    },
                    formatter: (value) => value.gene
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Number of Expressing Tissues (>1.0 nTPM)',
                        font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' },
                        color: settings.fontColor
                    },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor, stepSize: 1 }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Number of Protein Domains',
                        font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' },
                        color: settings.fontColor
                    },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor, stepSize: 1 }
                }
            }
        }
    });
}

function renderChordPlot(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();

    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes available for chord plot.</p>';
        return;
    }

    const tissues = getTissueNames();
    const matrix = Array.from({ length: foundGenes.length }, () => Array(tissues.length).fill(0));

    foundGenes.forEach((gene, i) => {
        const expr = getGeneExpression(gene.gene);
        tissues.forEach((tissue, j) => {
            if (expr && expr[tissue] != null) {
                matrix[i][j] = expr[tissue];
            }
        });
    });

    if (d3.sum(matrix.flat()) === 0) {
        container.innerHTML = '<p class="status-message">No expression data for chord plot.</p>';
        return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;
    const outerRadius = Math.min(width, height) * 0.5 - 60;
    const innerRadius = outerRadius - 20;

    const svg = d3.select(container).append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

    const chord = d3.chord()
        .padAngle(0.05)
        .sortSubgroups(d3.descending);

    const arc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius);

    const ribbon = d3.ribbon()
        .radius(innerRadius);

    const color = d3.scaleOrdinal()
        .domain([...foundGenes.map(g => g.gene), ...tissues])
        .range(d3.schemeTableau10);

    const ch = chord(matrix);
    const group = svg.append("g")
        .selectAll("g")
        .data(ch.groups)
        .join("g");

    group.append("path")
        .attr("fill", d => color(d.index < foundGenes.length ? foundGenes[d.index].gene : tissues[d.index - foundGenes.length]))
        .attr("stroke", d => d3.rgb(color(d.index < foundGenes.length ? foundGenes[d.index].gene : tissues[d.index - foundGenes.length])).darker())
        .attr("d", arc);

    group.append("text")
        .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
        .attr("dy", ".35em")
        .attr("transform", d => `
            rotate(${(d.angle * 180 / Math.PI - 90)})
            translate(${outerRadius + 10})
            ${d.angle > Math.PI ? "rotate(180)" : ""}
        `)
        .attr("text-anchor", d => d.angle > Math.PI ? "end" : null)
        .text(d => d.index < foundGenes.length ? foundGenes[d.index].gene : tissues[d.index - foundGenes.length])
        .style("font-family", settings.fontFamily)
        .style("font-size", "12px")
        .style("fill", settings.fontColor);

    svg.append("g")
        .attr("fill-opacity", 0.7)
        .selectAll("path")
        .data(ch)
        .join("path")
        .attr("d", ribbon)
        .attr("fill", d => color(d.source.index < foundGenes.length ? foundGenes[d.source.index].gene : tissues[d.source.index - foundGenes.length]))
        .attr("stroke", d => d3.rgb(color(d.source.index < foundGenes.length ? foundGenes[d.source.index].gene : tissues[d.source.index - foundGenes.length])).darker());

    currentPlotInstance = svg.node();
}

// =============================================================================
// MAIN PAGE DISPLAY FUNCTION
// =============================================================================

function displayCiliaPlotPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    document.querySelector('.cilia-panel').style.display = 'none';
    
    // New HTML structure with accordions and tabs
    contentArea.innerHTML = `
        <div class="page-section ciliaplot-page">
            <div class="ciliaplot-header">
                <h1>CiliaPlot Gene Set Analysis</h1>
                <p class="info">
                    Enter a list of genes to perform functional enrichment and network analysis, 
                    generating publication-ready visualizations.
                </p>
            </div>

            <div class="ciliaplot-container-pro">
                <div class="ciliaplot-left-panel-pro">
                    <div class="accordion-item active">
                        <div class="accordion-header">
                            <h3>1. Input Data & Analysis</h3>
                        </div>
                        <div class="accordion-content">
                            <textarea id="ciliaplot-genes-input" placeholder="Enter one gene per line...\ne.g., ARL13B\nIFT88\nBBS1\nCEP290"></textarea>
                            <label for="plot-type-select"><b>Select Analysis Type</b></label>
                            <select id="plot-type-select">
                                <optgroup label="Localization Analysis">
                                    <option value="bubble">Key Localizations (Bubble)</option>
                                    <option value="localization_bar">Key Localizations (Bar)</option>
                                    <option value="matrix">Gene-Localization Matrix</option>
                                </optgroup>
                                <optgroup label="Functional Analysis">
                                    <option value="domain_matrix">Gene-Domain Matrix</option>
                                    <option value="functional_category">Functional Category</option>
                                    <option value="network">Protein Complex Network</option>
                                    <option value="chord_plot">Protein Complex (Chord)</option>
                                </optgroup>
                                <optgroup label="Expression Analysis">
                                    <option value="expression_heatmap">Expression Heatmap</option>
                                    <option value="violin_plot">Expression Violin Plot</option>
                                    <option value="tissue_profile">Tissue Expression Profile</option>
                                    <option value="expression_localization">Expression vs. Localization</option>
                                    <option value="expression_domain_bubble">Expression vs. Domain</option>
                                    <option value="top_tissues">Top Expressing Tissues</option>
                                </optgroup>
                                <optgroup label="Proteomics Analysis">
                                    <option value="organelle_radar">Organellar Profile (Radar)</option>
                                    <option value="organelle_umap">Organellar Projection (UMAP)</option>
                                </optgroup>
                            </select>
                            <button id="generate-plot-btn" class="btn btn-primary">Run Analysis</button>
                        </div>
                    </div>

                    <div class="accordion-item">
                        <div class="accordion-header">
                            <h3>2. Plot Style Settings</h3>
                        </div>
                        <div class="accordion-content" id="plot-settings-grid">
                             <div><label>Title Font Size</label><input type="number" id="setting-title-font-size" value="21"></div>
                             <div><label>Axis Title Font Size</label><input type="number" id="setting-axis-title-font-size" value="20"></div>
                             <div><label>Axis Tick Font Size</label><input type="number" id="setting-tick-font-size" value="20"></div>
                             <div><label>Font</label><select id="setting-font-family"><option>Arial</option><option>Verdana</option><option>Times New Roman</option></select></div>
                             <div><label>Text Color</label><input type="color" id="setting-font-color" value="#333333"></div>
                             <div><label>Background</label><input type="color" id="setting-bg-color" value="#ffffff"></div>
                             <div><label>Axis Line Width</label><input type="number" id="setting-axis-line-width" value="2" step="0.5"></div>
                             <div><label>Axis Line Color</label><input type="color" id="setting-axis-line-color" value="#333333"></div>
                             <div><label>Gridline Color</label><input type="color" id="setting-grid-color" value="#e0e0e0"></div>
                             <div><label><input type="checkbox" id="setting-show-grid"> Show Grid</label></div>
                        </div>
                    </div>

                    <div class="accordion-item">
                        <div class="accordion-header">
                            <h3>3. Download Plot</h3>
                        </div>
                        <div class="accordion-content">
                             <select id="download-format">
                                 <option value="png">Download as PNG</option>
                                 <option value="pdf">Download as PDF</option>
                             </select>
                             <button id="download-plot-btn" class="btn btn-secondary">Download</button>
                        </div>
                    </div>
                </div>

                <div class="ciliaplot-right-panel-pro">
                    <div id="ciliaplot-plot-info" class="info">Select an analysis type and click "Run Analysis" to begin.</div>
                    <div id="ciliaplot-stats-container" class="stats-container"></div>
                    
                    <div class="tab-container">
                        <div class="tab-buttons">
                            <button class="tab-button active" data-tab="plot-tab">Plot</button>
                            <button class="tab-button" data-tab="summary-tab">Data Summary</button>
                            <button class="tab-button" data-tab="status-tab">Input Status</button>
                        </div>
                        <div class="tab-content">
                            <div id="plot-tab" class="tab-pane active">
                                <div id="plot-display-area" class="plot-container-pro">
                                    <p class="status-message">Your plot will appear here.</p>
                                </div>
                                <div id="ciliaplot-legend-container" class="legend"></div>
                            </div>
                            <div id="summary-tab" class="tab-pane">
                                <div id="plot-data-table-container"></div>
                            </div>
                            <div id="status-tab" class="tab-pane">
                                <div id="ciliaplot-search-results"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // --- JAVASCRIPT FOR NEW INTERACTIVE ELEMENTS ---
    
    // Accordion functionality
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const accordionItem = header.parentElement;
            accordionItem.classList.toggle('active');
        });
    });

    // Tab functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Deactivate all
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            // Activate clicked
            button.classList.add('active');
            document.getElementById(button.dataset.tab).classList.add('active');
        });
    });

    // --- RE-ATTACH ORIGINAL EVENT LISTENERS ---
    
    document.getElementById('generate-plot-btn').addEventListener('click', generateAnalysisPlots);
    document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
    document.getElementById('plot-type-select').addEventListener('change', (e) => updatePlotInfo(e.target.value));
    document.getElementById('plot-settings-grid').addEventListener('change', () => {
        if (currentPlotInstance) { 
            generateAnalysisPlots();
        }
    });
    updatePlotInfo(document.getElementById('plot-type-select').value);
}
