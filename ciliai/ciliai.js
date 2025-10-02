// ciliAI.js - Enhanced with heatmap visualization and corrected screen names



// Make functions globally available for router in globals.js

window.displayCiliAIPage = function displayCiliAIPage() {

    const contentArea = document.querySelector('.content-area');

    if (!contentArea) {

        console.error('Content area not found');

        return;

    }

    contentArea.className = 'content-area content-area-full';

    const ciliaPanel = document.querySelector('.cilia-panel');

    if (ciliaPanel) {

        ciliaPanel.style.display = 'none';

    }



    // Inject the updated HTML structure with Plotly CDN and Visualize button

    contentArea.innerHTML = `

        <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>

        <div class="ciliai-container">

            <div class="ciliai-header">

                <h1>CiliAI</h1>

                <p>Your AI-powered partner for discovering gene-cilia relationships.</p>

            </div>

            

            <div class="ciliai-main-content">

                <div class="ai-query-section">

                    <h3>Ask a Question</h3>

                    <div class="ai-input-group">

                        <input type="text" id="aiQueryInput" class="ai-query-input" placeholder="e.g., What is the role of IFT88 in cilia biology?">

                        <button class="ai-query-btn" id="aiQueryBtn">Ask CiliAI</button>

                    </div>

                </div>



                <div class="input-section">

                    <h3>Analyze Gene Phenotypes</h3>

                    <div class="input-group">

                        <label for="geneInput">Gene Symbols:</label>

                        <textarea id="geneInput" class="gene-input-textarea" placeholder="Enter one or more gene symbols, separated by commas, spaces, or newlines (e.g., HDAC6, IFT88, ARL13B)"></textarea>

                    </div>



                    <div class="input-group">

                        <label>Analysis Mode:</label>

                        <div class="mode-selector">

                            <div class="mode-option">

                                <input type="radio" id="hybrid" name="mode" value="hybrid" checked>

                                <label for="hybrid" title="Best for most users. Combines our fast, expert-curated database, screen data, and real-time AI literature mining for the most comprehensive results.">

                                    <span class="mode-icon">🔬</span>

                                    <div>

                                        <strong>Hybrid</strong><br>

                                        <small>Expert DB + Screen Data + Literature</small>

                                    </div>

                                </label>

                            </div>

                            <div class="mode-option">

                                <input type="radio" id="expert" name="mode" value="expert">

                                <label for="expert" title="Fastest option. Queries only our internal, manually curated database and screen data of known gene-cilia interactions.">

                                    <span class="mode-icon">🏛️</span>

                                    <div>

                                        <strong>Expert Only</strong><br>

                                        <small>Curated database + Screen Data</small>

                                    </div>

                                </label>

                            </div>

                            <div class="mode-option">

                                <input type="radio" id="nlp" name="mode" value="nlp">

                                <label for="nlp" title="Most current data. Performs a live AI-powered search across PubMed full-text articles. May be slower but includes the very latest findings.">

                                    <span class="mode-icon">📚</span>

                                    <div>

                                        <strong>Literature Only</strong><br>

                                        <small>Live AI text mining</small>

                                    </div>

                                </label>

                            </div>

                        </div>

                    </div>



                    <button class="analyze-btn" id="analyzeBtn">

                        🔍 Analyze Genes

                    </button>

                </div>



                <div id="resultsSection" class="results-section" style="display: none;">

                    <h2>Analysis Results</h2>

                    <button class="visualize-btn" id="visualizeBtn" style="display: none;">📊 Visualize Results</button>

                    <div id="plot-display-area" style="margin-top: 1rem;"></div>

                    <div id="resultsContainer"></div>

                </div>

            </div>

        </div>

        <style>

            /* Design styles to match CiliaHub theme */

            .ciliai-container {

                font-family: 'Arial', sans-serif;

                max-width: 950px;

                margin: 2rem auto;

                padding: 2rem;

                background-color: #f9f9f9;

                border-radius: 12px;

            }

            .ciliai-header { 

                text-align: center; 

                margin-bottom: 2rem; 

            }

            .ciliai-header h1 {

                font-size: 2.8rem;

                color: #2c5aa0;

                margin: 0;

            }

            .ciliai-header p { 

                font-size: 1.2rem; 

                color: #555; 

                margin-top: 0.5rem; 

            }

            

            .ai-query-section {

                background-color: #e8f4fd;

                border: 1px solid #bbdefb;

                padding: 1.5rem 2rem;

                border-radius: 8px;

                margin-bottom: 2rem;

            }

            .ai-query-section h3 { 

                margin-top: 0; 

                color: #2c5aa0; 

            }

            .ai-input-group { 

                display: flex; 

                gap: 10px; 

            }

            .ai-query-input {

                flex-grow: 1;

                padding: 0.8rem;

                border: 1px solid #ccc;

                border-radius: 4px;

                font-size: 1rem;

            }

            .ai-query-btn {

                padding: 0.8rem 1.2rem;

                font-size: 1rem;

                background-color: #2c5aa0;

                color: white;

                border: none;

                border-radius: 4px;

                cursor: pointer;

                transition: background-color 0.2s;

            }

            .ai-query-btn:hover { 

                background-color: #1e4273; 

            }



            .input-section {

                background-color: #fff;

                padding: 2rem;

                border-radius: 8px;

                box-shadow: 0 2px 8px rgba(0,0,0,0.05);

            }

            .input-section h3 { 

                margin-top: 0; 

                color: #333; 

            }

            .input-group { 

                margin-bottom: 1.5rem; 

            }

            .input-group label {

                display: block;

                font-weight: bold;

                margin-bottom: 0.5rem;

                color: #333;

            }

            .gene-input-textarea {

                width: 100%;

                padding: 0.8rem;

                border: 1px solid #ccc;

                border-radius: 4px;

                font-size: 1rem;

                min-height: 80px;

                resize: vertical;

            }

            .mode-selector {

                display: grid;

                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));

                gap: 1rem;

            }

            .mode-option input[type="radio"] { 

                display: none; 

            }

            .mode-option label {

                display: flex;

                align-items: center;

                gap: 10px;

                padding: 1rem;

                border: 2px solid #ddd;

                border-radius: 8px;

                cursor: pointer;

                transition: all 0.2s;

            }

            .mode-option input[type="radio"]:checked + label {

                border-color: #2c5aa0;

                background-color: #e8f4fd;

                box-shadow: 0 0 5px rgba(44, 90, 160, 0.3);

            }

            .mode-icon { 

                font-size: 1.8rem; 

            }

            .analyze-btn {

                width: 100%;

                padding: 1rem;

                font-size: 1.1rem;

                font-weight: bold;

                background-color: #28a745;

                color: white;

                border: none;

                border-radius: 8px;

                cursor: pointer;

                transition: background-color 0.2s;

            }

            .analyze-btn[disabled] {

                background-color: #a5d6a7;

                cursor: not-allowed;

            }

            .analyze-btn:hover:not([disabled]) { 

                background-color: #218838; 

            }

            .visualize-btn {

                width: 100%;

                padding: 0.8rem;

                font-size: 1rem;

                background-color: #007bff;

                color: white;

                border: none;

                border-radius: 8px;

                cursor: pointer;

                transition: background-color 0.2s;

                margin-bottom: 1rem;

            }

            .visualize-btn:hover:not([disabled]) { 

                background-color: #0056b3; 

            }

            .visualize-btn[disabled] {

                background-color: #b8daff;

                cursor: not-allowed;

            }

            .results-section {

                margin-top: 2rem;

                padding: 2rem;

                background-color: #fff;

                border-radius: 8px;

                box-shadow: 0 2px 8px rgba(0,0,0,0.05);

            }

            .result-card {

                border: 1px solid #ddd;

                border-radius: 8px;

                padding: 1.5rem;

                margin-bottom: 1.5rem;

                position: relative;

                overflow: hidden;

            }

            .result-card h3 { 

                margin-top: 0; 

                color: #2c5aa0; 

                font-size: 1.4rem; 

            }

            .result-card .status-found { 

                color: #28a745; 

            }

            .result-card .status-not-found { 

                color: #dc3545; 

            }

            .result-card .status-searching { 

                color: #007bff; 

            }

            .prediction-grid {

                display: grid;

                grid-template-columns: 1fr 1fr;

                gap: 1rem;

                margin-top: 1rem;

            }

            .prediction-box {

                padding: 1rem;

                border-radius: 6px;

                text-align: center;

                background-color: #f8f9fa; 

                border: 1px solid #dee2e6;

            }

            .prediction-box.promotes { 

                background-color: #d4edda; 

                border: 1px solid #c3e6cb; 

            }

            .prediction-box.inhibits { 

                background-color: #f8d7da; 

                border: 1px solid #f5c6cb; 

            }

            .prediction-box.no-effect { 

                background-color: #e2e3e5; 

                border: 1px solid #d6d8db; 

            }

            .prediction-box.conflicting { 

                background-color: #fff3cd; 

                border: 1px solid #ffeeba; 

            }

            .prediction-box h4 { 

                margin: 0 0 0.5rem 0; 

                color: #495057; 

            }

            .prediction-box p { 

                margin: 0; 

                font-size: 1.2rem; 

                font-weight: bold; 

            }

            .evidence-section {

                margin-top: 1.5rem;

                border-top: 1px solid #eee;

                padding-top: 1rem;

            }

            .evidence-toggle {

                background: none;

                border: 1px solid #2c5aa0;

                color: #2c5aa0;

                padding: 0.4rem 0.8rem;

                border-radius: 20px;

                cursor: pointer;

                font-weight: bold;

                transition: all 0.2s;

                margin-bottom: 0.5rem;

            }

            .evidence-toggle:hover { 

                background-color: #e8f4fd; 

            }

            .evidence-content {

                display: none;

                margin-top: 1rem;

                padding-left: 1rem;

                border-left: 3px solid #bbdefb;

            }

            .evidence-snippet {

                background-color: #f1f3f5;

                padding: 0.8rem;

                border-radius: 4px;

                margin-bottom: 0.8rem;

                font-size: 0.9rem;

                color: #333;

            }

            .evidence-snippet strong { 

                color: #0056b3; 

            }

            .evidence-snippet mark { 

                background-color: #ffeeba; 

                padding: 0.1em 0.2em; 

                border-radius: 3px; 

            }

            .screen-summary {

                font-weight: bold;

                color: #2c5aa0;

                margin-bottom: 1rem;

            }

            .screen-table {

                width: 100%;

                border-collapse: collapse;

                margin-top: 0.5rem;

                background-color: #fff;

            }

            .screen-table th, .screen-table td {

                border: 1px solid #ddd;

                padding: 0.8rem;

                text-align: left;

            }

            .screen-table th {

                background-color: #e8f4fd;

                font-weight: bold;

                color: #2c5aa0;

            }

            .screen-table .effect-promotes { color: #28a745; font-weight: bold; }

            .screen-table .effect-inhibits { color: #dc3545; font-weight: bold; }

            .screen-table .effect-no-effect { color: #6c757d; }

            .screen-evidence-container {

                border: 1px solid #bbdefb;

                border-radius: 4px;

                padding: 1rem;

                background-color: #f8f9fa;

            }

        </style>

    `;



    // Attach event listeners after HTML is injected

    setupCiliAIEventListeners();

};



