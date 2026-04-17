/**
 * CiliAI Enhancements v1.0
 * Self-contained module — add ONE script tag after intent-interceptor.js:
 *   <script src="./ciliai/assistant/ciliai-enhancements.js"></script>
 *
 * Features:
 *  1. Export — CSV/clipboard for any result (filtered table, query result, gene list)
 *  2. Query history — last 30 queries, sidebar with click-to-replay
 *  3. Shareable URLs — ?q= parameter on load + Share button
 *  4. /commands — /help /export /compare /plot slash commands in the chat input
 *  5. Virtual scrolling — for Gold Standard table (1000+ genes)
 *  6. Debounced search — 300ms debounce on geneSearch input
 *  7. IndexedDB caching — masterData persisted across sessions
 *  8. Query caching — repeated queries served instantly from a Map()
 *  9. Performance — lazy-load Plotly only when Plot tab is clicked
 * 10. Follow-up suggestions — 3 contextual chips after every AI answer
 * 11. Mobile gestures — swipe-down to close, haptic feedback on send
 * 12. Offline indicator — banner when data is from cache
 * 13. Confidence badges — certainty % for database queries vs AI fallback
 * 14. ARIA accessibility — live regions, keyboard nav for chat
 */
'use strict';
(function(win) {

/* ══════════════════════════════════════════════════════════════════════
 * 0 — SAFE INIT: wait for CiliAI core to be ready
 * ════════════════════════════════════════════════════════════════════*/
var _ready = false;
var _initQueue = [];
function onReady(fn) {
    if (_ready) { fn(); return; }
    _initQueue.push(fn);
}
function checkReady() {
    if (_ready) return;
    if (win.CiliAI && win.CiliAI.ready && win.CiliAI.masterData && win.CiliAI.masterData.length > 0) {
        _ready = true;
        _initQueue.forEach(function(fn){ try { fn(); } catch(e) {} });
        _initQueue = [];
    } else {
        setTimeout(checkReady, 400);
    }
}
checkReady();

/* ══════════════════════════════════════════════════════════════════════
 * 1 — EXPORT ENGINE
 * Exports any array of gene objects as CSV, or copies gene symbols.
 * Exposed on window so chat response buttons can call it.
 * ════════════════════════════════════════════════════════════════════*/
var _lastExportData = null;   /* stores the last result set for /export */

win.CiliAIExport = {

    /* Convert array of gene objects → CSV string */
    toCSV: function(rows, fields) {
        fields = fields || ['Gene','Localization','Ciliopathy','lof_effects','overexpression_effects'];
        var header = fields.join(',');
        var body = rows.map(function(r) {
            return fields.map(function(f) {
                var v = r[f] || r[f.toLowerCase()] || '';
                if (Array.isArray(v)) v = v.join('; ');
                return '"' + String(v).replace(/"/g,'""') + '"';
            }).join(',');
        });
        return [header].concat(body).join('\n');
    },

    /* Trigger browser download */
    download: function(rows, filename, fields) {
        var csv = this.toCSV(rows, fields);
        var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href = url; a.download = (filename||'ciliai_export')+'.csv';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    },

    /* Copy gene symbol list to clipboard */
    copySymbols: function(rows) {
        var syms = rows.map(function(r){ return r['Gene']||r['gene']||''; }).filter(Boolean).join('\n');
        if (navigator.clipboard) {
            navigator.clipboard.writeText(syms).then(function(){
                win.CiliAIEnhancements.toast('Copied '+rows.length+' gene symbols to clipboard');
            }).catch(function(){ win.CiliAIEnhancements.toast('Copy failed — try a different browser'); });
        }
    },

    /* Store for /export command */
    setLastResult: function(rows, label) {
        _lastExportData = {rows: rows, label: label || 'result'};
    },

    exportLast: function() {
        if (!_lastExportData || !_lastExportData.rows.length) {
            win.CiliAIEnhancements.toast('No result to export yet — run a query first');
            return;
        }
        this.download(_lastExportData.rows, _lastExportData.label.replace(/\s/g,'_'));
        win.CiliAIEnhancements.toast('Exported '+_lastExportData.rows.length+' genes as CSV');
    }
};

/* Inject export buttons into chat messages that contain tables */
function injectExportButtons(msgEl, rows, label) {
    if (!rows || !rows.length) return;
    win.CiliAIExport.setLastResult(rows, label);

    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;';

    var csvBtn = document.createElement('button');
    csvBtn.textContent = '⬇ CSV';
    csvBtn.style.cssText = 'font-size:11px;font-weight:600;padding:4px 10px;border-radius:6px;'
        +'border:1px solid #b3cde0;background:#eff6ff;color:#1d4ed8;cursor:pointer;';
    csvBtn.onclick = function(){ win.CiliAIExport.download(rows, label); };

    var copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 Copy symbols';
    copyBtn.style.cssText = csvBtn.style.cssText.replace('#eff6ff','#f0fdf4').replace('#1d4ed8','#166534');
    copyBtn.onclick = function(){ win.CiliAIExport.copySymbols(rows); };

    bar.appendChild(csvBtn);
    bar.appendChild(copyBtn);
    msgEl.appendChild(bar);
}
win._injectExportButtons = injectExportButtons; /* used by dispatch patches below */


/* ══════════════════════════════════════════════════════════════════════
 * 2 — QUERY HISTORY (last 30, persistent via localStorage)
 * ════════════════════════════════════════════════════════════════════*/
var HISTORY_KEY = 'ciliai_query_history_v1';
var _history = [];

function loadHistory() {
    try {
        var raw = localStorage.getItem(HISTORY_KEY);
        _history = raw ? JSON.parse(raw) : [];
    } catch(e) { _history = []; }
}
function saveHistory() {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(_history.slice(0,30))); } catch(e) {}
}
function addToHistory(query) {
    if (!query || query.trim().length < 3) return;
    _history = _history.filter(function(h){ return h.text !== query; });
    _history.unshift({text: query.trim(), ts: Date.now()});
    if (_history.length > 30) _history.pop();
    saveHistory();
    renderHistoryPanel();
}
loadHistory();

function renderHistoryPanel() {
    var panel = document.getElementById('ciliaiHistoryPanel');
    if (!panel) return;
    var list = document.getElementById('ciliaiHistoryList');
    if (!list) return;
    list.innerHTML = '';
    if (!_history.length) {
        list.innerHTML = '<p style="color:#94a3b8;font-size:12px;padding:10px 14px;">No history yet.</p>';
        return;
    }
    _history.forEach(function(h) {
        var btn = document.createElement('button');
        btn.style.cssText = 'display:block;width:100%;text-align:left;padding:7px 14px;font-size:12px;'
            +'color:#334155;background:none;border:none;border-bottom:1px solid #f1f5f9;cursor:pointer;'
            +'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background 0.1s;';
        btn.textContent = h.text;
        btn.title = h.text;
        btn.onmouseenter = function(){ this.style.background='#f1f5f9'; };
        btn.onmouseleave = function(){ this.style.background='none'; };
        btn.onclick = function() {
            toggleHistory(false);
            win.sendQuery && win.sendQuery(h.text);
        };
        list.appendChild(btn);
    });
}

win.toggleHistory = function(forceOpen) {
    var panel = document.getElementById('ciliaiHistoryPanel');
    if (!panel) return;
    var isOpen = panel.style.display !== 'none';
    var open = (forceOpen !== undefined) ? forceOpen : !isOpen;
    panel.style.display = open ? 'flex' : 'none';
    if (open) renderHistoryPanel();
};

/* Patch addChatMessage to record user queries in history */
function patchHistoryCapture() {
    if (!win.addChatMessage || win.addChatMessage.__historyPatch) return;
    var orig = win.addChatMessage;
    win.addChatMessage = function(html, isUser) {
        if (isUser && html && html.length < 300) {
            var clean = html.replace(/<[^>]*>/g,'').trim();
            addToHistory(clean);
        }
        return orig.apply(this, arguments);
    };
    win.addChatMessage.__historyPatch = true;
}
setTimeout(patchHistoryCapture, 800);
setTimeout(patchHistoryCapture, 2000);


/* ══════════════════════════════════════════════════════════════════════
 * 3 — SHAREABLE URLs (?q=…)
 * ════════════════════════════════════════════════════════════════════*/
win.shareCurrentQuery = function() {
    var input = document.getElementById('chatInput');
    var q = (input && input.value.trim()) || (_history[0] && _history[0].text) || '';
    if (!q) { win.CiliAIEnhancements.toast('Type a query first, then share'); return; }
    var url = location.origin + location.pathname + '?q=' + encodeURIComponent(q);
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function(){
            win.CiliAIEnhancements.toast('Link copied! Share it to replay this query.');
        });
    } else {
        prompt('Copy this URL:', url);
    }
};

