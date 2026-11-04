import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BellRingingIcon, MegaphoneIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'

const APK_BUCKET = 'announcement-apks'

type Announcement = {
  id: string
  title: string
  message: string
  apk_url: string | null
  severity: 'info' | 'warning' | 'urgent'
  is_active: boolean
  published_at: string | null
  ends_at: string | null
  created_at: string
}

type AnnouncementForm = {
  title: string
  message: string
  severity: Announcement['severity']
  ends_at: string
}

const EMPTY_FORM: AnnouncementForm = {
  title: '',
  message: '',
  severity: 'info',
  ends_at: ''
}

function toLocalDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function getApkStoragePath(url: string) {
  const marker = `/storage/v1/object/public/${APK_BUCKET}/`
  const markerIndex = url.indexOf(marker)
  if (markerIndex < 0) return null

  try {
    return decodeURIComponent(url.slice(markerIndex + marker.length).split('?')[0])
  } catch {
    return null
  }
}

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [form, setForm] = useState<AnnouncementForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [selectedApk, setSelectedApk] = useState<File | null>(null)
  const [editingApkUrl, setEditingApkUrl] = useState<string | null>(null)
  const [removeExistingApk, setRemoveExistingApk] = useState(false)
  const apkInputRef = useRef<HTMLInputElement>(null)

  const handleApkSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setSelectedApk(null)
      return
    }

    if (!file.name.toLowerCase().endsWith('.apk')) {
      setSelectedApk(null)
      setErrorMessage('Please select a valid Android APK file.')
      event.target.value = ''
      return
    }

    setSelectedApk(file)
    setRemoveExistingApk(false)
    setErrorMessage('')
  }

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, message, apk_url, severity, is_active, published_at, ends_at, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(`Failed to load announcements: ${error.message}`)
    } else {
      setAnnouncements(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    void fetchAnnouncements()

    const channel = supabase
      .channel('admin-announcements')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => { void fetchAnnouncements() }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          void fetchAnnouncements()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setErrorMessage(`Announcement live updates are unavailable (${status}).`)
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setSelectedApk(null)
    setEditingApkUrl(null)
    setRemoveExistingApk(false)
    if (apkInputRef.current) apkInputRef.current.value = ''
  }

  const handleEdit = (announcement: Announcement) => {
    setForm({
      title: announcement.title,
      message: announcement.message,
      severity: announcement.severity,
      ends_at: toLocalDateTime(announcement.ends_at)
    })
    setEditingId(announcement.id)
    setEditingApkUrl(announcement.apk_url)
    setRemoveExistingApk(false)
    setSelectedApk(null)
    if (apkInputRef.current) apkInputRef.current.value = ''
    setErrorMessage('')
    setSuccessMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (form.ends_at && new Date(form.ends_at).getTime() <= Date.now()) {
      setErrorMessage('The hide-after date must be in the future.')
      return
    }

    setSaving(true)
    const payload = {
      title: form.title.trim(),
      message: form.message.trim(),
      severity: form.severity,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      apk_url: removeExistingApk ? null : editingApkUrl
    }

    let uploadedApkPath: string | null = null
    try {
      if (selectedApk) {
        const safeFileName = selectedApk.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const filePath = `${crypto.randomUUID()}-${safeFileName}`
        const { error: uploadError } = await supabase.storage
          .from(APK_BUCKET)
          .upload(filePath, selectedApk, {
            contentType: 'application/vnd.android.package-archive',
            upsert: false
          })
        if (uploadError) throw uploadError

        uploadedApkPath = filePath
        payload.apk_url = supabase.storage
          .from(APK_BUCKET)
          .getPublicUrl(filePath, { download: safeFileName })
          .data.publicUrl
      }

      if (editingId) {
        const { error } = await supabase.from('announcements').update(payload).eq('id', editingId)
        if (error) throw error
        setSuccessMessage('Announcement updated.')
      } else {
        const { error } = await supabase.from('announcements').insert({ ...payload, is_active: true })
        if (error) throw error
        setSuccessMessage('Announcement published to players.')
      }

      const previousApkUrl = editingApkUrl
      const shouldRemovePreviousApk = previousApkUrl && (selectedApk || removeExistingApk)
      resetForm()
      await fetchAnnouncements()

      if (shouldRemovePreviousApk) {
        const oldApkPath = getApkStoragePath(previousApkUrl)
        if (oldApkPath) {
          const { error: cleanupError } = await supabase.storage.from(APK_BUCKET).remove([oldApkPath])
          if (cleanupError) {
            setErrorMessage(`Announcement saved, but the previous APK could not be removed: ${cleanupError.message}`)
          }
        }
      }
    } catch (error) {
      let message = `Failed to save announcement: ${error instanceof Error ? error.message : String(error)}`
      if (uploadedApkPath) {
        const { error: cleanupError } = await supabase.storage.from(APK_BUCKET).remove([uploadedApkPath])
        if (cleanupError) message += ` The uploaded APK could not be cleaned up: ${cleanupError.message}`
      }
      setErrorMessage(message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (announcement: Announcement) => {
    setErrorMessage('')
    const { error } = await supabase
      .from('announcements')
      .update({ is_active: !announcement.is_active })
      .eq('id', announcement.id)

    if (error) {
      setErrorMessage(`Failed to update announcement: ${error.message}`)
      return
    }
    await fetchAnnouncements()
  }

  const handleDelete = async (announcement: Announcement) => {
    if (!confirm(`Permanently delete "${announcement.title}"?`)) return

    setErrorMessage('')
    const { error } = await supabase.from('announcements').delete().eq('id', announcement.id)
    if (error) {
      setErrorMessage(`Failed to delete announcement: ${error.message}`)
      return
    }
    if (announcement.apk_url) {
      const apkPath = getApkStoragePath(announcement.apk_url)
      if (apkPath) {
        const { error: storageError } = await supabase.storage.from(APK_BUCKET).remove([apkPath])
        if (storageError) {
          setErrorMessage(`Announcement deleted, but its APK could not be removed: ${storageError.message}`)
        }
      }
    }
    if (editingId === announcement.id) resetForm()
    await fetchAnnouncements()
  }

  const isAnnouncementActive = (announcement: Announcement) =>
    announcement.is_active && (!announcement.ends_at || new Date(announcement.ends_at) > new Date())

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Player Announcements</h2>
        <p className="text-xs text-gray-400 mt-1">Publish important updates for players to see in the game.</p>
      </div>

      {(errorMessage || successMessage) && (
        <div className={`rounded-xl border p-3 text-sm ${
          errorMessage
            ? 'border-red-500/30 bg-red-500/10 text-red-300'
            : 'border-green-500/30 bg-green-500/10 text-green-300'
        }`} role="status">
          {errorMessage || successMessage}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-[#0f1014] border border-white/10 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          {editingId
            ? <PencilSimpleIcon className="text-[#00f0ff]" size={20} />
            : <PlusIcon className="text-[#ccff00]" size={20} />}
          <h3 className="font-bold text-white">{editingId ? 'Edit announcement' : 'Create announcement'}</h3>
        </div>

        <div>
          <label htmlFor="announcement-title" className="block text-xs text-gray-400 font-bold mb-2">Title</label>
          <input
            id="announcement-title"
            required
            maxLength={120}
            value={form.title}
            onChange={event => setForm({ ...form, title: event.target.value })}
            placeholder="Important update"
            className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-[#00f0ff]"
          />
        </div>

        <div>
          <label htmlFor="announcement-message" className="block text-xs text-gray-400 font-bold mb-2">Message</label>
          <textarea
            id="announcement-message"
            required
            maxLength={2000}
            rows={4}
            value={form.message}
            onChange={event => setForm({ ...form, message: event.target.value })}
            placeholder="Write the message players should see..."
            className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-[#00f0ff] resize-y"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="announcement-severity" className="block text-xs text-gray-400 font-bold mb-2">Type</label>
            <select
              id="announcement-severity"
              value={form.severity}
              onChange={event => setForm({ ...form, severity: event.target.value as Announcement['severity'] })}
              className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-[#00f0ff]"
            >
              <option value="info">Information</option>
              <option value="warning">Warning</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label htmlFor="announcement-end" className="block text-xs text-gray-400 font-bold mb-2">Hide after (optional)</label>
            <input
              id="announcement-end"
              type="datetime-local"
              value={form.ends_at}
              onChange={event => setForm({ ...form, ends_at: event.target.value })}
              className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-[#00f0ff]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="announcement-apk" className="block text-xs text-gray-400 font-bold mb-2">Android APK (optional)</label>
          <input
            id="announcement-apk"
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            ref={apkInputRef}
            onChange={handleApkSelection}
            className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-[#00f0ff] file:mr-3 file:rounded-lg file:border-0 file:bg-[#ccff00] file:px-3 file:py-2 file:text-xs file:font-bold file:text-black"
          />
          <p className="mt-2 text-[11px] text-gray-500">Accepted file type: .apk</p>
          {selectedApk && <p className="mt-2 text-xs text-[#00f0ff]">Selected APK: {selectedApk.name}</p>}
          {editingApkUrl && !removeExistingApk && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <a href={editingApkUrl} className="font-bold text-[#00f0ff] hover:underline">
                Download current APK
              </a>
              <button
                type="button"
                onClick={() => {
                  setRemoveExistingApk(true)
                  setSelectedApk(null)
                  if (apkInputRef.current) apkInputRef.current.value = ''
                }}
                className="text-red-400 hover:underline"
              >
                Remove APK
              </button>
            </div>
          )}
          {removeExistingApk && <p className="mt-2 text-xs text-yellow-400">The current APK will be removed when you save.</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-[#ccff00] text-black px-4 py-2.5 rounded-xl font-bold hover:bg-white transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : editingId ? 'Save changes' : 'Publish announcement'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-4 py-2.5 rounded-xl font-bold text-gray-300 bg-white/5 hover:bg-white/10">
              Cancel
            </button>
          )}
        </div>
      </form>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MegaphoneIcon className="text-[#00f0ff]" size={20} />
          <h3 className="font-bold text-white">Announcements</h3>
          <span className="text-xs text-gray-500">({announcements.length})</span>
        </div>

        {loading ? (
          <p className="py-10 text-center text-[#ccff00] font-mono text-sm animate-pulse">LOADING ANNOUNCEMENTS...</p>
        ) : announcements.length === 0 ? (
          <div className="bg-[#0f1014] border border-white/10 rounded-2xl py-12 text-center">
            <BellRingingIcon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No announcements yet.</p>
          </div>
        ) : announcements.map(announcement => {
          const active = isAnnouncementActive(announcement)
          return (
            <article key={announcement.id} className="bg-[#0f1014] border border-white/10 rounded-2xl p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h4 className="font-bold text-white">{announcement.title}</h4>
                    <span className={`text-[9px] uppercase tracking-wider px-2 py-1 rounded-md font-bold ${
                      active ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-gray-500'
                    }`}>{active ? 'Visible to players' : announcement.is_active ? 'Expired' : 'Hidden'}</span>
                    <span className={`text-[9px] uppercase tracking-wider px-2 py-1 rounded-md font-bold ${
                      announcement.severity === 'urgent' ? 'bg-red-500/10 text-red-400'
                        : announcement.severity === 'warning' ? 'bg-yellow-500/10 text-yellow-400'
                        : 'bg-[#00f0ff]/10 text-[#00f0ff]'
                    }`}>{announcement.severity}</span>
                  </div>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">{announcement.message}</p>
                  {announcement.apk_url && (
                    <a
                      href={announcement.apk_url}
                      className="mt-3 inline-flex rounded-lg bg-[#ccff00] px-4 py-2 text-xs font-bold text-black hover:bg-white transition"
                    >
                      Download Android app (APK)
                    </a>
                  )}
                  {announcement.published_at && (
                    <p className="text-[10px] text-gray-500 mt-3">
                      Published {new Date(announcement.published_at).toLocaleString()}
                    </p>
                  )}
                  {announcement.ends_at && (
                    <p className="text-[10px] text-gray-500 mt-3">
                      Hides {new Date(announcement.ends_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(announcement)}
                    className="px-3 py-2 rounded-lg text-xs font-bold bg-white/5 text-gray-300 hover:bg-white/10"
                  >
                    {announcement.is_active ? 'Hide' : 'Publish'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEdit(announcement)}
                    className="p-2 rounded-lg bg-[#00f0ff]/10 text-[#00f0ff] hover:bg-[#00f0ff]/20"
                    aria-label={`Edit ${announcement.title}`}
                  >
                    <PencilSimpleIcon size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(announcement)}
                    className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    aria-label={`Delete ${announcement.title}`}
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}
