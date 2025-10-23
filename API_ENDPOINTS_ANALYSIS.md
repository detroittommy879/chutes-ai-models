# Chutes Models Enhanced - API Endpoints Analysis

## Overview

The Chutes Models Enhanced application uses **3 different data sources** to gather comprehensive model information. Each endpoint provides different data with minimal overlap, creating a complete picture of available models and their capabilities.

---

## Data Sources

### 1. **Chutes API - Main Endpoint** (Requires API Key)
**URL:** `https://api.chutes.ai/chutes/`

**Proxy Endpoint:** `GET /api/models` (local server)

**Purpose:** Provides the primary list of models with deployment and pricing information specific to your organization

**Query Parameters:**
- `page` (int, default: 0) - Pagination page number
- `limit` (int, default: 100) - Number of results per page
- `include_public` (bool, default: true) - Include publicly available models
- `include_schemas` (bool, default: true) - Include runtime schemas
- `template` (string, optional) - Filter by template type (e.g., "vllm", "tgi", "comfyui")
- `name` (string, optional) - Filter by model name

**Authentication:** Requires `Authorization: Bearer {CHUTES_API_KEY}` header

**Data Returned:**
```json
{
  "items": [
    {
      "id": "model-uuid",
      "name": "model-name",
      "chute_id": "chute-uuid",
      "standard_template": "vllm|tgi|comfyui",
      "current_estimated_price": {
        "per_million_tokens": {
          "input": { "usd": 0.03, "tao": 0.000077... },
          "output": { "usd": 0.1, "tao": 0.000257... }
        }
      },
      "invocation_count": 12345,
      "instances": [
        {
          "id": "instance-uuid",
          "active": true,
          "verified": true,
          "gpu_count": 2
        }
      ],
      "supported_gpus": ["H100", "A100"],
      "hot": false
    }
  ],
  "total": 150,
  "page": 0,
  "limit": 100
}
```

**Data Uniqueness:** ✅
- Organization-specific pricing
- Deployment instances (active/verified status)
- GPU allocations per model
- Invocation count (usage statistics)
- Template/deployment information

**Limitations:**
- ❌ **Does NOT include:** Modalities (input/output types), context length, quantization info, model features
- ❌ **Public endpoint equivalent:** None - requires API key

---

### 2. **LLM Chutes V1 API** (No API Key Required)
**URL:** `https://llm.chutes.ai/v1/models`

**Proxy Endpoint:** `GET /api/models/v1/all` (local server)

**Purpose:** Provides OpenAI-compatible endpoint with rich model capability metadata

**Query Parameters:** None

**Authentication:** No API key required (public endpoint)

**Data Returned:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "unsloth/gemma-3-12b-it",
      "object": "model",
      "created": 1761246584,
      "owned_by": "sglang|vllm|ollama",
      "pricing": {
        "prompt": 0.03,
        "completion": 0.1
      },
      "root": "unsloth/gemma-3-12b-it",
      "parent": null,
      "price": {
        "input": { "usd": 0.03, "tao": 0.000077... },
        "output": { "usd": 0.1, "tao": 0.000257... }
      },
      "quantization": "bf16|fp8|int8|none",
      "max_model_len": 1048576,
      "context_length": 131072,
      "max_output_length": 131072,
      "input_modalities": ["text", "image", "audio"],
      "output_modalities": ["text", "image", "audio"],
      "supported_features": ["json_mode", "structured_outputs", "tools", "reasoning"],
      "supported_sampling_parameters": [
        "temperature", "top_p", "top_k", "repetition_penalty", 
        "frequency_penalty", "presence_penalty", "stop", "seed"
      ],
      "permission": [
        {
          "id": "modelperm-uuid",
          "object": "model_permission",
          "created": 1761246584,
          "allow_view": true,
          "allow_sampling": true,
          "allow_fine_tuning": false
        }
      ]
    }
  ]
}
```

**Data Uniqueness:** ✅
- **Input/Output Modalities:** text, image, audio, video
- **Context Limits:** input context length and max output length
- **Model Quantization:** bf16, fp8, int8, etc.
- **Supported Features:** reasoning, json_mode, structured_outputs, tool_use
- **Sampling Parameters:** temperature, top_p, top_k, etc.
- **Model Metadata:** creation date, ownership info, parent models
- **Includes embedding models, image models, multimodal models** (not just LLMs)

**Limitations:**
- ❌ **Does NOT include:** Pricing per organization, deployment instances, active status, GPU info
- ❌ **Data may differ from Chutes API:** Different pricing, some models appear in only one endpoint

---

### 3. **Individual Model Endpoint** (Requires API Key)
**URL:** `https://api.chutes.ai/chutes/{chute_id}`

