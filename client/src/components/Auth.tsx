import React, { useState, useEffect } from 'react';
import { Home, Loader2, KeyRound, User, Mail, ShieldAlert, Check } from 'lucide-react';
import api from '../services/api';

interface AuthProps {
  onAuthSuccess: (token: string, user: { _id: string; name: string; nickname: string; email: string; homeId: string | null; role: string; hasCompletedTour?: boolean }) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showKeyHelp, setShowKeyHelp] = useState<boolean>(false);

  // Form Fields
  const [name, setName] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  // Time-of-day greeting calculation
  const [greeting, setGreeting] = useState<string>('Good morning');

  useEffect(() => {
    const hr = new Date().getHours();
    if (hr < 12) setGreeting('Good morning');
    else if (hr < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const response = await api.post('/auth/login', {
          emailOrNickname: email,
          password
        });
        localStorage.setItem('lifeos-token', response.data.token);
        onAuthSuccess(response.data.token, response.data.user);
      } else {
        const response = await api.post('/auth/signup', {
          name,
          nickname,
          email,
          password
        });
        localStorage.setItem('lifeos-token', response.data.token);
        onAuthSuccess(response.data.token, response.data.user);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.response?.data?.error || 'Unable to open the front door. Please verify your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#1C1512] flex items-center justify-center p-4 lg:p-8 font-sans selection:bg-[#523D35] text-[#FAF6F0]">
      {/* Texture Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.035] bg-[url('https://www.transparenttextures.com/patterns/cardboard-flat.png')]" />

      {/* Main Split-Screen Container */}
      <div className="w-full max-w-5xl bg-[#251B17] border border-[#382923] rounded-3xl shadow-2xl shadow-black/40 overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10 animate-fade-in transition-all duration-300">

        {/* LEFT COLUMN: Form Container */}
        <div className="lg:col-span-6 p-6 sm:p-10 md:p-12 flex flex-col justify-between space-y-8 bg-[#251B17]">
          
          {/* Header & Small House Logo */}
          <div className="space-y-6">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#E38D73] text-[#1C1512] flex items-center justify-center shadow-lg shadow-[#E38D73]/15 animate-pulse">
                <Home size={20} className="fill-[#1C1512]/20" />
              </div>
              <span className="font-serif text-lg font-bold tracking-tight text-[#FAF6F0]">LifeOS</span>
            </div>

            {/* Time-of-day Aware Heading */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-serif font-black text-[#FAF6F0] leading-tight tracking-tight">
                {greeting}
              </h1>
              <p className="text-sm font-medium text-[#A69788] leading-relaxed">
                {isLogin
                  ? "— sign in to check on the house."
                  : "— set up your cozy home & invite your roommates."}
              </p>
            </div>
          </div>

          {/* Soft Warm Error Banner */}
          {error && (
            <div className="bg-rose-950/20 border border-rose-900/30 rounded-2xl p-3.5 flex gap-3 items-start text-xs text-[#E38D73] font-medium leading-normal animate-shake">
              <ShieldAlert size={16} className="shrink-0 mt-0.5 text-[#E38D73]" />
              <span>{error}</span>
            </div>
          )}

          {/* Lost Your Key Info Alert */}
          {showKeyHelp && (
            <div className="bg-[#1C1512] border border-[#382923] rounded-2xl p-3.5 text-xs text-[#D9CEC1] space-y-1.5 animate-fade-in">
              <p className="font-bold text-[#FAF6F0]">🔑 Lost your key?</p>
              <p className="leading-relaxed">
                Ask your household admin to verify your nickname, or contact your room manager to re-issue your invite token.
              </p>
              <button
                onClick={() => setShowKeyHelp(false)}
                className="text-[11px] font-bold text-[#E38D73] hover:underline cursor-pointer bg-transparent border-none p-0 mt-1"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#A69788]">
                  Your Display Name
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-[#78695C]">
                    <User size={15} />
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. Alex Johnson"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#1C1512] border border-[#382923] rounded-2xl pl-10 pr-4 py-3 text-xs text-[#FAF6F0] font-medium placeholder-[#78695C] focus:outline-none focus:border-[#E38D73] focus:ring-2 focus:ring-[#E38D73]/15 transition-all"
                    required
                  />
                </div>
              </div>
            )}

            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#A69788]">
                  Unique Roommate Handle
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-[#E38D73] font-bold text-xs font-sans">@</span>
                  <input
                    type="text"
                    placeholder="e.g. alex"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full bg-[#1C1512] border border-[#382923] rounded-2xl pl-9 pr-4 py-3 text-xs text-[#FAF6F0] font-bold placeholder-[#78695C] focus:outline-none focus:border-[#E38D73] focus:ring-2 focus:ring-[#E38D73]/15 transition-all"
                    required
                  />
                </div>
                <span className="text-[10px] text-[#A69788] leading-tight block">Roommates will use this handle to invite you to the household ledger.</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#A69788]">
                {isLogin ? 'Email or @handle' : 'Email Address'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-[#78695C]">
                  <Mail size={15} />
                </span>
                <input
                  type={isLogin ? 'text' : 'email'}
                  placeholder={isLogin ? 'e.g. alex or alex@example.com' : 'e.g. alex@example.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#1C1512] border border-[#382923] rounded-2xl pl-10 pr-4 py-3 text-xs text-[#FAF6F0] font-medium placeholder-[#78695C] focus:outline-none focus:border-[#E38D73] focus:ring-2 focus:ring-[#E38D73]/15 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#A69788]">Password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-[#78695C]">
                  <KeyRound size={15} />
                </span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#1C1512] border border-[#382923] rounded-2xl pl-10 pr-4 py-3 text-xs text-[#FAF6F0] font-medium placeholder-[#78695C] focus:outline-none focus:border-[#E38D73] focus:ring-2 focus:ring-[#E38D73]/15 transition-all"
                  required
                />
              </div>
            </div>

            {/* Remember Me & Lost your key? Controls */}
            {isLogin && (
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[#A69788]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-[#382923] text-[#E38D73] focus:ring-[#E38D73]/30 accent-[#E38D73] cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowKeyHelp(!showKeyHelp)}
                  className="text-[#E38D73] hover:text-[#F2A38A] font-semibold hover:underline transition-all cursor-pointer bg-transparent border-none"
                >
                  Lost your key?
                </button>
              </div>
            )}

            {/* Primary Action CTA */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#E38D73] hover:bg-[#F2A38A] disabled:opacity-50 text-[#1C1512] font-bold text-xs py-3.5 rounded-2xl transition-all shadow-md shadow-[#E38D73]/10 cursor-pointer flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin text-[#1C1512]" />
                  <span>Unlocking door...</span>
                </>
              ) : (
                <span>{isLogin ? 'Head Home →' : 'Set Up Your Home →'}</span>
              )}
            </button>
          </form>

          {/* Toggle Login/Signup */}
          <div className="border-t border-[#382923] pt-5 text-center">
            <p className="text-xs text-[#A69788]">
              {isLogin ? "New here?" : "Already registered?"}{' '}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                  setShowKeyHelp(false);
                }}
                className="text-[#E38D73] hover:text-[#F2A38A] font-bold hover:underline transition-all cursor-pointer bg-transparent border-none ml-1"
              >
                {isLogin ? 'Set up your home →' : 'Head home →'}
              </button>
            </p>
          </div>

        </div>

        {/* RIGHT COLUMN: Soft Line Illustration (Hidden on mobile) */}
        <div className="hidden lg:flex lg:col-span-6 bg-[#1F1714] border-l border-[#382923] p-12 flex-col justify-between relative overflow-hidden">
          
          {/* Subtle Ambient Background Orbs */}
          <div className="absolute top-10 right-10 w-48 h-48 rounded-full bg-[#E38D73]/10 blur-2xl pointer-events-none" />
          <div className="absolute bottom-10 left-10 w-56 h-56 rounded-full bg-[#A0B095]/10 blur-2xl pointer-events-none" />

          {/* Top Badge */}
          <div className="relative z-10 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#251B17] border border-[#382923] text-[11px] font-bold text-[#A69788]">
              <span className="w-2 h-2 rounded-full bg-[#A0B095] animate-pulse" />
              Shared Household OS
            </span>
            <span className="text-[11px] font-semibold text-[#78695C]">v2.4 Cozy Edition</span>
          </div>

          {/* Custom SVG Dark Theme Household Line Illustration */}
          <div className="my-auto py-8 relative z-10 flex flex-col items-center justify-center text-center">
            <svg
              viewBox="0 0 400 320"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full max-w-xs sm:max-w-sm drop-shadow-md"
            >
              {/* Cozy Room Background Wall Panel */}
              <rect x="30" y="40" width="340" height="240" rx="32" fill="#2B1F1B" />
              <rect x="50" y="60" width="300" height="200" rx="20" fill="#211714" stroke="#382923" strokeWidth="2" strokeDasharray="4 4" />

              {/* Sun/Moon Warm Light */}
              <circle cx="100" cy="110" r="28" fill="#EBC161" opacity="0.35" />

              {/* House Roof Silhouette & Chimney */}
              <path d="M200 80 L290 140 H110 L200 80 Z" fill="#E38D73" opacity="0.85" />
              <rect x="250" y="90" width="14" height="25" rx="3" fill="#C4634F" />
              <path d="M257 85 C257 80 262 78 265 74" stroke="#E38D73" strokeWidth="2" strokeLinecap="round" opacity="0.6" />

              {/* Kitchen Table */}
              <rect x="110" y="210" width="180" height="12" rx="4" fill="#3A2A23" />
              <rect x="130" y="222" width="10" height="48" rx="3" fill="#2C1F19" />
              <rect x="260" y="222" width="10" height="48" rx="3" fill="#2C1F19" />

              {/* Steaming Coffee Mugs */}
              {/* Mug 1 (Terracotta) */}
              <rect x="155" y="190" width="22" height="20" rx="4" fill="#E38D73" />
              <path d="M177 195 C182 195 182 205 177 205" stroke="#E38D73" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M162 184 C162 178 166 177 166 172" stroke="#F2A38A" strokeWidth="2" strokeLinecap="round" />

              {/* Mug 2 (Sage Green) */}
              <rect x="190" y="192" width="20" height="18" rx="4" fill="#A0B095" />
              <path d="M210 196 C214 196 214 204 210 204" stroke="#A0B095" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M196 186 C196 181 199 180 199 176" stroke="#A0B095" strokeWidth="2" strokeLinecap="round" />

              {/* Pothos Houseplant in Terracotta Pot */}
              <path d="M230 210 L234 186 H256 L260 210 H230 Z" fill="#EBC161" />
              {/* Vines & Leaves */}
              <path d="M245 186 C240 170 225 160 215 165" stroke="#5E735B" strokeWidth="3" strokeLinecap="round" />
              <path d="M245 186 C255 170 270 165 275 175" stroke="#5E735B" strokeWidth="3" strokeLinecap="round" />
              <circle cx="215" cy="165" r="7" fill="#A0B095" />
              <circle cx="228" cy="162" r="6" fill="#5E735B" />
              <circle cx="275" cy="175" r="7" fill="#A0B095" />
              <circle cx="262" cy="166" r="6.5" fill="#5E735B" />

              {/* Cozy Floor Rug */}
              <ellipse cx="200" cy="270" rx="110" ry="14" fill="#2E221E" />
              <ellipse cx="200" cy="270" rx="90" ry="9" fill="#251B17" />
            </svg>

            {/* Illustration Subtitle */}
            <div className="mt-6 space-y-1.5 max-w-xs">
              <h3 className="font-serif font-bold text-lg text-[#FAF6F0]">
                Your house, in harmony.
              </h3>
              <p className="text-xs text-[#A69788] leading-relaxed">
                Split rent & groceries, log daily meals, track sub-wallets, and keep roommate life stress-free.
              </p>
            </div>
          </div>

          {/* Bottom Household Motto */}
          <div className="relative z-10 flex items-center justify-center gap-4 text-xs font-semibold text-[#A69788] pt-4 border-t border-[#382923]">
            <span className="flex items-center gap-1"><Check size={13} className="text-[#A0B095]" /> Fair Splits</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Check size={13} className="text-[#A0B095]" /> Meal Ledger</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Check size={13} className="text-[#A0B095]" /> PC Telemetry</span>
          </div>

        </div>

      </div>
    </div>
  );
}
