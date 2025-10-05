// --- Global Data Cache ---
let ciliaHubDataCache = null;
let screenDataCache = null;
let phylogenyDataCache = null;

// --- Main Page Display Function ---
function displayCiliAIPage() {
    const container = document.getElementById('app-container');
    if (!container) {
        console.error('App container not found');
        return;
    }
    container.innerHTML = `
        <div class="cili-ai-container">
            <h1>CiliAI: Ciliary Gene Analysis</h1>
            <p class="subtitle">Explore ciliary gene functions, conservation, and literature evidence.</p>

            <div class="input-section">
                <h2>Analyze Genes</h2>
                <div class="input-group">
                    <input type="text" id="geneInput" placeholder="Enter gene symbols (e.g., IFT88, HDAC6, ARL13B)">
                    <button id="analyzeBtn">🔍 Analyze Genes</button>
                </div>
                <div class="mode-selection">
                    <label><input type="radio" name="mode" value="expert" checked> Expert DB + Screen Data</label>
                    <label><input type="radio" name="mode" value="nlp"> NLP Literature Search</label>
                    <label><input type="radio" name="mode" value="hybrid"> Hybrid (Both)</label>
                </div>
                <button id="visualizeBtn" style="display: none;">📊 Visualize Screen Results</button>
            </div>

            <div class="input-section">
                <h2>Ask CiliAI</h2>
                <div class="input-group">
                    <input type="text" id="aiQueryInput" placeholder="Ask about gene phylogeny, diseases, domains, localization, complexes, etc. (e.g., 'phylogeny of IFT88' or 'genes for Joubert Syndrome')">
                    <button id="aiQueryBtn">🔍 Ask CiliAI</button>
                </div>
                <div id="aiQuerySuggestions" class="suggestions-container"></div>
            </div>

            <div id="resultsSection" style="display: none;">
                <h2>Results</h2>
                <div id="resultsContainer"></div>
            </div>

            <div id="plot-display-area"></div>
        </div>

        <style>
            .cili-ai-container { max-width: 1200px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; }
            h1 { color: #2c5aa0; }
            .subtitle { color: #555; margin-bottom: 30px; }
            .input-section { margin-bottom: 30px; }
            h2 { color: #2c5aa0; margin-bottom: 15px; }
            .input-group { display: flex; gap: 10px; margin-bottom: 15px; }
            input[type="text"] { flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 16px; }
            button { padding: 10px 20px; background: #2c5aa0; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
            button:hover { background: #1e3d73; }
            .mode-selection { display: flex; gap: 20px; margin-bottom: 15px; }
            .mode-selection label { font-size: 14px; }
            #visualizeBtn { background: #4CAF50; }
            #visualizeBtn:hover { background: #388E3C; }
            #resultsSection { margin-top: 30px; }
            .result-card { border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 4px; background: #f9f9f9; }
            .status-searching { color: #777; font-style: italic; }
            .status-found { color: #2c5aa0; font-weight: bold; }
            .status-not-found { color: #d32f2f; font-weight: bold; }
            .prediction-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 10px 0; }
            .prediction-box { background: #e3f2fd; padding: 10px; border-radius: 4px; text-align: center; }
            .phylogeny-section { margin-top: 15px; }
            .phylo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-top: 10px; }
            .phylo-box { background: #eceff1; padding: 10px; border-radius: 4px; text-align: center; font-size: 14px; }
            .phylo-summary { font-style: italic; }
            .evidence-section { margin-top: 15px; }
            .evidence-toggle { background: none; color: #2c5aa0; border: none; padding: 5px; cursor: pointer; font-size: 14px; }
            .evidence-content { display: none; margin-top: 10px; }
            .evidence-snippet { border-left: 3px solid #2c5aa0; padding-left: 10px; margin-bottom: 10px; font-size: 14px; }
            .screen-evidence-container { margin-bottom: 10px; }
            .suggestions-container { position: absolute; background: white; border: 1px solid #ccc; max-height: 200px; overflow-y: auto; width: calc(100% - 100px); z-index: 1000; }
            .suggestion-item { padding: 10px; cursor: pointer; }
            .suggestion-item:hover { background: #e3f2fd; }
            #plot-display-area { margin-top: 20px; }
        </style>
    `;
    setupCiliAIEventListeners();
}

