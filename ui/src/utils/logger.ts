/**
 * Centralized logging system with structured logging and performance tracking
 */

import { getEnvironment, isDevelopment } from './env'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'trace'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: any
  component?: string
  userId?: string
  sessionId?: string
  duration?: number
  stack?: string
  url?: string
  userAgent?: string
}

export interface PerformanceEntry {
  name: string
  startTime: number
  endTime: number
  duration: number
  data?: any
}

class Logger {
  private sessionId: string
  private userId?: string
  private logs: LogEntry[] = []
  private performanceEntries: PerformanceEntry[] = []
  private maxLogEntries = 1000
  private logLevel: LogLevel
  
  constructor() {
    this.sessionId = this.generateSessionId()
    this.logLevel = this.getLogLevel()
    
    // Listen for errors
    this.setupErrorHandling()
    
    // Periodically clean up old logs
    setInterval(() => this.cleanup(), 60000) // Every minute
  }
  
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  private getLogLevel(): LogLevel {
    const env = getEnvironment()
    switch (env) {
      case 'development':
        return 'debug'
      case 'test':
        return 'warn'
      case 'production':
        return 'info'
      default:
        return 'info'
    }
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'trace', 'info', 'warn', 'error']
    return levels.indexOf(level) >= levels.indexOf(this.logLevel)
  }
  
  private createLogEntry(
    level: LogLevel,
    message: string,
    data?: any,
    component?: string,
    duration?: number
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      component,
      userId: this.userId,
      sessionId: this.sessionId,
      duration,
      url: window.location.href,
      userAgent: navigator.userAgent,
      stack: level === 'error' ? new Error().stack : undefined,
    }
  }
  
  private addLog(entry: LogEntry): void {
    this.logs.push(entry)
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries)
    }
    
    // Console output in development
    if (isDevelopment()) {
      this.outputToConsole(entry)
    }
    
    // Send to backend in production
    if (!isDevelopment() && entry.level === 'error') {
      this.sendToBackend(entry)
    }
  }
  
  private outputToConsole(entry: LogEntry): void {
    const { timestamp, level, message, component, data, duration } = entry
    const prefix = `[${timestamp}] [${level.toUpperCase()}]${component ? ` [${component}]` : ''}`
    const durationStr = duration !== undefined ? ` (${duration}ms)` : ''
    
    const consoleMethod = level === 'error' ? 'error' : 
                         level === 'warn' ? 'warn' :
                         level === 'debug' ? 'debug' : 'log'
    
    if (data) {
      console[consoleMethod](`${prefix} ${message}${durationStr}`, data)
    } else {
      console[consoleMethod](`${prefix} ${message}${durationStr}`)
    }
  }
  
  private async sendToBackend(entry: LogEntry): Promise<void> {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      })
    } catch (error) {
      console.error('Failed to send log to backend:', error)
    }
  }
  
  private setupErrorHandling(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.error('Global Error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.toString(),
      })
    })
    
    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled Promise Rejection', {
        reason: event.reason?.toString(),
      })
    })
  }
  
  private cleanup(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000) // 24 hours
    this.logs = this.logs.filter(log => 
      new Date(log.timestamp).getTime() > cutoff
    )
    this.performanceEntries = this.performanceEntries.filter(entry =>
      entry.endTime > cutoff
    )
  }
  
  // Public methods
  setUserId(userId: string): void {
    this.userId = userId
    this.info('User ID set', { userId })
  }
  
  debug(message: string, data?: any, component?: string): void {
    if (this.shouldLog('debug')) {
      this.addLog(this.createLogEntry('debug', message, data, component))
    }
  }
  
  trace(message: string, data?: any, component?: string): void {
    if (this.shouldLog('trace')) {
      this.addLog(this.createLogEntry('trace', message, data, component))
    }
  }
  
  info(message: string, data?: any, component?: string): void {
    if (this.shouldLog('info')) {
      this.addLog(this.createLogEntry('info', message, data, component))
    }
  }
  
  warn(message: string, data?: any, component?: string): void {
    if (this.shouldLog('warn')) {
      this.addLog(this.createLogEntry('warn', message, data, component))
    }
  }
  
  error(message: string, data?: any, component?: string): void {
    if (this.shouldLog('error')) {
      this.addLog(this.createLogEntry('error', message, data, component))
    }
  }
  
  // Performance tracking methods
  startTimer(name: string): () => number {
    const startTime = performance.now()
    
    return (): number => {
      const endTime = performance.now()
      const duration = endTime - startTime
      
      const entry: PerformanceEntry = {
        name,
        startTime,
        endTime,
        duration,
      }
      
      this.performanceEntries.push(entry)
      this.info(`Performance: ${name}`, { duration: `${duration.toFixed(2)}ms` })
      
      return duration
    }
  }
  
  async timeAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const stopTimer = this.startTimer(name)
    try {
      const result = await fn()
      stopTimer()
      return result
    } catch (error) {
      const duration = stopTimer()
      this.error(`Performance: ${name} failed`, { 
        duration: `${duration.toFixed(2)}ms`,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }
  
  time<T>(name: string, fn: () => T): T {
    const stopTimer = this.startTimer(name)
    try {
      const result = fn()
      stopTimer()
      return result
    } catch (error) {
      const duration = stopTimer()
      this.error(`Performance: ${name} failed`, { 
        duration: `${duration.toFixed(2)}ms`,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }
  
  // Analytics and user tracking
  trackUserAction(action: string, data?: any, component?: string): void {
    this.info(`User Action: ${action}`, data, component)
    
    // Track time spent on actions
    const actionKey = `action_${action}_${Date.now()}`
    const stopTimer = this.startTimer(actionKey)
    
    // Auto-stop timer after reasonable timeout (5 minutes)
    setTimeout(() => {
      try {
        stopTimer()
      } catch {
        // Timer might already be stopped
      }
    }, 5 * 60 * 1000)
  }
  
  trackPageView(path: string, title?: string): void {
    this.info('Page View', { 
      path, 
      title: title || document.title,
      referrer: document.referrer 
    })
  }
  
  trackError(error: Error, component?: string, additionalData?: any): void {
    this.error('Application Error', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...additionalData,
    }, component)
  }
  
  // Utility methods
  getLogs(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logs.filter(log => log.level === level)
    }
    return [...this.logs]
  }
  
  getPerformanceEntries(): PerformanceEntry[] {
    return [...this.performanceEntries]
  }
  
  getSessionInfo(): { sessionId: string; userId?: string; logCount: number } {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      logCount: this.logs.length,
    }
  }
  
  exportLogs(): string {
    return JSON.stringify({
      session: this.getSessionInfo(),
      logs: this.logs,
      performance: this.performanceEntries,
      timestamp: new Date().toISOString(),
    }, null, 2)
  }
  
  clearLogs(): void {
    this.logs = []
    this.performanceEntries = []
    this.info('Logs cleared')
  }
}

// Create singleton instance
export const logger = new Logger()

// Export convenience functions
export const log = {
  debug: (message: string, data?: any, component?: string) => 
    logger.debug(message, data, component),
  trace: (message: string, data?: any, component?: string) => 
    logger.trace(message, data, component),
  info: (message: string, data?: any, component?: string) => 
    logger.info(message, data, component),
  warn: (message: string, data?: any, component?: string) => 
    logger.warn(message, data, component),
  error: (message: string, data?: any, component?: string) => 
    logger.error(message, data, component),
}

export const perf = {
  time: <T>(name: string, fn: () => T): T => logger.time(name, fn),
  timeAsync: <T>(name: string, fn: () => Promise<T>): Promise<T> => 
    logger.timeAsync(name, fn),
  startTimer: (name: string) => logger.startTimer(name),
}

export const track = {
  action: (action: string, data?: any, component?: string) => 
    logger.trackUserAction(action, data, component),
  pageView: (path: string, title?: string) => 
    logger.trackPageView(path, title),
  error: (error: Error, component?: string, additionalData?: any) => 
    logger.trackError(error, component, additionalData),
  setUserId: (userId: string) => logger.setUserId(userId),
}

export default logger