# CiliAI Chatbot — Plain Language Guide

*For biologists, clinicians, and anyone curious about cilia — no coding knowledge required.*

---

## What is CiliAI?

CiliAI is a conversational assistant built into the CiliaHub website. You can type questions in plain English, and it will answer using a curated database of over 2,300 ciliary genes, along with disease associations, tissue expression data, and structural biology resources.

Think of it as a knowledgeable lab colleague who has read every paper on ciliary biology and can instantly cross-reference the curated CiliaHub database for you.

---

## What can I ask CiliAI?

CiliAI can help with five broad categories of questions:

### 1. Gene information
Ask about a specific gene and get a summary of its function, where it sits in the cilium, and which diseases it is linked to.

- *"What is IFT88?"*
- *"Tell me about CEP290"*
- *"What ciliopathy is BBS1 associated with?"*

### 2. Gene lists by disease or location
Ask for all the genes known to be associated with a particular ciliopathy, or all genes found in a specific compartment of the cilium.

- *"List Joubert syndrome genes"*
- *"Show genes in the transition zone"*
- *"Display Bardet–Biedl syndrome genes"*
- *"Show Gold Standard ciliary genes"*

### 3. Expression data
Ask where a gene is expressed across tissues or which cell types in a given organ express it. CiliAI can display interactive single-cell RNA-sequencing plots.

- *"Show expression plot for ARL13B"*
- *"Plot UMAP for FOXJ1 in lung"*
- *"Lung specific ciliary genes"*
- *"Show genes enriched in proximal tubule cells"*

### 4. Protein domains
Ask to see the protein domain architecture of any ciliary gene.

- *"Show domains for KIF3A"*
- *"Show domain panel for OFD1"*
- *"WDR31 domains"*

### 5. Comparisons and exploration
Compare two genes side by side, explore evolutionary conservation, or navigate to different parts of the CiliaHub portal.

- *"Compare IFT88 vs BBS1"*
- *"Show BBS1 evolution"*
- *"Display ARL13B mouse ortholog"*

---

## How does a question get answered?

When you type a question, CiliAI follows a decision tree to find the best answer. Here is what happens in plain terms:

```
You type a question
        │
        ▼
Is it a greeting or "help"?
  Yes → CiliAI responds warmly and suggests example questions.
        (No database or AI is needed.)
        │
        ▼
Is it a well-known query type?
  (Gold Standard genes, ANY ciliopathy gene list such as
   Joubert syndrome / PCD / Nephronophthisis / etc.,
   ANY compartment gene list such as basal body / transition zone / axoneme,
   "where is [gene] localized?", "what is [gene]?")
  Yes → CiliAI looks up the answer directly in its curated database.
        This is instant, always accurate, and uses no AI.
        Returns the COMPLETE list from the database.
        │
        ▼
Everything else →
  CiliAI sends your question to an AI assistant (DeepSeek)
  along with:
    • Relevant gene descriptions or gene symbol lists from the database
    • 20 worked examples of similar questions
    • Instructions to use database data rather than memory
  
  The AI writes a natural-language answer AND specifies
  which visual to show (a table, a diagram highlight, a plot, etc.)
        │
        ▼
CiliAI shows you:
  • A text answer in the chat panel
  • One or more visuals: gene table, diagram, expression plot, or domain panel
```

---

## The two "brains" inside CiliAI

CiliAI uses two different systems to answer your questions, and it is important to understand what each one is good at.

### Brain 1 — The Curated Database (always accurate)

This is a hand-curated dataset of 2,365 genes from published literature, expert curation, and established databases (OMIM, Human Protein Atlas, Reactome). When CiliAI uses this brain, the answer is drawn directly from structured records and is 100% reliable.

**Used for:**
- Gene descriptions and localizations
- Gold Standard gene list (the best-validated ciliary genes)
- Gene lists for any of the 70+ ciliopathies in the database (Bardet–Biedl, Joubert syndrome, Primary Ciliary Dyskinesia, Nephronophthisis, Meckel–Gruber, and more) — always the complete, curated list
- Gene lists for any ciliary compartment (basal body, transition zone, axoneme, ciliary membrane, and more) — always the complete, curated list
- Disease associations stored in the database
- Tissue expression values
- Protein domain annotations

### Brain 2 — The AI Language Model (flexible but imperfect)