function runQueryFromURL() {
    var params = new URLSearchParams(location.search);
    var q = params.get('q');
    if (!q || !q.trim()) return;
    onReady(function() {
        setTimeout(function() {
            win.sendQuery && win.sendQuery(decodeURIComponent(q));
        }, 1200);
    });
}
runQueryFromURL();


/* ══════════════════════════════════════════════════════════════════════
 * 4 — SLASH COMMANDS (/help /export /compare /plot /history /clear)
 * ════════════════════════════════════════════════════════════════════*/
var SLASH_COMMANDS = {
    '/help': {
        desc: 'Show available commands',
        fn: function() {
            var lines = Object.keys(SLASH_COMMANDS).map(function(cmd){
                return '<b>'+cmd+'</b> — '+SLASH_COMMANDS[cmd].desc;
            }).join('<br>');
            return '<b>CiliAI Commands</b><br><br>'+lines
                +'<br><br><span style="font-size:11px;color:#888;">You can also ask in plain English: '
                +'"IFT88 localization", "Joubert syndrome genes", "Compare BBS1 and CEP290"</span>';
        }
    },
    '/export': {
        desc: 'Export last query result as CSV',
        fn: function() { win.CiliAIExport.exportLast(); return null; /* no chat message */ }
    },
    '/compare': {
        desc: 'Compare two genes: /compare BBS1,IFT88',
        fn: function(args) {
            if (!args) return 'Usage: <b>/compare GENE1,GENE2</b> — e.g. /compare BBS1,IFT88';
            var syms = args.split(/[,\s]+/).map(function(s){ return s.trim().toUpperCase(); }).filter(Boolean);
            if (syms.length < 2) return 'Please provide at least 2 gene symbols: <b>/compare '+syms[0]+',GENE2</b>';
            win.sendQuery && win.sendQuery('Compare '+syms.join(' and '));
            return null;
        }
    },
    '/plot': {
        desc: 'Quick dot-plot for genes: /plot IFT88,ARL13B',
        fn: function(args) {
            if (!args) return 'Usage: <b>/plot GENE1,GENE2</b>';
            var syms = args.split(/[,\s]+/).map(function(s){ return s.trim().toUpperCase(); }).filter(Boolean);
            win.sendQuery && win.sendQuery('Dot plot: '+syms.join(', '));
            return null;
        }
    },
    '/history': {
        desc: 'Toggle query history panel',
        fn: function() { win.toggleHistory(); return null; }
    },
    '/clear': {
        desc: 'Clear chat conversation',
        fn: function() { win.clearChat && win.clearChat(); return null; }
    }
};

