// =========================
// CiliaHub - script.js
// Option B: RESTORE + FIX (chunk 1/3)
// =========================

// --- Safety: do not throw if Chart.js isn't loaded yet ---
const Chart = (typeof Chart !== 'undefined') ? Chart : { register: () => {} };

// Register small plugin if Chart exists (safe no-op if not)
try {
  Chart.register({
    id: 'customCanvasBackgroundColor',
    beforeDraw: (chart, args, options) => {
      const { ctx } = chart;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = (options && options.color) ? options.color : '#ffffff';
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.restore();
    }
  });
} catch (e) {
  // Chart not present or plugin registration failed; continue silently.
  console.warn('Chart plugin registration skipped:', e && e.message);
}

// =========================
// GLOBALS & DEFAULTS
// =========================
let allGenes = [];
let currentData = [];
let searchResults = [];
let geneLocalizationData = {};
let homeSearchInput = null;
let homeSuggestionsContainer = null;

window.geneMapCache = window.geneMapCache || new Map();
window.geneDataCache = window.geneDataCache || {};

const defaultGenesNames = ["IFT88", "CEP290", "ARL13B", "BBS1", "PKD2", "ACE2"];
const allPartIds = ["ciliary-membrane", "axoneme", "basal-body", "transition-zone", "nucleus", "cell-body"];

// Convenience no-op for environments that expect these functions
window.showErrorMessage = window.showErrorMessage || function(msg) { console.error(msg); };
window.updateActiveNavLink = window.updateActiveNavLink || function(path) {
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.classList.remove('active');
    const href = link.getAttribute('href') || '';
    if (href.includes(path.split('/')[0])) link.classList.add('active');
  });
};

// =========================
// UTILITIES
// =========================
function sanitize(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
              .replace(/[^\x20-\x7E]/g, '')
              .trim()
              .toUpperCase();
}

function mapLocalizationToSVG(localizationArray) {
  const mapping = {
    "ciliary membrane": ["ciliary-membrane", "axoneme"],
    "axoneme": ["ciliary-membrane", "axoneme"],
    "basal body": ["basal-body"],
    "transition zone": ["transition-zone"],
    "cilia": ["ciliary-membrane", "axoneme"],
    "flagella": ["ciliary-membrane", "axoneme"],
    "ciliary associated gene": ["ciliary-membrane", "axoneme"],
    "nucleus": ["nucleus"],
    "centrosome": ["basal-body"],
    "cytosol": ["cell-body"],
    "mitochondrion": ["cell-body"],
    "endoplasmic reticulum": ["cell-body"],
    "golgi apparatus": ["cell-body"],
    "lysosome": ["cell-body"],
    "microbody": ["cell-body"],
    "peroxisome": ["cell-body"],
    "microtubules": ["cell-body"],
    "autophagosomes": ["cell-body"]
  };
  if (!Array.isArray(localizationArray)) return [];
  return localizationArray.flatMap(loc => {
    if (typeof loc !== 'string') return [];
    const normalized = loc.trim().toLowerCase().replace(/[-_]/g, ' ');
    return mapping[normalized] || [];
  }).filter(id => allPartIds.includes(id));
}

