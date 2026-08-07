import { useState } from "react";
import { Calculator, X, Plus, Trash2, Copy, Check, ShoppingBag } from "lucide-react";
import { evaluateMathExpression } from "./SmartMathInput";

interface QuickCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol?: string;
}

interface GroceryItem {
  id: string;
  name: string;
  price: string;
}

export default function QuickCalculatorModal({
  isOpen,
  onClose,
  currencySymbol = "৳",
}: QuickCalculatorModalProps) {
  const [activeTab, setActiveTab] = useState<"itemized" | "standard">("itemized");
  const [copied, setCopied] = useState<boolean>(false);

  // Itemized Grocery List State
  const [items, setItems] = useState<GroceryItem[]>([
    { id: "1", name: "Alu (Potato)", price: "60" },
    { id: "2", name: "Piaz (Onion)", price: "120" },
  ]);

  // Standard Calc State
  const [calcDisplay, setCalcDisplay] = useState<string>("");

  if (!isOpen) return null;

  // Compute Itemized Total
  const itemizedTotal = items.reduce((sum, item) => {
    const val = evaluateMathExpression(item.price) || parseFloat(item.price) || 0;
    return sum + val;
  }, 0);

  // Compute Standard Calc Result
  const standardResult = evaluateMathExpression(calcDisplay) ?? 0;

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "", price: "" },
    ]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: "name" | "price", val: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: val } : i))
    );
  };

  const handleCalcButtonClick = (btn: string) => {
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

  const activeTotal = activeTab === "itemized" ? itemizedTotal : standardResult;

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
                Bazar Item List & Smart Calc
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

        {/* Tab Selector */}
        <div className="px-4 flex gap-2">
          <button
            onClick={() => setActiveTab("itemized")}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 flex items-center justify-center gap-1.5 ${
              activeTab === "itemized"
                ? "bg-[#E38D73] text-[#1C1512]"
                : "bg-[#1C1512] text-[#A69788] hover:text-[#FAF6F0]"
            }`}
          >
            <ShoppingBag size={13} />
            <span>Bazar List</span>
          </button>
          <button
            onClick={() => setActiveTab("standard")}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 flex items-center justify-center gap-1.5 ${
              activeTab === "standard"
                ? "bg-[#E38D73] text-[#1C1512]"
                : "bg-[#1C1512] text-[#A69788] hover:text-[#FAF6F0]"
            }`}
          >
            <Calculator size={13} />
            <span>Calculator</span>
          </button>
        </div>

        {/* Live Total Display Banner */}
        <div className="mx-4 p-3 bg-[#1C1512] border border-[#382923] rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[9px] uppercase font-bold text-[#A69788] block">
              Calculated Total
            </span>
            <span className="text-2xl font-serif font-black text-[#E38D73]">
              {currencySymbol}{activeTotal.toFixed(2)}
            </span>
          </div>
          <button
            onClick={() => copyToClipboard(activeTotal)}
            className="flex items-center gap-1 bg-[#382923] hover:bg-[#4A3728] text-xs text-[#FAF6F0] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer border border-[#E38D73]/30"
            title="Copy calculated total"
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

        {/* Tab 1: Itemized Grocery List */}
        {activeTab === "itemized" && (
          <div className="p-4 space-y-3">
            <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Item (e.g. Alu)"
                    value={item.name}
                    onChange={(e) => updateItem(item.id, "name", e.target.value)}
                    className="flex-1 bg-[#1C1512] border border-[#382923] focus:border-[#E38D73] rounded-xl px-2.5 py-1.5 text-xs text-[#FAF6F0] focus:outline-none placeholder-[#78695C]"
                  />
                  <div className="flex items-center w-28 bg-[#1C1512] border border-[#382923] focus-within:border-[#E38D73] rounded-xl px-2 py-1.5">
                    <span className="text-[10px] text-[#A69788] mr-1">{currencySymbol}</span>
                    <input
                      type="text"
                      placeholder="Price or 50+30"
                      value={item.price}
                      onChange={(e) => updateItem(item.id, "price", e.target.value)}
                      className="w-full bg-transparent border-none text-xs text-[#FAF6F0] text-right focus:outline-none font-bold"
                    />
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-[#78695C] hover:text-rose-450 p-1 bg-transparent border-0 cursor-pointer shrink-0"
                    title="Remove item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addItem}
              className="w-full bg-[#1C1512] hover:bg-[#382923] border border-[#382923] text-xs text-[#E38D73] font-bold py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus size={14} />
              <span>Add Item</span>
            </button>
          </div>
        )}

        {/* Tab 2: Standard Calculator Grid */}
        {activeTab === "standard" && (
          <div className="p-4 space-y-3">
            {/* Expression Box */}
            <div className="bg-[#1C1512] border border-[#382923] rounded-2xl p-3 text-right">
              <span className="text-xs font-mono text-[#A69788] min-h-[16px] block truncate">
                {calcDisplay || "0"}
              </span>
              <span className="text-xl font-bold font-mono text-[#E38D73]">
                = {standardResult}
              </span>
            </div>

            {/* Buttons Grid */}
            <div className="grid grid-cols-4 gap-1.5">
              {["C", "(", ")", "/", "7", "8", "9", "*", "4", "5", "6", "-", "1", "2", "3", "+", "0", ".", "⌫", "="].map(
                (btn) => (
                  <button
                    key={btn}
                    onClick={() => handleCalcButtonClick(btn)}
                    className={`py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer border-0 ${
                      btn === "="
                        ? "bg-[#E38D73] text-[#1C1512]"
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
