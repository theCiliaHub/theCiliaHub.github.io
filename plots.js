// =============================================================================
// CiliaHub Plotting Engine (plots.js) - FINAL VERSION
// =============================================================================
// This file contains all logic for the CiliaPlot interactive dashboard,
// including the main controller, annotation panel, and all plot rendering.
// =============================================================================

let currentPlotInstance = null; // Holds the active Chart.js, D3, etc. instance

// =============================================================================
// SECTION 1: SIMULATED DATA FOR ADVANCED PLOTS
// =============================================================================

const organelleMarkerProfiles = {
    "Cilia": [0.1, 0.1, 0.2, 0.8, 0.9, 0.6, 0.2, 0.1],
    "Basal Body": [0.1, 0.2, 0.7, 0.9, 0.8, 0.3, 0.1, 0.1],
    "Mitochondrion": [0.8, 0.9, 0.7, 0.2, 0.1, 0.1, 0.2, 0.3],
    "Nucleus": [0.9, 0.8, 0.3, 0.1, 0.1, 0.1, 0.1, 0.1],
    "ER": [0.2, 0.4, 0.8, 0.3, 0.2, 0.1, 0.5, 0.7],
    "Golgi": [0.1, 0.2, 0.5, 0.2, 0.2, 0.2, 0.8, 0.9],
    "Cytosol": [0.4, 0.5, 0.3, 0.3, 0.3, 0.4, 0.4, 0.3]
};
const fractionLabels = ['Fr 1', 'Fr 2', 'Fr 3', 'Fr 4', 'Fr 5', 'Fr 6', 'Fr 7', 'Fr 8'];

const precomputedUMAP = {
    "Cilia": Array.from({ length: 50 }, (_, i) => ({ gene: `CILGEN${i}`, x: 8 + Math.random() * 2, y: 8 + Math.random() * 2 })),
    "Basal Body": Array.from({ length: 40 }, (_, i) => ({ gene: `BBGEN${i}`, x: 6 + Math.random() * 2, y: 7 + Math.random() * 2 })),
    "Mitochondrion": Array.from({ length: 60 }, (_, i) => ({ gene: `MTGEN${i}`, x: 1 + Math.random() * 2, y: 2 + Math.random() * 2 })),
    "Nucleus": Array.from({ length: 70 }, (_, i) => ({ gene: `NUCGEN${i}`, x: 9 + Math.random() * 1.5, y: 1 + Math.random() * 2 })),
    "ER": Array.from({ length: 50 }, (_, i) => ({ gene: `ERGEN${i}`, x: 2 + Math.random() * 2, y: 8 + Math.random() * 2 })),
    "Golgi": Array.from({ length: 40 }, (_, i) => ({ gene: `GOLGEN${i}`, x: 1 + Math.random() * 2, y: 6 + Math.random() * 2 })),
    "Cytosol": Array.from({ length: 80 }, (_, i) => ({ gene: `CYTGEN${i}`, x: 5 + Math.random() * 3, y: 4 + Math.random() * 3 })),
};

const simulatedAnnotationData = {
    "DEFAULT": {
        graph_based_annotation: "Unknown", interfacial: "N/A", interface_with: "N/A", classifier_annotation: "Unknown", copies_per_cell: "N/A", concentration_nM: "N/A",
    },
    "IFT88": {
        graph_based_annotation: "Cilia", interfacial: "False", interface_with: "nan", classifier_annotation: "Cilia/Centrosome", copies_per_cell: 15025.1, concentration_nM: 25.0,
    },
    "CEP290": {
        graph_based_annotation: "Centrosome", interfacial: "True", interface_with: "Cilia, Cytosol", classifier_annotation: "Centrosome", copies_per_cell: 850.5, concentration_nM: 1.4,
    },
    "BBS1": {
        graph_based_annotation: "Cytosol", interfacial: "True", interface_with: "Cilia", classifier_annotation: "Cytosol", copies_per_cell: 17759.66, concentration_nM: 29.5,
    }
};

// =============================================================================
// SECTION 2: MAIN CONTROLLER & ANNOTATION FUNCTIONS
// =============================================================================

/**
 * Main orchestrator for the dashboard. This is called when the user clicks the "Generate Plot" button.
 */
