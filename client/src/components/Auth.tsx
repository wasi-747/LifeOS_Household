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
      if (!err.response) {
        setError('Cannot connect to server. Please check your connection or wait ~30s if the backend is waking up.');
      } else {
        setError(err.response?.data?.error || 'Unable to open the front door. Please verify your details.');
      }
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
      if (!err.response) {
        setResetError('Cannot connect to server. Please try again in a few moments.');
      } else {
        setResetError(err.response?.data?.error || 'Failed to send reset email. Please try again.');
      }
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
      if (!err.response) {
        setResetError('Cannot connect to server. Please try again in a few moments.');
      } else {
        setResetError(err.response?.data?.error || 'Invalid or expired OTP code.');
      }
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
      if (!err.response) {
        setResetError('Cannot connect to server. Please try again in a few moments.');
      } else {
        setResetError(err.response?.data?.error || 'Failed to reset password. Please try again.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#F6F8F5] flex items-center justify-center p-4 lg:p-8 font-sans text-slate-900">
      {/* Main Split-Screen Container */}
      <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-3xl shadow-2xl shadow-slate-300/40 overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10 animate-fade-in transition-all duration-300">

        {/* LEFT COLUMN: Form Container */}
        <div className="lg:col-span-6 p-6 sm:p-10 md:p-12 flex flex-col justify-between space-y-8 bg-white">
          
          {/* Header & Small House Logo */}
          <div className="space-y-6">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                <Home size={20} />
              </div>
              <span className="font-serif text-lg font-bold tracking-tight text-slate-900">LifeOS</span>
            </div>

            {/* Time-of-day Aware Heading */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-serif font-black text-slate-900 leading-tight tracking-tight">
                {greeting}
              </h1>
              <p className="text-sm font-medium text-slate-500 leading-relaxed">
                {isLogin
                  ? "— sign in to check on the house."
                  : "— set up your cozy home & invite your roommates."}
              </p>
            </div>
          </div>

          {/* Success Banner */}
          {successBanner && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex gap-3 items-start text-xs text-emerald-800 font-medium leading-normal animate-fade-in">
              <Check size={16} className="shrink-0 mt-0.5 text-emerald-600" />
              <span>{successBanner}</span>
            </div>
          )}

          {/* Soft Error Banner */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex gap-3 items-start text-xs text-rose-700 font-medium leading-normal animate-shake">
              <ShieldAlert size={16} className="shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Your Display Name
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-slate-400">
                    <User size={15} />
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. Alex Johnson"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all shadow-xs"
                    required
                  />
                </div>
              </div>
            )}

            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Unique Roommate Handle
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-emerald-600 font-bold text-xs font-sans">@</span>
                  <input
                    type="text"
                    placeholder="e.g. alex"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-4 py-3 text-xs text-slate-900 font-bold placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all shadow-xs"
                    required
                  />
                </div>
                <span className="text-[10px] text-slate-400 leading-tight block">Roommates will use this handle to invite you to the household ledger.</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {isLogin ? 'Email or @handle' : 'Email Address'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-slate-400">
                  <Mail size={15} />
                </span>
                <input
                  type={isLogin ? 'text' : 'email'}
                  placeholder={isLogin ? 'e.g. alex or alex@example.com' : 'e.g. alex@example.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all shadow-xs"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-slate-400">
                  <KeyRound size={15} />
                </span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all shadow-xs"
                  required
                />
              </div>
            </div>

            {/* Remember Me & Lost your key? Controls */}
            {isLogin && (
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/30 accent-emerald-600 cursor-pointer"
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
                  className="text-emerald-600 hover:text-emerald-700 font-semibold hover:underline transition-all cursor-pointer bg-transparent border-none"
                >
                  Lost your key?
                </button>
              </div>
            )}

            {/* Primary Action CTA */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs py-3.5 rounded-2xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-2 mt-4 border-0"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin text-white" />
                  <span>Unlocking door...</span>
                </>
              ) : (
                <span>{isLogin ? 'Head Home →' : 'Set Up Your Home →'}</span>
              )}
            </button>
          </form>

          {/* Toggle Login/Signup */}
          <div className="border-t border-slate-100 pt-5 text-center">
            <p className="text-xs text-slate-500">
              {isLogin ? "New here?" : "Already registered?"}{' '}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                }}
                className="text-emerald-600 hover:text-emerald-700 font-bold hover:underline transition-all cursor-pointer bg-transparent border-none ml-1"
              >
                {isLogin ? 'Set up your home →' : 'Head home →'}
              </button>
            </p>
          </div>

        </div>

        {/* RIGHT COLUMN: Modern Tech Illustration */}
        <div className="hidden lg:flex lg:col-span-6 bg-slate-50/80 border-l border-slate-200 p-12 flex-col justify-between relative overflow-hidden">
          
          {/* Subtle Ambient Background Orbs */}
          <div className="absolute top-10 right-10 w-48 h-48 rounded-full bg-emerald-500/5 blur-2xl pointer-events-none" />
          <div className="absolute bottom-10 left-10 w-56 h-56 rounded-full bg-teal-500/5 blur-2xl pointer-events-none" />

          {/* Top Badge */}
          <div className="relative z-10 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-600 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Shared Household OS
            </span>
            <span className="text-[11px] font-semibold text-slate-400">v2.4 Edition</span>
          </div>

          {/* Custom SVG Illustration */}
          <div className="my-auto py-8 relative z-10 flex flex-col items-center justify-center text-center">
            <svg
              viewBox="0 0 400 320"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full max-w-xs sm:max-w-sm drop-shadow-md"
            >
              <rect x="30" y="40" width="340" height="240" rx="32" fill="#FFFFFF" stroke="#DCE5D8" strokeWidth="2" />
              <rect x="50" y="60" width="300" height="200" rx="20" fill="#F6F8F5" stroke="#DCE5D8" strokeWidth="1.5" strokeDasharray="4 4" />

              <circle cx="100" cy="110" r="28" fill="#52B788" opacity="0.15" />

              <path d="M200 80 L290 140 H110 L200 80 Z" fill="#2D6A4F" opacity="0.85" />
              <rect x="250" y="90" width="14" height="25" rx="3" fill="#20503B" />

              <rect x="110" y="210" width="180" height="12" rx="4" fill="#DCE5D8" />
              <rect x="130" y="222" width="10" height="48" rx="3" fill="#CBD7C7" />
              <rect x="260" y="222" width="10" height="48" rx="3" fill="#CBD7C7" />

              <rect x="155" y="190" width="22" height="20" rx="4" fill="#2D6A4F" />
              <path d="M177 195 C182 195 182 205 177 205" stroke="#2D6A4F" strokeWidth="2.5" strokeLinecap="round" />

              <rect x="190" y="192" width="20" height="18" rx="4" fill="#20503B" />
              <path d="M210 196 C214 196 214 204 210 204" stroke="#20503B" strokeWidth="2.5" strokeLinecap="round" />

              <path d="M230 210 L234 186 H256 L260 210 H230 Z" fill="#D4A373" />
              <circle cx="215" cy="165" r="7" fill="#52B788" />
              <circle cx="228" cy="162" r="6" fill="#40916C" />
              <circle cx="275" cy="175" r="7" fill="#52B788" />

              <ellipse cx="200" cy="270" rx="110" ry="14" fill="#DCE5D8" />
              <ellipse cx="200" cy="270" rx="90" ry="9" fill="#EDF2EB" />
            </svg>

            {/* Illustration Subtitle */}
            <div className="mt-6 space-y-1.5 max-w-xs">
              <h3 className="font-serif font-bold text-lg text-slate-900">
                Your house, in harmony.
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Split rent & groceries, log daily meals, track sub-wallets, and keep roommate life stress-free.
              </p>
            </div>
          </div>

          {/* Bottom Household Motto */}
          <div className="relative z-10 flex items-center justify-center gap-4 text-xs font-semibold text-slate-500 pt-4 border-t border-slate-200">
            <span className="flex items-center gap-1"><Check size={13} className="text-emerald-600" /> Fair Splits</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Check size={13} className="text-emerald-600" /> Meal Ledger</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Check size={13} className="text-emerald-600" /> PC Telemetry</span>
          </div>

        </div>

      </div>

      {/* 🔑 3-Step Email OTP Password Reset Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative animate-fade-in text-slate-900">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                  <Key size={16} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-slate-900">Reset Password Key</h3>
                  <p className="text-[10px] text-slate-500">Step {resetStep} of 3</p>
                </div>
              </div>
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer border-0 bg-transparent"
              >
                <X size={16} />
              </button>
            </div>

            {/* Error Banner in Modal */}
            {resetError && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex gap-2.5 items-start text-xs text-rose-700 leading-normal animate-shake">
                <ShieldAlert size={16} className="shrink-0 mt-0.5 text-rose-600" />
                <span>{resetError}</span>
              </div>
            )}

            {/* STEP 1: Request Email OTP */}
            {resetStep === 1 && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enter your registered household email or handle (@nickname). We will send a 6-digit OTP reset key to your email address.
                </p>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Email or Handle (@nickname)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-slate-400">
                      <Mail size={15} />
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. alex or alex@example.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all shadow-xs"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(false)}
                    className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-600 px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-2 border-0"
                  >
                    {resetLoading ? <Loader2 size={14} className="animate-spin text-white" /> : null}
                    <span>Send Reset Key →</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Verify 6-Digit OTP */}
            {resetStep === 2 && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-xs text-slate-600 leading-relaxed shadow-xs">
                  📧 Check your email inbox (<span className="text-slate-900 font-bold">{resetEmail}</span>) for your 6-digit key.
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">6-Digit OTP Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 592814"
                    value={resetOtpInput}
                    onChange={(e) => setResetOtpInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-center text-lg tracking-[8px] font-extrabold text-emerald-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all shadow-xs"
                    required
                  />
                </div>

                <div className="flex justify-between items-center text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => setResetStep(1)}
                    className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-transparent border-none"
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
                        if (!err.response) {
                          setResetError('Cannot connect to server. Please ensure the backend server is running.');
                        } else {
                          setResetError(err.response?.data?.error || 'Failed to resend code.');
                        }
                      } finally {
                        setResetLoading(false);
                      }
                    }}
                    disabled={resetLoading}
                    className="text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer bg-transparent border-none text-xs"
                  >
                    Resend New Key
                  </button>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={resetLoading || resetOtpInput.length < 6}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 border-0"
                  >
                    {resetLoading ? <Loader2 size={14} className="animate-spin text-white" /> : null}
                    <span>Verify Key →</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Set New Password */}
            {resetStep === 3 && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Key verified! Enter a new password for your LifeOS account.
                </p>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">New Password</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-slate-400">
                      <KeyRound size={15} />
                    </span>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all shadow-xs"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Confirm New Password</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-slate-400">
                      <KeyRound size={15} />
                    </span>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all shadow-xs"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 border-0"
                  >
                    {resetLoading ? <Loader2 size={14} className="animate-spin text-white" /> : null}
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
