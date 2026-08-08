import { useState } from "react";
import { Calculator, X, Copy, Check, Binary, Sparkles } from "lucide-react";
import { evaluateMathExpression } from "./SmartMathInput";

interface QuickCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickCalculatorModal({
  isOpen,
  onClose,
}: QuickCalculatorModalProps) {
  const [calcMode, setCalcMode] = useState<"classic" | "scientific">("classic");
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
      <div className="bg-[#251B17] border border-[#382923] rounded-3xl w-80 md:w-96 shadow-2xl overflow-hidden space-y-3 relative text-[#FAF6F0]">
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
                Classic & Scientific Calculator
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

        {/* Mode Selector (Classic vs Scientific) */}
        <div className="px-4 flex gap-2">
          <button
            onClick={() => setCalcMode("classic")}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 flex items-center justify-center gap-1.5 ${
              calcMode === "classic"
                ? "bg-[#E38D73] text-[#1C1512] shadow-md font-black"
                : "bg-[#1C1512] text-[#A69788] hover:text-[#FAF6F0]"
            }`}
          >
            <Binary size={13} />
            <span>Classic</span>
          </button>
          <button
            onClick={() => setCalcMode("scientific")}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 flex items-center justify-center gap-1.5 ${
              calcMode === "scientific"
                ? "bg-[#E38D73] text-[#1C1512] shadow-md font-black"
                : "bg-[#1C1512] text-[#A69788] hover:text-[#FAF6F0]"
            }`}
          >
            <Sparkles size={13} />
            <span>Scientific</span>
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

        {/* Mode 1: Classic Calculator Keypad */}
        {calcMode === "classic" && (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-4 gap-1.5">
              {["C", "(", ")", "/", "7", "8", "9", "*", "4", "5", "6", "-", "1", "2", "3", "+", "0", ".", "⌫", "="].map(
                (btn) => (
                  <button
                    key={btn}
                    onClick={() => handleButtonClick(btn)}
                    className={`py-3 rounded-xl font-bold text-sm transition-all cursor-pointer border-0 ${
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
        )}

        {/* Mode 2: Scientific Calculator Keypad */}
        {calcMode === "scientific" && (
          <div className="p-4 space-y-2">
            {/* Scientific Math Functions Grid */}
            <div className="grid grid-cols-5 gap-1 bg-[#1C1512] p-2 border border-[#382923] rounded-2xl">
              {["sin(", "cos(", "tan(", "sqrt(", "^", "log(", "ln(", "π", "e", "%"].map(
                (fn) => (
                  <button
                    key={fn}
                    onClick={() => handleButtonClick(fn)}
                    className="py-1.5 rounded-lg font-mono text-[11px] font-bold bg-[#382923]/60 hover:bg-[#382923] text-[#E38D73] transition-all cursor-pointer border border-[#382923]"
                  >
                    {fn}
                  </button>
                )
              )}
            </div>

            {/* Standard Keypad */}
            <div className="grid grid-cols-4 gap-1.5">
              {["C", "(", ")", "/", "7", "8", "9", "*", "4", "5", "6", "-", "1", "2", "3", "+", "0", ".", "⌫", "="].map(
                (btn) => (
                  <button
                    key={btn}
                    onClick={() => handleButtonClick(btn)}
                    className={`py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer border-0 ${
                      btn === "="
                        ? "bg-[#E38D73] text-[#1C1512] font-black shadow-lg"
                        : btn === "C" || btn === "⌫"
                        ? "bg-rose-950/40 text-rose-300 border border-rose-900/40 hover:bg-rose-900/60"
                        : ["+", "-", "*", "/", "(", ")"].includes(btn)
                        ? "bg-[#382923] text-[#E38D73] hover:bg-[#4A3728]"
                        : "bg-[#1C1512] text-[#FAF6F0] hover:bg-[#382923]"
                    }`}
                  >
                    {btn}
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
