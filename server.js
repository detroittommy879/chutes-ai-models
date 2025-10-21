require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const cors = require('cors');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3888;
const CHUTES_API_KEY = process.env.CHUTES_API_KEY;
const CHUTES_BASE_URL = process.env.CHUTES_BASE_URL || 'https://api.chutes.ai';

// Cache configuration - configurable via environment variable
const CACHE_DIR = path.join(__dirname, 'cache');
const CACHE_DURATION_MINUTES = parseInt(process.env.CACHE_DURATION_MINUTES || '10', 10);
const CACHE_DURATION = CACHE_DURATION_MINUTES * 60 * 1000; // Convert minutes to milliseconds

// In-memory cache tracker
const cacheTracker = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from dist in production, public in development
const staticDir = process.env.NODE_ENV === 'production' ? 'dist' : 'public';
app.use(express.static(staticDir));
console.log(`📂 Serving static files from: ${staticDir}`);

// Initialize cache directory
async function initCache() {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
        console.log('✅ Cache directory initialized');
    } catch (err) {
        console.error('Failed to create cache directory:', err);
    }
}

// Generate cache key from query parameters
function getCacheKey(params) {
    const { page = 0, limit = 100, template = '', name = '', include_public = true } = params;
    return `models_p${page}_l${limit}_t${template}_n${name}_pub${include_public}.json`;
}

// Get cache file path with timestamp
function getCacheFilePath(cacheKey) {
    return path.join(CACHE_DIR, cacheKey);
}

// Check if cache is valid
async function getCachedData(cacheKey) {
    try {
        const cacheFile = getCacheFilePath(cacheKey);
        
        // Check in-memory tracker first
        const trackerEntry = cacheTracker.get(cacheKey);
        if (trackerEntry) {
            const age = Date.now() - trackerEntry.timestamp;
            if (age < CACHE_DURATION) {
                console.log(`📦 Using in-memory cache for ${cacheKey} (age: ${Math.round(age / 1000)}s)`);
                return trackerEntry.data;
            } else {
                console.log(`⏰ Cache expired for ${cacheKey} (age: ${Math.round(age / 1000)}s)`);
                cacheTracker.delete(cacheKey);
            }
        }

        // Try to read from disk
        const fileContent = await fs.readFile(cacheFile, 'utf8');
        const cached = JSON.parse(fileContent);
        
        const age = Date.now() - cached.timestamp;
        if (age < CACHE_DURATION) {
            console.log(`💾 Using disk cache for ${cacheKey} (age: ${Math.round(age / 1000)}s)`);
            // Store in memory for faster access next time
            cacheTracker.set(cacheKey, {
                timestamp: cached.timestamp,
                data: cached.data
            });
            return cached.data;
        } else {
            console.log(`⏰ Disk cache expired for ${cacheKey} (age: ${Math.round(age / 1000)}s)`);
            // Delete expired cache file
            await fs.unlink(cacheFile).catch(() => {});
        }
    } catch (err) {
        // Cache miss or error reading cache
        if (err.code !== 'ENOENT') {
            console.log('Cache read error:', err.message);
        }
    }
    return null;
}

// Save data to cache
async function setCachedData(cacheKey, data) {
    try {
        const timestamp = Date.now();
        const cacheFile = getCacheFilePath(cacheKey);
        
        // Save to memory
        cacheTracker.set(cacheKey, { timestamp, data });
        
        // Save to disk
        await fs.writeFile(
            cacheFile,
            JSON.stringify({ timestamp, data }, null, 2),
            'utf8'
        );
        
        console.log(`💾 Cached data saved for ${cacheKey}`);
    } catch (err) {
        console.error('Failed to save cache:', err);
    }
}

