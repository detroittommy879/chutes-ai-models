# Persistent Cache & Verification System

## 🎯 Overview

The application now features:
1. **Persistent cache** - Never expires, shows age and date
2. **Token test results database** - Stores test results permanently
3. **Verification badges** - Shows tested models with green checkmark

## 📦 Persistent Cache System

### How It Works

#### Before (Temporary Cache):
- Cache expired after 10 minutes
- Files deleted automatically
- No offline access
- Lost on server restart

#### After (Persistent Cache):
- **Never expires** automatically
- Files kept indefinitely
- **Works offline** or when API is down
- Shows cache date and age to users

### Cache Display

When cached data is loaded, users see:

```
Cache: 10/24/2025, 3:45:23 PM
(2 hours old)
```

Age is displayed in human-readable format:
- Less than 1 minute: "30s old"
- Less than 1 hour: "45 min old"
- Less than 1 day: "5 hours old"
- 1+ days: "3 days old"

### Benefits

1. **Offline Mode**: App works even without internet
2. **API Downtime**: Users can still browse when API is down
3. **Faster Loading**: No waiting for API on every visit
4. **Historical Data**: Compare models over time
5. **Cost Savings**: Fewer API calls

## ✅ Token Test Verification System

### Storage Location

Test results stored in: `cache/token_test_results.json`

### Data Structure

```json
{
  "model-name": {
    "status": "success",
    "latency": 15234,
    "tokenFile": "tokens_210,000.txt",
    "tokenCount": 210000,
    "inputContext": 262144,
    "inputTokens": 210041,
    "outputTokens": 156,
    "totalTokens": 210197,
    "lastTested": "2025-10-24T15:45:23.456Z"
  }
}
```

### What Gets Saved

For each successful test:
- ✅ Model name
- ✅ Test status (success/error)
- ✅ Response latency (ms)
- ✅ Token file used
- ✅ Token count from file
- ✅ Model's published input context
- ✅ Actual input tokens used
- ✅ Output tokens generated
- ✅ Total tokens consumed
- ✅ Test date and time (ISO format)

### When Results Are Saved

Results are saved automatically:
1. After each successful token test
2. Only for models that complete successfully
3. Failed tests are not saved (to avoid showing false verification)

## 🏷️ Verification Badges

### Visual Indicator

Models that pass token tests show a green badge:

```
Input Ctx: 262,144 ✓ Verified
```

### Badge Tooltip

Hover over badge to see details:
```
Verified: 10/24/2025 3:45 PM
Input: 210,041 tokens
File: tokens_210,000.txt
Context: 262,144
```

### Badge Display Rules

Badge appears when:
- ✅ Model has been tested with token test
- ✅ Test completed successfully
- ✅ Test results saved to database

Badge does NOT appear when:
- ❌ Model never tested
- ❌ Test failed
- ❌ Only regular test performed (not token test)

### Styling

