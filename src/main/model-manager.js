/**
 * Model Manager - Handles downloading, verifying, and managing LLM models
 * Phase 3 Implementation - Placeholder for now
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const DownloadManager = require('./download-manager');

class ModelManager {
  constructor() {
    this.modelsPath = path.join(app.getPath('userData'), 'models');
    this.manifestPath = path.join(__dirname, '../shared/models.json');
    this.manifest = null;
    this.downloadProgress = new Map();
    this.downloadManager = new DownloadManager();
    this.setupDownloadManager();
  }

  /**
   * Setup download manager event handlers
   */
  setupDownloadManager() {
    this.downloadManager.on('downloadProgress', (progress) => {
      this.downloadProgress.set(progress.modelId, progress);
    });

    this.downloadManager.on('downloadCompleted', (task) => {
      this.downloadProgress.delete(task.modelId);
      console.log(`Download completed for ${task.modelId}`);
    });

    this.downloadManager.on('downloadFailed', (task) => {
      this.downloadProgress.delete(task.modelId);
      console.error(`Download failed for ${task.modelId}: ${task.error}`);
    });

    this.downloadManager.on('downloadCancelled', (task) => {
      this.downloadProgress.delete(task.modelId);
      console.log(`Download cancelled for ${task.modelId}`);
    });
  }

  /**
   * Initialize the model manager
   * @returns {Promise<boolean>} - Success status
   */
  async initialize() {
    try {
      // Ensure models directory exists
      await fs.ensureDir(this.modelsPath);
      
      // Load model manifest
      await this.loadManifest();
      
      console.log('Model Manager initialized successfully');
      return true;

    } catch (error) {
      console.error('Failed to initialize Model Manager:', error);
      return false;
    }
  }

  /**
   * Load the model manifest from file
   * @returns {Promise<boolean>} - Success status
   */
  async loadManifest() {
    try {
      const manifestData = await fs.readFile(this.manifestPath, 'utf8');
      this.manifest = JSON.parse(manifestData);
      console.log(`Loaded manifest with ${this.manifest.models.length} models`);
      return true;

    } catch (error) {
      console.error('Failed to load model manifest:', error);
      return false;
    }
  }

  /**
   * Get list of available models
   * @returns {Array} - Array of model objects
   */
  getAvailableModels() {
    if (!this.manifest) {
      return [];
    }
    return this.manifest.models;
  }

  /**
   * Get model by ID
   * @param {string} modelId - Model identifier
   * @returns {Object|null} - Model object or null
   */
  getModel(modelId) {
    if (!this.manifest) {
      return null;
    }
    return this.manifest.models.find(model => model.id === modelId);
  }

  /**
   * Get default model
   * @returns {Object|null} - Default model object
   */
  getDefaultModel() {
    if (!this.manifest) {
      return null;
    }
    return this.getModel(this.manifest.defaultModel);
  }

  /**
   * Check if model is downloaded
   * @param {string} modelId - Model identifier
   * @returns {Promise<boolean>} - Download status
   */
  async isModelDownloaded(modelId) {
    const model = this.getModel(modelId);
    if (!model) {
      return false;
    }

    // Ollama models are always "downloaded" (available via Ollama)
    if (model.downloadUrl.startsWith('ollama://')) {
      return true;
    }

    const modelPath = path.join(this.modelsPath, `${modelId}.gguf`);
    return await fs.pathExists(modelPath);
  }

  /**
   * Get model file path
   * @param {string} modelId - Model identifier
   * @returns {string} - Model file path
   */
  getModelPath(modelId) {
    return path.join(this.modelsPath, `${modelId}.gguf`);
  }

  /**
   * Download a model with progress tracking
   * @param {string} modelId - Model identifier
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<boolean>} - Success status
   */
  async downloadModel(modelId, progressCallback = null) {
    const model = this.getModel(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    // Handle Ollama models (no download needed)
    if (model.downloadUrl.startsWith('ollama://')) {
      console.log(`Model ${modelId} is an Ollama model, no download needed`);
      return true;
    }

    const modelPath = this.getModelPath(modelId);
    
    // Check if already downloaded
    if (await this.isModelDownloaded(modelId)) {
      console.log(`Model ${modelId} already downloaded`);
      return true;
    }

    try {
      console.log(`Starting download of ${model.modelName}...`);
      console.log(`Download URL: ${model.downloadUrl}`);
      console.log(`Target path: ${modelPath}`);
      
      // Create temporary file for download
      const tempPath = modelPath + '.tmp';
      
      // Queue download with download manager
      await this.downloadManager.queueDownload(modelId, model.downloadUrl, tempPath, model);
      
      // Wait for download to complete
      return await this.waitForDownloadCompletion(modelId, tempPath, modelPath);

    } catch (error) {
      console.error(`Failed to download model ${modelId}:`, error);
      
      // Clean up any temporary files
      const tempPath = modelPath + '.tmp';
      if (await fs.pathExists(tempPath)) {
        await fs.remove(tempPath);
      }
      
      throw error;
    }
  }

  /**
   * Verify model file integrity
   * @param {string} modelId - Model identifier
   * @returns {Promise<boolean>} - Verification status
   */
  async verifyModel(modelId) {
    const model = this.getModel(modelId);
    if (!model) {
      return false;
    }

    const modelPath = this.getModelPath(modelId);
    
    try {
      console.log(`Verifying model ${modelId}...`);
      
      const verificationResult = await this.verifyDownloadedModel(modelId, modelPath);
      
      if (verificationResult.success) {
        console.log(`Model ${modelId} verification: PASSED`);
        return true;
      } else {
        console.log(`Model ${modelId} verification: FAILED - ${verificationResult.error}`);
        return false;
      }

    } catch (error) {
      console.error(`Failed to verify model ${modelId}:`, error);
      return false;
    }
  }

  /**
   * Wait for download completion and handle verification
   * @param {string} modelId - Model identifier
   * @param {string} tempPath - Temporary file path
   * @param {string} finalPath - Final file path
   * @returns {Promise<boolean>} - Success status
   */
  async waitForDownloadCompletion(modelId, tempPath, finalPath) {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        const status = this.downloadManager.getDownloadStatus(modelId);
        
        if (!status) {
          // Download not found, might have completed
          if (await fs.pathExists(tempPath)) {
            // Verify and move file
            try {
              const verificationResult = await this.verifyDownloadedModel(modelId, tempPath);
              
              if (verificationResult.success) {
                await fs.move(tempPath, finalPath);
                console.log(`Download and verification completed for ${modelId}`);
                clearInterval(checkInterval);
                resolve(true);
              } else {
                await fs.remove(tempPath);
                clearInterval(checkInterval);
                reject(new Error(`Model verification failed: ${verificationResult.error}`));
              }
            } catch (error) {
              clearInterval(checkInterval);
              reject(error);
            }
          } else {
            clearInterval(checkInterval);
            reject(new Error('Download file not found'));
          }
          return;
        }
        
        if (status.status === 'completed') {
          // Download completed, verify and move file
          try {
            const verificationResult = await this.verifyDownloadedModel(modelId, tempPath);
            
            if (verificationResult.success) {
              await fs.move(tempPath, finalPath);
              console.log(`Download and verification completed for ${modelId}`);
              clearInterval(checkInterval);
              resolve(true);
            } else {
              await fs.remove(tempPath);
              clearInterval(checkInterval);
              reject(new Error(`Model verification failed: ${verificationResult.error}`));
            }
          } catch (error) {
            clearInterval(checkInterval);
            reject(error);
          }
        } else if (status.status === 'failed') {
          clearInterval(checkInterval);
          reject(new Error(`Download failed: ${status.error}`));
        }
      }, 1000); // Check every second
      
      // Timeout after 30 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Download timeout'));
      }, 30 * 60 * 1000);
    });
  }

  /**
   * Get download progress for a model
   * @param {string} modelId - Model identifier
   * @returns {Object|null} - Progress object
   */
  getDownloadProgress(modelId) {
    // Check download manager first
    const status = this.downloadManager.getDownloadStatus(modelId);
    if (status) {
      return {
        modelId: modelId,
        progress: status.progress,
        status: status.status,
        error: status.error,
        retryCount: status.retryCount
      };
    }
    
    // Fallback to legacy progress tracking
    return this.downloadProgress.get(modelId) || null;
  }

  /**
   * Get storage information
   * @returns {Promise<Object>} - Storage info
   */
  async getStorageInfo() {
    try {
      const stats = await fs.stat(this.modelsPath);
      const files = await fs.readdir(this.modelsPath);
      
      let totalSize = 0;
      for (const file of files) {
        const filePath = path.join(this.modelsPath, file);
        const fileStats = await fs.stat(filePath);
        totalSize += fileStats.size;
      }

      return {
        path: this.modelsPath,
        totalFiles: files.length,
        totalSizeBytes: totalSize,
        totalSizeGB: (totalSize / (1024 * 1024 * 1024)).toFixed(2),
        available: true
      };

    } catch (error) {
      console.error('Failed to get storage info:', error);
      return {
        path: this.modelsPath,
        totalFiles: 0,
        totalSizeBytes: 0,
        totalSizeGB: '0.00',
        available: false
      };
    }
  }

  /**
   * Delete a model file
   * @param {string} modelId - Model identifier
   * @returns {Promise<boolean>} - Success status
   */
  async deleteModel(modelId) {
    try {
      const modelPath = this.getModelPath(modelId);
      
      if (await fs.pathExists(modelPath)) {
        await fs.remove(modelPath);
        console.log(`Deleted model ${modelId}`);
        return true;
      }

      return false;

    } catch (error) {
      console.error(`Failed to delete model ${modelId}:`, error);
      return false;
    }
  }

  /**
   * Get recommended model based on system specs
   * @param {Object} systemSpecs - System specifications
   * @returns {Object|null} - Recommended model
   */
  getRecommendedModel(systemSpecs = {}) {
    if (!this.manifest) {
      return null;
    }

    const { ramGB = 8, hasGPU = false } = systemSpecs;
    
    // Find best model based on system specs
    const suitableModels = this.manifest.models.filter(model => {
      return model.minRamGb <= ramGB;
    });

    if (suitableModels.length === 0) {
      return this.getModel(this.manifest.fallbackModel);
    }

    // Prefer GPU-optimized models if GPU is available
    if (hasGPU) {
      const gpuModels = suitableModels.filter(model => model.gpuRecommended);
      if (gpuModels.length > 0) {
        return gpuModels[0];
      }
    }

    // Return the first suitable model
    return suitableModels[0];
  }

  /**
   * Perform actual file download with progress tracking
   * @param {string} url - Download URL
   * @param {string} outputPath - Output file path
   * @param {number} expectedSizeGB - Expected file size in GB
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<Object>} - Download result
   */
  async performDownload(url, outputPath, expectedSizeGB, progressCallback = null) {
    return new Promise((resolve, reject) => {
      try {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const request = protocol.get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            return;
          }

          const totalSize = parseInt(response.headers['content-length'], 10);
          let downloadedSize = 0;
          const startTime = Date.now();
          
          // Create write stream
          const writeStream = fs.createWriteStream(outputPath);
          
          response.on('data', (chunk) => {
            downloadedSize += chunk.length;
            
            if (progressCallback) {
              const progress = Math.round((downloadedSize / totalSize) * 100);
              const elapsed = (Date.now() - startTime) / 1000;
              const speed = downloadedSize / elapsed / (1024 * 1024); // MB/s
              const downloadedGB = downloadedSize / (1024 * 1024 * 1024);
              const totalGB = totalSize / (1024 * 1024 * 1024);
              
              progressCallback({
                progress: progress,
                downloaded: downloadedGB,
                total: totalGB,
                speed: Math.round(speed * 100) / 100,
                eta: totalSize > downloadedSize ? 
                  Math.round((totalSize - downloadedSize) / (downloadedSize / elapsed)) : 0
              });
            }
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
   * Verify downloaded model file
   * @param {string} modelId - Model identifier
   * @param {string} filePath - Path to downloaded file
   * @returns {Promise<Object>} - Verification result
   */
  async verifyDownloadedModel(modelId, filePath) {
    try {
      const model = this.getModel(modelId);
      if (!model) {
        return { success: false, error: 'Model not found in manifest' };
      }

      // Check if file exists
      if (!await fs.pathExists(filePath)) {
        return { success: false, error: 'Downloaded file not found' };
      }

      // Get file stats
      const stats = await fs.stat(filePath);
      const fileSizeMB = Math.round(stats.size / (1024 * 1024));
      const expectedSizeMB = Math.round(model.fileSizeGb * 1024);
      
      // Check file size (allow 10% variance)
      const sizeVariance = Math.abs(fileSizeMB - expectedSizeMB) / expectedSizeMB;
      if (sizeVariance > 0.1) {
        return { 
          success: false, 
          error: `File size mismatch: expected ~${expectedSizeMB}MB, got ${fileSizeMB}MB` 
        };
      }

      // Verify checksum if available
      if (model.checksum && model.checksum.startsWith('sha256:')) {
        console.log(`Verifying SHA256 checksum for ${modelId}...`);
        const actualChecksum = await this.calculateFileChecksum(filePath);
        const expectedChecksum = model.checksum.replace('sha256:', '');
        
        if (actualChecksum !== expectedChecksum) {
          return { 
            success: false, 
            error: `Checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}` 
          };
        }
        
        console.log(`Checksum verification passed for ${modelId}`);
      }

      return { 
        success: true, 
        fileSize: fileSizeMB,
        checksum: model.checksum ? await this.calculateFileChecksum(filePath) : null
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate SHA256 checksum of a file
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} - SHA256 checksum
   */
  async calculateFileChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => {
        hash.update(data);
      });
      
      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Resume interrupted download
   * @param {string} modelId - Model identifier
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<boolean>} - Success status
   */
  async resumeDownload(modelId, progressCallback = null) {
    const model = this.getModel(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    const modelPath = this.getModelPath(modelId);
    const tempPath = modelPath + '.tmp';
    
    // Check if temp file exists
    if (!await fs.pathExists(tempPath)) {
      // No temp file, start fresh download
      return await this.downloadModel(modelId, progressCallback);
    }

    try {
      const stats = await fs.stat(tempPath);
      const downloadedSize = stats.size;
      const totalSize = model.fileSizeGb * 1024 * 1024 * 1024;
      
      if (downloadedSize >= totalSize) {
        // File appears complete, verify and move
        const verificationResult = await this.verifyDownloadedModel(modelId, tempPath);
        if (verificationResult.success) {
          await fs.move(tempPath, modelPath);
          return true;
        } else {
          // Verification failed, restart download
          await fs.remove(tempPath);
          return await this.downloadModel(modelId, progressCallback);
        }
      }

      // Resume download from where we left off
      console.log(`Resuming download of ${modelId} from ${downloadedSize} bytes`);
      
      // TODO: Implement resume download with Range header
      // For now, restart the download
      await fs.remove(tempPath);
      return await this.downloadModel(modelId, progressCallback);

    } catch (error) {
      console.error(`Failed to resume download for ${modelId}:`, error);
      // Clean up and restart
      if (await fs.pathExists(tempPath)) {
        await fs.remove(tempPath);
      }
      return await this.downloadModel(modelId, progressCallback);
    }
  }

  /**
   * Get download status for a model
   * @param {string} modelId - Model identifier
   * @returns {Promise<Object>} - Download status
   */
  async getDownloadStatus(modelId) {
    const model = this.getModel(modelId);
    if (!model) {
      return { status: 'not_found' };
    }

    const modelPath = this.getModelPath(modelId);
    const tempPath = modelPath + '.tmp';
    
    if (await fs.pathExists(modelPath)) {
      return { status: 'completed' };
    }
    
    if (await fs.pathExists(tempPath)) {
      const stats = await fs.stat(tempPath);
      const downloadedSize = stats.size;
      const totalSize = model.fileSizeGb * 1024 * 1024 * 1024;
      const progress = Math.round((downloadedSize / totalSize) * 100);
      
      return {
        status: 'in_progress',
        progress: progress,
        downloaded: Math.round(downloadedSize / (1024 * 1024 * 1024) * 100) / 100,
        total: model.fileSizeGb
      };
    }
    
    return { status: 'not_started' };
  }

  /**
   * Cancel a download
   * @param {string} modelId - Model identifier
   * @returns {boolean} - Success status
   */
  cancelDownload(modelId) {
    return this.downloadManager.cancelDownload(modelId);
  }

  /**
   * Get all download statuses
   * @returns {Object} - All download statuses
   */
  getAllDownloadStatuses() {
    return this.downloadManager.getAllDownloadStatuses();
  }

  /**
   * Get download statistics
   * @returns {Object} - Download statistics
   */
  getDownloadStatistics() {
    return this.downloadManager.getStatistics();
  }

  /**
   * Set download configuration
   * @param {Object} config - Configuration options
   */
  setDownloadConfiguration(config) {
    this.downloadManager.setConfiguration(config);
  }

  /**
   * Clear completed downloads
   */
  clearCompletedDownloads() {
    this.downloadManager.clearCompletedDownloads();
  }
}

module.exports = ModelManager;
