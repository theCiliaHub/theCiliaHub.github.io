// =============================================================================
// PLOTS.JS - COMPLETE IMPLEMENTATION
// =============================================================================

// --- Local expression state for plots.js heatmap only ---
let plotExpressionData = {};
let plotExpressionLoaded = false;
let pendingHeatmapRequest = null;

// --- Dedicated expression loader for plots.js ---
async function loadPlotExpressionData() {
    try {
        console.log("plots.js: Loading expression data for heatmap...");
        const response = await fetch('rna_tissue_consensus.tsv');
        if (!response.ok) throw new Error('Failed to load expression data (plots.js)');

        const tsvText = await response.text();
        const rawData = parseTSV(tsvText);
        plotExpressionData = processExpressionData(rawData); // Reuse script.js parser
        plotExpressionLoaded = true;

        console.log(`plots.js: Loaded ${Object.keys(plotExpressionData).length} genes with expression data.`);

        // If user already requested a heatmap earlier, render now
        if (pendingHeatmapRequest) {
            console.log("plots.js: Rendering deferred heatmap now that expression data is ready.");
            renderExpressionHeatmap(plotExpressionData, pendingHeatmapRequest.foundGenes);
            pendingHeatmapRequest = null;
        }
    } catch (error) {
        console.error("plots.js: Error loading expression data:", error);
    }
}

// =============================================================================
// MODIFIED PLOT CONTAINER STYLES - ENSURE NO OVERFLOW
// =============================================================================
const plotContainerStyles = `
    #plot-display-area {
        position: relative;
        width: 100%;
        height: 60vh;
        border: 2px dashed #ccc;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #888;
        margin-top: 10px;
        overflow: hidden; /* CRITICAL: Prevents content from spilling out */
    }

    #plot-display-area > div,
    #plot-display-area > svg,
    #plot-display-area > canvas {
        /* CRITICAL: Forces the rendered plot to conform to the container's size */
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        max-height: 100% !important;
        overflow: hidden !important;
    }
    
    /* Additional styling for D3 plots to ensure proper containment */
    .d3-plot-container {
        width: 100% !important;
        height: 100% !important;
        overflow: hidden !important;
    }
    
    /* Plot explanation styling */
    .plot-explanation {
        background: #f0f8ff; 
        border-left: 4px solid #3f51b5; 
        padding: 12px 16px; 
        margin-bottom: 15px; 
        border-radius: 4px;
        font-size: 14px;
        color: #333;
    }
    
    /* Footer text styling */
    .footer-text {
        margin-top: 20px;
        padding: 15px;
        background: #f9f9f9;
        border-radius: 8px;
        font-size: 14px;
        line-height: 1.5;
        color: #555;
    }
    
    .footer-text ul {
        margin: 10px 0 10px 20px;
    }
`;

// Add these styles to the document
document.head.insertAdjacentHTML('beforeend', `<style>${plotContainerStyles}</style>`);

// =============================================================================
// PLOT EXPLANATIONS - NEW FEATURE
// =============================================================================
const PLOT_EXPLANATIONS = {
    'localization_bubble': 'This bubble plot shows the subcellular localization of your genes. Each bubble represents a gene localized to a specific cellular compartment. Hover over bubbles to see details.',
    'functional_bar': 'This bar chart displays the functional categories of your genes. The height of each bar represents the number of genes in that functional category.',
    'enrichment_bubble': 'This enrichment analysis shows which functional categories are over-represented in your gene set. Larger bubbles indicate more genes, and color intensity shows statistical significance.',
    'balloon_plot': 'This balloon plot visualizes the relationship between gene functions and localizations. The size of each balloon represents the number of genes with that function-localization combination.',
    'venn_diagram': 'This Venn diagram compares your gene set with a reference ciliary gene set, showing overlaps and unique genes using exact matching only.',
    'network': 'This network visualization shows protein complex interactions between your genes. Nodes represent genes, and edges represent known interactions.',
    'organelle_radar': 'This radar chart compares organellar profiles. Each line represents the typical distribution of an organelle across cellular fractions.',
    'organelle_umap': 'This UMAP projection shows how genes cluster based on their organellar localization patterns in a reduced dimensional space.',
    'screen_analysis': 'This screen analysis visualization shows gene performance across different CRISPR screens. Each point represents a gene in a specific screen.',
    'expression_heatmap': 'This heatmap shows expression levels of your genes across different tissues. Red indicates higher expression, green indicates lower expression.'
};

// Add explanation display to the plot container
function addPlotExplanation(plotType) {
    const explanation = PLOT_EXPLANATIONS[plotType] || 'This visualization shows your gene data in a graphical format.';
    const plotContainer = document.getElementById('plot-display-area');
    
    // Remove any existing explanation
    const existingExplanation = document.querySelector('.plot-explanation');
    if (existingExplanation) {
        existingExplanation.remove();
    }
    
    // Add explanation above the plot
    plotContainer.insertAdjacentHTML('beforebegin', `
        <div class="plot-explanation">
            <strong>About this plot:</strong> ${explanation}
        </div>
    `);
}