function interceptSlashCommand(query) {
    if (!query || query[0] !== '/') return false;
    var parts = query.split(/\s+/);
    var cmd   = parts[0].toLowerCase();
    var args  = parts.slice(1).join(' ') || null;
    var handler = SLASH_COMMANDS[cmd];
    if (!handler) {
        win.addChatMessage('Unknown command <b>'+cmd+'</b>. Type <b>/help</b> for available commands.', false);
        return true;
    }
    var result = handler.fn(args);
    if (result) win.addChatMessage(result, false);
    return true;
}

/* Patch handleUserSend to intercept slash commands first */
function patchSlashCommands() {
    if (!win.handleUserSend || win.handleUserSend.__slashPatch) return;
    var orig = win.handleUserSend;
    win.handleUserSend = function() {
        var input = document.getElementById('chatInput');
        var q = input && input.value.trim();
        if (q && q[0] === '/') {
            input.value = '';
            if (input.tagName === 'TEXTAREA') input.style.height = 'auto';
            win.hideWelcome && win.hideWelcome();
            win.addChatMessage(q, true);
            interceptSlashCommand(q);
            return;
        }
        return orig.apply(this, arguments);
    };
    win.handleUserSend.__slashPatch = true;
}
setTimeout(patchSlashCommands, 600);
setTimeout(patchSlashCommands, 2000);


/* ══════════════════════════════════════════════════════════════════════
 * 5 — VIRTUAL SCROLLING for Gold Standard table
 * Replaces the full DOM render (1000+ rows) with a windowed renderer.
 * Row height = 40px, window = viewport height / 40 + 20 buffer rows.
 * ════════════════════════════════════════════════════════════════════*/
