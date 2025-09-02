// Add this script tag to your main HTML file before your plots.js script
// <script src="https://cdn.jsdelivr.net/npm/jstat@latest/dist/jstat.min.js"></script>

// Global variable for the active Chart.js instance
let currentChartInstance = null;

// --- Main Control Function ---

/**
 * Main function called by the "Generate Plot" button.
 * It reads the user's gene list and directs to the appropriate plotting function.
 */
function generateEnrichmentPlot() {
    const userInput = document.getElementById('enrichment-genes-input').value.trim();
    if (!userInput) {
        alert('Please provide a gene list to analyze.');
        return;
    }

    const userGeneList = userInput.toUpperCase().split(/[\s,;\n\r\t]+/).filter(Boolean);
    const plotType = document.querySelector('input[name="plot-type"]:checked').value;
    const plotSettings = getPlotSettings();

    // Find which of the user's genes are in the CiliaHub database
    const allCiliaHubGenes = new Set(window.allGenes.map(g => g.gene.toUpperCase()));
    const foundGenes = window.allGenes.filter(g => userGeneList.includes(g.gene.toUpperCase()));
    
    // Clear previous plots and show the main plot container
    destroyCurrentPlot();
    document.querySelectorAll('.plot-wrapper').forEach(el => el.style.display = 'none');
    document.getElementById('plot-container').style.display = 'block';
    document.getElementById('download-plot-btn').style.display = 'inline-block';

    // Route to the correct plotting function
    switch (plotType) {
        case 'functional':
            renderEnrichmentDotPlot(foundGenes, userGeneList.length, 'functional_category', 'Functional Category', plotSettings);
            break;
        case 'ciliopathy':
            renderEnrichmentDotPlot(foundGenes, userGeneList.length, 'ciliopathy', 'Ciliopathy', plotSettings);
            break;
        case 'heatmap':
            renderGeneCategoryHeatmap(foundGenes, plotSettings);
            break;
        case 'network':
            renderInteractionNetwork(foundGenes, plotSettings);
            break;
    }
    document.getElementById('plot-container').scrollIntoView({ behavior: 'smooth' });
}

// --- Statistical and Data Processing Functions ---

/**
 * Performs a hypergeometric test for a given category.
 * @param {string[]} userGenes - The list of genes found in the CiliaHub database.
 * @param {number} totalUserGenes - The total number of unique genes the user provided.
 * @param {string} category - The specific term to test (e.g., "Transition zone").
 * @param {string} field - The data field to check (e.g., 'functional_category').
 * @returns {object} An object with stats: k, n, M, N, pValue, foldEnrichment.
 */
function runHypergeometricTest(userGenes, totalUserGenes, category, field) {
    const N = window.allGenes.length; // Total genes in CiliaHub background
    const M = window.allGenes.filter(g => g[field] && g[field].includes(category)).length;
    const n = totalUserGenes;
    const k = userGenes.filter(g => g[field] && g[field].includes(category)).length;

    if (k === 0) {
        return { k, n, M, N, pValue: 1.0, foldEnrichment: 0 };
    }

    // p-value is the probability of getting k or more successes
    const pValue = 1 - jStat.hypgeom.cdf(k - 1, N, M, n);
    const foldEnrichment = (k / n) / (M / N);

    return { k, n, M, N, pValue, foldEnrichment };
}

// --- Plot Rendering Functions ---

/**
 * Renders a publication-quality Dot Plot for enrichment results.
 * Used for both Functional Category and Ciliopathy enrichment.
 */
function renderEnrichmentDotPlot(foundGenes, totalUserGenes, field, title, settings) {
    const container = document.getElementById('dot-plot-container');
    container.style.display = 'block';
    const canvas = document.getElementById('enrichment-dot-plot');

    const allTerms = new Set(window.allGenes.flatMap(g => g[field] || []));
    let enrichmentResults = [];

    allTerms.forEach(term => {
        if (!term) return;
        const result = runHypergeometricTest(foundGenes, totalUserGenes, term, field);
        if (result.k > 0) {
            enrichmentResults.push({ term, ...result });
        }
    });

    // Filter for significant results and sort
    const significantResults = enrichmentResults
        .filter(res => res.pValue < 0.05)
        .sort((a, b) => a.pValue - b.pValue)
        .slice(0, 20); // Show top 20 for clarity

    if (significantResults.length === 0) {
        container.innerHTML = `<p class="status-message">No significant enrichment found for the ${title.toLowerCase()} in your gene list.</p>`;
        return;
    }

    const maxGeneCount = Math.max(...significantResults.map(r => r.k));
    const data = {
        datasets: [{
            label: title,
            data: significantResults.map(res => ({
                x: res.foldEnrichment,
                y: res.term,
                r: 5 + 20 * (res.k / maxGeneCount), // Bubble size by gene count
                pValue: res.pValue,
                geneCount: res.k
            })),
            backgroundColor: significantResults.map(res => pValueToColor(res.pValue, settings.enrichmentColors))
        }]
    };

    currentChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bubble',
        data: data,
        options: { /* ... Chart options for dot plot ... */ } // Detailed options omitted for brevity
    });
}

