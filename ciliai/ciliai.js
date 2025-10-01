// ciliai.js

// This function will be called by the router in globals.js
function displayCiliAIPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    document.querySelector('.cilia-panel').style.display = 'none';

    // Inject the HTML structure from the user's CiliAI code
    contentArea.innerHTML = `
        <div class="ciliai-container">
            <div class="ciliai-header">
                <h1><span class="ciliai-icon">🧬</span> CiliAI</h1>
                <p>Gene Cilia Phenotype Analyzer - Discover how your genes affect cilia</p>
            </div>
            
            <div class="ciliai-main-content">
                <div class="info-box">
                    <h3>Welcome to CiliAI!</h3>
                    <p>Enter a gene of interest to discover its effects on cilia length and formation. We combine expert-curated data with AI-powered literature mining to provide comprehensive phenotype predictions.</p>
                    <div class="example-genes">
                        <span class="example-gene" data-gene="HDAC6">HDAC6</span>
                        <span class="example-gene" data-gene="IFT88">IFT88</span>
                        <span class="example-gene" data-gene="ARL13B">ARL13B</span>
                        <span class="example-gene" data-gene="ARF4">ARF4</span>
                    </div>
                </div>

                <div class="input-section">
                    <div class="input-group">
                        <label for="geneInput">Gene Symbol:</label>
                        <input type="text" id="geneInput" class="gene-input" placeholder="Enter a single gene symbol, e.g., HDAC6"/>
                    </div>

                    <div class="input-group">
                        <label>Analysis Mode:</label>
                        <div class="mode-selector">
                            <div class="mode-option">
                                <input type="radio" id="hybrid" name="mode" value="hybrid" checked>
                                <label for="hybrid">
                                    <span class="mode-icon">🔬</span>
                                    <div>
                                        <strong>Hybrid</strong><br>
                                        <small>Expert DB + Literature</small>
                                    </div>
                                </label>
                            </div>
                            <div class="mode-option">
                                <input type="radio" id="expert" name="mode" value="expert">
                                <label for="expert">
                                    <span class="mode-icon">🏛️</span>
                                    <div>
                                        <strong>Expert Only</strong><br>
                                        <small>Curated database</small>
                                    </div>
                                </label>
                            </div>
                            <div class="mode-option">
                                <input type="radio" id="nlp" name="mode" value="nlp">
                                <label for="nlp">
                                    <span class="mode-icon">📚</span>
                                    <div>
                                        <strong>Literature</strong><br>
                                        <small>AI text mining</small>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <button class="analyze-btn" id="analyzeBtn">
                        🔍 Analyze Gene
                    </button>
                </div>

                <div id="resultsSection" class="results-section" style="display: none;">
                    <h2>Analysis Results</h2>
                    <div id="resultsContainer"></div>
                </div>
            </div>
        </div>
        <style>
            /* Add specific styles for CiliAI page to avoid conflicts */
            .ciliai-container {
                font-family: 'Arial', sans-serif;
                max-width: 900px;
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
                font-size: 2.5rem;
                color: #2c5aa0; /* Match CiliaHub theme */
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
            }
            .ciliai-header p {
                font-size: 1.1rem;
                color: #555;
            }
            .info-box {
                background-color: #e8f4fd;
                border: 1px solid #bbdefb;
                padding: 1.5rem;
                border-radius: 8px;
                margin-bottom: 2rem;
            }
            .example-genes {
                margin-top: 1rem;
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
            }
            .example-gene {
                background-color: #2c5aa0;
                color: white;
                padding: 0.3rem 0.8rem;
                border-radius: 15px;
                cursor: pointer;
                font-size: 0.9rem;
                transition: background-color 0.2s;
            }
            .example-gene:hover {
                background-color: #1e4273;
            }
            .input-section {
                background-color: #fff;
                padding: 2rem;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
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
            .gene-input {
                width: 100%;
                padding: 0.8rem;
                border: 1px solid #ccc;
                border-radius: 4px;
                font-size: 1rem;
            }
            .mode-selector {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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
            .mode-icon { font-size: 1.5rem; }
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
            .analyze-btn:hover {
                background-color: #218838;
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
                margin-bottom: 1rem;
            }
            .result-card h3 {
                margin-top: 0;
                color: #2c5aa0;
            }
            .result-card .status-found { color: #28a745; }
            .result-card .status-not-found { color: #dc3545; }
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
            }
            .prediction-box.promotes { background-color: #d4edda; border: 1px solid #c3e6cb; }
            .prediction-box.inhibits { background-color: #f8d7da; border: 1px solid #f5c6cb; }
            .prediction-box.no-effect { background-color: #e2e3e5; border: 1px solid #d6d8db; }
            .prediction-box.conflicting { background-color: #fff3cd; border: 1px solid #ffeeba; }
            .prediction-box h4 { margin: 0 0 0.5rem 0; color: #333; }
            .prediction-box p { margin: 0; font-size: 1.2rem; font-weight: bold; }
        </style>
    `;

    // Attach event listeners after HTML is injected
    setupCiliAIEventListeners();
}

