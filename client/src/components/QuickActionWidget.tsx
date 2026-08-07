import React, { useState } from "react";
import { Zap, ShoppingBag, DollarSign, Calendar, User, Check, Loader2 } from "lucide-react";
import SmartMathInput from "./SmartMathInput";
import api from "../services/api";

interface QuickActionWidgetProps {
  monthId: string;
  daysInMonth: number;
  users: Array<{ _id: string; name: string }>;
  currencySymbol?: string;
  activeUserId: string;
  activeUserName: string;
  onRefresh: () => void;
  showAlert: (title: string, msg: string) => void;
}

export default function QuickActionWidget({
  monthId,
  daysInMonth,
  users,
  currencySymbol = "৳",
  activeUserId,
  activeUserName,
  onRefresh,
  showAlert,
}: QuickActionWidgetProps) {
  const [actionTab, setActionTab] = useState<"bazar" | "deposit">("bazar");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Today's day of month
  const todayDay = Math.min(new Date().getDate(), daysInMonth || 30);

  // Common Form States
  const [selectedDay, setSelectedDay] = useState<number>(todayDay);
  const [selectedUser, setSelectedUser] = useState<string>(
    users[0]?._id || activeUserId || ""
  );
  const [assignedUser, setAssignedUser] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const triggerSuccessNotice = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !amount || submitting) return;

    setSubmitting(true);
    try {
      const numericAmount = parseFloat(amount) || 0;

      if (actionTab === "bazar") {
        await api.post("/tracker/bazar/update", {
          monthId,
          day: selectedDay,
          userId: selectedUser,
          amount: numericAmount,
          assignedUser: assignedUser || null,
          note: note.trim() || null,
          activeUserId,
          activeUserName,
        });

        triggerSuccessNotice(
          `Recorded ${currencySymbol}${numericAmount.toFixed(2)} grocery expense for Day ${selectedDay}!`
        );
      } else {
        await api.post("/tracker/deposits/update", {
          monthId,
          day: selectedDay,
          userId: selectedUser,
          amount: numericAmount,
          note: note.trim() || null,
          activeUserId,
          activeUserName,
        });

        triggerSuccessNotice(
          `Logged ${currencySymbol}${numericAmount.toFixed(2)} deposit for Day ${selectedDay}!`
        );
      }

      setAmount("");
      setNote("");
      onRefresh();
    } catch (err: any) {
      console.error("Quick Action Error:", err);
      showAlert(
        "Action Failed",
        err.response?.data?.error || "Failed to record transaction."
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
                INSTANT SYNC
              </span>
            </h3>
            <p className="text-xs text-[#A69788]">
              Log date-specific grocery expenses and roommate deposits instantly
            </p>
          </div>
        </div>

        {/* Action Type Toggle Buttons */}
        <div className="flex gap-1.5 bg-[#1C1512] p-1.5 border border-[#382923] rounded-2xl shrink-0">
          <button
            type="button"
            onClick={() => setActionTab("bazar")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 flex items-center gap-1.5 ${
              actionTab === "bazar"
                ? "bg-[#E38D73] text-[#1C1512] shadow-md"
                : "text-[#A69788] hover:text-[#FAF6F0] bg-transparent"
            }`}
          >
            <ShoppingBag size={14} />
            <span>Grocery Expense</span>
          </button>

          <button
            type="button"
            onClick={() => setActionTab("deposit")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 flex items-center gap-1.5 ${
              actionTab === "deposit"
                ? "bg-[#A0B095] text-[#1C1512] shadow-md"
                : "text-[#A69788] hover:text-[#FAF6F0] bg-transparent"
            }`}
          >
            <DollarSign size={14} />
            <span>Meal Deposit</span>
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

      {/* Form Grid */}
      <form onSubmit={handleQuickSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Day / Date Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[#A69788] uppercase tracking-wider flex items-center gap-1">
              <Calendar size={12} className="text-[#E38D73]" /> Date (Day of Month)
            </label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(parseInt(e.target.value) || 1)}
              className="w-full bg-[#1C1512] border border-[#382923] focus:border-[#E38D73] rounded-2xl px-3 py-2 text-xs text-[#FAF6F0] font-bold focus:outline-none cursor-pointer"
            >
              {Array.from({ length: daysInMonth || 30 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Day {d} {d === todayDay ? "(Today)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Paid By Roommate */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[#A69788] uppercase tracking-wider flex items-center gap-1">
              <User size={12} className="text-[#E38D73]" /> {actionTab === "bazar" ? "Paid By Roommate" : "Depositor Roommate"}
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full bg-[#1C1512] border border-[#382923] focus:border-[#E38D73] rounded-2xl px-3 py-2 text-xs text-[#FAF6F0] font-bold focus:outline-none cursor-pointer"
            >
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} {u._id === activeUserId ? "(You)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Roommate Assignment for Bazar / Info Badge */}
          {actionTab === "bazar" ? (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#A69788] uppercase tracking-wider flex items-center gap-1">
                <User size={12} className="text-[#E38D73]" /> Assigned Cook / Purchaser
              </label>
              <select
                value={assignedUser}
                onChange={(e) => setAssignedUser(e.target.value)}
                className="w-full bg-[#1C1512] border border-[#382923] focus:border-[#E38D73] rounded-2xl px-3 py-2 text-xs text-[#FAF6F0] font-semibold focus:outline-none cursor-pointer"
              >
                <option value="">-- Unassigned --</option>
                {users.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#A69788] uppercase tracking-wider flex items-center gap-1">
                <DollarSign size={12} className="text-[#A0B095]" /> Category
              </label>
              <div className="w-full bg-[#1C1512] border border-[#382923] rounded-2xl px-3 py-2 text-xs text-[#A0B095] font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#A0B095]" />
                <span>Meal Account Deposit</span>
              </div>
            </div>
          )}

          {/* Amount Input with SmartMathInput */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[#A69788] uppercase tracking-wider flex items-center gap-1">
              <DollarSign size={12} className="text-[#E38D73]" /> Amount ({currencySymbol})
            </label>
            <div className="w-full">
              <SmartMathInput
                value={amount}
                onChange={(val) => setAmount(val)}
                placeholder="0 or 120+85+40"
                className="w-full bg-[#1C1512] border border-[#382923] focus:border-[#E38D73] rounded-2xl px-3 py-2 text-xs text-[#FAF6F0] font-bold focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Note/Memo Input & Submit Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder={
                actionTab === "bazar"
                  ? "Item Memo (e.g. Alu 60, Piaz 120, Mach 450)..."
                  : "Deposit Note (e.g. Hand Cash / Bkash Transfer)..."
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-[#1C1512] border border-[#382923] focus:border-[#E38D73] rounded-2xl px-4 py-2.5 text-xs text-[#FAF6F0] placeholder-[#78695C] focus:outline-none font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={!amount || submitting}
            className={`px-6 py-2.5 rounded-2xl text-xs font-black transition-all shadow-xl cursor-pointer flex items-center justify-center gap-2 shrink-0 border-0 disabled:opacity-40 ${
              actionTab === "bazar"
                ? "bg-[#E38D73] hover:bg-[#F2A38A] text-[#1C1512]"
                : "bg-[#A0B095] hover:bg-[#B5C5AA] text-[#1C1512]"
            }`}
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin text-[#1C1512]" />
            ) : (
              <>
                <Zap size={15} />
                <span>
                  {actionTab === "bazar" ? "Log Grocery Expense" : "Log Meal Deposit"}
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
