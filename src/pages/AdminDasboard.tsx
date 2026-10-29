// src/pages/AdminDashboard.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  UsersIcon, BookOpenIcon, LightningIcon,
  ArrowUpRightIcon, CaretRightIcon,
  CheckCircleIcon, PlusIcon, ChartBarIcon,
  CoinsIcon, ShieldCheckIcon, PulseIcon, ShoppingBagIcon,
  ArrowRightIcon
} from '@phosphor-icons/react'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ 
    totalUsers: 0, 
    activeToday: 0, 
    totalQuizzes: 0, 
    totalAttempts: 0, 
    avgAccuracy: 0, 
    pointsDistributed: 0, 
    coinsDistributed: 0,
    newUsersThisWeek: 0 
  })
  const [recentUsers, setRecentUsers] = useState<any[]>([])
  const [ageBreakdown, setAgeBreakdown] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all profiles
        const { data: rawUsersData } = await supabase.from('profiles').select('*')
        
        // ✅ FIX: Filter out admins so they don't count as players
        const usersData = (rawUsersData || []).filter(u => u.role !== 'admin')

        const totalUsers = usersData.length
        
        const sortedUsers = [...usersData].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setRecentUsers(sortedUsers.slice(0, 5))

        const weekAgo = new Date(Date.now() - 7 * 86400000)
        const newUsersThisWeek = usersData.filter(u => new Date(u.created_at) > weekAgo).length

        const breakdown = usersData.reduce((acc: any, p) => {
          const cat = p.age_category || 'unset'
          acc[cat] = (acc[cat] || 0) + 1
          return acc
        }, {})
        setAgeBreakdown(Object.entries(breakdown).map(([k, v]) => ({ category: k, count: v })))

        const coinsDistributed = usersData.reduce((acc, user) => acc + (user.coins || 0), 0)

        const { count: totalQuizzes } = await supabase.from('quizzes').select('id', { count: 'exact', head: true })

        const { data: attempts } = await supabase.from('quiz_attempts').select('score, accuracy, created_at')
        
        const totalAttempts = attempts?.length || 0
        let pointsDistributed = 0, activeTodayCount = 0
        let totalAccuracy = 0
        const today = new Date().toISOString().split('T')[0]

        attempts?.forEach(a => {
          pointsDistributed += (a.score || 0)
          totalAccuracy += (a.accuracy || 0)
          if (a.created_at.startsWith(today)) activeTodayCount++
        })

        const avgAccuracy = totalAttempts > 0 ? Math.round(totalAccuracy / totalAttempts) : 0

        setStats({ 
          totalUsers, 
          activeToday: activeTodayCount, 
          totalQuizzes: totalQuizzes || 0, 
          totalAttempts, 
          avgAccuracy, 
          pointsDistributed,
          coinsDistributed,
          newUsersThisWeek 
        })
      } catch (err) {
        console.error("Dashboard error:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-[#ccff00]">
        <p className="font-mono text-sm animate-pulse tracking-widest">LOADING METRICS...</p>
      </div>
    )
  }

  const statCards = [
    { label: 'Total Players', value: stats.totalUsers.toLocaleString(), delta: `+${stats.newUsersThisWeek}`, deltaLabel: 'this week', icon: UsersIcon, color: '#00f0ff', progress: 75 },
    { label: 'Active Today', value: stats.activeToday.toString(), delta: 'Live', deltaLabel: 'sessions', icon: LightningIcon, color: '#ccff00', progress: Math.min((stats.activeToday / (stats.totalUsers || 1)) * 100, 100) },
    { label: 'Total Quizzes', value: stats.totalQuizzes.toString(), delta: `${stats.totalAttempts}`, deltaLabel: 'total plays', icon: BookOpenIcon, color: '#ff00a0', progress: 45 },
    { label: 'Coins Economy', value: stats.coinsDistributed.toLocaleString(), delta: 'circulation', deltaLabel: 'total coins', icon: CoinsIcon, color: '#ff9500', progress: 60 },
  ]

  return (
    <div className="relative z-10 max-w-7xl mx-auto admin-page-enter pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 sm:mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <PulseIcon weight="bold" className="text-[#ccff00] w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">System Live</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Command Center</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">Overview of platform health, players, and economy.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={() => navigate('/admin/quizzes')} 
            className="flex-1 sm:flex-none bg-[#ccff00] text-black px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-white transition shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:scale-105 transform duration-200"
          >
            <PlusIcon weight="bold" className="w-4 h-4 sm:w-5 sm:h-5" /> Create New Quiz
          </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
        {statCards.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-[#0f1014] border border-white/5 p-2.5 sm:p-5 rounded-xl sm:rounded-3xl relative overflow-hidden group hover:border-white/20 transition-all duration-300">
              <div className="absolute top-0 right-0 w-16 h-16 sm:w-32 sm:h-32 rounded-full blur-[30px] sm:blur-[50px] opacity-10 group-hover:opacity-20 transition duration-500 pointer-events-none" style={{ background: s.color, transform: 'translate(30%, -30%)' }} />
              
              <div className="flex items-center justify-between mb-2 sm:mb-4 relative z-10">
                <div className="w-7 h-7 sm:w-12 sm:h-12 rounded-lg sm:rounded-2xl flex items-center justify-center shadow-inner" style={{ background: `${s.color}15`, border: `1px solid ${s.color}30` }}>
                  <Icon weight="duotone" className="w-4 h-4 sm:w-6 sm:h-6" style={{ color: s.color }} />
                </div>
                <span className="text-[7px] sm:text-[10px] font-bold flex items-center gap-1 text-white bg-white/5 border border-white/10 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg">
                  <ArrowUpRightIcon weight="bold" className="w-2 h-2 sm:w-3 sm:h-3" style={{ color: s.color }} /> {s.delta}
                </span>
              </div>
              
              <div className="relative z-10">
                <p className="text-base sm:text-2xl font-black text-white tracking-tight truncate">{s.value}</p>
                <p className="text-[8px] sm:text-xs text-gray-400 font-bold uppercase tracking-wider mt-0.5 sm:mt-1 truncate">{s.label}</p>
              </div>

              <div className="mt-2 sm:mt-4 pt-2 sm:pt-4 border-t border-white/5 relative z-10 hidden sm:block">
                <div className="flex justify-between text-[8px] sm:text-[10px] text-gray-500 font-mono mb-1 sm:mb-1.5">
                  <span>{s.deltaLabel}</span>
                  <span>{Math.round(s.progress)}%</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1 sm:h-1.5 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${s.progress}%`, background: s.color }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        
        {/* LEFT COLUMN: RECENT USERS & AGE Tiers */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          
          {/* RECENT USERS */}
          <div className="bg-transparent sm:bg-[#0f1014] sm:border border-white/10 rounded-2xl sm:rounded-3xl p-0 sm:p-6 shadow-none sm:shadow-xl">
            <div className="flex justify-between items-center mb-4 sm:mb-6 px-1 sm:px-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">Recent Signups</h3>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">The newest players to join SabTa</p>
              </div>
              <button 
                onClick={() => navigate('/admin/users')} 
                className="text-[10px] sm:text-xs font-bold text-[#00f0ff] flex items-center gap-1 hover:gap-2 transition-all bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl border border-[#00f0ff]/20"
              >
                View All <CaretRightIcon weight="bold" />
              </button>
            </div>
            
            <div className="space-y-2 sm:space-y-3">
              {recentUsers.length === 0 ? (
                <p className="text-gray-500 text-xs sm:text-sm text-center py-6 sm:py-8">No users registered yet.</p>
              ) : (
                recentUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 sm:p-4 bg-[#0f1014] sm:bg-black/40 border border-white/5 rounded-xl sm:rounded-2xl hover:border-white/20 transition-all group">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-[#00f0ff] to-blue-600 flex items-center justify-center font-bold text-black text-xs sm:text-sm shrink-0 uppercase overflow-hidden shadow-lg border-2 border-[#0f1014]">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          u.display_name?.charAt(0) || 'P'
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs sm:text-sm truncate text-white group-hover:text-[#00f0ff] transition">{u.display_name || 'Unknown Player'}</p>
                        <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
                          <span className="text-[8px] sm:text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            {u.age_category || 'Unset'}
                          </span>
                          <span className="text-[8px] sm:text-[10px] text-gray-500 font-mono">
                            {new Date(u.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] text-gray-500 uppercase font-bold">Balance</p>
                        <p className="text-xs font-bold text-[#ccff00]">{u.points || 0} pts</p>
                        <p className="text-[10px] font-bold text-[#ff00a0]">{u.coins || 0} coins</p>
                      </div>
                      <CheckCircleIcon weight="fill" className="text-[#00f0ff] w-5 h-5 sm:w-6 sm:h-6 opacity-30 sm:opacity-30 group-hover:opacity-100 transition" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* AGE BREAKDOWN */}
          <div className="bg-transparent sm:bg-[#0f1014] sm:border border-white/10 rounded-2xl sm:rounded-3xl p-0 sm:p-6 shadow-none sm:shadow-xl">
            <div className="flex justify-between items-center mb-4 sm:mb-6 px-1 sm:px-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">Player Demographics</h3>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">Distribution across age tiers</p>
              </div>
              <ChartBarIcon weight="duotone" className="text-[#ccff00] w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-x-8 sm:gap-y-6">
              {ageBreakdown.length === 0 ? (
                <p className="text-gray-500 text-xs sm:text-sm text-center py-4 col-span-full">No demographic data.</p>
              ) : (
                ageBreakdown.map((a, i) => {
                  const total = ageBreakdown.reduce((s, x) => s + Number(x.count), 0)
                  const pct = total ? Math.round((Number(a.count) / total) * 100) : 0
                  const colors = ['#ccff00', '#00f0ff', '#ff00a0', '#ff9500']
                  const color = colors[i % colors.length]
                  
                  return (
                    <div key={a.category} className="bg-[#0f1014] sm:bg-black/20 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/5">
                      <div className="flex justify-between items-center mb-2 sm:mb-3">
                        <span className="text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 sm:gap-2" style={{ color }}>
                          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full" style={{ background: color }} /> {a.category}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-white">
                          {a.count} <span className="text-[9px] sm:text-[10px] text-gray-500 font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5 sm:h-2 overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-1000" 
                          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 10px ${color}80` }} 
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: QUICK ACTIONS & SYSTEM HEALTH */}
        <div className="space-y-4 sm:space-y-6">
          
          {/* SYSTEM HEALTH */}
          <div className="bg-[#0f1014] border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-[#ccff00]/5 rounded-bl-full pointer-events-none" />
            <h3 className="text-sm sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
              <ShieldCheckIcon weight="fill" className="text-green-400 w-5 h-5 sm:w-6 sm:h-6" /> System Health
            </h3>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex justify-between items-center pb-2 sm:pb-3 border-b border-white/5">
                <span className="text-[10px] sm:text-xs text-gray-400">Supabase Database</span>
                <span className="text-[10px] sm:text-xs font-bold text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Operational</span>
              </div>
              <div className="flex justify-between items-center pb-2 sm:pb-3 border-b border-white/5">
                <span className="text-[10px] sm:text-xs text-gray-400">Avg. Accuracy</span>
                <span className="text-[10px] sm:text-xs font-bold text-white">{stats.avgAccuracy}%</span>
              </div>
              <div className="flex justify-between items-center pb-2 sm:pb-3 border-b border-white/5">
                <span className="text-[10px] sm:text-xs text-gray-400">Total Points Minted</span>
                <span className="text-[10px] sm:text-xs font-bold text-[#ccff00]">{stats.pointsDistributed.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] sm:text-xs text-gray-400">Total Coins Minted</span>
                <span className="text-[10px] sm:text-xs font-bold text-[#ff00a0]">{stats.coinsDistributed.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* QUICK ACTIONS */}
          <div className="bg-transparent sm:bg-[#0f1014] sm:border border-white/10 rounded-2xl sm:rounded-3xl p-0 sm:p-6 shadow-none sm:shadow-xl">
            <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 px-1 sm:px-0">Quick Actions</h3>
            <div className="space-y-2">
              <button onClick={() => navigate('/admin/quizzes')} className="w-full flex items-center justify-between p-3 sm:p-4 bg-[#0f1014] sm:bg-black/40 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-xl sm:rounded-2xl transition group">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#00f0ff]/10 text-[#00f0ff] flex items-center justify-center">
                    <BookOpenIcon weight="fill" className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold">Manage Quizzes</span>
                </div>
                <ArrowRightIcon weight="bold" className="text-gray-500 group-hover:text-white transition w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button onClick={() => navigate('/admin/users')} className="w-full flex items-center justify-between p-3 sm:p-4 bg-[#0f1014] sm:bg-black/40 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-xl sm:rounded-2xl transition group">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#ccff00]/10 text-[#ccff00] flex items-center justify-center">
                    <UsersIcon weight="fill" className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold">Manage Players</span>
                </div>
                <ArrowRightIcon weight="bold" className="text-gray-500 group-hover:text-white transition w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button onClick={() => navigate('/admin/cosmetics')} className="w-full flex items-center justify-between p-3 sm:p-4 bg-[#0f1014] sm:bg-black/40 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-xl sm:rounded-2xl transition group">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#ff00a0]/10 text-[#ff00a0] flex items-center justify-center">
                    <ShoppingBagIcon weight="fill" className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold">Manage Shop</span>
                </div>
                <ArrowRightIcon weight="bold" className="text-gray-500 group-hover:text-white transition w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}