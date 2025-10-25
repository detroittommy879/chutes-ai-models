# Token Test Feature - Quick Start Guide

## 🎯 What Is This?

The **Token Test** feature tests AI models with LARGE inputs (thousands to hundreds of thousands of tokens) to see how they perform when pushed to their limits.

## 🚀 How to Use

### Step 1: Load the App
```bash
cd "C:\2nd\Main\Git-Projects\z_aiimage\chutes-models-enhanced - Copy"
node server.js
```

Open: http://localhost:3888

### Step 2: Select Models
- Scroll down to the model table
- Check the boxes next to models you want to test
- (Only VLLM and TGI models will be tested)

### Step 3: Run Token Test
- Click the **"Run Token Test"** button (orange/accent colored)
- Wait for tests to complete
- View results below

## 📊 What You'll See

### Result Display:
```
✅ SUCCESS                    1234ms
📄 Token Test: Used tokens_250,000.txt | Model Context: 262,144
Token Usage: Input: 250041 | Output: 42 | Total: 250083
Response: [Model's output here]
```

### For Each Model:
- ✅ or ❌ Status
- Response time in milliseconds
- Token file used (automatically selected)
- Model's max input context
- Actual token usage (input/output/total)
- Response preview

## 🎯 Token File Selection Logic

The app automatically picks the right size file:

```
Model Context     →  Token File Used
256k (262,144)   →  tokens_250,000.txt (250k tokens)
128k (131,072)   →  tokens_125,000.txt (125k tokens)
64k (65,536)     →  tokens_61,000.txt  (61k tokens)
32k (32,768)     →  tokens_30,000.txt  (30k tokens)
16k (16,384)     →  tokens_14,000.txt  (14k tokens)
8k (8,192)       →  tokens_7,000.txt   (7k tokens)
```

**Rule**: Always use the **largest token file that's smaller** than the model's max context.

## 🔍 Examples

### Example 1: Testing GPT-4 Class Model
- Model: `gpt-4-turbo` (128k context)
- Selected File: `tokens_125,000.txt` (125k tokens)
- Result: Shows how fast it processes ~125k tokens

### Example 2: Testing Smaller Model  
- Model: `llama-3-8b` (8k context)
- Selected File: `tokens_7,000.txt` (7k tokens)
- Result: Tests performance near its limit

## ⚡ Regular Test vs Token Test

### Regular Test Button (Blue)
- Uses text from the prompt box
- Small input (~10-100 tokens)
- Quick test (1-5 seconds)
- **Use for**: Quick checks

### Token Test Button (Orange)
- Uses large token files
- Large input (7k-250k tokens)
- Slower test (10-60+ seconds)
- **Use for**: Stress testing, performance benchmarks

## 💡 Pro Tips

1. **Start Small**: Test with 1-2 models first
2. **Check Context**: Models with larger contexts = longer tests
3. **Monitor Console**: Look for log messages in browser DevTools
4. **Be Patient**: Large context tests take time
5. **Watch Costs**: Large context tests use more API credits

## 🐛 Troubleshooting

### "No suitable token file found"
- Model doesn't have context length info
- Need to create smaller token files

### "Model has no input context information"
- Model data missing from v1 API
- Try selecting a different model

### Tests taking too long
- Normal for large contexts (250k tokens can take 30-60+ seconds)
- Check server logs for progress

### Button disabled
- Select at least one VLLM or TGI model
- Wait for models to finish loading

## 📁 Token Files Location

```
bigtokens/generated_tokens/
├── tokens_7,000.txt      (7k tokens,  36 KB)
├── tokens_8,000.txt      (8k tokens,  41 KB)
├── tokens_14,000.txt     (14k tokens, 72 KB)
├── tokens_30,000.txt     (30k tokens, 155 KB)
├── tokens_32,000.txt     (32k tokens, 165 KB)
├── tokens_61,000.txt     (61k tokens, 315 KB)
├── tokens_125,000.txt    (125k tokens, 646 KB)
└── tokens_250,000.txt    (250k tokens, 1.2 MB)
```

## 🎓 Use Cases

### 1. Performance Testing
Test how different models handle large contexts:
```
Model A: 250k tokens → 15,234ms ✅
Model B: 250k tokens → 45,678ms ✅
Model C: 250k tokens → TIMEOUT ❌
```

### 2. Cost Analysis
Compare token usage across models:
```
Model A: 250k input → 100 output tokens
Model B: 250k input → 500 output tokens
```

### 3. Reliability Testing
Find models that fail with large contexts:
```
Model A: ✅ Handles 250k
Model B: ❌ Fails at 125k
Model C: ✅ Handles 250k
```

### 4. Production Readiness
Before using a model in production:
```
✅ Test with expected input size
✅ Verify response quality
✅ Check latency acceptability
✅ Confirm cost per request
```

## 🔄 Workflow Example

1. **Select 5 models** with 256k context
2. **Click "Run Token Test"**
3. **Watch progress**: Each model tested sequentially
4. **Review results**: Compare latency and reliability
5. **Choose best model** based on speed + reliability + cost

## 📈 Interpreting Results

### Good Result:
```
✅ SUCCESS                    8,456ms
Input: 125,044 | Output: 156 | Total: 125,200
Response: [Coherent output]
```
→ Model handled large context well!

### Concerning Result:
```
❌ ERROR                     45,678ms
Error: Request timeout
```
→ Model struggled with large context

### Mediocre Result:
```
✅ SUCCESS                    35,234ms
Input: 125,044 | Output: 12 | Total: 125,056
Response: I cannot process this request.
```
→ Model processed but didn't handle content properly

## 🎉 You're Ready!

Start testing your models with large contexts and see which ones perform best under pressure!
