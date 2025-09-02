// --- Main Plotting Control and Settings ---

function getPlotSettings() {
    return {
        fontFamily: document.getElementById('setting-font-family')?.value || 'Arial',
        fontSize: parseInt(document.getElementById('setting-font-size')?.value, 10) || 20,
        fontWeight: document.getElementById('setting-font-weight')?.value || 'bold',
        textColor: document.getElementById('setting-text-color')?.value || '#000000',
        axisColor: document.getElementById('setting-axis-color')?.value || '#000000',
        yAxisTitle: document.getElementById('setting-y-axis-title')?.value || 'Localization',
        xAxisTitle: document.getElementById('setting-x-axis-title')?.value || 'Enrichment',
        barChartColor: document.getElementById('setting-bar-color')?.value || '#2ca25f',
        enrichmentColors: [
            document.getElementById('setting-enrichment-color1')?.value || '#edf8fb',
            document.getElementById('setting-enrichment-color2')?.value || '#b2e2e2',
            document.getElementById('setting-enrichment-color3')?.value || '#66c2a4',
            document.getElementById('setting-enrichment-color4')?.value || '#2ca25f',
            document.getElementById('setting-enrichment-color5')?.value || '#006d2c'
        ]
    };
}

let currentPlot = null;

// ========================
// Disease Enrichment Analysis
// ========================

