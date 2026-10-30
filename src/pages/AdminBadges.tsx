// src/pages/AdminBadges.tsx
import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import {
  PlusIcon, PencilSimpleIcon, TrashIcon,
  WarningCircleIcon, CheckCircleIcon, MedalIcon, XIcon
} from '@phosphor-icons/react'

export default function AdminBadges() {
  const [badges, setBadges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBadge, setEditingBadge] = useState<any>(null)
  
  const [formData, setFormData] = useState<{
    name: string
    min_points: number | string
    max_points: number | string
    image_url: string
  }>({
    name: '',
    min_points: 0,
    max_points: 999999,
    image_url: ''
  })
  
  // Track the pending file and local preview URL
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [localPreview, setLocalPreview] = useState<string>('')
  
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{type: 'success'|'error', msg: string} | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchBadges = async () => {
    const { data, error } = await supabase
      .from('badge_items')
      .select('id, name, min_points, max_points, image_url')
      .order('min_points', { ascending: true })
    
    if (!error && data) setBadges(data)
    setLoading(false)
  }

  useEffect(() => { fetchBadges() }, [])

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview)
    }
  }, [localPreview])

  const openModal = (badge?: any) => {
    if (localPreview) URL.revokeObjectURL(localPreview)
    setLocalPreview('')
    setPendingFile(null)

    if (badge) {
      setEditingBadge(badge)
      setFormData({
        name: badge.name,
        min_points: badge.min_points,
        max_points: badge.max_points,
        image_url: badge.image_url
      })
    } else {
      setEditingBadge(null)
      setFormData({ name: '', min_points: 0, max_points: 999999, image_url: '' })
    }
    setIsModalOpen(true)
    setToast(null)
  }

  const handleCloseModal = () => {
    if (localPreview) URL.revokeObjectURL(localPreview)
    setLocalPreview('')
    setPendingFile(null)
    setIsModalOpen(false)
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setToast({ type: 'error', msg: 'Please select an image file.' })
      return
    }

    if (localPreview) URL.revokeObjectURL(localPreview)

    const objectUrl = URL.createObjectURL(file)
    setPendingFile(file)
    setLocalPreview(objectUrl)
    
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    let uploadedPath: string | null = null
    let oldImagePath: string | null = null

    try {
      let finalImageUrl = formData.image_url

      if (pendingFile) {
        const fileExt = pendingFile.name.split('.').pop()
        const fileName = `${crypto.randomUUID()}.${fileExt}`
        uploadedPath = fileName

        const { error: uploadError } = await supabase.storage
          .from('badges')
          .upload(fileName, pendingFile)

        if (uploadError) throw uploadError

        const { data } = supabase.storage.from('badges').getPublicUrl(fileName)
        finalImageUrl = data.publicUrl

        if (editingBadge && editingBadge.image_url && editingBadge.image_url.includes('/badges/')) {
          oldImagePath = editingBadge.image_url.split('/badges/')[1]
        }
      }

      const payload = {
        name: formData.name,
        min_points: parseInt(String(formData.min_points)) || 0,
        max_points: parseInt(String(formData.max_points)) || 0,
        image_url: finalImageUrl
      }

      if (editingBadge) {
        const { error } = await supabase
          .from('badge_items')
          .update(payload)
          .eq('id', editingBadge.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('badge_items')
          .insert([payload])
        if (error) throw error
      }
      
      if (oldImagePath) {
        await supabase.storage.from('badges').remove([oldImagePath])
      }
      
      setToast({ type: 'success', msg: 'Badge saved!' })
      fetchBadges()
      setTimeout(() => handleCloseModal(), 1000)
      
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message })
      
      if (uploadedPath) {
        await supabase.storage.from('badges').remove([uploadedPath])
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, imageUrl: string) => {
    if (!confirm('Are you sure you want to delete this badge? The image will also be permanently deleted.')) return
    
    try {
      if (imageUrl && imageUrl.includes('/badges/')) {
        const filePath = imageUrl.split('/badges/')[1]
        if (filePath) {
          await supabase.storage.from('badges').remove([filePath])
        }
      }
      
      const { error } = await supabase.from('badge_items').delete().eq('id', id)
      if (error) throw error

      fetchBadges()
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message })
    }
  }

  if (loading) return <div className="text-[#ccff00] font-mono p-8">LOADING BADGES...</div>

  const displayImage = localPreview || formData.image_url

  return (
    <div className="space-y-6">
      {/* 🔧 FIX: Adjusted flex direction for mobile so it doesn't squish */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Manage Badges</h2>
          <p className="text-xs text-gray-400">Upload images and set point requirements for player tiers.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="w-full sm:w-auto bg-[#ccff00] text-black px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-white transition whitespace-nowrap"
        >
          <PlusIcon weight="bold" /> Add Badge
        </button>
      </div>

      {/* 🔧 FIX: Grid adjusted for mobile (2 cols) and desktop (6 cols) with better gap and padding */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        {badges.map(b => (
          <div key={b.id} className="bg-[#0f1014] border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col items-center text-center relative group">
            <img src={b.image_url} alt={b.name} className="w-14 h-14 sm:w-16 sm:h-16 object-contain mb-2 sm:mb-3" />
            <h3 className="font-bold text-white text-xs sm:text-sm truncate w-full">{b.name}</h3>
            <p className="text-[9px] sm:text-[10px] text-gray-400 mb-2">{b.min_points} - {b.max_points} PTS</p>
            
            <div className="flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition mt-auto w-full justify-center">
              <button onClick={() => openModal(b)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white"><PencilSimpleIcon size={14} /></button>
              <button onClick={() => handleDelete(b.id, b.image_url)} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-500"><TrashIcon size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
          <form onSubmit={handleSave} className="bg-[#0f1014] border border-white/10 rounded-2xl w-full max-w-md max-h-[95vh] flex flex-col overflow-hidden shadow-2xl">
            
            {/* Header */}
            <div className="p-3 sm:p-4 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <MedalIcon weight="fill" className="text-[#ccff00]" />
                {editingBadge ? 'Edit Badge' : 'New Badge'}
              </h3>
              <button type="button" onClick={handleCloseModal} className="text-gray-400 hover:text-white p-1.5 bg-white/5 rounded-full transition">
                <XIcon weight="bold" size={16} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-5 overflow-y-auto admin-custom-scrollbar flex-1 space-y-4">
              
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-bold mb-1.5 block tracking-wider">Badge Name</label>
                <input 
                  required 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#ccff00] transition" 
                  placeholder="e.g. Diamond"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-bold mb-1.5 block tracking-wider">Min Points</label>
                  <input 
                    required 
                    type="number" 
                    value={formData.min_points} 
                    onChange={e => setFormData({...formData, min_points: e.target.value === '' ? '' : Number(e.target.value)})} 
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#ccff00] transition" 
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-bold mb-1.5 block tracking-wider">Max Points</label>
                  <input 
                    required 
                    type="number" 
                    value={formData.max_points} 
                    onChange={e => setFormData({...formData, max_points: e.target.value === '' ? '' : Number(e.target.value)})} 
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#ccff00] transition" 
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-bold mb-1.5 block tracking-wider">Badge Image</label>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" id="badge-upload" />
                <label htmlFor="badge-upload" className="mt-1 flex flex-col items-center justify-center w-full h-32 sm:h-36 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:bg-white/5 transition overflow-hidden relative group">
                  {displayImage ? (
                    <>
                      <img src={displayImage} className="h-full w-full object-contain p-2" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                        <span className="text-xs font-bold text-white bg-black/50 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-sm">Change Image</span>
                      </div>
                      {pendingFile && (
                        <div className="absolute top-2 left-2 z-20 text-[9px] font-bold bg-[#ccff00] text-black px-2 py-0.5 rounded shadow">
                          Not saved yet
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-gray-500 font-semibold">Click to upload image</span>
                  )}
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-4 border-t border-white/10 bg-[#0f1014] flex gap-3 shrink-0">
              <button type="button" onClick={handleCloseModal} className="flex-1 bg-white/5 hover:bg-white/10 py-2.5 rounded-xl text-white font-bold text-sm transition">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 bg-[#ccff00] hover:bg-white py-2.5 rounded-xl text-black font-bold text-sm disabled:opacity-50 transition shadow-[0_0_15px_rgba(204,255,0,0.2)]">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* Toast */}
      {toast && createPortal(
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl font-bold text-sm shadow-2xl border flex items-center gap-2 bg-[#0f1014] z-[10000] animate-in slide-in-from-bottom-4 ${
          toast.type === 'success' ? 'border-green-500/30 text-green-400' : 'border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircleIcon weight="fill" size={20} /> : <WarningCircleIcon weight="fill" size={20} />}
          {toast.msg}
        </div>,
        document.body
      )}
    </div>
  )
}