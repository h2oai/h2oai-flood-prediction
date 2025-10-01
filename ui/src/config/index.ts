/**
 * Centralized configuration management for the React app
 */

export interface AppConfig {
  // App Info
  name: string
  version: string
  environment: 'development' | 'production' | 'test'
  
  // API Configuration  
  apiBaseUrl: string
  apiTimeout: number
  
  // Authentication
  oidcAuthority: string
  oidcClientId: string
  oidcClientSecret: string
  oidcScope: string
  
  // UI Configuration
  theme: {
    defaultMode: 'light' | 'dark' | 'system'
    enableThemeToggle: boolean
  }
  
  // Feature Flags
  features: {
    authentication: boolean
    fileUpload: boolean
    darkMode: boolean
    notifications: boolean
    analytics: boolean
    debugging: boolean
  }
  
  // File Upload
  upload: {
    maxFileSize: number
    allowedTypes: string[]
    chunkSize: number
  }
}

// Default configuration
const defaultConfig: AppConfig = {
  name: 'React FastAPI Template',
  version: '1.0.0',
  environment: 'development',
  
  apiBaseUrl: '/api',
  apiTimeout: 30000,
  
  oidcAuthority: '',
  oidcClientId: '',
  oidcClientSecret: '',
  oidcScope: 'openid profile email',
  
  theme: {
    defaultMode: 'dark',
    enableThemeToggle: true,
  },
  
  features: {
    authentication: false, // Will be set based on server config
    fileUpload: true,
    darkMode: true,
    notifications: true,
    analytics: false,
    debugging: true,
  },
  
  upload: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['.pdf', '.txt', '.docx', '.csv'],
    chunkSize: 8192,
  },
}

// Environment-specific overrides
const environmentConfigs: Record<string, Partial<AppConfig>> = {
  development: {
    features: {
      authentication: false,
      fileUpload: true,
      darkMode: true,
      notifications: true,
      analytics: false,
      debugging: true,
    },
    apiTimeout: 10000,
  },
  
  production: {
    features: {
      authentication: true,
      fileUpload: true,
      darkMode: true,
      notifications: true,
      analytics: true,
      debugging: false,
    },
    apiTimeout: 30000,
  },
  
  test: {
    features: {
      authentication: false,
      fileUpload: false,
      darkMode: false,
      notifications: false,
      analytics: false,
      debugging: true,
    },
    apiTimeout: 5000,
  },
}

/**
 * Get configuration for current environment
 */
export function getEnvironmentConfig(): AppConfig {
  const env = import.meta.env.MODE || 'development'
  const envConfig = environmentConfigs[env] || {}
  
  return {
    ...defaultConfig,
    ...envConfig,
    environment: env as AppConfig['environment'],
    features: {
      ...defaultConfig.features,
      ...envConfig.features,
    },
    theme: {
      ...defaultConfig.theme,
      ...envConfig.theme,
    },
    upload: {
      ...defaultConfig.upload,
      ...envConfig.upload,
    },
  }
}

/**
 * Merge server configuration with client configuration  
 */
export function mergeServerConfig(
  clientConfig: AppConfig,
  serverConfig: Partial<AppConfig>
): AppConfig {
  return {
    ...clientConfig,
    ...serverConfig,
    features: {
      ...clientConfig.features,
      // Enable auth if server has OIDC configured
      authentication: !!(serverConfig.oidcAuthority && serverConfig.oidcClientId),
      ...serverConfig.features,
    },
    theme: {
      ...clientConfig.theme,
      ...serverConfig.theme,
    },
    upload: {
      ...clientConfig.upload,
      ...serverConfig.upload,
    },
  }
}

// Export default config for immediate use
export const config = getEnvironmentConfig()