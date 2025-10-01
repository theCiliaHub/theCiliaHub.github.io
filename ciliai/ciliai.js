// ciliai.js - RESTRUCTURED FOR CILIAHUB WITH SIMULATED ANALYSIS

// ============================================================================
// DATABASES & SIMULATIONS
// ============================================================================

// Simulated expert database
const expertDatabase = {
    'ARF4': { ensembl_id: 'ENSG00000168374', cilia_length: 'shorter_cilia', cilia_number: 'reduced_numbers', confidence: 0.95, source: 'CiliaHub_Expert' },
    'ARFGAP1': { ensembl_id: 'ENSG00000101199', cilia_length: 'no_effect', cilia_number: 'no_effect', confidence: 0.9, source: 'CiliaHub_Expert' },
    'ARHGAP1': { ensembl_id: 'ENSG00000175220', cilia_length: 'no_effect', cilia_number: 'no_effect', confidence: 0.85, source: 'CiliaHub_Expert' },
    'ARHGAP29': { ensembl_id: 'ENSG00000137962', cilia_length: 'shorter_cilia', cilia_number: 'reduced_numbers', confidence: 0.9, source: 'CiliaHub_Expert' },
    'ARHGAP35': { ensembl_id: 'ENSG00000160007', cilia_length: 'shorter_cilia', cilia_number: 'reduced_numbers', confidence: 0.9, source: 'CiliaHub_Expert' },
    'ARHGAP5': { ensembl_id: 'ENSG00000100852', cilia_length: 'shorter_cilia', cilia_number: 'reduced_numbers', confidence: 0.9, source: 'CiliaHub_Expert' },
    'HDAC6': { ensembl_id: 'ENSG00000094631', cilia_length: 'longer_cilia', cilia_number: 'no_effect', confidence: 0.95, source: 'CiliaHub_Expert' },
    'IFT88': { ensembl_id: 'ENSG00000107077', cilia_length: 'shorter_cilia', cilia_number: 'reduced_numbers', confidence: 0.98, source: 'CiliaHub_Expert' },
    'ARL13B': { ensembl_id: 'ENSG00000169855', cilia_length: 'required_for_formation', cilia_number: 'reduced_numbers', confidence: 0.95, source: 'CiliaHub_Expert' }
};

function simulateLiteratureMining(gene) {
    const mockResults = {
        'WDR54': { phenotype: 'length_increase', confidence: 0.8 },
        'ZNF474': { phenotype: 'frequency_decrease', confidence: 0.75 },
        'ACOT13': { phenotype: 'unclear', confidence: 0.2 }
    };
    return mockResults[gene.toUpperCase()] || { phenotype: 'unclear', confidence: 0.1 };
}

// ============================================================================
// ANALYSIS LOGIC
// ============================================================================

function analyzeGenes() {
    const input = document.getElementById('geneInput').value.trim();
    if (!input) {
        alert('Please enter at least one gene symbol.');
        return;
    }

    const genes = input.split(/[,\n]+/).map(g => g.trim().toUpperCase()).filter(Boolean);
    const mode = document.querySelector('input[name="mode"]:checked').value;
    
    const resultsContainer = document.getElementById('resultsContainer');
    document.getElementById('resultsSection').style.display = 'block';
    resultsContainer.innerHTML = `<div class="loading"><div class="spinner"></div><p>Analyzing ${genes.length} gene(s)...</p></div>`;

    const btn = document.getElementById('analyzeBtn');
    btn.disabled = true;
    btn.textContent = '🔄 Analyzing...';

    // Simulate analysis delay for a better user experience
    setTimeout(() => {
        const results = genes.map(gene => {
            if ((mode === 'expert' || mode === 'hybrid') && expertDatabase[gene]) {
                const expertData = expertDatabase[gene];
                return {
                    gene,
                    method: 'expert_database',
                    phenotype: getPrimaryPhenotype(expertData),
                    confidence: expertData.confidence,
                    summary: generateExpertSummary(gene, expertData),
                    details: expertData
                };
            } else if (mode === 'nlp' || mode === 'hybrid') {
                const nlpResult = simulateLiteratureMining(gene);
                return {
                    gene,
                    method: 'literature_mining',
                    phenotype: nlpResult.phenotype,
                    confidence: nlpResult.confidence,
                    summary: generateNlpSummary(gene, nlpResult)
                };
            } else {
                return { gene, method: 'no_data', phenotype: 'unknown', confidence: 0, summary: `No information available for ${gene} in the selected mode.` };
            }
        });
        
        resultsContainer.innerHTML = results.map(createResultCard).join('');
        
        btn.disabled = false;
        btn.textContent = '🔍 Analyze Genes';
    }, 1500);
}

