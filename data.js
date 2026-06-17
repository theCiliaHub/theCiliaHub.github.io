/* ═══════════════════════════════════════════════════════════════════════════
 * data.js — CiliAI Data Layer
 * ───────────────────────────────────────────────────────────────────────────
 * Authoritative Source: ciliahub_master_merged.json
 * This file replaces the fragmented loading of genes, lookups, and evidence.
 * Serves as the primary data interface for the Visual Research Workbench.
 * ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
 * data.js — CiliAI Data Layer (v2.0 - Merged Master Optimized)
 * ───────────────────────────────────────────────────────────────────────────
 * Authoritative Source: ciliahub_master_merged.json
 * ═══════════════════════════════════════════════════════════════════════════ */

(function() {
    'use strict';

    /* ── Configuration ────────────────────────────────────────────────────── */

    var DATA_BASE = '/data/';
    var MASTER_SOURCE = DATA_BASE + 'genes/ciliahub_master_merged.json';

    var DEFAULT_PATHS = {
        tissues: {
            hypothalamus:      'scRNA_seq/Hypothalamus/UMAP_Cells.json',
            liver:             'scRNA_seq/Liver/Liver_cells.json',
            cerebellum:        'scRNA_seq/Cerebellum/Cerebellum_cells.json',
            retina:            'scRNA_seq/Retina/Retina_cells.json',
            pancreas:          'scRNA_seq/Pancreas/Pancreas_cells.json',
            limb_bud:          'scRNA_seq/Limb_Bud/Limb_Bud_cells.json',
            olfactory_neurons: 'scRNA_seq/Olfactory_Neurons/Olfactory_cells.json',
            choroid_plexus:    'scRNA_seq/Choroid_Plexus/Choroid_Plexus_cells.json',
            lung:              'scRNA_seq/Lung/Lung_CiliAI_Data.json',
        },
        geneTissues: {
                liver:             'scRNA_seq/Liver/Liver_genes.json',
                cerebellum:        'scRNA_seq/Cerebellum/Cerebellum_genes.json',
                retina:            'scRNA_seq/Retina/Retina_genes.json',
                pancreas:          'scRNA_seq/Pancreas/Pancreas_genes.json',
                limb_bud:          'scRNA_seq/Limb_Bud/Limb_Bud_genes.json',
                olfactory_neurons: 'scRNA_seq/Olfactory_Neurons/Olfactory_genes.json',
                chondrocyte:       'scRNA_seq/Chondrocytes/UMAP_GeneExpression_Chondrocyte.json'
            },
        splitTissues: {
            chondrocyte: {
                cells: 'scRNA_seq/Chondrocytes/UMAP_Cells_Chondrocyte.json',
                genes: 'scRNA_seq/Chondrocytes/UMAP_GeneExpression_Chondrocyte.json'
            },

        },
        fragmentedTissues: {
            /* lung is now a single file above — no fragmented entry needed */
        },
        phylogeny: {
            nevers: 'phylogeny/nevers_et_al_2017_matrix_optimized.json',
            li:     'phylogeny/li_et_al_2014_matrix_optimized.json',
        },
    };


    /* ── Helper Functions ─────────────────────────────────────────────────── */

    function log(msg, kind) {
        var prefix = '[CiliAI Data]';
        if (kind === 'error') console.error(prefix, msg);
        else console.log(prefix, msg);
    }

    function sanitize(s) {
        return typeof s === 'string' ? s.trim().toUpperCase() : '';
    }

    async function fetchJson(url) {
        const res = await fetch(url, { cache: 'default' });
        if (!res.ok) throw new Error(`Failed to load: ${url}`);
        return res.json();
    }

    /* ── Data Processing ──────────────────────────────────────────────────── */

    function buildState(data) {
        var masterData = [];
        var geneMap = {};
        var byCiliopathy = {};
        var byComplex = {};

        var genes = data.genes || {};

        /* The master JSON ships its own pre-built lookups.byCiliopathy /
         * byModuleOrComplex (built by the curation pipeline, not from per-gene
         * fields). These contain disease tags that aren't always reflected in
         * each gene's `ciliopathies` array — e.g., byCiliopathy.joubertsyndrome
         * has 56 genes but only 51 of them list "Joubert" in their per-gene
         * field. The other 5 are mis-tagged in the per-gene field but
         * authoritatively listed in the lookup. So we merge: per-gene-derived
         * byCiliopathy is a fallback, but the master's lookup is preferred
         * when present. (April 28 audit: 197 of 726 disease→gene mappings
         * were being silently dropped by the pure-derivative approach.) */
        var masterLookups = (data.lookups && typeof data.lookups === 'object') ? data.lookups : {};
        var masterByCiliopathy = masterLookups.byCiliopathy || {};
        var masterByModuleOrComplex = masterLookups.byModuleOrComplex || {};

        Object.keys(genes).forEach(function(sym) {
            var g = genes[sym];
            var orth = g.orthologs || {};

            // Standardizing record for UI components
            var rec = {
                'Gene': sym,
                'Description': g.description || '',
                'Ensembl': g.ensembl_id || '',
                'Localization': Array.isArray(g.localization) ? g.localization.join(', ') : (g.localization || ''),
                'Ciliopathies': g.ciliopathies || [],
                'Complex': g.protein_complex || '',
                'Summary': g.functional_summary || '',
                'Synonyms': g.synonyms || '',
                // Injected Merged Data
                'ciliogenics': g.ciliogenics || null,
                'phenotypes': g.model_organism_phenotypes || [],
                'publications': g.publications || [],
                // Additional Metadata
                'mouse_phenotype': g.mouse_phenotype || '',
                'human_phenotype': g.human_phenotype || '',
                'lof_effects': g.lof_effect || '',
                /* Cilia-effect fields (Section 8 of CILIAHUB_DATA_REPORT). Were
                 * silently missing — Cilia Effects table in the chat card
                 * always showed "—" for Overexpression and % Ciliated. */
                'oe_effect':    g.oe_effect    || '',
                'pct_ciliated': g.pct_ciliated || '',
                /* OMIM. Source field: g.omim_id (string). Without this entry
                 * the chat card's OMIM row was always "—" because no key in
                 * geneMap matched any of the renderer's fallback chains. */
                'omim_id':      g.omim_id      || '',
                /* New v2 fields (from ciliopathy_by_gene_FINAL_v2 merge,
                 * April 29). The merged master JSON now carries:
                 *   ciliopathy_refs      — PMIDs supporting disease tags
                 *   localization_refs    — PMIDs supporting localization
                 *   disease_classifications — per-gene {disease: classification}
                 *   source               — 'curated' | 'literature_curated' |
                 *                          'ciliahub_master' (genes lacking
                 *                          ciliopathy data)
                 * Surface them so any UI that wants provenance/classifications
                 * can read them off masterData records without re-fetching. */
                'ciliopathy_refs':         g.ciliopathy_refs         || [],
                'localization_refs':       g.localization_refs       || [],
                'disease_classifications': g.disease_classifications || {},
                'source':                  g.source                  || 'ciliahub_master',
                /* Orthologs: source has nested g.orthologs.{mouse,c_elegans,
                 * zebrafish,drosophila,xenopus}. Flatten per Section 8 of the
                 * data report so renderers can read g.Ortholog_Mouse etc.
                 * Defaults to '' so missing orthologs render as empty rather
                 * than 'undefined'. Keep the nested orthologs object too in
                 * case future code wants the full map. */
                'Ortholog_Mouse':      orth.mouse      || '',
                'Ortholog_C_elegans':  orth.c_elegans  || '',
                'Ortholog_Zebrafish':  orth.zebrafish  || '',
                'Ortholog_Drosophila': orth.drosophila || '',
                'Ortholog_Xenopus':    orth.xenopus    || '',
                'orthologs':           orth,
                // v5 schema: screens entries have new fields (screen, outcome, etc.).
                // Older renderers (gene-card.js, ciliai.js) read s.source / s.result.
                // Add backward-compat aliases so both old and new code paths work.
                'screens':             (Array.isArray(g.screens) ? g.screens : []).map(function(s){
                    if (!s || typeof s !== 'object') return s;
                    var copy = Object.assign({}, s);
                    // Old fields used by legacy renderers
                    if (!copy.source) copy.source = s.source_legacy || s.screen || '';
                    if (!copy.result) copy.result = s.outcome ? (s.technical_detail ? s.outcome + ' (' + s.technical_detail + ')' : s.outcome) : (s.raw || '');
                    return copy;
                }),
                /* Other useful fields that were silently dropped. clinvar_variant_count
                 * is referenced by some downstream stats; uniprot_id and alphafold_url
                 * are useful for external links; pathway_ids for pathway intent. */
                'clinvar_variant_count': g.clinvar_variant_count || 0,
                'uniprot_id':            g.uniprot_id || '',
                'alphafold_url':         g.alphafold_url || '',
                'pathway_ids':           g.pathway_ids || '',
                'ciliopathy_classification': g.ciliopathy_classification || [],
                /* v5.4 evidence tier (Gold Standard Ciliary Genes vs.
                 * Cilia-Associated Genes). Computed by the server-side
                 * tag_evidence.py pipeline based on the localization labels.
                 * If absent (older snapshot), surface as empty so the UI
                 * helpers below show "Unknown" rather than crashing. */
                'evidence_tier':           g.evidence_tier || '',
                'evidence_summary':        g.evidence_summary || null,
                'curation_note':           g.curation_note || '',
                /* Wave-1 gene-attribute fields (families 1-7) surfaced for the
                 * CiliAI geneAttribute handler and gene card. The mgi, clingen and
                 * human_ciliopathy_phenotype fields were previously dropped from the
                 * runtime record, so identifier / ClinGen / clinical-phenotype
                 * lookups returned a dash. Additive only. */
                'mgi_id':                  g.mgi_id || '',
                'mgi_url':                 g.mgi_url || '',
                'clingen_disease':         g.clingen_disease || '',
                'clingen_gcep':            g.clingen_gcep || '',
                'human_ciliopathy_phenotype': g.human_ciliopathy_phenotype || '',
                'pan_idio_class':          g.pan_idio_class || '',
                'pan_idio_tissues':        (g.pan_idio_tissues != null ? g.pan_idio_tissues : ''),
                // Compatibility aliases for legacy script.js code paths
                // that read lowercase keys (g.gene, g.synonym, etc.).
                // Without these, KIF19A (synonym for KIF19) cannot be found.
                'gene':         sym,
                'synonym':      Array.isArray(g.synonyms) ? g.synonyms.join(',') : (g.synonyms || ''),
                'description':  g.description || '',
                'localization': Array.isArray(g.localization) ? g.localization.join(', ') : (g.localization || ''),
                'ensembl_id':   g.ensembl_id || '',
                'pfam_domains': g.pfam_domains || []
            };

            masterData.push(rec);
            geneMap[sym] = rec;

            // Synonym indexing: alias each synonym to point at the same record,
            // so lookups like KIF19A find the KIF19 record. Primary symbols
            // always win — synonym aliases never overwrite an existing primary.
            if (Array.isArray(g.synonyms)) {
                g.synonyms.forEach(function(syn) {
                    var key = String(syn).toUpperCase().trim();
                    if (key && !geneMap[key]) {
                        geneMap[key] = rec;
                    }
                });
            }

            // Build Dynamic Lookups
            if (Array.isArray(g.ciliopathies)) {
                g.ciliopathies.forEach(function(c) {
                    var k = c.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (!byCiliopathy[k]) byCiliopathy[k] = [];
                    byCiliopathy[k].push(sym);
                });
            }

            if (g.protein_complex) {
                var cks = String(g.protein_complex).split(/[;,]/);
                cks.forEach(function(ck) {
                    var key = ck.trim().toUpperCase();
                    if (!key) return;
                    if (!byComplex[key]) byComplex[key] = [];
                    if (!byComplex[key].includes(sym)) byComplex[key].push(sym);
                });
            }
        });

        /* Merge the master's authoritative byCiliopathy on top of the
         * per-gene-derived map. For each key the master has, union the gene
         * lists (so we keep both sources of evidence). */
        Object.keys(masterByCiliopathy).forEach(function(k) {
            var masterList = masterByCiliopathy[k];
            if (!Array.isArray(masterList)) return;
            if (!byCiliopathy[k]) byCiliopathy[k] = [];
            var existing = {};
            byCiliopathy[k].forEach(function(s) { existing[s] = 1; });
            masterList.forEach(function(s) {
                if (!existing[s]) { byCiliopathy[k].push(s); existing[s] = 1; }
            });
        });

        /* New v2 lookups (April 29 merge of ciliopathy_by_gene_FINAL_v2.json):
         * The master JSON now ships three additional pre-built lookups beyond
         * byCiliopathy. Pass them through verbatim — they're authoritative,
         * not derived from per-gene fields, so we don't reconstruct them.
         *   byClassification        — {Primary Ciliopathies: [genes], ...} (4 keys)
         *   diseaseToClassification — {disease: classification} (81 entries)
         *   diseaseAliases          — {alias: canonical disease} (73 entries)
         * Default to {} if missing so downstream code can call Object.keys()
         * without a null check. */
        var byClassification        = masterLookups.byClassification        || {};
        var diseaseToClassification = masterLookups.diseaseToClassification || {};
        var diseaseAliases          = masterLookups.diseaseAliases          || {};

        return { masterData, geneMap, byCiliopathy, byComplex,
                 byModuleOrComplexFromMaster: masterByModuleOrComplex,
                 byClassification, diseaseToClassification, diseaseAliases };
    }

    /* ── Lifecycle ───────────────────────────────────────────────────────── */

    async function loadCiliAIData() {
        window.CiliAI = window.CiliAI || {};
        window.CiliAI.data = { phylogeny: {} };
        
        if (window.updateStatus) window.updateStatus('Loading Merged Master Database...', 'loading');

        try {
            const rawData = await fetchJson(MASTER_SOURCE);
            const state = buildState(rawData);

            window.CiliAI.masterData = state.masterData;
            /* v5.4: surface the master JSON's meta block so consumers (banner,
             * tier helpers, version chip) can read changelog/version_id without
             * re-fetching. Without this, refreshUpdateBanner() saw no meta and
             * always fell back to the generic "No gene additions or removals"
             * message even after build_changelog_entry.py wrote a proper
             * changelog entry. */
            window.CiliAI.meta = rawData.meta || {};
            window.CiliAI.master = rawData;  /* full raw object for any caller */
            window.CiliAI.lookups = {
                geneMap: state.geneMap,
                byCiliopathy: state.byCiliopathy,
                byModuleOrComplex: state.byComplex,
                pfamByGene: {}, // Built from master data below

                /* v2 lookups (April 29 merge — see buildState). All three are
                 * pulled directly from the master JSON's lookups section and
                 * surfaced here so the chat assistant, gene cards, and any
                 * future UI can consult them without re-fetching the master
                 * file. Default to {} when missing so consumers can safely
                 * call Object.keys() / [key] without null checks. */
                byClassification:        state.byClassification        || {},
                diseaseToClassification: state.diseaseToClassification || {},
                diseaseAliases:          state.diseaseAliases          || {}
            };
            
            // Populate pfamByGene from merged records
            state.masterData.forEach(r => {
                if (r.pfam_domains) window.CiliAI.lookups.pfamByGene[r.Gene] = r.pfam_domains;
            });

            window.CiliAI.ready = true;
            if (window.updateStatus) {
                window.updateStatus('Ready', 'ready');
            }
            
            return true;
        } catch (e) {
            log('Initialization failed: ' + e.message, 'error');
            if (window.updateStatus) window.updateStatus('Data Load Error', 'error');
            return false;
        }
    }

    /* ── Exports ─────────────────────────────────────────────────────────── */

    window.loadCiliAIData = loadCiliAIData;
    window.CiliAI = window.CiliAI || {};
    window.CiliAI.datasets = window.CiliAI.datasets || {}; // Preserve existing datasets

    window.findGenes = function(queries) {
        var map = (window.CiliAI && window.CiliAI.lookups) ? window.CiliAI.lookups.geneMap : {};
        var found = [];
        var notFound = [];
        queries.forEach(q => {
            var k = sanitize(q);
            if (map[k]) found.push(map[k]);
            else notFound.push(q);
        });
        return { foundGenes: found, notFoundGenes: notFound };
    };

    window.loadTissue = async function(key) {
        var CA = window.CiliAI;
        var DP = DEFAULT_PATHS;
        var BASE = DATA_BASE;

        if (!CA.datasets[key]) CA.datasets[key] = { umap: [], expression: {}, _loaded: false };
        var ds = CA.datasets[key];
        if (ds._loaded) return ds;

        // ── Single-file tissue (cells only, genes loaded on demand) ────
        if (DP.tissues && DP.tissues[key]) {
            log('Loading tissue (single): ' + key);
            console.log('[CiliAI scRNA] Loading cells for:', key, '->', BASE + DP.tissues[key]);
            try {
                var data = await fetchJson(BASE + DP.tissues[key]);
                ds.umap       = data.cells || data.umap || data.UMAP || [];
                ds.expression = {};
                ds._loaded    = true;
                console.log('[CiliAI scRNA] Cells loaded:', key, '| cells:', ds.umap.length);
                // Load genes in background, track with promise
                if (DP.geneTissues && DP.geneTissues[key]) {
                    console.log('[CiliAI scRNA] Loading genes in background for:', key);
                    ds._genesLoading = fetchJson(BASE + DP.geneTissues[key]).then(function(gd) {
                        ds.expression = gd.genes || gd.expression || gd || {};
                        ds._genesLoaded = true;
                        console.log('[CiliAI scRNA] Genes loaded:', key, '| genes:', Object.keys(ds.expression).length);
                    }).catch(function(e){ log('Gene load failed (' + key + '): ' + e.message, 'error'); });
                }
            } catch(e) { log('Tissue load failed (' + key + '): ' + e.message, 'error'); }
            return ds;
        }

        // ── Split tissue (cells file + gene expression file) ────────────
        if (DP.splitTissues && DP.splitTissues[key]) {
            log('Loading tissue (split): ' + key);
            console.log('[CiliAI scRNA] Loading split tissue:', key, '->', DP.splitTissues[key]);
            var sp = DP.splitTissues[key];
            try {
                var cellData = await fetchJson(BASE + sp.cells);
                var rawCells = cellData.cells || cellData.umap || cellData.UMAP || cellData || [];
                /* Normalize cell_type field (hypothalamus uses 'type') */
                ds.umap = Array.isArray(rawCells) ? rawCells.map(function(c) {
                    if (!c.cell_type && c.type) c.cell_type = c.type;
                    if (!c.x && c.umap_x !== undefined) { c.x = c.umap_x; c.y = c.umap_y; }
                    return c;
                }) : rawCells;
                if (sp.genes) {
                    var geneData = await fetchJson(BASE + sp.genes);
                    ds.expression = geneData.genes || geneData.expression || geneData.geneExpression || geneData || {};
                }
                ds._loaded = true;
            } catch(e) { log('Split tissue load failed (' + key + '): ' + e.message, 'error'); }
            return ds;
        }

        // ── Fragmented tissue (part_1.json … part_N.json) ──────────────
        if (DP.fragmentedTissues && DP.fragmentedTissues[key]) {
            log('Loading tissue (fragmented): ' + key);
            var ft = DP.fragmentedTissues[key];
            try {
                var parts = [];
                for (var p = 1; p <= ft.parts; p++) {
                    var partData = await fetchJson(BASE + ft.dir + 'part' + p + '.json');
                    var partCells = partData.cells || partData.umap || partData.UMAP || (Array.isArray(partData) ? partData : []);
                    parts = parts.concat(partCells);
                }
                ds.umap    = parts;
                ds._loaded = true;
            } catch(e) { log('Fragmented tissue load failed (' + key + '): ' + e.message, 'error'); }
            return ds;
        }

        log('Unknown dataset: ' + key, 'error');
        return null;
    };

    /* Load phylogeny data (Nevers 2017 and/or Li 2014) — lazy, cached */
    window.loadPhylogeny = async function(which) {
        which = which || 'nevers';
        var CA = window.CiliAI;
        if (!CA) return null;
        CA._phylo = CA._phylo || {};
        if (CA._phylo[which]) return CA._phylo[which];
        var path = DEFAULT_PATHS.phylogeny && DEFAULT_PATHS.phylogeny[which];
        if (!path) { log('Unknown phylogeny dataset: ' + which, 'error'); return null; }
        try {
            log('Loading phylogeny: ' + which);
            var data = await fetchJson(DATA_BASE + path);
            CA._phylo[which] = data;
            log('Phylogeny loaded: ' + which + ' (' + Object.keys(data.genes || {}).length + ' genes)');
            return data;
        } catch(e) {
            log('Phylogeny load failed (' + which + '): ' + e.message, 'error');
            return null;
        }
    };



    /* loadDatasetOnDemand — called by ciliai.js renderUMAPPlot */
    window.loadDatasetOnDemand = async function(key) {
        return await window.loadTissue(key);
    };

    /* Per-gene loader for large datasets (hypothalamus) */
    window.loadGeneExpression = async function(datasetKey, geneSymbol) {
        var CA = window.CiliAI;
        var ds = CA.datasets && CA.datasets[datasetKey];
        if (!ds) return null;
        if (ds.expression && ds.expression[geneSymbol]) return ds.expression[geneSymbol];

        var perGeneDir = null;
        if (datasetKey === 'hypothalamus') perGeneDir = 'scRNA_seq/Hypothalamus/genes/';

        if (datasetKey === 'lung') perGeneDir = 'scRNA_seq/Lung/genes/';
        if (perGeneDir) {
            try {
                var url = DATA_BASE + perGeneDir + geneSymbol + '.json';
                console.log('[CiliAI scRNA] Loading gene on demand:', geneSymbol, 'from', url);
                var data = await fetchJson(url);
                if (!ds.expression) ds.expression = {};
                ds.expression[geneSymbol] = data;
                return data;
            } catch(e) {
                console.warn('[CiliAI scRNA] Gene not found:', geneSymbol, 'in', datasetKey);
                return null;
            }
        }
        return null;
    };

    /* Special handler for Lung column-oriented format */
    var _origLoadTissue = window.loadTissue;
    window.loadTissue = async function(key) {
        var CA = window.CiliAI;
        var BASE = DATA_BASE;
        var DP = DEFAULT_PATHS;

        if (key === 'lung') {
            if (!CA.datasets[key]) CA.datasets[key] = { umap: [], expression: {}, _loaded: false };
            var ds = CA.datasets[key];
            if (ds._loaded) return ds;
            console.log('[CiliAI scRNA] Loading Lung cells (column format)...');
            try {
                var cellData = await fetchJson(BASE + 'scRNA_seq/Lung/Lung_cells.json');
                var cols = cellData.cells || cellData || {};
                if (cols.umap_x) {
                    var n = cols.umap_x.length;
                    ds.umap = new Array(n);
                    for (var i = 0; i < n; i++) {
                        ds.umap[i] = {
                            x: cols.umap_x[i],
                            y: cols.umap_y[i],
                            cell_type: cols.cluster_name[i] || 'Unknown'
                        };
                    }
                } else {
                    ds.umap = cols.cells || [];
                }
                ds.expression = {};
                ds._loaded = true;
                console.log('[CiliAI scRNA] Lung cells loaded | cells:', ds.umap.length);
                /* Lung genes loaded per-gene on demand via loadGeneExpression */
            } catch(e) { console.error('Lung load failed:', e.message); }
            return ds;
        }

        return await _origLoadTissue(key);
    };

    log('Data Layer Active: Merged Master & scRNA_seq paths updated. (v2.3: + ciliopathy_refs, localization_refs, disease_classifications, source; + lookups: byClassification, diseaseToClassification, diseaseAliases)');
})();