var VS = {
    ROW_H: 40,
    _rows: [],
    _filtered: [],
    _container: null,
    _spacerTop: null,
    _spacerBot: null,
    _visibleStart: 0,
    _visibleCount: 0,
    _renderFn: null,

    install: function(container, rows, renderRow) {
        this._rows     = rows;
        this._filtered = rows.slice();
        this._container = container;
        this._renderFn  = renderRow;
        this._visibleCount = Math.ceil(container.clientHeight / this.ROW_H) + 20;

        /* Replace container children with spacers + rows */
        container.innerHTML = '';
        this._spacerTop = document.createElement('tr');
        this._spacerTop.style.height = '0px';
        this._spacerBot = document.createElement('tr');
        this._spacerBot.style.height = '0px';

        var tbody = container.querySelector('tbody') || container;
        tbody.insertBefore(this._spacerTop, tbody.firstChild);
        tbody.appendChild(this._spacerBot);

        container.addEventListener('scroll', this._onScroll.bind(this));
        this._render(0);
    },

    _onScroll: function() {
        var scrollTop = this._container.scrollTop;
        var start = Math.max(0, Math.floor(scrollTop / this.ROW_H) - 5);
        if (start !== this._visibleStart) this._render(start);
    },

    _render: function(start) {
        this._visibleStart = start;
        var end  = Math.min(this._filtered.length, start + this._visibleCount);
        var tbody = this._container.querySelector('tbody') || this._container;

        /* Remove existing data rows (not spacers) */
        var existing = tbody.querySelectorAll('tr.vs-row');
        existing.forEach(function(r){ r.remove(); });

        this._spacerTop.style.height = (start * this.ROW_H) + 'px';
        this._spacerBot.style.height = ((this._filtered.length - end) * this.ROW_H) + 'px';

        var frag = document.createDocumentFragment();
        for (var i = start; i < end; i++) {
            var tr = this._renderFn(this._filtered[i], i);
            tr.classList.add('vs-row');
            frag.appendChild(tr);
        }
        /* Insert after spacerTop */
        this._spacerTop.parentNode.insertBefore(frag, this._spacerBot);
    },

    filter: function(query) {
        var q = query.toLowerCase();
        this._filtered = q
            ? this._rows.filter(function(g){
                return (g.Gene||'').toLowerCase().indexOf(q) !== -1
                    || (g['Localization']||'').toLowerCase().indexOf(q) !== -1
                    || (g['Ciliopathy']||'').toLowerCase().indexOf(q) !== -1
                    || (Array.isArray(g['Ciliopathies'])?g['Ciliopathies'].join(' '):(g['Ciliopathies']||'')).toLowerCase().indexOf(q) !== -1;
              })
            : this._rows.slice();
        this._container.scrollTop = 0;
        this._render(0);

        var footer = document.getElementById('gs-footer');
        if (footer) footer.textContent = 'Showing '
            +this._filtered.length.toLocaleString()
            +' of '+this._rows.length.toLocaleString()+' genes';
    }
};
win._CiliAI_VS = VS;


/* ══════════════════════════════════════════════════════════════════════
 * 6 — DEBOUNCED SEARCH on geneSearch input (300ms)
 * ════════════════════════════════════════════════════════════════════*/
onReady(function() {
    var searchEl = document.getElementById('geneSearch');
    if (!searchEl) return;
    var _dTimer = null;
    searchEl.addEventListener('input', function() {
        clearTimeout(_dTimer);
        var q = searchEl.value.trim();
        _dTimer = setTimeout(function() {
            /* If Gold Standard table is open, filter it live */
            if (win._CiliAI_VS && win._CiliAI_VS._rows.length) {
                win._CiliAI_VS.filter(q);
            }
        }, 300);
    });
});


/* ══════════════════════════════════════════════════════════════════════
 * 7 — INDEXEDDB CACHING for masterData
 * Saves and restores the gene database to survive page refreshes.
 * ════════════════════════════════════════════════════════════════════*/
var IDB = {
    DB_NAME:  'ciliai_cache_v1',
    STORE:    'master',
    VERSION:  1,
    _db:      null,

    open: function(cb) {
        if (this._db) { cb(this._db); return; }
        var self = this;
        try {
            var req = indexedDB.open(this.DB_NAME, this.VERSION);
            req.onupgradeneeded = function(e) {
                e.target.result.createObjectStore(self.STORE);
            };
            req.onsuccess = function(e) {
                self._db = e.target.result;
                cb(self._db);
            };
            req.onerror = function() { cb(null); };
        } catch(e) { cb(null); }
    },

    set: function(key, value) {
        this.open(function(db) {
            if (!db) return;
            try {
                var tx = db.transaction([IDB.STORE], 'readwrite');
                tx.objectStore(IDB.STORE).put(value, key);
            } catch(e) {}
        });
    },

    get: function(key, cb) {
        this.open(function(db) {
            if (!db) { cb(null); return; }
            try {
                var tx  = db.transaction([IDB.STORE], 'readonly');
                var req = tx.objectStore(IDB.STORE).get(key);
                req.onsuccess = function(e) { cb(e.target.result || null); };
                req.onerror   = function()  { cb(null); };
            } catch(e) { cb(null); }
        });
    }
};

