import { ConfigProvider} from '@/contexts/ConfigContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { LoggingProvider } from '@/contexts/LoggingContext'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import UnifiedDashboard from '@/components/UnifiedDashboard'

function AppContent() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UnifiedDashboard />} />
        <Route path="/dashboard" element={<UnifiedDashboard />} />
        {/* All routes now point to the unified dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function App() {
  return (
    <ConfigProvider>
      <LoggingProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </LoggingProvider>
    </ConfigProvider>
  )
}

export default App