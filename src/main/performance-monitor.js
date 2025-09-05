/**
 * Performance Monitor - Tracks and logs LLM autofill performance metrics
 * Phase 2 Implementation
 */

const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      latencyHistory: [],
      errorHistory: [],
      memoryUsage: [],
      gpuUsage: [],
      startTime: Date.now(),
      lastReset: Date.now()
    };
    
    this.logsPath = path.join(app.getPath('userData'), 'logs');
    this.metricsPath = path.join(this.logsPath, 'performance-metrics.json');
    this.maxHistorySize = 1000; // Keep last 1000 measurements
  }

  /**
   * Initialize performance monitor
   * @returns {Promise<boolean>} - Success status
   */
  async initialize() {
    try {
      // Ensure logs directory exists
      await fs.ensureDir(this.logsPath);
      
      // Load existing metrics if available
      await this.loadMetrics();
      
      console.log('Performance Monitor initialized');
      return true;

    } catch (error) {
      console.error('Failed to initialize Performance Monitor:', error);
      return false;
    }
  }

  /**
   * Record a request with latency
   * @param {number} latency - Request latency in milliseconds
   * @param {boolean} success - Whether the request was successful
   * @param {Object} metadata - Additional metadata
   */
  recordRequest(latency, success = true, metadata = {}) {
    this.metrics.totalRequests++;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
      this.metrics.errorHistory.push({
        timestamp: Date.now(),
        latency: latency,
        error: metadata.error || 'Unknown error',
        metadata: metadata
      });
    }

    // Update latency statistics
    this.metrics.totalLatency += latency;
    this.metrics.minLatency = Math.min(this.metrics.minLatency, latency);
    this.metrics.maxLatency = Math.max(this.metrics.maxLatency, latency);
    
    // Add to history
    this.metrics.latencyHistory.push({
      timestamp: Date.now(),
      latency: latency,
      success: success,
      metadata: metadata
    });

    // Trim history if too large
    if (this.metrics.latencyHistory.length > this.maxHistorySize) {
      this.metrics.latencyHistory = this.metrics.latencyHistory.slice(-this.maxHistorySize);
    }
    
    if (this.metrics.errorHistory.length > this.maxHistorySize) {
      this.metrics.errorHistory = this.metrics.errorHistory.slice(-this.maxHistorySize);
    }

    // Calculate percentiles
    this.calculatePercentiles();

    // Log performance warning if latency is high
    if (latency > 3000) {
      console.warn(`High latency detected: ${latency}ms (P95 target: 3000ms)`);
    }
  }

  /**
   * Record memory usage
   * @param {number} memoryMB - Memory usage in MB
   * @param {string} type - Memory type (model, system, etc.)
   */
  recordMemoryUsage(memoryMB, type = 'model') {
    this.metrics.memoryUsage.push({
      timestamp: Date.now(),
      memoryMB: memoryMB,
      type: type
    });

    // Trim history if too large
    if (this.metrics.memoryUsage.length > this.maxHistorySize) {
      this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-this.maxHistorySize);
    }
  }

  /**
   * Record GPU usage
   * @param {number} gpuUsage - GPU usage percentage
   * @param {number} vramMB - VRAM usage in MB
   */
  recordGPUUsage(gpuUsage, vramMB = 0) {
    this.metrics.gpuUsage.push({
      timestamp: Date.now(),
      gpuUsage: gpuUsage,
      vramMB: vramMB
    });

    // Trim history if too large
    if (this.metrics.gpuUsage.length > this.maxHistorySize) {
      this.metrics.gpuUsage = this.metrics.gpuUsage.slice(-this.maxHistorySize);
    }
  }

  /**
   * Calculate latency percentiles
   */
  calculatePercentiles() {
    if (this.metrics.latencyHistory.length === 0) return;

    const latencies = this.metrics.latencyHistory
      .map(entry => entry.latency)
      .sort((a, b) => a - b);

    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);

    this.metrics.p95Latency = latencies[p95Index] || 0;
    this.metrics.p99Latency = latencies[p99Index] || 0;
  }

  /**
   * Get current performance summary
   * @returns {Object} - Performance summary
   */
  getPerformanceSummary() {
    const uptime = Date.now() - this.metrics.startTime;
    const avgLatency = this.metrics.totalRequests > 0 ? 
      this.metrics.totalLatency / this.metrics.totalRequests : 0;
    
    const successRate = this.metrics.totalRequests > 0 ? 
      this.metrics.successfulRequests / this.metrics.totalRequests : 0;

    const errorRate = this.metrics.totalRequests > 0 ? 
      this.metrics.failedRequests / this.metrics.totalRequests : 0;

    return {
      uptime: uptime,
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      failedRequests: this.metrics.failedRequests,
      successRate: Math.round(successRate * 10000) / 100, // Percentage
      errorRate: Math.round(errorRate * 10000) / 100, // Percentage
      latency: {
        average: Math.round(avgLatency),
        min: this.metrics.minLatency === Infinity ? 0 : this.metrics.minLatency,
        max: this.metrics.maxLatency,
        p95: this.metrics.p95Latency,
        p99: this.metrics.p99Latency
      },
      targets: {
        p95Target: 3000, // 3 seconds
        p95MeetsTarget: this.metrics.p95Latency <= 3000,
        errorRateTarget: 5, // 5%
        errorRateMeetsTarget: errorRate <= 0.05
      },
      recentActivity: {
        lastHour: this.getRecentActivity(60 * 60 * 1000),
        lastDay: this.getRecentActivity(24 * 60 * 60 * 1000)
      }
    };
  }

  /**
   * Get recent activity within time window
   * @param {number} timeWindowMs - Time window in milliseconds
   * @returns {Object} - Recent activity stats
   */
  getRecentActivity(timeWindowMs) {
    const cutoff = Date.now() - timeWindowMs;
    
    const recentRequests = this.metrics.latencyHistory.filter(
      entry => entry.timestamp >= cutoff
    );
    
    const recentErrors = this.metrics.errorHistory.filter(
      entry => entry.timestamp >= cutoff
    );

    const avgLatency = recentRequests.length > 0 ?
      recentRequests.reduce((sum, req) => sum + req.latency, 0) / recentRequests.length : 0;

    return {
      requests: recentRequests.length,
      errors: recentErrors.length,
      averageLatency: Math.round(avgLatency),
      successRate: recentRequests.length > 0 ?
        Math.round((recentRequests.filter(req => req.success).length / recentRequests.length) * 10000) / 100 : 100
    };
  }

  /**
   * Check if performance targets are being met
   * @returns {Object} - Performance target status
   */
  checkPerformanceTargets() {
    const summary = this.getPerformanceSummary();
    
    return {
      p95Latency: {
        target: 3000,
        current: this.metrics.p95Latency,
        meetsTarget: this.metrics.p95Latency <= 3000,
        status: this.metrics.p95Latency <= 3000 ? 'PASS' : 'FAIL'
      },
      errorRate: {
        target: 5, // 5%
        current: Math.round(summary.errorRate * 100) / 100,
        meetsTarget: summary.errorRate <= 5,
        status: summary.errorRate <= 5 ? 'PASS' : 'FAIL'
      },
      overall: {
        status: (this.metrics.p95Latency <= 3000 && summary.errorRate <= 5) ? 'PASS' : 'FAIL',
        score: this.calculatePerformanceScore()
      }
    };
  }

  /**
   * Calculate overall performance score (0-100)
   * @returns {number} - Performance score
   */
  calculatePerformanceScore() {
    const summary = this.getPerformanceSummary();
    let score = 100;

    // Deduct points for high latency
    if (this.metrics.p95Latency > 3000) {
      score -= Math.min(50, (this.metrics.p95Latency - 3000) / 100);
    }

    // Deduct points for high error rate
    if (summary.errorRate > 5) {
      score -= Math.min(30, (summary.errorRate - 5) * 2);
    }

    // Deduct points for low success rate
    if (summary.successRate < 95) {
      score -= Math.min(20, (95 - summary.successRate) * 2);
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * Save metrics to file
   * @returns {Promise<boolean>} - Success status
   */
  async saveMetrics() {
    try {
      const metricsData = {
        ...this.metrics,
        lastSaved: Date.now()
      };
      
      await fs.writeJson(this.metricsPath, metricsData, { spaces: 2 });
      return true;

    } catch (error) {
      console.error('Failed to save performance metrics:', error);
      return false;
    }
  }

  /**
   * Load metrics from file
   * @returns {Promise<boolean>} - Success status
   */
  async loadMetrics() {
    try {
      if (await fs.pathExists(this.metricsPath)) {
        const metricsData = await fs.readJson(this.metricsPath);
        
        // Merge with current metrics, preserving runtime data
        this.metrics = {
          ...this.metrics,
          ...metricsData,
          startTime: this.metrics.startTime, // Keep current session start time
          lastReset: Date.now()
        };
        
        console.log('Performance metrics loaded from file');
        return true;
      }
      
      return false;

    } catch (error) {
      console.error('Failed to load performance metrics:', error);
      return false;
    }
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      latencyHistory: [],
      errorHistory: [],
      memoryUsage: [],
      gpuUsage: [],
      startTime: Date.now(),
      lastReset: Date.now()
    };
    
    console.log('Performance metrics reset');
  }

  /**
   * Generate performance report
   * @returns {Object} - Detailed performance report
   */
  generateReport() {
    const summary = this.getPerformanceSummary();
    const targets = this.checkPerformanceTargets();
    
    return {
      timestamp: new Date().toISOString(),
      summary: summary,
      targets: targets,
      recommendations: this.generateRecommendations(summary, targets),
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime()
      }
    };
  }

  /**
   * Generate performance recommendations
   * @param {Object} summary - Performance summary
   * @param {Object} targets - Target status
   * @returns {Array} - List of recommendations
   */
  generateRecommendations(summary, targets) {
    const recommendations = [];

    if (!targets.p95Latency.meetsTarget) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: `P95 latency (${targets.p95Latency.current}ms) exceeds target (${targets.p95Latency.target}ms). Consider using a smaller model or enabling GPU acceleration.`
      });
    }

    if (!targets.errorRate.meetsTarget) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        message: `Error rate (${targets.errorRate.current}%) exceeds target (${targets.errorRate.target}%). Check system resources and model stability.`
      });
    }

    if (summary.successRate < 95) {
      recommendations.push({
        type: 'reliability',
        priority: 'medium',
        message: `Success rate (${summary.successRate}%) is below optimal (95%). Review error logs for common issues.`
      });
    }

    if (summary.latency.average > 2000) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: `Average latency (${summary.latency.average}ms) is high. Consider optimizing model configuration or hardware.`
      });
    }

    return recommendations;
  }
}

module.exports = PerformanceMonitor;