// --- Helper Functions ---

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));



// Expert-curated internal database (mock)

const CILI_AI_DB = {

    "HDAC6": {

        "summary": { "lof_length": "Promotes / Maintains", "percentage_ciliated": "No effect", "source": "Expert DB" },

        "evidence": [

            { "id": "21873644", "source": "pubmed", "context": "...loss of HDAC6 results in hyperacetylation of tubulin and leads to the formation of longer, more stable primary cilia in renal epithelial cells." }

        ]

    },

    "IFT88": {

        "summary": { "lof_length": "Inhibits / Restricts", "percentage_ciliated": "Reduced cilia numbers", "source": "Expert DB" },

        "evidence": [

            { "id": "10882118", "source": "pubmed", "context": "Mutations in IFT88 (polaris) disrupt intraflagellar transport, leading to a failure in cilia assembly and resulting in severely shortened or absent cilia." }

        ]

    },

    "ARL13B": {

        "summary": { "lof_length": "Inhibits / Restricts", "percentage_ciliated": "Reduced cilia numbers", "source": "Expert DB" },

        "evidence": [

            { "id": "21940428", "source": "pubmed", "context": "The small GTPase ARL13B is critical for ciliary structure; its absence leads to stunted cilia with abnormal morphology and axonemal defects." }

        ]

    }

};



