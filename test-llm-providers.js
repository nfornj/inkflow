/**
 * LLM Provider Performance Test Script
 * Tests both Llama 3.2 and MiniCPM-V 2.6 providers with test2.pdf
 */

const fs = require('fs');
const path = require('path');

// Import our LLM provider system
const LLMProviderManager = require('./inkflow/src/main/llm-provider-manager');
const LlamaProvider = require('./inkflow/src/main/llm-providers/llama-provider');
const MiniCPMProvider = require('./inkflow/src/main/llm-providers/minicpm-provider');
const { LLMFormAnalyzer } = require('./inkflow/src/main/llm-form-analyzer');

class LLMProviderTester {
    constructor() {
        this.results = {
            llama: [],
            minicpm: []
        };
        this.testFile = 'inkflow/test2.pdf';
    }

    async initialize() {
        console.log('🧪 Initializing LLM Provider Test Suite...\n');
        
        // Check if test file exists
        if (!fs.existsSync(this.testFile)) {
            throw new Error(`Test file not found: ${this.testFile}`);
        }

        // Initialize provider manager
        this.providerManager = new LLMProviderManager();
        
        // Register providers
        const llamaProvider = new LlamaProvider();
        const minicpmProvider = new MiniCPMProvider();
        
        this.providerManager.registerProvider('llama', llamaProvider);
        this.providerManager.registerProvider('minicpm', minicpmProvider);
        
        // Initialize form analyzer
        this.formAnalyzer = new LLMFormAnalyzer(this.providerManager);
        
        console.log('✅ Test suite initialized successfully\n');
    }

    async loadTestPDF() {
        console.log('📄 Loading test2.pdf...');
        
        try {
            const pdfBuffer = fs.readFileSync(this.testFile);
            const pdfBytes = new Uint8Array(pdfBuffer);
            
            console.log(`✅ Loaded PDF: ${pdfBytes.length} bytes\n`);
            return pdfBytes;
        } catch (error) {
            console.error('❌ Failed to load PDF:', error.message);
            throw error;
        }
    }