// Disease-gene associations (based on common ciliopathies)
const CILIOPATHY_DATABASE = {
    "Bardet-Biedl Syndrome": {
        genes: ["BBS1", "BBS2", "BBS3", "BBS4", "BBS5", "BBS7", "BBS8", "BBS9", "BBS10", "BBS11", "BBS12", "BBS13", "BBS14", "BBS15", "BBS16", "BBS17", "BBS18", "BBS19", "BBS20", "BBS21"],
        omim: ["209900", "615981", "600151", "600374", "603650", "607590", "608132", "615986", "610148", "615988", "610683", "615990", "615991", "615992", "615993", "615994", "615995", "615996", "615997", "615998"],
        description: "Autosomal recessive ciliopathy characterized by obesity, polydactyly, retinal degeneration, and kidney abnormalities."
    },
    "Joubert Syndrome": {
        genes: ["TMEM216", "AHI1", "NPHP1", "CEP290", "TMEM67", "RPGRIP1L", "ARL13B", "CC2D2A", "INPP5E", "OFD1", "TCTN1", "KIF7", "TMEM237", "CEP41", "TMEM138", "ATXN10", "CEP120", "TMEM231", "TCTN2", "TCTN3", "CSPP1", "MKS1", "B9D1", "B9D2", "JBTS17", "ARMC9", "CEP104", "SUFU", "KIAA0586", "TMEM107", "KIAA0753", "POC1B", "CPLANE1", "ZNF423", "CEP164"],
        omim: ["213300", "608629", "243910", "611755", "612285", "610688", "612291", "612013", "614464", "300804", "614900", "614815", "614970", "615636", "614009", "615872", "615905", "616222", "615851", "616490", "617622", "609883", "614277", "615568", "618175", "617562", "616690", "618916", "617881", "617562", "617562", "614789", "616170", "616490", "614848"],
        description: "Autosomal recessive ciliopathy with distinctive cerebellar and brainstem malformation."
    },
    "Meckel-Gruber Syndrome": {
        genes: ["MKS1", "TMEM216", "TMEM67", "CEP290", "RPGRIP1L", "CC2D2A", "NPHP3", "TCTN2", "B9D1", "B9D2", "TMEM231", "KIF14", "TCTN3", "CEP120", "TMEM107", "INPP5E"],
        omim: ["249000", "603194", "607361", "610142", "611561", "612284", "608002", "613846", "614828", "615871", "614949", "611056", "615849", "613982", "615924", "613037"],
        description: "Lethal ciliopathy characterized by neural tube defects, polydactyly, and cystic kidneys."
    },
    "Nephronophthisis": {
        genes: ["NPHP1", "INVS", "NPHP3", "NPHP4", "IQCB1", "CEP290", "GLIS2", "RPGRIP1L", "NEK8", "SDCCAG8", "TMEM67", "TTC21B", "MAPKBP1", "CEP164", "ANKS6", "CEP83", "DCDC2", "MAPK15", "RMD3", "SLC41A1", "TRAF3IP1", "ZNF423", "DZIP1L"],
        omim: ["256100", "243305", "604387", "606966", "609237", "610142", "608539", "611561", "609799", "613615", "604830", "613820", "616734", "614848", "615845", "615847", "616220", "616636", "617729", "616892", "617872", "616490", "617570"],
        description: "Progressive kidney disease caused by defects in ciliary function."
    },
    "Leber Congenital Amaurosis": {
        genes: ["GUCY2D", "RPE65", "SPATA7", "AIPL1", "LCA5", "RPGRIP1", "CRX", "CRB1", "NMNAT1", "CEP290", "IMPDH1", "RD3", "RDH12", "LRAT", "TULP1", "KCNJ13", "GDF6", "PRPH2", "DTHD1", "IQCB1"],
        omim: ["204000", "204100", "613829", "604393", "611408", "608553", "204000", "604210", "608700", "610142", "146690", "180040", "608830", "604863", "602280", "603208", "601147", "179605", "614500", "609237"],
        description: "Severe inherited retinal dystrophy affecting ciliary photoreceptors."
    },
    "Primary Ciliary Dyskinesia": {
        genes: ["DNAI1", "DNAH5", "DNAI2", "DNAH11", "DNAH9", "TXNDC3", "RSPH9", "RSPH4A", "LRRC6", "CCDC39", "CCDC40", "DRC1", "ZMYND10", "LRRC50", "DNAH1", "SPAG1", "HYDIN", "CCDC103", "ARMC4", "CCDC151", "CCDC114", "CCDC65", "CFAP298", "CFAP300", "PIH1D3", "DNAAF1", "DNAAF2", "DNAAF3", "DNAAF4", "DNAAF5", "CCDC164", "GAS8"],
        omim: ["244400", "608644", "612518", "612444", "615504", "614679", "612650", "612647", "614935", "613807", "613808", "615294", "615038", "615504", "603332", "603395", "610808", "614677", "615408", "615956", "615967", "611884", "618479", "618058", "614942", "613190", "612517", "614592", "608706", "614874", "615288", "605178"],
        description: "Genetic disorder affecting motile cilia structure and function."
    },
    "Alstrom Syndrome": {
        genes: ["ALMS1"],
        omim: ["203800"],
        description: "Rare ciliopathy causing blindness, hearing loss, obesity, and diabetes."
    },
    "Sensenbrenner Syndrome": {
        genes: ["WDR35", "IFT80", "WDR19", "IFT140", "TTC21B"],
        omim: ["218330", "613091", "614378", "266920", "613820"],
        description: "Cranioectodermal dysplasia affecting ciliary function."
    },
    "Short-Rib Thoracic Dysplasia": {
        genes: ["DYNC2H1", "IFT80", "WDR34", "WDR60", "TTC21B", "IFT140", "WDR19", "IFT172", "WDR35", "CEP120", "KIAA0586", "NEK1", "WDR96"],
        omim: ["208500", "613091", "615633", "615462", "613820", "266920", "614378", "607386", "613091", "613982", "617881", "604588", "617094"],
        description: "Skeletal ciliopathy affecting bone and cartilage development."
    },
    "Oral-Facial-Digital Syndrome": {
        genes: ["OFD1", "TMEM216", "TCTN3", "C5orf42", "TMEM138", "SELENOI", "C2CD3", "KIAA0753", "INPP5E", "TMEM107", "CFAP57", "CFAP410"],
        omim: ["311200", "607361", "615849", "614900", "614009", "607393", "615944", "617562", "613037", "615924", "618590", "618965"],
        description: "Ciliopathy affecting facial, oral, and digital development."
    }
};

