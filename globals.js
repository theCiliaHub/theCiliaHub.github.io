// =============================================================================
// CiliaHub Global Variables (globals.js)
// -----------------------------------------------------------------------------
// This file ONLY contains variable declarations that are accessed across
// multiple scripts. It has a single responsibility: to define the shared
// state and constants for the application.
// =============================================================================

// 📦 --- Data Storage & Caches ---
// These variables hold the main data for the application.
let allGenes = [];
let geneDataCache = null;
let geneMapCache = null;
let searchResults = [];
let expressionData = {};
const geneLocalizationData = {};


// 🖼️ --- UI & Plotting State ---
// These variables track the current state of the user interface and plots.
let currentPlotInstance = null;
let localizationChartInstance = null; // For the 'Compare' page chart
let selectedGenes = []; // For the interactive cilium diagram


// ⚙️ --- Constants & Defaults ---
// These are fixed values used throughout the application.
const allPartIds = [
    "cell-body", "nucleus", "basal-body",
    "transition-zone", "axoneme", "ciliary-membrane"
];

const defaultGenesNames = [
    "IFT88", "CEP290", "WDR31",
    "ARL13B", "BBS1", "ACE2", "PKD2"
];