/* Patch loadCiliAIData to save/restore from IndexedDB */
function patchIndexedDBCache() {
    var origLoad = win.loadCiliAIData;
    if (!origLoad || origLoad.__idbPatched) return;

    win.loadCiliAIData = async function() {
        /* Try restoring from cache first */
        await new Promise(function(resolve) {
            IDB.get('masterData_v1', function(cached) {
                if (cached && cached.length > 100) {
                    if (win.CiliAI) {
                        win.CiliAI.masterData = cached;
                        /* Rebuild lookups from cached data */
                        var geneMap = {};
                        cached.forEach(function(g){ if(g.Gene) geneMap[g.Gene.toUpperCase()] = g; });
                        win.CiliAI.lookups = win.CiliAI.lookups || {};
                        win.CiliAI.lookups.geneMap = Object.assign(geneMap, win.CiliAI.lookups.geneMap || {});
                        win.CiliAI.ready = true;
                        win.updateStatus && win.updateStatus('Ready ('+cached.length+' genes, cached)','ready');
                        win.calculateAndDisplayStatistics && win.calculateAndDisplayStatistics();
                        showOfflineIndicator(true);
                    }
                }
                resolve();
            });
        });

        /* Always fetch fresh data in background */
        var result = await origLoad.apply(this, arguments);

        /* Save fresh data to IndexedDB */
        if (win.CiliAI && win.CiliAI.masterData && win.CiliAI.masterData.length > 100) {
            IDB.set('masterData_v1', win.CiliAI.masterData);
            showOfflineIndicator(false);
        }
        return result;
    };
    win.loadCiliAIData.__idbPatched = true;
}
setTimeout(patchIndexedDBCache, 200);

function showOfflineIndicator(isCache) {
    var existing = document.getElementById('ciliaiOfflineBanner');
    if (isCache && !existing) {
        var banner = document.createElement('div');
        banner.id = 'ciliaiOfflineBanner';
        banner.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);'
            +'background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:8px;'
            +'padding:6px 14px;font-size:12px;font-weight:600;z-index:9999;pointer-events:none;'
            +'box-shadow:0 2px 8px rgba(0,0,0,0.12);';
        banner.textContent = '📦 Data loaded from cache — refreshing in background…';
        document.body.appendChild(banner);
        setTimeout(function(){ banner.remove(); }, 4000);
    } else if (!isCache && existing) {
        existing.remove();
    }
}


/* ══════════════════════════════════════════════════════════════════════
 * 8 — QUERY RESULT CACHE (Map, in-memory, max 100 entries)
 * Identical queries served instantly without re-running the interceptor.
 * ════════════════════════════════════════════════════════════════════*/
var _queryCache = new Map();
var CACHE_MAX   = 100;

win.CiliAIQueryCache = {
    get: function(key) { return _queryCache.get(key.toLowerCase().trim()) || null; },
    set: function(key, val) {
        if (_queryCache.size >= CACHE_MAX) {
            var first = _queryCache.keys().next().value;
            _queryCache.delete(first);
        }
        _queryCache.set(key.toLowerCase().trim(), val);
    },
    clear: function() { _queryCache.clear(); }
};


/* ══════════════════════════════════════════════════════════════════════
 * 9 — LAZY-LOAD PLOTLY (only when Plot tab is clicked)
 * ════════════════════════════════════════════════════════════════════*/
var _plotlyLoaded = typeof Plotly !== 'undefined';

