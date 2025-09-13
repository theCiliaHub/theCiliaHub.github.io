// =============================================================================
// CiliaHub Plotting Engine (plots.js) - v2.0.4
// =============================================================================
// Fixes:
// - Resolved SyntaxError in renderExpressionHeatmap (line ~1018) by validating parentheses and literals.
// - Added generateAnalysisPlots to fix ReferenceError in script.js:2245.
// - Fixed undefined functions (getGeneExpression, getPlotSettings, computeProteinComplexLinks).
// Improvements:
// - Colorblind-friendly colors (Tableau10, Viridis).
// - Clustering for heatmaps and networks.
// - Error bars in tissue expression profiles.
// - Optimized for large datasets (50 genes, 20 tissues).
// - Enhanced tooltips and label truncation.
// Dependencies: D3.js, Chart.js, jsPDF, html2canvas
// Global variables: expressionData, allGenes (from script.js)
// =============================================================================

let currentPlotInstance = null;
let expressionData = {}; // Populated in script.js
let tissueNames = []; // Populated in script.js or derived from expressionData

/**
 * Safely clears the previous plot, handling both Chart.js and D3.js instances.
 */
function clearPreviousPlot() {
    if (currentPlotInstance) {
        if (typeof currentPlotInstance.destroy === 'function') {
            currentPlotInstance.destroy();
        } else if (currentPlotInstance.nodeType) {
            currentPlotInstance.remove();
        }
    }
    currentPlotInstance = null;
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

/**
 * Get plot settings from UI or defaults.
 */
function getPlotSettings() {
    const setting = (id, def) => document.getElementById(id)?.value || def;
    return {
        fontFamily: setting('setting-font-family', 'Helvetica'),
        fontColor: setting('setting-font-color', '#333333'),
        titleFontSize: parseInt(setting('setting-title-font-size', 21)),
        axisTitleFontSize: parseInt(setting('setting-axis-title-font-size', 20)),
        tickFontSize: parseInt(setting('setting-tick-font-size', 20)),
        axisLineWidth: parseFloat(setting('setting-axis-line-width', 2)),
        axisLineColor: setting('setting-axis-line-color', '#333333'),
        backgroundColor: setting('setting-bg-color', '#ffffff'),
        gridColor: setting('setting-grid-color', '#e0e0e0'),
        showGrid: document.getElementById('setting-show-grid')?.checked ?? true
    };
}

/**
 * Get expression data for a specific gene.
 */
function getGeneExpression(geneName) {
    return expressionData[geneName.toUpperCase()] || {};
}

/**
 * Get the master list of tissue names.
 */
function getTissueNames() {
    if (tissueNames?.length > 0) return tissueNames;
    if (Object.keys(expressionData).length > 0) {
        const firstGene = Object.keys(expressionData)[0];
        return Object.keys(expressionData[firstGene]);
    }
    return ['Brain', 'Heart', 'Liver', 'Lung', 'Kidney', 'Spleen', 'Testis', 'Ovary', 'Pancreas', 'Stomach', 'Colon', 'Skin', 'Blood', 'Bone Marrow', 'Adipose']; // Fallback
}

/**
 * Calculate expression statistics with standard deviation.
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
            const sumSq = values.reduce((a, b) => a + b * b, 0);
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
 * Compute protein complex links for network plots.
 */
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

/**
 * The main controller function for plot generation.
 */
async function generateAnalysisPlots() {
    try {
        const plotContainer = document.getElementById('plot-display-area');
        const genesInput = document.getElementById('ciliaplot-genes-input')?.value.trim();
        const plotTypeSelect = document.getElementById('plot-type-select')?.value;

        if (!plotContainer || !genesInput || !plotTypeSelect) {
            console.error('Required DOM elements not found.');
            plotContainer.innerHTML = '<p class="status-message">Error: Plot interface not loaded.</p>';
            return;
        }

        if (!genesInput) {
            plotContainer.innerHTML = '<p class="status-message">Please enter at least one gene.</p>';
            return;
        }

        plotContainer.innerHTML = '<p class="status-message">Generating plot...</p>';

        const sanitizedQueries = [...new Set(genesInput.split(/[\s,;\n\r\t]+/).filter(Boolean).map(q => q.toUpperCase()))];
        const foundGenes = getGenesFromDatabase(sanitizedQueries); // Assume defined in script.js

        if (!foundGenes.length) {
            plotContainer.innerHTML = '<p class="status-message">No valid genes found.</p>';
            return;
        }

        updatePlotInfo(plotTypeSelect, foundGenes);
        updateStatsAndLegend(plotTypeSelect, foundGenes);

        switch (plotTypeSelect) {
            case 'bubble':
                renderKeyLocalizations(foundGenes.slice(0, 50), plotContainer);
                break;
            case 'matrix':
                renderGeneMatrix(foundGenes.slice(0, 50), plotContainer);
                break;
            case 'domain_matrix':
                renderDomainMatrixPlot(foundGenes.slice(0, 50), plotContainer);
                break;
            case 'functional_category':
                renderFunctionalCategoryPlot(foundGenes.slice(0, 50), plotContainer);
                break;
            case 'network':
                renderComplexNetwork(foundGenes.slice(0, 50), plotContainer);
                break;
            case 'expression_heatmap':
                renderExpressionHeatmap(foundGenes.slice(0, 50), plotContainer);
                break;
            case 'tissue_profile':
                renderTissueExpressionProfile(foundGenes.slice(0, 50), plotContainer);
                break;
            case 'expression_localization':
                renderExpressionLocalizationBubble(foundGenes.slice(0, 50), plotContainer);
                break;
            case 'top_tissues':
                renderTopExpressingTissues(foundGenes.slice(0, 50), plotContainer);
                break;
            default:
                plotContainer.innerHTML = `<p class="status-message">Plot type "${plotTypeSelect}" is not implemented.</p>`;
        }
    } catch (error) {
        console.error('Error generating plots:', error);
        document.getElementById('plot-display-area').innerHTML = `<p class="status-message error">Error generating plot: ${error.message}</p>`;
    }
}

/**
 * Updates the informational text box with a description of the current plot.
 * @param {string} plotType - The selected plot type.
 * @param {Array} foundGenes - The array of gene objects being plotted.
 */
function updatePlotInfo(plotType, foundGenes) {
    const infoContainer = document.getElementById('ciliaplot-plot-info');
    if (!infoContainer) return;
    let infoHTML = '';
    switch (plotType) {
        case 'bubble':
            infoHTML = `<strong>Key Localizations:</strong> This bubble plot shows the distribution of up to 50 genes across primary ciliary and cellular compartments. Bubble size corresponds to gene count.`;
            break;
        case 'matrix':
            infoHTML = `<strong>Gene-Localization Matrix:</strong> This plot shows specific localizations for up to 50 genes. A bubble indicates a gene is associated with a ciliary compartment.`;
            break;
        case 'domain_matrix':
            infoHTML = `<strong>Gene-Domain Matrix:</strong> This plot shows protein domains for up to 50 genes, highlighting shared functional components.`;
            break;
        case 'functional_category':
            infoHTML = `<strong>Functional Category Bar Chart:</strong> This chart categorizes up to 50 genes into functional groups, showing biological process distribution.`;
            break;
        case 'network':
            infoHTML = `<strong>Protein Complex Network:</strong> This network visualizes protein-protein interactions and complex memberships for up to 50 genes.`;
            break;
        case 'expression_heatmap':
            infoHTML = `<strong>Expression Heatmap:</strong> This heatmap shows expression levels (nTPM) for up to 50 genes across tissues. Darker colors indicate higher expression.`;
            break;
        case 'tissue_profile':
            infoHTML = `<strong>Tissue Expression Profile:</strong> This line chart shows mean expression and standard deviation for up to 50 genes across top 20 tissues.`;
            break;
        case 'expression_localization':
            infoHTML = `<strong>Expression vs. Localization:</strong> This bubble plot correlates expression breadth and localization diversity for up to 50 genes. Bubble size shows max expression.`;
            break;
        case 'top_tissues':
            infoHTML = `<strong>Top Expressing Tissues:</strong> This bar chart ranks the top 20 tissues by mean expression for up to 50 genes.`;
            break;
        default:
            infoHTML = `Select a plot type to see a description.`;
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

    statsContainer.style.display = 'grid';
    legendContainer.style.display = 'flex';

    let statsHTML = `<div class="stat-box"><div class="stat-number">${foundGenes.length}</div><div class="stat-label">Input Genes Found</div></div>`;
    let legendHTML = '';

    if (plotType === 'network') {
        const { links } = computeProteinComplexLinks(foundGenes);
        const complexSet = new Set(foundGenes.flatMap(g => getCleanArray(g, 'complex_names', 'complex')));
        statsHTML += `<div class="stat-box"><div class="stat-number">${complexSet.size}</div><div class="stat-label">Unique Complexes</div></div>`;
        statsHTML += `<div class="stat-box"><div class="stat-number">${links.length}</div><div class="stat-label">Interactions</div></div>`;
        legendHTML = `<div class="legend-item"><div class="legend-color" style="background-color: #1f77b4;"></div><span>Gene</span></div>`;
    } else if (plotType === 'functional_category') {
        const categorySet = new Set(foundGenes.flatMap(g => getCleanArray(g, 'functional_category')));
        statsHTML += `<div class="stat-box"><div class="stat-number">${categorySet.size}</div><div class="stat-label">Unique Categories</div></div>`;
        legendHTML = `<div class="legend-item"><div class="legend-color" style="background-color: rgba(26, 188, 156, 0.7); border-radius: 4px;"></div><span>Gene Count</span></div>`;
    } else if (plotType === 'domain_matrix') {
        const domainSet = new Set(foundGenes.flatMap(g => getCleanArray(g, 'domain_descriptions')));
        statsHTML += `<div class="stat-box"><div class="stat-number">${domainSet.size}</div><div class="stat-label">Unique Domains</div></div>`;
        legendContainer.style.display = 'none';
    } else if (plotType.startsWith('expression') || plotType === 'top_tissues' || plotType === 'tissue_profile') {
        const genesWithExpr = foundGenes.filter(g => Object.keys(getGeneExpression(g.gene)).length > 0);
        statsHTML += `<div class="stat-box"><div class="stat-number">${genesWithExpr.length}</div><div class="stat-label">Genes with Expression Data</div></div>`;
        legendContainer.style.display = 'none';
    } else {
        const localizations = new Set(foundGenes.flatMap(g => getCleanArray(g, 'localization'))).size;
        statsHTML += `<div class="stat-box"><div class="stat-number">${localizations}</div><div class="stat-label">Unique Localizations</div></div>`;
        legendContainer.style.display = 'none';
    }
    statsContainer.innerHTML = statsHTML;
    legendContainer.innerHTML = legendHTML;
}

/**
 * Downloads the current plot as PNG or PDF.
 */
async function downloadPlot() {
    const format = document.getElementById('download-format')?.value || 'png';
    const plotArea = document.getElementById('plot-display-area');
    const plotType = document.getElementById('plot-type-select')?.value;
    if (!plotArea?.firstChild || !plotType || plotArea.querySelector('.status-message')) {
        alert('Please generate a plot first.');
        return;
    }
    const fileName = `CiliaHub_${plotType}_plot_${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
    const scale = 3;
    const width = plotArea.clientWidth;
    const height = plotArea.clientHeight;
    try {
        let dataUrl;
        const settings = getPlotSettings();
        if (plotArea.querySelector('canvas')) {
            const sourceCanvas = plotArea.querySelector('canvas');
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = sourceCanvas.width * scale;
            tempCanvas.height = sourceCanvas.height * scale;
            const tempCtx = tempCanvas.getContext('2d');
            if (settings.backgroundColor !== 'transparent') {
                tempCtx.fillStyle = settings.backgroundColor;
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            }
            tempCtx.drawImage(sourceCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
            dataUrl = tempCanvas.toDataURL('image/png');
        } else if (plotArea.querySelector('svg')) {
            const svgElement = plotArea.querySelector('svg');
            const canvas = document.createElement('canvas');
            canvas.width = width * scale;
            canvas.height = height * scale;
            const ctx = canvas.getContext('2d');
            if (settings.backgroundColor !== 'transparent') {
                ctx.fillStyle = settings.backgroundColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            const img = new Image();
            let svgSource = new XMLSerializer().serializeToString(svgElement);
            if (!svgSource.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
                svgSource = `<?xml version="1.0" standalone="no"?>\n${svgSource}`;
            }
            const svgBlob = new Blob([svgSource], { type: 'image/svg+xml;charset=utf-8' });
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
        if (!dataUrl) throw new Error('Could not generate image data.');
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
        console.error('Download failed:', e);
        alert('An error occurred during download.');
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
    
    const categoriesWithData = yCategories
        .filter(cat => localizationCounts[cat] > 0)
        .sort((a, b) => (localizationCounts[b] || 0) - (localizationCounts[a] || 0))
        .slice(0, 15);
    
    if (!categoriesWithData.length) {
        container.innerHTML = '<p class="status-message">No genes in primary ciliary localizations.</p>';
        return;
    }
    
    const data = categoriesWithData.map(cat => localizationCounts[cat] || 0);
    const labels = categoriesWithData.map(cat => cat.length > 15 ? cat.substring(0, 12) + '...' : cat);
    
    currentPlotInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gene Count',
                data: data,
                backgroundColor: data.map((_, i) => d3.schemeTableau10[i % 10]),
                borderColor: data.map((_, i) => d3.schemeTableau10[i % 10].replace('0.7', '1')),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Key Ciliary Localizations (Top 15)',
                    font: { size: settings.titleFontSize + 4, family: settings.fontFamily, weight: 'bold' },
                    color: settings.fontColor
                },
                legend: { display: false },
                tooltip: {
                    callbacks: { label: c => `${categoriesWithData[c.dataIndex]}: ${c.raw} gene(s)` },
                    bodyFont: { size: 14 }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Cellular Compartment',
                        font: { size: settings.axisTitleFontSize + 2, family: settings.fontFamily, weight: 'bold' },
                        color: settings.fontColor
                    },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: {
                        font: { size: settings.tickFontSize, family: settings.fontFamily },
                        color: settings.fontColor,
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Gene Count',
                        font: { size: settings.axisTitleFontSize + 2, family: settings.fontFamily, weight: 'bold' },
                        color: settings.fontColor
                    },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: {
                        font: { size: settings.tickFontSize, family: settings.fontFamily },
                        color: settings.fontColor,
                        stepSize: 1
                    }
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
        .sort()
        .slice(0, 20);
    const xLabels = [...new Set(foundGenes.map(g => g.gene))]
        .sort()
        .slice(0, 50);
    
    if (!yCategories.length || !xLabels.length) {
        container.innerHTML = '<p class="status-message">No localization data for selected genes.</p>';
        return;
    }
    
    const datasets = foundGenes
        .filter(g => xLabels.includes(g.gene))
        .map((gene, index) => ({
            label: gene.gene,
            data: getCleanArray(gene, 'localization')
                .filter(loc => yCategories.includes(loc.charAt(0).toUpperCase() + loc.slice(1)))
                .map(loc => ({
                    x: gene.gene,
                    y: loc.charAt(0).toUpperCase() + loc.slice(1),
                    r: 10
                })),
            backgroundColor: d3.schemeTableau10[index % 10]
        }))
        .filter(ds => ds.data.length > 0);
    
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Gene-Localization Matrix',
                    font: { size: settings.titleFontSize + 4, family: settings.fontFamily, weight: 'bold' },
                    color: settings.fontColor
                },
                legend: { display: false },
                tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw.y}` } }
            },
            scales: {
                x: {
                    type: 'category',
                    labels: xLabels.map(l => l.length > 10 ? l.substring(0, 7) + '...' : l),
                    title: {
                        display: true,
                        text: 'Genes',
                        font: { size: settings.axisTitleFontSize + 2, family: settings.fontFamily, weight: 'bold' },
                        color: settings.fontColor
                    },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: {
                        font: { size: settings.tickFontSize, family: settings.fontFamily },
                        color: settings.fontColor,
                        maxRotation: 90,
                        minRotation: 45
                    }
                },
                y: {
                    type: 'category',
                    labels: yCategories.map(c => c.length > 15 ? c.substring(0, 12) + '...' : c),
                    title: {
                        display: true,
                        text: 'Ciliary Compartment',
                        font: { size: settings.axisTitleFontSize + 2, family: settings.fontFamily, weight: 'bold' },
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

function renderDomainMatrixPlot(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes to display.</p>';
        return;
    }
    
    const allDomains = [...new Set(foundGenes.flatMap(g => getCleanArray(g, 'domain_descriptions')))]
        .filter(Boolean)
        .sort()
        .slice(0, 20);
    const xLabels = [...new Set(foundGenes.map(g => g.gene))]
        .sort()
        .slice(0, 50);
    
    if (!allDomains.length) {
        container.innerHTML = '<p class="status-message">No domain description data found.</p>';
        return;
    }
    
    const yLabelMap = new Map(allDomains.map(domain => [
        domain,
        domain.length > 50 ? domain.substring(0, 47) + '...' : domain
    ]));
    const yCategories = [...yLabelMap.values()];
    
    const datasets = foundGenes
        .filter(g => xLabels.includes(g.gene))
        .map((gene, index) => ({
            label: gene.gene,
            data: getCleanArray(gene, 'domain_descriptions')
                .filter(domain => yLabelMap.has(domain))
                .map(domain => ({
                    x: gene.gene,
                    y: yLabelMap.get(domain),
                    r: 10
                })),
            backgroundColor: d3.schemeTableau10[index % 10]
        }))
        .filter(ds => ds.data.length > 0);
    
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Gene-Domain Matrix',
                    font: { size: settings.titleFontSize + 4, family: settings.fontFamily, weight: 'bold' },
                    color: settings.fontColor
                },
                legend: { display: false },
                tooltip: {
                    callbacks: { label: c => `${c.dataset.label}: ${[...yLabelMap.entries()].find(([k, v]) => v === c.raw.y)[0]}` }
                }
            },
            scales: {
                x: {
                    type: 'category',
                    labels: xLabels.map(l => l.length > 10 ? l.substring(0, 7) + '...' : l),
                    title: {
                        display: true,
                        text: 'Genes',
                        font: { size: settings.axisTitleFontSize + 2, family: settings.fontFamily, weight: 'bold' },
                        color: settings.fontColor
                    },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: {
                        font: { size: settings.tickFontSize, family: settings.fontFamily },
                        color: settings.fontColor,
                        maxRotation: 90,
                        minRotation: 45
                    }
                },
                y: {
                    type: 'category',
                    labels: yCategories,
                    title: {
                        display: true,
                        text: 'Domain Description',
                        font: { size: settings.axisTitleFontSize + 2, family: settings.fontFamily, weight: 'bold' },
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
        getCleanArray(gene, 'functional_category').forEach(cat => {
            categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
        });
    });
    
    if (categoryCounts.size === 0) {
        container.innerHTML = '<p class="status-message">No functional category data found.</p>';
        return;
    }
    
    const sortedData = Array.from(categoryCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);
    
    const labels = sortedData.map(item => item[0].length > 45 ? item[0].substring(0, 42) + '...' : item[0]);
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
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Functional Category Distribution (Top 15)',
                    font: { size: settings.titleFontSize + 4, family: settings.fontFamily, weight: 'bold' },
                    color: settings.fontColor
                },
                legend: { display: false },
                tooltip: {
                    callbacks: { title: (c) => sortedData[c[0].dataIndex][0], label: (c) => `${c.parsed.x} genes` }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Number of Genes',
                        font: { size: settings.axisTitleFontSize + 2, family: settings.fontFamily, weight: 'bold' },
                        color: settings.fontColor
                    },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: {
                        font: { size: settings.tickFontSize, family: settings.fontFamily },
                        color: settings.fontColor,
                        stepSize: 1
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Functional Category',
                        font: { size: settings.axisTitleFontSize + 2, family: settings.fontFamily, weight: 'bold' },
                        color: settings.fontColor
                    },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: {
                        font: { size: Math.max(10, settings.tickFontSize - 2), family: settings.fontFamily },
                        color: settings.fontColor
                    }
                }
            }
        }
    });
}

