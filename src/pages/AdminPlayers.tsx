// src/pages/AdminPlayers.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import {
  MagnifyingGlassIcon, ArrowLeftIcon, UsersIcon, CoinsIcon,
  LightningIcon, CalendarBlankIcon, ShieldCheckIcon, UserIcon,
  TrashIcon, WarningCircleIcon, XIcon
} from '@phosphor-icons/react'

export default function AdminPlayers() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTier, setFilterTier] = useState('all')
  
  // Delete State
  const [playerToDelete, setPlayerToDelete] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchPlayers = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setPlayers(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchPlayers()
  }, [])

  const handleDeletePlayer = async () => {
    if (!playerToDelete || deleting) return
    setDeleting(true)
    
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', playerToDelete.id)

      if (error) throw error

      setPlayerToDelete(null)
      await fetchPlayers()
      
    } catch (err: any) {
      console.error("Error deleting player:", err)
      alert("Failed to delete player: " + (err.message || "Unknown error"))
    } finally {
      setDeleting(false)
    }
  }

  const filteredPlayers = players.filter(p => {
    const matchesSearch = p.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTier = filterTier === 'all' ? true : p.age_category === filterTier
    return matchesSearch && matchesTier
  })

  return (
    <div className="min-h-screen bg-[#050505] text-white p-2 sm:p-6 md:p-8 relative admin-page-enter">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 sm:gap-4 mb-4 sm:mb-8 max-w-7xl mx-auto">
        <div>
          <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-gray-400 hover:text-white transition mb-1.5 text-xs sm:text-sm font-bold bg-white/5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg w-fit">
            <ArrowLeftIcon weight="bold" className="w-3 h-3 sm:w-4 sm:h-4" /> Back to Command Center
          </button>
          <h1 className="text-lg sm:text-3xl font-black text-white">Manage Players</h1>
          <p className="text-gray-400 text-[10px] sm:text-sm mt-0.5 sm:mt-1">View all registered players, their balances, and account details.</p>
        </div>
        
        {/* Total Players Badge */}
        <div className="bg-[#0f1014] border border-white/5 sm:border-white/10 px-3 sm:px-6 py-1.5 sm:py-3 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3 w-full md:w-auto">
          <UsersIcon weight="fill" className="text-[#ccff00] w-4 h-4 sm:w-6 sm:h-6" />
          <div>
            <p className="text-[8px] sm:text-[10px] text-gray-500 uppercase font-bold tracking-wider">Total Players</p>
            <p className="text-sm sm:text-xl font-bold text-white">{players.length}</p>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="max-w-7xl mx-auto mb-4 sm:mb-8 flex flex-col md:flex-row gap-2 sm:gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-500 w-3.5 h-3.5 sm:w-5 sm:h-5" />
          <input 
            type="text" 
            placeholder="Search players by name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0f1014] border border-white/5 sm:border-white/10 rounded-lg sm:rounded-xl pl-8 sm:pl-12 pr-2 sm:pr-4 py-1.5 sm:py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-[#ccff00] transition"
          />
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2 bg-[#0f1014] border border-white/5 sm:border-white/10 p-0.5 sm:p-1.5 rounded-lg sm:rounded-xl overflow-x-auto">
          {['all', 'kids', 'teens', 'adults'].map(tier => (
            <button
              key={tier}
              onClick={() => setFilterTier(tier)}
              className={`flex-1 sm:flex-none px-2 sm:px-4 py-1 sm:py-2 rounded-md sm:rounded-lg text-[9px] sm:text-xs font-bold uppercase tracking-wider transition whitespace-nowrap ${filterTier === tier ? 'bg-[#ccff00] text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* PLAYERS GRID */}
      <div className="max-w-7xl mx-auto pb-20">
        {loading ? (
          <div className="text-center py-20 text-[#ccff00] animate-pulse font-mono tracking-widest text-sm">LOADING PLAYERS...</div>
        ) : filteredPlayers.length === 0 ? (
          <div className="bg-[#0f1014] border border-white/5 sm:border-white/10 rounded-2xl sm:rounded-3xl p-10 sm:p-16 text-center shadow-xl">
            <UsersIcon weight="duotone" className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mx-auto mb-3 sm:mb-4" />
            <p className="text-gray-400 font-bold text-base sm:text-lg mb-1">No players found</p>
            <p className="text-gray-500 text-xs sm:text-sm">Try adjusting your search or tier filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1.5 sm:gap-4">
            {filteredPlayers.map((player) => (
              <div key={player.id} className="bg-[#0f1014] border border-white/5 sm:border-white/10 rounded-xl sm:rounded-3xl p-2 sm:p-5 hover:border-white/20 transition-all group relative overflow-hidden">
                
                {/* Background Accent */}
                <div className="absolute top-0 right-0 w-10 h-10 sm:w-24 sm:h-24 bg-[#00f0ff]/5 rounded-bl-full pointer-events-none group-hover:bg-[#00f0ff]/10 transition-colors" />
                
                {/* Delete Button */}
                <button
                  onClick={() => setPlayerToDelete(player)}
                  className="absolute top-1 right-1 sm:top-4 sm:right-4 text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500 p-1 sm:p-2 rounded sm:rounded-xl transition z-20 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  title="Delete Player"
                >
                  <TrashIcon weight="bold" className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>

                {/* ✅ FIXED: Compact Header */}
                <div className="flex flex-col items-center text-center gap-1 sm:flex-row sm:items-center sm:text-left sm:gap-4 mb-2 sm:mb-5 relative z-10 w-full pr-0 sm:pr-8 mt-1 sm:mt-0">
                  <div className="w-8 h-8 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-[#00f0ff] to-blue-600 flex items-center justify-center font-bold text-black text-xs sm:text-xl shrink-0 uppercase overflow-hidden shadow-lg border border-[#0f1014] sm:border-2">
                    {player.avatar_url ? (
                      <img src={player.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      player.display_name?.charAt(0) || 'P'
                    )}
                  </div>
                  <div className="min-w-0 w-full">
                    <h3 className="font-bold text-white text-[10px] sm:text-lg truncate leading-tight">{player.display_name || 'Unknown Player'}</h3>
                    <div className="flex items-center justify-center sm:justify-start gap-1 mt-0.5 sm:mt-1">
                      <span className={`text-[7px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${player.role === 'admin' ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-white/10 text-gray-300'}`}>
                        {player.role || 'player'}
                      </span>
                      {player.role === 'admin' && <ShieldCheckIcon className="text-[#00f0ff] w-2.5 h-2.5 sm:w-4 sm:h-4" />}
                    </div>
                  </div>
                </div>

                {/* ✅ FIXED: Compact Stats */}
                <div className="grid grid-cols-2 gap-1 sm:gap-2 mb-1.5 sm:mb-4 relative z-10">
                  <div className="bg-black/40 border border-white/5 rounded sm:rounded-xl p-1 sm:p-3 text-center flex flex-col justify-center">
                    <p className="text-[7px] sm:text-[10px] text-gray-500 uppercase font-bold mb-0.5">Points</p>
                    <p className="font-bold text-[#ccff00] text-[9px] sm:text-base flex items-center justify-center gap-0.5 sm:gap-1">
                      <LightningIcon weight="fill" className="w-2 h-2 sm:w-4 sm:h-4" /> {player.points || 0}
                    </p>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded sm:rounded-xl p-1 sm:p-3 text-center flex flex-col justify-center">
                    <p className="text-[7px] sm:text-[10px] text-gray-500 uppercase font-bold mb-0.5">Coins</p>
                    <p className="font-bold text-[#ff00a0] text-[9px] sm:text-base flex items-center justify-center gap-0.5 sm:gap-1">
                      <CoinsIcon weight="fill" className="w-2 h-2 sm:w-4 sm:h-4" /> {player.coins || 0}
                    </p>
                  </div>
                </div>

                {/* ✅ FIXED: Compact Footer */}
                <div className="space-y-0.5 sm:space-y-2 relative z-10 mt-auto">
                  <div className="flex items-center justify-between text-[8px] sm:text-xs text-gray-400 bg-white/5 px-1 py-0.5 sm:px-3 sm:py-2 rounded sm:rounded-lg">
                    <span className="flex items-center gap-0.5 sm:gap-1.5"><UserIcon className="w-2.5 h-2.5 sm:w-4 sm:h-4" /> Tier</span>
                    <span className="font-bold text-white uppercase">{player.age_category || 'Unset'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[8px] sm:text-xs text-gray-400 bg-white/5 px-1 py-0.5 sm:px-3 sm:py-2 rounded sm:rounded-lg">
                    <span className="flex items-center gap-0.5 sm:gap-1.5"><CalendarBlankIcon className="w-2.5 h-2.5 sm:w-4 sm:h-4" /> Joined</span>
                    <span className="font-bold text-white truncate max-w-[50px] sm:max-w-none">{new Date(player.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DELETE MODAL USING PORTAL */}
      {playerToDelete && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f1014] border border-white/10 rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 max-w-md w-full shadow-[0_0_50px_rgba(255,0,0,0.15)] relative text-center animate-in fade-in zoom-in-95 duration-200">
            
            <button onClick={() => setPlayerToDelete(null)} className="absolute top-4 right-4 sm:top-6 sm:right-6 text-gray-500 hover:text-white transition bg-white/5 hover:bg-white/10 p-1.5 rounded-lg">
              <XIcon weight="bold" size={20} className="sm:w-5 sm:h-5" />
            </button>
            
            <div className="mx-auto w-14 h-14 sm:w-20 sm:h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-4 sm:mb-6 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              <WarningCircleIcon weight="fill" size={28} className="sm:w-10 sm:h-10" />
            </div>
            
            <h2 className="text-xl sm:text-2xl font-black text-white mb-2">Delete Player?</h2>
            
            <p className="text-gray-400 text-xs sm:text-sm mb-6 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">{playerToDelete.display_name}</strong>? 
              This will wipe all their scores, coins, and inventory. 
              <br/><br/>
              <span className="text-red-400/80 text-[10px] sm:text-xs">
                *Note: This deletes their game data. To completely block their Google account from logging in, you must delete them in the Supabase Authentication dashboard.
              </span>
            </p>
            
            <div className="flex gap-2 sm:gap-3">
              <button 
                onClick={() => setPlayerToDelete(null)} 
                disabled={deleting} 
                className="flex-1 py-3 sm:py-3.5 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition disabled:opacity-50 text-xs sm:text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeletePlayer} 
                disabled={deleting} 
                className="flex-1 py-3 sm:py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition disabled:opacity-50 shadow-[0_0_15px_rgba(239,68,68,0.3)] text-xs sm:text-sm"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}