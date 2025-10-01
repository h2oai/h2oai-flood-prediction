'use client'

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
import { useState, useEffect } from 'react'
import { 
    Activity, 
    AlertTriangle, 
    TrendingUp, 
    TrendingDown, 
    BarChart3,
    MapPin,
    RefreshCw,
    Eye,
    X,
    AlertCircle,
    // Shield,
    Database,
    CheckCircle,
    Clock
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { dashboardApi, jobApi, type DashboardData } from '@/lib/api'
import DataSourceBadge from '@/components/DataSourceBadge'

// Helper functions
const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    })
}

const getRiskBadgeClass = (riskLevel: string): string => {
    switch (riskLevel) {
        case 'High': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
        case 'Moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'
        case 'Low': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
        default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
    }
}

const formatStreamflow = (cfs: number): string => {
    return `${cfs.toLocaleString()} CFS`
}

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

// Chart loading skeleton
const ChartLoadingSkeleton = ({ height = 300, className = "" }: { height?: number; className?: string }) => (
    <div className={`animate-pulse ${className}`}>
        <div className={`bg-gray-200 dark:bg-gray-700 rounded`} style={{ height }} />
    </div>
)

// Metric card component
const MetricCard = ({ title, value, change, icon: Icon, trend, color = 'blue' }: {
    title: string
    value: string | number
    change?: string
    icon: any
    trend?: 'up' | 'down'
    color?: string
}) => (
    <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm border dark:border-slate-700">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
                {change && (
                    <p className={`flex items-center mt-1 text-sm ${
                        trend === 'up' ? 'text-red-600 dark:text-red-400' : 
                        trend === 'down' ? 'text-green-600 dark:text-green-400' : 
                        'text-gray-600 dark:text-gray-400'
                    }`}>
                        {trend === 'up' && <TrendingUp className="h-4 w-4 mr-1" />}
                        {trend === 'down' && <TrendingDown className="h-4 w-4 mr-1" />}
                        {change}
                    </p>
                )}
            </div>
            <div className={`text-${color}-600`}>
                <Icon className="h-8 w-8" />
            </div>
        </div>
    </div>
)