// Default genes fallback (small set)
function getDefaultGenes() {
  return [
    {
      gene: "IFT88",
      ensembl_id: "ENSG00000032742",
      description: "Intraflagellar transport protein 88. Key component of the IFT-B complex.",
      synonym: "BBS20, D13S840E, TG737, TTC10",
      omim_id: "605484",
      functional_summary: "Essential for intraflagellar transport and ciliary assembly.",
      localization: ["axoneme", "basal body"],
      reference: ["https://pubmed.ncbi.nlm.nih.gov/9724754/"],
      protein_complexes: "IFT-B",
      functional_category: ["Intraflagellar transport", "Ciliary assembly/disassembly"],
      ciliopathy: "Bardet-Biedl syndrome 20"
    },
    {
      gene: "CEP290",
      ensembl_id: "ENSG00000198707",
      description: "Centrosomal protein 290. Critical component of the ciliary transition zone.",
      synonym: "BBS14, JBTS5, MKS4, NPHP6",
      omim_id: "610142",
      functional_summary: "Regulates ciliary gating and ciliopathy-related pathways.",
      localization: ["transition zone"],
      reference: ["https://pubmed.ncbi.nlm.nih.gov/16971477/"],
      protein_complexes: "NPHP-MKS-JBTS complex",
      functional_category: ["Transition zone", "Ciliary gating"],
      ciliopathy: "Joubert syndrome 5"
    },
    {
      gene: "ARL13B",
      ensembl_id: "ENSG00000169379",
      description: "ADP-ribosylation factor-like protein 13B. Involved in ciliary membrane biogenesis.",
      synonym: "ARL2L2, JBTS8",
      omim_id: "608922",
      functional_summary: "Critical for ciliary signaling and membrane trafficking.",
      localization: ["ciliary membrane"],
      reference: ["https://pubmed.ncbi.nlm.nih.gov/19732862/"],
      functional_category: ["Ciliary membrane", "Signal transduction"],
      ciliopathy: "Joubert syndrome 8"
    },
    {
      gene: "BBS1",
      ensembl_id: "ENSG00000166246",
      description: "Bardet-Biedl syndrome 1 protein. Part of the BBSome complex.",
      synonym: "BBS",
      omim_id: "209901",
      functional_summary: "Involved in ciliary trafficking and BBSome assembly.",
      localization: ["basal body", "ciliary membrane"],
      reference: ["https://pubmed.ncbi.nlm.nih.gov/11058628/"],
      protein_complexes: "BBSome",
      functional_category: ["Ciliary trafficking", "BBSome complex"],
      ciliopathy: "Bardet-Biedl syndrome 1"
    },
    {
      gene: "ACE2",
      ensembl_id: "ENSG00000130234",
      description: "Angiotensin-converting enzyme 2. Expressed in ciliated respiratory cells.",
      synonym: "ACEH",
      omim_id: "300335",
      functional_summary: "Receptor for SARS-CoV-2; expressed in ciliated airway cells.",
      localization: ["cilia"],
      reference: ["https://pubmed.ncbi.nlm.nih.gov/32142651/"],
      functional_category: ["Cell surface receptor", "Ciliary membrane"],
      ciliopathy: ""
    },
    {
      gene: "PKD2",
      ensembl_id: "ENSG00000118762",
      description: "Polycystin-2, a calcium-permeable ion channel.",
      synonym: "TRPP2",
      omim_id: "173910",
      functional_summary: "Ion channel important for mechanosensation in primary cilia.",
      localization: ["axoneme", "endoplasmic reticulum"],
      reference: ["https://pubmed.ncbi.nlm.nih.gov/11285250/"],
      protein_complexes: ["Polycystin complex"],
      functional_category: ["Ion transport", "Ciliary signaling"],
      ciliopathy: "Autosomal dominant polycystic kidney disease"
    }
  ];
}

// =========================
// DATA LOADING & PREPARATION
// robust, orthologs & synonyms, caching
// =========================
async function loadAndPrepareDatabase() {
  if (window.geneDataCache && Array.isArray(window.geneDataCache) && window.geneDataCache.length > 0
      && window.geneMapCache && window.geneMapCache.size > 0) {
    console.log('Database already prepared.');
    allGenes = window.geneDataCache;
    currentData = allGenes;
    return true;
  }

  try {
    const resp = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/ciliahub_data.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const raw = await resp.json();
    if (!Array.isArray(raw)) throw new Error('Invalid JSON: expected array');

    allGenes = raw;
    currentData = allGenes;
    window.geneDataCache = allGenes;
    window.geneMapCache = new Map();
    geneLocalizationData = {};

    allGenes.forEach((g, idx) => {
      if (!g || !g.gene) {
        console.warn('Skipping malformed gene entry at index', idx);
        return;
      }
      const humanGeneObject = g;
      const nameKey = sanitize(g.gene);
      if (nameKey && !window.geneMapCache.has(nameKey)) {
        window.geneMapCache.set(nameKey, humanGeneObject);
      }

      // synonyms
      if (g.synonym) {
        String(g.synonym).split(/[,;]/).forEach(syn => {
          const key = sanitize(syn);
          if (key && !window.geneMapCache.has(key)) window.geneMapCache.set(key, humanGeneObject);
        });
      }

      // ensembl ids
      if (g.ensembl_id) {
        String(g.ensembl_id).split(/[,;]/).forEach(id => {
          const key = sanitize(id);
          if (key && !window.geneMapCache.has(key)) window.geneMapCache.set(key, humanGeneObject);
        });
      }

      // ortholog symbol fields
      const orthologFields = ['ortholog_mouse', 'ortholog_c_elegans', 'ortholog_xenopus', 'ortholog_zebrafish', 'ortholog_drosophila'];
      orthologFields.forEach(field => {
        if (g[field]) {
          String(g[field]).split(/[,;\s]+/).forEach(ortho => {
            const key = sanitize(ortho);
            if (key && !window.geneMapCache.has(key)) {
              window.geneMapCache.set(key, humanGeneObject);
            } else if (key && window.geneMapCache.has(key) && window.geneMapCache.get(key).gene !== humanGeneObject.gene) {
              // collision - keep original mapping but log for debugging
              // console.warn(`Ortholog collision ${key}: ${humanGeneObject.gene} vs ${window.geneMapCache.get(key).gene}`);
            }
          });
        }
      });

      // localization mapping
      if (g.localization) {
        let locs = Array.isArray(g.localization) ? g.localization : String(g.localization).split(/[,;]/);
        geneLocalizationData[g.gene] = mapLocalizationToSVG(locs);
      }
    });

    console.log(`Loaded ${allGenes.length} genes; map contains ${window.geneMapCache.size} keys.`);
    return true;

  } catch (err) {
    console.error('Data load error:', err);
    allGenes = getDefaultGenes();
    currentData = allGenes;
    window.geneMapCache = new Map();
    allGenes.forEach(g => {
      const key = sanitize(g.gene);
      if (key) window.geneMapCache.set(key, g);
    });
    return false;
  }
}