/* ═══════════════════════════════════════════════════════════════════════════
 * v5.4 — Tier helpers (CiliaHub.tier)
 * ───────────────────────────────────────────────────────────────────────────
 * Reusable helpers that any UI surface (browse table, plots.html, search
 * autocomplete, CiliAI chat cards) can call to render a consistent tier badge.
 *
 * Tier names match the master JSON's evidence_tier field exactly:
 *   "Gold Standard Ciliary Genes"   — bona fide ciliary localization/function
 *   "Cilia-Associated Genes"        — labeled as cilia-associated in master
 *
 * Helpers:
 *   tier(symOrRec)   → "Gold Standard Ciliary Genes" | "Cilia-Associated Genes" | ""
 *   shortTier(name)  → "Gold" | "Cilia-Associated" | ""        (for compact display)
 *   tierBadgeHTML(name, opts) → ready-to-inject HTML badge
 *   tierDotHTML(name)         → tiny colored dot for autocomplete suggestions
 * ═══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    var TIER_GOLD  = 'Gold Standard Ciliary Genes';
    var TIER_ASSOC = 'Cilia-Associated Genes';

    /* Color tokens — gold for Gold Standard, blue for Cilia-Associated.
     * These match the gene-card.js v5.3 deployed colors exactly. */
    var STYLES = {};
    STYLES[TIER_GOLD]  = { bg: 'linear-gradient(135deg,#b45309,#d4a017)', fg: '#fff', dot: '#d4a017', short: 'Gold' };
    STYLES[TIER_ASSOC] = { bg: 'linear-gradient(135deg,#185FA5,#378ADD)', fg: '#fff', dot: '#378ADD', short: 'Cilia-Associated' };

    function lookupRec(symOrRec) {
        if (!symOrRec) return null;
        if (typeof symOrRec === 'object') return symOrRec;
        var sym = String(symOrRec).toUpperCase().trim();
        var map = (window.CiliAI && window.CiliAI.lookups && window.CiliAI.lookups.geneMap) || {};
        return map[sym] || null;
    }

    function tierOf(symOrRec) {
        var rec = lookupRec(symOrRec);
        if (!rec) return '';
        return rec.evidence_tier || '';
    }

    function shortTier(name) {
        var s = STYLES[name];
        return s ? s.short : '';
    }

    /* opts: { compact: true → smaller pill; tooltip: false → no title attr } */
    function tierBadgeHTML(name, opts) {
        if (!name || !STYLES[name]) return '';
        opts = opts || {};
        var s = STYLES[name];
        var pad = opts.compact ? '1px 7px' : '3px 10px';
        var fz  = opts.compact ? '9.5px'    : '10.5px';
        var label = opts.compact ? s.short : name;
        var title = opts.tooltip === false ? '' : ' title="' + name + '"';
        return '<span class="ch-tier-badge"' + title + ' style="background:' + s.bg +
               ';color:' + s.fg + ';padding:' + pad + ';border-radius:10px;font-size:' + fz +
               ';font-weight:700;letter-spacing:.2px;display:inline-block;line-height:1.4;white-space:nowrap;">' +
               label + '</span>';
    }

    /* For autocomplete suggestions / inline gene mentions: a single 10px dot
     * with the tier color. Cheaper than a pill. Slight shadow ensures it
     * stays visible against light backgrounds. */
    function tierDotHTML(name) {
        if (!name || !STYLES[name]) return '';
        var s = STYLES[name];
        return '<span class="ch-tier-dot" title="' + name + '" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + s.dot + ';margin-right:6px;vertical-align:middle;box-shadow:0 0 0 1px rgba(0,0,0,.08);flex-shrink:0;"></span>';
    }

    window.CiliaHub = window.CiliaHub || {};
    window.CiliaHub.tier = {
        GOLD:           TIER_GOLD,
        ASSOC:          TIER_ASSOC,
        of:             tierOf,
        short:          shortTier,
        badgeHTML:      tierBadgeHTML,
        dotHTML:        tierDotHTML,
    };

    /* ───────────────────────────────────────────────────────────────────
     * Auto-update banner (right panel "Database update" card)
     * ───────────────────────────────────────────────────────────────────
     * Pulls recent changelog from master.meta.changelog (newest entry).
     * Writes into the elements with IDs:
     *   #rab-title       — "Database update · {date} ({version})"
     *   #rab-new-genes   — chip list of newly added gene symbols
     *   #rab-stats       — "{N} genes · {M} diseases · {K} newly added in {ver}"
     *   #recent-additions-toggle — "{ver} · {K} new"  (compact pill)
     *
     * If meta or changelog is missing, replaces with a generic "Latest snapshot"
     * line built from totals — the banner never shows stale hardcoded numbers.
     * ─────────────────────────────────────────────────────────────────── */
    function refreshUpdateBanner() {
        var CA = window.CiliAI;
        if (!CA) return;
        var meta  = (CA.master && CA.master.meta) || (CA.meta || {});
        var genes = CA.masterData ? CA.masterData.length : 0;
        var diseases = 0;
        try {
            var seen = {};
            (CA.masterData || []).forEach(function(g) {
                (g.Ciliopathies || []).forEach(function(d) {
                    if (d && typeof d === 'string' && d.length > 2) seen[d.toLowerCase()] = true;
                });
            });
            diseases = Object.keys(seen).length;
        } catch(e) {}

        // Latest changelog entry (or v5_4_changelog string fallback)
        var latest = null;
        if (Array.isArray(meta.changelog) && meta.changelog.length) {
            latest = meta.changelog[meta.changelog.length - 1];
        }
        var version = (latest && latest.version) || meta.version_id || meta.version || '';
        var date    = (latest && latest.date)    || meta.last_updated || meta.updated_at || '';
        var added   = (latest && latest.added)   || (Array.isArray(meta.v5_4_added_genes) ? meta.v5_4_added_genes.length : 0);
        var newGenes = (latest && latest.new_genes) || meta.v5_4_added_genes || [];

        function setText(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }

        setText('rab-title', 'Database update' + (date ? ' · ' + date : '') + (version ? ' (' + version + ')' : ''));

        /* Chip row: show added genes if any, otherwise removed genes,
         * otherwise a generic message. Both arrays come from the
         * build_changelog_entry.py script via meta.changelog. */
        var rabNewEl = document.getElementById('rab-new-genes');
        if (rabNewEl) {
            var removedGenes = (latest && latest.removed_genes) || [];
            if (Array.isArray(newGenes) && newGenes.length) {
                rabNewEl.textContent = newGenes.slice(0, 12).join(' · ') + (newGenes.length > 12 ? ' · …' : '');
                /* Update the NEW label to reflect this is "added" content */
                var newLabel = rabNewEl.previousElementSibling;
                if (newLabel) newLabel.textContent = 'NEW';
            } else if (Array.isArray(removedGenes) && removedGenes.length) {
                rabNewEl.textContent = removedGenes.slice(0, 12).join(' · ') + (removedGenes.length > 12 ? ' · …' : '');
                /* Switch the colored badge to "REMOVED" so it's not misleading */
                var rmLabel = rabNewEl.previousElementSibling;
                if (rmLabel) {
                    rmLabel.textContent = 'REMOVED';
                    rmLabel.style.background = '#A32D2D';
                }
            } else {
                rabNewEl.textContent = 'No gene additions or removals in this release';
            }
        }

        /* Stats line: "{N} genes · {M} diseases · {action summary} in {ver}" */
        var rmCount = (latest && latest.removed) || 0;
        var addCount = added || (latest && latest.added) || 0;
        var summaryParts = [];
        if (addCount) summaryParts.push(addCount + ' added');
        if (rmCount)  summaryParts.push(rmCount + ' removed');
        var summary = summaryParts.length ? ' · ' + summaryParts.join(' · ') : '';
        setText('rab-stats', genes.toLocaleString() + ' genes · ' + diseases + ' diseases' + summary + (version ? ' in ' + version : ''));

        var pill = document.getElementById('recent-additions-toggle');
        if (pill) {
            var pillText = version || 'latest';
            if (addCount)      pillText += ' · ' + addCount + ' new';
            else if (rmCount)  pillText += ' · ' + rmCount + ' removed';
            pill.textContent = pillText;
        }
    }

    window.CiliaHub.refreshUpdateBanner = refreshUpdateBanner;
})();

