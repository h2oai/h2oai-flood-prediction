/**
 * React hook for logging and performance monitoring
 */

import { useCallback, useEffect, useRef } from 'react'
import { log, perf, track } from '@/utils/logger'
import type { LogLevel } from '@/utils/logger'

export function useLogger(componentName?: string) {
  const componentRef = useRef(componentName || 'UnknownComponent')
  const mountTimeRef = useRef<number>(performance.now())
  const renderCountRef = useRef(0)

  // Track component lifecycle
  useEffect(() => {
    const component = componentRef.current
    mountTimeRef.current = performance.now()
    renderCountRef.current++
    
    log.debug('Component mounted', { 
      renderCount: renderCountRef.current 
    }, component)
    
    return () => {
      const mountTime = mountTimeRef.current
      if (mountTime) {
        const duration = performance.now() - mountTime
        log.debug('Component unmounted', { 
          lifetimeDuration: `${duration.toFixed(2)}ms`,
          renderCount: renderCountRef.current 
        }, component)
      }
    }
  }, [])

  // Create component-specific logging functions
  const componentLogger = useCallback((level: LogLevel, message: string, data?: any) => {
    const component = componentRef.current
    switch (level) {
      case 'debug':
        log.debug(message, data, component)
        break
      case 'info':
        log.info(message, data, component)
        break
      case 'warn':
        log.warn(message, data, component)
        break
      case 'error':
        log.error(message, data, component)
        break
      case 'trace':
        log.trace(message, data, component)
        break
    }
  }, [])

  // Performance tracking
  const timeFunction = useCallback(<T>(name: string, fn: () => T): T => {
    return perf.time(`${componentRef.current}.${name}`, fn)
  }, [])

  const timeAsyncFunction = useCallback(<T>(name: string, fn: () => Promise<T>): Promise<T> => {
    return perf.timeAsync(`${componentRef.current}.${name}`, fn)
  }, [])

  const startTimer = useCallback((name: string) => {
    return perf.startTimer(`${componentRef.current}.${name}`)
  }, [])

  // User action tracking
  const trackAction = useCallback((action: string, data?: any) => {
    track.action(action, data, componentRef.current)
  }, [])

  const trackError = useCallback((error: Error, additionalData?: any) => {
    track.error(error, componentRef.current, additionalData)
  }, [])

  return {
    // Basic logging
    debug: (message: string, data?: any) => componentLogger('debug', message, data),
    info: (message: string, data?: any) => componentLogger('info', message, data),
    warn: (message: string, data?: any) => componentLogger('warn', message, data),
    error: (message: string, data?: any) => componentLogger('error', message, data),
    trace: (message: string, data?: any) => componentLogger('trace', message, data),
    
    // Performance monitoring
    time: timeFunction,
    timeAsync: timeAsyncFunction,
    startTimer,
    
    // User tracking
    trackAction,
    trackError,
    
    // Component info
    componentName: componentRef.current,
    renderCount: renderCountRef.current,
  }
}

export function usePerformanceMonitor() {
  const performanceEntries = useRef<{ [key: string]: number }>({})

  const startMeasurement = useCallback((name: string) => {
    performanceEntries.current[name] = performance.now()
    
    return () => {
      const startTime = performanceEntries.current[name]
      if (startTime !== undefined) {
        const duration = performance.now() - startTime
        log.info(`Performance: ${name}`, { duration: `${duration.toFixed(2)}ms` })
        delete performanceEntries.current[name]
        return duration
      }
      return 0
    }
  }, [])

  const measureRender = useCallback((componentName: string) => {
    renderCountRef.current++
    const renderStart = performance.now()
    
    useEffect(() => {
      const renderTime = performance.now() - renderStart
      log.debug(`Render time: ${componentName}`, { 
        duration: `${renderTime.toFixed(2)}ms`,
        renderCount: renderCountRef.current 
      }, componentName)
    })
  }, [])

  const renderCountRef = useRef(0)

  return {
    startMeasurement,
    measureRender,
  }
}

export function useUserActivity() {
  const activityTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({})
  const activityStartTimes = useRef<{ [key: string]: number }>({})

  const startActivity = useCallback((activityName: string, data?: any) => {
    // Clear existing timeout for this activity
    if (activityTimeouts.current[activityName]) {
      clearTimeout(activityTimeouts.current[activityName])
    }

    // Record start time
    activityStartTimes.current[activityName] = performance.now()
    
    track.action(`${activityName}_started`, data)

    // Set timeout to automatically end activity after 5 minutes of inactivity
    activityTimeouts.current[activityName] = setTimeout(() => {
      endActivity(activityName)
    }, 5 * 60 * 1000)
  }, [])

  const endActivity = useCallback((activityName: string, data?: any) => {
    const startTime = activityStartTimes.current[activityName]
    if (startTime) {
      const duration = performance.now() - startTime
      track.action(`${activityName}_ended`, { 
        ...data, 
        duration: `${duration.toFixed(2)}ms` 
      })
      
      delete activityStartTimes.current[activityName]
    }

    if (activityTimeouts.current[activityName]) {
      clearTimeout(activityTimeouts.current[activityName])
      delete activityTimeouts.current[activityName]
    }
  }, [])

  const updateActivity = useCallback((activityName: string, data?: any) => {
    // Reset timeout
    if (activityTimeouts.current[activityName]) {
      clearTimeout(activityTimeouts.current[activityName])
      activityTimeouts.current[activityName] = setTimeout(() => {
        endActivity(activityName)
      }, 5 * 60 * 1000)
    }

    track.action(`${activityName}_updated`, data)
  }, [endActivity])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.keys(activityTimeouts.current).forEach(activityName => {
        endActivity(activityName)
      })
    }
  }, [endActivity])

  return {
    startActivity,
    endActivity,
    updateActivity,
  }
}

export function usePageTracking() {
  useEffect(() => {
    const path = window.location.pathname
    const title = document.title
    
    track.pageView(path, title)
    
    const handleRouteChange = () => {
      const newPath = window.location.pathname
      const newTitle = document.title
      track.pageView(newPath, newTitle)
    }

    // Listen for navigation changes (for SPAs)
    window.addEventListener('popstate', handleRouteChange)
    
    // Also listen for pushState/replaceState (requires monkey patching)
    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args)
      setTimeout(handleRouteChange, 0) // Async to allow title updates
    }
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args)
      setTimeout(handleRouteChange, 0)
    }

    return () => {
      window.removeEventListener('popstate', handleRouteChange)
      history.pushState = originalPushState
      history.replaceState = originalReplaceState
    }
  }, [])
}