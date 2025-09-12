/**
 * LLM Provider Manager
 * Manages multiple LLM providers and handles switching between them
 */

const EventEmitter = require('events');

class LLMProviderManager extends EventEmitter {
    constructor() {
        super();
        this.providers = new Map();
        this.activeProviderId = null;
        this.defaultProviderId = 'minicpm'; // Set MiniCPM-V as default for testing
        this.performanceHistory = new Map();
    }

    /**
     * Register a new LLM provider
     * @param {string} id - Provider ID
     * @param {BaseLLMProvider} provider - Provider instance
     */
    registerProvider(id, provider) {
        console.log(`📋 LLMProviderManager: Registering provider: ${id}`);
        this.providers.set(id, provider);
        this.performanceHistory.set(id, []);
        
        // Set as active if it's the first provider or the default
        if (!this.activeProviderId || id === this.defaultProviderId) {
            this.activeProviderId = id;
        }
        
        this.emit('providerRegistered', { id, provider: provider.getModelInfo() });
    }

    /**
     * Switch to a different provider
     * @param {string} providerId - Provider ID to switch to
     * @returns {Promise<boolean>} Success status
     */
    async switchProvider(providerId) {
        console.log(`🔄 LLMProviderManager: Switching to provider: ${providerId}`);
        
        if (!this.providers.has(providerId)) {
            console.error(`❌ Provider ${providerId} not found`);
            return false;
        }

        const provider = this.providers.get(providerId);
        
        try {
            // Check if provider is available
            const isAvailable = await provider.checkAvailability();
            if (!isAvailable) {
                console.error(`❌ Provider ${providerId} is not available`);
                return false;
            }

            // Initialize if not already initialized
            if (!provider.isInitialized) {
                console.log(`🔧 Initializing provider: ${providerId}`);
                await provider.initialize();
            }

            this.activeProviderId = providerId;
            console.log(`✅ Switched to provider: ${providerId}`);
            
            this.emit('providerSwitched', { 
                providerId, 
                provider: provider.getModelInfo() 
            });
            
            return true;
        } catch (error) {
            console.error(`❌ Failed to switch to provider ${providerId}:`, error);
            return false;
        }
    }

    /**
     * Get the currently active provider
     * @returns {BaseLLMProvider|null} Active provider
     */
    getActiveProvider() {
        if (!this.activeProviderId) return null;
        return this.providers.get(this.activeProviderId);
    }

    /**
     * Get active provider ID
     * @returns {string|null} Active provider ID
     */
    getActiveProviderId() {
        return this.activeProviderId;
    }

    /**
     * Get all available providers
     * @returns {Array<Object>} Provider information
     */
    async getAvailableProviders() {
        const providers = [];
        
        for (const [id, provider] of this.providers) {
            try {
                const isAvailable = await provider.checkAvailability();
                const modelInfo = provider.getModelInfo();
                
                providers.push({
                    id,
                    ...modelInfo,
                    available: isAvailable,
                    active: id === this.activeProviderId
                });
            } catch (error) {
                console.error(`Error checking provider ${id}:`, error);
                providers.push({
                    id,
                    name: provider.getDisplayName(),
                    available: false,
                    active: id === this.activeProviderId,
                    error: error.message
                });
            }
        }
        
        return providers;
    }

    /**
     * Call LLM using the active provider
     * @param {string} prompt - The prompt to send
     * @param {Object} options - Additional options
     * @returns {Promise<string>} LLM response
     */
    async callLLM(prompt, options = {}) {
        const provider = this.getActiveProvider();
        if (!provider) {
            throw new Error('No active LLM provider available');
        }

        const startTime = Date.now();
        let success = false;
        
        try {
            console.log(`🤖 Calling LLM via provider: ${this.activeProviderId}`);
            const response = await provider.callLLM(prompt, options);
            success = true;
            
            const responseTime = Date.now() - startTime;
            provider.updatePerformanceStats(responseTime, success);
            this.recordPerformance(this.activeProviderId, responseTime, success);
            
            console.log(`✅ LLM response received in ${responseTime}ms`);
            return response;
        } catch (error) {
            const responseTime = Date.now() - startTime;
            provider.updatePerformanceStats(responseTime, success);
            this.recordPerformance(this.activeProviderId, responseTime, success);
            
            console.error(`❌ LLM call failed after ${responseTime}ms:`, error);
            throw error;
        }
    }