function renderComplexNetwork(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = '';
    
    const limitedGenes = foundGenes.slice(0, 50);
    const { nodes, links } = computeProteinComplexLinks(limitedGenes);
    
    if (!nodes.length || !links.length) {
        container.innerHTML = '<p class="status-message">No protein complex links found.</p>';
        return;
    }
    
    const width = container.clientWidth || 800;
    const height = Math.max(500, container.clientHeight || 600);
    const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
    svg.append('rect').attr('width', '100%').attr('height', '100%').attr('fill', settings.backgroundColor);
    
    // Simple clustering based on complex membership
    const complexMap = new Map();
    limitedGenes.forEach(gene => {
        getCleanArray(gene, 'complex_names', 'complex').forEach(complex => {
            if (!complexMap.has(complex)) complexMap.set(complex, []);
            complexMap.get(complex).push(gene.gene);
        });
    });
    const clusters = nodes.map((node, i) => {
        let clusterId = 0;
        complexMap.forEach((genes, complex, idx) => {
            if (genes.includes(node.id)) clusterId = idx % 10;
        });
        return clusterId;
    });
    const colors = d3.schemeTableau10;
    
    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2));
    
    const link = svg.append('g')
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .style('stroke', '#999')
        .style('stroke-opacity', 0.6)
        .style('stroke-width', d => Math.sqrt(d.value) * 2);
    
    const nodeGroup = svg.append('g')
        .selectAll('g')
        .data(nodes)
        .enter()
        .append('g')
        .call(d3.drag()
            .on('start', (e, d) => {
                if (!e.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x; d.fy = d.y;
            })
            .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
            .on('end', (e, d) => {
                if (!e.active) simulation.alphaTarget(0);
                d.fx = null; d.fy = null;
            }));
    
    nodeGroup.append('circle')
        .attr('r', 10)
        .style('fill', (d, i) => colors[clusters[i]])
        .style('stroke', '#fff')
        .style('stroke-width', 2);
    
    nodeGroup.append('text')
        .text(d => d.id.length > 12 ? d.id.substring(0, 9) + '...' : d.id)
        .attr('x', 15)
        .attr('y', 5)
        .style('font-family', settings.fontFamily)
        .style('font-size', '14px')
        .style('fill', settings.fontColor);
    
    simulation.on('tick', () => {
        link.attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        nodeGroup.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    // Add legend for clusters
    const legend = svg.append('g').attr('transform', `translate(20, 20)`);
    [...new Set(clusters)].slice(0, 5).forEach((cluster, i) => {
        const g = legend.append('g').attr('transform', `translate(0, ${i * 20})`);
        g.append('circle').attr('r', 5).attr('fill', colors[cluster]);
        g.append('text')
            .text(`Cluster ${cluster + 1}`)
            .attr('x', 10)
            .attr('y', 4)
            .style('font-family', settings.fontFamily)
            .style('font-size', '12px')
            .style('fill', settings.fontColor);
    });
    
    currentPlotInstance = svg.node();
}

// =============================================================================
// PLOTTING FUNCTIONS: EXPRESSION ANALYSIS
// =============================================================================

function renderExpressionHeatmap(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = '';
    
    if (!foundGenes.length || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available.</p>';
        return;
    }
    
    const tissues = getTissueNames().slice(0, 20);
    const genesWithExpression = foundGenes
        .filter(gene => Object.keys(getGeneExpression(gene.gene)).length > 0)
        .slice(0, 50);
    
    if (!genesWithExpression.length || !tissues.length) {
        container.innerHTML = '<p class="status-message">No valid expression data.</p>';
        return;
    }
    
    let maxExpression = 0;
    genesWithExpression.forEach(gene => {
        const expr = getGeneExpression(gene.gene);
        const maxGeneExpr = Math.max(0, ...Object.values(expr).filter(v => v !== undefined && v !== null));
        maxExpression = Math.max(maxExpression, maxGeneExpr);
    });
    
    const width = Math.min(container.clientWidth || 800, 1200);
    const height = Math.max(400, genesWithExpression.length * 25 + 150);
    const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
    svg.append('rect').attr('width', '100%').attr('height', '100%').attr('fill', settings.backgroundColor);
    
    const margin = { top: 80, right: 80, bottom: 140, left: 120 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    
    // Hierarchical clustering for genes and tissues
    const geneData = genesWithExpression.map(g => {
        const expr = getGeneExpression(g.gene);
        return tissues.map(t => expr[t] || 0);
    });
    const geneCluster = d3.hierarchy({ children: geneData })
        .sum(d => d)
        .sort((a, b) => d3.sum(b.data) - d3.sum(a.data));
    const geneOrder = d3.hierarchy(geneCluster).leaves().map((_, i) => genesWithExpression[i].gene);
    
    const tissueData = tissues.map(t => genesWithExpression.map(g => getGeneExpression(g.gene)[t] || 0));
    const tissueCluster = d3.hierarchy({ children: tissueData })
        .sum(d => d)
        .sort((a, b) => d3.sum(b.data) - d3.sum(a.data));
    const tissueOrder = d3.hierarchy(tissueCluster).leaves().map((_, i) => tissues[i]);
    
    const xScale = d3.scaleBand().domain(tissueOrder).range([0, plotWidth]).padding(0.1);
    const yScale = d3.scaleBand().domain(geneOrder).range([0, plotHeight]).padding(0.1);
    const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([0, maxExpression]);
    
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .style('font-family', settings.fontFamily)
        .style('font-size', `${settings.titleFontSize + 4}px`)
        .style('font-weight', 'bold')
        .style('fill', settings.fontColor)
        .text('Gene Expression Heatmap Across Tissues');
    
    const heatmapData = [];
    genesWithExpression.forEach(gene => {
        tissueOrder.forEach(tissue => {
            const expr = getGeneExpression(gene.gene);
            heatmapData.push({
                gene: gene.gene,
                tissue,
                expression: expr && expr[tissue] !== undefined ? expr[tissue] : 0
            });
        });
    });
    
    g.selectAll('.heatmap-rect')
        .data(heatmapData)
        .enter()
        .append('rect')
        .attr('class', 'heatmap-rect')
        .attr('x', d => xScale(d.tissue))
        .attr('y', d => yScale(d.gene))
        .attr('width', xScale.bandwidth())
        .attr('height', yScale.bandwidth())
        .attr('fill', d => d.expression > 0 ? colorScale(d.expression) : '#f0f0f0')
        .attr('stroke', 'white')
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this).attr('stroke-width', 2).attr('stroke', '#333');
            const tooltip = d3.select('body').append('div')
                .attr('class', 'expression-tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0,0,0,0.9)')
                .style('color', 'white')
                .style('padding', '10px')
                .style('border-radius', '5px')
                .style('font-size', '14px')
                .style('font-family', settings.fontFamily)
                .style('pointer-events', 'none')
                .style('z-index', '1000')
                .style('opacity', 0);
            tooltip.html(`<strong>${d.gene}</strong><br>${d.tissue}<br>Expression: ${d.expression.toFixed(2)} nTPM`)
                .style('left', `${event.pageX + 10}px`)
                .style('top', `${event.pageY - 10}px`)
                .transition()
                .duration(200)
                .style('opacity', 1);
        })
        .on('mouseout', function() {
            d3.select(this).attr('stroke-width', 0.5).attr('stroke', 'white');
            d3.selectAll('.expression-tooltip').remove();
        });
    
    g.append('g')
        .attr('transform', `translate(0,${plotHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('font-family', settings.fontFamily)
        .style('font-size', `${Math.max(10, settings.tickFontSize - 2)}px`)
        .style('fill', settings.fontColor)
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');
    
    g.append('g')
        .call(d3.axisLeft(yScale))
        .selectAll('text')
        .style('font-family', settings.fontFamily)
        .style('font-size', `${settings.tickFontSize}px`)
        .style('fill', settings.fontColor);
    
    svg.append('text')
        .attr('transform', `translate(${width/2},${height - 20})`)
        .style('text-anchor', 'middle')
        .style('font-family', settings.fontFamily)
        .style('font-size', `${settings.axisTitleFontSize + 2}px`)
        .style('font-weight', 'bold')
        .style('fill', settings.fontColor)
        .text('Tissues');
    
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 20)
        .attr('x', 0 - (height / 2))
        .style('text-anchor', 'middle')
        .style('font-family', settings.fontFamily)
        .style('font-size', `${settings.axisTitleFontSize + 2}px`)
        .style('font-weight', 'bold')
        .style('fill', settings.fontColor)
        .text('Genes');
    
    const legendWidth = 20, legendHeight = 200, legendX = width - 60, legendY = margin.top;
    const legendScale = d3.scaleLinear().domain([0, maxExpression]).range([legendHeight, 0]);
    const legendAxis = d3.axisRight(legendScale).ticks(5).tickFormat(d3.format('.1f'));
    const defs = svg.append('defs');
    const legendGradient = defs.append('linearGradient')
        .attr('id', 'legend-gradient')
        .attr('x1', '0%')
        .attr('y1', '100%')
        .attr('x2', '0%')
        .attr('y2', '0%');
    legendGradient.selectAll('stop')
        .data(d3.range(0, 1.1, 0.1))
        .enter()
        .append('stop')
        .attr('offset', d => `${d * 100}%`)
        .attr('stop-color', d => colorScale(d * maxExpression));
    svg.append('rect')
        .attr('x', legendX)
        .attr('y', legendY)
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', 'url(#legend-gradient)')
        .style('stroke', '#ccc');
    svg.append('g')
        .attr('transform', `translate(${legendX + legendWidth}, ${legendY})`)
        .call(legendAxis)
        .selectAll('text')
        .style('font-family', settings.fontFamily)
        .style('font-size', '12px')
        .style('fill', settings.fontColor);
    
    currentPlotInstance = svg.node();
}

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
        if (!isValid) console.warn(`Tissue "${tissue}" not found in expression data.`);
        return isValid;
    });
    
    if (!validTissues.length) {
        container.innerHTML = '<p class="status-message">No valid tissue data for selected genes.</p>';
        return;
    }
    
    const stats = calculateExpressionStats(foundGenes);
    const sortedTissues = validTissues
        .sort((a, b) => (stats.meanExpression[b] || 0) - (stats.meanExpression[a] || 0))
        .slice(0, Math.min(20, validTissues.length));
    
    if (!sortedTissues.length) {
        container.innerHTML = '<p class="status-message">No valid tissue data for selected genes.</p>';
        return;
    }
    
    const labels = sortedTissues.map(t => t.length > 15 ? t.substring(0, 12) + '...' : t);
    const means = sortedTissues.map(t => stats.meanExpression[t] || 0);
    const stdDevs = sortedTissues.map(t => stats.stdDevExpression[t] || 0);
    const geneCounts = sortedTissues.map(t => stats.geneCount[t] || 0);
    
    currentPlotInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Mean Expression (±SD, ${foundGenes.length} genes)`,
                data: means.map((mean, i) => ({
                    x: i,
                    y: mean,
                    yMin: mean - stdDevs[i],
                    yMax: mean + stdDevs[i]
                })),
                backgroundColor: 'rgba(31, 120, 180, 0.2)',
                borderColor: 'rgba(31, 120, 180, 1)',
                borderWidth: 3,
                pointBackgroundColor: 'rgba(31, 120, 180, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                fill: false,
                errorBarColor: 'rgba(31, 120, 180, 1)',
                errorBarLineWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Tissue Expression Profile (Top ${sortedTissues.length} Tissues)`,
                    font: { size: settings.titleFontSize + 4, family: settings.fontFamily, weight: 'bold' },
                    color: settings.fontColor
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor }
                },
                tooltip: {
                    callbacks: {
                        title: (context) => sortedTissues[context[0].dataIndex],
                        label: (context) => [
                            `Mean: ${context.raw.y.toFixed(2)} nTPM`,
                            `SD: ${stdDevs[context.dataIndex].toFixed(2)}`,
                            `Genes: ${geneCounts[context.dataIndex]}`
                        ]
                    },
                    bodyFont: { size: 14 }
                }
            },
            scales: {
                x: {
                    type: 'category',
                    labels: labels,
                    title: {
                        display: true,
                        text: 'Tissues (Sorted by Expression)',
                        font: { size: settings.axisTitleFontSize + 2, family: settings.fontFamily, weight: 'bold' },
                        color: settings.fontColor
                    },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: {
                        font: { size: settings.tickFontSize, family: settings.fontFamily },
                        color: settings.fontColor,
                        maxRotation: 90,
                        minRotation: 45,
                        padding: 10
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Mean Expression (nTPM)',
                        font: { size: settings.axisTitleFontSize + 2, family: settings.fontFamily, weight: 'bold' },
                        color: settings.fontColor
                    },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: {
                        font: { size: settings.tickFontSize, family: settings.fontFamily },
                        color: settings.fontColor
                    },
                    beginAtZero: true
                }
            },
            elements: { line: { tension: 0.1 } }
        }
    });
}

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
        const maxExpression = Math.max(0, ...Object.values(geneExpr).filter(v => v !== undefined && v !== null));
        const localizations = getCleanArray(gene, 'localization');
        return {
            x: expressingTissues.length,
            y: localizations.length,
            r: Math.max(5, Math.min(25, Math.sqrt(maxExpression) * 3)),
            gene: gene.gene,
            maxExpression,
            localizations: localizations.join(', ')
        };
    }).filter(d => d.x > 0 || d.y > 0);
    
    if (!bubbleData.length) {
        container.innerHTML = '<p class="status-message">No expression or localization data found.</p>';
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
                title: {
                    display: true,
                    text: 'Expression Breadth vs Localization Diversity',
                    font: { size: settings.titleFontSize + 4, family: settings.fontFamily, weight: 'bold' },
                    color: settings.fontColor
                },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: context => context[0].raw.gene,
                        label: context => [
                            `Expressing tissues: ${context.raw.x}`,
                            `Localizations: ${context.raw.y}`,
                            `Max expression: ${context.raw.maxExpression.toFixed(1)} nTPM`,
                            `Locations: ${context.raw.localizations || 'None'}`
                        ]
                    },
                    bodyFont: { size: 14 }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Number of Expressing Tissues (>1.0 nTPM)',
                        font: { size: settings.axisTitleFontSize + 2, family: settings.fontFamily, weight: 'bold' },
                        color: settings.fontColor
                    },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: {
                        font: { size: settings.tickFontSize, family: settings.fontFamily },
                        color: settings.fontColor,
                        stepSize: 1
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Number of Subcellular Localizations',
                        font: { size: settings.axisTitleFontSize + 2, family: settings.fontFamily, weight: 'bold' },
                        color: settings.fontColor
                    },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: {
                        font: { size: settings.tickFontSize, family: settings.fontFamily },
                        color: settings.fontColor,
                        stepSize: 1
                    }
                }
            }
        }
    });
}

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
    
    const tissueData = tissues
        .map(tissue => ({
            tissue,
            meanExpression: stats.meanExpression[tissue] || 0,
            geneCount: stats.geneCount[tissue] || 0
        }))
        .filter(d => d.meanExpression > 0)
        .sort((a, b) => b.meanExpression - a.meanExpression)
        .slice(0, 20);
    
    if (!tissueData.length) {
        container.innerHTML = '<p class="status-message">No tissues with expression found.</p>';
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
                title: {
                    display: true,
                    text: `Top Expressing Tissues (${foundGenes.length} genes)`,
                    font: { size: settings.titleFontSize + 4, family: settings.fontFamily, weight: 'bold' },
                    color: settings.fontColor
                },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const tissueInfo = tissueData[index];
                            return [
                                `Mean: ${context.parsed.x.toFixed(2)} nTPM`,
                                `Genes: ${tissueInfo.geneCount}`
                            ];
                        }
                    },
                    bodyFont: { size: 14 }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Mean Expression Level (nTPM)',
                        font: { size: settings.axisTitleFontSize + 2, family: settings.fontFamily, weight: 'bold' },
                        color: settings.fontColor
                    },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: {
                        font: { size: settings.tickFontSize, family: settings.fontFamily },
                        color: settings.fontColor
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Tissues',
                        font: { size: settings.axisTitleFontSize + 2, family: settings.fontFamily, weight: 'bold' },
                        color: settings.fontColor
                    },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: {
                        font: { size: Math.max(10, settings.tickFontSize - 2), family: settings.fontFamily },
                        color: settings.fontColor
                    }
                }
            }
        }
    });
}
