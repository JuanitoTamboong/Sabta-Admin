import { useEffect, useState } from 'react'
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom'
// FIXED: Changed from '../../lib/supabase' to '../lib/supabase'
import { supabase } from '../lib/supabase' 
// FIXED: Removed UsersIcon and GiftIcon to clear the TypeScript warning
import { ChartBarIcon, FileTextIcon, SignOutIcon, ShieldCheckIcon } from '@phosphor-icons/react'

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/')

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      
      // Security Check: Ensure they are an admin
      if (data?.role !== 'admin') {
        return navigate('/') // Kick out normal players back to login
      }

      setProfile(data)
      setLoading(false)
    }
    checkAdmin()
  }, [navigate])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center font-mono">
        VERIFYING CLEARANCE...
      </div>
    )
  }

  const navItems = [
    { path: '/admin', label: 'Analytics', icon: ChartBarIcon },
    { path: '/admin/quizzes', label: 'Quiz Manager', icon: FileTextIcon },
  ]

  return (
    <div className="min-h-screen bg-[#050505] text-white flex">
      
      {/* SIDEBAR */}
      <aside className="w-64 border-r border-red-500/20 bg-[#0a0505] flex flex-col items-start py-8 px-4 gap-4 fixed h-full z-20">
        <div className="flex items-center gap-3 mb-8 px-4">
          <div className="w-10 h-10 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center justify-center">
             <ShieldCheckIcon weight="fill" className="text-red-500 w-6 h-6" />
          </div>
          <div>
            <span className="block text-xl font-bold tracking-tighter text-white">SABTA</span>
            <span className="block text-[10px] text-red-400 font-mono tracking-widest">ADMIN PORTAL</span>
          </div>
        </div>

        <nav className="flex flex-col w-full gap-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                className={`flex items-center gap-4 w-full p-3 rounded-xl transition ${
                  isActive 
                    ? 'bg-red-500/20 text-red-400 font-bold border border-red-500/20' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-white font-semibold'
                }`}
              >
                <item.icon weight={isActive ? "fill" : "regular"} className="w-6 h-6" /> 
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto w-full">
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-4 w-full p-3 rounded-xl text-red-400 hover:bg-red-500/10 font-semibold transition"
          >
            <SignOutIcon weight="fill" className="w-6 h-6" /> Exit Admin
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 ml-64 p-8 relative overflow-hidden bg-[#050505]">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[120px] pointer-events-none" />
        
        <header className="flex justify-between items-center mb-10 relative z-10 pb-4 border-b border-white/10">
          <div>
            <h1 className="text-2xl font-bold">System Administrator</h1>
            <p className="text-gray-400 text-sm">Logged in as {profile?.display_name}</p>
          </div>
        </header>

        <div className="relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}