**Light Theme:**
- Green text (#15803d)
- Light green background (#d1fae5)
- Green border (#86efac)

**Dark Theme:**
- Light green text (#86efac)
- Semi-transparent green background
- Subtle green border

## 📊 API Endpoints

### Get Token Test Results
```http
GET /api/token-test-results
```

**Response:**
```json
{
  "model-1": { ...results... },
  "model-2": { ...results... },
  ...
}
```

### Save Token Test Result
```http
POST /api/token-test-results
Content-Type: application/json

{
  "modelName": "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8",
  "result": {
    "status": "success",
    "latency": 15234,
    "tokenFile": "tokens_210,000.txt",
    "tokenCount": 210000,
    "inputContext": 262144,
    "inputTokens": 210041,
    "outputTokens": 156,
    "totalTokens": 210197
  }
}
```

**Response:**
```json
{
  "success": true,
  "modelName": "...",
  "result": {
    ...saved result with lastTested timestamp...
  }
}
```

## 🔄 Workflow

### Initial Page Load

```
1. User visits site
2. Load cached models (shows cache date)
3. Load v1 models data
4. Load token test results
5. Display models with verification badges
```

### Running Token Tests

```
1. User selects models
2. Clicks "Run Token Test"
3. For each model:
   a. Test with appropriate token file
   b. Display result immediately
   c. If successful, save to database
4. Refresh model display
5. Verification badges now visible
```

### Subsequent Visits

```
1. User returns to site
2. Cached data loaded instantly
3. Verification badges show from previous tests
4. User can see which models were tested
5. Hover to see when they were tested
```

## 💾 File Structure

```
cache/
├── models_p0_l1000_tnull_nnull_pubtrue.json  (persistent)
├── v1_models_all.json                         (persistent)
└── token_test_results.json                    (persistent)
```

All files persist indefinitely until manually deleted.

## 🔍 Use Cases

### 1. Public Model Explorer
**Scenario**: Host publicly for others to browse models
**Benefit**: Visitors see which models are verified without testing themselves

### 2. Model Selection
**Scenario**: Choosing a model for production
**Benefit**: See which models have been stress-tested successfully

### 3. Historical Comparison
**Scenario**: Track model performance over time
**Benefit**: Compare latency/reliability from different test dates

### 4. Offline Documentation
**Scenario**: API maintenance or network issues
**Benefit**: Browse cached model data and test results

### 5. Team Collaboration
**Scenario**: Multiple team members evaluating models
**Benefit**: Share test results via the database file

## 🛠️ Maintenance

### Updating Cache Manually

To refresh cached data:
1. Click "Update Models" button
2. New data fetched from API
3. Cache updated with current timestamp
4. Old cache kept as backup

### Clearing Cache

To start fresh:
```bash
# Delete all cache files
rm cache/*.json

# Or delete specific cache
rm cache/models_p0_l1000_tnull_nnull_pubtrue.json
```

### Exporting Test Results

Test results file can be:
- Backed up: `cp cache/token_test_results.json backup/`
- Shared: Send file to team members
- Analyzed: Parse JSON for reports
- Versioned: Commit to git repository

### Resetting Verification Badges

To clear all verifications:
```bash
rm cache/token_test_results.json
```

Or edit file to remove specific models:
```json
{
  "model-to-keep": { ... },
  // Delete models you want to reset
}
```

## ⚙️ Configuration

### Cache Location
```javascript
const CACHE_DIR = path.join(__dirname, 'cache');
```

### Test Results File
```javascript
const TOKEN_TEST_RESULTS_FILE = path.join(__dirname, 'cache', 'token_test_results.json');
```

### Cache Duration (for freshness indicator)
```javascript
const CACHE_DURATION_MINUTES = 10; // Used for color coding, not deletion
```

## 🐛 Troubleshooting

### Cache shows very old date
**Normal behavior** - Cache is persistent by design
**Action**: Click "Update Models" to refresh

### Verification badges not showing
**Check**: 
1. Token test completed successfully?
2. Results saved (check console logs)?
3. Page refreshed after test?

**Fix**: Re-run token test for that model

### Test results file corrupted
**Symptom**: Errors loading results
**Fix**: 
```bash
# Backup if needed
cp cache/token_test_results.json backup.json

# Reset file
echo "{}" > cache/token_test_results.json
```

### Cache taking too much disk space
**Check size**:
```bash
du -sh cache/
```

**Clean up**:
```bash
# Keep only recent cache
find cache/ -name "*.json" -mtime +30 -delete
```

## 📈 Future Enhancements

- [ ] Add "Last updated" indicator for each model
- [ ] Export verification report as PDF/CSV
- [ ] Compare test results across dates
- [ ] Add batch re-testing for verified models
- [ ] Show verification count in stats
- [ ] Filter by verified/unverified models
- [ ] Add verification expiry (optional)
- [ ] Sync test results across deployments
- [ ] Add test notes/comments
- [ ] Track test history per model
