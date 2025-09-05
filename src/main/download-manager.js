/**
 * Download Manager - Handles model downloads with progress tracking and error recovery
 * Phase 3 Implementation
 */

const EventEmitter = require('events');
const fs = require('fs-extra');
const path = require('path');

class DownloadManager extends EventEmitter {
  constructor() {
    super();
    this.activeDownloads = new Map();
    this.downloadQueue = [];
    this.maxConcurrentDownloads = 1; // Limit to 1 for large model files
    this.retryAttempts = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  /**
   * Add download to queue
   * @param {string} modelId - Model identifier
   * @param {string} url - Download URL
   * @param {string} outputPath - Output file path
   * @param {Object} modelInfo - Model information
   * @returns {Promise<boolean>} - Success status
   */
  async queueDownload(modelId, url, outputPath, modelInfo) {
    const downloadTask = {
      modelId,
      url,
      outputPath,
      modelInfo,
      status: 'queued',
      progress: 0,
      error: null,
      retryCount: 0,
      startTime: null,
      endTime: null
    };

    this.downloadQueue.push(downloadTask);
    this.emit('downloadQueued', downloadTask);
    
    // Process queue
    await this.processQueue();
    
    return true;
  }

  /**
   * Process download queue
   */
  async processQueue() {
    if (this.activeDownloads.size >= this.maxConcurrentDownloads) {
      return; // Wait for active downloads to complete
    }

    const nextTask = this.downloadQueue.shift();
    if (!nextTask) {
      return; // No more downloads in queue
    }

    // Start download
    await this.startDownload(nextTask);
  }

  /**
   * Start a download task
   * @param {Object} task - Download task
   */
  async startDownload(task) {
    try {
      task.status = 'downloading';
      task.startTime = Date.now();
      this.activeDownloads.set(task.modelId, task);
      
      this.emit('downloadStarted', task);

      // Check if file already exists
      if (await fs.pathExists(task.outputPath)) {
        task.status = 'completed';
        task.progress = 100;
        this.emit('downloadCompleted', task);
        this.activeDownloads.delete(task.modelId);
        await this.processQueue();
        return;
      }

      // Perform download with progress tracking
      const result = await this.performDownload(task);
      
      if (result.success) {
        task.status = 'completed';
        task.progress = 100;
        task.endTime = Date.now();
        this.emit('downloadCompleted', task);
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      task.error = error.message;
      task.retryCount++;
      
      if (task.retryCount < this.retryAttempts) {
        // Retry download
        task.status = 'retrying';
        this.emit('downloadRetrying', task);
        
        setTimeout(async () => {
          await this.startDownload(task);
        }, this.retryDelay);
        
      } else {
        // Max retries reached
        task.status = 'failed';
        task.endTime = Date.now();
        this.emit('downloadFailed', task);
      }
    } finally {
      this.activeDownloads.delete(task.modelId);
      await this.processQueue();
    }
  }

  /**
   * Perform actual download with progress tracking
   * @param {Object} task - Download task
   * @returns {Promise<Object>} - Download result
   */
  async performDownload(task) {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const http = require('http');
      const { URL } = require('url');
      
      try {
        const urlObj = new URL(task.url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const request = protocol.get(task.url, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            return;
          }

          const totalSize = parseInt(response.headers['content-length'], 10);
          let downloadedSize = 0;
          const startTime = Date.now();
          
          // Create write stream
          const writeStream = fs.createWriteStream(task.outputPath);
          
          response.on('data', (chunk) => {
            downloadedSize += chunk.length;
            
            // Update progress
            const progress = Math.round((downloadedSize / totalSize) * 100);
            task.progress = progress;
            
            // Calculate speed and ETA
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = downloadedSize / elapsed / (1024 * 1024); // MB/s
            const eta = totalSize > downloadedSize ? 
              Math.round((totalSize - downloadedSize) / (downloadedSize / elapsed)) : 0;
            
            // Emit progress update
            this.emit('downloadProgress', {
              modelId: task.modelId,
              progress: progress,
              downloaded: Math.round(downloadedSize / (1024 * 1024 * 1024) * 100) / 100,
              total: Math.round(totalSize / (1024 * 1024 * 1024) * 100) / 100,
              speed: Math.round(speed * 100) / 100,
              eta: eta
            });
          });
          
          response.on('end', () => {
            writeStream.end();
            resolve({
              success: true,
              downloadedSize: downloadedSize,
              totalSize: totalSize
            });
          });
          
          response.on('error', (error) => {
            writeStream.destroy();
            reject(error);
          });
          
          // Pipe response to file
          response.pipe(writeStream);
          
        });
        
        request.on('error', (error) => {
          reject(error);
        });
        
        request.setTimeout(300000, () => { // 5 minute timeout
          request.destroy();
          reject(new Error('Download timeout'));
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Cancel a download
   * @param {string} modelId - Model identifier
   * @returns {boolean} - Success status
   */
  cancelDownload(modelId) {
    // Remove from queue
    const queueIndex = this.downloadQueue.findIndex(task => task.modelId === modelId);
    if (queueIndex !== -1) {
      const task = this.downloadQueue.splice(queueIndex, 1)[0];
      task.status = 'cancelled';
      this.emit('downloadCancelled', task);
      return true;
    }

    // Cancel active download
    const activeTask = this.activeDownloads.get(modelId);
    if (activeTask) {
      activeTask.status = 'cancelled';
      this.emit('downloadCancelled', activeTask);
      this.activeDownloads.delete(modelId);
      return true;
    }

    return false;
  }

  /**
   * Get download status for a model
   * @param {string} modelId - Model identifier
   * @returns {Object|null} - Download status
   */
  getDownloadStatus(modelId) {
    // Check active downloads
    const activeTask = this.activeDownloads.get(modelId);
    if (activeTask) {
      return {
        status: activeTask.status,
        progress: activeTask.progress,
        error: activeTask.error,
        retryCount: activeTask.retryCount
      };
    }

    // Check queue
    const queuedTask = this.downloadQueue.find(task => task.modelId === modelId);
    if (queuedTask) {
      return {
        status: queuedTask.status,
        progress: queuedTask.progress,
        error: queuedTask.error,
        retryCount: queuedTask.retryCount
      };
    }

    return null;
  }

  /**
   * Get all download statuses
   * @returns {Object} - All download statuses
   */
  getAllDownloadStatuses() {
    const statuses = {};
    
    // Active downloads
    for (const [modelId, task] of this.activeDownloads) {
      statuses[modelId] = {
        status: task.status,
        progress: task.progress,
        error: task.error,
        retryCount: task.retryCount
      };
    }
    
    // Queued downloads
    for (const task of this.downloadQueue) {
      statuses[task.modelId] = {
        status: task.status,
        progress: task.progress,
        error: task.error,
        retryCount: task.retryCount
      };
    }
    
    return statuses;
  }

  /**
   * Clear completed downloads from memory
   */
  clearCompletedDownloads() {
    // Remove completed tasks from queue
    this.downloadQueue = this.downloadQueue.filter(task => 
      task.status !== 'completed' && task.status !== 'failed' && task.status !== 'cancelled'
    );
  }

  /**
   * Get download statistics
   * @returns {Object} - Download statistics
   */
  getStatistics() {
    const active = this.activeDownloads.size;
    const queued = this.downloadQueue.length;
    const total = active + queued;
    
    return {
      active: active,
      queued: queued,
      total: total,
      maxConcurrent: this.maxConcurrentDownloads,
      retryAttempts: this.retryAttempts,
      retryDelay: this.retryDelay
    };
  }

  /**
   * Set download configuration
   * @param {Object} config - Configuration options
   */
  setConfiguration(config) {
    if (config.maxConcurrentDownloads !== undefined) {
      this.maxConcurrentDownloads = Math.max(1, config.maxConcurrentDownloads);
    }
    
    if (config.retryAttempts !== undefined) {
      this.retryAttempts = Math.max(0, config.retryAttempts);
    }
    
    if (config.retryDelay !== undefined) {
      this.retryDelay = Math.max(1000, config.retryDelay);
    }
  }
}

module.exports = DownloadManager;

