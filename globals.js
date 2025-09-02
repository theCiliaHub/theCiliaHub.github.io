// globals.js
let allGenes = [];
let currentData = [];
let searchResults = [];
let localizationChartInstance;
let analysisDotPlotInstance;
let analysisBarChartInstance;
const geneLocalizationData = {};
const allPartIds = ["cell-body", "nucleus", "basal-body", "transition-zone", "axoneme", "ciliary-membrane"];
const defaultGenesNames = ["ACE2", "ADAMTS20", "ADAMTS9", "IFT88", "CEP290", "WDR31", "ARL13B", "BBS1"];

// NEW CACHES
let geneDataCache = null;
let geneMapCache = null;
