// src/pages/AdminQuizzes.tsx
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { 
  PlusIcon, TrashIcon, UploadSimpleIcon, 
  FileTextIcon, CheckCircleIcon, XCircleIcon
} from '@phosphor-icons/react'

export default function AdminQuizzes() {
  const [quizzes, setQuizzes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'upload'>('list')
  
  // Manual Creation State
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('General Knowledge')
  const [difficulty, setDifficulty] = useState('normal')
  const [ageCategory, setAgeCategory] = useState('teens')
  const [qText, setQText] = useState('')
  const [optA, setOptA] = useState('')
  const [optB, setOptB] = useState('')
  const [optC, setOptC] = useState('')
  const [optD, setOptD] = useState('')
  const [correct, setCorrect] = useState('')

  // Upload State
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // --- NEW: Upload Settings State ---
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCategory, setUploadCategory] = useState('General Knowledge')
  const [uploadDifficulty, setUploadDifficulty] = useState('normal')
  const [uploadAgeCategory, setUploadAgeCategory] = useState('teens')

  const fetchQuizzes = async () => {
    const { data } = await supabase.from('quizzes').select('*, questions(count)').order('created_at', { ascending: false })
    if (data) setQuizzes(data)
    setLoading(false)
  }

  useEffect(() => { fetchQuizzes() }, [])

  // --- MANUAL CREATE HANDLER ---
  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: quizData, error: quizError } = await supabase.from('quizzes').insert({
        title, category, difficulty, age_category: ageCategory, status: 'published', time_limit_seconds: 15
      }).select().single()
      if (quizError) throw quizError

      const { error: qError } = await supabase.from('questions').insert({
        quiz_id: quizData.id, question_text: qText, options: [optA, optB, optC, optD], correct_answer: correct, points: 10
      })
      if (qError) throw qError

      setActiveTab('list')
      setTitle(''); setQText(''); setOptA(''); setOptB(''); setOptC(''); setOptD(''); setCorrect('')
      fetchQuizzes()
    } catch (err: any) {
      alert("Error: " + err.message)
      setLoading(false)
    }
  }

  // --- TEXT FILE PARSER HANDLER ---
  const handleTextUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!uploadTitle) {
      setUploadStatus({ type: 'error', msg: "Please enter a title for the uploaded quiz." })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploading(true)
    setUploadStatus(null)
    
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        const blocks = text.split(/Question \d+:/).filter(b => b.trim() !== '')

        const parsedQuestions = []

        for (const block of blocks) {
          const lines = block.split('\n').map(l => l.trim()).filter(l => l !== '')
          
          if (lines.length === 0) continue

          const question_text = lines[0]
          const options = lines
            .filter(l => /^[A-D]\./.test(l))
            .map(l => l.replace(/^[A-D]\.\s*/, '')) 

          const answerLine = lines.find(l => l.toLowerCase().startsWith('answer:'))
          const answerLetter = answerLine ? answerLine.split(':')[1].trim().toUpperCase() : 'A'
          
          const letterIndex = answerLetter.charCodeAt(0) - 65 
          const correct_answer = options[letterIndex] || ''

          if (question_text && options.length === 4 && correct_answer) {
            parsedQuestions.push({ question_text, options, correct_answer })
          }
        }

        if (parsedQuestions.length === 0) {
          throw new Error("Could not find any valid questions. Please check the format.")
        }

        // --- SAVE TO DATABASE USING SELECTED SETTINGS ---
        const { data: quizData, error: quizErr } = await supabase.from('quizzes').insert({
          title: uploadTitle, // Uses the input from the form
          category: uploadCategory, // Uses the dropdown
          difficulty: uploadDifficulty, // Uses the dropdown
          age_category: uploadAgeCategory, // Uses the dropdown
          status: 'published',
          time_limit_seconds: 15
        }).select().single()

        if (quizErr) throw quizErr

        const questionsToInsert = parsedQuestions.map(q => ({
          quiz_id: quizData.id,
          question_text: q.question_text,
          options: q.options,
          correct_answer: q.correct_answer,
          points: 10
        }))

        const { error: qErr } = await supabase.from('questions').insert(questionsToInsert)
        if (qErr) throw qErr

        setUploadStatus({ type: 'success', msg: `Successfully imported ${parsedQuestions.length} questions!` })
        setUploadTitle('') // Reset title
        fetchQuizzes()
      } catch (err: any) {
        setUploadStatus({ type: 'error', msg: err.message || 'Failed to parse document.' })
      } finally {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  const handleDeleteQuiz = async (id: string) => {
    if (!confirm("Are you sure you want to delete this quiz?")) return
    await supabase.from('quizzes').delete().eq('id', id)
    fetchQuizzes()
  }

  // --- UI RENDER ---
  return (
    <div className="relative z-10 max-w-6xl mx-auto">
      
      {/* HEADER & TABS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Quiz Manager</h1>
          <p className="text-gray-400 text-sm mt-1">Create new quizzes or upload them from a document.</p>
        </div>
        
        <div className="flex bg-[#0f1014] border border-white/10 rounded-xl p-1">
          <button onClick={() => setActiveTab('list')} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'list' ? 'bg-[#ccff00] text-black' : 'text-gray-400 hover:text-white'}`}>All Quizzes</button>
          <button onClick={() => setActiveTab('create')} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'create' ? 'bg-[#ccff00] text-black' : 'text-gray-400 hover:text-white'}`}>Create Manual</button>
          <button onClick={() => setActiveTab('upload')} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'upload' ? 'bg-[#ccff00] text-black' : 'text-gray-400 hover:text-white'}`}>Upload Document</button>
        </div>
      </div>

      {/* --- TAB 1: LIST QUIZZES --- */}
      {activeTab === 'list' && (
        <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-6 shadow-xl">
          {loading ? (
             <p className="text-center text-[#ccff00] font-mono py-10 animate-pulse">LOADING QUIZZES...</p>
          ) : quizzes.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 mb-4">No quizzes found in the database.</p>
              <button onClick={() => setActiveTab('create')} className="bg-[#ccff00] text-black px-6 py-2 rounded-xl font-bold">Create your first quiz</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="border-b border-white/10 text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                  <tr>
                    <th className="pb-4 px-2">Title</th>
                    <th className="pb-4 px-2">Category</th>
                    <th className="pb-4 px-2">Age Group</th>
                    <th className="pb-4 px-2">Difficulty</th>
                    <th className="pb-4 px-2 text-center">Questions</th>
                    <th className="pb-4 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quizzes.map(q => (
                    <tr key={q.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                      <td className="py-4 px-2 text-sm font-bold text-white">{q.title}</td>
                      <td className="py-4 px-2 text-xs text-[#ff00a0] font-semibold">{q.category}</td>
                      <td className="py-4 px-2 text-xs text-gray-400 uppercase font-mono">{q.age_category}</td>
                      <td className="py-4 px-2 text-xs text-[#00f0ff] uppercase font-mono">{q.difficulty}</td>
                      <td className="py-4 px-2 text-center">
                        <span className="bg-black/50 text-gray-300 text-xs px-2.5 py-1 rounded-lg border border-white/5">{q.questions?.[0]?.count || 0}</span>
                      </td>
                      <td className="py-4 px-2 text-right space-x-2">
                        <button onClick={() => handleDeleteQuiz(q.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition"><TrashIcon size={18} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: MANUAL CREATE --- */}
      {activeTab === 'create' && (
        <form onSubmit={handleManualCreate} className="bg-[#0f1014] border border-white/10 rounded-3xl p-6 md:p-8 shadow-xl">
          <h2 className="text-lg font-bold text-[#ccff00] mb-6 flex items-center gap-2"><PlusIcon /> New Quiz Setup</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div>
              <label className="text-xs text-gray-400 font-bold mb-1 block">Quiz Title</label>
              <input required placeholder="e.g. Science Vol 1" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-[#ccff00]/50" />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-bold mb-1 block">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-white outline-none">
                <option>General Knowledge</option><option>Science</option><option>Mathematics</option><option>History</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-bold mb-1 block">Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-white outline-none">
                <option value="normal">Normal</option><option value="intermediate">Intermediate</option><option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-bold mb-1 block">Age Category</label>
              <select value={ageCategory} onChange={e => setAgeCategory(e.target.value)} className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-white outline-none">
                <option value="kids">Kids</option><option value="teens">Teens</option><option value="adults">Adults</option>
              </select>
            </div>
          </div>

          <div className="bg-black/30 p-5 rounded-2xl border border-white/5 mb-6">
            <h3 className="text-sm font-bold text-white mb-4">Question 1</h3>
            <input required placeholder="Enter question here..." value={qText} onChange={e => setQText(e.target.value)} className="w-full bg-[#0f1014] border border-white/10 p-3.5 rounded-xl text-white outline-none focus:border-[#00f0ff]/50 mb-4" />
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <input required placeholder="Option A" value={optA} onChange={e => setOptA(e.target.value)} className="bg-[#0f1014] border border-white/10 p-3 rounded-xl text-white outline-none" />
              <input required placeholder="Option B" value={optB} onChange={e => setOptB(e.target.value)} className="bg-[#0f1014] border border-white/10 p-3 rounded-xl text-white outline-none" />
              <input required placeholder="Option C" value={optC} onChange={e => setOptC(e.target.value)} className="bg-[#0f1014] border border-white/10 p-3 rounded-xl text-white outline-none" />
              <input required placeholder="Option D" value={optD} onChange={e => setOptD(e.target.value)} className="bg-[#0f1014] border border-white/10 p-3 rounded-xl text-white outline-none" />
            </div>
            
            <input required placeholder="Correct Answer (Must match an option exactly)" value={correct} onChange={e => setCorrect(e.target.value)} className="w-full bg-green-500/10 border border-green-500/30 text-green-400 p-3.5 rounded-xl font-bold outline-none" />
          </div>

          <button type="submit" className="bg-[#ccff00] text-black px-8 py-4 rounded-xl font-bold w-full hover:bg-white transition shadow-[0_0_20px_rgba(204,255,0,0.2)]">Publish Quiz</button>
        </form>
      )}

      {/* --- TAB 3: DOCUMENT UPLOAD --- */}
      {activeTab === 'upload' && (
        <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-8 shadow-xl">
          
          {/* NEW: SETTINGS PANEL */}
          <div className="mb-8 p-5 bg-black/30 border border-white/5 rounded-2xl">
            <h3 className="text-sm font-bold text-white mb-4">Quiz Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Quiz Title</label>
                <input placeholder="e.g. Science Vol 2" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} className="w-full bg-[#0f1014] border border-white/10 p-3 rounded-xl text-white outline-none focus:border-[#ccff00]/50" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Category</label>
                <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} className="w-full bg-[#0f1014] border border-white/10 p-3 rounded-xl text-white outline-none">
                  <option>General Knowledge</option><option>Science</option><option>Mathematics</option><option>History</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Difficulty</label>
                <select value={uploadDifficulty} onChange={e => setUploadDifficulty(e.target.value)} className="w-full bg-[#0f1014] border border-white/10 p-3 rounded-xl text-white outline-none">
                  <option value="normal">Normal</option><option value="intermediate">Intermediate</option><option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Age Category</label>
                <select value={uploadAgeCategory} onChange={e => setUploadAgeCategory(e.target.value)} className="w-full bg-[#0f1014] border border-white/10 p-3 rounded-xl text-white outline-none">
                  <option value="kids">Kids</option><option value="teens">Teens</option><option value="adults">Adults</option>
                </select>
              </div>
            </div>
          </div>

          <div className="max-w-md mx-auto text-center">
            <div className="w-20 h-20 bg-[#00f0ff]/10 border border-[#00f0ff]/30 rounded-2xl flex items-center justify-center mx-auto mb-6 text-[#00f0ff]">
              <FileTextIcon size={40} weight="duotone" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Upload Document</h2>
            <p className="text-gray-400 text-sm mb-6">Upload a <strong>.txt</strong> file containing your questions.</p>

            <input type="file" accept=".txt" ref={fileInputRef} onChange={handleTextUpload} className="hidden" id="text-upload" />
            
            <label htmlFor="text-upload" className={`cursor-pointer inline-flex items-center justify-center gap-2 w-full py-4 rounded-xl font-bold transition ${uploading || !uploadTitle ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-[#ccff00] text-black hover:bg-white shadow-[0_0_20px_rgba(204,255,0,0.2)]'}`}>
              {uploading ? 'PROCESSING FILE...' : <><UploadSimpleIcon weight="bold" size={20} /> Select TXT File</>}
            </label>

            <div className="mt-6 text-left bg-black/40 border border-white/5 p-4 rounded-xl overflow-hidden">
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-2">Format required:</p>
              <pre className="text-[10px] text-[#00f0ff] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
{`Question 1: What is water?
A. A solid mineral
B. A chemical compound made of hydrogen and oxygen
C. A type of air
D. A metal element
Answer: B`}
              </pre>
            </div>

            {uploadStatus && (
              <div className={`mt-6 p-4 rounded-xl border flex items-center gap-3 text-left ${uploadStatus.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                {uploadStatus.type === 'success' ? <CheckCircleIcon size={24} /> : <XCircleIcon size={24} />}
                <p className="text-sm font-bold">{uploadStatus.msg}</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}