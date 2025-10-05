// ciliAI.js - Integrated with Phylogenetic AI, Data Visualization, and Dual Autocomplete

// --- Global Data Caches ---

let ciliaHubDataCache = null;
let screenDataCache = null;
let phylogenyDataCache = null; // <-- NEW: Cache for phylogenetic data

// --- Main Page Display Function ---

window.displayCiliAIPage = async function displayCiliAIPage() {
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

    try {
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
                        <div class="ai-input-group autocomplete-wrapper">
                            <input type="text" id="aiQueryInput" class="ai-query-input" placeholder="e.g., What's the distribution of IFT88?">
                            <div id="aiQuerySuggestions" class="suggestions-container"></div>
                            <button class="ai-query-btn" id="aiQueryBtn">Ask CiliAI</button>
                        </div>
                        <div class="example-queries">
                            <p><strong>Try asking:</strong> 
                                <span>"phylogeny of ARL13B"</span>, 
                                <span>"highly conserved genes"</span>, 
                                <span>"genes for Joubert Syndrome"</span>.
                            </p>
                        </div>
                    </div>

                    <div class="input-section">
                        <h3>Analyze Gene Phenotypes</h3>
                        <div class="input-group">
                            <label for="geneInput">Gene Symbols:</label>
                            <div class="autocomplete-wrapper">
                                <textarea id="geneInput" class="gene-input-textarea" placeholder="Start typing a gene symbol (e.g., IFT88)..."></textarea>
                                <div id="geneSuggestions" class="suggestions-container"></div>
                            </div>
                        </div>

                        <div class="input-group">
                            <label>Analysis Mode:</label>
                            <div class="mode-selector">
                                <div class="mode-option">
                                    <input type="radio" id="hybrid" name="mode" value="hybrid" checked>
                                    <label for="hybrid" title="Best for most users. Combines our fast, expert-curated database, screen data, and real-time AI literature mining for the most comprehensive results.">
                                        <span class="mode-icon">🔬</span>
                                        <div><strong>Hybrid</strong><br><small>Expert DB + Screens + Literature</small></div>
                                    </label>
                                </div>
                                <div class="mode-option">
                                    <input type="radio" id="expert" name="mode" value="expert">
                                     <label for="expert" title="Fastest option. Queries only our internal, manually curated database and screen data of known gene-cilia interactions.">
                                        <span class="mode-icon">🏛️</span>
                                        <div><strong>Expert Only</strong><br><small>Curated DB + Screen Data</small></div>
                                    </label>
                                </div>
                                <div class="mode-option">
                                    <input type="radio" id="nlp" name="mode" value="nlp">
                                    <label for="nlp" title="Most current data. Performs a live AI-powered search across PubMed full-text articles. May be slower but includes the very latest findings.">
                                        <span class="mode-icon">📚</span>
                                        <div><strong>Literature Only</strong><br><small>Live AI Text Mining</small></div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <button class="analyze-btn" id="analyzeBtn">🔍 Analyze Genes</button>
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
                .ciliai-container { font-family: 'Arial', sans-serif; max-width: 950px; margin: 2rem auto; padding: 2rem; background-color: #f9f9f9; border-radius: 12px; }
                .ciliai-header { text-align: center; margin-bottom: 2rem; }
                .ai-input-group { position: relative; display: flex; gap: 10px; }
                .ai-query-input { flex-grow: 1; padding: 0.8rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
                .input-group { margin-bottom: 1.5rem; }
                .gene-input-textarea { width: 100%; padding: 0.8rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; min-height: 80px; resize: vertical; box-sizing: border-box; }
                .mode-selector { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
                .mode-option input[type="radio"] { display: none; }
                .mode-option label { display: flex; align-items: center; gap: 10px; padding: 1rem; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
                .mode-option input[type="radio"]:checked + label { border-color: #2c5aa0; background-color: #e8f4fd; box-shadow: 0 0 5px rgba(44, 90, 160, 0.3); }
                .mode-icon { font-size: 1.8rem; }
                .result-card { border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; position: relative; overflow: hidden; background-color: #fff; }
                .prediction-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; }
                .prediction-box { padding: 1rem; border-radius: 6px; text-align: center; background-color: #f8f9fa; border: 1px solid #dee2e6; }
                .prediction-box h4 { margin: 0 0 0.5rem 0; color: #495057; }
                .prediction-box p { margin: 0; font-size: 1.2rem; font-weight: bold; }
                .autocomplete-wrapper { position: relative; width: 100%; }
                .suggestions-container { display: none; position: absolute; top: 100%; left: 0; border: 1px solid #ddd; background-color: white; width: 100%; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 8px rgba(0,0,0,0.1); border-radius: 0 0 4px 4px; box-sizing: border-box; }
                .suggestion-item { padding: 10px; cursor: pointer; font-size: 0.9rem; }
                .suggestion-item:hover { background-color: #f0f0f0; }

                /* NEW styles for phylogeny section */
                .phylogeny-section { margin-top: 1.5rem; border-top: 1px solid #eee; padding-top: 1.5rem; }
                .phylogeny-section h4 { margin-top: 0; margin-bottom: 0.5rem; color: #333; }
                .phylo-summary { font-style: italic; color: #555; margin-bottom: 1rem; }
                .phylo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; text-align: center; }
                .phylo-box { padding: 1rem; border-radius: 6px; background-color: #f8f9fa; border: 1px solid #dee2e6; }
                .phylo-box strong { font-size: 1.3rem; color: #2c5aa0; }
            </style>
        `;
    } catch (error) {
        console.error('Failed to inject CiliAI HTML:', error);
        contentArea.innerHTML = '<p class="status-not-found">Error: Failed to load CiliAI interface.</p>';
        return;
    }

    // Load all data sources in parallel
    await Promise.all([fetchCiliaData(), fetchScreenData(), fetchPhylogenyData()]);
    setupCiliAIEventListeners();
};

// --- Helper Functions & Mock DB ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function debounce(fn, delay) { let timeout; return function (...args) { clearTimeout(timeout); timeout = setTimeout(() => fn(...args), delay); }; }
const CILI_AI_DB = { "HDAC6": { "summary": { "lof_length": "Promotes / Maintains", "percentage_ciliated": "No effect", "source": "Expert DB" }, "evidence": [{ "id": "21873644", "source": "pubmed", "context": "...loss of HDAC6 results in hyperacetylation of tubulin and leads to the formation of longer, more stable primary cilia in renal epithelial cells." }] }, "IFT88": { "summary": { "lof_length": "Inhibits / Restricts", "percentage_ciliated": "Reduced cilia numbers", "source": "Expert DB" }, "evidence": [{ "id": "10882118", "source": "pubmed", "context": "Mutations in IFT88 (polaris) disrupt intraflagellar transport, leading to a failure in cilia assembly and resulting in severely shortened or absent cilia." }] }, "ARL13B": { "summary": { "lof_length": "Inhibits / Restricts", "percentage_ciliated": "Reduced cilia numbers", "source": "Expert DB" }, "evidence": [{ "id": "21940428", "source": "pubmed", "context": "The small GTPase ARL13B is critical for ciliary structure; its absence leads to stunted cilia with abnormal morphology and axonemal defects." }] } };


// --- Data Fetching and Caching ---
async function fetchCiliaData() { if (ciliaHubDataCache) return ciliaHubDataCache; try { const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/ciliahub_data.json'); if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`); const data = await response.json(); ciliaHubDataCache = data.map(gene => ({...gene, domain_descriptions: typeof gene.domain_descriptions === 'string' ? gene.domain_descriptions.split(',').map(d => d.trim()) : Array.isArray(gene.domain_descriptions) ? gene.domain_descriptions : [] })); console.log('CiliaHub data loaded.'); return ciliaHubDataCache; } catch (error) { console.error("Failed to fetch CiliaHub data:", error); return null; } }
async function fetchScreenData() { if (screenDataCache) return screenDataCache; try { const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cilia_screens_data.json'); if (!response.ok) throw new Error(`Failed to fetch screen data: ${response.statusText}`); screenDataCache = await response.json(); console.log('Screen data loaded.'); return screenDataCache; } catch (error) { console.error('Error fetching screen data:', error); return {}; } }

/**
 * NEW: Fetches and caches the phylogenetic summary data.
 */
async function fetchPhylogenyData() {
    if (phylogenyDataCache) return phylogenyDataCache;
    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/phylogeny_summary.json');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        phylogenyDataCache = await response.json();
        console.log('Phylogeny data loaded and cached successfully.');
        return phylogenyDataCache;
    } catch (error) {
        console.error("Failed to fetch Phylogeny data:", error);
        return null;
    }
}

// --- Advanced AI Query Engine ---
async function handleAIQuery() {
    const aiQueryInput = document.getElementById('aiQueryInput');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsSection = document.getElementById('resultsSection');
    const query = aiQueryInput.value.trim();

    if (!query) return;

    resultsSection.style.display = 'block';
    resultsContainer.innerHTML = `<p class="status-searching">CiliAI is thinking...</p>`;
    
    let resultHtml = '';
    let match;

    try {
        // --- NEW: Phylogenetic Queries ---
        if ((match = query.match(/(?:distribution of|phylogeny of)\s+([A-Z0-9\-]+)/i))) {
            const geneSymbol = match[1].toUpperCase();
            const phyloData = phylogenyDataCache ? phylogenyDataCache[geneSymbol] : null;
            if (phyloData) {
                let summary = `For <strong>${geneSymbol}</strong>, `;
                const ciliatedPct = phyloData.ciliated_prevalence;
                const nonCiliatedPct = phyloData.non_ciliated_prevalence;

                if (ciliatedPct > 0.9 && nonCiliatedPct < 0.1) {
                    summary += "it is highly conserved in ciliated organisms and largely absent from non-ciliated species, suggesting a core ciliary function.";
                } else if (ciliatedPct > 0.9 && nonCiliatedPct > 0.9) {
                    summary += "it is a highly conserved gene found in nearly all species, both ciliated and non-ciliated.";
                } else if (ciliatedPct < 0.1) {
                    summary += "it appears to be absent from most ciliated organisms.";
                } else {
                    summary += `it is found in about <strong>${Math.round(ciliatedPct * 100)}%</strong> of ciliated species and <strong>${Math.round(nonCiliatedPct * 100)}%</strong> of non-ciliated species.`;
                }
                resultHtml = `<div class="result-card"><h3>Phylogenetic Distribution of ${geneSymbol}</h3><p>${summary}</p></div>`;
            } else {
                resultHtml = `<div class="result-card"><p class="status-not-found">No phylogenetic data found for ${geneSymbol}.</p></div>`;
            }
        } 
        else if ((match = query.match(/(?:list|find|show)\s*(\d*)\s*(highly conserved|universally conserved|present in all ciliated species|present in all species)/i))) {
            const limit = match[1] ? parseInt(match[1], 10) : 10;
            const queryType = match[2];
            let foundGenes = [];

            if (queryType.includes('ciliated')) {
                foundGenes = Object.entries(phylogenyDataCache)
                    .filter(([gene, data]) => data.ciliated_prevalence === 1)
                    .map(([gene, data]) => gene);
            } else { // highly/universally conserved
                foundGenes = Object.entries(phylogenyDataCache)
                    .filter(([gene, data]) => data.ciliated_prevalence === 1 && data.non_ciliated_prevalence === 1)
                    .map(([gene, data]) => gene);
            }
            
            resultHtml = `<div class="result-card"><h3>${limit} Genes ${queryType}</h3>`;
            if (foundGenes.length > 0) {
                resultHtml += `<ul>${foundGenes.slice(0, limit).map(g => `<li>${g}</li>`).join('')}</ul>`;
            } else {
                resultHtml += `<p class="status-not-found">No genes matched the specified conservation criteria.</p>`;
            }
            resultHtml += `</div>`;
        }
        // --- End of New Queries ---
        else if ((match = query.match(/(?:genes for|genes involved in)\s+(.*)/i))) {
            const data = await fetchCiliaData();
            const disease = match[1].trim().replace(/\s+/g, ' ').toLowerCase();
            const title = `Genes associated with "${disease}"`;
            const diseaseRegex = new RegExp(disease.replace(/ /g, '[\\s-]*'), 'i');
            const results = data.filter(g => g.functional_summary && diseaseRegex.test(g.functional_summary));
            resultHtml = formatSimpleResults(results, title);
        }
        else {
            resultHtml = `<p class="status-not-found">Sorry, I didn't understand. Try asking about a gene's phylogeny (e.g., "distribution of IFT88"), highly conserved genes, or a disease.</p>`;
        }
        
        resultsContainer.innerHTML = resultHtml;

    } catch (e) {
        resultsContainer.innerHTML = `<p class="status-not-found">An error occurred during your query. Please check the console.</p>`;
        console.error(e);
    }
}

function formatSimpleResults(results, title) {
    if (results.length === 0) return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No matching genes found.</p></div>`;
    let html = `<div class="result-card"><h3>${title} (${results.length} found)</h3><ul>`;
    results.forEach(gene => {
        html += `<li><strong>${gene.gene}</strong>: ${gene.description || 'No description available.'}</li>`;
    });
    return html + '</ul></div>';
}

// --- Autocomplete Logic ---
function setupAiQueryAutocomplete() {
    const aiQueryInput = document.getElementById('aiQueryInput');
    const suggestionsContainer = document.getElementById('aiQuerySuggestions');
    if (!aiQueryInput || !suggestionsContainer) return;

    const exampleQueries = [ "phylogeny of IFT88", "distribution of ARL13B", "highly conserved genes", "genes present in all ciliated species", "genes for Joubert Syndrome", "show me WD40 domain genes", "complexes for CEP290" ];
    
    aiQueryInput.addEventListener('input', () => {
        const inputText = aiQueryInput.value.toLowerCase();
        if (inputText.length < 2) {
            suggestionsContainer.style.display = 'none';
            return;
        }
        const filteredSuggestions = exampleQueries.filter(q => q.toLowerCase().includes(inputText));
        if (filteredSuggestions.length > 0) {
            suggestionsContainer.innerHTML = filteredSuggestions.map(q => `<div class="suggestion-item">${q}</div>`).join('');
            suggestionsContainer.style.display = 'block';
        } else {
            suggestionsContainer.style.display = 'none';
        }
    });

    suggestionsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-item')) {
            aiQueryInput.value = e.target.textContent;
            suggestionsContainer.style.display = 'none';
            aiQueryInput.focus();
        }
    });

    document.addEventListener('click', (e) => {
        if (!aiQueryInput.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });
}

function setupGeneAutocomplete() {
    const geneInput = document.getElementById('geneInput');
    const suggestionsContainer = document.getElementById('geneSuggestions');
    if (!geneInput || !suggestionsContainer) return;

    geneInput.addEventListener('input', async () => {
        if (!ciliaHubDataCache) await fetchCiliaData();
        if (!ciliaHubDataCache) return;

        const currentTerm = geneInput.value.split(/[\s,]+/).pop().trim().toUpperCase();
        if (currentTerm.length < 2) {
            suggestionsContainer.style.display = 'none';
            return;
        }

        const suggestions = ciliaHubDataCache.map(g => g.gene).filter(geneName => geneName && geneName.toUpperCase().startsWith(currentTerm)).slice(0, 10);
        if (suggestions.length > 0) {
            suggestionsContainer.innerHTML = suggestions.map(gene => `<div class="suggestion-item">${gene}</div>`).join('');
            suggestionsContainer.style.display = 'block';
        } else {
            suggestionsContainer.style.display = 'none';
        }
    });

    suggestionsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-item')) {
            const selectedGene = e.target.textContent;
            const terms = geneInput.value.split(/[\s,]+/).filter(Boolean);
            const lastChar = geneInput.value.trim().slice(-1);
            if (lastChar && lastChar !== ',') {
                terms.pop();
            }
            terms.push(selectedGene);
            geneInput.value = terms.join(', ') + ', ';
            suggestionsContainer.style.display = 'none';
            geneInput.focus();
        }
    });

     document.addEventListener('click', (e) => {
        if (!geneInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });
}

// --- Main Event Listener Setup ---
function setupCiliAIEventListeners() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const aiQueryBtn = document.getElementById('aiQueryBtn');
    const visualizeBtn = document.getElementById('visualizeBtn');
    const resultsContainer = document.getElementById('resultsContainer');
    const geneInput = document.getElementById('geneInput');
    const aiQueryInput = document.getElementById('aiQueryInput');

    if (!analyzeBtn || !aiQueryBtn || !visualizeBtn || !resultsContainer || !geneInput || !aiQueryInput) {
        console.warn('One or more CiliAI elements were not found in the DOM.');
        return;
    }

    analyzeBtn.addEventListener('click', analyzeGenesFromInput);
    aiQueryBtn.addEventListener('click', handleAIQuery);
    visualizeBtn.addEventListener('click', async () => { const genes = geneInput.value.split(/[\s,]+/).map(g => g.trim().toUpperCase()).filter(Boolean); if (genes.length > 0) { const screenData = await fetchScreenData(); renderScreenSummaryHeatmap(genes, screenData); } });
    geneInput.addEventListener('keydown', debounce((e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); analyzeGenesFromInput(); } }, 300));
    aiQueryInput.addEventListener('keydown', debounce((e) => { if (e.key === 'Enter') handleAIQuery(); }, 300));
    resultsContainer.addEventListener('click', function(e) { if (e.target && e.target.classList.contains('evidence-toggle')) { const content = document.getElementById(e.target.dataset.contentId); if (content) { const isVisible = content.style.display === 'block'; content.style.display = isVisible ? 'none' : 'block'; e.target.textContent = isVisible ? `Hide Evidence (${e.target.dataset.count}) ▴` : `Show Evidence (${e.target.dataset.count}) ▾`; } } });

    setupGeneAutocomplete();
    setupAiQueryAutocomplete();
}

// --- Gene Analysis Functions ---
function analyzeGenesFromInput() {
    const geneInput = document.getElementById('geneInput');
    const genes = geneInput.value.split(/[\s,]+/).map(g => g.trim().toUpperCase()).filter(Boolean);
    
    if (genes.length === 0) {
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.innerHTML = '<p class="status-not-found">Please enter at least one gene symbol.</p>';
        document.getElementById('resultsSection').style.display = 'block';
        return;
    }
    
    runAnalysis([...new Set(genes)]);
}


async function runAnalysis(geneList) {
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsSection = document.getElementById('resultsSection');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const visualizeBtn = document.getElementById('visualizeBtn');
    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'hybrid';

    resultsContainer.innerHTML = '';
    resultsSection.style.display = 'block';
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    visualizeBtn.style.display = 'none';

    geneList.forEach(gene => {
        resultsContainer.insertAdjacentHTML('beforeend', createPlaceholderCard(gene, mode));
    });

    for (const gene of geneList) {
        const resultCard = document.getElementById(`card-${gene}`);
        let dbData = CILI_AI_DB[gene.toUpperCase()] || null;
        let apiEvidence = [];
        let screenEvidence = [];

        if (mode === 'expert' || mode === 'hybrid') {
            if (screenDataCache && screenDataCache[gene.toUpperCase()]) {
                screenEvidence.push({ id: `screen-${gene}`, source: 'screen_data', context: renderScreenDataTable(gene, screenDataCache[gene.toUpperCase()]) });
            }
        }
        if (mode === 'nlp' || mode === 'hybrid') {
            apiEvidence = await analyzeGeneViaAPI(gene, resultCard);
        }
        
        const phyloData = phylogenyDataCache ? phylogenyDataCache[gene.toUpperCase()] : null;
        const allEvidence = [...(dbData?.evidence || []), ...apiEvidence, ...screenEvidence];
        const finalHtml = createResultCard(gene, dbData, allEvidence, phyloData);
        if (resultCard) resultCard.outerHTML = finalHtml;
    }

    analyzeBtn.disabled = false;
    analyzeBtn.textContent = '🔍 Analyze Genes';
    if (geneList.length > 0) visualizeBtn.style.display = 'block';
}

function createPlaceholderCard(gene, mode) {
    let statusText = 'Fetching from Expert DB and Screen Data...';
    if (mode === 'nlp') statusText = 'Searching live literature...';
    if (mode === 'hybrid') statusText = 'Checking Expert DB, Screen Data & Searching Literature...';
    return `<div class="result-card" id="card-${gene}"><h3>${gene} - <span class="status-searching">${statusText}</span></h3></div>`;
}

function createResultCard(gene, dbData, allEvidence, phyloData) {
    let statusText = allEvidence.length > 0 || phyloData ? 'Evidence Found' : 'No Data Found';
    let statusClass = allEvidence.length > 0 || phyloData ? 'status-found' : 'status-not-found';
    
    let summaryHtml = '';
    if (dbData && dbData.summary) {
        summaryHtml = `
            <div class="prediction-grid">
                <div class="prediction-box"><h4>Loss-of-Function (Length)</h4><p>${dbData.summary.lof_length}</p></div>
                <div class="prediction-box"><h4>Percentage Ciliated</h4><p>${dbData.summary.percentage_ciliated}</p></div>
            </div>`;
    } else {
        summaryHtml = '<p>No summary prediction available. Review literature and screen evidence for insights.</p>';
    }

    let phylogenyHtml = '';
    if (phyloData) {
        let summaryText = '';
        const ciliatedPct = phyloData.ciliated_prevalence;
        const nonCiliatedPct = phyloData.non_ciliated_prevalence;

        if (ciliatedPct > 0.9 && nonCiliatedPct < 0.1) {
            summaryText = "This gene is highly conserved in ciliated species and rare elsewhere, suggesting a core ciliary function.";
        } else if (ciliatedPct > 0.9 && nonCiliatedPct > 0.9) {
            summaryText = "This is a highly conserved housekeeping gene found in nearly all organisms.";
        } else {
            summaryText = "This gene shows a variable conservation pattern across species."
        }
        
        phylogenyHtml = `
            <div class="phylogeny-section">
                <h4>Phylogenetic Profile</h4>
                <p class="phylo-summary">${summaryText}</p>
                <div class="phylo-grid">
                    <div class="phylo-box">Conserved In<br><strong>${Math.round(ciliatedPct * 100)}%</strong><br>Ciliated Species</div>
                    <div class="phylo-box">Conserved In<br><strong>${Math.round(nonCiliatedPct * 100)}%</strong><br>Non-Ciliated Species</div>
                </div>
            </div>`;
    }

    let evidenceHtml = '';
    if (allEvidence.length > 0) {
        const screenEv = allEvidence.find(ev => ev.source === 'screen_data');
        const otherEvidence = allEvidence.filter(ev => ev.source !== 'screen_data');

        evidenceHtml = `<div class="evidence-section">`;
        if (screenEv) {
            evidenceHtml += `<h4>Ciliary Screen Data</h4><div class="screen-evidence-container">${screenEv.context}</div>`;
        }
        if (otherEvidence.length > 0) {
            const evidenceSnippets = otherEvidence.map(ev => `
                <div class="evidence-snippet">
                    ${ev.context.replace(new RegExp(`(${gene})`, 'ig'), `<mark>$1</mark>`)}
                    <br><strong>Source: ${ev.source.toUpperCase()} (${ev.id})</strong>
                </div>
            `).join('');

            evidenceHtml += `
                <button class="evidence-toggle" data-count="${otherEvidence.length}" data-content-id="evidence-${gene}">Show Other Evidence (${otherEvidence.length}) ▾</button>
                <div class="evidence-content" id="evidence-${gene}">${evidenceSnippets}</div>
            `;
        }
        evidenceHtml += `</div>`;
    }

    return `
        <div class="result-card">
            <h3>${gene} - <span class="${statusClass}">${statusText}</span></h3>
            ${summaryHtml}
            ${phylogenyHtml}
            ${evidenceHtml}
        </div>
    `;
}

async function analyzeGeneViaAPI(gene, resultCard) {
    const ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
    const ELINK_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi";
    const EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
    
    const API_QUERY_KEYWORDS = ["cilia", "ciliary", "ciliogenesis", "intraflagellar transport", "ciliopathy"];
    const LOCAL_ANALYSIS_KEYWORDS = new Set(['cilia', 'ciliary', 'cilium', 'axoneme', 'basal body', 'transition zone', 'ciliogenesis', 'ift', 'shorter', 'longer', 'fewer', 'loss of', 'absent', 'reduced', 'increased', 'motility']);

    const geneRegex = new RegExp(`\\b${gene}\\b`, 'i');
    const sentSplitRegex = /(?<=[.!?])\s+/;
    let foundEvidence = [];

    const MAX_ARTICLES = 10;
    const MAX_EVIDENCE = 5;
    const RATE_LIMIT_DELAY = 350;

    try {
        const kwClause = API_QUERY_KEYWORDS.map(k => `"${k}"[Title/Abstract]`).join(" OR ");
        const query = `("${gene}"[Title/Abstract]) AND (${kwClause})`;
        const searchParams = new URLSearchParams({ db: 'pubmed', term: query, retmode: 'json', retmax: '25' });
        
        const searchResp = await fetch(`${ESEARCH_URL}?${searchParams}`);
        if (!searchResp.ok) throw new Error(`NCBI ESearch failed: ${searchResp.statusText}`);
        const searchData = await searchResp.json();
        const pmids = searchData.esearchresult?.idlist.slice(0, MAX_ARTICLES) || [];

        if (pmids.length === 0) return [];

        await sleep(RATE_LIMIT_DELAY);
        const linkParams = new URLSearchParams({ dbfrom: 'pubmed', db: 'pmc', id: pmids.join(','), retmode: 'json' });
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
            await sleep(RATE_LIMIT_DELAY);
            const fetchParams = new URLSearchParams({ db: 'pmc', id: pmcIds.join(','), retmode: 'xml', rettype: 'full' });
            const fetchResp = await fetch(`${EFETCH_URL}?${fetchParams}`);
            if (fetchResp.ok) {
                const xmlText = await fetchResp.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "application/xml");
                articles = Array.from(xmlDoc.getElementsByTagName('article'));
            }
        }

        if (articles.length === 0 && pmids.length > 0) {
            await sleep(RATE_LIMIT_DELAY);
            const fetchParams = new URLSearchParams({ db: 'pubmed', id: pmids.join(','), retmode: 'xml', rettype: 'abstract' });
            const fetchResp = await fetch(`${EFETCH_URL}?${fetchParams}`);
            if (fetchResp.ok) {
                const xmlText = await fetchResp.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "application/xml");
                articles = Array.from(xmlDoc.getElementsByTagName('PubmedArticle'));
            }
        }

        for (const article of articles) {
            if (foundEvidence.length >= MAX_EVIDENCE) break;
            
            let pmid, textContent;
            if (article.tagName.toLowerCase() === 'article') { // PMC full-text
                pmid = article.querySelector('article-id[pub-id-type="pmid"]')?.textContent || 'PMC Article';
                const title = article.querySelector('article-title')?.textContent || '';
                const body = Array.from(article.querySelectorAll('body p, body sec, body para')).map(el => el.textContent).join(' ');
                textContent = `${title}. ${body}`;
            } else { // PubMed abstract
                pmid = article.querySelector('MedlineCitation > PMID')?.textContent || 'PubMed Article';
                const title = article.querySelector('ArticleTitle')?.textContent || '';
                const abstractText = Array.from(article.querySelectorAll('AbstractText')).map(el => el.textContent).join(' ');
                textContent = `${title}. ${abstractText}`;
            }

            if (!textContent || !geneRegex.test(textContent)) continue;

            const sentences = textContent.split(sentSplitRegex);
            for (const sent of sentences) {
                if (foundEvidence.length >= MAX_EVIDENCE) break;
                const sentLower = sent.toLowerCase();
                if (geneRegex.test(sent) && [...LOCAL_ANALYSIS_KEYWORDS].some(kw => sentLower.includes(kw))) {
                    foundEvidence.push({ id: pmid, source: 'pubmed', context: sent.trim() });
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

function renderScreenDataTable(gene, screenInfo) {
    if (!screenInfo || typeof screenInfo !== 'object') return '<p class="status-not-found">No structured screen data available.</p>';
    
    let screensObj = {};
    if (Array.isArray(screenInfo)) {
        screensObj = screenInfo.reduce((acc, entry) => {
            if (entry.source && entry.result) {
                acc[entry.source] = {
                    hit: entry.result.toLowerCase() !== 'no effect', 
                    effect: entry.result,
                    details: 'From raw data' 
                };
            }
            return acc;
        }, {});
    } else if (screenInfo.screens) {
        screensObj = screenInfo.screens;
    }

    const screenKeys = Object.keys(screensObj);
    const hitCount = screenKeys.filter(key => screensObj[key]?.hit).length;

    const screenNames = { 'Kim2016': 'Kim et al. (2016) IMCD3 RNAi', 'Wheway2015': 'Wheway et al. (2015) RPE1 RNAi', 'Roosing2015': 'Roosing et al. (2015) hTERT-RPE1', 'Basu2023': 'Basu et al. (2023) MDCK CRISPR', 'Breslow2018': 'Breslow et al. (2018) Hedgehog Signaling' };
    const summary = `<p class="screen-summary">According to ${hitCount} out of ${screenKeys.length} ciliary screens, <strong>${gene}</strong> was found to impact cilia.</p>`;
    const tableHtml = `
        <table class="screen-table">
            <thead><tr><th>Screen</th><th>Hit?</th><th>Effect</th><th>Details</th></tr></thead>
            <tbody>
                ${screenKeys.map(key => {
                    const d = screensObj[key] || { hit: false, effect: 'N/A', details: 'Not tested' };
                    const name = screenNames[key] || key;
                    return `<tr><td>${name}</td><td>${d.hit ? '✅' : '❌'}</td><td>${d.effect}</td><td>${d.details}</td></tr>`;
                }).join('')}
            </tbody>
        </table>`;
    return summary + tableHtml;
}


function renderScreenSummaryHeatmap(genes, screenData) {
    if (!window.Plotly) { console.error('Plotly is not loaded.'); document.getElementById('plot-display-area').innerHTML = '<p class="status-not-found">Error: Plotly library failed to load.</p>'; return; }
    const plotArea = document.getElementById('plot-display-area');
    if (!plotArea) return;

    const numberScreens = { 'Kim et al. (2016) IMCD3 RNAi': 'Kim2016', 'Wheway et al. (2015) RPE1 RNAi': 'Wheway2015', 'Roosing et al. (2015) hTERT-RPE1': 'Roosing2015', 'Basu et al. (2023) MDCK CRISPR': 'Basu2023' };
    const signalingScreens = { 'Breslow et al. (2018) Hedgehog Signaling': 'Breslow2018' };
    const numberScreenOrder = Object.keys(numberScreens);
    const signalingScreenOrder = Object.keys(signalingScreens);

    const numberCategoryMap = { "Decreased cilia numbers": { v: 1, c: '#0571b0' }, "Increased cilia numbers": { v: 2, c: '#ca0020' }, "Causes Supernumerary Cilia": { v: 3, c: '#fdae61' }, "No effect": { v: 4, c: '#fee090' }, "Not in Screen": { v: 5, c: '#bdbdbd' }, "Not Reported": { v: 6, c: '#636363' } };
    const signalingCategoryMap = { "Decreased Signaling (Positive Regulator)": { v: 1, c: '#2166ac' }, "Increased Signaling (Negative Regulator)": { v: 2, c: '#d73027' }, "No Significant Effect": { v: 3, c: '#fdae61' }, "Not in Screen": { v: 4, c: '#bdbdbd' }, "Not Reported": { v: 5, c: '#636363' } };

    const geneLabels = genes.map(g => g.toUpperCase());
    const zDataNumber = [], textDataNumber = [], zDataSignaling = [], textDataSignaling = [];

    genes.forEach(gene => {
        const numberRowValues = [], numberRowText = [], signalingRowValues = [], signalingRowText = [];
        numberScreenOrder.forEach(screenName => {
            const screenKey = numberScreens[screenName];
            let resultText = "Not in Screen";
            if (screenData[gene]?.screens?.[screenKey]) { resultText = screenData[gene].screens[screenKey].result || "Not Reported"; }
            const mapping = numberCategoryMap[resultText] || numberCategoryMap["Not in Screen"];
            numberRowValues.push(mapping.v);
            numberRowText.push(resultText);
        });
        signalingScreenOrder.forEach(screenName => {
            const screenKey = signalingScreens[screenName];
            let resultText = "Not in Screen";
            if (screenData[gene]?.screens?.[screenKey]) { resultText = screenData[gene].screens[screenKey].result || "Not Reported"; }
            const mapping = signalingCategoryMap[resultText] || signalingCategoryMap["Not in Screen"];
            signalingRowValues.push(mapping.v);
            signalingRowText.push(resultText);
        });
        zDataNumber.push(numberRowValues);
        textDataNumber.push(numberRowText);
        zDataSignaling.push(signalingRowValues);
        textDataSignaling.push(signalingRowText);
    });

    const trace1 = { x: numberScreenOrder, y: geneLabels, z: zDataNumber, customdata: textDataNumber, type: 'heatmap', colorscale: [[0, '#0571b0'], [0.2, '#ca0020'], [0.4, '#fdae61'], [0.6, '#fee090'], [0.8, '#636363'], [1.0, '#bdbdbd']], showscale: false, hovertemplate: '<b>Gene:</b> %{y}<br><b>Screen:</b> %{x}<br><b>Result:</b> %{customdata}<extra></extra>', xgap: 1, ygap: 1 };
    const trace2 = { x: signalingScreenOrder, y: geneLabels, z: zDataSignaling, customdata: textDataSignaling, type: 'heatmap', colorscale: [[0, '#2166ac'], [0.25, '#d73027'], [0.5, '#fdae61'], [0.75, '#636363'], [1.0, '#bdbdbd']], showscale: false, hovertemplate: '<b>Gene:</b> %{y}<br><b>Screen:</b> %{x}<br><b>Result:</b> %{customdata}<extra></extra>', xaxis: 'x2', yaxis: 'y1', xgap: 1, ygap: 1 };
    
    const layout = { title: { text: 'Summary of Ciliary Screen Results', font: { size: 16, family: 'Arial', color: '#2c5aa0' } }, grid: { rows: 1, columns: 2, pattern: 'independent' }, xaxis: { domain: [0, 0.78], tickangle: -45, automargin: true }, xaxis2: { domain: [0.8, 1.0], tickangle: -45, automargin: true }, yaxis: { automargin: true, tickfont: { size: 10 } }, margin: { l: 120, r: 220, b: 150, t: 80 }, height: 400 + (geneLabels.length * 30), annotations: [] };
    
    let current_y = 1.0;
    layout.annotations.push({ xref: 'paper', yref: 'paper', x: 1.02, y: current_y + 0.05, xanchor: 'left', text: '<b>Cilia Number/Structure</b>', showarrow: false, font: { size: 13 } });
    Object.entries(numberCategoryMap).forEach(([key, val]) => { layout.annotations.push({ xref: 'paper', yref: 'paper', x: 1.02, y: current_y, xanchor: 'left', yanchor: 'middle', text: `█ ${key}`, font: { color: val.c, size: 12 }, showarrow: false }); current_y -= 0.06; });
    current_y -= 0.1;
    layout.annotations.push({ xref: 'paper', yref: 'paper', x: 1.02, y: current_y + 0.05, xanchor: 'left', text: '<b>Hedgehog Signaling</b>', showarrow: false, font: { size: 13 } });
    Object.entries(signalingCategoryMap).forEach(([key, val]) => { if (key !== "Not in Screen" && key !== "Not Reported") { layout.annotations.push({ xref: 'paper', yref: 'paper', x: 1.02, y: current_y, xanchor: 'left', yanchor: 'middle', text: `█ ${key}`, font: { color: val.c, size: 12 }, showarrow: false }); current_y -= 0.06; } });

    Plotly.newPlot('plot-display-area', [trace1, trace2], layout, { responsive: true });
}

// --- Global Exposure for Router ---
window.displayCiliAIPage = displayCiliAIPage;