async function runFullAnalysis() {
    try {
        await loadAndPrepareDatabase();
        const plotType = document.getElementById('plot-type-select').value;
        const genesInput = document.getElementById('ciliaplot-genes-input').value.trim();

        if (!genesInput) {
            alert('Please enter a gene list.');
            return;
        }

        const plotContainer = document.getElementById('ciliaplot-visualization-container');
        const annotationPanel = document.getElementById('ciliaplot-annotation-panel');
        const tableContainer = document.getElementById('ciliaplot-search-results-container');

        // Reset the UI elements
        plotContainer.innerHTML = '<p class="status-message">Generating...</p>';
        annotationPanel.innerHTML = `
            <h4 class="annotation-title">Gene Annotation</h4>
            <div class="annotation-content"><p class="status-message">Click on a gene in the plot to see details.</p></div>`;
        tableContainer.innerHTML = '';

        const sanitizedQueries = [...new Set(genesInput.split(/[\s,;\n\r\t]+/).filter(Boolean).map(q => q.toUpperCase()))];
        const { foundGenes, notFoundGenes } = findGenes(sanitizedQueries);

        if (foundGenes.length === 0) {
            plotContainer.innerHTML = '<p class="status-message error">No valid genes found to generate a plot.</p>';
            return;
        }

        await generateAnalysisPlots(plotType, foundGenes, plotContainer);
        renderCiliaPlotSearchResultsTable(foundGenes, notFoundGenes, tableContainer);

    } catch (error) {
        console.error('Error during analysis:', error);
        plotContainer.innerHTML = `<p class="status-message error">An error occurred: ${error.message}</p>`;
    }
}

/**
 * A simple router that calls the correct plot rendering function.
 */
async function generateAnalysisPlots(plotType, foundGenes, container) {
    const expressionPlots = ['expression_heatmap', 'top_tissues', 'tissue_profile', 'expression_localization'];
    if (expressionPlots.includes(plotType)) {
        await loadExpressionData();
    }

    switch (plotType) {
        case 'organelle_umap':
            await renderOrganelleUMAP(foundGenes, container); break;
        case 'feature_plot':
            await renderFeaturePlot(foundGenes, container); break;
        case 'network':
            await renderComplexNetwork(foundGenes, container); break;
        case 'organelle_radar':
            await renderOrganelleRadarPlot(foundGenes, container); break;
        case 'expression_heatmap':
            await renderExpressionHeatmap(foundGenes, container); break;
        case 'top_tissues':
            await renderTopExpressingTissues(foundGenes, container); break;
        case 'functional_category':
            await renderFunctionalCategoryPlot(foundGenes, container); break;
        case 'expression_localization':
            await renderExpressionLocalizationBubble(foundGenes, container); break;
        case 'bubble':
            await renderKeyLocalizations(foundGenes, container); break;
        case 'matrix':
            await renderGeneMatrix(foundGenes, container); break;
        case 'domain_matrix':
            await renderDomainMatrixPlot(foundGenes, container); break;
        case 'tissue_profile':
            await renderTissueExpressionProfile(foundGenes, container); break;
        default:
            container.innerHTML = `<p class="status-message">Plot type "${plotType}" is not yet implemented.</p>`; break;
    }
}

/**
 * Displays detailed annotation for a selected gene in the annotation panel.
 */
function displayGeneAnnotation(geneName) {
    const container = document.getElementById('ciliaplot-annotation-panel');
    if (!container) return;

    const data = simulatedAnnotationData[geneName.toUpperCase()] || simulatedAnnotationData["DEFAULT"];
    
    container.innerHTML = `
        <h4 class="annotation-title">Annotation: ${geneName}</h4>
        <div class="annotation-content">
            <div class="annotation-section">
                <h5>Graph-based annotation</h5>
                <p>${data.graph_based_annotation}</p>
                <div class="annotation-grid">
                    <div><strong>Interfacial:</strong> ${data.interfacial}</div>
                    <div><strong>At interface with:</strong> ${data.interface_with}</div>
                </div>
            </div>
            <div class="annotation-section">
                <h5>Classifier-based annotation</h5>
                <p>${data.classifier_annotation}</p>
                 <div class="annotation-grid">
                    <div><strong>Copies/cell*:</strong> ${data.copies_per_cell.toLocaleString()}</div>
                    <div><strong>Concentration (nM)*:</strong> ${data.concentration_nM}</div>
                </div>
            </div>
            <p class="annotation-footnote">
                *Whole cell protein copy number and concentration are from Cho et al. 2022, Science.
            </p>
        </div>
    `;
}

