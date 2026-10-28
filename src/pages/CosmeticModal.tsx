// src/pages/CosmeticModal.tsx
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom' // ✅ ADDED PORTAL
import { supabase } from '../lib/supabase'
import {
  XIcon, ImageIcon, CoinsIcon, SparkleIcon,
  UploadSimpleIcon, WarningCircleIcon, CheckCircleIcon
} from '@phosphor-icons/react'

interface CosmeticModalProps {
  isOpen: boolean
  onClose: () => void
  editingItem: any
  onSaveSuccess: () => void
}

export default function CosmeticModal({ isOpen, onClose, editingItem, onSaveSuccess }: CosmeticModalProps) {
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    cosmetic_type: 'background',
    price: 100,
    rarity: 'common',
    preview_url: '',
    status: 'published'
  })

  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    if (isOpen) {
      if (editingItem) {
        setFormData({
          name: editingItem.name || '',
          description: editingItem.description || '',
          cosmetic_type: editingItem.cosmetic_type || 'background',
          price: editingItem.price ? Number(editingItem.price) : 100,
          rarity: editingItem.rarity || 'common',
          preview_url: editingItem.preview_url || '',
          status: editingItem.status || 'published'
        })
      } else {
        setFormData({
          name: '', description: '', cosmetic_type: 'background',
          price: 100, rarity: 'common', preview_url: '', status: 'published'
        })
      }
      setUploadError(false)
      setToast(null)
    }
  }, [isOpen, editingItem])

  if (!isOpen) return null

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0]
      if (!file) return

      setUploading(true)
      setUploadError(false)
      
      const fileExt = file.name.split('.').pop() || 'png'
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('cosmetics')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('cosmetics')
        .getPublicUrl(filePath)

      if (!data?.publicUrl) throw new Error("Could not get public URL")

      setFormData(prev => ({ ...prev, preview_url: data.publicUrl }))
      setToast({ type: 'success', msg: 'Image uploaded successfully!' })
      
    } catch (err: any) {
      console.error("Upload error details:", err)
      setToast({ type: 'error', msg: 'Upload failed. Check storage policies.' })
      setUploadError(true)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        cosmetic_type: formData.cosmetic_type,
        price: formData.price,
        rarity: formData.rarity,
        preview_url: formData.preview_url,
        status: formData.status
      }

      if (editingItem) {
        const { error } = await supabase.from('cosmetic_items').update(payload).eq('id', editingItem.id)
        if (error) throw error
        setToast({ type: 'success', msg: 'Item updated successfully!' })
      } else {
        const { error } = await supabase.from('cosmetic_items').insert([payload])
        if (error) throw error
        setToast({ type: 'success', msg: 'Item created successfully!' })
      }
      setTimeout(() => {
        onSaveSuccess()
        onClose()
      }, 1000)
    } catch (err: any) {
      console.error("Save error:", err)
      setToast({ type: 'error', msg: err.message })
    } finally {
      setSaving(false)
    }
  }

  // ✅ RENDER MODAL WITH PORTAL
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-8">
      
      <div className="bg-[#0f1014] border border-white/10 rounded-3xl sm:rounded-[2rem] w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* HEADER */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/10 bg-[#0f1014] z-10 shrink-0">
          <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 sm:gap-3 text-white">
            <SparkleIcon className="text-[#ff00a0]" size={24} /> 
            {editingItem ? 'Edit Cosmetic Item' : 'Create New Cosmetic'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition bg-white/5 p-2 rounded-full">
            <XIcon weight="bold" size={20} />
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="p-4 sm:p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1">
          <form id="cosmetic-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            
            {/* LEFT COLUMN: Inputs */}
            <div className="space-y-4 sm:space-y-5">
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Item Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 focus:border-[#ff00a0] outline-none transition text-white" placeholder="e.g. Neon Cyber Background" />
              </div>

              <div>
                <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Description</label>
                <textarea required rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 focus:border-[#ff00a0] outline-none transition resize-none text-white" placeholder="Describe the item..." />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Type</label>
                  <select value={formData.cosmetic_type} onChange={e => setFormData({...formData, cosmetic_type: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-3 sm:px-4 py-3.5 focus:border-[#ff00a0] outline-none transition text-white text-sm">
                    <option value="background">Background</option>
                    <option value="theme">Quiz Theme</option>
                    <option value="border">Avatar Border</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Rarity</label>
                  <select value={formData.rarity} onChange={e => setFormData({...formData, rarity: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-3 sm:px-4 py-3.5 focus:border-[#ff00a0] outline-none transition text-white text-sm">
                    <option value="common">Common</option>
                    <option value="rare">Rare</option>
                    <option value="epic">Epic</option>
                    <option value="legendary">Legendary</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Price (Coins)</label>
                  <div className="relative">
                    <CoinsIcon className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-[#ff00a0]" />
                    <input required type="number" min="0" value={isNaN(formData.price) ? '' : formData.price} onChange={e => { const val = parseInt(e.target.value); setFormData({...formData, price: isNaN(val) ? 0 : val}); }} className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 sm:pl-12 pr-3 sm:pr-4 py-3.5 focus:border-[#ff00a0] outline-none transition text-[#ff00a0] font-bold text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Status</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-3 sm:px-4 py-3.5 focus:border-[#ff00a0] outline-none transition text-white text-sm">
                    <option value="published">Published (Visible)</option>
                    <option value="draft">Draft (Hidden)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Image Upload */}
            <div className="flex flex-col h-full mt-2 md:mt-0">
              <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Item Image</label>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" id="image-upload" />
              
              <label 
                htmlFor="image-upload" 
                className={`cursor-pointer flex flex-col items-center justify-center w-full flex-1 min-h-[200px] sm:min-h-[250px] border-2 border-dashed rounded-2xl transition-all relative overflow-hidden ${
                  uploading ? 'border-gray-700 bg-gray-800/20 text-gray-500 cursor-not-allowed' 
                  : formData.preview_url && !uploadError ? 'border-[#ff00a0]/30 bg-[#ff00a0]/5' 
                  : uploadError ? 'border-red-500/50 bg-red-500/5' 
                  : 'border-white/20 bg-black/30 hover:bg-white/5 hover:border-[#ff00a0]/50'
                }`}
              >
                {formData.preview_url && !uploadError ? (
                  <>
                    <img src={formData.preview_url} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                      <p className="text-white font-bold text-sm bg-black/60 px-4 py-2 rounded-xl backdrop-blur-md border border-white/20">Click to change image</p>
                    </div>
                  </>
                ) : (
                  <div className={`flex flex-col items-center ${uploadError ? 'text-red-400' : 'text-gray-400'} p-4 text-center`}>
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-3 ${uploadError ? 'bg-red-500/20' : 'bg-black/50'}`}>
                      {uploading ? <UploadSimpleIcon size={28} className="animate-bounce text-[#ff00a0]" /> : uploadError ? <WarningCircleIcon size={28} /> : <ImageIcon size={28} />}
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-white mb-1">{uploading ? 'Uploading...' : uploadError ? 'Upload Failed - Try Again' : 'Click to upload image'}</p>
                    <p className="text-[9px] sm:text-[10px] text-gray-500">PNG, JPG, or WEBP up to 5MB</p>
                  </div>
                )}
              </label>
            </div>
          </form>
        </div>

        {/* STICKY FOOTER */}
        <div className="p-4 sm:p-6 border-t border-white/10 bg-[#0f1014] flex justify-end gap-2 sm:gap-3 shrink-0 z-10">
          <button type="button" onClick={onClose} className="px-4 sm:px-6 py-2.5 sm:py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition text-gray-300 text-sm">Cancel</button>
          <button type="submit" form="cosmetic-form" disabled={saving || uploading} className="px-6 sm:px-8 py-2.5 sm:py-3 bg-[#ccff00] text-black hover:bg-white rounded-xl font-bold transition disabled:opacity-50 shadow-[0_0_15px_rgba(204,255,0,0.2)] text-sm">
            {saving ? 'Saving...' : 'Save Cosmetic'}
          </button>
        </div>
      </div>
      
      {/* Toast */}
      {toast && (
        <div className={`absolute top-8 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl font-bold text-sm shadow-2xl border flex items-center gap-2 bg-[#0f1014] z-[10000] ${
          toast.type === 'success' ? 'border-green-500/30 text-green-400' : 'border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircleIcon weight="fill" size={20} /> : <WarningCircleIcon weight="fill" size={20} />}
          {toast.msg}
        </div>
      )}
    </div>,
    document.body // ✅ Renders directly into the body, fixing all squishing and overlap
  )
}