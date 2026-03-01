# CiliAI Chatbot — Technical Analysis

**Version:** ciliai.js v7.2.3 / assistant-runtime.js  
**Date:** March 2026

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File Structure](#2-file-structure)
3. [Data Layer](#3-data-layer)
4. [Query Routing — Full Lifecycle](#4-query-routing--full-lifecycle)
5. [Data-First Engine (No LLM)](#5-data-first-engine-no-llm)
6. [LLM Path — DeepSeek Integration](#6-llm-path--deepseek-integration)
7. [System Prompt Construction](#7-system-prompt-construction)
8. [Response Parsing & Repair](#8-response-parsing--repair)
9. [Intent & Visual Dispatch](#9-intent--visual-dispatch)
10. [UI Rendering Pipeline](#10-ui-rendering-pipeline)
11. [Provider Configuration](#11-provider-configuration)
12. [Golden Cases & Few-Shot Learning](#12-golden-cases--few-shot-learning)
13. [Error Handling & Fallbacks](#13-error-handling--fallbacks)
14. [Legacy Intent Handlers](#14-legacy-intent-handlers)
15. [Known Gaps & Constraints](#15-known-gaps--constraints)

---

## 1. Architecture Overview

CiliAI is a client-side-only chatbot (no backend server) embedded in a static GitHub Pages site. All gene data is loaded into browser memory from JSON files at page load. The LLM call is the only network request at query time, and it is proxied through a Cloudflare Worker to keep the API key out of the browser.

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (client)                     │
│                                                             │
│  User Input                                                 │
│      │                                                      │
│      ▼                                                      │
│  window.handleAIQuery()       [ciliai/ciliai.js:6367]       │
│      │                                                      │
│      ├─ Greeting? ──────────► static help response         │
│      │                                                      │
│      ├─ Force data-first? ──► tryDataFirst()  (no LLM)     │
│      │                                                      │
│      └─ LLM path ───────────► CiliAIAssistant.ask()        │
│              │                   │                          │
│              │           buildSystemPrompt()                │
│              │           provider.chat(messages)            │
│              │                   │                          │
│              │          ┌────────▼────────┐                 │
│              │          │ Cloudflare Worker│                │
│              │          │  (API key proxy) │                │
│              │          └────────┬────────┘                 │
│              │                   │                          │
│              │          DeepSeek API (deepseek-chat)        │
│              │                   │                          │
│              ◄───────────────────┘                          │
│              │                                              │
│      parseAssistantResponse()  → [MARKDOWN] + [ACTIONS_JSON]│
│      renderMarkdown()          → safe HTML                  │
│      addChatMessage()          → inject into #messages      │
│      dispatchActions()         → UI side-effects            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. File Structure

```
ciliai/
├── env.js                        Runtime config (no secrets)
├── ciliai.js                     Main logic engine (v7.2.3, ~7,600 lines)
│                                 — global state, data loading, UI functions,
│                                   intent handlers, handleAIQuery dispatcher
├── assistant/
│   ├── assistant-core.js         Provider-agnostic helpers (UMD module)
│   │                             — INTENTS, KNOWN_TARGETS, parseAssistantResponse,
│   │                               normalizeActions, buildConfig
│   ├── assistant-runtime.js      LLM dispatch + action dispatcher
│   │                             — buildDatabaseContext, buildSystemPrompt,
│   │                               tryDataFirst, ask, dispatchActions,
│   │                               renderMarkdown
│   ├── assistant-verify.js       Verification UI panel
│   └── providers/
│       ├── deepseek.js           DeepSeek API provider (via Cloudflare proxy)
│       └── ollama.js             Local Ollama provider
└── tests/
    ├── assistant_golden_cases.json   20 reference Q&A pairs
    └── assistant_golden.test.mjs    Node.js test runner

data/
├── genes/
│   ├── ciliAI_master_database.json   2,365 genes, full annotations (15.6 MB)
│   └── ciliAI_lookups.json           Pre-indexed lookup maps (14.3 MB)
├── expression/
│   └── ciliai_master_expression.json Tissue RNA expression atlas (5.8 MB)
├── phylogeny/                        Phylogenetic presence/absence matrices
└── umap/                             scRNA-seq UMAP coordinates (chunked)

serverless/
└── cloudflare-worker.js              Cloudflare Worker: API key proxy
```

---

## 3. Data Layer

### 3.1 Master Database (`ciliAI_master_database.json`)

Loaded into `window.CiliAI.masterData` at page init. Contains 2,365 curated ciliary genes with:

| Field | Description |
|---|---|
| `Gene` | HGNC symbol (e.g., `IFT88`) |
| `Gene.Description` | Functional summary |
| `Localization` | Primary ciliary compartment |
| `Ciliopathies` | Array of associated diseases |
| `Ortholog_Mouse` | Mouse ortholog symbol |
| `OMIM_ID` | OMIM disease links |
| `Pfam_Domains` | Domain annotations |
| `Reactome_ID` | Pathway IDs |
| `Gold_Standard` | Boolean flag |

### 3.2 Lookup Maps (`ciliAI_lookups.json`)

Loaded into `window.CiliAI.lookups`. Pre-indexed for O(1) access:

| Key | Description | Approximate size |
|---|---|---|
| `geneMap` | `{ SYMBOL → gene record }` | 2,365 entries |
| `byCiliopathy` | `{ disease_key → [gene list] }` | 70+ diseases |
| `byLocalization` | `{ compartment → [gene list] }` | 20+ compartments |
| `complexByGene` | `{ gene → [complex names] }` | — |
| `complexByName` | `{ complex → [genes] }` | — |
| `byModuleOrComplex` | Module-to-gene map | — |
| `umapByGene` | UMAP cell-type lookup | — |

Notable `byCiliopathy` keys (normalized, e.g. `bardetbiedlsyndrome`):
- Bardet–Biedl syndrome: 25 genes
- Joubert syndrome: 47 genes
- Primary ciliary dyskinesia: 68 genes
- Retinitis pigmentosa: 26 genes
- Nephronophthisis: 20 genes
- Meckel–Gruber syndrome: 17 genes
- Short-rib thoracic dysplasia: 20 genes

`byLocalization` compartments include: cilia (1,021), basal body (855), flagella (352), transition zone (160), motile cilia (84), centrosome (236), nucleus (733), and sub-compartments.

### 3.3 UMAP Data (`data/umap/`)

Chunked JSON files for six tissues: lung, lung_downsampled, kidney, liver, hypothalamus, chondrocyte. Each chunk is loaded lazily when a plot is requested. Coordinates are Plotly scatter data with cell-type annotations and per-gene expression values.

### 3.4 Expression Atlas (`data/expression/ciliai_master_expression.json`)

Tissue-level RNA expression (TPM) for all ciliary genes. Used in tissue-specific query handlers.

---

## 4. Query Routing — Full Lifecycle

Entry point: `window.handleAIQuery(query)` in `ciliai/ciliai.js:6367`.

```
window.handleAIQuery(query)
│
├─ 1. Guard: CiliAI.ready? → "Data is still loading..." if false
│
├─ 2. Greeting detection
│      window.CiliAIAssistant.isGreeting(query)
│      Regex: /^(hi|hello|hey|selam|merhaba|how are you|help|thanks|...)\b/
│      └─ If LLM disabled → static help response (no network call)
│         If LLM enabled → falls through to LLM path
│
├─ 3. LLM path (if CiliAIAssistant.isEnabled())
│      │
│      ├─ Show "Thinking..." bubble
│      │
│      └─ CiliAIAssistant.ask(query)
│             │
│             ├─ shouldForceDataFirst(query)?
│             │    Patterns: 'gold standard', BBS/bardet/biedl display,
│             │              'where is cep290 localized'
│             │    └─ tryDataFirst(query) → returns immediately, no LLM
│             │
│             ├─ tryDataFirst(query)  [if chatMode = 'data_first']
│             │
│             ├─ loadFewShotExamples()
│             │    Fetches assistant_golden_cases.json; uses first 4 entries
│             │
│             ├─ buildDatabaseContext(query)
│             │    Extracts gene names from query → looks up geneMap
│             │    Injects ≤12 gene descriptions into system prompt
│             │    Also handles BBS/Gold Standard context fallbacks
│             │
│             ├─ buildSystemPrompt(fewShotText, dbContext)
│             │
│             └─ provider.chat([system, user]) → raw LLM response
│
├─ 4. Data-only path (LLM unavailable or disabled)
│      CiliAIAssistant.getDataOnlyResponse(query) = tryDataFirst(query)
│
├─ 5. Legacy BBS shortcut (qLower contains 'bardet'/'biedl'/'bbs')
│      window.showBBSGenes()
│
└─ 6. Legacy intentHandlers[] loop
       Sorted by priority (descending)
       Pattern-matching fallback for all other queries
```

### Configuration flags that affect routing (`ciliai/env.js`)

| Flag | Values | Effect |
|---|---|---|
| `CILIAI_ASSISTANT_V2` | `'true'` / `'false'` | Enables/disables LLM path entirely |
| `CILIAI_ASSISTANT_CHAT_MODE` | `'llm_first'` / `'data_first'` | Controls whether `tryDataFirst` runs before LLM |
| `CILIAI_LLM_PROVIDER` | `'deepseek'` / `'ollama'` | Selects provider |
| `CILIAI_ASSISTANT_DRY_RUN` | `'true'` / `'false'` | Returns mock instead of live API call |
| `CILIAI_ASSISTANT_FORCE_FAILURE` | `'true'` / `'false'` | Always returns fallback (for testing) |

---

## 5. Data-First Engine (No LLM)

`tryDataFirst(query)` in `assistant-runtime.js:464` is a rule-based engine that short-circuits the LLM for well-defined query patterns. It fires **before** the LLM call when `shouldForceDataFirst()` returns true, or when `chatMode = 'data_first'`.

### Covered patterns

| Pattern | Data source | Response builder |
|---|---|---|
| Greeting / "help" | — | `buildHelpResponse()` |
| `(show\|list\|display) + bardet\|biedl\|bbs` (not "what is") | `byCiliopathy[bardet-biedl key]` | `buildBbsListResponse()` |
| `gold standard` | `CiliAI.masterData` (all entries) | `buildGoldStandardResponse()` |
| `where is\|localized\|localised\|localization` + gene name | `geneMap[symbol].Localization` | `buildLocalizationResponse()` + `tryHighlightLocalization()` |
| `what is\|tell me about` + known gene | `geneMap[symbol]` | `buildGeneInfoResponse()` |

### What is NOT covered (falls through to LLM)

- Disease gene list queries other than BBS (e.g., "List Joubert syndrome genes")
- Localization gene list queries (e.g., "Show basal body genes")
- Tissue-specific queries ("Lung specific ciliary genes")
- Comparison, plot, domain, and navigation requests
- Complex / multi-gene queries

---

## 6. LLM Path — DeepSeek Integration

### Provider chain

```
assistant-runtime.js: ask()
  → getProvider(config)
    → new DeepSeekProvider({
        proxyUrl: 'https://sweet-poetry-5f25.ramiz-karadeniz81.workers.dev/api/chat',
        model: 'deepseek-chat',
        temperature: 0.2,
        timeoutMs: 60000,
        retries: 2
      })
      → POST proxyUrl { messages, model, temperature, stream: false }
        → Cloudflare Worker
          → POST https://api.deepseek.com/v1/chat/completions
            ← { choices[0].message.content }
        ← raw LLM text
```

### Security model

The DeepSeek API key is stored exclusively as a Cloudflare Worker secret (`DEEPSEEK_API_KEY`). It is never present in browser JavaScript or any committed file. The proxy URL is public but optionally protected by a bearer token (`CILIAI_PROXY_SECRET`).

The Cloudflare Worker (`serverless/cloudflare-worker.js`) also exposes `GET /api/chat/health` which returns `{ ok, keyConfigured, authRequired }` for diagnostics.

### Request structure

```json
{
  "model": "deepseek-chat",
  "temperature": 0.2,
  "messages": [
    { "role": "system", "content": "<system prompt + few-shot + DB context>" },
    { "role": "user",   "content": "<raw user query>" }
  ]
}
```

No conversation history is sent. Every call is a fresh two-message context (system + single user turn). This keeps costs low but means the model has no memory of previous turns.

---

## 7. System Prompt Construction

`buildSystemPrompt(fewShotText, dbContext)` in `assistant-runtime.js:88` assembles the system prompt in this order:

```
1. Role definition
   "You are CiliAI, a friendly and knowledgeable AI assistant for ciliary biology..."

2. HOW TO TALK instructions
   - Natural language, no rigid templates
   - Greetings: warm, brief
   - Science questions: clear answer first, then details
   - Concise but informative

3. RESPONSE FORMAT contract (mandatory)
   [MARKDOWN]
   <natural text>

   [ACTIONS_JSON]
   { "intent": "...", "title": "...", "payload": {...}, "visual": [...] }

4. Rules
   - [MARKDOWN] is what the user sees
   - [ACTIONS_JSON] MUST be valid JSON
   - Use only known targets: cilia-svg, plotly-container, domain-viewer,
     cilia-diagram, messages, viz-stage, tab-*, #ciliai, #gene/{SYMBOL}
   - Intents: none, list_genes, show_gene, show_disease, filter, plot,
     compare, navigate, help, visualize_bbs_list

5. DATABASE CONTEXT  (injected by buildDatabaseContext, ≤12 genes)
   "DATABASE CONTEXT (use this data to answer; prefer it over general knowledge):
   IFT88: Intraflagellar transport protein... | Localization: axoneme
   ..."

6. Few-shot examples  (first 4 entries from assistant_golden_cases.json)
   "User: What is IFT88?
   Assistant:
   [MARKDOWN]
   ...
   [ACTIONS_JSON]
   {...}"
```

### `buildDatabaseContext` detail

Located in `assistant-runtime.js:8`. Behavior:

1. Calls `CiliAI.utils.extractGenes(query)` to find gene symbols mentioned in the query text
2. For each (up to 12): looks up `geneMap[SYMBOL]`, formats `name: description | Localization: X`
3. If no genes found and query mentions "gold standard" or "ciliary genes" → injects first 8 master genes
4. If no genes found and query mentions "bardet"/"biedl"/"bbs" → injects up to 10 BBS genes from `byCiliopathy`
5. Returns empty string if nothing found (no DB context injected)

**Critical limitation**: for disease queries like "List Joubert syndrome genes", no genes are extracted from the query text (the query contains no gene symbols), and there is no fallback for non-BBS ciliopathies. The model receives zero database context and must generate the gene list from its parametric knowledge.

---

## 8. Response Parsing & Repair

### `parseAssistantResponse(text)` — `assistant-core.js:118`

Splits LLM output on `[MARKDOWN]` and `[ACTIONS_JSON]` tags:

```
raw = "...[MARKDOWN]\nsome text\n\n[ACTIONS_JSON]\n{...}"

→ markdown = text between [MARKDOWN] and [ACTIONS_JSON]
→ jsonText  = text after [ACTIONS_JSON]
→ JSON.parse(jsonText) → actions object
→ normalizeActions(actions) validates intent + visual items
```

If either tag is missing or `[ACTIONS_JSON]` comes before `[MARKDOWN]`, the entire raw text becomes `markdown` and `actions` is `noOpActions()`.

### `tryRepairJson(content)` — `assistant-runtime.js:714`

Fires when `JSON.parse` fails. Strategy:
1. Locate `[ACTIONS_JSON]` marker
2. Extract substring from first `{` to last `}`
3. Strip trailing commas: `block.replace(/,\s*([}\]])/g, '$1')`
4. Retry `JSON.parse`

This handles the most common LLM JSON formatting errors (trailing commas).

### `normalizeActions(actions)` — `assistant-core.js:106`

Validates the parsed actions object:
- `intent` must be in the `INTENTS` whitelist; defaults to `'none'` if invalid
- `payload` must be a plain object
- `visual` array items are filtered through `normalizeVisualItem()` which requires `type`, `target` (must be in `KNOWN_TARGETS`), and `data`

### `validateMarkdownTemplate(markdown)` — `assistant-core.js:155`

Currently only checks `markdown.trim().length > 0`. If false, `repairResponse()` is called which preserves whatever markdown existed and replaces with a generic fallback message.

### `buildDatabaseSummaryForDisplay` — appended after LLM response

After a successful LLM response, `buildDatabaseSummaryForDisplay(query)` (lines 48–86) generates a "From the database:" footer in the chat bubble showing verified gene data for any genes mentioned in the query. This runs independently of the LLM, ensuring that even if the LLM's description is slightly off, the hard facts are displayed below.

---

## 9. Intent & Visual Dispatch

`dispatchActions(actions)` in `assistant-runtime.js:535`.

### Intent handlers

| Intent | Condition | Action |
|---|---|---|
| `list_genes` | `showDataInLeftPanel` exists | `showDataInLeftPanel(title, genes)` — renders sortable table |
| `visualize_bbs_list` | same | same — separate intent for BBS styling |
| `plot` | `renderUMAPPlot` exists + `payload.gene` | `switchView('plot')` + `renderUMAPPlot(gene, genes, zoomToCellType)` |
| `compare` | `handleComparativeDashboard` exists + `payload.genes.length > 1` | `handleComparativeDashboard('GENE1 vs GENE2')` |
| `navigate` | `payload.route` | `navigateTo()` or `location.hash = route` |

### Visual array handlers

Each `visual[]` item is processed after intent handlers:

| `type` | Condition | Action |
|---|---|---|
| `highlight` | `SpatialManager` + `data.localization` | `showDiagram()` + `SpatialManager.highlight(localization, gene)` |
| `plot` | `renderUMAPPlot` + `data.gene` | `switchView('plot')` + `renderUMAPPlot(...)` |
| `table` / `list` / `panel` | `showDataInLeftPanel` + `data.genes.length` | `showDataInLeftPanel(title, genes)` |
| `panel` + target `domain-viewer` | `showDomainViewer` + `data.gene` | `switchView('domain')` + `showDomainViewer(gene)` |
| `link` | `data.route` + `navigateTo` | `navigateTo(null, route)` |

**Gene normalization**: `normalizeGenes(input)` converts all gene symbols to uppercase, handling both string arrays and comma-separated strings.

---

## 10. UI Rendering Pipeline

### `renderMarkdown(markdown)` — `assistant-runtime.js:137`

Line-by-line markdown → HTML converter (no external library):

| Input | Output |
|---|---|
| `# Heading` | `<h2>` (level + 1) |
| `## Heading` | `<h3>` |
| `- bullet` or `* bullet` | `<li>` in `<ul>` |
| `**bold**` | `<strong>` |
| blank line | `<br>` + close `</ul>` if open |
| any other line | `<p>` |

All text is HTML-escaped via `escapeHtml()` before rendering. Output is wrapped in `<div class="assistant-markdown">`.

### `showDataInLeftPanel(title, geneList)` — `ciliai.js:714`

Renders the gene table in `#cilia-svg`:
1. Hides `#plotly-container` and `#domain-viewer`
2. Augments each gene: looks up `geneMap[SYMBOL]` to fill Description, Localization, Ciliopathy, Mouse Ortholog
3. Renders an HTML table with inline styles (up to 200 rows displayed; full set available for CSV export)
4. Adds a live filter input (`#ciliai-table-filter`) and CSV export button
5. Each row has two action buttons: "View Details" → `displayFullGeneInfo(gene)` and "View Plot" → `renderUMAPPlot(gene, [gene])`

### `renderUMAPPlot(displayName, targetGenes, zoomToCellType)` — `ciliai.js:3824`

Async function that:
1. Checks `CiliAI.activeDataset` (default: `'lung'`)
2. Loads UMAP chunk files for the active dataset if not cached
3. Builds Plotly scatter trace with expression values color-coded per cell type
4. Calls `Plotly.newPlot('#plotly-container', ...)` 
5. Attaches `plotly_click` handler → triggers `SpatialManager.highlight` on cell type click

### `SpatialManager.highlight(localization, gene)` — `ciliai.js`

Maps localization strings from the LLM to SVG element IDs on the interactive cilium diagram. Returns `true` if a match was made. Localization strings are fuzzy-matched against the SVG parts: `basal-body`, `transition-zone`, `axoneme`, `ciliary-membrane`, `nucleus`, `cell-body`.

---

## 11. Provider Configuration

### Current production config (`ciliai/env.js`)

```javascript
window.CILIAI_ENV = {
    CILIAI_ENV_VERSION: 'v1-deepseek',
    CILIAI_ASSISTANT_V2: 'true',
    CILIAI_LLM_PROVIDER: 'deepseek',
    CILIAI_ASSISTANT_CHAT_MODE: 'llm_first',
    CILIAI_MODEL: 'deepseek-chat',
    CILIAI_ASSISTANT_TEMPERATURE: '0.2',
    CILIAI_ASSISTANT_TIMEOUT_MS: '60000',
    CILIAI_ASSISTANT_RETRIES: '2',
    CILIAI_ASSISTANT_PROXY_URL: 'https://sweet-poetry-5f25.ramiz-karadeniz81.workers.dev/api/chat',
    CILIAI_PROXY_SECRET: '',
    CILIAI_ASSISTANT_DRY_RUN: 'false',
    CILIAI_ASSISTANT_FORCE_FAILURE: 'false',
    CILIAI_DEBUG: 'false'
};
```

### DeepSeek provider (`ciliai/assistant/providers/deepseek.js`)

- Sends request to `proxyUrl` (Cloudflare Worker)
- Retries up to `retries` times on failure
- Aborts via `AbortController` after `timeoutMs`
- Handles HTTP 402 (insufficient balance) as a distinct error type

### Ollama provider (`ciliai/assistant/providers/ollama.js`)

- Endpoint: `http://localhost:11434/api/chat`
- Model: configurable (default `llama3.1`)
- Timeout: 120s (longer for local inference)
- Used for local development; no API key required

### `buildConfig()` — `assistant-core.js:45`

Reads all config from `window.CILIAI_ENV`. Returns a fully typed config object with defaults. Called fresh on every `ask()` invocation (not cached), allowing runtime config changes.

---

## 12. Golden Cases & Few-Shot Learning

### `ciliai/tests/assistant_golden_cases.json`

20 reference Q&A pairs covering the main intent types:

| ID | Question | Intent |
|---|---|---|
| q1 | What is IFT88? | show_gene + highlight (axoneme) |
| q2 | Where is CEP290 localized? | show_gene + highlight (transition zone) |
| q3 | List genes in the transition zone | list_genes + table (5 genes) |
| q4 | Show expression plot for ARL13B | plot + UMAP |
| q5 | Plot UMAP for FOXJ1 in lung | plot + UMAP |
| q6 | Show domains for KIF3A | show_gene + domain-viewer panel |
| q7 | List genes associated with Joubert syndrome | list_genes + table (5 genes hardcoded) |
| q8 | Compare IFT88 vs BBS1 | compare + panel |
| q9 | Highlight axoneme genes: DNAH5 and DNAI1 | list_genes + highlight + table |
| q10 | Show top ciliary genes list | list_genes + table |
| q11 | Show ARL13B and TMEM67 plot | plot (multi-gene) |
| q12 | What ciliopathy is BBS1 associated with? | show_gene |
| q13 | Show me genes in the basal body | list_genes + table + highlight |
| q14 | Open the CiliAI page | navigate |
| q15 | Help | help |
| q16 | Filter for localization: membrane | filter + table |
| q17 | Show domain panel for OFD1 | show_gene + domain-viewer |
| q18 | List genes in the BBSome complex | list_genes + table (5 genes) |
| q19 | Plot UMAP for IFT88 and IFT81 | plot (multi-gene) |
| q20 | Show table for genes: IFT88, CEP290, TMEM67 | list_genes + table |

### How they are used

`loadFewShotExamples()` in `assistant-runtime.js:182`:
1. Fetches `./ciliai/tests/assistant_golden_cases.json`
2. Caches result in `window.CiliAIFewShotCache` (fetched once per page load)
3. **Takes only the first 4 entries** (`data.slice(0, 4)`)
4. Converts each via `convertGoldenToTemplate()` which re-formats the markdown section and re-serializes the actions JSON
5. Formats as `User: {question}\nAssistant:\n{formatted response}`
6. Appended to system prompt under `"Examples:"`

**Critical gap**: Only q1–q4 are ever used as few-shot examples (IFT88 info, CEP290 localization, transition zone list, ARL13B plot). The 16 remaining cases (compare, domains, BBS, navigate, filter, etc.) are never shown to the model at inference time.

---

## 13. Error Handling & Fallbacks

### API failure cascade

```
provider.chat() throws
  │
  ├─ Is 402 / insufficient balance?
  │    └─ tryDataFirst(query) + note: "⚠️ DeepSeek balance insufficient (402)"
  │
  ├─ preferLlm=true and tryDataFirst returns a result?
  │    └─ return data-first result + "⚠️ API unavailable" note
  │
  ├─ provider = 'ollama'?
  │    └─ buildFallbackResponse("Local AI not running. Start Ollama.")
  │
  └─ default
       └─ buildFallbackResponse(e.message)
```

`buildFallbackResponse()` always returns a helpful response suggesting 3 specific queries the user can try next.

### JSON repair

`tryRepairJson()` handles trailing-comma JSON. If it also fails, `repairResponse()` keeps whatever markdown was parsed and falls back to `noOpActions()` (no UI side-effects).

### Guard rail in `handleAIQuery`

After `finalizeAssistantOutput()`, the caller verifies both `[MARKDOWN]` and `[ACTIONS_JSON]` tags are present in the final string. If either is missing (theoretically unreachable since `finalizeAssistantOutput` always inserts them), it forces a fallback response:

```javascript
if (!finalText.includes('[MARKDOWN]') || !finalText.includes('[ACTIONS_JSON]')) {
    // rebuild with buildFallbackResponse
}
```

---

## 14. Legacy Intent Handlers

`intentHandlers[]` in `ciliai.js` is a priority-sorted array of `{ matcher, handler, priority }` objects. These fire last — only if the LLM path and data-only path both produce nothing.

They are pattern-matched regex/string handlers covering queries such as:
- Dot plots
- Gene screen data
- Mouse ortholog queries
- WDR31 specific handling
- Tissue-specific gene lists
- Phylogenetic data queries

These handlers call older UI functions directly (HTML-returning async functions) and bypass the new `[MARKDOWN] / [ACTIONS_JSON]` contract entirely.

---

## 15. Known Gaps & Constraints

| Gap | Location | Impact |
|---|---|---|
| `buildDatabaseContext` only injects genes named in the query text | `assistant-runtime.js:32` | LLM has no database context for disease/localization list queries |
| `tryDataFirst` only covers BBS + Gold Standard + single-gene localization | `assistant-runtime.js:464` | All other ciliopathy and localization list queries hit the LLM unguided |
| Only first 4 golden cases used as few-shot | `assistant-runtime.js:188` | 16 intents (compare, domain, filter, navigate, etc.) have no example to follow |
| LLM has no conversation history | `assistant-runtime.js:643` | Cannot answer follow-up questions referencing previous turns |
| Table display capped at 200 rows | `ciliai.js:771` | Large gene lists (e.g., all 1,021 cilia genes) are truncated in the UI |
| Gene lists in golden cases are hardcoded small sets | `assistant_golden_cases.json` | Model learns to return 5 genes for Joubert syndrome instead of the full 47 |
| `validateMarkdownTemplate` only checks non-empty | `assistant-core.js:155` | Weak validation; malformed markdown passes through |
| No conversation memory | `ask()` | Cannot reference previous answers |
| External API call to `mygene.info` for variant data | `ciliai.js:6473` | Subject to CORS, rate limits, network errors |
