/* ciliai_ui.js
   UI + Plotting glue for CiliAI
   Integrates:
   1. CiliAI Core (Data)
   2. CiliPlot (Visualization)
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

    // Navigation Groups
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
          ['plot_home', '🎨 CiliaPlot Studio'], // This triggers the full plots.js UI
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
    activeModule = module;
    
    // Update Sidebar Active State
    $$('.side-link').forEach(l => l.classList.remove('active'));
    const activeLink = $(`.side-link[data-module="${module}"]`);
    if(activeLink) activeLink.classList.add('active');

    // Route Logic
    if (module === 'plot_home') {
        // Handover to plots.js module
        if (window.CiliPlot && window.CiliPlot.renderInterface) {
            window.CiliPlot.renderInterface();
        } else {
            alert("Plotting module not loaded yet.");
        }
    } else if (module === 'umap') {
        // Trigger Default UMAP
        if(window.handleAIQuery) window.handleAIQuery('plot default umap');
    } else if (module === 'phylogeny') {
        // Trigger Default Phylogeny
        if(window.handleAIQuery) window.handleAIQuery('plot default phylogeny');
    } else if (module === 'batch') {
        // Show Batch UI (Simplified)
        showBatchUI();
    } else {
        console.log("Module not fully implemented:", module);
    }
  }

  function showBatchUI() {
      const left = $('#left-panel'); // Note: index.html uses #left-panel now? Or #center-panel?
      // Let's try to use #center-panel if we are in the new layout
      const target = $('#center-panel .viz-card') || $('#left-panel');
      
      if(target) {
          target.innerHTML = `
            <div style="padding:20px;">
                <h3>Batch Query</h3>
                <textarea id="batchInput" style="width:100%; height:200px; margin-top:10px; padding:10px;" placeholder="Enter gene list..."></textarea>
                <button class="search-btn" style="margin-top:10px;" onclick="window.CiliAI_UI.runBatch()">Analyze</button>
                <div id="batchResults" style="margin-top:20px;"></div>
            </div>
          `;
      }
  }

  // --- 3. DATA STATUS & BOOT ---

  function setDataStatus() {
    const statusEl = $('#dataStatus');
    const dot = $('#db-status-dot');
    if (!statusEl) return;
    
    const isReady = window.CiliAI && window.CiliAI.ready;
    const count = isReady && window.CiliAI.masterData ? window.CiliAI.masterData.length : 0;
    
    statusEl.textContent = isReady ? `Ready (${count} genes)` : 'Loading Data...';
    if(dot) {
        dot.classList.toggle('loading', !isReady);
        dot.classList.toggle('ready', isReady);
    }
  }

  async function bootCiliAI_UI() {
    console.log("[UI] Booting...");
    buildSidebar();
    setDataStatus();

    // Hook into CiliAI Core
    window.CiliAI_UI_OnReady = () => {
        console.log("[UI] Data Ready Signal Received");
        setDataStatus();
        // Auto-load UMAP as default view
        switchModule('umap');
    };

    // Check if already loaded
    if (window.CiliAI && window.CiliAI.ready) {
        window.CiliAI_UI_OnReady();
    } else {
        // Trigger load if needed
        if (window.initCiliAI) window.initCiliAI();
    }
  }

  // --- 4. PUBLIC API (Exposed to HTML) ---

  window.CiliAI_UI = {
      switchModule,
      runBatch: () => {
          const input = $('#batchInput').value;
          // Simple implementation using plots.js helper if available
          if(window.CiliPlot && input) {
             // Redirect to CiliaPlot logic
             switchModule('plot_home');
             setTimeout(() => {
                 $('#ciliaplot-genes-input').value = input;
                 $('#generate-ciliaplot-btn').click();
             }, 500);
          }
      }
  };

  // --- STARTUP ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootCiliAI_UI);
  } else {
    bootCiliAI_UI();
  }

})();
