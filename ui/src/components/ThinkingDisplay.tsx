import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Brain, MapPin, Zap, Search, CheckCircle, AlertCircle } from 'lucide-react'

interface ThinkingDisplayProps {
  agentType: string
  location: string
  content: string
  logs: Array<{ level: string; message: string }>
  isStreaming: boolean
}

interface ThinkingStep {
  type: 'thought' | 'action' | 'search' | 'result' | 'final'
  title: string
  content: string
  expanded?: boolean
}

const parseAgentThinking = (content: string, logs: Array<{ level: string; message: string }>): ThinkingStep[] => {
  const steps: ThinkingStep[] = []
  
  // Parse agent logs into structured thinking steps
  logs.forEach((log, _index) => {
    const msg = log.message
    
    if (msg.includes('Agent input:') || msg.includes('Processing request:')) {
      steps.push({
        type: 'thought',
        title: 'Understanding the request',
        content: msg.replace(/^.*Agent input:?\s*/, '').replace(/^.*Processing request:?\s*/, ''),
        expanded: true
      })
    } else if (msg.includes('Action:') || msg.includes('Using tool:')) {
      steps.push({
        type: 'action',
        title: 'Taking action',
        content: msg.replace(/^.*Action:?\s*/, '').replace(/^.*Using tool:?\s*/, ''),
        expanded: false
      })
    } else if (msg.includes('Searching') || msg.includes('Querying') || msg.includes('API call')) {
      steps.push({
        type: 'search',
        title: 'Gathering information',
        content: msg,
        expanded: false
      })
    } else if (msg.includes('Tool\'s response:') || msg.includes('Result:') || msg.includes('Data retrieved:')) {
      steps.push({
        type: 'result',
        title: 'Processing results',
        content: msg.replace(/^.*Tool's response:?\s*/, '').replace(/^.*Result:?\s*/, '').replace(/^.*Data retrieved:?\s*/, ''),
        expanded: false
      })
    } else if (msg.includes('Final Answer:') || msg.includes('Workflow completed') || msg.includes('Summary:')) {
      steps.push({
        type: 'final',
        title: 'Final analysis',
        content: msg.replace(/^.*Final Answer:?\s*/, '').replace(/^.*Summary:?\s*/, ''),
        expanded: true
      })
    }
  })
  
  // If we have the final content, add it as the main result
  if (content && content !== 'Agent processing completed.') {
    steps.push({
      type: 'final',
      title: 'Complete analysis',
      content: content,
      expanded: true
    })
  }
  
  return steps
}

const getStepIcon = (type: string) => {
  switch (type) {
    case 'thought':
      return <Brain className="w-4 h-4 text-blue-400" />
    case 'action':
      return <Zap className="w-4 h-4 text-orange-400" />
    case 'search':
      return <Search className="w-4 h-4 text-purple-400" />
    case 'result':
      return <CheckCircle className="w-4 h-4 text-green-400" />
    case 'final':
      return <AlertCircle className="w-4 h-4 text-blue-400" />
    default:
      return <Brain className="w-4 h-4 text-gray-400" />
  }
}

const ThinkingDisplay: React.FC<ThinkingDisplayProps> = ({
  agentType,
  location,
  content,
  logs,
  isStreaming
}) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0]))
  const steps = parseAgentThinking(content, logs)
  
  const toggleStep = (index: number) => {
    const newExpanded = new Set(expandedSteps)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedSteps(newExpanded)
  }

  return (
    <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-600">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-gray-100">
            NAT Agent: {agentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
          {isStreaming && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-blue-400">Processing...</span>
            </div>
          )}
        </div>
        {location && (
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <MapPin className="w-4 h-4" />
            <span>{location}</span>
          </div>
        )}
      </div>

      {/* Thinking Steps */}
      <div className="space-y-3">
        {steps.length === 0 && isStreaming && (
          <div className="flex items-center gap-3 p-3 bg-blue-900/30 rounded-lg border border-blue-700/50">
            <Brain className="w-4 h-4 text-blue-400 animate-pulse" />
            <span className="text-blue-300">Agent is analyzing your request...</span>
          </div>
        )}
        
        {steps.map((step, index) => {
          const isExpanded = expandedSteps.has(index) || step.expanded
          
          return (
            <div key={index} className="border border-gray-600 rounded-lg bg-gray-800/50">
              {/* Step Header */}
              <button
                onClick={() => toggleStep(index)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {getStepIcon(step.type)}
                  <span className="font-medium text-gray-200">{step.title}</span>
                </div>
                <div className="ml-auto">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </button>
              
              {/* Step Content */}
              {isExpanded && (
                <div className="px-3 pb-3">
                  <div className="ml-6 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {step.content}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      {/* Status Footer */}
      {!isStreaming && steps.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-600">
          <div className="flex items-center gap-2 text-sm text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span>Analysis complete</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default ThinkingDisplay