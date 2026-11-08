// src/App.tsx
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import AdminApp from './AdminApp'

// 1. Check if running in Electron
const isElectron = typeof window !== 'undefined' && (window as any).desktop?.isElectron;

// 2. Automatically pick the correct router
const Router = isElectron ? HashRouter : BrowserRouter;

function App() {
  const [, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center font-mono">
        INITIALIZING...
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/*" element={<AdminApp />} />
      </Routes>
    </Router>
  )
}

export default App