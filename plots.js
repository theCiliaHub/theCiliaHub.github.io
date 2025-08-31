/**
 * ===================================================================
 * SECTION 1: CILIOME ANALYSIS (Formerly Enrichment)
 * - Visualization of gene localization within cellular compartments.
 * ===================================================================
 */

// --- Main function to generate Ciliome plots ---
function generateCiliomePlots() {
    // Hide previous plots and results
    ['ciliome-bubble-container', 'ciliome-matrix-container', 'ciliome-table-container'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    document.getElementById('download-ciliome-plot-btn').style.display = 'none';
    document.getElementById('download-ciliome-table-btn').style.display = 'none';

    const statusDiv = document.getElementById('ciliome-status');
    if (statusDiv) statusDiv.style.display = 'none';

    // Get and process gene list from textarea or file upload
    const input = document.getElementById('ciliome-genes-input').value || '';
    const geneNames = input.split(/[\s,;\n]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
    if (geneNames.length === 0) return;

    // Assumes a global findGenes() function exists
    const { foundGenes, notFoundGenes } = findGenes(geneNames); 
    if (foundGenes.length === 0) {
        if (statusDiv) {
            statusDiv.innerHTML = `<span class="error-message">None of the entered genes were found. Not found: ${notFoundGenes.join(', ')}</span>`;
            statusDiv.style.display = 'block';
        }
        return;
    }

    // Display the plot container and render the selected plot
    document.getElementById('ciliome-plot-container').style.display = 'block';
    const selectedPlot = document.querySelector('input[name="ciliome-plot-type"]:checked').value;

    if (selectedPlot === 'bubble') {
        renderCiliomeBubblePlot(foundGenes);
    } else if (selectedPlot === 'matrix') {
        renderCiliomeMatrix(foundGenes);
    }
    
    // Display the results table and download buttons
    renderCiliomeTable(foundGenes);
    document.getElementById('download-ciliome-plot-btn').style.display = 'inline-block';
    document.getElementById('download-ciliome-table-btn').style.display = 'inline-block';
}

// --- Renders the Ciliome Bubble Plot ---
function renderCiliomeBubblePlot(foundGenes) {
    document.getElementById('ciliome-bubble-container').style.display = 'flex';
    if (window.ciliomeDotPlotInstance) window.ciliomeDotPlotInstance.destroy();

    const settings = getPlotSettings();
    const yCategories = ['Cilia', 'Basal Body', 'Transition Zone', 'Axoneme', 'Ciliary Membrane', 'Lysosome', 'Peroxisome', 'Plasma Membrane', 'Cytoplasm', 'Nucleus', 'Endoplasmic Reticulum', 'Mitochondria', 'Ribosome', 'Golgi'];
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
    const colorPalette = settings.enrichmentColors;
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

    const legendContainer = document.getElementById('ciliome-legend-container');
    if (legendContainer) {
        const midCount = Math.ceil(maxCount / 2);
        const sizeLegendHTML = `
            <div style="font-family: ${settings.fontFamily}; color: ${settings.textColor};">
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
    
    const ctx = document.getElementById('ciliome-bubble-plot').getContext('2d');
    window.ciliomeDotPlotInstance = new Chart(ctx, {
        type: 'bubble', 
        data: { datasets: [dataset] },
        options: {
            responsive: true, 
            maintainAspectRatio: false,
            layout: { padding: { left: 0, right: 10, top: 20, bottom: 20 } },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => `${c.raw.y}: ${c.raw.count} gene(s)` } }
            },
            scales: {
                x: { 
                    display: true,
                    title: {
                        display: true,
                        text: 'Enrichment',
                        color: settings.axisColor,
                        font: { family: settings.fontFamily, size: settings.fontSize, weight: settings.fontWeight }
                    },
                    ticks: { display: false },
                    grid: { display: false }
                },
                y: {
                    type: 'category', 
                    labels: categoriesWithData,
                    title: {
                        display: true,
                        text: settings.yAxisTitle,
                        color: settings.axisColor,
                        font: { family: settings.fontFamily, size: settings.fontSize, weight: settings.fontWeight }
                    },
                    grid: { display: false, drawBorder: false },
                    ticks: { 
                        font: { size: settings.fontSize, weight: settings.fontWeight, family: settings.fontFamily },
                        color: settings.textColor,
                        padding: 2
                    },
                    offset: false,
                    position: 'left'
                }
            }
        }
    });
}

// --- Renders the Ciliome Matrix Plot ---
function renderCiliomeMatrix(foundGenes) {
    document.getElementById('ciliome-matrix-container').style.display = 'block';
    if (window.ciliomeBarChartInstance) window.ciliomeBarChartInstance.destroy();

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

    const ctx = document.getElementById('ciliome-matrix-plot').getContext('2d');
    window.ciliomeBarChartInstance = new Chart(ctx, {
        type: 'bubble', 
        data: { datasets },
        options: {
            responsive: true, 
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    display: true, 
                    position: 'right', 
                    labels: { 
                        font: { family: settings.fontFamily, size: settings.fontSize },
                        color: settings.textColor
                    } 
                },
                tooltip: { callbacks: { label: (context) => `${context.dataset.label} - ${context.raw.y}` } },
            },
            scales: {
                x: {
                    type: 'category', 
                    labels: xLabels,
                    title: { 
                        display: true, 
                        text: 'Genes', 
                        font: { family: settings.fontFamily, size: 16, weight: 'bold' },
                        color: settings.axisColor
                    },
                    ticks: { 
                        font: { family: settings.fontFamily, size: settings.fontSize, weight: settings.fontWeight }, 
                        autoSkip: false, 
                        maxRotation: 90, 
                        minRotation: 45,
                        color: settings.textColor
                    },
                    grid: { display: false }
                },
                y: {
                    type: 'category', 
                    labels: yCategories,
                    title: { 
                        display: true, 
                        text: 'Ciliary Localization', 
                        font: { family: settings.fontFamily, size: 16, weight: 'bold' },
                        color: settings.axisColor
                    },
                    ticks: { 
                        font: { family: settings.fontFamily, size: settings.fontSize, weight: settings.fontWeight },
                        color: settings.textColor
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

// --- Renders a downloadable table for Ciliome results ---
function renderCiliomeTable(foundGenes) {
    const container = document.getElementById('ciliome-table-container');
    container.dataset.ciliomeData = JSON.stringify(foundGenes); // Store data for download

    const tableHTML = `
        <table id="ciliome-results-table">
            <thead>
                <tr><th>Gene</th><th>Localization</th></tr>
            </thead>
            <tbody>
                ${foundGenes.map(g => `<tr><td>${g.gene}</td><td>${g.localization || 'N/A'}</td></tr>`).join('')}
            </tbody>
        </table>`;
    container.innerHTML = tableHTML;
    container.style.display = 'block';
}


/**
 * ===================================================================
 * SECTION 2: ENRICHMENT ANALYSIS (NEW)
 * - Calculates statistical enrichment of a gene list for ciliary genes.
 * ===================================================================
 */

// --- Main function to perform enrichment analysis ---
async function performEnrichmentAnalysis() {
    const resultsContainer = document.getElementById('enrichment-results-container');
    resultsContainer.innerHTML = 'Calculating...'; // Show loading state

    // These values should be constants for your application
    const CILIOME_SIZE = 2000; // M: Total number of ciliary genes in the database
    const GENOME_SIZE = 20000; // N: Total number of genes in the background set (e.g., human genome)

    const input = document.getElementById('enrichment-genes-input').value || '';
    const userGeneList = new Set(input.split(/[\s,;\n]+/).map(s => s.trim().toUpperCase()).filter(Boolean));
    const k = userGeneList.size; // k: Number of genes in the user's list

    if (k === 0) {
        resultsContainer.innerHTML = '';
        return;
    }

    // Assume `allGenes` is your global array of ciliary gene objects
    const ciliomeGeneSet = new Set(allGenes.map(g => g.gene.toUpperCase()));
    
    // Find the overlap
    const overlapGenes = [...userGeneList].filter(gene => ciliomeGeneSet.has(gene));
    const a = overlapGenes.length; // a: Number of ciliary genes in the user's list

    if (a === 0) {
        resultsContainer.innerHTML = '<p class="error-message">No known ciliary genes found in your list.</p>';
        return;
    }

    // Calculate Fold Enrichment and p-value
    const foldEnrichment = (a / k) / (CILIOME_SIZE / GENOME_SIZE);
    const pValue = hypergeometricTest(a, k, CILIOME_SIZE, GENOME_SIZE);

    // Prepare data for display and download
    const enrichmentData = {
        stats: [
            { parameter: 'Genes in your list (k)', value: k },
            { parameter: 'Ciliary genes in your list (a)', value: a },
            { parameter: 'Fold Enrichment', value: foldEnrichment.toFixed(2) },
            { parameter: 'p-value', value: pValue.toExponential(3) }
        ],
        genes: overlapGenes.map(gene => ({ gene }))
    };

    resultsContainer.dataset.enrichmentData = JSON.stringify(enrichmentData); // Store data for download
    
    // Display results in a table
    resultsContainer.innerHTML = `
        <h3>Enrichment Results</h3>
        <table id="enrichment-stats-table">
            <tbody>
                ${enrichmentData.stats.map(row => `<tr><td>${row.parameter}</td><td>${row.value}</td></tr>`).join('')}
            </tbody>
        </table>
        <h4>Overlapping Ciliary Genes (${a})</h4>
        <div class="gene-list-box">
            ${overlapGenes.join(', ')}
        </div>
        <button id="download-enrichment-table-btn" class="btn btn-secondary" onclick="downloadEnrichmentData()">Download Results</button>
    `;
}

// --- Hypergeometric Test Calculation ---
function hypergeometricTest(a, k, M, N) {
    let pValue = 0;
    // Sum probabilities from a to min(k, M)
    for (let i = a; i <= Math.min(k, M); i++) {
        const logProb = logCombinations(M, i) + logCombinations(N - M, k - i) - logCombinations(N, k);
        pValue += Math.exp(logProb);
    }
    return pValue;
}

// Helper functions for hypergeometric test to avoid large number overflow
function logFactorial(n) {
    if (n < 0) return NaN;
    if (n === 0 || n === 1) return 0;
    let result = 0;
    for (let i = 2; i <= n; i++) {
        result += Math.log(i);
    }
    return result;
}

function logCombinations(n, k) {
    if (k < 0 || k > n) return -Infinity; // log(0)
    return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}


/**
 * ===================================================================
 * SECTION 3: UTILITY FUNCTIONS (UPLOAD, DOWNLOAD, SETTINGS)
 * ===================================================================
 */

// --- NEW: Handles file upload for a given textarea ---
function handleFileUpload(event, targetTextareaId) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        document.getElementById(targetTextareaId).value = content;
    };
    reader.readAsText(file);
}
 
// --- NEW: Generic function to export data to CSV ---
function exportDataToCSV(data, filename) {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','), // Header row
        ...data.map(row => 
            headers.map(header => {
                let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
                cell = cell.includes(',') ? `"${cell}"` : cell; // Escape commas
                return cell;
            }).join(',')
        )
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- NEW: Download wrapper for Ciliome table ---
function downloadCiliomeData() {
    const dataString = document.getElementById('ciliome-table-container').dataset.ciliomeData;
    if (dataString) {
        const data = JSON.parse(dataString);
        exportDataToCSV(data, 'ciliome_analysis_results.csv');
    }
}

// --- NEW: Download wrapper for Enrichment results ---
function downloadEnrichmentData() {
    const dataString = document.getElementById('enrichment-results-container').dataset.enrichmentData;
    if(dataString) {
        const data = JSON.parse(dataString);
        // Combine stats and genes into one CSV for convenience
        const combinedData = [
            ...data.stats,
            { parameter: '', value: '' }, // Spacer row
            { parameter: 'Overlapping Genes', value: '' },
            ...data.genes.map(g => ({ parameter: g.gene, value: ''}))
        ];
        exportDataToCSV(combinedData, 'enrichment_analysis_results.csv');
    }
}

// --- Downloads the visible plot ---
function downloadPlot() {
    const selectedPlot = document.querySelector('input[name="ciliome-plot-type"]:checked').value;
    const format = document.getElementById('download-format')?.value || 'png';
    let fileName;
    let container;

    if (selectedPlot === 'bubble') {
        fileName = 'CiliaHub_Ciliome_Plot';
        container = document.getElementById('ciliome-bubble-container');
    } else if (selectedPlot === 'matrix') {
        fileName = 'CiliaHub_Matrix_Plot';
        container = window.ciliomeBarChartInstance.canvas;
    } else {
        return; // No other plot types
    }

    html2canvas(container, { backgroundColor: 'white', scale: 2 }).then(canvas => {
        if (format === 'png') {
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png');
            a.download = `${fileName}.png`;
            a.click();
        } else if (format === 'pdf') {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: canvas.width > canvas.height ? 'l' : 'p',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`${fileName}.pdf`);
        }
    }).catch(error => {
        console.error('Error downloading plot:', error);
        alert('Failed to download the plot.');
    });
}


// --- Gets plot settings from the UI (UNCHANGED) ---
function getPlotSettings() {
    return {
        fontFamily: document.getElementById('setting-font-family')?.value || 'Arial',
        fontSize: parseInt(document.getElementById('setting-font-size')?.value, 10) || 12,
        fontWeight: document.getElementById('setting-font-weight')?.value || 'bold',
        textColor: document.getElementById('setting-text-color')?.value || '#000000',
        axisColor: document.getElementById('setting-axis-color')?.value || '#000000',
        yAxisTitle: document.getElementById('setting-y-axis-title')?.value || 'Localization',
        enrichmentColors: [
            document.getElementById('setting-enrichment-color1')?.value || '#edf8fb',
            document.getElementById('setting-enrichment-color2')?.value || '#b2e2e2',
            document.getElementById('setting-enrichment-color3')?.value || '#66c2a4',
            document.getElementById('setting-enrichment-color4')?.value || '#2ca25f',
            document.getElementById('setting-enrichment-color5')?.value || '#006d2c'
        ]
    };
}
