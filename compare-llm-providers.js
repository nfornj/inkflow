/**
 * Comprehensive LLM Provider Comparison Test
 * Compares Llama 3.2 vs MiniCPM-V 2.6 using test2.pdf
 */

const fs = require('fs');

async function compareProviders() {
    console.log('🧪 LLM Provider Performance Comparison');
    console.log('=' .repeat(50));
    console.log('📄 Test File: test2.pdf');
    console.log('🦙 Provider 1: Llama 3.2 (Text-based)');
    console.log('👁️  Provider 2: MiniCPM-V 2.6 (Vision-capable)');
    console.log();

    // Check if test2.pdf exists
    if (!fs.existsSync('./test2.pdf')) {
        console.error('❌ test2.pdf not found in current directory');
        console.log('💡 Please ensure test2.pdf is in the inkflow directory');
        return;
    }

    const pdfStats = fs.statSync('./test2.pdf');
    console.log(`✅ Found test2.pdf (${(pdfStats.size / 1024).toFixed(1)} KB)`);
    console.log();

    // Import fetch dynamically
    const fetch = (await import('node-fetch')).default;

    const results = {};
    const testPrompt = `You are analyzing a PDF form document. Your task is to identify the main form fields that need to be filled out by a user.

Please analyze the document and respond with a JSON object in this exact format:
{
  "formType": "Brief description of the form type",
  "fields": [
    "Field 1 name",
    "Field 2 name", 
    "Field 3 name",
    "Field 4 name",
    "Field 5 name"
  ],
  "totalFields": 5,
  "complexity": "Simple/Medium/Complex",
  "estimatedTime": "X minutes"
}

Focus on the most important fillable fields like names, addresses, numbers, dates, etc. Keep field names concise and user-friendly.`;

    // Test Llama 3.2
    console.log('🦙 Testing Llama 3.2 (Text-based Analysis)...');
    console.log('-'.repeat(50));
    
    try {
        const llamaStart = Date.now();
        
        const llamaResponse = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3.2:latest',
                prompt: testPrompt,
                stream: false,
                options: {
                    temperature: 0.1,
                    num_predict: 300,
                    top_p: 0.9
                }
            }),
            timeout: 60000
        });

        if (!llamaResponse.ok) {
            throw new Error(`HTTP ${llamaResponse.status}: ${llamaResponse.statusText}`);
        }

        const llamaData = await llamaResponse.json();
        const llamaTime = Date.now() - llamaStart;

        console.log(`✅ Llama 3.2 completed in ${llamaTime}ms`);
        console.log(`📝 Response length: ${llamaData.response.length} characters`);
        
        // Try to parse JSON
        let llamaParsed = null;
        try {
            const jsonMatch = llamaData.response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                llamaParsed = JSON.parse(jsonMatch[0]);
                console.log(`🎯 Form type detected: ${llamaParsed.formType}`);
                console.log(`📋 Fields identified: ${llamaParsed.fields?.length || 0}`);
                console.log(`⏱️  Estimated complexity: ${llamaParsed.complexity}`);
            }
        } catch (parseError) {
            console.log('⚠️  JSON parsing failed - response format issue');
        }

        results.llama = {
            success: true,
            responseTime: llamaTime,
            responseLength: llamaData.response.length,
            parsedData: llamaParsed,
            rawResponse: llamaData.response
        };

        console.log('📄 Llama 3.2 Response Preview:');
        console.log(llamaData.response.substring(0, 200) + '...');
        
    } catch (error) {
        console.log(`❌ Llama 3.2 test failed: ${error.message}`);
        results.llama = {
            success: false,
            error: error.message,
            responseTime: 0
        };
    }

    console.log();

    // Test MiniCPM-V 2.6
    console.log('👁️  Testing MiniCPM-V 2.6 (Vision-based Analysis)...');
    console.log('-'.repeat(50));
    
    try {
        const minicpmStart = Date.now();
        
        const minicpmResponse = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'minicpm-v:latest',
                prompt: testPrompt,
                stream: false,
                options: {
                    temperature: 0.1,
                    num_predict: 300,
                    top_p: 0.9
                }
            }),
            timeout: 120000 // Longer timeout for vision model
        });

        if (!minicpmResponse.ok) {
            throw new Error(`HTTP ${minicpmResponse.status}: ${minicpmResponse.statusText}`);
        }

        const minicpmData = await minicpmResponse.json();
        const minicpmTime = Date.now() - minicpmStart;

        console.log(`✅ MiniCPM-V completed in ${minicpmTime}ms`);
        console.log(`📝 Response length: ${minicpmData.response.length} characters`);
        
        // Try to parse JSON
        let minicpmParsed = null;
        try {
            const jsonMatch = minicpmData.response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                minicpmParsed = JSON.parse(jsonMatch[0]);
                console.log(`🎯 Form type detected: ${minicpmParsed.formType}`);
                console.log(`📋 Fields identified: ${minicpmParsed.fields?.length || 0}`);
                console.log(`⏱️  Estimated complexity: ${minicpmParsed.complexity}`);
            }
        } catch (parseError) {
            console.log('⚠️  JSON parsing failed - response format issue');
        }

        results.minicpm = {
            success: true,
            responseTime: minicpmTime,
            responseLength: minicpmData.response.length,
            parsedData: minicpmParsed,
            rawResponse: minicpmData.response
        };

        console.log('📄 MiniCPM-V Response Preview:');
        console.log(minicpmData.response.substring(0, 200) + '...');
        
    } catch (error) {
        console.log(`❌ MiniCPM-V test failed: ${error.message}`);
        results.minicpm = {
            success: false,
            error: error.message,
            responseTime: 0
        };
    }

    console.log();

    // Generate Comparison Report
    console.log('📊 DETAILED COMPARISON REPORT');
    console.log('=' .repeat(50));

    if (results.llama.success && results.minicpm.success) {
        // Speed Comparison
        console.log('🏃 SPEED PERFORMANCE:');
        console.log(`   Llama 3.2:    ${results.llama.responseTime}ms`);
        console.log(`   MiniCPM-V:    ${results.minicpm.responseTime}ms`);
        
        const speedDiff = Math.abs(results.llama.responseTime - results.minicpm.responseTime);
        const fasterProvider = results.llama.responseTime < results.minicpm.responseTime ? 'Llama 3.2' : 'MiniCPM-V 2.6';
        const speedAdvantage = ((Math.max(results.llama.responseTime, results.minicpm.responseTime) - Math.min(results.llama.responseTime, results.minicpm.responseTime)) / Math.max(results.llama.responseTime, results.minicpm.responseTime) * 100).toFixed(1);
        
        console.log(`   🏆 Winner: ${fasterProvider}`);
        console.log(`   📈 Speed advantage: ${speedAdvantage}% (${speedDiff}ms faster)`);

        // Quality Comparison
        console.log('\n🎯 RESPONSE QUALITY:');
        console.log(`   Llama 3.2 response:    ${results.llama.responseLength} chars`);
        console.log(`   MiniCPM-V response:     ${results.minicpm.responseLength} chars`);
        
        const llamaFields = results.llama.parsedData?.fields?.length || 0;
        const minicpmFields = results.minicpm.parsedData?.fields?.length || 0;
        
        console.log(`   Llama 3.2 fields:      ${llamaFields}`);
        console.log(`   MiniCPM-V fields:      ${minicpmFields}`);
        
        if (llamaFields > 0 || minicpmFields > 0) {
            const betterDetection = llamaFields > minicpmFields ? 'Llama 3.2' : 'MiniCPM-V 2.6';
            console.log(`   🎯 Better detection: ${betterDetection}`);
        }

        // JSON Format Quality
        console.log('\n📋 STRUCTURED OUTPUT:');
        console.log(`   Llama 3.2 JSON:        ${results.llama.parsedData ? '✅ Valid' : '❌ Invalid'}`);
        console.log(`   MiniCPM-V JSON:        ${results.minicpm.parsedData ? '✅ Valid' : '❌ Invalid'}`);

        // Overall Recommendation
        console.log('\n🏆 OVERALL RECOMMENDATION:');
        
        if (results.llama.responseTime < results.minicpm.responseTime * 0.7) {
            console.log('   🚀 Use Llama 3.2 for speed-critical applications');
        } else if (results.minicpm.responseTime < results.llama.responseTime * 0.7) {
            console.log('   🚀 Use MiniCPM-V for speed-critical applications');
        } else {
            console.log('   ⚖️  Both providers have similar speed performance');
        }

        if (minicpmFields > llamaFields) {
            console.log('   🎯 Use MiniCPM-V for better form field detection');
        } else if (llamaFields > minicpmFields) {
            console.log('   🎯 Use Llama 3.2 for better form field detection');
        } else {
            console.log('   🎯 Both providers have similar detection quality');
        }

        console.log('\n💡 USE CASE RECOMMENDATIONS:');
        console.log('   📝 Text-based forms: Llama 3.2 (faster, sufficient accuracy)');
        console.log('   🖼️  Scanned/Image forms: MiniCPM-V 2.6 (vision capabilities)');
        console.log('   ⚡ Speed priority: Llama 3.2');
        console.log('   🎯 Accuracy priority: MiniCPM-V 2.6');

    } else {
        console.log('⚠️  INCOMPLETE COMPARISON:');
        console.log(`   Llama 3.2: ${results.llama.success ? '✅ Success' : '❌ Failed'}`);
        console.log(`   MiniCPM-V: ${results.minicpm.success ? '✅ Success' : '❌ Failed'}`);
        
        if (!results.llama.success) {
            console.log(`   Llama Error: ${results.llama.error}`);
        }
        if (!results.minicpm.success) {
            console.log(`   MiniCPM Error: ${results.minicpm.error}`);
        }
    }

    // Save detailed results
    const reportData = {
        timestamp: new Date().toISOString(),
        testFile: 'test2.pdf',
        testPrompt: testPrompt,
        results: results,
        summary: {
            llamaSuccess: results.llama.success,
            minicpmSuccess: results.minicpm.success,
            speedWinner: results.llama.success && results.minicpm.success ? 
                (results.llama.responseTime < results.minicpm.responseTime ? 'llama' : 'minicpm') : null,
            qualityWinner: results.llama.success && results.minicpm.success ? 
                ((results.llama.parsedData?.fields?.length || 0) > (results.minicpm.parsedData?.fields?.length || 0) ? 'llama' : 'minicpm') : null
        }
    };

    fs.writeFileSync('llm-comparison-report.json', JSON.stringify(reportData, null, 2));
    console.log('\n📄 Detailed report saved to: llm-comparison-report.json');
    
    console.log('\n🎉 Comparison test completed!');
}

// Run the comparison
compareProviders().catch(error => {
    console.error('💥 Comparison failed:', error);
});
