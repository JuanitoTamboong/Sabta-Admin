// src/pages/AdminQuizzes.tsx
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { 
  PlusIcon, TrashIcon, UploadSimpleIcon, 
  FileTextIcon, CheckCircleIcon, XCircleIcon,
  GameControllerIcon, ClockIcon, ListDashesIcon, SparkleIcon,
  ArrowLeftIcon
} from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'

export default function AdminQuizzes() {
  const navigate = useNavigate()
  const [quizzes, setQuizzes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'upload'>('list')
  
  // Manual Creation State
  const [category, setCategory] = useState('General Knowledge')
  const [difficulty, setDifficulty] = useState('normal')
  const [ageCategory, setAgeCategory] = useState('teens')
  const [qText, setQText] = useState('')
  const [optA, setOptA] = useState('')
  const [optB, setOptB] = useState('')
  const [optC, setOptC] = useState('')
  const [optD, setOptD] = useState('')
  const [correct, setCorrect] = useState('')
  const [manualHint, setManualHint] = useState('')

  // Upload State
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload Settings State
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
    
    const autoTitle = `${category} Quiz - ${new Date().toLocaleDateString()}`
    
    try {
      const { data: quizData, error: quizError } = await supabase.from('quizzes').insert({
        title: autoTitle, category, difficulty, age_category: ageCategory, status: 'published', time_limit_seconds: 15
      }).select().single()
      if (quizError) throw quizError

      const { error: qError } = await supabase.from('questions').insert({
        quiz_id: quizData.id, 
        question_text: qText, 
        options: [optA, optB, optC, optD], 
        correct_answer: correct, 
        hint: manualHint || null,
        points: 10
      })
      if (qError) throw qError

      setActiveTab('list')
      setQText(''); setOptA(''); setOptB(''); setOptC(''); setOptD(''); setCorrect(''); setManualHint('')
      fetchQuizzes()
    } catch (err: any) {
      alert("Error: " + err.message)
      setLoading(false)
    }
  }

  // --- MULTIPLE TEXT FILE PARSER HANDLER ---
  const handleTextUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadStatus(null)
    
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        
        const quizBlocks = text.split(/Quiz \d+:/i)
        const validQuizBlocks = quizBlocks.filter(block => block.trim().length > 0)

        let totalQuestionsAdded = 0
        let totalQuizzesAdded = 0

        for (let i = 0; i < validQuizBlocks.length; i++) {
          const blockText = validQuizBlocks[i]
          
          const questionBlocks = blockText.split(/Question \d+:/).filter(b => b.trim() !== '')
          const parsedQuestions = []

          for (const qBlock of questionBlocks) {
            const lines = qBlock.split('\n').map(l => l.trim()).filter(l => l !== '')
            if (lines.length === 0) continue

            const question_text = lines[0]
            
            const options = lines
              .filter(l => /^[A-D]\./.test(l))
              .map(l => l.replace(/^[A-D]\.\s*/, '')) 

            const hintLine = lines.find(l => l.toLowerCase().startsWith('hint:'))
            const hint = hintLine ? hintLine.substring(5).trim() : null

            const answerLine = lines.find(l => l.toLowerCase().startsWith('answer:'))
            const answerLetter = answerLine ? answerLine.split(':')[1].trim().toUpperCase() : 'A'
            
            const letterIndex = answerLetter.charCodeAt(0) - 65 
            const correct_answer = options[letterIndex] || ''

            if (question_text && options.length === 4 && correct_answer) {
              parsedQuestions.push({ question_text, options, correct_answer, hint })
            }
          }

          if (parsedQuestions.length > 0) {
            const autoTitle = `${uploadCategory} Quiz - ${new Date().toLocaleDateString()}`
            
            const { data: quizData, error: quizErr } = await supabase.from('quizzes').insert({
              title: autoTitle, category: uploadCategory, difficulty: uploadDifficulty, age_category: uploadAgeCategory, status: 'published', time_limit_seconds: 15
            }).select().single()

            if (quizErr) throw quizErr

            const questionsToInsert = parsedQuestions.map(q => ({
              quiz_id: quizData.id,
              question_text: q.question_text,
              options: q.options,
              correct_answer: q.correct_answer,
              hint: q.hint,
              points: 10
            }))

            const { error: qErr } = await supabase.from('questions').insert(questionsToInsert)
            if (qErr) throw qErr

            totalQuestionsAdded += parsedQuestions.length
            totalQuizzesAdded++
          }
        }

        if (totalQuizzesAdded === 0) {
          throw new Error("Could not find any valid questions. Please check the format.")
        }

        setUploadStatus({ 
          type: 'success', 
          msg: `Successfully imported ${totalQuizzesAdded} quiz(zes) with ${totalQuestionsAdded} total questions!` 
        })
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
    if (!confirm("Are you sure you want to delete this quiz? This action cannot be undone.")) return
    await supabase.from('quizzes').delete().eq('id', id)
    fetchQuizzes()
  }

  // --- UI RENDER ---
  return (
    <div className="relative z-10 max-w-6xl mx-auto p-4 md:p-0">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <button 
            onClick={() => navigate('/admin')} 
            className="flex items-center gap-2 text-gray-400 hover:text-white transition mb-2 text-sm font-bold bg-white/5 px-3 py-1.5 rounded-lg w-fit"
          >
            <ArrowLeftIcon weight="bold" /> Back to Command Center
          </button>
          <h1 className="text-3xl font-black text-white">Quiz Manager</h1>
          <p className="text-gray-400 text-sm mt-1">Create new quizzes, upload from documents, or manage existing content.</p>
        </div>
      </div>

      {/* PREMIUM TABS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button 
          onClick={() => setActiveTab('list')} 
          className={`flex items-start gap-4 p-5 rounded-2xl border transition-all text-left ${
            activeTab === 'list' 
              ? 'bg-[#ccff00]/10 border-[#ccff00]/50 shadow-[0_0_20px_rgba(204,255,0,0.1)]' 
              : 'bg-[#0f1014] border-white/10 hover:border-white/20 hover:bg-white/5'
          }`}
        >
          <div className={`p-3 rounded-xl ${activeTab === 'list' ? 'bg-[#ccff00] text-black' : 'bg-white/5 text-gray-400'}`}>
            <ListDashesIcon weight="bold" size={24} />
          </div>
          <div>
            <h3 className={`font-bold text-lg ${activeTab === 'list' ? 'text-[#ccff00]' : 'text-white'}`}>All Quizzes</h3>
            <p className="text-xs text-gray-400 mt-1">View, manage, and delete existing quizzes.</p>
          </div>
        </button>

        <button 
          onClick={() => setActiveTab('create')} 
          className={`flex items-start gap-4 p-5 rounded-2xl border transition-all text-left ${
            activeTab === 'create' 
              ? 'bg-[#00f0ff]/10 border-[#00f0ff]/50 shadow-[0_0_20px_rgba(0,240,255,0.1)]' 
              : 'bg-[#0f1014] border-white/10 hover:border-white/20 hover:bg-white/5'
          }`}
        >
          <div className={`p-3 rounded-xl ${activeTab === 'create' ? 'bg-[#00f0ff] text-black' : 'bg-white/5 text-gray-400'}`}>
            <PlusIcon weight="bold" size={24} />
          </div>
          <div>
            <h3 className={`font-bold text-lg ${activeTab === 'create' ? 'text-[#00f0ff]' : 'text-white'}`}>Create Manual</h3>
            <p className="text-xs text-gray-400 mt-1">Write a new question and publish instantly.</p>
          </div>
        </button>

        <button 
          onClick={() => setActiveTab('upload')} 
          className={`flex items-start gap-4 p-5 rounded-2xl border transition-all text-left ${
            activeTab === 'upload' 
              ? 'bg-[#ff00a0]/10 border-[#ff00a0]/50 shadow-[0_0_20px_rgba(255,0,160,0.1)]' 
              : 'bg-[#0f1014] border-white/10 hover:border-white/20 hover:bg-white/5'
          }`}
        >
          <div className={`p-3 rounded-xl ${activeTab === 'upload' ? 'bg-[#ff00a0] text-black' : 'bg-white/5 text-gray-400'}`}>
            <UploadSimpleIcon weight="bold" size={24} />
          </div>
          <div>
            <h3 className={`font-bold text-lg ${activeTab === 'upload' ? 'text-[#ff00a0]' : 'text-white'}`}>Bulk Upload</h3>
            <p className="text-xs text-gray-400 mt-1">Import multiple quizzes from a text file.</p>
          </div>
        </button>
      </div>

      {/* --- TAB 1: LIST QUIZZES --- */}
      {activeTab === 'list' && (
        <div className="bg-[#0f1014] border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-fade-in">
          {loading ? (
             <div className="py-20 text-center">
               <p className="text-[#ccff00] font-mono animate-pulse tracking-widest text-sm">LOADING DATABASE...</p>
             </div>
          ) : quizzes.length === 0 ? (
            <div className="py-24 text-center">
              <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <GameControllerIcon weight="duotone" className="w-10 h-10 text-gray-600" />
              </div>
              <p className="text-white font-bold text-lg mb-1">No Quizzes Found</p>
              <p className="text-gray-500 text-sm mb-6">Your database is empty. Create your first quiz to get started.</p>
              <button onClick={() => setActiveTab('create')} className="bg-[#ccff00] text-black px-6 py-2.5 rounded-xl font-bold hover:bg-white transition">
                Create New Quiz
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-black/40 border-b border-white/10 text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                  <tr>
                    <th className="py-4 px-6">Quiz Details</th>
                    <th className="py-4 px-4">Tier / Difficulty</th>
                    <th className="py-4 px-4 text-center">Questions</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {quizzes.map(q => (
                    <tr key={q.id} className="hover:bg-white/[0.02] transition group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00f0ff]/20 to-blue-600/20 border border-[#00f0ff]/30 flex items-center justify-center shrink-0">
                            <GameControllerIcon weight="fill" className="text-[#00f0ff] w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm group-hover:text-[#00f0ff] transition">{q.title}</p>
                            <p className="text-xs text-[#ff00a0] font-semibold">{q.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
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
                        <button 
                          onClick={() => handleDeleteQuiz(q.id)} 
                          className="p-2.5 text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-xl transition"
                          title="Delete Quiz"
                        >
                          <TrashIcon size={20} weight="bold" />
                        </button>
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
        <form onSubmit={handleManualCreate} className="bg-[#0f1014] border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl animate-fade-in max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8 pb-6 border-b border-white/10">
            <div className="p-3 bg-[#00f0ff]/20 text-[#00f0ff] rounded-xl">
              <PlusIcon weight="bold" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Create New Quiz</h2>
              <p className="text-xs text-gray-400">Manually add a single question to the database.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div>
              <label className="text-xs text-gray-400 font-bold mb-2 block uppercase tracking-wider">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-black/50 border border-white/10 p-3.5 rounded-xl text-white outline-none focus:border-[#00f0ff] transition">
                <option>General Knowledge</option><option>Science</option><option>Mathematics</option><option>History</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-bold mb-2 block uppercase tracking-wider">Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full bg-black/50 border border-white/10 p-3.5 rounded-xl text-white outline-none focus:border-[#00f0ff] transition">
                <option value="normal">Normal</option><option value="intermediate">Intermediate</option><option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-bold mb-2 block uppercase tracking-wider">Age Category</label>
              <select value={ageCategory} onChange={e => setAgeCategory(e.target.value)} className="w-full bg-black/50 border border-white/10 p-3.5 rounded-xl text-white outline-none focus:border-[#00f0ff] transition">
                <option value="kids">Kids</option><option value="teens">Teens</option><option value="adults">Adults</option>
              </select>
            </div>
          </div>

          <div className="bg-black/30 p-6 md:p-8 rounded-2xl border border-white/5 mb-8">
            <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
              <SparkleIcon className="text-[#ccff00]" /> Question Content
            </h3>
            
            <label className="text-xs text-gray-400 font-bold mb-2 block uppercase tracking-wider">Question Text</label>
            <input required placeholder="e.g. What is the capital of France?" value={qText} onChange={e => setQText(e.target.value)} className="w-full bg-[#0f1014] border border-white/10 p-4 rounded-xl text-white outline-none focus:border-[#ccff00] mb-6 text-lg font-medium" />
            
            <label className="text-xs text-gray-400 font-bold mb-2 block uppercase tracking-wider">Options (4 Required)</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">A.</span>
                <input required placeholder="Option A" value={optA} onChange={e => setOptA(e.target.value)} className="w-full bg-[#0f1014] border border-white/10 p-3.5 pl-10 rounded-xl text-white outline-none focus:border-white/30" />
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">B.</span>
                <input required placeholder="Option B" value={optB} onChange={e => setOptB(e.target.value)} className="w-full bg-[#0f1014] border border-white/10 p-3.5 pl-10 rounded-xl text-white outline-none focus:border-white/30" />
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">C.</span>
                <input required placeholder="Option C" value={optC} onChange={e => setOptC(e.target.value)} className="w-full bg-[#0f1014] border border-white/10 p-3.5 pl-10 rounded-xl text-white outline-none focus:border-white/30" />
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">D.</span>
                <input required placeholder="Option D" value={optD} onChange={e => setOptD(e.target.value)} className="w-full bg-[#0f1014] border border-white/10 p-3.5 pl-10 rounded-xl text-white outline-none focus:border-white/30" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-yellow-500 font-bold mb-2 block uppercase tracking-wider">Hint (Optional)</label>
                <input placeholder="A clue for the player..." value={manualHint} onChange={e => setManualHint(e.target.value)} className="w-full bg-yellow-500/5 border border-yellow-500/20 text-yellow-400 p-4 rounded-xl outline-none focus:border-yellow-500/50 transition placeholder-yellow-500/30" />
              </div>
              <div>
                <label className="text-xs text-green-500 font-bold mb-2 block uppercase tracking-wider">Correct Answer</label>
                <input required placeholder="Must match an option exactly" value={correct} onChange={e => setCorrect(e.target.value)} className="w-full bg-green-500/10 border border-green-500/30 text-green-400 p-4 rounded-xl font-bold outline-none focus:border-green-500 transition placeholder-green-500/30" />
              </div>
            </div>
          </div>

          <button type="submit" className="bg-[#ccff00] text-black px-8 py-4 rounded-xl font-black text-lg w-full hover:bg-white transition shadow-[0_0_30px_rgba(204,255,0,0.2)] hover:scale-[1.01] transform duration-200">
            Publish Quiz
          </button>
        </form>
      )}

      {/* --- TAB 3: DOCUMENT UPLOAD --- */}
      {activeTab === 'upload' && (
        <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl animate-fade-in max-w-5xl mx-auto">
          
          <div className="flex items-center gap-3 mb-8 pb-6 border-b border-white/10">
            <div className="p-3 bg-[#ff00a0]/20 text-[#ff00a0] rounded-xl">
              <UploadSimpleIcon weight="bold" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Bulk Upload</h2>
              <p className="text-xs text-gray-400">Import multiple quizzes and questions instantly.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            
            {/* LEFT: SETTINGS & UPLOAD */}
            <div>
              <div className="mb-6 p-5 bg-black/30 border border-white/5 rounded-2xl">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <ClockIcon className="text-[#ff00a0]" /> Quiz Settings
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 block">Category</label>
                    <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} className="w-full bg-[#0f1014] border border-white/10 p-3 rounded-xl text-white outline-none focus:border-[#ff00a0]">
                      <option>General Knowledge</option><option>Science</option><option>Mathematics</option><option>History</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 block">Difficulty</label>
                      <select value={uploadDifficulty} onChange={e => setUploadDifficulty(e.target.value)} className="w-full bg-[#0f1014] border border-white/10 p-3 rounded-xl text-white outline-none focus:border-[#ff00a0]">
                        <option value="normal">Normal</option><option value="intermediate">Intermediate</option><option value="hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 block">Age Category</label>
                      <select value={uploadAgeCategory} onChange={e => setUploadAgeCategory(e.target.value)} className="w-full bg-[#0f1014] border border-white/10 p-3 rounded-xl text-white outline-none focus:border-[#ff00a0]">
                        <option value="kids">Kids</option><option value="teens">Teens</option><option value="adults">Adults</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <input type="file" accept=".txt" ref={fileInputRef} onChange={handleTextUpload} className="hidden" id="text-upload" />
              
              <label 
                htmlFor="text-upload" 
                className={`cursor-pointer flex flex-col items-center justify-center w-full py-12 px-4 border-2 border-dashed rounded-3xl transition-all ${
                  uploading 
                    ? 'border-gray-700 bg-gray-800/20 text-gray-500 cursor-not-allowed' 
                    : 'border-[#ff00a0]/30 bg-[#ff00a0]/5 hover:bg-[#ff00a0]/10 hover:border-[#ff00a0]/60 text-[#ff00a0]'
                }`}
              >
                <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center mb-4">
                  {uploading ? <ClockIcon size={32} className="animate-spin" /> : <UploadSimpleIcon size={32} />}
                </div>
                <h3 className="font-bold text-lg mb-1">{uploading ? 'Processing File...' : 'Click to upload .txt file'}</h3>
                <p className="text-xs text-gray-400">Multiple quizzes are supported.</p>
              </label>

              {uploadStatus && (
                <div className={`mt-6 p-4 rounded-xl border flex items-center gap-3 text-left ${
                  uploadStatus.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}>
                  {uploadStatus.type === 'success' ? <CheckCircleIcon size={24} weight="fill" /> : <XCircleIcon size={24} weight="fill" />}
                  <p className="text-sm font-bold">{uploadStatus.msg}</p>
                </div>
              )}
            </div>

            {/* RIGHT: FORMAT GUIDE */}
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <FileTextIcon className="text-gray-400" /> Format Guide
              </h3>
              <p className="text-xs text-gray-400 mb-4">Ensure your text file matches this exact structure. You can add multiple questions and multiple quizzes.</p>
              
              <div className="bg-[#050505] border border-white/10 rounded-2xl overflow-hidden flex-1 shadow-inner relative">
                <div className="absolute top-0 left-0 w-full h-8 bg-black/40 border-b border-white/5 flex items-center px-4 gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                  <span className="text-[10px] text-gray-500 font-mono ml-2">example.txt</span>
                </div>
                <pre className="p-5 pt-12 text-xs text-[#00f0ff] font-mono leading-relaxed overflow-x-auto h-full">
{`Quiz 1:
Question 1: What is water?
A. A solid mineral
B. H2O
C. A type of air
D. A metal element
Hint: Think about hydrogen and oxygen.
Answer: B

Question 2: What is the sun?
A. A star
B. A planet
C. A moon
D. A comet
Hint: It shines very brightly.
Answer: A

Quiz 2:
Question 1: 2 + 2 = ?
A. 3
B. 4
C. 5
D. 6
Hint: Basic addition.
Answer: B`}
                </pre>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}