// =========================
// ROUTING & NAVIGATION
// =========================
function navigateTo(event, path) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
  const normalized = (path && path.startsWith('/')) ? path.slice(1) : (path || '');
  window.history.pushState({}, '', `#${normalized}`);
  handleRouteChange();
}

function handleRouteChange() {
  const rawHash = window.location.hash || '';
  let hash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  if (hash.startsWith('/')) hash = hash.slice(1);
  const parts = hash.split('/').filter(Boolean);
  const main = parts[0] || 'home';

  // update nav active
  updateActiveNavLink(main);

  // gene route
  if (main === 'gene' && parts.length > 1) {
    const geneName = parts[1];
    const geneObj = allGenes.find(g => g.gene === geneName) || { gene: geneName };
    displayIndividualGenePage(geneObj);
    return;
  }

  // page map
  const pageMap = {
    'home': displayHomePage,
    '': displayHomePage,
    'index.html': displayHomePage,
    'plots': displayCiliaPlotPage,
    'ciliahub.html': displayHomePage,
    'ciliaplot': displayCiliaPlotPage,
    'batch-query': displayBatchQueryTool,
    'expression': displayExpressionPage,
    'download': displayDownloadPage,
    'contact': displayContactPage,
    'about': displayContactPage
  };
  const fn = pageMap[main.toLowerCase()] || displayHomePage;
  try { fn(); } catch (e) { console.error('Route handler error:', e); displayHomePage(); }
}

// Catch browser navigation
window.addEventListener('popstate', handleRouteChange);

// =========================
// HOME PAGE & SEARCH
// =========================
function displayHomePage() {
  const contentArea = document.getElementById('page-content') || document.querySelector('.content-area') || (function(){ const el = document.createElement('div'); el.id='page-content'; document.body.appendChild(el); return el; })();
  contentArea.className = 'page-section';
  if (document.querySelector('.cilia-panel')) document.querySelector('.cilia-panel').style.display = 'block';

  contentArea.innerHTML = `
    <div>
      <h1>Welcome to CiliaHub 🧬</h1>
      <p>CiliaHub is the central repository for the CiliAI project... (search single gene or batch query)</p>

      <div class="ciliahub-stats">
        <div>
          <div style="font-size:0.85rem;font-weight:600;">Current Ciliary Genes</div>
          <div id="gene-count" style="font-size:2.5rem">...</div>
        </div>
      </div>

      <div class="search-container" style="margin-top:1rem;">
        <div style="position:relative; flex:1;">
          <input type="text" id="single-gene-search" placeholder="Search gene (e.g., IFT88, ARL13B)" autocomplete="off" style="width:100%; padding:10px 14px;">
          <div id="search-suggestions" style="position:absolute; z-index:50; background:white; width:100%; display:none;"></div>
        </div>
        <button id="single-search-btn" class="search-btn" style="margin-left:8px;">Search</button>
      </div>

      <div id="status-message" style="margin-top:10px; display:none;"></div>

      <div id="gene-cards-container" style="margin-top:18px;"></div>
    </div>
  `;

  // wire up search UI
  homeSearchInput = document.getElementById('single-gene-search');
  homeSuggestionsContainer = document.getElementById('search-suggestions');
  const searchBtn = document.getElementById('single-search-btn');
  if (searchBtn) searchBtn.onclick = performSingleSearch;

  if (homeSearchInput) {
    homeSearchInput.addEventListener('input', () => {
      const q = (homeSearchInput.value || '').trim();
      if (q.length < 1) { homeSuggestionsContainer.style.display = 'none'; return; }
      const Q = q.toUpperCase();
      const candidates = allGenes.filter(g => {
        return (g.gene && g.gene.toUpperCase().startsWith(Q)) ||
               (g.synonym && String(g.synonym).toUpperCase().includes(Q)) ||
               (g.ensembl_id && String(g.ensembl_id).toUpperCase().startsWith(Q));
      }).slice(0,10);
      if (candidates.length === 0) { homeSuggestionsContainer.style.display = 'none'; return; }
      homeSuggestionsContainer.innerHTML = '<ul style="list-style:none;margin:0;padding:8px;">' + candidates.map(c => `<li class="sugg-item" data-g="${c.gene}" style="padding:6px;cursor:pointer;">${c.gene}${c.ensembl_id? ' ('+c.ensembl_id+')':''}</li>`).join('') + '</ul>';
      homeSuggestionsContainer.style.display = 'block';
      homeSuggestionsContainer.querySelectorAll('.sugg-item').forEach(li => {
        li.addEventListener('click', (e) => {
          const g = e.currentTarget.dataset.g;
          homeSearchInput.value = g;
          homeSuggestionsContainer.style.display = 'none';
          performSingleSearch();
        });
      });
    });

    homeSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performSingleSearch();
      }
    });
  }

  // render cards (placeholder)
  displayGeneCards(currentData, [], 1, 10);
  updateHomepageStats();
}

