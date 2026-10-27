// src/pages/AdminCosmetics.tsx
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  PlusIcon, PencilSimpleIcon, TrashIcon, XIcon,
  CheckCircleIcon, ImageIcon, CoinsIcon, SparkleIcon, GiftIcon,
  UploadSimpleIcon, WarningCircleIcon
} from '@phosphor-icons/react'

export default function AdminCosmetics() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<any[]>([])
  
  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    cosmetic_type: 'background',
    price: 100,
    rarity: 'common',
    preview_url: '',
    status: 'published'
  })
  
  // Upload State
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState(false)
  
  const [saving, setSaving] = useState(false)
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0]
      if (!file) return

      setUploading(true)
      setUploadError(false)
      
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('cosmetics')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('cosmetics')
        .getPublicUrl(filePath)

      setFormData(prev => ({ ...prev, preview_url: publicUrl }))
      setToast({ type: 'success', msg: 'Image uploaded successfully!' })

    } catch (err: any) {
      setToast({ type: 'error', msg: 'Upload failed. Check storage policies.' })
      setUploadError(true)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingItem) {
        const { error } = await supabase.from('cosmetic_items').update(formData).eq('id', editingItem.id)
        if (error) throw error
        setToast({ type: 'success', msg: 'Item updated successfully!' })
      } else {
        const { error } = await supabase.from('cosmetic_items').insert([formData])
        if (error) throw error
        setToast({ type: 'success', msg: 'Item created successfully!' })
      }
      setIsModalOpen(false)
      fetchItems()
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message })
    } finally {
      setSaving(false)
    }
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
    setUploadError(false)
    if (item) {
      setEditingItem(item)
      setFormData({
        name: item.name,
        description: item.description || '',
        cosmetic_type: item.cosmetic_type,
        price: Number(item.price) || 100,
        rarity: item.rarity,
        preview_url: item.preview_url || '',
        status: item.status
      })
    } else {
      setEditingItem(null)
      setFormData({
        name: '', description: '', cosmetic_type: 'background',
        price: 100, rarity: 'common', preview_url: '', status: 'published'
      })
    }
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

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          
          {/* ✅ FIX: Modal Container */}
          <div className="bg-[#0f1014] border border-white/10 rounded-[2rem] w-full max-w-xl shadow-2xl relative flex flex-col max-h-[85vh] overflow-hidden">
            
            {/* Modal Header (Sticky) */}
            <div className="flex items-center justify-between p-6 md:p-8 border-b border-white/10 bg-[#0f1014] z-10 shrink-0">
              <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                <SparkleIcon className="text-[#ff00a0]" /> 
                {editingItem ? 'Edit Cosmetic' : 'Create Cosmetic'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition bg-white/5 p-2 rounded-full">
                <XIcon weight="bold" size={20} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
              <form id="cosmetic-form" onSubmit={handleSave} className="space-y-5">
                
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Item Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 focus:border-[#ff00a0] outline-none transition text-white" placeholder="e.g. Neon Cyber Background" />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Description</label>
                  <textarea required rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 focus:border-[#ff00a0] outline-none transition resize-none text-white" placeholder="Describe the item..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Type</label>
                    <select value={formData.cosmetic_type} onChange={e => setFormData({...formData, cosmetic_type: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 focus:border-[#ff00a0] outline-none transition text-white">
                      <option value="background">Background</option>
                      <option value="theme">Quiz Theme</option>
                      <option value="border">Avatar Border</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Rarity</label>
                    <select value={formData.rarity} onChange={e => setFormData({...formData, rarity: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 focus:border-[#ff00a0] outline-none transition text-white">
                      <option value="common">Common</option>
                      <option value="rare">Rare</option>
                      <option value="epic">Epic</option>
                      <option value="legendary">Legendary</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Price (Coins)</label>
                    <div className="relative">
                      <CoinsIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ff00a0]" />
                      <input 
                        required 
                        type="number" 
                        min="0" 
                        value={isNaN(formData.price) ? '' : formData.price} 
                        onChange={e => {
                          const val = parseInt(e.target.value);
                          setFormData({...formData, price: isNaN(val) ? 0 : val});
                        }} 
                        className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 focus:border-[#ff00a0] outline-none transition text-[#ff00a0] font-bold" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Status</label>
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 focus:border-[#ff00a0] outline-none transition text-white">
                      <option value="published">Published (Visible)</option>
                      <option value="draft">Draft (Hidden)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Item Image</label>
                  
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    className="hidden" 
                    id="image-upload" 
                  />
                  
                  <label 
                    htmlFor="image-upload" 
                    className={`cursor-pointer flex flex-col items-center justify-center w-full h-44 border-2 border-dashed rounded-2xl transition-all ${
                      uploading 
                        ? 'border-gray-700 bg-gray-800/20 text-gray-500 cursor-not-allowed' 
                        : formData.preview_url && !uploadError
                          ? 'border-[#ff00a0]/30 bg-[#ff00a0]/5 hover:bg-[#ff00a0]/10' 
                          : uploadError
                            ? 'border-red-500/50 bg-red-500/5'
                            : 'border-white/20 bg-black/30 hover:bg-white/5 hover:border-[#ff00a0]/50'
                    }`}
                  >
                    {formData.preview_url && !uploadError ? (
                      <div className="w-full h-full relative overflow-hidden rounded-xl p-1">
                        <img src={formData.preview_url} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                          <p className="text-white font-bold text-sm bg-black/60 px-4 py-2 rounded-lg backdrop-blur-md">Click to change image</p>
                        </div>
                      </div>
                    ) : (
                      <div className={`flex flex-col items-center ${uploadError ? 'text-red-400' : 'text-gray-400'}`}>
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${uploadError ? 'bg-red-500/20' : 'bg-black/50'}`}>
                          {uploading ? <UploadSimpleIcon size={28} className="animate-bounce text-[#ff00a0]" /> : uploadError ? <WarningCircleIcon size={28} /> : <ImageIcon size={28} />}
                        </div>
                        <p className="text-sm font-bold text-white mb-1">
                          {uploading ? 'Uploading...' : uploadError ? 'Upload Failed - Try Again' : 'Click to upload image'}
                        </p>
                        <p className="text-[11px] font-medium text-gray-500">PNG, JPG, or WEBP up to 5MB</p>
                      </div>
                    )}
                  </label>
                </div>

              </form>
            </div>

            {/* Modal Footer (Sticky) */}
            <div className="p-6 md:p-8 border-t border-white/10 bg-[#0f1014] flex gap-3 shrink-0 z-10">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition text-gray-300">Cancel</button>
              <button type="submit" form="cosmetic-form" disabled={saving || uploading} className="flex-1 py-3.5 bg-[#ccff00] text-black hover:bg-white rounded-xl font-bold transition disabled:opacity-50 shadow-[0_0_15px_rgba(204,255,0,0.2)]">
                {saving ? 'Saving...' : 'Save Item'}
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[10000] px-6 py-4 rounded-2xl font-bold text-sm shadow-2xl border flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-[#0f1014] border-green-500/30 text-green-400' : 'bg-[#0f1014] border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircleIcon weight="fill" size={24} /> : <XIcon weight="fill" size={24} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}