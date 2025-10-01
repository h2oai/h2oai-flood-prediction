import type {
    AppConfig,
} from '@/types';
import { refreshTokenIfNeeded } from './auth';

// Base configuration
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const API_BASE = `${BASE_URL}/api`;

const getHeaders = async (): Promise<HeadersInit> => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${await getAccessToken()}`,
});

export const getAccessToken = async () => {
    if (import.meta.env.DEV) {
        return 'dev-token'
    }

    return refreshTokenIfNeeded()
}

// Remove auth token
export const removeAuthToken = (): void => {
    localStorage.removeItem('auth_token');
};

export const setRefreshToken = async (refresh_token: string) => {
    console.log(refresh_token, 'Setting refresh token');
    try {
        const response = await fetch(`${API_BASE}/auth/refresh_token`, {
            method: 'POST',
            headers: await getHeaders(),
            body: JSON.stringify({ refresh_token }),
        });

        if (!response.ok) {
            throw new Error(`Failed to set refresh token: ${response.statusText}`);
        }

        localStorage.setItem('refresh_token', refresh_token);
    } catch (error) {
        console.error('Error setting refresh token:', error);
        throw error;
    }
}

// ✅ FIXED: Make request function async and await headers
async function request<T>(
    url: string,
    options: RequestInit = {}
): Promise<T> {
    const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;

    try {
        const response = await fetch(fullUrl, {
            headers: await getHeaders(),
            ...options,
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch {
                // If response is not JSON, use the status text
            }

            throw new Error(errorMessage);
        }

        // Handle empty responses
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }

        return {} as T;
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Network error occurred');
    }
}

// =============================================================================
// Configuration API
// =============================================================================

export const configApi = {
    getConfig: (): Promise<AppConfig> =>
        request<AppConfig>('/config'),
};

// =============================================================================
// Dashboard API
// =============================================================================

export interface DashboardSummary {
    total_watersheds: number;
    active_alerts: number;
    high_risk_watersheds: number;
    moderate_risk_watersheds: number;
    low_risk_watersheds: number;
    last_updated: string;
}

export interface Watershed {
    id: number;
    name: string;
    location_lat?: number;
    location_lng?: number;
    basin_size_sqmi?: number;
    current_streamflow_cfs: number;
    current_risk_level: string;
    risk_score: number;
    flood_stage_cfs?: number;
    trend?: string;
    trend_rate_cfs_per_hour?: number;
    usgs_site_code?: string;
    data_source?: string;
    data_quality?: string;
    last_api_update?: string;
    last_updated: string;
}

export interface Alert {
    alert_id: number;
    alert_type: string;
    watershed: string;
    message: string;
    severity: string;
    issued_time: string;
    expires_time?: string;
    affected_counties?: string[];
}

export interface RiskTrendPoint {
    time: string;
    risk: number;
    watersheds: number;
}

export interface DashboardData {
    summary: DashboardSummary;
    watersheds: Watershed[];
    alerts: Alert[];
    risk_trends: RiskTrendPoint[];
}

export const dashboardApi = {
    // Get complete dashboard data
    getDashboardData: (): Promise<DashboardData> =>
        request<DashboardData>('/dashboard'),

    // Get dashboard summary only
    getDashboardSummary: (): Promise<DashboardSummary> =>
        request<DashboardSummary>('/dashboard/summary'),

    // Get all watersheds
    getWatersheds: (): Promise<Watershed[]> =>
        request<Watershed[]>('/watersheds'),

    // Get active alerts
    getAlerts: (limit?: number): Promise<Alert[]> =>
        request<Alert[]>(`/alerts${limit ? `?limit=${limit}` : ''}`),

    // Populate sample data
    populateSampleData: (): Promise<{ status: string; message: string }> =>
        request('/dashboard/populate-sample-data', { method: 'POST' }),

    // Refresh USGS data
    refreshUsgsData: (): Promise<{ status: string; message: string; job_id: string }> =>
        request('/dashboard/refresh-usgs-data', { method: 'POST' }),

    // Update single watershed with USGS data
    updateSingleWatershed: (watershedId: number): Promise<{ status: string; message: string; job_id: string }> =>
        request(`/dashboard/update-single-watershed/${watershedId}`, { method: 'POST' }),

    // Get dashboard insights and metrics
    getDashboardInsights: (): Promise<{
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
    }> =>
        request('/dashboard/insights'),
};

// =============================================================================
// Job Management API  
// =============================================================================

export interface JobInfo {
    id: string;
    state: string; // RQ job state: "queued", "started", "finished", "failed"
    status: string; // Custom status message from job context
    aborted: boolean;
    name: string;
    enqueued_at?: string;
    started_at?: string;
    ended_at?: string;
    result?: any;
    exc_info?: string;
}

export const jobApi = {
    // Get job status
    getJob: (jobId: string): Promise<JobInfo> =>
        request<JobInfo>(`/jobs/${jobId}`),

    // Get job status updates (simple polling)
    pollJob: async (jobId: string, callback: (job: JobInfo) => void, interval: number = 2000): Promise<JobInfo> => {
        return new Promise((resolve, reject) => {
            const poll = async () => {
                try {
                    const job = await jobApi.getJob(jobId);
                    callback(job);
                    
                    // Check job.state (RQ status) instead of job.status (custom message)
                    if (job.state === 'finished' || job.state === 'failed') {
                        resolve(job);
                    } else {
                        setTimeout(poll, interval);
                    }
                } catch (error) {
                    reject(error);
                }
            };
            poll();
        });
    },
};

// =============================================================================
// Analytics API
// =============================================================================

export interface HistoricalDataPoint {
    date: string;
    time: string;
    avg_risk_score: number;
    avg_flow: number;
    high_risk_count: number;
    alerts_count: number;
}

export interface RiskDistribution {
    name: string;
    value: number;
    color: string;
    percentage: number;
}

export interface WatershedComparison {
    name: string;
    risk_score: number;
    flow_ratio: number;
    current_flow: number;
}

export interface FlowComparison {
    name: string;
    current_flow: number;
    flood_stage: number;
    capacity_used: number;
}

export interface AnalyticsData {
    summary: {
        avg_risk_score: number;
        high_risk_count: number;
        avg_flow: number;
        trending_up_count: number;
    };
    historical_data: HistoricalDataPoint[];
    risk_distribution: RiskDistribution[];
    watershed_comparison: WatershedComparison[];
    flow_comparison: FlowComparison[];
}

export const analyticsApi = {
    // Get complete analytics data
    getAnalyticsData: (timeRange: string = '7d', metric: string = 'risk_score'): Promise<AnalyticsData> =>
        request<AnalyticsData>(`/analytics?time_range=${timeRange}&metric=${metric}`),

    // Get historical data only
    getHistoricalData: (timeRange: string = '7d'): Promise<HistoricalDataPoint[]> =>
        request<HistoricalDataPoint[]>(`/analytics/historical?time_range=${timeRange}`),

    // Get risk distribution only
    getRiskDistribution: (): Promise<RiskDistribution[]> =>
        request<RiskDistribution[]>('/analytics/risk-distribution'),

    // Get watershed comparison only
    getWatershedComparison: (): Promise<WatershedComparison[]> =>
        request<WatershedComparison[]>('/analytics/watershed-comparison'),

    // Get flow comparison only
    getFlowComparison: (): Promise<FlowComparison[]> =>
        request<FlowComparison[]>('/analytics/flow-comparison'),
};

// =============================================================================
// AI Chat API
// =============================================================================

export interface ChatMessage {
    message: string;
    watershed_id?: number;
    context?: Record<string, any>;
    use_agent?: boolean;
    model?: string;
}

export interface ChatResponse {
    response: string;
    confidence: number;
    recommendations: string[];
    timestamp: string;
}

export const aiApi = {
    // Get available LLM models (with optional provider)
    getModels: (provider?: string): Promise<{ models: string[]; default_model: string; provider: string }> =>
        request<{ models: string[]; default_model: string; provider: string }>(`/ai/models${provider ? `?provider=${provider}` : ''}`),

    // Send message to AI assistant
    chat: (message: ChatMessage): Promise<ChatResponse> =>
        request<ChatResponse>('/ai/chat', {
            method: 'POST',
            body: JSON.stringify(message),
        }),

    // Stream chat with AI assistant
    streamChat: async function* (message: ChatMessage): AsyncGenerator<any, void, unknown> {
        const fullUrl = `${API_BASE}/ai/chat/stream`;
        
        try {
            const response = await fetch(fullUrl, {
                method: 'POST',
                headers: await getHeaders(),
                body: JSON.stringify(message),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body reader available');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    
                    // Keep the last incomplete line in the buffer
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.substring(6));
                                
                                if (data.error) {
                                    throw new Error(data.error);
                                }
                                
                                if (data.chunk && !data.done) {
                                    yield data.chunk;
                                }
                                
                                if (data.evaluation) {
                                    // Handle evaluation data separately
                                    yield { type: 'evaluation', data: data.evaluation };
                                }
                                
                                if (data.done) {
                                    return;
                                }
                            } catch (parseError) {
                                console.warn('Failed to parse streaming data:', parseError);
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
        } catch (error) {
            throw error instanceof Error ? error : new Error('Streaming request failed');
        }
    },

    // =============================================================================
    // AI Provider Management
    // =============================================================================

    // Get all available providers
    getProviders: (): Promise<{
        providers: Record<string, any>;
        current_default: string;
        nvidia_features: {
            agents_enabled: boolean;
            rag_enabled: boolean;
            evaluator_enabled: boolean;
        };
    }> =>
        request<{
            providers: Record<string, any>;
            current_default: string;
            nvidia_features: {
                agents_enabled: boolean;
                rag_enabled: boolean;
                evaluator_enabled: boolean;
            };
        }>('/ai/providers'),

    // Get specific provider details
    getProvider: (providerName: string): Promise<any> =>
        request<any>(`/ai/providers/${providerName}`),

    // Get models for specific provider
    getProviderModels: (providerName: string): Promise<{
        provider: string;
        models: string[];
        default_model: string;
        supports_agents: boolean;
    }> =>
        request<{
            provider: string;
            models: string[];
            default_model: string;
            supports_agents: boolean;
        }>(`/ai/providers/${providerName}/models`),

    // Enhanced chat with provider selection
    enhancedChat: (message: {
        message: string;
        watershed_id?: number;
        context?: Record<string, any>;
        provider?: string;
        model?: string;
        use_agent?: boolean;
        temperature?: number;
        max_tokens?: number;
    }): Promise<{
        response: string;
        provider_used: string;
        model_used: string;
        agent_used: boolean;
        confidence: number;
        recommendations: string[];
        timestamp: string;
    }> =>
        request<{
            response: string;
            provider_used: string;
            model_used: string;
            agent_used: boolean;
            confidence: number;
            recommendations: string[];
            timestamp: string;
        }>('/ai/chat/enhanced', {
            method: 'POST',
            body: JSON.stringify(message),
        }),

    // Enhanced streaming chat with provider selection
    enhancedStreamChat: async function* (message: {
        message: string;
        watershed_id?: number;
        context?: Record<string, any>;
        provider?: string;
        model?: string;
        use_agent?: boolean;
        temperature?: number;
        max_tokens?: number;
    }): AsyncGenerator<any, void, unknown> {
        const fullUrl = `${API_BASE}/ai/chat/enhanced/stream`;
        
        try {
            const response = await fetch(fullUrl, {
                method: 'POST',
                headers: await getHeaders(),
                body: JSON.stringify(message),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body reader available');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    
                    // Keep the last incomplete line in the buffer
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.substring(6));
                                
                                if (data.error) {
                                    throw new Error(data.error);
                                }
                                
                                if (data.chunk && !data.done) {
                                    yield data.chunk;
                                }
                                
                                if (data.provider) {
                                    // Provider info at start of stream
                                    yield { type: 'provider_info', data };
                                }
                                
                                if (data.evaluation) {
                                    // Handle evaluation data separately
                                    yield { type: 'evaluation', data: data.evaluation };
                                }
                                
                                if (data.done) {
                                    // Stream completion with metadata
                                    yield { type: 'stream_complete', data };
                                    return;
                                }
                            } catch (parseError) {
                                console.warn('Failed to parse enhanced streaming data:', parseError);
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
        } catch (error) {
            throw error instanceof Error ? error : new Error('Enhanced streaming request failed');
        }
    },

    // =============================================================================
    // NAT Agent API
    // =============================================================================

    // Get available NAT agents
    getNATAgents: (): Promise<{
        available_agents: Record<string, string>;
        base_path: string;
        nat_available: boolean;
        description: Record<string, string>;
    }> =>
        request<{
            available_agents: Record<string, string>;
            base_path: string;
            nat_available: boolean;
            description: Record<string, string>;
        }>('/nat/agents'),

    // Chat with NAT agents (non-streaming)
    natChat: (message: {
        message: string;
        agent_type?: string;
        location?: string;
        forecast_hours?: number;
        scenario?: string;
        custom_prompt?: string;
    }): Promise<{
        output: string;
        agent_type: string;
        status: string;
        logs?: Array<Record<string, any>>;
        timestamp: string;
    }> =>
        request<{
            output: string;
            agent_type: string;
            status: string;
            logs?: Array<Record<string, any>>;
            timestamp: string;
        }>('/nat/chat', {
            method: 'POST',
            body: JSON.stringify(message),
        }),

    // Stream chat with NAT agents
    natStreamChat: async function* (message: {
        message: string;
        agent_type?: string;
        location?: string;
        forecast_hours?: number;
        scenario?: string;
        custom_prompt?: string;
    }): AsyncGenerator<any, void, unknown> {
        const fullUrl = `${API_BASE}/nat/chat/stream`;
        
        try {
            const response = await fetch(fullUrl, {
                method: 'POST',
                headers: await getHeaders(),
                body: JSON.stringify(message),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body reader available');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    
                    // Keep the last incomplete line in the buffer
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.substring(6));
                                
                                if (data.error) {
                                    throw new Error(data.error);
                                }
                                
                                // Handle different types of NAT stream events
                                if (data.type === 'start') {
                                    yield { type: 'start', data };
                                } else if (data.type === 'log') {
                                    yield { type: 'log', data: data.log };
                                } else if (data.type === 'result') {
                                    yield { type: 'result', data };
                                } else if (data.type === 'error') {
                                    throw new Error(data.error);
                                } else if (data.type === 'keepalive') {
                                    // Keep connection alive, don't yield
                                    continue;
                                } else if (data.type === 'done') {
                                    return;
                                }
                            } catch (parseError) {
                                console.warn('Failed to parse NAT streaming data:', parseError);
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
        } catch (error) {
            throw error instanceof Error ? error : new Error('NAT streaming request failed');
        }
    },
};

// =============================================================================
// Settings API
// =============================================================================

export interface UserSettings {
    notifications: {
        enabled: boolean;
        highRiskAlerts: boolean;
        moderateRiskAlerts: boolean;
        dataUpdates: boolean;
        systemMaintenance: boolean;
    };
    display: {
        darkMode: boolean;
        autoRefresh: boolean;
        refreshInterval: number;
        defaultView: string;
        mapLayer: string;
    };
    data: {
        cacheEnabled: boolean;
        offlineMode: boolean;
        dataRetention: number;
        exportFormat: string;
    };
}

export const settingsApi = {
    // Get current user settings
    getSettings: (): Promise<UserSettings> =>
        request<UserSettings>('/settings'),

    // Update user settings
    updateSettings: (settings: UserSettings): Promise<{ status: string; message: string }> =>
        request('/settings', {
            method: 'POST',
            body: JSON.stringify(settings),
        }),

    // Reset settings to defaults
    resetSettings: (): Promise<{ status: string; message: string }> =>
        request('/settings', {
            method: 'DELETE',
        }),

    // Export settings as JSON file
    exportSettings: async (): Promise<Blob> => {
        const response = await fetch(`${API_BASE}/settings/export`, {
            headers: await getHeaders(),
        });
        
        if (!response.ok) {
            throw new Error(`Failed to export settings: ${response.statusText}`);
        }
        
        return response.blob();
    },

    // Import settings from file
    importSettings: async (file: File): Promise<UserSettings> => {
        const fileContent = await file.text();
        
        const response = await fetch(`${API_BASE}/settings/import`, {
            method: 'POST',
            headers: {
                ...await getHeaders(),
                'Content-Type': 'application/octet-stream',
            },
            body: fileContent,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to import settings: ${response.statusText}`);
        }

        const result = await response.json();
        return result.settings;
    },
};

