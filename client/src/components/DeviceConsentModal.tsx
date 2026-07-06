import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import PrivacyPolicy from "./PrivacyPolicy";

interface DeviceConsentModalProps {
  onConsentGranted: () => void;
  onCancel: () => void;
}

export default function DeviceConsentModal({
  onConsentGranted,
  onCancel,
}: DeviceConsentModalProps) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const handleGrant = async () => {
    if (!checked) return;
    setLoading(true);
    setError(null);
    try {
      const api = (await import("../services/api")).default;
      await api.post("/device-consent", { consentVersion: "1.0" });
      onConsentGranted();
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.message ||
          "Failed to grant consent. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
          onClick={onCancel}
        />
        <div className="relative bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-serif">
                Enable Device Tracking
              </h2>
              <p className="text-xs text-slate-400">
                Required before any data is collected
              </p>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3 text-sm text-slate-300 leading-relaxed">
            <p>
              We track <strong className="text-white">which applications</strong>{" "}
              are used and for how long, including GPU load to help categorize
              gaming vs work.
            </p>
            <p className="text-emerald-400 font-medium">
              We do NOT track window titles, browser history, URLs, or screen
              content.
            </p>
            <button
              type="button"
              onClick={() => setShowPrivacy(true)}
              className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold underline cursor-pointer"
            >
              Read full Privacy Policy
            </button>
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-sm text-slate-300 group-hover:text-slate-200">
              I understand and consent to device usage tracking on my account.
              I know I can revoke this at any time.
            </span>
          </label>

          {error && (
            <p className="text-rose-400 text-xs font-medium">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white border border-slate-700 rounded-xl cursor-pointer disabled:opacity-50"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={handleGrant}
              disabled={!checked || loading}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Enable tracking
            </button>
          </div>
        </div>
      </div>
      {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)} />}
    </>
  );
}