// =============================================================================
// SECTION 3: CORE UTILITY FUNCTIONS
// =============================================================================

function clearPreviousPlot(container) {
    if (currentPlotInstance) {
        if (typeof currentPlotInstance.destroy === 'function') {
            currentPlotInstance.destroy();
        } else if (currentPlotInstance.nodeType) {
            currentPlotInstance.remove();
        }
    }
    if (container) {
        container.innerHTML = '';
    }
    currentPlotInstance = null;
}

function getCleanArray(gene, ...keys) {
    let data = null;
    for (const key of keys) {
        if (gene[key] != null) { data = gene[key]; break; }
    }
    if (data == null) return [];
    const separatorRegex = /[,;]/;
    const initialArray = Array.isArray(data) ? data : String(data).split(separatorRegex);
    return initialArray.filter(Boolean).flatMap(item => String(item).split(separatorRegex)).map(item => item.trim()).filter(Boolean);
}

function getPlotSettings() {
    // This is a simplified version. Restore your more detailed function if needed.
    return {
        titleFontSize: 20,
        fontColor: '#333333',
        gridColor: '#e0e0e0'
    };
}

async function downloadPlot() {
    const format = 'png';
    const plotArea = document.getElementById('ciliaplot-visualization-container');
    if (!plotArea.firstChild || plotArea.querySelector('.status-message')) {
        alert("Please generate a plot first.");
        return;
    }
    const fileName = `CiliaHub_Plot.${format}`;
    try {
        const canvas = await html2canvas(plotArea, {
            backgroundColor: '#ffffff',
            scale: 2 
        });
        const dataUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = fileName;
        a.click();
    } catch (e) {
        console.error("Download failed:", e);
        alert("An error occurred during download.");
    }
}

function getGeneExpression(geneName) {
    return (typeof expressionData !== 'undefined' && expressionData[geneName.toUpperCase()]) || {};
}

function getTissueNames() {
    if (typeof tissueNames !== 'undefined' && tissueNames.length > 0) return tissueNames;
    if (typeof expressionData !== 'undefined' && Object.keys(expressionData).length > 0) {
        const firstGene = Object.keys(expressionData)[0];
        return Object.keys(expressionData[firstGene]);
    }
    return [];
}

function calculateExpressionStats(genes) {
    const tissues = getTissueNames();
    const stats = { meanExpression: {}, stdDevExpression: {} };
    tissues.forEach(tissue => {
        const values = genes.map(gene => {
            const expr = getGeneExpression(gene.gene);
            return expr && expr[tissue] != null ? expr[tissue] : 0;
        }).filter(v => v > 0);

        if (values.length > 0) {
            const sum = values.reduce((a, b) => a + b, 0);
            const mean = sum / values.length;
            stats.meanExpression[tissue] = mean;
            const sumSq = values.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0);
            stats.stdDevExpression[tissue] = Math.sqrt(sumSq / values.length);
        } else {
            stats.meanExpression[tissue] = 0;
            stats.stdDevExpression[tissue] = 0;
        }
    });
    return stats;
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
                if (!linkMap.has(key)) {
                    linkMap.set(key, { source: geneArray[i], target: geneArray[j] });
                }
            }
        }
    });
    return { nodes, links: Array.from(linkMap.values()) };
}

// =============================================================================
// SECTION 4: TABLE RENDERING FUNCTIONS
// =============================================================================

