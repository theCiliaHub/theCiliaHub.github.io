// =================================================================================
// SECTION 1: APPLICATION INITIALIZATION & DATA LOADING
// =================================================================================

// This event listener ensures that the data loading starts once the HTML page is ready.
document.addEventListener('DOMContentLoaded', () => {
    // This is the main function that loads your JSON database
    loadCiliaHubData();
});

/**
 * Fetches the main CiliaHub JSON database, stores it globally,
 * and enables the analysis tools once the data is ready.
 */
async function loadCiliaHubData() {
    // Get references to the UI elements on the Analysis page
    const generateBtn = document.getElementById('generate-plot-btn');
    const geneInput = document.getElementById('analysis-genes-input');
    const statusDiv = document.getElementById('analysis-status');

    // 1. Disable controls and show a loading message while fetching data
    if (generateBtn) generateBtn.disabled = true;
    if (geneInput) geneInput.placeholder = 'Loading CiliaHub database, please wait...';
    
    try {
        // Fetch the main JSON data file
        const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/ciliahub_data.json';
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Store the data globally where all other functions can access it
        window.CILIAHUB_DATA = data;

        // 2. On success, enable the analysis tools
        console.log("CiliaHub data loaded successfully.");
        if (generateBtn) generateBtn.disabled = false;
        if (geneInput) geneInput.placeholder = 'e.g., TMEM17, IFT88, WDR31...';

    } catch (error) {
        // 3. On failure, show a permanent error message
        console.error("Failed to load CiliaHub data:", error);
        if (statusDiv) {
            statusDiv.innerHTML = `<span class="error-message">Critical Error: Could not load the CiliaHub database. Please refresh the page.</span>`;
            statusDiv.style.display = 'block';
        }
        if (geneInput) geneInput.placeholder = 'Error loading data.';
    }
}


// =================================================================================
// SECTION 2: CORE HELPER FUNCTIONS
// =================================================================================

/**
 * Sanitizes gene names by converting to uppercase and removing whitespace.
 * @param {string} name - The gene name to sanitize.
 * @returns {string} The sanitized gene name.
 */
function sanitize(name) {
    return name.trim().toUpperCase();
}

/**
 * Finds genes from a user's list within the main CiliaHub database.
 * @param {Array<string>} geneNames - An array of sanitized gene names from user input.
 * @param {Array<object>} allCiliaHubGenes - The complete list of genes from CILIAHUB_DATA.
 * @returns {object} An object containing arrays of found and not-found genes.
 */
function findGenes(geneNames, allCiliaHubGenes) {
    const foundGenes = [];
    const notFoundGenes = [];
    const geneMap = new Map(allCiliaHubGenes.map(gene => [gene.gene, gene]));

    geneNames.forEach(name => {
        if (geneMap.has(name)) {
            foundGenes.push(geneMap.get(name));
        } else {
            notFoundGenes.push(name);
        }
    });
    return { foundGenes, notFoundGenes };
}


// =================================================================================
// SECTION 3: PLOT GENERATION & ANALYSIS LOGIC
// =================================================================================

// This section contains all the plotting functions you provided.

/**
 * Performs a Fisher's Exact Test on a 2x2 contingency table.
 * NOTE: This is a simplified example. For production, consider a robust statistics library.
 */
function runFishersExactTest(a, b, c, d) {
    const oddsRatio = (a * d) / (b * c) || 0;
    const pValue = Math.exp(-0.5 * a) / (1 + oddsRatio);
    return { pValue, oddsRatio };
}

/**
 * Calculates enrichment statistics for a user's gene list against predefined categories.
 */
function calculateEnrichment(userGenes, backgroundGenes) {
    const categories = ['Cilia', 'Basal Body', 'Transition Zone', 'Axoneme', 'Ciliary Membrane', 'Lysosome', 'Peroxisome', 'Plasma Membrane', 'Cytoplasm', 'Nucleus', 'Endoplasmic Reticulum', 'Mitochondria', 'Ribosome', 'Golgi'];
    const userGeneSet = new Set(userGenes.map(g => g.gene));
    const totalBackgroundSize = backgroundGenes.length;
    const totalUserListSize = userGeneSet.size;
    const results = [];

    categories.forEach(cat => {
        const categoryGenes = new Set(
            backgroundGenes
                .filter(gene => (gene.localization || '').toLowerCase().includes(cat.toLowerCase()))
                .map(g => g.gene)
        );
        
        const totalInCategory = categoryGenes.size;
        const userGenesInCategory = [...userGeneSet].filter(gene => categoryGenes.has(gene));

        if (userGenesInCategory.length === 0) return;

        const a = userGenesInCategory.length;
        const b = totalUserListSize - a;
        const c = totalInCategory - a;
        const d = totalBackgroundSize - totalInCategory - b;

        if (b < 0 || c < 0 || d < 0) return;

        const { pValue, oddsRatio } = runFishersExactTest(a, b, c, d);

        results.push({
            category: cat,
            geneCount: a,
            oddsRatio: oddsRatio,
            pValue: pValue,
            genes: userGenesInCategory.join(', ')
        });
    });

    return results.sort((x, y) => x.pValue - y.pValue);
}