    async testProvider(providerId, pdfBytes, testRuns = 3) {
        console.log(`🔄 Testing ${providerId.toUpperCase()} Provider (${testRuns} runs)...`);
        
        const results = [];
        
        for (let i = 1; i <= testRuns; i++) {
            console.log(`  Run ${i}/${testRuns}:`);
            
            try {
                // Switch to provider
                const switchResult = await this.providerManager.switchProvider(providerId);
                if (!switchResult) {
                    throw new Error(`Failed to switch to ${providerId}`);
                }
                
                // Record start time
                const startTime = Date.now();
                
                // Run analysis
                const analysisResult = await this.formAnalyzer.analyzePDFWithLLM({
                    pdfBytes: Array.from(pdfBytes)
                });
                
                // Record end time
                const endTime = Date.now();
                const responseTime = endTime - startTime;
                
                // Collect results
                const result = {
                    run: i,
                    success: analysisResult.success,
                    responseTime,
                    method: analysisResult.method,
                    todoCount: analysisResult.todoList?.categories?.reduce((total, cat) => total + cat.items.length, 0) || 0,
                    categoriesCount: analysisResult.todoList?.categories?.length || 0,
                    error: analysisResult.error
                };
                
                results.push(result);
                
                console.log(`    ✅ Success: ${result.success}`);
                console.log(`    ⏱️  Time: ${result.responseTime}ms`);
                console.log(`    📋 Todos: ${result.todoCount} items in ${result.categoriesCount} categories`);
                console.log(`    🔧 Method: ${result.method}`);
                
                if (result.error) {
                    console.log(`    ⚠️  Error: ${result.error}`);
                }
                
                // Wait between runs to avoid overwhelming the system
                if (i < testRuns) {
                    console.log(`    ⏳ Waiting 2 seconds before next run...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (error) {
                console.log(`    ❌ Run ${i} failed: ${error.message}`);
                results.push({
                    run: i,
                    success: false,
                    responseTime: 0,
                    error: error.message,
                    todoCount: 0,
                    categoriesCount: 0
                });
            }
        }
        
        console.log(`✅ ${providerId.toUpperCase()} testing completed\n`);
        return results;
    }

    calculateStats(results) {
        const successfulRuns = results.filter(r => r.success);
        const failedRuns = results.filter(r => !r.success);
        
        if (successfulRuns.length === 0) {
            return {
                successRate: 0,
                avgResponseTime: 0,
                minResponseTime: 0,
                maxResponseTime: 0,
                avgTodoCount: 0,
                avgCategoriesCount: 0,
                totalRuns: results.length,
                failedRuns: failedRuns.length
            };
        }
        
        const responseTimes = successfulRuns.map(r => r.responseTime);
        const todoCounts = successfulRuns.map(r => r.todoCount);
        const categoryCounts = successfulRuns.map(r => r.categoriesCount);
        
        return {
            successRate: (successfulRuns.length / results.length) * 100,
            avgResponseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
            minResponseTime: Math.min(...responseTimes),
            maxResponseTime: Math.max(...responseTimes),
            avgTodoCount: Math.round(todoCounts.reduce((a, b) => a + b, 0) / todoCounts.length),
            avgCategoriesCount: Math.round(categoryCounts.reduce((a, b) => a + b, 0) / categoryCounts.length),
            totalRuns: results.length,
            failedRuns: failedRuns.length
        };
    }

    formatTime(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    }

    printComparison(llamaStats, minicpmStats) {
        console.log('📊 PERFORMANCE COMPARISON REPORT');
        console.log('=' .repeat(60));
        console.log();
        
        // Performance Table
        console.log('🏃 SPEED COMPARISON:');
        console.log('-'.repeat(60));
        console.log(`| Metric              | Llama 3.2      | MiniCPM-V 2.6  | Winner     |`);
        console.log(`|---------------------|----------------|----------------|------------|`);
        
        const avgTimeWinner = llamaStats.avgResponseTime < minicpmStats.avgResponseTime ? 'Llama 3.2' : 'MiniCPM-V';
        const minTimeWinner = llamaStats.minResponseTime < minicpmStats.minResponseTime ? 'Llama 3.2' : 'MiniCPM-V';
        const maxTimeWinner = llamaStats.maxResponseTime < minicpmStats.maxResponseTime ? 'Llama 3.2' : 'MiniCPM-V';
        
        console.log(`| Avg Response Time   | ${this.formatTime(llamaStats.avgResponseTime).padEnd(14)} | ${this.formatTime(minicpmStats.avgResponseTime).padEnd(14)} | ${avgTimeWinner.padEnd(10)} |`);
        console.log(`| Min Response Time   | ${this.formatTime(llamaStats.minResponseTime).padEnd(14)} | ${this.formatTime(minicpmStats.minResponseTime).padEnd(14)} | ${minTimeWinner.padEnd(10)} |`);
        console.log(`| Max Response Time   | ${this.formatTime(llamaStats.maxResponseTime).padEnd(14)} | ${this.formatTime(minicpmStats.maxResponseTime).padEnd(14)} | ${maxTimeWinner.padEnd(10)} |`);
        console.log();
        
        // Accuracy & Quality
        console.log('🎯 ACCURACY & QUALITY:');
        console.log('-'.repeat(60));
        console.log(`| Metric              | Llama 3.2      | MiniCPM-V 2.6  | Winner     |`);
        console.log(`|---------------------|----------------|----------------|------------|`);
        
        const successWinner = llamaStats.successRate > minicpmStats.successRate ? 'Llama 3.2' : 'MiniCPM-V';
        const todoWinner = llamaStats.avgTodoCount > minicpmStats.avgTodoCount ? 'Llama 3.2' : 'MiniCPM-V';
        const categoryWinner = llamaStats.avgCategoriesCount > minicpmStats.avgCategoriesCount ? 'Llama 3.2' : 'MiniCPM-V';
        
        console.log(`| Success Rate        | ${llamaStats.successRate.toFixed(1)}%`.padEnd(15) + ' | ' + `${minicpmStats.successRate.toFixed(1)}%`.padEnd(14) + ` | ${successWinner.padEnd(10)} |`);
        console.log(`| Avg Todo Items      | ${llamaStats.avgTodoCount}`.padEnd(14) + ' | ' + `${minicpmStats.avgTodoCount}`.padEnd(14) + ` | ${todoWinner.padEnd(10)} |`);
        console.log(`| Avg Categories      | ${llamaStats.avgCategoriesCount}`.padEnd(14) + ' | ' + `${minicpmStats.avgCategoriesCount}`.padEnd(14) + ` | ${categoryWinner.padEnd(10)} |`);
        console.log();
        
        // Overall Recommendation
        console.log('🏆 OVERALL RECOMMENDATION:');
        console.log('-'.repeat(60));
        
        const speedAdvantage = ((minicpmStats.avgResponseTime - llamaStats.avgResponseTime) / minicpmStats.avgResponseTime * 100);
        const qualityAdvantage = ((llamaStats.avgTodoCount - minicpmStats.avgTodoCount) / Math.max(llamaStats.avgTodoCount, minicpmStats.avgTodoCount) * 100);
        
        if (speedAdvantage > 20) {
            console.log(`🚀 LLAMA 3.2 is significantly faster (${speedAdvantage.toFixed(1)}% speed advantage)`);
        } else if (speedAdvantage < -20) {
            console.log(`🚀 MINICPM-V 2.6 is significantly faster (${Math.abs(speedAdvantage).toFixed(1)}% speed advantage)`);
        } else {
            console.log('⚖️  Both providers have similar speed performance');
        }
        
        if (Math.abs(qualityAdvantage) > 10) {
            const betterQuality = qualityAdvantage > 0 ? 'LLAMA 3.2' : 'MINICPM-V 2.6';
            console.log(`🎯 ${betterQuality} provides better form detection quality`);
        } else {
            console.log('🎯 Both providers have similar detection quality');
        }
        
        console.log();
        console.log('💡 USAGE RECOMMENDATIONS:');
        console.log(`   • For speed-critical applications: Use ${avgTimeWinner}`);
        console.log(`   • For maximum accuracy: Use ${todoWinner}`);
        console.log(`   • For complex forms: Consider MiniCPM-V 2.6's vision capabilities`);
        console.log(`   • For simple text forms: Llama 3.2 is usually sufficient`);
    }

    async runFullTest() {
        try {
            await this.initialize();
            
            const pdfBytes = await this.loadTestPDF();
            
            // Test both providers
            console.log('🧪 STARTING COMPREHENSIVE PROVIDER TESTS\n');
            
            const llamaResults = await this.testProvider('llama', pdfBytes, 3);
            const minicpmResults = await this.testProvider('minicpm', pdfBytes, 3);
            
            // Calculate statistics
            const llamaStats = this.calculateStats(llamaResults);
            const minicpmStats = this.calculateStats(minicpmResults);
            
            // Print detailed results
            console.log('📈 DETAILED RESULTS:');
            console.log('=' .repeat(60));
            console.log();
            
            console.log('🦙 LLAMA 3.2 RESULTS:');
            console.log(`   Success Rate: ${llamaStats.successRate.toFixed(1)}%`);
            console.log(`   Avg Response Time: ${this.formatTime(llamaStats.avgResponseTime)}`);
            console.log(`   Min/Max Time: ${this.formatTime(llamaStats.minResponseTime)} / ${this.formatTime(llamaStats.maxResponseTime)}`);
            console.log(`   Avg Todo Items: ${llamaStats.avgTodoCount}`);
            console.log(`   Avg Categories: ${llamaStats.avgCategoriesCount}`);
            console.log();
            
            console.log('👁️  MINICPM-V 2.6 RESULTS:');
            console.log(`   Success Rate: ${minicpmStats.successRate.toFixed(1)}%`);
            console.log(`   Avg Response Time: ${this.formatTime(minicpmStats.avgResponseTime)}`);
            console.log(`   Min/Max Time: ${this.formatTime(minicpmStats.minResponseTime)} / ${this.formatTime(minicpmStats.maxResponseTime)}`);
            console.log(`   Avg Todo Items: ${minicpmStats.avgTodoCount}`);
            console.log(`   Avg Categories: ${minicpmStats.avgCategoriesCount}`);
            console.log();
            
            // Print comparison
            this.printComparison(llamaStats, minicpmStats);
            
            // Save results to file
            const testReport = {
                timestamp: new Date().toISOString(),
                testFile: this.testFile,
                llama: {
                    results: llamaResults,
                    stats: llamaStats
                },
                minicpm: {
                    results: minicpmResults,
                    stats: minicpmStats
                }
            };
            
            fs.writeFileSync('llm-provider-test-report.json', JSON.stringify(testReport, null, 2));
            console.log('\n📄 Test report saved to: llm-provider-test-report.json');
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            console.error(error.stack);
        }
    }
}

// Run the test
if (require.main === module) {
    const tester = new LLMProviderTester();
    tester.runFullTest().then(() => {
        console.log('\n🎉 Testing completed successfully!');
        process.exit(0);
    }).catch(error => {
        console.error('\n💥 Testing failed:', error);
        process.exit(1);
    });
}

module.exports = LLMProviderTester;