// =============================================================================
// Evaluation API
// =============================================================================

export interface EvaluationMetrics {
    helpfulness: number;
    accuracy: number;
    relevance: number;
    coherence: number;
    safety: number;
    overall: number;
    confidence: number;
}

export interface EvaluationResult {
    evaluation_id: string;
    metrics: EvaluationMetrics;
    reasoning: string;
    duration_ms: number;
    timestamp: string;
}

export interface EvaluationHistoryItem {
    id: string;
    timestamp: string;
    question: string;
    model: string;
    agent_used: boolean;
    overall_score: number;
    confidence: number;
    safety_score: number;
}

export interface EvaluationStats {
    total_evaluations: number;
    agent_evaluations: number;
    non_agent_evaluations: number;
    agent_avg_scores: EvaluationMetrics;
    non_agent_avg_scores: EvaluationMetrics;
}

export const evaluationApi = {
    // Evaluate a response manually
    evaluate: (data: {
        question: string;
        response: string;
        model: string;
        agent_used: boolean;
        watershed_context?: Record<string, any>;
    }): Promise<EvaluationResult> =>
        request<EvaluationResult>('/evaluation/evaluate', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // Get evaluation statistics
    getStats: (hours: number = 24): Promise<EvaluationStats> =>
        request<EvaluationStats>(`/evaluation/stats?hours=${hours}`),

    // Get evaluation history
    getHistory: (limit: number = 50): Promise<{ evaluations: EvaluationHistoryItem[] }> =>
        request<{ evaluations: EvaluationHistoryItem[] }>(`/evaluation/history?limit=${limit}`),
};

// =============================================================================
// AI Agents API
// =============================================================================

export interface AgentInsight {
    title: string;
    value: string;
    change?: string;
    trend?: 'up' | 'down' | 'stable';
    urgency: 'low' | 'normal' | 'high' | 'critical';
    timestamp: string;
}

export interface AgentAlert {
    id: string;
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    source_agent: string;
    affected_areas: string[];
    recommendations: string[];
    expires_at?: string;
    created_at: string;
}

export interface AgentStatus {
    name: string;
    description: string;
    is_running: boolean;
    last_check?: string;
    check_interval: number;
    insights_count: number;
    active_alerts_count: number;
}

export interface AgentSummary {
    total_agents: number;
    running_agents: number;
    total_insights: number;
    urgent_insights: number;
    total_alerts: number;
    critical_alerts: number;
    last_update: string;
    agent_statuses: Record<string, AgentStatus>;
}

export interface AgentDetails {
    name: string;
    description: string;
    status: AgentStatus;
    insights: AgentInsight[];
    alerts: AgentAlert[];
    configuration: {
        check_interval: number;
        last_check?: string;
    };
    [key: string]: any; // Agent-specific data
}

export interface EmergencyAlertRequest {
    title: string;
    message: string;
    severity?: 'info' | 'warning' | 'critical';
    affected_areas?: string[];
    recommendations?: string[];
    channels?: string[];
}

export interface ForecastData {
    generated_at: string;
    forecast_horizon_hours: number;
    watersheds_forecast: Array<{
        watershed_name: string;
        watershed_id: number;
        current_conditions: {
            flow_cfs: number;
            risk_score: number;
        };
        predicted_conditions: {
            flow_cfs: number;
            risk_score: number;
            risk_level: string;
        };
        confidence: number;
        prediction_factors: {
            trend_rate: number;
            data_age_hours: number;
            trend_stability: number;
        };
    }>;
    overall_confidence: number;
    methodology: string;
}

export const agentsApi = {
    // Get status of all AI agents
    getStatus: (): Promise<{
        agents: Record<string, AgentStatus>;
        manager_initialized: boolean;
        last_update: string;
    }> =>
        request<{
            agents: Record<string, AgentStatus>;
            manager_initialized: boolean;
            last_update: string;
        }>('/agents'),

    // Get insights from all AI agents
    getInsights: (): Promise<{
        insights: Record<string, AgentInsight[]>;
        generated_at: string;
    }> =>
        request<{
            insights: Record<string, AgentInsight[]>;
            generated_at: string;
        }>('/agents/insights'),

    // Get alerts from all AI agents
    getAlerts: (): Promise<{
        alerts: Record<string, AgentAlert[]>;
        generated_at: string;
    }> =>
        request<{
            alerts: Record<string, AgentAlert[]>;
            generated_at: string;
        }>('/agents/alerts'),

    // Get summary of all agent activities for dashboard
    getSummary: (): Promise<AgentSummary> =>
        request<AgentSummary>('/agents/summary'),

    // Get detailed information about a specific agent
    getAgentDetails: (agentName: string): Promise<AgentDetails> =>
        request<AgentDetails>(`/agents/${agentName}`),

    // Force an immediate check for a specific agent
    forceAgentCheck: (agentName: string): Promise<{
        status: string;
        message: string;
        result: {
            insights: AgentInsight[];
            alerts: AgentAlert[];
            status: AgentStatus;
        };
    }> =>
        request<{
            status: string;
            message: string;
            result: {
                insights: AgentInsight[];
                alerts: AgentAlert[];
                status: AgentStatus;
            };
        }>(`/agents/${agentName}/check`, {
            method: 'POST',
        }),

    // Start all AI agents
    startAgents: (): Promise<{ status: string; message: string }> =>
        request<{ status: string; message: string }>('/agents/start', {
            method: 'POST',
        }),

    // Stop all AI agents
    stopAgents: (): Promise<{ status: string; message: string }> =>
        request<{ status: string; message: string }>('/agents/stop', {
            method: 'POST',
        }),

    // Trigger data collection from external APIs
    collectExternalData: (): Promise<{
        status: string;
        message: string;
        data: {
            usgs_data: Record<string, any>;
            noaa_data: Record<string, any>;
            weather_data: Record<string, any>;
            collected_at: string;
        };
    }> =>
        request<{
            status: string;
            message: string;
            data: {
                usgs_data: Record<string, any>;
                noaa_data: Record<string, any>;
                weather_data: Record<string, any>;
                collected_at: string;
            };
        }>('/agents/collect-data', {
            method: 'POST',
        }),

    // Generate AI-powered flood forecast
    generateForecast: (hoursAhead: number = 24): Promise<{
        status: string;
        forecast: ForecastData;
    }> =>
        request<{
            status: string;
            forecast: ForecastData;
        }>(`/agents/forecast?hours_ahead=${hoursAhead}`, {
            method: 'POST',
        }),

    // Send emergency alert through AI agents
    sendEmergencyAlert: (alertRequest: EmergencyAlertRequest): Promise<{
        status: string;
        message: string;
    }> =>
        request<{
            status: string;
            message: string;
        }>('/agents/emergency-alert', {
            method: 'POST',
            body: JSON.stringify(alertRequest),
        }),

    // Get list of available agents
    getAvailableAgents: (): Promise<{
        agents: Array<{
            name: string;
            key: string;
            description: string;
            is_running: boolean;
        }>;
        total_count: number;
    }> =>
        request<{
            agents: Array<{
                name: string;
                key: string;
                description: string;
                is_running: boolean;
            }>;
            total_count: number;
        }>('/agents/available'),
};

// Helper functions for display
export const getRiskBadgeClass = (riskLevel: string): string => {
    switch (riskLevel) {
        case 'High': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
        case 'Moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'
        case 'Low': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
        default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
    }
};

export const formatStreamflow = (cfs: number): string => {
    return `${cfs.toLocaleString()} CFS`;
};

export const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
};

