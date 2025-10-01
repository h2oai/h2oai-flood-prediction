/**
 * Development-only performance monitoring component
 */

import { useState, useEffect } from 'react'
import { useConfig } from '@/contexts/ConfigContext'
import { useLogging } from '@/contexts/LoggingContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { 
  Activity, 
  Clock, 
  Download, 
  Trash2, 
  ChevronDown,
  ChevronUp,
  Zap,
  Database
} from 'lucide-react'

export function PerformanceMonitor() {
  const { config } = useConfig()
  const { logs, performanceEntries, exportLogs, clearLogs } = useLogging()
  const [isOpen, setIsOpen] = useState(false)
  const [memoryInfo, setMemoryInfo] = useState<any>(null)
  const [connectionInfo, setConnectionInfo] = useState<any>(null)

  // Only show in development
  if (config.environment !== 'development') {
    return null
  }

  useEffect(() => {
    // Get memory info if available
    if ('memory' in performance) {
      const updateMemoryInfo = () => {
        const memory = (performance as any).memory
        setMemoryInfo({
          used: Math.round(memory.usedJSHeapSize / 1048576), // MB
          total: Math.round(memory.totalJSHeapSize / 1048576), // MB
          limit: Math.round(memory.jsHeapSizeLimit / 1048576), // MB
        })
      }

      updateMemoryInfo()
      const interval = setInterval(updateMemoryInfo, 5000)
      return () => clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    // Get connection info if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      setConnectionInfo({
        type: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
      })

      const handleConnectionChange = () => {
        setConnectionInfo({
          type: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
        })
      }

      connection.addEventListener('change', handleConnectionChange)
      return () => connection.removeEventListener('change', handleConnectionChange)
    }
  }, [])

  const recentPerformanceEntries = performanceEntries.slice(-10)
  const errorLogs = logs.filter(log => log.level === 'error').slice(-5)
  const averagePerformance = performanceEntries.length > 0 
    ? performanceEntries.reduce((sum, entry) => sum + entry.duration, 0) / performanceEntries.length
    : 0

  const handleExportLogs = () => {
    const exported = exportLogs()
    const blob = new Blob([exported], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `performance-logs-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="bg-background border-2 shadow-lg hover:shadow-xl transition-shadow"
          >
            <Activity className="h-4 w-4 mr-2" />
            Performance
            {isOpen ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-2">
          <div className="bg-background border border-border rounded-lg shadow-lg p-4 w-80 max-h-96 overflow-auto">
            <div className="space-y-4">
              {/* Performance Stats */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Performance Stats
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted p-2 rounded">
                    <div className="font-medium">Avg Duration</div>
                    <div className="text-muted-foreground">
                      {averagePerformance.toFixed(2)}ms
                    </div>
                  </div>
                  <div className="bg-muted p-2 rounded">
                    <div className="font-medium">Total Logs</div>
                    <div className="text-muted-foreground">{logs.length}</div>
                  </div>
                </div>
              </div>

              {/* Memory Info */}
              {memoryInfo && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Memory Usage
                  </h3>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Used:</span>
                      <Badge variant="outline">{memoryInfo.used}MB</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Total:</span>
                      <Badge variant="outline">{memoryInfo.total}MB</Badge>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ 
                          width: `${(memoryInfo.used / memoryInfo.limit) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Connection Info */}
              {connectionInfo && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Connection</h3>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <Badge variant="outline">{connectionInfo.type}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Downlink:</span>
                      <Badge variant="outline">{connectionInfo.downlink} Mbps</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>RTT:</span>
                      <Badge variant="outline">{connectionInfo.rtt}ms</Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Performance Entries */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recent Timings
                </h3>
                <div className="space-y-1 text-xs max-h-24 overflow-auto">
                  {recentPerformanceEntries.length > 0 ? (
                    recentPerformanceEntries.map((entry, index) => (
                      <div key={index} className="flex justify-between items-center p-1 bg-muted rounded">
                        <span className="truncate">{entry.name}</span>
                        <Badge variant={entry.duration > 1000 ? 'destructive' : 'outline'}>
                          {entry.duration.toFixed(2)}ms
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground">No timing data yet</div>
                  )}
                </div>
              </div>

              {/* Recent Errors */}
              {errorLogs.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-destructive">Recent Errors</h3>
                  <div className="space-y-1 text-xs max-h-20 overflow-auto">
                    {errorLogs.map((log, index) => (
                      <div key={index} className="p-1 bg-destructive/10 rounded border border-destructive/20">
                        <div className="font-medium text-destructive truncate">{log.message}</div>
                        <div className="text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleExportLogs}
                  className="flex-1"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={clearLogs}
                  className="flex-1"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}