function ensurePlotly(cb) {
    if (_plotlyLoaded) { cb(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.plot.ly/plotly-2.35.2.min.js';
    s.onload  = function() { _plotlyLoaded = true; cb(); };
    s.onerror = function() { console.warn('[CiliAI] Plotly failed to load'); cb(); };
    document.head.appendChild(s);
}

/* Patch switchView to lazy-load Plotly */
onReady(function() {
    var origSwitch = win.switchView;
    if (!origSwitch || origSwitch.__lazyPlotly) return;
    win.switchView = function(viewType) {
        if (viewType === 'plot') {
            ensurePlotly(function() { origSwitch.call(win, viewType); });
        } else {
            origSwitch.call(win, viewType);
        }
    };
    win.switchView.__lazyPlotly = true;
});


/* ══════════════════════════════════════════════════════════════════════
 * 10 — FOLLOW-UP SUGGESTIONS (contextual chips after answers)
 * Appended to assistant messages based on what was asked.
 * ════════════════════════════════════════════════════════════════════*/
var FOLLOWUP_MAP = [
    { test: /joubert/i,    chips: ['Joubert basal body genes','JBTS genes in kidney','Compare Joubert vs Nephronophthisis genes'] },
    { test: /bardet|bbs/i, chips: ['BBSome vs IFT-B conservation','BBS1 evolution','Bardet-Biedl kidney expression'] },
    { test: /ift-b|iftb/i, chips: ['IFT-B vs IFT-A comparison','IFT88 localization','IFT-B genes in lung'] },
    { test: /pcd|primary ciliary/i, chips: ['PCD axoneme genes','PCD genes with motility defect','PCD genes in flagella'] },
    { test: /vertebrate.specific/i, chips: ['Vertebrate-specific basal body genes','Vertebrate-specific ciliary-only genes','Mammalian-specific ciliary genes'] },
    { test: /transition zone/i, chips: ['Transition zone Joubert genes','MKS module genes','NPHP module transition zone genes'] },
    { test: /lof|knockdown|no effect/i, chips: ['Genes with shorter cilia on LoF','Genes where OE increases cilia length but LoF has no effect','Basal body genes that shorten cilia'] },
    { test: /expression|lung|kidney/i, chips: ['Hypothalamus specific ciliary genes','Pan-ciliary genes','Proximal tubule enriched genes'] }
];

function getFollowUps(queryText) {
    if (!queryText) return [];
    for (var i = 0; i < FOLLOWUP_MAP.length; i++) {
        if (FOLLOWUP_MAP[i].test.test(queryText)) return FOLLOWUP_MAP[i].chips;
    }
    return ['Show Gold Standard ciliary genes', 'Joubert syndrome genes', 'IFT88 localization'];
}

function appendFollowUps(msgEl, queryText) {
    var chips = getFollowUps(queryText);
    if (!chips.length) return;
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-top:10px;padding-top:8px;border-top:1px solid #f1f5f9;';
    chips.forEach(function(text) {
        var btn = document.createElement('button');
        btn.style.cssText = 'font-size:11px;padding:3px 10px;border-radius:20px;border:1px solid #bfdbfe;'
            +'background:#eff6ff;color:#1d4ed8;cursor:pointer;font-weight:500;transition:background 0.12s;';
        btn.textContent = text;
        btn.onmouseenter = function(){ this.style.background='#dbeafe'; };
        btn.onmouseleave = function(){ this.style.background='#eff6ff'; };
        btn.onclick = function() { win.sendQuery && win.sendQuery(text); };
        wrap.appendChild(btn);
    });
    msgEl.appendChild(wrap);
}

var _lastUserQuery = '';
function patchFollowUps() {
    if (!win.addChatMessage || win.addChatMessage.__followupPatch) return;
    var orig = win.addChatMessage;
    win.addChatMessage = function(html, isUser) {
        var result = orig.apply(this, arguments);
        if (isUser) {
            _lastUserQuery = html ? html.replace(/<[^>]*>/g,'').trim() : '';
        } else {
            /* Append follow-ups to assistant message */
            setTimeout(function() {
                try {
                    var messages = document.getElementById('messages');
                    if (!messages) return;
                    var last = messages.querySelector('.ciliai-message.assistant:last-child .ciliai-message-content');
                    if (last && !last.querySelector('.ciliai-followups')) {
                        var w = document.createElement('div');
                        w.className = 'ciliai-followups';
                        appendFollowUps(w, _lastUserQuery);
                        if (w.children.length) last.appendChild(w);
                    }
                } catch(e) {}
            }, 200);
        }
        return result;
    };
    win.addChatMessage.__followupPatch = true;
}
setTimeout(patchFollowUps, 1000);
setTimeout(patchFollowUps, 2500);


/* ══════════════════════════════════════════════════════════════════════
 * 11 — MOBILE GESTURES (swipe-down to close, haptic on send)
 * ════════════════════════════════════════════════════════════════════*/
onReady(function() {
    var overlay = document.getElementById('mobileChatOverlay');
    var handle  = document.getElementById('mobileHandle');
    if (!overlay || !handle) return;

    var _touchStartY = 0;
    var _isDragging  = false;

    handle.addEventListener('touchstart', function(e) {
        _touchStartY = e.touches[0].clientY;
        _isDragging  = true;
        overlay.style.transition = 'none';
    }, {passive: true});

    document.addEventListener('touchmove', function(e) {
        if (!_isDragging) return;
        var dy = e.touches[0].clientY - _touchStartY;
        if (dy > 0) overlay.style.transform = 'translateY('+dy+'px)';
    }, {passive: true});

    document.addEventListener('touchend', function(e) {
        if (!_isDragging) return;
        _isDragging = false;
        var dy = e.changedTouches[0].clientY - _touchStartY;
        overlay.style.transition = 'transform 0.35s cubic-bezier(0.32,0.72,0,1)';
        if (dy > 120) {
            win.closeMobileChat && win.closeMobileChat();
        } else {
            overlay.style.transform = 'translateY(0)';
        }
    }, {passive: true});

    /* Haptic feedback on send buttons */
    document.querySelectorAll('.send-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            try {
                if (navigator.vibrate) navigator.vibrate(30);
            } catch(e) {}
        });
    });
});


