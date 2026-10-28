// src/pages/AdminLayout.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  SquaresFourIcon, BookOpenIcon, UsersIcon, ChartLineUpIcon,
  GiftIcon, SignOutIcon, BellIcon, ShieldCheckIcon
} from '@phosphor-icons/react'
import sabtaLogo from '../assets/icons/sabta-logo.png'
import '../css/AdminLayout.css'

const NAV_ITEMS = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: SquaresFourIcon },
  { path: '/admin/quizzes', label: 'Quizzes', icon: BookOpenIcon },
  { path: '/admin/users', label: 'Players', icon: UsersIcon },
  { path: '/admin/analytics', label: 'Analytics', icon: ChartLineUpIcon },
  { path: '/admin/cosmetics', label: 'Cosmetics', icon: GiftIcon },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/admin/login')

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      
      if (data?.role !== 'admin') {
        await supabase.auth.signOut()
        return navigate('/admin/login')
      }
      setProfile(data)
      setLoading(false)
    }
    checkAdmin()
  }, [navigate])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  const currentTitle = NAV_ITEMS.find(item => location.pathname.startsWith(item.path))?.label || 'Dashboard'

  if (loading) return <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center font-mono">VERIFYING CLEARANCE...</div>

  return (
    <div className="min-h-screen bg-[#050505] text-white flex font-sans">
      
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex w-64 border-r border-white/10 bg-[#0a0b0f] flex-col py-6 px-3 fixed h-full z-30">
        <div className="flex items-center gap-3 mb-8 px-3 cursor-pointer" onClick={() => navigate('/admin/dashboard')}>
          <div className="w-10 h-10 bg-[#ccff00]/10 border border-[#ccff00]/30 rounded-xl flex items-center justify-center overflow-hidden">
            <img src={sabtaLogo} alt="SabTa" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tighter block leading-none text-white">SAB<span className="text-[#ccff00]">TA</span></span>
            <span className="text-[9px] text-[#ff00a0] font-bold tracking-[0.2em] uppercase">Admin Panel</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname.startsWith(item.path)
            const Icon = item.icon
            return (
              <button key={item.path} onClick={() => navigate(item.path)} className={`flex items-center gap-3 w-full p-3 rounded-xl font-semibold text-sm transition ${isActive ? 'bg-[#ccff00]/10 text-[#ccff00] border border-[#ccff00]/20' : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'}`}>
                <Icon weight={isActive ? 'fill' : 'duotone'} className="w-5 h-5" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="mt-6 mx-1 p-3 bg-gradient-to-br from-[#00f0ff]/10 to-transparent border border-[#00f0ff]/20 rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheckIcon weight="fill" className="text-[#00f0ff] w-4 h-4" />
            <span className="text-[10px] font-bold text-[#00f0ff] uppercase tracking-wider">Admin Access</span>
          </div>
          <p className="text-[10px] text-gray-500">Full system control enabled</p>
        </div>

        <div className="mt-auto">
          <button onClick={handleLogout} className="flex items-center gap-3 w-full p-3 rounded-xl text-red-400 hover:bg-red-500/10 font-semibold text-sm transition">
            <SignOutIcon weight="fill" className="w-5 h-5" /> Logout
          </button>
        </div>
      </aside>

      {/* MAIN AREA */}
      <main className="flex-1 lg:ml-64 pb-24 lg:pb-0 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 bg-[#050505]/90 backdrop-blur-md border-b border-white/10 px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg lg:text-2xl font-bold leading-tight text-white">{currentTitle}</h1>
                <p className="text-[10px] lg:text-xs text-gray-500 hidden sm:block">System Administrator • {profile?.display_name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* ✅ MOBILE LOGOUT BUTTON ADDED HERE */}
              <button onClick={handleLogout} className="lg:hidden p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 hover:bg-red-500/20 transition">
                <SignOutIcon weight="bold" className="w-5 h-5" />
              </button>

              <button className="relative p-2 bg-[#0f1014] border border-white/10 rounded-xl hover:bg-white/5 transition">
                <BellIcon weight="duotone" className="w-5 h-5 text-gray-300" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#ff00a0] rounded-full animate-pulse" />
              </button>
              
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ff00a0] to-purple-600 border-2 border-white/20 flex items-center justify-center font-bold text-black text-sm">
                A
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT PADDING */}
        <div className="p-4 lg:p-8 relative flex-1 w-full max-w-full overflow-x-hidden">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#00f0ff]/5 rounded-full blur-[120px] pointer-events-none" />
          
          <div className="relative z-10 h-full admin-page-enter">
            <Outlet />
          </div>
        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0a0b0f]/95 backdrop-blur-md border-t border-white/10 flex justify-around items-center h-16 z-40 px-2 pb-safe">
        {NAV_ITEMS.slice(0, 5).map((item) => {
          const isActive = location.pathname.startsWith(item.path)
          const Icon = item.icon
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 w-full py-1 transition-all ${isActive ? 'text-[#ccff00] -translate-y-1' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <div className={`p-1.5 rounded-xl transition ${isActive ? 'bg-[#ccff00]/10' : 'bg-transparent'}`}>
                <Icon weight={isActive ? 'fill' : 'duotone'} size={20} />
              </div>
              <span className="text-[9px] font-bold tracking-wider">{item.label}</span>
            </button>
          )
        })}
      </nav>

    </div>
  )
}