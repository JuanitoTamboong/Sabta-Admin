// src/pages/AdminCosmetics.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  PlusIcon, PencilSimpleIcon, TrashIcon,
  ImageIcon, CoinsIcon, GiftIcon,
  CheckCircleIcon, WarningCircleIcon
} from '@phosphor-icons/react'
import CosmeticModal from './CosmeticModal'

export default function AdminCosmetics() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<any[]>([])
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    fetchItems()
  }, [])

  // Automatically hide the toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const fetchItems = async () => {
    setLoading(true)
    const { data } = await supabase.from('cosmetic_items').select('*').order('created_at', { ascending: false })
    if (data) setItems(data)
    setLoading(false)
  }

  const handleDelete = async (item: any) => {
    if (!confirm("Are you sure you want to delete this item? This will also remove it from any player who owns it.")) return
    
    try {
      // 1. Try to delete the file from Supabase Storage. 
      if (item.preview_url && item.preview_url.includes('/storage/v1/object/public/cosmetics/')) {
        const filePath = item.preview_url.split('/cosmetics/')[1]
        if (filePath) {
          const { error: storageError } = await supabase.storage.from('cosmetics').remove([filePath])
          if (storageError) {
            console.warn("Storage file could not be deleted (might already be missing):", storageError.message)
          }
        }
      }

      // 2. Delete the record from the database.
      const { error: dbError } = await supabase.from('cosmetic_items').delete().eq('id', item.id)
      
      if (dbError) {
        // ✅ This will now tell you exactly if the SQL fix hasn't applied yet
        console.error("Database delete failed:", dbError)
        if (dbError.code === '23503') {
          throw new Error("Database is still blocking this! Run the SQL fix to add ON DELETE CASCADE.")
        }
        throw dbError
      }

      // 3. Update local state instantly so it disappears from the screen
      setItems((prevItems) => prevItems.filter(i => i.id !== item.id))
      
      setToast({ type: 'success', msg: 'Item deleted successfully.' })
    } catch (err: any) {
      console.error("Delete failed:", err)
      setToast({ type: 'error', msg: err.message || 'Failed to delete item.' })
    }
  }

  const openEditModal = (item?: any) => {
    setEditingItem(item || null)
    setIsModalOpen(true)
  }

  return (
    <div className="max-w-7xl mx-auto admin-page-enter">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <GiftIcon weight="fill" className="text-[#ff00a0]" /> Cosmetics Store
          </h1>
          <p className="text-gray-400 text-[10px] sm:text-sm mt-1">Manage exclusive skins, borders, and themes for players to buy.</p>
        </div>
        <button onClick={() => openEditModal()} className="bg-[#ccff00] text-black px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-white transition shadow-[0_0_20px_rgba(204,255,0,0.3)] text-xs sm:text-sm w-full sm:w-auto">
          <PlusIcon weight="bold" /> Create New Item
        </button>
      </div>

      {/* ITEMS GRID */}
      {loading ? (
        <div className="text-center py-20 text-[#ccff00] animate-pulse font-mono tracking-widest text-sm">LOADING INVENTORY...</div>
      ) : items.length === 0 ? (
        <div className="bg-[#0f1014] border border-white/10 rounded-2xl sm:rounded-3xl p-10 sm:p-16 text-center shadow-xl">
          <GiftIcon weight="duotone" className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 font-bold text-base sm:text-lg mb-1">No cosmetics found</p>
          <p className="text-gray-500 text-xs sm:text-sm mb-6">Create your first cosmetic item for the player shop.</p>
          <button onClick={() => openEditModal()} className="bg-[#ccff00] text-black px-6 py-2 rounded-xl font-bold hover:bg-white transition text-sm">
            Create Item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
          {items.map(item => {
            const isLegendary = item.rarity === 'legendary'
            const isEpic = item.rarity === 'epic'
            const isRare = item.rarity === 'rare'
            
            const borderHover = isLegendary ? 'hover:border-[#ff00a0]/50 hover:shadow-[0_0_30px_rgba(255,0,160,0.2)]' 
              : isEpic ? 'hover:border-[#ccff00]/50 hover:shadow-[0_0_30px_rgba(204,255,0,0.2)]' 
              : isRare ? 'hover:border-[#00f0ff]/50 hover:shadow-[0_0_30px_rgba(0,240,255,0.2)]' 
              : 'hover:border-white/30'

            return (
              <div key={item.id} className={`bg-[#0f1014] border border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden group transition-all duration-300 flex flex-col ${borderHover}`}>
                
                {/* IMAGE CONTAINER */}
                <div className="h-28 sm:h-40 bg-[#050505] relative flex items-center justify-center overflow-hidden border-b border-white/5">
                  <div className={`absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500 blur-2xl ${
                    isLegendary ? 'bg-[#ff00a0]' : isEpic ? 'bg-[#ccff00]' : isRare ? 'bg-[#00f0ff]' : 'bg-gray-500'
                  }`} />
                  
                  {item.preview_url ? (
                    <img 
                      src={item.preview_url} 
                      alt={item.name} 
                      className="w-full h-full object-contain p-2 relative z-10"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement?.classList.add('image-error');
                      }}
                    />
                  ) : (
                    <ImageIcon weight="duotone" className="w-8 h-8 sm:w-10 sm:h-10 text-gray-600 relative z-10" />
                  )}

                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-black/60 backdrop-blur-md px-2 py-0.5 sm:px-3 sm:py-1 rounded-md sm:rounded-full text-[8px] sm:text-[10px] font-bold uppercase tracking-wider border border-white/10 z-20">
                    {item.status}
                  </div>
                </div>
                
                <div className="p-3 sm:p-5 flex-1 flex flex-col relative z-10">
                  <div className="flex flex-col sm:flex-row justify-between items-start mb-1 sm:mb-2 gap-1">
                    <h3 className="font-bold text-white text-xs sm:text-lg leading-tight line-clamp-1">{item.name}</h3>
                    <span className="font-bold text-[#ff00a0] flex items-center gap-1 shrink-0 bg-[#ff00a0]/10 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-sm">
                      <CoinsIcon weight="fill" className="w-3 h-3 sm:w-4 sm:h-4" /> {item.price}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-400 line-clamp-2 mb-3 sm:mb-4 leading-tight">{item.description}</p>
                  
                  <div className="mt-auto pt-2 sm:pt-4 border-t border-white/5 flex gap-1.5 sm:gap-2">
                    <button onClick={() => openEditModal(item)} className="flex-1 bg-white/5 hover:bg-white/10 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition text-gray-300">
                      <PencilSimpleIcon weight="bold" className="w-3 h-3 sm:w-4 sm:h-4" /> Edit
                    </button>
                    <button onClick={() => handleDelete(item)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition">
                      <TrashIcon weight="bold" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CLEAN MODAL COMPONENT */}
      <CosmeticModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        editingItem={editingItem} 
        onSaveSuccess={() => {
          fetchItems()
          setToast({ type: 'success', msg: 'Cosmetic saved successfully!' })
        }}
      />

      {/* TOAST */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[10000] px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm shadow-2xl border flex items-center gap-2 sm:gap-3 animate-in slide-in-from-top-4 fade-in duration-300 ${
          toast.type === 'success' ? 'bg-[#0f1014] border-green-500/30 text-green-400' : 'bg-[#0f1014] border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircleIcon weight="fill" size={20} className="sm:w-6 sm:h-6" /> : <WarningCircleIcon weight="fill" size={20} className="sm:w-6 sm:h-6" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}