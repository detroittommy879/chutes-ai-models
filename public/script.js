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

    // Theme and download controls
    const themeSelector = document.getElementById('themeSelector');
    const downloadCsvBtn = document.getElementById('downloadCsvBtn');
    const downloadMdBtn = document.getElementById('downloadMdBtn');

    // State
    let currentSort = { column: null, direction: 'asc' };
    let allModels = [];
    let fullModelsList = []; // Store all models from server for client-side filtering
    let filteredModels = []; // Store filtered results
    let currentPage = 0;
    let totalModels = 0;
    let limit = 1000; // Default to all models
    let v1ModelsMap = new Map(); // Map of model IDs to v1 model data (for modalities)

    // API endpoint (our local server) - auto-detect base path
    const BASE_PATH = window.location.pathname.match(/^\/[^\/]+\//)?.[0] || '/';
    const API_URL = `${BASE_PATH}api/models`.replace(/\/+/g, '/');

    // Initialize theme
    initializeTheme();

    // Theme management
    function initializeTheme() {
        // Check for stored preference first
        const storedTheme = localStorage.getItem('theme');
        
        let theme;
        if (storedTheme) {
            theme = storedTheme;
        } else {
            // Check OS preference
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            // Default to dark-default if no preference detected or if dark is preferred
            theme = prefersDark ? 'dark-default' : 'dark-default';
        }
        
        setTheme(theme);
    }

    function setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        themeSelector.value = theme;
    }

    function handleThemeChange(event) {
        const selectedTheme = event.target.value;
        setTheme(selectedTheme);
    }

    // Download functions
    function downloadCSV() {
        const sortedModels = sortModelsData(allModels, currentSort.column, currentSort.direction);
        
        // CSV header
        const headers = ['Model Name', 'Template', 'Input Modality', 'Output Modality', 'Input Price ($/M)', 'Output Price ($/M)', 'Invocations', 'Status', 'Hot', 'Chutes AI Link'];
        const csvRows = [headers.join(',')];
        
        // CSV rows
        sortedModels.forEach(model => {
            const name = (model.name || 'Unknown').replace(/"/g, '""');
            const template = model.standard_template || 'custom';
            const v1Model = v1ModelsMap.get(model.name);
            const inputModality = v1Model?.input_modalities?.join(';') || 'text';
            const outputModality = v1Model?.output_modalities?.join(';') || 'text';
            const inputPrice = model.current_estimated_price?.per_million_tokens?.input?.usd || 0;
            const outputPrice = model.current_estimated_price?.per_million_tokens?.output?.usd || 0;
            const invocations = model.invocation_count || 0;
            const hasActiveInstance = (model.instances || []).some(inst => inst.active && inst.verified);
            const status = hasActiveInstance ? 'Active' : 'Inactive';
            const hot = model.hot ? 'Yes' : 'No';
            const chuteId = model.chute_id || '';
            const link = chuteId ? `https://chutes.ai/app/chute/${chuteId}` : '';
            
            const row = [
                `"${name}"`,
                template,
                inputModality,
                outputModality,
                inputPrice.toFixed(3),
                outputPrice.toFixed(3),
                invocations,
                status,
                hot,
                link
            ];
            csvRows.push(row.join(','));
        });
        
        const csvContent = csvRows.join('\n');
        downloadFile(csvContent, 'chutes-models.csv', 'text/csv');
    }

    function downloadMarkdown() {
        const sortedModels = sortModelsData(allModels, currentSort.column, currentSort.direction);
        
        let mdContent = '# Chutes AI Models\n\n';
        mdContent += `*Generated on ${new Date().toLocaleDateString()}*\n\n`;
        mdContent += `**Total Models:** ${sortedModels.length}\n\n`;
        mdContent += '---\n\n';
        
        // Table header
        mdContent += '| Model Name | Template | Input → Output | Input Price | Output Price | Invocations | Status | Hot |\n';
        mdContent += '|------------|----------|----------------|-------------|--------------|-------------|--------|-----|\n';
        
        // Table rows
        sortedModels.forEach(model => {
            const name = model.name || 'Unknown';
            const template = (model.standard_template || 'custom').toUpperCase();
            const v1Model = v1ModelsMap.get(model.name);
            const inputModality = v1Model?.input_modalities?.join(', ') || 'text';
            const outputModality = v1Model?.output_modalities?.join(', ') || 'text';
            const modality = `${inputModality} → ${outputModality}`;
            const inputPrice = `$${(model.current_estimated_price?.per_million_tokens?.input?.usd || 0).toFixed(3)}`;
            const outputPrice = `$${(model.current_estimated_price?.per_million_tokens?.output?.usd || 0).toFixed(3)}`;
            const invocations = formatInvocations(model.invocation_count || 0);
            const hasActiveInstance = (model.instances || []).some(inst => inst.active && inst.verified);
            const status = hasActiveInstance ? '✅ Active' : '❌ Inactive';
            const hot = model.hot ? '🔥 Hot' : 'Cold';
            const chuteId = model.chute_id || '';
            const modelLink = chuteId ? `[${name}](https://chutes.ai/app/chute/${chuteId})` : name;
            
            mdContent += `| ${modelLink} | ${template} | ${modality} | ${inputPrice} | ${outputPrice} | ${invocations} | ${status} | ${hot} |\n`;
        });
        
        mdContent += '\n---\n\n';
        mdContent += '*Powered by [Chutes AI](https://chutes.ai)*\n';
        
        downloadFile(mdContent, 'chutes-models.md', 'text/markdown');
    }

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Create colorful modality badges
    function createModalityBadgesHTML(inputs, outputs) {
        const inputBadges = inputs.map(m => `<span class="modality-badge ${getModalityClass(m)}">${m}</span>`).join(' ');
        const outputBadges = outputs.map(m => `<span class="modality-badge ${getModalityClass(m)}">${m}</span>`).join(' ');
        return `${inputBadges}<span class="modality-arrow">→</span>${outputBadges}`;
    }

    function getModalityClass(modality) {
        const mod = modality.toLowerCase();
        if (mod === 'text') return 'text';
        if (mod === 'image') return 'image';
        if (mod === 'audio') return 'audio';
        if (mod === 'video') return 'video';
        return 'other';
    }

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
            const response = await fetch(`${BASE_PATH}api/models/v1/all`.replace(/\/+/g, '/'));
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
            params.append('page', 0);
            params.append('limit', 1000); // Fetch all models once
            params.append('include_public', 'true');
            params.append('include_schemas', 'true');
            
            // Only apply template filter to server request
            if (templateFilter.value) {
                params.append('template', templateFilter.value);
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
            fullModelsList = data.items || [];
            
            // Apply client-side filters
            applyFilters();
            
            hideLoading();

        } catch (err) {
            console.error('Error fetching models:', err);
            showError();
            hideLoading();
        }
    }

    // Apply client-side filtering (search and pagination)
    function applyFilters() {
        // Start with full list
        let filtered = [...fullModelsList];
        
        // Apply name search filter (client-side)
        const searchTerm = nameSearch.value.trim().toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(model => {
                const modelName = (model.name || '').toLowerCase();
                return modelName.includes(searchTerm);
            });
        }
        
        filteredModels = filtered;
        totalModels = filtered.length;
        
        // Calculate pagination
        const startIndex = currentPage * limit;
        const endIndex = startIndex + limit;
        allModels = filtered.slice(startIndex, endIndex);
        
        // Display results
        displayModels({ items: allModels, total: totalModels });
        updateStats({ items: allModels, total: totalModels });
        updatePagination();
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
            <div class="header-cell" data-column="context">
                <span>Context</span>
                <span class="sort-indicator ${currentSort.column === 'context' ? 'active' : ''}">${getSortIcon('context')}</span>
            </div>
            <div class="header-cell" data-column="quantization">
                <span>Quant</span>
                <span class="sort-indicator ${currentSort.column === 'quantization' ? 'active' : ''}">${getSortIcon('quantization')}</span>
            </div>
            <div class="header-cell" data-column="created">
                <span>Created</span>
                <span class="sort-indicator ${currentSort.column === 'created' ? 'active' : ''}">${getSortIcon('created')}</span>
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
        const chuteId = model.chute_id || '';
        const modelUrl = chuteId ? `https://chutes.ai/app/chute/${chuteId}` : '#';
        const template = model.standard_template || 'custom';
        const inputPrice = model.current_estimated_price?.per_million_tokens?.input?.usd || 0;
        const outputPrice = model.current_estimated_price?.per_million_tokens?.output?.usd || 0;
        const invocations = model.invocation_count || 0;
        const gpus = model.supported_gpus || [];
        const instances = model.instances || [];
        const isHot = model.hot || false;

        // Try to get modality info from v1 models
        const v1Model = v1ModelsMap.get(model.name);
        let inputModalities = v1Model?.input_modalities || [];
        let outputModalities = v1Model?.output_modalities || [];
        const supportedFeatures = v1Model?.supported_features || [];
        const contextWindow = v1Model?.max_model_len || v1Model?.context_length || null;
        const quantization = v1Model?.quantization || null;
        const createdDate = v1Model?.created ? new Date(v1Model.created * 1000).toLocaleDateString() : null;
        
        // Infer from template if not available
        if (inputModalities.length === 0 && outputModalities.length === 0) {
            if (template === 'vllm' || template === 'tgi') {
                inputModalities = ['text'];
                outputModalities = ['text'];
            } else if (template === 'comfyui') {
                inputModalities = ['text', 'image'];
                outputModalities = ['image', 'video'];
            } else {
                inputModalities = ['text'];
                outputModalities = ['text'];
            }
        }
        
        // Create modality badges HTML
        const modalityDisplay = createModalityBadgesHTML(inputModalities, outputModalities);

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
            <div class="model-cell model-name" title="${escapeHtml(name)}">
                ${chuteId ? `<a href="${modelUrl}" target="_blank" rel="noopener noreferrer" class="model-link">${escapeHtml(name)}</a>` : escapeHtml(name)}
            </div>
            <div class="model-cell template">
                <span class="template-badge ${template}">${template.toUpperCase()}</span>
            </div>
            <div class="model-cell modalities">
                <small>${modalityDisplay}</small>
                ${supportedFeatures.length > 0 ? `<div class="features-mini">${supportedFeatures.slice(0, 2).map(f => `<span class="feature-mini">${formatFeatureName(f)}</span>`).join('')}</div>` : ''}
            </div>
            <div class="model-cell context" title="${contextWindow ? formatNumber(contextWindow) + ' tokens' : 'N/A'}">
                ${contextWindow ? formatNumber(contextWindow) : '<span style="color: #999;">N/A</span>'}
            </div>
            <div class="model-cell quantization" title="${quantization || 'N/A'}">
                ${quantization ? `<span class="quant-badge">${escapeHtml(quantization)}</span>` : '<span style="color: #999;">N/A</span>'}
            </div>
            <div class="model-cell created" title="${createdDate || 'N/A'}">
                ${createdDate || '<span style="color: #999;">N/A</span>'}
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

                case 'context':
                    const getContext = (model) => {
                        const v1Model = v1ModelsMap.get(model.name);
                        return v1Model?.max_model_len || v1Model?.context_length || 0;
                    };
                    aVal = getContext(a);
                    bVal = getContext(b);
                    return direction === 'asc' ? aVal - bVal : bVal - aVal;

                case 'quantization':
                    const getQuant = (model) => {
                        const v1Model = v1ModelsMap.get(model.name);
                        return v1Model?.quantization || '';
                    };
                    aVal = getQuant(a);
                    bVal = getQuant(b);
                    return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);

                case 'created':
                    const getCreated = (model) => {
                        const v1Model = v1ModelsMap.get(model.name);
                        return v1Model?.created || 0;
                    };
                    aVal = getCreated(a);
                    bVal = getCreated(b);
                    return direction === 'asc' ? aVal - bVal : bVal - aVal;

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

    function formatNumber(num) {
        if (num === null || num === undefined || typeof num !== 'number') return 'N/A';
        return num.toLocaleString();
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
            applyFilters();
        }
    });

    nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(totalModels / limit);
        if (currentPage < totalPages - 1) {
            currentPage++;
            applyFilters();
        }
    });

    templateFilter.addEventListener('change', () => {
        currentPage = 0;
        fetchModels(); // Re-fetch from server when template changes
    });

    limitSelect.addEventListener('change', () => {
        limit = parseInt(limitSelect.value);
        currentPage = 0;
        applyFilters();
    });

    const debouncedSearch = debounce(() => {
        currentPage = 0;
        applyFilters(); // Client-side filtering only
    }, 300);

    nameSearch.addEventListener('input', debouncedSearch);

    // Theme selector listener
    themeSelector.addEventListener('change', handleThemeChange);

    // Download button listeners
    downloadCsvBtn.addEventListener('click', downloadCSV);
    downloadMdBtn.addEventListener('click', downloadMarkdown);

    // Initial load - fetch v1 models first for modality info
    fetchV1Models().then(() => {
        fetchModels();
    });
});