function getPrimaryPhenotype(data) {
    if (data.cilia_length === 'longer_cilia') return 'length_increase';
    if (data.cilia_length === 'shorter_cilia') return 'length_decrease';
    if (data.cilia_length === 'required_for_formation' || data.cilia_number === 'reduced_numbers') return 'frequency_decrease';
    if (data.cilia_length === 'no_effect' && data.cilia_number === 'no_effect') return 'no_effect';
    return 'unknown';
}

function generateExpertSummary(gene, data) {
    let summary = `CiliaHub Expert DB indicates that loss of ${gene} `;
    const effects = [];
    if (data.cilia_length === 'longer_cilia') effects.push('results in longer cilia');
    else if (data.cilia_length === 'shorter_cilia') effects.push('results in shorter cilia');
    else if (data.cilia_length === 'required_for_formation') effects.push('is essential for cilia formation');
    
    if (data.cilia_number === 'reduced_numbers' && data.cilia_length !== 'required_for_formation') {
        effects.push('reduces the number of ciliated cells');
    }
    
    if (effects.length === 0) return `CiliaHub Expert DB indicates no significant cilia phenotype for ${gene}.`;
    
    return summary + effects.join(' and ') + '.';
}

function generateNlpSummary(gene, result) {
    const summaries = {
        'length_increase': `Literature suggests loss of ${gene} may lead to longer cilia.`,
        'length_decrease': `Literature suggests loss of ${gene} may lead to shorter cilia.`,
        'frequency_decrease': `Literature suggests ${gene} may be important for ciliogenesis.`,
        'no_effect': `Literature review found no significant effect of ${gene} on cilia.`,
        'unclear': `Literature mining found insufficient or conflicting evidence for ${gene} cilia phenotypes.`
    };
    return summaries[result.phenotype] || `An unknown phenotype was returned for ${gene}.`;
}

// ============================================================================
// UI & DISPLAY
// ============================================================================

function createResultCard(result) {
    const icons = {
        phenotype: { 'length_increase': '🔺 LONGER', 'length_decrease': '🔻 SHORTER', 'frequency_decrease': '⭕ FORMATION', 'no_effect': '➖ NO EFFECT', 'unclear': '❓ UNCLEAR', 'unknown': '❓ UNKNOWN' },
        method: { 'expert_database': '🏛️ CiliaHub Expert', 'literature_mining': '🔬 Literature Mining', 'no_data': '❌ No Data' }
    };
    const confidencePercent = (result.confidence * 100).toFixed(0);

    return `
        <div class="result-card">
            <div class="gene-header">
                <h3 class="gene-name">${result.gene}</h3>
                <div class="phenotype-badge">${icons.phenotype[result.phenotype] || '❓ UNKNOWN'}</div>
            </div>
            
            <div class="method-source">${icons.method[result.method] || result.method}</div>
            
            <div class="confidence-section">
                <div class="confidence-bar"><div class="confidence-fill" style="width: ${confidencePercent}%"></div></div>
                <div class="confidence-text">Confidence: ${confidencePercent}%</div>
            </div>
            
            <div class="summary-text">${result.summary}</div>
            
            ${result.details ? `
                <div class="details-section">
                    <strong>Database Details:</strong>
                    <small>
                        Ensembl ID: ${result.details.ensembl_id}<br>
                        Length Effect: ${result.details.cilia_length.replace(/_/g, ' ')}<br>
                        Number Effect: ${result.details.cilia_number.replace(/_/g, ' ')}
                    </small>
                </div>
            ` : ''}
        </div>
    `;
}