    /**
     * Record performance data for analysis
     * @param {string} providerId - Provider ID
     * @param {number} responseTime - Response time in ms
     * @param {boolean} success - Whether the request was successful
     */
    recordPerformance(providerId, responseTime, success) {
        const history = this.performanceHistory.get(providerId) || [];
        
        history.push({
            timestamp: Date.now(),
            responseTime,
            success
        });
        
        // Keep only last 100 records
        if (history.length > 100) {
            history.shift();
        }
        
        this.performanceHistory.set(providerId, history);
        
        this.emit('performanceUpdate', {
            providerId,
            responseTime,
            success,
            stats: this.providers.get(providerId).performanceStats
        });
    }

    /**
     * Get performance comparison between providers
     * @returns {Object} Performance comparison
     */
    getPerformanceComparison() {
        const comparison = {};
        
        for (const [id, provider] of this.providers) {
            const stats = provider.performanceStats;
            const history = this.performanceHistory.get(id) || [];
            
            // Calculate recent performance (last 10 requests)
            const recentHistory = history.slice(-10);
            const recentAvgTime = recentHistory.length > 0 
                ? recentHistory.reduce((sum, record) => sum + record.responseTime, 0) / recentHistory.length
                : 0;
            
            comparison[id] = {
                name: provider.getDisplayName(),
                averageResponseTime: Math.round(stats.averageResponseTime),
                recentAverageTime: Math.round(recentAvgTime),
                successRate: Math.round(provider.getSuccessRate()),
                totalRequests: stats.totalRequests,
                lastResponseTime: stats.lastResponseTime
            };
        }
        
        return comparison;
    }

    /**
     * Get the fastest available provider
     * @returns {string|null} Provider ID of fastest provider
     */
    getFastestProvider() {
        let fastestId = null;
        let fastestTime = Infinity;
        
        for (const [id, provider] of this.providers) {
            const avgTime = provider.performanceStats.averageResponseTime;
            const successRate = provider.getSuccessRate();
            
            // Only consider providers with good success rate and some history
            if (successRate >= 80 && provider.performanceStats.totalRequests >= 3) {
                if (avgTime < fastestTime) {
                    fastestTime = avgTime;
                    fastestId = id;
                }
            }
        }
        
        return fastestId;
    }

    /**
     * Auto-select best provider based on performance
     * @returns {Promise<boolean>} Success status
     */
    async autoSelectBestProvider() {
        const fastestId = this.getFastestProvider();
        
        if (fastestId && fastestId !== this.activeProviderId) {
            console.log(`🚀 Auto-selecting fastest provider: ${fastestId}`);
            return await this.switchProvider(fastestId);
        }
        
        return false;
    }

    /**
     * Initialize all registered providers
     */
    async initializeAllProviders() {
        console.log('🔧 Initializing all LLM providers...');
        
        for (const [id, provider] of this.providers) {
            try {
                console.log(`🔧 Initializing provider: ${id}`);
                await provider.initialize();
                console.log(`✅ Provider ${id} initialized successfully`);
            } catch (error) {
                console.error(`❌ Failed to initialize provider ${id}:`, error);
            }
        }
    }

    /**
     * Cleanup all providers
     */
    async cleanup() {
        console.log('🧹 Cleaning up LLM providers...');
        
        for (const [id, provider] of this.providers) {
            try {
                await provider.cleanup();
            } catch (error) {
                console.error(`Error cleaning up provider ${id}:`, error);
            }
        }
        
        this.providers.clear();
        this.performanceHistory.clear();
        this.activeProviderId = null;
    }
}

module.exports = LLMProviderManager;
