// ciliai.js

// This function will be called by the router in globals.js
function displayCiliAIPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    document.querySelector('.cilia-panel').style.display = 'none';

    // Inject the HTML structure
    contentArea.innerHTML = `
        <div class="ciliai-container">
            <div class="ciliai-header">
                <h1><span class="ciliai-icon">🧬</span> CiliAI</h1>
                <p>Gene Cilia Phenotype Analyzer - Discover how your genes affect cilia</p>
            </div>
            
            <div class="ciliai-main-content">
                <div class="info-box">
                    <h3>Welcome to CiliAI!</h3>
                    <p>Enter multiple genes to discover their effects on cilia length and formation. We combine expert-curated data with AI-powered literature mining to provide comprehensive phenotype predictions.</p>
                    <div class="example-genes">
                        <span class="example-gene" data-gene="HDAC6">HDAC6</span>
                        <span class="example-gene" data-gene="IFT88">IFT88</span>
                        <span class="example-gene" data-gene="ARL13B">ARL13B</span>
                        <span class="example-gene" data-gene="ARF4">ARF4</span>
                    </div>
                </div>

                <div class="input-section">
                    <div class="input-group">
                        <label for="geneInput">Gene Symbols (comma-separated):</label>
                        <input type="text" id="geneInput" class="gene-input" placeholder="Enter multiple genes, e.g., HDAC6, IFT88, ARL13B"/>
                        <small class="input-hint">You can enter multiple genes separated by commas</small>
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

                    <div class="input-group">
                        <label for="naturalLanguageQuery">Natural Language Query (Optional):</label>
                        <input type="text" id="naturalLanguageQuery" class="gene-input" placeholder="e.g., Does gene X affect cilia length?"/>
                        <small class="input-hint">Ask specific questions about gene functions in cilia biology</small>
                    </div>

                    <button class="analyze-btn" id="analyzeBtn">
                        🔍 Analyze Genes
                    </button>
                </div>

                <div id="loadingSection" class="loading-section" style="display: none;">
                    <div class="loading-spinner"></div>
                    <p>Searching literature and analyzing genes... This may take a few moments.</p>
                </div>

                <div id="resultsSection" class="results-section" style="display: none;">
                    <h2>Analysis Results</h2>
                    <div class="results-header">
                        <button id="toggleTextRetrieval" class="toggle-btn">
                            📖 Show Text Evidence
                        </button>
                    </div>
                    <div id="resultsContainer"></div>
                </div>
            </div>
        </div>
        <style>
            .ciliai-container {
                font-family: 'Arial', sans-serif;
                max-width: 1200px;
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
                color: #2c5aa0;
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
            .input-hint {
                color: #666;
                font-size: 0.85rem;
                margin-top: 0.25rem;
                display: block;
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
            .analyze-btn:disabled {
                background-color: #6c757d;
                cursor: not-allowed;
            }
            .loading-section {
                text-align: center;
                padding: 2rem;
                background-color: #fff;
                border-radius: 8px;
                margin-top: 2rem;
            }
            .loading-spinner {
                border: 4px solid #f3f3f3;
                border-top: 4px solid #2c5aa0;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 1rem;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .results-section {
                margin-top: 2rem;
                padding: 2rem;
                background-color: #fff;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            }
            .results-header {
                display: flex;
                justify-content: flex-end;
                margin-bottom: 1rem;
            }
            .toggle-btn {
                background-color: #6c757d;
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.9rem;
            }
            .toggle-btn:hover {
                background-color: #5a6268;
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
            .text-evidence {
                margin-top: 1rem;
                padding: 1rem;
                background-color: #f8f9fa;
                border-radius: 6px;
                border-left: 4px solid #2c5aa0;
            }
            .text-evidence h4 {
                margin-top: 0;
                color: #2c5aa0;
            }
            .evidence-item {
                margin-bottom: 1rem;
                padding: 0.75rem;
                background-color: white;
                border-radius: 4px;
                border: 1px solid #e9ecef;
            }
            .evidence-source {
                font-size: 0.85rem;
                color: #6c757d;
                margin-bottom: 0.5rem;
            }
            .evidence-context {
                font-style: italic;
                color: #495057;
            }
            .evidence-effects {
                margin-top: 0.5rem;
                font-size: 0.9rem;
            }
            .effect-tag {
                display: inline-block;
                background-color: #e9ecef;
                padding: 0.2rem 0.5rem;
                border-radius: 12px;
                font-size: 0.8rem;
                margin-right: 0.5rem;
            }
            .natural-language-result {
                background-color: #e8f4fd;
                border: 1px solid #bbdefb;
                padding: 1rem;
                border-radius: 6px;
                margin-bottom: 1rem;
            }
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
        "source": "Expert DB + Literature Mining",
        "articles": [
            {
                "id": "12345678",
                "source": "pubmed",
                "title": "HDAC6 regulates ciliary length through tubulin deacetylation",
                "evidence": [
                    {
                        "context": "HDAC6 knockout resulted in longer cilia in primary mouse embryonic fibroblasts, suggesting HDAC6 normally restricts ciliary length through tubulin deacetylation.",
                        "effects": ["longer"],
                        "source": "pubmed"
                    }
                ]
            }
        ]
    },
    "IFT88": {
        "overexpression_length": "No effect",
        "lof_length": "Inhibits / Restricts",
        "percentage_ciliated": "Reduced cilia numbers",
        "source": "Expert DB",
        "articles": [
            {
                "id": "23456789",
                "source": "pmc",
                "title": "IFT88 is essential for ciliary assembly and maintenance",
                "evidence": [
                    {
                        "context": "Loss of IFT88 resulted in complete absence of cilia in kidney epithelial cells, demonstrating its crucial role in ciliogenesis.",
                        "effects": ["fewer"],
                        "source": "pmc"
                    }
                ]
            }
        ]
    }
};

function setupCiliAIEventListeners() {
    document.getElementById('analyzeBtn').addEventListener('click', analyzeGenes);
    document.getElementById('geneInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            analyzeGenes();
        }
    });

    document.getElementById('toggleTextRetrieval').addEventListener('click', toggleTextRetrieval);

    document.querySelectorAll('.example-gene').forEach(span => {
        span.addEventListener('click', (e) => {
            const gene = e.target.dataset.gene;
            document.getElementById('geneInput').value = gene;
        });
    });
}

async function analyzeGenes() {
    const geneInput = document.getElementById('geneInput');
    const naturalLanguageQuery = document.getElementById('naturalLanguageQuery');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsSection = document.getElementById('resultsSection');
    const loadingSection = document.getElementById('loadingSection');
    const analyzeBtn = document.getElementById('analyzeBtn');

    // Get and sanitize genes
    const genes = geneInput.value.trim().toUpperCase().split(',').map(g => g.trim()).filter(g => g);
    const nlQuery = naturalLanguageQuery.value.trim();
    const mode = document.querySelector('input[name="mode"]:checked').value;

    if (genes.length === 0) {
        resultsContainer.innerHTML = '<p class="status-not-found">Please enter at least one gene symbol.</p>';
        resultsSection.style.display = 'block';
        return;
    }

    // Show loading state
    analyzeBtn.disabled = true;
    loadingSection.style.display = 'block';
    resultsSection.style.display = 'none';

    try {
        let results = [];

        // Process each gene
        for (const gene of genes) {
            let result;
            
            if (mode === 'nlp' || mode === 'hybrid') {
                // Use literature mining for NLP and hybrid modes
                result = await performLiteratureAnalysis(gene, mode);
            } else {
                // Use expert database only
                result = CILI_AI_DATA[gene] || createNotFoundResult(gene);
            }
            
            results.push({ gene, ...result });
        }

        // Process natural language query if provided
        let nlResults = null;
        if (nlQuery) {
            nlResults = await processNaturalLanguageQuery(nlQuery, genes);
        }

        // Display results
        displayResults(results, nlResults, mode);
        
    } catch (error) {
        console.error('Analysis error:', error);
        resultsContainer.innerHTML = `
            <div class="result-card">
                <h3>Analysis Error</h3>
                <p>Sorry, there was an error processing your request. Please try again.</p>
            </div>
        `;
    } finally {
        loadingSection.style.display = 'none';
        resultsSection.style.display = 'block';
        analyzeBtn.disabled = false;
    }
}

async function performLiteratureAnalysis(gene, mode) {
    // Simulate API call to Python backend
    return new Promise((resolve) => {
        setTimeout(() => {
            if (CILI_AI_DATA[gene]) {
                resolve(CILI_AI_DATA[gene]);
            } else {
                resolve(createNotFoundResult(gene));
            }
        }, 1500); // Simulate network delay
    });
}

async function processNaturalLanguageQuery(query, genes) {
    // Simulate natural language processing
    return new Promise((resolve) => {
        setTimeout(() => {
            const responses = genes.map(gene => {
                const result = CILI_AI_DATA[gene];
                if (result) {
                    return {
                        gene,
                        answer: `Based on literature analysis, ${gene} ${result.lof_length.toLowerCase()} cilia length when knocked out and ${result.percentage_ciliated.toLowerCase()} cilia formation.`,
                        confidence: "High",
                        sources: result.articles ? result.articles.length : 0
                    };
                } else {
                    return {
                        gene,
                        answer: `No specific literature found about ${gene}'s role in cilia biology.`,
                        confidence: "Low",
                        sources: 0
                    };
                }
            });
            
            resolve({
                query,
                responses
            });
        }, 1000);
    });
}