// Example usage of the configApi
// =============================================================================
// Instance Management API
// =============================================================================

// export const instanceApi = {
//     // Get all instances
//     getInstances: (): Promise<Instance[]> =>
//         request<Instance[]>('/instances'),

//     // Get single instance
//     getInstance: (instanceId: string): Promise<Instance> =>
//         request<Instance>(`/instances/${instanceId}`),

//     // Create new instance
//     createInstance: (data: AddInstanceRequest): Promise<Instance> =>
//         request<Instance>('/instances', {
//             method: 'POST',
//             body: JSON.stringify(data),
//         }),

//     // Update instance
//     updateInstance: (instanceId: string, data: UpdateInstanceRequest): Promise<{ status: string; message: string }> =>
//         request(`/instances/${instanceId}`, {
//             method: 'PATCH',
//             body: JSON.stringify(data),
//         }),

//     // Delete instance
//     deleteInstance: (instanceId: string): Promise<{ status: string; message: string }> =>
//         request(`/instances/${instanceId}`, {
//             method: 'DELETE',
//         }),

//     // Get instance statistics
//     getInstanceStats: (instanceId: string): Promise<InstanceStats> =>
//         request<InstanceStats>(`/instances/${instanceId}/stats`),

//     // Get runtime status
//     getRuntimeStatus: (instanceId: string): Promise<RuntimeStatus> =>
//         request<RuntimeStatus>(`/instances/${instanceId}/runtime-status`),

