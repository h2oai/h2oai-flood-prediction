'use client'

import { useState, useEffect, useRef } from 'react'
import {
    Activity,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    MapPin,
    RefreshCw,
    Clock,
    Send,
    Bot,
    Settings,
    Star,
    BarChart3,
    Sparkles,
    Brain,
    ChevronDown,
    ChevronUp
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { dashboardApi, analyticsApi, aiApi, jobApi, agentsApi, type DashboardData, type AnalyticsData, type AgentSummary, type AgentInsight } from '@/lib/api'
import GlobalWatershedMap from '@/components/GlobalWatershedMap'
import { TubelightNavbar } from '@/components/TubelightNavbar'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import ThinkingDisplay from '@/components/ThinkingDisplay'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { ScrollArea } from "@/components/ui/scroll-area"
import h2oIcon from '@/assets/h2o.ico'

interface Message {
    id: number
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    confidence?: number
    recommendations?: string[]
    isError?: boolean
    isStreaming?: boolean
    natAgent?: {
        type: string
        location?: string
        logs: Array<{ level: string; message: string }>
    }
    evaluation?: {
        id: string
        overall_score: number
        confidence: number
        safety_score: number
        helpfulness: number
        accuracy: number
        reasoning: string
    }
}

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
        case 'High': return 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
        case 'Moderate': return 'bg-yellow-500/25 text-yellow-300 border border-yellow-500/35'
        case 'Low': return 'bg-amber-400/20 text-amber-200 border border-amber-400/30'
        default: return 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
    }
}

const getUrgencyBadgeClass = (urgency: string): string => {
    switch (urgency) {
        case 'critical': return 'bg-red-500/20 text-red-400 border border-red-500/30'
        case 'high': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
        case 'normal': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
        case 'low': return 'bg-green-500/20 text-green-400 border border-green-500/30'
        default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
    }
}

const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
        case 'up': return <TrendingUp className="h-3 w-3 text-red-400" />
        case 'down': return <TrendingDown className="h-3 w-3 text-green-400" />
        default: return null
    }
}