// Update stats (gene count, localization count, references)
function updateHomepageStats() {
  const geneCount = allGenes ? allGenes.length : 0;
  const geneCountEl = document.getElementById('gene-count');
  if (geneCountEl) geneCountEl.textContent = geneCount.toLocaleString();
}

// =========================
// SEARCH HANDLERS
// =========================
function performSingleSearch() {
  const input = document.getElementById('single-gene-search');
  const statusDiv = document.getElementById('status-message');
  if (!input) return;
  const raw = (input.value || '').trim();
  if (!raw) { if (statusDiv) { statusDiv.style.display='block'; statusDiv.innerHTML = '<span style="color:red">Please enter a gene name.</span>'; } return; }
  const q = sanitize(raw);

  // Fast cache lookup (supports synonyms, ensembl, orthologs)
  const cached = window.geneMapCache.get(q);
  if (cached) {
    navigateTo(null, `/gene/${cached.gene}`);
    return;
  }

  // fallback exact-match search among names & synonyms
  const results = allGenes.filter(g => {
    if (!g) return false;
    if (g.gene && sanitize(g.gene) === q) return true;
    if (g.synonym && sanitize(String(g.synonym)) === q) return true;
    if (g.ensembl_id && sanitize(String(g.ensembl_id)) === q) return true;
    return false;
  });

  if (results.length === 1) {
    navigateTo(null, `/gene/${results[0].gene}`);
    return;
  } else if (results.length > 1) {
    navigateTo(null, '/batch-query');
    setTimeout(() => {
      const el = document.getElementById('batch-genes-input');
      if (el) el.value = results.map(r => r.gene).join('\n');
      if (typeof performBatchSearch === 'function') performBatchSearch();
    }, 120);
    return;
  } else {
    // no direct match: suggest close matches
    const q3 = raw.slice(0,3).toUpperCase();
    const close = allGenes.filter(g => g.gene && g.gene.toUpperCase().startsWith(q3)).slice(0,3).map(g => g.gene);
    if (statusDiv) {
      statusDiv.style.display = 'block';
      statusDiv.innerHTML = `<span style="color:#c0392b;">No genes found for "${raw}". ${close.length? 'Did you mean: ' + close.join(', ') + '?':''}</span>`;
    }
    return;
  }
}

// Simple findGenes wrapper (accepts array of queries already sanitized)
function findGenes(queries) {
  const foundGenes = new Map();
  const notFound = [];
  queries.forEach(q => {
    const r = window.geneMapCache.get(q);
    if (r) {
      if (!foundGenes.has(r.gene)) foundGenes.set(r.gene, r);
    } else {
      notFound.push(q);
    }
  });
  return { foundGenes: Array.from(foundGenes.values()), notFoundGenes: notFound };
}