**Proxy Endpoint:** `GET /api/models/:chute_id` (local server)

**Purpose:** Detailed model information for a specific model deployment

**Parameters:**
- `chute_id` (string) - The model's chute ID from the main endpoint

**Authentication:** Requires `Authorization: Bearer {CHUTES_API_KEY}` header

**Data Returned:** Extended model object (same structure as items in `/api/models` with additional nested data)

**Use Case:** Currently NOT used in the UI, but available for future detailed model pages

---

## Data Flow Diagram

```
Frontend (script.js)
    │
    ├─→ fetchV1Models()
    │   └─→ GET /api/models/v1/all
    │       └─→ https://llm.chutes.ai/v1/models (no auth)
    │           └─→ Returns: Modalities, context length, quantization, features
    │
    └─→ fetchModels()
        └─→ GET /api/models
            └─→ https://api.chutes.ai/chutes/ (auth required)
                └─→ Returns: Pricing, instances, deployment status, GPU info

    Model data is merged client-side by model.name matching
    ↓
    v1ModelsMap stores V1 data for lookup
    fullModelsList stores Chutes API data
    ↓
    createModelRow() combines both sources for display
```

---

## Data Merging Strategy

The application merges data from both endpoints using **model name matching**:

```javascript
// In createModelRow():
const v1Model = v1ModelsMap.get(model.name);

// From Chutes API (model):
- name, pricing, instances, GPU info, deployment status

// From V1 API (v1Model):
- input_modalities, output_modalities
- context_length, max_output_length
- quantization
- supported_features
- supported_sampling_parameters
```

**Issue:** Model names may not always match exactly between endpoints, leading to:
- Missing modality info for some models
- Fallback behavior for template-based inference

---

## Data Gaps & Mismatches

### Why `/v1/models` has different models than `/chutes/`:

**V1 API includes models that Chutes API may not:**
- 🖼️ Image generation models (Comfy UI based)
- 📊 Embedding models
- 🔍 Vision/OCR models
- 🎵 Audio models
- Smaller/specialized models

**Chutes API includes models that V1 API may not:**
- Custom organization-specific fine-tuned models
- Experimental deployments
- Private models with restricted access

### Data Inconsistencies:

| Field | Chutes API | V1 API | Resolution |
|-------|-----------|--------|-----------|
| Model ID Format | UUID | `org/model-name` | Used separately, matched by name |
| Pricing | Organization-specific | Global | V1 pricing used as fallback |
| Quantization | ❌ Not provided | ✅ Included | Only V1 available |
| Context Length | ❌ Not provided | ✅ Included | Only V1 available |
| Modalities | ❌ Not provided | ✅ Included | Inferred from template if missing |
| Deployment Status | ✅ Included | ❌ Not provided | Only Chutes API available |

---

## Current Implementation

### Server-Side (server.js)

1. **GET /api/models** - Proxies Chutes API with caching
   - Caches for 10 minutes (configurable via `CACHE_DURATION_MINUTES`)
   - Caches to disk + memory
   - Cache key: `models_p{page}_l{limit}_t{template}_n{name}_pub{include_public}.json`

