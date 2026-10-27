// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

// Notice the paths are just './pages/...' now, NOT './pages/admin/...'
import AdminLayout from './pages/AdminLayout'
import AdminAnalytics from './pages/AdminAnalytics'
import AdminQuizzes from './pages/AdminQuizzes'

function AdminLogin() {
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505]">
      <div className="bg-[#0f1014] p-10 rounded-3xl border border-white/10 text-center max-w-sm w-full">
        <h1 className="text-2xl font-bold mb-2 text-white">SabTa Admin</h1>
        <p className="text-gray-400 mb-6 text-sm">Restricted access. Please sign in with your authorized Google account.</p>
        <button 
          onClick={handleLogin} 
          disabled={loading}
          className="w-full bg-white text-black py-3 rounded-xl font-bold hover:bg-gray-200 transition"
        >
          {loading ? 'Connecting...' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  )
}

function App() {
  const [session, setSession] = useState<any>(null)
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
      <div className="min-h-screen bg-[#050505] text-red-500 flex items-center justify-center font-mono">
        LOADING...
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* If not logged in, show Admin Login */}
        <Route path="/" element={!session ? <AdminLogin /> : <Navigate to="/admin" />} />

        {/* Protected Admin Routes */}
        <Route path="/admin" element={session ? <AdminLayout /> : <Navigate to="/" />}>
          <Route index element={<AdminAnalytics />} />
          <Route path="quizzes" element={<AdminQuizzes />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App