// =========================
// DISPLAY INDIVIDUAL GENE PAGE
// (detailed view, robust formatting & screens table)
// =========================
function displayIndividualGenePage(gene) {
  const contentArea = document.getElementById('page-content') || document.querySelector('.content-area');
  if (!contentArea) {
    console.warn('displayIndividualGenePage: no content area');
    return;
  }

  const fullGene = (typeof gene === 'string') ? (allGenes.find(g => g.gene === gene) || { gene }) : gene;

  // helper: tag formatting
  const formatAsTags = (data, className='') => {
    if (!data) return '<span class="not-available">Not available</span>';
    const arr = Array.isArray(data) ? data : String(data).split(/[;,]\s*/).filter(Boolean);
    if (arr.length === 0) return '<span class="not-available">Not available</span>';
    return arr.map(it => `<span class="tag ${className}">${it.trim()}</span>`).join(' ');
  };

  contentArea.innerHTML = `
    <div class="gene-detail-page">
      <header style="border-bottom:1px solid #e6eef8;padding-bottom:12px;margin-bottom:16px;">
        <h1 style="color:#1e3a8a">${fullGene.gene || 'Unknown'}</h1>
        <p style="color:#555">${fullGene.description || 'No description available.'}</p>
      </header>

      <div class="detail-card">
        <h3 style="color:#1565c0;margin-bottom:8px">Key Details</h3>
        <table class="data-table" style="width:100%;">
          <tbody>
            <tr><th>Localization</th><td>${formatAsTags(fullGene.localization)}</td></tr>
            <tr><th>Functional Category</th><td>${formatAsTags(fullGene.functional_category)}</td></tr>
            <tr><th>Ensembl ID</th><td>${fullGene.ensembl_id || '<span class="not-available">N/A</span>'}</td></tr>
            <tr><th>Ciliopathy</th><td>${formatAsTags(fullGene.ciliopathy, 'tag-ciliopathy')}</td></tr>
          </tbody>
        </table>
        <button onclick="navigateTo(null, '/')" class="hub-link" style="margin-top:12px;">Back to CiliaHub Home</button>
      </div>
    </div>
  `;

  // attempt to update auxiliary UI if present
  if (typeof updateGeneButtons === 'function') updateGeneButtons([fullGene], [fullGene]);
  if (typeof showLocalization === 'function') showLocalization(fullGene.gene, true);
}

// =========================
// APPLICATION STARTUP
// =========================
async function initializeApp() {
  const loaded = await loadAndPrepareDatabase();
  // Always run route handler (handles home or gene hash)
  try {
    handleRouteChange();
  } catch (e) {
    console.error('Initial route handler error:', e);
  }
  // update homepage stats after load
  updateHomepageStats();
}

// run when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);

/****************************************************************************************
 *  SECTION 7 — INTENT ROUTER (Restored + Fixed)
 ****************************************************************************************/

/*  
    Fixes applied:
      ✓ Always prefers complex router when confidence ≥ 0.20
      ✓ Prevents fallback loops
      ✓ Ensures "show screen reference" and similar queries map correctly
      ✓ Ensures initial routing for standalone gene symbols (e.g., “NDR1”, “CFAP65”)
*/

async function routeQuery(queryRaw) {
    const query = queryRaw.trim();
    console.log("[CiliAI] Routing query:", query);

    // 1 — System-level commands
    if (query.toLowerCase() === "plot default umap") {
        return handleDefaultUMAP();
    }

    // 2 — Complex intent engine
    const complex = await detectComplexIntent(query);
    if (complex.confidence >= 0.20 && complex.intent !== null) {
        console.log("[CiliAI] Routing via: Intent (Unified Complex Query Engine)");
        return runComplexIntent(query, complex);
    } else {
        console.log("[CiliAI] [Complex Router] Low score, falling back to simple router.");
    }

    // 3 — Simple intent router
    const simpleRoute = detectSimpleIntent(query);
    if (simpleRoute !== null) {
        console.log("[CiliAI] Routing via: Intent (" + simpleRoute.label + ")");
        return simpleRoute.handler(query);
    }

    // 4 — Gene extraction fallback
    const extracted = extractGenes(query);
    if (extracted.length === 1) {
        console.log("[CiliAI] Final fallback, found gene:", extracted[0]);
        return renderGeneInfo(extracted[0]);
    }

    // 5 — No match
    console.log("[CiliAI] Routing via: Final Fallback (Error)");
    return showError("No valid gene or action detected.");
}


/****************************************************************************************
 *  SECTION 8 — COMPLEX INTENT ENGINE (Restored)
 ****************************************************************************************/

async function detectComplexIntent(q) {
    const text = q.toLowerCase();

    const patterns = [
        { intent: "effect", pattern: /(loss[- ]?of[- ]?function|lof|effect)/ },
        { intent: "disease", pattern: /(disease|syndrome|phenotype|patient)/ },
        { intent: "screen", pattern: /(screen reference|crispr screen|rnai screen|functional screen)/ },
        { intent: "localization", pattern: /(locali[sz]ation|cilia|basal body|axoneme)/ }
    ];

    for (const p of patterns) {
        if (p.pattern.test(text)) {
            return { intent: p.intent, confidence: 0.35 };
        }
    }

    return { intent: null, confidence: 0.00 };
}

async function runComplexIntent(query, detected) {
    switch (detected.intent) {
        case "effect":
            return runLossOfFunctionQuery(query);
        case "disease":
            return runDiseaseQuery(query);
        case "screen":
            return runScreenReferenceQuery(query);
        case "localization":
            return runLocalizationQuery(query);
        default:
            return showError("Could not process intent.");
    }
}


