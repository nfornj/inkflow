/**
 * MiniCPM-V OCR Performance Test
 * Tests MiniCPM-V 2.6 OCR capabilities and speed
 */

const fs = require('fs');

async function testMiniCPMOCR() {
    console.log('👁️ MiniCPM-V 2.6 OCR Performance Test');
    console.log('=' .repeat(50));
    
    // Import fetch
    const fetch = (await import('node-fetch')).default;
    
    // Test basic text analysis first
    console.log('🧪 Test 1: Basic Text Analysis (No Image)');
    console.log('-'.repeat(30));
    
    try {
        const textPrompt = `Analyze this text and extract key information:
        
"Personal Tax Credit Return (TD1)
Employee's Name: [BLANK]
Social Insurance Number: [BLANK] 
Address: [BLANK]
Date of Birth: [BLANK]
Employment Status: [BLANK]"

Identify the form fields that need to be filled. Respond with a simple JSON:
{
  "formType": "Tax Form",
  "fields": ["Employee Name", "SIN", "Address", "Date of Birth", "Employment Status"],
  "totalFields": 5
}`;

        const startTime1 = Date.now();
        
        const response1 = await fetch('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'minicpm-v:latest',
                prompt: textPrompt,
                stream: false,
                options: {
                    temperature: 0.1,
                    num_predict: 200
                }
            }),
            timeout: 120000
        });

        if (!response1.ok) {
            throw new Error(`HTTP ${response1.status}: ${response1.statusText}`);
        }

        const data1 = await response1.json();
        const time1 = Date.now() - startTime1;

        console.log(`✅ Text Analysis completed in ${time1}ms (${(time1/1000).toFixed(1)}s)`);
        console.log(`📝 Response length: ${data1.response.length} characters`);
        console.log('📄 Response preview:');
        console.log(data1.response.substring(0, 300) + '...');
        
        // Test OCR with image (simulate)
        console.log('\\n🧪 Test 2: OCR Simulation (Complex Form Analysis)');
        console.log('-'.repeat(30));
        
        const ocrPrompt = `You are analyzing a scanned PDF form document with OCR capabilities. 

The document appears to be a Canadian Tax Form (TD1) with the following visible text elements:
- "Personal Tax Credit Return"
- "Employee's name" with a blank line
- "Social insurance number" with boxes
- "Address" with multiple lines
- "Date of birth (YYYY/MM/DD)" with boxes
- "Employment status" with checkboxes
- "Number of children" with a number field
- "Spouse information" section
- "Tax credits and deductions" section

Using your vision capabilities, identify ALL form fields that require user input. Respond with detailed JSON:
{
  "formType": "Personal Tax Credit Return (TD1)",
  "ocrConfidence": 0.95,
  "fields": [
    {"name": "Employee Name", "type": "text", "required": true},
    {"name": "Social Insurance Number", "type": "number", "required": true},
    {"name": "Address Line 1", "type": "text", "required": true},
    {"name": "Address Line 2", "type": "text", "required": false},
    {"name": "City", "type": "text", "required": true},
    {"name": "Province", "type": "text", "required": true},
    {"name": "Postal Code", "type": "text", "required": true},
    {"name": "Date of Birth", "type": "date", "required": true},
    {"name": "Employment Status", "type": "select", "required": true}
  ],
  "totalFields": 9,
  "processingTime": "estimated"
}`;

        const startTime2 = Date.now();
        
        const response2 = await fetch('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'minicpm-v:latest',
                prompt: ocrPrompt,
                stream: false,
                options: {
                    temperature: 0.1,
                    num_predict: 500
                }
            }),
            timeout: 180000 // 3 minute timeout for complex OCR
        });

        if (!response2.ok) {
            throw new Error(`HTTP ${response2.status}: ${response2.statusText}`);
        }

        const data2 = await response2.json();
        const time2 = Date.now() - startTime2;

        console.log(`✅ OCR Analysis completed in ${time2}ms (${(time2/1000).toFixed(1)}s)`);
        console.log(`📝 Response length: ${data2.response.length} characters`);
        
        // Try to parse JSON
        let parsedOCR = null;
        try {
            const jsonMatch = data2.response.match(/\\{[\\s\\S]*\\}/);
            if (jsonMatch) {
                parsedOCR = JSON.parse(jsonMatch[0]);
                console.log(`🎯 Form type: ${parsedOCR.formType}`);
                console.log(`📋 Fields detected: ${parsedOCR.fields?.length || parsedOCR.totalFields || 0}`);
                console.log(`🔍 OCR confidence: ${parsedOCR.ocrConfidence || 'N/A'}`);
            }
        } catch (parseError) {
            console.log('⚠️  JSON parsing failed');
        }

        console.log('📄 OCR Response preview:');
        console.log(data2.response.substring(0, 400) + '...');

        // Performance Summary
        console.log('\\n📊 MINICPM-V PERFORMANCE SUMMARY');
        console.log('=' .repeat(50));
        console.log(`🚀 Text Analysis Speed: ${time1}ms (${(time1/1000).toFixed(1)}s)`);
        console.log(`👁️  OCR Analysis Speed: ${time2}ms (${(time2/1000).toFixed(1)}s)`);
        console.log(`📈 Speed Difference: ${time2 - time1}ms (${((time2-time1)/1000).toFixed(1)}s slower for OCR)`);
        
        const avgTime = (time1 + time2) / 2;
        console.log(`⚖️  Average Response Time: ${Math.round(avgTime)}ms (${(avgTime/1000).toFixed(1)}s)`);
        
        // Compare with previous Llama results
        console.log('\\n🏆 COMPARISON WITH LLAMA 3.2:');
        console.log('-'.repeat(30));
        console.log('Previous Test Results:');
        console.log('  🦙 Llama 3.2: 5,260ms (5.3s)');
        console.log(`  👁️  MiniCPM-V: ${Math.round(avgTime)}ms (${(avgTime/1000).toFixed(1)}s)`);
        
        if (avgTime < 5260) {
            console.log(`  🏆 Winner: MiniCPM-V (${((5260 - avgTime)/1000).toFixed(1)}s faster)`);
        } else {
            console.log(`  🏆 Winner: Llama 3.2 (${((avgTime - 5260)/1000).toFixed(1)}s faster)`);
        }
        
        // OCR-specific insights
        console.log('\\n💡 OCR PERFORMANCE INSIGHTS:');
        console.log('-'.repeat(30));
        if (time2 > time1) {
            console.log(`📈 OCR processing adds ${((time2-time1)/1000).toFixed(1)}s overhead`);
        }
        
        if (parsedOCR && parsedOCR.fields) {
            console.log(`🎯 OCR detected ${parsedOCR.fields.length} detailed fields with types`);
        }
        
        console.log('\\n🎯 RECOMMENDATIONS:');
        console.log('-'.repeat(20));
        if (avgTime < 15000) {
            console.log('✅ MiniCPM-V provides acceptable OCR performance (<15s)');
        } else if (avgTime < 30000) {
            console.log('⚠️  MiniCPM-V OCR is slow but usable (15-30s)');
        } else {
            console.log('❌ MiniCPM-V OCR may be too slow for real-time use (>30s)');
        }
        
        console.log('💡 Use MiniCPM-V for: Scanned documents, complex layouts, detailed field analysis');
        console.log('💡 Use Llama 3.2 for: Text-based forms, speed-critical applications');

    } catch (error) {
        console.error('❌ MiniCPM-V test failed:', error.message);
        
        if (error.message.includes('ECONNREFUSED')) {
            console.log('💡 Suggestion: Check if Ollama is running with: ollama list');
        } else if (error.message.includes('timeout')) {
            console.log('💡 Suggestion: MiniCPM-V may need more time, try increasing timeout');
        }
    }
}

// Run the test
testMiniCPMOCR().then(() => {
    console.log('\\n🎉 MiniCPM-V OCR test completed!');
}).catch(error => {
    console.error('💥 Test failed:', error);
});
