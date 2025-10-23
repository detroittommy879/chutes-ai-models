#!/usr/bin/env node

/**
 * Raw Data Export & Analysis Tool
 * 
 * This utility helps extract and analyze raw data from the Chutes Models app
 * Usage: node export-data.js [options]
 * 
 * Options:
 *   --all              Export everything (default)
 *   --chutes           Export only Chutes API data
 *   --v1               Export only V1 API data
 *   --analysis         Show merge analysis only
 *   --format [json|csv|md]  Output format (default: json)
 *   --output [file]    Save to file (default: stdout)
 */

const fs = require('fs').promises;
const path = require('path');
const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3888';
const CACHE_DIR = path.join(__dirname, 'cache');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    all: true,
    format: 'json',
    output: null
};

args.forEach(arg => {
    if (arg === '--all') options.all = true;
    if (arg === '--chutes') options.all = false;
    if (arg === '--v1') options.all = false;
    if (arg === '--analysis') options.all = false;
    if (arg.startsWith('--format')) options.format = arg.split('=')[1] || 'json';
    if (arg.startsWith('--output')) options.output = arg.split('=')[1];
});

/**
 * Fetch data from local endpoint
 */
async function fetchExportData() {
    return new Promise((resolve, reject) => {
        const url = new URL('/api/export/data', BASE_URL);
        const client = url.protocol === 'https:' ? require('https') : http;
        
        client.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

/**
 * Read cache files directly
 */
async function readCacheFiles() {
    const data = { chutesApi: null, v1Api: null };
    
    try {
        // Read Chutes API cache
        const chutesCacheFile = path.join(CACHE_DIR, 'models_p0_l1000_tnull_nnull_pubtrue.json');
        const chutesContent = await fs.readFile(chutesCacheFile, 'utf8');
        const chutesData = JSON.parse(chutesContent);
        data.chutesApi = {
            source: 'https://api.chutes.ai/chutes/',
            modelCount: chutesData.data?.items?.length || 0,
            data: chutesData.data
        };
    } catch (err) {
        console.warn('⚠️  Could not read Chutes API cache:', err.message);
    }
    
    try {
        // Read V1 API cache
        const v1CacheFile = path.join(CACHE_DIR, 'v1_models_all.json');
        const v1Content = await fs.readFile(v1CacheFile, 'utf8');
        const v1Data = JSON.parse(v1Content);
        data.v1Api = {
            source: 'https://llm.chutes.ai/v1/models',
            modelCount: v1Data.data?.data?.length || 0,
            data: v1Data.data
        };
    } catch (err) {
        console.warn('⚠️  Could not read V1 API cache:', err.message);
    }
    
    return data;
}

/**
 * Format data as CSV
 */
function formatAsCSV(exportData) {
    let csv = '';
    
    if (exportData.sources.chutesApi?.data?.items) {
        csv += '# Chutes API Models\n';
        csv += 'name,chute_id,template,pricing_input_usd,pricing_output_usd,instances_active,gpus\n';
        
        exportData.sources.chutesApi.data.items.forEach(model => {
            const inputPrice = model.current_estimated_price?.per_million_tokens?.input?.usd || 'N/A';
            const outputPrice = model.current_estimated_price?.per_million_tokens?.output?.usd || 'N/A';
            const activeInstances = model.instances?.filter(i => i.active).length || 0;
            const gpus = model.supported_gpus?.join(';') || 'N/A';
            
            csv += `"${model.name}","${model.chute_id}","${model.standard_template}","${inputPrice}","${outputPrice}","${activeInstances}","${gpus}"\n`;
        });
    }
    
    csv += '\n# V1 Models (with modalities)\n';
    if (exportData.sources.v1Api?.data?.data) {
        csv += 'id,quantization,context_length,max_output_length,input_modalities,output_modalities,supported_features\n';
        
        exportData.sources.v1Api.data.data.forEach(model => {
            const inputMod = model.input_modalities?.join(';') || 'N/A';
            const outputMod = model.output_modalities?.join(';') || 'N/A';
            const features = model.supported_features?.join(';') || 'N/A';
            
            csv += `"${model.id}","${model.quantization}","${model.context_length}","${model.max_output_length}","${inputMod}","${outputMod}","${features}"\n`;
        });
    }
    
    return csv;
}

/**
 * Format data as Markdown
 */
function formatAsMarkdown(exportData) {
    let md = '# Chutes Models Export\n\n';
    md += `Generated: ${new Date().toISOString()}\n\n`;
    
    if (exportData.sources.mergeAnalysis) {
        const analysis = exportData.sources.mergeAnalysis;
        md += '## Merge Analysis\n\n';
        md += `- **Total in Chutes API:** ${analysis.totalInChutesApi}\n`;
        md += `- **Total in V1 API:** ${analysis.totalInV1Api}\n`;
        md += `- **Matched:** ${analysis.matched} (${analysis.matchPercentage})\n\n`;
        
        if (analysis.onlyInChutesApi.length > 0) {
            md += `### Only in Chutes API (${analysis.onlyInChutesApi.length}):\n\n`;
            analysis.onlyInChutesApi.forEach(name => {
                md += `- \`${name}\`\n`;
            });
            md += '\n';
        }
        
        if (analysis.onlyInV1Api.length > 0) {
            md += `### Only in V1 API (${analysis.onlyInV1Api.length}):\n\n`;
            analysis.onlyInV1Api.slice(0, 20).forEach(id => {
                md += `- \`${id}\`\n`;
            });
            if (analysis.onlyInV1Api.length > 20) {
                md += `- ... and ${analysis.onlyInV1Api.length - 20} more\n`;
            }
            md += '\n';
        }
    }
    
    if (exportData.sources.chutesApi?.data?.items) {
        md += `## Chutes API Models (${exportData.sources.chutesApi.data.items.length})\n\n`;
        md += '| Model | Template | Input Price | Output Price | Instances | GPUs |\n';
        md += '|-------|----------|-------------|--------------|-----------|------|\n';
        
        exportData.sources.chutesApi.data.items.slice(0, 50).forEach(model => {
            const inputPrice = model.current_estimated_price?.per_million_tokens?.input?.usd || 'N/A';
            const outputPrice = model.current_estimated_price?.per_million_tokens?.output?.usd || 'N/A';
            const activeInstances = model.instances?.filter(i => i.active).length || 0;
            const gpus = model.supported_gpus?.join(', ') || 'N/A';
            
            md += `| ${model.name} | ${model.standard_template} | $${inputPrice} | $${outputPrice} | ${activeInstances} | ${gpus} |\n`;
        });
        
        if (exportData.sources.chutesApi.data.items.length > 50) {
            md += `\n... and ${exportData.sources.chutesApi.data.items.length - 50} more models\n`;
        }
    }
    
    return md;
}

/**
 * Main execution
 */
async function main() {
    try {
        console.log('📊 Chutes Models Export Tool\n');
        
        let exportData;
        
        // Try to fetch from API first
        try {
            console.log('🌐 Fetching from API endpoint...');
            exportData = await fetchExportData();
            console.log('✅ Data fetched from API\n');
        } catch (err) {
            console.log('⚠️  API not available, reading cache files directly...');
            const cacheData = await readCacheFiles();
            exportData = {
                timestamp: new Date().toISOString(),
                sources: cacheData
            };
            console.log('✅ Data read from cache\n');
        }
        
        // Format output
        let output = '';
        if (options.format === 'csv') {
            output = formatAsCSV(exportData);
        } else if (options.format === 'md') {
            output = formatAsMarkdown(exportData);
        } else {
            output = JSON.stringify(exportData, null, 2);
        }
        
        // Write output
        if (options.output) {
            await fs.writeFile(options.output, output, 'utf8');
            console.log(`✅ Export saved to: ${options.output}`);
        } else {
            console.log(output);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
