// src/pages/AdminClanWars.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  FlagIcon, TrophyIcon, XIcon, CheckCircleIcon, WarningCircleIcon,
  PlusIcon, ArrowsClockwiseIcon,
  EyeIcon, SwordIcon, UsersIcon, TrashIcon, UploadSimpleIcon,
  PlayIcon
} from '@phosphor-icons/react'

type Toast = { type: 'success' | 'error'; msg: string } | null

type FighterRow = {
  war_id: string
  clan_id: string
  user_id: string
  display_name: string
  avatar_url: string | null
  points: number
}

type WarQuiz = {
  id: string
  title: string
  description: string | null
  difficulty: 'normal' | 'intermediate' | 'hard'
  time_limit_seconds: number
  status: 'draft' | 'published' | 'archived'
  created_at: string
  question_count?: number
}

const TEAM_SIZES = [2, 3, 4, 5] as const
type TeamSize = typeof TEAM_SIZES[number]

const TEAM_LABELS: Record<TeamSize, string> = {
  2: '2 vs 2 (Duel)',
  3: '3 vs 3 (Squad)',
  4: '4 vs 4 (Fireteam)',
  5: '5 vs 5 (Standard War)',
}

const teamLabel = (n: number | null | undefined) =>
  n && (TEAM_SIZES as readonly number[]).includes(n) ? TEAM_LABELS[n as TeamSize] : '—'

const renderModal = (open: boolean, onClose: () => void, children: React.ReactNode, wide = false) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        className={`w-full relative animate-in zoom-in-95 duration-200 ${wide ? 'max-w-2xl' : 'max-w-md'}`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

const CosmeticPreview = ({ item, type }: { item: any, type: 'border' | 'background' | 'theme' }) => {
  if (!item) return null
  return (
    <div className="mt-2 flex items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/10 animate-in fade-in slide-in-from-top-1">
      <div className={`w-12 h-12 rounded-lg bg-black/50 overflow-hidden flex items-center justify-center shrink-0 ${
        type === 'border' ? 'rounded-full ring-2 ring-[#ccff00]/50' : ''
      }`}>
        <img src={item.preview_url} alt={item.name} className="w-full h-full object-cover" />
      </div>
      <div>
        <p className="text-xs text-white font-bold">{item.name}</p>
        <p className="text-[10px] text-[#ccff00] uppercase tracking-wider">Selected Preview</p>
      </div>
    </div>
  )
}

const parseWarQuizText = (text: string) => {
  const cleanText = text.replace(/\\/g, '')
  const lines = cleanText.replace(/\r\n?/g, '\n').split('\n')
  
  const questions = []
  let currentQ: any = null
  let currentOptionIndex = -1
  let readingHint = false

  for (let i = 0; i < lines.length; i++) {
    const cleanLine = lines[i].trim()
    if (!cleanLine) continue

    const questionMatch = cleanLine.match(/^(?:Question|Q|Tanong)\s*(\d+)\s*[.:]?\s*(.*)$/i)
    const optionMatch = cleanLine.match(/^([A-D])(?:[.)]\s*(.*)|\s*)$/i)
    const hintMatch = cleanLine.match(/^(?:Hint|Clue)\s*:?\s*(.*)$/i)
    const answerMatch = cleanLine.match(/^(?:Answer|Sagot)\s*:\s*([A-D])/i)

    if (questionMatch) {
      if (currentQ) questions.push(currentQ)
      currentQ = {
        question_text: questionMatch[2] || '',
        options: ['', '', '', ''],
        correct_answer: '',
        hint: '',
        points: 10
      }
      currentOptionIndex = -1
      readingHint = false
    } else if (currentQ) {
      if (optionMatch) {
        currentOptionIndex = optionMatch[1].toUpperCase().charCodeAt(0) - 65
        if (optionMatch[2]) currentQ.options[currentOptionIndex] = optionMatch[2].trim()
        readingHint = false
      } else if (hintMatch) {
        currentQ.hint = hintMatch[1].trim()
        readingHint = true
        currentOptionIndex = -1
      } else if (answerMatch) {
        const idx = answerMatch[1].toUpperCase().charCodeAt(0) - 65
        currentQ.correct_answer = currentQ.options[idx] || answerMatch[1].toUpperCase()
        readingHint = false
      } else if (readingHint) {
        currentQ.hint += '\n' + cleanLine
      } else if (currentOptionIndex >= 0 && !currentQ.options[currentOptionIndex]) {
        currentQ.options[currentOptionIndex] = cleanLine
      } else if (!currentQ.question_text) {
        currentQ.question_text = cleanLine
      }
    }
  }
  if (currentQ) questions.push(currentQ)
  
  return questions.filter(q => q.question_text && q.options.some((o: string) => o))
}