function renderCiliaPlotSearchResultsTable(foundGenes, notFoundGenes, container) {
    if (!container) return;
    if (foundGenes.length === 0 && notFoundGenes.length === 0) {
        container.innerHTML = '';
        return;
    }
    let html = `<h3 class="table-title">Gene Query Summary</h3>`;
    if (foundGenes.length > 0) {
        html += `<div class="table-responsive"><table class="data-summary-table"><thead><tr><th>Gene</th><th>Ensembl ID</th><th>Localization Summary</th></tr></thead><tbody>`;
        foundGenes.forEach(item => {
            const localizationText = getCleanArray(item, 'localization').join(', ') || 'N/A';
            html += `<tr>
                <td><a href="/#/${item.gene}" onclick="navigateTo(event, '/${item.gene}')">${item.gene}</a></td>
                <td>${item.ensembl_id || 'N/A'}</td>
                <td>${localizationText}</td>
            </tr>`;
        });
        html += '</tbody></table></div>';
    }
    if (notFoundGenes && notFoundGenes.length > 0) {
        html += `<div class="not-found-genes"><h4>Genes Not Found (${notFoundGenes.length}):</h4><p>${notFoundGenes.join(', ')}</p></div>`;
    }
    container.innerHTML = html;
}

function renderFoundNotFoundTable(queries, foundGenes, container) {
    if (!container) return;
    const foundSet = new Set(foundGenes.map(g => g.gene.toUpperCase()));
    let tableHTML = `<h3 class="table-title">Input Genes Status</h3><div class="table-responsive"><table class="data-summary-table"><thead><tr><th>Input Gene</th><th>Status</th></tr></thead><tbody>`;
    queries.forEach(query => {
        const status = foundSet.has(query) ? 'Found' : 'Not Found';
        tableHTML += `<tr><td>${query}</td><td>${status}</td></tr>`;
    });
    tableHTML += `</tbody></table></div>`;
    container.innerHTML = tableHTML;
}

function renderGeneDataTable(foundGenes, container) {
    if (!container || !foundGenes.length) { if (container) container.innerHTML = ''; return; }
    let tableHTML = `<h3 class="table-title">Gene Data Summary</h3><div class="table-responsive"><table class="data-summary-table"><thead><tr><th>Gene</th><th>ENSG ID</th><th>Localizations</th><th>Max Expression (nTPM)</th></tr></thead><tbody>`;
    foundGenes.forEach(gene => {
        const localizations = getCleanArray(gene, 'localization').join(', ') || 'N/A';
        const geneExpr = getGeneExpression(gene.gene);
        const maxExpression = Math.max(0, ...Object.values(geneExpr));
        tableHTML += `<tr><td><strong>${gene.gene}</strong></td><td>${gene.ensembl_id || 'N/A'}</td><td>${localizations}</td><td>${maxExpression.toFixed(2)}</td></tr>`;
    });
    tableHTML += `</tbody></table></div>`;
    container.innerHTML = tableHTML;
}

// =============================================================================
// SECTION 5: PLOT RENDERING FUNCTIONS
// =============================================================================

