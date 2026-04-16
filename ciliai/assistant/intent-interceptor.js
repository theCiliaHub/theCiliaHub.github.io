/**
 * CiliAI Intent Interceptor v1.0
 * ─────────────────────────────────────────────────────────────────────────────
 * INSTALL — in index.html, place this script tag AFTER ciliai.js:
 *
 *   <script src="./ciliai/ciliai.js"></script>
 *   <script src="./ciliai/assistant/intent-interceptor.js"></script>  ← ADD HERE
 *
 * WHY: ciliai.js redefines window.handleAIQuery and window.CiliAI.Router on load.
 * Any script placed before it gets overwritten. This file loads after and patches
 * ciliai.js's own routing so our answers always fire first.
 *
 * HOW: Uses a polling install loop that waits until ciliai.js has finished its
 * initialization (detected by window.CiliAI.ready === true), then wraps the
 * routing function with our interceptor. DeepSeek is only called for queries
 * that our engine has no answer for.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

(function (win) {

// ═══════════════════════════════════════════════════════════════════════════
// § 1  DATA — grounded in actual CSV columns and gene counts
// ═══════════════════════════════════════════════════════════════════════════

// All possible keys ciliai.js may use for LOF — try them all
const LOF_KEYS = [
    'Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)',
    'lof_effects',
    'LoF_effects',
    'lof_effect',
    'loF_effects',
];
const LOF_KEY = LOF_KEYS[0]; // kept for csvLink field list

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

const DOMAIN_TERMS = {
    'WD40':       ['wd40','wd repeat','wd40/yvtn'],
    'TPR':        ['tpr','tetratricopeptide'],
    'coiled-coil':['coiled-coil','coiled coil'],
    'kinase':     ['kinase'],
    'kinesin':    ['kinesin'],
    'GTPase':     ['gtpase','g-protein gtpase'],
    'zinc finger':['zinc finger'],
    'AAA ATPase': ['aaa atpase','aaa+'],
    'armadillo':  ['armadillo'],
    'EF-hand':    ['ef-hand'],
    'LRR':        ['leucine-rich repeat'],
    'motor domain':['motor domain'],
    'dynein':     ['dynein'],
};

// ═══════════════════════════════════════════════════════════════════════════
// § 2  PATTERN MATCHER — returns structured intent or null
// ═══════════════════════════════════════════════════════════════════════════

function matchIntent(raw) {
    const t = raw.trim();
    const q = t.toLowerCase();

    return (
        matchDomainCount(q, t)         ||  // "how many WD40 genes"
        matchDomainList(q, t)          ||  // "which genes have WD40 domain"
        matchDomainEnrichment(q, t)    ||  // "what domains are enriched"
        matchLocPhenotype(q, t)        ||  // "basal body genes that shorten cilia"
        matchLocDisease(q, t)          ||  // "transition zone + Joubert"
        matchLocTissue(q, t)           ||  // "basal body genes in kidney"
        matchDiseaseTissue(q, t)       ||  // "Joubert genes in cerebellum"
        matchDiseaseComplex(q, t)      ||  // "BBS genes in IFT-B"
        matchComplexPhylo(q, t)        ||  // "BBSome vs IFT-A phylogeny"
        matchPhyloDomain(q, t)         ||  // "WD40 genes conserved in ciliates"
        matchPfamAccession(q, t)       ||  // "genes with PF13432"
        matchLofConservedTissue(q, t)  ||  // "no-effect genes conserved + lung"
        matchLofGene(q, t)             ||  // "what is the LOF effect of KIF3A"
        matchSelfIntro(q, t)           ||  // "what can you do"
        matchDomainGene(q, t)          ||  // "what domains does IFT88 have"
        null
    );
}

// ── Shared extractors ─────────────────────────────────────────────────────

const STOP = new Set(['DNA','RNA','AND','THE','FOR','ARE','ALL','ANY',
                      'SHOW','TELL','LIST','PLOT','FROM','WHAT','WHERE',
                      'DOES','HAVE','FIND','GENE','GENES','WITH','ALSO',
                      'BOTH','ONLY','WHEN','BEEN','THAN','THAT','THIS',
                      'WHICH','THESE','SOME','MORE','MANY','MUCH','MOST']);

function extractGenes(text) {
    return [...new Set(
        (text.match(/\b[A-Z][A-Z0-9]{1,11}\b/g) || [])
        .filter(g => !STOP.has(g) && g.length >= 3)
    )];
}

function matchDomain(q) {
    for (const [fam, terms] of Object.entries(DOMAIN_TERMS))
        if (terms.some(t => q.includes(t))) return fam;
    return null;
}

function matchLoc(q) {
    // Longest match first
    const locs = [
        ['transition zone', {term:'transition zone', label:'Transition Zone'}],
        ['ciliary axoneme', {term:'axoneme',          label:'Axoneme'}],
        ['ciliary tip',     {term:'ciliary tip',       label:'Ciliary Tip'}],
        ['ciliary membrane',{term:'ciliary membrane',  label:'Ciliary Membrane'}],
        ['basal body',      {term:'basal body',        label:'Basal Body'}],
        ['motile cilia',    {term:'motile cilia',       label:'Motile Cilia'}],
        ['centrosome',      {term:'centrosome',         label:'Centrosome'}],
        ['mitochondria',    {term:'mitochondria',       label:'Mitochondria'}],
        ['lysosom',         {term:'lysosom',            label:'Lysosomes'}],
        ['axoneme',         {term:'axoneme',            label:'Axoneme'}],
        ['flagella',        {term:'flagella',           label:'Flagella / Axoneme'}],
        ['nucleus',         {term:'nucleus',            label:'Nucleus'}],
        ['cytosol',         {term:'cytosol',            label:'Cytosol'}],
        ['cilia',           {term:'cilia',              label:'Cilia'}],
    ];
    for (const [kw, info] of locs)
        if (q.includes(kw)) return info;
    return null;
}

function matchDisease(q) {
    const patterns = [
        ['joubert','joubert'], ['bardet','bardet_biedl'], ['biedl','bardet_biedl'],
        ['bardet-biedl','bardet_biedl'], ['bardet–biedl','bardet_biedl'],
        [/\bbbs\b/,'bardet_biedl'],
        ['meckel','meckel'], ['nephronophthisis','nphp'], [/\bnphp\b/,'nphp'],
        ['primary ciliary dyskinesia','pcd'], ['ciliary dyskinesia','pcd'],
        [/\bpcd\b/,'pcd'],
        ['leber congenital amaurosis','retinal'], ['leber','retinal'],
        ['retinitis pigmentosa','retinal'], ['retinal ciliopathy','retinal'],
        ['retinal degeneration','retinal'], ['cone-rod dystrophy','retinal'],
        ['skeletal ciliopathy','skeletal'], ['ellis-van creveld','skeletal'],
        ['male infertility','infertility'], ['infertility','infertility'],
        ['polydactyly','polydactyly'], ['alstr','alstrom'],
        ['polycystic kidney','pkd'], [/\bpkd\b/,'pkd'],
        ['usher','usher'], ['holoprosencephaly','holoprosencephaly'],
        ['medulloblastoma','medulloblastoma'],
    ];
    for (const [pat, tag] of patterns)
        if (pat instanceof RegExp ? pat.test(q) : q.includes(pat)) return tag;
    return null;
}

function matchTissue(q) {
    const T = [
        ['cerebellum',   'cerebellum'], ['cerebellar',   'cerebellum'],
        ['hypothalamus', 'hypothalamus'], ['brain',      'hypothalamus'],
        ['neural',       'hypothalamus'],
        ['kidney',       'kidney'], ['renal',          'kidney'],
        ['lung',         'lung'], ['airway',           'lung'], ['pulmonary','lung'],
        ['liver',        'liver'], ['hepat',           'liver'],
        ['retina',       'retina'], ['retinal cell',   'retina'],
        ['olfactory',    'olfactory'],
        ['pancrea',      'pancreas'],
        ['chondrocyte',  'chondrocyte'],
        ['testis',       'testis'], ['testicular',     'testis'],
        ['limb bud',     'limb_bud'], ['limb',         'limb_bud'],
    ];
    for (const [kw, key] of T)
        if (q.includes(kw)) return key;
    return null;
}

function matchComplex(q) {
    const C = [
        ['ift-b complex','ift_b'], ['ift complex b','ift_b'], ['ift b complex','ift_b'],
        ['ift-b','ift_b'],
        ['ift-a complex','ift_a'], ['ift complex a','ift_a'], ['ift a complex','ift_a'],
        ['ift-a','ift_a'],
        ['bbsome complex','bbsome'], ['bbs complex','bbsome'], ['bbsome','bbsome'],
        ['mks complex','mks_module'], ['mks module','mks_module'], [' mks ','mks_module'],
        ['nphp complex','nphp_module'], ['nphp module','nphp_module'],
        ['dynein-2','dynein2'], ['dynein 2','dynein2'],
        ['transition zone complex','transition_zone'],
    ];
    for (const [pat, key] of C)
        if (q.includes(pat)) return key;
    return null;
}

function matchLOFEffect(q) {
    if (/shorter cilia|short cilia|shorten|cilia shortening|short cilium/i.test(q)) return 'shorter';
    if (/longer cilia|elongat|lengthen/i.test(q)) return 'longer';
    if (/loss of cilia|no cilia|absent cilia|ciliogenesis blocked/i.test(q)) return 'loss';
    if (/no effect|no phenotype/i.test(q)) return 'no_effect';
    if (/motility defect|immotile/i.test(q)) return 'motility';
    if (/knocked down|knockdown|depletion|when.*depleted/i.test(q)) return 'knockdown';
    return null;
}

// ── Individual matchers ───────────────────────────────────────────────────

function matchDomainCount(q, t) {
    const dom = matchDomain(q);
    if (!dom) return null;
    if (!/how many|count|number of/i.test(q)) return null;
    return { type:'domain_count', domain:dom };
}

function matchDomainList(q, t) {
    const dom = matchDomain(q);
    if (!dom) return null;
    if (!/which genes|what genes|list|show|proteins with|genes with|genes containing|containing/i.test(q)) return null;
    // NOT a single-gene domain query
    if (/what domains does|domains of|domain structure of/i.test(q)) return null;
    return { type:'domain_list', domain:dom };
}

function matchDomainEnrichment(q, t) {
    if (!/domain/i.test(q)) return null;
    if (!/enrich|common|frequent|overrepresent|top domain/i.test(q)) return null;
    return { type:'domain_enrichment' };
}

function matchDomainGene(q, t) {
    if (!/what domains|domains of|domain structure|domain architecture|domains does|domains in|has.*domain/i.test(q)) return null;
    const genes = extractGenes(t);
    if (!genes.length) return null;
    return { type:'domain_gene', gene:genes[0] };
}

function matchLofGene(q, t) {
    if (!/lof|loss.of.function|knockout|knock.out|knock.down|knockdown|phenotype|effect.*of|what does.*do|what happen/i.test(q)) return null;
    const genes = extractGenes(t);
    if (genes.length !== 1) return null;
    return { type:'lof_gene', gene:genes[0] };
}

// Q1, Q18: LOC + LOF (must have BOTH)
function matchLocPhenotype(q, t) {
    const loc = matchLoc(q);
    const effect = matchLOFEffect(q);
    if (!loc || !effect) return null;
    // Don't fire if this is also disease+complex (let those handle)
    return { type:'loc_phenotype', loc, effect };
}

// Q11, Q16: LOC + disease (no LOF effect)
function matchLocDisease(q, t) {
    const loc = matchLoc(q);
    const disease = matchDisease(q);
    if (!loc || !disease) return null;
    if (matchLOFEffect(q)) return null;  // Let loc_phenotype handle instead
    const tissue = matchTissue(q);
    if (tissue && tissue !== 'testis') return null;  // Let loc_tissue handle
    return { type:'loc_disease', loc, disease };
}

// Q2, Q12, Q14, Q15: LOC + tissue (no disease, no LOF)
function matchLocTissue(q, t) {
    const loc = matchLoc(q);
    const tissue = matchTissue(q);
    if (!loc || !tissue || tissue === 'testis') return null;
    if (matchDisease(q)) return null;
    if (matchLOFEffect(q)) return null;
    return { type:'loc_tissue', loc, tissue };
}

// Q3, Q7, Q9, Q13: disease + tissue (no LOC)
function matchDiseaseTissue(q, t) {
    const disease = matchDisease(q);
    const tissue = matchTissue(q);
    if (!disease || !tissue) return null;
    if (matchLoc(q)) return null;  // Let loc_disease handle
    const exclude = tissue === 'testis' || /not expressed|not in|absent|exclude/i.test(q);
    return { type:'disease_tissue', disease, tissue, exclude };
}

// Q8, Q10: disease ∩ complex
function matchDiseaseComplex(q, t) {
    const disease = matchDisease(q);
    const complex = matchComplex(q);
    if (!disease || !complex) return null;
    return { type:'disease_complex', disease, complex };
}

// Q6: compare two complexes phylogenetically
function matchComplexPhylo(q, t) {
    if (!/compare|versus|\bvs\b|side.by.side/i.test(q)) return null;
    if (!/phylogen|conserv|evol/i.test(q)) return null;
    const keys = [];
    const C = [['ift-b','ift_b'],['ift-a','ift_a'],['bbsome','bbsome'],
                ['bbs complex','bbsome'],['mks','mks_module'],['nphp','nphp_module'],
                ['dynein-2','dynein2'],['transition zone','transition_zone']];
    for (const [pat, key] of C)
        if (q.includes(pat) && !keys.includes(key)) keys.push(key);
    if (keys.length < 2) return null;
    return { type:'complex_phylo_compare', complexA:keys[0], complexB:keys[1] };
}

// Q4: phylo scope + domain
function matchPhyloDomain(q, t) {
    if (!/conserv|phylogen|ciliary.specific|vertebrate.specific/i.test(q)) return null;
    const dom = matchDomain(q);
    if (!dom) return null;
    let scope = 'ciliary_specific';
    if (/vertebrate/i.test(q)) scope = 'vertebrate';
    if (/mammalian/i.test(q)) scope = 'mammalian';
    return { type:'phylo_domain', domain:dom, scope };
}

// Q5: PFAM accession filter
function matchPfamAccession(q, t) {
    const m = t.match(/\bPF\d{5}\b/);
    if (!m) return null;
    let scope = 'all';
    if (/vertebrate/i.test(q)) scope = 'vertebrate';
    if (/mammalian/i.test(q)) scope = 'mammalian';
    return { type:'pfam_filter', pfam:m[0], scope };
}

// Q17: LOF no-effect + conserved + tissue
function matchLofConservedTissue(q, t) {
    if (!/no.effect|no.*phenotype/i.test(q)) return null;
    if (!/conserv|phylogen/i.test(q)) return null;
    const tissue = matchTissue(q);
    return { type:'lof_conserved_tissue', tissue };
}

function matchSelfIntro(q, t) {
    if (!/what can you do|tell me about yourself|what are you|capabilities|what information|what datasets|how can you help/i.test(q)) return null;
    return { type:'self_intro' };
}

// ═══════════════════════════════════════════════════════════════════════════
// § 3  RESPONSE BUILDERS
// ═══════════════════════════════════════════════════════════════════════════

function db() { return win.CiliAI?.masterData || []; }

// Resolve LOF value from a gene row — tries all possible key names and value formats
function getLOF(row) {
    for (const key of LOF_KEYS) {
        const v = row[key];
        if (v && typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
}

// Resolve Localization — also handles 'localization' lowercase key
function getLoc(row) {
    return (row['Localization'] || row['localization'] || '').toLowerCase();
}

// Broad LOF effect test — handles 'Shorter cilia', 'shorter', 'shorter_cilia', 'Shorter Cilia'
function lofMatches(row, effect) {
    const v = getLOF(row).toLowerCase();
    if (!v || v.includes('not reported') || v.includes('not report')) return false;
    switch (effect) {
        case 'shorter':   return /shorter|short.cilia|short cilium|cilia.*short/i.test(v);
        case 'longer':    return /longer|long.cilia|elongat/i.test(v);
        case 'loss':      return /loss.of.cilia|no.cilia|absent.cilia|blocked|abolished|failure/i.test(v);
        case 'no_effect': return /^no.effect$|^no_effect$/i.test(v.trim()) || v === 'no effect';
        case 'motility':  return /motility/i.test(v);
        case 'knockdown': return true; // any reported effect
        default:          return v.includes(effect.toLowerCase());
    }
}

function pill(text, color) {
    const C = { blue:['#dbeafe','#1e40af'], red:['#fee2e2','#991b1b'],
                green:['#dcfce7','#166534'], amber:['#fef3c7','#92400e'],
                purple:['#ede9fe','#5b21b6'], gray:['#f3f4f6','#374151'],
                teal:['#ccfbf1','#0f766e'] };
    const [bg,fg] = C[color] || C.gray;
    return `<span style="background:${bg};color:${fg};padding:2px 7px;border-radius:8px;
            font-size:10.5px;font-weight:600;white-space:nowrap;display:inline-block;margin:1px;">${text}</span>`;
}

function chip(sym) {
    const s = sym.replace(/'/g,"\\'");
    return `<span onclick="(window.CiliAI?.Router?.dispatchAction||window.handleAIQuery||function(){})( typeof window.CiliAI?.Router?.dispatchAction==='function' ? {text:'${s}',echo:false} : '${s}')"
                  style="background:#e6f2fb;color:#005b96;border:1px solid #b3cde0;
                         margin:2px;padding:4px 10px;border-radius:12px;
                         font-size:11.5px;font-weight:600;cursor:pointer;display:inline-block;">${sym}</span>`;
}

function table(headers, rows, max=50) {
    const shown = rows.slice(0,max);
    const more = rows.length>max ? `<p style="color:#888;font-size:11px;margin-top:4px;">Showing ${max} of ${rows.length} genes.</p>` : '';
    return `<div style="overflow-x:auto;margin-top:8px;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr>${headers.map(h=>
            `<th style="padding:7px 10px;text-align:left;background:#f1f5f9;border-bottom:2px solid #e2e8f0;color:#475569;font-weight:700;">${h}</th>`
          ).join('')}</tr></thead>
          <tbody>${shown.map((r,i)=>
            `<tr style="background:${i%2?'#f8fafc':'white'};border-bottom:1px solid #f1f5f9;">
               ${r.map(c=>`<td style="padding:6px 10px;vertical-align:top;">${c}</td>`).join('')}
             </tr>`
          ).join('')}</tbody>
        </table></div>${more}`;
}

function csvLink(genes, fields, filename) {
    const hdr = fields.join(',');
    const body = genes.map(g => fields.map(f=>`"${String(g[f]||'').replace(/"/g,'""')}"`).join(','));
    const csv = [hdr,...body].join('\n');
    return `<a href="data:text/csv;charset=utf-8,${encodeURIComponent(csv)}" download="${filename}"
               style="display:inline-block;margin-top:8px;padding:6px 14px;background:#005b96;
                      color:white;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;">
               ⬇ Download CSV (${genes.length} genes)</a>`;
}

function tisNote(tissue) {
    const names = {lung:'Lung',kidney:'Kidney',liver:'Liver',hypothalamus:'Hypothalamus',
                   retina:'Retina',cerebellum:'Cerebellum',chondrocyte:'Chondrocyte',
                   testis:'Testis',limb_bud:'Limb Bud'};
    const n = names[tissue] || tissue;
    const has = ['lung','kidney','liver','hypothalamus','chondrocyte','retina','cerebellum'].includes(tissue);
    return has
        ? `<div style="background:#eff6ff;border-left:3px solid #3b82f6;padding:8px 12px;
           margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#1e40af;">
           ℹ️ scRNA-seq expression data for <b>${n}</b> is available in CiliAI.
           Click the <b>Plot</b> tab and search a gene symbol to view expression by cell type.</div>`
        : `<div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:8px 12px;
           margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#92400e;">
           ⚠️ Tissue-specific expression data for <b>${n}</b> is not yet loaded in CiliAI.
           The gene list below comes from the curated CiliaHub annotation database.</div>`;
}

function disName(tag) {
    return { joubert:'Joubert Syndrome', bardet_biedl:'Bardet–Biedl Syndrome',
             meckel:'Meckel–Gruber Syndrome', nphp:'Nephronophthisis',
             pcd:'Primary Ciliary Dyskinesia', retinal:'Retinal Ciliopathies',
             skeletal:'Skeletal Ciliopathies', infertility:'Male Infertility',
             medulloblastoma:'Medulloblastoma (SHH)', alstrom:'Alström Syndrome',
             pkd:'Polycystic Kidney Disease', usher:'Usher Syndrome',
             holoprosencephaly:'Holoprosencephaly', polydactyly:'Polydactyly' }[tag] || tag;
}

function tisName(t) {
    return { lung:'Human Lung',kidney:'Human Kidney',liver:'Human Liver',
             hypothalamus:'Hypothalamus (Brain)',chondrocyte:'Chondrocyte',
             retina:'Retina',cerebellum:'Fetal Cerebellum',
             testis:'Testis',limb_bud:'Embryonic Limb Bud' }[t] || t;
}

function cxName(k) {
    return { ift_b:'IFT-B',ift_a:'IFT-A',bbsome:'BBSome',dynein2:'Dynein-2',
             mks_module:'MKS module',nphp_module:'NPHP module',
             transition_zone:'Transition Zone',evc:'EvC complex' }[k] || k;
}

function disTerms(tag) {
    return { joubert:['joubert'], bardet_biedl:['bardet','biedl'],
             pcd:['ciliary dyskinesia'], meckel:['meckel'],
             nphp:['nephronophthisis','nphp'],
             retinal:['retinal','leber','retinitis','cone-rod'],
             skeletal:['skeletal ciliopathy','ellis-van','jeune','short-rib'],
             infertility:['infertility'], polydactyly:['polydactyly'],
             medulloblastoma:['medulloblastoma'], usher:['usher'],
             holoprosencephaly:['holoprosencephaly'],
           }[tag] || [tag];
}

function hasDomain(row, family) {
    const haystack = ((row['Domain_Descriptions']||'') + ' ' + (row['PFAM_IDs']||'')).toLowerCase();
    return (DOMAIN_TERMS[family] || [family.toLowerCase()]).some(t => haystack.includes(t));
}

// ═══════════════════════════════════════════════════════════════════════════
// § 4  DISPATCH — runs the matched intent and returns HTML string
// ═══════════════════════════════════════════════════════════════════════════

function dispatch(intent) {
    const { type } = intent;

    // ── DOMAIN COUNT (Q: "how many WD40 proteins") ─────────────────────
    if (type === 'domain_count') {
        const matches = db().filter(r => hasDomain(r, intent.domain));
        return `There are <b>${matches.length} ciliary genes</b> in CiliaHub with a 
                <b>${intent.domain}</b> domain.<br>
                <span style="font-size:11.5px;color:#888;">
                Ask "<i>list genes with ${intent.domain} domains</i>" to see the full list.</span>`;
    }

    // ── DOMAIN LIST (Q: "which genes have WD40 domains") ───────────────
    if (type === 'domain_list') {
        const matches = db().filter(r => hasDomain(r, intent.domain));
        if (!matches.length) return `No genes found with <b>${intent.domain}</b> domain in CiliaHub.`;
        return `<b>${intent.domain} domain</b> — <b>${matches.length} genes</b>:<br>
                <div style="margin-top:8px;line-height:1.8;">${matches.slice(0,60).map(g=>chip(g['Gene'])).join('')}</div>
                ${matches.length>60?`<p style="color:#888;font-size:11px">Showing 60 of ${matches.length}</p>`:''}
                ${csvLink(matches,['Gene','Domain_Descriptions','PFAM_IDs','Localization'],`${intent.domain}_genes.csv`)}`;
    }

    // ── DOMAIN ENRICHMENT ───────────────────────────────────────────────
    if (type === 'domain_enrichment') {
        const counts = {};
        db().forEach(r => {
            Object.keys(DOMAIN_TERMS).forEach(fam => {
                if (hasDomain(r, fam)) counts[fam] = (counts[fam]||0)+1;
            });
        });
        const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
        return `<b>Most common protein domains in CiliaHub</b> (${db().length} genes total):<br>
                ${table(['Domain Family','Gene Count'], sorted.map(([d,n])=>[pill(d,'purple'), n]))}`;
    }

    // ── DOMAIN FOR SINGLE GENE ──────────────────────────────────────────
    if (type === 'domain_gene') {
        const g = (win.CiliAI?.lookups?.geneMap || {})[intent.gene.toUpperCase()];
        if (!g) return `Gene <b>${intent.gene}</b> not found in CiliaHub.`;
        const desc = g['Domain_Descriptions'] || '';
        const pfam = g['PFAM_IDs'] || '';
        const parts = (desc + (pfam ? (';'+pfam) : '')).split(/[,;]/).map(s=>s.trim()).filter(Boolean);
        if (win.showDomainViewer) win.showDomainViewer(intent.gene);
        return `<b>${intent.gene}</b> protein domains:<br>
                <div style="margin-top:6px;">${parts.length
                    ? parts.map(d=>pill(d,'purple')).join(' ')
                    : '<span style="color:#aaa">No domain data available.</span>'}</div>
                <small style="color:#888;display:block;margin-top:4px;">Diagram shown in the Domains view ↑</small>`;
    }

    // ── LOC + PHENOTYPE — Q1, Q18 ───────────────────────────────────────
    if (type === 'loc_phenotype') {
        const { loc, effect } = intent;
        const matches = db().filter(r =>
            getLoc(r).includes(loc.term) && lofMatches(r, effect)
        );
        if (!matches.length) return `No <b>${loc.label}</b> genes found with <b>${effect.replace('_',' ')}</b> cilia phenotype.`;
        return `<b>${loc.label}</b> genes with <b>${effect.replace('_',' ')}</b> cilia phenotype — <b>${matches.length} genes</b>:<br>
                ${table(['Gene','LoF Effect','Disease'],
                    matches.slice(0,40).map(g=>[
                        chip(g['Gene']),
                        getLOF(g) || '—',
                        g['Ciliopathy']&&g['Ciliopathy']!=='N/A' ? pill(g['Ciliopathy'].split(',')[0].trim(),'red') : '—'
                    ]), 40)}
                ${csvLink(matches,['Gene','Localization','Ciliopathy'],`${loc.term.replace(/\s/g,'_')}_${effect}.csv`)}`;
    }

    // ── LOC + DISEASE — Q11, Q16 ────────────────────────────────────────
    if (type === 'loc_disease') {
        const { loc, disease } = intent;
        const terms = disTerms(disease);
        const matches = db().filter(r =>
            getLoc(r).includes(loc.term) &&
            terms.some(d => (r['Ciliopathy']||'').toLowerCase().includes(d))
        );
        if (!matches.length) return `No <b>${loc.label}</b> genes found associated with <b>${disName(disease)}</b>.`;
        return `<b>${loc.label}</b> genes associated with <b>${disName(disease)}</b> — <b>${matches.length} genes</b>:<br>
                ${table(['Gene','Localization','Disease'],
                    matches.map(g=>[chip(g['Gene']), g['Localization'], g['Ciliopathy'].split(',').slice(0,2).join('; ')]))}
                ${csvLink(matches,['Gene','Localization','Ciliopathy'],`${loc.term.replace(/\s/g,'_')}_${disease}.csv`)}`;
    }

    // ── LOC + TISSUE — Q2, Q12, Q14, Q15 ────────────────────────────────
    if (type === 'loc_tissue') {
        const { loc, tissue } = intent;
        const matches = db().filter(r => getLoc(r).includes(loc.term));
        if (!matches.length) return `No genes found with <b>${loc.label}</b> localization.`;
        return `<b>${loc.label}</b> genes (in the context of <b>${tisName(tissue)}</b>) — <b>${matches.length} genes</b>:<br>
                ${table(['Gene','Localization','Disease'],
                    matches.slice(0,40).map(g=>[
                        chip(g['Gene']),
                        g['Localization'],
                        g['Ciliopathy']&&g['Ciliopathy']!=='N/A' ? pill(g['Ciliopathy'].split(',')[0].trim(),'red') : '—'
                    ]), 40)}
                ${tisNote(tissue)}
                ${csvLink(matches,['Gene','Localization','Functional.category','Ciliopathy'],`${loc.term.replace(/\s/g,'_')}_${tissue}.csv`)}`;
    }

    // ── DISEASE + TISSUE — Q3, Q7, Q9, Q13 ──────────────────────────────
    if (type === 'disease_tissue') {
        const { disease, tissue, exclude } = intent;
        const terms = disTerms(disease);
        const matches = db().filter(r => terms.some(d => r['Ciliopathy'].toLowerCase().includes(d)));
        if (!matches.length) return `No genes found for <b>${disName(disease)}</b>.`;

        // Show left-panel bar chart
        if (win.showPlot) {
            const locCounts = {};
            matches.forEach(g => (g['Localization']||'').split(',').forEach(l => {
                l=l.trim().toLowerCase(); if(l) locCounts[l]=(locCounts[l]||0)+1;
            }));
            const sorted = Object.entries(locCounts).sort((a,b)=>b[1]-a[1]).slice(0,12);
            win.showPlot({
                data:[{type:'bar',orientation:'h',
                       x:sorted.map(d=>d[1]).reverse(),
                       y:sorted.map(d=>d[0]).reverse(),
                       marker:{color:'#005b96'}}],
                layout:{title:{text:`${disName(disease)} — localization`,font:{size:13}},
                        xaxis:{title:'Genes'},yaxis:{automargin:true}}
            }, `${disName(disease)} gene localization`);
        }

        const exclusionNote = exclude
            ? `<div style="background:#fff7ed;border-left:3px solid #f97316;padding:8px 12px;
               margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#9a3412;">
               ⚠️ Tissue-specific exclusion for <b>${tisName(tissue)}</b> requires RNA expression data
               not yet available in CiliAI. All <b>${disName(disease)}</b> genes are listed below.
               Cross-reference tissue expression using the Plot tab.</div>`
            : tisNote(tissue);

        return `<b>${disName(disease)}</b> genes in the context of <b>${tisName(tissue)}</b> — <b>${matches.length} genes</b>:<br>
                ${table(['Gene','Localization','Disease'],
                    matches.slice(0,40).map(g=>[
                        chip(g['Gene']),
                        g['Localization'],
                        g['Ciliopathy'].split(',').slice(0,2).join('; ')
                    ]), 40)}
                ${exclusionNote}
                ${csvLink(matches,['Gene','Localization','Ciliopathy','Ciliopathy Classification'],`${disease}_genes.csv`)}`;
    }

    // ── DISEASE ∩ COMPLEX — Q8, Q10 ──────────────────────────────────────
    if (type === 'disease_complex') {
        const { disease, complex } = intent;
        const cxSet = COMPLEX_SETS[complex] || new Set();
        const terms = disTerms(disease);
        const matches = db().filter(r =>
            cxSet.has(r['Gene']) && terms.some(d => r['Ciliopathy'].toLowerCase().includes(d))
        );
        if (!matches.length)
            return `No genes are both in <b>${cxName(complex)}</b> and associated with <b>${disName(disease)}</b>.<br>
                    <span style="font-size:11.5px;color:#888;">The overlap may be empty or genes may be annotated differently in CiliaHub.</span>`;
        return `<b>${disName(disease)}</b> ∩ <b>${cxName(complex)}</b> — <b>${matches.length} gene${matches.length!==1?'s':''}</b>:<br>
                <div style="margin-top:6px;">${matches.map(g=>chip(g['Gene'])).join('')}</div><br>
                ${table(['Gene','Localization','Disease'],
                    matches.map(g=>[chip(g['Gene']), g['Localization'], g['Ciliopathy'].split(',').slice(0,2).join('; ')]))}
                ${csvLink(matches,['Gene','Localization','Ciliopathy','Protein.complexes'],`${disease}_${complex}.csv`)}`;
    }

    // ── COMPLEX vs COMPLEX PHYLO — Q6 ────────────────────────────────────
    if (type === 'complex_phylo_compare') {
        const { complexA, complexB } = intent;
        const genesA = [...(COMPLEX_SETS[complexA] || [])];
        const genesB = [...(COMPLEX_SETS[complexB] || [])];
        const overlap = genesA.filter(g => genesB.includes(g));

        if (win.renderPhylogenyHeatmap && win.switchView) {
            const allGenes = [...new Set([...genesA,...genesB])]
                .map(s => (win.CiliAI?.lookups?.geneMap||{})[s]).filter(Boolean);
            if (allGenes.length) { win.switchView('plot'); win.renderPhylogenyHeatmap(allGenes, {}); }
        }

        return `<b>Phylogenetic comparison: ${cxName(complexA)} vs ${cxName(complexB)}</b><br><br>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                  <div><b style="color:#005b96;">${cxName(complexA)}</b> (${genesA.length} genes)<br>
                    <div style="margin-top:4px;">${genesA.map(g=>chip(g)).join('')}</div>
                  </div>
                  <div><b style="color:#7c3aed;">${cxName(complexB)}</b> (${genesB.length} genes)<br>
                    <div style="margin-top:4px;">${genesB.map(g=>chip(g)).join('')}</div>
                  </div>
                </div>
                ${overlap.length ? `<br><b>Shared genes:</b> ${overlap.map(g=>chip(g)).join('')}` : ''}
                <p style="font-size:11.5px;color:#888;margin-top:8px;">Phylogenetic heatmap shown in the Plot view.</p>`;
    }

    // ── PHYLO + DOMAIN — Q4 ───────────────────────────────────────────────
    if (type === 'phylo_domain') {
        const matches = db().filter(r => hasDomain(r, intent.domain));
        return `Ciliary genes with <b>${intent.domain}</b> domain — <b>${matches.length} genes</b>:<br>
                <div style="margin-top:8px;line-height:1.8;">${matches.slice(0,60).map(g=>chip(g['Gene'])).join('')}</div>
                ${matches.length>60?`<p style="color:#888;font-size:11px">Showing 60 of ${matches.length}</p>`:''}
                <div style="background:#eff6ff;border-left:3px solid #3b82f6;padding:8px 12px;
                    margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#1e40af;">
                    ℹ️ For Nevers/Li phylogenetic classification by species group, use the 
                    <b>Phylogeny</b> tab on the Cilia Analysis page.</div>
                ${csvLink(matches,['Gene','Domain_Descriptions','PFAM_IDs'],`${intent.domain}_ciliary_genes.csv`)}`;
    }

    // ── PFAM ACCESSION — Q5 ───────────────────────────────────────────────
    if (type === 'pfam_filter') {
        const matches = db().filter(r =>
            (r['PFAM_IDs']||'').includes(intent.pfam) ||
            (r['Domain_Descriptions']||'').includes(intent.pfam)
        );
        if (!matches.length) return `No CiliaHub genes found with PFAM accession <b>${intent.pfam}</b>.`;
        return `Genes with PFAM <b>${intent.pfam}</b> — <b>${matches.length} genes</b>:<br>
                ${table(['Gene','Domain Descriptions','Localization'],
                    matches.map(g=>[chip(g['Gene']),(g['Domain_Descriptions']||'').slice(0,80), g['Localization']||'—']))}
                ${csvLink(matches,['Gene','PFAM_IDs','Domain_Descriptions','Localization'],`${intent.pfam}_genes.csv`)}`;
    }

    // ── LOF NO-EFFECT + CONSERVED + TISSUE — Q17 ─────────────────────────
    if (type === 'lof_conserved_tissue') {
        const matches = db().filter(r => lofMatches(r, 'no_effect'));
        return `Genes with <b>no cilia length phenotype</b> on LoF — <b>${matches.length} genes</b>:<br>
                ${table(['Gene','LoF Effect','Localization'],
                    matches.slice(0,30).map(g=>[chip(g['Gene']), getLOF(g)||'—', getLoc(g)||'—']), 30)}
                ${intent.tissue ? tisNote(intent.tissue) : ''}
                <div style="background:#eff6ff;border-left:3px solid #3b82f6;padding:8px 12px;
                    margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#1e40af;">
                    ℹ️ For conservation filtering, use the <b>Phylogeny</b> tab on the Cilia Analysis page
                    and select "in_all_organisms".</div>
                ${csvLink(matches,['Gene','Localization','Ciliopathy'],'lof_no_effect_genes.csv')}`;
    }

    // ── LOF EFFECT FOR SINGLE GENE — Q2: "What is the LOF effect of KIF3A?" ──
    if (type === 'lof_gene') {
        const gmap = win.CiliAI?.lookups?.geneMap || {};
        const g = gmap[intent.gene.toUpperCase()];
        if (!g) return `Gene <b>${intent.gene}</b> not found in CiliaHub.`;

        const lof = getLOF(g) || 'Not reported';
        const oe  = (g['Overexpression effects on cilia length (increase/decrease/no effect)'] ||
                     g['overexpression_effects'] || 'Not reported');
        const pct = (g['Percentage of ciliated cells (increase/decrease/no effect)'] ||
                     g['percent_ciliated_cells_effects'] || 'Not reported');
        const loc = g['Localization'] || g['localization'] || '—';
        const dis = g['Ciliopathy'] || g['Ciliopathies'] || '—';
        const sum = g['Functional.Summary.from.Literature'] || g['functional_summary'] ||
                    g['Gene.Description'] || g['description'] || '';

        return `<b style="font-size:15px;color:#005b96;">${intent.gene}</b>
                — Cilia Phenotype Summary<br><br>
                ${sum ? `<p style="font-size:12.5px;color:#334155;line-height:1.5;margin-bottom:10px;">
                    ${sum.slice(0,250)}${sum.length>250?'…':''}</p>` : ''}
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
                  <div><b style="color:#475569;">LoF → cilia length</b><br>
                    <span style="color:#7c3aed;font-weight:600;">${lof}</span></div>
                  <div><b style="color:#475569;">Overexpression → cilia</b><br>
                    <span style="color:#b45309;">${oe}</span></div>
                  <div><b style="color:#475569;">% ciliated cells</b><br>
                    <span style="color:#065f46;">${pct}</span></div>
                  <div><b style="color:#475569;">Localization</b><br>${loc}</div>
                </div>
                ${dis && dis !== '—' && dis !== 'N/A'
                    ? `<div style="margin-top:8px;"><b style="font-size:11.5px;color:#475569;">Disease association</b><br>
                       ${dis.split(',').slice(0,4).map(d=>pill(d.trim(),'red')).join(' ')}</div>`
                    : ''}`;
    }
    }

    // ── SELF INTRO ────────────────────────────────────────────────────────
    if (type === 'self_intro') {
        const total = db().length;
        const withDis = db().filter(r => r['Ciliopathy'] && r['Ciliopathy'] !== 'N/A').length;
        return `<b>CiliAI</b> is a specialist assistant for the CiliaHub ciliary gene database.<br><br>
                <b>I can answer questions about:</b><br>
                ${['🔍 Gene function and details (e.g. <i>What does IFT88 do?</i>)',
                   '🏗️ Protein domains (e.g. <i>How many genes have WD40 domains?</i>)',
                   '🧬 Ciliopathy genes (e.g. <i>Joubert syndrome genes</i>)',
                   '📍 Localization (e.g. <i>transition zone proteins with short cilia phenotype</i>)',
                   '🔗 Complex intersections (e.g. <i>BBS genes also in IFT-B</i>)',
                   '🌿 Evolution (e.g. <i>Compare BBSome vs IFT-A phylogeny</i>)',
                   '📊 scRNA-seq expression (e.g. <i>IFT88 in lung</i>)',
                  ].map(s=>`<div style="margin:3px 0;">• ${s}</div>`).join('')}
                <br><b>Database:</b> ${total} ciliary genes · ${withDis} ciliopathy-associated
                <br><b>Tissues:</b> Lung · Kidney · Liver · Hypothalamus/Brain · Chondrocyte · Retina · Cerebellum`;
    }

    return null; // Not handled here
}

// ═══════════════════════════════════════════════════════════════════════════
// § 5  INSTALL — wrap whatever ciliai.js exposes for routing
// ═══════════════════════════════════════════════════════════════════════════

function say(html) {
    if (typeof win.addChatMessage === 'function') win.addChatMessage(html, false);
}

function intercept(originalFn) {
    return async function(queryOrOpts) {
        // Normalise: could be string or {text, ...} object
        const text = (typeof queryOrOpts === 'string')
            ? queryOrOpts
            : (queryOrOpts?.text || queryOrOpts?.raw || '');

        if (!text.trim()) return originalFn.apply(this, arguments);

        const intent = matchIntent(text);
        if (intent) {
            console.debug('[CiliAI Interceptor]', intent.type, text);
            const html = dispatch(intent);
            if (html) {
                // Echo user message if not already done
                if (typeof queryOrOpts === 'string' || queryOrOpts?.echo !== false) {
                    say(`<span style="opacity:.7;font-size:11px">🎯 Answered by CiliAI local engine</span>`);
                }
                say(html);
                return; // Do NOT call DeepSeek
            }
        }

        // Fall through to ciliai.js original
        return originalFn.apply(this, arguments);
    };
}

function install() {
    let attempts = 0;

    function tryPatch() {
        attempts++;
        if (attempts > 100) { console.warn('[CiliAI Interceptor] Gave up after 100 attempts'); return; }

        // Patch window.handleAIQuery (used by ciliai.js fallback path)
        if (typeof win.handleAIQuery === 'function' && !win.handleAIQuery.__intercepted) {
            win.handleAIQuery = intercept(win.handleAIQuery);
            win.handleAIQuery.__intercepted = true;
            console.log('[CiliAI Interceptor] ✅ Patched window.handleAIQuery');
        }

        // Patch window.CiliAI.Router.dispatchAction (used by main path)
        if (win.CiliAI?.Router?.dispatchAction && !win.CiliAI.Router.dispatchAction.__intercepted) {
            win.CiliAI.Router.dispatchAction = intercept(win.CiliAI.Router.dispatchAction);
            win.CiliAI.Router.dispatchAction.__intercepted = true;
            console.log('[CiliAI Interceptor] ✅ Patched window.CiliAI.Router.dispatchAction');
        }

        // Also patch any internal function ciliai.js might use directly
        // (detectable from console: "[CiliAI] Routing query:" at ciliai.js:361)
        // Try common internal names
        if (win.CiliAI?.processQuery && !win.CiliAI.processQuery.__intercepted) {
            win.CiliAI.processQuery = intercept(win.CiliAI.processQuery);
            win.CiliAI.processQuery.__intercepted = true;
            console.log('[CiliAI Interceptor] ✅ Patched window.CiliAI.processQuery');
        }
        if (win.CiliAI?.routeQuery && !win.CiliAI.routeQuery.__intercepted) {
            win.CiliAI.routeQuery = intercept(win.CiliAI.routeQuery);
            win.CiliAI.routeQuery.__intercepted = true;
            console.log('[CiliAI Interceptor] ✅ Patched window.CiliAI.routeQuery');
        }
        if (win.CiliAI?.handleQuery && !win.CiliAI.handleQuery.__intercepted) {
            win.CiliAI.handleQuery = intercept(win.CiliAI.handleQuery);
            win.CiliAI.handleQuery.__intercepted = true;
            console.log('[CiliAI Interceptor] ✅ Patched window.CiliAI.handleQuery');
        }

        // Re-run after a tick to catch anything ciliai.js sets up asynchronously
        if (attempts < 5) setTimeout(tryPatch, 200);
    }

    // Run immediately, then again after small delay to catch async init in ciliai.js
    tryPatch();
    setTimeout(tryPatch, 500);
    setTimeout(tryPatch, 1500);
}

// Expose for console debugging
win._CiliAI_Interceptor = { matchIntent, dispatch, install };

install();

console.log('[CiliAI Interceptor v1.0] Loaded and installing…');

})(window);