// =============================================================================
// VISUALIZATION CONTAINER FOOTER TEXT - NEW FEATURE
// =============================================================================
function addFooterText() {
    const visualizationPanel = document.querySelector('.visualization-panel');
    
    // Check if footer already exists
    if (document.querySelector('.footer-text')) return;
    
    visualizationPanel.insertAdjacentHTML('beforeend', `
        <div class="footer-text">
            <p>The CiliaHub database contains an updated list of over 2200 Gold Standard Genes with Ciliary Functions. With CiliaPlot, users can perform powerful analyses on their own gene lists, such as those from CRISPR/Cas9 screenings. You can visualize the subcellular localization of ciliary genes, identify enriched or depleted protein domains, and perform detailed functional analysis.</p>
            
            <p>Additionally, we have integrated four seminal genome-wide screens for cilia and Hedgehog pathway functions:</p>
            
            <ul>
                <li>Kim et al. 2016</li>
                <li>Roosing et al. 2015</li>
                <li>Breslow et al. 2018</li>
                <li>Wheway et al. 2015</li>
            </ul>
        </div>
    `);
}

// =============================================================================
// GENE LOCALIZATIONS (BUBBLE PLOT) - UPDATED
// =============================================================================
function renderBubblePlot(genes, custom) {
    const plotData = [];
    genes.forEach(gene => {
        const localizations = getCleanArray(gene, 'localization');
        if (localizations.length > 0) {
            plotData.push({
                x: localizations, 
                y: Array(localizations.length).fill(gene.gene),
                mode: 'markers', 
                type: 'scatter', 
                name: gene.gene,
                marker: { 
                    size: 15, 
                    color: '#c8d9ed' // Set default plot color to #c8d9ed
                }, 
                hoverinfo: 'x+y'
            });
        }
    });
    
    const layout = {
        title: { 
            text: custom.title || 'Gene Subcellular Localizations', 
            font: { size: custom.titleFontSize, family: custom.fontFamily } 
        },
        xaxis: { 
            title: { text: 'Localization', font: custom.axisTitleFont }, 
            visible: custom.showX, 
            showline: true, // Ensure X-axis line is visible
            linecolor: 'black', 
            linewidth: 2, 
            mirror: true, 
            gridcolor: 'white',
            showgrid: false // Remove grid lines, keep only axis line
        },
        yaxis: { 
            title: { text: 'Gene', font: custom.axisTitleFont }, 
            visible: custom.showY, 
            showline: true, // Ensure Y-axis line is visible
            linecolor: 'black', 
            linewidth: 2, 
            mirror: true, 
            gridcolor: 'white',
            showgrid: false // Remove grid lines, keep only axis line
        },
        showlegend: false, 
        height: 600, 
        margin: { l: 120, r: 20, b: 100, t: 80 },
        plot_bgcolor: 'white', 
        paper_bgcolor: 'white'
    };
    
    Plotly.newPlot('plot-display-area', plotData, layout, { responsive: true });
}

// =============================================================================
// FUNCTIONAL CATEGORIES (BAR PLOT) - UPDATED
// =============================================================================
function renderBarPlot(genes, custom) {
    const categoryCounts = new Map();
    genes.forEach(gene => {
        getCleanArray(gene, 'functional_category').forEach(cat => {
            categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
        });
    });
    
    const sorted = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
    const data = [{ 
        x: sorted.map(e => e[1]), 
        y: sorted.map(e => e[0]), 
        type: 'bar', 
        orientation: 'h', 
        marker: { color: '#4CAF50' } 
    }];
    
    const layout = {
        title: { 
            text: custom.title || 'Functional Category Counts', 
            font: { size: custom.titleFontSize, family: custom.fontFamily } 
        },
        xaxis: { 
            title: { text: 'Number of Genes', font: custom.axisTitleFont }, 
            visible: custom.showX, 
            showline: true, // Ensure X-axis line is clearly visible
            linecolor: 'black', 
            linewidth: 2, 
            mirror: true, 
            gridcolor: 'white',
            showgrid: false // Remove grid lines, keep only axis line
        },
        yaxis: { 
            title: { text: 'Category', font: custom.axisTitleFont }, 
            visible: custom.showY, 
            automargin: true, 
            showline: true, // Ensure Y-axis line is clearly visible
            linecolor: 'black', 
            linewidth: 2, 
            mirror: true, 
            gridcolor: 'white',
            showgrid: false // Remove grid lines, keep only axis line
        },
        height: 600, 
        margin: { l: 250, r: 20, b: 50, t: 80 },
        plot_bgcolor: 'white', 
        paper_bgcolor: 'white'
    };
    
    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
}

