import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase' 
import { UsersIcon, FileTextIcon, LightningIcon, TrophyIcon } from '@phosphor-icons/react'

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalPlayers: 0, totalQuizzes: 0, totalAttempts: 0, kids: 0, teens: 0, adults: 0 })

  useEffect(() => {
    const fetchStats = async () => {
      const { data: profiles } = await supabase.from('profiles').select('age_category')
      const { count: quizCount } = await supabase.from('quizzes').select('*', { count: 'exact', head: true })
      const { count: attemptCount } = await supabase.from('quiz_attempts').select('*', { count: 'exact', head: true })

      if (profiles) {
        setStats({
          totalPlayers: profiles.length,
          totalQuizzes: quizCount || 0,
          totalAttempts: attemptCount || 0,
          kids: profiles.filter(p => p.age_category === 'kids').length,
          teens: profiles.filter(p => p.age_category === 'teens').length,
          adults: profiles.filter(p => p.age_category === 'adults').length,
        })
      }
      setLoading(false)
    }
    fetchStats()
  }, [])

  if (loading) return <div className="text-[#ccff00] font-mono">LOADING ANALYTICS...</div>

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#0f1014] border border-white/10 p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#00f0ff]/10 flex items-center justify-center text-[#00f0ff]">
            <span><UsersIcon weight="duotone" className="w-7 h-7" /></span>
          </div>
          <div><p className="text-sm text-gray-400 font-semibold mb-1">Total Players</p><p className="text-3xl font-bold">{stats.totalPlayers}</p></div>
        </div>
        <div className="bg-[#0f1014] border border-white/10 p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#ccff00]/10 flex items-center justify-center text-[#ccff00]">
            <span><FileTextIcon weight="duotone" className="w-7 h-7" /></span>
          </div>
          <div><p className="text-sm text-gray-400 font-semibold mb-1">Quizzes Created</p><p className="text-3xl font-bold">{stats.totalQuizzes}</p></div>
        </div>
        <div className="bg-[#0f1014] border border-white/10 p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#ff00a0]/10 flex items-center justify-center text-[#ff00a0]">
            <span><LightningIcon weight="duotone" className="w-7 h-7" /></span>
          </div>
          <div><p className="text-sm text-gray-400 font-semibold mb-1">Total Attempts</p><p className="text-3xl font-bold">{stats.totalAttempts}</p></div>
        </div>
      </div>

      <div className="bg-[#0f1014] border border-white/10 p-6 rounded-2xl">
        {/* FIXED: Wrapped the TrophyIcon in a span to handle the color class */}
        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
          <span className="text-[#ccff00]"><TrophyIcon weight="fill" /></span> 
          Player Demographics
        </h2>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-center">
            <p className="text-xs text-gray-400 mb-1">Kids</p>
            <p className="text-xl font-bold text-green-400">{stats.kids}</p>
          </div>
          <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-center">
            <p className="text-xs text-gray-400 mb-1">Teens</p>
            <p className="text-xl font-bold text-[#00f0ff]">{stats.teens}</p>
          </div>
          <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-center">
            <p className="text-xs text-gray-400 mb-1">Adults</p>
            <p className="text-xl font-bold text-[#ff00a0]">{stats.adults}</p>
          </div>
        </div>
      </div>
    </div>
  )
}