/**
 * Renders an interactive Protein Interaction Network.
 */
function renderInteractionNetwork(foundGenes, settings) {
    const container = document.getElementById('network-container');
    container.style.display = 'block';
    // NOTE: This requires a dedicated library like Cytoscape.js.
    // This is a placeholder to show the concept.
    container.innerHTML = `
        <div class="status-message">
            <h4>Protein Interaction Network</h4>
            <p>Network visualization requires an external library like Cytoscape.js or D3.js, which is beyond the scope of this implementation.</p>
            <p><strong>Analysis Result:</strong> ${foundGenes.length} of your genes were found in the CiliaHub database and could be used to build an interaction network based on shared protein complexes.</p>
        </div>`;
}

/**
 * Renders a Gene-Category Heatmap.
 */
function renderGeneCategoryHeatmap(foundGenes, settings) {
    const container = document.getElementById('heatmap-container');
    container.style.display = 'block';
    const canvas = document.getElementById('enrichment-heatmap');
    
    // For simplicity, we'll use a bubble chart on a 2D categorical axis to simulate a heatmap
    const topCategories = getTopCategories(foundGenes, 'functional_category', 15);
    const geneLabels = foundGenes.map(g => g.gene);

    const data = [];
    foundGenes.forEach(gene => {
        topCategories.forEach(category => {
            if (gene.functional_category && gene.functional_category.includes(category)) {
                data.push({ x: category, y: gene.gene, r: 8 }); // Fixed size bubble for heatmap
            }
        });
    });

    currentChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Association',
                data: data,
                backgroundColor: settings.enrichmentColors[3]
            }]
        },
        options: {
            scales: {
                y: { type: 'category', labels: geneLabels, ticks: { autoSkip: false } },
                x: { type: 'category', labels: topCategories, ticks: { autoSkip: false, maxRotation: 90, minRotation: 45 } }
            }
             /* ... other Chart options for heatmap ... */
        }
    });
}

// --- Utility and Helper Functions ---

function destroyCurrentPlot() {
    if (currentChartInstance) {
        currentChartInstance.destroy();
        currentChartInstance = null;
    }
}

function getTopCategories(foundGenes, field, count) {
    const categoryCounts = {};
    foundGenes.forEach(gene => {
        (gene[field] || []).forEach(cat => {
            if (cat) categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
    });
    return Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map(entry => entry[0]);
}

function pValueToColor(pValue, colorScale) {
    const logP = -Math.log10(pValue);
    // Simple linear scale; can be made more sophisticated
    if (logP > 5) return colorScale[4];
    if (logP > 3) return colorScale[3];
    if (logP > 2) return colorScale[2];
    if (logP > 1.3) return colorScale[1];
    return colorScale[0];
}


function getPlotSettings() {
    // This function remains the same as provided by the user
    return {
        fontFamily: document.getElementById('setting-font-family')?.value || 'Arial',
        fontSize: parseInt(document.getElementById('setting-font-size')?.value, 10) || 12,
        fontWeight: document.getElementById('setting-font-weight')?.value || 'normal',
        textColor: document.getElementById('setting-text-color')?.value || '#000000',
        axisColor: document.getElementById('setting-axis-color')?.value || '#000000',
        enrichmentColors: [
            document.getElementById('setting-enrichment-color1')?.value || '#fee5d9',
            document.getElementById('setting-enrichment-color2')?.value || '#fcae91',
            document.getElementById('setting-enrichment-color3')?.value || '#fb6a4a',
            document.getElementById('setting-enrichment-color4')?.value || '#de2d26',
            document.getElementById('setting-enrichment-color5')?.value || '#a50f15'
        ]
    };
}

function downloadPlot() {
    // This function remains largely the same but needs to find the correct active canvas
    const plotType = document.querySelector('input[name="plot-type"]:checked').value;
    let canvasId = '';
    if (plotType === 'functional' || plotType === 'ciliopathy') canvasId = 'enrichment-dot-plot';
    if (plotType === 'heatmap') canvasId = 'enrichment-heatmap';

    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        alert('No active plot to download.');
        return;
    }
    
    const format = document.getElementById('download-format')?.value || 'png';
    const link = document.createElement('a');
    link.download = `CiliaHub_${plotType}_plot.${format}`;
    link.href = canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 1.0);
    link.click();
}
