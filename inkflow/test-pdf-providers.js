/**
 * Simple PDF Provider Performance Test
 * Tests both Llama 3.2 and MiniCPM-V 2.6 with test2.pdf
 */

const fs = require('fs');
const LLMProviderManager = require('./src/main/llm-provider-manager');
const LlamaProvider = require('./src/main/llm-providers/llama-provider');
const MiniCPMProvider = require('./src/main/llm-providers/minicpm-provider');

async function testProviders() {
    console.log('🧪 Testing LLM Providers with test2.pdf\n');
    
    // Check if test2.pdf exists
    if (!fs.existsSync('./test2.pdf')) {
        console.error('❌ test2.pdf not found in current directory');
        return;
    }
    
    // Load PDF
    console.log('📄 Loading test2.pdf...');
    const pdfBuffer = fs.readFileSync('./test2.pdf');
    const pdfBytes = new Uint8Array(pdfBuffer);
    console.log(`✅ Loaded PDF: ${pdfBytes.length} bytes\n`);
    
    // Initialize provider manager
    const providerManager = new LLMProviderManager();
    const llamaProvider = new LlamaProvider();
    const minicpmProvider = new MiniCPMProvider();
    
    providerManager.registerProvider('llama', llamaProvider);
    providerManager.registerProvider('minicpm', minicpmProvider);
    
    const results = {};
    
    // Test each provider
    for (const providerId of ['llama', 'minicpm']) {
        console.log(`🔄 Testing ${providerId.toUpperCase()} Provider...`);
        
        try {
            // Check availability
            const provider = providerId === 'llama' ? llamaProvider : minicpmProvider;
            const available = await provider.checkAvailability();
            
            if (!available) {
                console.log(`   ❌ ${providerId} not available`);
                results[providerId] = { available: false, error: 'Provider not available' };
                continue;
            }
            
            console.log(`   ✅ ${providerId} is available`);
            
            // Switch to provider
            await providerManager.switchProvider(providerId);
            console.log(`   🔄 Switched to ${providerId}`);
            
            // Test with simple prompt first
            console.log('   🧪 Testing basic functionality...');
            const startTime = Date.now();
            
            const testPrompt = \`Analyze this PDF form and identify the main form fields that need to be filled. 
Respond with a JSON object containing:
{
  "formType": "description of form type",
  "fields": ["field1", "field2", "field3"],
  "totalFields": number
}

Keep the response concise and focus on the most important fillable fields.\`;

            try {
                const response = await providerManager.callLLM(testPrompt, { 
                    maxTokens: 500,
                    timeout: 60000 
                });
                
                const responseTime = Date.now() - startTime;
                
                console.log(\`   ✅ Response received in \${responseTime}ms\`);
                console.log(\`   📝 Response length: \${response.length} characters\`);
                console.log(\`   📄 Response preview: \${response.substring(0, 200)}...\`);
                
                // Try to parse JSON response
                let parsedResponse = null;
                try {
                    // Look for JSON in the response
                    const jsonMatch = response.match(/\\{[\\s\\S]*\\}/);
                    if (jsonMatch) {
                        parsedResponse = JSON.parse(jsonMatch[0]);
                        console.log(\`   🎯 Detected form type: \${parsedResponse.formType || 'Unknown'}\`);
                        console.log(\`   📋 Fields found: \${parsedResponse.fields?.length || 0}\`);
                    }
                } catch (parseError) {
                    console.log('   ⚠️  Response not in valid JSON format');
                }
                
                results[providerId] = {
                    available: true,
                    success: true,
                    responseTime,
                    responseLength: response.length,
                    parsedResponse,
                    provider: provider.getDisplayName()
                };
                
            } catch (llmError) {
                console.log(\`   ❌ LLM call failed: \${llmError.message}\`);
                results[providerId] = {
                    available: true,
                    success: false,
                    error: llmError.message,
                    provider: provider.getDisplayName()
                };
            }
            
        } catch (error) {
            console.log(\`   ❌ Provider test failed: \${error.message}\`);
            results[providerId] = {
                available: false,
                success: false,
                error: error.message
            };
        }
        
        console.log();
    }
    
    // Print comparison
    console.log('📊 COMPARISON RESULTS');
    console.log('=' .repeat(50));
    
    const llamaResult = results.llama;
    const minicpmResult = results.minicpm;
    
    if (llamaResult?.success && minicpmResult?.success) {
        console.log('🏃 SPEED COMPARISON:');
        console.log(\`   Llama 3.2: \${llamaResult.responseTime}ms\`);
        console.log(\`   MiniCPM-V: \${minicpmResult.responseTime}ms\`);
        
        const speedDiff = Math.abs(llamaResult.responseTime - minicpmResult.responseTime);
        const fasterProvider = llamaResult.responseTime < minicpmResult.responseTime ? 'Llama 3.2' : 'MiniCPM-V 2.6';
        const speedAdvantage = ((Math.max(llamaResult.responseTime, minicpmResult.responseTime) - Math.min(llamaResult.responseTime, minicpmResult.responseTime)) / Math.max(llamaResult.responseTime, minicpmResult.responseTime) * 100).toFixed(1);
        
        console.log(\`   🏆 Winner: \${fasterProvider} (by \${speedDiff}ms / \${speedAdvantage}%)\`);
        
        console.log('\\n📝 RESPONSE QUALITY:');
        console.log(\`   Llama 3.2 response: \${llamaResult.responseLength} chars\`);
        console.log(\`   MiniCPM-V response: \${minicpmResult.responseLength} chars\`);
        
        if (llamaResult.parsedResponse && minicpmResult.parsedResponse) {
            console.log(\`   Llama fields detected: \${llamaResult.parsedResponse.fields?.length || 0}\`);
            console.log(\`   MiniCPM fields detected: \${minicpmResult.parsedResponse.fields?.length || 0}\`);
        }
        
    } else {
        console.log('⚠️  Unable to compare - one or both providers failed');
        console.log(\`   Llama 3.2: \${llamaResult?.success ? '✅ Success' : '❌ Failed'}\`);
        console.log(\`   MiniCPM-V: \${minicpmResult?.success ? '✅ Success' : '❌ Failed'}\`);
    }
    
    console.log('\\n💡 RECOMMENDATIONS:');
    if (llamaResult?.success && minicpmResult?.success) {
        if (llamaResult.responseTime < minicpmResult.responseTime) {
            console.log('   🚀 Use Llama 3.2 for faster response times');
        } else {
            console.log('   🚀 Use MiniCPM-V 2.6 for potentially better accuracy');
        }
    } else if (llamaResult?.success) {
        console.log('   ✅ Use Llama 3.2 (MiniCPM-V not available)');
    } else if (minicpmResult?.success) {
        console.log('   ✅ Use MiniCPM-V 2.6 (Llama 3.2 not available)');
    } else {
        console.log('   ❌ Neither provider is currently available');
    }
    
    // Save results
    const testReport = {
        timestamp: new Date().toISOString(),
        testFile: 'test2.pdf',
        results
    };
    
    fs.writeFileSync('provider-test-results.json', JSON.stringify(testReport, null, 2));
    console.log('\\n📄 Results saved to: provider-test-results.json');
}

// Run the test
testProviders().then(() => {
    console.log('\\n🎉 Testing completed!');
}).catch(error => {
    console.error('\\n💥 Test failed:', error);
});
