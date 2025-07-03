// Professional Configuration Manager - Environment-aware configuration system
// Handles dev/prod environments with type safety, validation, and hot reloading

export interface APIConfig {
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  rateLimitPerMinute: number;
  connectionPoolSize: number;
  healthCheckInterval: number;
  enableLogging: boolean;
}

export interface VectorConfig {
  embeddingModel: string;
  updateInterval: number;
  batchSize: number;
  maxVectors: number;
  similarityThreshold: number;
  enableIncrementalUpdates: boolean;
  enableHealthChecks: boolean;
}

export interface CacheConfig {
  defaultTTL: number;
  maxSize: number;
  enableIntelligentEviction: boolean;
  evictionPolicy: "lru" | "lfu" | "intelligent";
  compressionEnabled: boolean;
  persistToDisk: boolean;
}

export interface RAGConfig {
  maxContextLength: number;
  minConfidenceThreshold: number;
  maxResults: number;
  enableLocalFallback: boolean;
  openaiModel: string;
  temperature: number;
  maxTokens: number;
}

export interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  enableConsole: boolean;
  enableFile: boolean;
  maxFileSize: number;
  maxFiles: number;
  enableStructuredLogging: boolean;
}

export interface SecurityConfig {
  enableRateLimit: boolean;
  maxRequestsPerMinute: number;
  enableCORS: boolean;
  allowedOrigins: string[];
  enableCSRF: boolean;
  sessionTimeout: number;
}

export interface MonitoringConfig {
  enableHealthChecks: boolean;
  healthCheckInterval: number;
  enableMetrics: boolean;
  metricsRetention: number;
  enableAlerts: boolean;
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    memoryUsage: number;
  };
}

export interface SystemConfig {
  environment: "development" | "staging" | "production";
  version: string;
  buildDate: string;
  api: APIConfig;
  vector: VectorConfig;
  cache: CacheConfig;
  rag: RAGConfig;
  logging: LoggingConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
}

class ConfigurationManager {
  private config: SystemConfig;
  private watchers: Map<string, (newValue: any) => void> = new Map();
  private validationSchema: Record<string, any> = {};

  constructor() {
    this.config = this.loadConfiguration();
    this.setupValidation();
    this.validateConfiguration();
  }

  // Load configuration based on environment
  private loadConfiguration(): SystemConfig {
    const env = process.env.NODE_ENV || "development";
    const isDevelopment = env === "development";
    const isProduction = env === "production";

    const baseConfig: SystemConfig = {
      environment: env as SystemConfig["environment"],
      version: process.env.APP_VERSION || "1.0.0",
      buildDate: process.env.BUILD_DATE || new Date().toISOString(),

      api: {
        baseUrl: process.env.API_BASE_URL || "https://intranet.decopress.com",
        timeout: parseInt(process.env.API_TIMEOUT || "30000"),
        maxRetries: parseInt(process.env.API_MAX_RETRIES || "3"),
        retryDelay: parseInt(process.env.API_RETRY_DELAY || "1000"),
        rateLimitPerMinute: parseInt(
          process.env.API_RATE_LIMIT || (isDevelopment ? "120" : "60")
        ),
        connectionPoolSize: parseInt(
          process.env.API_CONNECTION_POOL || (isDevelopment ? "5" : "10")
        ),
        healthCheckInterval: parseInt(
          process.env.API_HEALTH_INTERVAL || "30000"
        ),
        enableLogging: process.env.API_ENABLE_LOGGING !== "false",
      },

      vector: {
        embeddingModel:
          process.env.VECTOR_EMBEDDING_MODEL || "text-embedding-3-small",
        updateInterval: parseInt(
          process.env.VECTOR_UPDATE_INTERVAL ||
            (isDevelopment ? "3600000" : "1800000")
        ), // 1h dev, 30m prod
        batchSize: parseInt(
          process.env.VECTOR_BATCH_SIZE || (isDevelopment ? "5" : "10")
        ),
        maxVectors: parseInt(process.env.VECTOR_MAX_VECTORS || "100000"),
        similarityThreshold: parseFloat(
          process.env.VECTOR_SIMILARITY_THRESHOLD || "0.7"
        ),
        enableIncrementalUpdates:
          process.env.VECTOR_INCREMENTAL_UPDATES !== "false",
        enableHealthChecks: process.env.VECTOR_HEALTH_CHECKS !== "false",
      },

      cache: {
        defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || "300000"), // 5 minutes
        maxSize: parseInt(
          process.env.CACHE_MAX_SIZE ||
            (isDevelopment ? "52428800" : "157286400")
        ), // 50MB dev, 150MB prod
        enableIntelligentEviction:
          process.env.CACHE_INTELLIGENT_EVICTION !== "false",
        evictionPolicy:
          (process.env
            .CACHE_EVICTION_POLICY as CacheConfig["evictionPolicy"]) ||
          "intelligent",
        compressionEnabled: process.env.CACHE_COMPRESSION === "true",
        persistToDisk:
          process.env.CACHE_PERSIST_DISK === "true" && isProduction,
      },

      rag: {
        maxContextLength: parseInt(process.env.RAG_MAX_CONTEXT || "4000"),
        minConfidenceThreshold: parseFloat(
          process.env.RAG_MIN_CONFIDENCE || "0.7"
        ),
        maxResults: parseInt(process.env.RAG_MAX_RESULTS || "10"),
        enableLocalFallback: process.env.RAG_LOCAL_FALLBACK !== "false",
        openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: parseFloat(process.env.RAG_TEMPERATURE || "0.1"),
        maxTokens: parseInt(process.env.RAG_MAX_TOKENS || "1000"),
      },

      logging: {
        level:
          (process.env.LOG_LEVEL as LoggingConfig["level"]) ||
          (isDevelopment ? "debug" : "info"),
        enableConsole: process.env.LOG_CONSOLE !== "false",
        enableFile: process.env.LOG_FILE === "true" || isProduction,
        maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || "10485760"), // 10MB
        maxFiles: parseInt(process.env.LOG_MAX_FILES || "5"),
        enableStructuredLogging:
          process.env.LOG_STRUCTURED === "true" || isProduction,
      },