function renderComplexNetwork(foundGenes, container) {
    clearPreviousPlot(container);
    const { nodes, links } = computeProteinComplexLinks(foundGenes);
    if (!nodes.length || !links.length) {
        container.innerHTML = '<p class="status-message">No protein complex links found among the selected genes.</p>';
        return;
    }
    const width = container.clientWidth;
    const height = Math.max(600, container.clientHeight);
    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${width} ${height}`);
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width / 2, height / 2));
    const link = svg.append("g").selectAll("line").data(links).enter().append("line").style("stroke", "#999").style("stroke-opacity", 0.6);
    const nodeGroup = svg.append("g").selectAll("g").data(nodes).enter().append("g")
        .style("cursor", "pointer")
        .on("click", (event, d) => {
            displayGeneAnnotation(d.id);
        })
        .call(d3.drag().on("start", (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }).on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; }).on("end", (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));
    nodeGroup.append("circle").attr("r", 12).style("fill", "#3498db").style("stroke", "#fff").style("stroke-width", 2);
    nodeGroup.append("text").text(d => d.id).attr("x", 15).attr("y", 5).style("font-family", "Arial").style("font-size", "12px");
    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        nodeGroup.attr("transform", d => `translate(${d.x},${d.y})`);
    });
    currentPlotInstance = svg.node();
}

function renderDomainMatrixPlot(foundGenes, container) {
    clearPreviousPlot(container);
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const allDomains = [...new Set(foundGenes.flatMap(g => getCleanArray(g, 'domain_descriptions')))];
    if (allDomains.length === 0) { container.innerHTML = '<p class="status-message">No domain data found.</p>'; return; }
    const xLabels = [...new Set(foundGenes.map(g => g.gene))].sort();
    const datasets = foundGenes.map((gene, index) => ({
        label: gene.gene,
        data: getCleanArray(gene, 'domain_descriptions').map(domain => ({ x: gene.gene, y: domain, r: 10 })),
        backgroundColor: d3.schemeCategory10[index % 10]
    }));
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble', data: { datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: "Gene vs. Domain Descriptions" }, legend: { display: false } },
            scales: {
                x: { type: 'category', labels: xLabels, ticks: { maxRotation: 90, minRotation: 45 } },
                y: { type: 'category', labels: allDomains.sort() }
            }
        }
    });
}

function renderExpressionHeatmap(foundGenes, container) {
    clearPreviousPlot(container);
    const tissues = getTissueNames();
    const genesWithExpression = foundGenes.filter(gene => Object.keys(getGeneExpression(gene.gene)).length > 0);
    if (genesWithExpression.length === 0) { container.innerHTML = '<p class="status-message">No expression data found.</p>'; return; }
    let maxExpression = 0;
    const heatmapData = [];
    genesWithExpression.forEach(gene => {
        const expr = getGeneExpression(gene.gene);
        maxExpression = Math.max(maxExpression, ...Object.values(expr));
        tissues.forEach(tissue => { heatmapData.push({ gene: gene.gene, tissue: tissue, expression: expr[tissue] || 0 }); });
    });
    const containerWidth = container.clientWidth; const containerHeight = Math.max(600, container.clientHeight);
    const margin = { top: 60, right: 100, bottom: 150, left: 120 };
    const width = containerWidth - margin.left - margin.right; const height = containerHeight - margin.top - margin.bottom;
    const svg = d3.select(container).append('svg').attr('width', '100%').attr('height', '100%').attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`).append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
    const xScale = d3.scaleBand().domain(tissues).range([0, width]).padding(0.05);
    const yScale = d3.scaleBand().domain(genesWithExpression.map(g => g.gene)).range([0, height]).padding(0.05);
    const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([0, maxExpression]);
    svg.selectAll('.heatmap-rect').data(heatmapData).enter().append('rect').attr('x', d => xScale(d.tissue)).attr('y', d => yScale(d.gene)).attr('width', xScale.bandwidth()).attr('height', yScale.bandwidth()).attr('fill', d => colorScale(d.expression || 0));
    svg.append('g').attr('transform', `translate(0, ${height})`).call(d3.axisBottom(xScale)).selectAll('text').attr('transform', 'translate(-10,0)rotate(-45)').style('text-anchor', 'end');
    svg.append('g').call(d3.axisLeft(yScale));
    const legendWidth = 20, legendHeight = height / 2, legendX = width + 40, legendY = height / 4;
    const legend = svg.append('g').attr('transform', `translate(${legendX}, ${legendY})`);
    const defs = legend.append('defs');
    const linearGradient = defs.append('linearGradient').attr('id', 'legend-gradient').attr('gradientTransform', 'rotate(90)');
    linearGradient.selectAll('stop').data(colorScale.ticks().map((t, i, n) => ({ offset: `${100 * i / n.length}%`, color: colorScale(t) }))).enter().append('stop').attr('offset', d => d.offset).attr('stop-color', d => d.color);
    legend.append('rect').attr('width', legendWidth).attr('height', legendHeight).style('fill', 'url(#legend-gradient)');
    const legendScale = d3.scaleLinear().domain(colorScale.domain()).range([legendHeight, 0]);
    legend.append('g').attr('transform', `translate(${legendWidth}, 0)`).call(d3.axisRight(legendScale).ticks(5));
    currentPlotInstance = d3.select(container).select('svg').node();
}