//     // Start monitoring for instance
//     startMonitoring: (instanceId: string): Promise<{ status: string; message: string; job_id: string; poll_interval: number }> =>
//         request(`/instances/${instanceId}/start-monitoring`, {
//             method: 'POST',
//         }),

//     // Stop monitoring for instance
//     stopMonitoring: (instanceId: string): Promise<{ status: string; message: string }> =>
//         request(`/instances/${instanceId}/stop-monitoring`, {
//             method: 'POST',
//         }),

//     // Start polling for instance (backward compatibility)
//     startPolling: (instanceId: string): Promise<{ status: string; message: string; job_id: string; poll_interval: number }> =>
//         request(`/instances/${instanceId}/start-polling`, {
//             method: 'POST',
//         }),

//     // Stop polling for instance (backward compatibility)
//     stopPolling: (instanceId: string): Promise<{ status: string; message: string }> =>
//         request(`/instances/${instanceId}/stop-polling`, {
//             method: 'POST',
//         }),

//     // Get monitoring status
//     getMonitoringStatus: (instanceId: string): Promise<PollingStatus> =>
//         request<PollingStatus>(`/instances/${instanceId}/monitoring-status`),

//     // Get polling status (backward compatibility)
//     getPollingStatus: (instanceId: string): Promise<PollingStatus> =>
//         request<PollingStatus>(`/instances/${instanceId}/polling-status`),

