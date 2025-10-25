# Token File Selection Guide

## 🎯 How Token Files Are Selected

The system automatically selects the largest token file that fits within the model's context limit **while leaving room for output tokens**.

### Formula:
```
Max Input Tokens = Model Context Length - 20,000 (reserved for output)
Selected File = Largest file where tokens < Max Input Tokens
```

## 📊 Available Token Files

| File Name | Token Count | File Size | Best For |
|-----------|-------------|-----------|----------|
| `tokens_7,000.txt` | 7,041 | 36 KB | 8k-16k context models |
| `tokens_8,000.txt` | 8,044 | 41 KB | 16k context models |
| `tokens_14,000.txt` | 14,041 | 72 KB | 32k context models |
| `tokens_30,000.txt` | 30,041 | 155 KB | 32k-64k context models |
| `tokens_32,000.txt` | 32,044 | 165 KB | 64k context models |
| `tokens_50,000.txt` | 50,035 | 258 KB | 64k-128k context models |
| `tokens_61,000.txt` | 61,044 | 315 KB | 128k context models |
| `tokens_90,000.txt` | 90,035 | 465 KB | 128k context models |
| `tokens_125,000.txt` | 125,044 | 646 KB | 128k-256k context models |
| `tokens_210,000.txt` | 210,041 | 1,086 KB | 256k+ context models |
| `tokens_250,000.txt` | 250,041 | 1,293 KB | Reserved/future use |

## 🔄 Context Length to Token File Mapping

### Common Model Sizes:

#### 8k Context (8,192 tokens)
- Max Input: ~8k - 20k = **Can't fit** (will use smallest: 7k file)
- **Selected File**: `tokens_7,000.txt`

#### 16k Context (16,384 tokens)
- Max Input: 16k - 20k = **Can't fit** (will use: 7k or 8k file)
- **Selected File**: `tokens_8,000.txt`

#### 32k Context (32,768 tokens)
- Max Input: 32k - 20k = **12k tokens**
- **Selected File**: `tokens_8,000.txt`

#### 64k Context (65,536 tokens)
- Max Input: 64k - 20k = **44k tokens**
- **Selected File**: `tokens_32,000.txt`

#### 128k Context (131,072 tokens)
- Max Input: 128k - 20k = **108k tokens**
- **Selected File**: `tokens_90,000.txt`

#### 256k Context (262,144 tokens)
- Max Input: 256k - 20k = **242k tokens**
- **Selected File**: `tokens_210,000.txt` ✅

#### 512k Context (524,288 tokens)
- Max Input: 512k - 20k = **492k tokens**
- **Selected File**: `tokens_250,000.txt` (largest available)

## ⚠️ Why 20k Reserved Tokens?

When testing models, we need to account for:

1. **Output tokens** (`max_tokens` parameter): Default 1,000 tokens
2. **Safety buffer**: Extra space for tokenization differences
3. **API overhead**: Some models add system tokens

**Total Reserved**: 20,000 tokens (conservative estimate)

## 🛠️ Creating Custom Token Files

To create additional token files for specific needs:

```bash
cd bigtokens

# For specific sizes
python simple_token_generator.py 100k 150k 200k

# Examples
python simple_token_generator.py 40k    # For 64k models
python simple_token_generator.py 180k   # Alternative for 256k models
python simple_token_generator.py 400k   # For future 512k+ models
```

## 📈 Recommended Token Files by Use Case

### Quick Testing (Fast, Low Cost)
- Use: `tokens_7,000.txt` to `tokens_14,000.txt`
- Speed: 1-5 seconds per test
- Good for: Functionality checks

### Standard Testing (Balanced)
- Use: `tokens_30,000.txt` to `tokens_90,000.txt`
- Speed: 5-15 seconds per test
- Good for: Performance comparison

### Stress Testing (Slow, High Cost)
- Use: `tokens_125,000.txt` to `tokens_210,000.txt`
- Speed: 15-60+ seconds per test
- Good for: Maximum capacity testing

## 🔍 Example Selection Process

### Example 1: Qwen3-Coder (256k context)
```
Model Context: 262,144 tokens
Reserved: 20,000 tokens
Max Input: 242,144 tokens

Available files under 242k:
- tokens_210,000.txt (210k) ✅ SELECTED
- tokens_125,000.txt (125k)
- tokens_90,000.txt (90k)
- ... smaller files ...

Result: Uses tokens_210,000.txt
```

### Example 2: Llama 3 8B (8k context)
```
Model Context: 8,192 tokens
Reserved: 20,000 tokens
Max Input: -11,808 tokens (negative!)

Available files under -11k:
- NONE

Fallback: Uses smallest available
Result: Uses tokens_7,000.txt
```

### Example 3: GPT-4 Turbo (128k context)
```
Model Context: 131,072 tokens
Reserved: 20,000 tokens
Max Input: 111,072 tokens

Available files under 111k:
- tokens_90,000.txt (90k) ✅ SELECTED
- tokens_61,000.txt (61k)
- tokens_50,000.txt (50k)
- ... smaller files ...

Result: Uses tokens_90,000.txt
```

## 💡 Tips

1. **For 256k models**: Use `tokens_210,000.txt` (not 250k - it's too close to limit)
2. **For 128k models**: Use `tokens_90,000.txt` or `tokens_125,000.txt`
3. **For 64k models**: Use `tokens_50,000.txt` or `tokens_61,000.txt`
4. **For small models**: System automatically picks smallest available file

## 🐛 Troubleshooting

### Error: "Requested token count exceeds maximum context length"
**Cause**: Token file + output tokens > model context
**Fix**: 
- System now reserves 20k tokens automatically
- Use smaller `max_tokens` (default: 1,000)
- Verify correct token file selected

### Error: "No suitable token file found"
**Cause**: Model context info missing from API
**Fix**: Create smaller token files or skip that model

### Tests taking too long
**Cause**: Large token files (100k+) take time to process
**Expected**: 
- 210k tokens: 30-60 seconds
- 125k tokens: 20-40 seconds
- 90k tokens: 15-30 seconds