// Function to perform disease enrichment analysis
function performDiseaseEnrichment(foundGenes) {
    const geneSymbols = foundGenes.map(g => g.gene.toUpperCase());
    const results = [];
    
    for (const [disease, data] of Object.entries(CILIOPATHY_DATABASE)) {
        const diseaseGenes = data.genes.map(g => g.toUpperCase());
        const overlap = geneSymbols.filter(gene => diseaseGenes.includes(gene));
        
        if (overlap.length > 0) {
            // Calculate enrichment statistics
            const k = overlap.length; // genes in overlap
            const n = geneSymbols.length; // total input genes
            const K = diseaseGenes.length; // total disease genes
            const N = 20000; // background genome size
            
            const pValue = hypergeometricPValue(k, n, K, N);
            const enrichmentScore = n > 0 && K > 0 ? (k / n) / (K / N) : 0;
            const expectedOverlap = (n * K) / N;
            
            results.push({
                disease: disease,
                description: data.description,
                omim_ids: data.omim,
                overlap_genes: overlap,
                overlap_count: k,
                total_disease_genes: K,
                total_input_genes: n,
                expected_overlap: expectedOverlap,
                enrichment_score: enrichmentScore,
                p_value: pValue,
                fold_enrichment: k / Math.max(expectedOverlap, 0.1)
            });
        }
    }
    
    // Sort by p-value (most significant first)
    return results.sort((a, b) => a.p_value - b.p_value);
}

