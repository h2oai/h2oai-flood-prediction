import { User, UserManager, WebStorageStateStore } from 'oidc-client-ts'
import { setRefreshToken } from './api'
import { fetchConfig } from './oidcConfig'

let userManager: UserManager | null = null

export const initializeAuth = async (): Promise<UserManager> => {
    if (userManager) {
        return userManager
    }

    const config = await fetchConfig()
    const settings = {
        authority: config.oidc_authority,
        client_id: config.oidc_client_id,
        client_secret: config.oidc_client_secret,
        redirect_uri: `${window.location.href}`,
        response_type: 'code',
        scope: config.oidc_scope,
        userStore: new WebStorageStateStore({ store: window.localStorage }),
        // Enable PKCE
        usePkce: true,
        loadUserInfo: true,
        monitorSession: false,
    }

    userManager = new UserManager(settings)

    return userManager
}

// Helper to handle the initial auth request
export const initiateAuth = async () => {
    try {
        const config = await fetchConfig()
        if (config.oidc_authority === '') {
            const mockUser: User = {
                profile: {
                    sub: 'local-user',
                    name: 'Local User',
                },
                access_token: 'local-token',
                expired: false,
                expires_at: Date.now() / 1000 + 3600,
            } as User
            console.log('Using mock user for local development:', mockUser)
            return { user: mockUser, isRedirectNeeded: false }
        }

        console.log('Starting auth flow...')
        const userManager = await initializeAuth()

        // Check if we're handling the callback
        if (window.location.search.includes('code=')) {
            console.log('Handling auth callback...', window.location.search)
            try {
                if (sessionStorage.getItem('authInvokeInProgress')) {
                    return { user: null, isRedirectNeeded: false }
                }
                sessionStorage.setItem('authInvokeInProgress', 'true')
                const user = await userManager.signinCallback()
                console.log('Auth callback completed successfully')
                sessionStorage.removeItem('authInvokeInProgress')
                return { user, isRedirectNeeded: true }
            } catch (callbackError) {
                sessionStorage.removeItem('authInvokeInProgress')
                console.error('Auth callback error:', callbackError)
                throw new Error(`Auth callback failed: ${callbackError}`)
            }
        }
        // Check if we have an existing user
        try {
            const currentUser = await userManager.getUser()
            if (currentUser && !currentUser.expired) {
                console.log('Using existing auth session')
                return { user: currentUser, isRedirectNeeded: false }
            }
        } catch (getUserError) {
            console.error('Error getting current user:', getUserError)
        }
        // Start new auth flow
        console.log('Starting new auth flow')
        await userManager.signinRedirect()
        return { user: null, isRedirectNeeded: false }
    } catch (error) {
        console.error('Auth error:', error)
        throw error
    }
}

// Get user's access token
export const getAccessToken = async () => {
    if (import.meta.env.DEV) {
        return 'local-token'
    }

    return refreshTokenIfNeeded()
}

export const getRefreshToken = async () => {
    if (import.meta.env.DEV) {
        return 'local-refresh-token' // Simple local refresh token
    }
    const manager = await initializeAuth()
    const user = await manager.getUser()
    return user?.refresh_token
}

// Logout user
export const logout = async () => {
    const manager = await initializeAuth()
    await manager.signoutRedirect()
}

export const isTokenAboutToExpire = async (): Promise<boolean> => {
    if (import.meta.env.DEV) {
        return false
    }

    const manager = await initializeAuth()
    const user = await manager.getUser()

    if (!user) return true

    if (!user.expires_at) {
        console.error('No expires_in found in user object')
        return true
    }
    const expiresIn = user.expires_at - Math.floor(Date.now() / 1000)
    return expiresIn < 60
}

export const refreshTokenIfNeeded = async (): Promise<string> => {
    const manager = await initializeAuth()
    const user = await manager.getUser()

    if (import.meta.env.DEV || !user) {
        console.error('No user found, cannot refresh token')
        return 'local-token'
    }

    if (await isTokenAboutToExpire()) {
        try {
            console.log('Token is about to expire, refreshing...')
            const newUser = await manager.signinSilent()

            if (newUser && newUser.refresh_token) {
                await setRefreshToken(newUser.refresh_token)
                return newUser.access_token
            } else {
                console.error('Failed to refresh token silently, no new user found')
                throw new Error('Failed to refresh token silently')
            }
        } catch (error) {
            console.error('Failed to refresh token silently:', error)
            window.location.href = '/'
            throw error
        }
    }

    return user.access_token
}