//     // Get duplicate statistics
//     getDuplicateStats: (instanceId: string): Promise<DuplicateStats> =>
//         request<DuplicateStats>(`/instances/${instanceId}/duplicates`),
// };

// // =============================================================================
// // Enhanced Logs API
// // =============================================================================

// export const logsApi = {
//     // Get logs with pagination and filtering
//     getLogs: (instanceId: string, params: LogSearchParams = {}): Promise<LogsResponse> => {
//         const queryParams = new URLSearchParams();

//         if (params.page) queryParams.append('page', params.page.toString());
//         if (params.per_page) queryParams.append('per_page', params.per_page.toString());
//         if (params.level) queryParams.append('level', params.level);
//         if (params.search) queryParams.append('search', params.search);
//         if (params.before_id) queryParams.append('before_id', params.before_id.toString());
//         if (params.after_id) queryParams.append('after_id', params.after_id.toString());
//         if (params.sort_order) queryParams.append('sort_order', params.sort_order);

//         const queryString = queryParams.toString();
//         const url = `/instances/${instanceId}/logs${queryString ? `?${queryString}` : ''}`;

//         return request<LogsResponse>(url);
//     },

//     // Get recent logs (always returns latest logs sorted by timestamp desc)
//     getRecentLogs: (instanceId: string, limit: number = 50): Promise<{ logs: LogEntry[] }> => {
//         return request(`/instances/${instanceId}/logs/recent?limit=${limit}`);
//     },

