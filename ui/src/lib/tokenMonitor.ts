import { refreshTokenIfNeeded, isTokenAboutToExpire } from './auth'

let tokenRefreshInterval: number | null = null

export const startTokenMonitor = () => {
    if (import.meta.env.DEV) return

    if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval)
    }
    tokenRefreshInterval = window.setInterval(async () => {
        try {
            if (await isTokenAboutToExpire()) {
                console.log('Token is about to expire, refreshing proactively')
                await refreshTokenIfNeeded()
            }
        } catch (error) {
            console.error('Error in token monitor:', error)
        }
    }, 30 * 1000)

    console.log('Token monitor started')
}

export const stopTokenMonitor = () => {
    if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval)
        tokenRefreshInterval = null
        console.log('Token monitor stopped')
    }
}
