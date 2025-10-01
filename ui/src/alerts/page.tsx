'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Clock, MapPin, Eye, RefreshCw, Bell, Settings, Filter, Download } from 'lucide-react'
import { dashboardApi, type Alert, formatTimestamp } from '@/lib/api'
import { AppSidebar } from "@/components/app-sidebar"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import { Badge } from '@/components/ui/badge'

export default function Page() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string>('all')

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await dashboardApi.getAlerts(20) // Get up to 20 alerts
      setAlerts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts')
      console.error('Failed to fetch alerts:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [])

  const handleRefresh = () => {
    fetchAlerts()
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
      case 'moderate':
        return <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500 dark:text-gray-400" />
    }
  }

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return 'destructive'
      case 'moderate':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getSeverityCardClass = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return 'border-l-red-500 bg-red-50 dark:bg-red-900/10'
      case 'moderate':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10'
      default:
        return 'border-l-gray-500 bg-gray-50 dark:bg-gray-900/10'
    }
  }

  // Filter alerts by severity
  const filteredAlerts = alerts.filter(alert => 
    severityFilter === 'all' || alert.severity.toLowerCase() === severityFilter.toLowerCase()
  )

  // Loading skeleton component
  const LoadingSkeleton = ({ lines = 3, className = "" }: { lines?: number; className?: string }) => (
    <div className={`animate-pulse ${className}`}>
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className={`h-4 bg-gray-200 dark:bg-gray-700 rounded ${i === 0 ? 'w-3/4' : i === lines - 1 ? 'w-1/2' : 'w-full'}`} />
        ))}
      </div>
    </div>
  )

  // Show loading skeleton when loading and no data
  if (loading && alerts.length === 0) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">Texas Flood Prediction</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Alerts</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-6 p-6">
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <LoadingSkeleton key={index} lines={4} className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm border dark:border-slate-700" />
              ))}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (error) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">Texas Flood Prediction</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Alerts</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-1 flex-col items-center justify-center p-6">
            <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error Loading Alerts</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <button 
              onClick={handleRefresh}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </button>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">Texas Flood Prediction</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Alerts</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Flood Alerts & Warnings
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Current flood warnings and emergency notifications for Texas watersheds
              </p>
            </div>

            <div className="flex items-center space-x-4">
              {/* Severity Filter */}
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Severities</option>
                  <option value="high">High Severity</option>
                  <option value="moderate">Moderate Severity</option>
                  <option value="low">Low Severity</option>
                </select>
              </div>

              <button 
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Alert Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm border dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Alerts</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{alerts.length}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm border dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">High Severity</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {alerts.filter(a => a.severity.toLowerCase() === 'high').length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm border dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Watersheds Affected</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {new Set(alerts.map(a => a.watershed)).size}
                  </p>
                </div>
                <MapPin className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </div>

          {/* Alerts List */}
          {filteredAlerts.length > 0 ? (
            <div className="space-y-4">
              {filteredAlerts.map((alert, index) => (
                <div 
                  key={alert.alert_id || index}
                  className={`bg-white dark:bg-neutral-900 rounded-lg shadow-sm border-l-4 ${getSeverityCardClass(alert.severity)} dark:border-slate-700`}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        {getSeverityIcon(alert.severity)}
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                              {alert.alert_type}
                            </h3>
                            <Badge variant={getSeverityBadgeClass(alert.severity)}>
                              {alert.severity}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                            <div className="flex items-center space-x-1">
                              <MapPin className="h-4 w-4" />
                              <span>{alert.watershed}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="h-4 w-4" />
                              <span>Issued {formatTimestamp(alert.issued_time)}</span>
                            </div>
                          </div>
                          
                          <p className="text-gray-700 dark:text-gray-300 mb-3">
                            {alert.message}
                          </p>
                          
                          {alert.affected_counties && alert.affected_counties.length > 0 && (
                            <div className="mb-3">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                Affected Counties: 
                              </span>
                              <span className="text-sm text-gray-700 dark:text-gray-300 ml-1">
                                {alert.affected_counties.join(', ')}
                              </span>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                            {alert.expires_time && (
                              <span>
                                Expires: {formatTimestamp(alert.expires_time)}
                              </span>
                            )}
                            <span>
                              ID: {alert.alert_id}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <button className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 ml-4">
                        <Eye className="h-4 w-4 mr-1" />
                        View on Map
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm border dark:border-slate-700">
              <div className="p-16 text-center">
                <AlertTriangle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                  No Active Alerts
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {severityFilter === 'all' 
                    ? 'There are currently no flood alerts or warnings for Texas watersheds.'
                    : `There are currently no ${severityFilter} severity alerts.`
                  }
                </p>
              </div>
            </div>
          )}

          {/* Alert Subscription Settings */}
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm border dark:border-slate-700">
            <div className="p-6 border-b dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    Alert Preferences
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Configure how you receive flood alerts and warnings
                  </p>
                </div>
                <button className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md">
                  <Download className="h-4 w-4 mr-2" />
                  Export Settings
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">Alert Types</h4>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        defaultChecked 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Flash Flood Warnings</span>
                    </label>
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        defaultChecked 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Flood Warnings</span>
                    </label>
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Flood Watches</span>
                    </label>
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">River Flood Statements</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">Notification Methods</h4>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        defaultChecked 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">In-App Notifications</span>
                    </label>
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Email Alerts</span>
                    </label>
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">SMS Messages</span>
                    </label>
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Push Notifications</span>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mr-4">
                  Save Preferences
                </button>
                <button className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                  <Bell className="h-4 w-4 mr-2" />
                  Test Notification
                </button>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}