2. **GET /api/models/v1/all** - Proxies V1 API with caching
   - Caches for 10 minutes
   - Cache key: `v1_models_all.json`
   - Public endpoint (no auth needed)

3. **GET /api/cache/status** - Returns cache statistics
   - Shows all cached files, their age, and validity

### Client-Side (script.js)

1. **On page load:**
   - `fetchV1Models()` loads modality data into `v1ModelsMap`
   - `fetchModels()` loads pricing/deployment data into `fullModelsList`

2. **When displaying models:**
   - `createModelRow()` merges both datasets by model name
   - Falls back to template inference if V1 data missing

3. **Sorting:**
   - All sorting happens client-side after both datasets loaded
   - Can sort by any field from either endpoint

---

## How to Get Raw Data Files

### Option 1: Direct Endpoint Access (Easiest)

Visit these URLs in your browser or use curl:

```bash
# Chutes API endpoint (requires setup)
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3888/api/models?limit=1000

# V1 Models endpoint (public, no auth)
curl http://localhost:3888/api/models/v1/all

# Cache status
curl http://localhost:3888/api/cache/status
```

### Option 2: Export Endpoint (See Implementation Below)

Once the new endpoint is added, access:

```bash
# Export all raw data from all sources
curl http://localhost:3888/api/export/data

# Results: Single JSON file with both datasets and merge status
```

### Option 3: Direct File Access (After First Load)

Check the `cache/` directory:

```
cache/
├── models_p0_l1000_tnull_nnull_pubtrue.json     # Chutes API data
└── v1_models_all.json                           # V1 API data
```

Each file contains:
```json
{
  "timestamp": 1701234567890,
  "data": { /* actual API response */ }
}
```

### Option 4: Browser DevTools

1. Open browser DevTools (F12)
2. Network tab → click API calls → Response tab
3. Right-click → Save as (JSON file)

---

## Environment Variables

Control caching and data sources:

```bash
# .env file
CHUTES_API_KEY=your_api_key_here
CHUTES_BASE_URL=https://api.chutes.ai        # Can be overridden
CACHE_DURATION_MINUTES=10                     # Cache validity (default: 10 min)
NODE_ENV=development                          # development|production
PORT=3888
```

---

## Summary Table

| Aspect | Chutes API | V1 API |
|--------|-----------|--------|
| **URL** | `https://api.chutes.ai/chutes/` | `https://llm.chutes.ai/v1/models` |
| **Requires Auth** | ✅ Yes | ❌ No |
| **Model Count** | ~50-150 | ~100-300+ |
| **Pricing Info** | ✅ Organization-specific | ✅ Global |
| **Deployment Status** | ✅ Active/Inactive | ❌ No |
| **GPU Allocation** | ✅ Yes | ❌ No |
| **Modalities** | ❌ No | ✅ Yes |
| **Context Length** | ❌ No | ✅ Yes (input & output) |
| **Quantization** | ❌ No | ✅ Yes |
| **Model Features** | ❌ No | ✅ Yes |
| **Sampling Parameters** | ❌ No | ✅ Yes |
| **Image Models** | ⚠️ Limited | ✅ Yes |
| **Embedding Models** | ⚠️ Limited | ✅ Yes |
| **Caching** | ✅ 10 min default | ✅ 10 min default |

---

## Recommended Next Steps

1. **Data Validation:** Add a data merge report showing:
   - How many models matched between endpoints
   - How many are unique to each endpoint
   - Where data conflicts occur

2. **Enhanced Matching:** Instead of just model name:
   - Try fuzzy matching for similar names
   - Use model ID patterns for exact matching

3. **Additional Endpoints:**
   - Image/Vision models endpoint
   - Embedding models endpoint
   - Organization-specific model customization endpoint

4. **Real-time Updates:**
   - WebSocket for live model status
   - Webhook for pricing changes
   - Cache invalidation triggers
