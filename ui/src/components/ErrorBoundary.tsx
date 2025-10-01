/**
 * Error Boundary with comprehensive logging and recovery options
 */

import React from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'
import { logger, track } from '@/utils/logger'
// import { useConfig } from '@/contexts/ConfigContext' // Removed to avoid circular dependency

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
  retryCount: number
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void
  showDetails?: boolean
  maxRetries?: number
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeouts: NodeJS.Timeout[] = []

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    return {
      hasError: true,
      error,
      errorId,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = this.state.errorId || 'unknown_error'
    
    // Log comprehensive error information
    logger.error('React Error Boundary Caught Error', {
      errorId,
      name: error.name,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    }, 'ErrorBoundary')

    // Track error for analytics
    track.error(error, 'ErrorBoundary', {
      errorId,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo, errorId)
    }

    this.setState({
      errorInfo,
    })
  }

  componentWillUnmount() {
    // Clear any pending retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout))
  }

  handleRetry = () => {
    const maxRetries = this.props.maxRetries || 3
    const newRetryCount = this.state.retryCount + 1

    if (newRetryCount > maxRetries) {
      logger.warn('Max retries exceeded', { 
        maxRetries,
        errorId: this.state.errorId 
      }, 'ErrorBoundary')
      return
    }

    logger.info('Retrying after error', { 
      retryCount: newRetryCount,
      errorId: this.state.errorId 
    }, 'ErrorBoundary')

    // Clear error state to retry
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: newRetryCount,
    })
  }

  handleReload = () => {
    logger.info('Reloading page after error', { 
      errorId: this.state.errorId 
    }, 'ErrorBoundary')
    window.location.reload()
  }

  handleGoHome = () => {
    logger.info('Navigating to home after error', { 
      errorId: this.state.errorId 
    }, 'ErrorBoundary')
    window.location.href = '/'
  }

  handleReportError = () => {
    const errorReport = {
      errorId: this.state.errorId,
      error: {
        name: this.state.error?.name,
        message: this.state.error?.message,
        stack: this.state.error?.stack,
      },
      componentStack: this.state.errorInfo?.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      logs: logger.getLogs().slice(-50), // Last 50 log entries
    }

    // Copy to clipboard
    navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2))
    logger.info('Error report copied to clipboard', { errorId: this.state.errorId }, 'ErrorBoundary')
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return <ErrorFallback {...this.state} {...this.props} onRetry={this.handleRetry} onReload={this.handleReload} onGoHome={this.handleGoHome} onReportError={this.handleReportError} />
    }

    return this.props.children
  }
}

interface ErrorFallbackProps extends ErrorBoundaryState {
  showDetails?: boolean
  maxRetries?: number
  onRetry: () => void
  onReload: () => void
  onGoHome: () => void
  onReportError: () => void
}

function ErrorFallback({
  error,
  errorInfo,
  errorId,
  retryCount,
  showDetails = false,
  maxRetries = 3,
  onRetry,
  onReload,
  onGoHome,
  onReportError,
}: ErrorFallbackProps) {
  const canRetry = retryCount < maxRetries
  // Use process.env directly since we can't access config context here
  const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development'

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-card border border-destructive/20 rounded-lg p-8 text-center space-y-6">
          <div className="flex justify-center">
            <AlertTriangle className="h-16 w-16 text-destructive" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-destructive">
              Something went wrong
            </h1>
            <p className="text-muted-foreground">
              We're sorry, but something unexpected happened. The error has been logged and we've been notified.
            </p>
            {errorId && (
              <p className="text-sm text-muted-foreground font-mono">
                Error ID: {errorId}
              </p>
            )}
          </div>

          {/* Error details (development only or when showDetails is true) */}
          {(isDevelopment || showDetails) && error && (
            <div className="bg-muted p-4 rounded-lg text-left space-y-2">
              <h3 className="font-semibold text-destructive">Error Details:</h3>
              <p className="text-sm font-mono">{error.name}: {error.message}</p>
              {error.stack && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Stack Trace</summary>
                  <pre className="mt-2 whitespace-pre-wrap text-xs bg-background p-2 rounded border">
                    {error.stack}
                  </pre>
                </details>
              )}
              {errorInfo?.componentStack && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Component Stack</summary>
                  <pre className="mt-2 whitespace-pre-wrap text-xs bg-background p-2 rounded border">
                    {errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {canRetry && (
              <Button onClick={onRetry} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again {retryCount > 0 && `(${retryCount}/${maxRetries})`}
              </Button>
            )}
            
            <Button variant="outline" onClick={onReload} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </Button>
            
            <Button variant="outline" onClick={onGoHome} className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Go Home
            </Button>
            
            {isDevelopment && (
              <Button variant="outline" onClick={onReportError} className="flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Copy Error Report
              </Button>
            )}
          </div>

          {/* Help text */}
          <div className="text-sm text-muted-foreground">
            <p>
              If this problem persists, please{' '}
              <a 
                href="mailto:support@example.com" 
                className="text-primary hover:underline"
              >
                contact support
              </a>
              {errorId && ` and include the error ID: ${errorId}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Higher-order component wrapper
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

export default ErrorBoundary