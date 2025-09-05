/**
 * Hardware Detector - Detects system capabilities for LLM optimization
 * Phase 2 Implementation
 */

const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class HardwareDetector {
  constructor() {
    this.systemSpecs = null;
    this.gpuInfo = null;
  }

  /**
   * Detect system hardware specifications
   * @returns {Promise<Object>} - System specifications
   */
  async detectSystemSpecs() {
    try {
      const specs = {
        platform: os.platform(),
        arch: os.arch(),
        cpuCount: os.cpus().length,
        totalMemoryGB: Math.round(os.totalmem() / (1024 * 1024 * 1024) * 100) / 100,
        freeMemoryGB: Math.round(os.freemem() / (1024 * 1024 * 1024) * 100) / 100,
        cpuModel: os.cpus()[0]?.model || 'Unknown',
        nodeVersion: process.version,
        electronVersion: process.versions.electron
      };

      // Detect GPU capabilities
      specs.gpu = await this.detectGPU();

      this.systemSpecs = specs;
      console.log('System specs detected:', specs);
      return specs;

    } catch (error) {
      console.error('Failed to detect system specs:', error);
      return this.getFallbackSpecs();
    }
  }

  /**
   * Detect GPU capabilities
   * @returns {Promise<Object>} - GPU information
   */
  async detectGPU() {
    try {
      const platform = os.platform();
      let gpuInfo = {
        hasGPU: false,
        type: null,
        vendor: null,
        model: null,
        memoryGB: 0,
        cudaVersion: null,
        metalSupport: false
      };

      if (platform === 'darwin') {
        // macOS - Check for Metal support
        gpuInfo = await this.detectMacOSGPU();
      } else if (platform === 'win32') {
        // Windows - Check for NVIDIA CUDA
        gpuInfo = await this.detectWindowsGPU();
      } else if (platform === 'linux') {
        // Linux - Check for NVIDIA CUDA
        gpuInfo = await this.detectLinuxGPU();
      }

      this.gpuInfo = gpuInfo;
      return gpuInfo;

    } catch (error) {
      console.error('Failed to detect GPU:', error);
      return {
        hasGPU: false,
        type: null,
        vendor: null,
        model: null,
        memoryGB: 0,
        cudaVersion: null,
        metalSupport: false
      };
    }
  }

  /**
   * Detect macOS GPU (Metal support)
   * @returns {Promise<Object>} - macOS GPU info
   */
  async detectMacOSGPU() {
    try {
      // Check for Metal support
      const { stdout } = await execAsync('system_profiler SPDisplaysDataType -json');
      const displayData = JSON.parse(stdout);
      
      let gpuInfo = {
        hasGPU: false,
        type: 'metal',
        vendor: 'Apple',
        model: 'Unknown',
        memoryGB: 0,
        cudaVersion: null,
        metalSupport: false
      };

      if (displayData.SPDisplaysDataType && displayData.SPDisplaysDataType.length > 0) {
        const gpu = displayData.SPDisplaysDataType[0];
        gpuInfo.hasGPU = true;
        gpuInfo.model = gpu.sppci_model || 'Unknown';
        gpuInfo.metalSupport = true;
        
        // Estimate VRAM (macOS doesn't always report this accurately)
        if (gpuInfo.model.includes('M1') || gpuInfo.model.includes('M2') || gpuInfo.model.includes('M3')) {
          gpuInfo.memoryGB = 8; // Conservative estimate for Apple Silicon
        } else {
          gpuInfo.memoryGB = 4; // Conservative estimate for Intel
        }
      }

      return gpuInfo;

    } catch (error) {
      console.warn('Failed to detect macOS GPU:', error);
      return {
        hasGPU: false,
        type: 'metal',
        vendor: 'Apple',
        model: 'Unknown',
        memoryGB: 0,
        cudaVersion: null,
        metalSupport: false
      };
    }
  }

  /**
   * Detect Windows GPU (NVIDIA CUDA)
   * @returns {Promise<Object>} - Windows GPU info
   */
  async detectWindowsGPU() {
    try {
      let gpuInfo = {
        hasGPU: false,
        type: 'cuda',
        vendor: null,
        model: null,
        memoryGB: 0,
        cudaVersion: null,
        metalSupport: false
      };

      // Try to get GPU info using wmic
      try {
        const { stdout } = await execAsync('wmic path win32_VideoController get name,AdapterRAM /format:csv');
        const lines = stdout.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.includes('NVIDIA')) {
            gpuInfo.hasGPU = true;
            gpuInfo.vendor = 'NVIDIA';
            gpuInfo.model = line.split(',')[1] || 'Unknown';
            
            // Extract memory info if available
            const memoryMatch = line.match(/(\d+)/);
            if (memoryMatch) {
              gpuInfo.memoryGB = Math.round(parseInt(memoryMatch[1]) / (1024 * 1024 * 1024) * 100) / 100;
            }
            break;
          }
        }
      } catch (wmicError) {
        console.warn('Failed to use wmic for GPU detection:', wmicError);
      }

      // Check for CUDA version
      if (gpuInfo.hasGPU) {
        try {
          const { stdout } = await execAsync('nvcc --version');
          const versionMatch = stdout.match(/release (\d+\.\d+)/);
          if (versionMatch) {
            gpuInfo.cudaVersion = versionMatch[1];
          }
        } catch (cudaError) {
          console.warn('CUDA not found or not in PATH:', cudaError);
        }
      }

      return gpuInfo;

    } catch (error) {
      console.warn('Failed to detect Windows GPU:', error);
      return {
        hasGPU: false,
        type: 'cuda',
        vendor: null,
        model: null,
        memoryGB: 0,
        cudaVersion: null,
        metalSupport: false
      };
    }
  }

  /**
   * Detect Linux GPU (NVIDIA CUDA)
   * @returns {Promise<Object>} - Linux GPU info
   */
  async detectLinuxGPU() {
    try {
      let gpuInfo = {
        hasGPU: false,
        type: 'cuda',
        vendor: null,
        model: null,
        memoryGB: 0,
        cudaVersion: null,
        metalSupport: false
      };

      // Try to get GPU info using nvidia-smi
      try {
        const { stdout } = await execAsync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits');
        const lines = stdout.split('\n').filter(line => line.trim());
        
        if (lines.length > 0) {
          const gpuData = lines[0].split(',');
          gpuInfo.hasGPU = true;
          gpuInfo.vendor = 'NVIDIA';
          gpuInfo.model = gpuData[0]?.trim() || 'Unknown';
          gpuInfo.memoryGB = Math.round(parseInt(gpuData[1]?.trim() || '0') / 1024 * 100) / 100;
        }
      } catch (nvidiaError) {
        console.warn('nvidia-smi not found:', nvidiaError);
      }

      // Check for CUDA version
      if (gpuInfo.hasGPU) {
        try {
          const { stdout } = await execAsync('nvcc --version');
          const versionMatch = stdout.match(/release (\d+\.\d+)/);
          if (versionMatch) {
            gpuInfo.cudaVersion = versionMatch[1];
          }
        } catch (cudaError) {
          console.warn('CUDA not found or not in PATH:', cudaError);
        }
      }

      return gpuInfo;

    } catch (error) {
      console.warn('Failed to detect Linux GPU:', error);
      return {
        hasGPU: false,
        type: 'cuda',
        vendor: null,
        model: null,
        memoryGB: 0,
        cudaVersion: null,
        metalSupport: false
      };
    }
  }

  /**
   * Get fallback system specs when detection fails
   * @returns {Object} - Fallback specs
   */
  getFallbackSpecs() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpuCount: os.cpus().length,
      totalMemoryGB: Math.round(os.totalmem() / (1024 * 1024 * 1024) * 100) / 100,
      freeMemoryGB: Math.round(os.freemem() / (1024 * 1024 * 1024) * 100) / 100,
      cpuModel: 'Unknown',
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      gpu: {
        hasGPU: false,
        type: null,
        vendor: null,
        model: null,
        memoryGB: 0,
        cudaVersion: null,
        metalSupport: false
      }
    };
  }

  /**
   * Check if system meets minimum requirements
   * @param {Object} specs - System specifications
   * @returns {Object} - Requirements check result
   */
  checkMinimumRequirements(specs = null) {
    const systemSpecs = specs || this.systemSpecs || this.getFallbackSpecs();
    
    const requirements = {
      minRamGB: 8,
      minCpuCores: 4,
      recommendedRamGB: 16,
      recommendedCpuCores: 8
    };

    const meetsMinimum = {
      ram: systemSpecs.totalMemoryGB >= requirements.minRamGB,
      cpu: systemSpecs.cpuCount >= requirements.minCpuCores
    };

    const meetsRecommended = {
      ram: systemSpecs.totalMemoryGB >= requirements.recommendedRamGB,
      cpu: systemSpecs.cpuCount >= requirements.recommendedCpuCores
    };

    return {
      meetsMinimum: meetsMinimum.ram && meetsMinimum.cpu,
      meetsRecommended: meetsRecommended.ram && meetsRecommended.cpu,
      requirements,
      systemSpecs,
      checks: {
        ram: {
          required: requirements.minRamGB,
          available: systemSpecs.totalMemoryGB,
          meets: meetsMinimum.ram
        },
        cpu: {
          required: requirements.minCpuCores,
          available: systemSpecs.cpuCount,
          meets: meetsMinimum.cpu
        }
      }
    };
  }

  /**
   * Get optimal GPU layer configuration
   * @param {Object} gpuInfo - GPU information
   * @param {number} totalLayers - Total model layers
   * @returns {number} - Recommended GPU layers
   */
  getOptimalGPULayers(gpuInfo = null, totalLayers = 32) {
    const gpu = gpuInfo || this.gpuInfo;
    
    if (!gpu || !gpu.hasGPU) {
      return 0;
    }

    // Conservative GPU layer allocation based on VRAM
    if (gpu.memoryGB >= 16) {
      return Math.min(totalLayers, 32); // High-end GPU
    } else if (gpu.memoryGB >= 8) {
      return Math.min(totalLayers, 24); // Mid-range GPU
    } else if (gpu.memoryGB >= 4) {
      return Math.min(totalLayers, 16); // Entry-level GPU
    } else {
      return Math.min(totalLayers, 8);  // Very limited VRAM
    }
  }

  /**
   * Get system performance score (0-100)
   * @param {Object} specs - System specifications
   * @returns {number} - Performance score
   */
  getPerformanceScore(specs = null) {
    const systemSpecs = specs || this.systemSpecs || this.getFallbackSpecs();
    
    let score = 0;
    
    // RAM score (0-40 points)
    if (systemSpecs.totalMemoryGB >= 32) score += 40;
    else if (systemSpecs.totalMemoryGB >= 16) score += 30;
    else if (systemSpecs.totalMemoryGB >= 8) score += 20;
    else if (systemSpecs.totalMemoryGB >= 4) score += 10;
    
    // CPU score (0-30 points)
    if (systemSpecs.cpuCount >= 16) score += 30;
    else if (systemSpecs.cpuCount >= 8) score += 25;
    else if (systemSpecs.cpuCount >= 4) score += 15;
    else if (systemSpecs.cpuCount >= 2) score += 10;
    
    // GPU score (0-30 points)
    if (systemSpecs.gpu?.hasGPU) {
      if (systemSpecs.gpu.memoryGB >= 16) score += 30;
      else if (systemSpecs.gpu.memoryGB >= 8) score += 25;
      else if (systemSpecs.gpu.memoryGB >= 4) score += 20;
      else score += 15;
    }
    
    return Math.min(100, score);
  }
}

module.exports = HardwareDetector;