//     // Get logs after a specific timestamp (for real-time updates)
//     getLogsAfterTimestamp: (instanceId: string, timestamp: string, limit: number = 50): Promise<{ logs: LogEntry[] }> => {
//         const queryParams = new URLSearchParams({
//             after_timestamp: timestamp,
//             limit: limit.toString(),
//             sort_order: 'asc'
//         });
//         return request(`/instances/${instanceId}/logs/after?${queryParams.toString()}`);
//     },

//     // Get logs before a specific ID (for loading older logs)
//     getLogsBefore: (instanceId: string, beforeId: number, limit: number = 100): Promise<LogsResponse> => {
//         const queryParams = new URLSearchParams({
//             before_id: beforeId.toString(),
//             per_page: limit.toString(),
//             sort_order: 'desc'
//         });
//         return request<LogsResponse>(`/instances/${instanceId}/logs?${queryParams.toString()}`);
//     },

//     // Get logs after a specific ID (for loading newer logs)
//     getLogsAfter: (instanceId: string, afterId: number, limit: number = 100): Promise<LogsResponse> => {
//         const queryParams = new URLSearchParams({
//             after_id: afterId.toString(),
//             per_page: limit.toString(),
//             sort_order: 'asc'
//         });
//         return request<LogsResponse>(`/instances/${instanceId}/logs?${queryParams.toString()}`);
//     },