// --- Fetch Screen Data ---

async function fetchScreenData() {

    try {

        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cilia_screens_data.json');

        if (!response.ok) throw new Error(`Failed to fetch screen data: ${response.statusText}`);

        const data = await response.json();

        console.log('Screen data loaded successfully:', Object.keys(data).length, 'genes');

        if (Object.keys(data).length > 0) {

            const sampleGene = Object.keys(data)[0];

            console.log('Sample structure for', sampleGene, ':', Object.keys(data[sampleGene]));

            if (data[sampleGene].screens) {

                console.log('Number of screens for', sampleGene, ':', Object.keys(data[sampleGene].screens).length);

            }

        }

        return data;

    } catch (error) {

        console.error('Error fetching screen data:', error);

        return {};

    }

}



// --- Render Screen Data Table ---
function renderScreenDataTable(gene, screenInfo) {
    let summary = '';
    let tableHtml = '';

    if (!screenInfo || typeof screenInfo !== 'object') {
        return '<p class="status-not-found">No structured screen data available for this gene.</p>';
    }

    // --- START: PROPOSED FIX ---
    // This new block handles both the array format and the original expected object format.
    let screensObj = {};
    if (Array.isArray(screenInfo)) {
        // If screenInfo is an array, transform it into the expected object format.
        screensObj = screenInfo.reduce((acc, entry) => {
            if (entry.source && entry.result) {
                acc[entry.source] = {
                    // Determine the 'hit' status based on the result text.
                    hit: entry.result.toLowerCase() !== 'no effect', 
                    effect: entry.result,
                    details: 'From raw screen data' 
                };
            }
            return acc;
        }, {});
    } else if (screenInfo.screens) {
        // If it's the old format, use it directly.
        screensObj = screenInfo.screens;
    }
    // --- END: PROPOSED FIX ---

    // The rest of the function can now proceed as it was, using the correctly formatted screensObj
    const screenKeys = Object.keys(screensObj);
    const numScreens = 5; // Total number of screens displayed in the table
    const hitCount = screenKeys.filter(key => screensObj[key] && screensObj[key].hit === true).length;

    summary = `<p class="screen-summary">According to ${hitCount} out of ${numScreens} ciliary screens, <strong>${gene}</strong> was found to impact cilia (e.g., length or formation).</p>`;

    const screenNames = [
        { key: 'Kim2016', name: 'Kim et al. (2016) IMCD3 RNAi' },
        { key: 'Wheway2015', name: 'Wheway et al. (2015) RPE1 RNAi' },
        { key: 'Roosing2015', name: 'Roosing et al. (2015) hTERT-RPE1' },
        { key: 'Basu2023', name: 'Basu et al. (2023) MDCK CRISPR' },
        { key: 'Breslow2018', name: 'Breslow et al. (2018) Hedgehog Signaling' }
    ];

    tableHtml = `
        <table class="screen-table">
            <thead>
                <tr>
                    <th>Screen</th>
                    <th>Hit?</th>
                    <th>Effect</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody>
                ${screenNames.map(({ key, name }) => {
                    const screenData = screensObj[key] || { hit: false, effect: 'N/A', details: 'Not tested' };
                    const hitIcon = screenData.hit ? '✅' : '❌';
                    // Corrected logic for class name to handle different effect strings
                    const effectClass = screenData.hit 
                        ? (screenData.effect?.toLowerCase().includes('decreas') || screenData.effect?.toLowerCase().includes('increase') ? 'promotes' : 'inhibits') 
                        : 'no-effect';
                    return `
                        <tr>
                            <td>${name}</td>
                            <td>${hitIcon}</td>
                            <td class="effect-${effectClass}">${screenData.effect || 'N/A'}</td>
                            <td>${screenData.details || 'N/A'}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    return `${summary}${tableHtml}`;
}