function renderExpressionLocalizationBubble(foundGenes, container) {
    clearPreviousPlot(container);
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const tissues = getTissueNames();
    const bubbleData = foundGenes.map(gene => {
        const geneExpr = getGeneExpression(gene.gene);
        const expressingTissues = tissues.filter(tissue => (geneExpr[tissue] || 0) > 1.0);
        const maxExpression = Math.max(0, ...Object.values(geneExpr));
        const localizations = getCleanArray(gene, 'localization');
        return { x: expressingTissues.length, y: localizations.length, r: Math.max(5, Math.sqrt(maxExpression) * 3), gene: gene.gene };
    }).filter(d => d.x > 0 || d.y > 0);
    if (bubbleData.length === 0) { container.innerHTML = '<p class="status-message">No data to display.</p>'; return; }
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: { datasets: [{ label: 'Genes', data: bubbleData, backgroundColor: 'rgba(155, 89, 182, 0.6)' }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Expression Breadth vs Localization Diversity' }, legend: { display: false } },
            scales: {
                x: { title: { display: true, text: 'Number of Expressing Tissues' } },
                y: { title: { display: true, text: 'Number of Subcellular Localizations' } }
            }
        }
    });
}

function renderFeaturePlot(foundGenes, container) {
    clearPreviousPlot(container);
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const settings = getPlotSettings();
    const backgroundDataset = { label: 'All Proteins', data: Object.values(precomputedUMAP).flat(), backgroundColor: '#cccccc66', pointRadius: 3 };
    const userGeneData = [];
    const colorMap = {};
    const localizationColors = d3.schemeCategory10;
    let colorIndex = 0;
    foundGenes.forEach(gene => {
        const localizations = getCleanArray(gene, 'localization');
        const primaryLoc = localizations[0] || 'Unknown';
        if (!colorMap[primaryLoc]) { colorMap[primaryLoc] = localizationColors[colorIndex++ % localizationColors.length]; }
        for (const loc of localizations) {
            const matchedOrganelle = Object.keys(precomputedUMAP).find(org => loc.toLowerCase().includes(org.toLowerCase()));
            if (matchedOrganelle && precomputedUMAP[matchedOrganelle].length > 0) {
                const point = precomputedUMAP[matchedOrganelle][userGeneData.length % precomputedUMAP[matchedOrganelle].length];
                userGeneData.push({ ...point, gene: gene.gene, localization: primaryLoc, color: colorMap[primaryLoc] });
                break;
            }
        }
    });
    const userDatasets = Object.entries(colorMap).map(([loc, color]) => ({
        label: loc, data: userGeneData.filter(d => d.localization === loc), backgroundColor: color, pointRadius: 8, borderColor: '#ffffff', borderWidth: 2,
    }));
    currentPlotInstance = new Chart(ctx, {
        type: 'scatter', data: { datasets: [backgroundDataset, ...userDatasets] },
        options: {
            responsive: true, maintainAspectRatio: false,
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const dataset = currentPlotInstance.data.datasets[elements[0].datasetIndex];
                    if (dataset.label === 'All Proteins') return;
                    const geneData = dataset.data[elements[0].index];
                    if (geneData && geneData.gene) { displayGeneAnnotation(geneData.gene); }
                }
            },
            plugins: {
                title: { display: true, text: "Gene Set Feature Plot", font: { size: settings.titleFontSize } },
                legend: { position: 'right' },
                tooltip: { callbacks: { label: c => `Gene: ${c.raw.gene} (${c.raw.localization})` } }
            },
            scales: {
                x: { title: { display: true, text: 'UMAP 1' }, grid: { display: false }, ticks: { display: false } },
                y: { title: { display: true, text: 'UMAP 2' }, grid: { display: false }, ticks: { display: false } }
            }
        }
    });
}

function renderFunctionalCategoryPlot(foundGenes, container) {
    clearPreviousPlot(container);
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const categoryCounts = new Map();
    foundGenes.forEach(gene => {
        getCleanArray(gene, 'functional_category').forEach(cat => {
            categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
        });
    });
    if (categoryCounts.size === 0) { container.innerHTML = '<p class="status-message">No functional category data found.</p>'; return; }
    const sortedData = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1]);
    const labels = sortedData.map(item => item[0]);
    const data = sortedData.map(item => item[1]);
    currentPlotInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Gene Count', data, backgroundColor: 'rgba(26, 188, 156, 0.7)' }] },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Functional Category Distribution' }, legend: { display: false } },
            scales: { x: { title: { display: true, text: 'Number of Genes' } } }
        }
    });
}

