import React, { useState } from "react";
import { Zap, ShoppingBag, DollarSign, Calendar, Plus, Trash2, Check, Loader2, User, ArrowRightLeft, Utensils } from "lucide-react";
import SmartMathInput, { evaluateMathExpression } from "./SmartMathInput";
import api from "../services/api";

interface QuickActionWidgetProps {
  monthId: string;
  daysInMonth: number;
  users?: Array<{ _id: string; name: string }>;
  currencySymbol?: string;
  activeUserId: string;
  activeUserName: string;
  onRefresh: () => void;
  showAlert: (title: string, msg: string) => void;
}

interface GroceryItem {
  id: string;
  name: string;
  price: string;
}

export default function QuickActionWidget({
  monthId,
  daysInMonth,
  users = [],
  currencySymbol = "৳",
  activeUserId,
  activeUserName,
  onRefresh,
  showAlert,
}: QuickActionWidgetProps) {
  const [actionTab, setActionTab] = useState<"bazar" | "deposit" | "meals">("bazar");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Today's day of month
  const todayDay = Math.min(new Date().getDate(), daysInMonth || 30);
  const [selectedDay, setSelectedDay] = useState<number>(todayDay);

  // Grocery Items List State
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([
    { id: "1", name: "Alu (Potato)", price: "60" },
    { id: "2", name: "Piaz (Onion)", price: "120" },
  ]);

  // Deposit Form State
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [givenTo, setGivenTo] = useState<string>("");
  const [depositNote, setDepositNote] = useState<string>("");

  // Meals Form State
  const [mealCount, setMealCount] = useState<string>("2");

  const addGroceryItem = () => {
    setGroceryItems((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "", price: "" },
    ]);
  };

  const removeGroceryItem = (id: string) => {
    setGroceryItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateGroceryItem = (id: string, field: "name" | "price", val: string) => {
    setGroceryItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: val } : i))
    );
  };

  // Compute Itemized Total for Grocery Items
  const groceryTotal = groceryItems.reduce((sum, item) => {
    const val = evaluateMathExpression(item.price) || parseFloat(item.price) || 0;
    return sum + val;
  }, 0);

  const triggerSuccessNotice = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleGrocerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (groceryTotal <= 0 || submitting) return;

    setSubmitting(true);
    try {
      // Build item details note string (e.g., "Alu (Potato) ৳60, Piaz (Onion) ৳120")
      const itemDetails = groceryItems
        .filter((i) => (parseFloat(i.price) || 0) > 0 || i.name.trim())
        .map((i) => `${i.name.trim() || "Item"} ${currencySymbol}${i.price}`)
        .join(", ");

      await api.post("/tracker/bazar/update", {
        monthId,
        day: selectedDay,
        userId: activeUserId,
        amount: groceryTotal,
        note: itemDetails || null,
        isAppend: true,
        activeUserId,
        activeUserName,
      });

      triggerSuccessNotice(
        `Recorded ${currencySymbol}${groceryTotal.toFixed(2)} grocery expense for Day ${selectedDay}!`
      );

      // Reset items list
      setGroceryItems([
        { id: "1", name: "", price: "" },
      ]);
      onRefresh();
    } catch (err: any) {
      console.error("Quick Action Error:", err);
      showAlert(
        "Action Failed",
        err.response?.data?.error || "Failed to record grocery expense."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(depositAmount) || 0;
    if (numericAmount <= 0 || submitting) return;

    setSubmitting(true);
    try {
      // 1. Log Meal Deposit
      await api.post("/tracker/deposits/update", {
        monthId,
        day: selectedDay,
        userId: activeUserId,
        amount: numericAmount,
        note: depositNote.trim() || null,
        isAppend: true,
        activeUserId,
        activeUserName,
      });

      let extraMsg = "";

      // 2. If money was given to another roommate, log a Grocery Wallet Transfer!
      if (givenTo) {
        const parts = monthId.split("-");
        const monthName = parts[0];
        const yearStr = parts[1];
        const monthsMap: Record<string, number> = {
          January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
          July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
        };
        const mIdx = monthsMap[monthName] !== undefined ? monthsMap[monthName] : new Date().getMonth();
        const yr = parseInt(yearStr, 10) || new Date().getFullYear();
        const transferDate = new Date(Date.UTC(yr, mIdx, selectedDay, 12, 0, 0)).toISOString();

        await api.post("/bazar-wallet/transfer", {
          monthId,
          from: activeUserId,
          to: givenTo,
          amount: numericAmount,
          date: transferDate,
          note: depositNote.trim() ? `Meal Deposit — ${depositNote.trim()}` : "Meal deposit transfer",
        });

        const targetUser = users.find((u) => u._id === givenTo);
        extraMsg = ` & transferred to Grocery Wallet for ${targetUser ? targetUser.name : "roommate"}`;
      }

      triggerSuccessNotice(
        `Logged ${currencySymbol}${numericAmount.toFixed(2)} meal deposit for Day ${selectedDay}${extraMsg}!`
      );

      setDepositAmount("");
      setDepositNote("");
      setGivenTo("");
      onRefresh();
    } catch (err: any) {
      console.error("Quick Action Error:", err);
      showAlert(
        "Action Failed",
        err.response?.data?.error || "Failed to record meal deposit."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleMealsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const countVal = parseFloat(mealCount) || 0;
    if (submitting) return;

    setSubmitting(true);
    try {
      await api.post("/tracker/meals/update", {
        monthId,
        day: selectedDay,
        userId: activeUserId,
        count: countVal,
        activeUserId,
        activeUserName,
      });

      triggerSuccessNotice(
        `Recorded ${countVal.toFixed(1)} meals for Day ${selectedDay}!`
      );
      onRefresh();
    } catch (err: any) {
      console.error("Quick Action Error:", err);
      showAlert(
        "Action Failed",
        err.response?.data?.error || "Failed to record meals."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="quick-action-widget"
      className="bg-[#251B17] border border-[#382923] rounded-3xl p-6 shadow-2xl space-y-5 relative overflow-hidden animate-fade-in"
    >
      {/* Background Ambient Warm Light */}
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-[#E38D73]/10 blur-3xl pointer-events-none" />

      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#382923] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#E38D73]/15 border border-[#E38D73]/30 text-[#E38D73] flex items-center justify-center shadow-md shrink-0">
            <Zap size={20} />
          </div>
          <div>
            <h3 className="font-serif font-black text-lg text-[#FAF6F0] flex items-center gap-2">
              Quick Action Entry
              <span className="text-[10px] font-sans font-bold px-2.5 py-0.5 rounded-full bg-[#E38D73]/10 text-[#E38D73] border border-[#E38D73]/20">
                AUTO-SYNC
              </span>
            </h3>
            <p className="text-xs text-[#A69788] flex items-center gap-1 mt-0.5">
              <span>Logged in as:</span>
              <strong className="text-[#FAF6F0] flex items-center gap-1">
                <User size={12} className="text-[#E38D73]" /> {activeUserName || "You"}
              </strong>
            </p>
          </div>
        </div>

        {/* Action Type Toggle Buttons */}
        <div className="flex gap-1 bg-[#1C1512] p-1.5 border border-[#382923] rounded-2xl shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActionTab("bazar")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 flex items-center gap-1.5 whitespace-nowrap ${
              actionTab === "bazar"
                ? "bg-[#E38D73] text-[#1C1512] shadow-md font-black"
                : "text-[#A69788] hover:text-[#FAF6F0] bg-transparent"
            }`}
          >
            <ShoppingBag size={14} />
            <span>Grocery Items</span>
          </button>

          <button
            type="button"
            onClick={() => setActionTab("deposit")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 flex items-center gap-1.5 whitespace-nowrap ${
              actionTab === "deposit"
                ? "bg-[#A0B095] text-[#1C1512] shadow-md font-black"
                : "text-[#A69788] hover:text-[#FAF6F0] bg-transparent"
            }`}
          >
            <DollarSign size={14} />
            <span>Meal Deposit</span>
          </button>

          <button
            type="button"
            onClick={() => setActionTab("meals")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 flex items-center gap-1.5 whitespace-nowrap ${
              actionTab === "meals"
                ? "bg-[#E38D73] text-[#1C1512] shadow-md font-black"
                : "text-[#A69788] hover:text-[#FAF6F0] bg-transparent"
            }`}
          >
            <Utensils size={14} />
            <span>Daily Meals</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMsg && (
        <div className="bg-[#A0B095]/15 border border-[#A0B095]/40 text-[#A0B095] px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fade-in shadow-inner">
          <Check size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tab 1: Itemized Grocery List Log */}
      {actionTab === "bazar" && (
        <form onSubmit={handleGrocerySubmit} className="space-y-4">
          <div className="flex items-center justify-between gap-4 bg-[#1C1512] p-3 border border-[#382923] rounded-2xl">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-[#E38D73]" />
              <span className="text-xs font-bold text-[#A69788]">Date:</span>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(parseInt(e.target.value) || 1)}
                className="bg-[#251B17] border border-[#382923] focus:border-[#E38D73] rounded-xl px-2.5 py-1 text-xs text-[#FAF6F0] font-bold focus:outline-none cursor-pointer"
              >
                {Array.from({ length: daysInMonth || 30 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Day {d} {d === todayDay ? "(Today)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-[#A69788] uppercase font-bold block">
                Calculated Total
              </span>
              <span className="text-xl font-serif font-black text-[#E38D73]">
                {currencySymbol}{groceryTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Itemized Rows */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {groceryItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Item Name (e.g. Alu, Piaz, Mach)"
                  value={item.name}
                  onChange={(e) => updateGroceryItem(item.id, "name", e.target.value)}
                  className="flex-1 bg-[#1C1512] border border-[#382923] focus:border-[#E38D73] rounded-2xl px-3 py-2 text-xs text-[#FAF6F0] focus:outline-none placeholder-[#78695C] font-medium"
                />
                <div className="flex items-center w-36 bg-[#1C1512] border border-[#382923] focus-within:border-[#E38D73] rounded-2xl px-3 py-2">
                  <span className="text-[10px] text-[#A69788] mr-1">{currencySymbol}</span>
                  <input
                    type="text"
                    placeholder="Price (60 or 50+10)"
                    value={item.price}
                    onChange={(e) => updateGroceryItem(item.id, "price", e.target.value)}
                    className="w-full bg-transparent border-none text-xs text-[#FAF6F0] text-right focus:outline-none font-bold"
                  />
                </div>
                {groceryItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeGroceryItem(item.id)}
                    className="text-[#78695C] hover:text-rose-450 p-1 bg-transparent border-0 cursor-pointer shrink-0"
                    title="Remove item"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add Item & Submit Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={addGroceryItem}
              className="w-full sm:w-auto bg-[#1C1512] hover:bg-[#382923] border border-[#382923] text-xs text-[#E38D73] font-bold px-4 py-2.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus size={14} />
              <span>Add Item</span>
            </button>

            <button
              type="submit"
              disabled={groceryTotal <= 0 || submitting}
              className="w-full sm:w-auto bg-[#E38D73] hover:bg-[#F2A38A] disabled:opacity-40 text-[#1C1512] font-black text-xs px-6 py-2.5 rounded-2xl transition-all shadow-xl cursor-pointer flex items-center justify-center gap-2 border-0"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin text-[#1C1512]" />
              ) : (
                <>
                  <Zap size={15} />
                  <span>
                    Log Grocery Expense ({currencySymbol}{groceryTotal.toFixed(2)}) for Day {selectedDay}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Meal Deposit Log */}
      {actionTab === "deposit" && (
        <form onSubmit={handleDepositSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Day / Date Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#A69788] uppercase tracking-wider flex items-center gap-1">
                <Calendar size={12} className="text-[#A0B095]" /> Deposit Date
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(parseInt(e.target.value) || 1)}
                className="w-full bg-[#1C1512] border border-[#382923] focus:border-[#A0B095] rounded-2xl px-3 py-2.5 text-xs text-[#FAF6F0] font-bold focus:outline-none cursor-pointer"
              >
                {Array.from({ length: daysInMonth || 30 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Day {d} {d === todayDay ? "(Today)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Deposit Amount Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#A69788] uppercase tracking-wider flex items-center gap-1">
                <DollarSign size={12} className="text-[#A0B095]" /> Deposit Amount ({currencySymbol})
              </label>
              <SmartMathInput
                value={depositAmount}
                onChange={(val) => setDepositAmount(val)}
                placeholder="0 or 500+200"
                className="w-full bg-[#1C1512] border border-[#382923] focus:border-[#A0B095] rounded-2xl px-3 py-2.5 text-xs text-[#FAF6F0] font-bold focus:outline-none"
              />
            </div>

            {/* Given To (Handed Over / Transferred to Roommate) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#A69788] uppercase tracking-wider flex items-center gap-1">
                <ArrowRightLeft size={12} className="text-[#E38D73]" /> Given To (Physical Cash)
              </label>
              <select
                value={givenTo}
                onChange={(e) => setGivenTo(e.target.value)}
                className="w-full bg-[#1C1512] border border-[#382923] focus:border-[#A0B095] rounded-2xl px-3 py-2.5 text-xs text-[#FAF6F0] font-semibold focus:outline-none cursor-pointer"
              >
                <option value="">-- None (Self-Held Cash) --</option>
                {users
                  .filter((u) => u._id !== activeUserId)
                  .map((u) => (
                    <option key={u._id} value={u._id}>
                      Handed to {u.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Deposit Note & Submit */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="text"
              placeholder="Deposit Note (e.g. Bkash / Hand Cash to Manager)..."
              value={depositNote}
              onChange={(e) => setDepositNote(e.target.value)}
              className="flex-1 bg-[#1C1512] border border-[#382923] focus:border-[#A0B095] rounded-2xl px-4 py-2.5 text-xs text-[#FAF6F0] placeholder-[#78695C] focus:outline-none font-medium"
            />

            <button
              type="submit"
              disabled={!depositAmount || submitting}
              className="bg-[#A0B095] hover:bg-[#B5C5AA] disabled:opacity-40 text-[#1C1512] font-black text-xs px-6 py-2.5 rounded-2xl transition-all shadow-xl cursor-pointer flex items-center justify-center gap-2 shrink-0 border-0"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin text-[#1C1512]" />
              ) : (
                <>
                  <Zap size={15} />
                  <span>Log Meal Deposit for Day {selectedDay}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Tab 3: Daily Meals Log */}
      {actionTab === "meals" && (
        <form onSubmit={handleMealsSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Day / Date Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#A69788] uppercase tracking-wider flex items-center gap-1">
                <Calendar size={12} className="text-[#E38D73]" /> Date (Day of Month)
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(parseInt(e.target.value) || 1)}
                className="w-full bg-[#1C1512] border border-[#382923] focus:border-[#E38D73] rounded-2xl px-3 py-2.5 text-xs text-[#FAF6F0] font-bold focus:outline-none cursor-pointer"
              >
                {Array.from({ length: daysInMonth || 30 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Day {d} {d === todayDay ? "(Today)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Meal Count Input & Quick Buttons */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#A69788] uppercase tracking-wider flex items-center gap-1">
                <Utensils size={12} className="text-[#E38D73]" /> Number of Meals Eaten
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="10"
                  value={mealCount}
                  onChange={(e) => setMealCount(e.target.value)}
                  className="w-24 bg-[#1C1512] border border-[#382923] focus:border-[#E38D73] rounded-2xl px-3 py-2.5 text-xs text-[#FAF6F0] font-bold text-center focus:outline-none"
                />
                {/* Quick Chips */}
                <div className="flex gap-1 overflow-x-auto">
                  {["0", "1", "1.5", "2", "2.5", "3"].map((mVal) => (
                    <button
                      key={mVal}
                      type="button"
                      onClick={() => setMealCount(mVal)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border border-[#382923] ${
                        mealCount === mVal
                          ? "bg-[#E38D73] text-[#1C1512] font-black"
                          : "bg-[#1C1512] text-[#A69788] hover:text-[#FAF6F0]"
                      }`}
                    >
                      {mVal}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#E38D73] hover:bg-[#F2A38A] disabled:opacity-40 text-[#1C1512] font-black text-xs px-6 py-2.5 rounded-2xl transition-all shadow-xl cursor-pointer flex items-center justify-center gap-2 border-0"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin text-[#1C1512]" />
              ) : (
                <>
                  <Zap size={15} />
                  <span>Log {parseFloat(mealCount) || 0} Meals for Day {selectedDay}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