// --- Heatmap Visualization (Adapted from plots.js) ---

function renderScreenSummaryHeatmap(genes, screenData) {

    // Clear previous plot

    const plotArea = document.getElementById('plot-display-area');

    if (!plotArea) return;



    // Corrected screen names and mappings

    const numberScreens = {

        'Kim et al. (2016) IMCD3 RNAi': 'Kim2016',

        'Wheway et al. (2015) RPE1 RNAi': 'Wheway2015',

        'Roosing et al. (2015) hTERT-RPE1': 'Roosing2015',

        'Basu et al. (2023) MDCK CRISPR': 'Basu2023'

    };

    const signalingScreens = {

        'Breslow et al. (2018) Hedgehog Signaling': 'Breslow2018'

    };

    const numberScreenOrder = Object.keys(numberScreens);

    const signalingScreenOrder = Object.keys(signalingScreens);



    const numberCategoryMap = {

        "Decreased cilia numbers": { value: 1, color: '#0571b0' },

        "Increased cilia numbers": { value: 2, color: '#ca0020' },

        "Causes Supernumerary Cilia": { value: 3, color: '#fdae61' },

        "No effect": { value: 4, color: '#fee090' },

        "Not in Screen": { value: 5, color: '#bdbdbd' },

        "Not Reported": { value: 6, color: '#636363' }

    };

    const signalingCategoryMap = {

        "Decreased Signaling (Positive Regulator)": { value: 1, color: '#2166ac' },

        "Increased Signaling (Negative Regulator)": { value: 2, color: '#d73027' },

        "No Significant Effect": { value: 3, color: '#fdae61' },

        "Not in Screen": { value: 4, color: '#bdbdbd' },

        "Not Reported": { value: 5, color: '#636363' }

    };



    const geneLabels = genes.map(g => g.toUpperCase());

    const zDataNumber = [], textDataNumber = [], zDataSignaling = [], textDataSignaling = [];



    genes.forEach(gene => {

        const numberRowValues = [], numberRowText = [], signalingRowValues = [], signalingRowText = [];



        numberScreenOrder.forEach(screenName => {

            const screenKey = numberScreens[screenName];

            let resultText = "Not in Screen";

            if (screenData[gene] && screenData[gene].screens) {

                const screenResult = screenData[gene].screens[screenKey];

                if (screenResult) resultText = screenResult.result || "Not Reported";

            }

            const mapping = numberCategoryMap[resultText] || numberCategoryMap["Not in Screen"];

            numberRowValues.push(mapping.value);

            numberRowText.push(resultText);

        });



        signalingScreenOrder.forEach(screenName => {

            const screenKey = signalingScreens[screenName];

            let resultText = "Not in Screen";

            if (screenData[gene] && screenData[gene].screens) {

                const screenResult = screenData[gene].screens[screenKey];

                if (screenResult) resultText = screenResult.result || "Not Reported";

            }

            const mapping = signalingCategoryMap[resultText] || signalingCategoryMap["Not in Screen"];

            signalingRowValues.push(mapping.value);

            signalingRowText.push(resultText);

        });



        zDataNumber.push(numberRowValues);

        textDataNumber.push(numberRowText);

        zDataSignaling.push(signalingRowValues);

        textDataSignaling.push(signalingRowText);

    });



    const trace1 = {

        x: numberScreenOrder,

        y: geneLabels,

        z: zDataNumber,

        customdata: textDataNumber,

        type: 'heatmap',

        colorscale: [

            [0, numberCategoryMap["Decreased cilia numbers"].color], [0.16, numberCategoryMap["Decreased cilia numbers"].color],

            [0.17, numberCategoryMap["Increased cilia numbers"].color], [0.33, numberCategoryMap["Increased cilia numbers"].color],

            [0.34, numberCategoryMap["Causes Supernumerary Cilia"].color], [0.50, numberCategoryMap["Causes Supernumerary Cilia"].color],

            [0.51, numberCategoryMap["No effect"].color], [0.67, numberCategoryMap["No effect"].color],

            [0.68, numberCategoryMap["Not Reported"].color], [0.84, numberCategoryMap["Not Reported"].color],

            [0.85, numberCategoryMap["Not in Screen"].color], [1.0, numberCategoryMap["Not in Screen"].color]

        ],

        showscale: false,

        hovertemplate: '<b>Gene:</b> %{y}<br><b>Screen:</b> %{x}<br><b>Result:</b> %{customdata}<extra></extra>',

        xgap: 1,

        ygap: 1

    };



    const trace2 = {

        x: signalingScreenOrder,

        y: geneLabels,

        z: zDataSignaling,

        customdata: textDataSignaling,

        type: 'heatmap',

        colorscale: [

            [0, signalingCategoryMap["Decreased Signaling (Positive Regulator)"].color], [0.25, signalingCategoryMap["Decreased Signaling (Positive Regulator)"].color],

            [0.26, signalingCategoryMap["Increased Signaling (Negative Regulator)"].color], [0.5, signalingCategoryMap["Increased Signaling (Negative Regulator)"].color],

            [0.51, signalingCategoryMap["No Significant Effect"].color], [0.75, signalingCategoryMap["No Significant Effect"].color],

            [0.76, signalingCategoryMap["Not Reported"].color], [0.85, signalingCategoryMap["Not Reported"].color],

            [0.86, signalingCategoryMap["Not in Screen"].color], [1.0, signalingCategoryMap["Not in Screen"].color]

        ],

        showscale: false,

        hovertemplate: '<b>Gene:</b> %{y}<br><b>Screen:</b> %{x}<br><b>Result:</b> %{customdata}<extra></extra>',

        xaxis: 'x2',

        yaxis: 'y1',

        xgap: 1,

        ygap: 1

    };



    const data = [trace1, trace2];



    const layout = {

        title: { text: 'Summary of Ciliary Screen Results', font: { size: 16, family: 'Arial', color: '#2c5aa0' } },

        grid: { rows: 1, columns: 2, pattern: 'independent' },

        xaxis: { domain: [0, 0.78], tickangle: -45, automargin: true },

        xaxis2: { domain: [0.8, 1.0], tickangle: -45, automargin: true },

        yaxis: { automargin: true, tickfont: { size: 10 } },

        margin: { l: 120, r: 220, b: 150, t: 80 },

        width: 950,

        height: 400 + (geneLabels.length * 30),

        annotations: []

    };



    const legend_x_pos = 1.02;

    const legend_spacing = 0.06;

    let current_y_pos = 1.0;



    layout.annotations.push({

        xref: 'paper', yref: 'paper', x: legend_x_pos, y: current_y_pos + 0.05,

        xanchor: 'left', text: '<b>Cilia Number/Structure</b>', showarrow: false, font: { size: 13 }

    });

    Object.keys(numberCategoryMap).forEach(key => {

        layout.annotations.push({

            xref: 'paper', yref: 'paper', x: legend_x_pos, y: current_y_pos,

            xanchor: 'left', yanchor: 'middle', text: `█ ${key}`,

            font: { color: numberCategoryMap[key].color, size: 12 },

            showarrow: false

        });

        current_y_pos -= legend_spacing;

    });



    current_y_pos -= 0.1;



    layout.annotations.push({

        xref: 'paper', yref: 'paper', x: legend_x_pos, y: current_y_pos + 0.05,

        xanchor: 'left', text: '<b>Hedgehog Signaling</b>', showarrow: false, font: { size: 13 }

    });

    Object.keys(signalingCategoryMap).forEach(key => {

        if (key !== "Not in Screen" && key !== "Not Reported") {

            layout.annotations.push({

                xref: 'paper', yref: 'paper', x: legend_x_pos, y: current_y_pos,

                xanchor: 'left', yanchor: 'middle', text: `█ ${key}`,

                font: { color: signalingCategoryMap[key].color, size: 12 },

                showarrow: false

            });

            current_y_pos -= legend_spacing;

        }

    });



    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });

}