// --- Data Fetching and Caching ---
async function fetchCiliaData() {
    if (ciliaHubDataCache) return ciliaHubDataCache;
    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/ciliahub_data.json');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        ciliaHubDataCache = data.map(gene => ({
            ...gene,
            domain_descriptions: typeof gene.domain_descriptions === 'string' 
                ? gene.domain_descriptions.split(',').map(d => d.trim()) 
                : Array.isArray(gene.domain_descriptions) 
                ? gene.domain_descriptions 
                : []
        }));
        console.log('CiliaHub data loaded and cached successfully.');
        return ciliaHubDataCache;
    } catch (error) {
        console.error("Failed to fetch CiliaHub data:", error);
        return null;
    }
}

async function fetchScreenData() {
    if (screenDataCache) return screenDataCache;
    try {
        const response = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cilia_screens_data.json');
        if (!response.ok) throw new Error(`Failed to fetch screen data: ${response.statusText}`);
        screenDataCache = await response.json();
        console.log('Screen data loaded successfully:', Object.keys(screenDataCache).length, 'genes');
        return screenDataCache;
    } catch (error) {
        console.error('Error fetching screen data:', error);
        return {};
    }
}

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
    document.getElementById('plot-display-area').innerHTML = '';
    document.getElementById('visualizeBtn').style.display = 'none';

    const data = await fetchCiliaData();
    if (!data) {
        resultsContainer.innerHTML = `<p class="status-not-found">Error: CiliaHub data could not be loaded. Please check the console.</p>`;
        return;
    }

    let resultHtml = '';
    let title = `Results for "${query}"`;
    let match;

    try {
        // Phylogeny or distribution of a specific gene
        if ((match = query.match(/(?:distribution of|phylogeny of)\s+([A-Z0-9\-]+)/i))) {
            const geneSymbol = match[1].toUpperCase();
            const phyloData = phylogenyDataCache ? phylogenyDataCache[geneSymbol] : null;
            if (phyloData) {
                let summary = `For <strong>${geneSymbol}</strong>, `;
                const ciliatedPct = phyloData.ciliated_prevalence;
                const nonCiliatedPct = phyloData.non_ciliated_prevalence;
                if (ciliatedPct > 0.9 && nonCiliatedPct < 0.1) summary += "it is highly conserved in ciliated organisms and largely absent from non-ciliated species, suggesting a core ciliary function.";
                else if (ciliatedPct > 0.9 && nonCiliatedPct > 0.9) summary += "it is a highly conserved gene found in nearly all species, both ciliated and non-ciliated.";
                else if (ciliatedPct < 0.1) summary += "it appears to be absent from most ciliated organisms.";
                else summary += `it is found in about <strong>${Math.round(ciliatedPct * 100)}%</strong> of ciliated species and <strong>${Math.round(nonCiliatedPct * 100)}%</strong> of non-ciliated species.`;
                resultHtml = `<div class="result-card"><h3>Phylogenetic Distribution of ${geneSymbol}</h3><p>${summary}</p></div>`;
            } else {
                resultHtml = `<div class="result-card"><p class="status-not-found">No phylogenetic data found for ${geneSymbol}.</p></div>`;
            }
        }
        // Visualize phylogeny of a specific gene
        else if ((match = query.match(/(?:show|visualize) phylogeny of\s+([A-Z0-9\-]+)/i))) {
            const geneSymbol = match[1].toUpperCase();
            resultsContainer.innerHTML = `<div class="result-card"><p>Sure! Here’s the conservation pattern of <strong>${geneSymbol}</strong> across species 👇</p></div>`;
            renderScreenSummaryHeatmap([geneSymbol], await fetchScreenData());
            return; // Exit early as the heatmap is rendered separately
        }
        // List highly conserved or universally conserved genes
        else if ((match = query.match(/(?:list|find|show)\s*(\d*)\s*(highly conserved|universally conserved|present in all ciliated species|present in all species)/i))) {
            const limit = match[1] ? parseInt(match[1], 10) : 10;
            const queryType = match[2];
            let foundGenes = [];
            if (queryType.includes('ciliated')) foundGenes = Object.entries(phylogenyDataCache).filter(([_, data]) => data.ciliated_prevalence === 1).map(([gene]) => gene);
            else foundGenes = Object.entries(phylogenyDataCache).filter(([_, data]) => data.ciliated_prevalence === 1 && data.non_ciliated_prevalence === 1).map(([gene]) => gene);
            resultHtml = `<div class="result-card"><h3>Top ${limit} Genes: ${queryType}</h3>`;
            if (foundGenes.length > 0) resultHtml += `<ul>${foundGenes.slice(0, limit).map(g => `<li>${g}</li>`).join('')}</ul>`;
            else resultHtml += `<p class="status-not-found">No genes matched the specified conservation criteria.</p>`;
            resultHtml += `</div>`;
        }
        // Genes associated with a disease
        else if ((match = query.match(/(?:genes for|what genes are linked to|find genes for|genes involved in)\s+(.*)/i))) {
            const disease = match[1].trim().replace(/\s+/g, ' ').toLowerCase();
            title = `Genes associated with "${disease}"`;
            const diseaseRegex = new RegExp(disease.replace(/ /g, '[\\s-]*'), 'i');
            const results = data.filter(g => g.functional_summary && diseaseRegex.test(g.functional_summary));
            resultHtml = formatSimpleResults(results, title);
        }
        // Genes with a specific protein domain
        else if ((match = query.match(/(?:show me|find|what genes have a)\s+(.*?)\s+domain/i))) {
            const domain = match[1].trim();
            title = `Genes with "${domain}" domain`;
            const results = data.filter(g => g.domain_descriptions && g.domain_descriptions.some(d => d.toLowerCase().includes(domain.toLowerCase())));
            resultHtml = formatDomainResults(results, title);
        }
        // Genes localizing to a specific cellular location
        else if ((match = query.match(/(?:genes localizing to the|genes that localize to the|find genes in the)\s+(.*)/i) || query.match(/(.*)\s+localizing genes/i))) {
            const location = match[1].trim();
            title = `Genes localizing to "${location}"`;
            const results = data.filter(g => g.localization && g.localization.toLowerCase().includes(location.toLowerCase()));
            resultHtml = formatSimpleResults(results, title);
        }
        // Genes associated with a protein complex
        else if (
            (match = query.match(/complex(?:es| components)?\s+(?:for|of|with)\s+([A-Z0-9\-]+)/i)) ||
            (match = query.match(/^([A-Z0-9\-]+)\s+complex(?:es)?$/i)) ||
            (match = query.match(/(?:components of the|show me the)\s+(.*)\s+complex/i))
        ) {
            const complexOrGene = match[1].toUpperCase();
            const gene = data.find(g =>
                g.gene.toUpperCase() === complexOrGene ||
                (g.aliases && g.aliases.map(a => a.toUpperCase()).includes(complexOrGene))
            );
            title = `Complex Information for ${complexOrGene}`;
            resultHtml = formatComplexResults(gene, title);
        }
        // Direct gene analysis
        else if (/^[A-Z0-9]{3,}$/i.test(query.split(' ')[0])) {
            const detectedGene = query.split(' ')[0].toUpperCase();
            document.getElementById('geneInput').value = detectedGene;
            runAnalysis([detectedGene]);
            return;
        }
        // Fallback for unrecognized queries
        else {
            resultHtml = `<p class="status-not-found">Sorry, I didn't understand. Try asking about a gene's phylogeny (e.g., "distribution of IFT88"), highly conserved genes, a disease, protein domain, cellular localization, or a protein complex.</p>`;
        }
        
        resultsContainer.innerHTML = resultHtml;

    } catch (e) {
        resultsContainer.innerHTML = `<p class="status-not-found">An error occurred. Please check the console.</p>`;
        console.error(e);
    }
}

