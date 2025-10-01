'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, BarChart3, Activity, Calendar, RefreshCw, AlertTriangle, Download } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { analyticsApi, type AnalyticsData } from '@/lib/api'
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
  const [timeRange, setTimeRange] = useState('7d')
  const [selectedMetric, setSelectedMetric] = useState('risk_score')
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await analyticsApi.getAnalyticsData(timeRange, selectedMetric)
      setAnalyticsData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics data')
      console.error('Failed to fetch analytics data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalyticsData()
  }, [timeRange, selectedMetric])

  const handleRefresh = () => {
    fetchAnalyticsData()
  }

  // Metric card component
  const StatCard = ({ title, value, change, icon: Icon, trend, color = 'blue' }: {
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
              {trend === 'down' && <TrendingUp className="h-4 w-4 mr-1 rotate-180" />}
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

  // Show loading skeleton when loading and no data
  if (loading && !analyticsData) {
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
                    <BreadcrumbPage>Analytics</BreadcrumbPage>
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
                    <BreadcrumbPage>Analytics</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-1 flex-col items-center justify-center p-6">
            <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error Loading Analytics</h3>
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

  if (!analyticsData) return null

  const data = analyticsData

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
                  <BreadcrumbPage>Analytics</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Flood Analytics</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Historical trends and predictive insights for Texas watersheds
              </p>
            </div>

            <div className="flex items-center space-x-4">
              {/* Time Range Selector */}
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                </select>
              </div>

              {/* Metric Selector */}
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <select
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="risk_score">Risk Score</option>
                  <option value="flow">Stream Flow</option>
                  <option value="alerts">Alert Count</option>
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

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Average Risk Score"
              value={`${data.summary.avg_risk_score}/10`}
              change="+0.3 from last week"
              trend="up"
              icon={Activity}
              color="yellow"
            />
            <StatCard
              title="High Risk Watersheds"
              value={data.summary.high_risk_count}
              change="-1 from yesterday"
              trend="down"
              icon={AlertTriangle}
              color="red"
            />
            <StatCard
              title="Average Flow"
              value={`${data.summary.avg_flow.toLocaleString()} CFS`}
              change="+150 CFS from yesterday"
              trend="up"
              icon={TrendingUp}
              color="blue"
            />
            <StatCard
              title="Trending Up"
              value={data.summary.trending_up_count}
              change="2 more than yesterday"
              trend="up"
              icon={BarChart3}
              color="yellow"
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Historical Trend Chart */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm border dark:border-slate-700">
              <div className="p-6 border-b dark:border-slate-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {timeRange === '7d' ? '7-Day' : timeRange === '30d' ? '30-Day' : '90-Day'} Risk Trend
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Average risk score across all watersheds
                </p>
              </div>
              <div className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.historical_data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={[0, 10]} />
                    <Tooltip 
                      formatter={(value: any, name: string) => [
                        name === 'avg_risk_score' ? `${value} / 10` : value,
                        name === 'avg_risk_score' ? 'Average Risk Score' : 'Alert Count'
                      ]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="avg_risk_score" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="alerts_count" 
                      stroke="#ef4444" 
                      fill="#ef4444"
                      fillOpacity={0.1}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Risk Distribution Pie Chart */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm border dark:border-slate-700">
              <div className="p-6 border-b dark:border-slate-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Current Risk Distribution</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Watershed risk level breakdown
                </p>
              </div>
              <div className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.risk_distribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                    >
                      {data.risk_distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any, name: string) => [`${value} watersheds`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Watershed Risk Comparison */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm border dark:border-slate-700">
              <div className="p-6 border-b dark:border-slate-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Watershed Risk Comparison
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Current risk scores by watershed
                </p>
              </div>
              <div className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.watershed_comparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 10]} />
                    <Tooltip 
                      formatter={(value: any, name: string) => [
                        name === 'risk_score' ? `${value} / 10` : `${value}%`,
                        name === 'risk_score' ? 'Risk Score' : 'Capacity Used'
                      ]}
                    />
                    <Bar dataKey="risk_score" fill="#3b82f6" name="Risk Score" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Flow vs Flood Stage */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm border dark:border-slate-700">
              <div className="p-6 border-b dark:border-slate-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Flow vs Flood Stage
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Current flow relative to flood stage
                </p>
              </div>
              <div className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.flow_comparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any, name: string) => [
                        `${Number(value).toLocaleString()} CFS`,
                        name === 'current_flow' ? 'Current Flow' : 'Flood Stage'
                      ]}
                    />
                    <Bar dataKey="current_flow" fill="#22c55e" name="Current Flow" />
                    <Bar dataKey="flood_stage" fill="#ef4444" name="Flood Stage" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm border dark:border-slate-700">
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Detailed Watershed Analytics
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Complete data breakdown for all monitored watersheds
                </p>
              </div>
              <button className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md">
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </button>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-neutral-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Watershed
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Risk Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Current Flow
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Flood Stage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Capacity Used
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Trend
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-neutral-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {data.watershed_comparison.map((watershed, index) => {
                      const flowData = data.flow_comparison.find(f => f.name === watershed.name);
                      return (
                        <tr key={watershed.name} className={index % 2 === 0 ? 'bg-white dark:bg-neutral-900' : 'bg-gray-50 dark:bg-neutral-800'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {watershed.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            <Badge 
                              variant={
                                watershed.risk_score >= 7 ? 'destructive' :
                                watershed.risk_score >= 4 ? 'secondary' :
                                'outline'
                              }
                            >
                              {watershed.risk_score}/10
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {watershed.current_flow.toLocaleString()} CFS
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {flowData?.flood_stage.toLocaleString() || 'N/A'} CFS
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {watershed.flow_ratio}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center text-gray-600 dark:text-gray-400">
                              <TrendingUp className="h-4 w-4 mr-1" />
                              <span className="text-sm">Stable</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}