// src/AdminApp.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDasboard'
import AdminQuizzes from './pages/AdminQuizzes'
import AdminAnalytics from './pages/AdminAnalytics'
import AdminLayout from './pages/AdminLayout'

import AdminPlayers from './pages/AdminPlayers'
import AdminCosmetics from './pages/AdminCosmetics'
import AdminBadges from './pages/AdminBadges' // 🔧 Added Import

export default function AdminApp() {
  const [session, setSession] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }: any) => {
      setSession(session)
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
        setIsAdmin(profile?.role === 'admin')
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session: any) => { 
      setSession(session)
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
        setIsAdmin(profile?.role === 'admin')
      } else {
        setIsAdmin(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center font-mono">ADMIN SYSTEM INITIALIZING...</div>
  }

  return (
    <Routes>
      {/* 1. Login Route */}
      <Route path="/admin/login" element={session && isAdmin ? <Navigate to="/admin/dashboard" replace /> : <AdminLogin />} />
      
      {/* 2. Protected Routes wrapped in AdminLayout */}
      <Route path="/admin" element={session && isAdmin ? <AdminLayout /> : <Navigate to="/admin/login" replace />}>
        
        {/* Default redirect when visiting /admin */}
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        
        {/* The actual pages */}
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="quizzes" element={<AdminQuizzes />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="users" element={<AdminPlayers />} />
        <Route path="cosmetics" element={<AdminCosmetics />} />
        <Route path="badges" element={<AdminBadges />} /> {/* 🔧 Added Route */}
      </Route>
      
      {/* 3. Fallback */}
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  )
}