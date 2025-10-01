import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppConfig } from '@/config'
import { getEnvironmentConfig, mergeServerConfig } from '@/config'
import { fetchConfig } from '../lib/oidcConfig'

interface ConfigContextType {
  config: AppConfig
  loading: boolean
  error: string | null
  reloadConfig: () => Promise<void>
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined)

interface ConfigProviderProps {
  children: ReactNode
}

export function ConfigProvider({ children }: ConfigProviderProps) {
  const [config, setConfig] = useState<AppConfig>(getEnvironmentConfig())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadConfig = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const clientConfig = getEnvironmentConfig()
      
      // Try to fetch server configuration
      try {
        const serverConfig = await fetchConfig()
        const mergedConfig = mergeServerConfig(clientConfig, {
          oidcAuthority: serverConfig.oidc_authority,
          oidcClientId: serverConfig.oidc_client_id,
          oidcClientSecret: serverConfig.oidc_client_secret,
          oidcScope: serverConfig.oidc_scope,
          apiBaseUrl: serverConfig.base_url || clientConfig.apiBaseUrl,
        })
        setConfig(mergedConfig)
      } catch (serverError) {
        console.warn('Failed to load server config, using client defaults:', serverError)
        // Use client config as fallback
        setConfig(clientConfig)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load configuration'
      setError(message)
      console.error('Configuration error:', err)
    } finally {
      setLoading(false)
    }
  }

  const reloadConfig = async () => {
    await loadConfig()
  }

  useEffect(() => {
    loadConfig()
  }, [])

  const value: ConfigContextType = {
    config,
    loading,
    error,
    reloadConfig,
  }

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig(): ConfigContextType {
  const context = useContext(ConfigContext)
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider')
  }
  return context
}

// Convenience hooks for specific config sections
export function useFeatureFlags() {
  const { config } = useConfig()
  return config.features
}

export function useApiConfig() {
  const { config } = useConfig()
  return {
    baseUrl: config.apiBaseUrl,
    timeout: config.apiTimeout,
  }
}

export function useAuthConfig() {
  const { config } = useConfig()
  return {
    authority: config.oidcAuthority,
    clientId: config.oidcClientId,
    scope: config.oidcScope,
    enabled: config.features.authentication,
  }
}

export function useThemeConfig() {
  const { config } = useConfig()
  return config.theme
}

export function useUploadConfig() {
  const { config } = useConfig()
  return config.upload
}