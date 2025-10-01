interface FeatureCardProps {
  title: string
  description: string
  enabled: boolean
  icon?: React.ReactNode
}

export function FeatureCard({ title, description, enabled, icon }: FeatureCardProps) {
  return (
    <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-3">
        {icon && (
          <div className="flex-shrink-0 mt-1">
            {icon}
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-lg">{title}</h3>
            <div 
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
              }`} 
            />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${
          enabled 
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
        }`}>
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>
    </div>
  )
}