const getAgentInsightDescription = (title: string, agentType: string): { title: string, description: string, dataSource: string, technicalDetails?: string, urls?: string[]} => {
    const insights: Record<string, Record<string, { title: string, description: string, dataSource: string, technicalDetails?: string, urls?: string[]}>> = {
        data_collector: {
            "🔄 Data Freshness": {
                title: "🔄 Data Freshness",
                description: "Monitors how current our flood monitoring data is across all sources. Calculates age-weighted freshness scores based on last update timestamps from each API endpoint. Data older than 2 hours is flagged as stale.",
                dataSource: "Real-time from USGS water monitoring stations and weather APIs",
                technicalDetails: "• Updates every 5 minutes (300s interval)\n• Tracks last_usgs_update, last_noaa_update, last_weather_update\n• Freshness score: 100% - (age_minutes / 60) * 10%\n• Stale threshold: 2 hours for critical alerts",
                urls: [
                    "https://waterservices.usgs.gov/nwis/iv/",
                    "https://api.weather.gov/alerts",
                    "https://api.open-meteo.com/v1/forecast",
                    "https://flood-api.open-meteo.com/v1/flood"
                ],
            },
            "🌐 API Connectivity": {
                title: "🌐 API Connectivity",
                description: "Real-time status monitoring of all external data sources. Tests connectivity to USGS water services, NOAA weather alerts, NOAA tides, OpenMeteo weather, and flood APIs. Each API is tested with specific endpoints and parameters.",
                dataSource: "External flood monitoring APIs and weather services",
                technicalDetails: "• Tests 5 major APIs: USGS, NOAA Weather, NOAA Tides, OpenMeteo Weather, OpenMeteo Flood\n• HTTP status checks with 10-second timeouts\n• Retries failed connections up to 3 times\n• Custom headers and test parameters for each API",
                urls: [
                    "https://waterservices.usgs.gov/nwis/iv/",
                    "https://api.weather.gov/alerts",
                    "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter",
                    "https://api.open-meteo.com/v1/forecast",
                    "https://flood-api.open-meteo.com/v1/flood"
                ],
            },
            "📊 Data Quality": {
                title: "📊 Data Quality Score",
                description: "Comprehensive assessment of data accuracy and completeness. Combines API availability (40%), data freshness (60%), and data completeness factors. Monitors sensor reliability, validates data consistency, and tracks validation check results.",
                dataSource: "Automated quality checks on incoming sensor data",
                technicalDetails: "• Quality Score = (API_availability * 0.4 + Data_freshness * 0.6)\n• Baseline completeness score: 8.0/10\n• Factors: Working APIs ratio, data age, validation results\n• Updates stored in agent history for trend analysis",
                urls: [
                    "https://water.usgs.gov/GIS/huc.html",
                    "https://www.weather.gov/documentation/services-web-api"
                ],
            },
            "⚡ Update Frequency": {
                title: "⚡ Update Frequency",
                description: "Tracks how often we receive new data from monitoring stations. Higher frequency provides better flood prediction accuracy and faster emergency response. Calculated based on agent check intervals and successful data collection cycles.",
                dataSource: "USGS and NOAA real-time monitoring networks",
                technicalDetails: "• Base frequency: 3600 seconds ÷ check_interval\n• Default: Every 5 minutes = 12 updates/hour\n• USGS updates: Every 15-60 minutes\n• Weather data: Hourly updates\n• Emergency mode: Can increase to 1-minute intervals",
                urls: [
                    "https://help.waterdata.usgs.gov/faq/automated-retrievals",
                    "https://www.weather.gov/documentation/services-web-api#/default/alerts_active"
                ],
            }
        },
        risk_analyzer: {
            "🎯 Overall Risk Level": {
                title: "🎯 Overall Risk Level",
                description: "Comprehensive flood risk assessment across all monitored watersheds using weighted averaging based on basin size. Combines real-time water levels, weather patterns, historical data, and trend analysis. Risk levels: LOW (<4), MODERATE (4-6), HIGH (6-8), CRITICAL (8+).",
                dataSource: "AI analysis of real-time sensor data and weather forecasts",
                technicalDetails: "• Weighted average: (risk_score × basin_size) ÷ total_weight\n• Updates every 10 minutes (600s interval)\n• History tracking: 24-hour rolling window\n• Change detection threshold: ±0.5 points\n• Combines streamflow ratios, flood stage proximity, trend rates",
                urls: [
                    "https://water.usgs.gov/edu/hgstage.html",
                    "https://www.weather.gov/aprfc/terminology",
                    "https://www.usgs.gov/special-topics/water-science-school/science/streamflow-and-water-cycle"
                ],
            },
            "🚨 Critical Watersheds": {
                title: "🚨 Critical Watersheds",
                description: "Real-time count of watersheds exceeding critical risk thresholds (≥8.0/10). Tracks rapid changes in critical area counts and identifies watersheds requiring immediate emergency response attention.",
                dataSource: "Watershed monitoring stations and flood stage thresholds",
                technicalDetails: "• Critical threshold: risk_score ≥ 8.0\n• Tracks count changes vs previous assessment\n• Monitors: current_streamflow vs flood_stage\n• Factors: trend_rate >100 CFS/hour, near flood capacity >90%\n• Updates previous_critical_count for change detection",
                urls: [
                    "https://www.weather.gov/aprfc/terminology",
                    "https://water.usgs.gov/edu/measuring-flood.html"
                ],
            },
            "📈 Risk Trend Analysis": {
                title: "📈 Risk Trend Analysis",
                description: "Advanced temporal analysis of flood risk patterns using linear regression on recent risk history. Calculates rate of change per hour and determines if conditions are improving, stable, or deteriorating across the monitoring network.",
                dataSource: "Historical analysis of water levels and weather patterns",
                technicalDetails: "• Linear trend calculation on last 6 data points\n• Slope formula: (n×Σxy - ΣxΣy) ÷ (n×Σx² - (Σx)²)\n• Rate conversion: slope × 10 for percentage scale\n• Thresholds: >0.5% increasing, <-0.5% decreasing\n• Time window: Recent 6 hours with 10-minute intervals",
                urls: [
                    "https://www.usgs.gov/mission-areas/water-resources/science/streamflow-trends",
                    "https://waterwatch.usgs.gov/"
                ],
            },
            "🧠 AI Confidence": {
                title: "🧠 AI Confidence Level",
                description: "Statistical confidence measurement in current risk predictions based on data quality, freshness, and model validation. Considers data source reliability, update recency, and historical prediction accuracy to provide uncertainty estimates.",
                dataSource: "Machine learning model uncertainty analysis",
                technicalDetails: "• Base confidence calculation from data freshness and quality\n• Data age factor: confidence × 0.8 if data >2 hours old\n• Trend stability factor: confidence × 0.9 if instability <0.7\n• USGS data preference: higher weight for government sources\n• Confidence bands: 90%+ Very High, 75%+ High, 60%+ Moderate, <60% Low",
                urls: [
                    "https://www.usgs.gov/mission-areas/water-resources/science/uncertainty-streamflow-measurements",
                    "https://pubs.usgs.gov/tm/tm4-a1/"
                ],
            }
        },
        emergency_responder: {
            "🚨 Active Incidents": {
                title: "🚨 Active Flood Incidents",
                description: "Real-time tracking of ongoing flood emergencies requiring coordinated response. Monitors flash flood conditions, infrastructure stress, population threats, and evacuation operations. Includes evacuations, water rescues, emergency services deployment, and shelter activations.",
                dataSource: "Emergency services and incident reporting systems",
                technicalDetails: "• Updates every 3 minutes (180s interval)\n• Flash flood indicators: trend_rate >200 CFS/h + near_capacity >80%\n• Infrastructure stress: current_flow >95% flood_stage\n• Population risk estimation: basin_size × 150 people/sq.mi\n• Incident types: Flash flood, Infrastructure failure, Population threat",
                urls: [
                    "https://www.ready.gov/floods",
                    "https://www.fema.gov/emergency-managers/risk-management/floods",
                    "https://www.weather.gov/safety/flood"
                ],
            },
            "🚁 Response Readiness": {
                title: "🚁 Emergency Response Readiness",
                description: "Operational capacity assessment of emergency teams and resources available for immediate deployment. Calculates readiness percentage based on available teams, equipment status, and current incident load. Factors in resource allocation and response capability degradation.",
                dataSource: "Emergency services resource management systems",
                technicalDetails: "• Base readiness: 85% operational capacity\n• Reduction: 10% per active incident (max 30% reduction)\n• Team availability: 8 total teams - active incidents\n• Readiness levels: 90%+ Optimal, 75%+ Good, 60%+ Adequate, <60% Limited\n• Resource monitoring: Personnel, equipment, vehicles",
                urls: [
                    "https://www.fema.gov/emergency-managers/nims",
                    "https://training.fema.gov/emiweb/is/is200b/",
                    "https://www.ready.gov/community-emergency-response-team"
                ],
            },
            "🏃 Evacuation Status": {
                title: "🏃 Evacuation Status",
                description: "Current evacuation orders and status of affected areas. Tracks voluntary and mandatory evacuation zones, monitors population displacement, and coordinates with local authorities. Includes shelter capacity and transportation logistics.",
                dataSource: "Emergency management and evacuation coordination systems",
                technicalDetails: "• Zone categorization: Voluntary vs Mandatory evacuation\n• Status tracking: self.evacuation_zones set management\n• Population estimation per zone\n• Coordination points: Local authorities, shelters, transportation\n• Zone hash-based classification for evacuation type determination",
                urls: [
                    "https://www.ready.gov/evacuation",
                    "https://www.fema.gov/emergency-managers/individuals-communities/evacuation-plans",
                    "https://www.redcross.org/get-help/disaster-relief-and-recovery-services/find-an-open-shelter"
                ],
            },
            "📡 Communication Systems": {
                title: "📡 Communication Systems",
                description: "Status monitoring of critical emergency communication networks including EAS, NOAA Weather Radio, cell broadcast systems, social media alerts, and municipal systems. Essential for coordinating response efforts and public warning dissemination.",
                dataSource: "Emergency communication infrastructure monitoring",
                technicalDetails: "• 6 monitored systems: EAS, NOAA Radio, Cell Broadcast, Social Media, TV/Radio, Municipal\n• Operational percentage calculation\n• System redundancy and failover monitoring\n• Alert channel diversity for maximum coverage\n• Real-time status updates and failure detection",
                urls: [
                    "https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system",
                    "https://www.weather.gov/nwr/",
                    "https://www.fcc.gov/consumers/guides/emergency-alert-system-eas"
                ],
            },
            "📢 Alert Distribution": {
                title: "📢 Alert Distribution",
                description: "Comprehensive tracking of flood warnings and emergency alerts sent to the public through multiple channels. Monitors distribution statistics, delivery success rates, and audience reach across SMS, radio, mobile apps, and social media platforms.",
                dataSource: "Emergency alert and notification systems",
                technicalDetails: "• Notification history tracking with timestamps\n• Channel diversity: EAS, Cell, Social, Radio\n• Alert statistics: Last hour count, daily totals\n• Distribution success monitoring\n• History management: Rolling 1000 alert limit\n• Integration with multiple alert platforms",
                urls: [
                    "https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system",
                    "https://www.ctia.org/positions/wireless-emergency-alerts",
                    "https://alerts.weather.gov/"
                ],
            }
        },
        predictor: {
            "🎯 Model Accuracy": {
                title: "🎯 AI Model Accuracy",
                description: "Comprehensive validation of flood prediction models through backtesting against actual flood events. Tracks accuracy across different time horizons, watershed types, and flood scenarios. Uses rolling window validation and ensemble model performance metrics.",
                dataSource: "Historical validation of AI predictions vs actual events",
                technicalDetails: "• Updates every 15 minutes (900s interval)\n• Validation window: 6+ hours post-prediction\n• Accuracy calculation: Predicted vs actual risk scores\n• Rolling accuracy: Last 4 predictions comparison\n• Trend analysis: Recent vs older prediction performance\n• Target accuracy: >85% for reliable forecasting",
                urls: [
                    "https://www.usgs.gov/mission-areas/water-resources/science/streamflow-prediction",
                    "https://www.weather.gov/aprfc/hydrology",
                    "https://toolkit.climate.gov/tool/streamflow-prediction-tool"
                ],
            },
            "🧠 Prediction Confidence": {
                title: "🧠 Prediction Confidence",
                description: "Statistical confidence assessment in current flood forecasts using ensemble methods and uncertainty quantification. Factors in data quality, model agreement, historical performance, and prediction stability to provide reliability estimates.",
                dataSource: "AI model uncertainty and ensemble analysis",
                technicalDetails: "• Ensemble confidence from watershed-level predictions\n• Data age weighting: confidence × 0.8 if data >2h old\n• Trend stability impact: confidence × 0.9 if unstable\n• Forecast horizon degradation: confidence × 0.8 for >24h\n• Confidence levels: 85%+ Very High, 70%+ High, 55%+ Moderate, <55% Low",
                urls: [
                    "https://www.weather.gov/aprfc/uncertainty",
                    "https://pubs.usgs.gov/of/2008/1365/pdf/ofr2008-1365.pdf"
                ],
            },
            "🔮 Forecast Horizon": {
                title: "🔮 Forecast Horizon",
                description: "Assessment of reliable prediction timeframe based on data quality, model performance, and hydrological conditions. Determines how far into the future forecasts remain actionable for emergency planning and resource allocation.",
                dataSource: "Predictive model performance analysis",
                technicalDetails: "• Base quality: 90% with degradation over time\n• Data freshness factor: Recent data ratio analysis\n• Quality adjustment: ±10% based on data availability\n• Horizon ranges: 24h (poor data), 48h (standard), 72h (excellent data)\n• Reliable threshold: Quality score >75%",
                urls: [
                    "https://www.weather.gov/aprfc/flood_forecast",
                    "https://www.usgs.gov/mission-areas/water-resources/science/real-time-streamflow-conditions"
                ],
            },
            "⏰ Next Critical Period": {
                title: "⏰ Next Critical Period",
                description: "Predictive analysis of when flood conditions will reach critical levels. Uses trend analysis, weather forecasting, and hydrological modeling to estimate timing of peak risk periods for proactive emergency preparation.",
                dataSource: "Weather forecasts and hydrological modeling",
                technicalDetails: "• Critical condition threshold: risk_score ≥ 8.5\n• Trend analysis: trend_rate >50 CFS/h + current_risk >5\n• Time calculation: (8.5 - current_risk) ÷ (trend_rate/100)\n• Minimum prediction: 1 hour, maximum: 72 hours\n• Confidence degradation: 95% - (hours × 2%)\n• Severity classification based on trend_rate intensity",
                urls: [
                    "https://www.weather.gov/aprfc/flood_forecast",
                    "https://toolkit.climate.gov/tool/climate-explorer-precipitation-temperature-maps-and-data"
                ],
            },
            "📈 Trend Accuracy": {
                title: "📈 Trend Prediction Accuracy",
                description: "Performance evaluation of trend forecasting capabilities across different temporal scales. Measures how well the system predicts directional changes, rate of change, and inflection points in flood risk evolution.",
                dataSource: "Trend analysis validation and historical comparison",
                technicalDetails: "• Base trend accuracy: 82% with performance tracking\n• Validation against actual trend outcomes\n• Performance categories: 85%+ Excellent, 75%+ Good, 65%+ Fair, <65% Poor\n• Recent performance weighting for adaptive accuracy\n• Trend complexity factors: Seasonal patterns, weather variability",
                urls: [
                    "https://www.usgs.gov/mission-areas/water-resources/science/streamflow-trends",
                    "https://waterwatch.usgs.gov/index.php?id=ww_current"
                ],
            }
        },
        h2ogpte_agent: {
            "🤖 Model Performance": {
                title: "🤖 Model Performance",
                description: "ML model accuracy and performance metrics for flood prediction models trained using H2OGPTE and Driverless AI. Tracks model accuracy, precision, recall, and overall performance on flood prediction tasks using AutoML capabilities.",
                dataSource: "H2OGPTE AutoML platform and Driverless AI model evaluation",
                technicalDetails: "• Model accuracy tracking across training sessions\n• Performance metrics: Accuracy, Precision, Recall, F1-Score\n• Driverless AI AutoML model evaluations\n• Cross-validation performance monitoring\n• Time-series model performance for flood prediction\n• Feature importance analysis and model interpretability",
                urls: [
                    "https://docs.h2o.ai/h2o/latest-stable/h2o-docs/automl.html",
                    "https://docs.h2o.ai/driverless-ai/latest-stable/docs/userguide/index.html"
                ],
            },
            "🔬 Training Status": {
                title: "🔬 Training Status",
                description: "Current status of AutoML training experiments and model development using H2OGPTE agent. Monitors active training sessions, experiment progress, and queued model training tasks for flood prediction optimization.",
                dataSource: "H2OGPTE agent training sessions and Driverless AI experiments",
                technicalDetails: "• Active experiment tracking\n• Training session management\n• Queue monitoring for model training tasks\n• Training history and session logging\n• Integration with Driverless AI platform\n• Automated feature engineering progress",
                urls: [
                    "https://docs.h2o.ai/h2o-3/latest-stable/h2o-docs/automl.html",
                    "https://docs.h2o.ai/driverless-ai/latest-stable/docs/userguide/running-experiment.html"
                ],
            },
            "📊 ML Data Quality": {
                title: "📊 ML Data Quality",
                description: "Assessment of data quality and readiness for machine learning model training. Evaluates data completeness, consistency, feature engineering potential, and suitability for AutoML flood prediction models.",
                dataSource: "Data quality analysis for ML training datasets",
                technicalDetails: "• Data completeness scoring for ML training\n• Feature quality assessment\n• Missing data analysis and handling recommendations\n• Data distribution analysis for model training\n• Temporal data quality for time-series models\n• Feature engineering opportunity identification",
                urls: [
                    "https://docs.h2o.ai/driverless-ai/latest-stable/docs/userguide/data.html",
                    "https://docs.h2o.ai/h2o-3/latest-stable/h2o-docs/data-science.html"
                ],
            },
            "🧪 Feature Engineering": {
                title: "🧪 Feature Engineering",
                description: "Automated feature engineering capabilities and recommendations from H2OGPTE agent for flood prediction models. Includes time-series features, environmental variable interactions, and domain-specific feature creation.",
                dataSource: "H2OGPTE feature engineering recommendations and Driverless AI feature creation",
                technicalDetails: "• Automated feature engineering using Driverless AI\n• Time-series feature creation (lags, rolling statistics)\n• Environmental variable interaction features\n• Seasonal and temporal pattern features\n• Feature selection and importance analysis\n• Domain-specific flood prediction features",
                urls: [
                    "https://docs.h2o.ai/driverless-ai/latest-stable/docs/userguide/feature-engineering.html",
                    "https://docs.h2o.ai/h2o-3/latest-stable/h2o-docs/feature-engineering.html"
                ],
            }
        }
    }

    const agentInsights = insights[agentType]
    if (agentInsights && agentInsights[title]) {
        return agentInsights[title]
    }

    // Fallback for unknown insights
    return {
        title: title,
        description: "This metric provides important information about flood monitoring and prediction systems. This is a fallback description for metrics that haven't been detailed yet.",
        dataSource: "Various monitoring and analysis systems",
        technicalDetails: "• Metric tracking and analysis system\n• Updates based on agent check intervals\n• Integration with multiple data sources\n• Real-time processing and validation",
        urls: [
            "https://www.usgs.gov/mission-areas/water-resources",
            "https://www.weather.gov/",
            "https://www.fema.gov/"
        ]
    }
}