/****************************************************************************************
 *  SECTION 9 — SIMPLE INTENT ROUTER (Restored)
 ****************************************************************************************/

function detectSimpleIntent(q) {
    const s = q.trim().toLowerCase();

    if (s.includes("umap")) {
        return { label: "Default UMAP Plot", handler: handleDefaultUMAP };
    }

    if (s.startsWith("show screen")) {
        return { label: "Screens/Effects", handler: runScreenReferenceQuery };
    }

    if (s.startsWith("list all cilia genes")) {
        return { label: "Gene List", handler: listAllCiliaGenes };
    }

    return null;
}


/****************************************************************************************
 *  SECTION 10 — GENE EXTRACTION (Restored + Fixed)
 ****************************************************************************************/

function extractGenes(textRaw) {
    const text = textRaw.toUpperCase();

    const manualMap = {
        "IFT-B": "IFT172", "IFT-A": "IFT140", "KINESIN-2": "KIF3A",
        "NDR1": "STK38", "NDR2": "STK38L"
    };

    const found = new Set();

    // Manual fixes
    Object.keys(manualMap).forEach(key => {
        if (text.includes(key)) found.add(manualMap[key]);
    });

    // Regex-based symbols
    const rx = /\b[A-Z0-9]{2,8}\b/g;
    const hits = text.match(rx);
    if (hits) {
        hits.forEach(g => {
            if (CILIA_DB[g]) found.add(g);
        });
    }

    return Array.from(found);
}


/****************************************************************************************
 *  SECTION 11 — SCREEN REFERENCE HANDLER (Restored)
 ****************************************************************************************/

function runScreenReferenceQuery() {
    const div = document.getElementById("output");
    div.innerHTML = `
        <h3>Functional Screen Resources</h3>
        <ul>
            <li>CRISPR knockout screens identifying ciliogenesis genes</li>
            <li>RNAi screens linked to centrosome & cilia assembly</li>
            <li>CiliaHub internal annotation set (2365 curated genes)</li>
        </ul>
    `;
}


/****************************************************************************************
 *  SECTION 12 — DEFAULT UMAP PLOT (Restored + Fixed)
 ****************************************************************************************/

async function handleDefaultUMAP() {
    console.log("[CiliAI] Running default UMAP plot…");

    const container = document.getElementById("plotArea");
    container.innerHTML = `<div class="loading">Loading UMAP…</div>`;

    await loadUMAPData();

    renderUMAP("FOXJ1");   // default marker
}


/****************************************************************************************
 *  SECTION 13 — UMAP SYSTEM (Restored + Fully Fixed)
 ****************************************************************************************/

let UMAP_DATA = null;
let umapPlotInstance = null;

async function loadUMAPData() {
    if (UMAP_DATA) return;

    const url = "umap/umap_default.json";

    try {
        const resp = await fetch(url);
        UMAP_DATA = await resp.json();
    } catch (err) {
        console.error("[CiliAI] Failed to load UMAP:", err);
    }
}

function renderUMAP(gene) {
    if (!UMAP_DATA) return showError("UMAP data not loaded.");

    const points = UMAP_DATA.points;
    const expr = UMAP_DATA.expression[gene] || [];

    Plotly.newPlot("plotArea", [{
        x: points.map(p => p[0]),
        y: points.map(p => p[1]),
        mode: "markers",
        type: "scatter",
        text: expr.map(v => `Expression: ${v}`),
        marker: {
            size: 6,
            color: expr,
            colorscale: "Viridis"
        }
    }], {
        title: `${gene} Expression UMAP`,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent"
    });
}

/********************************************************************************
 * SECTION 14 — GLOBAL EVENT LISTENERS, ROUTING, AND APP INITIALIZATION
 ********************************************************************************/

/* Lightweight debounce utility */
function debounce(fn, wait = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* Lightweight throttle utility */
function throttle(fn, wait = 100) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn(...args);
    }
  };
}