function setupCiliAIEventListeners() {
    document.getElementById('analyzeBtn').addEventListener('click', analyzeGenes);
    document.getElementById('geneInput').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            analyzeGenes();
        }
    });
    // Add event listeners for example gene buttons if they exist
    document.querySelectorAll('[data-example-gene]').forEach(button => {
        button.addEventListener('click', () => {
            const gene = button.getAttribute('data-example-gene');
            const input = document.getElementById('geneInput');
            const currentValue = input.value.trim();
            const genes = currentValue ? currentValue.split(/[,\n]+/).map(g => g.trim()) : [];
            if (!genes.includes(gene)) {
                input.value = currentValue ? `${currentValue}\n${gene}` : gene;
                input.style.height = 'auto';
                input.style.height = `${input.scrollHeight}px`;
            }
        });
    });
}

// ============================================================================
// PAGE INITIALIZATION
// ============================================================================

window.displayCiliAIPage = function() {
    const contentArea = document.querySelector('.content-area');
    if (!contentArea) return console.error('Content area not found');
    contentArea.className = 'content-area content-area-full';
    const ciliaPanel = document.querySelector('.cilia-panel');
    if (ciliaPanel) ciliaPanel.style.display = 'none';

    contentArea.innerHTML = `
        <div class="ciliai-container">
            <div class="ciliai-header">
                <h1>CiliAI</h1>
                <p>Your AI-powered partner for discovering gene-cilia relationships.</p>
            </div>
            <div class="ciliai-main-content">
                <div class="input-section">
                    <h3>Analyze Gene Phenotypes</h3>
                    <div class="input-group">
                        <label for="geneInput">Enter Gene Symbols:</label>
                        <textarea id="geneInput" class="gene-input-textarea" placeholder="Enter one or more gene symbols, separated by commas or newlines (e.g., HDAC6, IFT88)..."></textarea>
                        <div class="example-genes">
                            <small>Examples:</small>
                            <button data-example-gene="HDAC6">HDAC6</button>
                            <button data-example-gene="IFT88">IFT88</button>
                            <button data-example-gene="WDR54">WDR54</button>
                            <button data-example-gene="ACOT13">ACOT13</button>
                        </div>
                    </div>
                    <div class="input-group">
                        <label>Analysis Mode:</label>
                        <div class="mode-selector">
                            <div class="mode-option"><input type="radio" id="hybrid" name="mode" value="hybrid" checked><label for="hybrid" title="Combines curated data with simulated literature mining."><span class="mode-icon">🔬</span><div><strong>Hybrid</strong><br><small>DB + Literature</small></div></label></div>
                            <div class="mode-option"><input type="radio" id="expert" name="mode" value="expert"><label for="expert" title="Queries only the CiliaHub Expert database."><span class="mode-icon">🏛️</span><div><strong>Expert Only</strong><br><small>Curated DB</small></div></label></div>
                            <div class="mode-option"><input type="radio" id="nlp" name="mode" value="nlp"><label for="nlp" title="Performs a simulated literature search."><span class="mode-icon">📚</span><div><strong>Literature Only</strong><br><small>Simulated Mining</small></div></label></div>
                        </div>
                    </div>
                    <button class="analyze-btn" id="analyzeBtn">🔍 Analyze Genes</button>
                </div>
                <div id="resultsSection" class="results-section" style="display: none;">
                    <h2>Analysis Results</h2>
                    <div id="resultsContainer"></div>
                </div>
            </div>
        </div>
        <style>
            /* Main layout and theme */
            .ciliai-container{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:1rem 2rem;background-color:#f8f9fa;border-radius:16px;}
            .ciliai-header{text-align:center;margin-bottom:2rem;color:#343a40;}
            .ciliai-header h1{font-size:3rem;color:#0056b3;margin:0;}
            .ciliai-header p{font-size:1.2rem;color:#6c757d;margin-top:.25rem;}
            .input-section{background-color:#fff;padding:2rem;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,.05);}
            .input-group label{display:block;font-weight:600;margin-bottom:.5rem;color:#495057;}
            .gene-input-textarea{width:100%;min-height:100px;padding:.8rem;border:1px solid #ced4da;border-radius:8px;font-size:1rem;resize:vertical;transition:border-color .2s, box-shadow .2s;}
            .gene-input-textarea:focus{border-color:#80bdff;outline:0;box-shadow:0 0 0 .2rem rgba(0,123,255,.25);}
            .example-genes{margin-top:8px;display:flex;gap:8px;align-items:center;}
            .example-genes small{color:#6c757d;}
            .example-genes button{font-size:0.8rem;padding:3px 8px;border:1px solid #ced4da;border-radius:12px;background-color:#fff;cursor:pointer;transition:background-color .2s;}
            .example-genes button:hover{background-color:#e9ecef;}
            .mode-selector{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-top:1rem;}
            .mode-option input[type=radio]{display:none;}
            .mode-option label{display:flex;align-items:center;gap:12px;padding:1rem;border:2px solid #e9ecef;border-radius:8px;cursor:pointer;transition:all .2s;}
            .mode-option input[type=radio]:checked+label{border-color:#4facfe;background-color:#e7f5ff;}
            .mode-icon{font-size:1.8rem;}
            .analyze-btn{width:100%;padding:1rem;font-size:1.2rem;font-weight:700;background-image:linear-gradient(45deg,#4facfe 0%,#00f2fe 100%);color:#fff;border:none;border-radius:8px;cursor:pointer;transition:transform .2s, box-shadow .2s;margin-top:1.5rem;}
            .analyze-btn:disabled{background-image:linear-gradient(45deg,#adb5bd 0%,#ced4da 100%);cursor:not-allowed;}
            .analyze-btn:hover:not([disabled]){transform:translateY(-2px);box-shadow:0 4px 12px rgba(79,172,254,.4);}
            .results-section{margin-top:2rem;}
            /* Result card styling */
            .result-card{background-color:#fff;border-radius:12px;padding:1.5rem;margin-bottom:1.5rem;box-shadow:0 4px 12px rgba(0,0,0,.05);border-left:5px solid #4facfe;}
            .gene-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;}
            .gene-name{margin:0;font-size:1.8rem;color:#0056b3;}
            .phenotype-badge{font-size:0.9rem;font-weight:700;padding:6px 12px;border-radius:16px;color:#fff;background-color:#6c757d;}
            .method-source{font-size:0.9rem;color:#6c757d;margin-bottom:1rem;}
            .confidence-section{margin-bottom:1rem;}
            .confidence-bar{width:100%;background-color:#e9ecef;border-radius:5px;height:8px;overflow:hidden;}
            .confidence-fill{height:100%;border-radius:5px;background-image:linear-gradient(45deg,#4facfe 0%,#00f2fe 100%);transition:width .5s ease-in-out;}
            .confidence-text{font-size:0.8rem;color:#6c757d;margin-top:4px;}
            .summary-text{color:#343a40;line-height:1.5;}
            .details-section{margin-top:1rem;padding-top:1rem;border-top:1px solid #eee;font-size:0.9rem;color:#495057;}
            .details-section small{line-height:1.6;}
            .loading{text-align:center;padding:2rem;color:#6c757d;}
            .spinner{width:40px;height:40px;border:4px solid #e9ecef;border-top:4px solid #4facfe;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 1rem;}
            @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        </style>
    `;

    setupCiliAIEventListeners();
};
