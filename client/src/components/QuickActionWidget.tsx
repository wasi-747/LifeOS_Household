import React, { useState, useEffect } from "react";
import { Zap, ShoppingBag, DollarSign, Calendar, Plus, Trash2, Check, Loader2, User, ArrowRightLeft, Utensils, CheckCircle2, Sparkles, Building } from "lucide-react";
import SmartMathInput, { evaluateMathExpression } from "./SmartMathInput";
import api from "../services/api";

export interface UtilityCategoryOption {
  key: string;
  label: string;
  targetAmount: number;
  paidAmount: number;
  remaining: number;
  isDone: boolean;
  percent?: number;
  note?: string;
}

export interface UserUtilityStandingInfo {
  userId: string;
  name: string;
  utilityShare: number;
  prevUtilityDue: number;
  utilityPayment: number;
  utilityDue: number;
}

interface QuickActionWidgetProps {
  monthId: string;
  daysInMonth: number;
  users?: Array<{ _id: string; name: string }>;
  currencySymbol?: string;
  activeUserId: string;
  activeUserName: string;
  utilityCategories?: { [key: string]: UtilityCategoryOption };
  utilities?: { [key: string]: number };
  userStandings?: UserUtilityStandingInfo[];
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
  utilityCategories = {},
  utilities = {},
  userStandings = [],
  onRefresh,
  showAlert,
}: QuickActionWidgetProps) {
  const [actionTab, setActionTab] = useState<"bazar" | "deposit" | "meals" | "utility">("bazar");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Today's day of month
  const todayDay = Math.min(new Date().getDate(), daysInMonth || 30);
  const [selectedDay, setSelectedDay] = useState<number>(todayDay);

  // Grocery Items List State
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([
    { id: "1", name: "", price: "" },
  ]);

  // Deposit Form State
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [givenTo, setGivenTo] = useState<string>("");
  const [depositNote, setDepositNote] = useState<string>("");

  // Meals Form State
  const [mealCount, setMealCount] = useState<string>("2");

  // Utility Form State
  const [selectedUtilityCategory, setSelectedUtilityCategory] = useState<string>("general_deposit");
  const [utilityPaidBy, setUtilityPaidBy] = useState<string>(activeUserId);
  const [utilityPaidFrom, setUtilityPaidFrom] = useState<"FUND" | "PERSONAL">("FUND");
  const [utilityAmount, setUtilityAmount] = useState<string>("");
  const [utilityNote, setUtilityNote] = useState<string>("");

  // Update paidBy when activeUserId changes
  useEffect(() => {
    if (activeUserId) {
      setUtilityPaidBy(activeUserId);
    }
  }, [activeUserId]);

  // When selected category or payer changes, auto-suggest remaining unpaid amount
  const handleSelectUtilityCategory = (catKey: string, payerId?: string) => {
    setSelectedUtilityCategory(catKey);
    const effectivePayer = payerId || utilityPaidBy || activeUserId;
    const payerStanding = userStandings.find((u) => u.userId === effectivePayer);

    if (catKey === "general_deposit") {
      if (payerStanding && payerStanding.utilityDue > 0) {
        setUtilityAmount(payerStanding.utilityDue.toString());
      } else if (payerStanding && payerStanding.utilityShare > 0) {
        setUtilityAmount(payerStanding.utilityShare.toString());
      } else {
        setUtilityAmount("");
      }
      return;
    }

    const catDetail = utilityCategories[catKey];
    if (catDetail) {
      if (catDetail.remaining > 0) {
        setUtilityAmount(catDetail.remaining.toString());
      } else if (catDetail.targetAmount > 0 && catDetail.paidAmount === 0) {
        setUtilityAmount(catDetail.targetAmount.toString());
      }
    } else if (utilities[catKey]) {
      setUtilityAmount(utilities[catKey].toString());
    }
  };

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
        isAppend: true,
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

  const handleUtilitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = evaluateMathExpression(utilityAmount) || parseFloat(utilityAmount) || 0;
    const payerId = utilityPaidBy || activeUserId || (users.length > 0 ? users[0]._id : "");

    if (numericAmount <= 0) {
      showAlert("Invalid Amount", "Please enter a payment amount greater than 0.");
      return;
    }
    if (!selectedUtilityCategory) {
      showAlert("Missing Category", "Please select a utility payment type or category.");
      return;
    }
    if (!payerId) {
      showAlert("Missing Payer", "Please select a roommate who made the payment.");
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    try {
      const parts = monthId.split("-");
      const monthName = parts[0];
      const yearStr = parts[1];
      const monthsMap: Record<string, number> = {
        January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
        July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
      };
      const mIdx = monthsMap[monthName] !== undefined ? monthsMap[monthName] : new Date().getMonth();
      const yr = parseInt(yearStr, 10) || new Date().getFullYear();
      const paymentDate = new Date(Date.UTC(yr, mIdx, selectedDay, 12, 0, 0)).toISOString();

      await api.post("/monthly-bill/utility-payment", {
        monthId,
        category: selectedUtilityCategory,
        paidBy: payerId,
        amount: numericAmount,
        paidFrom: selectedUtilityCategory === "general_deposit" ? "PERSONAL" : utilityPaidFrom,
        date: paymentDate,
        note: utilityNote.trim() || null,
      });

      const isGeneral = selectedUtilityCategory === "general_deposit";
      const isFund = !isGeneral && utilityPaidFrom === "FUND";
      const catDetail = utilityCategories[selectedUtilityCategory];
      const catLabel = isGeneral
        ? "General Utility Deposit / Share"
        : (catDetail ? catDetail.label : selectedUtilityCategory);

      const payerStanding = userStandings.find((u) => u.userId === payerId);
      const targetAmount = isGeneral
        ? (payerStanding ? payerStanding.utilityShare : 0)
        : (catDetail ? catDetail.targetAmount : (utilities[selectedUtilityCategory] || 0));
      const prevPaid = isGeneral
        ? (payerStanding ? payerStanding.utilityPayment : 0)
        : (catDetail ? catDetail.paidAmount : 0);
      const newTotalPaid = prevPaid + numericAmount;
      const isNowDone = targetAmount > 0 && newTotalPaid >= targetAmount;

      const payerObj = users.find((u) => u._id === payerId);
      const payerName = payerObj ? (payerObj._id === activeUserId ? "You" : payerObj.name) : "Roommate";

      const sourceMsg = isFund
        ? " (Paid from House Utility Fund)"
        : isGeneral
        ? " (Deposited to Manager/Fund)"
        : " (Paid from personal pocket)";

      triggerSuccessNotice(
        `Recorded ${currencySymbol}${numericAmount.toFixed(2)} ${catLabel}${sourceMsg} by ${payerName}! ${
          isNowDone ? "🎉 Obligation is now fully settled (DONE ✅)!" : ""
        }`
      );

      setUtilityAmount("");
      setUtilityNote("");
      onRefresh();
    } catch (err: any) {
      console.error("Quick Action Utility Error:", err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || "Failed to record utility payment.";
      showAlert("Action Failed", errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="quick-action-widget"
      className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-200/50 space-y-5 relative overflow-hidden animate-fade-in hover:shadow-2xl hover:translate-y-[2px] transition-all"
    >
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs shrink-0">
            <Zap size={20} />
          </div>
          <div>
            <h3 className="font-serif font-black text-lg text-slate-900 flex items-center gap-2">
              Quick Action Entry
              <span className="text-[10px] font-sans font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                AUTO-SYNC
              </span>
            </h3>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <span>Logged in as:</span>
              <strong className="text-slate-800 flex items-center gap-1">
                <User size={12} className="text-emerald-600" /> {activeUserName || "You"}
              </strong>
            </p>
          </div>
        </div>

        {/* Action Type Toggle Buttons */}
        <div className="flex gap-1.5 bg-slate-100/80 p-1.5 border border-slate-200/80 rounded-2xl shrink-0 overflow-x-auto shadow-inner">
          <button
            type="button"
            onClick={() => setActionTab("bazar")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 whitespace-nowrap ${
              actionTab === "bazar"
                ? "bg-white text-rose-600 border-slate-200 shadow-sm font-black"
                : "text-slate-600 hover:text-slate-900 bg-transparent border-transparent"
            }`}
          >
            <ShoppingBag size={14} className={actionTab === "bazar" ? "text-rose-500" : "text-slate-400"} />
            <span>Grocery Items</span>
          </button>

          <button
            type="button"
            onClick={() => setActionTab("deposit")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 whitespace-nowrap ${
              actionTab === "deposit"
                ? "bg-white text-emerald-700 border-slate-200 shadow-sm font-black"
                : "text-slate-600 hover:text-slate-900 bg-transparent border-transparent"
            }`}
          >
            <DollarSign size={14} className={actionTab === "deposit" ? "text-emerald-600" : "text-slate-400"} />
            <span>Meal Deposit</span>
          </button>

          <button
            type="button"
            onClick={() => setActionTab("meals")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 whitespace-nowrap ${
              actionTab === "meals"
                ? "bg-white text-emerald-700 border-slate-200 shadow-sm font-black"
                : "text-slate-600 hover:text-slate-900 bg-transparent border-transparent"
            }`}
          >
            <Utensils size={14} className={actionTab === "meals" ? "text-emerald-600" : "text-slate-400"} />
            <span>Daily Meals</span>
          </button>

          <button
            type="button"
            onClick={() => setActionTab("utility")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 whitespace-nowrap ${
              actionTab === "utility"
                ? "bg-white text-slate-900 border-slate-200 shadow-sm font-black"
                : "text-slate-600 hover:text-slate-900 bg-transparent border-transparent"
            }`}
          >
            <Zap size={14} className={actionTab === "utility" ? "text-emerald-600" : "text-slate-400"} />
            <span>Utility Bill</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fade-in shadow-xs">
          <Check size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tab 1: Itemized Grocery List Log */}
      {actionTab === "bazar" && (
        <form onSubmit={handleGrocerySubmit} className="space-y-4">
          <div className="flex items-center justify-between gap-4 bg-slate-50 p-3.5 border border-slate-200 rounded-2xl">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-emerald-600" />
              <span className="text-xs font-bold text-slate-600">Date:</span>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(parseInt(e.target.value) || 1)}
                className="bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-2.5 py-1 text-xs text-slate-800 font-bold focus:outline-none cursor-pointer shadow-xs"
              >
                {Array.from({ length: daysInMonth || 30 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Day {d} {d === todayDay ? "(Today)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">
                Calculated Total
              </span>
              <span className="text-xl font-serif font-black text-rose-500">
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
                  placeholder="e.g. Alu (Potato), Mach, Dim..."
                  value={item.name}
                  onChange={(e) => updateGroceryItem(item.id, "name", e.target.value)}
                  className="flex-1 bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl px-3 py-2 text-xs text-slate-900 focus:outline-none placeholder-slate-400 font-medium shadow-xs"
                />
                <div className="flex items-center w-36 bg-white border border-slate-200 focus-within:border-emerald-500 rounded-2xl px-3 py-2 shadow-xs">
                  <span className="text-[10px] text-slate-400 mr-1">{currencySymbol}</span>
                  <input
                    type="text"
                    placeholder="60 or 50+10"
                    value={item.price}
                    onChange={(e) => updateGroceryItem(item.id, "price", e.target.value)}
                    className="w-full bg-transparent border-none text-xs text-slate-900 text-right focus:outline-none placeholder-slate-400 font-bold"
                  />
                </div>
                {groceryItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeGroceryItem(item.id)}
                    className="text-slate-400 hover:text-rose-500 p-1 bg-transparent border-0 cursor-pointer shrink-0 transition-colors"
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
              className="w-full sm:w-auto bg-white hover:bg-slate-50 border border-slate-200 text-xs text-slate-700 font-bold px-4 py-2.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Plus size={14} />
              <span>Add Item</span>
            </button>

            <button
              type="submit"
              disabled={groceryTotal <= 0 || submitting}
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-black text-xs px-6 py-2.5 rounded-2xl transition-all shadow-md shadow-slate-900/10 cursor-pointer flex items-center justify-center gap-2 border-0"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin text-white" />
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
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={12} className="text-emerald-600" /> Deposit Date
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(parseInt(e.target.value) || 1)}
                className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl px-3 py-2.5 text-xs text-slate-800 font-bold focus:outline-none cursor-pointer shadow-xs"
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
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <DollarSign size={12} className="text-emerald-600" /> Deposit Amount ({currencySymbol})
              </label>
              <SmartMathInput
                value={depositAmount}
                onChange={(val) => setDepositAmount(val)}
                placeholder="0 or 500+200"
                className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl px-3 py-2.5 text-xs text-slate-900 font-bold focus:outline-none shadow-xs"
              />
            </div>

            {/* Given To (Handed Over / Transferred to Roommate) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <ArrowRightLeft size={12} className="text-emerald-600" /> Given To (Physical Cash)
              </label>
              <select
                value={givenTo}
                onChange={(e) => setGivenTo(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl px-3 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none cursor-pointer shadow-xs"
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
              className="flex-1 bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none font-medium shadow-xs"
            />

            <button
              type="submit"
              disabled={!depositAmount || submitting}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs px-6 py-2.5 rounded-2xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-2 shrink-0 border-0"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin text-white" />
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
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={12} className="text-emerald-600" /> Date (Day of Month)
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(parseInt(e.target.value) || 1)}
                className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl px-3 py-2.5 text-xs text-slate-800 font-bold focus:outline-none cursor-pointer shadow-xs"
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
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Utensils size={12} className="text-emerald-600" /> Number of Meals Eaten
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="10"
                  value={mealCount}
                  onChange={(e) => setMealCount(e.target.value)}
                  className="w-24 bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl px-3 py-2.5 text-xs text-slate-900 font-bold text-center focus:outline-none shadow-xs"
                />
                {/* Quick Chips */}
                <div className="flex gap-1 overflow-x-auto">
                  {["0", "1", "1.5", "2", "2.5", "3"].map((mVal) => (
                    <button
                      key={mVal}
                      type="button"
                      onClick={() => setMealCount(mVal)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        mealCount === mVal
                          ? "bg-emerald-600 text-white border-emerald-600 font-black shadow-xs"
                          : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200"
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
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs px-6 py-2.5 rounded-2xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-2 border-0"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin text-white" />
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

      {/* Tab 4: Utility Bill & Share Handover Payment Log */}
      {actionTab === "utility" && (
        <form onSubmit={handleUtilitySubmit} className="space-y-4 animate-fade-in">
          {/* Dynamic Header Info Banner for Selected Utility / General Deposit */}
          {(() => {
            const isGeneral = selectedUtilityCategory === "general_deposit";
            const payerObj = users.find((u) => u._id === (utilityPaidBy || activeUserId));
            const payerName = payerObj ? (payerObj._id === activeUserId ? "Your" : `${payerObj.name}'s`) : "Roommate's";
            const payerStanding = userStandings.find((u) => u.userId === (utilityPaidBy || activeUserId));

            if (isGeneral) {
              const due = payerStanding ? payerStanding.utilityDue : 0;
              const share = payerStanding ? payerStanding.utilityShare : 0;
              const paid = payerStanding ? payerStanding.utilityPayment : 0;
              const isCleared = share > 0 && due <= 0;

              return (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      isCleared 
                        ? "bg-emerald-50 border border-emerald-200 text-emerald-600" 
                        : "bg-slate-200 text-slate-700"
                    }`}>
                      {isCleared ? <CheckCircle2 size={20} /> : <Sparkles size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          General Utility Handover / Deposit
                        </span>
                        {isCleared ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase flex items-center gap-1">
                            <Check size={10} /> SHARE CLEARED
                          </span>
                        ) : due > 0 && paid > 0 ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                            PARTIAL (৳{paid.toFixed(2)} Paid)
                          </span>
                        ) : (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 uppercase">
                            DUE
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {payerName} Utility Share: <strong className="text-slate-900">{currencySymbol}{share.toFixed(2)}</strong> | Paid/Given: <strong className="text-emerald-600">{currencySymbol}{paid.toFixed(2)}</strong> | Net Due: <strong className={due > 0 ? "text-rose-600" : "text-emerald-600"}>{currencySymbol}{Math.max(0, due).toFixed(2)}</strong>
                      </p>
                    </div>
                  </div>

                  {due > 0 && (
                    <button
                      type="button"
                      onClick={() => setUtilityAmount(due.toString())}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Sparkles size={12} />
                      <span>Fill Unpaid Share ({currencySymbol}{due.toFixed(2)})</span>
                    </button>
                  )}
                </div>
              );
            }

            const cat = utilityCategories[selectedUtilityCategory];
            const target = cat ? cat.targetAmount : (utilities[selectedUtilityCategory] || 0);
            const paid = cat ? cat.paidAmount : 0;
            const rem = cat ? cat.remaining : Math.max(0, target - paid);
            const isDone = cat ? cat.isDone : (target > 0 && paid >= target);
            const percent = cat?.percent !== undefined ? cat.percent : (target > 0 ? Math.min(100, Math.round((paid / target) * 100)) : 0);

            return (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                    isDone 
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-600" 
                      : "bg-slate-200 text-slate-700"
                  }`}>
                    {isDone ? <CheckCircle2 size={20} /> : <Zap size={20} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {cat ? cat.label : selectedUtilityCategory}
                      </span>
                      {isDone ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase flex items-center gap-1">
                          <Check size={10} /> DONE
                        </span>
                      ) : rem > 0 && paid > 0 ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                          PARTIAL ({percent}%)
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 uppercase">
                          UNPAID
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Target Bill: <strong className="text-slate-900">{currencySymbol}{target.toFixed(2)}</strong> | Paid: <strong className="text-emerald-600">{currencySymbol}{paid.toFixed(2)}</strong> | Due: <strong className={rem > 0 ? "text-rose-600" : "text-emerald-600"}>{currencySymbol}{rem.toFixed(2)}</strong>
                    </p>
                  </div>
                </div>

                {rem > 0 && (
                  <button
                    type="button"
                    onClick={() => setUtilityAmount(rem.toString())}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <span>Auto-Fill Due ({currencySymbol}{rem.toFixed(2)})</span>
                  </button>
                )}
              </div>
            );
          })()}

          {/* Form Inputs Grid */}
          <div className={`grid grid-cols-1 ${selectedUtilityCategory === 'general_deposit' ? 'sm:grid-cols-3' : 'sm:grid-cols-2 md:grid-cols-4'} gap-4`}>
            {/* 1. Utility Category Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Zap size={12} className="text-emerald-600" /> Payment Type / Category
              </label>
              <select
                value={selectedUtilityCategory}
                onChange={(e) => handleSelectUtilityCategory(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl px-3 py-2.5 text-xs text-slate-800 font-bold focus:outline-none cursor-pointer shadow-xs"
              >
                <option value="general_deposit">
                  🌟 General Utility Deposit (ম্যানেজারকে জমা)
                </option>
                <optgroup label="Direct Provider Category Bills">
                  {(() => {
                    const keys = Object.keys(utilityCategories).length > 0
                      ? Object.keys(utilityCategories)
                      : Object.keys(utilities);

                    return keys.map((k) => {
                      const cat = utilityCategories[k];
                      const label = cat ? cat.label : k;
                      const target = cat ? cat.targetAmount : (utilities[k] || 0);
                      const isDone = cat ? cat.isDone : false;
                      return (
                        <option key={k} value={k}>
                          {label} ({currencySymbol}{target}) {isDone ? "— [DONE ✅]" : ""}
                        </option>
                      );
                    });
                  })()}
                </optgroup>
              </select>
            </div>

            {/* 2. Paid Source (Fund vs Personal) - Shown only for category bills */}
            {selectedUtilityCategory !== "general_deposit" && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Building size={12} className="text-emerald-600" /> Paid From (Source)
                </label>
                <select
                  value={utilityPaidFrom}
                  onChange={(e) => setUtilityPaidFrom(e.target.value as "FUND" | "PERSONAL")}
                  className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl px-3 py-2.5 text-xs text-slate-800 font-bold focus:outline-none cursor-pointer shadow-xs"
                >
                  <option value="FUND">
                    🏢 House Fund (কমন ফান্ড)
                  </option>
                  <option value="PERSONAL">
                    👤 Personal Pocket (নিজের পকেট)
                  </option>
                </select>
              </div>
            )}

            {/* 3. Paid By (Member Selector) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <User size={12} className="text-emerald-600" /> {selectedUtilityCategory !== "general_deposit" && utilityPaidFrom === "FUND" ? "Recorded By / Manager" : "Paid By (Member)"}
              </label>
              <select
                value={utilityPaidBy}
                onChange={(e) => {
                  setUtilityPaidBy(e.target.value);
                  handleSelectUtilityCategory(selectedUtilityCategory, e.target.value);
                }}
                className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl px-3 py-2.5 text-xs text-slate-800 font-bold focus:outline-none cursor-pointer shadow-xs"
              >
                {users.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} {u._id === activeUserId ? "(You)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Amount Input with SmartMath */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <DollarSign size={12} className="text-emerald-600" /> Amount Paid ({currencySymbol})
              </label>
              <SmartMathInput
                value={utilityAmount}
                onChange={(val) => setUtilityAmount(val)}
                placeholder="e.g. 1650 or 1000+650"
                className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl px-3 py-2.5 text-xs text-slate-900 font-bold focus:outline-none shadow-xs"
              />
            </div>
          </div>

          {/* Helper clarification banner */}
          {selectedUtilityCategory !== "general_deposit" && (
            <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-medium">
              {utilityPaidFrom === "FUND" ? (
                <>💡 <strong>Paid from House Fund:</strong> Deducts from the collected utility pool in hand. Marks bill as PAID/DONE without altering personal roommate shares.</>
              ) : (
                <>💡 <strong>Paid from Personal Pocket:</strong> Marks bill as PAID/DONE and directly credits this roommate's personal utility due.</>
              )}
            </p>
          )}

          {/* Date & Note Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Day Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={12} className="text-emerald-600" /> Payment Date
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(parseInt(e.target.value) || 1)}
                className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl px-3 py-2.5 text-xs text-slate-800 font-bold focus:outline-none cursor-pointer shadow-xs"
              >
                {Array.from({ length: daysInMonth || 30 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Day {d} {d === todayDay ? "(Today)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Note & Slip Details */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <span>Payment Note / Handover Detail (Optional)</span>
              </label>
              <input
                type="text"
                placeholder={
                  selectedUtilityCategory === "general_deposit"
                    ? "e.g. Handed over utility share to Mess Manager / bKash"
                    : "e.g. Paid directly to AmberIT via bKash / ISP slip..."
                }
                value={utilityNote}
                onChange={(e) => setUtilityNote(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none font-medium shadow-xs"
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={!utilityAmount || parseFloat(utilityAmount) <= 0 || submitting}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs px-6 py-2.5 rounded-2xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-2 border-0"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin text-white" />
              ) : (
                <>
                  <Zap size={15} />
                  <span>
                    Log Utility Payment ({currencySymbol}
                    {(parseFloat(utilityAmount) || 0).toFixed(2)})
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

