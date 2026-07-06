interface PrivacyPolicyProps {
  onClose: () => void;
}

export default function PrivacyPolicy({ onClose }: PrivacyPolicyProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-slate-900 border border-slate-800 w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <h2 className="text-lg font-bold text-white font-serif">
            Privacy Policy — Device Tracking
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-4 text-sm text-slate-300 leading-relaxed">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">
            Last updated: July 2026
          </p>

          <section className="space-y-2">
            <h3 className="text-white font-semibold">What we collect</h3>
            <p>
              When you opt in to Device Desk tracking, LifeOS records which
              applications are active on your computer and for how long. We also
              capture average GPU utilization per application session to help
              suggest categories (e.g., gaming vs work).
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-white font-semibold">What we never collect</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Window titles or screen content</li>
              <li>Browser URLs or browsing history</li>
              <li>Keystrokes, clipboard, or file contents</li>
              <li>Microphone or camera data</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-white font-semibold">Consent</h3>
            <p>
              Tracking only begins after you personally opt in. Household admins
              cannot consent on your behalf. You may revoke consent and delete
              your data at any time from Device Desk settings.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-white font-semibold">Data sharing</h3>
            <p>
              Usage data is shared within your household for shared expense and
              usage insights. We do not sell your data to third parties.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-white font-semibold">Your rights</h3>
            <p>
              You can export all tracked sessions (JSON) or permanently delete
              your usage data via Device Desk settings. Revoking consent stops
              future collection immediately.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-white font-semibold">Contact</h3>
            <p>
              Questions about this policy? Reach out to your household admin or
              the LifeOS project maintainers.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