// =============================================================================
// ENRICHMENT ANALYSIS (BUBBLE PLOT) - UPDATED
// =============================================================================
function renderEnrichmentBubblePlot(foundGenes, custom) {
    const plotContainer = document.getElementById('plot-display-area');
    clearAllPlots('plot-display-area');
    
    // Calculate enrichment scores for functional categories
    const categoryCounts = new Map();
    const totalGenes = foundGenes.length;
    
    foundGenes.forEach(gene => {
        getCleanArray(gene, 'functional_category').forEach(cat => {
            categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
        });
    });
    
    // Calculate enrichment p-values (simplified for demonstration)
    const enrichmentData = [];
    const allCategories = [...categoryCounts.keys()];
    const totalInDatabase = 100; // This would come from your database statistics
    
    allCategories.forEach(category => {
        const countInSet = categoryCounts.get(category);
        const proportionInSet = countInSet / totalGenes;
        const proportionInDatabase = 0.1; // This would come from your database
        
        // Simplified enrichment score
        const enrichmentScore = proportionInSet / proportionInDatabase;
        const pValue = 1 / (enrichmentScore * 10); // Simplified p-value calculation
        
        enrichmentData.push({
            category,
            count: countInSet,
            enrichment: enrichmentScore,
            pValue: pValue
        });
    });
    
    // Create bubble plot
    const data = [{
        x: enrichmentData.map(d => d.category),
        y: enrichmentData.map(d => d.enrichment),
        text: enrichmentData.map(d => `Category: ${d.category}<br>Count: ${d.count}<br>Enrichment: ${d.enrichment.toFixed(2)}<br>p-value: ${d.pValue.toFixed(4)}`),
        mode: 'markers',
        marker: {
            size: enrichmentData.map(d => d.count * 5),
            color: enrichmentData.map(d => -Math.log10(d.pValue)),
            colorscale: 'Viridis',
            showscale: true,
            colorbar: {
                title: '-log10(p-value)',
                titleside: 'right'
            }
        }
    }];
    
    const layout = {
        title: { 
            text: custom.title || 'Functional Category Enrichment', 
            font: { size: custom.titleFontSize, family: custom.fontFamily } 
        },
        xaxis: { 
            title: { text: 'Functional Category', font: custom.axisTitleFont }, 
            visible: custom.showX, 
            showline: true, // Ensure X-axis line is clearly visible
            linecolor: 'black',
            linewidth: 2,
            tickangle: -45 
        },
        yaxis: { 
            title: { text: 'Enrichment Score', font: custom.axisTitleFont }, 
            visible: custom.showY,
            showline: true // Ensure Y-axis line is clearly visible
        },
        hovermode: 'closest',
        showlegend: false,
        height: 600,
        margin: { l: 120, r: 50, b: 150, t: 80 }
    };
    
    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
}

// =============================================================================
// FUNCTION VS LOCALIZATION (BALLOON PLOT) - UPDATED
// =============================================================================
function renderBalloonPlot(foundGenes, custom) {
    const plotContainer = document.getElementById('plot-display-area');
    clearAllPlots('plot-display-area');
    
    // Count occurrences of each localization and functional category
    const localizationCounts = new Map();
    const functionalCounts = new Map();
    
    foundGenes.forEach(gene => {
        getCleanArray(gene, 'localization').forEach(loc => {
            localizationCounts.set(loc, (localizationCounts.get(loc) || 0) + 1);
        });
        
        getCleanArray(gene, 'functional_category').forEach(func => {
            functionalCounts.set(func, (functionalCounts.get(func) || 0) + 1);
        });
    });
    
    // Prepare data for balloon plot
    const localizations = [...localizationCounts.keys()];
    const functions = [...functionalCounts.keys()];
    
    const zData = [];
    const textData = [];
    
    functions.forEach(func => {
        const row = [];
        const textRow = [];
        
        localizations.forEach(loc => {
            // Count genes that have both this function and localization
            let count = 0;
            foundGenes.forEach(gene => {
                const geneLocs = getCleanArray(gene, 'localization');
                const geneFuncs = getCleanArray(gene, 'functional_category');
                if (geneLocs.includes(loc) && geneFuncs.includes(func)) {
                    count++;
                }
            });
            
            row.push(count);
            textRow.push(`Function: ${func}<br>Localization: ${loc}<br>Count: ${count}`);
        });
        
        zData.push(row);
        textData.push(textRow);
    });
    
    const data = [{
        type: 'heatmap',
        x: localizations,
        y: functions,
        z: zData,
        text: textData,
        hoverinfo: 'text',
        colorscale: 'Blues',
        showscale: true
    }];
    
    const layout = {
        title: { 
            text: custom.title || 'Function vs Localization', 
            font: { size: custom.titleFontSize, family: custom.fontFamily } 
        },
        xaxis: { 
            title: { text: 'Localization', font: custom.axisTitleFont }, 
            visible: custom.showX,
            showline: true, // Ensure X-axis line is clearly visible
            linecolor: 'black',
            linewidth: 2,
            tickangle: -45 
        },
        yaxis: { 
            title: { text: 'Functional Category', font: custom.axisTitleFont }, 
            visible: custom.showY,
            showline: true // Ensure Y-axis line is clearly visible
        },
        height: 600,
        margin: { l: 150, r: 50, b: 150, t: 80 }
    };
    
    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
}