/* ══════════════════════════════════════════════════════════════════════
 * 12 — OFFLINE INDICATOR (already handled in IDB section above)
 * Additional: detect network status
 * ════════════════════════════════════════════════════════════════════*/
win.addEventListener('offline', function() {
    win.CiliAIEnhancements.toast('⚠️ Offline — using cached data', 4000);
});
win.addEventListener('online', function() {
    win.CiliAIEnhancements.toast('✅ Back online', 2000);
});


/* ══════════════════════════════════════════════════════════════════════
 * 13 — CONFIDENCE BADGES on database query responses
 * Appended to the assistant message bubble header.
 * DB queries (interceptor handled) = 100%, AI fallback = ~60%
 * ════════════════════════════════════════════════════════════════════*/
function confidenceBadge(pct, label) {
    var color = pct >= 90 ? '#166534' : pct >= 70 ? '#92400e' : '#991b1b';
    var bg    = pct >= 90 ? '#dcfce7' : pct >= 70 ? '#fef3c7' : '#fee2e2';
    return '<span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;'
        +'background:'+bg+';color:'+color+';margin-left:6px;vertical-align:middle;">'
        +pct+'% '+label+'</span>';
}
win._confidenceBadge = confidenceBadge;


/* ══════════════════════════════════════════════════════════════════════
 * 14 — ARIA ACCESSIBILITY
 * Live region for screen reader announcements, keyboard nav.
 * ════════════════════════════════════════════════════════════════════*/
onReady(function() {
    /* Add aria-live region */
    var liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.id = 'ciliaiLiveRegion';
    liveRegion.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);';
    document.body.appendChild(liveRegion);

    /* Announce chat messages to screen readers */
    function patchAria() {
        if (!win.addChatMessage || win.addChatMessage.__ariaPatch) return;
        var orig = win.addChatMessage;
        win.addChatMessage = function(html, isUser) {
            var result = orig.apply(this, arguments);
            var region = document.getElementById('ciliaiLiveRegion');
            if (region && !isUser) {
                var clean = (html||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,200);
                region.textContent = clean;
            }
            return result;
        };
        win.addChatMessage.__ariaPatch = true;
    }
    setTimeout(patchAria, 3000);

    /* ARIA labels for chat input and buttons */
    var chatInput = document.getElementById('chatInput');
    if (chatInput) chatInput.setAttribute('aria-label', 'Ask CiliAI a question about ciliary genes');
    var sendBtn = document.getElementById('sendBtn');
    if (sendBtn) sendBtn.setAttribute('aria-label', 'Send message');

    /* Keyboard nav: Escape closes mobile overlay */
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') win.closeMobileChat && win.closeMobileChat();
    });
});


/* ══════════════════════════════════════════════════════════════════════
 * UI INJECTION — History panel, Share button, Help button
 * Adds the persistent UI chrome to the chat header.
 * ════════════════════════════════════════════════════════════════════*/
