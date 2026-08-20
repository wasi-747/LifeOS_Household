import { useState } from "react";
import { Calculator, X, Copy, Check } from "lucide-react";
import { evaluateMathExpression } from "./SmartMathInput";

interface QuickCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickCalculatorModal({
  isOpen,
  onClose,
}: QuickCalculatorModalProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const [calcDisplay, setCalcDisplay] = useState<string>("");

  if (!isOpen) return null;

  // Compute Calc Result
  const calcResult = evaluateMathExpression(calcDisplay) ?? 0;

  const handleButtonClick = (btn: string) => {
    if (btn === "C") {
      setCalcDisplay("");
    } else if (btn === "⌫") {
      setCalcDisplay((prev) => prev.slice(0, -1));
    } else if (btn === "=") {
      const res = evaluateMathExpression(calcDisplay);
      if (res !== null) setCalcDisplay(String(res));
    } else {
      setCalcDisplay((prev) => prev + btn);
    }
  };

  const copyToClipboard = (val: number) => {
    navigator.clipboard.writeText(String(val));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl w-80 md:w-88 shadow-2xl overflow-hidden space-y-3 relative text-slate-900">
        {/* Header */}
        <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
              <Calculator size={18} />
            </div>
            <div>
              <h3 className="font-serif font-black text-sm text-slate-900">
                Quick Calculator
              </h3>
              <p className="text-[10px] text-slate-500">
                Fast Household Math & Calculations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all bg-transparent border-0 cursor-pointer text-xs"
          >
            <X size={16} />
          </button>
        </div>

        {/* Live Display & Copy Banner */}
        <div className="mx-4 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex-1 pr-2 overflow-hidden">
            <span className="text-[10px] font-mono text-slate-400 min-h-[14px] block truncate">
              {calcDisplay || "0"}
            </span>
            <span className="text-2xl font-serif font-black text-emerald-600 truncate block">
              = {calcResult}
            </span>
          </div>
          <button
            onClick={() => copyToClipboard(calcResult)}
            className="flex items-center gap-1 bg-white hover:bg-slate-100 text-xs text-slate-700 font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer border border-slate-200 shrink-0 shadow-xs"
            title="Copy result"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-600" />
                <span className="text-emerald-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Classic Keypad */}
        <div className="p-4 pt-1 space-y-3">
          <div className="grid grid-cols-4 gap-1.5">
            {["C", "(", ")", "/", "7", "8", "9", "*", "4", "5", "6", "-", "1", "2", "3", "+", "0", ".", "⌫", "="].map(
              (btn) => (
                <button
                  key={btn}
                  onClick={() => handleButtonClick(btn)}
                  className={`py-3.5 rounded-2xl font-bold text-sm transition-all cursor-pointer border-0 ${
                    btn === "="
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-md shadow-emerald-600/20"
                      : btn === "C" || btn === "⌫"
                      ? "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100"
                      : ["+", "-", "*", "/", "(", ")"].includes(btn)
                      ? "bg-slate-100 text-emerald-700 hover:bg-slate-200 font-bold"
                      : "bg-slate-50 text-slate-800 hover:bg-slate-100 font-semibold"
                  }`}
                >
                  {btn}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