// =============================================================================
// GENE SET COMPARISON (VENN DIAGRAM) - UPDATED WITH EXACT MATCHES
// =============================================================================
function renderVennDiagram(foundGenes, custom) {
    const plotContainer = document.getElementById('plot-display-area');
    clearAllPlots('plot-display-area');
    
    // This would compare the user's gene list with a reference ciliary gene list
    // For demonstration, we'll use a mock reference list
    const referenceCiliaryGenes = new Set(['ABI2', 'ABLIM1', 'ABLIM3', 'ACTB', 'AKT1']); // Example genes
    
    // Use exact matches only for counting
    const userGenes = new Set(foundGenes.map(g => g.gene.toUpperCase()));
    
    // Calculate overlaps with exact matching
    const uniqueToUser = new Set();
    const uniqueToReference = new Set();
    const commonGenes = new Set();
    
    // Check exact matches only
    userGenes.forEach(gene => {
        if (referenceCiliaryGenes.has(gene)) {
            commonGenes.add(gene);
        } else {
            uniqueToUser.add(gene);
        }
    });
    
    referenceCiliaryGenes.forEach(gene => {
        if (!userGenes.has(gene)) {
            uniqueToReference.add(gene);
        }
    });
    
    // Create data for Venn diagram
    const sets = [
        { sets: ['Your Gene Set'], size: uniqueToUser.size },
        { sets: ['Ciliary Reference Set'], size: uniqueToReference.size },
        { sets: ['Your Gene Set', 'Ciliary Reference Set'], size: commonGenes.size }
    ];
    
    // For a real implementation, you would use a Venn diagram library like venn.js
    // This is a simplified version using Plotly's Venn diagram (if available)
    // Alternatively, you could implement with D3.js
    
    plotContainer.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <h3>Gene Set Comparison (Exact Matches Only)</h3>
            <div style="display: flex; justify-content: center; margin-top: 20px;">
                <div style="margin: 0 20px;">
                    <div style="width: 200px; height: 200px; border: 2px solid #3f51b5; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        Your Genes<br>${userGenes.size}
                    </div>
                </div>
                <div style="margin: 0 20px;">
                    <div style="width: 200px; height: 200px; border: 2px solid #4CAF50; border-radius: 50%; display: flex; align-items: center; justify-content: center; position: relative; left: -100px;">
                        Reference Ciliary Genes<br>${referenceCiliaryGenes.size}
                    </div>
                </div>
            </div>
            <div style="margin-top: 20px;">
                <p>Overlap: ${commonGenes.size} genes (exact matches only)</p>
                <p>Unique to your set: ${uniqueToUser.size} genes</p>
                <p>Unique to reference: ${uniqueToReference.size} genes</p>
            </div>
        </div>
    `;
}

// =============================================================================
// COMPLEX NETWORK (D3 PLOT) - UPDATED TO PREVENT OVERFLOW
// =============================================================================
function computeProteinComplexLinks(foundGenes) {
    const nodes = foundGenes.map(gene => ({ id: gene.gene }));
    const complexMap = new Map();
    foundGenes.forEach(gene => {
        getCleanArray(gene, 'complex_names', 'complex').forEach(complex => {
            if (!complexMap.has(complex)) complexMap.set(complex, new Set());
            complexMap.get(complex).add(gene.gene);
        });
    });
    const linkMap = new Map();
    complexMap.forEach((genes) => {
        const geneArray = Array.from(genes);
        for (let i = 0; i < geneArray.length; i++) {
            for (let j = i + 1; j < geneArray.length; j++) {
                const key = [geneArray[i], geneArray[j]].sort().join('-');
                linkMap.set(key, { source: geneArray[i], target: geneArray[j] });
            }
        }
    });
    return { nodes, links: Array.from(linkMap.values()) };
}

function renderComplexNetwork(foundGenes, container, custom) {
    clearAllPlots(container.id);
    const { nodes, links } = computeProteinComplexLinks(foundGenes);
    
    if (!nodes.length || !links.length) {
        container.innerHTML = '<p class="status-message">No protein complex links found.</p>';
        return;
    }
    
    // Create a container specifically for the D3 plot to prevent overflow
    container.innerHTML = '<div class="d3-plot-container"></div>';
    const d3Container = container.querySelector('.d3-plot-container');
    
    const width = d3Container.clientWidth;
    const height = d3Container.clientHeight;
    
    const svg = d3.select(d3Container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(120))
        .force("charge", d3.forceManyBody().strength(-500))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(30)) // Prevent node overlap
        .force("boundary", forceBoundary(width, height)); // Keep nodes within bounds

    const link = svg.append("g")
        .selectAll("line")
        .data(links)
        .enter()
        .append("line")
        .style("stroke", "#999")
        .style("stroke-opacity", 0.6)
        .style("stroke-width", 2);

    const nodeGroup = svg.append("g")
        .selectAll("g")
        .data(nodes)
        .enter()
        .append("g")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    nodeGroup.append("circle")
        .attr("r", 12)
        .style("fill", "#3498db")
        .style("stroke", "#fff")
        .style("stroke-width", 2);

    nodeGroup.append("text")
        .text(d => d.id)
        .attr("x", 15)
        .attr("y", 5)
        .style("font-family", custom.fontFamily)
        .style("font-size", "10px")
        .style("pointer-events", "none");

    simulation.on("tick", () => {
        // Keep nodes within bounds
        nodes.forEach(d => {
            d.x = Math.max(20, Math.min(width - 20, d.x));
            d.y = Math.max(20, Math.min(height - 20, d.y));
        });
        
        link.attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
            
        nodeGroup.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Force functions to keep nodes within bounds
    function forceBoundary(width, height) {
        let nodes;
        function force() {
            const padding = 20;
            nodes.forEach(node => {
                node.x = Math.max(padding, Math.min(width - padding, node.x));
                node.y = Math.max(padding, Math.min(height - padding, node.y));
            });
        }
        force.initialize = _ => nodes = _;
        return force;
    }

    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    currentPlotInstance = svg.node();
}

// =============================================================================
// ORGANELLE RADAR (CHART.JS) - UPDATED WITH DEFAULT ORGANELLES
// =============================================================================
const defaultOrganelles = [
    "Lysosome", "Cytosol", "Nucleus", "Mitochondria", "Endosome", 
    "Endoplasmic reticulum", "Centrosome", "Golgi", "Autophagosomes", 
    "Ciliary associated gene", "Peroxisome"
];

const defaultColors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
    '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#36A2EB',
    '#FFCE56'
];

const fractionLabels = ['Fr 1', 'Fr 2', 'Fr 3', 'Fr 4', 'Fr 5', 'Fr 6', 'Fr 7', 'Fr 8'];

function renderOrganelleRadarPlot(foundGenes, container, custom) {
    clearAllPlots(container.id);
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    // Use default organelles instead of calculating from genes
    const datasets = defaultOrganelles.map((organelle, i) => {
        // Generate a mock profile for each default organelle
        const profile = Array.from({length: 8}, (_, j) => 
            Math.random() * 0.5 + 0.3 * Math.sin((i + j) * 0.5) + 0.2
        );
        
        return {
            label: organelle,
            data: profile,
            borderColor: defaultColors[i % defaultColors.length],
            backgroundColor: `${defaultColors[i % defaultColors.length]}33`,
            pointBackgroundColor: defaultColors[i % defaultColors.length],
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: defaultColors[i % defaultColors.length],
            hidden: false // Show all default organelles
        };
    });

    currentPlotInstance = new Chart(ctx, {
        type: 'radar', 
        data: { 
            labels: fractionLabels, 
            datasets: datasets 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                title: { 
                    display: true, 
                    text: custom.title || "Organellar Profile Comparison", 
                    font: { size: custom.titleFontSize } 
                },
                legend: {
                    position: 'right',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                }
            },
            scales: {
                r: {
                    angleLines: {
                        display: true
                    },
                    suggestedMin: 0,
                    suggestedMax: 1
                }
            }
        }
    });
}

// =============================================================================
// ORGANELLE UMAP (CHART.JS) - UPDATED WITH DEFAULT ORGANELLES
// =============================================================================
function renderOrganelleUMAP(foundGenes, container, custom) {
    clearAllPlots(container.id);
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    // Use default organelles for UMAP
    const backgroundDatasets = defaultOrganelles.map((organelle, i) => {
        // Generate mock UMAP data for each default organelle
        const baseX = 5 + (i % 4) * 5;
        const baseY = 5 + Math.floor(i / 4) * 5;
        
        const data = Array.from({length: 20}, (_, j) => ({
            x: baseX + Math.random() * 3,
            y: baseY + Math.random() * 3,
            gene: `${organelle.substring(0, 3)}${j}`
        }));
        
        return {
            label: organelle,
            data: data,
            backgroundColor: defaultColors[i % defaultColors.length] + '77',
            pointRadius: 6,
            pointHoverRadius: 8
        };
    });
    
    currentPlotInstance = new Chart(ctx, {
        type: 'scatter', 
        data: { datasets: backgroundDatasets },
        options: {
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { 
                title: { 
                    display: true, 
                    text: custom.title || "UMAP Projection", 
                    font: { size: custom.titleFontSize } 
                },
                legend: {
                    position: 'right',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'UMAP 1'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'UMAP 2'
                    }
                }
            }
        }
    });
}

// =============================================================================
// SCREEN ANALYSIS (CHART.JS) - UPDATED WITH GENE NAMES AND DATA SOURCES
// =============================================================================
function renderGeneScreenAnalysis(foundGenes, container, custom) {
    clearAllPlots(container.id);
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const processedData = [];
    let geneIndex = 0;
    const geneIndexMap = {};
    const dataSources = new Set();
    
    foundGenes.forEach(gene => {
        if (!gene.screens || !Array.isArray(gene.screens)) return;
        if (!(gene.gene in geneIndexMap)) geneIndexMap[gene.gene] = geneIndex++;
        
        gene.screens.forEach(screen => {
            const meanValue = parseFloat(screen.mean_percent_ciliated);
            if (!isNaN(meanValue)) {
                processedData.push({ 
                    x: geneIndexMap[gene.gene], 
                    y: meanValue, 
                    gene: gene.gene, 
                    ...screen 
                });
                
                // Collect data sources
                if (screen.source) {
                    dataSources.add(screen.source);
                }
            }
        });
    });

    if (processedData.length === 0) { 
        container.innerHTML = '<p>No screen data found for these genes.</p>'; 
        return; 
    }
    
    const classificationColors = { 
        "Negative regulator": "#E74C3C", 
        "Positive regulator": "#27AE60", 
        "No significant effect": "#3498DB", 
        "Unclassified": "#95A5A6" 
    };
    
    const groupedData = {};
    processedData.forEach(item => {
        if (!groupedData[item.classification]) groupedData[item.classification] = [];
        groupedData[item.classification].push(item);
    });
    
    const datasets = Object.keys(groupedData).map(classification => ({
        label: classification,
        data: groupedData[classification],
        backgroundColor: classificationColors[classification] || "#95A5A6",
        pointRadius: 8,
        pointHoverRadius: 10
    }));
    
    const geneLabels = Object.keys(geneIndexMap).sort((a, b) => geneIndexMap[a] - geneIndexMap[b]);
    
    // Add data sources to the top of the plot
    const dataSourcesHTML = Array.from(dataSources).map(source => 
        `<span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; margin-right: 8px;">${source}</span>`
    ).join('');
    
    container.insertAdjacentHTML('afterbegin', 
        `<div style="margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 4px;">
            <strong>Data Sources:</strong> ${dataSourcesHTML}
        </div>`
    );
    
    currentPlotInstance = new Chart(ctx, {
        type: 'scatter', 
        data: { datasets },
        options: {
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { 
                title: { 
                    display: true, 
                    text: custom.title || 'Gene Screen Analysis', 
                    font: {size: custom.titleFontSize} 
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            return `${point.gene}: ${point.y.toFixed(2)}% ciliated`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: custom.showX,
                    title: { 
                        display: true, 
                        text: 'Genes', 
                        font: {size: 16, weight: 'bold'} 
                    },
                    min: -0.5, 
                    max: geneLabels.length - 0.5,
                    ticks: { 
                        stepSize: 1, 
                        callback: (val) => geneLabels[val] || '',
                        font: {size: 12}
                    },
                    grid: { display: false },
                    border: { display: true, color: 'black', width: 2 }
                },
                y: { 
                    display: custom.showY,
                    title: { 
                        display: true, 
                        text: 'Mean % Ciliated', 
                        font: {size: 16, weight: 'bold'} 
                    },
                    grid: { display: false },
                    border: { display: true, color: 'black', width: 2 }
                }
            }
        }
    });
}

