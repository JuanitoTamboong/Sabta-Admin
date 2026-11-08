// src/pages/CosmeticModal.tsx
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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

// ─────────────────────────────────────────────────────────────
// Type tables
// ─────────────────────────────────────────────────────────────
const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/svg+xml', 'image/avif', 'image/bmp', 'image/tiff',
]
const ACCEPTED_VIDEO_TYPES = [
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska',
]
const ACCEPTED_AUDIO_TYPES = [
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/mp4',
]
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES, ...ACCEPTED_AUDIO_TYPES]

// ─────────────────────────────────────────────────────────────
// Compression targets (Only for images now)
// ─────────────────────────────────────────────────────────────
const IMAGE_TARGET_BYTES = 1.5 * 1024 * 1024
const IMAGE_MAX_DIMENSION = 1920
const IMAGE_MIN_QUALITY = 0.55
const IMAGE_START_QUALITY = 0.9

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const isImage = (t: string) => ACCEPTED_IMAGE_TYPES.includes(t)
const isVideo = (t: string) => ACCEPTED_VIDEO_TYPES.includes(t)
const isAudio = (t: string) => ACCEPTED_AUDIO_TYPES.includes(t)
const isSvg = (t: string) => t === 'image/svg+xml'
const isGif = (t: string) => t === 'image/gif'

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}

async function compressImage(file: File): Promise<File> {
  if (isSvg(file.type) || isGif(file.type)) return file

  const img = await loadImage(file)
  const { width, height } = img
  const longest = Math.max(width, height)
  const scale = longest > IMAGE_MAX_DIMENSION ? IMAGE_MAX_DIMENSION / longest : 1
  const targetW = Math.round(width * scale)
  const targetH = Math.round(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, targetW, targetH)

  const supportsWebp = canvas.toDataURL('image/webp').startsWith('data:image/webp')
  const outType = supportsWebp ? 'image/webp' : 'image/jpeg'
  const outExt = supportsWebp ? 'webp' : 'jpg'

  let quality = IMAGE_START_QUALITY
  let blob: Blob | null = null
  while (quality >= IMAGE_MIN_QUALITY) {
    blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), outType, quality))
    if (blob && blob.size <= IMAGE_TARGET_BYTES) break
    quality -= 0.1
  }
  if (!blob) return file
  if (blob.size >= file.size) return file

  const baseName = file.name.replace(/\.[^.]+$/, '')
  return new File([blob], `${baseName}.${outExt}`, { type: outType })
}

