import React, { useState } from 'react';
import { Loader2, RefreshCw, LogOut, Info } from 'lucide-react';
import api from '../services/api';
import ConfirmDialog from './ConfirmDialog';

interface HomeOnboardingProps {
  user: { name: string; nickname: string; email: string };
  onHomeCreated: (homeId: string) => void;
  onLogout: () => void;
}

export default function HomeOnboarding({ user, onHomeCreated, onLogout }: HomeOnboardingProps) {
  const [homeName, setHomeName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Custom Alert Modal State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isAlert?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const showAlert = (title: string, message: string) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText: 'OK',
      isAlert: true,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleCreateHome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeName.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/home/create', { name: homeName });
      onHomeCreated(response.data.home._id);
    } catch (err: any) {
      console.error('Create home error:', err);
      setError(err.response?.data?.error || 'Failed to create home. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInvite = async () => {
    setLoading(true);
    try {
      const response = await api.get('/auth/me');
      if (response.data.user.homeId) {
        onHomeCreated(response.data.user.homeId);
      } else {
        showAlert(
          "No Invitations Found",
          "No invitations found yet. Ask your admin roommate to invite @" + user.nickname
        );
      }
    } catch (err) {
      console.error('Error checking invite:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#1C1512] flex flex-col items-center justify-center p-4 selection:bg-[#523D35] text-[#FAF6F0]">
      {/* Texture Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.035] bg-[url('https://www.transparenttextures.com/patterns/cardboard-flat.png')]" />

      <div className="w-full max-w-2xl bg-[#251B17] border border-[#382923] rounded-3xl p-8 shadow-2xl shadow-black/20 relative z-10 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-[#382923] pb-5">
          <div>
            <h1 className="text-2xl font-black font-serif text-[#FAF6F0]">Hello, {user.name}!</h1>
            <p className="text-xs text-[#A69788] mt-1">Nickname: <span className="font-bold text-[#E38D73]">@{user.nickname}</span></p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1C1512] hover:bg-[#2E221E] border border-[#382923] rounded-xl text-xs font-semibold text-[#FAF6F0] cursor-pointer transition-all"
          >
            <LogOut size={13} />
            <span>Logout</span>
          </button>
        </div>

        {error && (
          <div className="bg-rose-950/20 border border-rose-900/30 rounded-xl p-3 flex gap-2.5 items-start text-xs text-[#E38D73] leading-normal animate-shake">
            <Info size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x divide-[#382923]">
          {/* Column A: Create a Home */}
          <div className="space-y-4 pb-6 md:pb-0">
            <h2 className="text-lg font-bold font-serif text-[#FAF6F0]">Option A: Setup a New Home</h2>
            <p className="text-xs text-[#A69788] leading-relaxed">
              If you want to start a new household expense journal and carry over dues, set up a home. You will become the administrator of this home.
            </p>
            <form onSubmit={handleCreateHome} className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold tracking-wider text-[#A69788]">Home Name</label>
                <input
                  type="text"
                  placeholder="e.g. Apartment 4B or Cozy Nest"
                  value={homeName}
                  onChange={(e) => setHomeName(e.target.value)}
                  className="bg-[#1C1512] border border-[#382923] rounded-xl px-3 py-2 w-full focus:outline-none focus:border-[#E38D73] text-xs text-[#FAF6F0] font-medium placeholder-[#78695C]"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#E38D73] hover:bg-[#F2A38A] disabled:opacity-50 text-[#1C1512] font-bold text-xs py-2.5 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                {loading ? <Loader2 size={13} className="animate-spin text-[#1C1512]" /> : null}
                <span>Create Home</span>
              </button>
            </form>
          </div>

          {/* Column B: Wait for Invitation */}
          <div className="space-y-4 pt-6 md:pt-0 md:pl-8 flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="text-lg font-bold font-serif text-[#FAF6F0]">Option B: Join Existing Home</h2>
              <p className="text-xs text-[#A69788] leading-relaxed">
                If your roommate has already set up the home, ask them to invite you! Tell them your unique nickname:
              </p>
              <div className="bg-[#1C1512] p-4 border border-[#382923] rounded-2xl text-center">
                <span className="text-xl font-bold font-sans text-[#E38D73]">@{user.nickname}</span>
              </div>
            </div>
            <button
              onClick={handleCheckInvite}
              disabled={loading}
              className="w-full bg-[#1C1512] hover:bg-[#2E221E] border border-[#382923] text-[#FAF6F0] font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-4"
            >
              {loading ? <Loader2 size={13} className="animate-spin text-[#FAF6F0]" /> : <RefreshCw size={13} />}
              <span>Check for Invitations</span>
            </button>
          </div>
        </div>
      </div>

      {/* Custom Reusable Alert Modal */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        isAlert={confirmDialog.isAlert}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
