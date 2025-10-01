/**
 * Logging Context for React app with centralized log management
 */

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { logger, track } from '@/utils/logger'
import type { LogEntry, LogLevel, PerformanceEntry } from '@/utils/logger'
import { useConfig } from './ConfigContext'

interface LoggingContextType {
  // Current session info
  sessionId: string
  userId?: string
  
  // Log management
  logs: LogEntry[]
  performanceEntries: PerformanceEntry[]
  logLevel: LogLevel
  
  // Actions
  setUserId: (userId: string) => void
  clearLogs: () => void
  exportLogs: () => string
  
  // Settings
  enableAutoExport: boolean
  setEnableAutoExport: (enabled: boolean) => void
}

const LoggingContext = createContext<LoggingContextType | undefined>(undefined)

interface LoggingProviderProps {
  children: ReactNode
  autoTrackPageViews?: boolean
  autoTrackErrors?: boolean
  logRetentionHours?: number
}

export function LoggingProvider({ 
  children,
  autoTrackPageViews = true,
  autoTrackErrors = true,
}: LoggingProviderProps) {
  const { config } = useConfig()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [performanceEntries, setPerformanceEntries] = useState<PerformanceEntry[]>([])
  const [enableAutoExport, setEnableAutoExport] = useState(false)
  const sessionInfo = logger.getSessionInfo()

  // Update logs periodically
  useEffect(() => {
    const updateLogs = () => {
      setLogs(logger.getLogs())
      setPerformanceEntries(logger.getPerformanceEntries())
    }

    // Initial update
    updateLogs()

    // Set up periodic updates
    const interval = setInterval(updateLogs, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [])

  // Auto-export logs in development mode
  useEffect(() => {
    if (enableAutoExport && config.environment === 'development') {
      const exportInterval = setInterval(() => {
        const exported = logger.exportLogs()
        console.group('📋 Auto-exported Logs')
        console.log(exported)
        console.groupEnd()
      }, 60000) // Export every minute in dev mode

      return () => clearInterval(exportInterval)
    }
  }, [enableAutoExport, config.environment])

  // Track page views automatically
  useEffect(() => {
    if (autoTrackPageViews) {
      track.pageView(window.location.pathname, document.title)
    }
  }, [autoTrackPageViews])

  // Set up global error tracking
  useEffect(() => {
    if (!autoTrackErrors) return

    const handleError = (event: ErrorEvent) => {
      track.error(new Error(event.message), 'Global', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      })
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason))
      track.error(error, 'Promise', { type: 'unhandledrejection' })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [autoTrackErrors])

  // Log app lifecycle events
  useEffect(() => {
    track.action('app_started', { 
      environment: config.environment,
      version: config.version,
    })

    const handleBeforeUnload = () => {
      track.action('app_closing')
    }

    const handleVisibilityChange = () => {
      track.action(document.hidden ? 'app_backgrounded' : 'app_foregrounded')
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [config])

  const value: LoggingContextType = {
    sessionId: sessionInfo.sessionId,
    userId: sessionInfo.userId,
    logs,
    performanceEntries,
    logLevel: config.environment === 'development' ? 'debug' : 'info',
    
    setUserId: (userId: string) => {
      logger.setUserId(userId)
    },
    
    clearLogs: () => {
      logger.clearLogs()
    },
    
    exportLogs: () => {
      return logger.exportLogs()
    },
    
    enableAutoExport,
    setEnableAutoExport,
  }

  return (
    <LoggingContext.Provider value={value}>
      {children}
    </LoggingContext.Provider>
  )
}

export function useLogging(): LoggingContextType {
  const context = useContext(LoggingContext)
  if (context === undefined) {
    throw new Error('useLogging must be used within a LoggingProvider')
  }
  return context
}

// Specialized hooks for common logging patterns
export function useComponentLogger(componentName: string) {
  
  useEffect(() => {
    track.action('component_mounted', { componentName })
    return () => {
      track.action('component_unmounted', { componentName })
    }
  }, [componentName])

  return {
    info: (message: string, data?: any) => 
      logger.info(message, data, componentName),
    warn: (message: string, data?: any) => 
      logger.warn(message, data, componentName),
    error: (message: string, data?: any) => 
      logger.error(message, data, componentName),
    debug: (message: string, data?: any) => 
      logger.debug(message, data, componentName),
    trackAction: (action: string, data?: any) => 
      track.action(action, data, componentName),
  }
}

export function usePerformanceLogger() {
  const timeFunction = (name: string, fn: () => any): any => logger.time(name, fn)
  const timeAsyncFunction = (name: string, fn: () => Promise<any>): Promise<any> => logger.timeAsync(name, fn)
  
  return {
    time: timeFunction,
    timeAsync: timeAsyncFunction,
    startTimer: (name: string) => logger.startTimer(name),
  }
}

export function useUserSession() {
  const { sessionId, userId, setUserId } = useLogging()
  
  const startSession = (newUserId: string, userData?: any) => {
    setUserId(newUserId)
    track.action('session_started', { 
      userId: newUserId, 
      ...userData 
    })
  }

  const endSession = () => {
    track.action('session_ended', { userId })
  }

  const trackUserAction = (action: string, data?: any) => {
    track.action(action, { userId, ...data })
  }

  return {
    sessionId,
    userId,
    startSession,
    endSession,
    trackUserAction,
    isLoggedIn: !!userId,
  }
}