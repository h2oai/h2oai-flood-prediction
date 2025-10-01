import { prefixURL } from './utils'

export interface AppConfig {
    oidc_authority: string
    oidc_client_id: string
    oidc_client_secret: string
    oidc_scope: string
    base_url: string
}

let appConfig: AppConfig | null = null

export const fetchConfig = async (): Promise<AppConfig> => {
    try {
        const response = await fetch(prefixURL('api/config'))

        if (!response.ok) {
            throw new Error(`Failed to load configuration: ${response.statusText}`)
        }

        appConfig = await response.json()

        if (appConfig) {
            return appConfig
        }
        return {
            oidc_authority: '',
            oidc_client_id: '',
            oidc_client_secret: '',
            oidc_scope: '',
            base_url: '',
        }
    } catch (error) {
        console.error('Error loading application configuration:', error)
        throw error
    }
}

export const initializeApp = async (): Promise<boolean> => {
    try {
        await fetchConfig()
        return true
    } catch (error) {
        console.error('Failed to initialize app:', error)
        return false
    }
}