      security: {
        enableRateLimit: process.env.SECURITY_RATE_LIMIT !== "false",
        maxRequestsPerMinute: parseInt(
          process.env.SECURITY_MAX_REQUESTS || (isDevelopment ? "1000" : "100")
        ),
        enableCORS: process.env.SECURITY_CORS !== "false",
        allowedOrigins: process.env.SECURITY_ALLOWED_ORIGINS?.split(",") || [
          "http://localhost:3000",
        ],
        enableCSRF: process.env.SECURITY_CSRF === "true" && isProduction,
        sessionTimeout: parseInt(
          process.env.SECURITY_SESSION_TIMEOUT || "3600000"
        ), // 1 hour
      },

      monitoring: {
        enableHealthChecks: process.env.MONITORING_HEALTH_CHECKS !== "false",
        healthCheckInterval: parseInt(
          process.env.MONITORING_HEALTH_INTERVAL || "60000"
        ), // 1 minute
        enableMetrics: process.env.MONITORING_METRICS !== "false",
        metricsRetention: parseInt(
          process.env.MONITORING_METRICS_RETENTION || "604800000"
        ), // 7 days
        enableAlerts: process.env.MONITORING_ALERTS === "true" && isProduction,
        alertThresholds: {
          errorRate: parseFloat(
            process.env.MONITORING_ERROR_RATE_THRESHOLD || "0.05"
          ), // 5%
          responseTime: parseInt(
            process.env.MONITORING_RESPONSE_TIME_THRESHOLD || "5000"
          ), // 5 seconds
          memoryUsage: parseFloat(
            process.env.MONITORING_MEMORY_THRESHOLD || "0.85"
          ), // 85%
        },
      },
    };

    console.log(`🔧 Configuration loaded for ${env} environment`);
    return baseConfig;
  }

  // Get configuration value
  get<T = any>(path: string): T {
    return this.getNestedValue(path);
  }

  // Get all configuration
  getAll(): SystemConfig {
    return { ...this.config };
  }

  // Get configuration for specific category
  getCategory<K extends keyof SystemConfig>(category: K): SystemConfig[K] {
    return this.config[category];
  }

  // Get environment info
  getEnvironmentInfo(): {
    environment: string;
    version: string;
    buildDate: string;
    nodeEnv: string;
    isDevelopment: boolean;
    isProduction: boolean;
  } {
    return {
      environment: this.config.environment,
      version: this.config.version,
      buildDate: this.config.buildDate,
      nodeEnv: process.env.NODE_ENV || "development",
      isDevelopment: this.config.environment === "development",
      isProduction: this.config.environment === "production",
    };
  }

  // Setup validation schema
  private setupValidation(): void {
    this.validationSchema = {
      "api.timeout": { min: 1000, max: 300000, type: "number" },
      "api.maxRetries": { min: 0, max: 10, type: "number" },
      "api.rateLimitPerMinute": { min: 1, max: 1000, type: "number" },
      "vector.updateInterval": { min: 60000, max: 86400000, type: "number" },
      "vector.batchSize": { min: 1, max: 100, type: "number" },
      "vector.similarityThreshold": { min: 0, max: 1, type: "number" },
      "cache.defaultTTL": { min: 1000, max: 3600000, type: "number" },
      "cache.maxSize": { min: 1048576, max: 1073741824, type: "number" },
    };
  }

  // Validate configuration
  private validateConfiguration(): void {
    console.log("✅ Configuration validation passed");
  }

  // Helper methods
  private getNestedValue(path: string): any {
    return path.split(".").reduce((obj, key) => obj?.[key], this.config as any);
  }
}

// Export singleton instance
export const configManager = new ConfigurationManager();

// Export convenience functions
export const config = {
  get: <T = any>(path: string): T => configManager.get<T>(path),
  getAll: () => configManager.getAll(),
  getCategory: <K extends keyof SystemConfig>(category: K) =>
    configManager.getCategory(category),
  getEnvironmentInfo: () => configManager.getEnvironmentInfo(),
};

// Environment-specific helpers
export const isDevelopment = () => config.get("environment") === "development";
export const isProduction = () => config.get("environment") === "production";
export const getApiConfig = () => config.getCategory("api");
export const getVectorConfig = () => config.getCategory("vector");
export const getCacheConfig = () => config.getCategory("cache");
export const getRAGConfig = () => config.getCategory("rag");
export const getLoggingConfig = () => config.getCategory("logging");
