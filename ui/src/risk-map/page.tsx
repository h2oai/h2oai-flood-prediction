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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from 'react'
import { 
    MapPin, 
    RefreshCw, 
    AlertTriangle,
    Eye,
    BarChart3,
    Info
} from 'lucide-react'
import { dashboardApi, type DashboardData } from '@/lib/api'
import GlobalWatershedMap from '@/components/GlobalWatershedMap'

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



// Loading skeleton
const LoadingSkeleton = ({ className = "" }: { className?: string }) => (
    <div className={`animate-pulse ${className}`}>
        <div className="space-y-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
    </div>
)

// Map loading skeleton
const MapLoadingSkeleton = ({ className = "" }: { className?: string }) => (
    <div className={`animate-pulse ${className}`}>
        <div className="w-full h-[600px] bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <div className="text-center">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Loading map...</p>
            </div>
        </div>
    </div>
)

export default function RiskMapPage() {
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    // Removed unused state variables since MapView handles them internally

    const fetchDashboardData = async () => {
        try {
            setLoading(true)
            setError(null)
            const data = await dashboardApi.getDashboardData()
            setDashboardData(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load map data')
            console.error('Map data fetch error:', err)
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
                                        <BreadcrumbPage>Risk Map</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>
                    </header>
                    <div className="flex flex-1 flex-col gap-6 p-6">
                        <div className="space-y-6">
                            {/* <LoadingSkeleton className="h-20 bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm border dark:border-slate-700" /> */}
                            <MapLoadingSkeleton />
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <LoadingSkeleton className="h-40 bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm border dark:border-slate-700" />
                                <LoadingSkeleton className="h-40 bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm border dark:border-slate-700" />
                            </div>
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
                                        <BreadcrumbPage>Risk Map</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>
                    </header>
                    <div className="flex flex-1 flex-col items-center justify-center p-6">
                        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Unable to Load Map</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
                        <Button onClick={handleRefresh}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Retry
                        </Button>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        )
    }

    if (!dashboardData) return null

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
                                    <BreadcrumbPage>Risk Map</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </header>

                <div className="flex flex-1 flex-col gap-6 p-6">
                    {/* Header */}
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Texas Flood Risk Map</h1>
                            <p className="text-gray-600 dark:text-gray-400">Interactive map showing all {dashboardData.watersheds.length} monitored watersheds</p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                Last updated: {formatTimestamp(dashboardData.summary.last_updated)}
                            </div>
                            <Button onClick={handleRefresh} variant="outline">
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Global Watershed Map */}
                    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm border dark:border-slate-700">
                        <div className="p-6 border-b dark:border-slate-700">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Watershed Locations & Risk Levels</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Click on any watershed marker to view detailed information</p>
                        </div>
                        <div className="p-6">
                            <GlobalWatershedMap 
                                watersheds={dashboardData.watersheds}
                                height="600px"
                                onWatershedClick={(watershed) => {
                                    console.log('Viewing details for:', watershed.name);
                                    // Future: Could show detailed watershed modal/drawer
                                }}
                            />
                        </div>
                    </div>

                    {/* Bottom Stats and Info */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Map Statistics */}
                        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm border dark:border-slate-700">
                            <div className="p-6 border-b dark:border-slate-700">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5" />
                                    Current Statistics
                                </h3>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {dashboardData.watersheds.length}
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Watersheds Shown
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                                            {dashboardData.alerts.length}
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Active Alerts
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                                            {dashboardData.summary.high_risk_watersheds}
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            High Risk
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                            {dashboardData.summary.low_risk_watersheds}
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Low Risk
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Risk Level Legend */}
                        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm border dark:border-slate-700">
                            <div className="p-6 border-b dark:border-slate-700">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                    <Info className="h-5 w-5" />
                                    Risk Level Legend
                                </h3>
                            </div>
                            <div className="p-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full bg-green-500"></div>
                                        <div>
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">Low Risk</span>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">Normal conditions, routine monitoring</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                                        <div>
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">Moderate Risk</span>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">Elevated conditions, increased caution</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full bg-red-500"></div>
                                        <div>
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">High Risk</span>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">Dangerous conditions, immediate attention required</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Active Alerts Summary */}
                    {dashboardData.alerts.length > 0 && (
                        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm border dark:border-slate-700">
                            <div className="p-6 border-b dark:border-slate-700">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5" />
                                    Active Flood Alerts ({dashboardData.alerts.length})
                                </h3>
                            </div>
                            <div className="p-6">
                                <div className="space-y-4">
                                    {dashboardData.alerts.slice(0, 3).map((alert, index) => (
                                        <div key={alert.alert_id || index} className="flex items-start gap-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 rounded-lg">
                                            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <h4 className="font-medium text-gray-900 dark:text-white">{alert.alert_type}</h4>
                                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                            {alert.watershed} - {alert.message}
                                                        </p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                            {formatTimestamp(alert.issued_time)}
                                                        </p>
                                                    </div>
                                                    <Badge className={getRiskBadgeClass(alert.severity)}>
                                                        {alert.severity}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {dashboardData.alerts.length > 3 && (
                                        <div className="text-center">
                                            <Button variant="outline" size="sm">
                                                <Eye className="h-4 w-4 mr-2" />
                                                View All {dashboardData.alerts.length} Alerts
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}