function createNotFoundResult(gene) {
    return {
        "overexpression_length": "Not found",
        "lof_length": "Not found", 
        "percentage_ciliated": "Not found",
        "source": "No data available",
        "articles": []
    };
}

function displayResults(geneResults, nlResults, mode) {
    const resultsContainer = document.getElementById('resultsContainer');
    let html = '';

    // Display natural language results if available
    if (nlResults) {
        html += `
            <div class="natural-language-result">
                <h3>Natural Language Query: "${nlResults.query}"</h3>
                ${nlResults.responses.map(response => `
                    <div class="evidence-item">
                        <h4>${response.gene}</h4>
                        <p>${response.answer}</p>
                        <div class="evidence-source">
                            Confidence: ${response.confidence} | Sources: ${response.sources}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Display gene results
    geneResults.forEach(result => {
        const hasData = result.source !== "No data available";
        
        html += `
            <div class="result-card">
                <h3>${result.gene} - <span class="${hasData ? 'status-found' : 'status-not-found'}">${hasData ? 'Prediction Found' : 'Prediction Not Found'}</span></h3>
                <p><strong>Data Source:</strong> ${result.source}</p>
                <div class="prediction-grid">
                    ${createPredictionBox('Cilia Length (LoF)', result.lof_length)}
                    ${createPredictionBox('Cilia Formation', result.percentage_ciliated)}
                </div>
                ${result.articles && result.articles.length > 0 ? createTextEvidence(result.articles, result.gene) : ''}
            </div>
        `;
    });

    resultsContainer.innerHTML = html;
    
    // Reset text retrieval toggle
    document.getElementById('toggleTextRetrieval').textContent = '📖 Show Text Evidence';
    document.querySelectorAll('.text-evidence').forEach(el => {
        el.style.display = 'none';
    });
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
        case 'Not found':
            className = 'no-effect';
            text = 'Not Reported';
            break;
        default:
            className = 'no-effect';
            text = prediction;
    }

    return `
        <div class="prediction-box ${className}">
            <h4>${title}</h4>
            <p>${text}</p>
        </div>
    `;
}

