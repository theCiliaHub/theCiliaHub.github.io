// Type definitions for clarity
/** @typedef {{ gene: string, ensembl_id: string, description: string, synonym: string, omim_id: string, reference: string, localization: string, functional_category: string }} GeneData */

/** @type {GeneData[]} */
let data = [];
let filteredData = [];
let searchCounts = JSON.parse(sessionStorage.getItem('popularGenes')) || {};
const allGeneNames = new Set();
const allSynonyms = new Set();
const allEnsemblIds = new Set();
let debounceTimeout;

/** @type {{ totalCiliaGenes: number, ciliaLocalizations: Set<string>, ciliaWithOMIM: number, ciliaWithReferences: number, ciliaLocalizationCounts: Record<string, number>, functionalCategoryCounts: Record<string, number> }} */
const statsData = {
  totalCiliaGenes: 0,
  ciliaLocalizations: new Set(),
  ciliaWithOMIM: 0,
  ciliaWithReferences: 0,
  ciliaLocalizationCounts: {},
  functionalCategoryCounts: {},
};

const ciliaRelatedCategories = {
  cilia: ['cilia', 'cilium', 'ciliary'],
  'transition zone': ['transition zone', 'transition-zone'],
  'basal body': ['basal body', 'basal-body', 'centriole'],
  flagella: ['flagella', 'flagellum'],
  'cilia associated': ['cilia associated', 'ciliary associated', 'cilia-associated', 'ciliary-associated'],
};

/**
 * Checks if a localization is cilia-related
 * @param {string} localization
 * @returns {string|null}
 */
function isCiliaRelated(localization) {
  if (!localization) return null;
  const locLower = localization.toLowerCase().trim();
  for (const [category, keywords] of Object.entries(ciliaRelatedCategories)) {
    for (const keyword of keywords) {
      if (locLower.includes(keyword)) return category;
    }
  }
  return null;
}

/**
 * Formats references into clickable links
 * @param {string} reference
 * @returns {string}
 */
function formatReference(reference) {
  if (!reference) return 'N/A';
  return reference
    .split(';')
    .map(ref => ref.trim())
    .filter(ref => ref)
    .map(ref => {
      if (/^\d+$/.test(ref)) return `<a href="https://pubmed.ncbi.nlm.nih.gov/${ref}/" target="_blank" class="text-blue-600 hover:underline">${ref}</a>`;
      if (ref.startsWith('https://doi.org/') || /^10\.\d{4,}/.test(ref)) {
        const doi = ref.startsWith('https://doi.org/') ? ref.replace('https://doi.org/', '') : ref;
        return `<a href="https://doi.org/${doi}" target="_blank" class="text-blue-600 hover:underline">${doi}</a>`;
      }
      if (ref.startsWith('http://') || ref.startsWith('https://')) return `<a href="${ref}" target="_blank" class="text-blue-600 hover:underline">${ref}</a>`;
      return ref;
    })
    .join(', ');
}

/**
 * Displays error message
 * @param {string} message
 */
function showError(message) {
  const errorDiv = document.getElementById('ciliahub-error');
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
  document.getElementById('ciliahub-loading').classList.add('hidden');
  document.querySelector('.ciliahub-table').classList.add('hidden');
}

/**
 * Hides error message
 */
function hideError() {
  document.getElementById('ciliahub-error').classList.add('hidden');
}

/**
 * Updates results counter
 * @param {number} count
 */
function updateResultsCounter(count) {
  const resultsCounter = document.getElementById('results-counter');
  resultsCounter.textContent = `Showing ${count} genes`;
  resultsCounter.classList.toggle('hidden', count === 0);
}

/**
 * Populates the results table
 * @param {GeneData[]} dataToShow
 */