// --- Live Literature Mining Engine (Client-Side) ---

async function analyzeGeneViaAPI(gene, resultCard) {

    const ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";

    const ELINK_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi";

    const EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

    

    const API_QUERY_KEYWORDS = [

        "cilia", "ciliary", "cilia length", "ciliogenesis", "ciliation", "loss of cilia",

        "fewer cilia", "fluid flow", "mucociliary", "multiciliated", "intraflagellar transport", "ciliopathy"

    ];

    const LOCAL_ANALYSIS_KEYWORDS = new Set([

        'cilia', 'ciliary', 'cilium', 'axoneme', 'basal body', 'transition zone', 'centriole', 'ciliogenesis',

        'ciliation', 'intraflagellar transport', 'ift', 'cilia assembly', 'cilia disassembly', 'ciliary motility',

        'shorter', 'shortened', 'longer', 'elongated', 'fewer', 'loss of', 'absent cilia', 'reduction', 'reduced',

        'decrease', 'increased', 'increase', 'abnormal length', 'flow', 'fluid flow', 'cilia-generated',

        'mechanosensor', 'ciliary signaling', 'bead displacement', 'mucociliary', 'multiciliated', 'kidney tubule',

        'photoreceptor', 'acls', 'acrocallosal syndrome', 'alms', 'alström syndrome',

        'autosomal dominant polycystic kidney disease', 'adpkd', 'autosomal recessive polycystic kidney disease', 'arpkd',

        'bardet–biedl syndrome', 'bbs', 'joubert syndrome', 'jbts', 'kallmann syndrome',

        'leber congenital amaurosis', 'lca', 'meckel–gruber syndrome', 'mks',

        'nephronophthisis', 'nphp', 'orofaciodigital syndrome', 'ofd', 'polycystic kidney disease', 'pkd',

        'senior-løken syndrome', 'slsn', 'short-rib thoracic dysplasia', 'srtd', 'ciliopathy'

    ]);



    const geneRegex = new RegExp(`\\b${gene}\\b`, 'i');

    const sentSplitRegex = /(?<=[.!?])\s+/;

    let foundEvidence = [];



    try {

        const kwClause = API_QUERY_KEYWORDS.map(k => `"${k}"[Title/Abstract]`).join(" OR ");

        const query = `("${gene}"[Title/Abstract]) AND (${kwClause})`;

        const searchParams = new URLSearchParams({ db: 'pubmed', term: query, retmode: 'json', retmax: '25' });

        

        const searchResp = await fetch(`${ESEARCH_URL}?${searchParams}`);

        if (!searchResp.ok) throw new Error(`NCBI ESearch failed: ${searchResp.statusText}`);

        const searchData = await searchResp.json();

        const pmids = searchData.esearchresult?.idlist || [];



        if (pmids.length === 0) {

            return [];

        }



        await sleep(350);

        const linkParams = new URLSearchParams({

            dbfrom: 'pubmed',

            db: 'pmc',

            id: pmids.join(','),

            retmode: 'json'

        });

        const linkResp = await fetch(`${ELINK_URL}?${linkParams}`);

        if (!linkResp.ok) throw new Error(`NCBI ELink failed: ${linkResp.statusText}`);

        const linkData = await linkResp.json();

        

        const pmcIds = [];

        const linkSets = linkData.linksets || [];

        for (const linkSet of linkSets) {

            const links = linkSet.linksetdbs?.find(set => set.dbto === 'pmc')?.links || [];

            pmcIds.push(...links);

        }



        let articles = [];

        if (pmcIds.length > 0) {

            await sleep(350);

            const fetchParams = new URLSearchParams({ db: 'pmc', id: pmcIds.join(','), retmode: 'xml', rettype: 'full' });

            const fetchResp = await fetch(`${EFETCH_URL}?${fetchParams}`);

            if (fetchResp.ok) {

                const xmlText = await fetchResp.text();

                const parser = new DOMParser();

                const xmlDoc = parser.parseFromString(xmlText, "application/xml");

                articles = xmlDoc.getElementsByTagName('article');

            }

        }



        if (articles.length === 0) {

            await sleep(350);

            const fetchParams = new URLSearchParams({ db: 'pubmed', id: pmids.join(','), retmode: 'xml', rettype: 'abstract' });

            const fetchResp = await fetch(`${EFETCH_URL}?${fetchParams}`);

            if (fetchResp.ok) {

                const xmlText = await fetchResp.text();

                const parser = new DOMParser();

                const xmlDoc = parser.parseFromString(xmlText, "application/xml");

                articles = xmlDoc.getElementsByTagName('PubmedArticle');

            }

        }



        for (const article of articles) {

            let pmid, textContent;

            if (article.tagName === 'article') {

                pmid = article.querySelector('article-id[pub-id-type="pmid"]')?.textContent || 

                       article.querySelector('article-id[pub-id-type="pmcid"]')?.textContent;

                const title = article.querySelector('article-title')?.textContent || '';

                const body = article.querySelector('body') ? Array.from(article.querySelectorAll('body p, body sec, body para')).map(el => el.textContent).join(' ') : '';

                textContent = `${title}. ${body}`;

            } else {

                pmid = article.querySelector('MedlineCitation > PMID')?.textContent;

                const title = article.querySelector('ArticleTitle')?.textContent || '';

                const abstractNode = article.querySelector('Abstract');

                let abstractText = '';

                if (abstractNode) {

                    abstractText = Array.from(abstractNode.getElementsByTagName('AbstractText')).map(el => el.textContent).join(' ');

                }

                textContent = `${title}. ${abstractText}`;

            }



            if (!textContent || !geneRegex.test(textContent)) continue;



            const sentences = textContent.split(sentSplitRegex).filter(s => s.trim());

            for (const sent of sentences) {

                const sentLower = sent.toLowerCase();

                if (geneRegex.test(sentLower) && [...LOCAL_ANALYSIS_KEYWORDS].some(kw => sentLower.includes(kw.toLowerCase()))) {

                    foundEvidence.push({

                        id: pmid || 'unknown',

                        source: 'pubmed',

                        context: sent.trim().replace(geneRegex, `<mark>${gene}</mark>`)

                    });

                }

            }

        }

    } catch (error) {

        console.error(`Failed to fetch literature for ${gene}:`, error);

        const errorEl = resultCard ? resultCard.querySelector('.status-searching') : null;

        if (errorEl) {

            errorEl.textContent = 'Literature Search Failed';

            errorEl.className = 'status-not-found';

        }

    }

    

    return foundEvidence;

}



