/* ═══════════════════════════════════════════════════════════════════════════
 * gene-card.js — CiliAI Gene Card v12.1.0
 * ───────────────────────────────────────────────────────────────────────────
 * FIXES in v12.1.0:
 *   - Removed floating "↓ Scroll" button entirely. The native scrollbar on
 *     #cilia-svg (overflow-y:auto) is the sole scroll mechanism. The blue
 *     button was redundant and was reported as a second scroll by users.
 *   - Hide sibling absolute-positioned containers (#plotly-container,
 *     #domain-viewer, #compare-umap-container) when rendering the gene
 *     card. They are siblings of #cilia-svg inside #viz-stage, all with
 *     `position:absolute; inset:0`, and without explicit display:none they
 *     overlay the card and intercept every click — making nothing on the
 *     card clickable. This mirrors what window.showDiagram() does.
 *
 * FIXES in v12.0.1:
 *   - Double scroll button: remove ALL existing buttons before creating new
 *   - Container sizing: position:absolute + inset:0 for proper scrolling
 *   - Scroll button z-index: 5 (prevents blocking clicks)
 * ═══════════════════════════════════════════════════════════════════════════ */

(function (win, doc) {
    'use strict';

    var VERSION = '12.1.0';
    var _uid = 0;
    function uid() { return 'cg12_' + (++_uid); }

    function log(msg, kind) {
        (kind === 'error' ? console.error : console.log)('[GeneCard v' + VERSION + ']', msg);
    }
    function esc(s) {
        return s == null ? '' : String(s)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function toArray(val, sep) {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        return String(val).split(sep || ',').map(function(v){return v.trim();}).filter(Boolean);
    }
    function parseAaPos(title) {
        var m = String(title||'').match(/\(p\.[A-Z][a-z]{2}(\d+)/);
        return m ? parseInt(m[1],10) : null;
    }
    function collapseToggle(bodyId, chevId) {
        return 'onclick="(function(){'
            +'var b=document.getElementById(\''+bodyId+'\');'
            +'var c=document.getElementById(\''+chevId+'\');'
            +'if(!b)return;var op=b.classList.toggle(\'cgOpen\');'
            +'if(c){c.style.transform=op?\'rotate(180deg)\':\'\';c.style.color=op?\'#1d4ed8\':\'\'}'
            +'})()"';
    }

    /* v12.2 redesign: wrapCollapsed turns any block of HTML into a
     * collapsible row with a visible label and a chevron. The body is
     * collapsed by default (max-height:0 via .cgBody without .cgOpen).
     * Click the toggle row → expand. Click again → collapse.
     *
     * Used by the new renderCardHtml to keep secondary sections
     * (phenotypes, functional categories, phylogenetic, orthologs,
     * complex/STRING, domains, publications, ciliogenics) below the
     * fold without losing their data — the labels stay visible.
     *
     * Returns empty string if the inner HTML is empty/whitespace,
     * so empty sections don't render an empty toggle. */
    function wrapCollapsed(label, innerHtml, opts) {
        if (!innerHtml) return '';
        var probe = String(innerHtml).replace(/<[^>]+>/g, '').trim();
        if (!probe) return '';  /* no real content — skip */
        var bid = uid(), cid = uid();
        var subtitle = (opts && opts.subtitle) ? opts.subtitle : '';
        return '<div style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:10px;margin-bottom:6px;overflow:hidden;">'
            +'<div class="cgToggle" '+collapseToggle(bid, cid)+' style="padding:9px 14px;background:'+B.surface+';border-bottom:1px solid transparent;">'
                +'<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">'
                    +'<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:'+B.deep+';">'+label+'</div>'
                    +(subtitle?'<div style="font-size:11px;color:'+B.muted+';font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">· '+subtitle+'</div>':'')
                +'</div>'
                +'<span class="cgChev" id="'+cid+'">▼</span>'
            +'</div>'
            +'<div class="cgBody" id="'+bid+'"><div style="padding:11px 14px;">'+innerHtml+'</div></div>'
        +'</div>';
    }

    /* Strip the section header (cgPT) from a rendered section, since
     * wrapCollapsed already shows the label in the toggle row.
     * Pattern: <div class="cgP" ...><div class="cgPT">label</div>BODY</div>
     * We want just BODY. cgPT in this codebase always contains only plain
     * text (emoji + label), so the simple <div class="cgPT">[^<]*</div>
     * regex is sufficient and won't over-match into the body. */
    function stripCgHeader(html) {
        if (!html) return '';
        return html
            .replace(/^<div class="cgP"[^>]*>/, '')
            .replace(/<div class="cgPT">[^<]*<\/div>/, '')
            .replace(/<\/div>$/, '');
    }


    /* ── Raw master fallback ─────────────────────────────────────────────── */
    function rawOf(sym) {
        try {
            var m = win.CiliAI && win.CiliAI._rawMaster;
            return m ? ((m.genes || m)[sym.toUpperCase()] || null) : null;
        } catch(e) { return null; }
    }
    function F(rec, raw, key, def) {
        if (rec && rec[key] != null && rec[key] !== '') return rec[key];
        if (raw && raw[key] != null && raw[key] !== '') return raw[key];
        return def !== undefined ? def : null;
    }

    /* ══════════════════════════════════════════════════════════════════════
     * EVIDENCE TIER — Gold Standard Ciliary Genes / Cilia-Associated Genes
     *
     * v12.4 (2026-05-09): tier is now PRE-COMPUTED in the master JSON
     * (see /var/www/ciliahub/scripts/tag_evidence.py). Each gene record has:
     *
     *   evidence_tier: "Gold Standard Ciliary Genes" | "Cilia-Associated Genes"
     *
     * The rule that produces it: a gene is Cilia-Associated if its
     * localization field contains any of these curator-applied marker
     * strings:
     *     "cilia associated gene"
     *     "cilia associated"
     *     "Ciliary associated gene"
     * Every other gene in the master is Gold Standard. CiliaHub has no
     * candidate tier — every master gene is at minimum Cilia-Associated.
     *
     * This function reads the pre-computed field; if absent (transitional
     * state, stale cache, etc.) it falls back to the same rule client-side
     * so the badge never shows "undefined". */
    var ASSOC_MARKER_LABELS = ['cilia associated gene', 'cilia associated', 'Ciliary associated gene'];
    var TIER_GOLD_NAME  = 'Gold Standard Ciliary Genes';
    var TIER_ASSOC_NAME = 'Cilia-Associated Genes';

    /* Compact tier descriptors used by renderTierBadge. The key 'tier' is
     * the canonical id; 'label' is the full human-readable name. */
    var TIER_GOLD_DESCRIPTOR = {
        tier:'gold',
        label:TIER_GOLD_NAME,
        color:'#15803d',  // green-700
        bg:'#dcfce7',     // green-100
        border:'#86efac', // green-300
        icon:'🟢',
        tooltip:'Curated ciliary gene with localization to a real ciliary compartment (cilia, basal body, transition zone, axoneme, centrosome, etc).'
    };
    var TIER_ASSOC_DESCRIPTOR = {
        tier:'associated',
        label:TIER_ASSOC_NAME,
        color:'#1e40af',  // blue-800
        bg:'#dbeafe',     // blue-100
        border:'#93c5fd', // blue-300
        icon:'🔵',
        tooltip:'Functionally or biologically linked to cilia, but lacking direct localization to a ciliary compartment.'
    };

    function computeEvidenceTier(g, raw) {
        // Primary path: read pre-computed tier from master
        var preComputed = (g && g.evidence_tier) || (raw && raw.evidence_tier) || null;
        if (preComputed === TIER_GOLD_NAME)  return TIER_GOLD_DESCRIPTOR;
        if (preComputed === TIER_ASSOC_NAME) return TIER_ASSOC_DESCRIPTOR;

        // Fallback path: compute client-side using the same rule as tag_evidence.py.
        // Used during cache transitions or for records that haven't been re-tagged.
        var locsRaw = (g && (g.localization || g.Localization)) || (raw && (raw.localization || raw.Localization)) || '';
        var locs = Array.isArray(locsRaw) ? locsRaw : String(locsRaw).split(/[,;|]/);
        // Tag-presence rule: case-sensitive match against the three known marker strings.
        var hasAssoc = locs.some(function(l) {
            var s = String(l).trim();
            return ASSOC_MARKER_LABELS.indexOf(s) !== -1;
        });
        return hasAssoc ? TIER_ASSOC_DESCRIPTOR : TIER_GOLD_DESCRIPTOR;
    }

    /* Renders the tier badge as inline HTML. Used in header. */
    function renderTierBadge(tier) {
        return '<span title="'+esc(tier.tooltip)+'" '
            +'style="display:inline-flex;align-items:center;gap:5px;background:'+tier.bg+';color:'+tier.color+';border:1px solid '+tier.border+';padding:3px 11px;border-radius:20px;font-size:10px;font-weight:800;cursor:help;white-space:nowrap;">'
            +'<span style="font-size:9px;">'+tier.icon+'</span>'+esc(tier.label)
        +'</span>';
    }

    /* ══════════════════════════════════════════════════════════════════════
     * "WHY IS THIS IN CILIAHUB?" — provenance box
     *
     * 5-line max, ordered by evidential strength:
     *   1. Localization (with PMID chips)
     *   2. Disease association
     *   3. Functional screen hits
     *   4. LoF effect
     *   5. Conservation
     *
     * Each line auto-skipped if data unavailable. Lines render as
     * compact bullet rows. PMIDs are clickable chips, not naked numbers. */
    function buildWhyInCiliaHub(g, raw) {
        var lines = [];

        // 1. Localization with PMID chips
        var locsRaw = (g && (g.localization || g.Localization)) || (raw && (raw.localization || raw.Localization)) || '';
        var locs = (Array.isArray(locsRaw) ? locsRaw : String(locsRaw).split(/[,;|]/)).map(function(x){return String(x).trim();}).filter(Boolean);
        var locRefs = F(g, raw, 'localization_refs', []);
        if (locs.length > 0) {
            var primaryLocs = locs.slice(0, 3).join(', ');
            var pmidChips = '';
            if (Array.isArray(locRefs) && locRefs.length > 0) {
                pmidChips = ' ' + locRefs.slice(0, 3).map(function(p){
                    var pid = String(p).replace(/[^0-9]/g, '');
                    if (!pid) return '';
                    return '<a href="https://pubmed.ncbi.nlm.nih.gov/'+pid+'/" target="_blank" rel="noopener" class="cgPMID" style="margin-left:4px;">PMID:'+pid+' ↗</a>';
                }).filter(Boolean).join('');
            }
            lines.push('<strong style="color:'+B.deep+';">Localizes to</strong> '+esc(primaryLocs)+pmidChips);
        }

        // 2. Disease association
        var dis = F(g, raw, 'ciliopathies', []) || F(g, raw, 'Ciliopathies', []);
        if (!Array.isArray(dis)) dis = String(dis||'').split(/[,;|]/).map(function(x){return x.trim();}).filter(Boolean);
        if (dis.length > 0) {
            var disStr = dis.slice(0, 3).join(', ') + (dis.length > 3 ? ' (+ '+(dis.length-3)+' more)' : '');
            lines.push('<strong style="color:'+B.deep+';">Associated with</strong> '+esc(disStr));
        }

        // 3. Screen hits
        var screens = F(g, raw, 'screens', []);
        if (Array.isArray(screens) && screens.length > 0) {
            var nScreens = screens.length;
            var screenNames = screens.slice(0, 3).map(function(s) {
                var label = s.screen || s.source || '';
                // Compact: "Wheway et al. 2015 (siRNA)" → "Wheway 2015"
                var m = String(label).match(/^([A-Z][a-z]+).*?(\d{4})/);
                return m ? m[1]+' '+m[2] : label;
            }).filter(Boolean).join(', ');
            lines.push('<strong style="color:'+B.deep+';">Positive in '+nScreens+' screen'+(nScreens>1?'s':'')+'</strong> ('+esc(screenNames)+(nScreens>3?', …':'')+')');
        }

        // 4. LoF effect
        var lof = F(g, raw, 'lof_effects', '') || F(g, raw, 'lof_effect', '');
        var pct = F(g, raw, 'pct_ciliated', '');
        if (lof || pct) {
            var lofParts = [];
            if (lof && lof.toLowerCase() !== 'no effect' && lof.toLowerCase() !== 'not reported') lofParts.push(lof.toLowerCase());
            if (pct && pct.toLowerCase() !== 'no effect' && pct.toLowerCase() !== 'not reported') lofParts.push(pct.toLowerCase()+' ciliated cells');
            if (lofParts.length > 0) {
                lines.push('<strong style="color:'+B.deep+';">Loss-of-function</strong> ' + esc(lofParts.join(', ')));
            }
        }

        // 5. Conservation (Nevers 2017 if available, otherwise fall back to ortholog count)
        // v5.10: removed 'Conserved orthologs in N species' line — orthology
        // alone is not a reason for inclusion in CiliaHub.

        if (lines.length === 0) return '';

        // v5.10: flat white card matching the Perturbation Matrix design language.
        return '<div style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:14px 18px;margin-bottom:14px;">'
            +'<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:'+B.ink+';margin-bottom:10px;">Why is this in CiliaHub</div>'
            +'<ul style="list-style:none;margin:0;padding:0;font-size:13px;color:'+B.ink+';line-height:1.6;">'
                +lines.map(function(l){return '<li style="margin-bottom:4px;display:flex;align-items:flex-start;gap:8px;"><span style="color:'+B.faint+';flex-shrink:0;font-size:11px;line-height:1.5;">▸</span><span style="flex:1;">'+l+'</span></li>';}).join('')
            +'</ul>'
        +'</div>';
    }

    /* ══════════════════════════════════════════════════════════════════════
     * LoF/OE EFFECTS COMPACT STRIP — single row of 3 chips, above the fold
     *
     * Researchers scan; this lets them see knockdown phenotype + OE effect
     * in one glance. Full Functional Effects card stays in the body grid.
     * Returns empty string if no data. */
    function buildLoFEffectsStrip(g, raw) {
        // v5.10: titled card with 3-column metric grid below.
        // Section header gives context for what these three columns describe.
        var sym = esc(g.Gene || g.gene || (raw && raw.gene) || 'this gene');
        var lof = F(g, raw, 'lof_effects', '') || F(g, raw, 'lof_effect', '');
        var pct = F(g, raw, 'pct_ciliated', '');
        var oe  = F(g, raw, 'oe_effect',   '');
        if (!lof && !pct && !oe) return '';

        function cell(label, val) {
            var labelHtml = '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:'+B.faint+';font-weight:600;margin-bottom:4px;">'+esc(label)+'</div>';
            if (!val) {
                return '<div>'+labelHtml+'<div style="font-size:13px;color:'+B.faint+';font-style:italic;">— No data</div></div>';
            }
            var v = String(val).toLowerCase();
            var arrow = '—', tone = B.muted;
            if (v.indexOf('shorter')!==-1 || v.indexOf('decreased')!==-1 || v.indexOf('reduced')!==-1 || v.indexOf('absent')!==-1 || v.indexOf('loss')!==-1) {
                arrow='↓'; tone='#A32D2D';
            } else if (v.indexOf('longer')!==-1 || v.indexOf('increased')!==-1 || v.indexOf('elongated')!==-1 || v.indexOf('supernumerary')!==-1) {
                arrow='↑'; tone='#185FA5';
            } else if (v==='no effect' || v==='normal' || v==='not reported') {
                arrow='—'; tone=B.faint;
            }
            return '<div>'+labelHtml
                +'<div style="font-size:13px;color:'+tone+';font-weight:500;">'+arrow+' '+esc(val)+'</div>'
            +'</div>';
        }

        return '<div style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:14px 22px;margin-bottom:14px;">'
            +'<div style="margin-bottom:14px;">'
                +'<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:'+B.ink+';">Cilia effects upon perturbation of '+sym+'</div>'
                +'<div style="font-size:11px;color:'+B.faint+';margin-top:3px;">Curated observations of cilium morphology and ciliogenesis upon gene knockdown, loss-of-function, or overexpression.</div>'
            +'</div>'
            +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;">'
                +cell('LoF effect', lof)
                +cell('% ciliated', pct)
                +cell('Overexpression', oe)
            +'</div>'
        +'</div>';
    }

    /* ══════════════════════════════════════════════════════════════════════
     * DESIGN SYSTEM — strict blues only
     * ══════════════════════════════════════════════════════════════════════ */
    var B = {
        ink:    '#0a1f3d',
        navy:   '#1e3a5f',
        mid:    '#1d4ed8',
        deep:   '#1e40af',
        light:  '#dbeafe',
        pale:   '#eff6ff',
        border: '#bfdbfe',
        muted:  '#64748b',
        faint:  '#94a3b8',
        bg:     '#f1f5f9',
        surface:'#f8fafc',
        white:  '#ffffff',
        divider:'#e2e8f0',
    };

    /* ══════════════════════════════════════════════════════════════════════
     * STYLES
     * ══════════════════════════════════════════════════════════════════════ */
    var STYLES = '<style id="cg12s">'
        + '.cg12{font-family:\'IBM Plex Sans\',\'Segoe UI\',system-ui,sans-serif;color:'+B.ink+';background:'+B.bg+';}'
        + '.cg12 *{box-sizing:border-box;}'
        + '.cg12 a{color:'+B.mid+';text-decoration:none;}'
        + '.cg12 a:hover{text-decoration:underline;}'
        + '.cgP{background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:14px;display:flex;flex-direction:column;}'
        + '.cgPT{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:'+B.muted+';margin-bottom:10px;display:flex;align-items:center;gap:6px;flex-shrink:0;}'
        + '.cgPT::after{content:\'\';flex:1;height:1px;background:'+B.divider+';}'
        + '.cg3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px;align-items:stretch;}'
        + '.cg2{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:10px;align-items:stretch;}'
        + '@media(max-width:580px){.cg3,.cg2{grid-template-columns:1fr;}}'
        + '.cgBody{overflow:hidden;max-height:0;opacity:0;transition:max-height .28s ease,opacity .2s;}'
        + '.cgBody.cgOpen{max-height:5000px;opacity:1;}'
        + '.cgToggle{display:flex;align-items:center;justify-content:space-between;cursor:pointer;padding:3px 0;}'
        + '.cgToggle:hover .cgChev{color:'+B.mid+';}'
        + '.cgChev{font-size:11px;color:'+B.faint+';transition:transform .2s,color .2s;flex-shrink:0;margin-left:6px;}'
        + '.cgEffCell{flex:1;padding:11px;background:'+B.surface+';border:1px solid '+B.divider+';border-radius:8px;display:flex;flex-direction:column;gap:6px;}'
        + '.cgEffLabel{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:'+B.faint+';line-height:1.3;}'
        + '.cgBdg{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:16px;font-size:11px;font-weight:700;}'
        + '.cgBdgD{background:'+B.light+';color:'+B.deep+';border:1px solid '+B.border+';}'
        + '.cgBdgN{background:'+B.pale+';color:'+B.mid+';border:1px solid '+B.border+';}'
        + '.cgBdgU{background:'+B.pale+';color:'+B.muted+';border:1px solid '+B.divider+';}'
        + '.cgPMID{display:inline-flex;align-items:center;font-size:10px;font-weight:700;color:'+B.mid+';background:'+B.pale+';border:1px solid '+B.border+';padding:2px 7px;border-radius:4px;text-decoration:none;transition:background .12s,color .12s;}'
        + '.cgPMID:hover{background:'+B.mid+';color:#fff;}'
        + '.cgPheno{border-left:3px solid '+B.mid+';background:'+B.surface+';border-radius:0 7px 7px 0;padding:10px 12px;margin-bottom:8px;}'
        + '.cgPheno:last-child{margin-bottom:0;}'
        + '.cgTbl{width:100%;border-collapse:collapse;font-size:12px;}'
        + '.cgTbl th{padding:5px 7px;font-size:9px;font-weight:800;color:'+B.faint+';text-transform:uppercase;letter-spacing:.06em;text-align:left;border-bottom:1px solid '+B.divider+';}'
        + '.cgTbl td{padding:5px 7px;color:#334155;border-bottom:1px solid '+B.surface+';vertical-align:middle;}'
        + '.cgTbl tr:last-child td{border-bottom:none;}'
        + '.cgTbl tr:hover td{background:'+B.pale+';}'
        + '.cgBar{background:'+B.light+';border-radius:3px;height:4px;overflow:hidden;margin-top:3px;}'
        + '.cgBarF{height:100%;background:'+B.mid+';border-radius:3px;}'
        + '.cgTissue{display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 4px;border-radius:8px;cursor:pointer;border:1px solid '+B.divider+';background:'+B.surface+';transition:border-color .15s,box-shadow .15s;}'
        + '.cgTissue:hover{border-color:'+B.mid+';box-shadow:0 2px 8px rgba(29,78,216,.1);}'
        + '.cgDot{width:22px;height:22px;border-radius:50%;}'
        + '.cgTL{font-size:9px;font-weight:700;color:'+B.muted+';text-align:center;line-height:1.2;}'
        + '.cgDis{display:flex;align-items:center;gap:7px;padding:7px 10px;background:'+B.pale+';border:1px solid '+B.border+';border-radius:7px;}'
        + '.cgScreen{padding:9px 10px;background:'+B.pale+';border:1px solid '+B.border+';border-radius:8px;margin-bottom:6px;}'
        + '.cgCat{background:'+B.pale+';color:'+B.deep+';border:1px solid '+B.border+';padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;display:inline-block;}'
        /* #cgScroll rule removed in v12.1.0 — floating scroll button no longer rendered.
         * The native scrollbar on #cilia-svg is the sole scroll mechanism.
         * If a stale #cgScroll button somehow exists in the DOM, hide it. */
        + '#cgScroll{display:none !important;}'
        + '</style>';

    /* injectScroll: no longer creates a floating "↓ Scroll" button.
     * Kept as a stub for backward compatibility with any external caller,
     * and to clean up stale #cgScroll buttons that may persist from
     * earlier renders before this fix was deployed. */
    function injectScroll(el) {
        var allExisting = doc.querySelectorAll('#cgScroll');
        allExisting.forEach(function(btn) {
            if (btn.parentNode) btn.parentNode.removeChild(btn);
        });
    }

    /* ══════════════════════════════════════════════════════════════════════
     * HEADER
     * ══════════════════════════════════════════════════════════════════════ */
    function renderHeader(g, raw) {
        var sym     = esc(g.Gene || g.gene || '?');
        var desc    = esc(g.Description || g.description || '');
        var ensgRaw = g.Ensembl || g.ensembl_id || (raw&&raw.ensembl_id) || '';
        var cls     = toArray(g.ciliopathy_classification || (raw&&raw.ciliopathy_classification) || '');
        var locs    = toArray(g.Localization || g.localization || (raw&&raw.localization) || '');
        var syns    = toArray(g.Synonyms || g.synonyms || (raw&&raw.synonyms) || '');

        // Evidence tier — Gold Standard / Cilia-Associated
        // computeEvidenceTier returns a descriptor: {tier, label, color, bg, border, icon, tooltip}
        var tierDesc = computeEvidenceTier(g, raw);

        // ───────── Status pills (soft pastels) ─────────
        // Tier pill — green for Gold Standard, blue for Cilia-Associated
        var tierPill = '';
        if (tierDesc && tierDesc.label) {
            var isGold = tierDesc.tier === 'gold';
            var pillBg = isGold ? '#e1f5ee' : '#e6f1fb';
            var pillFg = isGold ? '#0f6e56' : '#185fa5';
            tierPill = '<span title="'+esc(tierDesc.tooltip||'')+'" style="font-size:11px;padding:3px 9px;background:'+pillBg+';color:'+pillFg+';border-radius:999px;font-weight:500;white-space:nowrap;cursor:help;">'+esc(tierDesc.label)+'</span>';
        }

        // Classification pills — soft blue
        var clsPills = cls.map(function(c){
            return '<span style="font-size:11px;padding:3px 9px;background:#e6f1fb;color:#185fa5;border-radius:999px;font-weight:500;white-space:nowrap;">'+esc(c)+'</span>';
        }).join('');

        // ───────── External ID stack (right side) ─────────
        var uid_=F(g,raw,'uniprot_id',''), omim=F(g,raw,'omim_id','');
        var idStack = [];
        function idEntry(label, value, href) {
            if (!value) return '';
            return '<div style="text-align:right;">'
                +'<div style="font-size:9px;font-weight:600;color:'+B.faint+';text-transform:uppercase;letter-spacing:.08em;">'+esc(label)+'</div>'
                +'<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:'+B.mid+';margin-top:1px;">'
                    +(href?'<a href="'+esc(href)+'" target="_blank" rel="noopener">'+esc(value)+' ↗</a>':esc(value))
                +'</div>'
            +'</div>';
        }
        if (ensgRaw) idStack.push(idEntry('Ensembl', ensgRaw, 'https://www.ensembl.org/Homo_sapiens/Gene/Summary?g='+esc(ensgRaw)));
        if (uid_)    idStack.push(idEntry('UniProt', uid_, 'https://www.uniprot.org/uniprot/'+esc(uid_)));
        if (omim)    idStack.push(idEntry('OMIM', omim, 'https://omim.org/entry/'+esc(omim)));

        // ───────── Localisation chips (soft grey) ─────────
        var locChips = locs.map(function(l){
            return '<span style="font-size:11px;padding:3px 8px;background:'+B.surface+';color:'+B.muted+';border-radius:4px;">'+esc(l)+'</span>';
        }).join('');

        // ───────── Aliases (outlined tertiary chip) ─────────
        var aliasChip = syns.length
            ? '<span style="font-size:11px;padding:3px 8px;background:transparent;color:'+B.faint+';border:0.5px solid '+B.divider+';border-radius:4px;">aliases: '+esc(syns.join(' · '))+'</span>'
            : '';

        // ───────── Compose ─────────
        return '<div style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:18px 22px;margin-bottom:14px;">'
            // Top row: name+desc+pills (left), IDs (right)
            +'<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:18px;">'
                +'<div style="flex:1;min-width:280px;">'
                    +'<h1 style="font-family:\'IBM Plex Mono\',\'SF Mono\',monospace;font-size:24px;font-weight:600;color:'+B.ink+';margin:0 0 4px;letter-spacing:-.01em;">'+sym+'</h1>'
                    +(desc?'<div style="font-size:13px;color:'+B.muted+';margin:0 0 10px;line-height:1.45;">'+desc+'</div>':'<div style="height:10px;"></div>')
                    +((tierPill||clsPills)?'<div style="display:flex;gap:6px;flex-wrap:wrap;">'+tierPill+clsPills+'</div>':'')
                +'</div>'
                +(idStack.length?'<div style="display:flex;gap:14px;flex-wrap:wrap;flex-shrink:0;">'+idStack.join('')+'</div>':'')
            +'</div>'
            // Bottom row: localisation chips + aliases
            +((locChips||aliasChip)?'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;">'+locChips+aliasChip+'</div>':'')
        +'</div>';
    }


    /* ══════════════════════════════════════════════════════════════════════
     * QUICK LINKS BAR
     * ══════════════════════════════════════════════════════════════════════ */
    function renderQuickLinks(g, raw) {
        var uid_=F(g,raw,'uniprot_id',''), af=F(g,raw,'alphafold_url','');
        var omim=F(g,raw,'omim_id',''), cg=F(g,raw,'clingen_report','');
        var cgDis=F(g,raw,'clingen_disease','');
        var links=[];
        if(uid_)  links.push('<a href="https://www.uniprot.org/uniprot/'+esc(uid_)+'" target="_blank" rel="noopener" style="font-size:10px;font-weight:700;color:'+B.mid+';background:'+B.pale+';border:1px solid '+B.border+';padding:3px 9px;border-radius:5px;text-decoration:none;">UniProt ↗</a>');
        if(af)    links.push('<a href="'+esc(af)+'" target="_blank" rel="noopener" style="font-size:10px;font-weight:700;color:'+B.deep+';background:'+B.light+';border:1px solid '+B.border+';padding:3px 9px;border-radius:5px;text-decoration:none;">AlphaFold ↗</a>');
        if(omim)  links.push('<a href="https://omim.org/entry/'+esc(omim)+'" target="_blank" rel="noopener" style="font-size:10px;font-weight:700;color:'+B.navy+';background:'+B.pale+';border:1px solid '+B.border+';padding:3px 9px;border-radius:5px;text-decoration:none;">OMIM '+esc(omim)+' ↗</a>');
        if(cg)    links.push('<a href="'+esc(cg)+'" target="_blank" rel="noopener" style="font-size:10px;font-weight:700;color:'+B.deep+';background:'+B.light+';border:1px solid '+B.border+';padding:3px 9px;border-radius:5px;text-decoration:none;">'+(cgDis?esc(cgDis)+' ':'')+'ClinGen ↗</a>');
        if(!links.length) return '';
        return '<div style="padding:8px 20px;display:flex;flex-wrap:wrap;gap:6px;background:'+B.white+';border-bottom:1px solid '+B.divider+';">'+links.join('')+'</div>';
    }

    /* ══════════════════════════════════════════════════════════════════════
     * CILIOPATHY ASSOCIATIONS
     * ══════════════════════════════════════════════════════════════════════ */
    function renderCiliopathies(g, raw) {
        // v5.10: table matching the Perturbation Matrix design.
        // Columns: Disease | Classification (pill) | PMID
        var dis = toArray(g.Ciliopathies||g.ciliopathies||(raw&&raw.ciliopathies)||'');
        var classMap = (g.disease_classifications)||(raw&&raw.disease_classifications)||{};
        var refs = toArray(g.ciliopathy_refs||g.disease_refs||(raw&&raw.ciliopathy_refs)||(raw&&raw.disease_refs)||[]);

        if (!dis.length) {
            return '<div style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:14px 18px;margin-bottom:14px;">'
                +'<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:'+B.ink+';">Ciliopathy associations</div>'
                +'<p style="font-size:12px;color:'+B.faint+';font-style:italic;margin:10px 0 0;">No ciliopathy associations recorded.</p>'
            +'</div>';
        }

        // Pill colour mapping
        function pillForClassification(c) {
            var lc = String(c||'').toLowerCase();
            var bg, fg;
            if (lc.indexOf('motile') !== -1)            { bg='#FAEEDA'; fg='#854F0B'; }
            else if (lc.indexOf('primary') !== -1)      { bg='#FCEBEB'; fg='#A32D2D'; }
            else if (lc.indexOf('tissue') !== -1 || lc.indexOf('idio') !== -1) { bg='#E6F1FB'; fg='#185FA5'; }
            else                                         { bg=B.surface; fg=B.muted; }
            return '<span style="font-size:11px;padding:3px 9px;background:'+bg+';color:'+fg+';border-radius:999px;font-weight:500;white-space:nowrap;">'+esc(c)+'</span>';
        }

        // Build rows
        var rows = dis.map(function(d, i) {
            var classn = classMap[d] || '';
            var pmid = refs[i] || refs[0] || '';
            var pidClean = String(pmid).replace(/[^0-9]/g, '');
            return '<tr style="border-bottom:0.5px solid '+B.divider+';">'
                +'<td style="padding:8px;font-weight:500;color:'+B.ink+';">'+esc(d)+'</td>'
                +'<td style="padding:8px;">'+(classn?pillForClassification(classn):'<span style="color:'+B.faint+';font-style:italic;font-size:11px;">unclassified</span>')+'</td>'
                +'<td style="padding:8px;font-family:\'IBM Plex Mono\',monospace;font-size:11px;">'
                    +(pidClean?'<a href="https://pubmed.ncbi.nlm.nih.gov/'+pidClean+'/" target="_blank" rel="noopener" style="color:'+B.mid+';">'+pidClean+' ↗</a>':'<span style="color:'+B.faint+';">—</span>')
                +'</td>'
            +'</tr>';
        }).join('');

        return '<div style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:14px 18px;margin-bottom:14px;">'
            +'<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:'+B.ink+';margin-bottom:12px;">Ciliopathy associations · '+dis.length+' disease'+(dis.length>1?'s':'')+'</div>'
            +'<table style="width:100%;font-size:12px;border-collapse:collapse;table-layout:fixed;">'
                +'<colgroup><col style="width:48%"><col style="width:35%"><col style="width:17%"></colgroup>'
                +'<thead><tr style="text-align:left;color:'+B.muted+';border-bottom:0.5px solid '+B.divider+';">'
                    +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">Disease</th>'
                    +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">Classification</th>'
                    +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">PMID</th>'
                +'</tr></thead>'
                +'<tbody>'+rows+'</tbody>'
            +'</table>'
        +'</div>';
    }

    /* ══════════════════════════════════════════════════════════════════════
     * DISEASE-ANCHORED SYMPTOMS  (gene → disease → symptom)
     * ══════════════════════════════════════════════════════════════════════
     * CiliaHub data model: symptoms are properties of DISEASES, never of the
     * gene directly. A gene relates to a symptom only transitively, through
     * the ciliopathies it is linked to. This section renders the phenotype
     * profile of each associated disease — it never builds a flat per-gene
     * symptom list. Source: /data/phenotype/disease_phenotype_profiles.json
     * ══════════════════════════════════════════════════════════════════════ */

    /* Rows in a profile that are bookkeeping artefacts, not real phenotypes. */
    var DISEASE_SX_JUNK = {
        'Methodology': 1,
        'Cohort description': 1,
        'Other / unclassified': 1,
        'Other': 1,
        'Unclassified': 1
    };

    function diseaseSlug(name) {
        return String(name || '').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /* Lazy-load the disease phenotype profiles once, mirroring loadPhylogeny.
     * Caches the dict on win.CiliAI._diseaseProfiles plus a normalised-key
     * lookup on win.CiliAI._diseaseProfilesNorm for tolerant disease matching.
     * Always resolves (never rejects) so a missing file degrades gracefully. */
    function loadDiseaseProfiles() {
        win.CiliAI = win.CiliAI || {};
        if (win.CiliAI._diseaseProfiles) return Promise.resolve(win.CiliAI._diseaseProfiles);
        return fetch('/data/phenotype/disease_phenotype_profiles.json', { cache: 'default' })
            .then(function(r) { return r.ok ? r.json() : {}; })
            .then(function(d) {
                win.CiliAI._diseaseProfiles = d || {};
                var norm = {};
                Object.keys(win.CiliAI._diseaseProfiles).forEach(function(k) {
                    norm[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = k;
                });
                win.CiliAI._diseaseProfilesNorm = norm;
                log('Disease phenotype profiles cached (' + Object.keys(win.CiliAI._diseaseProfiles).length + ' diseases).');
                return win.CiliAI._diseaseProfiles;
            })
            .catch(function(e) {
                log('Disease profiles fetch failed: ' + e.message, 'error');
                win.CiliAI._diseaseProfiles = win.CiliAI._diseaseProfiles || {};
                return win.CiliAI._diseaseProfiles;
            });
    }
    win.loadDiseaseProfiles = loadDiseaseProfiles;

    /* Render the symptom profile of each disease this gene is linked to.
     * Returns '' if the gene has no ciliopathies or the profiles aren't loaded
     * (the async render paths preload them before calling renderCardHtml). */
    function buildDiseaseSymptoms(g, raw) {
        var dis = toArray(g.Ciliopathies || g.ciliopathies || (raw && raw.ciliopathies) || '');
        if (!dis.length) return '';

        var profiles = (win.CiliAI && win.CiliAI._diseaseProfiles) || {};
        var normMap  = (win.CiliAI && win.CiliAI._diseaseProfilesNorm) || {};
        if (!Object.keys(profiles).length) return '';

        function lookup(name) {
            if (profiles[name]) return profiles[name];
            var k = normMap[String(name).toLowerCase().replace(/[^a-z0-9]/g, '')];
            return k ? profiles[k] : null;
        }
        function sortedEntries(obj) {
            return Object.keys(obj || {})
                .filter(function(k) { return !DISEASE_SX_JUNK[k]; })
                .sort(function(a, b) { return (obj[b] || 0) - (obj[a] || 0); });
        }

        var TOPN = 10;
        var blocks = dis.map(function(d) {
            var p = lookup(d);
            if (!p) return '';
            var slug = diseaseSlug(d);

            var organs = sortedEntries(p.organ_counts);
            var organChips = organs.map(function(o) {
                return '<span style="font-size:11px;padding:2px 8px;background:' + B.pale + ';color:' + B.deep + ';border-radius:999px;white-space:nowrap;">' + esc(o) + ' <span style="color:' + B.faint + ';">' + p.organ_counts[o] + '</span></span>';
            }).join(' ');

            var concepts = sortedEntries(p.concept_counts);
            var shown = concepts.slice(0, TOPN);
            var conceptList = shown.map(function(c) {
                return '<li style="display:flex;justify-content:space-between;gap:10px;margin-bottom:3px;"><span>' + esc(c) + '</span><span style="color:' + B.faint + ';font-size:11px;flex-shrink:0;">×' + p.concept_counts[c] + '</span></li>';
            }).join('');
            var more = concepts.length > TOPN
                ? '<a href="/disease/' + slug + '" target="_blank" rel="noopener" style="font-size:11px;color:' + B.mid + ';">+' + (concepts.length - TOPN) + ' more phenotypes on the ' + esc(d) + ' page ↗</a>'
                : '';

            var hpoCount = p.n_hpo || (p.hpo_ids ? p.hpo_ids.length : 0);
            var meta = (hpoCount ? hpoCount + ' HPO terms' : '') + (p['class'] ? ' · ' + esc(p['class']) : '');

            return '<div style="border:1px solid ' + B.divider + ';border-radius:10px;padding:11px 13px;margin-bottom:8px;background:' + B.surface + ';">'
                + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:8px;">'
                    + '<a href="/disease/' + slug + '" target="_blank" rel="noopener" style="font-weight:600;color:' + B.ink + ';text-decoration:none;font-size:13px;">' + esc(d) + ' ↗</a>'
                    + '<span style="font-size:10.5px;color:' + B.faint + ';white-space:nowrap;">' + meta + '</span>'
                + '</div>'
                + (organChips ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:' + (conceptList ? '9px' : '0') + ';">' + organChips + '</div>' : '')
                + (conceptList ? '<ul style="list-style:none;padding:0;margin:0;font-size:12px;color:' + B.navy + ';display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1px 22px;">' + conceptList + '</ul>' : '')
                + (more ? '<div style="margin-top:7px;">' + more + '</div>' : '')
            + '</div>';
        }).filter(Boolean).join('');

        if (!blocks) return '';

        return '<div style="background:' + B.white + ';border:1px solid ' + B.divider + ';border-radius:12px;padding:14px 18px;margin-bottom:14px;">'
            + '<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:' + B.ink + ';margin-bottom:4px;">Symptoms by associated disease</div>'
            + '<p style="font-size:11px;color:' + B.faint + ';margin:0 0 11px;line-height:1.45;">Symptoms are properties of the disease, not the gene — shown here for each ciliopathy this gene is linked to (gene → disease → symptom). Counts are the number of records supporting each phenotype.</p>'
            + blocks
        + '</div>';
    }

    /* ══════════════════════════════════════════════════════════════════════
     * FUNCTIONAL EFFECTS
     * ══════════════════════════════════════════════════════════════════════ */
    function renderFunctionalEffects(g, raw) {
        var lof = g.lof_effects || g.lof_effect || (raw&&raw.lof_effect) || '';
        var pct = g.pct_ciliated || (raw&&raw.pct_ciliated) || '';
        var oe  = g.oe_effect   || (raw&&raw.oe_effect)   || '';

        function badge(val) {
            if (!val) return '<span style="font-size:11px;color:'+B.faint+';font-style:italic;">No data</span>';
            var v=val.toLowerCase();
            if(v==='not reported'||v==='no effect'||v==='normal')
                return '<span class="cgBdg cgBdgN">— '+esc(val)+'</span>';
            if(v.indexOf('shorter')!==-1||v.indexOf('decreased')!==-1||v.indexOf('reduced')!==-1||v.indexOf('absent')!==-1||v.indexOf('loss')!==-1)
                return '<span class="cgBdg cgBdgD">↓ '+esc(val)+'</span>';
            if(v.indexOf('longer')!==-1||v.indexOf('increased')!==-1||v.indexOf('elongated')!==-1)
                return '<span class="cgBdg" style="background:'+B.light+';color:'+B.mid+';border:1px solid '+B.border+';">↑ '+esc(val)+'</span>';
            return '<span class="cgBdg cgBdgU">~ '+esc(val)+'</span>';
        }

        var cells=[
            {icon:'🔬',label:'LOF → Cilia Length',    val:lof, tip:'Effect on cilia length after gene knockdown / LOF'},
            {icon:'🔢',label:'LOF → % Ciliated Cells', val:pct, tip:'Effect on the fraction of ciliated cells after LOF'},
            {icon:'⬆',label:'Overexpression Effect',  val:oe,  tip:'Effect on cilia when the gene is overexpressed'},
        ].map(function(c){
            return '<div class="cgEffCell" title="'+esc(c.tip)+'" style="cursor:help;">'
                +'<div class="cgEffLabel">'+c.icon+' '+esc(c.label)+'</div>'
                +badge(c.val)+'</div>';
        }).join('');

        return '<div class="cgP">'
            +'<div class="cgPT">⚗️ Functional Effects</div>'
            +'<div style="display:flex;flex-direction:column;gap:7px;">'+cells+'</div>'
        +'</div>';
    }

    /* ══════════════════════════════════════════════════════════════════════
     * SCREEN DATA
     * ══════════════════════════════════════════════════════════════════════ */
    function renderScreens(g, raw) {
        /* v5.9 — perturbation matrix: always 8 reference screens so the
         * "not tested" gaps are visible, with quantitative detail per hit. */
        var screens = g.screens || (raw && raw.screens) || [];
        if (!Array.isArray(screens)) screens = [];

        var REF = [
            {id:'Wheway2015',  label:'Wheway 2015',  method:'siRNA',   measures:'Ciliogenesis',        meaning:'cilium formation & length'},
            {id:'Kim2010',     label:'Kim 2010',     method:'siRNA',   measures:'Cilium length',       meaning:'modulators of length'},
            {id:'Roosing2015', label:'Roosing 2015', method:'siRNA',   measures:'Architecture',        meaning:'Joubert-relevant defects'},
            {id:'Breslow2018', label:'Breslow 2018', method:'CRISPR',  measures:'Hh signalling',       meaning:'TZ / IFT for Hh'},
            {id:'Pusapati2018',label:'Pusapati 2018',method:'CRISPR',  measures:'Hh signalling',       meaning:'Shh transduction'},
            {id:'Failler2021', label:'Failler 2021', method:'siRNA',   measures:'Negative regulators', meaning:'hyper-ciliogenesis on KD'},
            {id:'Basu2023',    label:'Basu 2023',    method:'siRNA',   measures:'L/R asymmetry',       meaning:'motile-cilia / situs'},
            {id:'Elliott2025', label:'Elliott 2025', method:'CRISPRa', measures:'Disassembly trigger', meaning:'cilia loss on activation'},
        ];

        var SURNAME_MAP = {
            'wheway':'Wheway2015','kim':'Kim2010','roosing':'Roosing2015',
            'breslow':'Breslow2018','pusapati':'Pusapati2018','failler':'Failler2021',
            'valderrama':'Failler2021','basu':'Basu2023','elliott':'Elliott2025',
        };
        var byId = {};
        screens.forEach(function(s){
            var name = String(s.source_legacy || s.screen || s.source || '').toLowerCase();
            for (var sn in SURNAME_MAP) {
                if (name.indexOf(sn) !== -1) { byId[SURNAME_MAP[sn]] = s; break; }
            }
        });

        function classify(s) {
            if (!s) return 'not_tested';
            var o = String(s.outcome || s.result || '').toLowerCase();
            if (!o || o === 'not reported') return 'neutral';
            if (o === 'no effect' || o === 'no significant effect') return 'neutral';
            if (/defect|shorter|decreased|loss|no cilia/.test(o)) return 'strong_negative';
            if (/disassembly trigger/.test(o)) return 'disassembly';
            if (/negative regulator|hyper|longer/.test(o)) return 'pos_for_cilia';
            if (/positive regulator/.test(o)) return 'pos_regulator';
            return 'effect';
        }
        function labelFor(s, tier) {
            if (tier === 'not_tested') return '';
            var o = String(s.outcome || s.result || '').trim() || 'No effect';
            return o.replace('Increased Signaling (Negative Regulator)', 'Hh neg. regulator')
                    .replace('Positive Regulator', 'Hh pos. regulator')
                    .replace('Ciliogenesis Defect', 'Cilium defect')
                    .replace('No Significant Effect', 'No effect')
                    .replace('Disassembly Trigger', 'Disassembly');
        }
        function chipFor(tier, label) {
            if (tier === 'not_tested') {
                return '<span style="display:inline-block;font-size:10px;color:'+B.faint+';font-style:italic;">not tested</span>';
            }
            var styles = {
                strong_negative: {bg:'#fee2e2',color:'#991b1b',border:'#fca5a5',sym:'↓'},
                pos_regulator:   {bg:'#dbeafe',color:'#1e40af',border:'#93c5fd',sym:'+Hh'},
                pos_for_cilia:   {bg:'#dcfce7',color:'#166534',border:'#86efac',sym:'−Hh'},
                disassembly:     {bg:'#fed7aa',color:'#9a3412',border:'#fdba74',sym:'⚠'},
                neutral:         {bg:'#f1f5f9',color:'#475569',border:'#cbd5e1',sym:'~'},
                effect:          {bg:B.pale,    color:B.deep,   border:B.border,sym:'•'},
            };
            var s = styles[tier] || styles.effect;
            return '<span style="display:inline-flex;align-items:center;gap:4px;background:'+s.bg+';color:'+s.color+';border:1px solid '+s.border+';padding:2px 7px;border-radius:11px;font-size:10px;font-weight:700;white-space:nowrap;">'
                +'<span style="font-size:9px;opacity:.85;">'+s.sym+'</span>'+esc(label)+'</span>';
        }

        var nHit=0, nTested=0, nLoss=0, nHhReg=0;
        var rows = REF.map(function(ref){
            var s = byId[ref.id];
            var tier = classify(s);
            if (tier !== 'not_tested') nTested++;
            if (tier !== 'not_tested' && tier !== 'neutral') nHit++;
            if (tier === 'strong_negative' || tier === 'disassembly') nLoss++;
            if (tier === 'pos_regulator' || tier === 'pos_for_cilia') nHhReg++;

            var detail = s ? (s.technical_detail || '') : '';
            if (!detail && s && s.raw) {
                var qm = String(s.raw).match(/(z|casTLE effect|lfc|neg_rank)=(-?[\d.]+)/);
                if (qm) detail = qm[1]+'='+qm[2];
            }

            return '<tr style="border-bottom:1px solid '+B.divider+';">'
                +'<td style="padding:7px 8px;vertical-align:top;">'
                    +'<div style="font-size:11px;font-weight:700;color:'+B.ink+';">'+esc(ref.label)+'</div>'
                    +'<div style="font-size:9px;color:'+B.faint+';font-family:monospace;margin-top:1px;">'+(s && s.pmid ? 'PMID '+esc(s.pmid) : 'PMID —')+'</div>'
                +'</td>'
                +'<td style="padding:7px 8px;vertical-align:top;">'
                    +'<div style="font-size:11px;color:'+B.muted+';font-weight:600;">'+esc(ref.measures)+'</div>'
                    +'<div style="font-size:10px;color:'+B.faint+';font-style:italic;margin-top:1px;line-height:1.3;">'+esc(ref.meaning)+'</div>'
                +'</td>'
                +'<td style="padding:7px 8px;vertical-align:top;"><span style="font-size:9px;font-family:monospace;background:'+B.surface+';border:1px solid '+B.divider+';padding:1px 6px;border-radius:9px;color:'+B.muted+';letter-spacing:.02em;text-transform:uppercase;">'+ref.method+'</span></td>'
                +'<td style="padding:7px 8px;vertical-align:top;">'+chipFor(tier, labelFor(s, tier))+'</td>'
                +'<td style="padding:7px 8px;vertical-align:top;">'+(detail
                    ? '<span style="font-family:monospace;font-size:10px;color:'+B.muted+';">'+esc(detail)+'</span>'
                    : '<span style="color:'+B.faint+';font-size:11px;">—</span>')+'</td>'
            +'</tr>';
        }).join('');

        var summary = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:10px 12px 4px;margin-top:6px;border-top:1px dashed '+B.divider+';">'
            +'<div><div style="font-size:18px;font-weight:800;color:'+B.ink+';line-height:1;font-variant-numeric:tabular-nums;">'+nHit+'<span style="font-size:11px;font-weight:500;color:'+B.faint+';"> / '+nTested+'</span></div><div style="font-size:9px;color:'+B.muted+';text-transform:uppercase;letter-spacing:.07em;margin-top:3px;">Hit / Tested</div></div>'
            +'<div><div style="font-size:18px;font-weight:800;color:'+(nLoss?'#991b1b':B.faint)+';line-height:1;font-variant-numeric:tabular-nums;">'+nLoss+'</div><div style="font-size:9px;color:'+B.muted+';text-transform:uppercase;letter-spacing:.07em;margin-top:3px;">Cilium loss</div></div>'
            +'<div><div style="font-size:18px;font-weight:800;color:'+(nHhReg?B.deep:B.faint)+';line-height:1;font-variant-numeric:tabular-nums;">'+nHhReg+'</div><div style="font-size:9px;color:'+B.muted+';text-transform:uppercase;letter-spacing:.07em;margin-top:3px;">Hh regulator</div></div>'
            +'<div><div style="font-size:18px;font-weight:800;color:'+B.faint+';line-height:1;font-variant-numeric:tabular-nums;">'+(REF.length - nTested)+'</div><div style="font-size:9px;color:'+B.muted+';text-transform:uppercase;letter-spacing:.07em;margin-top:3px;">Not tested in</div></div>'
        +'</div>';

        return '<div class="cgP" style="padding:0;overflow:hidden;">'
            +'<div class="cgPT" style="padding:9px 12px;">🖥️ Perturbation matrix · 8 reference screens</div>'
            +'<div style="overflow-x:auto;padding:0 4px;">'
                +'<table style="width:100%;border-collapse:collapse;font-size:11px;">'
                    +'<thead><tr style="border-bottom:2px solid '+B.divider+';">'
                        +'<th style="text-align:left;padding:6px 8px;font-size:9px;font-weight:700;color:'+B.muted+';text-transform:uppercase;letter-spacing:.08em;">Screen</th>'
                        +'<th style="text-align:left;padding:6px 8px;font-size:9px;font-weight:700;color:'+B.muted+';text-transform:uppercase;letter-spacing:.08em;">Measures</th>'
                        +'<th style="text-align:left;padding:6px 8px;font-size:9px;font-weight:700;color:'+B.muted+';text-transform:uppercase;letter-spacing:.08em;">Method</th>'
                        +'<th style="text-align:left;padding:6px 8px;font-size:9px;font-weight:700;color:'+B.muted+';text-transform:uppercase;letter-spacing:.08em;">Outcome</th>'
                        +'<th style="text-align:left;padding:6px 8px;font-size:9px;font-weight:700;color:'+B.muted+';text-transform:uppercase;letter-spacing:.08em;">Detail</th>'
                    +'</tr></thead>'
                    +'<tbody>'+rows+'</tbody>'
                +'</table>'
            +'</div>'
            +summary
        +'</div>';
    }

    /* ══════════════════════════════════════════════════════════════════════
     * FUNCTIONAL CATEGORIES
     * ══════════════════════════════════════════════════════════════════════ */
    function renderFunctionalCategories(g, raw) {
        // v5.10: soft-grey chips matching the Perturbation Matrix design language.
        var cats = toArray(g.functional_category||(raw&&raw.functional_category)||'');
        if (!cats.length) {
            return '<div style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:14px 18px;">'
                +'<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:'+B.ink+';">Functional categories</div>'
                +'<p style="font-size:12px;color:'+B.faint+';font-style:italic;margin:10px 0 0;">No categories recorded.</p>'
            +'</div>';
        }
        return '<div style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:14px 18px;">'
            +'<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:'+B.ink+';margin-bottom:10px;">Functional categories</div>'
            +'<div style="display:flex;flex-wrap:wrap;gap:6px;">'
                +cats.map(function(c){
                    return '<span style="font-size:11px;padding:3px 8px;background:'+B.surface+';color:'+B.muted+';border-radius:4px;">'+esc(c)+'</span>';
                }).join('')
            +'</div>'
        +'</div>';
    }

    /* ══════════════════════════════════════════════════════════════════════
     * FUNCTIONAL SUMMARY
     * ══════════════════════════════════════════════════════════════════════ */
    function renderSummary(g, raw) {
        // v5.10: flat white card. Always show the full text — no collapsed preview.
        // Most summaries are 1-3 sentences so the collapse was unnecessary friction.
        var text = g.Summary||g.summary||g.functional_summary||(raw&&raw.functional_summary)||'';
        if (!text) {
            return '<div style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:14px 18px;margin-bottom:14px;">'
                +'<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:'+B.ink+';">Functional summary</div>'
                +'<p style="font-size:12px;color:'+B.faint+';font-style:italic;margin:10px 0 0;">No functional summary available.</p>'
            +'</div>';
        }
        return '<div style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:14px 18px;margin-bottom:14px;">'
            +'<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:'+B.ink+';margin-bottom:10px;">Functional summary</div>'
            +'<p style="font-size:13px;line-height:1.65;color:'+B.ink+';margin:0;">'+esc(text)+'</p>'
        +'</div>';
    }

    /* ══════════════════════════════════════════════════════════════════════
     * CROSS-SPECIES PHENOTYPES
     * ══════════════════════════════════════════════════════════════════════ */
    function renderPhenotypes(g, raw) {
        // v5.10: clean table matching the Perturbation Matrix design language.
        // Columns: Species | Phenotype | PMID
        // (Severity/tissue heuristic deferred to future work — needs NLP on snippet text.)
        var mops  = g.phenotypes||g.model_organism_phenotypes||(raw&&raw.model_organism_phenotypes)||[];
        var mouse = g.mouse_phenotype||(raw&&raw.mouse_phenotype)||'';
        var mouseCilio = (raw&&raw.mouse_ciliopathy_phenotype)||g.mouse_ciliopathy_phenotype||'';
        var human = g.human_phenotype||(raw&&raw.human_ciliopathy_phenotype)||(raw&&raw.human_phenotype)||'';
        var mgis  = g.mgi_phenotypes||(raw&&raw.mgi_phenotypes)||[];
        var mgiUrl= g.mgi_url||(raw&&raw.mgi_url)||'';

        // Common-name lookup for display
        var COMMON = {
            'mus musculus':'mouse', 'mus':'mouse', 'mouse':'mouse',
            'danio rerio':'zebrafish', 'zebrafish':'zebrafish',
            'xenopus tropicalis':'xenopus', 'xenopus':'xenopus',
            'caenorhabditis elegans':'C. elegans', 'c. elegans':'C. elegans', 'worm':'C. elegans',
            'drosophila melanogaster':'fly', 'drosophila':'fly', 'fly':'fly',
            'chlamydomonas reinhardtii':'chlamy', 'chlamydomonas':'chlamy',
            'homo sapiens':'human', 'human':'human',
        };

        var rows = [];

        // Per-species rows from model_organism_phenotypes
        mops.forEach(function(p) {
            var sp = p.species || 'Unknown';
            var snips = toArray(p.snippets || p.phenotype_description || '', '|');
            var phenoText = snips.length ? snips.join(' · ').replace(/\s+/g, ' ').trim() : '';
            // truncate very long phenotype text
            if (phenoText.length > 240) phenoText = phenoText.substring(0, 237).trim() + '…';
            var pmids = toArray(p.pmids || '');
            var common = COMMON[sp.toLowerCase()] || '';
            var pmidLinks = pmids.slice(0, 3).map(function(id) {
                var pid = String(id).trim().replace(/[^0-9]/g, '');
                if (!pid) return '';
                return '<a href="https://pubmed.ncbi.nlm.nih.gov/'+pid+'/" target="_blank" rel="noopener" style="color:'+B.mid+';">'+pid+'</a>';
            }).filter(Boolean).join(', ');
            if (pmids.length > 3) pmidLinks += ' <span style="color:'+B.faint+';">+'+(pmids.length-3)+'</span>';
            rows.push('<tr style="border-bottom:0.5px solid '+B.divider+';">'
                +'<td style="padding:8px;"><div style="font-style:italic;font-weight:500;">'+esc(sp)+'</div>'
                    +(common?'<div style="color:'+B.faint+';font-size:11px;">'+esc(common)+'</div>':'')
                +'</td>'
                +'<td style="padding:8px;color:'+B.ink+';line-height:1.5;">'+(phenoText?esc(phenoText):'<span style="color:'+B.faint+';font-style:italic;">no description</span>')+'</td>'
                +'<td style="padding:8px;font-family:\'IBM Plex Mono\',monospace;font-size:11px;">'+(pmidLinks||'<span style="color:'+B.faint+';">—</span>')+'</td>'
            +'</tr>');
        });

        // Mouse / MGI row — separate row with phenotype + MGI link
        if (mouse || mouseCilio || mgis.length) {
            var mouseTxt = [mouse, mouseCilio].filter(Boolean).join(' · ');
            if (mouseTxt.length > 240) mouseTxt = mouseTxt.substring(0, 237).trim() + '…';
            var mgiTerms = '';
            if (mgis.length) {
                mgiTerms = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">'
                    +mgis.slice(0, 8).map(function(m){
                        return '<span style="font-size:10px;background:'+B.surface+';color:'+B.muted+';padding:2px 6px;border-radius:3px;">'+esc(m.term||'')+'</span>';
                    }).join('')
                    +(mgis.length>8?'<span style="font-size:10px;color:'+B.faint+';">+'+(mgis.length-8)+'</span>':'')
                +'</div>';
            }
            // Only add this row if we don't already have a Mouse row from mops
            var hasMouseAlready = mops.some(function(p){return /mus|mouse/i.test(p.species||'');});
            if (!hasMouseAlready && (mouseTxt || mgiTerms)) {
                rows.push('<tr style="border-bottom:0.5px solid '+B.divider+';">'
                    +'<td style="padding:8px;"><div style="font-style:italic;font-weight:500;">Mus musculus</div>'
                        +'<div style="color:'+B.faint+';font-size:11px;">mouse</div>'
                    +'</td>'
                    +'<td style="padding:8px;color:'+B.ink+';line-height:1.5;">'+(mouseTxt?esc(mouseTxt):'<span style="color:'+B.faint+';font-style:italic;">MGI terms only</span>')+mgiTerms+'</td>'
                    +'<td style="padding:8px;">'+(mgiUrl?'<a href="'+esc(mgiUrl)+'" target="_blank" rel="noopener" style="color:'+B.mid+';font-size:11px;">MGI ↗</a>':'<span style="color:'+B.faint+';">—</span>')+'</td>'
                +'</tr>');
            }
        }

        // Human row
        if (human) {
            var humanTxt = human;
            if (humanTxt.length > 240) humanTxt = humanTxt.substring(0, 237).trim() + '…';
            rows.push('<tr style="border-bottom:0.5px solid '+B.divider+';">'
                +'<td style="padding:8px;"><div style="font-style:italic;font-weight:500;">Homo sapiens</div>'
                    +'<div style="color:'+B.faint+';font-size:11px;">human</div>'
                +'</td>'
                +'<td style="padding:8px;color:'+B.ink+';line-height:1.5;">'+esc(humanTxt)+'</td>'
                +'<td style="padding:8px;color:'+B.faint+';">—</td>'
            +'</tr>');
        }

        if (!rows.length) {
            return '<div style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:14px 18px;">'
                +'<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:'+B.ink+';">Cross-species phenotypes</div>'
                +'<p style="font-size:12px;color:'+B.faint+';font-style:italic;margin:10px 0 0;">No cross-species phenotype data available.</p>'
            +'</div>';
        }

        return '<div style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:14px 18px;">'
            +'<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:'+B.ink+';margin-bottom:12px;">Cross-species phenotypes · '+rows.length+' species</div>'
            +'<table style="width:100%;font-size:12px;border-collapse:collapse;table-layout:fixed;">'
                +'<colgroup><col style="width:22%"><col style="width:58%"><col style="width:20%"></colgroup>'
                +'<thead><tr style="text-align:left;color:'+B.muted+';border-bottom:0.5px solid '+B.divider+';">'
                    +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">Species</th>'
                    +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">Phenotype</th>'
                    +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">PMID</th>'
                +'</tr></thead>'
                +'<tbody>'+rows.join('')+'</tbody>'
            +'</table>'
        +'</div>';
    }

    /* ══════════════════════════════════════════════════════════════════════
     * PHYLOGENETIC CONSERVATION
     * ══════════════════════════════════════════════════════════════════════ */
    function renderPhylogenetics(g, raw) {
        // v5.11: Real Nevers 2017 phylogeny matrix with 30 chosen species.
        // Loads /data/phylogeny/nevers_et_al_2017_matrix_optimized.json on first
        // render via window.loadPhylogeny("nevers") (cached client-side).
        // Citation: Nevers Y et al. (2017) Mol Biol Evol 34(8):2016-2034
        // DOI: 10.1093/molbev/msx146 | PMID: 28460059
        var sym = String(g.Gene || g.gene || "").toUpperCase();
        var REF_GENES = ["ZC2HC1A","CEP41","BBS1","BBS2","BBS5","ZNF474","IFT81","BBS7"];

        // 30 species (15 ciliated + 15 non-ciliated) with their Nevers indices
        var SPECIES = [{"idx": 78, "sci": "Homo sapiens", "common": "human", "ciliated": true}, {"idx": 81, "sci": "Mus musculus", "common": "mouse", "ciliated": true}, {"idx": 80, "sci": "Rattus norvegicus", "common": "rat", "ciliated": true}, {"idx": 75, "sci": "Gallus gallus", "common": "chicken", "ciliated": true}, {"idx": 73, "sci": "Xenopus tropicalis", "common": "frog", "ciliated": true}, {"idx": 72, "sci": "Danio rerio", "common": "zebrafish", "ciliated": true}, {"idx": 70, "sci": "Ciona intestinalis", "common": "tunicate", "ciliated": true}, {"idx": 67, "sci": "Strongylocentrotus purpuratus", "common": "sea urchin", "ciliated": true}, {"idx": 98, "sci": "Drosophila melanogaster", "common": "fly", "ciliated": true}, {"idx": 88, "sci": "Caenorhabditis elegans", "common": "worm", "ciliated": true}, {"idx": 10, "sci": "Chlamydomonas reinhardtii", "common": "green alga", "ciliated": true}, {"idx": 30, "sci": "Tetrahymena thermophila", "common": "ciliate", "ciliated": true}, {"idx": 28, "sci": "Paramecium tetraurelia", "common": "ciliate", "ciliated": true}, {"idx": 4, "sci": "Trypanosoma brucei", "common": "kinetoplastid", "ciliated": true}, {"idx": 1, "sci": "Giardia intestinalis", "common": "diplomonad", "ciliated": true}, {"idx": 59, "sci": "Saccharomyces cerevisiae", "common": "budding yeast", "ciliated": false}, {"idx": 53, "sci": "Schizosaccharomyces pombe", "common": "fission yeast", "ciliated": false}, {"idx": 58, "sci": "Candida albicans", "common": "yeast", "ciliated": false}, {"idx": 55, "sci": "Emericella nidulans", "common": "Aspergillus", "ciliated": false}, {"idx": 51, "sci": "Cryptococcus neoformans", "common": "yeast", "ciliated": false}, {"idx": 20, "sci": "Arabidopsis thaliana", "common": "plant", "ciliated": false}, {"idx": 18, "sci": "Sorghum bicolor", "common": "sorghum", "ciliated": false}, {"idx": 19, "sci": "Vitis vinifera", "common": "grape", "ciliated": false}, {"idx": 17, "sci": "Brachypodium distachyon", "common": "grass", "ciliated": false}, {"idx": 8, "sci": "Cyanidioschyzon merolae", "common": "red alga", "ciliated": false}, {"idx": 42, "sci": "Dictyostelium discoideum", "common": "slime mould", "ciliated": false}, {"idx": 31, "sci": "Cryptosporidium parvum", "common": "apicomplexan", "ciliated": false}, {"idx": 40, "sci": "Entamoeba histolytica", "common": "amoeba", "ciliated": false}, {"idx": 46, "sci": "Encephalitozoon cuniculi", "common": "microsporidian", "ciliated": false}, {"idx": 21, "sci": "Blastocystis hominis", "common": "stramenopile", "ciliated": false}];

        // Unique IDs so the auto-loader and download buttons find their targets
        var widgetId = "phylo_w_" + Math.floor(Math.random()*1e9).toString(36);
        var heatmapId = widgetId + "_hm";

        // Try to read cached Nevers data
        function geneProfile(geneSym) {
            try {
                var phylo = win.CiliAI && win.CiliAI._phylo && win.CiliAI._phylo.nevers;
                if (!phylo || !phylo.genes) return null;
                var rec = phylo.genes[String(geneSym).toUpperCase()];
                if (!rec) return null;
                var presentSet = {};
                (rec.s || []).forEach(function(idx){ presentSet[idx] = true; });
                return presentSet;
            } catch(e) { return null; }
        }

        function cellHtml(present, hasData) {
            if (!hasData) return '<div style="height:16px;background:'+B.surface+';border-radius:2px;border:0.5px dashed '+B.divider+';"></div>';
            var bg = present ? "#185FA5" : "#e2e8f0";
            return '<div style="height:16px;background:'+bg+';border-radius:2px;"></div>';
        }

        // Organism strip (top): green for ciliated, grey for non-ciliated
        var organismStrip = SPECIES.map(function(sp){
            var bg = sp.ciliated ? "#0F6E56" : "#B4B2A9";
            return '<div title="'+esc(sp.sci)+' · '+(sp.ciliated?"ciliated":"non-ciliated")+'" style="height:10px;background:'+bg+';border-radius:2px;"></div>';
        }).join("");

        function shortCode(sp) {
            var parts = sp.sci.split(" ");
            return (parts[0][0] + (parts[1]||"")[0]).toUpperCase();
        }

        function geneRowHtml(geneSym, isCurrent) {
            var profile = geneProfile(geneSym);
            var hasData = profile !== null;
            var cells = SPECIES.map(function(sp){
                return cellHtml(hasData && profile[sp.idx], hasData);
            }).join("");
            var labelColor = isCurrent ? B.ink : B.muted;
            var labelWeight = isCurrent ? "600" : "400";
            var rowBg = isCurrent ? B.surface : "transparent";
            var nodataLabel = !hasData ? ' <span style="color:'+B.faint+';font-size:9px;font-weight:normal;">(no data)</span>' : "";
            return '<div style="display:grid;grid-template-columns:90px 1fr;gap:8px;align-items:center;padding:4px 4px 4px 0;background:'+rowBg+';border-radius:4px;">'
                +'<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:'+labelWeight+';color:'+labelColor+';text-align:right;padding-right:8px;">'+esc(geneSym)+(isCurrent?" ←":"")+nodataLabel+'</div>'
                +'<div style="display:grid;grid-template-columns:repeat('+SPECIES.length+',1fr);gap:2px;">'+cells+'</div>'
            +'</div>';
        }

        // Gene rows: current gene first, then 8 reference genes
        var allGenes;
        if (REF_GENES.indexOf(sym) === -1) {
            allGenes = [sym].concat(REF_GENES);
        } else {
            allGenes = [sym].concat(REF_GENES.filter(function(x){return x !== sym;}));
        }
        var geneRows = allGenes.map(function(s){ return geneRowHtml(s, s === sym); }).join("");

        var speciesShortLabels = '<div style="display:grid;grid-template-columns:90px 1fr;gap:8px;margin-top:6px;">'
            +'<div></div>'
            +'<div style="display:grid;grid-template-columns:repeat('+SPECIES.length+',1fr);gap:2px;">'
                +SPECIES.map(function(sp){
                    return '<div title="'+esc(sp.sci)+'" style="font-size:9px;color:'+B.muted+';text-align:center;font-family:\'IBM Plex Mono\',monospace;cursor:help;">'+esc(shortCode(sp))+'</div>';
                }).join("")
            +'</div>'
        +'</div>';

        var fullNamesTable = '<details style="margin-top:14px;"><summary style="cursor:pointer;font-size:11px;color:'+B.mid+';padding:4px 0;list-style:none;display:flex;align-items:center;gap:6px;"><span>▸</span><span>Show full species names</span></summary>'
            +'<div style="margin-top:8px;display:grid;grid-template-columns:repeat(2,1fr);gap:4px 18px;font-size:11px;">'
                +SPECIES.map(function(sp){
                    var dotBg = sp.ciliated ? "#0F6E56" : "#B4B2A9";
                    return '<div style="display:flex;align-items:center;gap:8px;padding:3px 0;">'
                        +'<span style="width:8px;height:8px;background:'+dotBg+';border-radius:2px;display:inline-block;flex-shrink:0;"></span>'
                        +'<span style="font-family:\'IBM Plex Mono\',monospace;color:'+B.muted+';font-size:10px;min-width:24px;">'+esc(shortCode(sp))+'</span>'
                        +'<span style="font-style:italic;color:'+B.ink+';">'+esc(sp.sci)+'</span>'
                        +'<span style="color:'+B.faint+';font-size:10px;">'+esc(sp.common)+'</span>'
                    +'</div>';
                }).join("")
            +'</div></details>';

        var citation = '<div style="margin-top:14px;padding:10px 12px;background:'+B.surface+';border-radius:6px;font-size:11px;line-height:1.55;color:'+B.muted+';">'
            +'<div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:'+B.muted+';margin-bottom:4px;">Data source</div>'
            +'<div>Nevers Y, Prasad MK, Poidevin L, Chennen K, Allot A, Kress A, Ripp R, Thompson JD, Dollfus H, Poch O, Lecompte O. '
            +'<strong style="color:'+B.ink+';">Insights into Ciliary Genes and Evolution from Multi-Level Phylogenetic Profiling.</strong> '
            +'<em>Molecular Biology and Evolution</em> 34(8):2016–2034 (2017). '
            +'<a href="https://doi.org/10.1093/molbev/msx146" target="_blank" rel="noopener" style="color:'+B.mid+';">doi:10.1093/molbev/msx146</a> · '
            +'<a href="https://pubmed.ncbi.nlm.nih.gov/28460059/" target="_blank" rel="noopener" style="color:'+B.mid+';">PMID:28460059</a>'
            +'</div></div>';

        var panelInner = '<div style="display:grid;grid-template-columns:90px 1fr;gap:8px;align-items:center;margin-bottom:6px;">'
            +'<div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:'+B.muted+';text-align:right;padding-right:4px;">Organism</div>'
            +'<div style="display:grid;grid-template-columns:repeat('+SPECIES.length+',1fr);gap:2px;">'+organismStrip+'</div>'
        +'</div>'
        +'<div style="border-top:0.5px solid '+B.divider+';padding-top:6px;">'+geneRows+'</div>'
        +speciesShortLabels
        +'<div style="display:flex;gap:18px;margin-top:14px;padding-top:12px;border-top:0.5px solid '+B.divider+';font-size:11px;color:'+B.muted+';flex-wrap:wrap;">'
            +'<div style="display:flex;align-items:center;gap:14px;">'
                +'<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:'+B.muted+';">Organism</div>'
                +'<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:#0F6E56;border-radius:2px;"></span>Ciliated</span>'
                +'<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:#B4B2A9;border-radius:2px;"></span>Non-ciliated</span>'
            +'</div>'
            +'<div style="display:flex;align-items:center;gap:14px;">'
                +'<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:'+B.muted+';">Gene</div>'
                +'<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:#185FA5;border-radius:2px;"></span>Present</span>'
                +'<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:#e2e8f0;border-radius:2px;"></span>Absent</span>'
            +'</div>'
        +'</div>';

        // Auto-load Nevers data if not yet loaded, and re-render this card
        var bootScript = '<script>(function(){ '
            +'if(window.loadPhylogeny && (!window.CiliAI||!window.CiliAI._phylo||!window.CiliAI._phylo.nevers)){'
                +'window.loadPhylogeny("nevers").then(function(){'
                    +'if(window.CiliAI&&window.CiliAI.GeneCard){'
                        +'var hostEl = document.getElementById("'+widgetId+'");'
                        +'if(hostEl && hostEl.closest){'
                            +'var container = hostEl.closest("[id]");'
                            +'if(container){window.CiliAI.GeneCard.renderToContainer("'+sym+'",container.id);}'
                        +'}'
                    +'}'
                +'});'
            +'}'
            // Wire CSV button
            +'var csvBtn=document.querySelector(\'[data-phylo-csv="'+widgetId+'"]\');'
            +'if(csvBtn){csvBtn.addEventListener("click",function(){'
                +'var phylo=window.CiliAI&&window.CiliAI._phylo&&window.CiliAI._phylo.nevers;'
                +'if(!phylo){alert("Nevers data still loading. Try again in a moment.");return;}'
                +'var SP='+JSON.stringify(SPECIES)+';'
                +'var GS='+JSON.stringify(allGenes)+';'
                +'var lines=["gene,"+SP.map(function(s){return s.sci;}).join(",")];'
                +'lines.push("organism_ciliated,"+SP.map(function(s){return s.ciliated?1:0;}).join(","));'
                +'GS.forEach(function(g){'
                    +'var r=phylo.genes[String(g).toUpperCase()];'
                    +'var set={};if(r){(r.s||[]).forEach(function(i){set[i]=1;});}'
                    +'lines.push(g+","+SP.map(function(s){return set[s.idx]?1:0;}).join(","));'
                +'});'
                +'var blob=new Blob([lines.join("\\n")],{type:"text/csv"});'
                +'var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="phylogeny_'+sym+'.csv";a.click();'
            +'});}'
            // Wire SVG button
            +'var svgBtn=document.querySelector(\'[data-phylo-svg="'+widgetId+'"]\');'
            +'if(svgBtn){svgBtn.addEventListener("click",function(){'
                +'var el=document.getElementById("'+heatmapId+'");'
                +'if(!el){alert("Widget not rendered yet.");return;}'
                +'var w=el.offsetWidth||720, h=el.offsetHeight||400;'
                +'var clone=el.cloneNode(true);'
                +'var html = new XMLSerializer().serializeToString(clone);'
                +'var svg=\'<svg xmlns="http://www.w3.org/2000/svg" width="\'+w+\'" height="\'+h+\'"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:sans-serif;">\'+html+\'</div></foreignObject></svg>\';'
                +'var blob=new Blob([svg],{type:"image/svg+xml"});'
                +'var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="phylogeny_'+sym+'.svg";a.click();'
            +'});}'
        +'})();</'+'script>';

        return '<div id="'+widgetId+'" style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:14px 18px;margin-bottom:14px;">'
            +'<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;gap:12px;flex-wrap:wrap;">'
                +'<div>'
                    +'<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:'+B.ink+';">Phylogenetic conservation · '+SPECIES.length+' species</div>'
                    +'<div style="font-size:11px;color:'+B.faint+';margin-top:3px;">'+esc(sym)+' compared against 8 reference ciliary genes · Nevers 2017</div>'
                +'</div>'
                +'<div style="display:flex;gap:6px;">'
                    +'<button data-phylo-csv="'+widgetId+'" style="font-size:11px;padding:4px 10px;border:0.5px solid '+B.divider+';border-radius:4px;background:transparent;color:'+B.muted+';cursor:pointer;white-space:nowrap;">↓ CSV</button>'
                    +'<button data-phylo-svg="'+widgetId+'" style="font-size:11px;padding:4px 10px;border:0.5px solid '+B.divider+';border-radius:4px;background:transparent;color:'+B.muted+';cursor:pointer;white-space:nowrap;">↓ SVG</button>'
                +'</div>'
            +'</div>'
            +'<div id="'+heatmapId+'">'+panelInner+'</div>'
            +fullNamesTable
            +citation
            /* bootScript removed: <script> in innerHTML doesn't run. Nevers preload happens in renderToContainer instead. v5.11 */
        +'</div>';
    }



    /* ══════════════════════════════════════════════════════════════════════
     * scRNA-seq EXPRESSION
     * ══════════════════════════════════════════════════════════════════════ */
    /* ──────────────────────────────────────────────────────────────────
     * scRNA-seq tissue UMAP — popup display
     * On a page with the native plotter (CiliAI), render inline. Elsewhere
     * (home explorer, phenotype, etc.) open a modal whose iframe loads the
     * CiliAI plot view in embed mode (chrome hidden, plot only).
     * ────────────────────────────────────────────────────────────────── */
    window.openTissueUMAP = function (sym, tissue) {
        sym = String(sym || '').toUpperCase();
        if (window.CiliAI) { window.CiliAI.activeGeneContext = sym; window.CiliAI.activeDataset = tissue; }
        if (typeof window.renderUMAPPlot === 'function') {
            if (typeof window.switchView === 'function') { try { window.switchView('plot', sym); } catch (e) {} }
            window.renderUMAPPlot(sym, [sym]);
            return;
        }
        var labels = {retina:'Retina',cerebellum:'Cerebellum',hypothalamus:'Hypothalamus',olfactory_neurons:'Olfactory neurons',choroid_plexus:'Choroid plexus',lung:'Lung',liver:'Liver',pancreas:'Pancreas',chondrocyte:'Chondrocyte',limb_bud:'Limb bud'};
        var ov = document.getElementById('ch-umap-modal');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'ch-umap-modal';
            ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(10,31,61,.55);display:none;align-items:center;justify-content:center;padding:20px;';
            ov.innerHTML =
                '<div style="background:#fff;border-radius:14px;width:min(960px,96vw);height:min(720px,92vh);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.45);">'
              +   '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #e6edf5;background:#f8fafc;">'
              +     '<div id="ch-umap-title" style="font-weight:700;color:#00406d;font-size:15px;"></div>'
              +     '<div style="display:flex;align-items:center;gap:14px;">'
              +       '<a id="ch-umap-open" href="#" target="_blank" rel="noopener" style="font-size:12px;color:#005b96;text-decoration:none;">Open full page \u2197</a>'
              +       '<button id="ch-umap-close" aria-label="Close" style="border:none;background:#eef2f7;border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:18px;color:#475569;line-height:1;">\u00d7</button>'
              +     '</div>'
              +   '</div>'
              +   '<iframe id="ch-umap-frame" title="scRNA-seq UMAP" style="border:0;flex:1;width:100%;background:#fff;"></iframe>'
              + '</div>';
            document.body.appendChild(ov);
            var closeModal = function () { ov.style.display = 'none'; var fr = document.getElementById('ch-umap-frame'); if (fr) fr.src = 'about:blank'; };
            ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
            document.getElementById('ch-umap-close').addEventListener('click', closeModal);
            document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov.style.display !== 'none') closeModal(); });
        }
        var url = '/ciliai.html?gene=' + encodeURIComponent(sym) + '&tissue=' + encodeURIComponent(tissue) + '&embed=1';
        document.getElementById('ch-umap-title').textContent = sym + ' \u00b7 ' + (labels[tissue] || tissue) + ' \u2014 scRNA-seq UMAP';
        document.getElementById('ch-umap-open').href = url;
        document.getElementById('ch-umap-frame').src = url;
        ov.style.display = 'flex';
    };

    function renderScRNA(g, raw) {
        // v5.11: read from window.CiliAI.datasets (where data.js caches per-tissue
        // expression data after loadTissue is called). For each tissue, check if 
        // the gene appears in the loaded dataset; if not loaded yet, show 'not 
        // loaded — view UMAP' CTA.
        var sym = String(g.Gene||g.gene||'').toUpperCase();
        var symEsc = esc(sym);

        var TISSUES = [
            {key:'retina',            label:'Retina'},
            {key:'cerebellum',        label:'Cerebellum'},
            {key:'hypothalamus',      label:'Hypothalamus'},
            {key:'olfactory_neurons', label:'Olfactory neurons'},
            {key:'choroid_plexus',    label:'Choroid plexus'},
            {key:'lung',              label:'Lung'},
            {key:'liver',             label:'Liver'},
            {key:'pancreas',          label:'Pancreas'},
            {key:'chondrocyte',       label:'Chondrocyte'},
            {key:'limb_bud',          label:'Limb bud'},
        ];

        var CA = win.CiliAI || {};
        var datasets = CA.datasets || {};

        function tissueState(tKey) {
            var ds = datasets[tKey];
            if (!ds || !ds._loaded) return {state:'not_loaded', value:null};
            // gene present in expression dict?
            var expr = ds.expression || {};
            // gene symbol case-insensitive
            var hit = expr[sym] || expr[sym.toLowerCase()] || expr[sym.toUpperCase()];
            if (hit == null) {
                // Some tissues store as nested arrays — try .genes
                if (ds.genes && (ds.genes[sym] != null)) hit = ds.genes[sym];
            }
            if (hit == null) return {state:'absent', value:null};
            // compute mean if array
            if (Array.isArray(hit)) {
                var nonzero = hit.filter(function(x){return x > 0;});
                var meanVal = nonzero.length ? (nonzero.reduce(function(a,b){return a+b;}, 0) / nonzero.length) : 0;
                return {state:'present', value:meanVal, ncells:nonzero.length, total:hit.length};
            }
            return {state:'present', value:parseFloat(hit) || 0};
        }

        // Helper for expression cell colour
        function expColour(v) {
            if (v === null || v === undefined) return B.surface;
            var c = Math.min(1, Math.max(0, v));
            if (c >= 0.7) return '#185FA5';
            if (c >= 0.4) return '#378ADD';
            if (c >= 0.15) return '#85B7EB';
            if (c > 0) return '#E6F1FB';
            return B.surface;
        }

        // Build rows — sorted: loaded with value first, then loaded without, then not loaded
        var rows = TISSUES.map(function(t){
            var st = tissueState(t.key);
            var clickHandler = 'window.openTissueUMAP(\''+sym+'\',\''+t.key+'\')';

            var cellHtml, valueHtml;
            if (st.state === 'present') {
                var bg = expColour(st.value);
                cellHtml = '<div style="height:18px;background:'+bg+';border-radius:3px;"></div>';
                valueHtml = '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:'+B.muted+';">'+(st.value!=null?st.value.toFixed(2):'—')+'</span>'
                    +(st.ncells!=null?'<div style="font-size:9px;color:'+B.faint+';">'+st.ncells+'/'+st.total+' cells</div>':'');
            } else if (st.state === 'absent') {
                cellHtml = '<div style="height:18px;background:'+B.surface+';border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:10px;color:'+B.faint+';">absent</div>';
                valueHtml = '<span style="color:'+B.faint+';font-size:11px;">—</span>';
            } else {
                // not_loaded
                cellHtml = '<div style="height:18px;background:'+B.surface+';border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:10px;color:'+B.faint+';font-style:italic;">click to load ↗</div>';
                valueHtml = '<span style="color:'+B.faint+';font-size:11px;">—</span>';
            }
            var rowStyle = st.state === 'present'
                ? 'cursor:pointer;background:'+B.white+';'
                : 'cursor:pointer;';
            return '<tr style="border-bottom:0.5px solid '+B.divider+';'+rowStyle+'" onclick="'+clickHandler+'" title="Open '+esc(t.label)+' UMAP for '+symEsc+'">'
                +'<td style="padding:6px 8px;font-weight:500;color:'+B.ink+';">'+esc(t.label)+'</td>'
                +'<td style="padding:6px 8px;">'+cellHtml+'</td>'
                +'<td style="padding:6px 8px;text-align:right;">'+valueHtml+'</td>'
            +'</tr>';
        }).join('');

        var anyLoaded = TISSUES.some(function(t){return tissueState(t.key).state !== 'not_loaded';});

        return '<div style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:14px 18px;margin-bottom:14px;">'
            +'<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;gap:12px;flex-wrap:wrap;">'
                +'<div>'
                    +'<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:'+B.ink+';">scRNA-seq expression · '+TISSUES.length+' tissues</div>'
                    +'<div style="font-size:11px;color:'+B.faint+';margin-top:3px;">'+(anyLoaded?'Click any row to view tissue UMAP':'Click any tissue row to load and view its expression UMAP')+'</div>'
                +'</div>'
            +'</div>'
            +'<table style="width:100%;font-size:12px;border-collapse:collapse;table-layout:fixed;">'
                +'<colgroup><col style="width:32%"><col style="width:48%"><col style="width:20%"></colgroup>'
                +'<thead><tr style="text-align:left;color:'+B.muted+';border-bottom:0.5px solid '+B.divider+';">'
                    +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">Tissue</th>'
                    +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">Expression</th>'
                    +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;text-align:right;">Mean value</th>'
                +'</tr></thead>'
                +'<tbody>'+rows+'</tbody>'
            +'</table>'
            +'<div style="display:flex;gap:14px;margin-top:12px;padding-top:10px;border-top:0.5px solid '+B.divider+';font-size:11px;color:'+B.muted+';align-items:center;flex-wrap:wrap;">'
                +'<span style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:'+B.muted+';">Expression</span>'
                +'<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:#185FA5;border-radius:2px;"></span>High</span>'
                +'<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:#378ADD;border-radius:2px;"></span>Medium</span>'
                +'<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:#85B7EB;border-radius:2px;"></span>Low</span>'
                +'<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:#E6F1FB;border-radius:2px;"></span>Trace</span>'
                +'<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:'+B.surface+';border-radius:2px;"></span>None / not loaded</span>'
            +'</div>'
        +'</div>';
    }



    /* ══════════════════════════════════════════════════════════════════════
     * PROTEIN DOMAINS + CLINVAR
     * ══════════════════════════════════════════════════════════════════════ */
    function renderDomains(g, raw) {
        // v5.11: SINGLE combined section — Pfam Domains + ClinVar variants.
        // Protein backbone is BLACK (non-Pfam regions visible). Pfam domains 
        // are blue blocks overlaid on the backbone. ClinVar variants are 
        // small lollipop markers ABOVE the backbone, positioned by aa coord.
        var domains = g.pfam_domains||(raw&&raw.pfam_domains)||[];
        var variants = g.clinvar_variants||(raw&&raw.clinvar_variants)||[];
        if (!Array.isArray(domains)) domains = [];
        if (!Array.isArray(variants)) variants = [];
        if (!domains.length && !variants.length) return '';

        var sym = String(g.Gene || g.gene || '').toUpperCase();

        // Determine protein length: max end position across domains AND variants
        var maxEnd = 0;
        domains.forEach(function(d){
            (d.locations || (d.start ? [{start:d.start,end:d.end}] : [])).forEach(function(l){
                var e = parseInt(l.end||0)||0;
                if (e > maxEnd) maxEnd = e;
            });
        });
        // Parse aa position from variant title (e.g. "p.Val366fs" → 366)
        function parseAa(title) {
            if (!title) return null;
            var m = String(title).match(/p\.[A-Za-z]+(\d+)/);
            return m ? parseInt(m[1], 10) : null;
        }
        variants = variants.map(function(v){
            return Object.assign({}, v, {_aa: parseAa(v.title)});
        });
        variants.forEach(function(v){if(v._aa&&v._aa>maxEnd)maxEnd=v._aa;});
        var totalLen = maxEnd || 500;

        // Variant significance → pill colour
        function sigPill(sig) {
            // 3-category mapping: Pathogenic / Benign / VUS (default for everything else)
            var s = String(sig||'').toLowerCase();
            var bg, fg, label;
            if (s.indexOf('pathogenic')!==-1) { bg='#FCEBEB'; fg='#A32D2D'; label=sig; }
            else if (s.indexOf('benign')!==-1) { bg='#E1F5EE'; fg='#0F6E56'; label=sig; }
            else if (sig) { bg='#FAEEDA'; fg='#854F0B'; label=sig; }
            else { return '<span style="font-size:11px;padding:3px 9px;background:#FAEEDA;color:#854F0B;border-radius:999px;font-weight:500;">VUS</span>'; }
            return '<span style="font-size:11px;padding:3px 9px;background:'+bg+';color:'+fg+';border-radius:999px;font-weight:500;">'+esc(label)+'</span>';
        }

        // ───────── Build the protein-length bar with overlaid variants ─────────
        // Pixel viewBox (1000 wide) so circles stay round. The SVG scales 
        // proportionally; vertical space is reserved for lollipops above.
        var SVG_W = 1000;
        var BAR_Y = 95;       // y position of the backbone
        var BAR_H = 22;       // height of domain blocks
        var BACKBONE_H = 4;   // black backbone line thickness
        var SVG_H = 145;      // total height (lollipops above + bar + axis below)
        function pxX(aa) { return (aa / totalLen) * SVG_W; }

        // STRICT 3-category classifier — Pathogenic / Benign / VUS (everything else)
        function classifyVariant(sig) {
            var s = String(sig||'').toLowerCase();
            if (s.indexOf('pathogenic') !== -1) {
                return {cat:'Pathogenic', fill:'#A32D2D', stroke:'#791F1F', textBg:'#FCEBEB', textFg:'#A32D2D'};
            }
            if (s.indexOf('benign') !== -1) {
                return {cat:'Benign',     fill:'#0F6E56', stroke:'#085041', textBg:'#E1F5EE', textFg:'#0F6E56'};
            }
            return {cat:'VUS',            fill:'#BA7517', stroke:'#854F0B', textBg:'#FAEEDA', textFg:'#854F0B'};
        }

        var svgParts = [];

        // 1. Black backbone line (non-Pfam protein regions visible as black)
        svgParts.push('<rect x="0" y="'+(BAR_Y + BAR_H/2 - BACKBONE_H/2)+'" width="'+SVG_W+'" height="'+BACKBONE_H+'" fill="'+B.ink+'" rx="2"/>');

        // 2. Pfam domain blocks (blue, overlaid on backbone)
        domains.forEach(function(d){
            var locs = d.locations || (d.start ? [{start:d.start,end:d.end}] : []);
            var name = d.name || d.pfam_id || '';
            locs.forEach(function(loc){
                var x = pxX(loc.start||0);
                var w = pxX((loc.end||0) - (loc.start||0));
                if (w < 6) w = 6;
                svgParts.push('<rect x="'+x.toFixed(1)+'" y="'+BAR_Y+'" width="'+w.toFixed(1)+'" height="'+BAR_H+'" rx="4" fill="#185FA5" stroke="#0C447C" stroke-width="0.5"><title>'+esc(name)+' ('+loc.start+'–'+loc.end+' aa)</title></rect>');
                // domain name label inside if width permits
                if (w > 80) {
                    var lbl = name.length > 22 ? name.substring(0,20)+'…' : name;
                    svgParts.push('<text x="'+(x+w/2).toFixed(1)+'" y="'+(BAR_Y+BAR_H/2+4)+'" font-size="11" fill="white" text-anchor="middle" font-family="\'IBM Plex Sans\',sans-serif" font-weight="500">'+esc(lbl)+'</text>');
                }
            });
        });

        // 3. ClinVar variant lollipops above the bar
        // Stagger heights so overlapping markers stack vertically.
        var sortedV = variants.filter(function(v){return v._aa;}).sort(function(a,b){return a._aa-b._aa;});
        var occupied = []; // [{x, headY}]
        var RADIUS = 7;
        var ROW_H = 18;
        var MIN_GAP_X = 14;
        sortedV.forEach(function(v){
            var x = pxX(v._aa);
            // Find first vertical slot from top where this circle won't collide
            var slot = 0;
            while (true) {
                var headY = BAR_Y - 18 - slot * ROW_H;
                var collides = occupied.some(function(o){
                    return Math.abs(o.x - x) < MIN_GAP_X && o.slot === slot;
                });
                if (!collides) {
                    occupied.push({x:x, slot:slot, headY:headY});
                    break;
                }
                slot++;
                if (slot > 4) { // cap at 5 rows
                    occupied.push({x:x, slot:slot, headY: BAR_Y - 18 - slot * ROW_H});
                    break;
                }
            }
            var s = occupied[occupied.length-1];
            var headY = Math.max(12, s.headY);
            var cls = classifyVariant(v.significance);
            var url = v.url || (v.id ? 'https://www.ncbi.nlm.nih.gov/clinvar/variation/'+v.id+'/' : '');
            var hgvs = (v.title||'').replace(/^NM_\d+\.\d+\([^)]+\):/, '');
            // Marker: stem + white halo + filled circle with single letter
            var letter = cls.cat[0];
            var content = '<line x1="'+x.toFixed(1)+'" y1="'+(headY+RADIUS)+'" x2="'+x.toFixed(1)+'" y2="'+BAR_Y+'" stroke="'+cls.stroke+'" stroke-width="1.5" stroke-opacity="0.7"/>'
                +'<circle cx="'+x.toFixed(1)+'" cy="'+headY+'" r="'+(RADIUS+1.5)+'" fill="white"/>'
                +'<circle cx="'+x.toFixed(1)+'" cy="'+headY+'" r="'+RADIUS+'" fill="'+cls.fill+'" stroke="'+cls.stroke+'" stroke-width="1.2"><title>'+esc(hgvs)+' — '+cls.cat+(v.significance?' ('+esc(v.significance)+')':'')+'</title></circle>'
                +'<text x="'+x.toFixed(1)+'" y="'+(headY+3.5)+'" font-size="9" fill="white" text-anchor="middle" font-family="\'IBM Plex Sans\',sans-serif" font-weight="700" pointer-events="none">'+letter+'</text>';
            if (url) {
                svgParts.push('<a href="'+esc(url)+'" target="_blank" rel="noopener" style="cursor:pointer;">'+content+'</a>');
            } else {
                svgParts.push(content);
            }
        });

        // 4. aa position labels at bottom
        svgParts.push('<text x="0" y="'+(SVG_H-6)+'" font-size="11" fill="'+B.muted+'" font-family="\'IBM Plex Mono\',monospace">1 aa</text>');
        svgParts.push('<text x="'+(SVG_W/2)+'" y="'+(SVG_H-6)+'" font-size="11" fill="'+B.muted+'" font-family="\'IBM Plex Mono\',monospace" text-anchor="middle">'+Math.round(totalLen/2)+' aa</text>');
        svgParts.push('<text x="'+SVG_W+'" y="'+(SVG_H-6)+'" font-size="11" fill="'+B.muted+'" font-family="\'IBM Plex Mono\',monospace" text-anchor="end">'+totalLen+' aa</text>');

        // Pixel-accurate viewBox keeps circles round when CSS resizes the SVG
        var svg = '<svg viewBox="0 0 '+SVG_W+' '+SVG_H+'" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;overflow:visible;" role="img" aria-label="Protein domain architecture with ClinVar variants classified as Pathogenic, Benign, or VUS">'+svgParts.join('')+'</svg>';

        // ───────── Domains table ─────────
        var domTable = '';
        if (domains.length) {
            var domRows = domains.map(function(d){
                var locs = d.locations || (d.start ? [{start:d.start,end:d.end}] : []);
                var nm = d.name || '';
                var pid = d.pfam_id || '';
                var posStr = locs.map(function(l){return l.start+'–'+l.end;}).join(', ');
                var lenStr = locs.reduce(function(acc,l){return acc + (l.end-l.start+1);}, 0) + ' aa';
                var pidLink = pid
                    ? '<a href="https://www.ebi.ac.uk/interpro/entry/pfam/'+esc(pid)+'/" target="_blank" rel="noopener" style="color:'+B.mid+';font-family:\'IBM Plex Mono\',monospace;font-weight:500;">'+esc(pid)+'</a>'
                    : '<span style="color:'+B.faint+';">—</span>';
                return '<tr style="border-bottom:0.5px solid '+B.divider+';">'
                    +'<td style="padding:8px;">'+pidLink+'</td>'
                    +'<td style="padding:8px;color:'+B.ink+';">'+esc(nm)+'</td>'
                    +'<td style="padding:8px;font-family:\'IBM Plex Mono\',monospace;color:'+B.muted+';font-size:11px;">'+esc(posStr)+'</td>'
                    +'<td style="padding:8px;font-family:\'IBM Plex Mono\',monospace;color:'+B.muted+';font-size:11px;text-align:right;">'+esc(lenStr)+'</td>'
                +'</tr>';
            }).join('');
            domTable = '<div style="margin-top:14px;">'
                +'<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:'+B.muted+';margin-bottom:8px;">Pfam domain table</div>'
                +'<table style="width:100%;font-size:12px;border-collapse:collapse;table-layout:fixed;">'
                    +'<colgroup><col style="width:18%"><col style="width:42%"><col style="width:24%"><col style="width:16%"></colgroup>'
                    +'<thead><tr style="text-align:left;color:'+B.muted+';border-bottom:0.5px solid '+B.divider+';">'
                        +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">Pfam ID</th>'
                        +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">Name</th>'
                        +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">Position</th>'
                        +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;text-align:right;">Length</th>'
                    +'</tr></thead>'
                    +'<tbody>'+domRows+'</tbody>'
                +'</table>'
            +'</div>';
        }

        // ───────── Variants table ─────────
        var varTable = '';
        if (variants.length) {
            var nPath=0, nBenign=0, nVUS=0;
            variants.forEach(function(v){
                var sig = (v.significance||'').toLowerCase();
                if (sig.indexOf('pathogenic')!==-1) nPath++;
                else if (sig.indexOf('benign')!==-1) nBenign++;
                else nVUS++;
            });
            var sumParts = [];
            sumParts.push('<span style="color:'+B.ink+';"><strong style="color:#A32D2D;">'+nPath+'</strong> Pathogenic</span>');
            sumParts.push('<span style="color:'+B.ink+';"><strong style="color:#BA7517;">'+nVUS+'</strong> VUS</span>');
            sumParts.push('<span style="color:'+B.ink+';"><strong style="color:#0F6E56;">'+nBenign+'</strong> Benign</span>');

            var top5 = variants.slice(0, 5);
            var varRows = top5.map(function(v) {
                var hgvs = (v.title||'').replace(/^NM_\d+\.\d+\([^)]+\):/, '');
                if (hgvs.length > 70) hgvs = hgvs.substring(0, 67) + '…';
                var url = v.url || (v.id ? 'https://www.ncbi.nlm.nih.gov/clinvar/variation/'+v.id+'/' : '');
                return '<tr style="border-bottom:0.5px solid '+B.divider+';">'
                    +'<td style="padding:8px;font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:'+B.muted+';">'+esc(v.id||'')+'</td>'
                    +'<td style="padding:8px;color:'+B.ink+';line-height:1.5;font-size:11px;">'+esc(hgvs)+'</td>'
                    +'<td style="padding:8px;">'+sigPill(v.significance)+'</td>'
                    +'<td style="padding:8px;color:'+B.muted+';font-size:11px;">'+esc(v.review_status||'—')+'</td>'
                    +'<td style="padding:8px;text-align:right;">'+(url?'<a href="'+esc(url)+'" target="_blank" rel="noopener" style="color:'+B.mid+';font-size:13px;">↗</a>':'<span style="color:'+B.faint+';">—</span>')+'</td>'
                +'</tr>';
            }).join('');

            varTable = '<div style="margin-top:18px;padding-top:14px;border-top:0.5px solid '+B.divider+';">'
                +'<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px;gap:12px;flex-wrap:wrap;">'
                    +'<div>'
                        +'<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:'+B.muted+';">ClinVar variants · '+variants.length+' reported</div>'
                        +'<div style="font-size:11px;color:'+B.faint+';margin-top:2px;">Showing top '+top5.length+' by review status</div>'
                    +'</div>'
                    +(sumParts.length?'<div style="display:flex;gap:14px;font-size:11px;">'+sumParts.join('')+'</div>':'')
                +'</div>'
                +'<table style="width:100%;font-size:12px;border-collapse:collapse;table-layout:fixed;">'
                    +'<colgroup><col style="width:14%"><col style="width:40%"><col style="width:20%"><col style="width:18%"><col style="width:8%"></colgroup>'
                    +'<thead><tr style="text-align:left;color:'+B.muted+';border-bottom:0.5px solid '+B.divider+';">'
                        +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">ClinVar ID</th>'
                        +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">Variant</th>'
                        +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">Significance</th>'
                        +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">Review</th>'
                        +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;text-align:right;">Link</th>'
                    +'</tr></thead>'
                    +'<tbody>'+varRows+'</tbody>'
                +'</table>'
                +(variants.length>5 ? '<div style="margin-top:8px;text-align:right;font-size:11px;"><a href="https://www.ncbi.nlm.nih.gov/clinvar/?term='+encodeURIComponent(sym+'[gene]')+'" target="_blank" rel="noopener" style="color:'+B.mid+';">View all '+variants.length+' variants on ClinVar →</a></div>' : '')
            +'</div>';
        }

        // ───────── Legend (variant marker colours) ─────────
        function legendDot(letter, fill) {
            return '<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:'+fill+';color:white;font-size:10px;font-weight:700;font-family:\'IBM Plex Sans\',sans-serif;">'+letter+'</span>';
        }
        var variantLegend = variants.length
            ? '<div style="display:flex;gap:14px;margin-top:12px;font-size:11px;color:'+B.ink+';align-items:center;flex-wrap:wrap;">'
                +'<span style="text-transform:uppercase;letter-spacing:.08em;color:'+B.muted+';font-size:10px;font-weight:600;">Variant categories</span>'
                +'<span style="display:flex;align-items:center;gap:5px;">'+legendDot('P','#A32D2D')+'<strong style="color:#A32D2D;">Pathogenic</strong></span>'
                +'<span style="display:flex;align-items:center;gap:5px;">'+legendDot('V','#BA7517')+'<strong style="color:#BA7517;">VUS</strong></span>'
                +'<span style="display:flex;align-items:center;gap:5px;">'+legendDot('B','#0F6E56')+'<strong style="color:#0F6E56;">Benign</strong></span>'
            +'</div>'
            : '';

        // ───────── Compose ─────────
        var title = domains.length && variants.length ? 'Pfam domains & ClinVar variants'
                  : domains.length ? 'Pfam domains'
                  : 'ClinVar variants';
        var subtitle = domains.length && variants.length 
            ? domains.length+' domain'+(domains.length>1?'s':'')+' · '+variants.length+' ClinVar variant'+(variants.length>1?'s':'')+' on the protein backbone'
            : '';

        return '<div style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:14px 18px;margin-bottom:14px;">'
            +'<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:'+B.ink+';">'+title+'</div>'
            +(subtitle?'<div style="font-size:11px;color:'+B.faint+';margin-top:3px;margin-bottom:10px;">'+subtitle+'</div>':'<div style="margin-bottom:10px;"></div>')
            +'<div style="position:relative;background:'+B.surface+';border-radius:6px;padding:8px 12px;">'+svg+'</div>'
            +variantLegend
            +domTable
            +varTable
        +'</div>';
    }



    /* ══════════════════════════════════════════════════════════════════════
     * PROTEIN COMPLEXES
     * ══════════════════════════════════════════════════════════════════════ */
    function renderComplex(g, raw) {
        // v5.10: flat-white card with table of complexes.
        // Data: protein_complex = "Complex A; Complex B" (semicolon list).
        //       complex_subunits = "Subunit 1;Subunit 2; Subunit 3" (semicolon list, may have a leading group separator).
        // The two fields aren't structurally linked — we list complexes as rows
        // and show a flat list of subunits as a sub-cell.
        var rawStr = g.Complex || g.protein_complex || (raw&&raw.protein_complex) || '';
        var subsStr = g.complex_subunits || (raw&&raw.complex_subunits) || '';
        var complexes = String(rawStr).split(/[;]/).map(function(x){return x.trim();}).filter(Boolean);
        if (!complexes.length) return '';

        // Parse subunits: may be in groups separated by '; ' (note the space)
        // or all in one block. We just split by ';' and dedupe.
        var subunits = String(subsStr).split(/[;]/).map(function(x){return x.trim();}).filter(Boolean);
        var subunitSet = {};
        subunits.forEach(function(s){subunitSet[s.toLowerCase()] = s;});
        subunits = Object.values(subunitSet);

        // First 8 subunits as chips below the table
        var subunitChips = subunits.length
            ? '<div style="margin-top:12px;padding-top:10px;border-top:0.5px solid '+B.divider+';">'
                +'<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:'+B.faint+';margin-bottom:6px;">Reported subunits ('+subunits.length+')</div>'
                +'<div style="display:flex;flex-wrap:wrap;gap:5px;">'
                    +subunits.slice(0, 12).map(function(s){
                        return '<span style="font-size:11px;padding:3px 8px;background:'+B.surface+';color:'+B.muted+';border-radius:4px;">'+esc(s)+'</span>';
                    }).join('')
                    +(subunits.length>12?'<span style="font-size:11px;padding:3px 8px;color:'+B.faint+';">+'+(subunits.length-12)+' more</span>':'')
                +'</div>'
            +'</div>'
            : '';

        var rows = complexes.map(function(cx){
            var url = 'https://mips.helmholtz-muenchen.de/corum/#?su='+encodeURIComponent(cx);
            return '<tr style="border-bottom:0.5px solid '+B.divider+';">'
                +'<td style="padding:8px;font-weight:500;color:'+B.ink+';">'+esc(cx)+'</td>'
                +'<td style="padding:8px;text-align:right;"><a href="'+esc(url)+'" target="_blank" rel="noopener" style="color:'+B.mid+';font-size:11px;">CORUM ↗</a></td>'
            +'</tr>';
        }).join('');

        return '<div style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:14px 18px;margin-bottom:14px;">'
            +'<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:'+B.ink+';margin-bottom:12px;">Protein complex · '+complexes.length+' complex'+(complexes.length>1?'es':'')+'</div>'
            +'<table style="width:100%;font-size:12px;border-collapse:collapse;table-layout:fixed;">'
                +'<colgroup><col style="width:82%"><col style="width:18%"></colgroup>'
                +'<thead><tr style="text-align:left;color:'+B.muted+';border-bottom:0.5px solid '+B.divider+';">'
                    +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">Complex name</th>'
                    +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;text-align:right;">Source</th>'
                +'</tr></thead>'
                +'<tbody>'+rows+'</tbody>'
            +'</table>'
            +subunitChips
        +'</div>';
    }


    /* ══════════════════════════════════════════════════════════════════════
     * STRING PPI
     * ══════════════════════════════════════════════════════════════════════ */
    function renderSTRING(g, raw) {
        // v5.10: flat-white card. STRING interactions data is typically not 
        // present in master JSON yet; show a clean stub with a link to STRING.
        var sym = esc(g.Gene||g.gene||(raw&&raw.gene)||'');
        var sd = g.string_interactions || g.string_ppi || g.ppi || null;
        if (!sd && win.CiliAI && win.CiliAI.data && win.CiliAI.data.string)
            sd = win.CiliAI.data.string[g.Gene||g.gene||''] || null;

        var stringUrl = 'https://string-db.org/network/'+encodeURIComponent(sym);

        // Helper for a card-style return
        function wrap(inner) {
            return '<div style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:14px 18px;margin-bottom:14px;">'
                +'<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;gap:12px;">'
                    +'<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:'+B.ink+';">STRING interactions</div>'
                    +'<a href="'+stringUrl+'" target="_blank" rel="noopener" style="font-size:11px;color:'+B.mid+';white-space:nowrap;">View network on STRING ↗</a>'
                +'</div>'+inner+'</div>';
        }

        if (!sd) {
            return wrap('<p style="font-size:12px;color:'+B.faint+';font-style:italic;margin:0;line-height:1.6;">'
                +'STRING interaction data not yet integrated for '+sym+'. Click the link above to view the live interaction network on STRING.'
            +'</p>');
        }

        var ints = Array.isArray(sd) ? sd : (sd.interactions || sd.partners || Object.values(sd));
        if (!Array.isArray(ints) || !ints.length) {
            return wrap('<p style="font-size:12px;color:'+B.faint+';font-style:italic;margin:0;">No interactions found.</p>');
        }

        // Sort by combined score, top 10
        ints = ints.slice().sort(function(a,b){
            return parseFloat(b.combined_score||b.score||0) - parseFloat(a.combined_score||a.score||0);
        }).slice(0, 10);

        function fmtScore(s) {
            var v = parseFloat(s)||0;
            if (v > 1) v /= 1000;
            return v.toFixed(3);
        }
        function scoreBar(s) {
            var v = parseFloat(s)||0;
            if (v > 1) v /= 1000;
            var pct = Math.min(100, v*100);
            var col = v >= 0.9 ? '#185FA5' : v >= 0.7 ? '#378ADD' : v >= 0.4 ? '#85B7EB' : '#B5D4F4';
            return '<div style="display:flex;align-items:center;gap:8px;">'
                +'<div style="flex:1;height:6px;background:'+B.surface+';border-radius:3px;overflow:hidden;">'
                    +'<div style="width:'+pct.toFixed(0)+'%;height:100%;background:'+col+';"></div>'
                +'</div>'
                +'<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:'+B.muted+';">'+fmtScore(s)+'</span>'
            +'</div>';
        }

        // Evidence tags
        function evidenceTags(i) {
            var tags = [];
            if (parseFloat(i.experimental||0) > 0) tags.push('<span style="padding:2px 5px;background:#e6f1fb;color:#185fa5;border-radius:3px;font-size:10px;font-weight:500;">EXP</span>');
            if (parseFloat(i.coexpression||0) > 0) tags.push('<span style="padding:2px 5px;background:'+B.surface+';color:'+B.muted+';border-radius:3px;font-size:10px;">CO</span>');
            if (parseFloat(i.database||0) > 0)     tags.push('<span style="padding:2px 5px;background:'+B.surface+';color:'+B.muted+';border-radius:3px;font-size:10px;">DB</span>');
            if (parseFloat(i.textmining||0) > 0)   tags.push('<span style="padding:2px 5px;background:'+B.surface+';color:'+B.muted+';border-radius:3px;font-size:10px;">TM</span>');
            return tags.join(' ');
        }

        var rows = ints.map(function(i){
            var p = esc(i.partner||i.gene_b||i.interactor||'—');
            return '<tr style="border-bottom:0.5px solid '+B.divider+';">'
                +'<td style="padding:8px;"><a href="https://string-db.org/network/'+encodeURIComponent(p)+'" target="_blank" rel="noopener" style="font-family:\'IBM Plex Mono\',monospace;font-weight:500;color:'+B.mid+';">'+p+'</a></td>'
                +'<td style="padding:8px;color:'+B.muted+';font-size:11px;">'+esc(i.description||'')+'</td>'
                +'<td style="padding:8px;">'+evidenceTags(i)+'</td>'
                +'<td style="padding:8px;">'+scoreBar(i.combined_score||i.score||0)+'</td>'
            +'</tr>';
        }).join('');

        return wrap(
            '<div style="font-size:11px;color:'+B.faint+';margin-bottom:8px;">Top '+ints.length+' partners ranked by combined confidence score</div>'
            +'<table style="width:100%;font-size:12px;border-collapse:collapse;table-layout:fixed;">'
                +'<colgroup><col style="width:18%"><col style="width:35%"><col style="width:24%"><col style="width:23%"></colgroup>'
                +'<thead><tr style="text-align:left;color:'+B.muted+';border-bottom:0.5px solid '+B.divider+';">'
                    +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">Partner</th>'
                    +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">Description</th>'
                    +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">Evidence</th>'
                    +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">Score</th>'
                +'</tr></thead>'
                +'<tbody>'+rows+'</tbody>'
            +'</table>'
        );
    }


    /* ══════════════════════════════════════════════════════════════════════
     * CILIOGENICS
     * ══════════════════════════════════════════════════════════════════════ */
    function renderCiliogenics(data) {
        // v5.10: flat-white compact stat card matching the locked mockup.
        // Columns: Rank | Score | Tier (pill) | Evidence sources
        var CILIOGENICS_URL = 'https://ciliogenics.com';
        if (!data || data.score == null) {
            return '<div style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:14px 18px;margin-bottom:14px;">'
                +'<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;gap:12px;">'
                    +'<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:'+B.ink+';">Ciliogenics evidence</div>'
                    +'<a href="'+CILIOGENICS_URL+'" target="_blank" rel="noopener" style="font-size:11px;color:'+B.mid+';">View on Ciliogenics ↗</a>'
                +'</div>'
                +'<p style="font-size:12px;color:'+B.faint+';font-style:italic;margin:0;">Ciliogenics score not available.</p>'
            +'</div>';
        }

        var tier = String(data.tier||'Unknown');
        var tierLower = tier.toLowerCase();
        var tierBg, tierFg;
        if (tierLower === 'gold')        { tierBg='#FAEEDA'; tierFg='#854F0B'; }
        else if (tierLower === 'silver') { tierBg='#F1EFE8'; tierFg='#5F5E5A'; }
        else if (tierLower === 'bronze') { tierBg='#FAECE7'; tierFg='#993C1D'; }
        else                              { tierBg=B.surface; tierFg=B.muted; }

        var scores = data.scores || {};
        var evidenceTags = [];
        if (scores.protein_interaction > 0) evidenceTags.push('Interactome');
        if (scores.phylogenetic > 0)         evidenceTags.push('Phylogeny');
        if (scores.motif > 0)                evidenceTags.push('Motif');
        if (scores.protein_atlas > 0)        evidenceTags.push('Atlas');
        if (scores.single_cell > 0)          evidenceTags.push('scRNA');
        if (scores.publication > 0)          evidenceTags.push('Literature');

        return '<div style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:14px 18px;margin-bottom:14px;">'
            +'<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;gap:12px;">'
                +'<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:'+B.ink+';">Ciliogenics evidence</div>'
                +'<a href="'+CILIOGENICS_URL+'" target="_blank" rel="noopener" style="font-size:11px;color:'+B.mid+';">View on Ciliogenics ↗</a>'
            +'</div>'
            +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:18px;">'
                +'<div>'
                    +'<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:'+B.faint+';margin-bottom:4px;">Rank</div>'
                    +(data.rank!=null
                        ? '<div style="font-size:20px;font-family:\'IBM Plex Mono\',monospace;font-weight:500;color:'+B.ink+';">'+esc(String(data.rank))+'</div><div style="font-size:11px;color:'+B.faint+';">global</div>'
                        : '<div style="font-size:13px;color:'+B.faint+';font-style:italic;">—</div>')
                +'</div>'
                +'<div>'
                    +'<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:'+B.faint+';margin-bottom:4px;">Score</div>'
                    +'<div style="font-size:20px;font-family:\'IBM Plex Mono\',monospace;font-weight:500;color:'+B.ink+';">'+Number(data.score).toFixed(3)+'</div>'
                    +'<div style="font-size:11px;color:'+B.faint+';">composite</div>'
                +'</div>'
                +'<div>'
                    +'<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:'+B.faint+';margin-bottom:4px;">Tier</div>'
                    +'<div><span style="font-size:13px;padding:4px 12px;background:'+tierBg+';color:'+tierFg+';border-radius:999px;font-weight:500;">'+esc(tier)+'</span></div>'
                +'</div>'
                +'<div>'
                    +'<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:'+B.faint+';margin-bottom:4px;">Evidence</div>'
                    +'<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;">'
                        +evidenceTags.map(function(t){
                            return '<span style="font-size:10px;padding:2px 6px;background:#e6f1fb;color:#185fa5;border-radius:3px;">'+esc(t)+'</span>';
                        }).join('')
                    +'</div>'
                +'</div>'
            +'</div>'
        +'</div>';
    }


    /* ══════════════════════════════════════════════════════════════════════
     * PUBLICATIONS
     * ══════════════════════════════════════════════════════════════════════ */
    function renderPublications(g, raw) {
        // v5.10: clean table matching design language.
        // Columns: First author | Source | Year | PMID
        // The PMID_MAP translates internal publication IDs to real PubMed IDs.
        var PMID_MAP = {1:'17581803',2:'15944456',3:'21399639',4:'15107855',5:'20093325',6:'20413456',7:'17526521',8:'22955954',9:'12966085',10:'17676947',11:'30464263',12:'16854802',13:'30464263',14:'26644350',15:null,16:'27882941',17:'27571160',18:'15105452',19:'19556458',20:'12050162',21:'15703212',22:'17317676',23:'24990955',24:'24150416',25:'25960373',26:'26159672',27:'17676063',28:'18787570',29:'28319084',30:'22983947',31:'16550214',32:'16043486',33:'17932292',34:'19202136',35:'21795440',36:'21873635',37:'21209158',38:'22102881',39:'24792167',40:'21873635',41:'20393563',42:'18256283',43:'19910365',44:'16469701',45:'22616028',46:'20351263',47:'23333735',48:'18467494',49:'18388199',50:'20621980',51:'15899979',52:'26791250',53:'15899979',54:'29769720',55:'25920554',56:'33961781'};

        var pubs = g.publications || g.Publications || (raw&&raw.publications) || [];
        var disRefs = g.disease_refs || (raw&&raw.disease_refs) || [];
        if (!Array.isArray(pubs)) pubs = [];
        if (!Array.isArray(disRefs)) disRefs = [];
        if (!pubs.length && !disRefs.length) return '';

        // Dedupe pubs by id
        var seen = {};
        var unique = pubs.filter(function(p){
            var k = String(p.id||'_'+p.source);
            if (seen[k]) return false;
            seen[k] = true;
            return true;
        });

        // Context pill colour from source string
        function pillForSource(src) {
            var s = String(src||'').toLowerCase();
            var bg, fg;
            if (s.indexOf('gold standard') !== -1 || s.indexOf('syscilia') !== -1) { bg='#E1F5EE'; fg='#0F6E56'; }
            else if (s.indexOf('cilia carta') !== -1)                                  { bg='#E6F1FB'; fg='#185FA5'; }
            else if (s.indexOf('go ') !== -1)                                          { bg=B.surface; fg=B.muted; }
            else                                                                       { bg=B.surface; fg=B.muted; }
            return '<span style="font-size:11px;padding:3px 9px;background:'+bg+';color:'+fg+';border-radius:999px;font-weight:500;white-space:nowrap;">'+esc(src||'unknown')+'</span>';
        }

        // Build rows — main publications
        var rows = unique.slice(0, 12).map(function(p) {
            var idx = parseInt(p.id, 10) || 0;
            var pmid = PMID_MAP[idx] || '';
            var src = p.source || 'Unknown';
            // Extract first author from source
            var auth = (src.match(/^([A-Za-z]+(?:\s+[A-Za-z]+)?)/) || ['',src])[1];
            return '<tr style="border-bottom:0.5px solid '+B.divider+';">'
                +'<td style="padding:8px;font-style:italic;color:'+B.ink+';">'+esc(auth)+(/et al/i.test(src)?'':' et al.')+'</td>'
                +'<td style="padding:8px;">'+pillForSource(src)+'</td>'
                +'<td style="padding:8px;text-align:right;font-family:\'IBM Plex Mono\',monospace;font-size:11px;">'
                    +(pmid?'<a href="https://pubmed.ncbi.nlm.nih.gov/'+pmid+'/" target="_blank" rel="noopener" style="color:'+B.mid+';">'+pmid+'</a>':'<span style="color:'+B.faint+';">—</span>')
                +'</td>'
            +'</tr>';
        }).join('');

        // Add disease_refs as additional rows (these have real PMIDs already)
        var disRowsHtml = '';
        if (disRefs.length) {
            disRowsHtml = disRefs.slice(0, 5).map(function(pmid){
                var pid = String(pmid).replace(/[^0-9]/g, '');
                if (!pid) return '';
                return '<tr style="border-bottom:0.5px solid '+B.divider+';">'
                    +'<td style="padding:8px;color:'+B.faint+';font-style:italic;font-size:11px;">disease reference</td>'
                    +'<td style="padding:8px;"><span style="font-size:11px;padding:3px 9px;background:#FCEBEB;color:#A32D2D;border-radius:999px;font-weight:500;">Disease association</span></td>'
                    +'<td style="padding:8px;text-align:right;font-family:\'IBM Plex Mono\',monospace;font-size:11px;"><a href="https://pubmed.ncbi.nlm.nih.gov/'+pid+'/" target="_blank" rel="noopener" style="color:'+B.mid+';">'+pid+'</a></td>'
                +'</tr>';
            }).filter(Boolean).join('');
        }

        var total = unique.length + disRefs.length;
        return '<div style="background:'+B.white+';border:1px solid '+B.divider+';border-radius:12px;padding:14px 18px;margin-bottom:14px;">'
            +'<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:'+B.ink+';margin-bottom:12px;">Publications · '+total+' reference'+(total>1?'s':'')+'</div>'
            +'<table style="width:100%;font-size:12px;border-collapse:collapse;table-layout:fixed;">'
                +'<colgroup><col style="width:35%"><col style="width:45%"><col style="width:20%"></colgroup>'
                +'<thead><tr style="text-align:left;color:'+B.muted+';border-bottom:0.5px solid '+B.divider+';">'
                    +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">First author</th>'
                    +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;">Source / context</th>'
                    +'<th style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;font-weight:500;text-align:right;">PMID</th>'
                +'</tr></thead>'
                +'<tbody>'+rows+disRowsHtml+'</tbody>'
            +'</table>'
        +'</div>';
    }


    /* ══════════════════════════════════════════════════════════════════════
     * MASTER CARD BUILDER
     * ══════════════════════════════════════════════════════════════════════ */
    function renderCardHtml(g) {
        /* v12.2 redesign — laptop-first compact card.
         *
         * ABOVE THE FOLD (~600 px height target on 700 px laptop viewport):
         *   ROW 1: Compact header (gene, desc, classification, locs, aliases, ENSG)
         *   ROW 2: Quick links bar (UniProt / AlphaFold / OMIM / ClinGen) + scRNA pill
         *   ROW 3: 2-column body
         *           LEFT  → Ciliopathies + Functional Effects (LoF, OE, % cil.)
         *           RIGHT → Screen Data + Functional Summary (truncated)
         *
         * BELOW THE FOLD (collapsed by default, click to expand):
         *   - Functional categories
         *   - Cross-species phenotypes
         *   - Phylogenetic profile (Nevers 2017)
         *   - Orthologs
         *   - Protein complex / STRING
         *   - Domains & ClinVar
         *   - Ciliogenics evidence
         *   - Publications */
        var sym=(g.Gene||g.gene||'').toUpperCase();
        var raw=rawOf(sym);
        var hasDomain=!!(g.pfam_domains&&g.pfam_domains.length)||!!(raw&&raw.pfam_domains&&raw.pfam_domains.length)
                     ||!!(g.clinvar_variants&&g.clinvar_variants.length)||!!(raw&&raw.clinvar_variants&&raw.clinvar_variants.length);

        /* Pre-render all sections so we can wrap them. Some renderers may
         * return empty strings for genes with no data — wrapCollapsed
         * handles that by skipping. */
        var hCiliop  = renderCiliopathies(g, raw);
        var hDiseaseSx = buildDiseaseSymptoms(g, raw);
        /* hEffects: rendered separately as buildLoFEffectsStrip above. v5.10 */
        var hScreens = renderScreens(g, raw);
        var hSummary = renderSummary(g, raw);
        var hCategories  = renderFunctionalCategories(g, raw);
        var hPhenotypes  = renderPhenotypes(g, raw);
        var hPhylogenetics = renderPhylogenetics(g, raw);
        var hScRNA       = renderScRNA(g, raw);
        var hDomains     = hasDomain ? renderDomains(g, raw) : '';
        var hComplex     = renderComplex(g, raw);
        var hSTRING      = renderSTRING(g, raw);
        var hCiliogenics = renderCiliogenics(g.ciliogenics);
        var hPublications = renderPublications(g, raw);

        return STYLES
            +'<div class="cg12">'
            +renderHeader(g, raw)
            +'<div style="padding:10px 14px 0;">'
                +buildWhyInCiliaHub(g, raw)
                +buildLoFEffectsStrip(g, raw)
            +'</div>'
            +'<div style="padding:0 14px 10px;">'
                /* v5.10 layout restructure:
                 * - Phylogeny heatmap (left) and Screens+Summary (right) form the
                 *   primary 2-column block. Ciliopathy moves out of this row.
                 * - Below: Ciliopathy associations (full width — wider table)
                 * - Then all other sections in their new flat-white styles,
                 *   no longer wrapped in collapsed accordions.
                 */
                +'<div class="cg2" style="margin-bottom:8px;">'
                    +'<div style="display:flex;flex-direction:column;gap:8px;">'
                        +hPhylogenetics
                    +'</div>'
                    +'<div style="display:flex;flex-direction:column;gap:8px;">'
                        +hScreens
                        +hSummary
                    +'</div>'
                +'</div>'

                /* Full-width sections below the primary grid */
                +hCiliop
                +hDiseaseSx
                +hPhenotypes
                +hCategories
                +hDomains
                +hComplex
                +hSTRING
                +hScRNA
                +hCiliogenics
                +hPublications
                +'<div style="height:30px;"></div>'
            +'</div>'
        +'</div>';
    }

    /* ══════════════════════════════════════════════════════════════════════
     * PUBLIC API — FIXED container sizing and scroll button
     * ══════════════════════════════════════════════════════════════════════ */
    async function renderInLeftPanel(symbol) {
        var container = doc.getElementById('cilia-svg');
        if (!container) {
            log('Target #cilia-svg not found.', 'error');
            return false;
        }

        /* Hide sibling absolute-positioned containers that would otherwise sit
         * on top of the gene card and intercept every click. #plotly-container,
         * #domain-viewer, and #compare-umap-container are siblings of
         * #cilia-svg inside #viz-stage, all positioned `absolute; inset: 0`,
         * so without an explicit display:none they overlay the card. This
         * mirrors what the host's window.showDiagram() does for the diagram
         * view. (Discovered when bare-gene queries opened the card but no
         * section header or link was clickable.) */
        ['plotly-container', 'domain-viewer', 'compare-umap-container'].forEach(function(id) {
            var sib = doc.getElementById(id);
            if (sib) sib.style.display = 'none';
        });

        /* FIXED: position:absolute + inset:0 ensures proper container height for scrolling */
        container.style.cssText = 'display:block !important;overflow-y:auto !important;overflow-x:hidden !important;background:' + B.bg + ' !important;position:absolute !important;top:0 !important;left:0 !important;right:0 !important;bottom:0 !important;';

        container.innerHTML = '<div style="padding:60px;text-align:center;font-family:\'IBM Plex Sans\',sans-serif;">'
            + '<div style="font-size:22px;font-weight:900;color:' + B.mid + ';margin-bottom:8px;">' + esc(symbol.toUpperCase()) + '</div>'
            + '<div style="font-size:13px;color:' + B.muted + ';">Loading gene profile…</div></div>';

        if (win.CiliAI && !win.CiliAI._rawMaster) {
            try {
                var resp = await fetch('/data/genes/ciliahub_master_merged.json', { cache: 'default' });
                if (resp.ok) {
                    win.CiliAI._rawMaster = await resp.json();
                    log('Raw master cached.');
                }
            } catch (e) {
                log('Raw master fetch failed: ' + e.message, 'error');
            }
        }

        /* Preload Nevers 2017 phylogeny so the conservation matrix has data on first render. */
        if (win.loadPhylogeny && !(win.CiliAI && win.CiliAI._phylo && win.CiliAI._phylo.nevers)) {
            try { await win.loadPhylogeny('nevers'); }
            catch (e) { log('Nevers phylogeny fetch failed: ' + e.message, 'error'); }
        }

        try { await loadDiseaseProfiles(); }
        catch (e) { log('Disease profiles preload failed: ' + e.message, 'error'); }

        var g = (win.CiliAI && win.CiliAI.lookups && win.CiliAI.lookups.geneMap) 
            ? win.CiliAI.lookups.geneMap[symbol.toUpperCase()] 
            : null;

        if (!g) {
            container.innerHTML = '<div style="padding:60px;text-align:center;">'
                + '<div style="font-size:15px;font-weight:700;color:' + B.faint + ';">No data found for <strong style="color:' + B.mid + ';">' + esc(symbol.toUpperCase()) + '</strong></div>'
                + '<div style="font-size:12px;color:#b0bec5;margin-top:6px;">Verify master JSON is loaded.</div></div>';
            log('Gene not found: ' + symbol, 'error');
            return false;
        }

        win.CiliAI.activeGeneContext = symbol.toUpperCase();
        container.innerHTML = renderCardHtml(g);
        container.scrollTop = 0;
        /* Floating "↓ Scroll" button removed — the native scrollbar on
         * #cilia-svg (overflow-y:auto, above) is the sole scroll mechanism.
         * The blue button was redundant with the native scrollbar and was
         * also covering content at the bottom of the panel. */
        log('Rendered: ' + symbol.toUpperCase());
        return true;
    }

    win.CiliAI = win.CiliAI || {};
    win.CiliAI.GeneCard = {
        renderInLeftPanel: renderInLeftPanel,
        loadDiseaseProfiles: loadDiseaseProfiles,

        /* ──────────────────────────────────────────────────────────────────
         * Generic render API — usable on any page (ciliahub.html, plots.html)
         *
         * renderHtmlForSymbol(symbol)
         *   Returns the full gene-card HTML as a string for the given symbol.
         *   Pulls the gene record from window.CiliAI.lookups.geneMap. Returns
         *   a fallback "No data found" snippet if the symbol isn't in the map.
         *   Does NOT touch the DOM, does NOT hide other elements, does NOT
         *   manage scroll. Just returns markup.
         *
         * renderToContainer(symbol, containerOrId)
         *   Convenience wrapper: writes renderHtmlForSymbol's output into
         *   the given container (DOM element or element ID). Returns true
         *   on success, false if the container can't be found.
         * ────────────────────────────────────────────────────────────────── */
        renderHtmlForSymbol: function(symbol) {
            var sym = String(symbol || '').toUpperCase().trim();
            if (!sym) return '';
            var g = (win.CiliAI && win.CiliAI.lookups && win.CiliAI.lookups.geneMap)
                ? win.CiliAI.lookups.geneMap[sym] : null;
            if (!g) {
                return '<div style="padding:60px;text-align:center;font-family:\'IBM Plex Sans\',sans-serif;">'
                    + '<div style="font-size:15px;font-weight:700;color:' + B.faint + ';">No data found for <strong style="color:' + B.mid + ';">' + esc(sym) + '</strong></div>'
                    + '<div style="font-size:12px;color:#b0bec5;margin-top:6px;">Verify master JSON is loaded.</div></div>';
            }
            /* If the raw master is loaded, merge it into a defensive copy of g
             * so sections that only take `g` (renderSummary, renderPublications,
             * renderScRNA, renderPhylogenetics, renderCiliopathies) see all
             * fields. The geneMap rec built by buildState/buildFromMaster
             * intentionally renames many fields (e.g. functional_summary →
             * Functional_Summary, no publications carried), so without this
             * merge those sections would render empty even though the raw
             * master has the data. Existing fields on g win — we never
             * overwrite renamed-by-design fields. */
            var raw = (win.CiliAI && win.CiliAI._rawMaster && win.CiliAI._rawMaster.genes)
                ? win.CiliAI._rawMaster.genes[sym] : null;
            if (raw) {
                var merged = {};
                Object.keys(raw).forEach(function(k) { merged[k] = raw[k]; });
                Object.keys(g).forEach(function(k) {
                    /* Only override raw with g if g has a non-empty value.
                     * Handles cases where buildFromMaster wrote '' or [] for
                     * a field — we'd rather show the raw master's content
                     * than empty. */
                    var v = g[k];
                    if (v == null) return;
                    if (Array.isArray(v) && v.length === 0 && Array.isArray(raw[k]) && raw[k].length > 0) return;
                    if (typeof v === 'string' && v === '' && raw[k]) return;
                    merged[k] = v;
                });
                /* Always preserve the canonical Gene field (uppercase symbol)
                 * since gene-card.js depends on it for ID lookups. */
                merged.Gene = g.Gene || sym;
                /* Diagnostic — logs once per page session so we can verify the
                 * raw-merge is happening and which fields populate. */
                if (!win._geneCardMergeLogged) {
                    win._geneCardMergeLogged = true;
                    console.log('[GeneCard merge]', sym,
                        '| raw fields:', Object.keys(raw).length,
                        '| g fields:', Object.keys(g).length,
                        '| merged fields:', Object.keys(merged).length,
                        '| screens:', merged.screens ? merged.screens.length : 'MISSING',
                        '| functional_summary:', !!merged.functional_summary,
                        '| publications:', merged.publications ? merged.publications.length : 'MISSING');
                }
                return renderCardHtml(merged);
            }
            return renderCardHtml(g);
        },

        /* Async — call this when you also want raw master data loaded so all
         * sections (screens, publications, phenotypes, phylogenetics, etc.)
         * render with full content. The renderHtmlForSymbol synchronous
         * variant only has access to data.js's geneMap rec which is a subset
         * of the raw master record. */
        renderToContainer: async function(symbol, containerOrId) {
            var container = (typeof containerOrId === 'string')
                ? doc.getElementById(containerOrId)
                : containerOrId;
            if (!container) {
                log('renderToContainer: container not found: ' + containerOrId, 'error');
                return false;
            }
            /* Show loading state immediately so the page isn't blank during
             * the master fetch (which is ~22 MB and takes a few seconds on
             * cold cache). */
            container.innerHTML = '<div style="padding:60px;text-align:center;font-family:\'IBM Plex Sans\',sans-serif;">'
                + '<div style="font-size:22px;font-weight:900;color:' + B.mid + ';margin-bottom:8px;">' + esc(String(symbol).toUpperCase()) + '</div>'
                + '<div style="font-size:13px;color:' + B.muted + ';">Loading gene profile…</div></div>';

            /* Lazy-load the raw master JSON once. gene-card.js sections use
             * rawOf(sym) to read fields like screens, publications, mouse_phenotype,
             * phylogeny matrices, and ciliogenics evidence — all of which are
             * stripped out of buildState's compact rec. Without _rawMaster these
             * sections render empty. */
            if (win.CiliAI && !win.CiliAI._rawMaster) {
                try {
                    var resp = await fetch('/data/genes/ciliahub_master_merged.json', { cache: 'default' });
                    if (resp.ok) {
                        win.CiliAI._rawMaster = await resp.json();
                        log('Raw master cached.');
                    }
                } catch (e) {
                    log('Raw master fetch failed: ' + e.message, 'error');
                }
            }

            /* v5.11: Preload Nevers 2017 phylogeny so renderPhylogenetics
             * has data on first render. ~2 MB, cached client-side. */
            if (win.loadPhylogeny && !(win.CiliAI && win.CiliAI._phylo && win.CiliAI._phylo.nevers)) {
                try {
                    await win.loadPhylogeny('nevers');
                } catch (e) {
                    log('Nevers phylogeny fetch failed: ' + e.message, 'error');
                }
            }

            try { await loadDiseaseProfiles(); }
            catch (e) { log('Disease profiles preload failed: ' + e.message, 'error'); }

            container.innerHTML = this.renderHtmlForSymbol(symbol);
            return true;
        },

        version: VERSION,
        _renderers: {
            header: renderHeader,
            ciliopathies: renderCiliopathies,
            functionalCategories: renderFunctionalCategories,
            screens: renderScreens,
            functionalEffects: renderFunctionalEffects,
            summary: renderSummary,
            phenotypes: renderPhenotypes,
            phylogenetics: renderPhylogenetics,
            scrna: renderScRNA,
            domains: renderDomains,
            complex: renderComplex,
            string: renderSTRING,
            ciliogenics: renderCiliogenics,
            publications: renderPublications
        }
    };
    
    log('v' + VERSION + ' [scroll button removed; sibling containers hidden so clicks reach the card] initialized.');

})(window, document);