function populateTable(dataToShow = []) {
  const tableBody = document.getElementById('ciliahub-table-body');
  tableBody.innerHTML = '';
  filteredData = dataToShow;

  if (!dataToShow.length) {
    document.getElementById('ciliahub-loading').classList.add('hidden');
    document.querySelector('.ciliahub-table').classList.add('hidden');
    updateResultsCounter(0);
    return;
  }

  dataToShow.forEach(item => {
    const sanitizedLocalization = (item.localization || '').toLowerCase().replace(/[\s,]+/g, '-');
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="p-3 border-b"><a href="https://www.ncbi.nlm.nih.gov/gene/?term=${item.gene}" target="_blank" class="text-blue-600 hover:underline">${item.gene}</a></td>
      <td class="p-3 border-b"><a href="https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${item.ensembl_id}" target="_blank" class="text-blue-600 hover:underline">${item.ensembl_id}</a></td>
      <td class="p-3 border-b">${item.description || ''}</td>
      <td class="p-3 border-b">${item.synonym ? item.synonym.split(',').map(s => s.trim()).join('<br>') : ''}</td>
      <td class="p-3 border-b"><a href="https://www.omim.org/entry/${item.omim_id}" target="_blank" class="text-blue-600 hover:underline">${item.omim_id || ''}</a></td>
      <td class="p-3 border-b">${formatReference(item.reference)}</td>
      <td class="p-3 border-b">${item.localization || ''}</td>
    `;
    if (sanitizedLocalization) row.classList.add(sanitizedLocalization);
    tableBody.appendChild(row);
  });

  document.getElementById('ciliahub-loading').classList.add('hidden');
  document.querySelector('.ciliahub-table').classList.remove('hidden');
  updateResultsCounter(dataToShow.length);
}

/**
 * Updates popular genes list
 */
function updatePopularGenes() {
  const popularGenesList = document.getElementById('popularGenesList');
  const sortedGenes = Object.entries(searchCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  popularGenesList.innerHTML = sortedGenes.length
    ? sortedGenes.map(([gene, count]) => `<li class="text-gray-700">${gene} (${count} searches)</li>`).join('')
    : '<li class="text-gray-700">No searches yet.</li>';
}

/**
 * Shows search prompt
 */
function showSearchPrompt() {
  const loadingDiv = document.getElementById('ciliahub-loading');
  loadingDiv.textContent = 'Enter a search term to explore the CiliaHub database...';
  loadingDiv.classList.remove('hidden');
  document.querySelector('.ciliahub-table').classList.add('hidden');
  updateResultsCounter(0);
}

/**
 * Shows search suggestions
 * @param {string} query
 */
function showSuggestions(query) {
  const suggestionsDiv = document.getElementById('search-suggestions');
  if (!query || query.length < 2) {
    suggestionsDiv.classList.add('hidden');
    return;
  }

  const suggestions = [];
  const queryLower = query.toLowerCase();
  for (const gene of allGeneNames) {
    if (gene.toLowerCase().includes(queryLower) && suggestions.length < 8) suggestions.push({ text: gene, type: 'gene' });
  }
  for (const synonym of allSynonyms) {
    if (synonym.toLowerCase().includes(queryLower) && suggestions.length < 8) suggestions.push({ text: synonym, type: 'synonym' });
  }
  for (const id of allEnsemblIds) {
    if (id.toLowerCase().includes(queryLower) && suggestions.length < 8) suggestions.push({ text: id, type: 'ensembl' });
  }

  suggestionsDiv.innerHTML = suggestions.length
    ? suggestions.map(s => `<div class="p-2 hover:bg-blue-100 cursor-pointer" data-type="${s.type}">${s.text} <span class="text-gray-500 text-sm">(${s.type})</span></div>`).join('')
    : '';
  suggestionsDiv.classList.toggle('hidden', !suggestions.length);

  suggestionsDiv.querySelectorAll('.p-2').forEach(item => {
    item.addEventListener('click', () => {
      document.getElementById('ciliahub-search').value = item.textContent.replace(/\s+\(gene|synonym|ensembl\)$/, '');
      suggestionsDiv.classList.add('hidden');
      applyFilters();
    });
  });
}

/**
 * Applies filters to data
 */
function applyFilters() {
  hideError();
  const query = document.getElementById('ciliahub-search').value.toLowerCase().trim();
  const localizationFilter = document.getElementById('ciliahub-filter').value.toLowerCase();
  const omimFilterValue = document.getElementById('omim-filter').value;
  const synonymFilterValue = document.getElementById('synonym-filter').value.toLowerCase().trim();

  if (!query && !localizationFilter && !omimFilterValue && !synonymFilterValue) {
    showSearchPrompt();
    return;
  }

  if (query) {
    searchCounts[query] = (searchCounts[query] || 0) + 1;
    sessionStorage.setItem('popularGenes', JSON.stringify(searchCounts));
    updatePopularGenes();
  }

  filteredData = data.filter(item => {
    const textMatch = !query || (
      (item.gene && item.gene.toLowerCase().includes(query)) ||
      (item.ensembl_id && item.ensembl_id.toLowerCase().includes(query)) ||
      (item.synonym && item.synonym.toLowerCase().includes(query)) ||
      (item.omim_id && item.omim_id.toLowerCase().includes(query))
    );
    const localizationMatch = !localizationFilter || (item.localization || '').toLowerCase().replace(/[\s,]+/g, '-') === localizationFilter;
    const omimMatch = omimFilterValue === '' || (omimFilterValue === 'has-omim' ? item.omim_id && item.omim_id.trim() : !item.omim_id || !item.omim_id.trim());
    const synonymMatch = !synonymFilterValue || (item.synonym && item.synonym.toLowerCase().includes(synonymFilterValue));
    return textMatch && localizationMatch && omimMatch && synonymMatch;
  });

  populateTable(filteredData);
}

/**
 * Debounces a function
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
function debounce(func, wait) {
  return (...args) => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Calculates statistics for cilia-related genes
 */
function calculateStatistics() {
  const ciliaRelatedGenes = data.filter(item => isCiliaRelated(item.localization));
  statsData.totalCiliaGenes = ciliaRelatedGenes.length;
  statsData.ciliaWithOMIM = ciliaRelatedGenes.filter(item => item.omim_id && item.omim_id.trim()).length;
  statsData.ciliaWithReferences = ciliaRelatedGenes.filter(item => item.reference && item.reference.trim()).length;

  ciliaRelatedGenes.forEach(item => {
    const category = isCiliaRelated(item.localization);
    if (category) {
      statsData.ciliaLocalizations.add(category);
      statsData.ciliaLocalizationCounts[category] = (statsData.ciliaLocalizationCounts[category] || 0) + 1;
    }
    if (item.functional_category) {
      item.functional_category.split('; ').filter(cat => cat).forEach(cat => {
        statsData.functionalCategoryCounts[cat] = (statsData.functionalCategoryCounts[cat] || 0) + 1;
      });
    }
  });
}

/**
 * Creates analytics charts
 */
function createCharts() {
  const locData = Object.entries(statsData.ciliaLocalizationCounts).sort((a, b) => b[1] - a[1]);
  const locChart = document.getElementById('localizationChart');
  if (locChart) {
    new Chart(locChart, {
      type: 'pie',
      data: {
        labels: locData.map(([label]) => label.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')),
        datasets: [{
          data: locData.map(([, count]) => count),
          backgroundColor: ['#203c78', '#4a6fa5', '#6d8bc9', '#90a7dd', '#b3c3f1'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 15, padding: 10, font: { size: 11 }, usePointStyle: true } },
          title: { display: true, text: 'Cilia-Related Gene Distribution', font: { size: 14, weight: 'bold' }, color: '#203c78' },
          tooltip: {
            callbacks: {
              label: context => `${context.label}: ${context.parsed} genes (${((context.parsed / context.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)`
            }
          }
        }
      }
    });
  }

  const funcData = Object.entries(statsData.functionalCategoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const funcChart = document.getElementById('functionalChart');
  if (funcChart) {
    new Chart(funcChart, {
      type: 'bar',
      data: {
        labels: funcData.map(([label]) => label.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')),
        datasets: [{
          label: 'Gene Count',
          data: funcData.map(([, count]) => count),
          backgroundColor: '#4a6fa5',
          borderColor: '#203c78',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Number of Genes', font: { size: 12, weight: 'bold' }, color: '#203c78' } },
          x: { title: { display: true, text: 'Functional Category', font: { size: 12, weight: 'bold' }, color: '#203c78' } }
        },
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Top Functional Categories', font: { size: 14, weight: 'bold' }, color: '#203c78' }
        }
      }
    });
  }
}

/**
 * Main data loading function
 */
async function loadCiliaHubData() {
  try {
    const response = await fetch('https://raw.githubusercontent.com/rarediseaselab/home/main/ciliahub_data.json');
    if (!response.ok) throw new Error('Network response was not ok');
    data = await response.json();

    data.forEach(item => {
      if (item.gene) allGeneNames.add(item.gene);
      if (item.ensembl_id) allEnsemblIds.add(item.ensembl_id);
      if (item.synonym) item.synonym.split(',').forEach(syn => syn.trim() && allSynonyms.add(syn.trim()));
    });

    calculateStatistics();
    createCharts();
    showSearchPrompt();
    updatePopularGenes();
  } catch (error) {
    console.error('Error loading CiliaHub data:', error);
    showError('Failed to load data. Please check your network or contact support.');
  }
}

/**
 * Sets up event listeners
 */
function setupEventListeners() {
  const searchInput = document.getElementById('ciliahub-search');
  searchInput.addEventListener('input', debounce(e => {
    showSuggestions(e.target.value);
    applyFilters();
  }, 300));

  document.getElementById('ciliahub-filter').addEventListener('change', applyFilters);
  document.getElementById('omim-filter').addEventListener('change', applyFilters);
  document.getElementById('synonym-filter').addEventListener('input', debounce(applyFilters, 300));

  document.getElementById('ciliahub-reset').addEventListener('click', () => {
    hideError();
    document.getElementById('ciliahub-search').value = '';
    document.getElementById('ciliahub-filter').value = '';
    document.getElementById('omim-filter').value = '';
    document.getElementById('synonym-filter').value = '';
    document.getElementById('search-suggestions').classList.add('hidden');
    searchCounts = {};
    sessionStorage.removeItem('popularGenes');
    updatePopularGenes();
    showSearchPrompt();
  });

  document.getElementById('download-ciliahub').addEventListener('click', () => {
    const csv = [['Gene', 'Ensembl ID', 'Description', 'Synonym', 'OMIM ID', 'Reference', 'Localization'], ...data.map(item => [
      item.gene || '',
      item.ensembl_id || '',
      item.description || '',
      item.synonym || '',
      item.omim_id || '',
      item.reference || '',
      item.localization || ''
    ])].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadCSV(csv, 'ciliahub_data.csv');
  });

  document.getElementById('export-filtered').addEventListener('click', () => {
    if (!filteredData.length) {
      alert('No filtered data to export. Apply filters first.');
      return;
    }
    const csv = [['Gene', 'Ensembl ID', 'Description', 'Synonym', 'OMIM ID', 'Reference', 'Localization'], ...filteredData.map(item => [
      item.gene || '',
      item.ensembl_id || '',
      item.description || '',
      item.synonym || '',
      item.omim_id || '',
      item.reference || '',
      item.localization || ''
    ])].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadCSV(csv, `ciliahub_filtered_${new Date().toISOString().split('T')[0]}.csv`);
  });

  document.getElementById('batchQueryBtn').addEventListener('click', () => {
    hideError();
    const input = document.getElementById('batchGenes').value.trim();
    const batchResultsDiv = document.getElementById('batchResults');
    if (!input) {
      batchResultsDiv.innerHTML = '<p class="text-red-500">Please enter at least one gene name or ID.</p>';
      document.getElementById('batchResultsContainer').classList.remove('hidden');
      return;
    }

    const queries = input.split(/[\s,\n]+/).filter(q => q.trim()).map(q => q.toLowerCase());
    queries.forEach(query => {
      searchCounts[query] = (searchCounts[query] || 0) + 1;
      sessionStorage.setItem('popularGenes', JSON.stringify(searchCounts));
    });
    updatePopularGenes();

    const batchFiltered = data.filter(item => queries.some(query =>
      (item.gene && item.gene.toLowerCase() === query) ||
      (item.ensembl_id && item.ensembl_id.toLowerCase() === query) ||
      (item.synonym && item.synonym.toLowerCase().includes(query)) ||
      (item.omim_id && item.omim_id.toLowerCase() === query)
    ));

    batchResultsDiv.innerHTML = batchFiltered.length ? `
      <table class="w-full border-collapse">
        <thead>
          <tr class="bg-blue-800 text-white">
            <th class="p-3">Gene</th>
            <th class="p-3">Ensembl ID</th>
            <th class="p-3">Description</th>
            <th class="p-3">Synonym</th>
            <th class="p-3">OMIM ID</th>
            <th class="p-3">Reference</th>
            <th class="p-3">Localization</th>
          </tr>
        </thead>
        <tbody>
          ${batchFiltered.map(item => `
            <tr class="border-b">
              <td class="p-3"><a href="https://www.ncbi.nlm.nih.gov/gene/?term=${item.gene}" target="_blank" class="text-blue-600 hover:underline">${item.gene}</a></td>
              <td class="p-3"><a href="https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${item.ensembl_id}" target="_blank" class="text-blue-600 hover:underline">${item.ensembl_id}</a></td>
              <td class="p-3">${item.description || ''}</td>
              <td class="p-3">${item.synonym || ''}</td>
              <td class="p-3"><a href="https://www.omim.org/entry/${item.omim_id}" target="_blank" class="text-blue-600 hover:underline">${item.omim_id || ''}</a></td>
              <td class="p-3">${formatReference(item.reference)}</td>
              <td class="p-3">${item.localization || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p class="text-red-500">No matching genes found.</p>';
    document.getElementById('batchResultsContainer').classList.remove('hidden');
  });

  document.getElementById('clearBatchResults').addEventListener('click', () => {
    document.getElementById('batchResults').innerHTML = '';
    document.getElementById('batchResultsContainer').classList.add('hidden');
    document.getElementById('batchGenes').value = '';
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.relative')) document.getElementById('search-suggestions').classList.add('hidden');
  });
}

/**
 * Downloads CSV file
 * @param {string} csv
 * @param {string} filename
 */
function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('ciliahub')) {
    loadCiliaHubData();
    setupEventListeners();
  }
});
