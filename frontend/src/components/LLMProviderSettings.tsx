import React, { useState, useEffect } from "react";
import "./LLMProviderSettings.css";

interface LLMProvider {
  id: string;
  name: string;
  description: string;
  available: boolean;
  active: boolean;
  status: "ready" | "not_initialized" | "error";
  performance?: {
    totalRequests: number;
    successfulRequests: number;
    averageResponseTime: number;
    lastResponseTime: number;
    errorCount: number;
  };
  capabilities?: string[];
  strengths?: string[];
  bestFor?: string[];
  modelName?: string;
  parameters?: {
    maxTokens: number;
    temperature: number;
    [key: string]: any;
  };
}

interface PerformanceComparison {
  [providerId: string]: {
    name: string;
    averageResponseTime: number;
    recentAverageTime: number;
    successRate: number;
    totalRequests: number;
    lastResponseTime: number;
  };
}

const LLMProviderSettings: React.FC = () => {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string>("");
  const [performanceData, setPerformanceData] = useState<PerformanceComparison>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string>("");

  // Load providers on component mount
  useEffect(() => {
    loadProviders();
    loadPerformanceData();
  }, []);

  const loadProviders = async () => {
    try {
      if (!window.electronAPI?.getLLMProviders) {
        setError("LLM Provider API not available");
        return;
      }

      const result = await window.electronAPI.getLLMProviders();

      if (result.success) {
        setProviders(result.providers || []);
        setActiveProviderId(result.activeProviderId || "");
        setError("");
      } else {
        setError(result.error || "Failed to load providers");
      }
    } catch (err) {
      console.error("Failed to load LLM providers:", err);
      setError("Failed to load providers");
    } finally {
      setLoading(false);
    }
  };

  const loadPerformanceData = async () => {
    try {
      if (!window.electronAPI?.getLLMPerformance) return;

      const result = await window.electronAPI.getLLMPerformance();

      if (result.success) {
        setPerformanceData(result.performanceComparison || {});
      }
    } catch (err) {
      console.error("Failed to load performance data:", err);
    }
  };

  const switchProvider = async (providerId: string) => {
    if (providerId === activeProviderId || switching) return;

    setSwitching(true);
    setError("");

    try {
      if (!window.electronAPI?.switchLLMProvider) {
        throw new Error("Switch provider API not available");
      }

      const result = await window.electronAPI.switchLLMProvider(providerId);

      if (result.success) {
        setActiveProviderId(result.activeProviderId || "");
        await loadProviders(); // Refresh provider status
        await loadPerformanceData(); // Refresh performance data
      } else {
        setError(result.error || "Failed to switch provider");
      }
    } catch (err) {
      console.error("Failed to switch provider:", err);
      setError("Failed to switch provider");
    } finally {
      setSwitching(false);
    }
  };

  const autoSelectBest = async () => {
    setSwitching(true);
    setError("");

    try {
      if (!window.electronAPI?.autoSelectBestProvider) {
        throw new Error("Auto-select API not available");
      }

      const result = await window.electronAPI.autoSelectBestProvider();

      if (result.success && result.switched) {
        setActiveProviderId(result.activeProviderId || "");
        await loadProviders();
        await loadPerformanceData();
      }
    } catch (err) {
      console.error("Failed to auto-select provider:", err);
      setError("Failed to auto-select provider");
    } finally {
      setSwitching(false);
    }
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getSuccessRate = (provider: LLMProvider): number => {
    if (!provider.performance || provider.performance.totalRequests === 0)
      return 0;
    return Math.round(
      (provider.performance.successfulRequests /
        provider.performance.totalRequests) *
        100
    );
  };

  const getStatusIcon = (provider: LLMProvider): string => {
    if (!provider.available) return "❌";
    if (provider.active) return "✅";
    if (
      provider.performance &&
      provider.performance.averageResponseTime < 30000
    )
      return "⚡";
    return "🔄";
  };

  const getStatusText = (provider: LLMProvider): string => {
    if (!provider.available) return "Unavailable";
    if (provider.active) return "Active";
    if (
      provider.performance &&
      provider.performance.averageResponseTime < 30000
    )
      return "Fast";
    return "Available";
  };

  if (loading) {
    return (
      <div className="llm-provider-settings">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading LLM providers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="llm-provider-settings">
      <div className="settings-header">
        <h3>🤖 LLM Provider Settings</h3>
        <p>Choose your preferred AI model for form analysis and OCR</p>
      </div>

      {error && (
        <div className="error-message">
          <span>⚠️ {error}</span>
        </div>
      )}

      <div className="providers-list">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className={`provider-card ${provider.active ? "active" : ""} ${
              !provider.available ? "unavailable" : ""
            }`}
          >
            <div className="provider-header">
              <div className="provider-info">
                <div className="provider-title">
                  <span className="status-icon">{getStatusIcon(provider)}</span>
                  <h4>{provider.name}</h4>
                  <span className="status-text">{getStatusText(provider)}</span>
                </div>
                <p className="provider-description">{provider.description}</p>
              </div>

              <button
                className={`switch-button ${provider.active ? "active" : ""}`}
                onClick={() => switchProvider(provider.id)}
                disabled={!provider.available || provider.active || switching}
              >
                {switching ? "🔄" : provider.active ? "✅ Active" : "Select"}
              </button>
            </div>

            {/* Performance Stats */}
            {(performanceData[provider.id] || provider.performance) && (
              <div className="performance-stats">
                <div className="stat">
                  <span className="stat-label">Avg Response:</span>
                  <span className="stat-value">
                    {formatTime(
                      performanceData[provider.id]?.averageResponseTime ||
                        provider.performance?.averageResponseTime ||
                        0
                    )}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">Success Rate:</span>
                  <span className="stat-value">
                    {performanceData[provider.id]?.successRate ||
                      getSuccessRate(provider)}
                    %
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">Total Requests:</span>
                  <span className="stat-value">
                    {performanceData[provider.id]?.totalRequests ||
                      provider.performance?.totalRequests ||
                      0}
                  </span>
                </div>
              </div>
            )}

            {/* Capabilities */}
            {provider.strengths && provider.strengths.length > 0 && (
              <div className="provider-capabilities">
                <h5>Strengths:</h5>
                <div className="capabilities-list">
                  {provider.strengths.map((strength, index) => (
                    <span key={index} className="capability-tag">
                      {strength}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {provider.bestFor && provider.bestFor.length > 0 && (
              <div className="provider-best-for">
                <h5>Best For:</h5>
                <div className="best-for-list">
                  {provider.bestFor.map((use, index) => (
                    <span key={index} className="use-case-tag">
                      {use}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="settings-actions">
        <button
          className="auto-select-button"
          onClick={autoSelectBest}
          disabled={switching}
        >
          {switching ? "🔄 Selecting..." : "⚡ Auto-Select Fastest"}
        </button>

        <button
          className="refresh-button"
          onClick={() => {
            loadProviders();
            loadPerformanceData();
          }}
          disabled={switching}
        >
          🔄 Refresh
        </button>
      </div>

      <div className="performance-comparison">
        <h4>📊 Performance Comparison</h4>
        <div className="comparison-grid">
          {Object.entries(performanceData).map(([providerId, data]) => (
            <div key={providerId} className="comparison-item">
              <div className="provider-name">{data.name}</div>
              <div className="comparison-stats">
                <div className="comparison-stat">
                  <span>Response Time:</span>
                  <span className="stat-value">
                    {formatTime(data.averageResponseTime)}
                  </span>
                </div>
                <div className="comparison-stat">
                  <span>Success Rate:</span>
                  <span className="stat-value">{data.successRate}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LLMProviderSettings;
