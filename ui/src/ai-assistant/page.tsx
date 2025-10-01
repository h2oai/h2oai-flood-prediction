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
import { useState, useEffect, useRef } from 'react'
import {
    Send,
    Bot,
    RefreshCw,
    Sparkles,
    TrendingUp,
    Loader,
    BarChart3,
    Shield,
    Star,
    Settings,
    Zap,
    Brain,
    Database
} from 'lucide-react'
import { dashboardApi, aiApi, type Watershed } from '@/lib/api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

interface Message {
    id: number
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    confidence?: number
    recommendations?: string[]
    isError?: boolean
    isStreaming?: boolean
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


export default function Page() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 1,
            role: 'assistant',
            content: `Hello! I'm your AI Flood Prediction Assistant. I can help you understand flood risks, interpret data, and provide safety recommendations for Texas watersheds.

What would you like to know? You can ask me about:
• Current flood conditions for specific watersheds
• Safety recommendations and emergency guidance
• Data interpretation and flood forecasting
• Historical patterns and trends
• Emergency preparedness planning

Feel free to ask any questions about flood conditions or safety!`,
            timestamp: new Date()
        }
    ])

    const [inputMessage, setInputMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [selectedWatershed, setSelectedWatershed] = useState('')
    const [watersheds, setWatersheds] = useState<Watershed[]>([])
    const [loadingWatersheds, setLoadingWatersheds] = useState(true)
    const [hasUserSentMessage, setHasUserSentMessage] = useState(false)
    const [useAgents, setUseAgents] = useState(false)
    
    // NAT Agent Chat States
    const [chatMode, setChatMode] = useState<'normal' | 'nat'>('normal')
    const [natAgentType, setNatAgentType] = useState<string>('risk_analyzer')
    const [natLocation, setNatLocation] = useState<string>('Texas Region')
    const [natForecastHours, setNatForecastHours] = useState<number>(24)
    const [natScenario, setNatScenario] = useState<string>('routine_check')
    const [availableNATAgents, setAvailableNATAgents] = useState<any>({})
    const [loadingNATAgents, setLoadingNATAgents] = useState(true)
    
    // New NVIDIA provider states
    const [selectedProvider, setSelectedProvider] = useState<string>('auto')
    const [availableProviders, setAvailableProviders] = useState<any>({})
    const [selectedModel, setSelectedModel] = useState<string>('')
    const [availableModels, setAvailableModels] = useState<string[]>([])
    const [showSettings, setShowSettings] = useState(false)
    const [temperature, setTemperature] = useState<number>(0.7)
    const [maxTokens, setMaxTokens] = useState<number>(4096)
    const [loadingProviders, setLoadingProviders] = useState(true)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // Fetch watersheds data
    useEffect(() => {
        const fetchWatersheds = async () => {
            try {
                setLoadingWatersheds(true)
                const data = await dashboardApi.getWatersheds()
                setWatersheds(data)
            } catch (error) {
                console.error('Failed to fetch watersheds:', error)
            } finally {
                setLoadingWatersheds(false)
            }
        }

        fetchWatersheds()
    }, [])

    // Fetch AI providers and models
    useEffect(() => {
        const fetchProviders = async () => {
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

        fetchProviders()
    }, [])

    // Fetch NAT agents
    useEffect(() => {
        const fetchNATAgents = async () => {
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

        fetchNATAgents()
    }, [])

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


    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isLoading) return

        const userMessage: Message = {
            id: Date.now(),
            role: 'user',
            content: inputMessage,
            timestamp: new Date()
        }

        const currentInput = inputMessage
        setMessages(prev => [...prev, userMessage])
        setHasUserSentMessage(true)
        setIsLoading(true)

        // Create a placeholder assistant message with loading indicator
        const assistantMessageId = Date.now() + 1
        const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isStreaming: true
        }

        setMessages(prev => [...prev, assistantMessage])

        // Clear input only after messages are added
        setInputMessage('')

        try {
            if (chatMode === 'normal') {
                // Normal chat mode - existing logic
                // Get watershed data for context
                const selectedWatershedData = selectedWatershed && watersheds.length > 0
                    ? watersheds.find(w => w.name === selectedWatershed)
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
                    console.log('Received chunk:', chunk, typeof chunk); // Debug logging
                    
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
                    console.log('Received NAT chunk:', chunk, typeof chunk);
                    
                    if (typeof chunk === 'object' && chunk !== null) {
                        if (chunk.type === 'start') {
                            // Handle start metadata
                            console.log('NAT agent started:', chunk.data)
                        } else if (chunk.type === 'log') {
                            // Handle agent logs
                            agentLogs.push(chunk.data)
                            
                            // Update message with current logs for real-time display
                            setMessages(prev => prev.map(msg =>
                                msg.id === assistantMessageId
                                    ? { 
                                        ...msg, 
                                        content: `**Agent ${natAgentType} is processing...**\n\n**Logs:**\n${agentLogs.map(log => `[${log.level}] ${log.message}`).join('\n')}`,
                                        isStreaming: true 
                                    }
                                    : msg
                            ))
                        } else if (chunk.type === 'result') {
                            // Handle final result
                            fullContent = chunk.data.output || 'Agent processing completed.'
                            
                            setMessages(prev => prev.map(msg =>
                                msg.id === assistantMessageId
                                    ? { 
                                        ...msg, 
                                        content: `**Agent: ${natAgentType}** | **Location: ${natLocation}**\n\n${fullContent}\n\n**Execution Logs:**\n${agentLogs.map(log => `[${log.level}] ${log.message}`).join('\n')}`,
                                        isStreaming: false 
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
                                content: `**Agent: ${natAgentType}** | **Location: ${natLocation}**\n\nAgent processing completed.\n\n**Execution Logs:**\n${agentLogs.map(log => `[${log.level}] ${log.message}`).join('\n')}`,
                                isStreaming: false 
                            }
                            : msg
                    ))
                }
            }

        } catch (error) {
            console.error('Error sending message to AI:', error)

            const errorMessage: Message = {
                id: Date.now() + 1,
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
            setIsLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    const normalQuickQuestions = [
        "Is it safe to travel during moderate flood conditions?",
        "How should I prepare for potential flooding?",
        "What does a risk score of 6.5 mean?",
        "Explain the difference between flood stages"
    ]

    const natQuickQuestions = [
        "What is flood risk Miami FL",
        "Analyze current flood conditions in Texas",
        "Generate 24-hour flood forecast for Dallas",
        "Emergency response status check"
    ]

    const quickQuestions = chatMode === 'normal' ? normalQuickQuestions : natQuickQuestions

    const handleQuickQuestion = (question: string) => {
        setInputMessage(question)
        inputRef.current?.focus()
    }

    const clearChat = () => {
        setMessages([messages[0]]) // Keep only the initial welcome message
        setHasUserSentMessage(false)
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
                                    <BreadcrumbPage>AI Assistant</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </header>

                <div className="flex flex-1 flex-col min-h-screen">
                    {/* Minimal Header with Controls */}
                    <div className="flex justify-between items-center p-6 border-b border-border/5">
                        <div>
                            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
                                <Bot className="h-5 w-5 text-primary" />
                                AI Flood Assistant
                            </h1>
                        </div>

                        <div className="flex items-center space-x-3">
                            {/* Chat Mode Selector */}
                            <div className="flex items-center bg-muted rounded-lg p-1">
                                <button
                                    onClick={() => setChatMode('normal')}
                                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                                        chatMode === 'normal' 
                                            ? 'bg-primary text-primary-foreground shadow-sm' 
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Normal Chat
                                </button>
                                <button
                                    onClick={() => setChatMode('nat')}
                                    disabled={!availableNATAgents.nat_available}
                                    className={`px-3 py-1 text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                        chatMode === 'nat' 
                                            ? 'bg-primary text-primary-foreground shadow-sm' 
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    NAT Agents {!availableNATAgents.nat_available && '(Unavailable)'}
                                </button>
                            </div>

                            {/* Normal Chat Controls */}
                            {chatMode === 'normal' && (
                                <>
                                    {/* Provider Selection */}
                                    <select
                                        value={selectedProvider}
                                        onChange={(e) => setSelectedProvider(e.target.value)}
                                        disabled={loadingProviders}
                                        className="text-sm border border-border/20 rounded-lg px-3 py-1.5 bg-card text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                                        title="AI Provider"
                                    >
                                        <option value="auto">Auto</option>
                                        {Object.entries(availableProviders.providers || {}).map(([name, info]: [string, any]) => (
                                            <option key={name} value={name} disabled={!info.available}>
                                                {name === 'h2ogpte' ? 'H2OGPTE' : name === 'nvidia' ? 'NVIDIA' : name}
                                                {!info.available && ' (Unavailable)'}
                                            </option>
                                        ))}
                                    </select>
                                </>
                            )}

                            {/* NAT Agent Controls */}
                            {chatMode === 'nat' && availableNATAgents.nat_available && (
                                <>
                                    {/* Agent Type Selection */}
                                    <select
                                        value={natAgentType}
                                        onChange={(e) => setNatAgentType(e.target.value)}
                                        disabled={loadingNATAgents}
                                        className="text-sm border border-border/20 rounded-lg px-3 py-1.5 bg-card text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                                        title="NAT Agent Type"
                                    >
                                        {Object.entries(availableNATAgents.available_agents || {}).map(([key, _name]: [string, any]) => (
                                            <option key={key} value={key}>
                                                {key.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                            </option>
                                        ))}
                                        <option value="all">All Agents (Comprehensive)</option>
                                    </select>

                                    {/* Location for Risk Analyzer and Predictor */}
                                    {(natAgentType === 'risk_analyzer' || natAgentType === 'predictor') && (
                                        <input
                                            type="text"
                                            value={natLocation}
                                            onChange={(e) => setNatLocation(e.target.value)}
                                            placeholder="Location (e.g., Miami, FL)"
                                            className="text-sm border border-border/20 rounded-lg px-3 py-1.5 bg-card text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring max-w-32"
                                            title="Location"
                                        />
                                    )}

                                    {/* Forecast Hours for Predictor */}
                                    {natAgentType === 'predictor' && (
                                        <input
                                            type="number"
                                            value={natForecastHours}
                                            onChange={(e) => setNatForecastHours(parseInt(e.target.value) || 24)}
                                            min="1"
                                            max="168"
                                            className="text-sm border border-border/20 rounded-lg px-3 py-1.5 bg-card text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring w-20"
                                            title="Forecast Hours"
                                        />
                                    )}

                                    {/* Scenario for Emergency Responder */}
                                    {natAgentType === 'emergency_responder' && (
                                        <select
                                            value={natScenario}
                                            onChange={(e) => setNatScenario(e.target.value)}
                                            className="text-sm border border-border/20 rounded-lg px-3 py-1.5 bg-card text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                            title="Emergency Scenario"
                                        >
                                            <option value="routine_check">Routine Check</option>
                                            <option value="flash_flood_alert">Flash Flood Alert</option>
                                        </select>
                                    )}
                                </>
                            )}

                            {/* Model Selection (when specific provider is selected) */}
                            {selectedProvider !== 'auto' && availableModels.length > 0 && (
                                <select
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    className="text-sm border border-border/20 rounded-lg px-3 py-1.5 bg-card text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring max-w-48"
                                    title="AI Model"
                                >
                                    {availableModels.map((model) => (
                                        <option key={model} value={model}>
                                            {model.split('/').pop() || model}
                                        </option>
                                    ))}
                                </select>
                            )}

                            {/* Watershed Selection */}
                            <select
                                value={selectedWatershed}
                                onChange={(e) => setSelectedWatershed(e.target.value)}
                                disabled={loadingWatersheds}
                                className="text-sm border border-border/20 rounded-lg px-3 py-1.5 bg-card text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                            >
                                <option value="">All Watersheds</option>
                                {watersheds.map((watershed) => (
                                    <option key={watershed.id} value={watershed.name}>
                                        {watershed.name}
                                    </option>
                                ))}
                            </select>

                            {/* Settings Button */}
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="inline-flex items-center px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition-colors text-sm"
                            >
                                <Settings className="h-4 w-4 mr-1.5" />
                                Settings
                            </button>

                            {/* Clear Button */}
                            <button
                                onClick={clearChat}
                                className="inline-flex items-center px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition-colors text-sm"
                            >
                                <RefreshCw className="h-4 w-4 mr-1.5" />
                                Clear
                            </button>
                        </div>
                    </div>

                    {/* Advanced Settings Panel */}
                    {showSettings && (
                        <div className="border-b border-border/5 bg-muted/30 px-6 py-4">
                            <div className="max-w-4xl mx-auto">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                        <Brain className="h-4 w-4 text-primary" />
                                        AI Configuration
                                    </h3>
                                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                                        {selectedProvider !== 'auto' && availableProviders.providers?.[selectedProvider] && (
                                            <div className="flex items-center space-x-2">
                                                <div className={`w-2 h-2 rounded-full ${availableProviders.providers[selectedProvider].available ? 'bg-green-500' : 'bg-red-500'}`} />
                                                <span>{selectedProvider === 'nvidia' ? 'NVIDIA NIM' : selectedProvider === 'h2ogpte' ? 'H2OGPTE' : selectedProvider}</span>
                                                {availableProviders.providers[selectedProvider].info?.supports_agents && (
                                                    <div title="Supports Agents">
                                                        <Zap className="h-3 w-3 text-primary" />
                                                    </div>
                                                )}
                                                {availableProviders.providers[selectedProvider].info?.supports_embeddings && (
                                                    <div title="Supports Embeddings">
                                                        <Database className="h-3 w-3 text-blue-500" />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <label className="block text-xs font-medium text-muted-foreground mb-1">Temperature</label>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="range"
                                                min="0"
                                                max="2"
                                                step="0.1"
                                                value={temperature}
                                                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                                className="flex-1"
                                            />
                                            <span className="text-xs w-8 text-center">{temperature.toFixed(1)}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">Controls randomness (0.0-2.0)</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-muted-foreground mb-1">Max Tokens</label>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="range"
                                                min="512"
                                                max="8192"
                                                step="256"
                                                value={maxTokens}
                                                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                                                className="flex-1"
                                            />
                                            <span className="text-xs w-12 text-center">{maxTokens}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">Maximum response length</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-muted-foreground mb-1">Provider Features</label>
                                        <div className="space-y-1">
                                            {availableProviders.nvidia_features && (
                                                <div className="text-xs text-muted-foreground">
                                                    <div className="flex items-center space-x-2">
                                                        <span className={`w-2 h-2 rounded-full ${availableProviders.nvidia_features.agents_enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                                                        <span>NVIDIA Agents: {availableProviders.nvidia_features.agents_enabled ? 'Enabled' : 'Disabled'}</span>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <span className={`w-2 h-2 rounded-full ${availableProviders.nvidia_features.rag_enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                                                        <span>NVIDIA RAG: {availableProviders.nvidia_features.rag_enabled ? 'Enabled' : 'Disabled'}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col relative">
                        {/* Messages and Quick Questions Container */}
                        <div className="flex-1 overflow-hidden px-6 py-6">
                            <div className="w-full max-w-4xl mx-auto flex flex-col h-full">

                                {/* Chat Messages */}
                                <div className="flex-1 space-y-6 overflow-y-auto pb-6">
                                    {messages.map((message) => (
                                        <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] rounded-2xl px-6 py-4 ${message.role === 'assistant'
                                                ? message.isError
                                                    ? 'bg-destructive/10 text-destructive border border-destructive/20'
                                                    : 'bg-muted text-muted-foreground'
                                                : 'bg-primary text-primary-foreground'
                                                }`}>
                                                <div className="text-sm leading-relaxed">
                                                    {message.role === 'assistant' ? (
                                                        message.isStreaming && !message.content ? (
                                                            // Show loading indicator when starting to stream
                                                            <div className="flex items-center space-x-2">
                                                                <Loader className="h-4 w-4 animate-spin text-primary" />
                                                                <span className="text-muted-foreground">AI is thinking...</span>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <ReactMarkdown
                                                                    remarkPlugins={[remarkGfm]}
                                                                    rehypePlugins={[rehypeSanitize]}
                                                                    components={{
                                                                        h1: ({ ...props }) => <h1 className="text-lg font-bold mb-3 text-current" {...props} />,
                                                                        h2: ({ ...props }) => <h2 className="text-base font-semibold mb-2 text-current flex items-center gap-2" {...props} />,
                                                                        h3: ({ ...props }) => <h3 className="text-sm font-semibold mb-2 text-current" {...props} />,
                                                                        p: ({ ...props }) => <p className="mb-2 text-current" {...props} />,
                                                                        ul: ({ ...props }) => <ul className="list-disc ml-4 mb-3 space-y-1" {...props} />,
                                                                        ol: ({ ...props }) => <ol className="list-decimal ml-4 mb-3 space-y-1" {...props} />,
                                                                        li: ({ ...props }) => <li className="text-current" {...props} />,
                                                                        blockquote: ({ ...props }) => (
                                                                            <blockquote className="border-l-4 border-orange-400 bg-orange-50/10 p-3 rounded-r mb-3 text-current" {...props} />
                                                                        ),
                                                                        code: ({ className, children, ...props }) => (
                                                                            <code
                                                                                className="bg-muted/80 text-current px-1.5 py-0.5 rounded text-xs font-mono"
                                                                                {...props}
                                                                            >
                                                                                {children}
                                                                            </code>
                                                                        ),
                                                                        pre: ({ ...props }) => (
                                                                            <pre className="bg-muted/80 p-3 rounded text-xs font-mono overflow-x-auto mb-3 text-current" {...props} />
                                                                        ),
                                                                        strong: ({ ...props }) => <strong className="font-bold text-current" {...props} />,
                                                                        em: ({ ...props }) => <em className="italic text-current" {...props} />,
                                                                        hr: ({ ...props }) => <hr className="border-border/20 my-4" {...props} />,
                                                                        a: ({ ...props }) => <a className="text-blue-400 hover:text-blue-300 underline" {...props} />
                                                                    }}
                                                                >
                                                                    {message.content}
                                                                </ReactMarkdown>
                                                            </div>
                                                        )
                                                    ) : (
                                                        <div className="whitespace-pre-wrap">
                                                            {message.content}
                                                        </div>
                                                    )}
                                                </div>

                                                {message.recommendations && message.recommendations.length > 0 && (
                                                    <div className="mt-4 pt-3 border-t border-border/10">
                                                        <p className="text-xs font-medium mb-2 flex items-center gap-1 opacity-80">
                                                            <Sparkles className="h-3 w-3" />
                                                            Recommendations:
                                                        </p>
                                                        <ul className="text-xs space-y-1 opacity-90">
                                                            {message.recommendations.slice(0, 3).map((rec, index) => (
                                                                <li key={index} className="flex items-start">
                                                                    <span className="mr-2">•</span>
                                                                    <span>{rec}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {message.evaluation && message.role === 'assistant' && (
                                                    <div className="mt-4 pt-3 border-t border-border/10">
                                                        <p className="text-xs font-medium mb-2 flex items-center gap-1 opacity-80">
                                                            <BarChart3 className="h-3 w-3" />
                                                            AI Quality Evaluation:
                                                        </p>
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            <div className="flex items-center gap-1">
                                                                <Star className="h-3 w-3 text-yellow-500" />
                                                                <span>Overall: {message.evaluation.overall_score.toFixed(1)}/10</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Shield className="h-3 w-3 text-green-500" />
                                                                <span>Safety: {message.evaluation.safety_score.toFixed(1)}/10</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <TrendingUp className="h-3 w-3 text-blue-500" />
                                                                <span>Helpful: {message.evaluation.helpfulness.toFixed(1)}/10</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                                                                <span>Accurate: {message.evaluation.accuracy.toFixed(1)}/10</span>
                                                            </div>
                                                        </div>
                                                        {message.evaluation.reasoning && (
                                                            <div className="mt-2 p-2 bg-muted/30 rounded text-xs opacity-75">
                                                                <strong>Judge Reasoning:</strong> {message.evaluation.reasoning.substring(0, 150)}...
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between mt-3 text-xs opacity-60">
                                                    <span>
                                                        {message.timestamp.toLocaleTimeString()}
                                                    </span>
                                                    {message.confidence && (
                                                        <span className="flex items-center gap-1">
                                                            <TrendingUp className="h-3 w-3" />
                                                            {(message.confidence * 100).toFixed(0)}%
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Context Information - Above quick questions */}
                                {selectedWatershed && watersheds.length > 0 && (() => {
                                    const watershed = watersheds.find(w => w.name === selectedWatershed)
                                    if (!watershed) return null

                                    return (
                                        <div className="text-center pb-6">
                                            <div className="inline-flex items-center px-4 py-2 bg-muted/50 rounded-full text-sm text-muted-foreground">
                                                <span className="font-medium text-foreground">{selectedWatershed}</span>
                                                <span className="mx-2">•</span>
                                                <span>Risk: {watershed.current_risk_level}</span>
                                                <span className="mx-2">•</span>
                                                <span>Score: {watershed.risk_score}/10</span>
                                            </div>
                                        </div>
                                    )
                                })()}

                                {/* Quick Questions Pills - Only show if user hasn't sent a message */}
                                {!hasUserSentMessage && (
                                    <div className="flex flex-wrap gap-2 justify-center pb-6">
                                        {quickQuestions.map((question, index) => (
                                            <button
                                                key={index}
                                                onClick={() => handleQuickQuestion(question)}
                                                disabled={isLoading}
                                                className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-full text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-border/10"
                                            >
                                                {question}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Fixed Input Area at Bottom */}
                        <div className="sticky bottom-0 bg-background/80 backdrop-blur-sm border-t border-border/10 p-6">
                            <div className="w-full max-w-4xl mx-auto">
                                <div className="flex items-end space-x-3 bg-card border border-border rounded-2xl p-4 shadow-lg">
                                    <div className="flex-1">
                                        <textarea
                                            ref={inputRef}
                                            value={inputMessage}
                                            onChange={(e) => setInputMessage(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder={chatMode === 'normal' 
                                                ? "Ask about flood conditions, safety, or data interpretation..." 
                                                : `Ask ${natAgentType.replace('_', ' ')} agent about flood analysis...`}
                                            className="w-full bg-transparent text-card-foreground placeholder-muted-foreground focus:outline-none resize-none text-sm"
                                            rows={2}
                                            disabled={isLoading}
                                        />
                                    </div>
                                    {/* Agent toggle only for normal chat mode */}
                                    {chatMode === 'normal' && (
                                        <button
                                            onClick={() => setUseAgents(!useAgents)}
                                            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${useAgents
                                                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm hover:bg-primary/15 dark:bg-primary/20 dark:text-primary dark:border-primary/30'
                                                    : 'bg-muted hover:bg-muted/80 text-muted-foreground border border-border hover:border-border/60 dark:bg-card dark:hover:bg-card/80 dark:border-sidebar-border'
                                                }`}
                                            title={useAgents ? "AI Agents enabled" : "Enable AI Agents"}
                                        >
                                            <Bot className="h-4 w-4" />
                                            <span>Agent</span>
                                        </button>
                                    )}
                                    
                                    {/* NAT Agent status indicator */}
                                    {chatMode === 'nat' && (
                                        <div className="flex items-center space-x-2 px-3 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg text-sm">
                                            <Bot className="h-4 w-4" />
                                            <span>NAT Agent</span>
                                        </div>
                                    )}
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!inputMessage.trim() || isLoading}
                                        className="flex-shrink-0 p-2 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-lg transition-colors disabled:cursor-not-allowed"
                                    >
                                        <Send className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}