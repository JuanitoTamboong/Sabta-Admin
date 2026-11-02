// src/pages/AdminQuizzes.tsx
import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { 
  PlusIcon, TrashIcon, UploadSimpleIcon, 
  FileTextIcon, CheckCircleIcon, XCircleIcon,
  GameControllerIcon, ClockIcon, ListDashesIcon, SparkleIcon,
  EyeIcon, XIcon,
  BabyIcon, UserIcon, UsersThreeIcon
} from '@phosphor-icons/react'

type ManualQuestionDraft = {
  questionText: string
  options: string[]
  correctAnswer: string
  hint: string
}

type QuizPublishMode = 'draft' | 'publish' | 'schedule'

type QuizPublication = {
  status: 'draft' | 'published'
  scheduled_at: string | null
}

const getQuizPublication = (mode: QuizPublishMode, scheduledAt: string): QuizPublication => {
  if (mode === 'draft') return { status: 'draft', scheduled_at: null }
  if (mode === 'publish') return { status: 'published', scheduled_at: null }

  const scheduledDate = new Date(scheduledAt)
  if (!scheduledAt || Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
    throw new Error("Choose a date and time later than now in your device's local time. The quiz was not changed.")
  }

  return { status: 'draft', scheduled_at: scheduledDate.toISOString() }
}

const getPublicationSummary = (publication: QuizPublication) => {
  if (publication.scheduled_at) {
    return `scheduled for ${new Date(publication.scheduled_at).toLocaleString()}`
  }
  return publication.status === 'draft' ? 'saved as a draft' : 'published'
}

const toLocalDateTimeInputValue = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

const getNextLocalMinute = () => {
  const date = new Date()
  date.setSeconds(0, 0)
  date.setMinutes(date.getMinutes() + 1)
  return toLocalDateTimeInputValue(date.toISOString())
}

function QuizPublishingOptions({
  mode,
  scheduledAt,
  onModeChange,
  onScheduledAtChange,
  accent
}: {
  mode: QuizPublishMode
  scheduledAt: string
  onModeChange: (mode: QuizPublishMode) => void
  onScheduledAtChange: (value: string) => void
  accent: 'cyan' | 'pink'
}) {
  const focusColor = accent === 'cyan' ? 'focus:border-[#00f0ff]' : 'focus:border-[#ff00a0]'

  return (
    <div className="mb-6 rounded-xl border border-white/10 bg-black/30 p-4">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
        When should this quiz be available?
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {([
          ['publish', 'Publish immediately'],
          ['draft', 'Save as draft'],
          ['schedule', 'Schedule publishing']
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => onModeChange(value)}
            className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-bold transition ${
              mode === value
                ? accent === 'cyan'
                  ? 'border-[#00f0ff] bg-[#00f0ff]/10 text-[#00f0ff]'
                  : 'border-[#ff00a0] bg-[#ff00a0]/10 text-[#ff00a0]'
                : 'border-white/10 bg-[#0f1014] text-gray-300 hover:border-white/30 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'schedule' && (
        <div className="mt-4 rounded-lg border border-[#ff9500]/30 bg-[#ff9500]/5 p-3">
          <label className="mb-2 block text-xs font-bold text-white">
            Choose the publish date and time
          </label>
          <input
            type="datetime-local"
            required
            min={getNextLocalMinute()}
            value={scheduledAt}
            onChange={event => onScheduledAtChange(event.target.value)}
            className={`w-full min-h-12 rounded-lg border border-white/10 bg-[#0f1014] p-3 text-base text-white outline-none ${focusColor}`}
          />
          <p className="mt-2 text-xs leading-relaxed text-gray-400">Tap this field to pick a date and time. The quiz publishes automatically within about a minute after that time.</p>
        </div>
      )}
    </div>
  )
}

const createEmptyManualQuestion = (): ManualQuestionDraft => ({
  questionText: '',
  options: ['', '', '', ''],
  correctAnswer: '',
  hint: ''
})

const splitQuestionCode = (text: string) => {
  const codeStart = text.search(/\b(?:public\s+)?class\s+[A-Za-z_$][\w$]*/)
  if (codeStart < 0) return { prompt: text, code: null }

  const prompt = text.slice(0, codeStart).trim()
  const source = text.slice(codeStart).replace(/^\s*(```[^\n]*|~~~[^\n]*)?\s*/, '').replace(/\s*(```|~~~)\s*$/, '')
  const tokens = source.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|==|!=|<=|>=|&&|\|\||\+\+|--|->|[{}()[\];,.@=+\-*/<>!?:]|\S/g) ?? []
  const lines: string[] = []
  let line = ''
  let indent = 0
  let previousToken = ''

  const flushLine = () => {
    if (line.trim()) lines.push(`${'  '.repeat(Math.max(indent, 0))}${line.trim()}`)
    line = ''
  }
  const append = (value: string) => { line += value }

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    const previousIsWord = /^[A-Za-z_$\d]/.test(previousToken)
    const tokenIsWord = /^[A-Za-z_$\d]/.test(token)

    if (token === '{') {
      if (line && !line.endsWith(' ')) append(' ')
      append('{')
      flushLine()
      indent++
    } else if (token === '}') {
      flushLine()
      indent = Math.max(indent - 1, 0)
      line = '}'
      flushLine()
    } else if (token === ';') {
      append(';')
      flushLine()
    } else if (token === ',') {
      append(', ')
    } else if (token === '.') {
      append('.')
    } else if (token === '(') {
      const needsSpace = ['if', 'for', 'while', 'switch', 'catch', 'synchronized'].includes(previousToken)
      if (needsSpace && line && !line.endsWith(' ')) append(' ')
      append('(')
    } else if (token === ')') {
      append(')')
    } else if (token === '[') {
      append('[')
    } else if (token === ']') {
      append(']')
    } else if (token === '@') {
      append(`@${tokens[index + 1] ?? ''}`)
      index++
      flushLine()
    } else if (['=', '+', '-', '*', '/', '==', '!=', '<', '>', '<=', '>=', '&&', '||', '?', ':', '->'].includes(token)) {
      if (line && !line.endsWith(' ')) append(' ')
      append(token)
      append(' ')
    } else {
      if (previousIsWord && tokenIsWord) append(' ')
      append(token)
    }

    previousToken = token
  }
  flushLine()

  return { prompt, code: lines.join('\n') }
}