// Function to render disease enrichment heatmap
function renderDiseaseEnrichment(foundGenes) {
    document.getElementById('disease-plot-container').style.display = 'block';
    
    if (window.diseaseChartInstance) {
        window.diseaseChartInstance.destroy();
    }
    
    const enrichmentResults = performDiseaseEnrichment(foundGenes);
    
    if (enrichmentResults.length === 0) {
        document.getElementById('disease-plot-container').innerHTML = 
            '<p class="status-message">No significant disease associations found for the given genes.</p>';
        return;
    }
    
    const settings = getPlotSettings();
    
    // Create summary section
    const summaryHTML = `
        <div id="disease-results-summary" style="margin-bottom: 2rem; font-size: 1.1rem;">
            <h3>Disease Enrichment Analysis Results</h3>
            <p>Found significant associations with <strong>${enrichmentResults.length}</strong> ciliopathy(ies) from your gene list.</p>
            <div style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
                ${enrichmentResults.map(result => `
                    <div style="margin-bottom: 10px; padding: 8px; background-color: ${result.p_value < 0.05 ? '#e8f5e8' : '#f8f8f8'}; border-radius: 3px;">
                        <strong>${result.disease}</strong><br>
                        <small>Overlap: ${result.overlap_count}/${result.total_disease_genes} genes | 
                        P-value: ${result.p_value.toExponential(3)} | 
                        Fold-enrichment: ${result.fold_enrichment.toFixed(2)}x</small><br>
                        <small style="color: #666;">Genes: ${result.overlap_genes.join(', ')}</small>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // Create heatmap visualization
    const heatmapHTML = `
        <div style="position: relative; width: 100%; max-width: 800px; height: 500px; margin: auto;">
            <canvas id="disease-heatmap-chart"></canvas>
        </div>
    `;
    
    const container = document.getElementById('disease-plot-container');
    container.innerHTML = summaryHTML + heatmapHTML;
    
    // Prepare data for heatmap
    const maxLogP = Math.max(...enrichmentResults.map(r => -Math.log10(r.p_value)), 1);
    const maxEnrichment = Math.max(...enrichmentResults.map(r => r.enrichment_score), 1);
    
    const heatmapData = enrichmentResults.map((result, index) => ({
        x: 'Enrichment Score',
        y: result.disease,
        v: result.enrichment_score / maxEnrichment, // Normalized for color scaling
        enrichment: result.enrichment_score,
        pValue: result.p_value,
        geneCount: result.overlap_count,
        genes: result.overlap_genes
    }));
    
    // Add significance data
    const significanceData = enrichmentResults.map((result, index) => ({
        x: '-Log10(P-value)',
        y: result.disease,
        v: (-Math.log10(result.p_value)) / maxLogP,
        enrichment: result.enrichment_score,
        pValue: result.p_value,
        geneCount: result.overlap_count,
        genes: result.overlap_genes
    }));
    
    const ctx = document.getElementById('disease-heatmap-chart').getContext('2d');
    
    // Create a custom heatmap using bubble chart
    window.diseaseChartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Enrichment Score',
                    data: heatmapData.map((d, i) => ({
                        x: 0,
                        y: i,
                        r: 15 + (d.enrichment * 10),
                        ...d
                    })),
                    backgroundColor: function(context) {
                        const value = context.raw.v || 0;
                        const colors = settings.enrichmentColors || ['#edf8fb', '#b2e2e2', '#66c2a4', '#2ca25f', '#006d2c'];
                        const index = Math.min(Math.floor(value * (colors.length - 1)), colors.length - 1);
                        return colors[index];
                    },
                    borderWidth: 2,
                    borderColor: '#ffffff'
                },
                {
                    label: 'Statistical Significance',
                    data: significanceData.map((d, i) => ({
                        x: 1,
                        y: i,
                        r: 15 + (-Math.log10(d.pValue) * 3),
                        ...d
                    })),
                    backgroundColor: function(context) {
                        const pValue = context.raw.pValue || 1;
                        if (pValue < 0.001) return '#8B0000';
                        if (pValue < 0.01) return '#DC143C';
                        if (pValue < 0.05) return '#FF6347';
                        return '#FFB6C1';
                    },
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
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
                        title: function(context) {
                            return enrichmentResults[context[0].raw.y].disease;
                        },
                        label: function(context) {
                            const data = context.raw;
                            return [
                                `Genes: ${data.genes.join(', ')}`,
                                `Enrichment: ${data.enrichment.toFixed(2)}x`,
                                `P-value: ${data.pValue.toExponential(3)}`,
                                `Gene count: ${data.geneCount}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'category',
                    labels: ['Enrichment Score', 'Statistical Significance'],
                    title: {
                        display: true,
                        text: 'Analysis Type',
                        font: {
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: 'bold'
                        },
                        color: settings.axisColor
                    },
                    ticks: {
                        font: {
                            family: settings.fontFamily,
                            size: settings.fontSize
                        },
                        color: settings.textColor
                    },
                    grid: { display: false }
                },
                y: {
                    type: 'category',
                    labels: enrichmentResults.map(r => r.disease),
                    title: {
                        display: true,
                        text: 'Ciliopathy',
                        font: {
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: 'bold'
                        },
                        color: settings.axisColor
                    },
                    ticks: {
                        font: {
                            family: settings.fontFamily,
                            size: Math.max(8, settings.fontSize - 2),
                            weight: settings.fontWeight
                        },
                        color: settings.textColor
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

// Updated displayEnrichmentPage function with disease analysis option
function displayEnrichmentPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    document.querySelector('.cilia-panel').style.display = 'none';
    contentArea.innerHTML = `
        <div class="page-section">
    <h2>Ciliary Gene Enrichment Analysis</h2>
    
    <p><strong>One-Click Enrichment Analysis &amp; Visualization</strong></p>
    <p>
        Upload or paste your list of genes (e.g., from a differential expression analysis or a CRISPR screen), 
        and CiliaHub will calculate how enriched your list is for known ciliary genes.
    </p>

    <h3>How it works:</h3>
    <ol>
        <li>User pastes or uploads their gene list.</li>
        <li>The tool compares it to the full ciliome (~2,000 genes) and a background set (e.g., all human genes).</li>
        <li>Results are visualized in interactive plots and downloadable tables.</li>
    </ol>

    <textarea id="enrichment-genes-input" 
        placeholder="e.g., TMEM17, IFT88, WDR31..." 
        style="width: 100%; min-height: 150px; padding: 1rem; border: 2px solid #e1ecf4; border-radius: 10px; font-size: 1rem; margin-top: 1rem; resize: vertical;">
    </textarea>
    
    <div id="enrichment-controls" style="margin-top: 1rem; display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
        <div>
           <strong>Plot Type:</strong>
            <input type="radio" id="plot-bubble" name="plot-type" value="bubble" checked>
            <label for="plot-bubble" style="margin-right: 10px;">Localization</label>
            <input type="radio" id="plot-matrix" name="plot-type" value="matrix">
            <label for="plot-matrix" style="margin-right: 10px;">Gene Matrix</label>
            <input type="radio" id="plot-ciliome" name="plot-type" value="ciliome">
            <label for="plot-ciliome" style="margin-right: 10px;">Ciliome Enrichment</label>
            <input type="radio" id="plot-disease" name="plot-type" value="disease">
            <label for="plot-disease">Disease Association</label>
        </div>
        <button id="generate-plot-btn" class="btn btn-primary">Generate Plot</button>
        <select id="download-format">
            <option value="png">PNG</option>
            <option value="pdf">PDF</option>
        </select>
        <button id="download-plot-btn" class="btn btn-secondary" style="display:none;">Download Plot</button>
    </div>
</div>
            <div style="margin-top: 20px; border: 1px solid #e1ecf4; border-radius: 5px; padding: 10px;">
                <h3 style="font-weight: bold; margin-bottom: 10px;">Plot Customization</h3>
                <p style="font-size: 0.9rem; color: #555;">Please click "Generate Plot" after making changes to apply them.</p>
                <div id="plot-settings-panel" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 10px;">
                    <div>
                        <label for="setting-font-family" style="display: block; margin-bottom: 5px;">Font Family</label>
                        <select id="setting-font-family">
                            <option value="Arial">Arial</option>
                            <option value="Tahoma">Tahoma</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Helvetica">Helvetica</option>
                            <option value="Verdana">Verdana</option>
                        </select>
                    </div>
                    <div>
                        <label for="setting-font-size" style="display: block; margin-bottom: 5px;">Label Font Size</label>
                        <input type="number" id="setting-font-size" value="20" min="8" max="30" style="width: 60px;">
                    </div>
                    <div>
                        <label for="setting-font-weight" style="display: block; margin-bottom: 5px;">Label Weight</label>
                        <select id="setting-font-weight">
                            <option value="normal">Normal</option>
                            <option value="bold" selected>Bold</option>
                            <option value="lighter">Lighter</option>
                        </select>
                    </div>
                    <div>
                        <label for="setting-text-color" style="display: block; margin-bottom: 5px;">Text Color</label>
                        <input type="color" id="setting-text-color" value="#000000">
                    </div>
                    <div>
                        <label for="setting-axis-color" style="display: block; margin-bottom: 5px;">Axis Color</label>
                        <input type="color" id="setting-axis-color" value="#000000">
                    </div>
                    <div>
                        <label for="setting-y-axis-title" style="display: block; margin-bottom: 5px;">Y Axis Title</label>
                        <input type="text" id="setting-y-axis-title" value="Localization">
                    </div>
                    <div>
                        <label for="setting-enrichment-color1" style="display: block; margin-bottom: 5px;">Enrichment Color 1 (Low)</label>
                        <input type="color" id="setting-enrichment-color1" value="#edf8fb">
                    </div>
                    <div>
                        <label for="setting-enrichment-color2" style="display: block; margin-bottom: 5px;">Enrichment Color 2</label>
                        <input type="color" id="setting-enrichment-color2" value="#b2e2e2">
                    </div>
                    <div>
                        <label for="setting-enrichment-color3" style="display: block; margin-bottom: 5px;">Enrichment Color 3</label>
                        <input type="color" id="setting-enrichment-color3" value="#66c2a4">
                    </div>
                    <div>
                        <label for="setting-enrichment-color4" style="display: block; margin-bottom: 5px;">Enrichment Color 4</label>
                        <input type="color" id="setting-enrichment-color4" value="#2ca25f">
                    </div>
                    <div>
                        <label for="setting-enrichment-color5" style="display: block; margin-bottom: 5px;">Enrichment Color 5 (High)</label>
                        <input type="color" id="setting-enrichment-color5" value="#006d2c">
                    </div>
                </div>
            </div>

            <div id="enrichment-status" class="status-message" style="display: none; padding: 1rem;"></div>
            
            <div id="plot-container" style="display:none; margin-top: 2rem;">
                <div id="bubble-enrichment-container" style="display: none; align-items: flex-start; gap: 0px;">
                    <div class="plot-wrapper" style="position: relative; height: 600px; flex-grow: 1;"><canvas id="enrichment-bubble-plot"></canvas></div>
                    <div id="legend-container" style="flex-shrink: 0; width: 150px; padding-top: 20px; padding-left: 5px;"></div>
                </div>
                <div id="matrix-plot-container" style="display: none;">
                     <div class="plot-wrapper" style="position: relative; height: 600px;"><canvas id="enrichment-matrix-plot"></canvas></div>
                </div>
                <div id="ciliome-plot-container" style="display: none; padding: 20px; text-align: center;"></div>
                <div id="disease-plot-container" style="display: none; padding: 20px; text-align: center;">
                    <div style="position: relative; width: 100%; height: 600px;">
                        <canvas id="disease-heatmap-chart"></canvas>
                    </div>
                </div>
            </div>
            </div>
        </div>
    `;

    document.getElementById('generate-plot-btn').addEventListener('click', generateEnrichmentPlots);
    document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
}

// Updated generateEnrichmentPlots function to include disease analysis
function generateEnrichmentPlots() {
    const genesInput = document.getElementById('enrichment-genes-input').value.trim();
    if (!genesInput) {
        alert('Please enter or upload a gene list.');
        return;
    }

    const geneList = genesInput.split(/[\n,]+/).map(g => g.trim()).filter(Boolean);
    const plotType = document.querySelector('input[name="plot-type"]:checked').value;

    // Find genes in the database (you'll need to implement this based on your data structure)
    const foundGenes = geneList.map(inputGene => {
        // This is a placeholder - replace with your actual gene lookup logic
        return window.allGenes?.find(gene => 
            gene.gene.toLowerCase() === inputGene.toLowerCase()
        ) || { gene: inputGene, localization: '', functional_category: [] };
    }).filter(gene => gene.localization || gene.functional_category?.length > 0);

    // Hide all plot containers
    document.getElementById('bubble-enrichment-container').style.display = 'none';
    document.getElementById('matrix-plot-container').style.display = 'none';
    document.getElementById('ciliome-plot-container').style.display = 'none';
    document.getElementById('disease-plot-container').style.display = 'none';
    document.getElementById('plot-container').style.display = 'block';
    document.getElementById('download-plot-btn').style.display = 'inline-block';

    // Destroy previous plot if exists
    if (currentPlot) {
        currentPlot.destroy();
        currentPlot = null;
    }

    if (plotType === 'bubble') {
        renderEnrichmentBubblePlot(foundGenes);
    } else if (plotType === 'matrix') {
        renderBubbleMatrix(foundGenes);
    } else if (plotType === 'ciliome') {
        const notFoundGenes = geneList.filter(inputGene => 
            !foundGenes.some(fg => fg.gene.toLowerCase() === inputGene.toLowerCase())
        );
        renderCiliomeEnrichment(foundGenes, notFoundGenes);
    } else if (plotType === 'disease') {
        renderDiseaseEnrichment(foundGenes);
    }

    // Scroll to plot container
    document.getElementById('plot-container').scrollIntoView({ behavior: 'smooth' });
}

// Updated downloadPlot function to handle disease plots
function downloadPlot() {
    const selectedPlot = document.querySelector('input[name="plot-type"]:checked').value;
    const format = document.getElementById('download-format')?.value || 'png';
    let canvas = null;
    let fileName = 'CiliaHub_Plot';

    if (selectedPlot === 'bubble') {
        canvas = document.getElementById('enrichment-bubble-plot');
        fileName = 'CiliaHub_Localization_Plot';
    } else if (selectedPlot === 'matrix') {
        canvas = document.getElementById('enrichment-matrix-plot');
        fileName = 'CiliaHub_Gene_Matrix_Plot';
    } else if (selectedPlot === 'ciliome') {
        canvas = document.getElementById('ciliome-bar-chart');
        fileName = 'CiliaHub_Ciliome_Enrichment';
    } else if (selectedPlot === 'disease') {
        canvas = document.getElementById('disease-heatmap-chart');
        fileName = 'CiliaHub_Disease_Enrichment';
    }

    if (!canvas) {
        console.error("Could not find the canvas element to download.");
        return;
    }
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // Increase resolution for better quality download
    const scale = 4;
    tempCanvas.width = canvas.width * scale;
    tempCanvas.height = canvas.height * scale;

    // Fill background with white
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw the original canvas onto the high-res temporary canvas
    tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);

    if (format === 'png') {
        const a = document.createElement('a');
        a.href = tempCanvas.toDataURL('image/png');
        a.download = `${fileName}.png`;
        a.click();
    } else if (format === 'pdf') {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: tempCanvas.width > tempCanvas.height ? 'l' : 'p',
            unit: 'px',
            format: [tempCanvas.width, tempCanvas.height]
        });
        pdf.addImage(tempCanvas.toDataURL('image/png'), 'PNG', 0, 0, tempCanvas.width, tempCanvas.height);
        pdf.save(`${fileName}.pdf`);
    }
}

// Helper function for hypergeometric p-value calculation (if not already present)
function hypergeometricPValue(k, n, K, N) {
    // k: number of successes in sample
    // n: sample size
    // K: number of successes in population
    // N: population size
    
    function logFactorial(num) {
        let result = 0;
        for (let i = 2; i <= num; i++) {
            result += Math.log(i);
        }
        return result;
    }
    
    function logCombination(n, k) {
        if (k > n || k < 0) return -Infinity;
        if (k === 0 || k === n) return 0;
        return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
    }
    
    let pValue = 0;
    const maxK = Math.min(n, K);
    
    for (let i = k; i <= maxK; i++) {
        const logProb = logCombination(K, i) + logCombination(N - K, n - i) - logCombination(N, n);
        pValue += Math.exp(logProb);
    }
    
    return Math.min(pValue, 1.0);
}

// Additional utility function to get genes associated with OMIM IDs
function getGenesForOMIM(omimId, allGenes) {
    return allGenes.filter(gene => 
        gene.omim_id && gene.omim_id.includes(omimId)
    );
}

// Function to export disease enrichment results as table
function exportDiseaseResults(enrichmentResults) {
    const csvContent = "data:text/csv;charset=utf-8," + 
        "Disease,Description,Overlap_Genes,Overlap_Count,Total_Disease_Genes,Enrichment_Score,P_Value,OMIM_IDs\n" +
        enrichmentResults.map(result => 
            `"${result.disease}","${result.description}","${result.overlap_genes.join(';')}",${result.overlap_count},${result.total_disease_genes},${result.enrichment_score.toFixed(3)},${result.p_value.toExponential(3)},"${result.omim_ids.join(';')}"`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "CiliaHub_Disease_Enrichment_Results.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Enhanced disease enrichment with statistical corrections
function performEnhancedDiseaseEnrichment(foundGenes) {
    const basicResults = performDiseaseEnrichment(foundGenes);
    
    // Apply Benjamini-Hochberg correction for multiple testing
    const pValues = basicResults.map(r => r.p_value);
    const adjustedPValues = benjaminiHochbergCorrection(pValues);
    
    return basicResults.map((result, index) => ({
        ...result,
        p_value_adjusted: adjustedPValues[index],
        significant_uncorrected: result.p_value < 0.05,
        significant_corrected: adjustedPValues[index] < 0.05
    }));
}

// Benjamini-Hochberg correction function
function benjaminiHochbergCorrection(pValues) {
    const n = pValues.length;
    const indexed = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
    const adjusted = new Array(n);
    
    for (let k = 0; k < n; k++) {
        const rank = k + 1;
        const adjustedP = Math.min(1, indexed[k].p * n / rank);
        adjusted[indexed[k].i] = adjustedP;
    }
    
    // Ensure monotonicity
    for (let i = n - 2; i >= 0; i--) {
        if (adjusted[indexed[i].i] > adjusted[indexed[i + 1].i]) {
            adjusted[indexed[i].i] = adjusted[indexed[i + 1].i];
        }
    }
    
    return adjusted;
}

// ------------------------
// Bubble Plot Function (Using Chart.js)
// ------------------------
function renderEnrichmentBubblePlot(foundGenes) {
    document.getElementById('bubble-enrichment-container').style.display = 'flex';

    if (window.enrichmentDotPlotInstance) window.enrichmentDotPlotInstance.destroy();

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
    if (categoriesWithData.length === 0) {
        document.getElementById('bubble-enrichment-container').innerHTML = '<p class="status-message">No localizations found for the given genes in the selected categories.</p>';
        return;
    }

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
        data: categoriesWithData.map(loc => ({
            x: 0,
            y: loc,
            r: getRadius(localizationCounts[loc]),
            count: localizationCounts[loc]
        })),
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

    const ctx = document.getElementById('enrichment-bubble-plot').getContext('2d');

    window.enrichmentDotPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [dataset]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { left: 0, right: 10, top: 20, bottom: 20 }
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
                        text: settings.xAxisTitle,
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
                    grid: { display: false, drawBorder: false },
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

// ------------------------
// Gene Matrix Plot Function (Using Chart.js)
// ------------------------
function renderBubbleMatrix(foundGenes) {
    document.getElementById('matrix-plot-container').style.display = 'block';

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

    const ctx = document.getElementById('enrichment-matrix-plot').getContext('2d');

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
                        text: settings.xAxisTitle,
                        font: {
                            family: settings.fontFamily,
                            size: settings.fontSize,
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
                    grid: { display: false }
                },
                y: {
                    type: 'category',
                    labels: yCategories,
                    title: {
                        display: true,
                        text: 'Ciliary Localization',
                        font: {
                            family: settings.fontFamily,
                            size: settings.fontSize,
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
                    grid: { display: false }
                }
            }
        }
    });
}


// ------------------------
// Ciliome Enrichment Plot Function (Using Chart.js)
// ------------------------
function renderCiliomeEnrichment(foundGenes, notFoundGenes) {
    document.getElementById('ciliome-plot-container').style.display = 'block';

    if (window.ciliomeChartInstance) {
        window.ciliomeChartInstance.destroy();
    }

    const k = foundGenes.length;
    const n_input = k + notFoundGenes.length;
    const M = window.allGenes ? window.allGenes.length : 2000; // Total ciliary genes in database
    const N = 20000; // Total genes in background genome

    if (n_input === 0) {
        document.getElementById('ciliome-plot-container').innerHTML = '<p class="status-message">Please enter a gene list to analyze.</p>';
        return;
    }

    const pValue = hypergeometricPValue(k, n_input, M, N);
    const enrichmentScore = n_input > 0 && M > 0 ? (k / n_input) / (M / N) : 0;

    const summaryHTML = `
        <div id="ciliome-results-summary" style="margin-bottom: 2rem; font-size: 1.1rem; max-width: 600px; margin-left: auto; margin-right: auto;">
            <h3>Enrichment Analysis Results</h3>
            <p>From your list of <strong>${n_input}</strong> unique gene(s), <strong>${k}</strong> were found in the CiliaHub database of <strong>${M}</strong> ciliary genes.</p>
            <p>The expected number of ciliary genes from a random list of this size (from a background of ${N} total genes) would be approximately <strong>${((M / N) * n_input).toFixed(2)}</strong>.</p>
            <div style="font-size: 1.2rem; margin-top: 1rem; padding: 10px; background-color: #f8f9fa; border-radius: 5px;">
                <p><strong>Enrichment Score:</strong> ${enrichmentScore.toFixed(2)}-fold</p>
                <p><strong>P-value (Hypergeometric Test):</strong> ${pValue.toExponential(3)}</p>
            </div>
        </div>
    `;

    const localizationCounts = {};
    foundGenes.forEach(gene => {
        if (gene.localization) {
            gene.localization.split(',').forEach(loc => {
                const term = loc.trim();
                if (term) {
                    localizationCounts[term] = (localizationCounts[term] || 0) + 1;
                }
            });
        }
    });

    const chartData = { labels: [], counts: [] };
    Object.entries(localizationCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([label, count]) => {
            chartData.labels.push(label);
            chartData.counts.push(count);
        });

    const barChartHTML = `
        <div style="position: relative; width: 100%; max-width: 700px; height: 600px; margin: auto;">
            <canvas id="ciliome-bar-chart"></canvas>
        </div>
    `;

    const container = document.getElementById('ciliome-plot-container');
    container.innerHTML = summaryHTML + (k > 0 ? barChartHTML : '<p>No ciliary genes were found in your list to plot localizations.</p>');

    if (k === 0) return;

    const settings = getPlotSettings();
    const ctx = document.getElementById('ciliome-bar-chart').getContext('2d');
    window.ciliomeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Gene Count',
                data: chartData.counts,
                backgroundColor: settings.barChartColor,
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Localization of Found Ciliary Genes',
                    font: {
                        family: settings.fontFamily,
                        size: settings.fontSize,
                        weight: settings.fontWeight
                    },
                    color: settings.textColor
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: settings.xAxisTitle,
                        font: {
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: settings.fontWeight
                        },
                        color: settings.axisColor
                    },
                    ticks: {
                        stepSize: 1,
                        color: settings.textColor
                    },
                    grid: {
                        display: false,
                        drawBorder: true,
                        borderColor: settings.axisColor
                    }
                },
                y: {
                    ticks: {
                        font: {
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: settings.fontWeight
                        },
                        color: settings.textColor
                    },
                    grid: {
                        display: false,
                        drawBorder: true,
                        borderColor: settings.axisColor
                    }
                }
            }
        }
    });
}

