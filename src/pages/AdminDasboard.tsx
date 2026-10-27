// src/pages/AdminDashboard.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  UsersIcon, BookOpenIcon, LightningIcon,
  TargetIcon, ArrowUpRightIcon, CaretRightIcon, 
  CheckCircleIcon, PlusIcon, ChartBarIcon
} from '@phosphor-icons/react'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalUsers: 0, activeToday: 0, totalQuizzes: 0, totalAttempts: 0, avgAccuracy: 0, pointsDistributed: 0, newUsersThisWeek: 0 })
  const [recentUsers, setRecentUsers] = useState<any[]>([])
  const [ageBreakdown, setAgeBreakdown] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Users & Age Breakdown
        const { data: usersData } = await supabase.from('profiles').select('*') // Changed to profiles to ensure it works
        const totalUsers = usersData?.length || 0
        
        // Sort and get recent 5
        setRecentUsers([...(usersData || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5))

        const weekAgo = new Date(Date.now() - 7 * 86400000)
        const newUsersThisWeek = (usersData || []).filter(u => new Date(u.created_at) > weekAgo).length

        const breakdown = (usersData || []).reduce((acc: any, p) => {
          const cat = p.age_category || 'unset'
          acc[cat] = (acc[cat] || 0) + 1
          return acc
        }, {})
        setAgeBreakdown(Object.entries(breakdown).map(([k, v]) => ({ category: k, count: v })))

        // 2. Quizzes
        const { count: totalQuizzes } = await supabase.from('quizzes').select('id', { count: 'exact', head: true })

        // 3. Attempts & Accuracy
        const today = new Date().toISOString().split('T')[0]
        const { data: attempts } = await supabase.from('quiz_attempts').select('score, accuracy, created_at')

        const totalAttempts = attempts?.length || 0
        let pointsDistributed = 0, activeTodayCount = 0
        let totalAccuracy = 0

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
          newUsersThisWeek 
        })
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-[#ccff00]">
        <p className="font-mono text-sm animate-pulse">LOADING METRICS...</p>
      </div>
    )
  }

  const statCards = [
    { label: 'Total Players', value: stats.totalUsers.toLocaleString(), delta: `+${stats.newUsersThisWeek}`, deltaLabel: 'this week', icon: UsersIcon, color: '#00f0ff' },
    { label: 'Active Today', value: stats.activeToday.toString(), delta: 'live', deltaLabel: 'sessions', icon: LightningIcon, color: '#ccff00' },
    { label: 'Total Quizzes', value: stats.totalQuizzes.toString(), delta: `${stats.totalAttempts} plays`, deltaLabel: 'all time', icon: BookOpenIcon, color: '#ff00a0' },
    { label: 'Avg Accuracy', value: `${stats.avgAccuracy}%`, delta: `${stats.pointsDistributed.toLocaleString()} pts`, deltaLabel: 'distributed', icon: TargetIcon, color: '#ff9500' },
  ]

  return (
    <div className="relative z-10">
      
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Command Center</h1>
          <p className="text-gray-400 text-sm mt-1">System overview and real-time metrics</p>
        </div>
        <button 
          onClick={() => navigate('/admin/quizzes')} 
          className="bg-[#ccff00] text-black px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-white transition shadow-[0_0_20px_rgba(204,255,0,0.2)]"
        >
          <PlusIcon weight="bold" /> Create Quiz
        </button>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-[#0f1014] border border-white/10 p-5 rounded-2xl relative overflow-hidden group hover:border-white/20 transition-all duration-300">
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-[40px] opacity-10 group-hover:opacity-30 transition duration-500" style={{ background: s.color }} />
              
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15`, border: `1px solid ${s.color}40` }}>
                  <Icon weight="duotone" className="w-6 h-6" style={{ color: s.color }} />
                </div>
                <span className="text-[10px] font-bold flex items-center gap-0.5 text-[#ccff00] bg-[#ccff00]/10 px-2 py-1 rounded-lg">
                  <ArrowUpRightIcon weight="bold" className="w-3 h-3" /> {s.delta}
                </span>
              </div>
              <p className="text-3xl font-black relative z-10 text-white tracking-tight">{s.value}</p>
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mt-1 relative z-10">{s.label}</p>
              <p className="text-[10px] text-gray-600 mt-0.5 relative z-10 font-mono">{s.deltaLabel}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RECENT USERS */}
        <div className="lg:col-span-2 bg-[#0f1014] border border-white/10 rounded-3xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base font-bold text-white">Recent Signups</h3>
              <p className="text-xs text-gray-500 mt-1">Latest registered players</p>
            </div>
            <button 
              onClick={() => navigate('/admin/users')} 
              className="text-xs font-bold text-[#00f0ff] flex items-center gap-1 hover:gap-2 transition-all bg-[#00f0ff]/10 px-3 py-1.5 rounded-lg"
            >
              View all <CaretRightIcon weight="bold" />
            </button>
          </div>
          
          <div className="space-y-3">
            {recentUsers.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No users yet.</p>
            ) : (
              recentUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3.5 bg-black/40 border border-white/5 rounded-2xl hover:border-white/10 transition group">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00f0ff] to-blue-600 flex items-center justify-center font-bold text-black text-sm shrink-0 uppercase">
                      {u.display_name?.charAt(0) || 'P'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate text-white group-hover:text-[#00f0ff] transition">{u.display_name || 'Player'}</p>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                        {u.age_category?.toUpperCase() || 'UNSET'} • {new Date(u.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-bold text-[#ccff00]">{u.points || 0} pts</span>
                    <CheckCircleIcon weight="fill" className="text-[#00f0ff] w-5 h-5 opacity-50 group-hover:opacity-100 transition" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AGE BREAKDOWN */}
        <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-bold text-white">Age Tiers</h3>
            <ChartBarIcon weight="duotone" className="text-[#ccff00] w-5 h-5" />
          </div>
          
          <div className="space-y-4">
            {ageBreakdown.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No data.</p>
            ) : (
              ageBreakdown.map((a, i) => {
                const total = ageBreakdown.reduce((s, x) => s + Number(x.count), 0)
                const pct = total ? Math.round((Number(a.count) / total) * 100) : 0
                const colors = ['#ccff00', '#00f0ff', '#ff00a0', '#ff9500']
                const color = colors[i % colors.length]
                
                return (
                  <div key={a.category}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{a.category}</span>
                      <span className="text-xs font-bold text-white">{a.count} <span className="text-[10px] text-gray-500 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="h-2.5 rounded-full transition-all duration-1000" 
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
    </div>
  )
}