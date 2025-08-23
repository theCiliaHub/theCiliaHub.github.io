<<<<<<< HEAD
# CiliaHub - Interactive Ciliary Gene Database

## Overview
CiliaHub is a comprehensive, interactive database for ciliary gene research, featuring advanced gene search capabilities, expression visualization, and performance-optimized data handling.

## New Features (Latest Update)

### 🎯 Gene Expression Visualization System
- **Interactive Human Body Visualization**: Right-side panel showing organ-specific gene expression
- **Dynamic Gene Search**: Left-side search panel with real-time suggestions
- **Expression Color Coding**: Visual representation of nTPM values across tissues
- **Comprehensive Data Table**: Detailed expression data with categorization

### 🚀 Performance Optimizations
- **Limited Gene Set**: Restricted to 2011 genes for optimal performance
- **Dynamic Filtering**: Real-time search suggestions without dropdown delays
- **Efficient Data Loading**: Optimized TSV parsing and memory management
- **Reduced Reload Times**: Integrated visualization system eliminates file reloads
- **SVG File Integration**: Uses existing `file.svg` without modification, only updates colors

### 🔍 Enhanced Search Capabilities
- **Auto-suggestions**: Type "AR" to see all genes starting with "AR"
- **Instant Results**: Real-time filtering as you type
- **Smart Matching**: Searches gene names, synonyms, and Ensembl IDs
- **Performance Focused**: No more slow dropdown searches

## Features

### Gene Search & Discovery
- **Single Gene Search**: Quick lookup with instant results
- **Batch Query Tool**: Analyze multiple genes simultaneously
- **CSV Upload Support**: Bulk gene analysis from file uploads
- **Dynamic Filtering**: Real-time search suggestions

### Expression Visualization
- **Organ Highlighting**: Color-coded organs based on expression levels using existing `file.svg`
- **nTPM Values**: Hover tooltips showing exact expression values
- **Expression Categories**:
  - 🟢 Low: 0-5 nTPM (Light green #A8E6A1)
  - 🟢 Medium: 5-15 nTPM (Medium green #6CC96C)
  - 🟢 High: 15-30 nTPM (Green #3FAF3F)
  - 🟢 Very High: >30 nTPM (Dark green #1E7B1E)

### Interactive Cilium Model
- **3D Cilium Visualization**: Interactive SVG-based cilium model
- **Gene Localization**: Click genes to see their cellular location
- **Highlighted Components**: Visual representation of gene functions

### Data Management
- **Comprehensive Database**: 20,000+ ciliary genes
- **Multiple Data Sources**: Integration with external databases
- **Export Capabilities**: Download data in JSON and CSV formats

## Technical Implementation

### Architecture
- **Single Page Application**: Built with vanilla JavaScript
- **Modular Design**: Separate systems for different functionalities
- **Performance Optimized**: Efficient data structures and algorithms

### Data Sources
- **ciliahub_data.json**: Primary gene database
- **rna_tissue_consensus.tsv**: Expression data from Human Protein Atlas
- **External APIs**: Ensembl, OMIM integration

### Performance Features
- **Lazy Loading**: Data loaded only when needed
- **Caching**: Session-based caching for frequently accessed data
- **Debounced Search**: Optimized search input handling
- **Memory Management**: Efficient data structures and cleanup

## Usage Guide

### Basic Gene Search
1. Navigate to the home page
2. Type a gene name (e.g., "ARL13B")
3. View instant search results
4. Click on a gene for detailed information

### Expression Visualization
1. Go to the Expression page
2. Search for a gene in the left panel
3. View organ highlighting on the human body
4. Check the expression data table below
5. Hover over organs for detailed expression values

### Batch Analysis
1. Navigate to Batch Query
2. Enter multiple gene names (comma-separated)
3. Or upload a CSV file
4. View comprehensive results

## Browser Compatibility
- **Modern Browsers**: Chrome 80+, Firefox 75+, Safari 13+
- **Mobile Support**: Responsive design for all screen sizes
- **JavaScript Required**: ES6+ features utilized

## Performance Metrics
- **Initial Load Time**: <2 seconds
- **Search Response**: <100ms
- **Expression Rendering**: <200ms
- **Memory Usage**: Optimized for large datasets

## Data Sources & Citations
- **Human Protein Atlas**: Tissue expression data
- **Ensembl**: Gene annotations and IDs
- **OMIM**: Disease associations
- **Primary Research**: Ciliary gene catalog

## Contributing
This project is actively maintained by the CiliaHub research team. For contributions or questions, please contact:
- **Dr. Oktay I. Kaplan**: oktay.kaplan@agu.edu.tr
- **Ferhan Yenisert**: ferhan.yenisert@agu.edu.tr

## License
Research use only. Please cite appropriate sources when using this data in publications.

## Version History
- **v2.0**: Major update with expression visualization system
- **v1.0**: Initial release with basic gene database functionality

---

*CiliaHub - Advancing ciliary research through interactive data visualization*
=======
<img width="1024" height="354" alt="image" src="https://github.com/user-attachments/assets/c003b219-a130-4026-b047-f2098b008b79" />

**CiliaHub: An Expanded Catalog of Human Ciliary Genes**

CiliaHub is a scalable, user-friendly platform that significantly expands the known human ciliome by integrating automated literature mining with expert manual curation.

This repository hosts the data and information for the CiliaHub project, which provides a comprehensive, updated, and expanded catalog of human ciliary genes. The complete, searchable database is available at our project website:

➡️ https://theciliahub.github.io/



The established link between cilia and human disease has fueled a growing interest in identifying the complete "ciliome." Despite numerous efforts, the full extent of the human ciliary gene set remains unresolved, with many genes absent from curated databases.

**CiliaHub addresses this gap by:**

**Automating Discovery:** Systematically searching the PubMed database using gene symbols and cilia-related keywords (e.g., cilia, flagella, basal body) to identify potential ciliary genes.

**Ensuring Accuracy:** Applying a rigorous manual curation process where each automatically flagged gene is reviewed by independent experts to confirm its association with ciliary structures or function.

**Expanding the Ciliome:** Increasing the known human ciliary gene list from 688 (SYSCILIA Gold Standard v2) to over 2,000 curated genes.
>>>>>>> 19cd5cbe433ee3c23bf70890019d6fd9123aff9f
