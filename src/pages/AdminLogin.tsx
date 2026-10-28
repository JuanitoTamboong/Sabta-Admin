// src/pages/AdminLogin.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  ShieldCheckIcon, 
  LockKeyIcon, 
  EnvelopeIcon, 
  EyeIcon, 
  EyeSlashIcon,
  ArrowRightIcon,
  CommandIcon, 
  GlobeIcon,
  LightningIcon
} from '@phosphor-icons/react'

import sabtaLogo from '../assets/icons/sabta-logo.png'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }
    
    if (data.user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (profileError) {
        setError(`Database Error: ${profileError.message}`)
        await supabase.auth.signOut()
      } else if (profile?.role === 'admin') {
        // ✅ FIXED: Navigates to dashboard instead of analytics
        navigate('/admin/dashboard') 
      } else {
        setError('Access Denied. Admin privileges required.')
        await supabase.auth.signOut() 
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex overflow-hidden">
      
      {/* LEFT SIDE - BRANDING (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-12 bg-[#0a0a0a] border-r border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#ccff00_0.5px,transparent_0.5px)] [background-size:24px_24px] opacity-10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#ccff00]/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center overflow-hidden p-1">
            <img src={sabtaLogo} alt="SabTa Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-3xl font-black tracking-tighter">
            SAB<span className="text-[#ccff00]">TA</span>
          </span>
        </div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00f0ff]/10 border border-[#00f0ff]/20 text-[#00f0ff] text-xs font-bold uppercase tracking-widest mb-6">
            <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse" />
            System Online
          </div>
          <h1 className="text-5xl font-bold leading-tight tracking-tight mb-6">
            Control the <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ccff00] to-[#00f0ff]">Arena.</span>
          </h1>
          <p className="text-gray-400 max-w-md text-lg">
            Access the central command interface to manage players, deploy quizzes, and monitor the global leaderboard.
          </p>
        </div>

        <div className="relative z-10 flex gap-8 text-sm font-mono text-gray-500">
          <div className="flex items-center gap-2"><GlobeIcon /> Server: Active</div>
          <div className="flex items-center gap-2"><LightningIcon /> Latency: 12ms</div>
          <div className="flex items-center gap-2"><ShieldCheckIcon /> Security: Max</div>
        </div>
      </div>

      {/* RIGHT SIDE - LOGIN FORM */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 relative">
        
        {/* Mobile Background Glows */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none lg:hidden" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] bg-[#ccff00]/10 rounded-full blur-[80px] pointer-events-none lg:hidden" />

        <div className="w-full max-w-[400px] relative z-10">
          
          {/* Mobile Logo & Title */}
          <div className="lg:hidden flex flex-col items-center mb-6">
            <div className="w-14 h-14 bg-[#0f1014] border border-white/10 rounded-2xl flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(204,255,0,0.15)] p-2">
              <img src={sabtaLogo} alt="SabTa Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xl font-black tracking-tighter text-white">SAB<span className="text-[#ccff00]">TA</span> ADMIN</h1>
          </div>

          {/* Terminal-style Login Box */}
          <div className="bg-[#0f1014]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-7 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#ccff00] to-transparent opacity-50" />
            
            <div className="mb-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CommandIcon className="text-[#ccff00] w-5 h-5" />
                Secure Login
              </h2>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-1.5 font-mono">Enter your credentials to authenticate.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-widest block mb-1.5">Admin Email</label>
                <div className="flex items-center gap-3 bg-black/50 border border-white/10 rounded-xl px-3.5 py-3 focus-within:border-[#ccff00]/50 focus-within:bg-[#ccff00]/5 transition-all duration-300">
                  <EnvelopeIcon className="text-gray-500 w-4 h-4 shrink-0" />
                  <input 
                    type="email" 
                    required 
                    placeholder="admin@sabta.app" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="bg-transparent outline-none w-full text-xs sm:text-sm text-white placeholder:text-gray-600 font-mono" 
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-widest block mb-1.5">Password</label>
                <div className="flex items-center gap-3 bg-black/50 border border-white/10 rounded-xl px-3.5 py-3 focus-within:border-[#ccff00]/50 focus-within:bg-[#ccff00]/5 transition-all duration-300">
                  <LockKeyIcon className="text-gray-500 w-4 h-4 shrink-0" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="bg-transparent outline-none w-full text-xs sm:text-sm text-white placeholder:text-gray-600 font-mono" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-500 hover:text-[#ccff00] transition focus:outline-none shrink-0"
                  >
                    {showPassword ? <EyeSlashIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border-l-4 border-red-500 rounded-r-xl px-3 py-2.5 text-[10px] text-red-400 font-mono leading-tight">
                  ERR: {error}
                </div>
              )}

              <button 
                type="submit"
                disabled={loading} 
                className="w-full group relative flex items-center justify-center gap-2 bg-[#ccff00] text-black py-3.5 rounded-xl font-bold text-xs sm:text-sm hover:bg-white transition-all duration-300 mt-2 disabled:opacity-50 overflow-hidden shadow-[0_0_20px_rgba(204,255,0,0.2)] hover:shadow-[0_0_30px_rgba(204,255,0,0.4)]"
              >
                <span className="relative z-10 tracking-wider">{loading ? 'AUTHENTICATING...' : 'ACCESS SYSTEM'}</span>
                {!loading && <ArrowRightIcon className="relative z-10 w-4 h-4 group-hover:translate-x-1 transition-transform" />}
              </button>
            </form>
            
            <div className="mt-5 text-center">
              <p className="text-[9px] text-gray-600 font-mono">
                Unauthorized access is strictly prohibited.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}