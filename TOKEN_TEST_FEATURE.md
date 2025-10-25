# Token Test Feature

## Overview
The "Run Token Test" feature allows you to test AI models with large token inputs that approach their maximum context length. This is useful for testing model performance and reliability with near-maximum context sizes.

## How It Works

### 1. Token File Selection
The system automatically selects the appropriate token file based on each model's published maximum input context:

- **Models with 256k context** (262,144 tokens) → Uses `tokens_250,000.txt` (250,041 tokens)
- **Models with 128k context** (131,072 tokens) → Uses `tokens_125,000.txt` (125,044 tokens)
- **Models with 64k context** (65,536 tokens) → Uses `tokens_61,000.txt` (61,044 tokens)
- **Models with smaller contexts** → Uses `tokens_14,000.txt` (14,041 tokens)

The system always selects the largest token file that is smaller than the model's max input context.

### 2. Available Token Files
Located in: `bigtokens/generated_tokens/`

| File | Target Tokens | Actual Tokens | File Size |
|------|--------------|---------------|-----------|
| `tokens_250,000.txt` | 250,000 | 250,041 | 1,293.1 KB |
| `tokens_125,000.txt` | 125,000 | 125,044 | 646.7 KB |
| `tokens_61,000.txt` | 61,000 | 61,044 | 315.7 KB |
| `tokens_32,000.txt` | 32,000 | 32,044 | 165.7 KB |
| `tokens_30,000.txt` | 30,000 | 30,041 | 155.4 KB |
| `tokens_14,000.txt` | 14,000 | 14,041 | 72.6 KB |
| `tokens_8,000.txt` | 8,000 | 8,044 | 41.6 KB |
| `tokens_7,000.txt` | 7,000 | 7,041 | 36.4 KB |

### 3. Usage

1. **Select Models**: Use checkboxes to select models you want to test (VLLM and TGI models only)
2. **Click "Run Token Test"**: The button will be enabled when models are selected
3. **View Results**: Results show:
   - Model name
   - Test status (success/error)
   - Response latency
   - Token file used
   - Model's max input context
   - Token usage (input/output/total)
   - Model response

### 4. Differences from "Run Test"

| Feature | Run Test | Run Token Test |
|---------|----------|----------------|
| Input Source | Text prompt from textbox | Large token file |
| Input Size | Small (~10-100 tokens) | Near-max context (7k-250k tokens) |
| Purpose | Quick functionality test | Stress test with large context |
| Test Duration | Fast (seconds) | Slower (depends on model and size) |

## Implementation Details

### Server Endpoints

#### `GET /api/token-files`
Returns list of available token files with metadata:
```json
{
  "files": [
    {
      "filename": "tokens_250,000.txt",
      "tokenCount": 250000,
      "path": "/api/token-files/tokens_250,000.txt"
    }
  ]
}
```

#### `GET /api/token-files/:filename`
Serves the actual token file content for testing.

### Client-Side Logic

1. **Token File Selection Algorithm**:
   ```javascript
   function selectTokenFile(inputContext) {
     // Find largest file smaller than input context
     const suitableFiles = availableTokenFiles.filter(f => f.tokenCount < inputContext);
     return suitableFiles[suitableFiles.length - 1];
   }
   ```

2. **Test Process**:
   - Fetch model's input context from v1 API data
   - Select appropriate token file
   - Load token file content
   - Send to model via chat completion API
   - Display results with timing and token usage

## Creating Additional Token Files

To create more token files for different sizes:

```bash
cd bigtokens
python simple_token_generator.py 500k  # For 500k tokens
python simple_token_generator.py 128k  # For 128k tokens
```

The generator will create files in `bigtokens/generated_tokens/` directory.

## Benefits

1. **Stress Testing**: Test models at their limits to see how they handle large contexts
2. **Performance Comparison**: Compare latency across models with similar large inputs
3. **Reliability Testing**: Identify models that fail with large contexts
4. **Real-World Simulation**: Test with realistic large document scenarios
5. **Context Window Verification**: Verify that models truly support their advertised context length

## Limitations

- Only works with text generation models (VLLM and TGI templates)
- Token files must be smaller than model's max context
- Large context tests may take longer and cost more API credits
- Some models may timeout or fail with very large contexts

## Future Enhancements

- [ ] Add progress indicator for individual model tests
- [ ] Allow custom token file upload
- [ ] Add batch testing with different token sizes
- [ ] Export test results to CSV/JSON
- [ ] Add cost estimation before running tests
- [ ] Support for streaming responses
