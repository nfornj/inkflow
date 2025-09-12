/**
 * Base LLM Provider Interface
 * Abstract class that all LLM providers must implement
 */

class BaseLLMProvider {
    constructor(config = {}) {
        this.config = config;
        this.isInitialized = false;
        this.modelInfo = {};
        this.performanceStats = {
            totalRequests: 0,
            successfulRequests: 0,
            averageResponseTime: 0,
            lastResponseTime: 0,
            errorCount: 0
        };
    }

    /**
     * Initialize the provider
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        throw new Error('initialize() must be implemented by provider');
    }

    /**
     * Check if the provider is available and ready
     * @returns {Promise<boolean>} Availability status
     */
    async checkAvailability() {
        throw new Error('checkAvailability() must be implemented by provider');
    }

    /**
     * Call the LLM with a prompt
     * @param {string} prompt - The prompt to send
     * @param {Object} options - Additional options
     * @returns {Promise<string>} LLM response
     */
    async callLLM(prompt, options = {}) {
        throw new Error('callLLM() must be implemented by provider');
    }

    /**
     * Get model information
     * @returns {Object} Model info
     */
    getModelInfo() {
        return {
            id: this.getId(),
            name: this.getDisplayName(),
            description: this.getDescription(),
            capabilities: this.getCapabilities(),
            status: this.isInitialized ? 'ready' : 'not_initialized',
            performance: this.performanceStats
        };
    }

    /**
     * Get provider ID
     * @returns {string} Provider ID
     */
    getId() {
        throw new Error('getId() must be implemented by provider');
    }

    /**
     * Get display name
     * @returns {string} Display name
     */
    getDisplayName() {
        throw new Error('getDisplayName() must be implemented by provider');
    }

    /**
     * Get description
     * @returns {string} Description
     */
    getDescription() {
        throw new Error('getDescription() must be implemented by provider');
    }

    /**
     * Get capabilities
     * @returns {Array<string>} Capabilities
     */
    getCapabilities() {
        return ['text_analysis'];
    }

    /**
     * Update performance statistics
     * @param {number} responseTime - Response time in ms
     * @param {boolean} success - Whether the request was successful
     */
    updatePerformanceStats(responseTime, success) {
        this.performanceStats.totalRequests++;
        this.performanceStats.lastResponseTime = responseTime;
        
        if (success) {
            this.performanceStats.successfulRequests++;
            
            // Update running average
            const totalSuccessTime = this.performanceStats.averageResponseTime * (this.performanceStats.successfulRequests - 1);
            this.performanceStats.averageResponseTime = (totalSuccessTime + responseTime) / this.performanceStats.successfulRequests;
        } else {
            this.performanceStats.errorCount++;
        }
    }

    /**
     * Get success rate
     * @returns {number} Success rate as percentage
     */
    getSuccessRate() {
        if (this.performanceStats.totalRequests === 0) return 0;
        return (this.performanceStats.successfulRequests / this.performanceStats.totalRequests) * 100;
    }

    /**
     * Reset performance statistics
     */
    resetPerformanceStats() {
        this.performanceStats = {
            totalRequests: 0,
            successfulRequests: 0,
            averageResponseTime: 0,
            lastResponseTime: 0,
            errorCount: 0
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        this.isInitialized = false;
    }
}

module.exports = BaseLLMProvider;
