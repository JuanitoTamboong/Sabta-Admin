// src/pages/AdminLayout.tsx
import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import {
  SquaresFourIcon, BookOpenIcon, UsersIcon, ChartLineUpIcon,
  GiftIcon, SignOutIcon, BellIcon, ShieldCheckIcon,
  CheckCircleIcon, XIcon
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

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0) // ✅ New state for count
  const notifRef = useRef<HTMLDivElement>(null)

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

  // Fetch notifications across the whole layout
  useEffect(() => {
    const fetchNotifications = async () => {
      const today = new Date().toISOString().split('T')[0]
      
      const { data: usersData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(5)
      
      // ✅ Added correct_answers, incorrect_answers, unanswered_questions to the select
      const { data: attempts } = await supabase.from('quiz_attempts')
        .select('*, profiles(display_name), correct_answers, incorrect_answers, unanswered_questions')
        .order('created_at', { ascending: false })
        .limit(5)

      const newNotifs: any[] = []
      let newTodayCount = 0 // ✅ Counter for today's events
      
      usersData?.forEach(u => {
        const isToday = u.created_at.startsWith(today)
        if (isToday) newTodayCount++

        newNotifs.push({
          id: `signup-${u.id}`,
          title: 'New Player Joined',
          message: `${u.display_name || 'A new user'} has created an account.`,
          date: new Date(u.created_at),
          icon: UsersIcon,
          color: '#00f0ff',
          link: '/admin/users'
        })
      })

      attempts?.forEach((a: any) => {
        const isToday = a.created_at.startsWith(today)
        if (isToday) newTodayCount++

        // ✅ Calculate accuracy manually since it's not a column in the DB
        const totalQuestions = (a.correct_answers || 0) + (a.incorrect_answers || 0) + (a.unanswered_questions || 0);
        const calculatedAccuracy = totalQuestions > 0 
          ? Math.round(((a.correct_answers || 0) / totalQuestions) * 100) 
          : 0;

        newNotifs.push({
          id: `attempt-${a.id}`,
          title: 'Quiz Completed',
          message: `${a.profiles?.display_name || 'A player'} scored ${calculatedAccuracy}% on a quiz.`, // ✅ Used calculated value
          date: new Date(a.created_at),
          icon: CheckCircleIcon,
          color: '#ccff00',
          link: '/admin/users'
        })
      })

      newNotifs.sort((a, b) => b.date.getTime() - a.date.getTime())
      setNotifications(newNotifs)
      setUnreadCount(newTodayCount) // ✅ Set the count
    }

    if (!loading) fetchNotifications()
  }, [loading])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // ✅ Handle opening the bell and clearing the count
  const toggleNotifications = () => {
    setShowNotifications(!showNotifications)
    if (!showNotifications) {
      setUnreadCount(0) // Clear count when opened
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  const currentTitle = NAV_ITEMS.find(item => location.pathname.startsWith(item.path))?.label || 'Dashboard'

  if (loading) return <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center font-mono">VERIFYING CLEARANCE...</div>

  return (
    <div className="min-h-screen bg-[#050505] text-white flex font-sans h-screen overflow-hidden">
      
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
      <main className="flex-1 lg:ml-64 flex flex-col h-screen overflow-hidden">
        <header className="sticky top-0 z-20 bg-[#050505]/90 backdrop-blur-md border-b border-white/10 px-4 lg:px-8 py-4 shrink-0">
          <div className="flex items-center justify-between gap-4">
            
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg lg:text-2xl font-bold leading-tight text-white">{currentTitle}</h1>
                <p className="text-[10px] lg:text-xs text-gray-500 hidden sm:block">System Administrator • {profile?.display_name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={handleLogout} className="lg:hidden p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 hover:bg-red-500/20 transition">
                <SignOutIcon weight="bold" className="w-5 h-5" />
              </button>

              {/* ✅ FIXED: Notification Bell with Numbered Badge */}
              <div className="relative" ref={notifRef}>
                <button 
                  onClick={toggleNotifications} 
                  className={`relative p-2 border rounded-xl transition group ${showNotifications ? 'bg-[#0f1014] border-[#ccff00]/50' : 'bg-[#0f1014] border-white/10 hover:bg-white/5'}`}
                >
                  <BellIcon weight="duotone" className={`w-5 h-5 ${showNotifications ? 'text-[#ccff00]' : 'text-gray-300'}`} />
                  
                  {/* Numbered Badge */}
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-[#ff00a0] text-white text-[9px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border-2 border-[#050505] shadow-lg">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              </div>
              
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ff00a0] to-purple-600 border-2 border-white/20 flex items-center justify-center font-bold text-black text-sm">
                A
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT PADDING */}
        <div className="flex-1 overflow-y-auto admin-custom-scrollbar relative w-full">
          <div className="p-4 lg:p-8 relative w-full max-w-full min-h-full">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#00f0ff]/5 rounded-full blur-[120px] pointer-events-none" />
            
            <div className="relative z-10 admin-page-enter pb-24 lg:pb-8">
              <Outlet />
            </div>
          </div>
        </div>
      </main>

      {/* ✅ NOTIFICATION DROPDOWN PORTAL */}
      {showNotifications && createPortal(
        <>
          <div className="fixed inset-0 z-[100] bg-black/20 sm:hidden" onClick={() => setShowNotifications(false)} />
          
          <div className="fixed top-16 right-4 sm:top-20 sm:right-8 w-72 sm:w-80 bg-[#0f1014] border border-white/10 rounded-2xl shadow-2xl z-[110] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-3 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Notifications</h3>
              <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-white">
                <XIcon weight="bold" size={16} />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto admin-custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <BellIcon weight="duotone" className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">You're all caught up!</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div 
                    key={n.id} 
                    onClick={() => { navigate(n.link); setShowNotifications(false); }}
                    className="p-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition flex gap-3"
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${n.color}15`, color: n.color }}>
                      <n.icon weight="fill" size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white leading-tight">{n.title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{n.message}</p>
                      <p className="text-[9px] text-gray-600 mt-1 font-mono">
                        {n.date.toLocaleDateString()} at {n.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-2 border-t border-white/10 bg-white/5 text-center">
              <button onClick={() => { navigate('/admin/users'); setShowNotifications(false); }} className="text-[10px] font-bold text-[#ccff00] hover:underline">
                View All Activity
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

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