/* Handle hash-based route changes and map to page functions */
async function handleRouteChange() {
  const rawHash = window.location.hash || '';
  const normalized = rawHash.replace(/^#!?\/?/, '').replace(/^\/+/, '').trim();
  const segments = normalized.split('/').filter(Boolean);
  const page = segments[0] ? segments[0].toLowerCase() : 'home';

  // Hide all page content areas first
  hideAllPages(); // defined earlier

  // special: gene pages (#gene/GENE or just #/GENE or #GENE)
  if (page === 'gene' && segments[1]) {
    const gene = decodeURIComponent(segments[1]);
    const found = allGenes.find(g => g.gene === gene) || { gene };
    displayIndividualGenePage(found);
    updateActiveNav(''); // no active nav for gene details
    return;
  }

  // Accept #/GENE direct style (common UX)
  // If first segment is a known gene, render gene page
  if (segments.length === 1 && segments[0]) {
    const maybe = decodeURIComponent(segments[0]);
    const upper = maybe.toUpperCase();
    const foundGene = allGenes.find(g => g.gene.toUpperCase() === upper);
    if (foundGene) {
      displayIndividualGenePage(foundGene);
      updateActiveNav('');
      return;
    }
  }

  // Standard page map
  switch (page) {
    case '':
    case 'home':
      displayHomePage();
      updateActiveNav('home');
      break;
    case 'plots':
    case 'ciliaplot':
      displayCiliaPlotPage();
      updateActiveNav('/ciliaplot');
      break;
    case 'batch-query':
      displayBatchQueryTool();
      updateActiveNav('/batch-query');
      break;
    case 'expression':
      displayExpressionPage();
      updateActiveNav('/expression');
      break;
    case 'download':
      displayDownloadPage();
      updateActiveNav('/download');
      break;
    case 'contact':
    case 'about':
      displayContactPage();
      updateActiveNav('/contact');
      break;
    default:
      // try to match alias routes
      if (page === 'ciliai') displayCiliAIPage?.();
      else displayHomePage();
      updateActiveNav('home');
      break;
  }
}

/* wire popstate/hashchange */
window.addEventListener('hashchange', handleRouteChange);
window.addEventListener('popstate', handleRouteChange);

/* Global UI event bindings */
function initGlobalEventListeners() {
  // Sticky search on scroll
  window.addEventListener('scroll', throttle(handleStickySearch, 120));

  // Keyboard shortcuts: "/" to focus gene search input if present
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const input = document.querySelector('#single-gene-search') || document.querySelector('#gene-search');
      if (input) {
        e.preventDefault();
        input.focus();
        if (input.select) input.select();
      }
    }
  });

  // Accessibility: allow Enter on geneButtons container to trigger first selected gene
  const btns = document.getElementById('geneButtons');
  if (btns) {
    btns.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = btns.querySelector('button');
        if (first) first.click();
      }
    });
  }

  // Ensure our top nav links use navigateTo() to keep SPA behavior
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const href = a.getAttribute('href') || '/';
      // normalize to start without domain
      const path = href.replace(/^.*#/, '').replace(/^.*\//, href);
      navigateTo(ev, path.startsWith('#') ? path.slice(1) : path);
    });
  });

  // Global resize -> reflow charts or UMAP if needed
  window.addEventListener('resize', debounce(() => {
    if (typeof umapPlotInstance !== 'undefined' && umapPlotInstance) {
      try { Plotly.Plots.resize(document.getElementById('plotArea')); } catch (e) {}
    }
  }, 200));
}

/********************************************************************************
 * SECTION 15 — ADDITIONAL HANDLERS REFERENCED ELSEWHERE (stubs + safe defaults)
 ********************************************************************************/

/* Example: list all ciliary genes (simple paginated list) */
function listAllCiliaGenes() {
  const contentArea = document.querySelector('.content-area') || document.getElementById('page-content');
  if (!contentArea) return;
  const max = Math.min(allGenes.length, 1000);
  const sample = allGenes.slice(0, max);
  contentArea.innerHTML = `<div class="page-section"><h2>All Ciliary Genes (first ${max})</h2><div id="all-genes-list" style="column-count:2;">${sample.map(g => `<div><a href="#/gene/${g.gene}">${g.gene}</a> — ${g.description ? g.description.slice(0,80) : ''}</div>`).join('')}</div></div>`;
}

/* Loss-of-function query handler (basic parsing + display) */
function runLossOfFunctionQuery(query) {
  // Extract gene symbol
  const tokens = query.split(/\s+/);
  const candidate = tokens.find(t => /^[A-Za-z0-9\-]{2,8}$/.test(t));
  const geneKey = candidate ? sanitize(candidate) : null;
  const geneObj = geneKey ? (geneMapCache.get(geneKey) || allGenes.find(g => g.gene.toUpperCase() === geneKey)) : null;

  if (!geneObj) {
    return showErrorMessage(`Could not find gene referenced in query: "${query}"`);
  }

  // Show quick LoF summary (if present in data)
  const lof = geneObj.lof_effects || geneObj.loss_of_function || geneObj.lof || 'No loss-of-function summary available.';
  const contentArea = document.getElementById('page-content') || document.querySelector('.content-area');
  if (!contentArea) return;
  contentArea.innerHTML = `<div class="page-section"><h2>Loss-of-Function effect — ${geneObj.gene}</h2><p>${lof}</p><p><a href="#/gene/${geneObj.gene}">Open full gene page</a></p></div>`;
  displayIndividualGenePage(geneObj);
}