function createTextEvidence(articles, gene) {
    let evidenceHtml = '';
    
    articles.forEach(article => {
        article.evidence.forEach(evidence => {
            evidenceHtml += `
                <div class="evidence-item">
                    <div class="evidence-source">
                        <strong>${article.source.toUpperCase()}:</strong> ${article.id} - "${article.title}"
                    </div>
                    <div class="evidence-context">
                        "${evidence.context}"
                    </div>
                    <div class="evidence-effects">
                        ${evidence.effects.map(effect => 
                            `<span class="effect-tag">${effect}</span>`
                        ).join('')}
                    </div>
                </div>
            `;
        });
    });

    return `
        <div class="text-evidence" style="display: none;">
            <h4>Literature Evidence for ${gene}</h4>
            ${evidenceHtml}
        </div>
    `;
}

function toggleTextRetrieval() {
    const toggleBtn = document.getElementById('toggleTextRetrieval');
    const textEvidences = document.querySelectorAll('.text-evidence');
    
    const isHidden = textEvidences[0]?.style.display !== 'block';
    
    textEvidences.forEach(el => {
        el.style.display = isHidden ? 'block' : 'none';
    });
    
    toggleBtn.textContent = isHidden ? '📖 Hide Text Evidence' : '📖 Show Text Evidence';
}
