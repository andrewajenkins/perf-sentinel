const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

class ConfigLoader {
  constructor() {
    this.defaultConfigPath = path.join(__dirname, 'defaults.yml');
  }

  async load(options = {}) {
    try {
      // Start with default configuration
      const defaultConfig = await this.loadConfigFile(this.defaultConfigPath);
      let config = this.deepClone(defaultConfig);

      // Load user config file if provided
      if (options.configPath) {
        const userConfig = await this.loadConfigFile(options.configPath);
        config = this.mergeConfigs(config, userConfig);
      }

      // Apply environment-specific overrides
      if (options.environment) {
        config = this.applyEnvironmentOverrides(config, options.environment);
      }

      // Apply profile overrides
      if (options.profile) {
        config = this.applyProfileOverrides(config, options.profile);
      }

      // Apply CLI argument overrides
      if (options.cliOverrides) {
        config = this.applyCLIOverrides(config, options.cliOverrides);
      }

      // Interpolate environment variables
      config = this.interpolateEnvironmentVariables(config);

      // Validate configuration
      this.validateConfig(config);

      return config;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }

  async loadConfigFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return yaml.load(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Configuration file not found: ${filePath}`);
      }
      throw new Error(`Failed to parse YAML configuration: ${error.message}`);
    }
  }

  mergeConfigs(base, override) {
    if (!override) return base;
    
    const result = this.deepClone(base);
    
    for (const key in override) {
      if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key])) {
        result[key] = this.mergeConfigs(result[key] || {}, override[key]);
      } else {
        result[key] = override[key];
      }
    }
    
    return result;
  }

  applyEnvironmentOverrides(config, environment) {
    if (!config.environments || !config.environments[environment]) {
      return config;
    }

    const envOverrides = config.environments[environment];
    return this.mergeConfigs(config, envOverrides);
  }

  applyProfileOverrides(config, profile) {
    if (!config.profiles || !config.profiles[profile]) {
      throw new Error(`Profile '${profile}' not found in configuration`);
    }

    const profileOverrides = config.profiles[profile];
    return this.mergeConfigs(config, profileOverrides);
  }

  applyCLIOverrides(config, cliOverrides) {
    const result = this.deepClone(config);
    
    // Map CLI arguments to config paths
    const mappings = {
      threshold: 'analysis.threshold',
      maxHistory: 'analysis.max_history',
      reporter: 'reporting.default_reporters',
      dbConnection: 'storage.database.connection',
      dbName: 'storage.database.name',
      projectId: 'project.id',
      bucketName: 'storage.s3.bucket_name',
      s3Region: 'storage.s3.region',
      s3Prefix: 'storage.s3.prefix',
      baseDirectory: 'storage.filesystem.base_directory'
    };

    for (const [cliKey, configPath] of Object.entries(mappings)) {
      if (cliOverrides[cliKey] !== undefined) {
        this.setNestedValue(result, configPath, cliOverrides[cliKey]);
      }
    }

    // Special handling for adapter type detection and legacy options
    if (cliOverrides.adapterType) {
      result.storage.adapter_type = cliOverrides.adapterType;
    } else if (cliOverrides.bucketName) {
      result.storage.adapter_type = 's3';
    } else if (cliOverrides.dbConnection) {
      result.storage.adapter_type = 'database';
    } else if (cliOverrides.historyFile) {
      result.storage.adapter_type = 'filesystem';
      result.storage.file.history_path = cliOverrides.historyFile;
    }

    return result;
  }

  interpolateEnvironmentVariables(config) {
    const result = this.deepClone(config);
    return this.processValue(result);
  }

  processValue(value) {
    if (typeof value === 'string') {
      return this.interpolateString(value);
    } else if (Array.isArray(value)) {
      return value.map(item => this.processValue(item));
    } else if (value && typeof value === 'object') {
      const result = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.processValue(val);
      }
      return result;
    }
    return value;
  }

  interpolateString(str) {
    return str.replace(/\$\{([^}]+)\}/g, (match, varExpr) => {
      // Handle default values: ${VAR:-default}
      const [varName, defaultValue] = varExpr.split(':-');
      return process.env[varName] || defaultValue || match;
    });
  }

  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  validateConfig(config) {
    // Validate required fields
    if (!config.analysis) {
      throw new Error('analysis configuration is required');
    }

    if (!config.analysis.threshold || config.analysis.threshold <= 0) {
      throw new Error('analysis.threshold must be a positive number');
    }

    if (!config.analysis.max_history || config.analysis.max_history <= 0) {
      throw new Error('analysis.max_history must be a positive number');
    }

    // Validate step types
    if (config.analysis.step_types) {
      for (const [stepType, stepConfig] of Object.entries(config.analysis.step_types)) {
        if (!stepConfig.rules) {
          throw new Error(`step_types.${stepType}.rules is required`);
        }
      }
    }

    // Validate storage configuration
    if (config.storage.type === 'database' && !config.storage.database.connection) {
      throw new Error('storage.database.connection is required when using database storage');
    }

    // Validate reporting configuration
    if (!config.reporting.default_reporters || !Array.isArray(config.reporting.default_reporters)) {
      throw new Error('reporting.default_reporters must be an array');
    }
  }

  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // Helper method to apply context-based overrides
  applyContextOverrides(baseConfig, context, config) {
    let result = this.deepClone(baseConfig);
    
    // Apply suite-level overrides
    if (context.suite && config.analysis.suite_overrides && config.analysis.suite_overrides[context.suite]) {
      const suiteOverrides = config.analysis.suite_overrides[context.suite];
      result = this.mergeConfigs(result, suiteOverrides);
    }
    
    // Apply tag-based overrides (higher priority than suite)
    if (context.tags && Array.isArray(context.tags) && config.analysis.tag_overrides) {
      // Apply tag overrides in order - later tags override earlier ones
      for (const tag of context.tags) {
        if (config.analysis.tag_overrides[tag]) {
          const tagOverrides = config.analysis.tag_overrides[tag];
          result = this.mergeConfigs(result, tagOverrides);
        }
      }
    }
    
    return result;
  }

  // Helper method to get step configuration with context awareness
  getStepConfig(stepText, averageDuration, config, context = null) {
    // Start with base configuration
    let stepConfig = this.getBaseStepConfig(stepText, averageDuration, config);
    
    // Apply context-based overrides if context is provided
    if (context) {
      stepConfig = this.applyContextOverrides(stepConfig, context, config);
    }
    
    return stepConfig;
  }

  // Helper method to get base step configuration (original logic)
  getBaseStepConfig(stepText, averageDuration, config) {
    // Check for step-specific overrides first
    if (config.analysis.step_overrides && config.analysis.step_overrides[stepText]) {
      const override = config.analysis.step_overrides[stepText];
      const baseStepType = override.step_type || this.getStepTypeForDuration(averageDuration, config);
      const baseConfig = config.analysis.step_types[baseStepType] || {};
      
      return this.mergeConfigs(baseConfig, {
        threshold: override.threshold || config.analysis.threshold,
        rules: override.rules || {}
      });
    }

    // Use step type based on duration
    const stepType = this.getStepTypeForDuration(averageDuration, config);
    const stepConfig = config.analysis.step_types[stepType] || config.analysis.step_types.slow;
    
    return {
      threshold: config.analysis.threshold,
      rules: this.mergeConfigs(config.analysis.global_rules, stepConfig.rules || {})
    };
  }

  // Helper method to get step configuration for a specific context
  getStepConfigForContext(stepText, averageDuration, config, context) {
    return this.getStepConfig(stepText, averageDuration, config, context);
  }

  // Helper method to get suite-specific configuration
  getSuiteConfig(suiteName, config) {
    const baseConfig = {
      threshold: config.analysis.threshold,
      rules: config.analysis.global_rules
    };
    
    if (config.analysis.suite_overrides && config.analysis.suite_overrides[suiteName]) {
      return this.mergeConfigs(baseConfig, config.analysis.suite_overrides[suiteName]);
    }
    
    return baseConfig;
  }

  // Helper method to get tag-specific configuration
  getTagConfig(tagName, config) {
    const baseConfig = {
      threshold: config.analysis.threshold,
      rules: config.analysis.global_rules
    };
    
    if (config.analysis.tag_overrides && config.analysis.tag_overrides[tagName]) {
      return this.mergeConfigs(baseConfig, config.analysis.tag_overrides[tagName]);
    }
    
    return baseConfig;
  }

  // Helper method to get effective configuration for a step with context
  getEffectiveStepConfig(stepText, averageDuration, config, context) {
    // Get base step config
    let effectiveConfig = this.getBaseStepConfig(stepText, averageDuration, config);
    
    // Apply context-based overrides in order of priority:
    // 1. Suite overrides
    // 2. Tag overrides (each tag can override previous)
    // 3. Step-specific overrides (highest priority)
    
    if (context) {
      // Apply suite overrides
      if (context.suite && config.analysis.suite_overrides && config.analysis.suite_overrides[context.suite]) {
        const suiteOverrides = config.analysis.suite_overrides[context.suite];
        effectiveConfig = this.mergeConfigs(effectiveConfig, suiteOverrides);
      }
      
      // Apply tag overrides (in order, so later tags override earlier ones)
      if (context.tags && Array.isArray(context.tags) && config.analysis.tag_overrides) {
        for (const tag of context.tags) {
          if (config.analysis.tag_overrides[tag]) {
            const tagOverrides = config.analysis.tag_overrides[tag];
            effectiveConfig = this.mergeConfigs(effectiveConfig, tagOverrides);
          }
        }
      }
    }
    
    // Step-specific overrides always take highest priority
    if (config.analysis.step_overrides && config.analysis.step_overrides[stepText]) {
      const stepOverrides = config.analysis.step_overrides[stepText];
      effectiveConfig = this.mergeConfigs(effectiveConfig, stepOverrides);
    }
    
    return effectiveConfig;
  }

  getStepTypeForDuration(duration, config) {
    const stepTypes = config.analysis.step_types;
    
    if (stepTypes.very_fast && duration < stepTypes.very_fast.max_duration) {
      return 'very_fast';
    }
    if (stepTypes.fast && duration < stepTypes.fast.max_duration) {
      return 'fast';
    }
    if (stepTypes.medium && duration < stepTypes.medium.max_duration) {
      return 'medium';
    }
    
    return 'slow';
  }

  // Helper method to convert configuration to storage options
  getStorageOptions(config) {
    const storageConfig = config.storage;
    const projectId = config.project?.id || 'default';

    // Base options
    const options = {
      projectId,
      adapterType: storageConfig.adapter_type || 'auto'
    };

    // Database options
    if (storageConfig.database) {
      options.useDatabase = storageConfig.adapter_type === 'database' || !!storageConfig.database.connection;
      options.connectionString = storageConfig.database.connection;
      options.databaseName = storageConfig.database.name;
    }

    // Filesystem options
    if (storageConfig.filesystem) {
      options.baseDirectory = storageConfig.filesystem.base_directory;
    }

    // S3 options
    if (storageConfig.s3) {
      options.bucketName = storageConfig.s3.bucket_name;
      options.region = storageConfig.s3.region;
      options.prefix = storageConfig.s3.prefix;
    }

    // Legacy file options for backward compatibility
    if (storageConfig.file) {
      options.historyFile = storageConfig.file.history_path;
    }

    // Retention policies
    if (storageConfig.retention) {
      options.retentionPolicy = storageConfig.retention;
    }

    return options;
  }
}

module.exports = ConfigLoader; 