export default function AdminQuizzes() {
  const [quizzes, setQuizzes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'upload'>('list')
  const [selectedQuizIds, setSelectedQuizIds] = useState<Set<string>>(new Set())
  const [deletingQuizzes, setDeletingQuizzes] = useState(false)
  
  // Age Filter State
  const [ageFilter, setAgeFilter] = useState<'all' | 'kids' | 'teens' | 'adults'>('all')

  // View Quiz State
  const [viewingQuiz, setViewingQuiz] = useState<any | null>(null)
  const [quizQuestions, setQuizQuestions] = useState<any[]>([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)

  // Manual Creation State
  const [category, setCategory] = useState('')
  const [manualQuizTitle, setManualQuizTitle] = useState('')
  const [difficulty, setDifficulty] = useState('normal')
  const [ageCategory, setAgeCategory] = useState('teens')
  const [manualTimer, setManualTimer] = useState(15)
  const [manualQuestions, setManualQuestions] = useState<ManualQuestionDraft[]>([createEmptyManualQuestion()])
  const [manualPublishMode, setManualPublishMode] = useState<QuizPublishMode>('publish')
  const [manualScheduledAt, setManualScheduledAt] = useState('')
  const [publishingQuizId, setPublishingQuizId] = useState<string | null>(null)
  const [editingPublication, setEditingPublication] = useState<any | null>(null)
  const [editingPublishMode, setEditingPublishMode] = useState<QuizPublishMode>('draft')
  const [editingScheduledAt, setEditingScheduledAt] = useState('')

  // Upload State
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null)
  
  // File vs Paste State
  const [uploadMode, setUploadMode] = useState<'file' | 'paste'>('file')
  const [pastedText, setPastedText] = useState('')

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload Settings State
  const [uploadCategory, setUploadCategory] = useState('')
  const [uploadDifficulty, setUploadDifficulty] = useState('normal')
  const [uploadAgeCategory, setUploadAgeCategory] = useState('teens')
  const [uploadTimer, setUploadTimer] = useState(15)
  const [uploadPublishMode, setUploadPublishMode] = useState<QuizPublishMode>('publish')
  const [uploadScheduledAt, setUploadScheduledAt] = useState('')

  const fetchQuizzes = async () => {
    const { data } = await supabase.from('quizzes').select('*, questions(count)').order('created_at', { ascending: false })
    if (data) setQuizzes(data)
    setLoading(false)
  }

  useEffect(() => { fetchQuizzes() }, [])

  // Auto-dismiss the success message after 5 seconds
  useEffect(() => {
    if (uploadStatus?.type === 'success') {
      const timer = setTimeout(() => {
        setUploadStatus(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [uploadStatus]);

  const handleTabChange = (tab: 'list' | 'create' | 'upload') => {
    setActiveTab(tab);
    if (tab === 'upload') {
      setUploadStatus(null); 
    }
  }

  const generateHash = (text: string) => {
    let hash = 0
    const str = text.toLowerCase().replace(/\s+/g, '')
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return 'hash_' + Math.abs(hash).toString(16)
  }

  const updateManualQuestion = (index: number, updates: Partial<ManualQuestionDraft>) => {
    setManualQuestions(current => current.map((question, questionIndex) =>
      questionIndex === index ? { ...question, ...updates } : question
    ))
  }

  const updateManualOption = (questionIndex: number, optionIndex: number, value: string) => {
    setManualQuestions(current => current.map((question, index) =>
      index === questionIndex
        ? { ...question, options: question.options.map((option, i) => i === optionIndex ? value : option) }
        : question
    ))
  }

  const handleViewQuiz = async (quiz: any) => {
    setViewingQuiz(quiz)
    setLoadingQuestions(true)
    
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quiz.id)
      
    if (!error && data) {
      setQuizQuestions(data)
    }
    setLoadingQuestions(false)
  }

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const finalCategory = category.trim() || 'General Knowledge'
    const autoTitle = `Quiz 1: ${manualQuizTitle.trim()}`
    const questionsToPublish = manualQuestions.map(question => {
      const questionText = question.questionText.trim()
      const options = question.options.map(option => option.trim())
      const correctAnswer = question.correctAnswer.trim()

      return {
        question_text: questionText,
        options,
        correct_answer: correctAnswer,
        hint: question.hint.trim() || null,
        qHash: generateHash(`${questionText}|${[...options].sort().join('|')}`)
      }
    })

    try {
      const publication = getQuizPublication(manualPublishMode, manualScheduledAt)

      if (questionsToPublish.some(question =>
        !question.question_text ||
        question.options.length !== 4 ||
        question.options.some(option => !option)
      )) {
        throw new Error('Complete the question text and all four options for every question.')
      }

      if (questionsToPublish.some(question => !question.options.includes(question.correct_answer))) {
        throw new Error('Each correct answer must exactly match one of its four options.')
      }

      const questionHashes = questionsToPublish.map(question => question.qHash)
      if (new Set(questionHashes).size !== questionHashes.length) {
        throw new Error('Duplicate questions detected in this quiz. Please remove or edit the duplicates.')
      }

      const { data: existingQuestions, error: existingQuestionsError } = await supabase
        .from('questions')
        .select('explanation')
        .in('explanation', questionHashes)
      if (existingQuestionsError) throw existingQuestionsError
      if (existingQuestions?.length) {
        throw new Error('One or more questions already exist in the database. Please remove or edit the duplicates.')
      }

      const { data: quizData, error: quizError } = await supabase.from('quizzes').insert({
        title: autoTitle, 
        category: finalCategory, 
        difficulty, 
        age_category: ageCategory, 
        ...publication,
        time_limit_seconds: manualTimer 
      }).select().single()
      if (quizError) throw quizError

      const { error: qError } = await supabase.from('questions').insert(
        questionsToPublish.map(question => ({
          quiz_id: quizData.id,
          question_text: question.question_text,
          options: question.options,
          correct_answer: question.correct_answer,
          hint: question.hint,
          points: 10,
          explanation: question.qHash
        }))
      )
      if (qError) throw qError

      setUploadStatus({
        type: 'success',
        msg: `Quiz ${getPublicationSummary(publication)} with ${questionsToPublish.length} questions.`
      })
      
      setActiveTab('list')
      setManualQuestions([createEmptyManualQuestion()])
      setCategory('')
      setManualQuizTitle('')
      setManualPublishMode('publish')
      setManualScheduledAt('')
      await fetchQuizzes()
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setUploadStatus(null) 
    }
  }

  const processTextData = async (text: string) => {
    try {
      const publication = getQuizPublication(uploadPublishMode, uploadScheduledAt)

      const cleanHeading = (line: string) => line
        .trim()
        .replace(/^#{1,6}\s*/, '')
        .replace(/^\*{1,2}/, '')
        .replace(/\*{1,2}$/, '')
        .trim()
      const getQuizHeading = (lines: string[], index: number) => {
        const line = cleanHeading(lines[index])
        const inlineHeading = line.match(/^(?:Quiz|Pagsusulit)\s+(\d+)\s*:\s*(.*)$/i)
        if (inlineHeading) return inlineHeading

        if (/^(?:Quiz|Pagsusulit)$/i.test(line) && index + 1 < lines.length) {
          return cleanHeading(lines[index + 1]).match(/^(\d+)\s*:\s*(.*)$/)
        }

        return null
      }

      const allLines = text.replace(/\r\n?/g, '\n').split('\n')
      const quizBlocks: string[][] = []
      let currentQuizLines: string[] = []
      let insideCodeFence = false

      for (let lineIndex = 0; lineIndex < allLines.length; lineIndex++) {
        const line = allLines[lineIndex]
        const startsCodeFence = /^\s*(```|~~~)/.test(line)
        const isQuizHeading = !insideCodeFence && getQuizHeading(allLines, lineIndex)

        if (isQuizHeading && currentQuizLines.length > 0) {
          quizBlocks.push(currentQuizLines)
          currentQuizLines = []
        }

        currentQuizLines.push(line)
        if (startsCodeFence) insideCodeFence = !insideCodeFence
      }
      if (currentQuizLines.some(line => line.trim())) quizBlocks.push(currentQuizLines)

      let totalQuestionsAdded = 0
      let totalQuestionsSkipped = 0
      let totalQuizzesAdded = 0
      const uploadCategoryOverride = uploadCategory.trim()

      for (const quizLines of quizBlocks) {
        const quizHeading = quizLines
          .map((_, index) => getQuizHeading(quizLines, index))
          .find(Boolean)
        const quizNumber = quizHeading?.[1]
        const quizName = quizHeading?.[2]?.trim()
        const quizCategory = uploadCategoryOverride || quizName || 'General Knowledge'
        const questionBlocks: string[][] = []
        let currentQuestionLines: string[] | null = null
        let currentQuestionHasAnswer = false
        insideCodeFence = false

        for (const line of quizLines) {
          const startsCodeFence = /^\s*(```|~~~)/.test(line)
          const questionHeading = !insideCodeFence &&
            cleanHeading(line).match(/^(?:(?:Question|Tanong)\s*|Q\s*)(\d+)\s*[.:]?\s*(.*)$/i)

          if (questionHeading && (!currentQuestionLines || currentQuestionHasAnswer)) {
            if (currentQuestionLines) questionBlocks.push(currentQuestionLines)
            currentQuestionLines = [questionHeading[2]]
            currentQuestionHasAnswer = false
          } else if (currentQuestionLines) {
            currentQuestionLines.push(line)
            if (!insideCodeFence && /^\s*(?:Answer|Sagot)\s*:/i.test(line)) {
              currentQuestionHasAnswer = true
            }
          }

          if (startsCodeFence) insideCodeFence = !insideCodeFence
        }
        if (currentQuestionLines) questionBlocks.push(currentQuestionLines)

        const parsedQuestions = []

        for (const qBlock of questionBlocks) {
          const questionTextLines: string[] = []
          const optionLines: string[][] = [[], [], [], []]
          const hintLines: string[] = []
          let currentOptionIndex = -1
          let readingHint = false
          let answerLetter = 'A'
          let inQuestionCodeFence = false

          for (let lineIndex = 0; lineIndex < qBlock.length; lineIndex++) {
            const line = qBlock[lineIndex]
            const startsCodeFence = /^\s*(```|~~~)/.test(line)

            if (!inQuestionCodeFence) {
              const optionMatch = line.match(/^\s*([A-D])(?:[.)]\s*(.*)|\s*)$/i)
              const hintMatch = line.match(/^\s*Hint\s*:?\s*(.*)$/i)
              const answerMatch = line.match(/^\s*(?:Answer|Sagot)\s*:\s*([A-D])(?:\s*[.)-]\s*.*)?\s*$/i)

              if (optionMatch && (optionMatch[2] || qBlock[lineIndex + 1]?.trim())) {
                currentOptionIndex = optionMatch[1].toUpperCase().charCodeAt(0) - 65
                if (optionMatch[2]) {
                  optionLines[currentOptionIndex].push(optionMatch[2])
                } else {
                  const nextLine = qBlock[lineIndex + 1]
                  if (nextLine?.trim() && !/^\s*(?:[A-D](?:\.|\))?|Hint|Answer|Sagot)\b/i.test(nextLine)) {
                    optionLines[currentOptionIndex].push(nextLine)
                    lineIndex++
                  }
                }
                readingHint = false
              } else if (hintMatch) {
                if (hintMatch[1]) hintLines.push(hintMatch[1])
                readingHint = true
                currentOptionIndex = -1
              } else if (answerMatch) {
                answerLetter = answerMatch[1].toUpperCase()
                readingHint = false
                currentOptionIndex = -1
              } else if (readingHint) {
                hintLines.push(line)
              } else if (currentOptionIndex >= 0) {
                optionLines[currentOptionIndex].push(line)
              } else {
                questionTextLines.push(line)
              }
            } else if (currentOptionIndex >= 0) {
              optionLines[currentOptionIndex].push(line)
            } else {
              questionTextLines.push(line)
            }

            if (startsCodeFence) inQuestionCodeFence = !inQuestionCodeFence
          }

          const question_text = questionTextLines.join('\n').trim()
          const options = optionLines.map(option => option.join('\n').trim())
          const hint = hintLines.join('\n').trim() || null
          
          const letterIndex = answerLetter.charCodeAt(0) - 65 
          const correct_answer = options[letterIndex] || ''

          if (question_text && options.every(Boolean) && correct_answer) {
            const qHash = generateHash(`${question_text}|${[...options].sort().join('|')}`)
            
            const { data: existing } = await supabase
              .from('questions')
              .select('id')
              .eq('explanation', qHash)
              .maybeSingle()

            if (existing) {
              totalQuestionsSkipped++
            } else {
              parsedQuestions.push({ question_text, options, correct_answer, hint, qHash })
            }
          }
        }

        if (parsedQuestions.length > 0) {
          const autoTitle = quizName
            ? `Quiz ${quizNumber}: ${quizName}`
            : `${quizCategory} Quiz ${totalQuizzesAdded + 1} - ${new Date().toLocaleDateString()}`
          
          const { data: quizData, error: quizErr } = await supabase.from('quizzes').insert({
            title: autoTitle, 
            category: quizCategory,
            difficulty: uploadDifficulty, 
            age_category: uploadAgeCategory, 
            ...publication,
            time_limit_seconds: uploadTimer
          }).select().single()

          if (quizErr) throw quizErr

          const questionsToInsert = parsedQuestions.map(q => ({
            quiz_id: quizData.id,
            question_text: q.question_text,
            options: q.options,
            correct_answer: q.correct_answer,
            hint: q.hint,
            points: 10,
            explanation: q.qHash
          }))

          const { error: qErr } = await supabase.from('questions').insert(questionsToInsert)
          if (qErr) throw qErr

          totalQuestionsAdded += parsedQuestions.length
          totalQuizzesAdded++
        }
      }

      if (totalQuizzesAdded === 0 && totalQuestionsSkipped === 0) {
        throw new Error("Could not find any valid questions. Please check the format.")
      }

      if (totalQuizzesAdded === 0 && totalQuestionsSkipped > 0) {
        setUploadStatus({ type: 'error', msg: `All ${totalQuestionsSkipped} questions in this file are duplicates and were skipped!` })
      } else {
        setUploadStatus({ 
          type: 'success', 
          msg: `Imported ${totalQuizzesAdded} quiz(zes) ${getPublicationSummary(publication)} with ${totalQuestionsAdded} questions. ${totalQuestionsSkipped > 0 ? `(${totalQuestionsSkipped} duplicates skipped)` : ''}`
        })
      }
      
      setSelectedFile(null)
      setPastedText('')
      setUploadCategory('')
      setUploadPublishMode('publish')
      setUploadScheduledAt('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      
      await fetchQuizzes()
    } catch (err: any) {
      setUploadStatus({ type: 'error', msg: err.message || 'Failed to parse document.' })
    } finally {
      setUploading(false)
    }
  }

  const handleProcessUpload = () => {
    if (uploadMode === 'file') {
      if (!selectedFile) return
      setUploading(true)
      setUploadStatus(null)
      
      const reader = new FileReader()
      reader.onload = async (event) => {
        const text = event.target?.result as string
        await processTextData(text)
      }
      reader.readAsText(selectedFile)
    } else {
      if (!pastedText.trim()) return
      setUploading(true)
      setUploadStatus(null)
      processTextData(pastedText)
    }
  }

  const handleDeleteQuizzes = async (ids: string[], confirmationMessage: string) => {
    if (ids.length === 0 || !confirm(confirmationMessage)) return

    setDeletingQuizzes(true)
    try {
      const { error: questionsError } = await supabase
        .from('questions')
        .delete()
        .in('quiz_id', ids)
      if (questionsError) throw questionsError

      const { error: quizzesError } = await supabase
        .from('quizzes')
        .delete()
        .in('id', ids)
      if (quizzesError) throw quizzesError

      setSelectedQuizIds(current => {
        const remaining = new Set(current)
        ids.forEach(id => remaining.delete(id))
        return remaining
      })
      if (viewingQuiz && ids.includes(viewingQuiz.id)) setViewingQuiz(null)
      await fetchQuizzes()
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : String(error)
      alert(`Failed to delete quiz${ids.length === 1 ? '' : 'zes'}: ${message}`)
    } finally {
      setDeletingQuizzes(false)
    }
  }

  const handleDeleteQuiz = (id: string) => {
    handleDeleteQuizzes([id], "Are you sure you want to delete this quiz and its questions? This action cannot be undone.")
  }

  const handlePublishQuizNow = async (id: string) => {
    setPublishingQuizId(id)
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .update({ status: 'published', scheduled_at: null })
        .eq('id', id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('No quiz was updated. Refresh the list and check that your admin access is active.')

      await fetchQuizzes()
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : String(error)
      alert(`Failed to publish quiz: ${message}`)
    } finally {
      setPublishingQuizId(null)
    }
  }

  const openPublicationEditor = (quiz: any) => {
    setEditingPublication(quiz)
    setEditingPublishMode(
      quiz.status === 'published' ? 'publish' : quiz.scheduled_at ? 'schedule' : 'draft'
    )
    setEditingScheduledAt(toLocalDateTimeInputValue(quiz.scheduled_at))
  }

  const handleSavePublication = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingPublication) return

    setPublishingQuizId(editingPublication.id)
    try {
      const publication = getQuizPublication(editingPublishMode, editingScheduledAt)
      const { data, error } = await supabase
        .from('quizzes')
        .update(publication)
        .eq('id', editingPublication.id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('No quiz was updated. Check that the scheduling SQL was applied and your admin access is active.')

      setEditingPublication(null)
      await fetchQuizzes()
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : String(error)
      alert(`Failed to update quiz publishing: ${message}`)
    } finally {
      setPublishingQuizId(null)
    }
  }

  const toggleQuizSelection = (id: string) => {
    setSelectedQuizIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleVisibleQuizSelection = () => {
    const visibleIds = filteredQuizzes.map(quiz => quiz.id)
    const allVisibleSelected = visibleIds.every(id => selectedQuizIds.has(id))
    setSelectedQuizIds(current => {
      const next = new Set(current)
      visibleIds.forEach(id => {
        if (allVisibleSelected) next.delete(id)
        else next.add(id)
      })
      return next
    })
  }

  const filteredQuizzes = quizzes.filter(q => 
    ageFilter === 'all' ? true : q.age_category === ageFilter
  )

  const quizCounts = quizzes.reduce((acc, q) => {
    if (q.age_category === 'kids') acc.kids++
    else if (q.age_category === 'teens') acc.teens++
    else if (q.age_category === 'adults') acc.adults++
    return acc
  }, { kids: 0, teens: 0, adults: 0 })

  return (
    <div className="relative z-10 max-w-6xl mx-auto sm:p-4 md:p-0 admin-page-enter">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Quiz Manager</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">Create new quizzes, upload from documents, or manage existing content.</p>
        </div>
      </div>

      {/* PREMIUM TABS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 md:mb-8">
        <button 
          onClick={() => handleTabChange('list')} 
          className={`flex items-center sm:items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border transition-all text-left ${
            activeTab === 'list' ? 'bg-[#ccff00]/10 border-[#ccff00]/50 shadow-[0_0_20px_rgba(204,255,0,0.1)]' : 'bg-[#0f1014] border-white/10 hover:border-white/20 hover:bg-white/5'
          }`}
        >
          <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${activeTab === 'list' ? 'bg-[#ccff00] text-black' : 'bg-white/5 text-gray-400'}`}>
            <ListDashesIcon weight="bold" size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div>
            <h3 className={`font-bold text-sm sm:text-lg ${activeTab === 'list' ? 'text-[#ccff00]' : 'text-white'}`}>All Quizzes</h3>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1 hidden sm:block">View, manage, and delete existing quizzes.</p>
          </div>
        </button>

        <button 
          onClick={() => handleTabChange('create')} 
          className={`flex items-center sm:items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border transition-all text-left ${
            activeTab === 'create' ? 'bg-[#00f0ff]/10 border-[#00f0ff]/50 shadow-[0_0_20px_rgba(0,240,255,0.1)]' : 'bg-[#0f1014] border-white/10 hover:border-white/20 hover:bg-white/5'
          }`}
        >
          <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${activeTab === 'create' ? 'bg-[#00f0ff] text-black' : 'bg-white/5 text-gray-400'}`}>
            <PlusIcon weight="bold" size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div>
            <h3 className={`font-bold text-sm sm:text-lg ${activeTab === 'create' ? 'text-[#00f0ff]' : 'text-white'}`}>Create Manual</h3>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1 hidden sm:block">Write a new question and publish instantly.</p>
          </div>
        </button>

        <button 
          onClick={() => handleTabChange('upload')} 
          className={`flex items-center sm:items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border transition-all text-left ${
            activeTab === 'upload' ? 'bg-[#ff00a0]/10 border-[#ff00a0]/50 shadow-[0_0_20px_rgba(255,0,160,0.1)]' : 'bg-[#0f1014] border-white/10 hover:border-white/20 hover:bg-white/5'
          }`}
        >
          <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${activeTab === 'upload' ? 'bg-[#ff00a0] text-black' : 'bg-white/5 text-gray-400'}`}>
            <UploadSimpleIcon weight="bold" size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div>
            <h3 className={`font-bold text-sm sm:text-lg ${activeTab === 'upload' ? 'text-[#ff00a0]' : 'text-white'}`}>Bulk Upload</h3>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1 hidden sm:block">Import multiple quizzes from a text file or paste text.</p>
          </div>
        </button>
      </div>

      {/* --- TAB 1: LIST QUIZZES --- */}
      {activeTab === 'list' && (
        <div className="bg-transparent sm:bg-[#0f1014] sm:border sm:border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl animate-fade-in">
          
          {/* QUIZ COUNTS STATS */}
          <div className="grid grid-cols-3 divide-x divide-white/10 border-b border-white/10 bg-black/20">
            <div className="p-4 flex flex-col items-center justify-center text-center hover:bg-white/5 transition">
              <div className="flex items-center gap-1.5 text-green-400 mb-1">
                <BabyIcon size={16} weight="fill" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Kids</span>
              </div>
              <p className="text-2xl font-black text-white">{quizCounts.kids}</p>
            </div>
            
            <div className="p-4 flex flex-col items-center justify-center text-center hover:bg-white/5 transition">
              <div className="flex items-center gap-1.5 text-yellow-400 mb-1">
                <UserIcon size={16} weight="fill" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Teens</span>
              </div>
              <p className="text-2xl font-black text-white">{quizCounts.teens}</p>
            </div>

            <div className="p-4 flex flex-col items-center justify-center text-center hover:bg-white/5 transition">
              <div className="flex items-center gap-1.5 text-[#00f0ff] mb-1">
                <UsersThreeIcon size={16} weight="fill" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Adults</span>
              </div>
              <p className="text-2xl font-black text-white">{quizCounts.adults}</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="p-4 border-b border-white/10 bg-black/20 flex flex-wrap gap-2">
            {['all', 'kids', 'teens', 'adults'].map((tier) => (
              <button
                key={tier}
                onClick={() => setAgeFilter(tier as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  ageFilter === tier 
                    ? 'bg-white text-black shadow-lg scale-105' 
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tier === 'all' ? 'All Quizzes' : tier}
              </button>
            ))}
          </div>

          <div className="p-4 border-b border-white/10 bg-black/10 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleVisibleQuizSelection}
              disabled={filteredQuizzes.length === 0 || deletingQuizzes}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {filteredQuizzes.length > 0 && filteredQuizzes.every(quiz => selectedQuizIds.has(quiz.id))
                ? 'Deselect visible'
                : 'Select visible'}
            </button>
            <button
              type="button"
              onClick={() => handleDeleteQuizzes(
                Array.from(selectedQuizIds),
                `Delete ${selectedQuizIds.size} selected quiz${selectedQuizIds.size === 1 ? '' : 'zes'} and their questions? This action cannot be undone.`
              )}
              disabled={selectedQuizIds.size === 0 || deletingQuizzes}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="inline-flex items-center gap-1.5">
                <TrashIcon size={14} weight="bold" />
                Delete selected ({selectedQuizIds.size})
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleDeleteQuizzes(
                quizzes.map(quiz => quiz.id),
                `Delete all ${quizzes.length} quizzes and their questions? This action cannot be undone.`
              )}
              disabled={quizzes.length === 0 || deletingQuizzes}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Delete all ({quizzes.length})
            </button>
          </div>

          {loading ? (
             <div className="py-20 text-center bg-[#0f1014] rounded-2xl">
               <p className="text-[#ccff00] font-mono animate-pulse tracking-widest text-sm">LOADING DATABASE...</p>
             </div>
          ) : filteredQuizzes.length === 0 ? (
            <div className="py-20 sm:py-24 text-center px-4 bg-[#0f1014] rounded-2xl border border-white/10 sm:border-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/5 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-4">
                <GameControllerIcon weight="duotone" className="w-8 h-8 sm:w-10 sm:h-10 text-gray-600" />
              </div>
              <p className="text-white font-bold text-base sm:text-lg mb-1">No Quizzes Found</p>
              <p className="text-gray-500 text-xs sm:text-sm mb-6 max-w-xs mx-auto">
                No quizzes match the "{ageFilter}" filter. Try selecting a different category or create a new quiz.
              </p>
              <button onClick={() => handleTabChange('create')} className="bg-[#ccff00] text-black px-6 py-2.5 rounded-xl font-bold hover:bg-white transition text-sm">
                Create New Quiz
              </button>
            </div>
          ) : (
            <>
              <div className="hidden sm:block overflow-x-auto admin-custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead className="bg-black/40 border-b border-white/10 text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                    <tr>
                      <th className="py-4 pl-6 pr-2">
                        <span className="sr-only">Select quiz</span>
                      </th>
                      <th className="py-4 px-6">Quiz Details</th>
                      <th className="py-4 px-4">Status</th>
                      <th className="py-4 px-4">Tier / Difficulty</th>
                      <th className="py-4 px-4 text-center">Questions</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredQuizzes.map(q => (
                      <tr key={q.id} className="hover:bg-white/[0.02] transition group">
                        <td className="py-4 pl-6 pr-2">
                          <input
                            type="checkbox"
                            aria-label={`Select ${q.title}`}
                            checked={selectedQuizIds.has(q.id)}
                            onChange={() => toggleQuizSelection(q.id)}
                            disabled={deletingQuizzes}
                            className="h-4 w-4 accent-[#ccff00]"
                          />
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00f0ff]/20 to-blue-600/20 border border-[#00f0ff]/30 flex items-center justify-center shrink-0">
                              <GameControllerIcon weight="fill" className="text-[#00f0ff] w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-white text-sm group-hover:text-[#00f0ff] transition line-clamp-1">{q.title}</p>
                              <p className="text-xs text-[#ff00a0] font-semibold">{q.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              q.status === 'published'
                                ? 'border-green-500/20 bg-green-500/10 text-green-400'
                                : q.scheduled_at
                                  ? 'border-[#ff9500]/20 bg-[#ff9500]/10 text-[#ff9500]'
                                  : 'border-white/10 bg-white/5 text-gray-400'
                            }`}>
                              {q.status === 'published' ? 'Published' : q.scheduled_at ? 'Scheduled' : 'Draft'}
                            </span>
                            {q.scheduled_at && q.status !== 'published' && (
                              <span className="text-[10px] text-gray-500">{new Date(q.scheduled_at).toLocaleString()}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                              q.age_category === 'kids' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                              q.age_category === 'teens' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                              'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/20'
                            }`}>
                              {q.age_category}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                              q.difficulty === 'hard' ? 'text-[#ff00a0]' :
                              q.difficulty === 'intermediate' ? 'text-[#ff9500]' :
                              'text-[#ccff00]'
                            }`}>
                              {q.difficulty}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center gap-1.5 bg-black/50 text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-white/5">
                            <FileTextIcon /> {q.questions?.[0]?.count || 0}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openPublicationEditor(q)}
                              disabled={publishingQuizId !== null}
                              className="rounded-xl bg-[#ff9500]/10 p-2.5 text-[#ff9500] transition hover:bg-[#ff9500]/20 disabled:opacity-40"
                              title="Change publishing status"
                            >
                              <ClockIcon size={20} weight="bold" />
                            </button>
                            {q.status !== 'published' && (
                              <button
                                onClick={() => handlePublishQuizNow(q.id)}
                                disabled={publishingQuizId !== null}
                                className="rounded-xl bg-green-500/10 p-2.5 text-green-400 transition hover:bg-green-500/20 disabled:opacity-40"
                                title="Publish Quiz Now"
                              >
                                <CheckCircleIcon size={20} weight="bold" />
                              </button>
                            )}
                            <button onClick={() => handleViewQuiz(q)} className="p-2.5 text-[#00f0ff] bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 rounded-xl transition" title="View Quiz Questions">
                              <EyeIcon size={20} weight="bold" />
                            </button>
                            <button onClick={() => handleDeleteQuiz(q.id)} disabled={deletingQuizzes} className="p-2.5 text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-xl transition disabled:opacity-40" title="Delete Quiz">
                              <TrashIcon size={20} weight="bold" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="sm:hidden flex flex-col gap-3 p-3">
                {filteredQuizzes.map(q => (
                  <div key={q.id} className="bg-[#0f1014] border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${q.title}`}
                        checked={selectedQuizIds.has(q.id)}
                        onChange={() => toggleQuizSelection(q.id)}
                        disabled={deletingQuizzes}
                        className="mt-1 h-4 w-4 accent-[#ccff00]"
                      />
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00f0ff]/20 to-blue-600/20 border border-[#00f0ff]/30 flex items-center justify-center shrink-0">
                        <GameControllerIcon weight="fill" className="text-[#00f0ff] w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-sm line-clamp-2 leading-tight">{q.title}</p>
                        <p className="text-[10px] text-[#ff00a0] font-semibold mt-1">{q.category}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            q.status === 'published'
                              ? 'border-green-500/20 bg-green-500/10 text-green-400'
                              : q.scheduled_at
                                ? 'border-[#ff9500]/20 bg-[#ff9500]/10 text-[#ff9500]'
                                : 'border-white/10 bg-white/5 text-gray-400'
                          }`}>
                            {q.status === 'published' ? 'Published' : q.scheduled_at ? 'Scheduled' : 'Draft'}
                          </span>
                          {q.scheduled_at && q.status !== 'published' && (
                            <span className="text-[9px] text-gray-500">{new Date(q.scheduled_at).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-1 flex flex-col gap-3 border-t border-white/5 pt-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                          q.age_category === 'kids' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                          q.age_category === 'teens' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                          'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/20'
                        }`}>
                          {q.age_category}
                        </span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${
                          q.difficulty === 'hard' ? 'text-[#ff00a0]' :
                          q.difficulty === 'intermediate' ? 'text-[#ff9500]' :
                          'text-[#ccff00]'
                        }`}>
                          {q.difficulty}
                        </span>
                        <span className="inline-flex items-center gap-1 text-gray-400 text-[10px] bg-black/50 px-2 py-0.5 rounded-md border border-white/5">
                          <FileTextIcon size={10} /> {q.questions?.[0]?.count || 0}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openPublicationEditor(q)}
                          disabled={publishingQuizId !== null}
                          className="rounded-lg bg-[#ff9500]/10 p-2 text-[#ff9500] disabled:opacity-40"
                          title="Change publishing status"
                        >
                          <ClockIcon size={16} weight="bold" />
                        </button>
                        {q.status !== 'published' && (
                          <button
                            onClick={() => handlePublishQuizNow(q.id)}
                            disabled={publishingQuizId !== null}
                            className="rounded-lg bg-green-500/10 p-2 text-green-400 disabled:opacity-40"
                            title="Publish Quiz Now"
                          >
                            <CheckCircleIcon size={16} weight="bold" />
                          </button>
                        )}
                        <button onClick={() => handleViewQuiz(q)} className="p-2 text-[#00f0ff] bg-[#00f0ff]/10 rounded-lg">
                          <EyeIcon size={16} weight="bold" />
                        </button>
                        <button onClick={() => handleDeleteQuiz(q.id)} disabled={deletingQuizzes} className="p-2 text-red-400 bg-red-400/10 rounded-lg disabled:opacity-40">
                          <TrashIcon size={16} weight="bold" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* --- TAB 2: MANUAL CREATE --- */}
      {activeTab === 'create' && (
        <form onSubmit={handleManualCreate} className="bg-[#0f1014] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-10 shadow-2xl animate-fade-in max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-white/10">
            <div className="p-2 sm:p-3 bg-[#00f0ff]/20 text-[#00f0ff] rounded-lg sm:rounded-xl">
              <PlusIcon weight="bold" size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Create New Quiz</h2>
              <p className="text-[10px] sm:text-xs text-gray-400">Add as many questions as you need before publishing.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div>
              <label className="text-[10px] sm:text-xs text-gray-400 font-bold mb-1.5 sm:mb-2 block uppercase tracking-wider">Quiz Header</label>
              <input required placeholder="e.g. Introduction to Java" value={manualQuizTitle} onChange={e => setManualQuizTitle(e.target.value)} className="w-full bg-black/50 border border-white/10 p-3 sm:p-3.5 rounded-lg sm:rounded-xl text-white outline-none focus:border-[#00f0ff] transition text-sm" />
              <p className="text-[10px] text-gray-500 mt-1.5">Published as Quiz 1: [header]</p>
            </div>
            <div>
              <label className="text-[10px] sm:text-xs text-gray-400 font-bold mb-1.5 sm:mb-2 block uppercase tracking-wider">Category</label>
              <input required placeholder="e.g. Pop Culture, Science..." value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-black/50 border border-white/10 p-3 sm:p-3.5 rounded-lg sm:rounded-xl text-white outline-none focus:border-[#00f0ff] transition text-sm" />
            </div>
            <div>
              <label className="text-[10px] sm:text-xs text-gray-400 font-bold mb-1.5 sm:mb-2 block uppercase tracking-wider">Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full bg-black/50 border border-white/10 p-3 sm:p-3.5 rounded-lg sm:rounded-xl text-white outline-none focus:border-[#00f0ff] transition text-sm">
                <option value="normal">Normal</option><option value="intermediate">Intermediate</option><option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] sm:text-xs text-gray-400 font-bold mb-1.5 sm:mb-2 block uppercase tracking-wider">Age Category</label>
              <select value={ageCategory} onChange={e => setAgeCategory(e.target.value)} className="w-full bg-black/50 border border-white/10 p-3 sm:p-3.5 rounded-lg sm:rounded-xl text-white outline-none focus:border-[#00f0ff] transition text-sm">
                <option value="kids">Kids</option><option value="teens">Teens</option><option value="adults">Adults</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] sm:text-xs text-gray-400 font-bold mb-1.5 sm:mb-2 block uppercase tracking-wider">Timer (Seconds)</label>
              <input type="number" min="5" max="120" value={manualTimer} onChange={e => setManualTimer(parseInt(e.target.value))} className="w-full bg-black/50 border border-white/10 p-3 sm:p-3.5 rounded-lg sm:rounded-xl text-white outline-none focus:border-[#00f0ff] transition text-sm" />
            </div>
          </div>

          <QuizPublishingOptions
            mode={manualPublishMode}
            scheduledAt={manualScheduledAt}
            onModeChange={setManualPublishMode}
            onScheduledAtChange={setManualScheduledAt}
            accent="cyan"
          />

          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <SparkleIcon className="text-[#ccff00]" /> Questions ({manualQuestions.length})
            </h3>
            <button
              type="button"
              onClick={() => setManualQuestions(current => [...current, createEmptyManualQuestion()])}
              className="inline-flex items-center gap-2 bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/20 px-3 py-2 rounded-lg font-bold text-xs sm:text-sm hover:bg-[#00f0ff]/20 transition"
            >
              <PlusIcon weight="bold" size={16} /> Add Question
            </button>
          </div>

          <div className="space-y-4 mb-6 sm:mb-8">
            {manualQuestions.map((question, questionIndex) => (
              <section key={questionIndex} className="bg-black/30 p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl border border-white/5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h4 className="text-sm font-bold text-white">Question {questionIndex + 1}</h4>
                  {manualQuestions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setManualQuestions(current => current.filter((_, index) => index !== questionIndex))}
                      className="inline-flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs font-bold"
                      aria-label={`Remove question ${questionIndex + 1}`}
                    >
                      <TrashIcon size={16} /> Remove
                    </button>
                  )}
                </div>

                <label className="text-[10px] sm:text-xs text-gray-400 font-bold mb-1.5 sm:mb-2 block uppercase tracking-wider">Question Text</label>
                <input required placeholder="e.g. What is the capital of France?" value={question.questionText} onChange={e => updateManualQuestion(questionIndex, { questionText: e.target.value })} className="w-full bg-[#0f1014] border border-white/10 p-3 sm:p-4 rounded-lg sm:rounded-xl text-white outline-none focus:border-[#ccff00] mb-4 sm:mb-6 text-sm sm:text-lg font-medium" />

                <label className="text-[10px] sm:text-xs text-gray-400 font-bold mb-1.5 sm:mb-2 block uppercase tracking-wider">Options (4 Required)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                  {question.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="relative">
                      <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">{String.fromCharCode(65 + optionIndex)}.</span>
                      <input required placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`} value={option} onChange={e => updateManualOption(questionIndex, optionIndex, e.target.value)} className="w-full bg-[#0f1014] border border-white/10 p-3 pl-8 sm:p-3.5 sm:pl-10 rounded-lg sm:rounded-xl text-white outline-none focus:border-white/30 text-sm" />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-[10px] sm:text-xs text-yellow-500 font-bold mb-1.5 sm:mb-2 block uppercase tracking-wider">Hint (Optional)</label>
                    <input placeholder="A clue for the player..." value={question.hint} onChange={e => updateManualQuestion(questionIndex, { hint: e.target.value })} className="w-full bg-yellow-500/5 border border-yellow-500/20 text-yellow-400 p-3 sm:p-4 rounded-lg sm:rounded-xl outline-none focus:border-yellow-500/50 transition placeholder-yellow-500/30 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-xs text-green-500 font-bold mb-1.5 sm:mb-2 block uppercase tracking-wider">Correct Answer</label>
                    <input required placeholder="Must match an option exactly" value={question.correctAnswer} onChange={e => updateManualQuestion(questionIndex, { correctAnswer: e.target.value })} className="w-full bg-green-500/10 border border-green-500/30 text-green-400 p-3 sm:p-4 rounded-lg sm:rounded-xl font-bold outline-none focus:border-green-500 transition placeholder-green-500/30 text-sm" />
                  </div>
                </div>
              </section>
            ))}
          </div>

          <button type="submit" disabled={loading} className="bg-[#ccff00] text-black px-6 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-xl font-black text-base sm:text-lg w-full hover:bg-white transition shadow-[0_0_30px_rgba(204,255,0,0.2)] hover:scale-[1.01] transform duration-200 disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? 'Saving...' : `${manualPublishMode === 'draft' ? 'Save Draft' : manualPublishMode === 'schedule' ? 'Schedule Quiz' : 'Publish Quiz'} (${manualQuestions.length} ${manualQuestions.length === 1 ? 'Question' : 'Questions'})`}
          </button>
        </form>
      )}

      {/* --- TAB 3: DOCUMENT UPLOAD --- */}
      {activeTab === 'upload' && (
        <div className="bg-[#0f1014] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-10 shadow-2xl animate-fade-in max-w-5xl mx-auto">
          
          <div className="flex items-center gap-3 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-white/10">
            <div className="p-2 sm:p-3 bg-[#ff00a0]/20 text-[#ff00a0] rounded-lg sm:rounded-xl">
              <UploadSimpleIcon weight="bold" size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Bulk Upload</h2>
              <p className="text-[10px] sm:text-xs text-gray-400">Import multiple quizzes and questions instantly.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">
            
            {/* LEFT: SETTINGS & UPLOAD */}
            <div>
              <div className="mb-4 sm:mb-6 p-4 sm:p-5 bg-black/30 border border-white/5 rounded-xl sm:rounded-2xl">
                <h3 className="text-xs sm:text-sm font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
                  <ClockIcon className="text-[#ff00a0]" /> Quiz Settings
                </h3>
                <div className="space-y-3 sm:space-y-4">
                  <QuizPublishingOptions
                    mode={uploadPublishMode}
                    scheduledAt={uploadScheduledAt}
                    onModeChange={setUploadPublishMode}
                    onScheduledAtChange={setUploadScheduledAt}
                    accent="pink"
                  />
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 block">Category</label>
                    <input placeholder="Optional; defaults to the quiz heading" value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} className="w-full bg-[#0f1014] border border-white/10 p-2.5 sm:p-3 rounded-lg sm:rounded-xl text-white outline-none focus:border-[#ff00a0] transition text-sm" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div>
                      <label className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 block">Difficulty</label>
                      <select value={uploadDifficulty} onChange={e => setUploadDifficulty(e.target.value)} className="w-full bg-[#0f1014] border border-white/10 p-2 sm:p-3 rounded-lg sm:rounded-xl text-white outline-none focus:border-[#ff00a0] text-xs">
                        <option value="normal">Normal</option><option value="intermediate">Intermediate</option><option value="hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 block">Age Tier</label>
                      <select value={uploadAgeCategory} onChange={e => setUploadAgeCategory(e.target.value)} className="w-full bg-[#0f1014] border border-white/10 p-2 sm:p-3 rounded-lg sm:rounded-xl text-white outline-none focus:border-[#ff00a0] text-xs">
                        <option value="kids">Kids</option><option value="teens">Teens</option><option value="adults">Adults</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 block">Timer (S)</label>
                      <input type="number" min="5" max="120" value={uploadTimer} onChange={e => setUploadTimer(parseInt(e.target.value))} className="w-full bg-[#0f1014] border border-white/10 p-2 sm:p-3 rounded-lg sm:rounded-xl text-white outline-none focus:border-[#ff00a0] text-xs" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Toggle for File Upload vs Paste Text */}
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 mb-4">
                <button 
                  onClick={() => setUploadMode('file')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${uploadMode === 'file' ? 'bg-[#ff00a0] text-black' : 'text-gray-400 hover:text-white'}`}
                >
                  Upload File
                </button>
                <button 
                  onClick={() => setUploadMode('paste')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${uploadMode === 'paste' ? 'bg-[#ff00a0] text-black' : 'text-gray-400 hover:text-white'}`}
                >
                  Paste Text
                </button>
              </div>

              {uploadMode === 'file' ? (
                <>
                  <input type="file" accept=".txt" ref={fileInputRef} onChange={handleFileChange} className="hidden" id="text-upload" />
                  <label 
                    htmlFor="text-upload" 
                    className={`cursor-pointer flex flex-col items-center justify-center w-full py-8 sm:py-10 px-4 border-2 border-dashed rounded-xl sm:rounded-3xl transition-all ${
                      selectedFile ? 'border-green-500/50 bg-green-500/5 text-green-400' : 'border-[#ff00a0]/30 bg-[#ff00a0]/5 hover:bg-[#ff00a0]/10 hover:border-[#ff00a0]/60 text-[#ff00a0]'
                    }`}
                  >
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/50 flex items-center justify-center mb-2 sm:mb-3">
                      {selectedFile ? <CheckCircleIcon size={24} className="sm:w-7 sm:h-7" /> : <UploadSimpleIcon size={24} className="sm:w-7 sm:h-7" />}
                    </div>
                    <h3 className="font-bold text-sm sm:text-base mb-1 text-center">
                      {selectedFile ? selectedFile.name : 'Click to select .txt file'}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-gray-400">
                      {selectedFile ? `${(selectedFile.size / 1024).toFixed(2)} KB` : 'Multiple quizzes are supported.'}
                    </p>
                  </label>
                </>
              ) : (
                <div className="relative">
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste your quiz text here (same format as below)..."
                    className="w-full h-[150px] bg-black/50 border-2 border-[#ff00a0]/30 focus:border-[#ff00a0] rounded-xl p-4 text-white text-xs font-mono outline-none transition-colors resize-none admin-custom-scrollbar"
                  />
                  <div className="absolute bottom-3 right-3 text-[10px] text-gray-500 font-bold bg-black/60 px-2 py-1 rounded-md">
                    {pastedText.length} chars
                  </div>
                </div>
              )}

              {/* Upload Button */}
              {(selectedFile || pastedText.trim()) && (
                <button 
                  onClick={handleProcessUpload}
                  disabled={uploading}
                  className={`mt-3 sm:mt-4 w-full py-3 sm:py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition text-sm sm:text-base ${
                    uploading ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-[#ff00a0] text-black hover:bg-white'
                  }`}
                >
                  {uploading ? (
                    <><ClockIcon size={18} className="animate-spin sm:w-5 sm:h-5" /> Processing...</>
                  ) : (
                    <><UploadSimpleIcon size={18} weight="bold" className="sm:w-5 sm:h-5" /> Upload Now</>
                  )}
                </button>
              )}

              {uploadStatus && (
                <div className={`mt-3 sm:mt-4 p-3 sm:p-4 rounded-xl border flex items-start sm:items-center gap-2 sm:gap-3 text-left ${
                  uploadStatus.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}>
                  {uploadStatus.type === 'success' ? <CheckCircleIcon size={20} className="sm:w-6 sm:h-6 shrink-0" weight="fill" /> : <XCircleIcon size={20} className="sm:w-6 sm:h-6 shrink-0" weight="fill" />}
                  <p className="text-xs sm:text-sm font-bold leading-tight">{uploadStatus.msg}</p>
                </div>
              )}
            </div>

            {/* RIGHT: FORMAT GUIDE */}
            <div className="flex flex-col mt-4 lg:mt-0">
              <h3 className="text-xs sm:text-sm font-bold text-white mb-2 sm:mb-3 flex items-center gap-2">
                <FileTextIcon className="text-gray-400" /> Format Guide
              </h3>
              <p className="text-[10px] sm:text-xs text-gray-400 mb-3 sm:mb-4">Supports multiline code, Q1 or Question 1 headings, and choices as either “A. text” or “A” followed by the answer on the next line.</p>
              
              <div className="bg-[#050505] border border-white/10 rounded-xl sm:rounded-2xl overflow-hidden flex-1 shadow-inner relative flex flex-col">
                <div className="w-full h-7 sm:h-8 bg-black/40 border-b border-white/5 flex items-center px-3 sm:px-4 gap-1.5 shrink-0">
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-500/50" />
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-yellow-500/50" />
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-500/50" />
                  <span className="text-[9px] sm:text-[10px] text-gray-500 font-mono ml-1.5 sm:ml-2">example.txt</span>
                </div>
                <pre className="p-3 sm:p-5 text-[10px] sm:text-xs text-[#00f0ff] font-mono leading-relaxed overflow-x-auto flex-1">
{`Quiz 1: Introduction to Java
Question 1: What is Java?
A. A programming language
B. An operating system
C. A web browser
D. A database
Hint: Developers use it to create software and applications.
Answer: A

Quiz 2: Geography
Question 1: What is the capital of France?
A. Rome
B. Madrid
C. Paris
D. Berlin
Hint: The city is known as the City of Light.
Answer: C

Quiz 3: Basic Addition
Question 1: 2 + 2 = ?
A. 3
B. 4
C. 5
D. 6
Hint: Basic addition.
Answer: B

Pagsusulit 4: Paghinga
Tanong 1: Ano ang ating ginagamit sa paghinga?
A. Tubig
B. Hangin
C. Lupa
D. Apoy
Hint: Isipin ang hangin.
Sagot: B`}
                </pre>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- VIEW QUIZ MODAL (PORTAL) --- */}
      {viewingQuiz && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl sm:rounded-[2rem] w-full max-w-4xl shadow-[0_0_50px_rgba(0,240,255,0.1)] relative max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-8 border-b border-white/10 bg-[#0f1014] relative z-10 shrink-0">
              <button 
                onClick={() => setViewingQuiz(null)} 
                className="absolute top-4 right-4 sm:top-8 sm:right-8 text-gray-400 hover:text-white transition bg-white/5 hover:bg-white/10 p-1.5 sm:p-2 rounded-lg sm:rounded-xl z-20"
              >
                <XIcon weight="bold" size={18} className="sm:w-5 sm:h-5" />
              </button>
              
              <div className="pr-10 sm:pr-12">
                <h2 className="text-lg sm:text-3xl font-black text-white mb-1.5 sm:mb-2 leading-tight">{viewingQuiz.title}</h2>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
                  <p className="text-[10px] sm:text-sm text-[#ff00a0] font-bold uppercase tracking-wider">{viewingQuiz.category}</p>
                  <span className="text-white/20 hidden sm:block">•</span>
                  <span className={`text-[9px] sm:text-xs px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg font-bold uppercase tracking-wider border ${
                    viewingQuiz.age_category === 'kids' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                    viewingQuiz.age_category === 'teens' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                    'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/20'
                  }`}>
                    {viewingQuiz.age_category}
                  </span>
                  <span className={`text-[9px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg bg-white/5 border border-white/10 ${
                    viewingQuiz.difficulty === 'hard' ? 'text-[#ff00a0]' : 
                    viewingQuiz.difficulty === 'intermediate' ? 'text-[#ff9500]' : 
                    'text-[#ccff00]'
                  }`}>
                    {viewingQuiz.difficulty}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Modal Scrollable Body */}
            <div className="overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4 admin-custom-scrollbar flex-1 bg-[#050505]">
              {loadingQuestions ? (
                <div className="py-20 text-center">
                   <p className="text-[#ccff00] font-mono text-sm animate-pulse">LOADING QUESTIONS...</p>
                </div>
              ) : quizQuestions.length === 0 ? (
                <div className="py-20 text-center">
                   <p className="text-gray-500 text-sm">No questions found for this quiz.</p>
                </div>
              ) : (
                quizQuestions.map((q, idx) => {
                  const { prompt, code } = splitQuestionCode(q.question_text)

                  return (
                    <div key={q.id} className="bg-[#13151a] border border-white/5 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm">
                      <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
                        <span className="bg-white/5 text-gray-400 text-[10px] sm:text-xs font-black px-2 py-1 rounded-md sm:rounded-lg shrink-0">Q{idx + 1}</span>
                        <div className="min-w-0 flex-1 space-y-3">
                          {prompt && <p className="font-bold text-white text-xs sm:text-base leading-relaxed pt-0.5 whitespace-pre-wrap">{prompt}</p>}
                          {code && (
                            <div className="overflow-hidden rounded-xl border border-cyan-400/15 bg-[#080b10]">
                              <div className="border-b border-white/5 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-300/60">
                                Code snippet
                              </div>
                              <pre className="overflow-x-auto p-3 sm:p-4 text-[11px] sm:text-xs leading-6 text-cyan-100/90 font-mono admin-custom-scrollbar"><code>{code}</code></pre>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                        {q.options.map((opt: string, i: number) => {
                          const isCorrect = opt === q.correct_answer
                          return (
                            <div key={i} className={`flex items-center gap-2 sm:gap-3 text-[11px] sm:text-sm p-2 sm:p-3 rounded-lg sm:rounded-xl border ${
                              isCorrect
                                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                : 'bg-[#0a0a0c] border-white/5 text-gray-400'
                            }`}>
                              <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center font-bold shrink-0 text-[10px] sm:text-xs ${
                                isCorrect ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-500'
                              }`}>
                                {String.fromCharCode(65 + i)}
                              </span>
                              <span className={`whitespace-pre-wrap break-words ${isCorrect ? 'font-bold' : ''}`}>{opt}</span>
                              {isCorrect && <CheckCircleIcon className="ml-auto w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 shrink-0" />}
                            </div>
                          )
                        })}
                      </div>

                      {q.hint && (
                        <div className="mt-2 sm:mt-3 bg-yellow-500/5 border border-yellow-500/10 p-2 sm:p-3 rounded-lg sm:rounded-xl flex items-start gap-2">
                          <SparkleIcon weight="fill" className="text-yellow-500 w-3.5 h-3.5 sm:w-4 sm:h-4 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-[9px] sm:text-[10px] text-yellow-500 font-bold uppercase tracking-wider block mb-0.5">Hint</span>
                            <p className="text-[10px] sm:text-xs text-yellow-200/70 whitespace-pre-wrap">{q.hint}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
            
          </div>
        </div>,
        document.body
      )}

      {editingPublication && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <form
            onSubmit={handleSavePublication}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#0f1014] p-5 shadow-2xl sm:p-7"
          >
            <h2 className="mb-1 text-lg font-bold text-white">Change quiz publishing</h2>
            <p className="mb-5 text-sm text-gray-400">{editingPublication.title}</p>
            <QuizPublishingOptions
              mode={editingPublishMode}
              scheduledAt={editingScheduledAt}
              onModeChange={setEditingPublishMode}
              onScheduledAtChange={setEditingScheduledAt}
              accent="pink"
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingPublication(null)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm font-bold text-gray-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={publishingQuizId !== null}
                className="rounded-lg bg-[#ccff00] px-4 py-2 text-sm font-bold text-black hover:bg-white disabled:opacity-50"
              >
                {publishingQuizId === editingPublication.id ? 'Saving...' : 'Save status'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

    </div>
  )
}