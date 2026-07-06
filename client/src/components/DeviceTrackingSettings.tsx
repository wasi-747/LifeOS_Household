import { useState } from "react";
import {
  Loader2,
  Trash2,
  ShieldOff,
  FileDown,
  Settings,
} from "lucide-react";
import api from "../services/api";
import ConfirmDialog from "./ConfirmDialog";

interface DeviceTrackingSettingsProps {
  isActive: boolean;
  onConsentChanged: () => void;
  onClose: () => void;
}

export default function DeviceTrackingSettings({
  isActive,
  onConsentChanged,
  onClose,
}: DeviceTrackingSettingsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleExport = async () => {
    setLoading("export");
    setMessage(null);
    try {
      const response = await api.get("/device-usage/export");
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `lifeos-device-usage-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Your data has been downloaded.");
    } catch (err: any) {
      setMessage(err.response?.data?.error || "Export failed.");
    } finally {
      setLoading(null);
    }
  };

  const handleRevoke = async () => {
    setLoading("revoke");
    setMessage(null);
    try {
      await api.delete("/device-consent/me");
      setMessage("Consent revoked. Future tracking is stopped.");
      onConsentChanged();
    } catch (err: any) {
      setMessage(err.response?.data?.error || "Failed to revoke consent.");
    } finally {
      setLoading(null);
      setConfirmRevoke(false);
    }
  };

  const handleDelete = async () => {
    setLoading("delete");
    setMessage(null);
    try {
      const response = await api.delete("/device-usage/mine");
      setMessage(
        response.data.message ||
          `Deleted ${response.data.deletedCount || 0} session records.`,
      );
    } catch (err: any) {
      setMessage(err.response?.data?.error || "Failed to delete data.");
    } finally {
      setLoading(null);
      setConfirmDelete(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="relative bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5 z-10">
          <div className="flex items-center gap-3">
            <Settings size={20} className="text-indigo-400" />
            <h2 className="text-lg font-bold text-white font-serif">
              Device Tracking Settings
            </h2>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-700">
              <span className="text-slate-300">Tracking status</span>
              <span
                className={`text-xs font-bold uppercase tracking-wider ${isActive ? "text-emerald-400" : "text-slate-500"}`}
              >
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="bg-slate-800/30 rounded-xl px-4 py-3 border border-slate-800 text-xs text-slate-400 leading-relaxed">
              <p className="font-semibold text-slate-300 mb-1">
                What is tracked:
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Application/process names and duration</li>
                <li>GPU utilization (for category suggestions)</li>
              </ul>
              <p className="font-semibold text-slate-300 mt-2 mb-1">
                Never tracked:
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Window titles, URLs, browser history, screen content</li>
              </ul>
            </div>
          </div>

          {message && (
            <p className="text-xs text-indigo-400 font-medium">{message}</p>
          )}

          <div className="space-y-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={!!loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl cursor-pointer disabled:opacity-50"
            >
              {loading === "export" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileDown size={14} />
              )}
              Export my data (JSON)
            </button>

            {isActive && (
              <button
                type="button"
                onClick={() => setConfirmRevoke(true)}
                disabled={!!loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-amber-400 bg-amber-950/30 hover:bg-amber-950/50 border border-amber-900/50 rounded-xl cursor-pointer disabled:opacity-50"
              >
                <ShieldOff size={14} />
                Revoke consent
              </button>
            )}

            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={!!loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-rose-400 bg-rose-950/30 hover:bg-rose-950/50 border border-rose-900/50 rounded-xl cursor-pointer disabled:opacity-50"
            >
              {loading === "delete" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              Delete all my tracked data
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full text-xs font-semibold text-slate-400 hover:text-white py-2 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmRevoke}
        title="Revoke tracking consent?"
        message="This stops future data collection from your devices. Existing data remains until you delete it."
        confirmText="Revoke consent"
        onConfirm={handleRevoke}
        onCancel={() => setConfirmRevoke(false)}
      />
      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete all tracked data?"
        message="This permanently removes all device usage sessions linked to your account. This cannot be undone."
        confirmText="Delete everything"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
