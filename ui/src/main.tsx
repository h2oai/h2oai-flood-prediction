import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import type { User } from 'oidc-client-ts'
import App from './App.tsx'
import './index.css'
import { initiateAuth } from './lib/auth'
import { setRefreshToken } from './lib/api'
import { startTokenMonitor, stopTokenMonitor } from './lib/tokenMonitor'

const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [_user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const authenticate = async () => {
      try {
        setLoading(true)
        const { user: authUser, isRedirectNeeded } = await initiateAuth()

        if (authUser?.refresh_token) {
          console.log('Setting refresh token:', authUser.refresh_token)
          await setRefreshToken(authUser.refresh_token)
        }

        if (isRedirectNeeded) {
          window.history.replaceState({}, '', window.location.pathname)
          window.location.href = window.location.pathname || '/'
          return
        }

        if (isMounted) {
          setUser(authUser || null)
          if (authUser) startTokenMonitor()
        }
      } catch (err: any) {
        console.error('Authentication error:', err)
        setError(err.message || 'Authentication failed')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    authenticate()
    return () => {
      isMounted = false
      stopTokenMonitor()
    }
  }, [])

  if (loading) {
    return (
      <div style={centerStyle}>
        <h2>Authenticating...</h2>
        <p>Please wait while we securely sign you in</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={centerStyle}>
        <h2>Authentication Error</h2>
        <p>{error}</p>
      </div>
    )
  }

  return <>{children}</>
}

const centerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100vh',
  flexDirection: 'column',
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthWrapper>
      <App />
    </AuthWrapper>
  </React.StrictMode>,
)