const AgentInsightCard = ({ insight, agentType }: { insight: AgentInsight, agentType: string }) => {
    const insightInfo = getAgentInsightDescription(insight.title, agentType)

    return (
        <div className={`py-1 text-sm text-gray-400 flex items-center justify-between ${insight.urgency === 'critical' ? 'text-red-400' : insight.urgency === 'high' ? 'text-orange-400' : ''}`}>
            <div className="flex-1">
                <HoverCard>
                    <HoverCardTrigger asChild>
                        <div className="font-medium text-white text-xs cursor-help hover:text-blue-400 transition-colors">
                            {insight.title}
                        </div>
                    </HoverCardTrigger>
                    <HoverCardContent
                        className="w-96 bg-gray-900 border-gray-700 text-white max-h-96 overflow-y-auto shadow-2xl border-2"
                        style={{
                            zIndex: 99999,
                            position: 'fixed',
                            backgroundColor: '#111827',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        }}
                        sideOffset={8}
                        collisionPadding={16}
                    >
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-blue-400">{insightInfo.title}</h4>

                            <p className="text-sm text-gray-300 leading-relaxed">
                                {insightInfo.description}
                            </p>

                            {insightInfo.technicalDetails && (
                                <div className="bg-gray-800/50 rounded p-2">
                                    <div className="text-xs font-medium text-yellow-400 mb-1">Technical Details:</div>
                                    <div className="text-xs text-gray-300 whitespace-pre-line leading-relaxed">
                                        {insightInfo.technicalDetails}
                                    </div>
                                </div>
                            )}

                            {insightInfo.urls && insightInfo.urls.length > 0 && (
                                <div className="bg-gray-800/50 rounded p-2">
                                    <div className="text-xs font-medium text-green-400 mb-1">Data Sources & APIs:</div>
                                    <div className="space-y-1">
                                        {insightInfo.urls.map((url, index) => (
                                            <div key={index} className="text-xs">
                                                <a
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-300 hover:text-blue-200 underline break-all"
                                                >
                                                    {url}
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="text-xs text-gray-500 border-t border-gray-700 pt-2">
                                <span className="font-medium">Primary Data Source:</span> {insightInfo.dataSource}
                            </div>
                        </div>
                    </HoverCardContent>
                </HoverCard>
                <div className="flex items-center space-x-1 mt-0.5">
                    <span className="text-white font-semibold">{insight.value}</span>
                    {insight.change && (
                        <span className="text-xs text-gray-500">
                            {getTrendIcon(insight.trend)}
                            {insight.change}
                        </span>
                    )}
                </div>
            </div>
            {insight.urgency === 'critical' && (
                <AlertTriangle className="h-3 w-3 text-red-400" />
            )}
        </div>
    )
}


// Enhanced metric card component using shadcn/ui
const MetricCard = ({ title, value, change, icon: Icon, trend }: {
    title: string
    value: string | number
    change?: string
    icon: any
    trend?: 'up' | 'down'
}) => (
    <Card className="bg-card backdrop-blur-sm border-border">
        <CardContent className="p-4">
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <CardDescription className="text-sm font-medium text-muted-foreground mb-1">
                        {title}
                    </CardDescription>
                    <div className="text-2xl font-bold text-card-foreground mb-1">{value}</div>
                    {change && (
                        <div className={`flex items-center text-xs ${
                            trend === 'up' ? 'text-red-400' :
                            trend === 'down' ? 'text-green-400' :
                            'text-muted-foreground'
                        }`}>
                            {trend === 'up' && <TrendingUp className="h-3 w-3 mr-1" />}
                            {trend === 'down' && <TrendingDown className="h-3 w-3 mr-1" />}
                            <span>{change}</span>
                        </div>
                    )}
                </div>
                <div className="text-primary ml-4">
                    <Icon className="h-6 w-6" />
                </div>
            </div>
        </CardContent>
    </Card>
)

interface DashboardInsights {
    model_accuracy: number;
    usgs_stations: number;
    total_stations: number;
    rising_trend_count: number;
    average_flow: number;
    confidence_level: string;
    data_quality_score: number;
    next_update: string;
    system_status: string;
    alert_trend: string;
}

export default function UnifiedDashboard() {
    const [activeTab, setActiveTab] = useState(1)
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
    const [insightsData, setInsightsData] = useState<DashboardInsights | null>(null)
    const [agentSummary, setAgentSummary] = useState<AgentSummary | null>(null)
    const [agentInsights, setAgentInsights] = useState<Record<string, AgentInsight[]> | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [refreshingData, setRefreshingData] = useState(false)
    const [refreshStatus, setRefreshStatus] = useState<string | null>(null)

    // Enhanced AI Chat states
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 1,
            role: 'assistant',
            content: `🌊 **Flood AI Assistant Ready**

I can help you with:
• **Risk Analysis** - Explain watershed conditions
• **Emergency Planning** - Safety recommendations
• **Data Interpretation** - Stream flow & predictions
• **Historical Trends** - Compare past flood events
• **Real-time Monitoring** - Current alert status

*What would you like to know about flood conditions?*`,
            timestamp: new Date()
        }
    ])
    const [inputMessage, setInputMessage] = useState('')
    const [isLoadingAI, setIsLoadingAI] = useState(false)
    const [chatExpanded, setChatExpanded] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Advanced AI provider states
    const [selectedProvider, setSelectedProvider] = useState<string>('auto')
    const [availableProviders, setAvailableProviders] = useState<any>({})
    const [selectedModel, setSelectedModel] = useState<string>('')
    const [availableModels, setAvailableModels] = useState<string[]>([])
    const [showSettings, setShowSettings] = useState(false)
    const [temperature, setTemperature] = useState<number>(0.7)
    const [maxTokens, setMaxTokens] = useState<number>(8192*10)
    const [useAgents, _setUseAgents] = useState(false)
    const [selectedWatershed, setSelectedWatershed] = useState('')
    const [loadingProviders, setLoadingProviders] = useState(true)

    // NAT Agent Chat States
    const [chatMode, setChatMode] = useState<'normal' | 'nat'>('normal')
    const [natAgentType, setNatAgentType] = useState<string>('risk_analyzer')
    const [natLocation, setNatLocation] = useState<string>('Texas Region')
    const [natForecastHours, setNatForecastHours] = useState<number>(24)
    const [natScenario, setNatScenario] = useState<string>('routine_check')
    const [availableNATAgents, setAvailableNATAgents] = useState<any>({})
    const [loadingNATAgents, setLoadingNATAgents] = useState(true)

    // Collapsible insight cards state
    const [riskAnalysisOpen, setRiskAnalysisOpen] = useState(true)
    const [emergencyResponseOpen, setEmergencyResponseOpen] = useState(true)
    const [aiPredictionsOpen, setAiPredictionsOpen] = useState(true)
    const [dataCollectorOpen, setDataCollectorOpen] = useState(false)
    // const [h2ogpteAgentOpen, setH2ogpteAgentOpen] = useState(false)

    const fetchDashboardData = async () => {
        try {
            setLoading(true)
            setError(null)

            // Fetch dashboard, analytics, insights, and agent data
            const [dashboardData, analyticsData, insightsData, agentSummary, agentInsights] = await Promise.all([
                dashboardApi.getDashboardData(),
                analyticsApi.getAnalyticsData('24h', 'risk_score'),
                dashboardApi.getDashboardInsights(),
                agentsApi.getSummary().catch(() => null), // Don't fail if agents are unavailable
                agentsApi.getInsights().catch(() => null)
            ])

            setDashboardData(dashboardData)
            setAnalyticsData(analyticsData)
            setInsightsData(insightsData)
            setAgentSummary(agentSummary)
            setAgentInsights(agentInsights?.insights || null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
            console.error('Dashboard data fetch error:', err)
        } finally {
            setLoading(false)
        }
    }

    // Load NAT agents
    const loadNATAgents = async () => {
        try {
            setLoadingNATAgents(true)
            const natData = await aiApi.getNATAgents()
            setAvailableNATAgents(natData)
        } catch (error) {
            console.error('Failed to fetch NAT agents:', error)
            setAvailableNATAgents({ nat_available: false, available_agents: {} })
        } finally {
            setLoadingNATAgents(false)
        }
    }

    useEffect(() => {
        fetchDashboardData()
        loadAIProviders()
        loadNATAgents()
    }, [])

    // Load AI providers and models
    const loadAIProviders = async () => {
        try {
            setLoadingProviders(true)
            const providersData = await aiApi.getProviders()
            setAvailableProviders(providersData)

            // Set default provider
            const defaultProvider = providersData.current_default || 'h2ogpte'
            setSelectedProvider(defaultProvider)

            // Fetch models for default provider
            if (providersData.providers[defaultProvider]?.available) {
                const modelsData = await aiApi.getProviderModels(defaultProvider)
                setAvailableModels(modelsData.models)
                setSelectedModel(modelsData.default_model)
            }
        } catch (error) {
            console.error('Failed to fetch AI providers:', error)
        } finally {
            setLoadingProviders(false)
        }
    }

    // Fetch models when provider changes
    useEffect(() => {
        if (selectedProvider && selectedProvider !== 'auto') {
            const fetchModels = async () => {
                try {
                    const modelsData = await aiApi.getProviderModels(selectedProvider)
                    setAvailableModels(modelsData.models)
                    setSelectedModel(modelsData.default_model)
                } catch (error) {
                    console.error('Failed to fetch models:', error)
                    setAvailableModels([])
                    setSelectedModel('')
                }
            }

            fetchModels()
        }
    }, [selectedProvider])

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

                if (response.job_id) {
                    await jobApi.pollJob(response.job_id, (job) => {
                        if (job.status) {
                            setRefreshStatus(job.status)
                        }

                        if (job.state === 'finished') {
                            setRefreshStatus('USGS data refresh completed')
                            setRefreshingData(false)
                            fetchDashboardData()
                            setTimeout(() => {
                                setRefreshStatus(null)
                            }, 2000)
                        } else if (job.state === 'failed') {
                            setRefreshStatus(`Refresh failed: ${job.exc_info || 'Unknown error'}`)
                            setRefreshingData(false)
                            setTimeout(() => setRefreshStatus(null), 5000)
                        }
                    })
                }
            }
        } catch (err) {
            console.error('USGS refresh failed:', err)
            setRefreshStatus(`Refresh failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
            setRefreshingData(false)
            setTimeout(() => setRefreshStatus(null), 5000)
        }
    }

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isLoadingAI) return

        const userMessage: Message = {
            id: Date.now(),
            role: 'user',
            content: inputMessage,
            timestamp: new Date()
        }

        const currentInput = inputMessage
        setMessages(prev => [...prev, userMessage])
        setIsLoadingAI(true)
        setInputMessage('')

        // Create placeholder assistant message
        const assistantMessageId = Date.now() + 1
        const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isStreaming: true
        }

        setMessages(prev => [...prev, assistantMessage])

        try {
            if (chatMode === 'normal') {
                // Normal chat mode - existing logic
                const selectedWatershedData = selectedWatershed && selectedWatershed !== "none" && dashboardData?.watersheds && dashboardData.watersheds.length > 0
                    ? dashboardData.watersheds.find(w => w.name === selectedWatershed)
                    : null

                // Prepare enhanced API request with provider selection
                const enhancedRequest = {
                    message: currentInput,
                    watershed_id: selectedWatershedData?.id,
                    provider: selectedProvider === 'auto' ? undefined : selectedProvider,
                    model: selectedModel || undefined,
                    use_agent: useAgents,
                    temperature: temperature,
                    max_tokens: maxTokens,
                    context: selectedWatershedData ? {
                        name: selectedWatershedData.name,
                        risk_level: selectedWatershedData.current_risk_level,
                        risk_score: selectedWatershedData.risk_score,
                        current_flow: selectedWatershedData.current_streamflow_cfs,
                        flood_stage: selectedWatershedData.flood_stage_cfs
                    } : undefined
                }

                // Stream AI response using enhanced API
                let fullContent = ''
                let evaluationData = null

                for await (const chunk of aiApi.enhancedStreamChat(enhancedRequest)) {
                    if (typeof chunk === 'object' && chunk !== null) {
                        if ((chunk as any).type === 'evaluation') {
                            // Handle evaluation data
                            evaluationData = (chunk as any).data
                        } else if ((chunk as any).type === 'provider_info') {
                            // Handle provider information (metadata only, not stored)
                            console.log('Provider info:', (chunk as any).data)
                        } else if ((chunk as any).type === 'stream_complete') {
                            // Stream completed with metadata
                            break
                        }
                    } else if (typeof chunk === 'string' && chunk.trim()) {
                        // Handle text content - accumulate it
                        fullContent = chunk

                        setMessages(prev => prev.map(msg =>
                            msg.id === assistantMessageId
                                ? { ...msg, content: fullContent, isStreaming: true }
                                : msg
                        ))
                    }
                }

                // Mark streaming as complete and add evaluation data
                setMessages(prev => prev.map(msg =>
                    msg.id === assistantMessageId
                        ? { ...msg, isStreaming: false, evaluation: evaluationData }
                        : msg
                ))
            } else {
                // NAT agent chat mode
                const natRequest = {
                    message: currentInput,
                    agent_type: natAgentType,
                    location: natLocation,
                    forecast_hours: natForecastHours,
                    scenario: natScenario
                }

                let fullContent = ''
                let agentLogs: any[] = []

                for await (const chunk of aiApi.natStreamChat(natRequest)) {
                    if (typeof chunk === 'object' && chunk !== null) {
                        if (chunk.type === 'start') {
                            console.log('NAT agent started:', chunk.data)
                        } else if (chunk.type === 'log') {
                            agentLogs.push(chunk.data)


                            // Update message with current logs for real-time display
                            setMessages(prev => prev.map(msg =>
                                msg.id === assistantMessageId
                                    ? {
                                        ...msg,
                                        content: '',
                                        isStreaming: true,
                                        natAgent: {
                                            type: natAgentType,
                                            location: natLocation,
                                            logs: agentLogs
                                        }
                                    }
                                    : msg
                            ))
                        } else if (chunk.type === 'result') {
                            fullContent = chunk.data.output || 'Agent processing completed.'


                            setMessages(prev => prev.map(msg =>
                                msg.id === assistantMessageId
                                    ? {
                                        ...msg,
                                        content: fullContent,
                                        isStreaming: false,
                                        natAgent: {
                                            type: natAgentType,
                                            location: natLocation,
                                            logs: agentLogs
                                        }
                                    }
                                    : msg
                            ))
                        } else if (chunk.type === 'error') {
                            throw new Error(chunk.error || 'NAT agent error')
                        } else if (chunk.type === 'done') {
                            break
                        }
                    }
                }

                // If we didn't get a result, use accumulated content
                if (!fullContent && agentLogs.length > 0) {
                    setMessages(prev => prev.map(msg =>
                        msg.id === assistantMessageId
                            ? {
                                ...msg,
                                content: 'Agent processing completed.',
                                isStreaming: false,
                                natAgent: {
                                    type: natAgentType,
                                    location: natLocation,
                                    logs: agentLogs
                                }
                            }
                            : msg
                    ))
                }
            }

        } catch (error) {
            console.error('Error sending message to AI:', error)

            const errorMessage: Message = {
                id: assistantMessageId,
                role: 'assistant',
                content: "I apologize, but I'm having trouble processing your request right now. Please try again or contact emergency services if this is urgent.",
                timestamp: new Date(),
                isError: true,
                isStreaming: false
            }

            // Replace the placeholder message with error
            setMessages(prev => prev.map(msg =>
                msg.id === assistantMessageId
                    ? errorMessage
                    : msg
            ))
        } finally {
            setIsLoadingAI(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Helper functions for agent management
    const getAgentIcon = (agentKey: string): string => {
        switch (agentKey) {
            case 'data_collector': return '🔄'
            case 'risk_analyzer': return '🎯'
            case 'emergency_responder': return '🚁'
            case 'predictor': return '🔮'
            case 'h2ogpte_agent': return '🤖'
            default: return '🤖'
        }
    }

    const handleRefreshAgents = async () => {
        try {
            // Refresh agent data
            const [newAgentSummary, newAgentInsights] = await Promise.all([
                agentsApi.getSummary(),
                agentsApi.getInsights()
            ])
            setAgentSummary(newAgentSummary)
            setAgentInsights(newAgentInsights.insights)
        } catch (error) {
            console.error('Failed to refresh agents:', error)
        }
    }

    const handleCollectData = async () => {
        try {
            await agentsApi.collectExternalData()
            // Refresh dashboard data after collection
            await fetchDashboardData()
        } catch (error) {
            console.error('Failed to collect data:', error)
        }
    }

    const handleGenerateForecast = async () => {
        try {
            const forecast = await agentsApi.generateForecast(24)
            console.log('Generated forecast:', forecast)
            // You could show this in a modal or separate component
        } catch (error) {
            console.error('Failed to generate forecast:', error)
        }
    }

    const handleStartAgents = async () => {
        try {
            await agentsApi.startAgents()
            // Refresh agent data after starting
            await handleRefreshAgents()
        } catch (error) {
            console.error('Failed to start agents:', error)
        }
    }

    const handleStopAgents = async () => {
        try {
            await agentsApi.stopAgents()
            // Refresh agent data after stopping
            await handleRefreshAgents()
        } catch (error) {
            console.error('Failed to stop agents:', error)
        }
    }

    if (loading && !dashboardData) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-center">
                    <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Unable to Load Dashboard</h3>
                    <p className="text-gray-400 mb-4">{error}</p>
                    <Button onClick={handleRefresh} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        <RefreshCw className="h-4 w-4 mr-2 inline" />
                        Retry
                    </Button>
                </div>
            </div>
        )
    }

    if (!dashboardData || !analyticsData || !insightsData) return null

    // Use real trend data from API, fallback to dashboard risk_trends if analytics data not available
    const riskTrendData = analyticsData.historical_data.length > 0
        ? analyticsData.historical_data.map(point => ({
            time: point.time,
            risk: point.avg_risk_score,
            alerts: point.alerts_count
        }))
        : dashboardData.risk_trends.map(point => ({
            time: point.time,
            risk: point.risk,
            alerts: point.watersheds  // Using watersheds count as placeholder for alerts
        }))

    // Use real distribution data from analytics API
    const riskDistributionData = analyticsData.risk_distribution.length > 0
        ? analyticsData.risk_distribution
        : [
            { name: 'Low Risk', value: dashboardData.summary.low_risk_watersheds, color: '#22c55e', percentage: Math.round((dashboardData.summary.low_risk_watersheds / dashboardData.summary.total_watersheds) * 100) },
            { name: 'Moderate Risk', value: dashboardData.summary.moderate_risk_watersheds, color: '#f59e0b', percentage: Math.round((dashboardData.summary.moderate_risk_watersheds / dashboardData.summary.total_watersheds) * 100) },
            { name: 'High Risk', value: dashboardData.summary.high_risk_watersheds, color: '#ef4444', percentage: Math.round((dashboardData.summary.high_risk_watersheds / dashboardData.summary.total_watersheds) * 100) }
        ]

    return (
        <div className="min-h-screen bg-black text-white overflow-hidden">
            {/* Header */}
            <div className="border-b border-border">
                {/* Navigation and Status Row */}
                <div className="flex items-center justify-between px-6 pb-4">
                    <div className="flex items-center justify-center py-4">
                        <img src={h2oIcon} alt="H2O.ai" className="h-8 w-8 mr-2" />
                        <h1 className="text-2xl font-bold text-white">Flood Prediction</h1>
                    </div>
                    {/* Center - Navigation Tabs */}
                    <div className="flex-1 flex justify-center">
                        <TubelightNavbar
                            items={[
                                { id: 1, name: 'Live Map', desc: 'Real-time watershed monitoring', icon: MapPin },
                                { id: 2, name: 'Analytics', desc: 'Trends and forecasting', icon: BarChart3 },
                                { id: 3, name: 'Alerts', desc: 'Emergency notifications', icon: AlertTriangle },
                                { id: 4, name: 'AI Agents', desc: 'Agent details and management', icon: Brain }
                            ]}
                            activeTab={activeTab}
                            onTabChange={setActiveTab}
                        />
                    </div>
                    {/* Left side - Status buttons */}
                    <div className="flex items-center space-x-3">

                        {/* Agents Online Status */}
                        <HoverCard>
                            <HoverCardTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-auto p-2 hover:bg-gray-800/50">
                                    <div className="flex items-center space-x-2">
                                        {agentSummary && <p className="text-sm font-semibold text-green-400">
                                            <strong>{agentSummary.running_agents}</strong> Agents online
                                        </p>
                                        }
                                        <Bot className="h-4 w-4 text-green-400" />
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    </div>
                                </Button>
                            </HoverCardTrigger>
                            <HoverCardContent side="bottom" className="w-80">
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-green-400">🤖 AI Agents Status</h4>
                                    {agentSummary && (
                                        <>
                                            <p className="text-sm text-gray-300">
                                                <strong>{agentSummary.running_agents}/{agentSummary.total_agents}</strong> agents online
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {agentSummary.total_insights} insights generated
                                            </p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleUsgsRefresh}
                                                disabled={refreshingData}
                                                className="text-xs mt-2 w-full"
                                            >
                                                {refreshingData ? (
                                                    <>
                                                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                                        Refreshing...
                                                    </>
                                                ) : (
                                                    'Pull Latest Data'
                                                )}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </HoverCardContent>
                        </HoverCard>

                        {/* Emergency Status */}
                        <HoverCard>
                            <HoverCardTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-auto p-2 hover:bg-gray-800/50">
                                    <div className="flex items-center space-x-2">
                                        <p className="text-sm font-semibold text-amber-300">
                                            <strong>{dashboardData.summary.active_alerts}</strong> Alerts
                                        </p>
                                        <AlertTriangle className="h-4 w-4 text-amber-300" />
                                        <div className={`w-2 h-2 rounded-full ${dashboardData.summary.active_alerts > 5 ? 'bg-amber-500 animate-pulse' :
                                                dashboardData.summary.active_alerts > 0 ? 'bg-amber-400' :
                                                    'bg-amber-600'
                                            }`}></div>
                                    </div>
                                </Button>
                            </HoverCardTrigger>
                            <HoverCardContent side="bottom" className="w-80">
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-amber-300">🚨 Emergency Status</h4>
                                    <p className="text-sm text-amber-200">
                                        <strong>{dashboardData.summary.active_alerts}</strong> active alerts
                                    </p>
                                    <p className="text-xs text-amber-400">
                                        Status: {dashboardData.summary.high_risk_watersheds > 0 ? 'HIGH PRIORITY' : 'MONITORING'}
                                    </p>
                                    <div className="text-xs text-gray-500 mt-1">
                                        Risk breakdown: {dashboardData.summary.high_risk_watersheds} high, {dashboardData.summary.moderate_risk_watersheds} moderate, {dashboardData.summary.low_risk_watersheds} low
                                    </div>
                                </div>
                            </HoverCardContent>
                        </HoverCard>
                    </div>



                </div>
            </div>

            {/* Main Content */}
            <div className="flex h-[calc(100vh-88px)]">
                {/* Left Insights Panel */}
                <div className="w-80 border-r border-border flex flex-col">
                    {/* AI Agents Status Header */}
                    <div className="p-4 border-b border-border">
                        <div className="flex items-center justify-between">
                            <h3 className="text-primary font-semibold">🤖 AI Agents
                            </h3>
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gradient-to-r from-green-500/20 to-blue-500/20 text-green-400 border border-green-500/30 font-medium">
                                ⚡ NVIDIA NAT
                            </span>
                            {/* {agentSummary && (
                                <div className="text-xs text-gray-400">
                                    {agentSummary.running_agents}/{agentSummary.total_agents} online
                                </div>
                            )} */}
                            {agentSummary && (
                                <div className="flex items-center space-x-4 text-s">
                                    <span className="text-gray-400">
                                        {agentSummary.total_insights} insights
                                    </span>
                                    {/* <span className={`${agentSummary.critical_alerts > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                    {agentSummary.total_alerts} alerts
                                </span> */}
                                </div>
                            )}
                        </div>

                    </div>

                    {/* AI Agent Insights */}
                    <div className="p-4 space-y-2 flex-1 overflow-y-auto">
                        {/* Data Collector Agent */}
                        <Collapsible open={dataCollectorOpen} onOpenChange={setDataCollectorOpen}>
                            <div className="border-l-2 border-green-500/30">
                                <CollapsibleTrigger className="w-full">
                                    <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-800/30 transition-colors">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-primary">🔄</span>
                                            <span className="text-primary font-medium">Data Collector</span>
                                            {agentSummary?.agent_statuses?.data_collector?.is_running && (
                                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                            )}
                                        </div>
                                        {dataCollectorOpen ?
                                            <ChevronUp className="h-3 w-3 text-gray-400" /> :
                                            <ChevronDown className="h-3 w-3 text-gray-400" />
                                        }
                                    </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="pl-6 pr-3 pb-2 space-y-1">
                                        {agentInsights?.data_collector?.map((insight, index) => (
                                            <AgentInsightCard key={index} insight={insight} agentType="data_collector" />
                                        )) || (
                                                <div className="py-1 text-sm text-gray-400">
                                                    Agent insights unavailable
                                                </div>
                                            )}
                                    </div>
                                </CollapsibleContent>
                            </div>
                        </Collapsible>

                        {/* Risk Analyzer Agent */}
                        <Collapsible open={riskAnalysisOpen} onOpenChange={setRiskAnalysisOpen}>
                            <div className="border-l-2 border-green-500/30">
                                <CollapsibleTrigger className="w-full">
                                    <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-800/30 transition-colors">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-primary">🎯</span>
                                            <span className="text-primary font-medium">Risk Analyzer</span>
                                            {agentSummary?.agent_statuses?.risk_analyzer?.is_running && (
                                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                            )}
                                        </div>
                                        {riskAnalysisOpen ?
                                            <ChevronUp className="h-3 w-3 text-gray-400" /> :
                                            <ChevronDown className="h-3 w-3 text-gray-400" />
                                        }
                                    </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="pl-6 pr-3 pb-2 space-y-1">
                                        {agentInsights?.risk_analyzer?.map((insight, index) => (
                                            <AgentInsightCard key={index} insight={insight} agentType="risk_analyzer" />
                                        )) || (
                                                <div className="py-1 text-sm text-gray-400">
                                                    Agent insights unavailable
                                                </div>
                                            )}
                                    </div>
                                </CollapsibleContent>
                            </div>
                        </Collapsible>

                        {/* Emergency Responder Agent */}
                        <Collapsible open={emergencyResponseOpen} onOpenChange={setEmergencyResponseOpen}>
                            <div className="border-l-2 border-green-500/30">
                                <CollapsibleTrigger className="w-full">
                                    <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-800/30 transition-colors">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-primary">🚁</span>
                                            <span className="text-primary font-medium">Emergency Response</span>
                                            {agentSummary?.agent_statuses?.emergency_responder?.is_running && (
                                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                            )}
                                        </div>
                                        {emergencyResponseOpen ?
                                            <ChevronUp className="h-3 w-3 text-gray-400" /> :
                                            <ChevronDown className="h-3 w-3 text-gray-400" />
                                        }
                                    </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="pl-6 pr-3 pb-2 space-y-1">
                                        {agentInsights?.emergency_responder?.map((insight, index) => (
                                            <AgentInsightCard key={index} insight={insight} agentType="emergency_responder" />
                                        )) || (
                                                <div className="py-1 text-sm text-gray-400">
                                                    Agent insights unavailable
                                                </div>
                                            )}
                                    </div>
                                </CollapsibleContent>
                            </div>
                        </Collapsible>

                        {/* AI Predictor Agent */}
                        <Collapsible open={aiPredictionsOpen} onOpenChange={setAiPredictionsOpen}>
                            <div className="border-l-2 border-green-500/30">
                                <CollapsibleTrigger className="w-full">
                                    <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-800/30 transition-colors">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-primary">🔮</span>
                                            <span className="text-primary font-medium">AI Predictor</span>
                                            {agentSummary?.agent_statuses?.predictor?.is_running && (
                                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                            )}
                                        </div>
                                        {aiPredictionsOpen ?
                                            <ChevronUp className="h-3 w-3 text-gray-400" /> :
                                            <ChevronDown className="h-3 w-3 text-gray-400" />
                                        }
                                    </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="pl-6 pr-3 pb-2 space-y-1">
                                        {agentInsights?.predictor?.map((insight, index) => (
                                            <AgentInsightCard key={index} insight={insight} agentType="predictor" />
                                        )) || (
                                                <div className="py-1 text-sm text-gray-400">
                                                    Agent insights unavailable
                                                </div>
                                            )}
                                    </div>
                                </CollapsibleContent>
                            </div>
                        </Collapsible>
                    </div>
                </div>

                {/* Center Map Content */}
                <div className="flex-1 flex flex-col">
                    <div className="flex-1 p-6">
                        <div className={`bg-gray-900/30 rounded-xl h-full border border-border overflow-hidden ${activeTab === 4 ? 'flex flex-col' : 'flex items-center justify-center'}`}>
                            <div className="h-full w-full">
                                {activeTab === 1 && (
                                    <div className="h-full w-full">
                                        <GlobalWatershedMap
                                            watersheds={dashboardData.watersheds}
                                            height="100%"
                                            onWatershedClick={(watershed) => {
                                                console.log('Viewing details for:', watershed.name);
                                            }}
                                        />
                                    </div>
                                )}
                                {activeTab === 2 && (
                                    <div className="p-6 h-full">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-xl font-semibold text-white">🔍 Flood Analytics & Forecasting</h3>
                                            <div className="text-sm text-gray-400">
                                                Updated {new Date().toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100%-80px)]">
                                            <Card className="bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors">
                                                <CardHeader className="pb-3">
                                                    <CardTitle className="text-primary text-base">⏱️ 24-Hour Risk Progression</CardTitle>
                                                    <CardDescription className="text-xs text-gray-400">
                                                        Texas watersheds average risk level trending {riskTrendData[riskTrendData.length-1].risk > riskTrendData[0].risk ? '↗️ UP' : '↘️ DOWN'}
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent>
                                                    <ResponsiveContainer width="100%" height={250}>
                                                        <AreaChart data={riskTrendData}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                                            <XAxis dataKey="time" stroke="#9CA3AF" />
                                                            <YAxis domain={[0, 10]} stroke="#9CA3AF" />
                                                            <RechartsTooltip
                                                                contentStyle={{
                                                                    backgroundColor: 'rgba(195, 156, 24, 0.1)',
                                                                    border: '1px solid rgba(195, 156, 24, 0.3)',
                                                                    borderRadius: '8px',
                                                                    color: '#fff'
                                                                }}
                                                                formatter={(value: any, name: any) => [
                                                                    name === 'risk' ? `${value}/10 Risk Level` : `${value} Active Alerts`,
                                                                    name === 'risk' ? 'Average Risk' : 'Alert Count'
                                                                ]}
                                                            />
                                                            <Area type="monotone" dataKey="risk" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                                                            <Area type="monotone" dataKey="alerts" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                                                        </AreaChart>
                                                    </ResponsiveContainer>
                                                </CardContent>
                                            </Card>
                                            <Card className="bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors">
                                                <CardHeader className="pb-3">
                                                    <CardTitle className="text-primary text-base">🗺️ Statewide Risk Distribution</CardTitle>
                                                    <CardDescription className="text-xs text-gray-400">
                                                        Monitoring {dashboardData.summary.total_watersheds} watersheds across Texas
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent>
                                                    <ResponsiveContainer width="100%" height={250}>
                                                        <PieChart>
                                                            <Pie
                                                                data={riskDistributionData}
                                                                cx="50%"
                                                                cy="50%"
                                                                outerRadius={90}
                                                                fill="#8884d8"
                                                                dataKey="value"
                                                                label={({ name, value, percent }) => `${name.split(' ')[0]}: ${value} (${percent ? (percent * 100).toFixed(0) : 0}%)`}
                                                            >
                                                                {riskDistributionData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                                ))}
                                                            </Pie>
                                                            <RechartsTooltip
                                                                contentStyle={{
                                                                    backgroundColor: 'rgba(195, 156, 24, 0.1)',
                                                                    border: '1px solid rgba(195, 156, 24, 0.3)',
                                                                    borderRadius: '8px',
                                                                    color: '#fff'
                                                                }}
                                                                formatter={(value: any) => [`${value} watersheds`, 'Count']}
                                                            />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </div>
                                )}
                                {activeTab === 3 && (
                                    <div className="p-6 h-full overflow-y-auto">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-xl font-semibold text-amber-100">🚨 Emergency Flood Alerts</h3>
                                            <div className="flex items-center space-x-2 text-sm">
                                                <div className="text-amber-300">Last updated:</div>
                                                <div className="text-amber-100">{new Date().toLocaleTimeString()}</div>
                                            </div>
                                        </div>

                                        {dashboardData.alerts.length > 0 ? (
                                            <div className="space-y-4">
                                                {dashboardData.alerts.slice(0, 8).map((alert, index) => (
                                                    <Card key={alert.alert_id || index} className={`${
                                                        alert.severity === 'High' ? 'border-l-amber-600 bg-amber-900/20 border-l-4' :
                                                        alert.severity === 'Moderate' ? 'border-l-yellow-500 bg-yellow-900/15 border-l-4' :
                                                        'border-l-amber-400 bg-amber-900/10 border-l-4'
                                                    } bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors`}>
                                                        <CardContent className="p-4">
                                                            <div className="flex justify-between items-start">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center space-x-2 mb-2">
                                                                        <CardTitle className="text-amber-100 text-base">{alert.alert_type}</CardTitle>
                                                                        <Badge className={`text-xs ${getRiskBadgeClass(alert.severity)}`}>
                                                                            {alert.severity}
                                                                        </Badge>
                                                                    </div>
                                                                    <CardDescription className="text-amber-200 mb-2">
                                                                        📍 <strong>{alert.watershed}</strong>
                                                                    </CardDescription>
                                                                    <p className="text-sm text-amber-100 mb-3 leading-relaxed">
                                                                        {alert.message}
                                                                    </p>
                                                                    <div className="flex items-center justify-between text-xs text-amber-300">
                                                                        <span>🕒 Issued: {formatTimestamp(alert.issued_time)}</span>
                                                                        {alert.expires_time && (
                                                                            <span>⏰ Expires: {formatTimestamp(alert.expires_time)}</span>
                                                                        )}
                                                                    </div>
                                                                    {alert.affected_counties && alert.affected_counties.length > 0 && (
                                                                        <div className="mt-2 text-xs text-amber-300">
                                                                            🏛️ Counties: {alert.affected_counties.join(', ')}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12">
                                                <div className="text-6xl mb-4">✅</div>
                                                <h4 className="text-xl font-semibold text-amber-100 mb-2">All Clear</h4>
                                                <p className="text-amber-300">No active flood alerts for Texas watersheds</p>
                                                <p className="text-sm text-amber-400 mt-2">System monitoring continues 24/7</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {activeTab === 4 && (
                                    <div className="flex flex-col h-full">
                                        <div className="flex-shrink-0 p-6 pb-4">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-xl font-semibold text-white">🤖 AI Agents Management</h3>
                                                <div className="flex items-center space-x-3">
                                                    {/* Agent Control Buttons */}
                                                    <div className="flex items-center space-x-2">
                                                        <Button
                                                            size="sm"
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:scale-105"
                                                            onClick={() => handleStartAgents()}
                                                            disabled={agentSummary?.running_agents === agentSummary?.total_agents}
                                                        >
                                                            <div className="flex items-center space-x-1">
                                                                <div className="w-3 h-3 bg-white rounded-sm flex items-center justify-center">
                                                                    <div className="w-0 h-0 border-l-2 border-l-white border-y-transparent border-y-[1px] ml-0.5"></div>
                                                                </div>
                                                                <span>Start All</span>
                                                            </div>
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="bg-red-600 hover:bg-red-700 text-white border-0 px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:scale-105"
                                                            onClick={() => handleStopAgents()}
                                                            disabled={agentSummary?.running_agents === 0}
                                                        >
                                                            <div className="flex items-center space-x-1">
                                                                <div className="w-3 h-3 bg-white rounded-sm"></div>
                                                                <span>Stop All</span>
                                                            </div>
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:scale-105"
                                                            onClick={() => handleRefreshAgents()}
                                                        >
                                                            <RefreshCw className="h-3 w-3 mr-1" />
                                                            Refresh
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="border-blue-600 text-blue-300 hover:bg-blue-800 hover:text-white px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:scale-105"
                                                            onClick={() => handleCollectData()}
                                                        >
                                                            <RefreshCw className="h-3 w-3 mr-1" />
                                                            Collect Data
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="border-purple-600 text-purple-300 hover:bg-purple-800 hover:text-white px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:scale-105"
                                                            onClick={() => handleGenerateForecast()}
                                                        >
                                                            <Sparkles className="h-3 w-3 mr-1" />
                                                            Forecast
                                                        </Button>
                                                    </div>

                                                    {/* Status Info */}
                                                    <div className="flex items-center space-x-2 text-sm">
                                                        {agentSummary && (
                                                            <>
                                                                <div className="text-gray-400">Status:</div>
                                                                <div className="text-white font-medium">
                                                                    {agentSummary.running_agents}/{agentSummary.total_agents} online
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto px-6 pb-6">
                                            <div className="space-y-6">
                                                {/* Agent Status Overview */}
                                                {agentSummary && (
                                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                <Card className="bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors">
                                                    <CardContent className="p-4 text-center">
                                                        <div className="text-2xl font-bold text-blue-400 mb-1">
                                                            {agentSummary.total_agents}
                                                        </div>
                                                        <div className="text-sm text-gray-400">Total Agents</div>
                                                    </CardContent>
                                                </Card>
                                                <Card className="bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors">
                                                    <CardContent className="p-4 text-center">
                                                        <div className="text-2xl font-bold text-green-400 mb-1">
                                                            {agentSummary.running_agents}
                                                        </div>
                                                        <div className="text-sm text-gray-400">Running</div>
                                                    </CardContent>
                                                </Card>
                                                <Card className="bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors">
                                                    <CardContent className="p-4 text-center">
                                                        <div className="text-2xl font-bold text-yellow-400 mb-1">
                                                            {agentSummary.total_insights}
                                                        </div>
                                                        <div className="text-sm text-gray-400">Active Insights</div>
                                                    </CardContent>
                                                </Card>
                                                <Card className="bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors">
                                                    <CardContent className="p-4 text-center">
                                                        <div className={`text-2xl font-bold mb-1 ${agentSummary.critical_alerts > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                                            {agentSummary.total_alerts}
                                                        </div>
                                                        <div className="text-sm text-gray-400">Active Alerts</div>
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        )}

                                        {/* Individual Agent Details */}
                                        <ScrollArea className="h-96 w-full">
                                            <div className="space-y-4">
                                            {agentSummary?.agent_statuses && Object.entries(agentSummary.agent_statuses).map(([agentKey, status]) => (
                                                <Card key={agentKey} className="bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors">
                                                    <CardHeader className="pb-3">
                                                        <div className="flex items-center justify-between">
                                                            <CardTitle className="text-white text-lg flex items-center space-x-2">
                                                                <span>{getAgentIcon(agentKey)}</span>
                                                                <span>{status.name}</span>
                                                                {status.is_running ? (
                                                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                                                ) : (
                                                                    <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                                                                )}
                                                            </CardTitle>
                                                            <Badge className={`${status.is_running ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'} border-0`}>
                                                                {status.is_running ? 'ONLINE' : 'OFFLINE'}
                                                            </Badge>
                                                        </div>
                                                        <CardDescription className="text-gray-400">
                                                            {status.description}
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                                            <div>
                                                                <div className="text-gray-400">Check Interval</div>
                                                                <div className="text-white font-medium">
                                                                    {Math.floor(status.check_interval / 60)}m
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-gray-400">Insights</div>
                                                                <div className="text-white font-medium">
                                                                    {status.insights_count}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-gray-400">Alerts</div>
                                                                <div className={`font-medium ${status.active_alerts_count > 0 ? 'text-amber-300' : 'text-white'}`}>
                                                                    {status.active_alerts_count}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {status.last_check && (
                                                            <div className="mt-3 text-xs text-gray-500">
                                                                Last check: {new Date(status.last_check).toLocaleString()}
                                                            </div>
                                                        )}

                                                        {/* Current Insights for this Agent */}
                                                        {agentInsights?.[agentKey] && agentInsights[agentKey].length > 0 && (
                                                            <div className="mt-4">
                                                                <div className="text-sm font-medium text-gray-300 mb-2">Current Insights:</div>
                                                                <div className="space-y-2">
                                                                    {agentInsights[agentKey].slice(0, 3).map((insight, index) => (
                                                                        <div key={index} className="bg-gray-800/50 rounded p-2">
                                                                            <div className="flex items-center justify-between">
                                                                                <div className="flex-1">
                                                                                    <div className="text-xs font-medium text-white">
                                                                                        {insight.title}
                                                                                    </div>
                                                                                    <div className="text-xs text-gray-400 flex items-center space-x-1">
                                                                                        <span>{insight.value}</span>
                                                                                        {insight.change && (
                                                                                            <>
                                                                                                {getTrendIcon(insight.trend)}
                                                                                                <span>{insight.change}</span>
                                                                                            </>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <Badge className={`${getUrgencyBadgeClass(insight.urgency)} text-xs border-0`}>
                                                                                    {insight.urgency.toUpperCase()}
                                                                                </Badge>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            ))}
                                            </div>
                                        </ScrollArea>

                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Metric Cards */}
                    <div className="px-6 pb-6">
                        <div className="grid grid-cols-3 gap-4">
                            <MetricCard
                                title="🌊 Water Level Monitoring"
                                value={`${insightsData.total_stations} Sites`}
                                change={`${insightsData.usgs_stations} real-time`}
                                icon={MapPin}
                            />
                            <MetricCard
                                title="⚠️ Flood Warnings"
                                value={dashboardData.summary.active_alerts}
                                change={`${analyticsData.summary.high_risk_count} critical`}
                                trend={insightsData.rising_trend_count > 0 ? "up" : "down"}
                                icon={AlertTriangle}
                            />
                            <MetricCard
                                title="🎯 Risk Assessment"
                                value={`${analyticsData.summary.avg_risk_score.toFixed(1)}/10`}
                                change={`${insightsData.data_quality_score.toFixed(0)}% data quality`}
                                trend={analyticsData.summary.high_risk_count > dashboardData.summary.low_risk_watersheds ? "up" : "down"}
                                icon={Activity}
                            />
                        </div>
                    </div>
                </div>

                {/* Right AI Assistant Panel */}
                <div className={`border-l border-border flex flex-col transition-all duration-300 ${chatExpanded ? 'w-[32rem]' : 'w-[28rem]'}`}>
                    {/* Enhanced AI Assistant Header */}
                    <div className="p-4 border-b border-border">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-semibold flex items-center">
                                <Bot className="h-5 w-5 mr-2 text-primary" />
                                <span className="text-primary">AI Flood Assistant</span>
                            </h3>
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="AI Online"></div>
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowSettings(!showSettings)}
                                    className="text-gray-400 hover:text-white p-1 h-auto"
                                    title="AI Settings"
                                >
                                    <Settings className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setChatExpanded(!chatExpanded)}
                                    className="text-gray-400 hover:text-white h-auto p-1"
                                    title={chatExpanded ? 'Collapse' : 'Expand'}
                                >
                                    {chatExpanded ? '←' : '→'}
                                </Button>
                            </div>
                        </div>

                        {/* Chat Mode Selector */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center bg-card rounded-lg p-1 border border-border">
                                <button
                                    onClick={() => setChatMode('normal')}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${
                                        chatMode === 'normal'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Normal Chat
                                </button>
                                <button
                                    onClick={() => setChatMode('nat')}
                                    disabled={!availableNATAgents.nat_available}
                                    className={`px-2 py-1 text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                        chatMode === 'nat'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    title={!availableNATAgents.nat_available ? 'NAT agents not available' : 'Use NAT Agents'}
                                >
                                    🤖 NAT Agents
                                </button>
                            </div>
                        </div>

                        {/* Normal Chat Controls */}
                        {chatMode === 'normal' && (
                            <div className="flex items-center space-x-2 text-xs mb-3">
                            <Select value={selectedProvider} onValueChange={setSelectedProvider} disabled={loadingProviders}>
                                <SelectTrigger className="w-22 bg-card text-card-foreground border-border text-m h-8">
                                    <SelectValue placeholder="Provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">Auto Provider</SelectItem>
                                    {Object.entries(availableProviders.providers || {}).map(([key, provider]: [string, any]) => (
                                        <SelectItem key={key} value={key} disabled={!provider.available}>
                                            {provider.name || key} {!provider.available ? '(Unavailable)' : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {availableModels.length > 0 && (
                                <Select value={selectedModel} onValueChange={setSelectedModel}>
                                    <SelectTrigger className="w-80 bg-card text-card-foreground border-border text-m h-8">
                                        <SelectValue placeholder="Model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableModels.map(model => (
                                            <SelectItem key={model} value={model}>{model}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            {/* <label className="flex items-center space-x-1">
                                <Input
                                    type="checkbox"
                                    checked={useAgents}
                                    onChange={(e) => setUseAgents(e.target.checked)}
                                    className="w-3 h-3 bg-gray-800 border-gray-700"
                                />
                                <span className="text-gray-400">Agent</span>
                            </label> */}
                            </div>
                        )}

                        {/* NAT Agent Controls */}
                        {chatMode === 'nat' && availableNATAgents.nat_available && (
                            <div className="space-y-2 text-xs">
                                {/* Agent Type Selection */}
                                <div className="flex items-center space-x-2">
                                    <label className="text-muted-foreground min-w-[60px]">Agent:</label>
                                    <Select value={natAgentType} onValueChange={setNatAgentType} disabled={loadingNATAgents}>
                                        <SelectTrigger className="bg-card text-card-foreground border-border h-7 flex-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(availableNATAgents.available_agents || {}).map(([key, _name]: [string, any]) => (
                                                <SelectItem key={key} value={key}>
                                                    {key.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                                </SelectItem>
                                            ))}
                                            <SelectItem value="all">🔄 All Agents (Comprehensive)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Location for Risk Analyzer and Predictor */}
                                {(natAgentType === 'risk_analyzer' || natAgentType === 'predictor') && (
                                    <div className="flex items-center space-x-2">
                                        <label className="text-muted-foreground min-w-[60px]">Location:</label>
                                        <Input
                                            value={natLocation}
                                            onChange={(e) => setNatLocation(e.target.value)}
                                            placeholder="e.g., Miami, FL"
                                            className="bg-input text-foreground border-border h-7 flex-1 text-xs"
                                        />
                                    </div>
                                )}

                                {/* Forecast Hours for Predictor */}
                                {natAgentType === 'predictor' && (
                                    <div className="flex items-center space-x-2">
                                        <label className="text-muted-foreground min-w-[60px]">Hours:</label>
                                        <Input
                                            type="number"
                                            value={natForecastHours}
                                            onChange={(e) => setNatForecastHours(parseInt(e.target.value) || 24)}
                                            min="1"
                                            max="168"
                                            className="bg-input text-foreground border-border h-7 w-16 text-xs"
                                        />
                                        <span className="text-muted-foreground text-xs">hrs</span>
                                    </div>
                                )}

                                {/* Scenario for Emergency Responder */}
                                {natAgentType === 'emergency_responder' && (
                                    <div className="flex items-center space-x-2">
                                        <label className="text-muted-foreground min-w-[60px]">Scenario:</label>
                                        <Select value={natScenario} onValueChange={setNatScenario}>
                                            <SelectTrigger className="bg-card text-card-foreground border-border h-7 flex-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="routine_check">🔍 Routine Check</SelectItem>
                                                <SelectItem value="flash_flood_alert">⚠️ Flash Flood Alert</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Advanced Settings Panel */}
                        {showSettings && (
                            <div className="mt-3 p-3 bg-muted rounded border border-border space-y-2">
                                <div className="text-xs text-muted-foreground font-medium">Advanced Settings</div>

                                {/* Watershed Context Selection */}
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1">Watershed Context</label>
                                    <Select value={selectedWatershed} onValueChange={setSelectedWatershed}>
                                        <SelectTrigger className="w-full bg-card text-card-foreground border-border text-xs h-7">
                                            <SelectValue placeholder="No specific watershed" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No specific watershed</SelectItem>
                                            {dashboardData?.watersheds.map(watershed => (
                                                <SelectItem key={watershed.id} value={watershed.name}>
                                                    {watershed.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Temperature Control */}
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1">Temperature: {temperature}</label>
                                    <Input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={temperature}
                                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer border-0 focus:ring-2 focus:ring-primary"
                                    />
                                </div>

                                {/* Max Tokens Control */}
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1">Max Tokens: {maxTokens}</label>
                                    <Input
                                        type="range"
                                        min="256"
                                        max="4096"
                                        step="256"
                                        value={maxTokens}
                                        onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer border-0 focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Enhanced Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((message) => (
                            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {message.role === 'assistant' && message.natAgent ? (
                                    <div className="max-w-[85%] w-full">
                                        <ThinkingDisplay
                                            agentType={message.natAgent.type}
                                            location={message.natAgent.location || ''}
                                            content={message.content}
                                            logs={message.natAgent.logs}
                                            isStreaming={message.isStreaming || false}
                                        />
                                    </div>
                                ) : (
                                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                                        message.role === 'assistant'
                                            ? message.isError
                                                ? 'bg-destructive/30 text-destructive-foreground border border-destructive/50'
                                                : 'bg-card text-card-foreground border border-border'
                                            : 'bg-primary text-primary-foreground'
                                    }`}>
                                        {/* Message Content */}
                                        <div className="mb-2">
                                            {message.role === 'assistant' ? (
                                                <div className="prose prose-sm prose-invert max-w-none">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        rehypePlugins={[rehypeSanitize]}
                                                    >
                                                        {message.content || (message.isStreaming ? '⚡ Thinking...' : '')}
                                                    </ReactMarkdown>
                                                </div>
                                            ) : (
                                                <div className="whitespace-pre-wrap">
                                                    {message.content}
                                                </div>
                                            )}
                                        </div>

                                    {/* Evaluation Display */}
                                    {message.evaluation && message.role === 'assistant' && (
                                        <div className="mt-3 p-2 bg-muted/50 border border-border rounded text-xs">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center space-x-1">
                                                    <BarChart3 className="h-3 w-3 text-green-500" />
                                                    <span className="text-muted-foreground font-medium">AI Evaluation</span>
                                                </div>
                                                <div className="flex items-center space-x-3">
                                                    <div className="flex items-center space-x-1">
                                                        <Star className="h-3 w-3 text-yellow-500" />
                                                        <span className="text-foreground font-medium">{message.evaluation.overall_score.toFixed(1)}/10</span>
                                                    </div>
                                                    <div className="flex items-center space-x-1">
                                                        <Brain className="h-3 w-3 text-blue-500" />
                                                        <span className="text-foreground">{(message.evaluation.confidence * 100).toFixed(0)}%</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Detailed Metrics */}
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Safety:</span>
                                                    <span className="text-foreground">{message.evaluation.safety_score.toFixed(1)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Helpful:</span>
                                                    <span className="text-foreground">{message.evaluation.helpfulness.toFixed(1)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Accuracy:</span>
                                                    <span className="text-foreground">{message.evaluation.accuracy.toFixed(1)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Quality:</span>
                                                    <span className={`${message.evaluation.overall_score >= 8 ? 'text-green-500' : message.evaluation.overall_score >= 6 ? 'text-yellow-500' : 'text-red-500'}`}>
                                                        {message.evaluation.overall_score >= 8 ? 'High' : message.evaluation.overall_score >= 6 ? 'Good' : 'Fair'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Streaming Indicator */}
                                    {message.isStreaming && (
                                        <div className="mt-2 flex items-center space-x-1 text-xs text-muted-foreground">
                                            <Sparkles className="h-3 w-3 animate-pulse" />
                                            <span>AI is thinking...</span>
                                        </div>
                                    )}

                                        {/* Timestamp */}
                                        <div className={`mt-2 text-xs text-right ${
                                            message.role === 'user'
                                                ? 'text-primary-foreground/70'
                                                : 'text-muted-foreground'
                                        }`}>
                                            {message.timestamp.toLocaleTimeString()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Action Buttons */}
                    {!chatExpanded && messages.length === 1 && (
                        <div className="p-3 border-t border-border">
                            <div className="space-y-2 text-xs">
                                <Button
                                    variant="ghost"
                                    onClick={() => setInputMessage("What's the current flood risk in Texas?")}
                                    className="w-full justify-start p-2 bg-muted hover:bg-muted/80 rounded text-muted-foreground hover:text-foreground transition-colors h-auto text-xs"
                                >
                                    💧 Current Risk Status
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setInputMessage("Which watersheds need immediate attention?")}
                                    className="w-full justify-start p-2 bg-muted hover:bg-muted/80 rounded text-muted-foreground hover:text-foreground transition-colors h-auto text-xs"
                                >
                                    🚨 Priority Areas
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setInputMessage("What should I do if I'm in a flood zone?")}
                                    className="w-full justify-start p-2 bg-muted hover:bg-muted/80 rounded text-muted-foreground hover:text-foreground transition-colors h-auto text-xs"
                                >
                                    🛡️ Safety Guidance
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Enhanced Chat Input */}
                    <div className="p-4 border-t border-border">
                        <div className="space-y-3">
                            {/* Context Info */}
                            {selectedWatershed && selectedWatershed !== "none" && (
                                <div className="text-xs text-primary bg-primary/20 border border-primary/30 rounded px-2 py-1">
                                    🎯 Context: {selectedWatershed}
                                </div>
                            )}

                            {/* Input Area */}
                            <div className="flex items-end space-x-2">
                                <textarea
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={chatMode === 'normal'
                                        ? "Ask about flood conditions, safety, or risk assessment..."
                                        : `Ask ${natAgentType.replace('_', ' ')} agent about flood analysis...`}
                                    className="flex-1 bg-input text-foreground placeholder-muted-foreground border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                                    rows={chatExpanded ? 4 : 2}
                                    disabled={isLoadingAI}
                                />
                                <Button
                                    onClick={handleSendMessage}
                                    disabled={!inputMessage.trim() || isLoadingAI}
                                    className="p-2 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center"
                                    title="Send message"
                                >
                                    {isLoadingAI ? (
                                        <Sparkles className="h-4 w-4 animate-pulse" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>

                            {/* Status Info */}
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                <span>
                                    {selectedProvider !== 'auto' && selectedModel
                                        ? `${selectedProvider}/${selectedModel}`
                                        : 'Auto Provider'
                                    }
                                    {useAgents && ' + Agent'}
                                </span>
                                <span>AI powered by real-time flood data</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Bar */}
            {refreshStatus && (
                <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center space-x-2">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">{refreshStatus}</span>
                </div>
            )}
        </div>
    )
}