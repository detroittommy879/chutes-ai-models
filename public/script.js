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
            const cacheDate = response.headers.get('X-Cache-Date');
            console.log('Cache headers:', { cacheStatus, cacheAge, cacheDate });
            updateCacheStatus(cacheStatus, cacheAge, cacheDate);

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
            <div class="header-cell" data-column="input_modalities">
                <span>Input Modalities</span>
                <span class="sort-indicator ${currentSort.column === 'input_modalities' ? 'active' : ''}">${getSortIcon('input_modalities')}</span>
            </div>
            <div class="header-cell" data-column="output_modalities">
                <span>Output Modalities</span>
                <span class="sort-indicator ${currentSort.column === 'output_modalities' ? 'active' : ''}">${getSortIcon('output_modalities')}</span>
            </div>
            <div class="header-cell" data-column="input_context">
                <span>Input Ctx</span>
                <span class="sort-indicator ${currentSort.column === 'input_context' ? 'active' : ''}">${getSortIcon('input_context')}</span>
            </div>
            <div class="header-cell" data-column="output_context">
                <span>Output Ctx</span>
                <span class="sort-indicator ${currentSort.column === 'output_context' ? 'active' : ''}">${getSortIcon('output_context')}</span>
            </div>
            <div class="header-cell" data-column="visibility">
                <span>Visibility</span>
                <span class="sort-indicator ${currentSort.column === 'visibility' ? 'active' : ''}">${getSortIcon('visibility')}</span>
            </div>
            <div class="header-cell" data-column="sampling">
                <span>Features</span>
                <span class="sort-indicator ${currentSort.column === 'sampling' ? 'active' : ''}">${getSortIcon('sampling')}</span>
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
        
        // Add latency testing checkboxes and show tester
        addTestCheckboxes();
        showLatencyTester();
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
    const inputContext = v1Model?.context_length || null;
    const outputContext = v1Model?.max_output_length || null;
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
            <div class="model-cell input-modalities">
                <small>${inputModalities.length ? inputModalities.map(m => `<span class="modality-badge ${getModalityClass(m)}">${m}</span>`).join(' ') : '<span style="color: #999;">N/A</span>'}</small>
            </div>
            <div class="model-cell output-modalities">
                <small>${outputModalities.length ? outputModalities.map(m => `<span class="modality-badge ${getModalityClass(m)}">${m}</span>`).join(' ') : '<span style="color: #999;">N/A</span>'}</small>
            </div>
            <div class="model-cell input-context" title="${inputContext !== null ? formatNumber(inputContext) : 'N/A'}">
                ${getVerificationBadge(name, inputContext)}
                ${inputContext !== null ? `<span>${formatNumber(inputContext)}</span>` : '<span style="color: #999;">N/A</span>'}
            </div>
            <div class="model-cell output-context" title="${outputContext !== null ? formatNumber(outputContext) : 'N/A'}">
                ${outputContext !== null ? `<span>${formatNumber(outputContext)}</span>` : '<span style="color: #999;">N/A</span>'}
            </div>
            <div class="model-cell visibility">
                <span>${model.public === true ? 'Public' : (model.public === false ? 'Private' : 'Unknown')}</span>
            </div>
            <div class="model-cell features">
                ${supportedFeatures.length > 0 ? `<div class="features-mini">${supportedFeatures.map(f => `<span class="feature-mini">${formatFeatureName(f)}</span>`).join('')}</div>` : ''}
                ${Array.isArray(v1Model?.supported_sampling_parameters) ? `<span class="sampling-badge" title="${v1Model.supported_sampling_parameters.join(', ')}">${v1Model.supported_sampling_parameters.length} Sampling Params</span>` : ''}
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
                        // Sort by input context, then output context if input is equal
                        const input = v1Model?.context_length || 0;
                        const output = v1Model?.max_output_length || 0;
                        return { input, output };
                    };
                    aVal = getContext(a);
                    bVal = getContext(b);
                    if (aVal.input !== bVal.input) {
                        return direction === 'asc' ? aVal.input - bVal.input : bVal.input - aVal.input;
                    } else {
                        return direction === 'asc' ? aVal.output - bVal.output : bVal.output - aVal.output;
                    }

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

                // New columns for enhanced sorting
                case 'input_modalities':
                    try {
                        const getInputModalities = (model) => {
                            const v1Model = v1ModelsMap.get(model.name);
                            return v1Model?.input_modalities?.join(',') || '';
                        };
                        aVal = getInputModalities(a);
                        bVal = getInputModalities(b);
                        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                    } catch (err) {
                        console.error('Error sorting input_modalities:', err);
                        return 0;
                    }

                case 'output_modalities':
                    try {
                        const getOutputModalities = (model) => {
                            const v1Model = v1ModelsMap.get(model.name);
                            return v1Model?.output_modalities?.join(',') || '';
                        };
                        aVal = getOutputModalities(a);
                        bVal = getOutputModalities(b);
                        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                    } catch (err) {
                        console.error('Error sorting output_modalities:', err);
                        return 0;
                    }

                case 'input_context':
                    try {
                        const getInputContext = (model) => {
                            const v1Model = v1ModelsMap.get(model.name);
                            return v1Model?.context_length ?? 0;
                        };
                        aVal = getInputContext(a);
                        bVal = getInputContext(b);
                        return direction === 'asc' ? aVal - bVal : bVal - aVal;
                    } catch (err) {
                        console.error('Error sorting input_context:', err);
                        return 0;
                    }

                case 'output_context':
                    try {
                        const getOutputContext = (model) => {
                            const v1Model = v1ModelsMap.get(model.name);
                            return v1Model?.max_output_length ?? 0;
                        };
                        aVal = getOutputContext(a);
                        bVal = getOutputContext(b);
                        return direction === 'asc' ? aVal - bVal : bVal - aVal;
                    } catch (err) {
                        console.error('Error sorting output_context:', err);
                        return 0;
                    }

                case 'visibility':
                    try {
                        const getVisibility = (model) => {
                            if (model.public === true) return 2;
                            if (model.public === false) return 1;
                            return 0; // Unknown
                        };
                        aVal = getVisibility(a);
                        bVal = getVisibility(b);
                        return direction === 'asc' ? aVal - bVal : bVal - aVal;
                    } catch (err) {
                        console.error('Error sorting visibility:', err);
                        return 0;
                    }

                case 'sampling':
                    try {
                        const getSamplingCount = (model) => {
                            const v1Model = v1ModelsMap.get(model.name);
                            return Array.isArray(v1Model?.supported_sampling_parameters) ? v1Model.supported_sampling_parameters.length : 0;
                        };
                        aVal = getSamplingCount(a);
                        bVal = getSamplingCount(b);
                        return direction === 'asc' ? aVal - bVal : bVal - aVal;
                    } catch (err) {
                        console.error('Error sorting sampling:', err);
                        return 0;
                    }

                default:
                    return 0;
            }
        });

        return sorted;
    }

    // Update cache status display
    function updateCacheStatus(cacheStatus, cacheAge, cacheDate) {
        const cacheStatusEl = document.getElementById('cacheStatus');
        const cacheInfoEl = document.getElementById('cacheInfo');
        
        if (cacheStatus === 'HIT') {
            cacheStatusEl.style.display = 'flex';
            
            // Format cache date with simple time
            let dateStr = '';
            if (cacheDate) {
                const date = new Date(cacheDate);
                const dateOnly = date.toLocaleDateString();
                const hours = date.getHours();
                const ampm = hours >= 12 ? 'pm' : 'am';
                const hour12 = hours % 12 || 12;
                const simpleTime = `${hour12}${ampm}`;
                dateStr = `${dateOnly} ${simpleTime}`;
            } else {
                dateStr = 'Unknown date';
            }
            
            // Convert seconds to human readable
            const ageSeconds = parseInt(cacheAge) || 0;
            const ageMinutes = Math.floor(ageSeconds / 60);
            const ageHours = Math.floor(ageMinutes / 60);
            const ageDays = Math.floor(ageHours / 24);
            
            let ageStr = '';
            if (ageDays > 0) {
                ageStr = `${ageDays} day${ageDays !== 1 ? 's' : ''} old`;
            } else if (ageHours > 0) {
                ageStr = `${ageHours} hour${ageHours !== 1 ? 's' : ''} old`;
            } else if (ageMinutes > 0) {
                ageStr = `${ageMinutes} min old`;
            } else {
                ageStr = `${ageSeconds}s old`;
            }
            
            cacheInfoEl.innerHTML = `${dateStr}<br><small>(${ageStr})</small>`;
            cacheInfoEl.style.color = '#4caf50';
        } else if (cacheStatus === 'MISS') {
            cacheStatusEl.style.display = 'flex';
            cacheInfoEl.innerHTML = 'Fresh data';
            cacheInfoEl.style.color = '#ff9800';
        } else {
            // No cache status - probably loading
            cacheStatusEl.style.display = 'flex';
            cacheInfoEl.innerHTML = 'Loading...';
            cacheInfoEl.style.color = '#999';
        }
    }

    // Update statistics display
    function updateStats(data) {
        document.getElementById('totalModels').textContent = data.total || 0;
        document.getElementById('showingModels').textContent = data.items?.length || 0;
        document.getElementById('currentPage').textContent = (currentPage + 1);
        stats.classList.remove('hidden');
        document.getElementById('resourceLinks').classList.remove('hidden');
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

    // Generate verification badge for tested models
    function getVerificationBadge(modelName, inputContext) {
        const testResult = tokenTestResults[modelName];
        
        if (!testResult || testResult.status !== 'success') {
            return '';
        }

        const testDate = new Date(testResult.lastTested);
        const dateStr = testDate.toLocaleDateString();
        const timeStr = testDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const tooltipText = `Verified: ${dateStr} ${timeStr}
Input: ${testResult.inputTokens || testResult.tokenCount || 'N/A'} tokens
File: ${testResult.tokenFile || 'N/A'}
Context: ${formatNumber(testResult.inputContext || inputContext)}`;

        return `<span class="verification-badge" title="${tooltipText}">✓ Verified</span>`;
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

    // ========== LATENCY TESTING FUNCTIONALITY ==========
    const latencyTester = document.getElementById('latencyTester');
    const selectAllTestBtn = document.getElementById('selectAllTestBtn');
    const selectTop10Btn = document.getElementById('selectTop10Btn');
    const clearSelectionBtn = document.getElementById('clearSelectionBtn');
    const runLatencyTestBtn = document.getElementById('runLatencyTestBtn');
    const runTokenTestBtn = document.getElementById('runTokenTestBtn');
    const testPromptInput = document.getElementById('testPrompt');
    const latencyResults = document.getElementById('latencyResults');

    let selectedForTest = new Set();
    let testingInProgress = false;
    let availableTokenFiles = [];
    let tokenTestResults = {}; // Store loaded test results

    // Show latency tester when models are loaded
    function showLatencyTester() {
        if (latencyTester && allModels.length > 0) {
            latencyTester.style.display = 'block';
        }
    }

    // Load available token files
    async function loadTokenFiles() {
        try {
            const response = await fetch('/api/token-files');
            if (response.ok) {
                const data = await response.json();
                availableTokenFiles = data.files;
                console.log('📁 Available token files:', availableTokenFiles);
            }
        } catch (error) {
            console.warn('Could not load token files:', error);
        }
    }

    // Load token test results
    async function loadTokenTestResults() {
        try {
            const response = await fetch('/api/token-test-results');
            if (response.ok) {
                tokenTestResults = await response.json();
                console.log('✅ Loaded token test results for', Object.keys(tokenTestResults).length, 'models');
            }
        } catch (error) {
            console.warn('Could not load token test results:', error);
        }
    }

    // Save token test result
    async function saveTokenTestResult(modelName, result) {
        try {
            const response = await fetch('/api/token-test-results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelName, result })
            });
            
            if (response.ok) {
                const data = await response.json();
                tokenTestResults[modelName] = data.result;
                console.log('💾 Saved token test result for', modelName);
            }
        } catch (error) {
            console.warn('Could not save token test result:', error);
        }
    }

    // Add checkboxes to model rows
    function addTestCheckboxes() {
        const sortedModels = sortModelsData(allModels, currentSort.column, currentSort.direction);
        const modelRows = document.querySelectorAll('.model-row');
        modelRows.forEach((row, index) => {
            if (!row.querySelector('.test-checkbox')) {
                const model = sortedModels[index];
                if (!model) return;
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'test-checkbox';
                checkbox.dataset.modelName = model.name;
                checkbox.dataset.modelTemplate = model.standard_template || 'custom';
                checkbox.style.marginRight = '8px';
                checkbox.addEventListener('change', updateTestSelection);
                
                const nameCell = row.querySelector('.model-name');
                if (nameCell) {
                    nameCell.insertBefore(checkbox, nameCell.firstChild);
                }
            }
        });
    }

    function updateTestSelection() {
        selectedForTest.clear();
        document.querySelectorAll('.test-checkbox:checked').forEach(cb => {
            selectedForTest.add(cb.dataset.modelName);
        });
        updateTestButton();
    }

    function updateTestButton() {
        const count = selectedForTest.size;
        runLatencyTestBtn.textContent = `Run Test (${count} selected)`;
        runLatencyTestBtn.disabled = count === 0 || testingInProgress;
        runTokenTestBtn.textContent = `Run Token Test (${count} selected)`;
        runTokenTestBtn.disabled = count === 0 || testingInProgress;
    }

    selectAllTestBtn.addEventListener('click', () => {
        document.querySelectorAll('.test-checkbox').forEach(cb => {
            cb.checked = true;
        });
        updateTestSelection();
    });

    selectTop10Btn.addEventListener('click', () => {
        document.querySelectorAll('.test-checkbox').forEach((cb, idx) => {
            cb.checked = idx < 10;
        });
        updateTestSelection();
    });

    clearSelectionBtn.addEventListener('click', () => {
        document.querySelectorAll('.test-checkbox').forEach(cb => {
            cb.checked = false;
        });
        updateTestSelection();
    });

    runLatencyTestBtn.addEventListener('click', async () => {
        if (testingInProgress || selectedForTest.size === 0) return;

        testingInProgress = true;
        runLatencyTestBtn.disabled = true;
        runTokenTestBtn.disabled = true;
        runLatencyTestBtn.textContent = 'Testing...';

        const testPrompt = testPromptInput.value.trim() || 'Write a haiku about programming.';
        
        // Get models by their names from the selected set
        const modelsToTest = Array.from(selectedForTest)
            .map(modelName => allModels.find(m => m.name === modelName))
            .filter(m => m && (m.standard_template === 'vllm' || m.standard_template === 'tgi'));

        if (modelsToTest.length === 0) {
            alert('No valid text generation models selected. Please select VLLM or TGI models.');
            testingInProgress = false;
            updateTestButton();
            return;
        }

        // Clear previous results
        latencyResults.innerHTML = '<div style="color: var(--color-text); margin-bottom: 1rem;">Testing in progress...</div>';

        const results = [];

        for (const model of modelsToTest) {
            const result = await testModelLatency(model, testPrompt);
            results.push(result);
            displayLatencyResults(results);
        }

        testingInProgress = false;
        updateTestButton();
    });

    runTokenTestBtn.addEventListener('click', async () => {
        if (testingInProgress || selectedForTest.size === 0) return;

        testingInProgress = true;
        runLatencyTestBtn.disabled = true;
        runTokenTestBtn.disabled = true;
        runTokenTestBtn.textContent = 'Token Testing...';

        // Get models by their names from the selected set
        const modelsToTest = Array.from(selectedForTest)
            .map(modelName => allModels.find(m => m.name === modelName))
            .filter(m => m && (m.standard_template === 'vllm' || m.standard_template === 'tgi'));

        if (modelsToTest.length === 0) {
            alert('No valid text generation models selected. Please select VLLM or TGI models.');
            testingInProgress = false;
            updateTestButton();
            return;
        }

        // Clear previous results
        latencyResults.innerHTML = '<div style="color: var(--color-text); margin-bottom: 1rem;">Token testing in progress...</div>';

        const results = [];

        for (const model of modelsToTest) {
            const result = await testModelWithTokenFile(model);
            results.push(result);
            
            // Save successful test results
            if (result.status === 'success') {
                await saveTokenTestResult(result.name, {
                    status: result.status,
                    latency: result.latency,
                    tokenFile: result.tokenFile,
                    tokenCount: result.inputTokens,
                    inputContext: result.inputContext,
                    inputTokens: result.usage.prompt_tokens,
                    outputTokens: result.usage.completion_tokens,
                    totalTokens: result.usage.total_tokens
                });
            }
            
            displayLatencyResults(results);
        }

        testingInProgress = false;
        updateTestButton();
        
        // Refresh the model display to show new verification badges
        displayModels({ items: allModels, total: totalModels });
    });

    async function testModelLatency(model, prompt) {
        const startTime = performance.now();
        
        try {
            const response = await fetch('/api/test-model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model.name,
                    prompt: prompt
                })
            });

            const endTime = performance.now();
            const latency = Math.round(endTime - startTime);

            if (!response.ok) {
                const errorData = await response.json();
                return {
                    name: model.name,
                    status: 'error',
                    latency: latency,
                    error: errorData.error || 'Request failed'
                };
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '(Empty response)';
            const usage = data.usage || {};

            return {
                name: model.name,
                status: 'success',
                latency: latency,
                response: content,
                usage: {
                    prompt_tokens: usage.prompt_tokens || 0,
                    completion_tokens: usage.completion_tokens || 0,
                    total_tokens: usage.total_tokens || 0
                }
            };
        } catch (error) {
            const endTime = performance.now();
            const latency = Math.round(endTime - startTime);
            
            return {
                name: model.name,
                status: 'error',
                latency: latency,
                error: error.message
            };
        }
    }

    // Select appropriate token file based on model's input context
    function selectTokenFile(inputContext) {
        if (!inputContext || availableTokenFiles.length === 0) {
            console.warn('No input context or no token files available');
            return null;
        }

        // We need to leave room for the output tokens (max_tokens parameter)
        // Typical max_tokens is 4000-16000, so we'll be conservative and reserve 20k tokens
        const RESERVED_OUTPUT_TOKENS = 20000;
        const maxInputTokens = inputContext - RESERVED_OUTPUT_TOKENS;

        // Find the largest token file that's smaller than the adjusted limit
        const suitableFiles = availableTokenFiles.filter(f => f.tokenCount < maxInputTokens);
        
        if (suitableFiles.length === 0) {
            // If no suitable file found, use the smallest one
            console.warn(`No token file smaller than ${maxInputTokens} (context: ${inputContext} - ${RESERVED_OUTPUT_TOKENS}), using smallest available`);
            return availableTokenFiles[0];
        }

        // Return the largest file that's still smaller than the adjusted context
        const selectedFile = suitableFiles[suitableFiles.length - 1];
        console.log(`Selected ${selectedFile.filename} (${selectedFile.tokenCount} tokens) for context ${inputContext} (max input: ${maxInputTokens})`);
        return selectedFile;
    }

    async function testModelWithTokenFile(model) {
        const startTime = performance.now();
        
        try {
            // Get model's input context from v1 data
            const v1Model = v1ModelsMap.get(model.name);
            const inputContext = v1Model?.context_length;

            if (!inputContext) {
                return {
                    name: model.name,
                    status: 'error',
                    latency: 0,
                    error: 'Model has no input context information'
                };
            }

            // Select appropriate token file
            const tokenFile = selectTokenFile(inputContext);
            
            if (!tokenFile) {
                return {
                    name: model.name,
                    status: 'error',
                    latency: 0,
                    error: 'No suitable token file found'
                };
            }

            console.log(`📄 Testing ${model.name} (context: ${inputContext}) with ${tokenFile.filename} (${tokenFile.tokenCount} tokens)`);

            // Fetch the token file content
            const tokenResponse = await fetch(tokenFile.path);
            if (!tokenResponse.ok) {
                throw new Error('Failed to load token file');
            }
            const tokenContent = await tokenResponse.text();

            // Test the model with the token content
            const response = await fetch('/api/test-model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model.name,
                    prompt: tokenContent,
                    max_tokens: 1000,  // Use smaller max_tokens for token tests to avoid exceeding context
                    testType: 'token'
                })
            });

            const endTime = performance.now();
            const latency = Math.round(endTime - startTime);

            if (!response.ok) {
                const errorData = await response.json();
                return {
                    name: model.name,
                    status: 'error',
                    latency: latency,
                    error: errorData.error || 'Request failed',
                    tokenFile: tokenFile.filename,
                    inputContext: inputContext
                };
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '(Empty response)';
            const usage = data.usage || {};

            return {
                name: model.name,
                status: 'success',
                latency: latency,
                response: content,
                usage: {
                    prompt_tokens: usage.prompt_tokens || 0,
                    completion_tokens: usage.completion_tokens || 0,
                    total_tokens: usage.total_tokens || 0
                },
                tokenFile: tokenFile.filename,
                inputContext: inputContext,
                inputTokens: tokenFile.tokenCount
            };
        } catch (error) {
            const endTime = performance.now();
            const latency = Math.round(endTime - startTime);
            
            return {
                name: model.name,
                status: 'error',
                latency: latency,
                error: error.message,
                tokenFile: tokenFile?.filename,
                inputContext: inputContext
            };
        }
    }

    function displayLatencyResults(results) {
        console.log('Displaying results for', results.length, 'models');
        
        const successCount = results.filter(r => r.status === 'success').length;
        const errorCount = results.filter(r => r.status === 'error').length;
        const avgLatency = successCount > 0
            ? Math.round(results.filter(r => r.status === 'success').reduce((sum, r) => sum + r.latency, 0) / successCount)
            : 0;

        let html = `
            <div style="margin-bottom: 1rem; padding: 1rem; background: var(--color-surface); border-radius: 8px; border: 1px solid var(--color-border);">
                <h3 style="margin: 0 0 0.5rem 0; color: var(--color-text);">Test Results (${results.length} models tested)</h3>
                <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
                    <div><strong>Success:</strong> ${successCount}</div>
                    <div><strong>Failed:</strong> ${errorCount}</div>
                    <div><strong>Avg Latency:</strong> ${avgLatency}ms</div>
                    <div><strong>In Progress:</strong> ${results.length - successCount - errorCount}</div>
                </div>
            </div>
            <div style="display: grid; gap: 1rem; grid-template-columns: 1fr;">
        `;

        results.forEach((result, index) => {
            console.log(`Result ${index + 1}:`, result.name, result.status);
            
            const statusColor = result.status === 'success' ? 'var(--color-success)' : 'var(--color-error)';
            const statusIcon = result.status === 'success' ? '✅' : '❌';

            html += `
                <div style="padding: 1rem; background: var(--color-surface); border-radius: 8px; border: 1px solid var(--color-border); margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                        <strong style="color: var(--color-text); flex: 1; min-width: 200px;">${index + 1}. ${result.name}</strong>
                        <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                            <span style="color: ${statusColor};">${statusIcon} ${result.status.toUpperCase()}</span>
                            <span style="color: var(--color-accent); font-weight: bold;">${result.latency}ms</span>
                            ${result.usage ? `
                                <span style="color: var(--color-text-muted); font-size: 0.85rem;">
                                    📊 ${result.usage.completion_tokens} tokens
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    ${result.tokenFile ? `
                        <div style="color: var(--color-accent); font-size: 0.85rem; margin-top: 0.5rem; padding: 0.5rem; background: var(--color-bg); border-radius: 4px;">
                            📄 <strong>Token Test:</strong> Used ${result.tokenFile} | Model Context: ${formatNumber(result.inputContext)}
                        </div>
                    ` : ''}
                    ${result.error ? `<div style="color: var(--color-error); font-size: 0.9rem; margin-top: 0.5rem;">❌ Error: ${result.error}</div>` : ''}
                    ${result.usage ? `
                        <div style="color: var(--color-text-muted); font-size: 0.85rem; margin-top: 0.5rem; padding: 0.5rem; background: var(--color-bg); border-radius: 4px;">
                            <strong>Token Usage:</strong> Input: ${result.usage.prompt_tokens} | Output: ${result.usage.completion_tokens} | Total: ${result.usage.total_tokens}
                        </div>
                    ` : ''}
                    ${result.response ? `
                        <div style="margin-top: 0.75rem; padding: 0.75rem; background: var(--color-bg); border-radius: 4px; border-left: 3px solid var(--color-accent);">
                            <div style="font-weight: bold; color: var(--color-text); margin-bottom: 0.5rem; font-size: 0.9rem;">Response:</div>
                            <div style="color: var(--color-text); font-size: 0.9rem; line-height: 1.6; max-height: 300px; overflow-y: auto; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(result.response)}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        html += '</div>';
        latencyResults.innerHTML = html;
    }

    // Initial load - fetch v1 models first for modality info
    fetchV1Models().then(() => {
        // Load token files for token testing
        loadTokenFiles();
        // Load existing token test results
        loadTokenTestResults();
        fetchModels();
    });
});
