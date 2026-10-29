// src/pages/AdminAnalytics.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { 
  UsersIcon, FileTextIcon, LightningIcon, TrophyIcon, 
  ChartLineUpIcon, ArrowUpRightIcon, TargetIcon, 
  CoinsIcon, GameControllerIcon 
} from '@phosphor-icons/react'

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ 
    totalPlayers: 0, 
    totalQuizzes: 0, 
    totalAttempts: 0, 
    kids: 0, 
    teens: 0, 
    adults: 0,
    totalCoins: 0,
    avgAccuracy: 0
  })

  useEffect(() => {
    const fetchStats = async () => {
      // ✅ FIX: Fetch only players, exclude admins
      const { data: profiles } = await supabase.from('profiles').select('age_category, coins').eq('role', 'player')
      const { count: quizCount } = await supabase.from('quizzes').select('*', { count: 'exact', head: true })
      const { data: attempts } = await supabase.from('quiz_attempts').select('accuracy')

      if (profiles) {
        const totalCoins = profiles.reduce((acc, p) => acc + (p.coins || 0), 0)
        let avgAcc = 0
        
        if (attempts && attempts.length > 0) {
          const sumAcc = attempts.reduce((acc, a) => acc + (a.accuracy || 0), 0)
          avgAcc = Math.round(sumAcc / attempts.length)
        }

        setStats({
          totalPlayers: profiles.length,
          totalQuizzes: quizCount || 0,
          totalAttempts: attempts?.length || 0,
          kids: profiles.filter(p => p.age_category === 'kids').length,
          teens: profiles.filter(p => p.age_category === 'teens').length,
          adults: profiles.filter(p => p.age_category === 'adults').length,
          totalCoins,
          avgAccuracy: avgAcc
        })
      }
      setLoading(false)
    }
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-[#ccff00]">
        <p className="font-mono text-sm animate-pulse tracking-widest">LOADING ANALYTICS...</p>
      </div>
    )
  }

  const totalDemographics = stats.kids + stats.teens + stats.adults || 1

  return (
    <div className="max-w-7xl mx-auto sm:p-4 md:p-0 space-y-4 sm:space-y-6 admin-page-enter">
      
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-3xl font-bold text-white flex items-center gap-2">
          Platform Analytics
        </h1>
        <p className="text-gray-400 text-xs sm:text-sm mt-1">Real-time overview of player activity and engagement.</p>
      </div>

      {/* TOP STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6">
        <div className="bg-[#0f1014] border border-white/5 sm:border-white/10 p-3 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between relative overflow-hidden group hover:border-white/20 transition-all">
          <div className="absolute top-0 right-0 w-16 sm:w-24 h-16 sm:h-24 bg-[#00f0ff]/10 rounded-bl-full pointer-events-none group-hover:bg-[#00f0ff]/20 transition-colors" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 relative z-10">
            <div className="w-8 h-8 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl bg-[#00f0ff]/10 flex items-center justify-center text-[#00f0ff] border border-[#00f0ff]/20 shadow-[0_0_15px_rgba(0,240,255,0.1)] shrink-0">
              <UsersIcon weight="fill" className="w-4 h-4 sm:w-7 sm:h-7" />
            </div>
            <div>
              <p className="text-[9px] sm:text-xs text-gray-400 font-bold uppercase tracking-wider mb-0.5 sm:mb-1">Players</p>
              <p className="text-lg sm:text-3xl font-black text-white">{stats.totalPlayers}</p>
            </div>
          </div>
          <div className="relative z-10 hidden sm:flex bg-[#00f0ff]/10 text-[#00f0ff] text-[10px] font-bold px-2 py-1 rounded-lg items-center gap-1">
            <ArrowUpRightIcon weight="bold" /> Live
          </div>
        </div>

        <div className="bg-[#0f1014] border border-white/5 sm:border-white/10 p-3 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between relative overflow-hidden group hover:border-white/20 transition-all">
          <div className="absolute top-0 right-0 w-16 sm:w-24 h-16 sm:h-24 bg-[#ccff00]/10 rounded-bl-full pointer-events-none group-hover:bg-[#ccff00]/20 transition-colors" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 relative z-10">
            <div className="w-8 h-8 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl bg-[#ccff00]/10 flex items-center justify-center text-[#ccff00] border border-[#ccff00]/20 shadow-[0_0_15px_rgba(204,255,0,0.1)] shrink-0">
              <FileTextIcon weight="fill" className="w-4 h-4 sm:w-7 sm:h-7" />
            </div>
            <div>
              <p className="text-[9px] sm:text-xs text-gray-400 font-bold uppercase tracking-wider mb-0.5 sm:mb-1">Quizzes</p>
              <p className="text-lg sm:text-3xl font-black text-white">{stats.totalQuizzes}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#0f1014] border border-white/5 sm:border-white/10 p-3 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between relative overflow-hidden group hover:border-white/20 transition-all col-span-2 sm:col-span-1">
          <div className="absolute top-0 right-0 w-16 sm:w-24 h-16 sm:h-24 bg-[#ff00a0]/10 rounded-bl-full pointer-events-none group-hover:bg-[#ff00a0]/20 transition-colors" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 relative z-10">
            <div className="w-8 h-8 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl bg-[#ff00a0]/10 flex items-center justify-center text-[#ff00a0] border border-[#ff00a0]/20 shadow-[0_0_15px_rgba(255,0,160,0.1)] shrink-0">
              <LightningIcon weight="fill" className="w-4 h-4 sm:w-7 sm:h-7" />
            </div>
            <div>
              <p className="text-[9px] sm:text-xs text-gray-400 font-bold uppercase tracking-wider mb-0.5 sm:mb-1">Plays</p>
              <p className="text-lg sm:text-3xl font-black text-white">{stats.totalAttempts}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        
        {/* PLAYER DEMOGRAPHICS */}
        <div className="bg-[#0f1014] border border-white/5 sm:border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl">
          <div className="flex justify-between items-center mb-5 sm:mb-8">
            <div>
              <h2 className="text-base sm:text-xl font-bold text-white flex items-center gap-2">
                <TrophyIcon weight="fill" className="text-[#ccff00]" /> Demographics
              </h2>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Distribution across age tiers.</p>
            </div>
          </div>
          
          <div className="space-y-4 sm:space-y-6">
            {/* Kids */}
            <div>
              <div className="flex justify-between items-end mb-1 sm:mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-400"></span>
                  <span className="font-bold text-[10px] sm:text-sm text-gray-300">Kids</span>
                </div>
                <div className="text-right">
                  <span className="text-xs sm:text-lg font-black text-white">{stats.kids}</span>
                  <span className="text-[8px] sm:text-[10px] text-gray-500 ml-1">({Math.round((stats.kids / totalDemographics) * 100)}%)</span>
                </div>
              </div>
              <div className="w-full bg-black/50 rounded-full h-1.5 sm:h-3 overflow-hidden border border-white/5">
                <div className="bg-green-400 h-full rounded-full transition-all duration-1000" style={{ width: `${(stats.kids / totalDemographics) * 100}%` }} />
              </div>
            </div>

            {/* Teens */}
            <div>
              <div className="flex justify-between items-end mb-1 sm:mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-[#00f0ff]"></span>
                  <span className="font-bold text-[10px] sm:text-sm text-gray-300">Teens</span>
                </div>
                <div className="text-right">
                  <span className="text-xs sm:text-lg font-black text-white">{stats.teens}</span>
                  <span className="text-[8px] sm:text-[10px] text-gray-500 ml-1">({Math.round((stats.teens / totalDemographics) * 100)}%)</span>
                </div>
              </div>
              <div className="w-full bg-black/50 rounded-full h-1.5 sm:h-3 overflow-hidden border border-white/5">
                <div className="bg-[#00f0ff] h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(0,240,255,0.5)]" style={{ width: `${(stats.teens / totalDemographics) * 100}%` }} />
              </div>
            </div>

            {/* Adults */}
            <div>
              <div className="flex justify-between items-end mb-1 sm:mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-[#ff00a0]"></span>
                  <span className="font-bold text-[10px] sm:text-sm text-gray-300">Adults</span>
                </div>
                <div className="text-right">
                  <span className="text-xs sm:text-lg font-black text-white">{stats.adults}</span>
                  <span className="text-[8px] sm:text-[10px] text-gray-500 ml-1">({Math.round((stats.adults / totalDemographics) * 100)}%)</span>
                </div>
              </div>
              <div className="w-full bg-black/50 rounded-full h-1.5 sm:h-3 overflow-hidden border border-white/5">
                <div className="bg-[#ff00a0] h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(255,0,160,0.5)]" style={{ width: `${(stats.adults / totalDemographics) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* ENGAGEMENT & ECONOMY */}
        <div className="bg-[#0f1014] border border-white/5 sm:border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 sm:w-32 h-20 sm:h-32 bg-[#ff00a0]/5 rounded-bl-full pointer-events-none" />
          
          <div className="flex justify-between items-center mb-5 sm:mb-8 relative z-10">
            <div>
              <h2 className="text-base sm:text-xl font-bold text-white flex items-center gap-2">
                <ChartLineUpIcon weight="bold" className="text-[#ff00a0]" /> Engagement
              </h2>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-1">How players interact with the platform.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 relative z-10">
            
            <div className="bg-black/40 border border-white/5 p-3 sm:p-5 rounded-xl sm:rounded-2xl flex flex-col justify-center">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                <TargetIcon weight="fill" className="text-[#ccff00] w-3.5 h-3.5 sm:w-5 sm:h-5" />
                <p className="text-[9px] sm:text-xs text-gray-400 font-bold uppercase tracking-wider">Accuracy</p>
              </div>
              <p className="text-xl sm:text-3xl font-black text-[#ccff00]">{stats.avgAccuracy}%</p>
              <p className="text-[8px] sm:text-[10px] text-gray-500 mt-0.5 sm:mt-1">Avg across all attempts</p>
            </div>

            <div className="bg-black/40 border border-white/5 p-3 sm:p-5 rounded-xl sm:rounded-2xl flex flex-col justify-center">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                <GameControllerIcon weight="fill" className="text-[#00f0ff] w-3.5 h-3.5 sm:w-5 sm:h-5" />
                <p className="text-[9px] sm:text-xs text-gray-400 font-bold uppercase tracking-wider">Avg Plays</p>
              </div>
              <p className="text-xl sm:text-3xl font-black text-[#00f0ff]">
                {stats.totalPlayers > 0 ? (stats.totalAttempts / stats.totalPlayers).toFixed(1) : 0}
              </p>
              <p className="text-[8px] sm:text-[10px] text-gray-500 mt-0.5 sm:mt-1">Per player</p>
            </div>

            <div className="bg-black/40 border border-white/5 p-3 sm:p-5 rounded-xl sm:rounded-2xl flex flex-col justify-center sm:col-span-2">
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                    <CoinsIcon weight="fill" className="text-[#ff00a0] w-3.5 h-3.5 sm:w-5 sm:h-5" />
                    <p className="text-[9px] sm:text-xs text-gray-400 font-bold uppercase tracking-wider">Total Economy</p>
                  </div>
                  <p className="text-xl sm:text-3xl font-black text-[#ff00a0]">{stats.totalCoins.toLocaleString()}</p>
                </div>
                <div className="w-10 h-10 sm:w-16 sm:h-16 bg-[#ff00a0]/10 rounded-full flex items-center justify-center shrink-0">
                  <CoinsIcon weight="fill" className="text-[#ff00a0] w-5 h-5 sm:w-8 sm:h-8" />
                </div>
              </div>
              <p className="text-[8px] sm:text-[10px] text-gray-500 mt-0.5 sm:mt-1">Total coins held by all players</p>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}