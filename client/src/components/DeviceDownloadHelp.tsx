import { Download, AlertTriangle, ShieldCheck, X } from "lucide-react";

interface DeviceDownloadHelpProps {
  onClose: () => void;
}

export default function DeviceDownloadHelp({ onClose }: DeviceDownloadHelpProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-slate-900 border border-slate-800 w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Download size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-serif">
                Install LifeOS Agent
              </h2>
              <p className="text-xs text-slate-400">
                Unsigned distribution - security warning instructions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-semibold cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 py-5 space-y-6 text-sm text-slate-300 leading-relaxed">
          {/* Warning Notice */}
          <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
              <div>
                <h3 className="font-semibold text-amber-400 mb-1">
                  This app is not code-signed yet
                </h3>
                <p className="text-xs text-amber-200/80">
                  You may see security warnings on first launch. This is expected for new apps that haven't been code-signed yet. 
                  The warnings are due to the lack of a digital signature, not because the app is unsafe.
                </p>
              </div>
            </div>
          </div>

          {/* Windows Instructions */}
          <div className="space-y-3">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                W
              </span>
              Windows Installation
            </h3>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3 text-xs">
              <div className="pb-2">
                <a
                  href="/public/downloads/LifeOSAgent.exe"
                  download="LifeOSAgent.exe"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white font-bold rounded-xl transition-all cursor-pointer shadow-md"
                >
                  <Download size={14} />
                  Download LifeOSAgent.exe
                </a>
              </div>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  <span className="font-medium text-slate-200">Download the agent:</span> Click the download button above to get the Windows executable.
                </li>
                <li>
                  <span className="font-medium text-slate-200">Run the installer:</span> Double-click the downloaded file.
                </li>
                <li>
                  <span className="font-medium text-slate-200">SmartScreen warning:</span> If Windows SmartScreen appears, click <span className="bg-slate-700 px-1.5 py-0.5 rounded text-white font-mono">"More info"</span> then <span className="bg-slate-700 px-1.5 py-0.5 rounded text-white font-mono">"Run anyway"</span>.
                </li>
                <li>
                  <span className="font-medium text-slate-200">Pair your device:</span> Launch the agent, enter the pairing code from your LifeOS account.
                </li>
              </ol>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
                <p className="text-slate-400">
                  <span className="text-amber-400 font-semibold">Note:</span> The "More info" → "Run anyway" flow is a standard Windows security feature for unsigned apps. 
                  This is normal and expected.
                </p>
              </div>
            </div>
          </div>

          {/* Mac Instructions */}
          <div className="space-y-3">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-slate-500/20 text-slate-400 flex items-center justify-center text-xs font-bold">
                M
              </span>
              macOS Installation
            </h3>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3 text-xs">
              <div className="pb-2">
                <a
                  href="/public/downloads/LifeOSAgent.zip"
                  download="LifeOSAgent.zip"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-750 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-all cursor-pointer shadow-md"
                >
                  <Download size={14} />
                  Download LifeOSAgent.zip
                </a>
              </div>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  <span className="font-medium text-slate-200">Download the agent:</span> Click the download button above to get the macOS ZIP archive.
                </li>
                <li>
                  <span className="font-medium text-slate-200">Extract & Run:</span> Unzip the file and run <span className="bg-slate-700 px-1.5 py-0.5 rounded text-white font-mono">python device_tracker.py</span> in Terminal (requires Python).
                </li>
                <li>
                  <span className="font-medium text-slate-200">Gatekeeper warning:</span> If macOS blocks Python or dependencies, go to <span className="bg-slate-700 px-1.5 py-0.5 rounded text-white font-mono">System Settings → Privacy & Security</span>.
                </li>
                <li>
                  <span className="font-medium text-slate-200">Allow the app:</span> Click <span className="bg-slate-700 px-1.5 py-0.5 rounded text-white font-mono">"Open Anyway"</span>.
                </li>
                <li>
                  <span className="font-medium text-slate-200">Pair your device:</span> Enter the pairing code from your LifeOS account when prompted.
                </li>
              </ol>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
                <p className="text-slate-400">
                  <span className="text-amber-400 font-semibold">Note:</span> macOS Gatekeeper blocks unsigned apps by default. The "Open Anyway" button appears after you attempt to open the app the first time.
                </p>
              </div>
            </div>
          </div>

          {/* Privacy Assurance */}
          <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="text-emerald-400 shrink-0 mt-0.5" size={18} />
              <div>
                <h3 className="font-semibold text-emerald-400 mb-1">
                  Your privacy is protected
                </h3>
                <ul className="text-xs text-emerald-200/80 space-y-1 list-disc pl-4">
                  <li>Source code is available for transparency</li>
                  <li>No window titles, URLs, or screen content are ever captured</li>
                  <li>You can revoke consent and delete data at any time</li>
                  <li>Data is encrypted in transit and stored securely</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="space-y-3">
            <h3 className="text-white font-semibold">Troubleshooting</h3>
            <div className="space-y-2 text-xs">
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-800">
                <p className="font-medium text-slate-200 mb-1">Agent won't start?</p>
                <p className="text-slate-400">Make sure you've paired it with a valid pairing code from your LifeOS account. The code expires in 15 minutes.</p>
              </div>
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-800">
                <p className="font-medium text-slate-200 mb-1">Can't bypass security warning?</p>
                <p className="text-slate-400">On Windows, run as Administrator. On Mac, use Terminal: <span className="bg-slate-700 px-1.5 py-0.5 rounded text-white font-mono">sudo spctl --master-disable</span> (re-enable after install).</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer transition-all"
          >
            Got it, thanks
          </button>
        </div>
      </div>
    </div>
  );
}
