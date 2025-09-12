/**
 * Quick Provider Availability Check
 * Verifies both Llama 3.2 and MiniCPM-V 2.6 are available before running tests
 */

const LLMProviderManager = require('./src/main/llm-provider-manager');
const LlamaProvider = require('./src/main/llm-providers/llama-provider');
const MiniCPMProvider = require('./src/main/llm-providers/minicpm-provider');

async function checkProviders() {
    console.log('🔍 Checking LLM Provider Availability...\n');
    
    try {
        // Initialize provider manager
        const providerManager = new LLMProviderManager();
        
        // Create providers
        const llamaProvider = new LlamaProvider();
        const minicpmProvider = new MiniCPMProvider();
        
        console.log('🦙 Checking Llama 3.2 (Ollama)...');
        try {
            const llamaAvailable = await llamaProvider.checkAvailability();
            console.log(`   Status: ${llamaAvailable ? '✅ Available' : '❌ Not Available'}`);
            console.log(`   Model: ${llamaProvider.modelName}`);
            console.log(`   Description: ${llamaProvider.getDescription()}`);
        } catch (error) {
            console.log(`   Status: ❌ Error - ${error.message}`);
        }
        
        console.log();
        
        console.log('👁️  Checking MiniCPM-V 2.6 (Vision)...');
        try {
            const minicpmAvailable = await minicpmProvider.checkAvailability();
            console.log(`   Status: ${minicpmAvailable ? '✅ Available' : '❌ Not Available'}`);
            console.log(`   Model: ${minicpmProvider.modelName}`);
            console.log(`   Description: ${minicpmProvider.getDescription()}`);
            
            if (!minicpmAvailable) {
                console.log('   💡 Note: MiniCPM-V will be auto-downloaded on first use');
            }
        } catch (error) {
            console.log(`   Status: ❌ Error - ${error.message}`);
        }
        
        console.log();
        
        // Register providers and test manager
        providerManager.registerProvider('llama', llamaProvider);
        providerManager.registerProvider('minicpm', minicpmProvider);
        
        console.log('📋 Provider Manager Status:');
        const providers = await providerManager.getAvailableProviders();
        
        providers.forEach(provider => {
            console.log(`   ${provider.id}: ${provider.available ? '✅' : '❌'} ${provider.name}`);
        });
        
        console.log(`\n🎯 Active Provider: ${providerManager.getActiveProviderId()}`);
        
        // Test basic functionality
        console.log('\n🧪 Testing Basic Functionality...');
        
        for (const provider of providers) {
            if (provider.available) {
                try {
                    console.log(`\n   Testing ${provider.name}...`);
                    await providerManager.switchProvider(provider.id);
                    
                    const testPrompt = "Hello, this is a test. Please respond with 'Test successful'.";
                    const startTime = Date.now();
                    
                    const response = await providerManager.callLLM(testPrompt, { maxTokens: 50 });
                    const responseTime = Date.now() - startTime;
                    
                    console.log(`   ✅ Response received in ${responseTime}ms`);
                    console.log(`   📝 Response: ${response.substring(0, 100)}${response.length > 100 ? '...' : ''}`);
                    
                } catch (error) {
                    console.log(`   ❌ Test failed: ${error.message}`);
                }
            }
        }
        
        console.log('\n🎉 Provider check completed!');
        
    } catch (error) {
        console.error('❌ Provider check failed:', error.message);
        throw error;
    }
}

if (require.main === module) {
    checkProviders().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('💥 Check failed:', error);
        process.exit(1);
    });
}

module.exports = checkProviders;
