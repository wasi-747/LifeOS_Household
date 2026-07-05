import React, { useState } from 'react';
import { Home, Loader2, KeyRound, User, Mail, ShieldAlert } from 'lucide-react';
import api from '../services/api';

interface AuthProps {
  onAuthSuccess: (token: string, user: { _id: string; name: string; nickname: string; email: string; homeId: string | null; role: string }) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

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
      setError(err.response?.data?.error || 'Authentication failed. Please verify fields.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#1C1512] flex flex-col items-center justify-center p-4 selection:bg-[#523D35] text-[#FAF6F0]">
      {/* Texture Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.035] bg-[url('https://www.transparenttextures.com/patterns/cardboard-flat.png')]" />

      <div className="w-full max-w-md bg-[#251B17] border border-[#382923] rounded-3xl p-8 shadow-2xl shadow-black/20 relative z-10 space-y-8 animate-fade-in">
        {/* App Logo */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="bg-[#E38D73] p-3 rounded-2xl text-[#1C1512] shadow-lg shadow-[#E38D73]/15 animate-pulse">
            <Home size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black font-serif text-[#FAF6F0] tracking-tight">LifeOS</h1>
            <p className="text-[#A69788] text-xs font-semibold uppercase tracking-wider mt-1">Cozy Roommate Management</p>
          </div>
        </div>

        {/* Form Header */}
        <div className="text-center">
          <h2 className="text-xl font-bold font-serif text-[#FAF6F0]">
            {isLogin ? 'Welcome Back!' : 'Create an Account'}
          </h2>
          <p className="text-xs text-[#A69788] mt-1">
            {isLogin ? 'Sign in to access your household ledger' : 'Register your nickname to join/create a home'}
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-rose-950/20 border border-rose-900/30 rounded-2xl p-3 flex gap-2.5 items-start text-xs text-[#E38D73] leading-normal animate-shake">
            <ShieldAlert size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-[#A69788]">Display Name</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-[#78695C]">
                  <User size={14} />
                </span>
                <input
                  type="text"
                  placeholder="e.g. Borno Ahmed"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-[#1C1512] border border-[#382923] rounded-xl pl-9 pr-4 py-2.5 w-full focus:outline-none focus:border-[#E38D73] text-xs text-[#FAF6F0] transition-all font-medium placeholder-[#78695C]"
                  required
                />
              </div>
            </div>
          )}

          {!isLogin && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-[#A69788]">Unique Nickname</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-[#78695C] text-xs font-bold font-sans">@</span>
                <input
                  type="text"
                  placeholder="e.g. borno"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="bg-[#1C1512] border border-[#382923] rounded-xl pl-8 pr-4 py-2.5 w-full focus:outline-none focus:border-[#E38D73] text-xs text-[#FAF6F0] transition-all font-bold font-sans placeholder-[#78695C]"
                  required
                />
              </div>
              <span className="text-[9px] text-[#A69788] leading-tight block">Roommates will use this nickname to invite you. Letters, numbers, and underscores only.</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-[#A69788]">
              {isLogin ? 'Email or Nickname' : 'Email Address'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-[#78695C]">
                <Mail size={14} />
              </span>
              <input
                type={isLogin ? 'text' : 'email'}
                placeholder={isLogin ? 'e.g. borno or email@example.com' : 'e.g. borno@example.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#1C1512] border border-[#382923] rounded-xl pl-9 pr-4 py-2.5 w-full focus:outline-none focus:border-[#E38D73] text-xs text-[#FAF6F0] transition-all font-medium placeholder-[#78695C]"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-[#A69788]">Password</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-[#78695C]">
                <KeyRound size={14} />
              </span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#1C1512] border border-[#382923] rounded-xl pl-9 pr-4 py-2.5 w-full focus:outline-none focus:border-[#E38D73] text-xs text-[#FAF6F0] transition-all font-medium placeholder-[#78695C]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#E38D73] hover:bg-[#F2A38A] disabled:opacity-50 text-[#1C1512] font-bold text-xs py-3 rounded-xl transition-all shadow-md shadow-[#E38D73]/10 cursor-pointer flex items-center justify-center gap-2 mt-6"
          >
            {loading ? (
              <>
                <Loader2 className="h-4.5 w-4.5 animate-spin text-[#1C1512]" />
                <span>Working...</span>
              </>
            ) : (
              <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
            )}
          </button>
        </form>

        {/* Switching Toggles */}
        <div className="border-t border-[#382923] pt-4 text-center">
          <p className="text-xs text-[#A69788]">
            {isLogin ? "New to LifeOS?" : "Already have an account?"}{' '}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setEmail('');
                setPassword('');
              }}
              className="text-[#E38D73] hover:text-[#F2A38A] hover:underline font-bold transition-all cursor-pointer bg-transparent border-none"
            >
              {isLogin ? 'Create one here' : 'Sign in here'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