function renderGeneMatrix(foundGenes, container) {
    clearPreviousPlot(container);
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const yCategories = [...new Set(foundGenes.flatMap(g => getCleanArray(g, 'localization')))].sort();
    if (yCategories.length === 0) { container.innerHTML = '<p class="status-message">No localization data found.</p>'; return; }
    const xLabels = [...new Set(foundGenes.map(g => g.gene))].sort();
    const datasets = foundGenes.map((gene, index) => ({
        label: gene.gene,
        data: getCleanArray(gene, 'localization').map(loc => ({ x: gene.gene, y: loc, r: 10 })),
        backgroundColor: d3.schemeTableau10[index % 10]
    }));
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble', data: { datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: "Gene Localization Matrix" }, legend: { display: false } },
            scales: {
                x: { type: 'category', labels: xLabels, ticks: { maxRotation: 90, minRotation: 45 } },
                y: { type: 'category', labels: yCategories }
            }
        }
    });
}

function renderKeyLocalizations(foundGenes, container) {
    clearPreviousPlot(container);
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const yCategories = ['Cilia', 'Basal Body', 'Transition Zone', 'Axoneme', 'Ciliary Membrane', 'Centrosome', 'Cytosol', 'Nucleus'];
    const localizationCounts = {};
    foundGenes.forEach(gene => {
        getCleanArray(gene, 'localization').forEach(loc => {
            const match = yCategories.find(cat => cat.toLowerCase() === loc.toLowerCase());
            if (match) localizationCounts[match] = (localizationCounts[match] || 0) + 1;
        });
    });
    const categoriesWithData = yCategories.filter(cat => localizationCounts[cat] > 0);
    if (categoriesWithData.length === 0) { container.innerHTML = '<p class="status-message">No genes in key localizations found.</p>'; return; }
    const dataset = {
        label: 'Gene Count',
        data: categoriesWithData.map(loc => ({ x: localizationCounts[loc], y: loc, r: 8 + localizationCounts[loc] * 2 })),
        backgroundColor: 'rgba(52, 152, 219, 0.7)'
    };
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble', data: { datasets: [dataset] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: "Key Ciliary Localizations" }, legend: { display: false } },
            scales: {
                x: { title: { display: true, text: "Gene Count" } },
                y: { type: 'category', labels: yCategories, title: { display: true, text: "Cellular Compartment" } }
            }
        }
    });
}

function renderOrganelleRadarPlot(foundGenes, container) {
    clearPreviousPlot(container);
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const settings = getPlotSettings();
    const userProfile = new Array(fractionLabels.length).fill(0);
    let contributingGenes = 0;
    foundGenes.forEach(gene => {
        const localizations = getCleanArray(gene, 'localization');
        let geneAdded = false;
        localizations.forEach(loc => {
            const matchedProfile = Object.keys(organelleMarkerProfiles).find(key => loc.toLowerCase().includes(key.toLowerCase()));
            if (matchedProfile) {
                organelleMarkerProfiles[matchedProfile].forEach((val, i) => userProfile[i] += val);
                geneAdded = true;
            }
        });
        if (geneAdded) contributingGenes++;
    });
    if (contributingGenes > 0) {
        userProfile.forEach((val, i) => userProfile[i] /= contributingGenes);
    } else {
        container.innerHTML = '<p class="status-message">No genes mapped to an organellar profile.</p>'; return;
    }
    const datasets = Object.entries(organelleMarkerProfiles).map(([name, data], index) => ({
        label: name, data: data, borderColor: d3.schemeTableau10[index], backgroundColor: d3.schemeTableau10[index] + '33',
    }));
    datasets.push({
        label: 'Your Gene Set', data: userProfile, borderColor: '#e74c3c', backgroundColor: '#e74c3c55', borderWidth: 3,
    });
    currentPlotInstance = new Chart(ctx, {
        type: 'radar', data: { labels: fractionLabels, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: "Organellar Profile Comparison", font: { size: settings.titleFontSize } },
                legend: { position: 'top' }
            },
            scales: { r: { suggestedMin: 0, suggestedMax: 1 } }
        }
    });
}

