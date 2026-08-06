import React, { useState, useEffect } from 'react';
import { Home, Loader2, KeyRound, User, Mail, ShieldAlert, Check, X, ArrowLeft, Key } from 'lucide-react';
import api from '../services/api';

interface AuthProps {
  onAuthSuccess: (token: string, user: { _id: string; name: string; nickname: string; email: string; homeId: string | null; role: string; hasCompletedTour?: boolean }) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  // Password Reset Modal States
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [resetStep, setResetStep] = useState<1 | 2 | 3>(1);
  const [resetEmail, setResetEmail] = useState<string>('');
  const [resetOtpInput, setResetOtpInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [resetLoading, setResetLoading] = useState<boolean>(false);
  const [resetError, setResetError] = useState<string | null>(null);

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
    setSuccessBanner(null);

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

  // Step 1: Send OTP to Email
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    setResetError(null);

    try {
      await api.post('/auth/forgot-password', { emailOrNickname: resetEmail });
      setResetStep(2);
    } catch (err: any) {
      console.error('Send OTP error:', err);
      setResetError(err.response?.data?.error || 'Failed to send reset email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  // Step 2: Verify OTP Code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetOtpInput.trim()) return;
    setResetLoading(true);
    setResetError(null);

    try {
      await api.post('/auth/verify-otp', { emailOrNickname: resetEmail, otp: resetOtpInput });
      setResetStep(3);
    } catch (err: any) {
      console.error('Verify OTP error:', err);
      setResetError(err.response?.data?.error || 'Invalid or expired OTP code.');
    } finally {
      setResetLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasswordInput !== confirmPasswordInput) {
      setResetError('Passwords do not match. Please re-enter.');
      return;
    }
    if (newPasswordInput.length < 4) {
      setResetError('New password must be at least 4 characters.');
      return;
    }

    setResetLoading(true);
    setResetError(null);

    try {
      const res = await api.post('/auth/reset-password', {
        emailOrNickname: resetEmail,
        otp: resetOtpInput,
        newPassword: newPasswordInput
      });

      setIsResetModalOpen(false);
      setIsLogin(true);
      setEmail(resetEmail);
      setPassword('');
      setSuccessBanner(res.data.message || 'Password reset successful! You can now log in with your new key.');
      
      // Reset Modal States
      setResetStep(1);
      setResetEmail('');
      setResetOtpInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
    } catch (err: any) {
      console.error('Reset password error:', err);
      setResetError(err.response?.data?.error || 'Failed to reset password. Please try again.');
    } finally {
      setResetLoading(false);
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

          {/* Success Banner */}
          {successBanner && (
            <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-2xl p-3.5 flex gap-3 items-start text-xs text-emerald-400 font-medium leading-normal animate-fade-in">
              <Check size={16} className="shrink-0 mt-0.5 text-emerald-400" />
              <span>{successBanner}</span>
            </div>
          )}

          {/* Soft Warm Error Banner */}
          {error && (
            <div className="bg-rose-950/20 border border-rose-900/30 rounded-2xl p-3.5 flex gap-3 items-start text-xs text-[#E38D73] font-medium leading-normal animate-shake">
              <ShieldAlert size={16} className="shrink-0 mt-0.5 text-[#E38D73]" />
              <span>{error}</span>
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
                  onClick={() => {
                    setResetEmail(email);
                    setResetStep(1);
                    setResetError(null);
                    setIsResetModalOpen(true);
                  }}
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

      {/* 🔑 3-Step Email OTP Password Reset Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#251B17] border border-[#382923] w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative animate-fade-in">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-[#382923] pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#E38D73]/15 text-[#E38D73] flex items-center justify-center">
                  <Key size={16} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#FAF6F0]">Reset Password Key</h3>
                  <p className="text-[10px] text-[#A69788]">Step {resetStep} of 3</p>
                </div>
              </div>
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="p-1 hover:bg-[#382923] rounded-lg text-[#A69788] hover:text-[#FAF6F0] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Error Banner in Modal */}
            {resetError && (
              <div className="bg-rose-950/20 border border-rose-900/30 rounded-2xl p-3 flex gap-2.5 items-start text-xs text-[#E38D73] leading-normal animate-shake">
                <ShieldAlert size={16} className="shrink-0 mt-0.5 text-[#E38D73]" />
                <span>{resetError}</span>
              </div>
            )}

            {/* STEP 1: Request Email OTP */}
            {resetStep === 1 && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <p className="text-xs text-[#A69788] leading-relaxed">
                  Enter your registered household email or handle (@nickname). We will send a 6-digit OTP reset key to your email address from <span className="text-[#E38D73] font-bold">lifeos.household@gmail.com</span>.
                </p>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-[#A69788]">Email or Handle (@nickname)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-[#78695C]">
                      <Mail size={15} />
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. alex or alex@example.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full bg-[#1C1512] border border-[#382923] rounded-2xl pl-10 pr-4 py-3 text-xs text-[#FAF6F0] font-medium placeholder-[#78695C] focus:outline-none focus:border-[#E38D73] focus:ring-2 focus:ring-[#E38D73]/15 transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(false)}
                    className="bg-[#1C1512] hover:bg-[#2E221E] border border-[#382923] text-xs font-semibold text-[#A69788] px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="bg-[#E38D73] hover:bg-[#F2A38A] disabled:opacity-50 text-[#1C1512] font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    {resetLoading ? <Loader2 size={14} className="animate-spin text-[#1C1512]" /> : null}
                    <span>Send Reset Key →</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Verify 6-Digit OTP */}
            {resetStep === 2 && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="bg-[#1C1512] border border-[#382923] p-3 rounded-2xl text-xs text-[#A69788] leading-relaxed">
                  📧 Check your email inbox (<span className="text-[#FAF6F0] font-bold">{resetEmail}</span>) for your 6-digit key.
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-[#A69788]">6-Digit OTP Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 592814"
                    value={resetOtpInput}
                    onChange={(e) => setResetOtpInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-[#1C1512] border border-[#382923] rounded-2xl px-4 py-3 text-center text-lg tracking-[8px] font-extrabold text-[#E38D73] focus:outline-none focus:border-[#E38D73] focus:ring-2 focus:ring-[#E38D73]/15 transition-all"
                    required
                  />
                </div>

                <div className="flex justify-between items-center text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => setResetStep(1)}
                    className="text-xs text-[#A69788] hover:text-[#FAF6F0] flex items-center gap-1 cursor-pointer bg-transparent border-none"
                  >
                    <ArrowLeft size={13} />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setResetLoading(true);
                      setResetError(null);
                      try {
                        await api.post('/auth/forgot-password', { emailOrNickname: resetEmail });
                        setResetOtpInput('');
                      } catch (err: any) {
                        setResetError(err.response?.data?.error || 'Failed to resend code.');
                      } finally {
                        setResetLoading(false);
                      }
                    }}
                    disabled={resetLoading}
                    className="text-[#E38D73] hover:text-[#F2A38A] font-semibold cursor-pointer bg-transparent border-none text-xs"
                  >
                    Resend New Key
                  </button>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={resetLoading || resetOtpInput.length < 6}
                    className="w-full bg-[#E38D73] hover:bg-[#F2A38A] disabled:opacity-50 text-[#1C1512] font-bold text-xs py-3 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {resetLoading ? <Loader2 size={14} className="animate-spin text-[#1C1512]" /> : null}
                    <span>Verify Key →</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Set New Password */}
            {resetStep === 3 && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-xs text-[#A69788] leading-relaxed">
                  Key verified! Enter a new password for your LifeOS account.
                </p>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-[#A69788]">New Password</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-[#78695C]">
                      <KeyRound size={15} />
                    </span>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      className="w-full bg-[#1C1512] border border-[#382923] rounded-2xl pl-10 pr-4 py-3 text-xs text-[#FAF6F0] font-medium placeholder-[#78695C] focus:outline-none focus:border-[#E38D73] focus:ring-2 focus:ring-[#E38D73]/15 transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-[#A69788]">Confirm New Password</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-[#78695C]">
                      <KeyRound size={15} />
                    </span>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      className="w-full bg-[#1C1512] border border-[#382923] rounded-2xl pl-10 pr-4 py-3 text-xs text-[#FAF6F0] font-medium placeholder-[#78695C] focus:outline-none focus:border-[#E38D73] focus:ring-2 focus:ring-[#E38D73]/15 transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full bg-[#E38D73] hover:bg-[#F2A38A] disabled:opacity-50 text-[#1C1512] font-bold text-xs py-3 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {resetLoading ? <Loader2 size={14} className="animate-spin text-[#1C1512]" /> : null}
                    <span>Save New Key & Head Home →</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
