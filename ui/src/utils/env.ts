/**
 * Environment utilities for accessing Vite environment variables
 */

/**
 * Get environment variable with optional default value
 */
export function getEnv(key: string, defaultValue?: string): string | undefined {
  const value = import.meta.env[key]
  return value !== undefined ? value : defaultValue
}

/**
 * Get required environment variable (throws if not found)
 */
export function getRequiredEnv(key: string): string {
  const value = import.meta.env[key]
  if (value === undefined) {
    throw new Error(`Required environment variable ${key} is not defined`)
  }
  return value
}

/**
 * Get boolean environment variable
 */
export function getBooleanEnv(key: string, defaultValue = false): boolean {
  const value = import.meta.env[key]
  if (value === undefined) return defaultValue
  
  return value.toLowerCase() === 'true' || value === '1'
}

/**
 * Get number environment variable
 */
export function getNumberEnv(key: string, defaultValue?: number): number | undefined {
  const value = import.meta.env[key]
  if (value === undefined) return defaultValue
  
  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) {
    console.warn(`Environment variable ${key} is not a valid number: ${value}`)
    return defaultValue
  }
  
  return parsed
}

/**
 * Get current environment mode
 */
export function getEnvironment(): 'development' | 'production' | 'test' {
  const mode = import.meta.env.MODE || 'development'
  if (['development', 'production', 'test'].includes(mode)) {
    return mode as 'development' | 'production' | 'test'
  }
  return 'development'
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return getEnvironment() === 'development'
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return getEnvironment() === 'production'
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return getEnvironment() === 'test'
}

/**
 * Get all environment variables with a specific prefix
 */
export function getEnvWithPrefix(prefix: string): Record<string, string> {
  const env: Record<string, string> = {}
  
  Object.keys(import.meta.env).forEach(key => {
    if (key.startsWith(prefix)) {
      env[key] = import.meta.env[key]
    }
  })
  
  return env
}