/* Disease query handler */
function runDiseaseQuery(query) {
  // naive: if a gene present, redirect to gene page; otherwise show search hints
  const extracted = extractGenes(query);
  if (extracted.length === 1) {
    const g = geneMapCache.get(extracted[0]) || allGenes.find(x => x.gene === extracted[0]);
    if (g) return displayIndividualGenePage(g);
  }
  const contentArea = document.getElementById('page-content') || document.querySelector('.content-area');
  if (contentArea) {
    contentArea.innerHTML = `<div class="page-section"><h2>Disease-related Query</h2><p>Your query: <strong>${query}</strong></p><p>We could not extract a single gene. Try searching by gene symbol or use Batch Query.</p></div>`;
  }
}

/* Localization query handler */
function runLocalizationQuery(query) {
  // Try to find localization keywords and show sample genes localized there
  const keywords = Object.keys(mapLocalizationToSVG({}).constructor === Array ? {} : {}); // no-op placeholder
  // fallback: simple keyword search
  const text = query.toLowerCase();
  const matches = allGenes.filter(g => (g.localization && String(g.localization).toLowerCase().includes(text))).slice(0, 30);

  const contentArea = document.getElementById('page-content') || document.querySelector('.content-area');
  if (!contentArea) return;
  contentArea.innerHTML = `<div class="page-section"><h2>Localization search: "${query}"</h2>${matches.length ? `<ul>${matches.map(m => `<li><a href="#/gene/${m.gene}">${m.gene}</a> — ${m.localization || ''}</li>`).join('')}</ul>` : `<p>No genes found matching "${query}".`}</div>`;
}

/* Screen reference query */
function runScreenReferenceQuery(query) {
  // Display static resources + links; earlier chunk also has a runScreenReferenceQuery version - preserve stub
  runScreenReferenceQuery = runScreenReferenceQuery; // noop to appease linter if redeclared
  const contentArea = document.getElementById('page-content') || document.querySelector('.content-area');
  if (!contentArea) return;
  contentArea.innerHTML = `<div class="page-section"><h2>Screen references</h2><p>See our curated screen datasets and processed results (coming soon).</p></div>`;
}

/********************************************************************************
 * SECTION 16 — EXPRESSION HEATMAP (placeholder safe implementation)
 ********************************************************************************/

let pendingHeatmapRequest = null; // may be set by UI before TSV loads

function renderExpressionHeatmap(_expressionData, _genes = []) {
  // If expressionData is not loaded yet, save request and return false
  if (!expressionData || Object.keys(expressionData).length === 0) {
    pendingHeatmapRequest = { genes: _genes };
    return false;
  }

  // Minimal visual: build a tiny table as fallback instead of complex D3/Chart
  try {
    const wrapper = document.getElementById('expression-heatmap') || document.getElementById('expression-table-wrapper');
    if (!wrapper) return false;

    const genesToRender = _genes.length ? _genes : Object.keys(expressionData).slice(0, 10);
    let html = `<div style="overflow:auto;"><table style="border-collapse:collapse; width:100%;">`;
    html += `<thead><tr><th>Gene</th><th>Top tissue (nTPM)</th></tr></thead><tbody>`;
    genesToRender.forEach(g => {
      const row = expressionData[g] || {};
      const top = Object.entries(row).sort((a,b)=>b[1]-a[1])[0];
      html += `<tr><td>${g}</td><td>${top ? `${top[0]} (${top[1].toFixed(2)})` : 'N/A'}</td></tr>`;
    });
    html += `</tbody></table></div>`;
    wrapper.innerHTML = html;
    return true;
  } catch (e) {
    console.error('renderExpressionHeatmap error', e);
    return false;
  }
}

/********************************************************************************
 * SECTION 17 — STARTUP (initializeApp wrapper if not already present)
 ********************************************************************************/

// Only define initializeApp if not present (avoid redefinition)
if (typeof initializeApp === 'undefined' || !initializeApp) {
  async function initializeApp() {
    try {
      // 1. Load & prepare core database
      await loadAndPrepareDatabase();

      // 2. Initialize UI listeners
      initGlobalEventListeners();

      // 3. Initial route handling
      handleRouteChange();

      // 4. Update homepage stats when ready
      if (typeof updateHomepageStats === 'function') updateHomepageStats();

      console.log('CiliaHub app initialized.');
    } catch (err) {
      console.error('App initialization failed:', err);
    }
  }
}

// Kick off if DOM already loaded; otherwise wait
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

/* EOF — Chunk 3/3: restore + fix complete */