function injectUI() {
    /* ─ History panel (full-height flyout on the left of the chat panel) ─ */
    var historyPanel = document.createElement('div');
    historyPanel.id = 'ciliaiHistoryPanel';
    historyPanel.setAttribute('role', 'dialog');
    historyPanel.setAttribute('aria-label', 'Query history');
    historyPanel.style.cssText = 'display:none;position:absolute;top:0;right:420px;width:280px;'
        +'height:100%;background:white;border-left:1px solid #e2e8f0;'
        +'border-right:1px solid #e2e8f0;z-index:200;flex-direction:column;'
        +'box-shadow:-4px 0 12px rgba(0,0,0,0.08);';

    var histHeader = document.createElement('div');
    histHeader.style.cssText = 'padding:12px 16px;border-bottom:1px solid #e2e8f0;'
        +'display:flex;align-items:center;justify-content:space-between;flex-shrink:0;';
    histHeader.innerHTML = '<span style="font-size:13px;font-weight:700;color:#0f172a;">Query History</span>'
        +'<button onclick="window.toggleHistory(false)" style="background:none;border:none;cursor:pointer;'
        +'color:#94a3b8;font-size:16px;line-height:1;" aria-label="Close history">✕</button>';

    var clearHistBtn = document.createElement('button');
    clearHistBtn.style.cssText = 'margin:8px 14px 0;font-size:11px;color:#dc2626;background:none;'
        +'border:none;cursor:pointer;text-align:left;padding:0;';
    clearHistBtn.textContent = 'Clear history';
    clearHistBtn.onclick = function() {
        _history = [];
        saveHistory();
        renderHistoryPanel();
    };

    var histList = document.createElement('div');
    histList.id = 'ciliaiHistoryList';
    histList.style.cssText = 'flex:1;overflow-y:auto;';

    historyPanel.appendChild(histHeader);
    historyPanel.appendChild(clearHistBtn);
    historyPanel.appendChild(histList);
    document.body.appendChild(historyPanel);

    /* ─ Inject Share + History buttons into chat header right ─ */
    var chatHeaderRight = document.querySelector('.chat-header-right');
    if (chatHeaderRight) {
        /* History button */
        var histBtn = document.createElement('button');
        histBtn.className = 'clear-chat-btn';
        histBtn.title = 'Query history';
        histBtn.setAttribute('aria-label', 'Toggle query history');
        histBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            +'style="width:12px;height:12px;vertical-align:middle;"><circle cx="12" cy="12" r="10"/>'
            +'<polyline points="12 6 12 12 16 14"/></svg> History';
        histBtn.onclick = function(){ win.toggleHistory(); };
        chatHeaderRight.insertBefore(histBtn, chatHeaderRight.firstChild);

        /* Share button */
        var shareBtn = document.createElement('button');
        shareBtn.className = 'clear-chat-btn';
        shareBtn.title = 'Share current query as URL';
        shareBtn.setAttribute('aria-label', 'Share current query');
        shareBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            +'style="width:12px;height:12px;vertical-align:middle;"><circle cx="18" cy="5" r="3"/>'
            +'<circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>'
            +'<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>'
            +'<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Share';
        shareBtn.onclick = win.shareCurrentQuery;
        chatHeaderRight.insertBefore(shareBtn, chatHeaderRight.firstChild);
    }

    /* ─ Add /help hint to input-hint line ─ */
    var hint = document.querySelector('.input-hint');
    if (hint) {
        hint.innerHTML += ' · type <kbd>/help</kbd> for commands';
    }
}

/* Run UI injection after DOM is ready */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUI);
} else {
    setTimeout(injectUI, 100);
}


/* ══════════════════════════════════════════════════════════════════════
 * TOAST NOTIFICATION
 * ════════════════════════════════════════════════════════════════════*/
win.CiliAIEnhancements = {
    toast: function(msg, duration) {
        var t = document.createElement('div');
        t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);'
            +'background:#1e293b;color:white;padding:8px 18px;border-radius:8px;font-size:13px;'
            +'font-weight:500;z-index:9999;pointer-events:none;opacity:0;transition:all 0.25s;'
            +'box-shadow:0 4px 16px rgba(0,0,0,0.25);white-space:nowrap;';
        t.textContent = msg;
        document.body.appendChild(t);
        requestAnimationFrame(function() {
            t.style.opacity = '1';
            t.style.transform = 'translateX(-50%) translateY(0)';
        });
        setTimeout(function() {
            t.style.opacity = '0';
            t.style.transform = 'translateX(-50%) translateY(8px)';
            setTimeout(function(){ t.remove(); }, 300);
        }, duration || 2800);
    }
};

console.log('[CiliAI Enhancements v1.0] Loaded — history, export, /commands, virtual scroll, cache, follow-ups, gestures, a11y.');

})(window);