// --- UI and Event Handling ---

function setupCiliAIEventListeners() {

    const analyzeBtn = document.getElementById('analyzeBtn');

    const aiQueryBtn = document.getElementById('aiQueryBtn');

    const visualizeBtn = document.getElementById('visualizeBtn');

    const resultsContainer = document.getElementById('resultsContainer');



    if (analyzeBtn) {

        analyzeBtn.addEventListener('click', analyzeGenesFromInput);

    }

    if (aiQueryBtn) {

        aiQueryBtn.addEventListener('click', handleAIQuery);

    }

    if (visualizeBtn) {

        visualizeBtn.addEventListener('click', () => {

            const geneInput = document.getElementById('geneInput');

            if (!geneInput) return;

            const genes = geneInput.value.split(/[\s,]+/).map(g => g.trim().toUpperCase()).filter(g => g !== '');

            if (genes.length > 0) {

                fetchScreenData().then(screenData => {

                    renderScreenSummaryHeatmap(genes, screenData);

                });

            }

        });

    }



    const geneInput = document.getElementById('geneInput');

    if (geneInput) {

        geneInput.addEventListener('keydown', (e) => {

            if (e.key === 'Enter' && !e.shiftKey) {

                e.preventDefault();

                analyzeGenesFromInput();

            }

        });

    }

    

    const aiQueryInput = document.getElementById('aiQueryInput');

    if (aiQueryInput) {

        aiQueryInput.addEventListener('keydown', (e) => {

            if (e.key === 'Enter') {

                handleAIQuery();

            }

        });

    }



    if (resultsContainer) {

        resultsContainer.addEventListener('click', function(e) {

            if (e.target && e.target.classList.contains('evidence-toggle')) {

                const content = e.target.nextElementSibling;

                if (content) {

                    const isVisible = content.style.display === 'block';

                    content.style.display = isVisible ? 'none' : 'block';

                    const count = e.target.dataset.count || 0;

                    e.target.textContent = isVisible ? `Show Evidence (${count}) ▾` : `Hide Evidence (${count}) ▴`;

                }

            }

        });

    }

}



