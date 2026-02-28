**CiliaHub - Interactive Ciliary Gene Database**
<img width="1024" height="354" alt="image" src="https://github.com/user-attachments/assets/c003b219-a130-4026-b047-f2098b008b79" />
**Overview**

CiliaHub is a comprehensive, interactive platform for ciliary gene research. It combines advanced search capabilities, expression visualization, and optimized data handling to accelerate discovery in ciliary biology.

➡️ E**xplore the database: https://theciliahub.github.io/**

**New Features (Latest Update)**
**Gene Expression Visualization**

**Interactive Human Body Panel**: Organ-specific gene expression shown dynamically.

**Dynamic Gene Search:** Real-time suggestions while typing.

**Color-Coded Expression**: nTPM-based visualization across tissues.

**Detailed Expression Table:** Organized, categorized expression data.

**Performance Optimizations**

**Optimized Dataset**: Limited to 2011 curated genes for fast performance.

**Real-Time Filtering:** No dropdown lag.

**Efficient Data Handling:** Improved TSV parsing, caching, and memory use.

**Reduced Reloads:** Integrated visualization without repeated file loading.

**SVG Integration:** Direct color updates to the existing file.svg.

**Enhanced Search**

**Smart Auto-Suggestions:** e.g., typing AR shows all genes beginning with AR.

**Synonym & ID Search:** Matches by gene names, synonyms, and Ensembl IDs.

**Instant Results:** Sub-100ms query responses.

**Features
Gene Search & Discovery**

**Single Gene Search:** Instant lookup with detailed info.

**Batch Query Tool:** Analyze multiple genes simultaneously.

**CSV Upload:** Bulk gene analysis.

**Dynamic Suggestions:** Real-time filtering.

**Expression Visualization**

**Organ Highlighting:** Color-coded organs via file.svg.

**Hover Tooltips:** Exact nTPM values.

**Expression Categories:**