// Clean up old cache files periodically
async function cleanupCache() {
    try {
        const files = await fs.readdir(CACHE_DIR);
        const now = Date.now();
        let cleanedCount = 0;

        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            
            const filePath = path.join(CACHE_DIR, file);
            try {
                const content = await fs.readFile(filePath, 'utf8');
                const cached = JSON.parse(content);
                const age = now - cached.timestamp;
                
                if (age > CACHE_DURATION) {
                    await fs.unlink(filePath);
                    cleanedCount++;
                }
            } catch (err) {
                // If we can't read it, delete it
                await fs.unlink(filePath).catch(() => {});
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} old cache file(s)`);
        }
    } catch (err) {
        console.error('Cache cleanup error:', err);
    }
}

// Check if API key is configured
if (!CHUTES_API_KEY) {
    console.error('ERROR: CHUTES_API_KEY is not set in .env file');
    console.error('Please create a .env file with your API key');
    process.exit(1);
}

// Initialize
initCache();

// Run cache cleanup every 5 minutes
setInterval(cleanupCache, 5 * 60 * 1000);

// API endpoint to fetch models (with caching)
app.get('/api/models', async (req, res) => {
    try {
        const {
            page = 0,
            limit = 100,
            include_public = true,
            template = null,
            name = null,
            include_schemas = true
        } = req.query;

        // Generate cache key based on query parameters
        const cacheKey = getCacheKey({ page, limit, template, name, include_public });

        // Try to get cached data
        const cachedData = await getCachedData(cacheKey);
        if (cachedData) {
            // Add cache info to response headers
            res.set('X-Cache', 'HIT');
            res.set('X-Cache-Age', Math.round((Date.now() - cacheTracker.get(cacheKey)?.timestamp || 0) / 1000));
            return res.json(cachedData);
        }

        // Cache miss - fetch from API
        console.log(`🌐 Fetching fresh data from API for ${cacheKey}`);

        // Build query parameters
        const params = new URLSearchParams();
        params.append('page', page);
        params.append('limit', limit);
        params.append('include_public', include_public);
        if (include_schemas) params.append('include_schemas', 'true');
        if (template) params.append('template', template);
        if (name) params.append('name', name);

        const url = `${CHUTES_BASE_URL}/chutes/?${params.toString()}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHUTES_API_KEY}`
            }
        });

        if (!response.ok) {
            throw new Error(`Chutes API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        console.log(`✅ Successfully fetched ${data.items?.length || 0} models from API`);
        
        // Cache the response
        await setCachedData(cacheKey, data);

        // Add cache info to response headers
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Duration', CACHE_DURATION / 1000);
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching models:', error);
        res.status(500).json({
            error: 'Failed to fetch models',
            message: error.message
        });
    }
});

// API endpoint to fetch additional model info from /v1/models (for modalities)
app.get('/api/models/v1/all', async (req, res) => {
    try {
        const cacheKey = 'v1_models_all.json';
        
        // Try to get cached data
        const cachedData = await getCachedData(cacheKey);
        if (cachedData) {
            res.set('X-Cache', 'HIT');
            return res.json(cachedData);
        }

        console.log('🌐 Fetching /v1/models data (for modalities info)');
        
        const url = 'https://llm.chutes.ai/v1/models';
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`V1 API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Cache the response
        await setCachedData(cacheKey, data);
        
        res.set('X-Cache', 'MISS');
        res.json(data);
    } catch (error) {
        console.error('Error fetching v1 models:', error);
        res.status(500).json({
            error: 'Failed to fetch v1 models',
            message: error.message
        });
    }
});

// API endpoint to fetch a specific model
app.get('/api/models/:chute_id', async (req, res) => {
    try {
        const { chute_id } = req.params;
        const url = `${CHUTES_BASE_URL}/chutes/${chute_id}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHUTES_API_KEY}`
            }
        });

        if (!response.ok) {
            throw new Error(`Chutes API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching model:', error);
        res.status(500).json({
            error: 'Failed to fetch model',
            message: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        apiKeyConfigured: !!CHUTES_API_KEY,
        baseUrl: CHUTES_BASE_URL,
        cache: {
            duration: `${CACHE_DURATION / 1000} seconds`,
            inMemoryEntries: cacheTracker.size
        }
    });
});

// Cache status endpoint
app.get('/api/cache/status', async (req, res) => {
    try {
        const files = await fs.readdir(CACHE_DIR);
        const cacheFiles = files.filter(f => f.endsWith('.json'));
        
        const cacheInfo = [];
        for (const file of cacheFiles) {
            try {
                const filePath = path.join(CACHE_DIR, file);
                const content = await fs.readFile(filePath, 'utf8');
                const cached = JSON.parse(content);
                const age = Date.now() - cached.timestamp;
                
                cacheInfo.push({
                    key: file,
                    age: Math.round(age / 1000),
                    valid: age < CACHE_DURATION,
                    itemCount: cached.data?.items?.length || 0
                });
            } catch (err) {
                // Skip invalid files
            }
        }

        res.json({
            cacheDuration: CACHE_DURATION / 1000,
            inMemoryEntries: cacheTracker.size,
            diskFiles: cacheInfo.length,
            entries: cacheInfo
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    const htmlFile = process.env.NODE_ENV === 'production' ? 'dist' : 'public';
    res.sendFile(path.join(__dirname, htmlFile, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✅ Chutes Models Enhanced Server running on http://localhost:${PORT}`);
    console.log(`📡 Using Chutes API: ${CHUTES_BASE_URL}`);
    console.log(`🔑 API Key configured: ${CHUTES_API_KEY ? 'Yes' : 'No'}`);
    console.log(`💾 Cache enabled: ${CACHE_DURATION / 1000} seconds (${CACHE_DURATION_MINUTES} minutes)`);
    console.log(`📁 Cache directory: ${CACHE_DIR}`);
    console.log(`⏱️  API calls only happen when cache expires AND someone visits the site`);
});
