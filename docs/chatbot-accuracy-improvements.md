# CiliAI Chatbot — Accuracy Improvement Analysis

**Version analysed:** ciliai.js v7.2.3 / assistant-runtime.js  
**Date:** March 2026

---

## Table of Contents

1. [Root Cause Analysis](#1-root-cause-analysis)
2. [Gap Inventory](#2-gap-inventory)
3. [Fix 1 — Extend tryDataFirst to all ciliopathies (High Impact)](#3-fix-1--extend-trydatafirst-to-all-ciliopathies)
4. [Fix 2 — Extend tryDataFirst to localization list queries (High Impact)](#4-fix-2--extend-trydatafirst-to-localization-list-queries)
5. [Fix 3 — Inject full disease gene lists into database context (High Impact)](#5-fix-3--inject-full-disease-gene-lists-into-database-context)
6. [Fix 4 — Use all 20 golden cases as few-shot examples (High Impact)](#6-fix-4--use-all-20-golden-cases-as-few-shot-examples)
7. [Fix 5 — Add count + instruction to system prompt (Medium Impact)](#7-fix-5--add-count--instruction-to-system-prompt)
8. [Fix 6 — Add a lookup-based intent for gene lists (Medium Impact)](#8-fix-6--add-a-lookup-based-intent-for-gene-lists)
9. [Fix 7 — Add post-dispatch gene validation (Medium Impact)](#9-fix-7--add-post-dispatch-gene-validation)
10. [Fix 8 — Extend few-shot coverage for tissue and complex queries (Low Impact)](#10-fix-8--extend-few-shot-coverage-for-tissue-and-complex-queries)
11. [Fix 9 — Golden test CI integration (Low Impact / Infrastructure)](#11-fix-9--golden-test-ci-integration)
12. [Summary Table](#12-summary-table)
13. [Recommended Implementation Order](#13-recommended-implementation-order)

---

## 1. Root Cause Analysis

The chatbot has two answer engines:

- **Database engine** (`tryDataFirst`): instantly returns verified gene lists from the pre-indexed `ciliAI_lookups.json`. Always accurate, no AI involved.
- **LLM engine** (DeepSeek): generates natural-language answers and gene lists from its parametric knowledge, supplemented by a small database context window.

The accuracy problem arises specifically when a user asks the LLM to produce a **gene list** (for a disease or localization) and the database engine does not intercept the query. In that case:

1. `buildDatabaseContext(query)` only injects gene descriptions for **genes explicitly named in the query text**. A query like "List Joubert syndrome genes" contains no gene symbols, so the context window is empty.
2. The LLM falls back entirely on training knowledge and returns a **short, plausible-sounding but incomplete list** — typically 5–10 of the best-known genes.
3. The database has the full correct list (47 Joubert syndrome genes in `byCiliopathy['joubertsyndrome']`) but it is never passed to the model or used directly.

The fix is to wire the existing, accurate data structures into the query pipeline at the right points, rather than relying on the LLM to recall gene lists from training.

---

## 2. Gap Inventory

The table below maps each example query from the suggestion cards to whether it currently produces a correct and complete result.

| Query | Current behaviour | Root cause | Correct data available? |
|---|---|---|---|
| "Show Gold Standard ciliary genes" | Correct — full list from `masterData` | `tryDataFirst` intercepts | Yes, working |
| "Display Bardet–Biedl genes" | Correct — full BBS list from `byCiliopathy` | `tryDataFirst` intercepts | Yes, working |
| "Where is CEP290 localized?" | Correct — single gene from `geneMap` | `tryDataFirst` intercepts | Yes, working |
| "What is IFT88?" | Correct — from `geneMap` | `tryDataFirst` intercepts | Yes, working |
| "List Joubert syndrome genes" | **Partial** — LLM returns ~5 genes | No `tryDataFirst` rule; empty DB context | `byCiliopathy['joubertsyndrome']` = 47 genes |
| "List Primary Ciliary Dyskinesia genes" | **Partial** — LLM returns ~5–8 genes | Same | `byCiliopathy[pcd key]` = 68 genes |
| "Display transition zone genes" | **Partial** — LLM returns ~5 genes | No localization list rule | `byLocalization['transition zone']` = 160 genes |
| "Show basal body genes" | **Partial** — LLM returns ~5 genes | Same | `byLocalization['basal body']` = 855 genes |
| "Show pan-ciliary genes" | **Partial** — LLM guesses | No data-first rule | `byLocalization['cilia']` = 1,021 genes |
| "Lung specific ciliary genes" | Partial / varies | Expression data not injected into context | `ciliai_master_expression.json` |
| "Show BBS1 evolution" | Depends on legacy handler | Legacy handler, not LLM | Phylogenetic data available |
| "Dot plot of IFT88, ARL13B, BBS1, FOXJ1" | Usually correct | Genes named in query → context injected | Working for named genes |
| "List genes in BBSome complex" | Partial — LLM returns ~5 genes | No `complexByName` lookup in data-first | `complexByName['BBSome']` available |
| "Compare IFT88 vs BBS1" | Usually correct (compare intent) | Named genes → context injected | Working |
| "Show expression plot for ARL13B" | Correct (plot intent, named gene) | Named gene → context injected | Working |

**Summary:** All queries where the user names specific genes work well. All queries where the answer is a gene list derived from a disease name, localization, or complex name are incomplete.

---

## 3. Fix 1 — Extend `tryDataFirst` to all ciliopathies

**File:** `ciliai/assistant/assistant-runtime.js`  
**Function:** `tryDataFirst(query)` starting at line 464  
**Impact:** High — this single change fixes all ciliopathy gene list queries  

### The problem

`tryDataFirst` currently intercepts BBS queries only:

```javascript
// Current code (lines 479–490)
const wantsBbsList = (q.includes('display') || q.includes('show') || q.includes('list')) &&
    (q.includes('bardet') || q.includes('biedl') || q.includes('bbs'));
```

Joubert syndrome, Primary Ciliary Dyskinesia, Nephronophthisis, Meckel–Gruber syndrome, and all other ciliopathies fall through to the LLM.

### The fix

Add a generic ciliopathy lookup that fires for any `(show|list|display) + <disease name>` query:

```javascript
// After the BBS block, before the gold-standard block:

const wantsDiseaseList = (q.includes('display') || q.includes('show') || q.includes('list'));
if (wantsDiseaseList && !isExplainQuestion) {
    const byCiliopathy = root.CiliAI.lookups?.byCiliopathy || {};
    // Normalize query to find a matching disease key
    const qNorm = q.replace(/[^a-z0-9]/g, '');
    const matchedKey = Object.keys(byCiliopathy).find(k => {
        const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        // Check if the normalized key is a substring of the normalized query
        return qNorm.includes(kNorm) || kNorm.includes(qNorm.slice(0, 6));
    });
    if (matchedKey) {
        const genes = (byCiliopathy[matchedKey] || []).map(g =>
            typeof g === 'string' ? g : g.Gene || g.gene
        ).filter(Boolean);
        if (genes.length) {
            const displayName = matchedKey
                .replace(/([a-z])([A-Z])/g, '$1 $2')
                .replace(/^./, c => c.toUpperCase());
            setMeta({ dataFirstUsed: true, dataFirstSource: matchedKey, llmCalled: false });
            return {
                markdown: [
                    `Here are the **${genes.length} ${displayName} genes** in the curated database.`,
                    '',
                    'Opening the full gene list table now.'
                ].join('\n'),
                actions: core.normalizeActions({
                    intent: 'list_genes',
                    title: `${displayName} Genes`,
                    payload: { genes },
                    visual: [{ type: 'table', target: 'cilia-svg',
                                data: { title: `${displayName} Genes`, genes } }]
                }),
                raw: ''
            };
        }
    }
}
```

**Result:** "List Joubert syndrome genes" → 47 genes from database, no LLM call.

---

## 4. Fix 2 — Extend `tryDataFirst` to localization list queries

**File:** `ciliai/assistant/assistant-runtime.js`  
**Function:** `tryDataFirst(query)` starting at line 464  
**Impact:** High — fixes all compartment-based gene list queries  

### The problem

`tryDataFirst` currently handles "where is X localized?" for a single gene but does NOT handle "show genes in the [compartment]" list queries. These fall through to the LLM.

The distinction:
- *"Where is CEP290 localized?"* → handled (single gene lookup)
- *"Show genes in the transition zone"* → NOT handled (list of genes by compartment)

### The fix

Add a compartment-to-gene-list rule that uses `byLocalization`:

```javascript
// After the single-gene localization block:

const wantsLocList = (q.includes('show') || q.includes('list') || q.includes('display'))
    && !isExplainQuestion;
if (wantsLocList) {
    const byLocalization = root.CiliAI.lookups?.byLocalization || {};
    const locKeys = Object.keys(byLocalization);
    // Find the localization term mentioned in the query
    const matchedLoc = locKeys.find(loc => q.includes(loc.toLowerCase()));
    if (matchedLoc) {
        const rawList = byLocalization[matchedLoc] || [];
        const genes = rawList.map(g =>
            typeof g === 'string' ? g : g.Gene || g.gene
        ).filter(Boolean);
        if (genes.length) {
            const displayName = matchedLoc.charAt(0).toUpperCase() + matchedLoc.slice(1);
            setMeta({ dataFirstUsed: true, dataFirstSource: matchedLoc, llmCalled: false });
            return {
                markdown: [
                    `Found **${genes.length} genes** localized to the **${displayName}**.`,
                    '',
                    'Opening the gene list table. The diagram will highlight the compartment.'
                ].join('\n'),
                actions: core.normalizeActions({
                    intent: 'list_genes',
                    title: `${displayName} Genes`,
                    payload: { genes },
                    visual: [
                        { type: 'table', target: 'cilia-svg',
                          data: { title: `${displayName} Genes`, genes } },
                        { type: 'highlight', target: 'cilia-diagram',
                          data: { localization: matchedLoc } }
                    ]
                }),
                raw: ''
            };
        }
    }
}
```

**Result:**
- "Show transition zone genes" → 160 genes from `byLocalization['transition zone']`, plus diagram highlight
- "Display basal body genes" → 855 genes from `byLocalization['basal body']`
- "Show pan-ciliary genes" → 1,021 genes from `byLocalization['cilia']`

---

## 5. Fix 3 — Inject full disease gene lists into database context

**File:** `ciliai/assistant/assistant-runtime.js`  
**Function:** `buildDatabaseContext(query)` at line 8  
**Impact:** High — improves LLM accuracy for any query that does reach the LLM  

### The problem

`buildDatabaseContext` only injects genes that are **already named in the query text**. For disease/localization list queries, the query contains no gene symbols, so the context is empty and the LLM has nothing to work from.

### The fix

After the existing gene-extraction logic, add ciliopathy and localization lookups:

```javascript
// Add after the existing BBS context fallback (around line 43):

// Ciliopathy context: inject gene symbols when query asks for a disease list
if (lines.length === 0) {
    const byCiliopathy = root.CiliAI.lookups?.byCiliopathy || {};
    const qNorm = q.replace(/[^a-z0-9]/g, '');
    const matchedKey = Object.keys(byCiliopathy).find(k =>
        qNorm.includes(k.toLowerCase().replace(/[^a-z0-9]/g, ''))
    );
    if (matchedKey) {
        const allGenes = (byCiliopathy[matchedKey] || []).map(g =>
            typeof g === 'string' ? g : g.Gene || g.gene
        ).filter(Boolean);
        // Inject gene symbols (not full descriptions, to stay within token budget)
        lines.push(`${matchedKey} genes (${allGenes.length} total): ${allGenes.join(', ')}`);
    }
}

// Localization context
if (lines.length === 0) {
    const byLocalization = root.CiliAI.lookups?.byLocalization || {};
    const matchedLoc = Object.keys(byLocalization).find(loc => q.includes(loc.toLowerCase()));
    if (matchedLoc) {
        const allGenes = (byLocalization[matchedLoc] || []).map(g =>
            typeof g === 'string' ? g : g.Gene || g.gene
        ).filter(Boolean);
        lines.push(`${matchedLoc} genes (${allGenes.length} total): ${allGenes.slice(0, 50).join(', ')}${allGenes.length > 50 ? ' ...[truncated]' : ''}`);
    }
}
```

**Note on token budget:** Injecting all 68 PCD gene symbols (~340 tokens) or all 160 transition zone gene symbols (~800 tokens) is feasible within DeepSeek's context window. However, injecting all 1,021 cilia gene symbols (~5,000 tokens) may push the total context too high. For large compartments, truncate to the top 50–100 most-cited genes or provide count only. Fix 1 (data-first bypass) is the preferred solution for large lists; this fix serves as a backstop for edge cases that reach the LLM.

---

## 6. Fix 4 — Use all 20 golden cases as few-shot examples

**File:** `ciliai/assistant/assistant-runtime.js`  
**Function:** `loadFewShotExamples()` at line 182  
**Impact:** High — the LLM currently has no examples for 16 out of 20 intent types  

### The problem

```javascript
// Current code (line 188)
const examples = Array.isArray(data) ? data.slice(0, 4) : [];
```

Only q1–q4 are ever used: IFT88 info, CEP290 localization, transition zone list, ARL13B plot. The LLM has no examples of compare, domain viewer, navigate, filter, BBSome complex, or multi-gene plot intents.

### The fix

Increase the slice to use all 20, or implement query-adaptive selection:

**Option A — Use all 20 (simplest):**

```javascript
// Change line 188:
const examples = Array.isArray(data) ? data : [];
```

Trade-off: increases every system prompt by ~3,000 tokens (~$0.0015 per query at DeepSeek pricing). This is acceptable at current scale.

**Option B — Query-adaptive few-shot selection (better for cost at scale):**

```javascript
function selectFewShotExamples(data, query) {
    const q = query.toLowerCase();
    const scored = data.map(item => {
        let score = 0;
        const actions = item.response || '';
        if (q.includes('plot') || q.includes('umap')) score += actions.includes('"plot"') ? 3 : 0;
        if (q.includes('domain')) score += actions.includes('domain-viewer') ? 3 : 0;
        if (q.includes('compare') || q.includes('vs')) score += actions.includes('"compare"') ? 3 : 0;
        if (q.includes('list') || q.includes('show') || q.includes('display')) score += actions.includes('"list_genes"') ? 2 : 0;
        if (q.includes('locali')) score += actions.includes('highlight') ? 2 : 0;
        return { item, score };
    });
    scored.sort((a, b) => b.score - a.score);
    // Always include q1 (gene info) and q2 (localization) as anchors, then top 2 by score
    const anchors = data.slice(0, 2);
    const topScored = scored.filter(s => !anchors.includes(s.item)).slice(0, 2).map(s => s.item);
    return [...anchors, ...topScored];
}
```

Option B keeps the prompt small while always showing the most relevant examples for the query type.

---

## 7. Fix 5 — Add count and grounding instruction to system prompt

**File:** `ciliai/assistant/assistant-runtime.js`  
**Function:** `buildSystemPrompt(fewShotText, dbContext)` at line 88  
**Impact:** Medium — reduces hallucination for queries that still reach the LLM  

### The problem

The system prompt says "prefer [database context] over general knowledge" but does not explicitly tell the model how many genes exist or that it must use the provided list rather than generating its own.

### The fix

Add two lines to the Rules section in `buildSystemPrompt`:

```javascript
// Add to the base array, after line 115:
'- When DATABASE CONTEXT provides a list of gene symbols for a disease or localization, ' +
  'copy those exact symbols into [ACTIONS_JSON] payload.genes. ' +
  'Do NOT substitute or supplement with genes not in the provided list.',
'- If the DATABASE CONTEXT states "N total" genes, use that number in your [MARKDOWN] response.',
```

This grounds the model's output to the injected data rather than its parametric memory.

---

## 8. Fix 6 — Add a lookup-based intent for gene lists

**File:** `ciliai/assistant/assistant-runtime.js` and `ciliai/ciliai.js`  
**Impact:** Medium — architectural improvement that permanently solves the gene-list accuracy problem  

### The idea

Rather than asking the LLM to enumerate gene lists (which it will do imperfectly), add a new intent `lookup_gene_list` that signals the client to do the lookup itself. The LLM only needs to identify **what** to look up, not enumerate the genes.

**LLM produces:**
```json
{
  "intent": "lookup_gene_list",
  "title": "Joubert Syndrome Genes",
  "payload": { "disease": "Joubert syndrome" },
  "visual": [{ "type": "table", "target": "cilia-svg", "data": { "disease": "Joubert syndrome" } }]
}
```

**Client-side handler in `dispatchActions`:**
```javascript
if (intent === 'lookup_gene_list' && payload.disease) {
    const byCiliopathy = root.CiliAI.lookups?.byCiliopathy || {};
    const qNorm = payload.disease.toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = Object.keys(byCiliopathy).find(k =>
        qNorm.includes(k.replace(/[^a-z0-9]/g, '')) ||
        k.replace(/[^a-z0-9]/g, '').includes(qNorm)
    );
    if (key) {
        const genes = (byCiliopathy[key] || []).map(g =>
            typeof g === 'string' ? g : g.Gene || g.gene
        ).filter(Boolean);
        const title = actions.title || `${payload.disease} Genes`;
        root.showDataInLeftPanel && root.showDataInLeftPanel(title, genes);
    }
}
```

**System prompt addition:**

```
- To show a disease gene list: use intent "lookup_gene_list" with payload { "disease": "<exact disease name from user query>" }.
  The UI will look up the full gene list from the database. You do NOT need to list the genes yourself.
```

This is the architecturally cleanest solution: the LLM acts as a natural language parser (identifying the disease name), and the client performs the authoritative data lookup.

---

## 9. Fix 7 — Add post-dispatch gene validation

**File:** `ciliai/assistant/assistant-runtime.js`  
**Function:** `dispatchActions(actions)` at line 535  
**Impact:** Medium — prevents unknown/hallucinated gene symbols from appearing in tables  

### The problem

When the LLM returns gene symbols in `payload.genes`, some may be hallucinated (not in the CiliaHub database). They will appear as rows in the gene table with "-" in every column, which looks broken and misleads the user.

### The fix

Add a validation filter in `dispatchActions` before calling `showDataInLeftPanel`:

```javascript
function validateGenes(genes) {
    if (!root.CiliAI?.lookups?.geneMap) return genes; // skip if lookups not loaded
    const geneMap = root.CiliAI.lookups.geneMap;
    const valid = genes.filter(g => !!geneMap[String(g).toUpperCase()]);
    const invalid = genes.filter(g => !geneMap[String(g).toUpperCase()]);
    if (invalid.length && root.console) {
        console.warn('[CiliAI] Unrecognized gene symbols dropped:', invalid);
    }
    return valid;
}

// In dispatchActions, before showDataInLeftPanel:
if (intent === 'list_genes' && root.showDataInLeftPanel) {
    const rawGenes = normalizeGenes(payload.genes);
    const genes = validateGenes(rawGenes);  // ADD THIS LINE
    const title = actions.title || payload.title || 'Gene List';
    if (genes.length) root.showDataInLeftPanel(title, genes);
}
```

If all genes are invalid (complete hallucination), the function can show an error message rather than an empty table.

---

## 10. Fix 8 — Extend few-shot coverage for tissue and complex queries

**File:** `ciliai/tests/assistant_golden_cases.json`  
**Impact:** Low-Medium — improves LLM pattern matching for underrepresented query types  

### Missing coverage

The existing 20 golden cases do not include:
- Tissue-specific gene list queries (lung, kidney, hypothalamus)
- Complex-based gene list queries (IFT-A, IFT-B complexes)
- Pan-ciliary / motile cilia queries
- Phylogenetic queries ("Show BBS1 evolution")
- Screen data queries ("Tell me about IFT88 screen")

### Recommended additions

Add these cases to `assistant_golden_cases.json` (6 new entries, q21–q26):

| ID | Question | Key intent |
|---|---|---|
| q21 | "Show lung specific ciliary genes" | `list_genes` with tissue filter |
| q22 | "List IFT-B complex genes" | `lookup_gene_list` with complex name |
| q23 | "Show motile cilia genes" | `list_genes` from `byLocalization['motile cilia']` |
| q24 | "Tell me about IFT88 screen" | `show_gene` with screen panel |
| q25 | "Show BBS1 evolution" | `show_gene` with phylogeny panel |
| q26 | "Show hypothalamus specific ciliary genes" | `list_genes` with tissue context |

Each new case must include a correctly formatted `[MARKDOWN]` + `[ACTIONS_JSON]` response that demonstrates the exact intent and visual structure the LLM should produce.

---

## 11. Fix 9 — Golden test CI integration

**File:** `ciliai/tests/assistant_golden.test.mjs`  
**Impact:** Low (infrastructure) — prevents accuracy regressions silently breaking  

### Current state

`assistant_golden.test.mjs` exists but is not integrated into any CI pipeline. It runs locally only. Changes to `buildSystemPrompt`, `dispatchActions`, or `assistant_golden_cases.json` can break the JSON contract without any automated alert.

### Recommended setup

1. Add a `package.json` at the repo root (or in `ciliai/`) with a test script:

```json
{
  "scripts": {
    "test": "node ciliai/tests/assistant_golden.test.mjs"
  }
}
```

2. Add a GitHub Actions workflow at `.github/workflows/test.yml`:

```yaml
name: CiliAI Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm test
```

The test runner validates that every golden case produces a correctly structured `[MARKDOWN]` + `[ACTIONS_JSON]` response — catching any regression in the response parsing contract before it reaches production.

---

## 12. Summary Table

| Fix | Files changed | Lines of code | Impact | Effort |
|---|---|---|---|---|
| 1. `tryDataFirst` — all ciliopathies | `assistant-runtime.js` | ~25 | **High** | Low |
| 2. `tryDataFirst` — localization lists | `assistant-runtime.js` | ~25 | **High** | Low |
| 3. Full disease gene list in DB context | `assistant-runtime.js` | ~20 | High | Low |
| 4. Use all 20 golden cases | `assistant-runtime.js` | 1 (slice change) | **High** | Trivial |
| 5. Grounding instruction in system prompt | `assistant-runtime.js` | ~4 | Medium | Trivial |
| 6. `lookup_gene_list` intent | `assistant-runtime.js` + `ciliai.js` | ~40 | Medium | Medium |
| 7. Post-dispatch gene validation | `assistant-runtime.js` | ~15 | Medium | Low |
| 8. New few-shot examples | `assistant_golden_cases.json` | ~60 (JSON) | Low-Medium | Medium |
| 9. CI test integration | `.github/workflows/` + `package.json` | ~20 | Low | Low |

---

## 13. Recommended Implementation Order

The four changes below can be done in under an hour and together eliminate the most significant accuracy gap — incomplete gene lists for disease and localization queries:

**Step 1 (5 minutes):** Change `data.slice(0, 4)` to `data` in `loadFewShotExamples()`. Zero risk, immediate improvement to LLM format compliance across all 20 intent types.

**Step 2 (20 minutes):** Add the generic ciliopathy block to `tryDataFirst()`. Test with "List Joubert syndrome genes", "Show PCD genes", "Display Meckel–Gruber genes". All should return the full database list without an LLM call.

**Step 3 (20 minutes):** Add the localization list block to `tryDataFirst()`. Test with "Show transition zone genes", "Display basal body genes", "Show pan-ciliary genes".

**Step 4 (5 minutes):** Add the two grounding lines to `buildSystemPrompt()`. This improves accuracy for any query that still reaches the LLM after the above bypasses.

After these four changes, the chatbot will return correct and complete results for all the example queries on the suggestion cards. The remaining fixes (6–9) are improvements to architecture robustness and should be addressed in a subsequent pass.