// --- AI Result Formatting Helpers ---
function formatSimpleResults(results, title) {
    if (results.length === 0) return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No matching genes found.</p></div>`;
    let html = `<div class="result-card"><h3>${title} (${results.length} found)</h3><ul>`;
    results.forEach(gene => {
        html += `<li><strong>${gene.gene}</strong>: ${gene.description || 'No description available.'}</li>`;
    });
    return html + '</ul></div>';
}

function formatDomainResults(results, title) {
    if (results.length === 0) return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">No matching genes found.</p></div>`;
    let html = `<div class="result-card"><h3>${title} (${results.length} found)</h3>`;
    results.forEach(gene => {
        const domains = Array.isArray(gene.domain_descriptions) ? gene.domain_descriptions.join(', ') : 'None';
        html += `<div style="border-bottom: 1px solid #eee; padding: 10px 0; margin-bottom: 10px;"><strong>${gene.gene}</strong><ul><li>Domains: ${domains}</li></ul></div>`;
    });
    return html + '</div>';
}

function formatComplexResults(gene, title) {
    if (!gene) return `<div class="result-card"><h3>${title}</h3><p class="status-not-found">Gene not found in the dataset.</p></div>`;
    let html = `<div class="result-card"><h3>${title}</h3>`;
    if (gene.complex_names && gene.complex_names.length > 0) {
        html += '<h4>Complex Names:</h4><ul>';
        gene.complex_names.forEach(name => { html += `<li>${name}</li>`; });
        html += '</ul>';
    } else {
        html += '<p>No complex names listed for this gene.</p>';
    }
    if (gene.complex_components && gene.complex_components.length > 0) {
        html += `<br><h4>Complex Components:</h4><p>${gene.complex_components.join(', ')}</p>`;
    } else {
        html += '<p>No complex components listed for this gene.</p>';
    }
    return html + '</div>';
}

