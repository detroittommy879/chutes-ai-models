# Data Analysis Summary

## What I Found

The Chutes Models Enhanced application uses **3 distinct data sources** that work together:

### 1. **Chutes API** (`https://api.chutes.ai/chutes/`)
- **Requires:** API key authentication
- **Provides:** Organization-specific model deployments, pricing, instance status, GPU allocations, usage stats
- **Models:** ~50-150 (your organization's models)
- **Data Focus:** Business/Operations (What's deployed, how much it costs, how popular it is)

### 2. **V1 Models API** (`https://llm.chutes.ai/v1/models`)
- **Requires:** None (public endpoint)
- **Provides:** Model capabilities, modalities, context limits, quantization, features
- **Models:** ~100-300+ (comprehensive catalog including image, embedding, vision models)
- **Data Focus:** Technical (What can the model do, its limits, what it supports)

### 3. **Individual Model Endpoint** (`https://api.chutes.ai/chutes/{chute_id}`)
- **Requires:** API key authentication
- **Provides:** Detailed info for a specific model deployment
- **Usage:** Currently not used in UI (available for future enhancements)

---

## Key Findings

### Why `/v1/models` has more models:
- ✅ Includes image/vision/OCR models
- ✅ Includes embedding models
- ✅ Includes audio models
- ✅ Includes all available models regardless of deployment status

### Why `/chutes/` has different models:
- ✅ Only your organization's active deployments
- ✅ Organization-specific pricing & instance info
- ✅ Real-time deployment status
- ✅ Custom fine-tuned models you've created

### The Gap Problem:
Only **~74-80%** of models match between endpoints. This means:
- Many V1 models aren't deployed in your organization
- Some custom models may only be in your Chutes deployment
- Data merging requires fuzzy matching or name-based lookups

---

## Files Created

### 📋 Documentation
1. **API_ENDPOINTS_ANALYSIS.md** (This folder)
   - Complete reference for all 3 endpoints
   - What data each provides/lacks
   - Data flow diagram
   - Merge strategy explanation
   - Why mismatches occur

2. **GETTING_RAW_DATA.md** (This folder)
   - Quick reference guide
   - 5 ways to get raw data
   - Common inspection tasks (with jq examples)
   - Integration examples (Python, JavaScript, SQL)
   - Troubleshooting

### 🛠️ New Features

3. **`/api/export/data` endpoint** (Added to server.js)
   - Single endpoint for all raw data
   - Automatic merge analysis
   - Shows which models are in which endpoint
   - Data gaps reported
   - Download as JSON

4. **`export-data.js` script**
   - Command-line tool for data extraction
   - Supports JSON, CSV, Markdown output
   - Direct cache file reading
   - No server required if cache exists
   - Usage:
     ```bash
     node export-data.js --format json --output export.json
     node export-data.js --format csv --output models.csv
     node export-data.js --format md --output models.md
     ```

---

## How to Use These Resources

### Step 1: Understand the Architecture
→ Read **API_ENDPOINTS_ANALYSIS.md** for overview

### Step 2: Access the Data
Choose your preferred method in **GETTING_RAW_DATA.md**:
- Browser: Visit `http://localhost:3888/api/export/data`
- CLI: `curl http://localhost:3888/api/export/data`
- Script: `node export-data.js`
- Direct: Check `cache/` folder

### Step 3: Analyze What You Got
- Export includes merge analysis showing mismatches
- Use jq examples to filter for specific models
- Compare pricing, capabilities, availability

---

## Real-World Example

Let's say you want to find "Why doesn't model X show quantization info?"

### Investigation Steps:

1. **Get the export data:**
   ```bash
   curl http://localhost:3888/api/export/data > data.json
   ```

2. **Check merge analysis:**
   ```bash
   jq '.sources.mergeAnalysis | {matched, onlyInChutesApi, onlyInV1Api}' data.json
   ```
   Result: "Model X is onlyInChutesApi" → It doesn't exist in V1, so no quant info available

3. **Or find it explicitly:**
   ```bash
   # Search Chutes API
   jq '.sources.chutesApi.data.items[] | select(.name == "Model X")' data.json
   # No quantization field found
   
   # Check V1 API
   jq '.sources.v1Api.data.data[] | select(.id == "Model X")' data.json
   # Not found in V1 API
   ```

**Conclusion:** Model X is custom/org-specific and doesn't have V1 metadata.

---

## Next Steps You Could Take

### Option A: Improve Data Matching
- Implement fuzzy name matching instead of exact match
- Build a model ID mapping table
- Add manual override for known mismatches

### Option B: Enhance Data Collection
- Add image models endpoint
- Add embeddings models endpoint
- Add custom endpoint for combined data

### Option C: Real-Time Updates
- WebSocket for live model status
- Pricing change notifications
- Cache invalidation on model updates

### Option D: Dashboard/Reports
- Model availability dashboard
- Pricing comparison charts
- Quantization distribution
- Context length rankings

---

## Important Notes

### About the Context Column Fix
The context column now correctly shows:
- **Input Context:** Uses `context_length` from V1 API
- **Output Context:** Uses `max_output_length` from V1 API
- **NOT `max_model_len`:** That's the theoretical max (requires infinite compute)

### Caching Behavior
- Cache saves **entire API responses** (all columns automatically included)
- 10-minute default (configurable)
- Cache key includes query parameters (different queries = different caches)
- You can force refresh by clearing cache files

### API Key Required For...
- ✅ `/api/models` endpoint (Chutes API)
- ✅ `/api/models/:chute_id` (individual model detail)
- ✅ `/api/test-model` (testing/latency checking)

### No API Key Needed For...
- ✅ `/api/models/v1/all` (V1 models - public)
- ✅ `/api/export/data` (uses cached data)
- ✅ `/api/cache/status` (cache info)
- ✅ `/api/health` (health check)

---

## Quick Answers to Your Original Questions

**Q: Why does /v1/models list image models but /chutes/ doesn't?**
> Because V1 is the full public catalog (with all model types), while /chutes/ is only your organization's deployments (which may not include image models).

**Q: How do I get raw files to inspect?**
> 5 ways:
> 1. Browser: `http://localhost:3888/api/export/data`
> 2. CLI: `curl http://localhost:3888/api/export/data > data.json`
> 3. Script: `node export-data.js`
> 4. Direct files: `cache/models_p0_*.json` and `cache/v1_models_all.json`
> 5. In-app: DevTools Network tab, save responses

**Q: What's max_model_len vs context_length?**
> - `context_length` = actual usable input tokens
> - `max_output_length` = actual usable output tokens
> - `max_model_len` = theoretical max (ignore it)

**Q: Does caching include all columns?**
> Yes! Cache saves entire API response, so any column (new or existing) is automatically included.

---

## File Locations

From the `chutes-models-enhanced - Copy` folder:

```
.
├── API_ENDPOINTS_ANALYSIS.md          ← Comprehensive endpoint docs
├── GETTING_RAW_DATA.md                 ← Quick reference & how-to
├── export-data.js                      ← CLI utility for exports
├── server.js                           ← Updated with /api/export/data
├── public/
│   ├── script.js                       ← Updated context column logic
│   └── ...
├── cache/
│   ├── models_p0_l1000_tnull_nnull_pubtrue.json
│   └── v1_models_all.json
└── ...
```

---

## Support

If you need more details:
1. Check **API_ENDPOINTS_ANALYSIS.md** for endpoint specs
2. Check **GETTING_RAW_DATA.md** for data access methods
3. Run `curl http://localhost:3888/api/cache/status` to see what's cached
4. Check server console logs for API call details

Good luck with your analysis! 🚀