// Mock database simulating the output of the Python pipeline
const CILI_AI_DATA = {
    "HDAC6": {
        "overexpression_length": "Inhibits / Restricts",
        "lof_length": "Promotes / Maintains",
        "percentage_ciliated": "No effect",
        "source": "Expert DB + Literature Mining"
    },
    "IFT88": {
        "overexpression_length": "No effect",
        "lof_length": "Inhibits / Restricts",
        "percentage_ciliated": "Reduced cilia numbers",
        "source": "Expert DB"
    },
    "ARL13B": {
        "overexpression_length": "Promotes / Maintains",
        "lof_length": "Inhibits / Restricts",
        "percentage_ciliated": "Reduced cilia numbers",
        "source": "Expert DB + Literature Mining"
    },
    "ARF4": {
        "overexpression_length": "Conflicting Data",
        "lof_length": "Inhibits / Restricts",
        "percentage_ciliated": "No effect",
        "source": "Literature Mining"
    }
};

function setupCiliAIEventListeners() {
    document.getElementById('analyzeBtn').addEventListener('click', analyzeGene);
    document.getElementById('geneInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            analyzeGene();
        }
    });

    document.querySelectorAll('.example-gene').forEach(span => {
        span.addEventListener('click', (e) => {
            const gene = e.target.dataset.gene;
            document.getElementById('geneInput').value = gene;
            analyzeGene();
        });
    });
}

function analyzeGene() {
    const geneInput = document.getElementById('geneInput');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsSection = document.getElementById('resultsSection');

    // Sanitize and get the single gene query
    const query = geneInput.value.trim().toUpperCase();
    
    if (!query) {
        resultsContainer.innerHTML = '<p class="status-not-found">Please enter a gene symbol.</p>';
        resultsSection.style.display = 'block';
        return;
    }

    const result = CILI_AI_DATA[query];
    let html = '';

    if (result) {
        html = `
            <div class="result-card">
                <h3>${query} - <span class="status-found">Prediction Found</span></h3>
                <p><strong>Data Source:</strong> ${result.source}</p>
                <div class="prediction-grid">
                    ${createPredictionBox('Cilia Length (LoF)', result.lof_length)}
                    ${createPredictionBox('Cilia Formation', result.percentage_ciliated)}
                </div>
            </div>
        `;
    } else {
         html = `
            <div class="result-card">
                <h3>${query} - <span class="status-not-found">Prediction Not Found</span></h3>
                <p>No pre-computed prediction is available for this gene in our database. This may mean it has no known ciliary role or has not yet been analyzed.</p>
            </div>
        `;
    }

    resultsContainer.innerHTML = html;
    resultsSection.style.display = 'block';
}

function createPredictionBox(title, prediction) {
    let className = '';
    let text = prediction;
    
    switch (prediction) {
        case 'Promotes / Maintains':
            className = 'promotes';
            break;
        case 'Inhibits / Restricts':
        case 'Reduced cilia numbers':
            className = 'inhibits';
            text = 'Inhibits / Reduces';
            break;
        case 'No effect':
            className = 'no-effect';
            break;
        case 'Conflicting Data':
            className = 'conflicting';
            break;
        default:
            className = 'no-effect';
            text = 'Not Reported';
    }

    return `
        <div class="prediction-box ${className}">
            <h4>${title}</h4>
            <p>${text}</p>
        </div>
    `;
}
