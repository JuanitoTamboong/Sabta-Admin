// src/pages/AdminPlayers.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  MagnifyingGlassIcon,
  ArrowLeftIcon,
  UsersIcon,
  CoinsIcon,
  LightningIcon,
  CalendarBlankIcon,
  ShieldCheckIcon,
  UserIcon
} from '@phosphor-icons/react'

export default function AdminPlayers() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTier, setFilterTier] = useState('all')

  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (data) setPlayers(data)
      setLoading(false)
    }

    fetchPlayers()
  }, [])

  // Filter logic
  const filteredPlayers = players.filter(p => {
    const matchesSearch = p.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTier = filterTier === 'all' ? true : p.age_category === filterTier
    return matchesSearch && matchesTier
  })

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8 relative">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 max-w-7xl mx-auto">
        <div>
          <button 
            onClick={() => navigate('/admin')} 
            className="flex items-center gap-2 text-gray-400 hover:text-white transition mb-2 text-sm font-bold bg-white/5 px-3 py-1.5 rounded-lg w-fit"
          >
            <ArrowLeftIcon weight="bold" /> Back to Command Center
          </button>
          <h1 className="text-3xl font-black text-white">Manage Players</h1>
          <p className="text-gray-400 text-sm mt-1">View all registered players, their balances, and account details.</p>
        </div>
        
        <div className="bg-[#0f1014] border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-3">
          <UsersIcon weight="fill" className="text-[#ccff00] w-6 h-6" />
          <div>
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Total Players</p>
            <p className="text-xl font-bold text-white">{players.length}</p>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search players by name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0f1014] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-[#ccff00] transition"
          />
        </div>
        
        <div className="flex items-center gap-2 bg-[#0f1014] border border-white/10 p-1.5 rounded-xl overflow-x-auto">
          {['all', 'kids', 'teens', 'adults'].map(tier => (
            <button
              key={tier}
              onClick={() => setFilterTier(tier)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition whitespace-nowrap ${
                filterTier === tier 
                  ? 'bg-[#ccff00] text-black' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* PLAYERS GRID */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-[#ccff00] animate-pulse font-mono tracking-widest">
            LOADING PLAYERS...
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-16 text-center shadow-xl">
            <UsersIcon weight="duotone" className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 font-bold text-lg mb-1">No players found</p>
            <p className="text-gray-500 text-sm">Try adjusting your search or tier filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredPlayers.map((player) => (
              <div 
                key={player.id} 
                className="bg-[#0f1014] border border-white/10 rounded-3xl p-5 hover:border-white/20 transition-all group relative overflow-hidden"
              >
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#00f0ff]/5 rounded-bl-full pointer-events-none group-hover:bg-[#00f0ff]/10 transition-colors" />
                
                {/* Avatar & Name */}
                <div className="flex items-center gap-4 mb-5 relative z-10">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00f0ff] to-blue-600 flex items-center justify-center font-bold text-black text-xl shrink-0 uppercase overflow-hidden shadow-lg border-2 border-[#0f1014]">
                    {player.avatar_url ? (
                      <img src={player.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      player.display_name?.charAt(0) || 'P'
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-white text-lg truncate pr-2">{player.display_name || 'Unknown Player'}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                        player.role === 'admin' ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-white/10 text-gray-300'
                      }`}>
                        {player.role || 'player'}
                      </span>
                      {player.role === 'admin' && <ShieldCheckIcon className="text-[#00f0ff] w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 mb-4 relative z-10">
                  <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Points</p>
                    <p className="font-bold text-[#ccff00] flex items-center justify-center gap-1">
                      <LightningIcon weight="fill" /> {player.points || 0}
                    </p>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Coins</p>
                    <p className="font-bold text-[#ff00a0] flex items-center justify-center gap-1">
                      <CoinsIcon weight="fill" /> {player.coins || 0}
                    </p>
                  </div>
                </div>

                {/* Footer Info */}
                <div className="space-y-2 relative z-10">
                  <div className="flex items-center justify-between text-xs text-gray-400 bg-white/5 px-3 py-2 rounded-lg">
                    <span className="flex items-center gap-1.5"><UserIcon /> Tier</span>
                    <span className="font-bold text-white uppercase">{player.age_category || 'Unset'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 bg-white/5 px-3 py-2 rounded-lg">
                    <span className="flex items-center gap-1.5"><CalendarBlankIcon /> Joined</span>
                    <span className="font-bold text-white">{new Date(player.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}