function renderOrganelleUMAP(foundGenes, container) {
    clearPreviousPlot(container);
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const settings = getPlotSettings();
    const backgroundDatasets = Object.entries(precomputedUMAP).map(([name, data], index) => ({
        label: name, data: data, backgroundColor: d3.schemeCategory10[index] + '77', pointRadius: 4,
    }));
    const userGeneData = [];
    let mappedCount = 0;
    foundGenes.forEach(gene => {
        const localizations = getCleanArray(gene, 'localization');
        for (const organelle in precomputedUMAP) {
            if (localizations.some(loc => organelle.toLowerCase().includes(loc.toLowerCase()))) {
                const point = precomputedUMAP[organelle][mappedCount % precomputedUMAP[organelle].length];
                if (point) { userGeneData.push({ ...point, gene: gene.gene }); mappedCount++; break; }
            }
        }
    });
    if (userGeneData.length === 0) { container.innerHTML = '<p class="status-message">No genes mapped to UMAP.</p>'; return; }
    const userDataset = {
        label: 'Your Genes', data: userGeneData, backgroundColor: '#e74c3c', pointRadius: 8, borderColor: '#ffffff', borderWidth: 2,
    };
    currentPlotInstance = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: [...backgroundDatasets, userDataset] },
        options: {
            responsive: true, maintainAspectRatio: false,
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const dataset = currentPlotInstance.data.datasets[elements[0].datasetIndex];
                    const geneData = dataset.data[elements[0].index];
                    if (geneData && geneData.gene) { displayGeneAnnotation(geneData.gene); }
                }
            },
            plugins: {
                title: { display: true, text: "UMAP Projection of Organellar Proteomes", font: { size: settings.titleFontSize } },
                legend: { position: 'right' },
                tooltip: { callbacks: { label: c => c.raw.gene ? `Gene: ${c.raw.gene}` : c.dataset.label } }
            },
            scales: {
                x: { title: { display: true, text: 'UMAP 1' }, grid: { display: false }, ticks: { display: false } },
                y: { title: { display: true, text: 'UMAP 2' }, grid: { display: false }, ticks: { display: false } }
            }
        }
    });
}

function renderTissueExpressionProfile(foundGenes, container) {
    clearPreviousPlot(container);
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const stats = calculateExpressionStats(foundGenes);
    const sortedTissues = Object.keys(stats.meanExpression).sort((a, b) => stats.meanExpression[b] - stats.meanExpression[a]).slice(0, 20);
    if (sortedTissues.length === 0) { container.innerHTML = '<p class="status-message">No expression data to display.</p>'; return; }
    const labels = sortedTissues;
    const means = sortedTissues.map(tissue => stats.meanExpression[tissue]);
    currentPlotInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{ label: 'Mean Expression', data: means, borderColor: 'rgba(31, 120, 180, 1)', backgroundColor: 'rgba(31, 120, 180, 0.2)', fill: true }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Tissue Expression Profile (Top 20 Tissues)' } },
            scales: {
                x: { ticks: { maxRotation: 90, minRotation: 45 } },
                y: { title: { display: true, text: 'Mean Expression (nTPM)' }, beginAtZero: true }
            }
        }
    });
}

function renderTopExpressingTissues(foundGenes, container) {
    clearPreviousPlot(container);
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const stats = calculateExpressionStats(foundGenes);
    const tissueData = Object.entries(stats.meanExpression).map(([tissue, mean]) => ({ tissue, mean }))
        .filter(d => d.mean > 0).sort((a, b) => b.mean - a.mean).slice(0, 20);
    if (tissueData.length === 0) { container.innerHTML = '<p class="status-message">No expression data found.</p>'; return; }
    const labels = tissueData.map(d => d.tissue);
    const data = tissueData.map(d => d.mean);
    currentPlotInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: 'Mean Expression', data, backgroundColor: 'rgba(46, 204, 113, 0.7)' }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Top 20 Expressing Tissues' }, legend: { display: false } },
            scales: { x: { title: { display: true, text: 'Mean Expression (nTPM)' } } }
        }
    });
}