🟢 Low: 0–5 nTPM (#A8E6A1)

🟢 Medium: 5–15 nTPM (#6CC96C)

🟢 High: 15–30 nTPM (#3FAF3F)

🟢 Very High: >30 nTPM (#1E7B1E)

**Interactive Cilium Model**

**3D Visualization:** SVG-based cilium model.

**Gene Localization:** Highlighted subcellular locations.

**Functional Representation:** Genes linked to their roles.

**Data Management**

**Comprehensive Database:** 2,000+ ciliary-related genes.

**Export Options:** JSON and CSV download support.

**Technical Implementation
Architecture**

**SPA:** Single Page Application with vanilla JavaScript.

**Modular Design:** Separate systems for search, visualization, and data.

**Performance-Driven:** Optimized algorithms for speed and efficiency.

**Data Sources**

**ciliahub_data.json:** Core gene database.

**rna_tissue_consensus.tsv:** Expression data from the Human Protein Atlas.

**External APIs:** Ensembl, OMIM.

**Performance Features**

**Lazy Loading:** Load only when needed.

**Session Caching:** Fast repeat access.

**Debounced Search:** Smooth query handling.

**Memory Management**: Efficient cleanup.

**Usage Guide
Gene Search**

Open the homepage.

Type a gene (e.g., ARL13B).

See instant results.

Click for detailed info.

Expression Visualization

Open the Expression page.

Search a gene in the left panel.

View highlighted organs.

Explore data tables.

Hover for values.

Batch Analysis

Navigate to Batch Query.

Enter multiple genes or upload CSV.

Analyze results in bulk.

**Browser Compatibility**

Chrome 80+, Firefox 75+, Safari 13+.

Responsive design for mobile/tablet.

Requires JavaScript (ES6+).

**CiliAI Assistant (DeepSeek Integration)**

This repository supports a feature-flagged DeepSeek assistant. The UI defaults to the legacy rule-based assistant unless enabled.

**Environment Variables**

- `CILIAI_LLM_PROVIDER=deepseek`
- `CILIAI_MODEL=deepseek-chat`
- `CILIAI_ASSISTANT_V2=true|false`
- `CILIAI_ASSISTANT_TEMPERATURE=0.1–0.3`
- `CILIAI_ASSISTANT_TIMEOUT_MS=15000`
- `CILIAI_ASSISTANT_RETRIES=2`
- `CILIAI_ASSISTANT_PROXY_URL=https://your-proxy.example.com/api/chat`
- `CILIAI_PROXY_SECRET=` — Optional. If set in the Worker, the frontend must send this token (Bearer or X-CiliAI-Token) to call the proxy. Keeps the API hidden from unauthorized use.
- `CILIAI_ASSISTANT_DRY_RUN=true|false`
- `CILIAI_ASSISTANT_FORCE_FAILURE=true|false`
- `CILIAI_DEBUG=true|false`

**Important (Static Site)**

If you do not want the API key visible in the browser, you must use a proxy. The browser should **never** call `api.deepseek.com` directly.

**Local Development (.env → env.js)**

1. Copy `ciliai/env.example.js` to `ciliai/env.js` and set values, or create `ciliai/.env`.
2. If using `.env`, run:
   - `node ciliai/tools/build_env.js`
3. Reload the page. The runtime reads `window.CILIAI_ENV` from `ciliai/env.js`.

**Proxy Setup (No key in browser)**

This repo includes a simple Cloudflare Worker in `serverless/cloudflare-worker.js`.

Steps (plain language):
1. Create a Cloudflare Worker.
2. Add a secret named `DEEPSEEK_API_KEY` in the Worker settings.
3. Deploy the Worker and copy its URL.
4. Set `CILIAI_ASSISTANT_PROXY_URL` in `ciliai/env.js` to `https://your-worker-url/api/chat`.
5. (Optional) In the Worker, add a secret `CILIAI_PROXY_SECRET`. In `ciliai/env.js` set the same value for `CILIAI_PROXY_SECRET`. Only requests with this token will be accepted (API stays hidden).
6. Open the site and use the **Assistant Verification** panel.

**Chatbot + database (RAG)**

The assistant uses your loaded CiliAI data so the LLM can answer from the database:

- On each question, relevant genes and facts are taken from `CiliAI.masterData` and `CiliAI.lookups` (geneMap, byCiliopathy).
- This context is injected into the system prompt so DeepSeek answers using your DB (gene descriptions, localizations, Bardet–Biedl list, Gold Standard), not only general knowledge.
- No training or fine-tuning: retrieval at query time (RAG-style).

**Tests (Golden Contract)**

- Run: `node --test ciliai/tests/assistant_golden.test.mjs`
- Tests validate the `[MARKDOWN]` + `[ACTIONS_JSON]` contract and known UI targets.

**Assistant Verification Mode (UI-only)**

- Open the site and click **Assistant Verification** in the CiliAI panel, or go to `#verify` or `/verify.html`.
- Click **Run Verification** to execute UI checks and view ✅/❌ results.
- Use **Try in Assistant** buttons to replay example questions.

**Performance Metrics**

Initial Load: <2s

Search: <100ms

Expression Rendering: <200ms

Memory: Optimized for large datasets

Data Sources & Citations

Human Protein Atlas: Tissue expression.

Ensembl: Gene annotations and IDs.

OMIM: Disease associations.

Primary Research: Expanded ciliary gene catalog.

**Contributing**

CiliaHub is actively maintained by the research team.

**Contact:**

Dr. Oktay I. Kaplan – oktay.kaplan@agu.edu.tr

Ferhan Yenisert – ferhan.yenisert@agu.edu.tr

**License**

Research use only. Please cite relevant sources when publishing.

**Version History**

v1.0 – Initial release with gene database functionality.

**About the Project**

**CiliaHub:** An Expanded Catalog of Human Ciliary Genes

CiliaHub expands the known human ciliome by combining automated PubMed literature mining with manual expert curation.

**Automated Discovery:** Systematic searches using gene symbols & cilia-related terms.

Manual Accuracy Check: Expert review of all flagged genes.

Ciliome Expansion: Increased from 688 genes (SYSCILIA Gold Standard v2) to >2,000 curated genes.
