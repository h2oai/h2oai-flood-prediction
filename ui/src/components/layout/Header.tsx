import { Button } from '@/components/ui/button'
import { useConfig, useFeatureFlags } from '@/contexts/ConfigContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Sun, Moon, Settings } from 'lucide-react'

export function Header() {
  const { config } = useConfig()
  const { toggleTheme, actualTheme } = useTheme()
  const features = useFeatureFlags()

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">{config.name}</h1>
          <span className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground">
            {config.environment}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {features.darkMode && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {actualTheme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          )}
          
          <Button variant="ghost" size="sm" aria-label="Settings">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}