This is an AI trained on scientific literature (DeepSeek's language model). It can understand natural language, infer what you mean even if your question is phrased unusually, and generate coherent explanations. However, it works from memory and can sometimes:
- Phrase a description slightly differently from the primary source
- Occasionally suggest a gene symbol that is not in the CiliaHub database (these are automatically removed before displaying)
- Give partial results for queries it does not recognise as a database lookup (e.g., tissue-specific gene lists)

**Used for:**
- Explaining gene function in plain language
- Handling complex or open-ended questions
- Comparison queries
- Navigation requests
- Any question not covered by the database-first rules

### How they work together

When the AI model answers your question, the database runs a verification step in the background. Any genes mentioned in your question are looked up in the curated database, and their verified descriptions, localizations, and disease links are appended to the response as a "From the database:" footer. This way, even when the AI is answering, you always get the database-verified facts alongside it.

---

## Understanding the visuals

Depending on your question, CiliAI may show one of four types of visuals.

### Gene Table

A sortable, filterable table listing the relevant genes with:
- **Gene symbol** (e.g., IFT88)
- **Description** — what the gene does
- **Localization** — where in the cilium it is found
- **Ciliopathy** — which disease(s) it is associated with
- **Mouse ortholog** — the equivalent gene in mice
- Two action buttons per row: one to view full gene details, one to launch an expression plot

You can type in the filter box to narrow the list, or download the full set as a CSV file.

### Ciliary Diagram Highlight

An interactive diagram of the cilium with labelled compartments:
- Basal body
- Transition zone
- Axoneme
- Ciliary membrane
- Nucleus / cell body

When you ask about a gene's localization, or ask for genes in a compartment, CiliAI highlights the relevant part of the diagram. You can also click any compartment directly to explore genes in that region.

### UMAP Expression Plot

A scatter plot showing thousands of individual cells from a tissue (lung, kidney, liver, hypothalamus, or chondrocyte). Each dot is a single cell; the colour indicates how strongly your gene of interest is expressed in that cell. Cells of the same type cluster together, so you can immediately see which cell types are enriched for your gene.

You can switch between tissue datasets using the buttons above the plot, and click any cluster to highlight the corresponding ciliary compartment on the diagram.

### Protein Domain Panel

A linear diagram of the protein showing all annotated Pfam domains along the amino acid sequence. This is useful for interpreting the functional regions of a gene and for comparing domain architecture between genes.

---

## Example questions and what to expect

| Question | What CiliAI does |
|---|---|
| *"Show Gold Standard ciliary genes"* | Opens a table of all curated Gold Standard genes (instant, from database) |
| *"Display Bardet–Biedl genes"* | Opens a table of all 25 BBS-associated genes (instant, from database) |
| *"List Joubert syndrome genes"* | Opens a table of all 47 Joubert syndrome genes (instant, from database) |
| *"List Primary Ciliary Dyskinesia genes"* | Opens a table of all 68 PCD genes (instant, from database) |
| *"Show transition zone genes"* | Opens a table of all 160 transition zone genes + highlights the compartment on the diagram (instant, from database) |
| *"Display basal body genes"* | Opens a table of all 855 basal body genes (instant, from database) |
| *"Where is CEP290 localized?"* | States "transition zone", highlights it on the diagram (instant, from database) |
| *"What is IFT88?"* | Returns a paragraph summary with localization and disease links (instant, from database) |
| *"Show expression plot for ARL13B"* | Launches the UMAP scatter plot coloured by ARL13B expression |
| *"Show domains for KIF3A"* | Opens the protein domain panel for KIF3A |
| *"Compare IFT88 vs BBS1"* | Opens a side-by-side comparison panel |
| *"Lung specific ciliary genes"* | Returns genes enriched in lung ciliated cells |

---

## What CiliAI cannot do (current limitations)

It helps to know where the boundaries are:

**It does not remember previous questions.**
Each question is treated independently. If you ask "What is IFT88?" and then "Where is it expressed?", the word "it" will not be understood as referring to IFT88. Always name the gene explicitly.

**Tissue-specific gene lists are handled by the AI, not the database.**
Queries like "Lung specific ciliary genes" or "Show hypothalamus ciliary genes" are answered by the AI model rather than a direct database lookup. Results are generally good but may not be complete for less studied tissues.

**Protein complex gene lists are handled by the AI.**
Queries like "List IFT-B complex genes" are answered by the AI model. The database has complex membership data, but the direct lookup for complex names is not yet wired to the data-first engine.

**It only knows about ciliary biology.**
CiliAI is not a general-purpose assistant. Questions outside ciliary biology, ciliopathies, and cilia gene expression are likely to receive a generic or unhelpful response.

**Expression plots require a tissue dataset to be selected.**
If no dataset has been chosen, the default is lung. Switch datasets using the tissue selector buttons if you need kidney, liver, hypothalamus, or chondrocyte data.

**The AI service requires an internet connection and an active API subscription.**
If the AI service is temporarily unavailable, CiliAI will switch to database-only mode. In this mode it can still answer all disease gene list queries (all 70+ ciliopathies), all compartment gene list queries, single-gene localization lookups, and gene information queries — these all run directly from the local database.

---

## Tips for getting the best answers

- **Name the gene explicitly.** Use the official HGNC symbol (e.g., IFT88, CEP290, BBS1) for the most reliable results.
- **Use action words for lists.** "Show", "list", or "display" followed by a disease or compartment tells CiliAI you want a table, not an explanation.
- **Ask about one thing at a time.** Complex multi-part questions may produce incomplete responses.
- **Use the suggestion cards.** The clickable cards at the bottom of the chat panel are pre-validated examples that are guaranteed to produce correct results.
- **Check the "From the database:" footer.** Whenever a gene is mentioned, the database-verified facts appear below the AI text. If there is a discrepancy, trust the footer.
- **Download the CSV for large lists.** The gene table shows up to 200 rows on screen, but the CSV download contains the full set.
