

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isAlert?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isAlert = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Semi-transparent backdrop overlay */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity"
        onClick={isAlert ? onConfirm : onCancel}
      />
      
      {/* Modal Content Card */}
      <div className="relative bg-white border border-slate-200 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 animate-fade-in text-slate-900 z-10">
        <h3 className="text-base font-bold text-slate-900 font-serif tracking-tight">{title}</h3>
        <p className="text-slate-600 text-xs leading-relaxed font-medium">{message}</p>
        
        <div className="flex justify-end gap-2.5 pt-2">
          {!isAlert && (
            <button
              type="button"
              onClick={onCancel}
              className="bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600 px-4 py-2 border border-slate-200 rounded-xl transition-all cursor-pointer"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-2 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer border-0"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
