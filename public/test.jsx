import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

function ModelTester() {
    const [testPrompt, setTestPrompt] = useState('What is the capital of France? Answer in one sentence.');
    const [modelResults, setModelResults] = useState({});
    const [testing, setTesting] = useState(false);
    const [allModels, setAllModels] = useState([]);
    const [selectedModels, setSelectedModels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch models on load
    useEffect(() => {
        fetchModels();
    }, []);

    async function fetchModels() {
        try {
            setLoading(true);
            const response = await fetch('/api/models?limit=1000&include_public=true');
            const data = await response.json();
            
            // Only show text generation models (VLLM, TGI templates)
            const textModels = (data.items || [])
                .filter(m => m.standard_template === 'vllm' || m.standard_template === 'tgi')
                .filter(m => m.name) // Must have a name
                .map(m => ({
                    name: m.name,
                    id: m.name,
                    url: m.chute_id ? `https://chutes.ai/app/chute/${m.chute_id}` : '#',
                    invocations: m.invocation_count || 0,
                    hot: m.hot || false
                }))
                .sort((a, b) => b.invocations - a.invocations); // Sort by popularity
            
            setAllModels(textModels);
            // Auto-select top 10 by default
            setSelectedModels(textModels.slice(0, 10).map(m => m.id));
            setLoading(false);
        } catch (error) {
            console.error('Error fetching models:', error);
            setLoading(false);
        }
    }

    async function testModel(model) {
        const startTime = performance.now();
        
        try {
            const response = await fetch('/api/test-model', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model.id,
                    prompt: testPrompt,
                    temperature: 0.7,
                    max_tokens: 100
                })
            });

            const endTime = performance.now();
            const latency = Math.round(endTime - startTime);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const responseText = data.choices?.[0]?.message?.content?.trim() || '';

            return {
                status: 'success',
                latency,
                response: responseText || '(Empty response)',
                error: null
            };
        } catch (error) {
            const endTime = performance.now();
            const latency = Math.round(endTime - startTime);
            
            return {
                status: 'error',
                latency,
                response: '',
                error: error.message
            };
        }
    }

    async function runTests() {
        if (!testPrompt.trim()) {
            alert('Please enter a test prompt');
            return;
        }

        if (selectedModels.length === 0) {
            alert('Please select at least one model to test');
            return;
        }

        setTesting(true);
        setModelResults({});

        const modelsToTest = allModels.filter(m => selectedModels.includes(m.id));

        // Test models sequentially to avoid rate limiting
        for (const model of modelsToTest) {
            setModelResults(prev => ({
                ...prev,
                [model.id]: { status: 'testing', latency: null, response: '', error: null }
            }));

            const result = await testModel(model);
            
            setModelResults(prev => ({
                ...prev,
                [model.id]: result
            }));

            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        setTesting(false);
    }

    function toggleModel(modelId) {
        setSelectedModels(prev => {
            if (prev.includes(modelId)) {
                return prev.filter(id => id !== modelId);
            } else {
                return [...prev, modelId];
            }
        });
    }

    function selectTop(count) {
        setSelectedModels(allModels.slice(0, count).map(m => m.id));
    }

    function clearSelection() {
        setSelectedModels([]);
    }

    const filteredModels = allModels.filter(m => 
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const modelsToDisplay = allModels.filter(m => selectedModels.includes(m.id));

    const completedTests = Object.values(modelResults).filter(r => r.status === 'success' || r.status === 'error').length;
    const successfulTests = Object.values(modelResults).filter(r => r.status === 'success').length;
    const failedTests = Object.values(modelResults).filter(r => r.status === 'error').length;
    const avgLatency = successfulTests > 0 
        ? Math.round(Object.values(modelResults).filter(r => r.status === 'success').reduce((sum, r) => sum + r.latency, 0) / successfulTests)
        : 0;

    if (loading) {
        return (
            <div className="test-container">
                <div className="test-header">
                    <h1>🚀 Chutes AI Model Latency Tester</h1>
                    <p>Loading models...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="test-container">
            <div className="test-header">
                <h1>🚀 Chutes AI Model Latency Tester</h1>
                <p>Select models to test for response time and reliability</p>
            </div>

            <div className="test-controls">
                <div className="control-row">
                    <div className="control-field" style={{ flex: 1 }}>
                        <label htmlFor="modelSearch">Search Models ({allModels.length} available)</label>
                        <input
                            id="modelSearch"
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by name..."
                        />
                    </div>
                    <div className="control-field" style={{ flex: 0, minWidth: 'auto' }}>
                        <label>&nbsp;</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => selectTop(10)} className="test-button" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
                                Top 10
                            </button>
                            <button onClick={() => selectTop(20)} className="test-button" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
                                Top 20
                            </button>
                            <button onClick={clearSelection} className="test-button" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
                                Clear
                            </button>
                        </div>
                    </div>
                </div>

                <div className="control-row">
                    <div className="control-field">
                        <label>Selected Models ({selectedModels.length})</label>
                        <div style={{ 
                            maxHeight: '150px', 
                            overflowY: 'auto', 
                            padding: '8px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '8px'
                        }}>
                            {filteredModels.length === 0 ? (
                                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                                    No models found
                                </div>
                            ) : (
                                filteredModels.slice(0, 50).map(model => (
                                    <label 
                                        key={model.id}
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '8px',
                                            padding: '4px',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedModels.includes(model.id)}
                                            onChange={() => toggleModel(model.id)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        <span>{model.name}</span>
                                        {model.hot && <span style={{ fontSize: '0.7rem' }}>🔥</span>}
                                    </label>
                                ))
                            )}
                            {filteredModels.length > 50 && (
                                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>
                                    Showing 50 of {filteredModels.length} models. Use search to narrow down.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="control-row">
                    <div className="control-field" style={{ flex: 2 }}>
                        <label htmlFor="testPrompt">Test Prompt</label>
                        <textarea
                            id="testPrompt"
                            value={testPrompt}
                            onChange={(e) => setTestPrompt(e.target.value)}
                            placeholder="Enter your test prompt..."
                        />
                    </div>
                </div>
                
                <div className="control-row">
                    <button onClick={runTests} disabled={testing || selectedModels.length === 0} className="test-button">
                        {testing ? `Testing ${completedTests}/${selectedModels.length}...` : `Run Tests (${selectedModels.length} models)`}
                    </button>
                </div>
            </div>

            {completedTests > 0 && (
                <div className="summary-section">
                    <h2>Summary</h2>
                    <div className="summary-grid">
                        <div className="summary-stat">
                            <span className="summary-stat-label">Completed</span>
                            <span className="summary-stat-value">{completedTests}/{MODELS.length}</span>
                        </div>
                        <div className="summary-stat">
                            <span className="summary-stat-label">Successful</span>
                            <span className="summary-stat-value" style={{ color: 'var(--color-status-active)' }}>
                                {successfulTests}
                            </span>
                        </div>
                        <div className="summary-stat">
                            <span className="summary-stat-label">Failed</span>
                            <span className="summary-stat-value" style={{ color: 'var(--color-status-inactive)' }}>
                                {failedTests}
                            </span>
                        </div>
                        <div className="summary-stat">
                            <span className="summary-stat-label">Avg Latency</span>
                            <span className="summary-stat-value">{avgLatency}ms</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="models-grid">
                {allModels.filter(m => selectedModels.includes(m.id)).map((model) => {
                    const result = modelResults[model.id] || { status: 'pending' };
                    
                    return (
                        <div key={model.id} className={`model-test-card ${result.status}`}>
                            <div className="model-card-header">
                                <div className="model-card-name">{model.name}</div>
                                <div className="model-card-meta">
                                    {model.hot && <span style={{ fontSize: '0.8rem' }}>🔥</span>}
                                    {model.template_name && (
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                            {model.template_name}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className={`status-badge ${result.status}`}>
                                {result.status === 'testing' && <span className="spinner"></span>}
                                {result.status === 'pending' && '⏳ Pending'}
                                {result.status === 'testing' && 'Testing...'}
                                {result.status === 'success' && '✅ Success'}
                                {result.status === 'error' && '❌ Error'}
                            </div>

                            {result.latency !== null && (
                                <div className="latency-display">{result.latency}ms</div>
                            )}

                            {result.error && (
                                <div className="error-text">Error: {result.error}</div>
                            )}

                            {result.response && (
                                <div className="response-container">{result.response}</div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ModelTester />);