//     // Stream logs (for real-time monitoring)
//     streamLogs: (instanceId: string, onLog: (log: LogEntry) => void, onError: (error: Error) => void): () => void => {
//         let cancelled = false;
//         let lastTimestamp: string | null = null;

//         const poll = async () => {
//             if (cancelled) return;

//             try {
//                 const params: any = { limit: 10 };
//                 if (lastTimestamp) {
//                     params.after_timestamp = lastTimestamp;
//                 }

//                 const response = await logsApi.getLogsAfterTimestamp(instanceId, lastTimestamp || new Date().toISOString(), 10);

//                 if (response.logs.length > 0) {
//                     response.logs.forEach(onLog);
//                     lastTimestamp = response.logs[response.logs.length - 1].timestamp;
//                 }
//             } catch (error) {
//                 onError(error instanceof Error ? error : new Error('Unknown error'));
//             }

//             if (!cancelled) {
//                 setTimeout(poll, 5000); // Poll every 5 seconds
//             }
//         };

//         poll();

//         return () => {
//             cancelled = true;
//         };
//     },
// };

// // =============================================================================
// // Health Check API
// // =============================================================================

// export const healthApi = {
//     check: (): Promise<{
//         status: string;
//         redis: string;
//         database: string;
//         database_version: number;
//         active_jobs: number;
//         timestamp: string;
//     }> => request('/health'),
// };

// // =============================================================================
// // Enhanced WebSocket Connection
// // =============================================================================

// export class WebSocketManager {
//     private ws: WebSocket | null = null;
//     private url: string;
//     private reconnectAttempts: number = 0;
//     private maxReconnectAttempts: number = 5;
//     private reconnectInterval: number = 5000;
//     private listeners: Map<string, Set<(data: any) => void>> = new Map();
//     private heartbeatInterval: NodeJS.Timeout | null = null;

//     constructor(userId: string) {
//         const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
//         const wsHost = window.location.host;
//         this.url = `${wsProtocol}//${wsHost}/ws/${userId}`;
//     }

//     connect(): void {
//         try {
//             this.ws = new WebSocket(this.url);

//             this.ws.onopen = () => {
//                 console.log('WebSocket connected');
//                 this.reconnectAttempts = 0;
//                 this.startHeartbeat();
//                 this.emit('connected', null);
//             };

//             this.ws.onmessage = (event) => {
//                 try {
//                     const message = JSON.parse(event.data);
//                     this.emit(message.type, message.data);
//                 } catch (error) {
//                     console.error('Failed to parse WebSocket message:', error);
//                 }
//             };

//             this.ws.onclose = () => {
//                 console.log('WebSocket disconnected');
//                 this.stopHeartbeat();
//                 this.emit('disconnected', null);
//                 this.attemptReconnect();
//             };

//             this.ws.onerror = (error) => {
//                 console.error('WebSocket error:', error);
//                 this.emit('error', error);
//             };
//         } catch (error) {
//             console.error('Failed to create WebSocket connection:', error);
//         }
//     }

//     private startHeartbeat(): void {
//         this.heartbeatInterval = setInterval(() => {
//             if (this.ws && this.ws.readyState === WebSocket.OPEN) {
//                 this.ws.send(JSON.stringify({ type: 'ping' }));
//             }
//         }, 30000); // Send ping every 30 seconds
//     }

//     private stopHeartbeat(): void {
//         if (this.heartbeatInterval) {
//             clearInterval(this.heartbeatInterval);
//             this.heartbeatInterval = null;
//         }
//     }

//     private attemptReconnect(): void {
//         if (this.reconnectAttempts < this.maxReconnectAttempts) {
//             this.reconnectAttempts++;
//             console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

//             setTimeout(() => {
//                 this.connect();
//             }, this.reconnectInterval * this.reconnectAttempts);
//         } else {
//             console.error('Max reconnection attempts reached');
//         }
//     }

//     on(event: string, callback: (data: any) => void): void {
//         if (!this.listeners.has(event)) {
//             this.listeners.set(event, new Set());
//         }
//         this.listeners.get(event)!.add(callback);
//     }

//     off(event: string, callback: (data: any) => void): void {
//         if (this.listeners.has(event)) {
//             this.listeners.get(event)!.delete(callback);
//         }
//     }

