import { useConfig } from '@/contexts/ConfigContext'

export function Footer() {
  const { config } = useConfig()
  
  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-muted-foreground">
            © 2025 {config.name}. Built with React + FastAPI.
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>v{config.version}</span>
            <span>•</span>
            <span className="capitalize">{config.environment}</span>
            {config.environment === 'development' && (
              <>
                <span>•</span>
                <span className="text-yellow-600 dark:text-yellow-400">Dev Mode</span>
              </>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}