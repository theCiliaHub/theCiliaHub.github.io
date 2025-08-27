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
