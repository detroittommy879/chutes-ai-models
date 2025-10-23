# Quick Reference - Getting Raw Data

## TL;DR

### Option 1: Browser (Easiest) 🌐
```
http://localhost:3888/api/export/data
```
- Click the download link that appears
- Opens JSON file with all data sources + merge analysis
- Can inspect in browser or save to file

### Option 2: Command Line
```bash
# Get all data as JSON
curl http://localhost:3888/api/export/data > export.json

# Get V1 models specifically  
curl http://localhost:3888/api/models/v1/all > v1-models.json

# Get Chutes API data (requires .env setup)
curl -H "Authorization: Bearer YOUR_KEY" \
  http://localhost:3888/api/models?limit=1000 > chutes-models.json

# View cache status
curl http://localhost:3888/api/cache/status | jq .
```

### Option 3: Node.js Script (With Analysis)
```bash
# From the chutes-models-enhanced - Copy directory:
node export-data.js --output models-export.json

# Different formats:
node export-data.js --format csv --output models.csv
node export-data.js --format md --output models.md

# Direct file read from cache:
node export-data.js
```

### Option 4: Direct Cache Files
Navigate to: `chutes-models-enhanced - Copy/cache/`

Files created after first page load:
- `models_p0_l1000_tnull_nnull_pubtrue.json` - Chutes API response
- `v1_models_all.json` - V1 Models API response

Each contains:
```json
{
  "timestamp": 1234567890,
  "data": { /* actual API response */ }
}
```

---

## What's in Each Data Source

### Chutes API (`/api/models`)
**✅ Has:**
- Model names
- Pricing (org-specific)
- Deployment instances
- Active/inactive status
- GPU allocations
- Invocation counts

**❌ Missing:**
- Modalities (input/output types)
- Context lengths
- Quantization
- Model features

### V1 Models (`/api/models/v1/all`)
**✅ Has:**
- Input/output modalities (text, image, audio, video)
- Context length limits
- Max output length
- Quantization (bf16, fp8, etc)
- Supported features (json_mode, tools, reasoning)
- Image models
- Embedding models
- All model details

**❌ Missing:**
- Organization-specific pricing
- Deployment/instance status
- GPU allocations
- Real-time availability

---

## Example: Where's My Model?

**Problem:** You see a model in the UI but want the raw data

**Solution:** Use the export endpoint:

```bash
# Export all data
curl http://localhost:3888/api/export/data > data.json

# Then search data.json for your model in the merge analysis:
# - "onlyInChutesApi": Models with pricing/instances but no modality info
# - "onlyInV1Api": Models with full specs but no deployment info
# - Matched: Models with data from both sources
```

---

## Common Data Inspection Tasks

### 1. List all image models
```bash
curl http://localhost:3888/api/models/v1/all | \
  jq '.data[] | select(.input_modalities[] == "image") | {id, input_modalities, output_modalities}'
```

### 2. Find models supporting JSON mode
```bash
curl http://localhost:3888/api/models/v1/all | \
  jq '.data[] | select(.supported_features[] == "json_mode") | .id'
```

### 3. Check quantization distribution
```bash
curl http://localhost:3888/api/models/v1/all | \
  jq '[.data[].quantization] | group_by(.) | map({quant: .[0], count: length})'
```

### 4. Find models with longest context
```bash
curl http://localhost:3888/api/models/v1/all | \
  jq '.data | sort_by(-.context_length) | .[0:10] | .[] | {id, context_length}'
```

### 5. Compare pricing between APIs
```bash
# Run the Node script to get merge analysis
node export-data.js --format json | \
  jq '.sources.mergeAnalysis | {totalInChutesApi, totalInV1Api, matched, onlyInChutesApi: (.onlyInChutesApi | length), onlyInV1Api: (.onlyInV1Api | length)}'
```

---

## File Format Reference

### JSON Export Structure
```json
{
  "timestamp": "2024-01-20T10:30:45.123Z",
  "sources": {
    "chutesApi": {
      "source": "https://api.chutes.ai/chutes/",
      "requiresAuth": true,
      "modelCount": 127,
      "data": {
        "items": [ /* all models from Chutes */ ],
        "total": 127,
        "page": 0,
        "limit": 1000
      }
    },
    "v1Api": {
      "source": "https://llm.chutes.ai/v1/models",
      "requiresAuth": false,
      "modelCount": 287,
      "data": {
        "object": "list",
        "data": [ /* all models from V1 */ ]
      }
    },
    "mergeAnalysis": {
      "totalInChutesApi": 127,
      "totalInV1Api": 287,
      "matched": 95,
      "matchPercentage": "74.80%",
      "onlyInChutesApi": [ "org/custom-model-1", ... ],
      "onlyInV1Api": [ "meta/llama-2", ... ]
    }
  }
}
```

### CSV Export (Chutes Models)
```csv
name,chute_id,template,pricing_input_usd,pricing_output_usd,instances_active,gpus
"meta/llama-70b-chat","uuid-123","vllm","0.03","0.1","2","H100;H100"
"openai/gpt-4-turbo","uuid-456","tgi","0.05","0.15","1","A100"
```

### Markdown Export
- Summary table with top 50 models
- Merge analysis with stats
- Lists of unique models in each API

---

## Environment Setup

Create `.env` in `chutes-models-enhanced - Copy/`:
```bash
CHUTES_API_KEY=sk_your_api_key_here
CHUTES_BASE_URL=https://api.chutes.ai
CACHE_DURATION_MINUTES=10
NODE_ENV=development
PORT=3888
```

Without `CHUTES_API_KEY`, you can still:
- ✅ Use `/api/models/v1/all` (public endpoint)
- ✅ View cache status
- ❌ Fetch `/api/models` (requires auth)
- ❌ Test models

---

## Troubleshooting

### API returns 500 error
```bash
# Check if server is running
curl http://localhost:3888/api/health

# View server logs (look for errors)
npm start
```

### No cached files
```bash
# Cache is created on first API call
# Visit http://localhost:3888 in browser first

# Then check cache:
ls -la cache/
```

### Models not matching between APIs
- Different naming conventions
- V1 includes more models (image, embedding)
- Check merge analysis for gaps:
  ```bash
  curl http://localhost:3888/api/export/data | \
    jq '.sources.mergeAnalysis'
  ```

### Large export file
- Export is comprehensive (all models + metadata)
- For specific data, use jq filters (see examples above)
- CSV format is more compact than JSON

---

## Integration Examples

### Python
```python
import json
import urllib.request

# Fetch export data
url = 'http://localhost:3888/api/export/data'
with urllib.request.urlopen(url) as response:
    data = json.loads(response.read())
    
# Analyze
print(f"Matched: {data['sources']['mergeAnalysis']['matched']}")
print(f"Only V1: {len(data['sources']['mergeAnalysis']['onlyInV1Api'])}")
```

### JavaScript
```javascript
// Fetch in browser or Node.js
const response = await fetch('/api/export/data');
const data = await response.json();

// Find image models
const imageModels = data.sources.v1Api.data.data
  .filter(m => m.input_modalities?.includes('image'));
```

### SQL/Database
```bash
# Export as CSV, then load into database
node export-data.js --format csv --output models.csv

# In PostgreSQL:
# COPY models FROM 'models.csv' WITH (FORMAT csv, HEADER);
```

---

## Next Steps

1. **Inspect data:** Use `/api/export/data` to understand structure
2. **Extract what you need:** Use jq or script to filter
3. **Build on it:** Create dashboards, alerts, or automated workflows
4. **Contribute improvements:** Share insights about data gaps or matching issues