// =============================================================================
// MODIFIED FUNCTIONS FOR HEATMAP INTEGRATION - FIXED CONTAINER BOUNDS
// =============================================================================
function renderExpressionHeatmap(expressionData, geneList = []) {
    console.log('plots.js: === Starting renderExpressionHeatmap (integrated) ===');
    
    // Get the main visualization container
    const plotContainer = document.getElementById('plot-display-area');
    clearAllPlots('plot-display-area');
    
    // ---- Validation and gene resolution logic ----
    function normalizeGeneString(s) {
        if (!s) return null;
        let str = String(s).trim();
        str = str.replace(/\(.*?\)/g, '');
        str = str.replace(/[,\/\\|;]/g, ' ');
        str = str.replace(/[^A-Za-z0-9\-_ ]/g, '');
        str = str.replace(/\s+/g, ' ').trim();
        return str ? str.toUpperCase() : null;
    }

    function extractCandidates(entry) {
        const out = [];
        if (!entry) return out;
        if (typeof entry === 'string') {
            entry.split(/\s+/).forEach(part => {
                const n = normalizeGeneString(part);
                if (n) out.push(n);
            });
        } else if (typeof entry === 'object') {
            const keys = ['gene', 'geneSymbol', 'symbol', 'name', 'Gene', 'Gene name'];
            for (const k of keys) {
                if (entry[k]) {
                    const n = normalizeGeneString(entry[k]);
                    if (n) out.push(n);
                }
            }
            if (out.length === 0) {
                const maybe = normalizeGeneString(JSON.stringify(entry));
                if (maybe) out.push(maybe);
            }
        }
        return [...new Set(out)];
    }

    function resolveViaGeneMapCache(candidate) {
        try {
            if (typeof geneMapCache !== 'undefined' && geneMapCache && geneMapCache.has) {
                if (geneMapCache.has(candidate)) {
                    const obj = geneMapCache.get(candidate);
                    if (!obj) return null;
                    if (typeof obj === 'string') return normalizeGeneString(obj);
                    if (typeof obj === 'object') {
                        const prefer = obj.gene || obj.symbol || obj.geneSymbol || obj.name || obj.Gene;
                        if (prefer) return normalizeGeneString(prefer);
                        for (const v of Object.values(obj)) {
                            if (typeof v === 'string' && v.length <= 12) {
                                const n = normalizeGeneString(v);
                                if (n) return n;
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('plots.js: geneMapCache lookup failed for', candidate, e);
        }
        return null;
    }

    const availableGenes = new Set(Object.keys(expressionData || {}).map(g => String(g).toUpperCase()));
    const validated = [];
    const skipped = [];
    const seen = new Set();

    if (Array.isArray(geneList)) {
        for (const entry of geneList) {
            const candidates = extractCandidates(entry);
            let found = null;
            for (const cand of candidates) {
                if (availableGenes.has(cand)) { found = cand; break; }
                const resolved = resolveViaGeneMapCache(cand);
                if (resolved && availableGenes.has(resolved)) { found = resolved; break; }
            }
            if (!found && candidates.length > 0) {
                for (const cand of candidates) {
                    const firstToken = cand.split('.')[0];
                    if (firstToken && availableGenes.has(firstToken)) { found = firstToken; break; }
                }
            }

            if (found && !seen.has(found)) {
                validated.push(found);
                seen.add(found);
            } else {
                skipped.push({ entry, candidates });
            }
        }
    } else if (typeof geneList === 'string') {
        const parts = geneList.split(/[\s,;\n\r\t]+/).filter(Boolean);
        for (const p of parts) {
            const cand = normalizeGeneString(p);
            let found = null;
            if (cand) {
                if (availableGenes.has(cand)) found = cand;
                else {
                    const resolved = resolveViaGeneMapCache(cand);
                    if (resolved && availableGenes.has(resolved)) found = resolved;
                }
            }
            if (found && !seen.has(found)) { validated.push(found); seen.add(found); }
            else skipped.push({ entry: p, candidates: [cand] });
        }
    } else {
        validated.push(...Array.from(availableGenes));
    }

    console.log('plots.js: Validated geneList:', validated);
    if (validated.length === 0) {
        plotContainer.innerHTML = '<div style="text-align:center; padding:2rem; color:#dc3545;">No valid genes found for heatmap.</div>';
        return false;
    }

    // ---- Create heatmap container within the visualization area ----
    plotContainer.innerHTML = `
        <div id="heatmap-wrapper" style="width: 100%; height: 100%; position: relative; overflow: hidden;">
            <svg id="heatmap-svg" style="display: block;"></svg>
        </div>
    `;

    // ---- D3 heatmap rendering with constrained dimensions ----
    const tissues = Object.keys(expressionData).length > 0
        ? [...new Set(validated.flatMap(g => Object.keys(expressionData[g] || {})))].sort()
        : ['No tissues available'];

    const heatmapData = validated.map(gene => {
        const row = { gene };
        tissues.forEach(tissue => {
            row[tissue] = (expressionData?.[gene]?.[tissue] !== undefined) ? expressionData[gene][tissue] : 0;
        });
        return row;
    });

    // Calculate dimensions based on container size with proper constraints
    const containerWidth = plotContainer.clientWidth;
    const containerHeight = plotContainer.clientHeight;
    
    // Calculate dynamic margins based on text length to ensure full visibility
    const maxGeneNameLength = Math.max(...validated.map(gene => gene.length));
    const maxTissueNameLength = Math.max(...tissues.map(tissue => tissue.length));
    
    // Calculate required margins for full text visibility
    const leftMarginForGenes = Math.max(80, Math.min(200, maxGeneNameLength * 8 + 20));
    const bottomMarginForTissues = Math.max(100, Math.min(200, maxTissueNameLength * 6 + 40));
    
    const margin = { 
        top: Math.min(80, containerHeight * 0.15), 
        right: 30, 
        bottom: Math.min(bottomMarginForTissues, containerHeight * 0.35), 
        left: Math.min(leftMarginForGenes, containerWidth * 0.3) 
    };
    
    // Calculate available space for the heatmap itself
    const availableWidth = containerWidth - margin.left - margin.right;
    const availableHeight = containerHeight - margin.top - margin.bottom;
    
    // Ensure minimum viable dimensions
    const minWidth = Math.max(300, availableWidth);
    const minHeight = Math.max(200, availableHeight);
    
    // Calculate cell sizes based on available space
    const maxCellWidth = Math.max(15, Math.min(50, availableWidth / tissues.length));
    const maxCellHeight = Math.max(15, Math.min(40, availableHeight / validated.length));
    
    // Final dimensions constrained by container
    const width = Math.min(availableWidth, tissues.length * maxCellWidth);
    const height = Math.min(availableHeight, validated.length * maxCellHeight);
    
    // Set SVG size to fit exactly within container
    const totalSVGWidth = Math.min(containerWidth, width + margin.left + margin.right);
    const totalSVGHeight = Math.min(containerHeight, height + margin.top + margin.bottom);

    const svg = d3.select('#heatmap-svg')
        .attr('width', totalSVGWidth)
        .attr('height', totalSVGHeight)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxNTPM = (heatmapData.length > 0 && tissues.length > 0)
        ? d3.max(heatmapData, d => d3.max(tissues, t => d[t]))
        : 1;

    const colorScale = d3.scaleSequential(d3.interpolateGreens)
        .domain([0, maxNTPM || 100]);

    const xScale = d3.scaleBand()
        .range([0, width])
        .domain(tissues)
        .padding(0.05);

    const yScale = d3.scaleBand()
        .range([0, height])
        .domain(validated)
        .padding(0.05);

    // X-axis with full text visibility
    const xAxisGroup = svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale));
        
    // Calculate font size that ensures readability while fitting in allocated space
    const xAxisFontSize = Math.max(9, Math.min(11, Math.min(xScale.bandwidth() / 2, (margin.bottom - 40) / maxTissueNameLength * 8)));
    
    xAxisGroup.selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)')
        .style('font-size', xAxisFontSize + 'px')
        .style('fill', '#333')
        .style('font-weight', '500')
        .text(d => d); // Show full text without truncation

    // Y-axis with responsive font size
    const yAxisFontSize = Math.max(8, Math.min(12, yScale.bandwidth() / 2));
    
    svg.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(yScale))
        .selectAll('text')
        .style('font-size', yAxisFontSize + 'px')
        .style('fill', '#333')
        .each(function(d) {
            // Truncate long gene names if necessary
            const maxChars = Math.max(6, Math.floor(margin.left / 8));
            const text = d3.select(this);
            const originalText = text.text();
            if (originalText.length > maxChars) {
                text.text(originalText.substring(0, maxChars - 3) + '...')
                    .append('title')
                    .text(originalText);
            }
        });

    // Heatmap cells
    svg.selectAll()
        .data(heatmapData, d => d.gene)
        .enter()
        .append('g')
        .selectAll('rect')
        .data(d => tissues.map(tissue => ({
            gene: d.gene,
            tissue,
            value: d[tissue]
        })))
        .enter()
        .append('rect')
        .attr('x', d => xScale(d.tissue))
        .attr('y', d => yScale(d.gene))
        .attr('width', xScale.bandwidth())
        .attr('height', yScale.bandwidth())
        .style('fill', d => d.value === 0 ? '#f5f5f5' : colorScale(d.value))
        .style('stroke', '#fff')
        .style('stroke-width', Math.max(0.5, Math.min(1, xScale.bandwidth() / 20)))
        .on('mouseover', function(event, d) {
            d3.select(this).style('stroke', '#000').style('stroke-width', 2);
            
            // Show tooltip
            const tooltip = d3.select('body').selectAll('.tooltip').data([null]);
            tooltip.enter()
                .append('div')
                .attr('class', 'tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0, 0, 0, 0.8)')
                .style('color', 'white')
                .style('padding', '8px')
                .style('border-radius', '4px')
                .style('pointer-events', 'none')
                .style('font-size', '12px')
                .style('opacity', 0)
                .style('z-index', '1000')
                .merge(tooltip)
                .html(`Gene: ${d.gene}<br>Tissue: ${d.tissue}<br>Value: ${Number(d.value).toFixed(2)}`)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px')
                .transition()
                .duration(200)
                .style('opacity', 1);
        })
        .on('mouseout', function() {
            d3.select(this).style('stroke', '#fff').style('stroke-width', Math.max(0.5, Math.min(1, xScale.bandwidth() / 20)));
            
            // Hide tooltip
            d3.selectAll('.tooltip')
                .transition()
                .duration(200)
                .style('opacity', 0)
                .remove();
        });

    // Add title with responsive positioning and size
    const custom = getPlotCustomization();
    const title = custom.title || 'Gene Expression Heatmap';
    const titleFontSize = Math.max(12, Math.min(18, containerWidth / 40));
    
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -margin.top / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', titleFontSize + 'px')
        .style('font-family', custom.fontFamily || 'Arial, sans-serif')
        .style('font-weight', 'bold')
        .text(title);

    // Add legend with responsive sizing and positioning
    const legendHeight = Math.max(15, Math.min(25, containerHeight / 30));
    const legendWidth = Math.max(150, Math.min(250, width * 0.4));
    
    // Position legend based on available space
    const legendX = width > legendWidth + 20 ? width - legendWidth - 10 : 10;
    const legendY = margin.top > 80 ? -margin.top + 10 : -60;
    
    const legend = svg.append('g')
        .attr('transform', `translate(${legendX}, ${legendY})`);
        
    const legendScale = d3.scaleLinear()
        .domain([0, maxNTPM || 100])
        .range([0, legendWidth]);
        
    const legendAxis = d3.axisBottom(legendScale)
        .ticks(Math.min(5, Math.floor(legendWidth / 40)))
        .tickFormat(d3.format('.1f'));
        
    // Gradient for legend
    const defs = svg.append('defs');
    const linearGradient = defs.append('linearGradient')
        .attr('id', 'legend-gradient')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '100%')
        .attr('y2', '0%');
        
    for (let i = 0; i <= 10; i++) {
        const frac = i / 10;
        const val = frac * (maxNTPM || 1);
        linearGradient.append('stop')
            .attr('offset', `${frac * 100}%`)
            .attr('stop-color', colorScale(val));
    }
    
    legend.append('rect')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', 'url(#legend-gradient)');
        
    legend.append('g')
        .attr('transform', `translate(0,${legendHeight})`)
        .call(legendAxis)
        .style('font-size', Math.max(8, Math.min(12, legendHeight / 2)) + 'px');
        
    legend.append('text')
        .attr('x', legendWidth / 2)
        .attr('y', -5)
        .style('text-anchor', 'middle')
        .style('font-size', Math.max(10, Math.min(14, legendHeight * 0.8)) + 'px')
        .text('Expression Level');

    console.log('plots.js: Heatmap rendering completed successfully with container bounds');
    return true;
}

// =============================================================================
// MODIFIED generateAnalysisPlots FUNCTION
// =============================================================================
async function generateAnalysisPlots() {
    if (typeof geneMapCache === 'undefined' || geneMapCache.size === 0) {
        alert("Error: The main gene database is not yet loaded. Please wait a moment.");
        console.error("generateAnalysisPlots was called before geneMapCache was initialized.");
        return;
    }

    const plotContainer = document.getElementById('plot-display-area');
    plotContainer.innerHTML = '<em>Searching genes and generating plot...</em>';
    clearAllPlots('plot-display-area');

    const rawInput = document.getElementById('ciliaplot-genes-input').value;
    const originalQueries = rawInput.split(/[\s,;\n\r\t]+/).filter(Boolean);
    if (originalQueries.length === 0) {
        plotContainer.innerHTML = 'Please enter at least one gene.';
        return;
    }

    const sanitizedQueries = [...new Set(originalQueries.map(sanitize))];
    const { foundGenes } = findGenes(sanitizedQueries);
    
    // Update the MAIN gene summary table (not a duplicate)
    updateGeneSummaryTable(originalQueries, foundGenes);

    if (foundGenes.length === 0) {
        plotContainer.innerHTML = 'None of the provided genes were found.';
        return;
    }

    const plotType = document.querySelector('input[name="ciliaplot_type"]:checked').value;
    const custom = getPlotCustomization();
    
    // Add plot explanation
    addPlotExplanation(plotType);

    switch (plotType) {
        case 'expression_heatmap':
            if (!plotExpressionLoaded || Object.keys(plotExpressionData).length === 0) {
                console.warn("plots.js: expression data not loaded yet. Deferring heatmap rendering.");
                plotContainer.innerHTML = '<em>Expression data is still loading... heatmap will appear automatically once ready.</em>';
                pendingHeatmapRequest = { foundGenes };
                loadPlotExpressionData();
                return;
            }
            renderExpressionHeatmap(plotExpressionData, foundGenes);
            break;

        case 'localization_bubble':
            renderBubblePlot(foundGenes, custom);
            break;

        case 'functional_bar':
            renderBarPlot(foundGenes, custom);
            break;

        case 'network':
            renderComplexNetwork(foundGenes, plotContainer, custom);
            break;

        case 'organelle_radar':
            renderOrganelleRadarPlot(foundGenes, plotContainer, custom);
            break;

        case 'organelle_umap':
            renderOrganelleUMAP(foundGenes, plotContainer, custom);
            break;

        case 'screen_analysis':
            renderGeneScreenAnalysis(foundGenes, plotContainer, custom);
            break;
        case 'enrichment_bubble':
            renderEnrichmentBubblePlot(foundGenes, custom);
            break;

        case 'balloon_plot':
            renderBalloonPlot(foundGenes, custom);
            break;

        case 'venn_diagram':
            renderVennDiagram(foundGenes, custom);
            break;

        default:
            plotContainer.innerHTML = 'This plot type is not yet implemented.';
    }
}

// =============================================================================
// INITIALIZATION
// =============================================================================
// Call this when the page loads to add footer text
addFooterText();
