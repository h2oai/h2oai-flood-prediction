import { useFeatureFlags } from '@/contexts/ConfigContext'
import { FeatureCard } from './FeatureCard'
import { 
  Shield, 
  Upload, 
  Palette, 
  Zap, 
  Bell, 
  BarChart3,
  Lock,
  Cog
} from 'lucide-react'

export function FeatureGrid() {
  const features = useFeatureFlags()
  
  const featureList = [
    {
      title: 'Authentication',
      description: 'OIDC/OAuth2 integration with automatic token refresh',
      enabled: features.authentication,
      icon: <Shield className="h-5 w-5 text-blue-600" />
    },
    {
      title: 'File Upload',
      description: 'Secure file upload with validation and chunked transfer',
      enabled: features.fileUpload,
      icon: <Upload className="h-5 w-5 text-green-600" />
    },
    {
      title: 'Dark Mode',
      description: 'System theme support with manual toggle',
      enabled: features.darkMode,
      icon: <Palette className="h-5 w-5 text-purple-600" />
    },
    {
      title: 'Background Jobs',
      description: 'Async task processing with Redis queue',
      enabled: features.authentication, // Using auth as proxy for backend features
      icon: <Zap className="h-5 w-5 text-orange-600" />
    },
    {
      title: 'Notifications',
      description: 'Real-time updates and user notifications',
      enabled: features.notifications,
      icon: <Bell className="h-5 w-5 text-yellow-600" />
    },
    {
      title: 'Analytics',
      description: 'Usage tracking and performance metrics',
      enabled: features.analytics,
      icon: <BarChart3 className="h-5 w-5 text-indigo-600" />
    },
    {
      title: 'Security',
      description: 'CORS, rate limiting, and input validation',
      enabled: true, // Always enabled
      icon: <Lock className="h-5 w-5 text-red-600" />
    },
    {
      title: 'Configuration',
      description: 'Environment-based settings and feature flags',
      enabled: true, // Always enabled
      icon: <Cog className="h-5 w-5 text-gray-600" />
    }
  ]
  
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {featureList.map((feature) => (
        <FeatureCard key={feature.title} {...feature} />
      ))}
    </div>
  )
}