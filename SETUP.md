# Quick Setup Guide

## What's Different?

### Basic Version (`chutes-models/`)
- ✅ Works without API key
- ✅ Browser-only (no server needed)
- ❌ Only shows text generation models (~20-30 models)
- ❌ Limited information
- Uses endpoint: `/v1/models`

### Enhanced Version (`chutes-models-enhanced/`)
- ⚠️ Requires API key
- ✅ Node.js server (keeps API key secure)
- ✅ Shows ALL models including:
  - **Text generation** (VLLM models)
  - **Image generation** (ComfyUI models)
  - **Video generation models**
  - **Audio models**
  - **Custom models**
- ✅ Complete information:
  - Instance status and verification
  - GPU requirements
  - Invocation counts (popularity)
  - Hot/Cold status
  - Pricing in USD and TAO
  - Regional availability
- Uses endpoint: `/chutes/` (requires authentication)

## Installation Steps

### 1. Navigate to the directory
```powershell
cd c:\2nd\Main\Git-Projects\z_aiimage\chutes-models-enhanced
```

### 2. Install Node.js dependencies
```powershell
npm install
```

### 3. Create your .env file
```powershell
copy .env.example .env
```

### 4. Edit the .env file with your API key
Open `.env` in a text editor and replace `your-api-key-here` with your actual Chutes API key:
```env
CHUTES_API_KEY=your-actual-api-key-here
PORT=3000
CHUTES_BASE_URL=https://api.chutes.ai
```

### 5. Start the server
```powershell
npm start
```

### 6. Open in browser
Navigate to: http://localhost:3000

## Features

### Smart Caching 💾
The server automatically caches API responses for **3 minutes**. This means:
- If 10 people visit within 3 minutes, only **1 API call** is made
- Subsequent visitors get instant cached data
- Cache automatically expires and refreshes
- Sorting is instant (client-side only, no API calls)

See [CACHING.md](CACHING.md) for technical details.

### Filtering
- **Template filter**: Show only specific types (VLLM, ComfyUI, TGI, Custom)
- **Name search**: Search for specific models
- **Limit selector**: Choose how many models to display per page

### Sorting
Click any column header to sort by:
- Model name
- Template type
- Input/Output price
- Invocation count (popularity)
- GPU types
- Status (Active/Inactive)
- Hot/Cold

### Pagination
- Navigate through pages of models
- See total count and current page
- Adjustable results per page

## Model Types Explained

### VLLM Models
Text generation models (LLMs like GPT, DeepSeek, LLaMA, etc.)

### ComfyUI Models
Image and video generation models (Stable Diffusion, etc.)

### TGI Models
Text Generation Inference models

### Custom Models
Special purpose or custom deployment models

## Pricing Information

Prices are shown per million tokens:
- **Input Price**: Cost for prompt tokens
- **Output Price**: Cost for generated tokens

## Status Indicators

- **Active** (green): Model is running and verified
- **Inactive** (red): Model is not currently available
- **Hot** (orange, pulsing): Pre-warmed for instant response
- **Cold** (gray): Needs to warm up when invoked

## Troubleshooting

### "Failed to load model information"
1. Check that your API key is correct in `.env`
2. Make sure the server is running
3. Check the terminal for error messages

### "CHUTES_API_KEY is not set"
You need to create a `.env` file with your API key

### Port already in use
Change the `PORT` in your `.env` file to a different number (e.g., 3001)
