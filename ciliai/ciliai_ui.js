/* ciliai_ui.js
   UI + Plotting glue for CiliAI — replaces plot code but uses existing loadCiliAIData()/initCiliAI()
   Designed to be loaded AFTER your ciliai/ciliai.js (data loader).
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
    if (Array.isArray(children)) children.forEach(c => d.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return d;
  }

  // --- Basic UI layout (inject into #sidebar, #left-panel, #right-panel) ---
  function buildSidebar() {
    const sb = $('#sidebar');
    sb.innerHTML = '';

    const brand = el('div', { class: 'brand' }, [
      el('div', { style: 'width:40px;height:40px;border-radius:8px;background:linear-gradient(135deg,#5b7be6,#8fb4ff);display:flex;align-items:center;justify-content:center;font-weight:700;color:white' }, ['CI']),
      el('div', {}, [el('h1', {}, ['CiliAI']), el('p', {}, ['Unified Cilia Explorer'])])
    ]);
    sb.appendChild(brand);

    const searchRow = el('div', { class: 'searchbox' }, [
      el('input', { id: 'sidebarSearch', placeholder: 'Search gene or term (e.g. IFT88)' }),
      el('button', { id: 'sidebarSearchBtn' }, ['Go'])
    ]);
    sb.appendChild(searchRow);

    // groups
    const g1 = el('div', { class: 'side-group' }, [
      el('h3', {}, ['CiliAI']),
      el('div', { class: 'side-link active', 'data-module': 'chat' }, ['💬 Chat']),
      el('div', { class: 'side-link', 'data-module': 'search' }, ['🔎 Search / Gene Card']),
      el('div', { class: 'side-link', 'data-module': 'batch' }, ['📁 Batch Query'])
    ]);
    sb.appendChild(g1);

    const plotItems = [
      ['plot_home','📊 Visualize Gene Sets'],
      ['localization','📌 Gene Localizations'],
      ['functional','🧩 Functional Categories'],
      ['enrichment','🔬 Enrichment Analysis'],
      ['funcloc','⚙️ Function vs Localization'],
      ['compare','🔁 Gene Set Comparison'],
      ['network','🕸 Complex Network'],
      ['radar','📡 Organelle Radar'],
      ['umap','🧭 Organelle UMAP'],
      ['expr','🌡 Expression Heatmap'],
      ['feature','🧬 Gene Feature Overview'],
      ['screen','🗂 Screen Summary Heatmap'],
      ['disease','⚕️ Genes vs Ciliopathies']
    ];
    const pg = el('div', { class: 'side-group' }, [el('h3', {}, ['CiliaPlot'])]);
    plotItems.forEach(([k, label]) => {
      const a = el('div', { class: 'side-link', 'data-module': k }, [label]);
      pg.appendChild(a);
    });
    sb.appendChild(pg);

    const foot = el('div', { style: 'margin-top:auto; font-size:12px; color:rgba(255,255,255,0.6)' }, [
      el('div', { style: 'padding-top:10px' }, ['Version: 5.2 (Nov 18, 2025)']),
      el('div', { style: 'padding-top:6px' }, ['Data: pre-compiled JSON'])
    ]);
    sb.appendChild(foot);
  }

  function buildLeftPanel() {
    const lp = $('#left-panel');
    lp.innerHTML = '';

    // Chat container
    const chatCard = el('div', { class: 'card' }, []);
    const chatHeader = el('div', { class: 'chat-header' }, [
      el('div', {}, [el('h2', {}, ['CiliAI Chat']), el('div', { class: 'small' }, ['Type a gene name or ask an analysis'])]),
      el('div', { class: 'small' }, ['Chat-first experience'])
    ]);
    chatCard.appendChild(chatHeader);

    const messages = el('div', { id: 'messages', class: 'messages' }, []);
    chatCard.appendChild(messages);

    const inputRow = el('div', { class: 'input-row' }, [
      el('input', { id: 'chatInput', placeholder: "Try: IFT88, FOXJ1, or 'Compare two gene sets' " }),
      el('button', { id: 'sendBtn' }, ['Send']),
      el('button', { id: 'clearBtn', style: 'background:#eee' }, ['Clear'])
    ]);
    chatCard.appendChild(inputRow);

    lp.appendChild(chatCard);

    // Batch and Search cards
    const searchCard = el('div', { class: 'card', id: 'searchCard', style: 'display:none' }, [
      el('h3', {}, ['Search']),
      el('div', { class: 'hint' }, ['Type a gene symbol and press Enter or click Search.'])
    ]);
    lp.appendChild(searchCard);

    const batchCard = el('div', { class: 'card', id: 'batchCard', style: 'display:none' }, [
      el('h3', {}, ['Batch Query']),
      el('textarea', { id: 'batchInput', style: 'width:100%;height:120px;border-radius:8px;border:1px solid #e8eef8;padding:10px', placeholder: 'Paste gene symbols, one per line' }),
      el('div', { style: 'display:flex;gap:8px;margin-top:8px' }, [
        el('button', { id: 'batchRun', class: 'action-btn primary' }, ['Run Batch']),
        el('button', { id: 'batchClear', class: 'action-btn' }, ['Clear']),
        el('div', { class: 'small', id: 'batchStatus', style: 'margin-left:auto' }, [''])
      ]),
      el('div', { id: 'batchResult', style: 'margin-top:12px' }, [])
    ]);
    lp.appendChild(batchCard);
  }

  function buildRightPanel() {
    const rp = $('#right-panel');
    rp.innerHTML = '';

    const geneCard = el('div', { class: 'card gene-card', id: 'geneCard' }, [
      el('div', { class: 'title' }, [
        el('div', {}, [el('h3', { id: 'geneTitle' }, ['No gene selected']), el('div', { id: 'geneSubtitle', class: 'small' }, ['Search a gene to see metadata & quick plots'])]),
        el('div', { id: 'geneActions', style: 'display:flex;gap:8px;align-items:center' }, [])
      ]),
      el('div', { id: 'geneBadges', style: 'margin-top:8px' }, [el('span', { class: 'badge' }, ['Cilia'])]),
      el('table', { class: 'meta-table', id: 'geneMeta', style: 'margin-top:12px' }, [
        el('tbody', {}, [
          el('tr', {}, [el('td', {}, [el('strong', {}, ['Symbol'])]), el('td', { id: 'metaSymbol' }, ['—'])]),
          el('tr', {}, [el('td', {}, [el('strong', {}, ['Localization'])]), el('td', { id: 'metaLocal' }, ['—'])]),
          el('tr', {}, [el('td', {}, [el('strong', {}, ['Function'])]), el('td', { id: 'metaFunc' }, ['—'])]),
          el('tr', {}, [el('td', {}, [el('strong', {}, ['Expression'])]), el('td', { id: 'metaExpr' }, ['—'])]),
          el('tr', {}, [el('td', {}, [el('strong', {}, ['Disease'])]), el('td', { id: 'metaDisease' }, ['—'])])
        ])
      ]),
      el('div', { class: 'quick-actions', id: 'geneQuickActions' }, [
        el('button', { class: 'action-btn', 'data-action': 'umap' }, ['Show Organelle UMAP']),
        el('button', { class: 'action-btn', 'data-action': 'expr' }, ['Expression Heatmap']),
        el('button', { class: 'action-btn', 'data-action': 'radar' }, ['Organelle Radar']),
        el('button', { class: 'action-btn', 'data-action': 'network' }, ['Network'])
      ])
    ]);
    rp.appendChild(geneCard);

    const plotCard = el('div', { class: 'card', id: 'plotCard' }, [
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, [
        el('div', {}, [el('h3', {}, ['Plot']), el('div', { class: 'small', id: 'plotHint' }, ['Select a plot from the sidebar or gene quick actions.'])]),
        el('div', {}, [el('button', { id: 'downloadPlot', class: 'action-btn' }, ['Download'])])
      ]),
      el('div', { id: 'plotArea', class: 'plot-placeholder', style: 'margin-top:12px' }, [
        el('div', {}, [el('div', { style: 'font-weight:600' }, ['No plot selected']), el('div', { class: 'small', style: 'margin-top:6px' }, ['Pick a module from the left (e.g. Organelle UMAP, Expression Heatmap).'])])
      ])
    ]);
    rp.appendChild(plotCard);
  }

  // --- App state ---
  let activeModule = 'chat';
  let selectedGene = null;

  // --- Attach interactions ---
  function attachInteractions() {
    // sidebar actions
    $('#sidebar').addEventListener('click', (ev) => {
      const node = ev.target.closest('.side-link');
      if (!node) return;
      $$('.side-link').forEach(s => s.classList.remove('active'));
      node.classList.add('active');
      const module = node.getAttribute('data-module');
      switchModule(module);
    });

    // sidebar search
    $('#sidebarSearchBtn').addEventListener('click', () => {
      const q = $('#sidebarSearch').value.trim();
      if (q) routeQuery(q);
    });
    $('#sidebarSearch').addEventListener('keyup', (e) => { if (e.key === 'Enter') $('#sidebarSearchBtn').click(); });

    // chat
    $('#sendBtn').addEventListener('click', handleChatSend);
    $('#chatInput').addEventListener('keyup', (e) => { if (e.key === 'Enter') handleChatSend(); });
    $('#clearBtn').addEventListener('click', () => { $('#messages').innerHTML = ''; addBotMessage('Chat cleared.'); });

    // batch
    $('#batchRun').addEventListener('click', handleBatchRun);
    $('#batchClear').addEventListener('click', () => { $('#batchInput').value = ''; $('#batchResult').innerHTML = ''; $('#batchStatus').textContent = ''; });

    // gene quick actions
    $('#geneQuickActions').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const action = btn.dataset.action;
      if (!selectedGene) { addBotMessage('Select a gene first.'); return; }
      if (action === 'umap') renderOrganelleUMAP(selectedGene);
      if (action === 'expr') renderExpressionHeatmap(selectedGene);
      if (action === 'radar') renderOrganelleRadar(selectedGene);
      if (action === 'network') renderComplexNetwork(selectedGene);
    });

    // download (placeholder)
    $('#downloadPlot').addEventListener('click', () => addBotMessage('Download feature not implemented.'));
  }

  // --- Chat helpers ---
  function addUserMessage(txt) {
    const m = el('div', { class: 'msg user', html: escapeHtml(txt) });
    $('#messages').appendChild(m);
    $('#messages').scrollTop = $('#messages').scrollHeight;
  }
  function addBotMessage(html) {
    const node = el('div', { class: 'msg bot' }, []);
    node.innerHTML = html;
    $('#messages').appendChild(node);
    $('#messages').scrollTop = $('#messages').scrollHeight;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // --- Query routing & heuristics ---
  function isLikelyGeneName(q) {
    if (!q || typeof q !== 'string') return false;
    return /^[A-Za-z0-9\-_.]{2,12}$/.test(q.trim());
  }

  function routeQuery(q) {
    if (!q) return;
    q = q.trim();
    if (isLikelyGeneName(q)) {
      selectGene(q.toUpperCase());
      switchModule('search');
      addBotMessage(`Showing gene card for <strong>${escapeHtml(q.toUpperCase())}</strong>.`);
      return;
    }
    // gene list detection (commas or many tokens)
    if (q.includes(',') || q.split(/\s+/).length > 6) {
      switchModule('batch');
      $('#batchInput').value = q;
      addBotMessage('Moved query to Batch Query — please review and Run Batch.');
      return;
    }
    // general assist
    switchModule('chat');
    addBotMessage(`Searching: <em>${escapeHtml(q)}</em>`);
    // try to detect gene from CiliAI lookups
    handleAIQuery(q);
  }

  function handleChatSend() {
    const q = $('#chatInput').value.trim();
    if (!q) return;
    addUserMessage(q);
    $('#chatInput').value = '';
    if (isLikelyGeneName(q)) {
      selectGene(q.toUpperCase());
      addBotMessage(`Detected gene <strong>${escapeHtml(q.toUpperCase())}</strong> — displaying gene card.`);
      return;
    }
    if (/enrich|enrichment/i.test(q)) {
      switchModule('enrichment');
      renderEnrichmentAnalysis(q);
      addBotMessage('Preparing enrichment analysis — open the Enrichment module.');
      return;
    }
    handleAIQuery(q);
  }

  // Basic placeholder AI router — you can replace this with your LLM/backend
  function handleAIQuery(q) {
    const tokens = (q.match(/[A-Za-z0-9]{2,12}/g) || []).map(t => t.toUpperCase());
    const gene = tokens.find(t => window.CiliAI?.lookups?.geneMap?.[t]);
    if (gene) {
      selectGene(gene);
      addBotMessage(`Found gene <strong>${gene}</strong> in DB — showing gene card.`);
    } else {
      setTimeout(() => addBotMessage(`I can help with that. Try asking for a gene symbol (e.g. IFT88) or choose a plot module from the sidebar.`), 300);
    }
  }

  // --- Gene selection (uses window.CiliAI.lookups.geneMap when available) ---
  function selectGene(symbol) {
    selectedGene = symbol.toUpperCase();
    $('#geneTitle').textContent = selectedGene;
    $('#metaSymbol').textContent = selectedGene;

    const geneObj = window.CiliAI?.lookups?.geneMap?.[selectedGene] || null;
    if (geneObj) {
      $('#metaLocal').textContent = geneObj.localization || geneObj.localisation || '—';
      $('#metaFunc').textContent = geneObj.function || geneObj.description || '—';
      $('#metaExpr').textContent = geneObj.expressionSummary || '—';
      $('#metaDisease').textContent = geneObj.disease || '—';

      // badges
      const bcont = $('#geneBadges');
      bcont.innerHTML = '';
      if (geneObj.ciliary) bcont.appendChild(el('span', { class: 'badge' }, ['Ciliary']));
      if (geneObj.essential) bcont.appendChild(el('span', { class: 'badge' }, ['Essential']));
      if (geneObj.complexes && geneObj.complexes.length) geneObj.complexes.slice(0, 4).forEach(c => bcont.appendChild(el('span', { class: 'badge' }, [c])));
    } else {
      $('#metaLocal').textContent = '—';
      $('#metaFunc').textContent = 'Metadata not preloaded.';
      $('#metaExpr').textContent = '—';
      $('#metaDisease').textContent = '—';
    }

    // geneActions quick buttons
    const ga = $('#geneActions');
    ga.innerHTML = '';
    const openU = el('button', { class: 'action-btn' }, ['Open UMAP']); openU.onclick = () => renderOrganelleUMAP(selectedGene);
    const openE = el('button', { class: 'action-btn' }, ['Expr Heat']); openE.onclick = () => renderExpressionHeatmap(selectedGene);
    ga.appendChild(openU); ga.appendChild(openE);

    // if UMAP available, try to call the UMAP hook directly
    if (window.CiliAI_UMAP && window.CiliAI_UMAP.length) renderOrganelleUMAP(selectedGene);
    else $('#plotArea').innerHTML = `<div style="text-align:center"><div style="font-weight:600">No precomputed UMAP available</div><div class="small" style="margin-top:6px">Load UMAP into window.CiliAI_UMAP to enable plotting.</div></div>`;
  }

  // --- Batch ---
  function handleBatchRun() {
    const raw = ($('#batchInput').value || '').trim();
    if (!raw) { $('#batchStatus').textContent = 'No input.'; return; }
    $('#batchStatus').textContent = 'Running...';
    const tokens = raw.split(/[\s,;]+/).map(t => t.trim()).filter(Boolean);
    const results = tokens.map(t => {
      const s = t.toUpperCase();
      const found = !!(window.CiliAI?.lookups?.geneMap?.[s]);
      return { gene: s, found, info: window.CiliAI?.lookups?.geneMap?.[s] || null };
    });

    const out = el('div', {}, []);
    results.forEach(r => {
      const row = el('div', { style: 'padding:6px 0;border-bottom:1px solid #f2f6fb;' }, []);
      const title = el('div', {}, []); title.appendChild(el('strong', {}, [r.gene])); title.appendChild(document.createTextNode(' — ' + (r.found ? 'Found' : 'Not found')));
      row.appendChild(title);
      if (r.found && r.info) row.appendChild(el('div', { class: 'small' }, [`${r.info.localization || '—'} | ${r.info.function || '—'}`]));
      out.appendChild(row);
    });

    $('#batchResult').innerHTML = ''; $('#batchResult').appendChild(out);
    $('#batchStatus').textContent = `${results.filter(r => r.found).length} / ${results.length} found.`;
  }

  // --- Module switcher ---
  function switchModule(module) {
    activeModule = module || 'chat';
    // hide left cards
    $('#messages').parentElement.style.display = (module === 'chat' || module.startsWith('plot')) ? 'block' : 'block';
    $('#searchCard').style.display = module === 'search' ? 'block' : 'none';
    $('#batchCard').style.display = module === 'batch' ? 'block' : 'none';

    // route to plot modules
    const plotMap = {
      'plot_home': renderPlotHome,
      'localization': renderGeneLocalizations,
      'functional': renderFunctionalCategories,
      'enrichment': renderEnrichmentAnalysis,
      'funcloc': renderFunctionVsLocalization,
      'compare': renderGeneSetComparison,
      'network': renderComplexNetwork,
      'radar': renderOrganelleRadar,
      'umap': renderOrganelleUMAP,
      'expr': renderExpressionHeatmap,
      'feature': renderGeneFeatureOverview,
      'screen': renderScreenSummaryHeatmap,
      'disease': renderGenesVsCiliopathies
    };
    if (plotMap[module]) plotMap[module]();
  }

  // --- Plot API (REPLACED CODE) ---
  // Replace old plot implementations with modular placeholders + integration hooks.
  // You can replace internals with Plotly / D3 / Vega implementations (examples below).
  const Plots = {
    // Called to render home / selection hub
    renderPlotHome: function () {
      $('#plotHint').textContent = 'CiliaPlot home — pick a visualization';
      $('#plotArea').innerHTML = `<div style="text-align:center"><div style="font-weight:700">CiliaPlot — Visualize Ciliary Gene Sets</div><div class="small" style="margin-top:8px">Choose a plot from the sidebar or click a gene quick action.</div></div>`;
    },

    renderGeneLocalizations: function () {
      $('#plotHint').textContent = 'Gene Localizations';
      $('#plotArea').innerHTML = `<div style="text-align:center"><div style="font-weight:700">Gene Localizations</div><div class="small" style="margin-top:8px">Localization distribution placeholder.</div></div>`;
      // Hook: implement bar plot using window.CiliAI.masterData
    },

    renderFunctionalCategories: function () {
      $('#plotHint').textContent = 'Functional Categories';
      $('#plotArea').innerHTML = `<div style="text-align:center"><div style="font-weight:700">Functional Categories</div><div class="small" style="margin-top:8px">Functional category bar chart placeholder.</div></div>`;
      // Hook: implement category plot
    },

    renderEnrichmentAnalysis: function (query) {
      $('#plotHint').textContent = 'Enrichment Analysis';
      $('#plotArea').innerHTML = `<div style="text-align:center"><div style="font-weight:700">Enrichment Analysis</div><div class="small" style="margin-top:8px">Run enrichment on selected gene set — placeholder.</div></div>`;
      // Hook: call enrichment backend or run local ORA/GSEA using preloaded gene sets
    },

    renderFunctionVsLocalization: function () {
      $('#plotHint').textContent = 'Function vs Localization';
      $('#plotArea').innerHTML = `<div style="text-align:center"><div style="font-weight:700">Function vs Localization</div><div class="small" style="margin-top:8px">Contingency or scatter plot placeholder.</div></div>`;
    },

    renderGeneSetComparison: function () {
      $('#plotHint').textContent = 'Gene Set Comparison';
      $('#plotArea').innerHTML = `<div style="text-align:center"><div style="font-weight:700">Gene Set Comparison</div><div class="small" style="margin-top:8px">Venn / UpSet placeholder.</div></div>`;
    },

    renderComplexNetwork: function () {
      $('#plotHint').textContent = 'Complex Network';
      $('#plotArea').innerHTML = `<div style="text-align:center"><div style="font-weight:700">Complex Network</div><div class="small" style="margin-top:8px">Network view placeholder.</div></div>`;
    },

    renderOrganelleRadar: function (gene) {
      $('#plotHint').textContent = 'Organelle Radar';
      $('#plotArea').innerHTML = `<div style="text-align:center"><div style="font-weight:700">Organelle Radar</div><div class="small" style="margin-top:8px">${gene ? 'Gene: ' + escapeHtml(gene) : ''} — placeholder radar chart.</div></div>`;
    },

    renderOrganelleUMAP: function (gene) {
      $('#plotHint').textContent = 'Organelle UMAP';
      // Use window.CiliAI_UMAP if available
      if (window.CiliAI_UMAP && Array.isArray(window.CiliAI_UMAP) && window.CiliAI_UMAP.length) {
        // quick display: show whether gene has a point
        const g = (gene || '').toUpperCase();
        const point = (window.CiliAI && window.CiliAI.lookups && window.CiliAI.lookups.umapByGene) ? window.CiliAI.lookups.umapByGene[g] : null;
        let msg = point ? `Showing location for <strong>${escapeHtml(g)}</strong> (placeholder marker)` : `Showing full UMAP (no marker for ${escapeHtml(g)})`;
        $('#plotArea').innerHTML = `<div style="text-align:center"><div style="font-weight:700">Organelle UMAP</div><div class="small" style="margin-top:8px">${msg}</div></div>`;
        // Hook: if you have a plot function (e.g. Plotly), call it here.
        if (typeof window.CiliAI?.Plots?.renderUMAPPlot === 'function') {
          try { window.CiliAI.Plots.renderUMAPPlot(g, '#plotArea'); } catch (e) { console.warn('Error in external UMAP plotter', e); }
        }
      } else {
        $('#plotArea').innerHTML = `<div style="text-align:center"><div style="font-weight:700">Organelle UMAP</div><div class="small" style="margin-top:8px">No UMAP data loaded (window.CiliAI_UMAP empty).</div></div>`;
      }
    },

    renderExpressionHeatmap: function (gene) {
      $('#plotHint').textContent = 'Expression Heatmap';
      if (gene && window.CiliAI?.cellDataCache && window.CiliAI.cellDataCache[gene.toUpperCase()]) {
        const c = window.CiliAI.cellDataCache[gene.toUpperCase()];
        // show textual mini-heatmap if plotting libs absent
        const rows = Object.entries(c).slice(0, 50).map(([cell, val]) =>
          `<div style="display:flex;justify-content:space-between;padding:2px 6px">${escapeHtml(cell)}<span>${Number(val).toFixed(2)}</span></div>`
        ).join('');
        $('#plotArea').innerHTML = `<div style="max-height:320px;overflow:auto">${rows}</div>`;
      } else {
        $('#plotArea').innerHTML = `<div style="text-align:center"><div style="font-weight:700">Expression Heatmap</div><div class="small" style="margin-top:8px">No expression cache for this gene (placeholder).</div></div>`;
      }
    },

    renderGeneFeatureOverview: function () {
      $('#plotHint').textContent = 'Gene Feature Overview';
      $('#plotArea').innerHTML = `<div style="text-align:center"><div style="font-weight:700">Gene Feature Overview</div><div class="small" style="margin-top:8px">Domain architecture / isoforms (placeholder).</div></div>`;
    },

    renderScreenSummaryHeatmap: function () {
      $('#plotHint').textContent = 'Screen Summary Heatmap';
      $('#plotArea').innerHTML = `<div style="text-align:center"><div style="font-weight:700">Screen Summary Heatmap</div><div class="small" style="margin-top:8px">Screen aggregates placeholder.</div></div>`;
    },

    renderGenesVsCiliopathies: function () {
      $('#plotHint').textContent = 'Genes vs Ciliopathies';
      $('#plotArea').innerHTML = `<div style="text-align:center"><div style="font-weight:700">Genes vs Ciliopathies</div><div class="small" style="margin-top:8px">Association placeholder.</div></div>`;
    }
  };

  // Expose Plots for external hooking (so we respect your request to keep data code intact)
  window.CiliAI = window.CiliAI || {};
  window.CiliAI.Plots = Object.assign({}, Plots);

  // Convenience wrappers (old code may call these)
  function renderPlotHome() { window.CiliAI.Plots.renderPlotHome(); }
  function renderGeneLocalizations() { window.CiliAI.Plots.renderGeneLocalizations(); }
  function renderFunctionalCategories() { window.CiliAI.Plots.renderFunctionalCategories(); }
  function renderEnrichmentAnalysis(q) { window.CiliAI.Plots.renderEnrichmentAnalysis(q); }
  function renderFunctionVsLocalization() { window.CiliAI.Plots.renderFunctionVsLocalization(); }
  function renderGeneSetComparison() { window.CiliAI.Plots.renderGeneSetComparison(); }
  function renderComplexNetwork() { window.CiliAI.Plots.renderComplexNetwork(); }
  function renderOrganelleRadar(g) { window.CiliAI.Plots.renderOrganelleRadar(g); }
  function renderOrganelleUMAP(g) { window.CiliAI.Plots.renderOrganelleUMAP(g); }
  function renderExpressionHeatmap(g) { window.CiliAI.Plots.renderExpressionHeatmap(g); }
  function renderGeneFeatureOverview() { window.CiliAI.Plots.renderGeneFeatureOverview(); }
  function renderScreenSummaryHeatmap() { window.CiliAI.Plots.renderScreenSummaryHeatmap(); }
  function renderGenesVsCiliopathies() { window.CiliAI.Plots.renderGenesVsCiliopathies(); }

  // attach functions globally so older code might still call them
  window.renderPlotHome = renderPlotHome;
  window.renderGeneLocalizations = renderGeneLocalizations;
  window.renderFunctionalCategories = renderFunctionalCategories;
  window.renderEnrichmentAnalysis = renderEnrichmentAnalysis;
  window.renderFunctionVsLocalization = renderFunctionVsLocalization;
  window.renderGeneSetComparison = renderGeneSetComparison;
  window.renderComplexNetwork = renderComplexNetwork;
  window.renderOrganelleRadar = renderOrganelleRadar;
  window.renderOrganelleUMAP = renderOrganelleUMAP;
  window.renderExpressionHeatmap = renderExpressionHeatmap;
  window.renderGeneFeatureOverview = renderGeneFeatureOverview;
  window.renderScreenSummaryHeatmap = renderScreenSummaryHeatmap;
  window.renderGenesVsCiliopathies = renderGenesVsCiliopathies;

  // --- Data status display ---
  function setDataStatus() {
    const s = (window.CiliAI && window.CiliAI.ready) ? `Ready (${(window.CiliAI.masterData && window.CiliAI.masterData.length) || 0} genes)` : 'Loading data…';
    $('#dataStatus').textContent = s;
  }

  // --- Boot sequence ---
  function bootUI() {
    buildSidebar();
    buildLeftPanel();
    buildRightPanel();
    attachInteractions();
    setDataStatus();

    // If your ciliai.js exposed initCiliAI or loadCiliAIData, call it (but don't duplicate if ready)
    const callInit = async () => {
      try {
        if (window.CiliAI && window.CiliAI.ready) {
          setDataStatus();
          addBotMessage('CiliAI ready.');
          return;
        }
        if (typeof initCiliAI === 'function') {
          await initCiliAI();
          setDataStatus();
          addBotMessage('CiliAI database loaded (initCiliAI).');
          return;
        }
        if (typeof loadCiliAIData === 'function') {
          await loadCiliAIData();
          // if loader doesn't set ready, do so
          if (window.CiliAI && window.CiliAI.masterData) window.CiliAI.ready = true;
          setDataStatus();
          addBotMessage('CiliAI database loaded (loadCiliAIData).');
          return;
        }
        // else, keep placeholders
        addBotMessage('CiliAI UI ready. Database not loaded — plotting limited until data is available.');
      } catch (e) {
        console.error('Error calling init/load:', e);
        addBotMessage('Error loading CiliAI data — see console.');
      }
    };

    callInit();
  }

  // expose some utilities globally for devs
  window.CiliAI_UI = {
    selectGene,
    switchModule,
    setDataStatus,
    renderPlotHome: () => window.CiliAI.Plots.renderPlotHome()
  };

  // DOM ready
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootUI);
  else bootUI();

})();
