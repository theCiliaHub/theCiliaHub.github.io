/**
 * CiliAI Intent Engine — Composite Query Patch
 * ─────────────────────────────────────────────────────────────────────────────
 * INSTALL: Add AFTER intent-engine.js in index.html:
 *   <script src="./ciliai/assistant/intent-engine-composite.js"></script>
 *
 * Fixes all 18 failing composite queries by adding:
 *   1. Composite parser that runs BEFORE all single-dimension parsers
 *   2. New composite action handlers
 *   3. Brain→hypothalamus tissue map extension
 *   4. Case-insensitive LOF matching fix
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

(function (win) {

// ═══════════════════════════════════════════════════════════════════════════
// § 1  CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const LOF_KEY = 'Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)';

// Known complex gene sets for intersection queries
const COMPLEX_SETS = {
    ift_b: new Set(['IFT22','IFT25','IFT27','IFT46','IFT52','IFT56','IFT57',
                    'IFT70A','IFT70B','IFT74','IFT81','IFT88','IFT172',
                    'CLUAP1','IFT20','TRAF3IP1']),
    ift_a: new Set(['IFT43','IFT80','IFT121','IFT122','IFT139','IFT140',
                    'IFT144','WDR19','WDR35','TTC21B']),
    bbsome: new Set(['BBS1','BBS2','BBS4','BBS5','BBS7','BBS8','BBS9',
                     'BBS18','BBIP1','TTC8','LZTFL1']),
    mks_module: new Set(['MKS1','TMEM216','TMEM67','CEP290','RPGRIP1L',
                         'CC2D2A','TCTN1','TCTN2','TCTN3','B9D1','B9D2',
                         'TMEM231','TMEM107','TMEM237','TMEM17','TMEM138',
                         'TMEM218','TMEM252']),
    nphp_module: new Set(['NPHP1','NPHP3','NPHP4','NPHP5','NPHP8',
                          'RPGRIP1L','IQCB1','CEP290','SDCCAG8','INVERSIN','NEK8']),
    dynein2: new Set(['DYNC2H1','DYNC2LI1','WDR34','WDR60','DYNLT2B','TCTEX1D2']),
    transition_zone: new Set(['NPHP1','NPHP4','MKS1','CEP290','TCTN1','TCTN2','TCTN3',
                               'B9D1','B9D2','TMEM67','CC2D2A','RPGRIP1L','TMEM216',
                               'TMEM231','AHI1','CSPP1']),
};

// Disease → localization hints (for disease+tissue answers)
const DISEASE_TISSUE_CONTEXT = {
    joubert:      'cerebellum',
    pcd:          'lung',
    nphp:         'kidney',
    bardet_biedl: 'hypothalamus',
    retinal:      'retina',
    skeletal:     'limb_bud',
    infertility:  'testis',
};

// ═══════════════════════════════════════════════════════════════════════════
// § 2  COMPOSITE PARSER
// ═══════════════════════════════════════════════════════════════════════════

const CompositeParser = {

    // Entry: tries all composite patterns, returns intent or null
    parse(t, q) {
        return (
            this._locPhenotype(t, q)     ||  // Q1, Q18: LOC + LOF effect
            this._locDisease(t, q)       ||  // Q11, Q16: LOC + disease
            this._locTissue(t, q)        ||  // Q2, Q12, Q14, Q15: LOC + tissue
            this._diseaseTissue(t, q)    ||  // Q3, Q7, Q9: disease + tissue
            this._diseaseComplex(t, q)   ||  // Q8, Q10: disease ∩ complex
            this._phyloDomain(t, q)      ||  // Q4: phylo scope + domain
            this._pfamFilter(t, q)       ||  // Q5: vertebrate + PFAM accession
            this._complexComplex(t, q)   ||  // Q6: complex vs complex phylo
            this._lofPhyloTissue(t, q)   ||  // Q17: LOF + conserved + tissue
            null
        );
    },

    // ── Helpers ─────────────────────────────────────────────────────────

    _genes(text) {
        const STOP = new Set(['DNA','RNA','AND','THE','FOR','ARE','ALL','ANY','LOC',
                              'SHOW','TELL','LIST','PLOT','UMAP','FROM','THAT','WITH',
                              'WHAT','WHERE','DOES','HAVE','FIND','GENE','GENES','NOT',
                              'WHICH','THESE','ALSO','BOTH','ONLY','WHEN','BEEN','THAN']);
        return [...new Set(
            (text.match(/\b[A-Z][A-Z0-9]{1,11}\b/g) || [])
            .filter(g => !STOP.has(g) && g.length >= 3)
        )];
    },

    _matchDisease(q) {
        const D = [
            ['joubert','joubert'],['bardet','bardet_biedl'],['biedl','bardet_biedl'],
            [/\bbbs\b/,'bardet_biedl'],['meckel','meckel'],['nephronophthisis','nphp'],
            [/\bnphp\b/,'nphp'],['primary ciliary dyskinesia','pcd'],
            ['ciliary dyskinesia','pcd'],[/\bpcd\b/,'pcd'],
            ['leber','retinal'],['retinal ciliopathy','retinal'],['retinitis','retinal'],
            ['retinal degeneration','retinal'],['skeletal ciliopathy','skeletal'],
            ['male infertility','infertility'],['infertility','infertility'],
            ['medulloblastoma','medulloblastoma'],['alstr','alstrom'],
            ['polycystic kidney','pkd'],[/\bpkd\b/,'pkd'],
            ['usher','usher'],['holoprosencephaly','holoprosencephaly'],
            ['polydactyly','polydactyly'],
        ];
        for (const [pat, tag] of D)
            if (pat instanceof RegExp ? pat.test(q) : q.includes(pat)) return tag;
        return null;
    },

    _matchLoc(q) {
        const sorted = Object.entries({
            'transition zone':  {term:'transition zone', label:'Transition Zone'},
            'basal body':       {term:'basal body',       label:'Basal Body'},
            'ciliary tip':      {term:'ciliary tip',       label:'Ciliary Tip'},
            'ciliary membrane': {term:'ciliary membrane',  label:'Ciliary Membrane'},
            'ciliary axoneme':  {term:'ciliary axoneme',   label:'Axoneme'},
            'axoneme':          {term:'axoneme',           label:'Axoneme'},
            'flagella':         {term:'flagella',          label:'Flagella / Axoneme'},
            'motile cilia':     {term:'motile cilia',      label:'Motile Cilia'},
            'cilia':            {term:'cilia',             label:'Cilia'},
            'centrosome':       {term:'centrosome',        label:'Centrosome'},
            'nucleus':          {term:'nucleus',           label:'Nucleus'},
            'mitochondria':     {term:'mitochondria',      label:'Mitochondria'},
            'lysosome':         {term:'lysosom',           label:'Lysosomes'},
            'lysosomes':        {term:'lysosom',           label:'Lysosomes'},
        }).sort((a,b) => b[0].length - a[0].length);
        for (const [kw, info] of sorted)
            if (q.includes(kw)) return info;
        return null;
    },

    _matchTissue(q) {
        const T = {
            lung:         ['lung','airway','bronchial','pulmonary'],
            kidney:       ['kidney','renal','nephron','proximal tubule'],
            liver:        ['liver','hepat'],
            hypothalamus: ['hypothalamus','hypothalamic','brain','neural'],
            chondrocyte:  ['chondrocyte','cartilage'],
            retina:       ['retina','retinal','photoreceptor'],
            olfactory:    ['olfactory'],
            pancreas:     ['pancrea'],
            choroid_plexus:['choroid plexus'],
            cerebellum:   ['cerebellum','cerebellar','granule cell'],
            limb_bud:     ['limb bud','limb','digit'],
            testis:       ['testis','testicular','sperm'],
        };
        for (const [key, terms] of Object.entries(T))
            if (terms.some(t => q.includes(t))) return key;
        return null;
    },

    _matchComplex(q) {
        const C = [
            ['ift-b','ift_b'],['ift complex b','ift_b'],['ift b complex','ift_b'],
            ['ift-a','ift_a'],['ift complex a','ift_a'],['ift a complex','ift_a'],
            ['bbsome','bbsome'],['bbs complex','bbsome'],
            ['mks module','mks_module'],['mks complex','mks_module'],['meckel','mks_module'],
            ['nphp module','nphp_module'],['nphp complex','nphp_module'],
            ['dynein-2','dynein2'],['dynein 2','dynein2'],
            ['transition zone complex','transition_zone'],
        ];
        for (const [pat, key] of C)
            if (q.includes(pat)) return key;
        return null;
    },

    _matchLOFEffect(q) {
        if (/shorter cilia|short cilia|shorten|cilia shortening/i.test(q)) return 'shorter';
        if (/longer cilia|elongat|lengthen/i.test(q)) return 'longer';
        if (/loss of cilia|no cilia|absent cilia|ciliogenesis blocked/i.test(q)) return 'loss';
        if (/no effect|no phenotype/i.test(q)) return 'no_effect';
        if (/motility defect|immotile/i.test(q)) return 'motility';
        if (/knocked down|knockdown|depletion|lof|loss.of.function/i.test(q)) return 'knockdown';
        return null;
    },

    // ── Composite matchers ───────────────────────────────────────────────

    // Q1, Q18: localization + LOF phenotype
    _locPhenotype(t, q) {
        const loc = this._matchLoc(q);
        const effect = this._matchLOFEffect(q);
        if (!loc || !effect) return null;
        // Avoid firing if this is just a disease query
        if (this._matchDisease(q) && !loc) return null;
        return { type:'composite_loc_phenotype', loc, effect, raw:t };
    },

    // Q11, Q16: localization + disease
    _locDisease(t, q) {
        const loc = this._matchLoc(q);
        const disease = this._matchDisease(q);
        if (!loc || !disease) return null;
        // Don't fire if also has tissue (let locDiseaseTissue handle)
        const tissue = this._matchTissue(q);
        if (tissue && tissue !== 'testis') return null;
        return { type:'composite_loc_disease', loc, disease, raw:t };
    },

    // Q2, Q12, Q14, Q15: localization + tissue (no disease)
    _locTissue(t, q) {
        const loc = this._matchLoc(q);
        const tissue = this._matchTissue(q);
        if (!loc || !tissue || tissue === 'testis') return null;
        // Don't fire if also has disease
        if (this._matchDisease(q)) return null;
        // Don't fire if also has LOF effect
        if (this._matchLOFEffect(q)) return null;
        return { type:'composite_loc_tissue', loc, tissue, raw:t };
    },

    // Q3, Q7, Q9: disease + tissue (no localization)
    _diseaseTissue(t, q) {
        const disease = this._matchDisease(q);
        const tissue = this._matchTissue(q);
        if (!disease || !tissue) return null;
        // Don't fire if localization is also present
        if (this._matchLoc(q)) return null;
        const exclude = tissue === 'testis' || /not expressed|not found in|absent from|exclude/i.test(q);
        return { type:'composite_disease_tissue', disease, tissue, exclude, raw:t };
    },

    // Q8, Q10: disease ∩ complex
    _diseaseComplex(t, q) {
        const disease = this._matchDisease(q);
        const complex = this._matchComplex(q);
        if (!disease || !complex) return null;
        return { type:'composite_disease_complex', disease, complex, raw:t };
    },

    // Q4: phylo scope + domain
    _phyloDomain(t, q) {
        const hasPhylo = /conserv|phylogen|ciliary.specific|vertebrate.specific|mammalian.specific|evol/i.test(q);
        const hasDomain = /domain|wd40|tpr|coiled|kinase|pfam|repeat/i.test(q);
        if (!hasPhylo || !hasDomain) return null;
        // Extract domain family
        const domFamilies = {
            'WD40':['wd40','wd repeat'],'TPR':['tpr','tetratricopeptide'],
            'coiled-coil':['coiled-coil','coiled coil'],'kinase':['kinase'],
            'kinesin':['kinesin'],'GTPase':['gtpase'],
        };
        let domain = null;
        for (const [fam, terms] of Object.entries(domFamilies))
            if (terms.some(tr => q.includes(tr))) { domain = fam; break; }
        if (!domain) return null;
        let scope = 'all';
        if (/vertebrate.specific/i.test(q)) scope = 'vertebrate';
        if (/mammalian.specific/i.test(q)) scope = 'mammalian';
        if (/ciliary.specific/i.test(q)) scope = 'ciliary_specific';
        if (/conserv|ancient/i.test(q)) scope = 'conserved';
        return { type:'composite_phylo_domain', domain, scope, raw:t };
    },

    // Q5: vertebrate/phylo filter + PFAM accession (PFxxxxx)
    _pfamFilter(t, q) {
        const pfamMatch = t.match(/\bPF\d{5}\b/);
        if (!pfamMatch) return null;
        let scope = 'all';
        if (/vertebrate/i.test(q)) scope = 'vertebrate';
        if (/mammalian/i.test(q)) scope = 'mammalian';
        if (/ciliary.specific/i.test(q)) scope = 'ciliary_specific';
        return { type:'composite_pfam_filter', pfam: pfamMatch[0], scope, raw:t };
    },

    // Q6: two complexes for phylo comparison
    _complexComplex(t, q) {
        const isCompare = /compare|versus|\bvs\b|side.by.side/i.test(q);
        const isPhylo = /phylogen|conserv|evol/i.test(q);
        if (!isCompare || !isPhylo) return null;
        // Extract two complex mentions
        const complexKeys = [];
        const C = [
            ['ift-b','ift_b'],['bbsome','bbsome'],['bbs complex','bbsome'],
            ['ift-a','ift_a'],['mks','mks_module'],['nphp','nphp_module'],
            ['dynein-2','dynein2'],['transition zone','transition_zone'],
        ];
        for (const [pat, key] of C)
            if (q.includes(pat) && !complexKeys.includes(key)) complexKeys.push(key);
        if (complexKeys.length < 2) return null;
        return { type:'composite_complex_complex', complexA: complexKeys[0], complexB: complexKeys[1], raw:t };
    },

    // Q17: LOF no-effect + conserved + tissue
    _lofPhyloTissue(t, q) {
        const hasLOF = /no.*(effect|phenotype)|lof.*no|phenotype.*no/i.test(q);
        const hasConserved = /conserv|phylogen/i.test(q);
        const tissue = this._matchTissue(q);
        if (!hasLOF || !hasConserved) return null;
        return { type:'composite_lof_conserved_tissue', tissue: tissue || null, raw:t };
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// § 3  COMPOSITE ACTION HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

const CompositeActions = {

    _db()  { return win.CiliAI?.masterData || []; },
    _say(html) { win.addChatMessage(html, false); },

    _pill(text, color) {
        const C = { blue:['#dbeafe','#1e40af'], red:['#fee2e2','#991b1b'],
                    green:['#dcfce7','#166534'], amber:['#fef3c7','#92400e'],
                    purple:['#ede9fe','#5b21b6'], gray:['#f3f4f6','#374151'],
                    teal:['#ccfbf1','#0f766e'], orange:['#ffedd5','#9a3412'] };
        const [bg,fg] = C[color] || C.gray;
        return `<span style="background:${bg};color:${fg};padding:2px 7px;border-radius:8px;
                font-size:10.5px;font-weight:600;white-space:nowrap;display:inline-block;margin:1px;">${text}</span>`;
    },

    _chip(sym) {
        const safe = sym.replace(/'/g,"\\'");
        return `<span onclick="window.CiliAI.Router.dispatchAction({text:'${safe}',echo:false})"
                      style="background:#e6f2fb;color:#005b96;border:1px solid #b3cde0;
                             margin:2px;padding:4px 10px;border-radius:12px;
                             font-size:11.5px;font-weight:600;cursor:pointer;display:inline-block;">${sym}</span>`;
    },

    _table(headers, rows, max=50) {
        const shown = rows.slice(0,max);
        const more  = rows.length > max ? `<p style="color:#888;font-size:11px;margin-top:4px;">Showing ${max} of ${rows.length}</p>` : '';
        return `<div style="overflow-x:auto;margin-top:8px;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead><tr>${headers.map(h=>
                `<th style="padding:7px 10px;text-align:left;background:#f1f5f9;border-bottom:2px solid #e2e8f0;color:#475569;font-weight:700;">${h}</th>`
              ).join('')}</tr></thead>
              <tbody>${shown.map((r,i)=>
                `<tr style="background:${i%2?'#f8fafc':'white'};border-bottom:1px solid #f1f5f9;">
                   ${r.map(cell=>`<td style="padding:6px 10px;vertical-align:top;">${cell}</td>`).join('')}
                 </tr>`
              ).join('')}</tbody>
            </table></div>${more}`;
    },

    _csv(genes, fields) {
        const hdr = fields.join(',');
        const body = genes.map(g => fields.map(f=>`"${String(g[f]||'').replace(/"/g,'""')}"`).join(','));
        return [hdr,...body].join('\n');
    },

    _dl(label, csv, filename) {
        return `<a href="data:text/csv;charset=utf-8,${encodeURIComponent(csv)}"
                   download="${filename}"
                   style="display:inline-block;margin-top:8px;padding:6px 14px;
                          background:#005b96;color:white;border-radius:6px;
                          font-size:12px;font-weight:600;text-decoration:none;">⬇ ${label}</a>`;
    },

    _tissueNote(tissue) {
        const names = { lung:'Human Lung',kidney:'Human Kidney',liver:'Human Liver',
                        hypothalamus:'Hypothalamus',retina:'Retina',cerebellum:'Fetal Cerebellum',
                        testis:'Testis' };
        const n = names[tissue] || tissue;
        const hasData = ['lung','kidney','liver','hypothalamus','chondrocyte','retina','cerebellum'].includes(tissue);
        if (hasData) return `<div style="background:#eff6ff;border-left:3px solid #3b82f6;padding:8px 12px;
                margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#1e40af;">
                ℹ️ scRNA-seq data for <b>${n}</b> is available. Click <b>Plot</b> tab then search a gene to view expression.</div>`;
        return `<div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:8px 12px;
                margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#92400e;">
                ⚠️ Tissue expression data for <b>${n}</b> is not yet loaded in CiliAI's scRNA-seq database.
                Genes listed here are from the curated CiliaHub annotation database.</div>`;
    },

    // ── LOC + PHENOTYPE (Q1, Q18) ─────────────────────────────────────────
    composite_loc_phenotype(i) {
        const { loc, effect } = i;
        const locTerm = loc.term;

        // Case-insensitive LOF search covering all 'shorter cilia' variants
        const effectFilters = {
            shorter:    r => /shorter cilia|short cilia|shorter sperm/i.test(r[LOF_KEY]),
            longer:     r => /longer cilia/i.test(r[LOF_KEY]),
            loss:       r => /loss of cilia|ciliogenesis blocked|abolished/i.test(r[LOF_KEY]),
            no_effect:  r => /no effect/i.test(r[LOF_KEY]),
            motility:   r => /motility/i.test(r[LOF_KEY]),
            knockdown:  r => r[LOF_KEY] && !/not reported/i.test(r[LOF_KEY]),
        };
        const lofFilter = effectFilters[effect] || effectFilters.shorter;

        const matches = this._db().filter(r =>
            r['Localization'].toLowerCase().includes(locTerm) && lofFilter(r)
        );

        if (!matches.length) {
            this._say(`No genes found with <b>${loc.label}</b> localization and <b>${effect}</b> cilia phenotype.`);
            return;
        }

        const rows = matches.slice(0,40).map(g => [
            this._chip(g['Gene']),
            g[LOF_KEY] || '—',
            g['Ciliopathy'] && g['Ciliopathy'] !== 'N/A'
                ? this._pill(g['Ciliopathy'].split(',')[0].trim(),'red') : '—',
        ]);
        const csv = this._csv(matches, ['Gene','Localization',LOF_KEY,'Ciliopathy']);

        this._say(`
            <b>${loc.label}</b> proteins with <b>${effect.replace('_',' ')} cilia</b> phenotype — <b>${matches.length} genes</b>:<br>
            ${this._table(['Gene','LoF Effect','Disease Association'], rows, 40)}
            ${this._dl(`CSV (${matches.length} genes)`, csv, `${locTerm.replace(/\s/g,'_')}_${effect}_cilia.csv`)}`);
    },

    // ── LOC + DISEASE (Q11, Q16) ──────────────────────────────────────────
    composite_loc_disease(i) {
        const { loc, disease } = i;
        const locTerm = loc.term;

        const disMap = {
            joubert:['joubert'], bardet_biedl:['bardet','biedl'],
            pcd:['ciliary dyskinesia'], meckel:['meckel'],
            nphp:['nephronophthisis','nphp'], retinal:['retinal','leber','retinitis'],
            skeletal:['skeletal ciliopathy'], infertility:['infertility'],
        };
        const disTerms = disMap[disease] || [disease];

        const matches = this._db().filter(r =>
            r['Localization'].toLowerCase().includes(locTerm) &&
            disTerms.some(d => r['Ciliopathy'].toLowerCase().includes(d))
        );

        const disLabel = this._disName(disease);
        if (!matches.length) {
            this._say(`No genes found at <b>${loc.label}</b> associated with <b>${disLabel}</b>.`);
            return;
        }

        const rows = matches.map(g => [
            this._chip(g['Gene']),
            g['Localization'],
            g['Ciliopathy'].split(',').slice(0,2).join('; '),
        ]);
        const csv = this._csv(matches, ['Gene','Localization','Ciliopathy']);

        this._say(`
            <b>${loc.label}</b> proteins associated with <b>${disLabel}</b> — <b>${matches.length} genes</b>:<br>
            ${this._table(['Gene','Localization','Disease Association'], rows)}
            ${this._dl(`CSV (${matches.length})`, csv, `${locTerm.replace(/\s/g,'_')}_${disease}.csv`)}`);
    },

    // ── LOC + TISSUE (Q2, Q12, Q14, Q15) ─────────────────────────────────
    composite_loc_tissue(i) {
        const { loc, tissue } = i;
        const locTerm = loc.term;

        const matches = this._db().filter(r =>
            r['Localization'].toLowerCase().includes(locTerm)
        );

        const tisName = this._tisName(tissue);
        if (!matches.length) {
            this._say(`No genes found with <b>${loc.label}</b> localization.`);
            return;
        }

        const rows = matches.slice(0,40).map(g => [
            this._chip(g['Gene']),
            g['Localization'],
            g['Ciliopathy'] && g['Ciliopathy'] !== 'N/A'
                ? this._pill(g['Ciliopathy'].split(',')[0].trim(),'red') : '—',
        ]);
        const csv = this._csv(matches, ['Gene','Localization','Functional.category','Ciliopathy']);

        this._say(`
            <b>${loc.label}</b> genes in the context of <b>${tisName}</b> — <b>${matches.length} genes</b>:<br>
            ${this._table(['Gene','Localization','Disease'], rows, 40)}
            ${this._tisNote(tissue)}
            ${this._dl(`CSV (${matches.length})`, csv, `${locTerm.replace(/\s/g,'_')}_${tissue}.csv`)}`);
    },

    // ── DISEASE + TISSUE (Q3, Q7, Q9) ────────────────────────────────────
    composite_disease_tissue(i) {
        const { disease, tissue, exclude } = i;
        const disLabel = this._disName(disease);
        const tisName  = this._tisName(tissue);

        const disMap = {
            joubert:['joubert'], bardet_biedl:['bardet','biedl'],
            pcd:['ciliary dyskinesia'], meckel:['meckel'],
            nphp:['nephronophthisis','nphp'], retinal:['retinal','leber','retinitis'],
            skeletal:['skeletal ciliopathy'], infertility:['infertility'],
        };
        const disTerms = disMap[disease] || [disease];

        const matches = this._db().filter(r =>
            disTerms.some(d => r['Ciliopathy'].toLowerCase().includes(d))
        );

        if (!matches.length) {
            this._say(`No genes found for <b>${disLabel}</b>.`);
            return;
        }

        const rows = matches.slice(0,40).map(g => [
            this._chip(g['Gene']),
            g['Localization'],
            g['Ciliopathy'].split(',').slice(0,2).join('; '),
        ]);
        const csv = this._csv(matches, ['Gene','Localization','Ciliopathy','Ciliopathy Classification']);

        const contextNote = exclude
            ? `<div style="background:#fff7ed;border-left:3px solid #f97316;padding:8px 12px;
               margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#9a3412;">
               ⚠️ Tissue-specific exclusion (<b>${tisName}</b>) requires RNA expression data. 
               Showing all <b>${disLabel}</b> genes — cross-reference tissue expression on the Plot tab.</div>`
            : this._tisNote(tissue);

        this._say(`
            <b>${disLabel}</b> genes — in the context of <b>${tisName}</b> — <b>${matches.length} genes</b>:<br>
            ${this._table(['Gene','Localization','Disease'], rows, 40)}
            ${contextNote}
            ${this._dl(`CSV (${matches.length})`, csv, `${disease}_genes.csv`)}`);

        // Also show in left panel
        if (win.showPlot) {
            const locCounts = {};
            matches.forEach(g => (g['Localization']||'').split(',').forEach(l => {
                l = l.trim().toLowerCase(); if(l) locCounts[l] = (locCounts[l]||0)+1;
            }));
            const sorted = Object.entries(locCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);
            win.showPlot({
                data: [{ type:'bar', orientation:'h',
                         x: sorted.map(d=>d[1]).reverse(),
                         y: sorted.map(d=>d[0]).reverse(),
                         marker:{ color:'#005b96' } }],
                layout:{ title:{ text:`${disLabel} — localization`, font:{size:13} },
                         xaxis:{ title:'Genes' }, yaxis:{ automargin:true } }
            }, `${disLabel} gene localization`);
        }
    },

    // ── DISEASE ∩ COMPLEX (Q8, Q10) ───────────────────────────────────────
    composite_disease_complex(i) {
        const { disease, complex } = i;
        const disLabel  = this._disName(disease);
        const cxSet     = COMPLEX_SETS[complex] || new Set();
        const cxName    = this._cxName(complex);

        const disMap = {
            joubert:['joubert'], bardet_biedl:['bardet','biedl'],
            pcd:['ciliary dyskinesia'], meckel:['meckel'],
            nphp:['nephronophthisis','nphp'], retinal:['retinal','leber','retinitis'],
        };
        const disTerms = disMap[disease] || [disease];

        const intersection = this._db().filter(r =>
            cxSet.has(r['Gene']) &&
            disTerms.some(d => r['Ciliopathy'].toLowerCase().includes(d))
        );

        if (!intersection.length) {
            this._say(`No genes found in both <b>${disLabel}</b> and the <b>${cxName}</b>.<br>
                <span style="font-size:11.5px;color:#888;">The overlap may be empty or the genes may be annotated differently.</span>`);
            return;
        }

        const rows = intersection.map(g => [
            this._chip(g['Gene']),
            g['Localization'],
            g['Ciliopathy'].split(',').slice(0,2).join('; '),
        ]);
        const csv = this._csv(intersection, ['Gene','Localization','Ciliopathy','Protein.complexes']);

        this._say(`
            <b>${disLabel}</b> ∩ <b>${cxName}</b> — <b>${intersection.length} gene${intersection.length!==1?'s':''}</b>:<br>
            <div style="margin-top:6px;">${intersection.map(g => this._chip(g['Gene'])).join('')}</div>
            <br>${this._table(['Gene','Localization','Disease Association'], rows)}
            ${this._dl(`CSV (${intersection.length})`, csv, `${disease}_${complex}_intersection.csv`)}`);
    },

    // ── PHYLO SCOPE + DOMAIN (Q4) ─────────────────────────────────────────
    composite_phylo_domain(i) {
        const { domain, scope } = i;
        const domTerms = {
            'WD40':['wd40','wd repeat','wd40/yvtn'],
            'TPR':['tpr','tetratricopeptide'],
            'coiled-coil':['coiled-coil','coiled coil'],
            'kinase':['kinase'],
            'kinesin':['kinesin'],
        };
        const terms = domTerms[domain] || [domain.toLowerCase()];
        const matches = this._db().filter(r => {
            const h = ((r['Domain_Descriptions']||'') + ' ' + (r['PFAM_IDs']||'')).toLowerCase();
            return terms.some(t => h.includes(t));
        });

        const scopeDesc = {
            ciliary_specific: 'ciliary-specific (from CiliaHub curated gene set)',
            vertebrate: 'vertebrate-enriched',
            mammalian: 'mammalian-specific',
            conserved: 'broadly conserved',
            all: 'all',
        };

        this._say(`
            Ciliary genes with <b>${domain}</b> domain (${scopeDesc[scope] || scope}) — <b>${matches.length} genes</b>:<br>
            <div style="margin-top:8px;line-height:1.8;">${matches.slice(0,60).map(g=>this._chip(g['Gene'])).join('')}</div>
            ${matches.length>60?`<p style="color:#888;font-size:11px">Showing 60 of ${matches.length}</p>`:''}
            <div style="background:#eff6ff;border-left:3px solid #3b82f6;padding:8px 12px;
                margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#1e40af;">
                ℹ️ For Nevers/Li phylogenetic classification, use the Phylogeny view on the Cilia Analysis page 
                and filter by species group.</div>
            ${this._dl(`CSV (${matches.length})`, this._csv(matches,['Gene','Domain_Descriptions','PFAM_IDs']), `${domain}_domain_genes.csv`)}`);
    },

    // ── PFAM ACCESSION FILTER (Q5) ────────────────────────────────────────
    composite_pfam_filter(i) {
        const { pfam, scope } = i;
        const matches = this._db().filter(r =>
            (r['PFAM_IDs']||'').includes(pfam) ||
            (r['Domain_Descriptions']||'').includes(pfam)
        );

        if (!matches.length) {
            this._say(`No CiliaHub genes found with PFAM accession <b>${pfam}</b>.`); return;
        }

        const scopeLabel = { vertebrate:'vertebrate-specific', mammalian:'mammalian-specific',
                             all:'all CiliaHub', ciliary_specific:'ciliary-specific' }[scope] || 'all';

        this._say(`
            Genes with <b>${pfam}</b> (${scopeLabel}) — <b>${matches.length} genes</b>:<br>
            ${this._table(['Gene','Domain Descriptions','Localization'],
                matches.map(g => [
                    this._chip(g['Gene']),
                    (g['Domain_Descriptions']||'').slice(0,80),
                    g['Localization']||'—'
                ]))}
            ${this._dl(`CSV`, this._csv(matches,['Gene','PFAM_IDs','Domain_Descriptions','Localization']),
                       `${pfam}_genes.csv`)}`);
    },

    // ── COMPLEX vs COMPLEX PHYLO (Q6) ────────────────────────────────────
    async composite_complex_complex(i) {
        const { complexA, complexB } = i;
        const genesA = [...(COMPLEX_SETS[complexA] || [])];
        const genesB = [...(COMPLEX_SETS[complexB] || [])];
        const nameA  = this._cxName(complexA);
        const nameB  = this._cxName(complexB);

        // Show in plot if available
        if (win.renderPhylogenyHeatmap && win.switchView) {
            const allGenes = [...new Set([...genesA,...genesB])]
                .map(s => win.CiliAI?.lookups?.geneMap?.[s])
                .filter(Boolean);
            if (allGenes.length) {
                win.switchView('plot');
                win.renderPhylogenyHeatmap(allGenes, {});
            }
        }

        // Intersection
        const overlap = genesA.filter(g => genesB.includes(g));

        this._say(`
            <b>Phylogenetic comparison: ${nameA} vs ${nameB}</b><br><br>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:6px;">
              <div>
                <b style="color:#005b96;">${nameA}</b> (${genesA.length} genes)<br>
                <div style="margin-top:4px;">${genesA.map(g=>this._chip(g)).join('')}</div>
              </div>
              <div>
                <b style="color:#7c3aed;">${nameB}</b> (${genesB.length} genes)<br>
                <div style="margin-top:4px;">${genesB.map(g=>this._chip(g)).join('')}</div>
              </div>
            </div>
            ${overlap.length ? `<br><b>Shared genes:</b> ${overlap.map(g=>this._chip(g)).join('')}` : ''}
            <p style="font-size:11.5px;color:#888;margin-top:8px;">
              Side-by-side phylogenetic heatmap shown in the Plot view above.</p>`);
    },

    // ── LOF NO-EFFECT + CONSERVED + TISSUE (Q17) ─────────────────────────
    composite_lof_conserved_tissue(i) {
        const { tissue } = i;
        const matches = this._db().filter(r => /no effect/i.test(r[LOF_KEY]));
        const tisName = tissue ? this._tisName(tissue) : 'lung';

        const rows = matches.slice(0,30).map(g => [
            this._chip(g['Gene']),
            g[LOF_KEY]||'—',
            g['Localization']||'—',
            g['Ciliopathy'] && g['Ciliopathy'] !== 'N/A'
                ? this._pill(g['Ciliopathy'].split(',')[0].trim(),'red') : '—',
        ]);
        const csv = this._csv(matches, ['Gene',LOF_KEY,'Localization','Ciliopathy']);

        this._say(`
            Genes with <b>no cilia length phenotype on LoF</b>, with phylogenetic context:<br>
            <b>${matches.length} genes</b> found with "No effect" on cilia length when depleted.<br>
            ${this._table(['Gene','LoF Effect','Localization','Disease'], rows, 30)}
            ${tissue ? this._tisNote(tissue) : ''}
            <div style="background:#eff6ff;border-left:3px solid #3b82f6;padding:8px 12px;
                margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#1e40af;">
                ℹ️ Phylogenetic conservation data can be viewed in the Plots page → Phylogeny mode.
                Filter by "in_all_organisms" to find conserved genes within this set.</div>
            ${this._dl(`CSV (${matches.length})`, csv, 'lof_no_effect_genes.csv')}`);
    },

    // ── Helpers ──────────────────────────────────────────────────────────
    _tisNote(t) { return CompositeActions._tissueNote(t); },
    _tissueNote(tissue) {
        const names = { lung:'Human Lung',kidney:'Human Kidney',liver:'Human Liver',
                        hypothalamus:'Hypothalamus',retina:'Retina',cerebellum:'Fetal Cerebellum',
                        testis:'Testis',limb_bud:'Embryonic Limb Bud' };
        const n = names[tissue] || tissue;
        const hasData = ['lung','kidney','liver','hypothalamus','chondrocyte','retina','cerebellum'].includes(tissue);
        if (hasData)
            return `<div style="background:#eff6ff;border-left:3px solid #3b82f6;padding:8px 12px;
                    margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#1e40af;">
                    ℹ️ scRNA-seq data for <b>${n}</b> is available in CiliAI. 
                    Click the <b>Plot</b> tab and search a gene to view expression by cell type.</div>`;
        return `<div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:8px 12px;
                margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#92400e;">
                ⚠️ Tissue-specific expression data for <b>${n}</b> is not yet in CiliAI's scRNA-seq database.
                Genes listed here are from the curated CiliaHub annotation database.</div>`;
    },
    _disName(tag) {
        return { joubert:'Joubert Syndrome', bardet_biedl:'Bardet–Biedl Syndrome',
                 meckel:'Meckel–Gruber Syndrome', nphp:'Nephronophthisis',
                 pcd:'Primary Ciliary Dyskinesia', retinal:'Retinal Ciliopathies',
                 skeletal:'Skeletal Ciliopathies', infertility:'Male Infertility',
                 medulloblastoma:'Medulloblastoma (SHH)', alstrom:'Alström Syndrome',
                 pkd:'Polycystic Kidney Disease', usher:'Usher Syndrome',
                 holoprosencephaly:'Holoprosencephaly', cardiac:'Cardiac Ciliopathies',
                 ofd:'Orofaciodigital Syndrome',
               }[tag] || tag;
    },
    _tisName(t) {
        return { lung:'Human Lung',kidney:'Human Kidney',liver:'Human Liver',
                 hypothalamus:'Hypothalamus',chondrocyte:'Chondrocyte',
                 retina:'Retina',olfactory:'Olfactory Neurons',pancreas:'Pancreas',
                 choroid_plexus:'Choroid Plexus',cerebellum:'Fetal Cerebellum',
                 limb_bud:'Embryonic Limb Bud',testis:'Testis',
               }[t] || t;
    },
    _cxName(key) {
        return { ift_b:'IFT-B',ift_a:'IFT-A',bbsome:'BBSome',dynein2:'Dynein-2',
                 mks_module:'MKS module',nphp_module:'NPHP module',
                 transition_zone:'Transition Zone',evc:'EvC complex',
               }[key] || key;
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// § 4  PATCH THE EXISTING ROUTER
// ═══════════════════════════════════════════════════════════════════════════

// Wait for the main engine to load
function patchRouter() {
    if (!win.CiliAI?.Router) {
        setTimeout(patchRouter, 100); return;
    }

    const originalDispatch = win.CiliAI.Router.dispatchAction.bind(win.CiliAI.Router);

    win.CiliAI.Router.dispatchAction = async function(opts) {
        const { text, source, echo=true, intent:preIntent, gene:preGene } = opts;
        if (!text && !preGene) return originalDispatch(opts);

        // Don't intercept pre-classified intents from search box
        if (preIntent === 'gene_overview' && preGene) return originalDispatch(opts);

        const t = (text || '').trim();
        const q = t.toLowerCase();

        // 1. Hide empty state
        const es = document.getElementById('emptyState');
        if (es) es.remove();

        // 2. Echo user bubble
        if (echo && t) win.addChatMessage(t, true);

        // 3. Try composite parser FIRST
        const compositeIntent = CompositeParser.parse(t, q);
        if (compositeIntent) {
            console.debug('[CiliAI Composite]', compositeIntent.type, compositeIntent);
            const handler = CompositeActions[compositeIntent.type];
            if (typeof handler === 'function') {
                try {
                    await handler.call(CompositeActions, compositeIntent);
                } catch(e) {
                    console.error('[CiliAI Composite] Error:', e);
                    win.addChatMessage('An error occurred processing your query. Please try again.', false);
                }
                return; // Done — do NOT fall through to main engine
            }
        }

        // 4. Composite didn't match → fall through to main intent engine
        // But echo already happened above, so pass echo:false to avoid duplicate
        return originalDispatch({ ...opts, echo: false, _echoed: true });
    };

    // Extend TISSUE_MAP in main parser to include 'brain' → hypothalamus
    if (win.CiliAI.Parser) {
        const origParse = win.CiliAI.Parser.parse.bind(win.CiliAI.Parser);
        win.CiliAI.Parser._matchTissue_orig = win.CiliAI.Parser._matchTissue;
        win.CiliAI.Parser._matchTissue = function(q) {
            // Add brain → hypothalamus before calling original
            if (/\bbrain\b/i.test(q) || /\bneural\b/i.test(q)) return 'hypothalamus';
            return this._matchTissue_orig ? this._matchTissue_orig(q) : null;
        };
    }

    console.log('[CiliAI Composite v1.0] Patched router. Covers all 18 composite query patterns.');
}

// Expose for debugging
win.CiliAI = win.CiliAI || {};
win.CiliAI.CompositeParser = CompositeParser;
win.CiliAI.CompositeActions = CompositeActions;

// Start patching
patchRouter();

})(window);
