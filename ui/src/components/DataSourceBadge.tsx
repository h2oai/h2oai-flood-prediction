import { Database, Shield, Globe } from 'lucide-react'

interface DataSourceBadgeProps {
  source?: string
  quality?: string
  siteCode?: string
  className?: string
}

export function DataSourceBadge({ source, quality, siteCode, className = "" }: DataSourceBadgeProps) {
  if (!source || source === 'sample') {
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 ${className}`}>
        <Shield className="h-3 w-3" />
        Sample Data
      </div>
    )
  }

  const getSourceConfig = (source: string) => {
    switch (source.toLowerCase()) {
      case 'usgs':
        return {
          icon: Database,
          label: 'USGS',
          bgColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
          title: 'US Geological Survey real-time data'
        }
      case 'noaa':
        return {
          icon: Globe,
          label: 'NOAA',
          bgColor: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
          title: 'National Oceanic and Atmospheric Administration data'
        }
      case 'openmeteo':
        return {
          icon: Globe,
          label: 'OpenMeteo',
          bgColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
          title: 'Open-Meteo weather and flood data'
        }
      default:
        return {
          icon: Database,
          label: source.toUpperCase(),
          bgColor: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
          title: 'External data source'
        }
    }
  }

  const getQualityConfig = (quality: string) => {
    const normalized = quality.toLowerCase()
    if (normalized === 'approved' || normalized === 'a') {
      return {
        label: 'Approved',
        bgColor: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
        title: 'Data has been reviewed and approved'
      }
    } else if (normalized === 'provisional' || normalized === 'p') {
      return {
        label: 'Provisional',
        bgColor: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
        title: 'Data is provisional and subject to revision'
      }
    } else if (normalized === 'estimated' || normalized === 'e') {
      return {
        label: 'Estimated',
        bgColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
        title: 'Data is estimated'
      }
    }
    return null
  }

  const sourceConfig = getSourceConfig(source)
  const qualityConfig = quality && quality !== 'unknown' ? getQualityConfig(quality) : null
  const SourceIcon = sourceConfig.icon

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Data source badge */}
      <div 
        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${sourceConfig.bgColor}`}
        title={sourceConfig.title}
      >
        <SourceIcon className="h-3 w-3" />
        {sourceConfig.label}
        {siteCode && (
          <span className="ml-1 text-xs opacity-75">
            {siteCode}
          </span>
        )}
      </div>

      {/* Data quality badge */}
      {qualityConfig && (
        <div 
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${qualityConfig.bgColor}`}
          title={qualityConfig.title}
        >
          {qualityConfig.label}
        </div>
      )}
    </div>
  )
}

export default DataSourceBadge