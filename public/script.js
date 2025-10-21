document.addEventListener('DOMContentLoaded', function() {
    const updateBtn = document.getElementById('updateBtn');
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const modelsContainer = document.getElementById('modelsContainer');
    const stats = document.getElementById('stats');
    const pagination = document.getElementById('pagination');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageInfo = document.getElementById('pageInfo');

    // Filter controls
    const templateFilter = document.getElementById('templateFilter');
    const nameSearch = document.getElementById('nameSearch');
    const limitSelect = document.getElementById('limitSelect');

    // State
    let currentSort = { column: null, direction: 'asc' };
    let allModels = [];
    let currentPage = 0;
    let totalModels = 0;
    let limit = 100;
    let v1ModelsMap = new Map(); // Map of model IDs to v1 model data (for modalities)

    // API endpoint (our local server)
    const API_URL = '/api/models';

    // Debounce function for search
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Fetch v1 models data (for modalities info)
    async function fetchV1Models() {
        try {
            const response = await fetch('/api/models/v1/all');
            if (response.ok) {
                const data = await response.json();
                if (data.data && Array.isArray(data.data)) {
                    data.data.forEach(model => {
                        v1ModelsMap.set(model.id, model);
                    });
                    console.log(`Loaded ${v1ModelsMap.size} models with modality info`);
                }
            }
        } catch (err) {
            console.warn('Could not fetch v1 models:', err);
        }
    }

    // Fetch models from our server
    async function fetchModels() {
        try {
            showLoading();
            
            const params = new URLSearchParams();
            params.append('page', currentPage);
            params.append('limit', limit);
            params.append('include_public', 'true');
            params.append('include_schemas', 'true');
            
            if (templateFilter.value) {
                params.append('template', templateFilter.value);
            }
            if (nameSearch.value.trim()) {
                params.append('name', nameSearch.value.trim());
            }

            const response = await fetch(`${API_URL}?${params.toString()}`);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            // Get cache information from headers
            const cacheStatus = response.headers.get('X-Cache');
            const cacheAge = response.headers.get('X-Cache-Age');
            updateCacheStatus(cacheStatus, cacheAge);

            const data = await response.json();
            totalModels = data.total || 0;
            displayModels(data);
            updateStats(data);
            updatePagination();
            hideLoading();

        } catch (err) {
            console.error('Error fetching models:', err);
            showError();
            hideLoading();
        }
    }

    // Display models in the container
    function displayModels(data) {
        if (!data || !data.items || !Array.isArray(data.items)) {
            showError();
            return;
        }

        allModels = data.items;
        modelsContainer.innerHTML = '';

        // Create table header with sorting
        const tableHeader = document.createElement('div');
        tableHeader.className = 'table-header';
        tableHeader.innerHTML = `
            <div class="header-cell" data-column="name">
                <span>Model Name</span>
                <span class="sort-indicator ${currentSort.column === 'name' ? 'active' : ''}">${getSortIcon('name')}</span>
            </div>
            <div class="header-cell" data-column="template">
                <span>Template</span>
                <span class="sort-indicator ${currentSort.column === 'template' ? 'active' : ''}">${getSortIcon('template')}</span>
            </div>
            <div class="header-cell" data-column="modalities">
                <span>Input → Output</span>
                <span class="sort-indicator ${currentSort.column === 'modalities' ? 'active' : ''}">${getSortIcon('modalities')}</span>
            </div>
            <div class="header-cell" data-column="inputPrice">
                <span>Input Price</span>
                <span class="sort-indicator ${currentSort.column === 'inputPrice' ? 'active' : ''}">${getSortIcon('inputPrice')}</span>
            </div>
            <div class="header-cell" data-column="outputPrice">
                <span>Output Price</span>
                <span class="sort-indicator ${currentSort.column === 'outputPrice' ? 'active' : ''}">${getSortIcon('outputPrice')}</span>
            </div>
            <div class="header-cell" data-column="invocations">
                <span>Invocations</span>
                <span class="sort-indicator ${currentSort.column === 'invocations' ? 'active' : ''}">${getSortIcon('invocations')}</span>
            </div>
            <div class="header-cell" data-column="status">
                <span>Status</span>
                <span class="sort-indicator ${currentSort.column === 'status' ? 'active' : ''}">${getSortIcon('status')}</span>
            </div>
            <div class="header-cell" data-column="hot">
                <span>Hot</span>
                <span class="sort-indicator ${currentSort.column === 'hot' ? 'active' : ''}">${getSortIcon('hot')}</span>
            </div>
        `;
        modelsContainer.appendChild(tableHeader);

        // Add click listeners for sorting
        tableHeader.querySelectorAll('.header-cell').forEach(cell => {
            cell.addEventListener('click', function() {
                const column = this.dataset.column;
                sortModels(column);
            });
        });

        // Apply current sort and display model rows
        const sortedModels = sortModelsData(allModels, currentSort.column, currentSort.direction);
        sortedModels.forEach((model, index) => {
            const modelRow = createModelRow(model, index);
            modelsContainer.appendChild(modelRow);
        });

        modelsContainer.classList.remove('hidden');
    }

    // Create a model row element
    function createModelRow(model, index) {
        const row = document.createElement('div');
        row.className = 'model-row';

        const name = model.name || 'Unknown';
        const template = model.standard_template || 'custom';
        const inputPrice = model.current_estimated_price?.per_million_tokens?.input?.usd || 0;
        const outputPrice = model.current_estimated_price?.per_million_tokens?.output?.usd || 0;
        const invocations = model.invocation_count || 0;
        const gpus = model.supported_gpus || [];
        const instances = model.instances || [];
        const isHot = model.hot || false;

        // Try to get modality info from v1 models
        const v1Model = v1ModelsMap.get(model.name);
        const inputModalities = v1Model?.input_modalities || [];
        const outputModalities = v1Model?.output_modalities || [];
        const supportedFeatures = v1Model?.supported_features || [];
        
        // Determine modality display
        let modalityDisplay = '';
        if (inputModalities.length > 0 || outputModalities.length > 0) {
            const inputs = inputModalities.length > 0 ? inputModalities.join(', ') : 'text';
            const outputs = outputModalities.length > 0 ? outputModalities.join(', ') : 'text';
            modalityDisplay = `${inputs} → ${outputs}`;
        } else {
            // Infer from template
            if (template === 'vllm' || template === 'tgi') {
                modalityDisplay = 'text → text';
            } else if (template === 'comfyui') {
                modalityDisplay = 'text/image → image/video';
            } else {
                modalityDisplay = 'various';
            }
        }

        // Check if any instance is active
        const hasActiveInstance = instances.some(inst => inst.active && inst.verified);
        const statusText = hasActiveInstance ? 'Active' : 'Inactive';
        const statusClass = hasActiveInstance ? 'active' : 'inactive';

        // Create GPU collapse button
        const gpuId = `gpu-${index}`;
        const gpuCount = gpus.length;
        const gpuDisplay = gpuCount > 0 
            ? `<button class="gpu-toggle" onclick="toggleGpu('${gpuId}')">${gpuCount} GPU${gpuCount !== 1 ? 's' : ''} ▼</button>
               <div id="${gpuId}" class="gpu-details hidden">
                   ${gpus.map(gpu => `<span class="gpu-tag">${gpu.toUpperCase()}</span>`).join('')}
               </div>`
            : '<span style="color: #999;">N/A</span>';

        row.innerHTML = `
            <div class="model-cell model-name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
            <div class="model-cell template">
                <span class="template-badge ${template}">${template.toUpperCase()}</span>
            </div>
            <div class="model-cell modalities" title="${modalityDisplay}">
                <small>${modalityDisplay}</small>
                ${supportedFeatures.length > 0 ? `<div class="features-mini">${supportedFeatures.slice(0, 2).map(f => `<span class="feature-mini">${formatFeatureName(f)}</span>`).join('')}</div>` : ''}
            </div>
            <div class="model-cell price" title="$${inputPrice.toFixed(3)}/M tokens">$${inputPrice.toFixed(3)}</div>
            <div class="model-cell price" title="$${outputPrice.toFixed(3)}/M tokens">$${outputPrice.toFixed(3)}</div>
            <div class="model-cell invocations" title="${invocations.toLocaleString()} invocations">${formatInvocations(invocations)}</div>
            <div class="model-cell">
                <div class="status-indicator">
                    <span class="status-dot ${statusClass}"></span>
                    <span>${statusText}</span>
                </div>
            </div>
            <div class="model-cell">
                ${isHot ? '<div class="status-indicator"><span class="status-dot hot"></span><span>Hot</span></div>' : '<span style="color: #999;">Cold</span>'}
            </div>
        `;

        return row;
    }

    // Toggle GPU details
    window.toggleGpu = function(id) {
        const element = document.getElementById(id);
        const button = element.previousElementSibling;
        if (element.classList.contains('hidden')) {
            element.classList.remove('hidden');
            button.textContent = button.textContent.replace('▼', '▲');
        } else {
            element.classList.add('hidden');
            button.textContent = button.textContent.replace('▲', '▼');
        }
    };

    // Sorting functions
    function getSortIcon(column) {
        if (currentSort.column !== column) return '↕';
        return currentSort.direction === 'asc' ? '↑' : '↓';
    }

    function sortModels(column) {
        if (currentSort.column === column) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = column;
            currentSort.direction = 'asc';
        }
        displayModels({ items: allModels });
    }

    function sortModelsData(models, column, direction) {
        if (!column) return models;

        const sorted = [...models].sort((a, b) => {
            let aVal, bVal;

            switch (column) {
                case 'name':
                    aVal = a.name || '';
                    bVal = b.name || '';
                    return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);

                case 'template':
                    aVal = a.standard_template || '';
                    bVal = b.standard_template || '';
                    return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);

                case 'inputPrice':
                    aVal = a.current_estimated_price?.per_million_tokens?.input?.usd || 0;
                    bVal = b.current_estimated_price?.per_million_tokens?.input?.usd || 0;
                    return direction === 'asc' ? aVal - bVal : bVal - aVal;

                case 'outputPrice':
                    aVal = a.current_estimated_price?.per_million_tokens?.output?.usd || 0;
                    bVal = b.current_estimated_price?.per_million_tokens?.output?.usd || 0;
                    return direction === 'asc' ? aVal - bVal : bVal - aVal;

                case 'invocations':
                    aVal = a.invocation_count || 0;
                    bVal = b.invocation_count || 0;
                    return direction === 'asc' ? aVal - bVal : bVal - aVal;

                case 'modalities':
                    const getModalityString = (model) => {
                        const v1Model = v1ModelsMap.get(model.name);
                        if (v1Model) {
                            return `${(v1Model.input_modalities || []).join(',')}→${(v1Model.output_modalities || []).join(',')}`;
                        }
                        return model.standard_template || '';
                    };
                    aVal = getModalityString(a);
                    bVal = getModalityString(b);
                    return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);

                case 'status':
                    aVal = (a.instances || []).some(inst => inst.active && inst.verified) ? 1 : 0;
                    bVal = (b.instances || []).some(inst => inst.active && inst.verified) ? 1 : 0;
                    return direction === 'asc' ? aVal - bVal : bVal - aVal;

                case 'hot':
                    aVal = a.hot ? 1 : 0;
                    bVal = b.hot ? 1 : 0;
                    return direction === 'asc' ? aVal - bVal : bVal - aVal;

                default:
                    return 0;
            }
        });

        return sorted;
    }

    // Update cache status display
    function updateCacheStatus(cacheStatus, cacheAge) {
        const cacheStatusEl = document.getElementById('cacheStatus');
        const cacheInfoEl = document.getElementById('cacheInfo');
        
        if (cacheStatus === 'HIT') {
            cacheStatusEl.style.display = 'flex';
            cacheInfoEl.textContent = `Cached (${cacheAge}s old)`;
            cacheInfoEl.style.color = '#4caf50';
        } else if (cacheStatus === 'MISS') {
            cacheStatusEl.style.display = 'flex';
            cacheInfoEl.textContent = 'Fresh';
            cacheInfoEl.style.color = '#ff9800';
            // Hide after 3 seconds
            setTimeout(() => {
                cacheStatusEl.style.display = 'none';
            }, 3000);
        }
    }

    // Update statistics display
    function updateStats(data) {
        document.getElementById('totalModels').textContent = data.total || 0;
        document.getElementById('showingModels').textContent = data.items?.length || 0;
        document.getElementById('currentPage').textContent = (currentPage + 1);
        stats.classList.remove('hidden');
    }

    // Update pagination controls
    function updatePagination() {
        const totalPages = Math.ceil(totalModels / limit);
        prevBtn.disabled = currentPage === 0;
        nextBtn.disabled = currentPage >= totalPages - 1;
        pageInfo.textContent = `Page ${currentPage + 1} of ${totalPages}`;
        pagination.classList.remove('hidden');
    }

    // Utility functions
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatInvocations(count) {
        if (count >= 1000000) {
            return (count / 1000000).toFixed(1) + 'M';
        } else if (count >= 1000) {
            return (count / 1000).toFixed(1) + 'K';
        }
        return count.toString();
    }

    function formatFeatureName(feature) {
        return feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // UI state management
    function showLoading() {
        loading.classList.remove('hidden');
        error.classList.add('hidden');
        modelsContainer.classList.add('hidden');
        stats.classList.add('hidden');
        pagination.classList.add('hidden');
        updateBtn.disabled = true;
        updateBtn.textContent = 'Updating...';
    }

    function hideLoading() {
        loading.classList.add('hidden');
        updateBtn.disabled = false;
        updateBtn.textContent = 'Update Models';
    }

    function showError() {
        error.classList.remove('hidden');
        modelsContainer.classList.add('hidden');
        stats.classList.add('hidden');
        pagination.classList.add('hidden');
    }

    // Event listeners
    updateBtn.addEventListener('click', () => {
        currentPage = 0;
        fetchModels();
    });

    prevBtn.addEventListener('click', () => {
        if (currentPage > 0) {
            currentPage--;
            fetchModels();
        }
    });

    nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(totalModels / limit);
        if (currentPage < totalPages - 1) {
            currentPage++;
            fetchModels();
        }
    });

    templateFilter.addEventListener('change', () => {
        currentPage = 0;
        fetchModels();
    });

    limitSelect.addEventListener('change', () => {
        limit = parseInt(limitSelect.value);
        currentPage = 0;
        fetchModels();
    });

    const debouncedSearch = debounce(() => {
        currentPage = 0;
        fetchModels();
    }, 500);

    nameSearch.addEventListener('input', debouncedSearch);

    // Initial load - fetch v1 models first for modality info
    fetchV1Models().then(() => {
        fetchModels();
    });
});
