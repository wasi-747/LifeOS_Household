

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
      {/* Semi-transparent warm-brown/charcoal overlay */}
      <div 
        className="fixed inset-0 bg-[#1C1512]/80 backdrop-blur-sm transition-opacity"
        onClick={isAlert ? onConfirm : onCancel}
      />
      
      {/* Modal Content Card */}
      <div className="relative bg-[#251B17] border border-[#382923] w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4 animate-fade-in text-[#FAF6F0] z-10">
        <h3 className="text-base font-bold text-[#FAF6F0] font-serif tracking-tight">{title}</h3>
        <p className="text-[#D9CEC1] text-xs leading-relaxed font-medium">{message}</p>
        
        <div className="flex justify-end gap-2.5 pt-2">
          {!isAlert && (
            <button
              type="button"
              onClick={onCancel}
              className="bg-[#1C1512] hover:bg-[#2E221E] text-xs font-semibold text-[#D9CEC1] px-4 py-2 border border-[#382923] rounded-xl transition-all cursor-pointer"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className="bg-[#E38D73] hover:bg-[#F2A38A] text-[#1C1512] text-xs font-bold px-5 py-2 rounded-xl shadow-md shadow-[#E38D73]/10 transition-all cursor-pointer"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