function handleAIQuery() {

    const aiQueryInput = document.getElementById('aiQueryInput');

    if (!aiQueryInput) return;

    const query = aiQueryInput.value.trim();

    const geneRegex = /\b([A-Z0-9]{3,})\b/g;

    const matches = query.match(geneRegex);

    

    if (matches && matches.length > 0) {

        const detectedGene = matches[0].toUpperCase();

        const geneInput = document.getElementById('geneInput');

        if (geneInput) geneInput.value = detectedGene;

        runAnalysis([detectedGene]);

    } else {

        const resultsContainer = document.getElementById('resultsContainer');

        if (resultsContainer) {

            resultsContainer.innerHTML = `<p class="status-not-found">Could not identify a valid gene symbol in your question. Please try again, e.g., "What does IFT88 do?".</p>`;

            const resultsSection = document.getElementById('resultsSection');

            if (resultsSection) resultsSection.style.display = 'block';

        }

    }

}



function analyzeGenesFromInput() {

    const geneInput = document.getElementById('geneInput');

    if (!geneInput) return;

    const genes = geneInput.value.split(/[\s,]+/).map(g => g.trim().toUpperCase()).filter(g => g !== '');

    

    if (genes.length === 0) {

        const resultsContainer = document.getElementById('resultsContainer');

        if (resultsContainer) {

            resultsContainer.innerHTML = '<p class="status-not-found">Please enter at least one gene symbol.</p>';

            const resultsSection = document.getElementById('resultsSection');

            if (resultsSection) resultsSection.style.display = 'block';

        }

        return;

    }

    

    const sanitizedGenes = [...new Set(genes)];

    runAnalysis(sanitizedGenes);

}