export default function AdminClanWars() {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<Toast>(null)

  const [activeWars, setActiveWars] = useState<any[]>([])
  const [completedWars, setCompletedWars] = useState<any[]>([])
  const [warQuizzes, setWarQuizzes] = useState<WarQuiz[]>([])
  const [allCosmetics, setAllCosmetics] = useState<any[]>([])
  const [tab, setTab] = useState<'active' | 'quizzes' | 'history'>('active')

  const [fightersByWar, setFightersByWar] = useState<Record<string, FighterRow[]>>({})

  const [createOpen, setCreateOpen] = useState(false)
  const [duration, setDuration] = useState('7')
  
  const [startDelayHours, setStartDelayHours] = useState('0')
  const [startDelayMins, setStartDelayMins] = useState('3') 

  const [creating, setCreating] = useState(false)
  const [teamSize, setTeamSize] = useState<TeamSize>(5)

  const [prizeCoins, setPrizeCoins] = useState('500')
  const [prizePoints, setPrizePoints] = useState('150')
  const [prizeBorderId, setPrizeBorderId] = useState('')
  const [prizeBackgroundId, setPrizeBackgroundId] = useState('')
  const [prizeThemeId, setPrizeThemeId] = useState('')

  const [quizCreateOpen, setQuizCreateOpen] = useState(false)
  const [quizCreateMode, setQuizCreateMode] = useState<'manual' | 'paste'>('manual')
  const [newQuizTitle, setNewQuizTitle] = useState('')
  const [newQuizDescription, setNewQuizDescription] = useState('')
  const [newQuizDifficulty, setNewQuizDifficulty] = useState<'normal' | 'intermediate' | 'hard'>('normal')
  const [newQuizTimeLimit, setNewQuizTimeLimit] = useState('20')
  const [pastedQuizText, setPastedQuizText] = useState('')
  const [creatingQuiz, setCreatingQuiz] = useState(false)

  const [editingQuiz, setEditingQuiz] = useState<WarQuiz | null>(null)
  const [editQuizTitle, setEditQuizTitle] = useState('')
  const [editQuizDescription, setEditQuizDescription] = useState('')
  const [editQuizDifficulty, setEditQuizDifficulty] = useState<'normal' | 'intermediate' | 'hard'>('normal')
  const [editQuizTimeLimit, setEditQuizTimeLimit] = useState('20')
  const [updatingQuiz, setUpdatingQuiz] = useState(false)

  const [activeQuizForQuestions, setActiveQuizForQuestions] = useState<WarQuiz | null>(null)
  const [questionList, setQuestionList] = useState<any[]>([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [newQText, setNewQText] = useState('')
  const [newQOptions, setNewQOptions] = useState<string[]>(['', '', '', ''])
  const [newQCorrect, setNewQCorrect] = useState('')
  const [newQHint, setNewQHint] = useState('')
  const [newQExplanation, setNewQExplanation] = useState('')
  const [newQPoints, setNewQPoints] = useState('10')
  const [addingQuestion, setAddingQuestion] = useState(false)

  const [viewingWar, setViewingWar] = useState<any | null>(null)
  const [warAttacks, setWarAttacks] = useState<any[]>([])
  const [loadingAttacks, setLoadingAttacks] = useState(false)

  const notify = (type: 'success' | 'error', msg: string) => setToast({ type, msg })

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [wars, history, wq, cosmetics] = await Promise.all([
        supabase
          .from('clan_wars')
          .select(`
            *,
            clan_a:clan_a_id (id, name, tag, avatar_url),
            clan_b:clan_b_id (id, name, tag, avatar_url),
            daily_quiz:daily_quiz_id (id, title, difficulty)
          `)
          .eq('status', 'active')
          .order('ends_at', { ascending: true }),
        supabase
          .from('clan_wars')
          .select(`
            *,
            clan_a:clan_a_id (id, name, tag, avatar_url),
            clan_b:clan_b_id (id, name, tag, avatar_url)
          `)
          .eq('status', 'completed')
          .order('ends_at', { ascending: false })
          .limit(20),
        supabase
          .from('clan_war_quizzes')
          .select('*')
          .neq('status', 'archived')
          .order('created_at', { ascending: false }),
        supabase.from('cosmetic_items').select('*').eq('status', 'published')
      ])

      const activeWarList = wars.data ?? []
      setActiveWars(activeWarList)
      setCompletedWars(history.data ?? [])
      setWarQuizzes((wq.data ?? []) as WarQuiz[])
      setAllCosmetics(cosmetics.data ?? [])

      if (activeWarList.length > 0) {
        const fighterResults = await Promise.all(
          activeWarList.map(w => supabase.rpc('admin_get_war_fighters', { p_war_id: w.id }))
        )
        const map: Record<string, FighterRow[]> = {}
        activeWarList.forEach((w, i) => {
          map[w.id] = (fighterResults[i].data ?? []).map((f: any) => ({ ...f, war_id: w.id }))
        })
        setFightersByWar(map)
      } else {
        setFightersByWar({})
      }
    } catch (e: any) {
      notify('error', e.message ?? 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    const channel = supabase
      .channel('admin-clan-wars-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clan_wars' }, () => { fetchAll() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // ============ CREATE WAR ============
  const handleCreateWar = async () => {
    setCreating(true)
    
    const hours = parseInt(startDelayHours) || 0
    const mins = parseInt(startDelayMins) || 0
    const totalMinutes = hours * 60 + mins
    const safeDuration = parseInt(duration) || 7

    // Pass the delay directly to the RPC
    const { data: warData, error: warError } = await supabase.rpc('admin_create_clan_war', {
      p_duration_days: safeDuration,
      p_max_attacks: teamSize,
      p_team_size: teamSize,
      p_start_delay_minutes: totalMinutes
    })

    if (warError) {
      setCreating(false)
      return notify('error', warError.message)
    }

    const { error: prizeError } = await supabase.from('clan_war_prizes').insert({
      war_id: warData.war_id,
      coins_per_member: parseInt(prizeCoins) || 0,
      points_per_member: parseInt(prizePoints) || 0,
      border_id: prizeBorderId || null,
      background_id: prizeBackgroundId || null,
      theme_id: prizeThemeId || null
    })

    setCreating(false)

    if (prizeError) {
      return notify('error', 'War created, but prizes failed to save: ' + prizeError.message)
    }

    notify('success', `Open ${teamSize}v${teamSize} Arena created! Timer starts when both clans join.`)
    setCreateOpen(false)
    setDuration('7')
    setStartDelayHours('0')
    setStartDelayMins('3')
    setTeamSize(5)
    setPrizeCoins('500'); setPrizePoints('150')
    setPrizeBorderId(''); setPrizeBackgroundId(''); setPrizeThemeId('')
    fetchAll()
  }

  const handleCancelWar = async (warId: string) => {
    if (!confirm('Cancel this war? Players will be notified but no rewards granted.')) return
    const { error } = await supabase.rpc('admin_cancel_clan_war', { p_war_id: warId })
    if (error) return notify('error', error.message)
    notify('success', 'War cancelled')
    fetchAll()
  }

  const handleStartNow = async (warId: string) => {
    if (!confirm('Skip the countdown and start the war immediately?')) return
    const { error } = await supabase
      .from('clan_wars')
      .update({ starts_at: new Date(Date.now() - 60000).toISOString() })
      .eq('id', warId)
    
    if (error) return notify('error', error.message)
    notify('success', 'War started immediately')
    fetchAll()
  }

  const handleSetStrikes = async (warId: string, side: 'a' | 'b', newStrikes: number) => {
    const { error } = await supabase.rpc('admin_set_war_strikes', {
      p_war_id: warId,
      p_side: side,
      p_strikes: Math.max(0, Math.min(3, newStrikes)),
      p_disqualified: newStrikes >= 3
    })
    if (error) return notify('error', error.message)
    notify('success', 'Strikes updated')
    fetchAll()
  }

  // ============ WAR QUIZ ACTIONS ============
  const handleCreateWarQuiz = async () => {
    if (!newQuizTitle.trim()) return notify('error', 'Title is required')

    let parsedQuestions: any[] = []

    if (quizCreateMode === 'paste') {
      if (!pastedQuizText.trim()) return notify('error', 'Please paste the quiz text')
      parsedQuestions = parseWarQuizText(pastedQuizText)
      if (parsedQuestions.length === 0) {
        return notify('error', 'Could not find any valid questions in the pasted text. Check the format.')
      }
    }

    const safeTimeLimit = parseInt(newQuizTimeLimit) || 20

    setCreatingQuiz(true)
    const { data, error } = await supabase.rpc('admin_create_war_quiz', {
      p_title: newQuizTitle.trim(),
      p_description: newQuizDescription.trim() || null,
      p_difficulty: newQuizDifficulty,
      p_time_limit_seconds: safeTimeLimit
    })
    
    if (error) {
      setCreatingQuiz(false)
      return notify('error', error.message)
    }

    const newQuizId = data.quiz_id

    if (quizCreateMode === 'paste' && parsedQuestions.length > 0) {
      for (const q of parsedQuestions) {
        const cleanOptions = q.options.map((o: string) => o.replace(/\\/g, '').trim())
        
        await supabase.rpc('admin_add_war_question', {
          p_war_quiz_id: newQuizId,
          p_question_text: q.question_text.replace(/\\/g, '').trim(),
          p_options: cleanOptions,
          p_correct_answer: q.correct_answer.replace(/\\/g, '').trim(),
          p_hint: q.hint ? q.hint.replace(/\\/g, '').trim() : null,
          p_points: 10
        })
      }
      await supabase.rpc('admin_publish_war_quiz', { p_war_quiz_id: newQuizId })
      notify('success', `War quiz created & published with ${parsedQuestions.length} questions!`)
      setQuizCreateOpen(false)
      fetchAll()
    } else {
      notify('success', 'War quiz created (draft). Add questions next.')
      setQuizCreateOpen(false)
      const created = {
        id: newQuizId,
        title: newQuizTitle.trim(),
        description: newQuizDescription.trim() || null,
        difficulty: newQuizDifficulty,
        time_limit_seconds: safeTimeLimit,
        status: 'draft' as const,
        created_at: new Date().toISOString()
      }
      openQuestionEditor(created)
    }

    setCreatingQuiz(false)
    setNewQuizTitle('')
    setNewQuizDescription('')
    setNewQuizDifficulty('normal')
    setNewQuizTimeLimit('20')
    setPastedQuizText('')
    setQuizCreateMode('manual')
  }

  const handleUpdateWarQuiz = async () => {
    if (!editingQuiz) return
    if (!editQuizTitle.trim()) return notify('error', 'Title is required')

    const safeTimeLimit = parseInt(editQuizTimeLimit) || 20

    setUpdatingQuiz(true)
    const { error } = await supabase
      .from('clan_war_quizzes')
      .update({
        title: editQuizTitle.trim(),
        description: editQuizDescription.trim() || null,
        difficulty: editQuizDifficulty,
        time_limit_seconds: safeTimeLimit
      })
      .eq('id', editingQuiz.id)

    setUpdatingQuiz(false)
    if (error) return notify('error', error.message)
    
    notify('success', 'War quiz updated')
    setEditingQuiz(null)
    fetchAll()
  }

  const handleDeleteWarQuiz = async (quizId: string) => {
    if (!confirm('Are you sure you want to PERMANENTLY DELETE this quiz and all its questions? This cannot be undone.')) return
    await supabase.from('clan_wars').update({ daily_quiz_id: null }).eq('daily_quiz_id', quizId)
    const { error } = await supabase.from('clan_war_quizzes').delete().eq('id', quizId)
    if (error) return notify('error', error.message)
    notify('success', 'War quiz permanently deleted')
    fetchAll()
  }

  const handlePublishWarQuiz = async (quizId: string) => {
    const { error } = await supabase.rpc('admin_publish_war_quiz', { p_war_quiz_id: quizId })
    if (error) return notify('error', error.message)
    notify('success', 'War quiz published')
    fetchAll()
  }

  const handleArchiveWarQuiz = async (quizId: string) => {
    if (!confirm('Archive this war quiz? It will no longer be selected for new wars.')) return
    const { error } = await supabase.rpc('admin_archive_war_quiz', { p_war_quiz_id: quizId })
    if (error) return notify('error', error.message)
    notify('success', 'War quiz archived')
    fetchAll()
  }

  const openEditQuizModal = (quiz: WarQuiz) => {
    setEditingQuiz(quiz)
    setEditQuizTitle(quiz.title)
    setEditQuizDescription(quiz.description || '')
    setEditQuizDifficulty(quiz.difficulty)
    setEditQuizTimeLimit(String(quiz.time_limit_seconds))
  }

  const openQuestionEditor = async (quiz: WarQuiz) => {
    setActiveQuizForQuestions(quiz)
    setLoadingQuestions(true)
    setNewQText(''); setNewQOptions(['', '', '', '']); setNewQCorrect('')
    setNewQHint(''); setNewQExplanation(''); setNewQPoints('10')
    const { data } = await supabase
      .from('clan_war_questions')
      .select('id, question_text, options, correct_answer, hint, explanation, points')
      .eq('war_quiz_id', quiz.id)
      .order('id')
    setQuestionList(data ?? [])
    setLoadingQuestions(false)
  }

  const refreshQuestions = async (quizId: string) => {
    const { data } = await supabase
      .from('clan_war_questions')
      .select('id, question_text, options, correct_answer, hint, explanation, points')
      .eq('war_quiz_id', quizId)
      .order('id')
    setQuestionList(data ?? [])
  }

  const handleAddQuestion = async () => {
    if (!activeQuizForQuestions) return
    if (!newQText.trim()) return notify('error', 'Question text required')
    const filledOptions = newQOptions.map(o => o.trim()).filter(o => o.length > 0)
    if (filledOptions.length < 2) return notify('error', 'At least 2 options required')
    if (!newQCorrect.trim()) return notify('error', 'Correct answer required')
    if (!filledOptions.includes(newQCorrect.trim())) {
      return notify('error', 'Correct answer must match one of the options')
    }

    const safePoints = parseInt(newQPoints) || 10

    setAddingQuestion(true)
    const { error } = await supabase.rpc('admin_add_war_question', {
      p_war_quiz_id: activeQuizForQuestions.id,
      p_question_text: newQText.trim(),
      p_options: filledOptions,
      p_correct_answer: newQCorrect.trim(),
      p_explanation: newQExplanation.trim() || null,
      p_hint: newQHint.trim() || null,
      p_points: safePoints
    })
    setAddingQuestion(false)
    if (error) return notify('error', error.message)

    setNewQText(''); setNewQOptions(['', '', '', '']); setNewQCorrect('')
    setNewQHint(''); setNewQExplanation(''); setNewQPoints('10')
    await refreshQuestions(activeQuizForQuestions.id)
    notify('success', 'Question added')
  }

  const handleDeleteQuestion = async (qid: string) => {
    if (!confirm('Delete this question?')) return
    const { error } = await supabase.from('clan_war_questions').delete().eq('id', qid)
    if (error) return notify('error', error.message)
    if (activeQuizForQuestions) await refreshQuestions(activeQuizForQuestions.id)
  }

  const viewWarDetails = async (war: any) => {
    setViewingWar(war)
    setLoadingAttacks(true)
    const { data } = await supabase
      .from('clan_war_attacks')
      .select(`
        *,
        profile:user_id (id, display_name, avatar_url),
        clan:clan_id (id, name, tag)
      `)
      .eq('war_id', war.id)
      .order('attack_day', { ascending: false })
    setWarAttacks(data ?? [])
    setLoadingAttacks(false)
  }

  // ============ HELPERS ============
  const dayOfWar = (startsAt: string | null) => {
    if (!startsAt) return 0
    const diff = Date.now() - new Date(startsAt).getTime()
    return Math.min(7, Math.max(1, Math.ceil(diff / 86400000)))
  }

  const timeLeft = (endsAt: string | null) => {
    if (!endsAt) return 'Waiting'
    const diff = new Date(endsAt).getTime() - Date.now()
    if (diff <= 0) return 'Ended'
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    if (days > 0) return `${days}d ${hours}h`
    return `${hours}h`
  }

  const fighterCount = (warId: string, clanId: string | null | undefined) => {
    if (!clanId) return 0
    return (fightersByWar[warId] ?? []).filter(f => f.clan_id === clanId).length
  }

  const fightersOf = (warId: string, clanId: string | null | undefined) => {
    if (!clanId) return []
    return (fightersByWar[warId] ?? [])
      .filter(f => f.clan_id === clanId)
      .sort((a, b) => b.points - a.points)
  }

  const borderItems = allCosmetics.filter(c => c.cosmetic_type === 'avatar_border')
  const bgItems = allCosmetics.filter(c => c.cosmetic_type === 'background')
  const themeItems = allCosmetics.filter(c => c.cosmetic_type === 'quiz_theme')

  const selectedBorder = borderItems.find(c => c.id === prizeBorderId)
  const selectedBg = bgItems.find(c => c.id === prizeBackgroundId)
  const selectedTheme = themeItems.find(c => c.id === prizeThemeId)

  const publishedQuizzes = warQuizzes.filter(q => q.status === 'published')
  const draftQuizzes = warQuizzes.filter(q => q.status === 'draft')

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-[#ccff00]">
        <p className="font-mono text-sm animate-pulse tracking-widest">LOADING WARS...</p>
      </div>
    )
  }

  return (
    <div className="relative z-10 max-w-7xl mx-auto pb-20">
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl font-bold text-sm shadow-2xl border flex items-center gap-2 max-w-[90vw] text-center ${
          toast.type === 'success'
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircleIcon weight="fill" className="w-5 h-5 shrink-0" /> : <WarningCircleIcon weight="fill" className="w-5 h-5 shrink-0" />}
          <span className="truncate">{toast.msg}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 sm:mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FlagIcon weight="bold" className="text-[#ccff00] w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Clan Arena</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Clan Wars</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">Create open arenas (2v2 to 5v5) for leaders to fight in.</p>
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="w-full sm:w-auto bg-[#ccff00] text-black px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-white transition shadow-[0_0_20px_rgba(204,255,0,0.3)]"
        >
          <PlusIcon weight="bold" className="w-4 h-4 sm:w-5 sm:h-5" /> Create Open Arena
        </button>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 mb-6">
        <div className="bg-[#0f1014] border border-white/5 p-3 sm:p-5 rounded-xl sm:rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg bg-[#ccff00]/10 flex items-center justify-center">
              <FlagIcon weight="fill" className="w-4 h-4 sm:w-5 sm:h-5 text-[#ccff00]" />
            </div>
            <p className="text-[9px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">Active Wars</p>
          </div>
          <p className="text-xl sm:text-3xl font-black text-white">{activeWars.length}</p>
        </div>
        <div className="bg-[#0f1014] border border-white/5 p-3 sm:p-5 rounded-xl sm:rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg bg-[#00f0ff]/10 flex items-center justify-center">
              <ArrowsClockwiseIcon weight="fill" className="w-4 h-4 sm:w-5 sm:h-5 text-[#00f0ff]" />
            </div>
            <p className="text-[9px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">War Quizzes</p>
          </div>
          <p className="text-xl sm:text-3xl font-black text-white">{publishedQuizzes.length}</p>
        </div>
        <div className="bg-[#0f1014] border border-white/5 p-3 sm:p-5 rounded-xl sm:rounded-2xl col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg bg-[#ff9500]/10 flex items-center justify-center">
              <TrophyIcon weight="fill" className="w-4 h-4 sm:w-5 sm:h-5 text-[#ff9500]" />
            </div>
            <p className="text-[9px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">Completed Wars</p>
          </div>
          <p className="text-xl sm:text-3xl font-black text-white">{completedWars.length}</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-1 px-1 scroll-smooth">
        {[
          { id: 'active', label: 'Active Wars', count: activeWars.length },
          { id: 'quizzes', label: 'War Quiz Pool', count: publishedQuizzes.length },
          { id: 'history', label: 'History', count: completedWars.length }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`shrink-0 px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-bold transition flex items-center gap-2 ${
              tab === t.id
                ? 'bg-[#ccff00] text-black'
                : 'bg-[#0f1014] border border-white/10 text-gray-300 hover:bg-white/5'
            }`}
          >
            {t.label}
            <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${
              tab === t.id ? 'bg-black/20' : 'bg-white/10'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* TAB: ACTIVE WARS */}
      {tab === 'active' && (
        <section className="space-y-3">
          {activeWars.length === 0 ? (
            <div className="bg-[#0f1014] border border-white/10 rounded-2xl p-8 sm:p-12 text-center">
              <FlagIcon weight="duotone" className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-bold">No active wars</p>
              <p className="text-xs text-gray-600 mt-1">Create an open arena to let leaders fight.</p>
            </div>
          ) : (
            activeWars.map(war => {
              const day = dayOfWar(war.starts_at)
              const isOpen = !war.clan_a_id || !war.clan_b_id
              const countA = fighterCount(war.id, war.clan_a_id)
              const countB = fighterCount(war.id, war.clan_b_id)
              const ts: number = war.team_size ?? 5
              // Handle null starts_at safely
              const isStarted = war.starts_at ? new Date(war.starts_at).getTime() <= Date.now() : false
              return (
                <div key={war.id} className="bg-[#0f1014] border border-white/10 rounded-2xl p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                        {war.clan_a?.avatar_url ? <img src={war.clan_a.avatar_url} className="w-full h-full object-cover" /> : <span className="text-gray-500 font-bold text-xs">?</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-sm sm:text-base text-white truncate">
                          {war.clan_a?.name || <span className="text-[#ccff00] animate-pulse">Open Arena</span>}
                          {war.clan_a_id && war.clan_b_id && (
                            <>
                              <span className="text-gray-500 font-normal mx-1">vs</span>
                              {war.clan_b?.name}
                            </>
                          )}
                          {!war.clan_a_id || !war.clan_b_id ? (
                            <span className="text-xs text-gray-500 font-normal ml-2">(Waiting for {!war.clan_a_id ? 'Clan A' : 'Clan B'})</span>
                          ) : null}
                        </p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                          {isOpen ? (
                            <span className="text-[#ccff00] animate-pulse">
                              Waiting for {!war.clan_a_id ? 'Clan A' : 'Clan B'} to join...
                            </span>
                          ) : !isStarted && war.starts_at ? (
                            <span className="text-[#00f0ff] animate-pulse">
                              Countdown: {timeLeft(war.starts_at)} 
                            </span>
                          ) : (
                            <>
                              Day {day}/{war.duration_days ?? 7} · {timeLeft(war.ends_at)} left ·{' '}
                              <span className="text-[#ccff00]">{ts}v{ts}</span>
                              <span className="ml-2 text-gray-500">({teamLabel(ts)})</span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                        {war.clan_b?.avatar_url ? <img src={war.clan_b.avatar_url} className="w-full h-full object-cover" /> : <span className="text-gray-500 font-bold text-xs">?</span>}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => viewWarDetails(war)}
                        className="text-[10px] sm:text-xs bg-[#00f0ff]/10 text-[#00f0ff] px-3 py-2 rounded-lg font-bold hover:bg-[#00f0ff]/20 transition flex items-center gap-1.5"
                      >
                        <EyeIcon weight="bold" className="w-3.5 h-3.5" /> Details
                      </button>
                      
                      {!isOpen && !isStarted && (
                        <button
                          onClick={() => handleStartNow(war.id)}
                          className="text-[10px] sm:text-xs bg-green-500/20 text-green-400 px-3 py-2 rounded-lg font-bold hover:bg-green-500/30 transition flex items-center gap-1.5"
                        >
                          <PlayIcon weight="fill" className="w-3.5 h-3.5" /> Start Now
                        </button>
                      )}

                      <button
                        onClick={() => handleCancelWar(war.id)}
                        className="text-[10px] sm:text-xs bg-red-500/20 text-red-400 px-3 py-2 rounded-lg font-bold hover:bg-red-500/30 transition flex items-center gap-1.5"
                      >
                        <XIcon weight="bold" className="w-3.5 h-3.5" /> Cancel
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 uppercase font-bold">Today's quiz:</span>
                      {war.daily_quiz ? (
                        <span className="text-[10px] bg-[#ccff00]/10 text-[#ccff00] px-2 py-1 rounded font-bold">
                          {war.daily_quiz.title} (Dynamic Matchups)
                        </span>
                      ) : (
                        <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-1 rounded font-bold animate-pulse">Assigning...</span>
                      )}
                    </div>
                    {!isOpen && (
                      <div className="flex items-center gap-2">
                        <UsersIcon weight="bold" className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Fighters:</span>
                        <span className={`text-[10px] px-2 py-1 rounded font-bold ${
                          countA === ts ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-300'
                        }`}>
                          {war.clan_a?.tag || 'A'} {countA}/{ts}
                        </span>
                        <span className="text-gray-600 text-[10px]">vs</span>
                        <span className={`text-[10px] px-2 py-1 rounded font-bold ${
                          countB === ts ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-300'
                        }`}>
                          {war.clan_b?.tag || 'B'} {countB}/{ts}
                        </span>
                      </div>
                    )}
                  </div>

                  {!isOpen && (
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
                      <div className={`bg-black/30 rounded-xl p-2 sm:p-3 ${war.clan_a_disqualified ? 'border border-red-500/30' : ''}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-gray-400 font-bold truncate">{war.clan_a?.tag}</span>
                          <span className={`text-[10px] font-bold ${war.clan_a_disqualified ? 'text-red-400' : 'text-white'}`}>
                            {war.clan_a_strikes ?? 0}/3 {war.clan_a_disqualified && '· DQ'}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          {[0, 1, 2].map(i => (
                            <div key={i} className={`flex-1 h-1.5 rounded-full ${i < (war.clan_a_strikes ?? 0) ? 'bg-red-500' : 'bg-white/10'}`} />
                          ))}
                        </div>
                        <div className="flex gap-1 mt-2">
                          <button 
                            onClick={() => handleSetStrikes(war.id, 'a', (war.clan_a_strikes ?? 0) + 1)} 
                            disabled={war.clan_a_disqualified}
                            className="flex-1 text-[9px] bg-yellow-500/20 text-yellow-300 py-1 rounded font-bold hover:bg-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            +1
                          </button>
                          <button 
                            onClick={() => handleSetStrikes(war.id, 'a', (war.clan_a_strikes ?? 0) - 1)} 
                            disabled={(war.clan_a_strikes ?? 0) === 0}
                            className="flex-1 text-[9px] bg-white/5 text-gray-400 py-1 rounded font-bold hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            -1
                          </button>
                        </div>
                      </div>

                      <div className={`bg-black/30 rounded-xl p-2 sm:p-3 ${war.clan_b_disqualified ? 'border border-red-500/30' : ''}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-gray-400 font-bold truncate">{war.clan_b?.tag}</span>
                          <span className={`text-[10px] font-bold ${war.clan_b_disqualified ? 'text-red-400' : 'text-white'}`}>
                            {war.clan_b_strikes ?? 0}/3 {war.clan_b_disqualified && '· DQ'}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          {[0, 1, 2].map(i => (
                            <div key={i} className={`flex-1 h-1.5 rounded-full ${i < (war.clan_b_strikes ?? 0) ? 'bg-red-500' : 'bg-white/10'}`} />
                          ))}
                        </div>
                        <div className="flex gap-1 mt-2">
                          <button 
                            onClick={() => handleSetStrikes(war.id, 'b', (war.clan_b_strikes ?? 0) + 1)} 
                            disabled={war.clan_b_disqualified}
                            className="flex-1 text-[9px] bg-yellow-500/20 text-yellow-300 py-1 rounded font-bold hover:bg-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            +1
                          </button>
                          <button 
                            onClick={() => handleSetStrikes(war.id, 'b', (war.clan_b_strikes ?? 0) - 1)} 
                            disabled={(war.clan_b_strikes ?? 0) === 0}
                            className="flex-1 text-[9px] bg-white/5 text-gray-400 py-1 rounded font-bold hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            -1
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </section>
      )}

      {/* TAB: QUIZZES */}
      {tab === 'quizzes' && (
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-white">War Quiz Pool</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                These are <b>war-only</b> quizzes. They never appear in normal quiz lists.
              </p>
            </div>
            <button
              onClick={() => setQuizCreateOpen(true)}
              className="bg-[#ccff00] text-black px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-white transition shrink-0"
            >
              <PlusIcon weight="bold" className="w-4 h-4" /> New War Quiz
            </button>
          </div>

          <div className="bg-[#0f1014] border border-green-500/20 rounded-2xl p-4">
            <h4 className="text-xs font-bold text-green-300 uppercase tracking-wider mb-2">
              Published ({publishedQuizzes.length}) — available for new wars
            </h4>
            <div className="space-y-1">
              {publishedQuizzes.length === 0 ? (
                <p className="text-xs text-gray-500 py-3 text-center">No published war quizzes yet.</p>
              ) : (
                publishedQuizzes.map(q => (
                  <div key={q.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 hover:bg-white/5 rounded-lg text-xs gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-bold truncate">{q.title}</p>
                      <p className="text-[10px] text-gray-500">
                        {q.difficulty} · {q.time_limit_seconds}s limit
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1 shrink-0">
                      <button onClick={() => openEditQuizModal(q)} className="text-[10px] text-[#ccff00] hover:text-[#ccff00]/80 font-bold px-2 py-1">
                        Edit
                      </button>
                      <button onClick={() => openQuestionEditor(q)} className="text-[10px] text-[#00f0ff] hover:text-[#00f0ff]/80 font-bold px-2 py-1">
                        Questions
                      </button>
                      <button onClick={() => handleArchiveWarQuiz(q.id)} className="text-[10px] text-yellow-400 hover:text-yellow-300 font-bold px-2 py-1">
                        Archive
                      </button>
                      <button onClick={() => handleDeleteWarQuiz(q.id)} className="text-[10px] text-red-400 hover:text-red-300 font-bold px-2 py-1">
                        <TrashIcon weight="bold" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-[#0f1014] border border-yellow-500/20 rounded-2xl p-4">
            <h4 className="text-xs font-bold text-yellow-300 uppercase tracking-wider mb-2">
              Drafts ({draftQuizzes.length}) — need questions before publishing
            </h4>
            <div className="space-y-1">
              {draftQuizzes.length === 0 ? (
                <p className="text-xs text-gray-500 py-3 text-center">No drafts.</p>
              ) : (
                draftQuizzes.map(q => (
                  <div key={q.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 hover:bg-white/5 rounded-lg text-xs gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-bold truncate">{q.title}</p>
                      <p className="text-[10px] text-gray-500">{q.difficulty} · draft</p>
                    </div>
                    <div className="flex flex-wrap gap-1 shrink-0">
                      <button onClick={() => openEditQuizModal(q)} className="text-[10px] text-[#ccff00] hover:text-[#ccff00]/80 font-bold px-2 py-1">
                        Edit
                      </button>
                      <button onClick={() => openQuestionEditor(q)} className="text-[10px] text-[#00f0ff] hover:text-[#00f0ff]/80 font-bold px-2 py-1 flex items-center gap-1">
                        <UploadSimpleIcon weight="bold" className="w-3 h-3" /> Questions
                      </button>
                      <button onClick={() => handlePublishWarQuiz(q.id)} className="text-[10px] text-green-400 hover:text-green-300 font-bold px-2 py-1">
                        Publish
                      </button>
                      <button onClick={() => handleDeleteWarQuiz(q.id)} className="text-[10px] text-red-400 hover:text-red-300 font-bold px-2 py-1">
                        <TrashIcon weight="bold" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* TAB: HISTORY */}
      {tab === 'history' && (
        <section className="space-y-2">
          {completedWars.length === 0 ? (
            <div className="bg-[#0f1014] border border-white/10 rounded-2xl p-8 sm:p-12 text-center">
              <TrophyIcon weight="duotone" className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-bold">No completed wars yet</p>
            </div>
          ) : (
            completedWars.map(war => {
              const winner = war.winner_clan_id === war.clan_a?.id ? war.clan_a
                : war.winner_clan_id === war.clan_b?.id ? war.clan_b : null
              const ts = war.team_size ?? 5
              return (
                <div key={war.id} className="bg-[#0f1014] border border-white/10 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-white truncate">
                      {war.clan_a?.name || 'Unknown'} <span className="text-gray-500">vs</span> {war.clan_b?.name || 'Unknown'}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {ts}v{ts} · Ended {war.ends_at ? new Date(war.ends_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila' }) : 'N/A'}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {winner ? (
                      <span className="text-[10px] sm:text-xs bg-[#ccff00]/10 text-[#ccff00] px-2 sm:px-3 py-1.5 rounded-lg font-bold flex items-center gap-1">
                        <TrophyIcon weight="fill" className="w-3 h-3" />{winner.name} won
                      </span>
                    ) : (
                      <span className="text-[10px] sm:text-xs bg-white/5 text-gray-400 px-2 sm:px-3 py-1.5 rounded-lg font-bold">Draw</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </section>
      )}

      {/* ============ CREATE WAR MODAL ============ */}
      {renderModal(createOpen, () => setCreateOpen(false), (
        <div className="bg-[#0f1014] border border-white/10 rounded-3xl w-full overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
          <div className="p-4 sm:p-5 border-b border-white/10 flex justify-between items-center bg-black/40 shrink-0">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white">Create Open Arena</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">Players will challenge each other to claim this arena.</p>
            </div>
            <button onClick={() => setCreateOpen(false)} className="text-gray-400 hover:text-white p-2">
              <XIcon weight="bold" size={20} />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto admin-custom-scrollbar flex-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase tracking-wider">Duration (Days)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={duration}
                  onChange={e => setDuration(e.target.value.replace(/\D/g, ''))}
                  onBlur={() => { if (!duration || parseInt(duration) < 1) setDuration('7') }}
                  className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-sm text-white outline-none focus:border-[#ccff00]"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase tracking-wider">Format</label>
                <select
                  value={teamSize}
                  onChange={e => setTeamSize(parseInt(e.target.value) as TeamSize)}
                  className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-sm text-white outline-none focus:border-[#ccff00]"
                >
                  {TEAM_SIZES.map(n => (
                    <option key={n} value={n}>{TEAM_LABELS[n]}</option>
                  ))}
                </select>
                <p className="text-[9px] text-gray-500 mt-1">1 attack per fighter per day · {teamSize} fighters per side</p>
              </div>
            </div>

            {/* SPLIT HOURS AND MINUTES INPUT */}
            <div>
              <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase tracking-wider">Start Delay</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={startDelayHours}
                    onChange={e => setStartDelayHours(e.target.value.replace(/\D/g, ''))}
                    onBlur={() => { if (!startDelayHours) setStartDelayHours('0') }}
                    className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-sm text-white outline-none focus:border-[#ccff00] pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-bold">Hours</span>
                </div>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={startDelayMins}
                    onChange={e => setStartDelayMins(e.target.value.replace(/\D/g, ''))}
                    onBlur={() => { if (!startDelayMins) setStartDelayMins('0') }}
                    className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-sm text-white outline-none focus:border-[#ccff00] pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-bold">Mins</span>
                </div>
              </div>
              
              {/* Quick Select Buttons */}
              <div className="flex flex-wrap gap-2 mt-2">
                <button type="button" onClick={() => { setStartDelayHours('0'); setStartDelayMins('0'); }} className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded font-bold text-gray-300">Instant</button>
                <button type="button" onClick={() => { setStartDelayHours('0'); setStartDelayMins('5'); }} className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded font-bold text-gray-300">5 Mins</button>
                <button type="button" onClick={() => { setStartDelayHours('1'); setStartDelayMins('0'); }} className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded font-bold text-gray-300">1 Hour</button>
                <button type="button" onClick={() => { setStartDelayHours('2'); setStartDelayMins('0'); }} className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded font-bold text-gray-300">2 Hours</button>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4 mt-2">
              <h3 className="text-xs font-bold text-[#ccff00] uppercase tracking-wider mb-3">🏆 Winner Prizes (Per Fighter)</h3>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase tracking-wider">Coins</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={prizeCoins}
                    onChange={e => setPrizeCoins(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-sm text-white outline-none focus:border-[#ccff00]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase tracking-wider">Points</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={prizePoints}
                    onChange={e => setPrizePoints(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-sm text-white outline-none focus:border-[#ccff00]"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase tracking-wider">Avatar Border (Optional)</label>
                  <select
                    value={prizeBorderId}
                    onChange={e => setPrizeBorderId(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-sm text-white outline-none focus:border-[#ccff00]"
                  >
                    <option value="">— No Border —</option>
                    {borderItems.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <CosmeticPreview item={selectedBorder} type="border" />
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase tracking-wider">Background (Optional)</label>
                  <select
                    value={prizeBackgroundId}
                    onChange={e => setPrizeBackgroundId(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-sm text-white outline-none focus:border-[#ccff00]"
                  >
                    <option value="">— No Background —</option>
                    {bgItems.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <CosmeticPreview item={selectedBg} type="background" />
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase tracking-wider">Quiz Theme (Optional)</label>
                  <select
                    value={prizeThemeId}
                    onChange={e => setPrizeThemeId(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-sm text-white outline-none focus:border-[#ccff00]"
                  >
                    <option value="">— No Theme —</option>
                    {themeItems.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <CosmeticPreview item={selectedTheme} type="theme" />
                </div>
              </div>
            </div>

            <div className="bg-[#ccff00]/5 border border-[#ccff00]/20 rounded-xl p-3 mt-4">
              <p className="text-[10px] text-[#ccff00] font-bold uppercase tracking-wider mb-1">⚠️ Requirements</p>
              <ul className="text-[10px] text-gray-400 space-y-0.5 list-disc list-inside">
                <li>The war quiz will be <b>automatically matched</b> to the players' badges.</li>
                <li>Each clan leader picks <b>exactly {teamSize} fighters</b> when joining.</li>
                <li>Only those {teamSize} fighters can attack and receive rewards.</li>
              </ul>
            </div>

            <button
              onClick={handleCreateWar}
              disabled={creating}
              className="w-full bg-[#ccff00] text-black font-bold py-3 rounded-xl hover:bg-white transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {creating ? 'Creating...' : (
                <>
                  <SwordIcon weight="fill" className="w-4 h-4" />
                  Create {teamSize}v{teamSize} Open Arena
                </>
              )}
            </button>
          </div>
        </div>
      ))}

      {/* ============ CREATE WAR QUIZ MODAL ============ */}
      {renderModal(quizCreateOpen, () => setQuizCreateOpen(false), (
        <div className="bg-[#0f1014] border border-white/10 rounded-3xl w-full overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
          <div className="p-4 sm:p-5 border-b border-white/10 flex justify-between items-center bg-black/40 shrink-0">
            <div>
              <h2 className="text-lg font-black text-white">New War Quiz</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">War-only quiz. Not shown in normal quiz lists.</p>
            </div>
            <button onClick={() => setQuizCreateOpen(false)} className="text-gray-400 hover:text-white p-2">
              <XIcon weight="bold" size={20} />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto admin-custom-scrollbar flex-1">
            
            {/* Mode Toggle */}
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 mb-4">
              <button 
                onClick={() => setQuizCreateMode('manual')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${quizCreateMode === 'manual' ? 'bg-[#ccff00] text-black' : 'text-gray-400 hover:text-white'}`}
              >
                Manual Questions
              </button>
              <button 
                onClick={() => setQuizCreateMode('paste')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${quizCreateMode === 'paste' ? 'bg-[#ccff00] text-black' : 'text-gray-400 hover:text-white'}`}
              >
                Bulk Paste Text
              </button>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase tracking-wider">Title</label>
              <input
                value={newQuizTitle}
                onChange={e => setNewQuizTitle(e.target.value)}
                placeholder="e.g. War Tactics Quiz #1"
                className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-sm text-white outline-none focus:border-[#ccff00]"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase tracking-wider">Description (optional)</label>
              <textarea
                value={newQuizDescription}
                onChange={e => setNewQuizDescription(e.target.value)}
                rows={2}
                className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-sm text-white outline-none focus:border-[#ccff00] resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase tracking-wider">Difficulty</label>
                <select
                  value={newQuizDifficulty}
                  onChange={e => setNewQuizDifficulty(e.target.value as any)}
                  className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-sm text-white outline-none focus:border-[#ccff00]"
                >
                  <option value="normal">Normal</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase tracking-wider">Time Limit (s)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newQuizTimeLimit}
                  onChange={e => setNewQuizTimeLimit(e.target.value.replace(/\D/g, ''))}
                  onBlur={() => { if (!newQuizTimeLimit || parseInt(newQuizTimeLimit) < 5) setNewQuizTimeLimit('20') }}
                  className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-sm text-white outline-none focus:border-[#ccff00]"
                />
              </div>
            </div>

            {quizCreateMode === 'paste' && (
              <div className="mt-4">
                <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase tracking-wider">Paste Quiz Text</label>
                <textarea
                  value={pastedQuizText}
                  onChange={e => setPastedQuizText(e.target.value.replace(/\\/g, ''))}
                  placeholder={`Question 1: What is the capital of France?\nA. Rome\nB. Madrid\nC. Paris\nD. Berlin\nHint: The city is known as the City of Light.\nAnswer: C\n\nQuestion 2: ...`}
                  rows={8}
                  className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-sm text-white outline-none focus:border-[#ccff00] resize-none font-mono"
                />
                <p className="text-[10px] text-gray-500 mt-2">
                  Supports multiple questions. Matches the same format as the normal quiz bulk upload.
                </p>
              </div>
            )}

            <button
              onClick={handleCreateWarQuiz}
              disabled={creatingQuiz}
              className="w-full bg-[#ccff00] text-black font-bold py-3 rounded-xl hover:bg-white transition disabled:opacity-50 flex items-center justify-center gap-2 mt-4 shrink-0"
            >
              {creatingQuiz ? 'Creating...' : (
                <>
                  <PlusIcon weight="bold" className="w-4 h-4" />
                  {quizCreateMode === 'paste' ? 'Create & Auto-Publish' : 'Create & Add Questions'}
                </>
              )}
            </button>
          </div>
        </div>
      ), true)}

      {/* ============ EDIT WAR QUIZ MODAL ============ */}
      {renderModal(!!editingQuiz, () => setEditingQuiz(null), (
        <div className="bg-[#0f1014] border border-white/10 rounded-3xl w-full overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
          <div className="p-4 sm:p-5 border-b border-white/10 flex justify-between items-center bg-black/40 shrink-0">
            <div>
              <h2 className="text-lg font-black text-white">Edit War Quiz</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">Update the quiz details.</p>
            </div>
            <button onClick={() => setEditingQuiz(null)} className="text-gray-400 hover:text-white p-2">
              <XIcon weight="bold" size={20} />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto admin-custom-scrollbar flex-1">
            <div>
              <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase tracking-wider">Title</label>
              <input
                value={editQuizTitle}
                onChange={e => setEditQuizTitle(e.target.value)}
                className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-sm text-white outline-none focus:border-[#ccff00]"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase tracking-wider">Description (optional)</label>
              <textarea
                value={editQuizDescription}
                onChange={e => setEditQuizDescription(e.target.value)}
                rows={2}
                className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-sm text-white outline-none focus:border-[#ccff00] resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase tracking-wider">Difficulty</label>
                <select
                  value={editQuizDifficulty}
                  onChange={e => setEditQuizDifficulty(e.target.value as any)}
                  className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-sm text-white outline-none focus:border-[#ccff00]"
                >
                  <option value="normal">Normal</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase tracking-wider">Time Limit (s)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editQuizTimeLimit}
                  onChange={e => setEditQuizTimeLimit(e.target.value.replace(/\D/g, ''))}
                  onBlur={() => { if (!editQuizTimeLimit || parseInt(editQuizTimeLimit) < 5) setEditQuizTimeLimit('20') }}
                  className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-sm text-white outline-none focus:border-[#ccff00]"
                />
              </div>
            </div>

            <button
              onClick={handleUpdateWarQuiz}
              disabled={updatingQuiz}
              className="w-full bg-[#ccff00] text-black font-bold py-3 rounded-xl hover:bg-white transition disabled:opacity-50 flex items-center justify-center gap-2 mt-4 shrink-0"
            >
              {updatingQuiz ? 'Saving...' : (
                <>
                  <CheckCircleIcon weight="bold" className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      ), true)}

      {/* ============ QUESTION EDITOR MODAL (Manual Mode) ============ */}
      {renderModal(!!activeQuizForQuestions, () => setActiveQuizForQuestions(null), (
        <div className="bg-[#0f1014] border border-white/10 rounded-3xl w-full overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
          <div className="p-4 sm:p-5 border-b border-white/10 bg-black/40 flex justify-between items-start shrink-0">
            <div className="min-w-0">
              <h2 className="text-base font-black text-white truncate">
                {activeQuizForQuestions?.title}
              </h2>
              <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">
                {activeQuizForQuestions?.difficulty} · {questionList.length} questions
              </p>
            </div>
            <button onClick={() => setActiveQuizForQuestions(null)} className="text-gray-400 hover:text-white p-1 shrink-0">
              <XIcon weight="bold" size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 admin-custom-scrollbar space-y-4">
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Existing Questions</p>
              {loadingQuestions ? (
                <p className="text-xs text-gray-500 py-3 text-center">Loading...</p>
              ) : questionList.length === 0 ? (
                <p className="text-xs text-gray-500 py-3 text-center italic">No questions yet. Add below.</p>
              ) : (
                <div className="space-y-2">
                  {questionList.map((q, idx) => (
                    <div key={q.id} className="bg-black/30 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-white font-bold flex-1">
                          {idx + 1}. {q.question_text}
                        </p>
                        <button onClick={() => handleDeleteQuestion(q.id)} className="text-red-400 hover:text-red-300 p-1 shrink-0">
                          <TrashIcon weight="bold" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(q.options as string[]).map((opt, i) => (
                          <span key={i} className={`text-[10px] px-2 py-0.5 rounded ${
                            opt === q.correct_answer
                              ? 'bg-green-500/20 text-green-300 font-bold'
                              : 'bg-white/5 text-gray-400'
                          }`}>
                            {opt}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 pt-4">
              <p className="text-[10px] text-[#ccff00] uppercase font-bold mb-2">Add New Question</p>
              <div className="space-y-2">
                <textarea
                  value={newQText}
                  onChange={e => setNewQText(e.target.value)}
                  placeholder="Question text"
                  rows={2}
                  className="w-full bg-black/50 border border-white/10 p-2.5 rounded-xl text-xs text-white outline-none focus:border-[#ccff00] resize-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  {newQOptions.map((opt, i) => (
                    <input
                      key={i}
                      value={opt}
                      onChange={e => {
                        const next = [...newQOptions]
                        next[i] = e.target.value
                        setNewQOptions(next)
                      }}
                      placeholder={`Option ${i + 1}`}
                      className="bg-black/50 border border-white/10 p-2.5 rounded-xl text-xs text-white outline-none focus:border-[#ccff00]"
                    />
                  ))}
                </div>
                <select
                  value={newQCorrect}
                  onChange={e => setNewQCorrect(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 p-2.5 rounded-xl text-xs text-white outline-none focus:border-[#ccff00]"
                >
                  <option value="">— Select correct answer —</option>
                  {newQOptions.filter(o => o.trim()).map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={newQHint}
                    onChange={e => setNewQHint(e.target.value)}
                    placeholder="Hint (optional)"
                    className="bg-black/50 border border-white/10 p-2.5 rounded-xl text-xs text-white outline-none focus:border-[#ccff00]"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newQPoints}
                    onChange={e => setNewQPoints(e.target.value.replace(/\D/g, ''))}
                    onBlur={() => { if (!newQPoints) setNewQPoints('10') }}
                    placeholder="Points"
                    className="bg-black/50 border border-white/10 p-2.5 rounded-xl text-xs text-white outline-none focus:border-[#ccff00]"
                  />
                </div>
                <textarea
                  value={newQExplanation}
                  onChange={e => setNewQExplanation(e.target.value)}
                  placeholder="Explanation (optional)"
                  rows={2}
                  className="w-full bg-black/50 border border-white/10 p-2.5 rounded-xl text-xs text-white outline-none focus:border-[#ccff00] resize-none"
                />
                <button
                  onClick={handleAddQuestion}
                  disabled={addingQuestion}
                  className="w-full bg-[#00f0ff] text-black font-bold py-2.5 rounded-xl hover:bg-white transition disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
                >
                  {addingQuestion ? 'Adding...' : (
                    <>
                      <PlusIcon weight="bold" className="w-3.5 h-3.5" />
                      Add Question
                    </>
                  )}
                </button>
              </div>
            </div>

            {activeQuizForQuestions?.status === 'draft' && questionList.length > 0 && (
              <button
                onClick={async () => {
                  await handlePublishWarQuiz(activeQuizForQuestions.id)
                  setActiveQuizForQuestions({ ...activeQuizForQuestions, status: 'published' })
                }}
                className="w-full bg-[#ccff00] text-black font-bold py-2.5 rounded-xl hover:bg-white transition flex items-center justify-center gap-2 text-xs shrink-0"
              >
                <CheckCircleIcon weight="bold" className="w-3.5 h-3.5" />
                Publish Quiz ({questionList.length} questions)
              </button>
            )}
          </div>
        </div>
      ), true)}

      {/* ============ WAR DETAILS MODAL ============ */}
      {renderModal(!!viewingWar, () => setViewingWar(null), (
        <div className="bg-[#0f1014] border border-white/10 rounded-3xl w-full overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">
          <div className="p-4 sm:p-5 border-b border-white/10 bg-black/40 flex justify-between items-start shrink-0">
            <div className="min-w-0">
              <h2 className="text-lg font-black text-white truncate">
                {viewingWar?.clan_a?.name || 'Clan A'}
                <span className="text-gray-500 font-normal mx-1">vs</span>
                {viewingWar?.clan_b?.name || <span className="text-[#ccff00] animate-pulse">Waiting for Opponent</span>}
              </h2>
              <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">
                {teamLabel(viewingWar?.team_size ?? 5)} · Attack Log · {warAttacks.length} attacks
              </p>
            </div>
            <button onClick={() => setViewingWar(null)} className="text-gray-400 hover:text-white p-1 shrink-0">
              <XIcon weight="bold" size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 admin-custom-scrollbar">
            {viewingWar && (() => {
              const ts: number = viewingWar.team_size ?? 5
              return (
                <div className="mb-4 px-1">
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-2 flex items-center gap-1.5">
                    <UsersIcon weight="bold" className="w-3.5 h-3.5" /> The {ts} Fighters
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { label: viewingWar.clan_a?.tag, id: viewingWar.clan_a_id, clan: viewingWar.clan_a },
                      { label: viewingWar.clan_b?.tag, id: viewingWar.clan_b_id, clan: viewingWar.clan_b }
                    ].map(side => {
                      const list = fightersOf(viewingWar.id, side.id)
                      return (
                        <div key={side.label || 'x'} className="bg-black/30 rounded-xl p-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 truncate">
                            {side.clan?.name || '—'} <span className="text-gray-600">({list.length}/{ts})</span>
                          </p>
                          {list.length === 0 ? (
                            <p className="text-[10px] text-gray-600 italic">No fighters picked yet</p>
                          ) : (
                            <div className="space-y-1">
                              {list.map(f => (
                                <div key={f.user_id} className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-[9px] font-bold text-gray-400 shrink-0">
                                    {f.avatar_url
                                      ? <img src={f.avatar_url} className="w-full h-full object-cover" />
                                      : (f.display_name?.charAt(0) ?? '?')}
                                  </div>
                                  <span className="text-[10px] text-white font-bold truncate flex-1">{f.display_name}</span>
                                  <span className="text-[10px] text-[#ccff00] font-bold shrink-0">{f.points} pts</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            <p className="text-[10px] text-gray-500 uppercase font-bold mb-2 px-1">Attack Log</p>
            {loadingAttacks ? (
              <p className="text-center text-gray-500 text-sm py-8">Loading attacks...</p>
            ) : warAttacks.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-8">No attacks recorded yet.</p>
            ) : (
              warAttacks.map(a => (
                <div key={a.id} className="flex items-center justify-between p-2.5 hover:bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-xs font-bold text-gray-400 shrink-0">
                      {a.profile?.avatar_url
                        ? <img src={a.profile.avatar_url} className="w-full h-full object-cover" />
                        : a.profile?.display_name?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{a.profile?.display_name}</p>
                      <p className="text-[10px] text-gray-500">
                        {a.clan?.tag} · {new Date(a.attack_day).toLocaleDateString('en-US', { timeZone: 'Asia/Manila' })}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#ccff00] shrink-0">+{a.points}</span>
                </div>
              ))
            )}
          </div>
        </div>
      ))}

    </div>
  )
}