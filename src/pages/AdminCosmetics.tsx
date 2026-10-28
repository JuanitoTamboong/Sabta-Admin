// src/pages/AdminCosmetics.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  PlusIcon, PencilSimpleIcon, TrashIcon,
  ImageIcon, CoinsIcon, GiftIcon,
  CheckCircleIcon, WarningCircleIcon
} from '@phosphor-icons/react'
import CosmeticModal from './CosmeticModal' // ✅ Import the fixed modal

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

  const fetchItems = async () => {
    setLoading(true)
    const { data } = await supabase.from('cosmetic_items').select('*').order('created_at', { ascending: false })
    if (data) setItems(data)
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return
    try {
      await supabase.from('cosmetic_items').delete().eq('id', id)
      setToast({ type: 'success', msg: 'Item deleted.' })
      fetchItems()
    } catch (err) {
      setToast({ type: 'error', msg: 'Failed to delete item.' })
    }
  }

  const openEditModal = (item?: any) => {
    setEditingItem(item || null)
    setIsModalOpen(true)
  }

  return (
    <div className="max-w-7xl mx-auto">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GiftIcon weight="fill" className="text-[#ff00a0]" /> Cosmetics Store
          </h1>
          <p className="text-gray-400 text-sm mt-1">Manage exclusive skins, borders, and themes for players to buy.</p>
        </div>
        <button onClick={() => openEditModal()} className="bg-[#ccff00] text-black px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-white transition shadow-[0_0_20px_rgba(204,255,0,0.3)]">
          <PlusIcon weight="bold" /> Create New Item
        </button>
      </div>

      {/* ITEMS GRID */}
      {loading ? (
        <div className="text-center py-20 text-[#ccff00] animate-pulse font-mono tracking-widest">LOADING INVENTORY...</div>
      ) : items.length === 0 ? (
        <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-16 text-center shadow-xl">
          <GiftIcon weight="duotone" className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 font-bold text-lg mb-1">No cosmetics found</p>
          <p className="text-gray-500 text-sm mb-6">Create your first cosmetic item for the player shop.</p>
          <button onClick={() => openEditModal()} className="bg-[#ccff00] text-black px-6 py-2 rounded-xl font-bold hover:bg-white transition">
            Create Item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map(item => {
            const isLegendary = item.rarity === 'legendary'
            const isEpic = item.rarity === 'epic'
            const isRare = item.rarity === 'rare'
            
            const borderHover = isLegendary ? 'hover:border-[#ff00a0]/50 hover:shadow-[0_0_30px_rgba(255,0,160,0.2)]' 
              : isEpic ? 'hover:border-[#ccff00]/50 hover:shadow-[0_0_30px_rgba(204,255,0,0.2)]' 
              : isRare ? 'hover:border-[#00f0ff]/50 hover:shadow-[0_0_30px_rgba(0,240,255,0.2)]' 
              : 'hover:border-white/30'

            return (
              <div key={item.id} className={`bg-[#0f1014] border border-white/10 rounded-3xl overflow-hidden group transition-all duration-300 flex flex-col ${borderHover}`}>
                
                <div className="h-40 bg-black/50 relative flex items-center justify-center overflow-hidden border-b border-white/5">
                  <div className={`absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500 blur-2xl ${
                    isLegendary ? 'bg-[#ff00a0]' : isEpic ? 'bg-[#ccff00]' : isRare ? 'bg-[#00f0ff]' : 'bg-gray-500'
                  }`} />
                  
                  {item.preview_url ? (
                    <img 
                      src={item.preview_url} 
                      alt={item.name} 
                      className="w-full h-full object-cover relative z-10" 
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement?.classList.add('image-error');
                      }}
                    />
                  ) : (
                    <ImageIcon weight="duotone" className="w-10 h-10 text-gray-600 relative z-10" />
                  )}

                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/10 z-20">
                    {item.status}
                  </div>
                </div>
                
                <div className="p-5 flex-1 flex flex-col relative z-10">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-white text-lg leading-tight group-hover:text-white transition">{item.name}</h3>
                    <span className="font-bold text-[#ff00a0] flex items-center gap-1 shrink-0 bg-[#ff00a0]/10 px-2 py-1 rounded-lg">
                      <CoinsIcon weight="fill" /> {item.price}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-2 mb-4">{item.description}</p>
                  
                  <div className="mt-auto pt-4 border-t border-white/5 flex gap-2">
                    <button onClick={() => openEditModal(item)} className="flex-1 bg-white/5 hover:bg-white/10 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition text-gray-300">
                      <PencilSimpleIcon weight="bold" /> Edit
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-xl transition">
                      <TrashIcon weight="bold" size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ✅ CLEAN MODAL COMPONENT */}
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
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[10000] px-6 py-4 rounded-2xl font-bold text-sm shadow-2xl border flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-[#0f1014] border-green-500/30 text-green-400' : 'bg-[#0f1014] border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircleIcon weight="fill" size={24} /> : <WarningCircleIcon weight="fill" size={24} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}