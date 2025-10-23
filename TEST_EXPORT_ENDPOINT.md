# Testing the New Export Endpoint

## Quick Test (30 seconds)

After starting the server, test the new export endpoint:

### 1. Browser (Easiest)
```
http://localhost:3888/api/export/data
```
✅ Should show JSON in browser with all data sources + analysis

### 2. Command Line
```bash
curl http://localhost:3888/api/export/data | head -50
```
✅ Should show JSON output starting with timestamp and sources

### 3. Save to File
```bash
# PowerShell (Windows)
(curl.exe http://localhost:3888/api/export/data).Content | Out-File export.json

# Or with curl
curl http://localhost:3888/api/export/data > export.json
```
✅ Should create `export.json` file with full data

---

## What You Should See

The JSON response structure:

```json
{
  "timestamp": "2024-01-20T10:30:45.123Z",
  "sources": {
    "chutesApi": {
      "source": "https://api.chutes.ai/chutes/",
      "requiresAuth": true,
      "modelCount": 127,
      "data": { 
        "items": [/* models */],
        "total": 127,
        ...
      }
    },
    "v1Api": {
      "source": "https://llm.chutes.ai/v1/models",
      "requiresAuth": false,
      "modelCount": 287,
      "data": {
        "object": "list",
        "data": [/* models */]
      }
    },
    "mergeAnalysis": {
      "totalInChutesApi": 127,
      "totalInV1Api": 287,
      "matched": 95,
      "matchPercentage": "74.80%",
      "onlyInChutesApi": [/* model names */],
      "onlyInV1Api": [/* model ids */],
      "dataGaps": {
        "chutesApiMissing": ["modalities", "context_length", ...],
        "v1ApiMissing": ["pricing_organization_specific", ...]
      }
    }
  }
}
```

---

## Common Test Cases

### Test 1: Verify Cache is Working
```bash
# First request (should be cache MISS if just started)
curl http://localhost:3888/api/export/data | jq '.timestamp'

# Wait a second
sleep 1

# Second request (should be cache HIT based on internal logic)
curl http://localhost:3888/api/models/v1/all | head -20
```

### Test 2: Check Merge Statistics
```bash
# Extract just the merge analysis
curl http://localhost:3888/api/export/data | \
  jq '.sources.mergeAnalysis | {matched, totalInChutesApi, totalInV1Api, matchPercentage}'
```

**Expected output:**
```json
{
  "matched": 95,
  "totalInChutesApi": 127,
  "totalInV1Api": 287,
  "matchPercentage": "74.80%"
}
```

### Test 3: Find Models Only in V1 (First 10)
```bash
curl http://localhost:3888/api/export/data | \
  jq '.sources.mergeAnalysis.onlyInV1Api[0:10]'
```

### Test 4: Find Models Only in Chutes
```bash
curl http://localhost:3888/api/export/data | \
  jq '.sources.mergeAnalysis.onlyInChutesApi'
```

### Test 5: Check Data Gaps
```bash
curl http://localhost:3888/api/export/data | \
  jq '.sources.mergeAnalysis.dataGaps'
```

**Expected output:**
```json
{
  "chutesApiMissing": [
    "modalities",
    "context_length",
    "max_output_length",
    "quantization",
    "supported_features"
  ],
  "v1ApiMissing": [
    "pricing_organization_specific",
    "instances",
    "deployment_status",
    "gpu_allocation",
    "invocation_count"
  ]
}
```

---

## Test the Export Script

### Using Node.js (from chutes-models-enhanced - Copy folder)

```bash
# JSON format (default)
node export-data.js

# JSON to file
node export-data.js --output export.json

# CSV format
node export-data.js --format csv --output models.csv

# Markdown format
node export-data.js --format md --output models.md

# View output
cat export.json | head -50
```

---

## Troubleshooting Tests

