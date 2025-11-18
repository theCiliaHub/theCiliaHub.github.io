/* ciliai_ui.js
   UI + Plotting glue for CiliAI
   Integrates:
   1. CiliAI Core (Data) - ciliai.js
   2. CiliPlot (Visualization) - plots.js
   3. UI Shell (Sidebar, Panels)
*/

(function () {
  'use strict';

  // --- Utility helpers ---
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  
  function el(tag, attrs = {}, children = []) {
    const d = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') d.className = v;
      else if (k === 'html') d.innerHTML = v;
      else d.setAttribute(k, v);
    });
    if (Array.isArray(children)) {
      children.forEach(c => d.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    }
    return d;
  }

  // --- App State ---
  let activeModule = 'chat';
  let selectedGene = null;

  // --- 1. UI LAYOUT BUILDERS ---
  
  function buildSidebar() {
    const sb = $('#sidebar');
    if (!sb) return;

    sb.innerHTML = '';

    const brand = el('div', { class: 'brand' }, [
      el('div', { class: 'brand-icon' }, ['🧬']),
      el('div', {}, [el('h1', {}, ['CiliAI']), el('p', {}, ['Unified Explorer'])])
    ]);
    sb.appendChild(brand);

    const groups = [
      {
        title: 'Analysis',
        items: [
          ['umap', '📊 UMAP Visualization'],
          ['phylogeny', '🌳 Phylogeny'],
          ['expression', '📈 Expression']
        ]
      },
      {
        title: 'Advanced Tools',
        items: [
          ['plot_home', '🎨 CiliaPlot Studio'],
          ['batch', '📁 Batch Query'],
          ['compare', '⚖️ Compare Genes']
        ]
      }
    ];

    groups.forEach(g => {
      const grpDiv = el('div', { class: 'side-group' }, [el('h3', {}, [g.title])]);
      g.items.forEach(([id, label]) => {
        const link = el('div', { class: 'side-link', 'data-module': id }, [label]);
        link.onclick = () => switchModule(id);
        grpDiv.appendChild(link);
      });
      sb.appendChild(grpDiv);
    });
  }

  // --- 2. MODULE SWITCHER ---

  function switchModule(module) {
    if (!module) return;

    activeModule = module;

    // Set active sidebar item
    $$('.side-link').forEach(l => l.classList.remove('active'));
    const activeLink = $(`.side-link[data-module="${module}"]`);
    if (activeLink) activeLink.classList.add('active');

    // Routing
    if (module === 'plot_home') {
      if (window.CiliPlot?.renderInterface) {
        window.CiliPlot.renderInterface();
      } else {
        const rightPanel = $('#right-panel');
        if (rightPanel) {
          rightPanel.innerHTML = `<div style="padding:20px; text-align:center; color:#666;">Loading plotting module...</div>`;
        }
      }
    }

    else if (module === 'umap') {
      window.handleAIQuery?.('plot default umap');
    }

    else if (module === 'phylogeny') {
      window.handleAIQuery?.('plot default phylogeny');
    }

    else if (module === 'expression') {
      window.handleAIQuery?.('show expression heatmap');
    }

    else if (module === 'batch') {
      showBatchUI();
    }

    else if (module === 'compare') {
      switchModule('plot_home');
      setTimeout(() => {
        const sel = $('#ciliaplot-type-selector');
        if (sel) {
          sel.value = 'venn_diagram';
          sel.dispatchEvent(new Event('change'));
        }
      }, 300);
    }

    else {
      console.warn("Unknown module:", module);
    }
  }

  function showBatchUI() {
    const left = $('#left-panel');
    const right = $('#right-panel');

    if (left) {
      left.innerHTML = `
        <div class="card">
            <h3>Batch Query</h3>
            <p style="font-size:12px; color:#666; margin-bottom:10px;">Enter a list of gene symbols.</p>
            <textarea id="batchInput" 
                style="width:100%; height:200px; padding:10px; border:1px solid #ddd; border-radius:4px; font-family:monospace;"
                placeholder="e.g.\nIFT88\nBBS1\nCEP290"></textarea>
            <button class="search-btn" style="width:100%; margin-top:10px;" onclick="window.CiliAI_UI.runBatch()">Analyze Genes</button>
        </div>`;
    }

    if (right) {
      right.innerHTML = `
        <div class="card">
            <h3>Results</h3>
            <div id="batchResults" style="margin-top:20px; color:#666;">
                Results will appear here...
            </div>
        </div>`;
    }
  }

  // --- 3. DATA STATUS & BOOT ---

  function setDataStatus() {
    const statusEl = $('#dataStatus');
    const dot = $('#db-status-dot');

    const isReady = window.CiliAI?.ready;
    const count = isReady && window.CiliAI?.masterData?.length || 0;

    if (statusEl) statusEl.textContent = isReady ? `Ready (${count} genes)` : 'Loading Data...';

    if (dot) {
      dot.classList.toggle('loading', !isReady);
      dot.classList.toggle('ready', !!isReady);
    }
  }

  async function bootCiliAI_UI() {
    console.log("[UI] Booting...");
    buildSidebar();
    setDataStatus();

    window.CiliAI_UI_OnReady = () => {
      console.log("[UI] Data Ready Signal Received");
      setDataStatus();
      switchModule('umap');
    };

    if (window.CiliAI?.ready) {
      window.CiliAI_UI_OnReady();
    } else if (window.initCiliAI) {
      window.initCiliAI(); // safe bridge
    }
  }

  // --- 4. PUBLIC API (Exposed to HTML) ---

  window.CiliAI_UI = {
    switchModule,

    runBatch: () => {
      const inputEl = $('#batchInput');
      if (!inputEl) return;

      const raw = inputEl.value.trim();
      if (!raw) return;

      const queries = raw.split(/[\s,;\n]+/).filter(x => x.trim().length);

      const lookup = window.CiliAI?.lookups?.geneMap || {};
      const results = queries.map(q => ({
        query: q,
        found: !!lookup[q.toUpperCase()],
        data: lookup[q.toUpperCase()]
      }));

      const resDiv = $('#batchResults');
      if (!resDiv) return;

      let html = `<p>Found <strong>${results.filter(r => r.found).length}</strong> / ${results.length} genes.</p>`;
      html += `<div style="max-height:400px; overflow:auto;">
                <table style="width:100%; font-size:12px; border-collapse:collapse;">
                <thead>
                  <tr style="background:#f8f9fa;">
                    <th>Query</th><th>Status</th><th>Description</th>
                  </tr>
                </thead><tbody>`;

      results.forEach(r => {
        const desc = r.found
          ? (r.data['Gene.Description'] || r.data.description || 'No description')
          : '-';

        html += `<tr style="border-bottom:1px solid #eee;">
                    <td style="padding:8px;">${r.query}</td>
                    <td style="padding:8px; color:${r.found ? 'green' : 'red'};">
                        ${r.found ? '✓' : '✗'}
                    </td>
                    <td style="padding:8px;">${desc}</td>
                </tr>`;
      });

      html += `</tbody></table></div>`;

      if (results.some(r => r.found)) {
        html += `<button class="search-btn" style="margin-top:15px;" onclick="window.CiliAI_UI.sendToPlotter()">Visualize Found Genes</button>`;
      }

      resDiv.innerHTML = html;
    },

    sendToPlotter: () => {
      const inputEl = $('#batchInput');
      if (!inputEl) return;

      const raw = inputEl.value;
      switchModule('plot_home');

      setTimeout(() => {
        const plotInput = $('#ciliaplot-genes-input');
        const genBtn = $('#generate-ciliaplot-btn');
        if (plotInput && genBtn) {
          plotInput.value = raw;
          genBtn.click();
        }
      }, 400);
    }
  };

  // --- STARTUP ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootCiliAI_UI);
  } else {
    bootCiliAI_UI();
  }

})();
