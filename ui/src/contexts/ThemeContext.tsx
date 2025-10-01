import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useThemeConfig } from './ConfigContext'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  actualTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const themeConfig = useThemeConfig()
  const [theme, setTheme] = useState<Theme>(themeConfig.defaultMode)
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light')

  // Get system theme preference
  const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  }

  // Calculate actual theme based on current theme setting
  const calculateActualTheme = (currentTheme: Theme): 'light' | 'dark' => {
    if (currentTheme === 'system') {
      return getSystemTheme()
    }
    return currentTheme
  }

  // Update theme and apply to document
  const updateTheme = (newTheme: Theme) => {
    const actual = calculateActualTheme(newTheme)
    setActualTheme(actual)
    
    // Apply theme to document
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(actual)
      document.documentElement.setAttribute('data-theme', actual)
    }
    
    // Store in localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('theme', newTheme)
    }
  }

  // Toggle between light and dark (skip system)
  const toggleTheme = () => {
    if (!themeConfig.enableThemeToggle) return
    
    const newTheme = actualTheme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    updateTheme(newTheme)
  }

  // Initialize theme on mount
  useEffect(() => {
    // Try to get saved theme from localStorage
    const savedTheme = typeof localStorage !== 'undefined' 
      ? localStorage.getItem('theme') as Theme 
      : null
    
    const initialTheme = savedTheme || themeConfig.defaultMode
    setTheme(initialTheme)
    updateTheme(initialTheme)
  }, [themeConfig.defaultMode])

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = () => {
      if (theme === 'system') {
        updateTheme('system')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  // Handle theme changes
  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme)
    updateTheme(newTheme)
  }

  const value: ThemeContextType = {
    theme,
    actualTheme,
    setTheme: handleSetTheme,
    toggleTheme,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}