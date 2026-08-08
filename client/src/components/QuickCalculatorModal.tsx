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
      <div className="bg-[#251B17] border border-[#382923] rounded-3xl w-80 md:w-88 shadow-2xl overflow-hidden space-y-3 relative text-[#FAF6F0]">
        {/* Header */}
        <div className="p-4 bg-[#1C1512] border-b border-[#382923] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#E38D73]/15 border border-[#E38D73]/30 text-[#E38D73] flex items-center justify-center">
              <Calculator size={18} />
            </div>
            <div>
              <h3 className="font-serif font-black text-sm text-[#FAF6F0]">
                Quick Calculator
              </h3>
              <p className="text-[10px] text-[#A69788]">
                Fast Household Math & Calculations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#A69788] hover:text-[#FAF6F0] hover:bg-[#382923] transition-all bg-transparent border-0 cursor-pointer text-xs"
          >
            <X size={16} />
          </button>
        </div>

        {/* Live Display & Copy Banner */}
        <div className="mx-4 p-3.5 bg-[#1C1512] border border-[#382923] rounded-2xl flex items-center justify-between shadow-inner">
          <div className="flex-1 pr-2 overflow-hidden">
            <span className="text-[10px] font-mono text-[#A69788] min-h-[14px] block truncate">
              {calcDisplay || "0"}
            </span>
            <span className="text-2xl font-serif font-black text-[#E38D73] truncate block">
              = {calcResult}
            </span>
          </div>
          <button
            onClick={() => copyToClipboard(calcResult)}
            className="flex items-center gap-1 bg-[#382923] hover:bg-[#4A3728] text-xs text-[#FAF6F0] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer border border-[#E38D73]/30 shrink-0"
            title="Copy result"
          >
            {copied ? (
              <>
                <Check size={14} className="text-[#A0B095]" />
                <span className="text-[#A0B095]">Copied!</span>
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
                      ? "bg-[#E38D73] text-[#1C1512] font-black shadow-lg"
                      : btn === "C" || btn === "⌫"
                      ? "bg-rose-950/40 text-rose-300 border border-rose-900/40 hover:bg-rose-900/60"
                      : ["+", "-", "*", "/", "(", ")"].includes(btn)
                      ? "bg-[#382923] text-[#E38D73] hover:bg-[#4A3728] font-bold"
                      : "bg-[#1C1512] text-[#FAF6F0] hover:bg-[#382923]"
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