// ✅ The new simple dispatcher
async function processFile(
  file: File,
  onProgress?: (pct: number, stage: string) => void
): Promise<File> {
  
  // 1. SVGs & GIFs: Instant bypass (No compression needed)
  if (isSvg(file.type) || isGif(file.type)) {
    onProgress?.(100, 'Ready')
    return file
  }

  // 2. Images: Compress natively
  if (isImage(file.type)) {
    onProgress?.(20, 'Compressing image…')
    const out = await compressImage(file)
    onProgress?.(100, 'Done')
    return out
  }

  // 3. Videos & Audio: Instant bypass (Since ffmpeg was causing the freeze)
  if (isVideo(file.type) || isAudio(file.type)) {
    onProgress?.(50, 'Checking file...')
    
    // Safety cap to prevent huge uploads
    if (file.size > 15 * 1024 * 1024) {
      throw new Error("Video/Audio is too large (max 15MB). Please compress it manually.")
    }

    // Fake a quick delay for UI smoothness
    await new Promise(r => setTimeout(r, 600))
    onProgress?.(100, 'Done')
    return file
  }

  return file
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export default function CosmeticModal({ isOpen, onClose, editingItem, onSaveSuccess }: CosmeticModalProps) {
  const [saving, setSaving] = useState(false)
  const [uploadError, setUploadError] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [originalUrl, setOriginalUrl] = useState<string>('')

  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingKind, setPendingKind] = useState<'image' | 'video' | 'audio' | null>(null)
  const [localPreview, setLocalPreview] = useState<string>('')

  const [compressing, setCompressing] = useState(false)
  const [compressProgress, setCompressProgress] = useState(0)
  const [compressStage, setCompressStage] = useState('')
  const [originalSize, setOriginalSize] = useState<number>(0)
  const [compressedSize, setCompressedSize] = useState<number>(0)

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    cosmetic_type: string;
    price: number | string;
    rarity: string;
    preview_url: string;
    status: string;
  }>({
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
    return () => { if (localPreview) URL.revokeObjectURL(localPreview) }
  }, [localPreview])

  useEffect(() => {
    if (isOpen) {
      if (localPreview) URL.revokeObjectURL(localPreview)
      setLocalPreview('')
      setPendingFile(null)
      setPendingKind(null)
      setUploadError(false)
      setToast(null)
      setCompressing(false)
      setCompressProgress(0)
      setCompressStage('')
      setOriginalSize(0)
      setCompressedSize(0)

      if (editingItem) {
        setFormData({
          name: editingItem.name || '',
          description: editingItem.description || '',
          cosmetic_type: editingItem.cosmetic_type || 'background',
          price: editingItem.price !== undefined && editingItem.price !== null ? Number(editingItem.price) : 100,
          rarity: editingItem.rarity || 'common',
          preview_url: editingItem.preview_url || '',
          status: editingItem.status || 'published'
        })
        setOriginalUrl(editingItem.preview_url || '')
      } else {
        setFormData({
          name: '', description: '', cosmetic_type: 'background',
          price: 100, rarity: 'common', preview_url: '', status: 'published'
        })
        setOriginalUrl('')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingItem])

  const handleClose = () => {
    if (localPreview) URL.revokeObjectURL(localPreview)
    setLocalPreview('')
    setPendingFile(null)
    setPendingKind(null)
    setCompressing(false)
    onClose()
  }

  if (!isOpen) return null

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setToast({
        type: 'error',
        msg: 'Unsupported file type. Allowed: JPG, PNG, GIF, WebP, SVG, AVIF, MP4, WebM, OGG, MOV, MP3, WAV.'
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Hard caps for raw files
    const hardCap = isVideo(file.type) ? 50 * 1024 * 1024
      : isAudio(file.type) ? 50 * 1024 * 1024
      : 50 * 1024 * 1024
    if (file.size > hardCap) {
      setToast({ type: 'error', msg: `File too large to process (max ${formatBytes(hardCap)}).` })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (localPreview) URL.revokeObjectURL(localPreview)
    setLocalPreview('')
    setPendingFile(null)
    setPendingKind(null)
    setUploadError(false)
    setToast(null)
    setOriginalSize(file.size)
    setCompressedSize(0)
    setCompressing(true)
    setCompressProgress(0)
    setCompressStage('Preparing…')

    try {
      const processed = await processFile(file, (pct, stage) => {
        setCompressProgress(pct)
        setCompressStage(stage)
      })

      const kind: 'image' | 'video' | 'audio' =
        isVideo(processed.type) ? 'video'
        : isAudio(processed.type) ? 'audio'
        : 'image'

      const objectUrl = URL.createObjectURL(processed)
      setPendingFile(processed)
      setPendingKind(kind)
      setLocalPreview(objectUrl)
      setCompressedSize(processed.size)

      const saved = file.size - processed.size
      if (saved > 0 && processed.size < file.size) {
        setToast({
          type: 'success',
          msg: `Compressed: ${formatBytes(file.size)} → ${formatBytes(processed.size)} (saved ${formatBytes(saved)})`
        })
      } else if (processed.size >= file.size) {
        setToast({ type: 'success', msg: `File ready (${formatBytes(processed.size)})` })
      }
    } catch (err: any) {
      console.error('Processing error:', err)
      setToast({ type: 'error', msg: `File error: ${err.message}` })
      setUploadError(true)
    } finally {
      setCompressing(false)
      setCompressProgress(0)
      setCompressStage('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (compressing) return
    setSaving(true)

    let uploadedPath: string | null = null

    try {
      let finalPreviewUrl = formData.preview_url

      if (pendingFile) {
        const fileExt = pendingFile.name.split('.').pop()?.toLowerCase() || 'png'
        const fileName = `${crypto.randomUUID()}.${fileExt}`
        uploadedPath = fileName

        const { error: upErr } = await supabase.storage
          .from('cosmetics')
          .upload(fileName, pendingFile, { upsert: false, contentType: pendingFile.type })

        if (upErr) throw upErr

        const { data } = supabase.storage.from('cosmetics').getPublicUrl(fileName)
        if (!data?.publicUrl) throw new Error('Could not get public URL')
        finalPreviewUrl = data.publicUrl
      }

      const numericPrice = typeof formData.price === 'string' ? parseInt(formData.price) : formData.price
      const finalPrice = isNaN(numericPrice) ? 0 : numericPrice

      const payload = {
        name: formData.name,
        description: formData.description,
        cosmetic_type: formData.cosmetic_type,
        price: finalPrice,
        rarity: formData.rarity,
        preview_url: finalPreviewUrl,
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

      if (editingItem && pendingFile && originalUrl && originalUrl.includes('/cosmetics/')) {
        const oldFilePath = originalUrl.split('/cosmetics/')[1]
        if (oldFilePath) {
          await supabase.storage.from('cosmetics').remove([oldFilePath])
        }
      }

      if (localPreview) URL.revokeObjectURL(localPreview)
      setLocalPreview('')
      setPendingFile(null)
      setPendingKind(null)

      setTimeout(() => {
        onSaveSuccess()
        onClose()
      }, 1000)
    } catch (err: any) {
      console.error('Save error:', err)
      setToast({ type: 'error', msg: err.message })

      if (uploadedPath) {
        try {
          await supabase.storage.from('cosmetics').remove([uploadedPath])
        } catch (cleanupErr) {
          console.error('Orphan cleanup failed:', cleanupErr)
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const getRecommendedSize = () => {
    switch (formData.cosmetic_type) {
      case 'background': return '1920x1080 · PNG/JPG/SVG/MP4/WebM'
      case 'avatar_border': return '1000x1000 transparent · PNG/SVG/GIF'
      case 'quiz_theme': return '1920x1080 · PNG/JPG/SVG/MP4'
      default: return 'Any'
    }
  }

  const getPreviewClass = () => {
    switch (formData.cosmetic_type) {
      case 'avatar_border': return 'object-contain p-4'
      case 'background':
      case 'quiz_theme': return 'object-cover'
      default: return 'object-cover'
    }
  }

  const previewSrc = localPreview || formData.preview_url

  const previewKind: 'image' | 'video' | 'audio' | null = (() => {
    if (pendingKind) return pendingKind
    if (!previewSrc) return null
    const lower = previewSrc.split('?')[0].toLowerCase()
    if (/\.(mp4|webm|ogv|mov|mkv)$/.test(lower)) return 'video'
    if (/\.(mp3|wav|ogg|m4a)$/.test(lower)) return 'audio'
    if (/\.(jpg|jpeg|png|gif|webp|svg|avif|bmp|tiff)$/.test(lower)) return 'image'
    return 'image'
  })()

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-8">

      <div className="bg-[#0f1014] border border-white/10 rounded-2xl sm:rounded-[2rem] w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden relative">

        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 bg-[#0f1014] z-10 shrink-0">
          <h2 className="text-base sm:text-xl font-bold flex items-center gap-2 sm:gap-3 text-white">
            <SparkleIcon className="text-[#ff00a0] sm:w-6 sm:h-6" size={20} />
            {editingItem ? 'Edit Cosmetic' : 'Create Cosmetic'}
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-white transition bg-white/5 p-1.5 sm:p-2 rounded-full">
            <XIcon weight="bold" size={18} className="sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 md:p-8 overflow-y-auto admin-custom-scrollbar flex-1">
          <form id="cosmetic-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">

            <div className="space-y-4 sm:space-y-5">
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 sm:mb-2 block">Item Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3.5 focus:border-[#ff00a0] outline-none transition text-white text-sm" placeholder="e.g. Neon Cyber Background" />
              </div>

              <div>
                <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 sm:mb-2 block">Description</label>
                <textarea required rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3.5 focus:border-[#ff00a0] outline-none transition resize-none text-white text-sm" placeholder="Describe the item..." />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 sm:mb-2 block">Type</label>
                  <select value={formData.cosmetic_type} onChange={e => setFormData({...formData, cosmetic_type: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg sm:rounded-xl px-2 sm:px-4 py-2.5 sm:py-3.5 focus:border-[#ff00a0] outline-none transition text-white text-xs sm:text-sm">
                    <option value="background">Background</option>
                    <option value="quiz_theme">Quiz Theme</option>
                    <option value="avatar_border">Avatar Border</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 sm:mb-2 block">Rarity</label>
                  <select value={formData.rarity} onChange={e => setFormData({...formData, rarity: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg sm:rounded-xl px-2 sm:px-4 py-2.5 sm:py-3.5 focus:border-[#ff00a0] outline-none transition text-white text-xs sm:text-sm">
                    <option value="common">Common</option>
                    <option value="rare">Rare</option>
                    <option value="epic">Epic</option>
                    <option value="legendary">Legendary</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 sm:mb-2 block">Price (Coins)</label>
                  <div className="relative">
                    <CoinsIcon className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 text-[#ff00a0] w-4 h-4 sm:w-5 sm:h-5" />
                    <input required type="text" inputMode="numeric" pattern="[0-9]*" value={formData.price} onChange={e => { const numericValue = e.target.value.replace(/[^0-9]/g, ''); setFormData({...formData, price: numericValue}); }} className="w-full bg-black/50 border border-white/10 rounded-lg sm:rounded-xl pl-8 sm:pl-12 pr-2 sm:pr-4 py-2.5 sm:py-3.5 focus:border-[#ff00a0] outline-none transition text-[#ff00a0] font-bold text-xs sm:text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 sm:mb-2 block">Status</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg sm:rounded-xl px-2 sm:px-4 py-2.5 sm:py-3.5 focus:border-[#ff00a0] outline-none transition text-white text-xs sm:text-sm">
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col h-full mt-2 md:mt-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1.5 sm:mb-2 gap-1">
                <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider block">Item Media</label>
                <span className="text-[9px] sm:text-[10px] text-[#ccff00] font-semibold bg-[#ccff00]/10 px-2 py-0.5 rounded border border-[#ccff00]/20">
                  {getRecommendedSize()}
                </span>
              </div>

              <input
                type="file"
                accept={[
                  ...ACCEPTED_IMAGE_TYPES,
                  ...ACCEPTED_VIDEO_TYPES,
                  ...ACCEPTED_AUDIO_TYPES,
                  '.svg', '.mp4', '.webm', '.mov', '.mkv', '.mp3', '.wav', '.ogg',
                ].join(',')}
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
                disabled={compressing || saving}
              />

              <label
                htmlFor="image-upload"
                className={`cursor-pointer flex flex-col items-center justify-center w-full flex-1 min-h-[160px] sm:min-h-[250px] border-2 border-dashed rounded-xl sm:rounded-2xl transition-all relative overflow-hidden ${
                  (saving || compressing) ? 'border-gray-700 bg-gray-800/20 text-gray-500 cursor-not-allowed'
                  : previewSrc && !uploadError ? 'border-[#ff00a0]/30 bg-[#ff00a0]/5'
                  : uploadError ? 'border-red-500/50 bg-red-500/5'
                  : 'border-white/20 bg-black/30 hover:bg-white/5 hover:border-[#ff00a0]/50'
                }`}
              >
                {compressing ? (
                  <div className="flex flex-col items-center justify-center w-full p-6 text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#ff00a0]/20 flex items-center justify-center mb-3">
                      <SparkleIcon size={28} className="text-[#ff00a0] animate-pulse" />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-white mb-2">{compressStage || 'Preparing…'}</p>
                    <div className="w-full max-w-[200px] h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#ff00a0] transition-all duration-200"
                        style={{ width: `${compressProgress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">{compressProgress}%</p>
                  </div>
                ) : previewSrc && !uploadError ? (
                  <>
                    {previewKind === 'video' ? (
                      <video src={previewSrc} className={`absolute inset-0 w-full h-full ${getPreviewClass()}`} autoPlay loop muted playsInline />
                    ) : previewKind === 'audio' ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 p-4">
                        <ImageIcon size={32} className="text-[#ff00a0] mb-3" />
                        <audio src={previewSrc} controls className="w-full max-w-xs" />
                      </div>
                    ) : (
                      <img src={previewSrc} alt="Preview" className={`absolute inset-0 w-full h-full ${getPreviewClass()}`} />
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity z-10">
                      <p className="text-white font-bold text-xs sm:text-sm bg-black/60 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl backdrop-blur-md border border-white/20">Change Media</p>
                    </div>
                    {pendingFile && (
                      <div className="absolute top-2 left-2 z-20 text-[9px] sm:text-[10px] font-bold bg-[#ccff00] text-black px-2 py-0.5 rounded">
                        Not saved yet
                      </div>
                    )}
                    {previewKind && (
                      <div className="absolute top-2 right-2 z-20 text-[9px] sm:text-[10px] font-bold bg-black/70 text-white px-2 py-0.5 rounded uppercase tracking-wider border border-white/20">
                        {previewKind}
                      </div>
                    )}
                    {compressedSize > 0 && (
                      <div className="absolute bottom-2 left-2 right-2 z-20 text-[9px] sm:text-[10px] font-bold bg-black/70 text-white px-2 py-1 rounded flex items-center justify-between gap-2">
                        <span className="text-[#ccff00]">{formatBytes(compressedSize)}</span>
                        {originalSize > compressedSize && (
                          <span className="text-gray-400 line-through">{formatBytes(originalSize)}</span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className={`flex flex-col items-center ${uploadError ? 'text-red-400' : 'text-gray-400'} p-4 text-center`}>
                    <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-2 sm:mb-3 ${uploadError ? 'bg-red-500/20' : 'bg-black/50'}`}>
                      {saving ? <UploadSimpleIcon size={20} className="animate-bounce text-[#ff00a0] sm:w-7 sm:h-7" /> : uploadError ? <WarningCircleIcon size={20} className="sm:w-7 sm:h-7" /> : <ImageIcon size={20} className="sm:w-7 sm:h-7" />}
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-white mb-0.5 sm:mb-1">{saving ? 'Uploading...' : uploadError ? 'Upload Failed' : 'Click to upload'}</p>
                    <p className="text-[9px] sm:text-[10px] text-gray-500">PNG, JPG, GIF, WEBP, SVG, MP4, WebM · auto-compressed before upload</p>
                  </div>
                )}
              </label>
            </div>
          </form>
        </div>

        <div className="p-3 sm:p-6 border-t border-white/10 bg-[#0f1014] flex justify-end gap-2 sm:gap-3 shrink-0 z-10">
          <button type="button" onClick={handleClose} className="px-4 sm:px-6 py-2 sm:py-3 bg-white/5 hover:bg-white/10 rounded-lg sm:rounded-xl font-bold transition text-gray-300 text-xs sm:text-sm">Cancel</button>
          <button type="submit" form="cosmetic-form" disabled={saving || compressing} className="px-5 sm:px-8 py-2 sm:py-3 bg-[#ccff00] text-black hover:bg-white rounded-lg sm:rounded-xl font-bold transition disabled:opacity-50 shadow-[0_0_15px_rgba(204,255,0,0.2)] text-xs sm:text-sm">
            {saving ? 'Saving…' : compressing ? 'Processing…' : 'Save Item'}
          </button>
        </div>
      </div>

      {toast && (
        <div className={`absolute top-8 left-1/2 -translate-x-1/2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm shadow-2xl border flex items-center gap-2 bg-[#0f1014] z-[10000] ${
          toast.type === 'success' ? 'border-green-500/30 text-green-400' : 'border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircleIcon weight="fill" size={18} className="sm:w-5 sm:h-5" /> : <WarningCircleIcon weight="fill" size={18} className="sm:w-5 sm:h-5" />}
          {toast.msg}
        </div>
      )}
    </div>,
    document.body
  )
}