// --- Autocomplete Logic ---
function setupAiQueryAutocomplete() {
    const aiQueryInput = document.getElementById('aiQueryInput');
    const suggestionsContainer = document.getElementById('aiQuerySuggestions');
    if (!aiQueryInput || !suggestionsContainer) return;

    const exampleQueries = [
        "phylogeny of IFT88",
        "distribution of ARL13B",
        "highly conserved genes",
        "show phylogeny of CEP290",
        "genes for Joubert Syndrome",
        "genes for Bardet-Biedl Syndrome",
        "show me WD40 domain genes",
        "show me IFT domain genes",
        "cilia localizing genes",
        "transition zone localizing genes",
        "complexes for IFT88",
        "genes causing short cilia",
        "genes involved in Hedgehog signaling"
    ];

    aiQueryInput.addEventListener('input', () => {
        const inputText = aiQueryInput.value.toLowerCase();
        if (inputText.length < 2) {
            suggestionsContainer.style.display = 'none';
            return;
        }

        const filteredSuggestions = exampleQueries.filter(q => q.toLowerCase().includes(inputText));

        if (filteredSuggestions.length > 0) {
            suggestionsContainer.innerHTML = filteredSuggestions
                .map(q => `<div class="suggestion-item">${q}</div>`)
                .join('');
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
        if (!aiQueryInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
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
        console.warn('One or more CiliAI elements were not found.');
        return;
    }

    analyzeBtn.addEventListener('click', analyzeGenesFromInput);
    aiQueryBtn.addEventListener('click', handleAIQuery);
    visualizeBtn.addEventListener('click', async () => {
        const genes = geneInput.value.split(/[\s,]+/).map(g => g.trim().toUpperCase()).filter(Boolean);
        if (genes.length > 0) {
            const screenData = await fetchScreenData();
            renderScreenSummaryHeatmap(genes, screenData);
        }
    });

    geneInput.addEventListener('keydown', debounce((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            analyzeGenesFromInput();
        }
    }, 300));

    aiQueryInput.addEventListener('keydown', debounce((e) => {
        if (e.key === 'Enter') handleAIQuery();
    }, 300));

    resultsContainer.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('evidence-toggle')) {
            const content = document.getElementById(e.target.dataset.contentId);
            if (content) {
                const isVisible = content.style.display === 'block';
                content.style.display = isVisible ? 'none' : 'block';
                e.target.textContent = isVisible ? `Show Evidence (${e.target.dataset.count}) ▾` : `Hide Evidence (${e.target.dataset.count}) ▴`;
            }
        }
    });

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
                screenEvidence.push({
                    id: `screen-${gene}`,
                    source: 'screen_data',
                    context: renderScreenDataTable(gene, screenDataCache[gene.toUpperCase()])
                });
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
                <div class="prediction-box">
                    <h4>Loss-of-Function (Length)</h4>
                    <p>${dbData.summary.lof_length}</p>
                </div>
                <div class="prediction-box">
                    <h4>Percentage Ciliated</h4>
                    <p>${dbData.summary.percentage_ciliated}</p>
                </div>
            </div>`;
    } else {
        summaryHtml = '<p>No summary prediction available. Review literature and screen evidence for insights.</p>';
    }
    let phylogenyHtml = '';
    if (phyloData) {
        let summaryText = '';
        const ciliatedPct = phyloData.ciliated_prevalence;
        const nonCiliatedPct = phyloData.non_ciliated_prevalence;
        if (ciliatedPct > 0.9 && nonCiliatedPct < 0.1) summaryText = "This gene is highly conserved in ciliated species and rare elsewhere, suggesting a core ciliary function.";
        else if (ciliatedPct > 0.9 && nonCiliatedPct > 0.9) summaryText = "This is a highly conserved housekeeping gene found in nearly all organisms.";
        else summaryText = "This gene shows a variable conservation pattern across species.";
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
        if (screenEv) evidenceHtml += `<h4>Ciliary Screen Data</h4><div class="screen-evidence-container">${screenEv.context}</div>`;
        if (otherEvidence.length > 0) {
            const evidenceSnippets = otherEvidence.map(ev => `
                <div class="evidence-snippet">
                    ${ev.context.replace(new RegExp(`(${gene})`, 'ig'), `<mark>$1</mark>`)}
                    <br><strong>Source: ${ev.source.toUpperCase()} (${ev.id})</strong>
                </div>`).join('');
            evidenceHtml += `
                <button class="evidence-toggle" data-count="${otherEvidence.length}" data-content-id="evidence-${gene}">Show Other Evidence (${otherEvidence.length}) ▾</button>
                <div class="evidence-content" id="evidence-${gene}">${evidenceSnippets}</div>`;
        }
        evidenceHtml += `</div>`;
    }
    return `
        <div class="result-card">
            <h3>${gene} - <span class="${statusClass}">${statusText}</span></h3>
            ${summaryHtml}
            ${phylogenyHtml}
            ${evidenceHtml}
        </div>`;
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
            if (article.tagName.toLowerCase() === 'article') {
                pmid = article.querySelector('article-id[pub-id-type="pmid"]')?.textContent || 'PMC';
                const title = article.querySelector('article-title')?.textContent || '';
                const body = Array.from(article.querySelectorAll('body p')).map(el => el.textContent).join(' ');
                textContent = `${title}. ${body}`;
            } else {
                pmid = article.querySelector('MedlineCitation > PMID')?.textContent || 'PubMed';
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
        const errorEl = resultCard?.querySelector('.status-searching');
        if (errorEl) {
            errorEl.textContent = 'Lit Search Failed';
            errorEl.className = 'status-not-found';
        }
    }
    return foundEvidence;
}

function renderScreenSummaryHeatmap(genes, screenData) {
    if (!window.Plotly) {
        console.error('Plotly is not loaded.');
        document.getElementById('plot-display-area').innerHTML = '<p class="status-not-found">Error: Plotly library failed to load.</p>';
        return;
    }

    const plotArea = document.getElementById('plot-display-area');
    if (!plotArea) return;

    const numberScreens = {
        'Kim et al. (2016) IMCD3 RNAi': 'Kim2016',
        'Wheway et al. (2015) RPE1 RNAi': 'Wheway2015',
        'Roosing et al. (2015) hTERT-RPE1': 'Roosing2015',
        'Basu et al. (2023) MDCK CRISPR': 'Basu2023'
    };
    const signalingScreens = { 'Breslow et al. (2018) Hedgehog Signaling': 'Breslow2018' };
    const numberScreenOrder = Object.keys(numberScreens);
    const signalingScreenOrder = Object.keys(signalingScreens);

    const numberCategoryMap = {
        "Decreased cilia numbers": { v: 1, c: '#0571b0' },
        "Increased cilia numbers": { v: 2, c: '#ca0020' },
        "Causes Supernumerary Cilia": { v: 3, c: '#fdae61' },
        "No effect": { v: 4, c: '#fee090' },
        "Not in Screen": { v: 5, c: '#bdbdbd' },
        "Not Reported": { v: 6, c: '#636363' }
    };
    const signalingCategoryMap = {
        "Decreased Signaling (Positive Regulator)": { v: 1, c: '#2166ac' },
        "Increased Signaling (Negative Regulator)": { v: 2, c: '#d73027' },
        "No Significant Effect": { v: 3, c: '#fdae61' },
        "Not in Screen": { v: 4, c: '#bdbdbd' },
        "Not Reported": { v: 5, c: '#636363' }
    };

    const geneLabels = genes.map(g => g.toUpperCase());
    const zDataNumber = [], textDataNumber = [], zDataSignaling = [], textDataSignaling = [];

    genes.forEach(gene => {
        const numberRowValues = [], numberRowText = [], signalingRowValues = [], signalingRowText = [];
        numberScreenOrder.forEach(screenName => {
            const screenKey = numberScreens[screenName];
            let resultText = "Not in Screen";
            if (screenData[gene]?.screens?.[screenKey]) {
                resultText = screenData[gene].screens[screenKey].result || "Not Reported";
            }
            const mapping = numberCategoryMap[resultText] || numberCategoryMap["Not in Screen"];
            numberRowValues.push(mapping.v);
            numberRowText.push(resultText);
        });
        signalingScreenOrder.forEach(screenName => {
            const screenKey = signalingScreens[screenName];
            let resultText = "Not in Screen";
            if (screenData[gene]?.screens?.[screenKey]) {
                resultText = screenData[gene].screens[screenKey].result || "Not Reported";
            }
            const mapping = signalingCategoryMap[resultText] || signalingCategoryMap["Not in Screen"];
            signalingRowValues.push(mapping.v);
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
        colorscale: [[0, '#0571b0'], [0.2, '#ca0020'], [0.4, '#fdae61'], [0.6, '#fee090'], [0.8, '#636363'], [1.0, '#bdbdbd']],
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
        colorscale: [[0, '#2166ac'], [0.25, '#d73027'], [0.5, '#fdae61'], [0.75, '#636363'], [1.0, '#bdbdbd']],
        showscale: false,
        hovertemplate: '<b>Gene:</b> %{y}<br><b>Screen:</b> %{x}<br><b>Result:</b> %{customdata}<extra></extra>',
        xaxis: 'x2',
        yaxis: 'y1',
        xgap: 1,
        ygap: 1
    };
    
    const layout = {
        title: { text: 'Summary of Ciliary Screen Results', font: { size: 16, family: 'Arial', color: '#2c5aa0' } },
        grid: { rows: 1, columns: 2, pattern: 'independent' },
        xaxis: { domain: [0, 0.78], tickangle: -45, automargin: true },
        xaxis2: { domain: [0.8, 1.0], tickangle: -45, automargin: true },
        yaxis: { automargin: true, tickfont: { size: 10 } },
        margin: { l: 120, r: 220, b: 150, t: 80 },
        height: 400 + (geneLabels.length * 30),
        annotations: []
    };
    
    let current_y = 1.0;
    layout.annotations.push({
        xref: 'paper',
        yref: 'paper',
        x: 1.02,
        y: current_y + 0.05,
        xanchor: 'left',
        text: '<b>Cilia Number/Structure</b>',
        showarrow: false,
        font: { size: 13 }
    });
    Object.entries(numberCategoryMap).forEach(([key, val]) => {
        layout.annotations.push({
            xref: 'paper',
            yref: 'paper',
            x: 1.02,
            y: current_y,
            xanchor: 'left',
            yanchor: 'middle',
            text: `█ ${key}`,
            font: { color: val.c, size: 12 },
            showarrow: false
        });
        current_y -= 0.06;
    });
    current_y -= 0.1;
    layout.annotations.push({
        xref: 'paper',
        yref: 'paper',
        x: 1.02,
        y: current_y + 0.05,
        xanchor: 'left',
        text: '<b>Hedgehog Signaling</b>',
        showarrow: false,
        font: { size: 13 }
    });
    Object.entries(signalingCategoryMap).forEach(([key, val]) => {
        if (key !== "Not in Screen" && key !== "Not Reported") {
            layout.annotations.push({
                xref: 'paper',
                yref: 'paper',
                x: 1.02,
                y: current_y,
                xanchor: 'left',
                yanchor: 'middle',
                text: `█ ${key}`,
                font: { color: val.c, size: 12 },
                showarrow: false
            });
            current_y -= 0.06;
        }
    });

    Plotly.newPlot('plot-display-area', [trace1, trace2], layout, { responsive: true });
}

// --- Helper Functions & Mock DB ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function debounce(fn, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

const CILI_AI_DB = {
    "HDAC6": {
        "summary": {
            "lof_length": "Promotes / Maintains",
            "percentage_ciliated": "No effect",
            "source": "Expert DB"
        },
        "evidence": [{
            "id": "21873644",
            "source": "pubmed",
            "context": "...loss of HDAC6 results in hyperacetylation of tubulin and leads to the formation of longer, more stable primary cilia in renal epithelial cells."
        }]
    },
    "IFT88": {
        "summary": {
            "lof_length": "Inhibits / Restricts",
            "percentage_ciliated": "Reduced cilia numbers",
            "source": "Expert DB"
        },
        "evidence": [{
            "id": "10882118",
            "source": "pubmed",
            "context": "Mutations in IFT88 (polaris) disrupt intraflagellar transport, leading to a failure in cilia assembly and resulting in severely shortened or absent cilia."
        }]
    },
    "ARL13B": {
        "summary": {
            "lof_length": "Inhibits / Restricts",
            "percentage_ciliated": "Reduced cilia numbers",
            "source": "Expert DB"
        },
        "evidence": [{
            "id": "21940428",
            "source": "pubmed",
            "context": "The small GTPase ARL13B is critical for ciliary structure; its absence leads to stunted cilia with abnormal morphology and axonemal defects."
        }]
    }
};

// --- Global Exposure for Router ---
window.displayCiliAIPage = displayCiliAIPage;
window.setupCiliAIEventListeners = setupCiliAIEventListeners;
window.handleAIQuery = handleAIQuery;
window.analyzeGenesFromInput = analyzeGenesFromInput;
window.runAnalysis = runAnalysis;
window.analyzeGeneViaAPI = analyzeGeneViaAPI;
window.fetchScreenData = fetchScreenData;
window.createResultCard = createResultCard;
window.createPlaceholderCard = createPlaceholderCard;
window.renderScreenSummaryHeatmap = renderScreenSummaryHeatmap;
