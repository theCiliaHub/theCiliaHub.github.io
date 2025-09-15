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
 * Renders a summary table of found and not-found genes for CiliaPlot.
 * This function is adapted from the BatchQuery's displayBatchResults.
 * @param {Array} foundGenes - Array of gene objects that were found in the database.
 * @param {Array} notFoundGenes - Array of gene names that were not found.
 */
function renderCiliaPlotSearchResultsTable(foundGenes, notFoundGenes) {
    const resultDiv = document.getElementById('ciliaplot-search-results');
    if (!resultDiv) {
        console.error('CiliaPlot search results container not found.');
        return;
    }

    let html = `<h3>Query Summary (${foundGenes.length} gene${foundGenes.length !== 1 ? 's' : ''} found)</h3>`;

    if (foundGenes.length > 0) {
        html += `
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Gene</th>
                            <th>Ensembl ID</th>
                            <th>Localization Summary</th>
                            <th>Function Summary</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        foundGenes.forEach(item => {
            const localizationText = Array.isArray(item.localization) ? item.localization.join(', ') : (item.localization || 'N/A');
            html += `
                <tr>
                    <td><a href="/${item.gene}" onclick="navigateTo(event, '/${item.gene}')">${item.gene}</a></td>
                    <td>${item.ensembl_id || 'N/A'}</td>
                    <td>${localizationText}</td>
                    <td>${item.functional_summary ? item.functional_summary.substring(0, 100) + '...' : 'N/A'}</td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
    }

    if (notFoundGenes && notFoundGenes.length > 0) {
        html += `
            <div class="not-found-genes">
                <h4>Genes Not Found (${notFoundGenes.length}):</h4>
                <p>${notFoundGenes.join(', ')}</p>
            </div>
        `;
    }

    resultDiv.innerHTML = html;
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

/**
 * Main controller for CiliaPlot. It now performs the search, displays a summary
 * table of results, and then generates the selected analytical plot.
 */
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

        // Clear all previous results before starting a new analysis
        clearPreviousPlot();
        if (searchResultsContainer) searchResultsContainer.innerHTML = '';
        const tableContainer = document.getElementById('plot-data-table-container');
        if (tableContainer) tableContainer.innerHTML = '';
        plotContainer.innerHTML = '<p class="status-message">Searching genes and generating plot...</p>';

        const sanitizedQueries = [...new Set(genesInput.split(/[\s,;\n\r\t]+/).filter(Boolean).map(q => q.toUpperCase()))];
        const { foundGenes, notFoundGenes } = findGenes(sanitizedQueries);

        // **NEW**: Render the search results table first
        renderCiliaPlotSearchResultsTable(foundGenes, notFoundGenes);

        if (foundGenes.length === 0) {
            plotContainer.innerHTML = '<p class="status-message error">No valid genes were found to generate a plot.</p>';
            updateStatsAndLegend(document.getElementById('plot-type-select').value, []); // Clear stats
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
                renderFoundNotFoundTable(sanitizedQueries, foundGenes, document.getElementById('plot-data-table-container'));
                break;
            case 'tissue_profile':
                renderTissueExpressionProfile(foundGenes, plotContainer);
                break;
            case 'top_tissues':
                renderTopExpressingTissues(foundGenes, plotContainer);
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


/**
 * Updates the informational text box with a description of the current plot.
 * @param {string} plotType - The selected plot type.
 */
function updatePlotInfo(plotType) {
    const infoContainer = document.getElementById('ciliaplot-plot-info');
    if (!infoContainer) return;
    let infoHTML = '';
    switch (plotType) {
        case 'bubble':
            infoHTML = `<strong>Key Localizations:</strong> This bubble plot shows the distribution of your genes across primary ciliary and cellular compartments. The size of each bubble corresponds to the number of genes found in that location.`;
            break;
        case 'matrix':
            infoHTML = `<strong>Gene-Localization Matrix:</strong> This plot shows the specific localization for each gene in your list. A bubble indicates that a gene is associated with a particular ciliary compartment.`;
            break;
        case 'domain_matrix':
            infoHTML = `<strong>Gene-Domain Matrix:</strong> This plot shows which protein domains are present in each gene. This helps identify shared functional components among your selected genes.`;
            break;
        case 'functional_category':
            infoHTML = `<strong>Functional Category Bar Chart:</strong> This chart categorizes your genes into broader functional groups, providing an overview of the biological processes they are involved in.`;
            break;
        case 'network':
            infoHTML = `<strong>Protein Complex Network:</strong> This network graph visualizes known protein-protein interactions and complex memberships among your selected genes, revealing functional modules.`;
            break;
        case 'expression_heatmap':
            infoHTML = `<strong>Expression Heatmap:</strong> This plot displays the expression level (nTPM) of each selected gene across various human tissues. Darker colors indicate higher expression.`;
            break;
        case 'tissue_profile':
            infoHTML = `<strong>Tissue Expression Profile:</strong> This line chart shows the average expression of your gene set across the top 20 tissues, highlighting potential tissue-specific enrichment.`;
            break;
        case 'expression_localization':
            infoHTML = `<strong>Expression vs. Localization:</strong> This bubble plot correlates expression breadth (number of expressing tissues) with localization diversity. Bubble size represents the maximum expression level.`;
            break;
        case 'top_tissues':
            infoHTML = `<strong>Top Expressing Tissues:</strong> This bar chart ranks tissues by the average expression level of your gene set, showing where these genes are most active.`;
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

    let statsHTML = '', legendHTML = '';
    statsHTML += `<div class="stat-box"><div class="stat-number">${foundGenes.length}</div><div class="stat-label">Input Genes Found</div></div>`;

    if (plotType === 'network') {
        const { links } = computeProteinComplexLinks(foundGenes);
        const complexSet = new Set(foundGenes.flatMap(g => getCleanArray(g, 'complex_names', 'complex')));
        statsHTML += `<div class="stat-box"><div class="stat-number">${complexSet.size}</div><div class="stat-label">Unique Complexes</div></div><div class="stat-box"><div class="stat-number">${links.length}</div><div class="stat-label">Interactions</div></div>`;
        legendHTML = `<div class="legend-item"><div class="legend-color" style="background-color: #3498db;"></div><span>Gene</span></div>`;
    } else if (plotType === 'functional_category') {
        const categorySet = new Set(foundGenes.flatMap(g => getCleanArray(g, 'functional_category')));
        statsHTML += `<div class="stat-box"><div class="stat-number">${categorySet.size}</div><div class="stat-label">Unique Categories</div></div>`;
        legendHTML = `<div class="legend-item"><div class="legend-color" style="background-color: rgba(26, 188, 156, 0.7); border-radius: 4px;"></div><span>Gene Count</span></div>`;
    } else if (plotType === 'domain_matrix') {
        const domainSet = new Set(foundGenes.flatMap(g => getCleanArray(g, 'domain_descriptions')));
        statsHTML += `<div class="stat-box"><div class="stat-number">${domainSet.size}</div><div class="stat-label">Unique Domains</div></div>`;
        legendContainer.style.display = 'none'; // No legend for this plot
    } else if (plotType.startsWith('expression') || plotType === 'top_tissues' || plotType === 'tissue_profile') {
        const genesWithExpr = foundGenes.filter(g => expressionData[g.gene.toUpperCase()]);
        statsHTML += `<div class="stat-box"><div class="stat-number">${genesWithExpr.length}</div><div class="stat-label">Genes with Expression Data</div></div>`;
        legendContainer.style.display = 'none'; // Legends are built into these plots
    } else {
        const localizations = new Set(foundGenes.flatMap(g => getCleanArray(g, 'localization'))).size;
        statsHTML += `<div class="stat-box"><div class="stat-number">${localizations}</div><div class="stat-label">Unique Localizations</div></div>`;
        legendContainer.style.display = 'none'; // No legend for this plot
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

// NOTE: This matrix plot and the domain matrix plot could be merged into a single,
// customizable component to reduce redundancy, as they share the same structure.
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
    // TODO: Enhance this plot by adding domain enrichment statistics (e.g., via a hypergeometric test)
    // to make the output more suitable for publication.
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
    // TODO: To align with publication standards, replace raw gene counts with
    // statistical enrichment results (e.g., p-values from a GO/KEGG analysis).
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
    // TODO: Add advanced features like network clustering (e.g., Louvain) and an
    // "Export to Cytoscape" option for publication-quality figure generation.
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
 * Renders an expression heatmap.
 */
function renderExpressionHeatmap(foundGenes, container) {
    clearPreviousPlot();
    // TODO: Add hierarchical clustering for both genes and tissues to reveal
    // expression patterns, which is a standard feature in publication heatmaps.
    const settings = getPlotSettings();
    
    if (!foundGenes.length || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available for selected genes.</p>';
        return;
    }
    
    const tissues = getTissueNames();
    if (tissues.length === 0) {
        container.innerHTML = '<p class="status-message">No tissue data found in expression dataset.</p>';
        return;
    }
    
    const genesWithExpression = foundGenes.filter(gene => Object.keys(getGeneExpression(gene.gene)).length > 0);
    
    if (genesWithExpression.length === 0) {
        container.innerHTML = '<p class="status-message">None of the selected genes have expression data.</p>';
        return;
    }
    
    let maxExpression = 0;
    genesWithExpression.forEach(gene => {
        const expr = getGeneExpression(gene.gene);
        const maxGeneExpr = Math.max(0, ...Object.values(expr));
        maxExpression = Math.max(maxExpression, maxGeneExpr);
    });
    
    container.style.overflowX = 'auto';
    const containerWidth = container.clientWidth || 800;
    const minBandWidth = 15;
    const calcWidth = Math.max(containerWidth, tissues.length * minBandWidth + 200);
    const width = Math.min(calcWidth, 2000);
    const height = Math.max(400, genesWithExpression.length * 25 + 220);
    
    const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
    svg.append('rect').attr('width', '100%').attr('height', '100%').attr('fill', settings.backgroundColor);
    
    const margin = {top: 80, right: 80, bottom: 140, left: 120};
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    
    const xScale = d3.scaleBand().domain(tissues).range([0, plotWidth]).padding(0.1);
    const yScale = d3.scaleBand().domain(genesWithExpression.map(g => g.gene)).range([0, plotHeight]).padding(0.1);
    const colorScale = d3.scaleSequential().interpolator(d3.interpolateViridis).domain([0, maxExpression]);
    
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    
    svg.append('text').attr('x', width / 2).attr('y', 30).attr('text-anchor', 'middle')
        .style('font-family', settings.fontFamily).style('font-size', `${settings.titleFontSize}px`)
        .style('font-weight', 'bold').style('fill', settings.fontColor).text('Gene Expression Heatmap Across Tissues');
    
    const heatmapData = [];
    genesWithExpression.forEach(gene => {
        const expr = getGeneExpression(gene.gene);
        tissues.forEach(tissue => {
            heatmapData.push({ gene: gene.gene, tissue: tissue, expression: expr[tissue] || 0 });
        });
    });
    
    g.selectAll('.heatmap-rect').data(heatmapData).enter().append('rect')
        .attr('class', 'heatmap-rect').attr('x', d => xScale(d.tissue)).attr('y', d => yScale(d.gene))
        .attr('width', xScale.bandwidth()).attr('height', yScale.bandwidth())
        .attr('fill', d => d.expression > 0 ? colorScale(d.expression) : '#f0f0f0')
        .attr('stroke', 'white').attr('stroke-width', 0.5).style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this).attr('stroke-width', 2).attr('stroke', '#333');
            const tooltip = d3.select('body').append('div').attr('class', 'expression-tooltip')
                .style('position', 'absolute').style('background', 'rgba(0,0,0,0.9)').style('color', 'white')
                .style('padding', '10px').style('border-radius', '5px').style('font-size', '12px')
                .style('pointer-events', 'none').style('z-index', '1000').style('opacity', 0);
            tooltip.html(`<strong>${d.gene}</strong><br/>${d.tissue}<br/>Expression: ${d.expression.toFixed(2)}`)
                .style('left', `${event.pageX + 10}px`).style('top', `${event.pageY - 10}px`)
                .transition().duration(200).style('opacity', 1);
        }).on('mouseout', function() {
            d3.select(this).attr('stroke-width', 0.5).attr('stroke', 'white');
            d3.selectAll('.expression-tooltip').remove();
        });
    
    const xTickFontSize = Math.max(6, Math.min(settings.tickFontSize, xScale.bandwidth() * 0.8));
    g.append('g').attr('transform', `translate(0,${plotHeight})`).call(d3.axisBottom(xScale))
        .selectAll('text').style('font-family', settings.fontFamily)
        .style('font-size', `${xTickFontSize}px`).style('fill', settings.fontColor)
        .attr('transform', 'rotate(-45)').style('text-anchor', 'end');
    
    const yTickFontSize = Math.max(6, Math.min(settings.tickFontSize, yScale.bandwidth() * 0.8));
    g.append('g').call(d3.axisLeft(yScale)).selectAll('text')
        .style('font-family', settings.fontFamily).style('font-size', `${yTickFontSize}px`).style('fill', settings.fontColor);
    
    svg.append('text').attr('transform', `translate(${width/2},${height - 20})`).style('text-anchor', 'middle')
        .style('font-family', settings.fontFamily).style('font-size', `${settings.axisTitleFontSize}px`)
        .style('font-weight', 'bold').style('fill', settings.fontColor).text('Tissues');
    
    svg.append('text').attr('transform', 'rotate(-90)').attr('y', 20).attr('x', 0 - (height / 2)).style('text-anchor', 'middle')
        .style('font-family', settings.fontFamily).style('font-size', `${settings.axisTitleFontSize}px`)
        .style('font-weight', 'bold').style('fill', settings.fontColor).text('Genes');
    
    const legendWidth = 20, legendHeight = 200, legendX = width - 60, legendY = margin.top;
    const legendScale = d3.scaleLinear().domain([0, maxExpression]).range([legendHeight, 0]);
    const legendAxis = d3.axisRight(legendScale).ticks(5).tickFormat(d3.format('.1f'));
    const defs = svg.append('defs');
    const legendGradient = defs.append('linearGradient').attr('id', 'legend-gradient').attr('x1', '0%').attr('y1', '100%').attr('x2', '0%').attr('y2', '0%');
    legendGradient.selectAll('stop').data(d3.range(0, 1.1, 0.1)).enter().append('stop')
        .attr('offset', d => `${d * 100}%`).attr('stop-color', d => colorScale(d * maxExpression));
    svg.append('rect').attr('x', legendX).attr('y', legendY).attr('width', legendWidth).attr('height', legendHeight)
        .style('fill', 'url(#legend-gradient)').style('stroke', '#ccc');
    svg.append('g').attr('transform', `translate(${legendX + legendWidth}, ${legendY})`).call(legendAxis)
        .selectAll('text').style('font-family', settings.fontFamily).style('font-size', '10px').style('fill', settings.fontColor);
    
    currentPlotInstance = svg.node();
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
 * NEW: Renders a data table below the plot.
 * @param {Array} foundGenes - The array of gene objects to display.
 * @param {HTMLElement} container - The container element to render the table into.
 */
function renderGeneDataTable(foundGenes, container) {
    if (!container || !foundGenes.length) return;

    let tableHTML = `
        <h3 class="table-title">Gene Data Summary</h3>
        <table class="data-summary-table">
            <thead>
                <tr>
                    <th>Gene</th>
                    <th>ENSG ID</th>
                    <th>Localizations</th>
                    <th>Max Expression (nTPM)</th>
                </tr>
            </thead>
            <tbody>
    `;

    foundGenes.forEach(gene => {
        const localizations = getCleanArray(gene, 'localization').join(', ') || 'N/A';
        const geneExpr = getGeneExpression(gene.gene);
        const maxExpression = Math.max(0, ...Object.values(geneExpr));

        tableHTML += `
            <tr>
                <td><strong>${gene.gene}</strong></td>
                <td>${gene.ensg_id || 'N/A'}</td>
                <td>${localizations}</td>
                <td>${maxExpression.toFixed(2)}</td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    container.innerHTML = tableHTML;
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

/**
 * NEW: Renders a table of found and not found input genes.
 * @param {Array} queries - The sanitized input queries.
 * @param {Array} foundGenes - The array of found gene objects.
 * @param {HTMLElement} container - The container element to render the table into.
 */
function renderFoundNotFoundTable(queries, foundGenes, container) {
    if (!container) return;

    const foundSet = new Set(foundGenes.map(g => g.gene.toUpperCase()));

    let tableHTML = `
        <h3 class="table-title">Input Genes Status</h3>
        <button id="download-status-csv" class="download-button">Download as CSV</button>
        <table class="data-summary-table">
            <thead>
                <tr>
                    <th>Input Gene</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    queries.forEach(query => {
        const status = foundSet.has(query) ? 'Found' : 'Not Found';
        tableHTML += `
            <tr>
                <td>${query}</td>
                <td>${status}</td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    container.innerHTML = tableHTML;

    // Add event listener for download
    document.getElementById('download-status-csv').addEventListener('click', () => {
        let csvContent = 'Input Gene,Status\n';
        queries.forEach(query => {
            const status = foundSet.has(query) ? 'Found' : 'Not Found';
            csvContent += `${query},${status}\n`;
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'gene_status.csv';
        link.click();
        URL.revokeObjectURL(url);
    });
}


/**
 * Renders the main structure of the CiliaPlot analysis page.
 */
function displayCiliaPlotPage() {
    const contentArea = document.querySelector('.content-area');
    // Set the class to style the page layout correctly
    contentArea.className = 'content-area ciliaplot-layout'; 
    document.querySelector('.cilia-panel').style.display = 'none'; // Hide side panel for more space

    // This is the HTML structure for the entire CiliaPlot page
    contentArea.innerHTML = `
        <div class="page-section">
            <h2>CiliaPlot: Gene Set Analysis</h2>
            <p style="font-size: 1rem; color: #555;">
                Enter a list of genes to generate analytical plots for localization, 
                protein domains, expression, and more.
            </p>

            <div class="ciliaplot-input-section">
                <label for="ciliaplot-genes-input">Enter Gene Names:</label>
                <textarea id="ciliaplot-genes-input" placeholder="e.g., IFT88, CEP290, BBS1..."></textarea>
                
                <label for="plot-type-select">Select Plot Type:</label>
                <select id="plot-type-select">
                    <option value="bubble">Key Localizations</option>
                    <option value="matrix">Gene-Localization Matrix</option>
                    <option value="domain_matrix">Gene-Domain Matrix</option>
                    <option value="functional_category">Functional Categories</option>
                    <option value="network">Protein Complex Network</option>
                    <option value="expression_heatmap">Expression Heatmap</option>
                    <option value="tissue_profile">Tissue Expression Profile</option>
                    <option value="top_tissues">Top Expressing Tissues</option>
                    <option value="expression_localization">Expression vs. Localization</option>
                </select>

                <button id="generate-plot-btn" class="btn btn-primary">Generate Plot</button>
            </div>
            
            <div id="ciliaplot-search-results" class="search-results-container"></div>

            <div id="plot-display-area" class="plot-container"></div>
            <div id="plot-data-table-container"></div>
        </div>
    `;

    // Attach the event listener to the new button
    document.getElementById('generate-plot-btn').onclick = generateAnalysisPlots;
}