### Test: Is server running?
```bash
curl http://localhost:3888/api/health
```
Should return:
```json
{
  "status": "ok",
  "apiKeyConfigured": true,
  "baseUrl": "https://api.chutes.ai",
  "cache": {
    "duration": "600 seconds",
    "inMemoryEntries": 2
  }
}
```

### Test: Is cache working?
```bash
curl http://localhost:3888/api/cache/status
```
Should return info about cached files.

### Test: Can we reach V1 API? (No API key needed)
```bash
curl http://localhost:3888/api/models/v1/all | jq '.object'
```
Should return: `"list"`

### Test: Can we reach Chutes API? (Needs API key)
```bash
curl -H "Authorization: Bearer $CHUTES_API_KEY" \
  http://localhost:3888/api/models?limit=10 | jq '.items | length'
```
Should return a number or error if API key is missing.

---

## Performance Notes

The export endpoint should be fast:
- If data is cached: <50ms response time
- First call (cache miss): 2-5 seconds (depends on API response times)
- Merge analysis: Generated on-the-fly, <100ms

File sizes (typical):
- Chutes API response: 150-300 KB
- V1 API response: 500-800 KB
- Full export JSON: 700-1100 KB
- CSV export: 200-400 KB
- Markdown export: 300-500 KB

---

## Next Steps

1. ✅ **Test** - Run the tests above
2. 📖 **Read** - Check `API_ENDPOINTS_ANALYSIS.md` for details
3. 📊 **Analyze** - Use jq or script to filter data
4. 🔧 **Integrate** - Use exported data in your workflow
5. 🚀 **Enhance** - Add more endpoints or analysis as needed

---

## Integration Test (Full Workflow)

Complete test of the entire system:

```bash
#!/bin/bash

echo "🧪 Testing Chutes Models Export System"
echo ""

# 1. Check health
echo "1️⃣  Checking server health..."
curl -s http://localhost:3888/api/health | jq '.status'

# 2. Check cache status
echo ""
echo "2️⃣  Checking cache status..."
curl -s http://localhost:3888/api/cache/status | jq '.diskFiles'

# 3. Export all data
echo ""
echo "3️⃣  Exporting all data..."
curl -s http://localhost:3888/api/export/data > /tmp/export.json

# 4. Analyze
echo ""
echo "4️⃣  Merge Analysis:"
jq '.sources.mergeAnalysis | {matched, totalInChutesApi, totalInV1Api, matchPercentage}' /tmp/export.json

# 5. Count models
echo ""
echo "5️⃣  Model Statistics:"
echo "Chutes API models:"
jq '.sources.chutesApi.modelCount' /tmp/export.json
echo "V1 API models:"
jq '.sources.v1Api.modelCount' /tmp/export.json

# 6. Show data gaps
echo ""
echo "6️⃣  Data Gaps:"
jq '.sources.mergeAnalysis.dataGaps' /tmp/export.json

echo ""
echo "✅ Tests complete! Data saved to /tmp/export.json"
```

Save as `test-export.sh` and run:
```bash
bash test-export.sh
```

---

## Expected Behavior

After starting the server with valid `.env`:

1. First page load → API calls made → Data cached
2. Second page load → Data from cache (fast)
3. After 10 minutes → Cache expires → Next request refetches

Testing `/api/export/data`:
- First call: Returns data + merge analysis (may be slow if APIs are slow)
- Subsequent calls: Returns cached data (very fast)
- Merge analysis: Always generated from current cache
- Shows exactly which models are where

---

## Support for Issues

If tests fail:

| Issue | Check |
|-------|-------|
| 404 error | Is server running? `curl http://localhost:3888` |
| No cache files | Visit browser page first to trigger cache population |
| Empty V1 data | Is internet connection working? |
| Empty Chutes data | Is `CHUTES_API_KEY` set? Check `.env` file |
| Merge shows 0% match | Model names may not match - check individual models |

---

Happy testing! 🚀