async function runAnalysis(geneList) {

    const resultsContainer = document.getElementById('resultsContainer');

    const resultsSection = document.getElementById('resultsSection');

    const analyzeBtn = document.getElementById('analyzeBtn');

    const visualizeBtn = document.getElementById('visualizeBtn');

    if (!resultsContainer || !resultsSection || !analyzeBtn || !visualizeBtn) return;

    

    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'hybrid';



    resultsContainer.innerHTML = '';

    resultsSection.style.display = 'block';

    analyzeBtn.disabled = true;

    analyzeBtn.textContent = 'Analyzing...';

    visualizeBtn.style.display = 'none';



    const screenData = await fetchScreenData();



    geneList.forEach(gene => {

        resultsContainer.insertAdjacentHTML('beforeend', createPlaceholderCard(gene, mode));

    });



    for (const gene of geneList) {

        const resultCard = document.getElementById(`card-${gene}`);

        let dbData = null;

        let apiEvidence = [];

        let screenEvidence = [];



        if (mode === 'expert' || mode === 'hybrid') {

            dbData = CILI_AI_DB[gene] || null;

            if (screenData && screenData[gene]) {

                const screenInfo = screenData[gene];

                if (!dbData && (screenInfo.cilia_length || screenInfo.percent_ciliated)) {

                    dbData = {

                        summary: {

                            lof_length: screenInfo.cilia_length || 'Unknown',

                            percentage_ciliated: screenInfo.percent_ciliated || 'Unknown',

                            source: 'Screen Data'

                        },

                        evidence: []

                    };

                }

                screenEvidence = [{

                    id: `screen-${gene}`,

                    source: 'screen_data',

                    context: renderScreenDataTable(gene, screenInfo)

                }];

            }

        }

        if (mode === 'nlp' || mode === 'hybrid') {

            apiEvidence = await analyzeGeneViaAPI(gene, resultCard);

        }

        

        const allEvidence = [...(dbData?.evidence || []), ...apiEvidence, ...screenEvidence];

        

        const finalHtml = createResultCard(gene, dbData, allEvidence, mode);

        if (resultCard) {

            resultCard.outerHTML = finalHtml;

        }

    }



    analyzeBtn.disabled = false;

    analyzeBtn.textContent = '🔍 Analyze Genes';

    visualizeBtn.style.display = 'block';

}



function createPlaceholderCard(gene, mode) {

    let statusText = 'Fetching from Expert DB and Screen Data...';

    if (mode === 'nlp') statusText = 'Searching live literature...';

    if (mode === 'hybrid') statusText = 'Checking Expert DB, Screen Data & Searching Literature...';

    return `<div class="result-card" id="card-${gene}"><h3>${gene} - <span class="status-searching">${statusText}</span></h3></div>`;

}



function createResultCard(gene, dbData, allEvidence, mode) {

    let statusText = allEvidence.length > 0 ? 'Evidence Found' : 'No Data Found';

    let statusClass = allEvidence.length > 0 ? 'status-found' : 'status-not-found';

    

    let summaryHtml = '';

    if (dbData && dbData.summary) {

        const lofClass = dbData.summary.lof_length.toLowerCase().replace(/[^a-z]/g, '-');

        const percClass = dbData.summary.percentage_ciliated.toLowerCase().replace(/[^a-z]/g, '-');

        summaryHtml = `

            <div class="prediction-grid">

                <div class="prediction-box ${lofClass || 'no-effect'}">

                    <h4>Loss-of-Function (Cilia Length)</h4>

                    <p>${dbData.summary.lof_length}</p>

                </div>

                <div class="prediction-box ${percClass || 'no-effect'}">

                    <h4>Percentage Ciliated</h4>

                    <p>${dbData.summary.percentage_ciliated}</p>

                </div>

            </div>

        `;

    } else {

        summaryHtml = '<p>No summary prediction available. Review literature and screen evidence for insights.</p>';

    }



    let evidenceHtml = '';

    if (allEvidence.length > 0) {

        const evidenceSnippets = allEvidence.map(ev => {

            if (ev.source === 'screen_data') {

                return `<div class="evidence-snippet screen-evidence">${ev.context}</div>`;

            } else {

                return `

                    <div class="evidence-snippet">

                        ${ev.context.replace(/<mark>(\w+)<\/mark>/g, '<mark>$1</mark>')}

                        <br><strong>Source: ${ev.source.toUpperCase()} (${ev.id})</strong>

                    </div>

                `;

            }

        }).join('');



        const screenEv = allEvidence.find(ev => ev.source === 'screen_data');

        const otherEvCount = allEvidence.length - (screenEv ? 1 : 0);

        evidenceHtml = `

            <div class="evidence-section">

                ${screenEv ? `

                    <h4>Ciliary Screen Data</h4>

                    <div class="screen-evidence-container">${screenEv.context}</div>

                ` : ''}

                ${otherEvCount > 0 ? `

                    <button class="evidence-toggle" data-count="${otherEvCount}">Show Other Evidence (${otherEvCount}) ▾</button>

                    <div class="evidence-content">

                        ${evidenceSnippets.replace(screenEv?.context || '', '')}

                    </div>

                ` : ''}

            </div>

        `;

    }



    return `

        <div class="result-card">

            <h3>${gene} - <span class="${statusClass}">${statusText}</span></h3>

            ${summaryHtml}

            ${evidenceHtml}

        </div>

    `;

}



// Expose all functions globally for compatibility with globals.js router

window.setupCiliAIEventListeners = setupCiliAIEventListeners;

window.handleAIQuery = handleAIQuery;

window.analyzeGenesFromInput = analyzeGenesFromInput;

window.runAnalysis = runAnalysis;

window.analyzeGeneViaAPI = analyzeGeneViaAPI;

window.fetchScreenData = fetchScreenData;

window.createResultCard = createResultCard;

window.createPlaceholderCard = createPlaceholderCard;

window.renderScreenSummaryHeatmap = renderScreenSummaryHeatmap;