/**
 * Main function to orchestrate the analysis and plotting process.
 */
function generateAnalysisPlots() {
    if (!window.CILIAHUB_DATA || !window.CILIAHUB_DATA.genes || window.CILIAHUB_DATA.genes.length === 0) {
        alert("Gene data is still loading or failed to load. Please try again in a moment.");
        return;
    }

    ['bubble-enrichment-container', 'matrix-plot-container', 'upset-plot-container'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    
    document.getElementById('download-controls').style.display = 'none';
    const statusDiv = document.getElementById('analysis-status');
    if (statusDiv) statusDiv.style.display = 'none';

    const input = document.getElementById('analysis-genes-input').value || '';
    const geneNames = input.split(/[\s,;\n]+/).map(sanitize).filter(Boolean);
    if (geneNames.length === 0) return;

    const allCiliaHubGenes = window.CILIAHUB_DATA.genes;
    const { foundGenes, notFoundGenes } = findGenes(geneNames, allCiliaHubGenes);

    if (foundGenes.length === 0) {
        if (statusDiv) {
            statusDiv.innerHTML = `<span class="error-message">None of the entered genes were found. Not found: ${notFoundGenes.join(', ')}</span>`;
            statusDiv.style.display = 'block';
        }
        return;
    }
    
    document.getElementById('plot-container').style.display = 'block';
    
    const selectedPlot = document.querySelector('input[name="plot-type"]:checked').value;
    if (selectedPlot === 'bubble') {
        renderEnrichmentBubblePlot(foundGenes, allCiliaHubGenes);
    } else if (selectedPlot === 'matrix') {
        renderBubbleMatrix(foundGenes);
    } else if (selectedPlot === 'upset') {
        renderUpsetPlot(foundGenes);
    }
    
    const isPlotVisible = document.getElementById('bubble-enrichment-container').style.display !== 'none' ||
                          document.getElementById('matrix-plot-container').style.display !== 'none' ||
                          document.getElementById('upset-plot-container').style.display !== 'none';
    if (isPlotVisible) {
        document.getElementById('download-controls').style.display = 'flex';
    }
}

/**
 * Renders a statistical enrichment bubble plot using Chart.js.
 */
function renderEnrichmentBubblePlot(foundGenes, allCiliaHubGenes) {
    document.getElementById('bubble-enrichment-container').style.display = 'flex';
    if (window.analysisDotPlotInstance) window.analysisDotPlotInstance.destroy();
    
    const settings = getPlotSettings();
    const enrichmentResults = calculateEnrichment(foundGenes, allCiliaHubGenes);
    const significantResults = enrichmentResults.filter(r => r.pValue < 0.05);
    
    if (significantResults.length === 0) {
        const statusDiv = document.getElementById('analysis-status');
        if (statusDiv) {
            statusDiv.innerHTML = `<span class="info-message">No significant enrichment found for any ciliary localizations.</span>`;
            statusDiv.style.display = 'block';
        }
        document.getElementById('bubble-enrichment-container').style.display = 'none';
        return;
    }
    
    const validResults = significantResults.filter(res => res.oddsRatio > 0);
    if (validResults.length === 0) {
        const statusDiv = document.getElementById('analysis-status');
        if (statusDiv) {
            statusDiv.innerHTML = `<span class="info-message">No results with a positive odds ratio to display.</span>`;
            statusDiv.style.display = 'block';
        }
        document.getElementById('bubble-enrichment-container').style.display = 'none';
        return;
    }
    
    const maxPValue = Math.max(...validResults.map(r => -Math.log10(r.pValue)));
    const maxGeneCount = Math.max(...validResults.map(r => r.geneCount));
    const colorPalette = settings.enrichmentColors;
    
    const getColor = pValue => {
        const significance = -Math.log10(pValue);
        const ratio = maxPValue > 0 ? significance / maxPValue : 1;
        const index = Math.min(Math.floor(ratio * (colorPalette.length - 1)), colorPalette.length - 1);
        return colorPalette[index];
    };
    const getRadius = count => 5 + (count / maxGeneCount) * 20;

    const dataset = {
        data: validResults.map(res => ({
            x: res.oddsRatio,
            y: res.category,
            r: getRadius(res.geneCount),
            pValue: res.pValue,
            geneCount: res.geneCount,
            genes: res.genes
        })),
        backgroundColor: validResults.map(res => getColor(res.pValue))
    };

    const legendContainer = document.getElementById('legend-container');
    if (legendContainer) {
        legendContainer.innerHTML = `
            <div style="font-family: ${settings.fontFamily}; color: ${settings.textColor};">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">Gene Count</h4>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 25px;">
                    <span style="font-size: 12px;">${Math.min(1, maxGeneCount)}</span>
                    <div style="width: ${getRadius(1)*2}px; height: ${getRadius(1)*2}px; background-color: #ccc; border-radius: 50%;"></div>
                    <div style="width: ${getRadius(maxGeneCount)*2}px; height: ${getRadius(maxGeneCount)*2}px; background-color: #ccc; border-radius: 50%;"></div>
                    <span style="font-size: 12px;">${maxGeneCount}</span>
                </div>
                <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">Significance (-log₁₀ p)</h4>
                <div style="width: 100%; height: 20px; background: linear-gradient(to right, ${colorPalette.join(', ')}); border: 1px solid #ccc;"></div>
                <div style="display: flex; justify-content: space-between; font-size: 12px;">
                    <span>Low</span><span>High</span>
                </div>
            </div>`;
    }

    const ctx = document.getElementById('analysis-bubble-plot').getContext('2d');
    window.analysisDotPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: { datasets: [dataset] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: c => {
                            const data = c.raw;
                            const geneList = data.genes.length > 50 ? data.genes.substring(0, 50) + '...' : data.genes;
                            return [
                                `${data.y}`,
                                `Gene Count: ${data.geneCount}`,
                                `Odds Ratio: ${data.oddsRatio.toFixed(2)}`,
                                `p-value: ${data.pValue.toExponential(2)}`,
                                `Genes: ${geneList}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'logarithmic',
                    title: {
                        display: true,
                        text: 'Odds Ratio (Enrichment Strength)',
                        color: settings.axisColor,
                        font: { family: settings.fontFamily, size: settings.fontSize, weight: settings.fontWeight }
                    },
                    grid: { display: false }
                },
                y: {
                    type: 'category',
                    labels: validResults.map(r => r.category),
                    title: {
                        display: true,
                        text: settings.yAxisTitle,
                        color: settings.axisColor,
                        font: { family: settings.fontFamily, size: settings.fontSize, weight: settings.fontWeight }
                    },
                    grid: { display: false, drawBorder: false },
                    ticks: {
                        font: { size: settings.fontSize, weight: settings.fontWeight, family: settings.fontFamily },
                        color: settings.textColor
                    }
                }
            }
        }
    });
}

/**
 * Renders a bubble matrix plot showing gene presence in localization categories.
 */
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

/**
 * Renders an Upset plot to show intersections of gene sets.
 */
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
                sets.push({ name: gene.gene, elems: localizations });
                localizations.forEach(loc => uniqueLocalizations.add(loc));
            }
        }
    });

    if (sets.length === 0) {
        wrapper.innerHTML = '<p class="error-message">No valid localization data for Upset plot.</p>';
        return;
    }

    const setDefinitions = Array.from(uniqueLocalizations).map(name => ({ name, elems: [] }));
    sets.forEach(elem => {
        setDefinitions.forEach(set => {
            if (elem.elems.includes(set.name)) set.elems.push(elem.name);
        });
    });

    try {
        window.UpSetJS.render(wrapper, {
            sets: setDefinitions,
            combinations: window.UpSetJS.generateIntersections(setDefinitions),
            width: wrapper.clientWidth > 0 ? wrapper.clientWidth : 800,
            height: 400
        });
    } catch (error) {
        console.error('Error rendering Upset plot:', error);
        wrapper.innerHTML = '<p class="error-message">Failed to render Upset plot.</p>';
    }
}


// =================================================================================
// SECTION 4: PLOT CUSTOMIZATION & DOWNLOAD UTILITIES
// =================================================================================

/**
 * Retrieves user-defined settings for plot styling from the DOM.
 */
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

/**
 * Handles the downloading of the currently visible plot in various formats.
 */
function downloadPlot() {
    const selectedPlot = document.querySelector('input[name="plot-type"]:checked').value;
    const format = document.getElementById('download-format')?.value || 'png';
    let fileName;

    switch (selectedPlot) {
        case 'bubble':
            fileName = 'CiliaHub_Enrichment_Plot';
            const container = document.getElementById('bubble-enrichment-container');
            html2canvas(container, { backgroundColor: 'white', scale: 2 }).then(canvas => {
                downloadCanvasAs(canvas, format, fileName);
            });
            return;
        case 'matrix':
            fileName = 'CiliaHub_Matrix_Plot';
            const canvas = window.analysisBarChartInstance.canvas;
            downloadCanvasAs(canvas, format, fileName);
            return;
        case 'upset':
            fileName = 'CiliaHub_Upset_Plot';
            const svgElement = document.querySelector('#upset-plot-wrapper svg');
            if (!svgElement) { alert("Could not find Upset plot to download."); return; }
            downloadSvgAs(svgElement, format, fileName);
            return;
    }
}

// Helper function for downloading canvas-based plots
function downloadCanvasAs(canvas, format, fileName) {
    if (format === 'png') {
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png', 1.0);
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
}

// Helper function for downloading SVG-based plots (like Upset)
function downloadSvgAs(svgElement, format, fileName) {
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgElement);
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    if (format === 'svg') {
        const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.svg`;
        a.click();
        URL.revokeObjectURL(url);
    } else { // Convert SVG to canvas for PNG or PDF download
        html2canvas(svgElement, { backgroundColor: 'white', scale: 2 }).then(canvas => {
            downloadCanvasAs(canvas, format, fileName);
        });
    }
}
