import { useState, useEffect } from "react";
import { Calculator } from "lucide-react";

interface SmartMathInputProps {
  id?: string;
  value: string | number;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  title?: string;
}

export const evaluateMathExpression = (expr: string | number): number | null => {
  if (typeof expr === "number") return expr;
  if (!expr || typeof expr !== "string") return null;
  const clean = expr.replace(/=/g, "").trim();
  if (!clean) return null;
  
  if (/^-?\d+(\.\d+)?$/.test(clean)) {
    return parseFloat(clean);
  }
  
  if (!/^[0-9+\-*/.()\s%]+$/.test(clean)) {
    return null;
  }
  
  try {
    const result = new Function(`"use strict"; return (${clean})`)();
    if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
      return Math.round(result * 100) / 100;
    }
  } catch (e) {
    return null;
  }
  return null;
};

export default function SmartMathInput({
  id,
  value,
  onChange,
  placeholder = "0",
  className = "",
  title = "Type a number or math expression like 120+85+40",
}: SmartMathInputProps) {
  const [displayValue, setDisplayValue] = useState<string>(
    value !== undefined && value !== null && value !== 0 ? String(value) : ""
  );
  const [liveEval, setLiveEval] = useState<number | null>(null);

  useEffect(() => {
    setDisplayValue(
      value !== undefined && value !== null && value !== 0 ? String(value) : ""
    );
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setDisplayValue(text);

    if (/[+\-*/%]/.test(text)) {
      const calculated = evaluateMathExpression(text);
      setLiveEval(calculated);
    } else {
      setLiveEval(null);
    }
  };

  const handleBlurOrSubmit = () => {
    if (!displayValue.trim()) {
      onChange("0");
      setLiveEval(null);
      return;
    }

    const calculated = evaluateMathExpression(displayValue);
    if (calculated !== null) {
      const valStr = String(calculated);
      setDisplayValue(valStr);
      onChange(valStr);
    } else {
      const num = parseFloat(displayValue) || 0;
      const numStr = String(num);
      setDisplayValue(numStr);
      onChange(numStr);
    }
    setLiveEval(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  return (
    <div className="relative inline-block w-full">
      <input
        id={id}
        type="text"
        value={displayValue}
        onChange={handleTextChange}
        onBlur={handleBlurOrSubmit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        title={title}
        className={className}
      />
      {liveEval !== null && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-xl border border-amber-400 z-40 flex items-center gap-1 whitespace-nowrap animate-bounce pointer-events-none">
          <Calculator size={11} /> = ৳{liveEval}
        </span>
      )}
    </div>
  );
}