// Banner component
const WarningBanner = ({ banner, onDismiss, onActionClick }: {
    banner: {
        id: string
        type: 'emergency' | 'warning' | 'info'
        icon: any
        title: string
        message: string
        actionText?: string
        actionHref?: string
    }
    onDismiss: (id: string) => void
    onActionClick?: (id: string) => void
}) => {
    const getBannerStyles = (type: string) => {
        switch (type) {
            case 'emergency':
                return 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
            case 'warning':
                return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-800'
            case 'info':
                return 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800'
            default:
                return 'bg-gray-50 border-gray-200 dark:bg-gray-900/10 dark:border-gray-800'
        }
    }
    
    const getTextStyles = (type: string) => {
        switch (type) {
            case 'emergency':
                return { title: 'text-red-800 dark:text-red-200', message: 'text-red-700 dark:text-red-300', icon: 'text-red-600 dark:text-red-400' }
            case 'warning':
                return { title: 'text-yellow-800 dark:text-yellow-200', message: 'text-yellow-700 dark:text-yellow-300', icon: 'text-yellow-600 dark:text-yellow-400' }
            case 'info':
                return { title: 'text-blue-800 dark:text-blue-200', message: 'text-blue-700 dark:text-blue-300', icon: 'text-blue-600 dark:text-blue-400' }
            default:
                return { title: 'text-gray-800 dark:text-gray-200', message: 'text-gray-700 dark:text-gray-300', icon: 'text-gray-600 dark:text-gray-400' }
        }
    }
    
    const styles = getTextStyles(banner.type)
    const Icon = banner.icon
    
    return (
        <div className={`border rounded-lg p-4 ${getBannerStyles(banner.type)}`}>
            <div className="flex items-start">
                <div className="flex-shrink-0">
                    <Icon className={`h-5 w-5 ${styles.icon}`} />
                </div>
                <div className="ml-3 flex-1">
                    <h3 className={`text-sm font-medium ${styles.title}`}>
                        {banner.title}
                    </h3>
                    <div className={`mt-1 text-sm ${styles.message}`}>
                        <p>{banner.message}</p>
                    </div>
                    {banner.actionText && (
                        <div className="mt-3">
                            {banner.actionHref === '#' && onActionClick ? (
                                <button
                                    onClick={() => onActionClick(banner.id)}
                                    className={`text-sm font-medium ${
                                        banner.type === 'emergency' ? 'text-red-800 hover:text-red-900 dark:text-red-200 dark:hover:text-red-100' :
                                        banner.type === 'warning' ? 'text-yellow-800 hover:text-yellow-900 dark:text-yellow-200 dark:hover:text-yellow-100' :
                                        'text-blue-800 hover:text-blue-900 dark:text-blue-200 dark:hover:text-blue-100'
                                    } underline cursor-pointer`}
                                >
                                    {banner.actionText} →
                                </button>
                            ) : banner.actionHref ? (
                                <a
                                    href={banner.actionHref}
                                    className={`text-sm font-medium ${
                                        banner.type === 'emergency' ? 'text-red-800 hover:text-red-900 dark:text-red-200 dark:hover:text-red-100' :
                                        banner.type === 'warning' ? 'text-yellow-800 hover:text-yellow-900 dark:text-yellow-200 dark:hover:text-yellow-100' :
                                        'text-blue-800 hover:text-blue-900 dark:text-blue-200 dark:hover:text-blue-100'
                                    } underline`}
                                >
                                    {banner.actionText} →
                                </a>
                            ) : null}
                        </div>
                    )}
                </div>
                <div className="ml-auto pl-3">
                    <div className="-mx-1.5 -my-1.5">
                        <button
                            type="button"
                            onClick={() => onDismiss(banner.id)}
                            className={`inline-flex rounded-md p-1.5 ${styles.icon} hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-offset-2`}
                        >
                            <span className="sr-only">Dismiss</span>
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function Page() {
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(new Set())
    const [refreshingData, setRefreshingData] = useState(false)
    const [refreshStatus, setRefreshStatus] = useState<string | null>(null)

    const fetchDashboardData = async () => {
        try {
            setLoading(true)
            setError(null)
            const data = await dashboardApi.getDashboardData()
            setDashboardData(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
            console.error('Dashboard data fetch error:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDashboardData()
    }, [])

    const handleRefresh = () => {
        fetchDashboardData()
    }

    const handleUsgsRefresh = async () => {
        try {
            setRefreshingData(true)
            setRefreshStatus('Starting USGS data refresh...')
            
            const response = await dashboardApi.refreshUsgsData()
            
            if (response.status === 'success') {
                setRefreshStatus('USGS data refresh started')
                
                // Monitor the job progress
                if (response.job_id) {
                    await jobApi.pollJob(response.job_id, (job) => {
                        // Update status from job's custom status message if available
                        if (job.status) {
                            setRefreshStatus(job.status)
                        }
                        
                        // Check job state (not status) for completion
                        if (job.state === 'started') {
                            if (!job.status) setRefreshStatus('Fetching data from USGS API...')
                        } else if (job.state === 'finished') {
                            setRefreshStatus('USGS data refresh completed')
                            setRefreshingData(false) // Reset refreshing state when job completes
                            // Immediately refresh dashboard data when job completes
                            fetchDashboardData()
                            setTimeout(() => {
                                setRefreshStatus(null)
                            }, 2000)
                        } else if (job.state === 'failed') {
                            setRefreshStatus(`Refresh failed: ${job.exc_info || 'Unknown error'}`)
                            setRefreshingData(false) // Reset refreshing state on failure
                            setTimeout(() => setRefreshStatus(null), 5000)
                        }
                    })
                }
            }
        } catch (err) {
            console.error('USGS refresh failed:', err)
            setRefreshStatus(`Refresh failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
            setRefreshingData(false) // Reset on error
            setTimeout(() => setRefreshStatus(null), 5000)
        }
    }

    const dismissBanner = (bannerId: string) => {
        setDismissedBanners(prev => new Set([...prev, bannerId]))
    }

    const handleBannerAction = (bannerId: string) => {
        if (bannerId === 'demo-mode') {
            // Trigger USGS data refresh when clicking "Update Now" in demo mode banner
            handleUsgsRefresh()
            // Dismiss the banner after clicking
            dismissBanner(bannerId)
        }
    }

    const getBanners = (): Array<{
        id: string
        type: 'emergency' | 'warning' | 'info'
        icon: any
        title: string
        message: string
        actionText?: string
        actionHref?: string
    }> => {
        const banners = []
        
        if (dashboardData) {
            // Emergency banner for high active alerts
            if (dashboardData.summary.active_alerts > 5 && !dismissedBanners.has('emergency-alerts')) {
                banners.push({
                    id: 'emergency-alerts',
                    type: 'emergency' as const,
                    icon: AlertCircle,
                    title: 'Emergency: High Alert Activity',
                    message: `${dashboardData.summary.active_alerts} active flood alerts detected. Emergency services have been notified. Call 911 for immediate flood emergencies.`,
                    actionText: 'View Alerts',
                    actionHref: '/alerts'
                })
            }
            
            // High risk banner
            if (dashboardData.summary.high_risk_watersheds > 3 && !dismissedBanners.has('high-risk')) {
                banners.push({
                    id: 'high-risk',
                    type: 'warning' as const,
                    icon: AlertTriangle,
                    title: 'High Risk Areas Detected',
                    message: `${dashboardData.summary.high_risk_watersheds} watersheds currently at high flood risk. Monitor conditions closely and avoid flood-prone areas.`,
                    actionText: 'View Risk Map',
                    actionHref: '/risk-map'
                })
            }
            
            // Real-time data status banner
            const hasRealTimeData = dashboardData.watersheds.some(w => 
                w.data_source && w.data_source !== 'sample' && w.data_source !== null && w.data_source !== undefined
            )
            const usgsCount = dashboardData.watersheds.filter(w => w.data_source === 'usgs').length
            
            // Debug logging to understand data source state
            if (import.meta.env.DEV) {
                console.log('Banner detection debug:', {
                    hasRealTimeData,
                    usgsCount,
                    watershedDataSources: dashboardData.watersheds.map(w => ({ 
                        name: w.name, 
                        data_source: w.data_source,
                        last_api_update: w.last_api_update
                    }))
                })
            }
            
            // System status banner - show appropriate message based on data state
            if (!hasRealTimeData && !dismissedBanners.has('demo-mode')) {
                banners.push({
                    id: 'demo-mode',
                    type: 'info' as const,
                    icon: Database,
                    title: 'Sample Data Mode',
                    message: 'System is displaying sample data for demonstration. Click "Update USGS Data" to fetch real-time monitoring data from USGS stations.',
                    actionText: 'Update Now',
                    actionHref: '#'
                })
            } else if (hasRealTimeData && !dismissedBanners.has('real-time-active')) {
                banners.push({
                    id: 'real-time-active',
                    type: 'info' as const,
                    icon: CheckCircle,
                    title: 'Real-Time Data Active',
                    message: `System is now using live data from ${usgsCount} USGS monitoring stations. Data automatically updates every hour for accurate flood monitoring.`,
                    actionText: 'View Details',
                    actionHref: '/settings'
                })
            }
        }
        
        return banners
    }

    // Show loading skeleton when loading and no data
    if (loading && !dashboardData) {
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
                                        <BreadcrumbPage>Dashboard</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>
                    </header>
                    <div className="flex flex-1 flex-col gap-6 p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <LoadingSkeleton key={index} lines={2} className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm border dark:border-slate-700" />
                            ))}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <ChartLoadingSkeleton height={400} className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm border dark:border-slate-700" />
                            <ChartLoadingSkeleton height={400} className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm border dark:border-slate-700" />
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
                                        <BreadcrumbPage>Dashboard</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>
                    </header>
                    <div className="flex flex-1 flex-col items-center justify-center p-6">
                        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Unable to Load Dashboard</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
                        <button onClick={handleRefresh} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Retry
                        </button>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        )
    }

    if (!dashboardData) return null

    // Sample trend data for chart (in production this would come from the API)
    const riskTrendData = [
        { time: '00:00', risk: 3.2, alerts: 1 },
        { time: '02:00', risk: 3.5, alerts: 1 },
        { time: '04:00', risk: 3.8, alerts: 2 },
        { time: '06:00', risk: 4.1, alerts: 2 },
        { time: '08:00', risk: 4.5, alerts: 3 },
        { time: '10:00', risk: 4.9, alerts: 3 },
        { time: '12:00', risk: 5.2, alerts: 2 },
        { time: '14:00', risk: 5.7, alerts: 3 },
        { time: '16:00', risk: 6.1, alerts: 4 },
        { time: '18:00', risk: 6.3, alerts: 4 },
        { time: '20:00', risk: 5.8, alerts: 3 },
        { time: '22:00', risk: 5.6, alerts: 3 },
        { time: '24:00', risk: 5.5, alerts: 2 }
    ]

    const riskDistributionData = [
        { name: 'Low Risk', value: dashboardData.summary.low_risk_watersheds, color: '#22c55e' },
        { name: 'Moderate Risk', value: dashboardData.summary.moderate_risk_watersheds, color: '#f59e0b' },
        { name: 'High Risk', value: dashboardData.summary.high_risk_watersheds, color: '#ef4444' }
    ]

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
                                    <BreadcrumbPage>Dashboard</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </header>

                <div className="flex flex-1 flex-col gap-6 p-6">
                    {/* Header */}
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Flood Risk Dashboard</h1>
                            <p className="text-gray-600 dark:text-gray-400">Real-time monitoring of Texas watersheds</p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                Last updated: {formatTimestamp(dashboardData.summary.last_updated)}
                            </div>
                            {/* Data refresh status */}
                            {refreshStatus && (
                                <div className="flex items-center text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-md">
                                    <Clock className="h-4 w-4 mr-2" />
                                    {refreshStatus}
                                </div>
                            )}
                            {/* Emergency 911 Banner */}
                            <div className="bg-red-600 text-white px-4 py-2 rounded-md border border-red-700 shadow-sm">
                                <div className="flex items-center space-x-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <span className="text-sm font-semibold">Emergency: 911</span>
                                </div>
                            </div>
                            {/* USGS Data Refresh Button */}
                            <button 
                                onClick={handleUsgsRefresh}
                                disabled={refreshingData}
                                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Refresh real-time data from USGS"
                            >
                                <Database className={`h-4 w-4 mr-2 ${refreshingData ? 'animate-pulse' : ''}`} />
                                {refreshingData ? 'Updating...' : 'Update USGS Data'}
                            </button>
                            {/* Dashboard Refresh Button */}
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

                    {/* Warning Banners */}
                    {getBanners().map((banner) => (
                        <WarningBanner
                            key={banner.id}
                            banner={banner}
                            onDismiss={dismissBanner}
                            onActionClick={handleBannerAction}
                        />
                    ))}

                    {/* Metrics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <MetricCard
                            title="Total Watersheds"
                            value={dashboardData.summary.total_watersheds}
                            icon={MapPin}
                            color="blue"
                        />
                        <MetricCard
                            title="Active Alerts"
                            value={dashboardData.summary.active_alerts}
                            change="+2 from yesterday"
                            trend="up"
                            icon={AlertTriangle}
                            color="red"
                        />
                        <MetricCard
                            title="High Risk Areas"
                            value={dashboardData.summary.high_risk_watersheds}
                            change="-1 from yesterday"
                            trend="down"
                            icon={Activity}
                            color="yellow"
                        />
                        <MetricCard
                            title="AI Accuracy"
                            value="85.3%"
                            change="+0.8% from last week"
                            trend="up"
                            icon={BarChart3}
                            color="green"
                        />
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Risk Trend Chart */}
                        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm border dark:border-slate-700">
                            <div className="p-6 border-b dark:border-slate-700">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">24-Hour Risk Trend</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Average risk score across all watersheds</p>
                            </div>
                            <div className="p-6">
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={riskTrendData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="time" />
                                        <YAxis domain={[0, 10]} />
                                        <Tooltip 
                                            formatter={(value: any, name: any) => [
                                                name === 'risk' ? `${value} / 10` : value,
                                                name === 'risk' ? 'Risk Score' : 'Active Alerts'
                                            ]}
                                        />
                                        <Area type="monotone" dataKey="risk" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                                        <Area type="monotone" dataKey="alerts" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Risk Distribution */}
                        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm border dark:border-slate-700">
                            <div className="p-6 border-b dark:border-slate-700">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Risk Distribution</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Current watershed risk levels</p>
                            </div>
                            <div className="p-6">
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={riskDistributionData}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                            label={({ name, value, percent }: any) => 
                                                `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                                            }
                                        >
                                            {riskDistributionData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>


                    {/* Recent Alerts and Top Watersheds */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Recent Alerts */}
                        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm border dark:border-slate-700">
                            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Alerts</h3>
                                <button className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                                    <Eye className="h-4 w-4 mr-1" />
                                    View All
                                </button>
                            </div>
                            <div className="p-6">
                                {dashboardData.alerts.length > 0 ? (
                                    <div className="space-y-4">
                                        {dashboardData.alerts.slice(0, 3).map((alert, index) => (
                                            <div key={alert.alert_id || index} className="border-l-4 border-l-red-500 pl-4">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="font-medium text-gray-900 dark:text-white">{alert.alert_type}</h4>
                                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                            {alert.watershed} - {alert.message}
                                                        </p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                            {formatTimestamp(alert.issued_time)}
                                                        </p>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskBadgeClass(alert.severity)}`}>
                                                        {alert.severity}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <AlertTriangle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                        <p className="text-gray-600 dark:text-gray-400">No active alerts</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Top Risk Watersheds */}
                        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm border dark:border-slate-700">
                            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Highest Risk Watersheds</h3>
                                <button className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                                    <Eye className="h-4 w-4 mr-1" />
                                    View Map
                                </button>
                            </div>
                            <div className="p-6">
                                {dashboardData.watersheds.length > 0 ? (
                                    <div className="space-y-4">
                                        {dashboardData.watersheds.slice(0, 5).map((watershed, index) => (
                                            <div key={watershed.id || index} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="font-medium text-gray-900 dark:text-white">{watershed.name}</h4>
                                                        </div>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <DataSourceBadge 
                                                                source={watershed.data_source}
                                                                quality={watershed.data_quality}
                                                                siteCode={watershed.usgs_site_code}
                                                            />
                                                        </div>
                                                        <div className="mt-1 space-y-1">
                                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                                Flow: {formatStreamflow(watershed.current_streamflow_cfs)}
                                                            </p>
                                                            {watershed.trend && watershed.trend !== 'stable' && (
                                                                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                                                    {watershed.trend === 'rising' ? 
                                                                        <TrendingUp className="h-3 w-3 text-red-500 mr-1" /> :
                                                                        <TrendingDown className="h-3 w-3 text-green-500 mr-1" />
                                                                    }
                                                                    <span className={watershed.trend === 'rising' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                                                                        {watershed.trend} {watershed.trend_rate_cfs_per_hour && Math.abs(watershed.trend_rate_cfs_per_hour) > 1 ? 
                                                                            `(${Math.abs(watershed.trend_rate_cfs_per_hour).toFixed(1)} CFS/hr)` : ''}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {watershed.last_api_update && (
                                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                    Data updated: {formatTimestamp(watershed.last_api_update)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskBadgeClass(watershed.current_risk_level)}`}>
                                                            {watershed.current_risk_level}
                                                        </span>
                                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                            {watershed.risk_score}/10
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <MapPin className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                        <p className="text-gray-600 dark:text-gray-400">No watershed data available</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}