//     private emit(event: string, data: any): void {
//         if (this.listeners.has(event)) {
//             this.listeners.get(event)!.forEach(callback => callback(data));
//         }
//     }

//     send(message: any): void {
//         if (this.ws && this.ws.readyState === WebSocket.OPEN) {
//             this.ws.send(JSON.stringify(message));
//         } else {
//             console.warn('WebSocket is not connected');
//         }
//     }

//     disconnect(): void {
//         if (this.ws) {
//             this.ws.close();
//             this.ws = null;
//         }
//         this.stopHeartbeat();
//         this.listeners.clear();
//     }

//     isConnected(): boolean {
//         return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
//     }
// }

// // =============================================================================
// // Error Handling Utilities
// // =============================================================================

// export const handleApiError = (error: unknown): ApiError => {
//     if (error instanceof Error) {
//         return {
//             message: error.message,
//             status: (error as any).status,
//         };
//     }

//     return {
//         message: 'An unexpected error occurred',
//     };
// };

// // =============================================================================
// // Enhanced Helper Functions
// // =============================================================================

// export const formatTimestamp = (timestamp: string): string => {
//     return new Date(timestamp).toLocaleString('en-US', {
//         year: 'numeric',
//         month: '2-digit',
//         day: '2-digit',
//         hour: '2-digit',
//         minute: '2-digit',
//         second: '2-digit',
//         hour12: false
//     });
// };

// export const formatDuration = (start: string, end?: string): string => {
//     const startTime = new Date(start);
//     const endTime = end ? new Date(end) : new Date();
//     const diffMs = endTime.getTime() - startTime.getTime();

//     const seconds = Math.floor(diffMs / 1000);
//     const minutes = Math.floor(seconds / 60);
//     const hours = Math.floor(minutes / 60);

//     if (hours > 0) {
//         return `${hours}h ${minutes % 60}m`;
//     } else if (minutes > 0) {
//         return `${minutes}m ${seconds % 60}s`;
//     } else {
//         return `${seconds}s`;
//     }
// };

// export const getLogLevelColor = (level: string): string => {
//     const colors: Record<string, string> = {
//         INFO: 'text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
//         ERROR: 'text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
//         WARN: 'text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
//         WARNING: 'text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
//         DEBUG: 'text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800',
//         FATAL: 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
//     };
//     return colors[level] || colors.INFO;
// };

// export const getInstanceStatusColor = (status: string): string => {
//     const colors: Record<string, string> = {
//         active: 'text-green-600 dark:text-green-400',
//         paused: 'text-yellow-600 dark:text-yellow-400',
//         error: 'text-red-600 dark:text-red-400',
//         stopped: 'text-gray-600 dark:text-gray-400',
//     };
//     return colors[status] || colors.stopped;
// };

// export const getRuntimeStatusColor = (status?: string): string => {
//     if (!status) return 'text-gray-600 dark:text-gray-400';

//     const colors: Record<string, string> = {
//         'Running': 'text-green-600 dark:text-green-400',
//         'Pending': 'text-yellow-600 dark:text-yellow-400',
//         'CrashLoopBackOff': 'text-red-600 dark:text-red-400',
//         'Error': 'text-red-600 dark:text-red-400',
//         'Failed': 'text-red-600 dark:text-red-400',
//         'ImagePullBackOff': 'text-orange-600 dark:text-orange-400',
//         'Completed': 'text-blue-600 dark:text-blue-400',
//         'Succeeded': 'text-green-600 dark:text-green-400',
//     };
//     return colors[status] || 'text-gray-600 dark:text-gray-400';
// };

// export const formatEfficiency = (unique: number, total: number): string => {
//     if (total === 0) return '100%';
//     const percentage = (unique / total) * 100;
//     return `${percentage.toFixed(1)}%`;
// };

// export const formatFileSize = (bytes: number): string => {
//     const sizes = ['B', 'KB', 'MB', 'GB'];
//     if (bytes === 0) return '0 B';
//     const i = Math.floor(Math.log(bytes) / Math.log(1024));
//     return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
// };

// export const getTimeAgo = (timestamp: string): string => {
//     const now = new Date();
//     const time = new Date(timestamp);
//     const diffMs = now.getTime() - time.getTime();
//     const diffMinutes = Math.floor(diffMs / 60000);
//     const diffHours = Math.floor(diffMinutes / 60);
//     const diffDays = Math.floor(diffHours / 24);

//     if (diffMinutes < 1) return 'just now';
//     if (diffMinutes < 60) return `${diffMinutes}m ago`;
//     if (diffHours < 24) return `${diffHours}h ago`;
//     return `${diffDays}d ago`;
// };

// // Export default API object
export default {
    config: configApi,
    dashboard: dashboardApi,
    analytics: analyticsApi,
    ai: aiApi,
    settings: settingsApi,
    evaluation: evaluationApi,
    job: jobApi,
    agents: agentsApi,
};