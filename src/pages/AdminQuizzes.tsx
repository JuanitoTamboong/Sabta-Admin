import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PlusIcon, CheckCircleIcon } from '@phosphor-icons/react'

export default function AdminQuizzes() {
  const [quizzes, setQuizzes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)

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

  const fetchQuizzes = async () => {
    const { data } = await supabase.from('quizzes').select('*, questions(count)').order('created_at', { ascending: false })
    if (data) setQuizzes(data)
    setLoading(false)
  }

  useEffect(() => { fetchQuizzes() }, [])

  // FIXED: Used React.FormEvent instead of the deprecated FormEvent
  const handleCreate = async (e: React.FormEvent) => {
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

      setIsCreating(false)
      setTitle(''); setQText(''); setOptA(''); setOptB(''); setOptC(''); setOptD(''); setCorrect('')
      fetchQuizzes()
    } catch (err: any) {
      alert(err.message)
      setLoading(false)
    }
  }

  if (loading) return <div className="text-[#ccff00] font-mono">LOADING QUIZZES...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Quiz Manager</h2>
        <button onClick={() => setIsCreating(!isCreating)} className="bg-[#ccff00] text-black px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-white transition">
          <PlusIcon weight="bold" /> Create Quiz
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="bg-[#0f1014] border border-white/10 p-6 rounded-2xl mb-8 space-y-4">
          <h3 className="text-lg font-bold text-[#ccff00]">New Quiz Setup</h3>
          <div className="grid grid-cols-2 gap-4">
            <input required placeholder="Quiz Title" value={title} onChange={e => setTitle(e.target.value)} className="bg-black/50 border border-white/10 p-3 rounded-xl w-full text-white" />
            <select value={category} onChange={e => setCategory(e.target.value)} className="bg-black/50 border border-white/10 p-3 rounded-xl w-full text-white">
              <option>General Knowledge</option><option>Science</option><option>Mathematics</option><option>History</option>
            </select>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="bg-black/50 border border-white/10 p-3 rounded-xl w-full text-white">
              <option value="normal">Normal</option><option value="intermediate">Intermediate</option><option value="hard">Hard</option>
            </select>
            <select value={ageCategory} onChange={e => setAgeCategory(e.target.value)} className="bg-black/50 border border-white/10 p-3 rounded-xl w-full text-white">
              <option value="kids">Kids (6-12)</option><option value="teens">Teens (13-17)</option><option value="adults">Adults (18+)</option>
            </select>
          </div>
          <hr className="border-white/10 my-4" />
          <h3 className="text-md font-bold">Question 1</h3>
          <input required placeholder="Question Text" value={qText} onChange={e => setQText(e.target.value)} className="bg-black/50 border border-white/10 p-3 rounded-xl w-full text-white" />
          <div className="grid grid-cols-2 gap-4">
            <input required placeholder="Option A" value={optA} onChange={e => setOptA(e.target.value)} className="bg-black/50 border border-white/10 p-3 rounded-xl w-full text-white" />
            <input required placeholder="Option B" value={optB} onChange={e => setOptB(e.target.value)} className="bg-black/50 border border-white/10 p-3 rounded-xl w-full text-white" />
            <input required placeholder="Option C" value={optC} onChange={e => setOptC(e.target.value)} className="bg-black/50 border border-white/10 p-3 rounded-xl w-full text-white" />
            <input required placeholder="Option D" value={optD} onChange={e => setOptD(e.target.value)} className="bg-black/50 border border-white/10 p-3 rounded-xl w-full text-white" />
          </div>
          <input required placeholder="Correct Answer (Must match exactly one option)" value={correct} onChange={e => setCorrect(e.target.value)} className="bg-green-500/10 border border-green-500/30 text-green-400 p-3 rounded-xl w-full font-bold" />
          <button type="submit" className="bg-[#ccff00] text-black px-6 py-3 rounded-xl font-bold w-full hover:bg-white transition">Publish Quiz & Question</button>
        </form>
      )}

      <div className="bg-[#0f1014] border border-white/10 rounded-2xl overflow-hidden">
        {quizzes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No quizzes created yet.</div>
        ) : (
          quizzes.map(q => (
            <div key={q.id} className="flex items-center justify-between p-4 border-b border-white/5 last:border-0">
              <div>
                <p className="font-bold">{q.title}</p>
                <p className="text-xs text-gray-500 uppercase">{q.age_category} • {q.difficulty} • {q.category}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs bg-black/50 px-3 py-1 rounded-lg text-gray-400 border border-white/5">{q.questions?.[0]?.count || 0} Qs</span>
                <span className="text-xs bg-green-500/10 text-green-400 px-3 py-1 rounded-lg font-bold border border-green-500/20 flex items-center gap-1"><CheckCircleIcon weight="fill" /> Published</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}