function getPlotSettings() {
    return {
        fontFamily: document.getElementById('setting-font-family')?.value || 'Arial',
        fontSize: parseInt(document.getElementById('setting-font-size')?.value, 10) || 20,
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

// --- ADDED: Helper functions for Hypergeometric Test ---
function logGamma(x) {
    let tmp = (x - 0.5) * Math.log(x + 4.5) - (x + 4.5);
    let ser = 1.0 + 76.18009173 / (x + 0) - 86.50532033 / (x + 1) + 24.01409822 / (x + 2) - 1.231739516 / (x + 3) + 0.00120858003 / (x + 4) - 0.00000536382 / (x + 5);
    return tmp + Math.log(ser * Math.sqrt(2 * Math.PI));
}

function logCombination(n, k) {
    if (k < 0 || k > n) return -Infinity;
    return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

function hypergeometricPValue(k, n, M, N) {
    let p = 0;
    // Calculate P(X >= k) by summing probabilities from k to min(n, M)
    for (let i = k; i <= n && i <= M; i++) {
        let logP = logCombination(M, i) + logCombination(N - M, n - i) - logCombination(N, n);
        p += Math.exp(logP);
    }
    return p;
}
// --- END: Helper functions ---

// RENAMED FUNCTION: generateAnalysisPlots() → generateEnrichmentPlots()
function generateEnrichmentPlots() {
    // MODIFIED: Added 'ciliome-plot-container' and removed 'upset-plot-container'
    ['bubble-enrichment-container', 'matrix-plot-container', 'ciliome-plot-container'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });
    document.getElementById('download-plot-btn').style.display = 'none';
    
    const statusDiv = document.getElementById('enrichment-status');
    if (statusDiv) statusDiv.style.display = 'none';

    const input = document.getElementById('enrichment-genes-input').value || '';
    const geneNames = input.split(/[\s,;\n]+/).map(sanitize).filter(Boolean);
    if (geneNames.length === 0) return;

    const { foundGenes, notFoundGenes } = findGenes(geneNames);
    // The new Ciliome plot can still run if no genes are found to show a non-significant result
    const selectedPlot = document.querySelector('input[name="plot-type"]:checked').value;

    if (selectedPlot !== 'ciliome' && foundGenes.length === 0) {
        if(statusDiv) {
            statusDiv.innerHTML = `<span class="error-message">None of the entered genes were found. Not found: ${notFoundGenes.join(', ')}</span>`;
            statusDiv.style.display = 'block';
        }
        return;
    }
    
    document.getElementById('plot-container').style.display = 'block';
    
    // MODIFIED: Replaced 'upset' with 'ciliome'
    if (selectedPlot === 'bubble') {
        renderEnrichmentBubblePlot(foundGenes);
    } else if (selectedPlot === 'matrix') {
        renderBubbleMatrix(foundGenes);
    } else if (selectedPlot === 'ciliome') {
        renderCiliomeEnrichment(foundGenes, notFoundGenes);
    }
    
    document.getElementById('download-plot-btn').style.display = 'inline-block';
}

function renderEnrichmentBubblePlot(foundGenes) {
    document.getElementById('bubble-enrichment-container').style.display = 'flex';
    
    // UPDATED VARIABLE NAME: analysisDotPlotInstance → enrichmentDotPlotInstance
    if (window.enrichmentDotPlotInstance) window.enrichmentDotPlotInstance.destroy();
    
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
    if (categoriesWithData.length === 0) { return; }

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
    
    const legendContainer = document.getElementById('legend-container');
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
    
    // UPDATED CANVAS ID: analysis-bubble-plot → enrichment-bubble-plot
    const ctx = document.getElementById('enrichment-bubble-plot').getContext('2d');
    
    // UPDATED VARIABLE NAME: analysisDotPlotInstance → enrichmentDotPlotInstance
    window.enrichmentDotPlotInstance = new Chart(ctx, {
        type: 'bubble', 
        data: { datasets: [dataset] },
        options: {
            responsive: true, 
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 0,
                    right: 10,
                    top: 20,
                    bottom: 20
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: { 
                    callbacks: { 
                        label: c => `${c.raw.y}: ${c.raw.count} gene(s)` 
                    } 
                }
            },
            scales: {
                x: { 
                    display: true,
                    title: {
                        display: true,
                        text: 'Enrichment',
                        color: settings.axisColor,
                        font: {
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: settings.fontWeight
                        }
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
                        font: {
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: settings.fontWeight
                        }
                    },
                    grid: { 
                        display: false, 
                        drawBorder: false 
                    },
                    ticks: { 
                        font: { 
                            size: settings.fontSize, 
                            weight: settings.fontWeight, 
                            family: settings.fontFamily 
                        },
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

function renderBubbleMatrix(foundGenes) {
    document.getElementById('matrix-plot-container').style.display = 'block';
    
    // UPDATED VARIABLE NAME: analysisBarChartInstance → enrichmentBarChartInstance
    if (window.enrichmentBarChartInstance) window.enrichmentBarChartInstance.destroy();

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

    // UPDATED CANVAS ID: analysis-matrix-plot → enrichment-matrix-plot
    const ctx = document.getElementById('enrichment-matrix-plot').getContext('2d');
    
    // UPDATED VARIABLE NAME: analysisBarChartInstance → enrichmentBarChartInstance
    window.enrichmentBarChartInstance = new Chart(ctx, {
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
                        font: { 
                            family: settings.fontFamily, 
                            size: settings.fontSize 
                        },
                        color: settings.textColor
                    } 
                },
                tooltip: { 
                    callbacks: { 
                        label: (context) => `${context.dataset.label} - ${context.raw.y}` 
                    } 
                },
            },
            scales: {
                x: {
                    type: 'category', 
                    labels: xLabels,
                    title: { 
                        display: true, 
                        text: 'Genes', 
                        font: { 
                            family: settings.fontFamily, 
                            size: 16, 
                            weight: 'bold' 
                        },
                        color: settings.axisColor
                    },
                    ticks: { 
                        font: { 
                            family: settings.fontFamily, 
                            size: settings.fontSize, 
                            weight: settings.fontWeight 
                        }, 
                        autoSkip: false, 
                        maxRotation: 90, 
                        minRotation: 45,
                        color: settings.textColor
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    type: 'category', 
                    labels: yCategories,
                    title: { 
                        display: true, 
                        text: 'Ciliary Localization', 
                        font: { 
                            family: settings.fontFamily, 
                            size: 16, 
                            weight: 'bold' 
                        },
                        color: settings.axisColor
                    },
                    ticks: { 
                        font: { 
                            family: settings.fontFamily, 
                            size: settings.fontSize, 
                            weight: settings.fontWeight 
                        },
                        color: settings.textColor
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// --- ADDED: New function to render Ciliome Enrichment plot ---
function renderCiliomeEnrichment(foundGenes, notFoundGenes) {
    document.getElementById('ciliome-plot-container').style.display = 'block';
    
    if (window.ciliomeChartInstance) {
        window.ciliomeChartInstance.destroy();
    }

    const k = foundGenes.length;
    const n_input = k + notFoundGenes.length;
    const M = window.allGenes ? window.allGenes.length : 2000;
    const N = 20000; // Assumed total human protein-coding genes

    if (n_input === 0) {
        document.getElementById('ciliome-plot-container').innerHTML = '<p class="status-message">Please enter a gene list to analyze.</p>';
        return;
    }

    const pValue = hypergeometricPValue(k, n_input, M, N);
    const enrichmentScore = n_input > 0 && M > 0 ? (k / n_input) / (M / N) : 0;

    const container = document.getElementById('ciliome-plot-container');
    container.innerHTML = `
        <div id="ciliome-results-summary" style="margin-bottom: 2rem; font-size: 1.1rem; max-width: 600px; margin-left: auto; margin-right: auto;">
            <h3>Enrichment Analysis Results</h3>
            <p>From your list of <strong>${n_input}</strong> unique gene(s), <strong>${k}</strong> were found in the CiliaHub database of <strong>${M}</strong> ciliary genes.</p>
            <p>The expected number of ciliary genes from a random list of this size (from a background of ${N} total genes) would be approximately <strong>${((M / N) * n_input).toFixed(2)}</strong>.</p>
            <div style="font-size: 1.2rem; margin-top: 1rem; padding: 10px; background-color: #f8f9fa; border-radius: 5px;">
                <p><strong>Enrichment Score:</strong> ${enrichmentScore.toFixed(2)}-fold</p>
                <p><strong>P-value (Hypergeometric Test):</strong> ${pValue.toExponential(3)}</p>
            </div>
        </div>
        <div style="position: relative; width: 300px; height: 300px; margin: auto;">
            <canvas id="ciliome-pie-chart"></canvas>
        </div>
    `;

    const ctx = document.getElementById('ciliome-pie-chart').getContext('2d');
    window.ciliomeChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Genes in Ciliome', 'Genes Not in Ciliome'],
            datasets: [{
                data: [k, n_input - k],
                backgroundColor: ['#2ca25f', '#cccccc'],
                borderColor: ['#ffffff', '#ffffff'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Composition of Your Gene List' }
            }
        }
    });
}


function downloadPlot() {
    const selectedPlot = document.querySelector('input[name="plot-type"]:checked').value;
    const format = document.getElementById('download-format')?.value || 'png';
    let fileName;

    if (selectedPlot === 'bubble') {
        // ... bubble download logic (unchanged) ...
    } else if (selectedPlot === 'matrix') {
        // ... matrix download logic (unchanged) ...
    // --- ADDED: Download logic for the new Ciliome plot ---
    } else if (selectedPlot === 'ciliome') {
        fileName = 'CiliaHub_Ciliome_Enrichment';
        const container = document.getElementById('ciliome-plot-container');
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
        });
    // --- REMOVED: Download logic for the Upset plot ---
    }
}
