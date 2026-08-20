import { useState, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import {
  Home,
  Utensils,
  Search,
  Bell,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  UserCheck,
  Loader2,
  LogOut,
  Laptop,
  Sliders,
  Trash2,
  StickyNote,
  Pin,
  History,
  Plus,
  MessageSquare,
  HelpCircle,
  MousePointer2,
  Lock,
  Sparkles,
  Check,
  Crown,
  AlertCircle,
  Zap,
  Calculator,
  Key,
  CheckCircle2,
  Building,
  CreditCard,
  Receipt,
  Flame,
  Droplet,
  Trash,
  User,
  Wallet,
  Wifi,
} from "lucide-react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import api from "../services/api";
import Auth from "./Auth";
import HomeOnboarding from "./HomeOnboarding";
import ConfirmDialog from "./ConfirmDialog";
import DeviceConsentModal from "./DeviceConsentModal";
import DeviceTrackingSettings from "./DeviceTrackingSettings";
import DeviceDownloadHelp from "./DeviceDownloadHelp";
import HouseChat from "./HouseChat";
import SmartMathInput from "./SmartMathInput";
import QuickCalculatorModal from "./QuickCalculatorModal";
import QuickActionWidget from "./QuickActionWidget";


export interface UtilityPaymentTransaction {
  _id: string;
  amount: number;
  paidBy?: { _id: string; name: string } | null;
  date: string;
  note?: string;
}

export interface UtilityCategoryDetail {
  key: string;
  label: string;
  targetAmount: number;
  paidAmount: number;
  remaining: number;
  percent: number;
  isDone: boolean;
  note?: string;
  payments?: UtilityPaymentTransaction[];
}

export interface UtilitySummary {
  totalBill: number;
  totalCollected: number;
  totalPaid: number;
  totalRemaining: number;
  fundInHand?: number;
  totalGeneralDeposits?: number;
  generalPayments?: UtilityPaymentTransaction[];
  isDone: boolean;
  categories: { [key: string]: UtilityCategoryDetail };
}

export interface RentRoommateDetail {
  userId: string;
  name: string;
  rentPortion: number;
  rentPayment: number;
  rentDue: number;
  isDone: boolean;
}

export interface RentSummary {
  totalRent: number;
  totalPaid: number;
  totalRemaining: number;
  isDone: boolean;
  roommateBreakdown: RentRoommateDetail[];
}

interface UserStanding {
  userId: string;
  name: string;
  email: string;
  role: string;
  userTotalMeals: number;
  usageHours: number;
  usagePercent: number;
  mealCostPortion: number;
  prevMealDue: number;
  utilityPortion: number;
  prevUtilityDue: number;
  utilityShare: number;
  utilityPayment: number;
  rentPortion: number;
  rentPayment: number;
  totalDeposits: number;
  netBazarPaid: number;
  foodDue: number;
  utilityDue: number;
  rentDue: number;
  finalDue: number;
  walletReceived: number;
  walletGiven: number;
  walletSpent: number;
  walletBalance: number;
  note?: string;
}

interface DeviceUsage {
  deviceId: string;
  ownerName: string;
  usageHours: number;
  usagePercent: number;
}

interface UtilitySplitRule {
  mode: "equal" | "weighted" | "surcharge" | "fixed";
  customValues?: { [userId: string]: number };
}

interface MonthlyBillConfig {
  _id?: string;
  monthId: string;
  rent: { [userId: string]: number };
  utilities: { [key: string]: number };
  adjustments: Array<{
    user: string;
    prevUtilityDue: number;
    prevMealDue: number;
    utilityPayment: number;
    rentPayment: number;
    note?: string;
  }>;
  utilityNotes?: { [key: string]: string };
  utilitySplitRules?: { [key: string]: UtilitySplitRule };
}

const computePreviewShares = (
  totalBill: number,
  mode: string,
  customVals: { [uid: string]: number },
  users: Array<{ userId: string; name: string }>,
) => {
  if (totalBill <= 0 || !users.length) return {};
  const res: { [uid: string]: number } = {};

  if (mode === "weighted") {
    let totalW = 0;
    const weights: { [uid: string]: number } = {};
    users.forEach((u) => {
      const w = parseFloat(customVals[u.userId] as any) > 0 ? parseFloat(customVals[u.userId] as any) : 1;
      weights[u.userId] = w;
      totalW += w;
    });
    users.forEach((u) => {
      res[u.userId] = totalW > 0 ? totalBill * (weights[u.userId] / totalW) : totalBill / users.length;
    });
  } else if (mode === "surcharge") {
    let totalS = 0;
    users.forEach((u) => {
      totalS += parseFloat(customVals[u.userId] as any) || 0;
    });
    const remaining = Math.max(0, totalBill - totalS);
    const base = remaining / users.length;
    users.forEach((u) => {
      res[u.userId] = base + (parseFloat(customVals[u.userId] as any) || 0);
    });
  } else if (mode === "fixed") {
    let totalFixed = 0;
    const fixedU: string[] = [];
    const nonFixedU: string[] = [];
    users.forEach((u) => {
      const val = customVals[u.userId];
      if (val !== undefined && val !== null && (val as any) !== "") {
        totalFixed += parseFloat(val as any) || 0;
        fixedU.push(u.userId);
      } else {
        nonFixedU.push(u.userId);
      }
    });
    const remaining = Math.max(0, totalBill - totalFixed);
    const remShare = nonFixedU.length > 0 ? remaining / nonFixedU.length : 0;
    fixedU.forEach((uid) => {
      res[uid] = parseFloat(customVals[uid] as any) || 0;
    });
    nonFixedU.forEach((uid) => {
      res[uid] = remShare;
    });
  } else {
    users.forEach((u) => {
      res[u.userId] = totalBill / users.length;
    });
  }
  return res;
};

interface WalletTransfer {
  _id: string;
  from: string;
  to: string;
  amount: number;
  date: string;
  note: string;
}

interface WalletUserSummary {
  userId: string;
  name: string;
  received: number;
  given: number;
  spent: number;
  deposits?: number;
  balance: number;
}

interface WalletData {
  monthId: string;
  transfers: WalletTransfer[];
  walletId: string;
  userSummaries: WalletUserSummary[];
}

interface SummaryData {
  monthId: string;
  totalMealCost: number;
  totalMeals: number;
  totalUtilities: number;
  mealRate: number;
  monthlyBill: MonthlyBillConfig;
  deviceUsages: DeviceUsage[];
  userStandings: UserStanding[];
  utilitySummary?: UtilitySummary;
  rentSummary?: RentSummary;
}

export default function Dashboard() {
  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good morning";
    if (hr < 17) return "Good afternoon";
    return "Good evening";
  };

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "hardware" | "tracker" | "notepad" | "history" | "chat"
  >("dashboard");

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light");
    root.classList.add("dark");
    localStorage.setItem("lifeos-theme", "dark");
  }, []);

  const [monthId, setMonthId] = useState<string>("July-2026");
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Device Desk States
  const [consentStatus, setConsentStatus] = useState<{
    isActive: boolean;
    consentedAt: string | null;
  }>({ isActive: false, consentedAt: null });
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);
  const [showTrackingSettings, setShowTrackingSettings] = useState<boolean>(false);
  const [showDownloadHelp, setShowDownloadHelp] = useState<boolean>(false);
  const [showProModal, setShowProModal] = useState<boolean>(false);
  const [showQuickCalc, setShowQuickCalc] = useState<boolean>(false);

  // Daily Tracker Interfaces & States
  interface TrackerUser {
    _id: string;
    name: string;
    email: string;
    role: string;
  }

  interface DailyMeals {
    day: number;
    date: string;
    guestMeals: number;
    meals: {
      [userId: string]: number;
    };
  }

  interface DailyBazar {
    day: number;
    date: string;
    costs: {
      [userId: string]: number;
    };
    notes?: {
      [userId: string]: string;
    };
    assignedUser?: string | null;
  }

  interface DailyDeposit {
    day: number;
    date: string;
    amounts: {
      [userId: string]: number;
    };
    notes?: {
      [userId: string]: string;
    };
  }

  interface TrackerData {
    monthId: string;
    daysInMonth: number;
    users: TrackerUser[];
    meals: DailyMeals[];
    bazar: DailyBazar[];
    deposits: DailyDeposit[];
  }

  const [trackerData, setTrackerData] = useState<TrackerData | null>(null);
  const [trackerLoading, setTrackerLoading] = useState<boolean>(false);
  const [trackerError, setTrackerError] = useState<string | null>(null);
  const [trackerSubTab, setTrackerSubTab] = useState<
    "meals" | "bazar" | "deposits" | "wallet"
  >("meals");

  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [billConfig, setBillConfig] = useState<MonthlyBillConfig | null>(null);
  const [expandedSplitUtil, setExpandedSplitUtil] = useState<string | null>(null);

  // Dynamic Month States
  const [availableMonths, setAvailableMonths] = useState<string[]>([
    "July-2026",
    "June-2026",
  ]);
  const [isNewMonthModalOpen, setIsNewMonthModalOpen] =
    useState<boolean>(false);
  const [newMonthPrevMonthId, setNewMonthPrevMonthId] =
    useState<string>("July-2026");

  // Rent Payment Quick Modal States
  const [isRentModalOpen, setIsRentModalOpen] = useState<boolean>(false);
  const [rentModalUser, setRentModalUser] = useState<{
    userId: string;
    name: string;
    rentPortion: number;
    rentPayment: number;
    rentDue: number;
  } | null>(null);
  const [rentPaymentInput, setRentPaymentInput] = useState<string>("");
  const [rentPaymentNote, setRentPaymentNote] = useState<string>("");
  const [submittingRent, setSubmittingRent] = useState<boolean>(false);

  // Session Authentication & Onboarding states
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("lifeos-token"),
  );
  const [currentUser, setCurrentUser] = useState<{
    _id: string;
    name: string;
    nickname: string;
    email: string;
    homeId: string | null;
    role: string;
    hasCompletedTour?: boolean;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Dynamic Home details
  const [homeName, setHomeName] = useState<string>("Sweet Home");
  const [homeData, setHomeData] = useState<any>(null);
  const [isHomeSettingsOpen, setIsHomeSettingsOpen] = useState<boolean>(false);
  const [editHomeName, setEditHomeName] = useState<string>("");
  const [editHomeCurrency, setEditHomeCurrency] = useState<string>("৳");
  const [savingHomeSettings, setSavingHomeSettings] = useState<boolean>(false);

  const [editingRoommate, setEditingRoommate] = useState<any>(null);
  const [editRoommateEmail, setEditRoommateEmail] = useState<string>("");
  const [editRoommateNickname, setEditRoommateNickname] = useState<string>("");
  const [editRoommatePassword, setEditRoommatePassword] = useState<string>("");
  const [savingRoommateCredentials, setSavingRoommateCredentials] = useState<boolean>(false);

  const handleOpenEditRoommate = (member: any) => {
    setEditingRoommate(member);
    setEditRoommateEmail(member.email || "");
    setEditRoommateNickname(member.nickname || "");
    setEditRoommatePassword("");
  };

  const handleSaveRoommateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoommate) return;
    setSavingRoommateCredentials(true);
    try {
      const res = await api.put("/home/roommate-credentials", {
        memberId: editingRoommate._id,
        newEmail: editRoommateEmail,
        newNickname: editRoommateNickname,
        newPassword: editRoommatePassword,
      });
      if (res.data.home) {
        setHomeData(res.data.home);
      }
      setEditingRoommate(null);
      setEditRoommateEmail("");
      setEditRoommateNickname("");
      setEditRoommatePassword("");
      showAlert("Success", res.data.message || "Roommate credentials updated successfully!");
    } catch (err: any) {
      console.error("Error updating roommate credentials:", err);
      showAlert(
        "Error",
        err.response?.data?.error || "Failed to update roommate credentials.",
      );
    } finally {
      setSavingRoommateCredentials(false);
    }
  };

  const currencySymbol = homeData?.currency || "৳";

  const fetchHomeDetails = async () => {
    if (!token || !currentUser) return;
    try {
      const response = await api.get("/home/details");
      if (response.data.home) {
        setHomeData(response.data.home);
        setHomeName(response.data.home.name);
        setEditHomeName(response.data.home.name);
        if (response.data.home.currency) {
          setEditHomeCurrency(response.data.home.currency);
        }
      }
    } catch (err) {
      console.error("Error fetching home details:", err);
    }
  };

  const handleSaveHomeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHomeSettings(true);
    try {
      const res = await api.put("/home/settings", {
        name: editHomeName,
        currency: editHomeCurrency,
      });
      if (res.data.home) {
        setHomeData(res.data.home);
        setHomeName(res.data.home.name);
      }
      setIsHomeSettingsOpen(false);
      showAlert("Success", "Household settings updated successfully!");
    } catch (err: any) {
      console.error("Error updating home settings:", err);
      showAlert(
        "Error",
        err.response?.data?.error || "Failed to update home settings.",
      );
    } finally {
      setSavingHomeSettings(false);
    }
  };

  useEffect(() => {
    if (currentUser?.homeId) {
      fetchHomeDetails();
    }
  }, [currentUser]);

  // Tour states & utility
  const [tourStarted, setTourStarted] = useState<boolean>(false);
  const [tourPointerTab, setTourPointerTab] = useState<
    "dashboard" | "tracker" | "chat" | "hardware" | "notepad" | "history" | null
  >(null);

  const moveTourNextWhenReady = useCallback(
    (selector: string, driverInstance: any) => {
      const tryAdvance = (attempt: number) => {
        if (document.querySelector(selector)) {
          setTimeout(() => {
            driverInstance.moveNext();
          }, 150);
          return;
        }

        if (attempt >= 30) {
          driverInstance.moveNext();
          return;
        }

        setTimeout(() => tryAdvance(attempt + 1), 100);
      };

      tryAdvance(0);
    },
    [],
  );

  const startTour = useCallback(() => {
    const stepsConfig = [
      {
        element: "#dashboard-greeting",
        popover: {
          title: "Welcome to LifeOS! 👋",
          description:
            "This is your main dashboard. You can see personalized greetings, announcements, and quick status metrics here.",
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "#dashboard-stats",
        popover: {
          title: "Monthly Summary Stats 📈",
          description:
            "Quickly monitor total meal costs, active shared meal counts, and this month's calculated meal rate.",
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "#roommate-standing",
        popover: {
          title: "Roommate Standings Ledger 👥",
          description:
            "A real-time overview of who cooked, who spent on bazar, and what final dues are owed by/to each roommate.",
          side: "top" as const,
          align: "start" as const,
        },
        onNextClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("tracker");
          });
          moveTourNextWhenReady("#sidebar-tab-tracker", driver);
        },
      },
      {
        element: "#sidebar-tab-tracker",
        popover: {
          title: "Kitchen & Meals",
          description: "This tab is the next destination in the tour.",
          side: "right" as const,
          align: "start" as const,
        },
        onHighlightStarted: () => {
          setTourPointerTab("tracker");
        },
        onDeselected: () => {
          setTourPointerTab((current) =>
            current === "tracker" ? null : current,
          );
        },
        onPrevClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("dashboard");
          });
          setTimeout(() => {
            driver.movePrevious();
          }, 200);
        },
        onNextClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("tracker");
          });
          moveTourNextWhenReady("#meals-tabs-container", driver);
        },
      },
      {
        element: "#meals-tabs-container",
        popover: {
          title: "Kitchen & Meal Tracker 🍳",
          description:
            "Record roommate meal servings, log shared grocery bazar costs, add deposits, and manage roommate sub-wallets.",
          side: "bottom" as const,
          align: "start" as const,
        },
        onPrevClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("tracker");
          });
          setTimeout(() => {
            driver.movePrevious();
          }, 200);
        },
        onNextClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("chat");
          });
          moveTourNextWhenReady("#sidebar-tab-chat", driver);
        },
      },
      {
        element: "#sidebar-tab-chat",
        popover: {
          title: "House Chat 💬",
          description: "This tab is the next destination in the tour.",
          side: "right" as const,
          align: "start" as const,
        },
        onHighlightStarted: () => {
          setTourPointerTab("chat");
        },
        onDeselected: () => {
          setTourPointerTab((current) =>
            current === "chat" ? null : current,
          );
        },
        onPrevClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("tracker");
          });
          setTimeout(() => {
            driver.movePrevious();
          }, 200);
        },
        onNextClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("chat");
          });
          moveTourNextWhenReady("#house-chat-container", driver);
        },
      },
      {
        element: "#house-chat-container",
        popover: {
          title: "Live House Channel 💬",
          description:
            "Chat in real time with your roommates and household members. Share grocery updates, dinner plans, or house notes right here.",
          side: "bottom" as const,
          align: "start" as const,
        },
        onPrevClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("chat");
          });
          setTimeout(() => {
            driver.movePrevious();
          }, 200);
        },
        onNextClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("hardware");
          });
          moveTourNextWhenReady("#sidebar-tab-hardware", driver);
        },
      },
      {
        element: "#sidebar-tab-hardware",
        popover: {
          title: "Device Desk",
          description: "This tab is the next destination in the tour.",
          side: "right" as const,
          align: "start" as const,
        },
        onHighlightStarted: () => {
          setTourPointerTab("hardware");
        },
        onDeselected: () => {
          setTourPointerTab((current) =>
            current === "hardware" ? null : current,
          );
        },
        onPrevClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("chat");
          });
          setTimeout(() => {
            driver.movePrevious();
          }, 200);
        },
        onNextClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("hardware");
          });
          moveTourNextWhenReady("#device-desk-container", driver);
        },
      },
      {
        element: "#device-desk-container",
        popover: {
          title: "Device Desk 💻",
          description:
            "Monitor active system health, network telemetry logging, and shared computer units in the household.",
          side: "bottom" as const,
          align: "start" as const,
        },
        onPrevClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("hardware");
          });
          setTimeout(() => {
            driver.movePrevious();
          }, 200);
        },
        onNextClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("notepad");
          });
          moveTourNextWhenReady("#sidebar-tab-notepad", driver);
        },
      },
      {
        element: "#sidebar-tab-notepad",
        popover: {
          title: "House Notes",
          description: "This tab is the next destination in the tour.",
          side: "right" as const,
          align: "start" as const,
        },
        onHighlightStarted: () => {
          setTourPointerTab("notepad");
        },
        onDeselected: () => {
          setTourPointerTab((current) =>
            current === "notepad" ? null : current,
          );
        },
        onPrevClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("hardware");
          });
          setTimeout(() => {
            driver.movePrevious();
          }, 200);
        },
        onNextClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("notepad");
          });
          moveTourNextWhenReady("#create-note-form", driver);
        },
      },
      {
        element: "#create-note-form",
        popover: {
          title: "Cozy Notepad & Purchases 📝",
          description:
            "Create shared shopping items, todo check-lists, general memos, or deadlined reminders.",
          side: "bottom" as const,
          align: "start" as const,
        },
        onPrevClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("notepad");
          });
          setTimeout(() => {
            driver.movePrevious();
          }, 200);
        },
        onNextClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("history");
          });
          moveTourNextWhenReady("#sidebar-tab-history", driver);
        },
      },
      {
        element: "#sidebar-tab-history",
        popover: {
          title: "Change History",
          description: "This tab is the next destination in the tour.",
          side: "right" as const,
          align: "start" as const,
        },
        onHighlightStarted: () => {
          setTourPointerTab("history");
        },
        onDeselected: () => {
          setTourPointerTab((current) =>
            current === "history" ? null : current,
          );
        },
        onPrevClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("notepad");
          });
          setTimeout(() => {
            driver.movePrevious();
          }, 200);
        },
        onNextClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("history");
          });
          moveTourNextWhenReady("#history-log-container", driver);
        },
      },
      {
        element: "#history-log-container",
        popover: {
          title: "Change History Log 🧾",
          description:
            "Review the audit trail for meals, groceries, deposits, notes, and monthly configuration changes.",
          side: "bottom" as const,
          align: "start" as const,
        },
        onPrevClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("history");
          });
          setTimeout(() => {
            driver.movePrevious();
          }, 200);
        },
        onNextClick: (_element: any, _step: any, { driver }: any) => {
          flushSync(() => {
            setActiveTab("dashboard");
          });
          moveTourNextWhenReady("#top-bar-controls", driver);
        },
      },
      {
        element: "#top-bar-controls",
        popover: {
          title: "Top Bar Utilities 🛠️",
          description:
            "Easily select months, configure roommate bill splits, and check the custom notifications bell.",
          side: "bottom" as const,
          align: "end" as const,
        },
        onPrevClick: (_element: any, _step: any, { driver }: any) => {
          setActiveTab("history");
          setTimeout(() => {
            driver.movePrevious();
          }, 200);
        },
      },
    ];

    const d = driver({
      showProgress: true,
      popoverClass: "cozy-tour-popover",
      allowClose: true,
      steps: stepsConfig,
      onDestroyed: async () => {
        if (currentUser && !currentUser.hasCompletedTour) {
          try {
            await api.put("/auth/completed-tour");
            setCurrentUser((prev) =>
              prev ? { ...prev, hasCompletedTour: true } : null,
            );
          } catch (err) {
            console.error("Failed to save tour completion:", err);
          }
        }
      },
    });

    d.drive();
  }, [currentUser]);

  const launchTour = useCallback(
    (force = false, delayMs = 300) => {
      if (tourStarted && !force) {
        return;
      }

      setTourStarted(true);
      setTimeout(() => {
        startTour();
      }, delayMs);
    },
    [startTour, tourStarted],
  );

  useEffect(() => {
    if (currentUser?.homeId && !currentUser.hasCompletedTour && !tourStarted) {
      const timer = setTimeout(() => {
        launchTour(false, 0);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentUser, tourStarted, launchTour]);

  // Search input state
  const [searchText, setSearchText] = useState<string>("");

  // Invite roommate states
  const [inviteNickname, setInviteNickname] = useState<string>("");
  const [inviteLoading, setInviteLoading] = useState<boolean>(false);

  // Stubs mapped to session context so existing mutation payloads compile unchanged!
  const activeUserId = currentUser?._id || "";
  const activeUserName = currentUser?.name || "";

  // Custom Confirm/Alert Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isAlert?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText = "Confirm",
    cancelText = "Cancel",
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText,
      isAlert: false,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const showAlert = (
    title: string,
    message: string,
    onConfirm?: () => void,
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText: "OK",
      isAlert: true,
      onConfirm: () => {
        if (onConfirm) onConfirm();
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Notepad states
  interface NoteRecord {
    _id: string;
    monthId: string;
    text: string;
    category: "general" | "purchase" | "reminder" | "todo";
    amount: number;
    createdBy?: string;
    createdByName?: string;
    pinned: boolean;
    createdAt: string;
    completed?: boolean;
    reminderDate?: string | null;
  }
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [noteText, setNoteText] = useState<string>("");
  const [noteCategory, setNoteCategory] = useState<
    "general" | "purchase" | "reminder" | "todo"
  >("general");
  const [noteAmount, setNoteAmount] = useState<string>("");
  const [noteReminderDate, setNoteReminderDate] = useState<string>("");
  const [notesLoading, setNotesLoading] = useState<boolean>(false);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState<string>("");
  const [editingNoteCategory, setEditingNoteCategory] = useState<
    "general" | "purchase" | "reminder" | "todo"
  >("general");
  const [editingNoteAmount, setEditingNoteAmount] = useState<string>("");
  const [editingNoteReminderDate, setEditingNoteReminderDate] =
    useState<string>("");

  // Audit History states
  interface AuditLogChange {
    field: string;
    oldValue: any;
    newValue: any;
    detail: string;
  }
  interface AuditLogRecord {
    _id: string;
    monthId: string;
    action: string;
    entity: string;
    entityId: string;
    userId: string;
    userName: string;
    changes: AuditLogChange[];
    createdAt: string;
  }
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditTotalPages, setAuditTotalPages] = useState<number>(1);

  // Comment popover states
  const [activeCommentCell, setActiveCommentCell] = useState<{
    type: "bazar" | "deposit";
    day: number;
    userId: string;
  } | null>(null);
  const [activeCommentText, setActiveCommentText] = useState<string>("");

  // Notification states & effects
  interface AppNotification {
    id: string;
    text: string;
    time: string;
    read: boolean;
  }
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lifeos-notifications");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [notifiedReminders, setNotifiedReminders] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "lifeos-notifications",
        JSON.stringify(notifications),
      );
    }
  }, [notifications]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  const playBuzzSound = () => {
    try {
      const ctx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);

      // Buzz beep pattern: two short buzzes
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + 0.25);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0, ctx.currentTime + 0.4);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.45);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + 0.65);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.7);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {
      console.error("AudioContext error:", e);
    }
  };

  useEffect(() => {
    notes.forEach((note) => {
      if (note.category === "reminder" && note.reminderDate) {
        const reminderTime = new Date(note.reminderDate).getTime();
        const now = currentTime.getTime();

        if (now >= reminderTime && !notifiedReminders.includes(note._id)) {
          setNotifiedReminders((prev) => [...prev, note._id]);
          playBuzzSound();

          const newNotif = {
            id: `${note._id}-${Date.now()}`,
            text: `Reminder: ${note.text}`,
            time: new Date().toISOString(),
            read: false,
          };
          setNotifications((prev) => [newNotif, ...prev]);

          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            new Notification("LifeOS Reminder!", {
              body: note.text,
            });
          }
        }
      }
    });
  }, [currentTime, notes, notifiedReminders]);

  const renderReminderTimer = (note: NoteRecord) => {
    if (!note.reminderDate) return null;
    const diff = new Date(note.reminderDate).getTime() - currentTime.getTime();

    if (diff <= 0) {
      return (
        <span className="text-[10px] text-rose-500 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 animate-pulse font-sans">
          ⏰ Time is up!
        </span>
      );
    }

    const secs = Math.floor(diff / 1000) % 60;
    const mins = Math.floor(diff / (1000 * 60)) % 60;
    const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    let countdownStr = "";
    if (days > 0) countdownStr += `${days}d `;
    if (hours > 0 || days > 0) countdownStr += `${hours}h `;
    countdownStr += `${mins}m ${secs}s`;

    return (
      <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-mono">
        ⏳ {countdownStr} remaining
      </span>
    );
  };

  // Load current session user from JWT
  const fetchCurrentUser = async () => {
    setAuthLoading(true);
    try {
      const response = await api.get("/auth/me");
      setCurrentUser(response.data.user);
    } catch (err) {
      console.error("Session load failed:", err);
      localStorage.removeItem("lifeos-token");
      setToken(null);
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    } else {
      setAuthLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem("lifeos-token");
      setToken(null);
      setCurrentUser(null);
    };
    window.addEventListener("lifeos-unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("lifeos-unauthorized", handleUnauthorized);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("lifeos-token");
    setToken(null);
    setCurrentUser(null);
    // Reset all dashboard state so stale data doesn't persist across accounts
    setHomeData(null);
    setHomeName("Sweet Home");
    setSummaryData(null);
    setTrackerData(null);
    setBillConfig(null);
    setTourStarted(false);
    setActiveTab("dashboard");
    setTrackerSubTab("meals");
  };

  const handleInviteRoommate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteNickname.trim()) return;
    setInviteLoading(true);
    try {
      const response = await api.post("/home/invite", {
        nickname: inviteNickname,
      });
      showAlert("Success", response.data.message);
      setInviteNickname("");
      fetchSummary();
      fetchBillConfig();
      if (activeTab === "tracker") {
        fetchTracker();
      }
    } catch (err: any) {
      console.error("Invite roommate error:", err);
      showAlert(
        "Error",
        err.response?.data?.error || "Failed to invite roommate.",
      );
    } finally {
      setInviteLoading(false);
    }
  };

  const handleTogglePermission = async (
    memberId: string,
    currentHasControl: boolean,
  ) => {
    try {
      const response = await api.post("/home/permission", {
        memberId,
        hasControl: !currentHasControl,
      });
      if (response.data.home) {
        setHomeData(response.data.home);
      }
    } catch (err: any) {
      console.error("Error toggling permission:", err);
      showAlert(
        "Error",
        err.response?.data?.error || "Failed to toggle permission",
      );
    }
  };

  // Debounced search queries for notepad and audit history logs
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (activeTab === "notepad") {
        fetchNotes();
      } else if (activeTab === "history") {
        fetchAuditLogs(1);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchText, activeTab, monthId]);

  const fetchMonths = async () => {
    if (!token || !currentUser) return;
    try {
      const response = await api.get<{ months: string[] }>("/months");
      setAvailableMonths(response.data.months);
    } catch (err) {
      console.error("Error fetching available months:", err);
    }
  };

  const handleCreateMonth = async () => {
    try {
      const response = await api.post("/months", {
        previousMonthId: newMonthPrevMonthId,
        userId: activeUserId,
        userName: activeUserName,
      });
      setIsNewMonthModalOpen(false);
      await fetchMonths();
      if (response.data.monthId) {
        setMonthId(response.data.monthId);
      }
      showAlert("Success", "New month setup completed successfully!");
    } catch (err: any) {
      console.error("Error creating month:", err);
      showAlert(
        "Month Setup Failed",
        err.response?.data?.error || "Failed to create month",
      );
    }
  };

  const fetchNotes = async () => {
    setNotesLoading(true);
    try {
      const response = await api.get<{ notes: NoteRecord[] }>(
        `/notepad/${monthId}?search=${encodeURIComponent(searchText)}`,
      );
      setNotes(response.data.notes);
    } catch (err) {
      console.error("Error fetching notes:", err);
    } finally {
      setNotesLoading(false);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    try {
      await api.post("/notepad", {
        monthId,
        text: noteText,
        category: noteCategory,
        amount: parseFloat(noteAmount) || 0,
        reminderDate:
          noteCategory === "reminder" && noteReminderDate
            ? noteReminderDate
            : null,
        userId: activeUserId,
        userName: activeUserName,
      });
      setNoteText("");
      setNoteAmount("");
      setNoteReminderDate("");
      setNoteCategory("general");
      fetchNotes();
      showAlert("Success", "Note added successfully!");
    } catch (err) {
      console.error("Error creating note:", err);
    }
  };

  const handleSaveNoteEdit = async (noteId: string) => {
    try {
      await api.put(`/notepad/${noteId}`, {
        text: editingNoteText,
        category: editingNoteCategory,
        amount: parseFloat(editingNoteAmount) || 0,
        reminderDate:
          editingNoteCategory === "reminder" && editingNoteReminderDate
            ? editingNoteReminderDate
            : null,
        userId: activeUserId,
        userName: activeUserName,
      });
      setEditingNoteId(null);
      fetchNotes();
      showAlert("Success", "Note updated successfully!");
    } catch (err) {
      console.error("Error editing note:", err);
    }
  };

  const handleToggleTodoCompleted = async (
    noteId: string,
    currentCompleted: boolean,
  ) => {
    try {
      await api.put(`/notepad/${noteId}`, {
        completed: !currentCompleted,
        userId: activeUserId,
        userName: activeUserName,
      });
      fetchNotes();
      showAlert(
        "Success",
        `Todo marked as ${!currentCompleted ? "completed" : "incomplete"}!`,
      );
    } catch (err: any) {
      console.error("Error toggling todo completion:", err);
      showAlert(
        "Error",
        err.response?.data?.error || "Failed to update todo status",
      );
    }
  };

  const handleToggleNotePin = async (
    noteId: string,
    currentPinned: boolean,
  ) => {
    try {
      await api.put(`/notepad/${noteId}`, {
        pinned: !currentPinned,
        userId: activeUserId,
        userName: activeUserName,
      });
      fetchNotes();
    } catch (err) {
      console.error("Error pinning note:", err);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    showConfirm(
      "Delete Note",
      "Are you sure you want to delete this note?",
      async () => {
        try {
          await api.delete(`/notepad/${noteId}`, {
            data: { userId: activeUserId, userName: activeUserName },
          });
          fetchNotes();
          showAlert("Success", "Note deleted successfully!");
        } catch (err) {
          console.error("Error deleting note:", err);
        }
      },
      "Delete",
      "Cancel",
    );
  };

  const fetchAuditLogs = async (page: number = 1) => {
    setAuditLoading(true);
    try {
      const response = await api.get<{
        logs: AuditLogRecord[];
        totalPages: number;
      }>(
        `/audit/${monthId}?page=${page}&limit=20&search=${encodeURIComponent(searchText)}`,
      );
      setAuditLogs(response.data.logs);
      setAuditPage(page);
      setAuditTotalPages(response.data.totalPages);
    } catch (err) {
      console.error("Error fetching audit logs:", err);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    fetchMonths();
  }, []);

  useEffect(() => {
    if (activeTab === "notepad") {
      fetchNotes();
    } else if (activeTab === ("history" as any)) {
      fetchAuditLogs(1);
    }
  }, [activeTab, monthId]);

  // Bazar wallet state
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [walletFrom, setWalletFrom] = useState<string>("");
  const [walletTo, setWalletTo] = useState<string>("");
  const [walletAmount, setWalletAmount] = useState<string>("");
  const [walletNote, setWalletNote] = useState<string>("");
  const [walletDate, setWalletDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  const fetchWallet = async () => {
    try {
      const response = await api.get<WalletData>(`/bazar-wallet/${monthId}`);
      setWalletData(response.data);
    } catch (err) {
      console.error("Error fetching bazar wallet:", err);
    }
  };

  useEffect(() => {
    if (trackerSubTab === "wallet") {
      fetchWallet();
    }
  }, [trackerSubTab, monthId]);

  const handleAddTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletFrom || !walletTo || !walletAmount) return;
    try {
      await api.post("/bazar-wallet/transfer", {
        monthId,
        from: walletFrom,
        to: walletTo,
        amount: parseFloat(walletAmount) || 0,
        note: walletNote,
        date: walletDate,
        activeUserId,
        activeUserName,
      });
      setWalletAmount("");
      setWalletNote("");
      fetchWallet();
      const summaryResponse = await api.get<SummaryData>(`/summary/${monthId}`);
      setSummaryData(summaryResponse.data);
      showAlert("Success", "Transfer recorded successfully!");
    } catch (err) {
      console.error("Error adding transfer:", err);
    }
  };

  const handleDeleteTransfer = async (transferId: string) => {
    try {
      await api.delete(`/bazar-wallet/transfer/${transferId}`, {
        data: { activeUserId, activeUserName },
      });
      fetchWallet();
      const summaryResponse = await api.get<SummaryData>(`/summary/${monthId}`);
      setSummaryData(summaryResponse.data);
      showAlert("Success", "Transfer deleted successfully!");
    } catch (err) {
      console.error("Error deleting transfer:", err);
    }
  };

  const fetchBillConfig = async () => {
    try {
      const response = await api.get<MonthlyBillConfig>(
        `/monthly-bill/${monthId}`,
      );
      setBillConfig(response.data);
    } catch (err) {
      console.error("Error fetching monthly bill config:", err);
    }
  };

  const openConfigModal = () => {
    fetchBillConfig();
    setIsConfigModalOpen(true);
  };

  useEffect(() => {
    fetchBillConfig();
  }, [monthId]);

  const handleDepositChange = async (
    day: number,
    userId: string,
    value: string,
  ) => {
    if (!trackerData) return;
    const numericVal = parseFloat(value) || 0;

    const updatedDeposits = trackerData.deposits.map((item) => {
      if (item.day === day) {
        return {
          ...item,
          amounts: {
            ...item.amounts,
            [userId]: numericVal,
          },
        };
      }
      return item;
    });

    setTrackerData({
      ...trackerData,
      deposits: updatedDeposits,
    });

    try {
      await api.post("/tracker/deposits/update", {
        monthId,
        day,
        userId,
        amount: numericVal,
        isOverwrite: true,
        activeUserId,
        activeUserName,
      });
      const summaryResponse = await api.get<SummaryData>(`/summary/${monthId}`);
      setSummaryData(summaryResponse.data);
    } catch (err) {
      console.error("Error updating meal deposit:", err);
    }
  };

  const handleSaveBillConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billConfig) return;

    try {
      await api.post("/monthly-bill", {
        ...billConfig,
        activeUserId,
        activeUserName,
      });
      setIsConfigModalOpen(false);
      const summaryResponse = await api.get<SummaryData>(`/summary/${monthId}`);
      setSummaryData(summaryResponse.data);
      showAlert("Success", "Bill configurations saved successfully!");
    } catch (err) {
      console.error("Error saving bill configurations:", err);
    }
  };

  const handleRecordRentPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rentModalUser || !rentPaymentInput || submittingRent) return;
    const numeric = parseFloat(rentPaymentInput) || 0;
    if (numeric <= 0) return;

    setSubmittingRent(true);
    try {
      await api.post("/monthly-bill/rent-payment", {
        monthId,
        userId: rentModalUser.userId,
        amount: numeric,
        isAppend: true,
        note: rentPaymentNote.trim() || undefined,
        activeUserId,
        activeUserName,
      });
      showAlert("Success", `Rent payment of ${currencySymbol}${numeric.toFixed(2)} recorded for ${rentModalUser.name}!`);
      setIsRentModalOpen(false);
      setRentPaymentInput("");
      setRentPaymentNote("");
      fetchSummary();
    } catch (err: any) {
      console.error("Error recording rent payment:", err);
      showAlert("Error", err.response?.data?.error || "Failed to record rent payment.");
    } finally {
      setSubmittingRent(false);
    }
  };

  const fetchTracker = async () => {
    setTrackerLoading(true);
    setTrackerError(null);
    try {
      const response = await api.get<TrackerData>(`/tracker/${monthId}`);
      setTrackerData(response.data);
    } catch (err: any) {
      console.error("Error fetching tracker data:", err);
      setTrackerError(err.message || "Failed to fetch tracker logs.");
    } finally {
      setTrackerLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "tracker") {
      fetchTracker();
    }
  }, [activeTab, monthId]);

  const handleMealChange = async (
    day: number,
    userId: string,
    change: number,
  ) => {
    if (!trackerData) return;

    const updatedMeals = trackerData.meals.map((item) => {
      if (item.day === day) {
        const currentCount = item.meals[userId] || 0;
        const newCount = Math.max(0, currentCount + change);
        return {
          ...item,
          meals: {
            ...item.meals,
            [userId]: newCount,
          },
        };
      }
      return item;
    });

    setTrackerData({
      ...trackerData,
      meals: updatedMeals,
    });

    try {
      const targetDay = updatedMeals.find((item) => item.day === day);
      const newCount = targetDay ? targetDay.meals[userId] : 0;
      await api.post("/tracker/meals/update", {
        monthId,
        day,
        userId,
        count: newCount,
        isOverwrite: true,
        activeUserId,
        activeUserName,
      });
      const summaryResponse = await api.get<SummaryData>(`/summary/${monthId}`);
      setSummaryData(summaryResponse.data);
    } catch (err) {
      console.error("Error updating meal count:", err);
    }
  };

  const handleBazarChange = async (
    day: number,
    userId: string,
    value: string,
  ) => {
    if (!trackerData) return;
    const numericVal = parseFloat(value) || 0;

    const updatedBazar = trackerData.bazar.map((item) => {
      if (item.day === day) {
        return {
          ...item,
          costs: {
            ...item.costs,
            [userId]: numericVal,
          },
        };
      }
      return item;
    });

    setTrackerData({
      ...trackerData,
      bazar: updatedBazar,
    });

    try {
      await api.post("/tracker/bazar/update", {
        monthId,
        day,
        userId,
        amount: numericVal,
        isOverwrite: true,
        activeUserId,
        activeUserName,
      });
      const summaryResponse = await api.get<SummaryData>(`/summary/${monthId}`);
      setSummaryData(summaryResponse.data);
    } catch (err) {
      console.error("Error updating bazar cost:", err);
    }
  };

  const handleBazarAssignmentChange = async (day: number, userId: string) => {
    if (!trackerData) return;
    const targetUserId = userId === "" ? null : userId;

    const updatedBazar = trackerData.bazar.map((item) => {
      if (item.day === day) {
        return {
          ...item,
          assignedUser: targetUserId,
        };
      }
      return item;
    });

    setTrackerData({
      ...trackerData,
      bazar: updatedBazar,
    });

    try {
      await api.post("/tracker/bazar/assign", {
        monthId,
        day,
        userId: targetUserId,
        activeUserId,
        activeUserName,
      });
      const summaryResponse = await api.get<SummaryData>(`/summary/${monthId}`);
      setSummaryData(summaryResponse.data);
    } catch (err) {
      console.error("Error updating bazar assignment:", err);
    }
  };

  const handleDaysConfigChange = async (days: number) => {
    if (!trackerData) return;
    try {
      await api.post("/tracker/config", {
        monthId,
        days,
      });
      fetchTracker();
      const summaryResponse = await api.get<SummaryData>(`/summary/${monthId}`);
      setSummaryData(summaryResponse.data);
      showAlert("Success", "Month days configured successfully!");
    } catch (err) {
      console.error("Error updating days configuration:", err);
    }
  };

  const fetchSummary = async () => {
    if (!token || !currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<SummaryData>(`/summary/${monthId}`);
      setSummaryData(response.data);
    } catch (err: any) {
      console.error("Error fetching summary data:", err);
      // For brand new homes with no data yet, show empty state instead of error
      if (err.response?.status === 404) {
        setSummaryData(null);
      } else {
        setError(
          err.message || "Failed to fetch summary data from the server.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch summary calculations, home details, and available months
  useEffect(() => {
    if (token && currentUser && currentUser.homeId) {
      fetchSummary();
      fetchHomeDetails();
      fetchMonths();
    }
  }, [monthId, token, currentUser]);



  // Device Usage Tracking Functions
  const fetchConsentStatus = async () => {
    try {
      const response = await api.get("/device-consent/me");
      setConsentStatus({
        isActive: response.data.isActive,
        consentedAt: response.data.consent?.consentedAt || null,
      });
    } catch (err) {
      console.error("Error fetching consent status:", err);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen w-screen bg-[#F6F8F5] flex flex-col items-center justify-center text-[#1B281E]">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#2D6A4F] mx-auto" />
          <p className="text-xs font-semibold tracking-wider uppercase text-[#5A6F5E]">
            Loading LifeOS...
          </p>
        </div>
      </div>
    );
  }

  if (!token || !currentUser) {
    return (
      <Auth
        onAuthSuccess={(t, u) => {
          setToken(t);
          setCurrentUser(u);
        }}
      />
    );
  }

  if (!currentUser.homeId) {
    return (
      <HomeOnboarding
        user={currentUser}
        onHomeCreated={(hId) => {
          // Reset stale state from any previous home session
          setHomeData(null);
          setHomeName("Sweet Home");
          setSummaryData(null);
          setTrackerData(null);
          setBillConfig(null);
          setTourStarted(false);
          setActiveTab("dashboard");
          setTrackerSubTab("meals");
          setError(null);
          setLoading(false);
          setCurrentUser((prev) =>
            prev
              ? { ...prev, homeId: hId, role: "admin", hasCompletedTour: false }
              : prev,
          );
          launchTour(true, 600);
          // Re-fetch user from server to get fresh homeId + hasCompletedTour
          fetchCurrentUser();
        }}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#F6F8F5] text-slate-900 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 shadow-xs z-20">
        <div>
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-slate-200 gap-3 bg-white">
            <div className="bg-emerald-500 p-2.5 rounded-xl text-white shadow-md shadow-emerald-500/20">
              <Home size={20} />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none tracking-wide text-slate-900 font-serif">
                LifeOS
              </h1>
              <span className="text-[10px] text-emerald-600 font-extrabold tracking-wider uppercase">
                Welcome Home
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav id="sidebar-nav" className="p-4 space-y-1">
            <button
              id="sidebar-tab-dashboard"
              onClick={() => setActiveTab("dashboard")}
              className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-emerald-50 text-emerald-700 font-bold border-l-4 border-emerald-500 shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Home size={18} className={activeTab === "dashboard" ? "text-emerald-600" : "text-slate-400"} />
              <span>Welcome Home</span>
            </button>
            <button
              id="sidebar-tab-tracker"
              onClick={() => setActiveTab("tracker")}
              className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === "tracker"
                  ? "bg-emerald-50 text-emerald-700 font-bold border-l-4 border-emerald-500 shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Utensils size={18} className={activeTab === "tracker" ? "text-emerald-600" : "text-slate-400"} />
              <span>Kitchen & Meals</span>
              {tourStarted && tourPointerTab === "tracker" && (
                <span className="pointer-events-none absolute -right-1 top-1/2 -translate-y-1/2 text-slate-400 drop-shadow animate-bounce">
                  <MousePointer2 size={18} />
                </span>
              )}
            </button>
            <button
              id="sidebar-tab-chat"
              onClick={() => setActiveTab("chat")}
              className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === "chat"
                  ? "bg-emerald-50 text-emerald-700 font-bold border-l-4 border-emerald-500 shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <MessageSquare size={18} className={activeTab === "chat" ? "text-emerald-600" : "text-slate-400"} />
              <span>House Chat</span>
              {tourStarted && tourPointerTab === "chat" && (
                <span className="pointer-events-none absolute -right-1 top-1/2 -translate-y-1/2 text-slate-400 drop-shadow animate-bounce">
                  <MousePointer2 size={18} />
                </span>
              )}
            </button>
            <button
              id="sidebar-tab-hardware"
              onClick={() => setActiveTab("hardware")}
              className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === "hardware"
                  ? "bg-emerald-50 text-emerald-700 font-bold border-l-4 border-emerald-500 shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Laptop size={18} className={activeTab === "hardware" ? "text-emerald-600" : "text-slate-400"} />
              <span>Device Desk</span>
              {tourStarted && tourPointerTab === "hardware" && (
                <span className="pointer-events-none absolute -right-1 top-1/2 -translate-y-1/2 text-slate-400 drop-shadow animate-bounce">
                  <MousePointer2 size={18} />
                </span>
              )}
            </button>
            <button
              id="sidebar-tab-notepad"
              onClick={() => setActiveTab("notepad")}
              className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === "notepad"
                  ? "bg-emerald-50 text-emerald-700 font-bold border-l-4 border-emerald-500 shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <StickyNote size={18} className={activeTab === "notepad" ? "text-emerald-600" : "text-slate-400"} />
              <span>House Notes</span>
              {tourStarted && tourPointerTab === "notepad" && (
                <span className="pointer-events-none absolute -right-1 top-1/2 -translate-y-1/2 text-slate-400 drop-shadow animate-bounce">
                  <MousePointer2 size={18} />
                </span>
              )}
            </button>
            <button
              id="sidebar-tab-history"
              onClick={() => setActiveTab("history")}
              className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === "history"
                  ? "bg-emerald-50 text-emerald-700 font-bold border-l-4 border-emerald-500 shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <History size={18} className={activeTab === "history" ? "text-emerald-600" : "text-slate-400"} />
              <span>Change History</span>
              {tourStarted && tourPointerTab === "history" && (
                <span className="pointer-events-none absolute -right-1 top-1/2 -translate-y-1/2 text-slate-400 drop-shadow animate-bounce">
                  <MousePointer2 size={18} />
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setEditHomeName(homeName || "");
                setEditHomeCurrency(homeData?.currency || "৳");
                setIsHomeSettingsOpen(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200 cursor-pointer"
            >
              <Sliders size={18} className="text-slate-400" />
              <span>Home Settings</span>
            </button>
          </nav>
        </div>

        {/* Current Session User / Roommate Invites */}
        <div className="p-4 border-t border-slate-200 space-y-4 bg-white">
          {/* User profile */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center font-serif font-black text-white text-sm shadow-sm shrink-0">
                {currentUser?.name
                  ? currentUser.name.substring(0, 2).toUpperCase()
                  : "??"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                  Logged In As
                </p>
                <p className="text-xs font-bold text-slate-800 truncate mt-1">
                  {currentUser?.name}
                </p>
                <p className="text-[9px] text-emerald-600 font-medium mt-0.5 font-mono">
                  @{currentUser?.nickname}
                </p>
              </div>
              <button
                onClick={handleLogout}
                title="Logout"
                className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-rose-500 transition-all cursor-pointer border-none bg-transparent"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>

          {/* Admin invite roomies */}
          {currentUser?.role === "admin" && (
            <form
              onSubmit={handleInviteRoommate}
              className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl"
            >
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                Invite Roommate
              </p>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Nickname"
                  value={inviteNickname}
                  onChange={(e) => setInviteNickname(e.target.value)}
                  className="bg-white border border-slate-200 focus:border-emerald-500 rounded-lg px-2 py-1 text-[11px] text-slate-800 focus:outline-none w-full font-sans font-bold shadow-xs"
                  required
                />
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-[10px] px-2.5 rounded-lg transition-all cursor-pointer shrink-0 border-0"
                >
                  {inviteLoading ? "..." : "Invite"}
                </button>
              </div>
            </form>
          )}

          {/* Roommates & Bill Config Permission Control */}
          {homeData?.members && homeData.members.length > 1 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 mt-2">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                Roommate Bill Permissions
              </p>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                {homeData.members.map((member: any) => {
                  if (member._id === homeData.admin) return null; // Hide owner from toggle list
                  const hasControl = (
                    homeData.utilityControlMembers || []
                  ).includes(member._id);
                  const canToggle = homeData.admin === currentUser?._id;
                  return (
                    <div
                      key={member._id}
                      className="flex justify-between items-center gap-2 text-[11px] py-1.5 border-b border-slate-200/60 last:border-b-0"
                    >
                      <span className="text-slate-700 font-medium truncate font-sans">
                        @{member.nickname}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-bold tracking-wider uppercase transition-colors duration-200 ${hasControl ? "text-emerald-600" : "text-slate-400"}`}
                        >
                          {hasControl ? "Full Control" : "Read Only"}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={hasControl}
                          disabled={!canToggle}
                          onClick={() =>
                            handleTogglePermission(member._id, hasControl)
                          }
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none items-center border-0 ${
                            hasControl ? "bg-emerald-500" : "bg-slate-300"
                          } ${!canToggle ? "opacity-40 cursor-not-allowed" : "hover:opacity-90"}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out shadow-sm ${
                              hasControl
                                ? "translate-x-[18px]"
                                : "translate-x-[2px]"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#F6F8F5]">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white/90 backdrop-blur-md shrink-0 shadow-xs">
          {["notepad", "history"].includes(activeTab) ? (
            <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200 w-80 animate-fade-in">
              <Search size={16} className="text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab === "notepad" ? "notes" : "history logs"}...`}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="bg-transparent border-none text-xs text-slate-800 focus:outline-none w-full font-medium placeholder-slate-400"
              />
            </div>
          ) : (
            <div className="w-80" />
          )}

          <div id="top-bar-controls" className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2 text-slate-700">
              <Home size={16} className="text-emerald-600" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {homeName}
              </span>
              <button
                onClick={() => {
                  setEditHomeName(homeName || "");
                  setEditHomeCurrency(homeData?.currency || "৳");
                  setIsHomeSettingsOpen(true);
                }}
                className="ml-1 bg-white hover:bg-slate-50 text-slate-700 hover:text-emerald-600 border border-slate-200 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Household Settings, Roommates & Credentials"
              >
                <Sliders size={13} className="text-emerald-600" />
                <span>Home Settings</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-slate-700">
              <Calendar size={16} className="text-emerald-600" />
              <select
                value={monthId}
                onChange={(e) => setMonthId(e.target.value)}
                disabled={activeTab === "hardware"}
                className="bg-white text-xs font-bold text-slate-800 focus:outline-none border border-slate-200 rounded-lg px-2.5 py-1 uppercase tracking-wider cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {availableMonths.map((m) => {
                  const parts = m.split("-");
                  const displayName =
                    parts.length === 2 ? `${parts[0]} ${parts[1]}` : m;
                  return (
                    <option key={m} value={m}>
                      {displayName}
                    </option>
                  );
                })}
              </select>
            </div>

            {activeTab !== "hardware" && (
              <>
                <button
                  onClick={() => {
                    setNewMonthPrevMonthId(monthId);
                    setIsNewMonthModalOpen(true);
                  }}
                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white px-3 py-1.5 rounded-lg shadow-md shadow-emerald-500/20 transition-all cursor-pointer animate-fade-in border-0"
                  title="Create a new month with carried forward dues"
                >
                  <Plus size={14} />
                  <span>New Month</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowQuickCalc(!showQuickCalc)}
                  className={`flex items-center gap-1.5 border text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer ${
                    showQuickCalc
                      ? "bg-emerald-500 text-white border-emerald-500 font-extrabold shadow-sm"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-emerald-600"
                  }`}
                  title="Open Quick Bazar Calculator"
                >
                  <Calculator size={14} className={showQuickCalc ? "text-white" : "text-emerald-600"} />
                  <span>Calculator</span>
                </button>

                <button
                  onClick={openConfigModal}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white px-3 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer border-0"
                >
                  <Sliders size={14} />
                  <span>Configure Bills</span>
                </button>
              </>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
                title="Notifications"
              >
                <Bell size={16} />
                {notifications.filter((n) => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center animate-bounce">
                    {notifications.filter((n) => !n.read).length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 space-y-3 text-left">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900">
                      Notifications
                    </span>
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setNotifications((prev) =>
                            prev.map((n) => ({ ...n, read: true })),
                          );
                        }}
                        className="text-[10px] text-emerald-600 hover:text-emerald-700 transition-colors font-bold cursor-pointer bg-transparent border-0"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic py-2 text-center">
                        No notifications yet.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            setNotifications((prev) =>
                              prev.map((item) =>
                                item.id === n.id
                                  ? { ...item, read: true }
                                  : item,
                              ),
                            );
                          }}
                          className={`p-2.5 rounded-xl border text-[11px] cursor-pointer transition-all ${
                            n.read
                              ? "bg-slate-50 border-slate-100 text-slate-400"
                              : "bg-emerald-50/60 border-emerald-200 text-slate-800 font-medium hover:bg-emerald-50"
                          }`}
                        >
                          <p>{n.text}</p>
                          <span className="text-[9px] text-slate-400 mt-1 block">
                            {new Date(n.time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Container */}
        <div className="p-8 space-y-8 flex-1">
          {/* House Chat View */}
          {activeTab === "chat" && (
            <HouseChat currentUser={currentUser} />
          )}

          {/* Hardware & Telemetry View - Locked Behind LifeOS Pro Subscription */}
          {activeTab === "hardware" && (
            <div id="device-desk-container" className="space-y-6 animate-fade-in">
              {/* Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-white tracking-tight font-serif">
                      Device Desk
                    </h2>
                    <span className="bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Lock size={11} /> PRO FEATURE
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm">
                    Track application usage, CPU/RAM telemetry, and device activity across your household.
                  </p>
                </div>
              </div>

              {/* Locked Pro Paywall Card */}
              <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-8 md:p-12 text-center space-y-6 relative overflow-hidden shadow-2xl max-w-3xl mx-auto my-6">
                {/* Ambient Light */}
                <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

                {/* Pro Lock Badge */}
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/10">
                  <Lock size={32} />
                </div>

                <div className="space-y-3 max-w-md mx-auto">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                    <Sparkles size={12} className="text-amber-400" /> Pro Subscription Required
                  </span>
                  <h3 className="text-2xl md:text-3xl font-serif font-black text-white tracking-tight">
                    Device Desk is Locked
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Real-time PC telemetry, GPU application breakdown, and multi-device activity tracking require an active <strong className="text-white">LifeOS Pro</strong> subscription.
                  </p>
                </div>

                {/* Pro Features Included List */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 text-left max-w-lg mx-auto space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Crown size={14} className="text-amber-400" /> Included in LifeOS Pro:
                  </h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-400 shrink-0" /> Real-time CPU & RAM Telemetry
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-400 shrink-0" /> GPU App Usage Categorization
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-400 shrink-0" /> Unlimited Household Devices
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-400 shrink-0" /> Automated PC Tracker & Sync
                    </li>
                  </ul>
                </div>

                {/* CTA Button */}
                <div className="pt-2">
                  <button
                    onClick={() => setShowProModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-8 py-3.5 rounded-2xl shadow-xl shadow-indigo-600/25 transition-all cursor-pointer inline-flex items-center gap-2 transform hover:scale-102"
                  >
                    <Sparkles size={16} />
                    <span>Upgrade to LifeOS Pro →</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Daily Tracker View */}
          {activeTab === "tracker" && (
            <div className="space-y-6">
              {/* Header section */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight font-serif">
                    Kitchen & Meals
                  </h2>
                  <p className="text-slate-500 text-sm">
                    Log daily roommate meal counts and shared grocery expenses.
                  </p>
                </div>

                <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                    Days in Month:
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={trackerData?.daysInMonth || 30}
                    onChange={(e) =>
                      handleDaysConfigChange(parseInt(e.target.value) || 30)
                    }
                    className="bg-slate-50 text-slate-900 text-xs font-bold w-16 text-center border border-slate-200 rounded-xl py-1 px-1.5 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Sub-tabs toggles */}
              <div
                id="meals-tabs-container"
                className="flex gap-4 border-b border-slate-200 pb-px"
              >
                <button
                  onClick={() => setTrackerSubTab("meals")}
                  className={`pb-3 font-semibold text-sm transition-all relative cursor-pointer border-0 bg-transparent ${
                    trackerSubTab === "meals"
                      ? "text-emerald-700 border-b-2 border-emerald-500 font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Meals Eaten
                </button>
                <button
                  onClick={() => setTrackerSubTab("bazar")}
                  className={`pb-3 font-semibold text-sm transition-all relative cursor-pointer border-0 bg-transparent ${
                    trackerSubTab === "bazar"
                      ? "text-rose-600 border-b-2 border-rose-500 font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Grocery Bills
                </button>
                <button
                  onClick={() => setTrackerSubTab("deposits")}
                  className={`pb-3 font-semibold text-sm transition-all relative cursor-pointer border-0 bg-transparent ${
                    trackerSubTab === "deposits"
                      ? "text-emerald-700 border-b-2 border-emerald-500 font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Meal Deposits
                </button>
                <button
                  onClick={() => setTrackerSubTab("wallet")}
                  className={`pb-3 font-semibold text-sm transition-all relative cursor-pointer border-0 bg-transparent ${
                    trackerSubTab === "wallet"
                      ? "text-slate-900 border-b-2 border-slate-900 font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Grocery Wallet
                </button>
              </div>

              {trackerLoading ? (
                <div className="flex flex-col items-center justify-center h-96 gap-4">
                  <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
                  <p className="text-slate-500 text-sm font-medium">
                    Opening the kitchen cabinets...
                  </p>
                </div>
              ) : trackerError ? (
                <div className="flex flex-col items-center justify-center h-96 gap-4 bg-white border border-slate-200 rounded-3xl p-8 shadow-xs">
                  <span className="text-4xl">🍳</span>
                  <h3 className="text-lg font-bold text-slate-900 font-serif">
                    Kitchen Snag
                  </h3>
                  <p className="text-slate-500 text-sm text-center max-w-md">
                    We couldn't open the kitchen ledger. Let's try checking the
                    cupboards again.
                  </p>
                </div>
              ) : trackerData ? (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-200/50 space-y-6 hover:shadow-2xl hover:translate-y-[2px] transition-all">
                  {trackerSubTab === "meals" ? (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="font-bold text-base text-slate-900 font-serif">
                            Daily Meals Consumed
                          </h3>
                          <p className="text-xs text-slate-500">
                            Click (+) or (-) to update daily meals.
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                            Total Combined Meals
                          </span>
                          <span className="text-xl font-black text-emerald-600">
                            {trackerData.meals
                              .reduce(
                                (acc, item) =>
                                  acc +
                                  Object.values(item.meals).reduce(
                                    (s, c) => s + c,
                                    0,
                                  ),
                                0,
                              )
                              .toFixed(1)}
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-[500px] shadow-xs">
                        <table className="w-full text-left border-collapse min-w-[600px] sticky-header">
                          <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr className="border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                              <th className="py-3 px-4 w-24 text-center">
                                Day
                              </th>
                              {trackerData.users.map((u) => (
                                <th
                                  key={u._id}
                                  className="py-3 px-4 text-center"
                                >
                                  {u.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {trackerData.meals.map((item) => (
                              <tr
                                key={item.day}
                                className="hover:bg-slate-50 text-slate-800 text-xs border-b border-slate-100"
                              >
                                <td className="py-2.5 px-4 font-bold text-slate-500 text-center bg-slate-50/50">
                                  Day {item.day}
                                </td>
                                {trackerData.users.map((u) => {
                                  const count = item.meals[u._id] || 0;
                                  return (
                                    <td
                                      key={u._id}
                                      className="py-2.5 px-4 text-center"
                                    >
                                      <div className="flex items-center justify-center gap-2">
                                        <button
                                          onClick={() =>
                                            handleMealChange(
                                              item.day,
                                              u._id,
                                              -0.5,
                                            )
                                          }
                                          className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center transition-all border-0 cursor-pointer"
                                        >
                                          -
                                        </button>
                                        <span
                                          className={`w-8 font-bold text-center ${count > 0 ? "text-emerald-600 font-black" : "text-slate-400"}`}
                                        >
                                          {count}
                                        </span>
                                        <button
                                          onClick={() =>
                                            handleMealChange(
                                              item.day,
                                              u._id,
                                              0.5,
                                            )
                                          }
                                          className="w-6 h-6 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center transition-all border border-emerald-200 cursor-pointer"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                            {/* Totals row */}
                            <tr className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800 text-xs">
                              <td className="py-3 px-4 text-center uppercase tracking-wider">
                                Total
                              </td>
                              {trackerData.users.map((u) => {
                                const sum = trackerData.meals.reduce(
                                  (acc, item) => acc + (item.meals[u._id] || 0),
                                  0,
                                );
                                return (
                                  <td
                                    key={u._id}
                                    className="py-3 px-4 text-center text-emerald-600 font-extrabold text-sm"
                                  >
                                    {sum.toFixed(1)}
                                  </td>
                                );
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : trackerSubTab === "bazar" ? (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="font-bold text-base text-slate-900 font-serif">
                            Daily Bazar Expenses
                          </h3>
                          <p className="text-xs text-slate-500">
                            Enter amounts spent on bazar for each roommate.
                            Updates auto-save on blur.
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                            Total Combined Bazar Cost
                          </span>
                          <span className="text-xl font-black text-rose-500">
                            ৳
                            {trackerData.bazar
                              .reduce(
                                (acc, item) =>
                                  acc +
                                  Object.values(item.costs).reduce(
                                    (s, c) => s + c,
                                    0,
                                  ),
                                0,
                              )
                              .toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-[500px] shadow-xs">
                        <table className="w-full text-left border-collapse min-w-[600px] sticky-header">
                          <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr className="border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                              <th className="py-3 px-4 w-24 text-center">
                                Day
                              </th>
                              <th className="py-3 px-4 text-center w-48">
                                Assigned Roommate
                              </th>
                              {trackerData.users.map((u) => (
                                <th
                                  key={u._id}
                                  className="py-3 px-4 text-center"
                                >
                                  {u.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {trackerData.bazar.map((item) => (
                              <tr
                                key={item.day}
                                className="hover:bg-slate-50 text-slate-800 text-xs border-b border-slate-100"
                              >
                                <td className="py-2 px-4 font-bold text-slate-500 text-center bg-slate-50/50">
                                  Day {item.day}
                                </td>
                                <td className="py-2 px-4 text-center">
                                  <select
                                    value={item.assignedUser || ""}
                                    onChange={(e) =>
                                      handleBazarAssignmentChange(
                                        item.day,
                                        e.target.value,
                                      )
                                    }
                                    className="bg-white border border-slate-200 text-xs text-slate-800 rounded-xl px-2.5 py-1 w-full focus:outline-none focus:border-emerald-500 font-semibold cursor-pointer shadow-xs"
                                  >
                                    <option value="">-- Unassigned --</option>
                                    {trackerData.users.map((u) => (
                                      <option key={u._id} value={u._id}>
                                        {u.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                {trackerData.users.map((u) => {
                                  const costVal = item.costs[u._id] || 0;
                                  const isCommentOpen =
                                    activeCommentCell?.type === "bazar" &&
                                    activeCommentCell?.day === item.day &&
                                    activeCommentCell?.userId === u._id;
                                  const hasNote = !!item.notes?.[u._id];
                                  return (
                                    <td
                                      key={u._id}
                                      className="py-2 px-4 text-center relative"
                                    >
                                      <div className="flex items-center justify-center gap-1">
                                        <div className="flex items-center justify-center w-24">
                                          <span className="text-slate-400 mr-0.5 text-[10px] font-bold">
                                            ৳
                                          </span>
                                          <SmartMathInput
                                            id={`bazar-input-${item.day}-${u._id}`}
                                            value={costVal}
                                            onChange={(val) =>
                                              handleBazarChange(
                                                item.day,
                                                u._id,
                                                val,
                                              )
                                            }
                                            placeholder="0"
                                            className="bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-1 w-full text-center focus:outline-none focus:border-emerald-500 font-bold transition-all text-xs text-slate-900 shadow-xs"
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (isCommentOpen) {
                                              setActiveCommentCell(null);
                                            } else {
                                              setActiveCommentCell({
                                                type: "bazar",
                                                day: item.day,
                                                userId: u._id,
                                              });
                                              setActiveCommentText(
                                                item.notes?.[u._id] || "",
                                              );
                                            }
                                          }}
                                          className={`p-1 rounded-lg transition-all cursor-pointer border-0 ${
                                            hasNote
                                              ? "text-rose-500 bg-rose-50 border border-rose-100"
                                              : "text-slate-400 hover:text-slate-700 bg-transparent hover:bg-slate-100"
                                          }`}
                                          title={
                                            item.notes?.[u._id] || "Add note"
                                          }
                                        >
                                          <MessageSquare size={12} />
                                        </button>
                                      </div>

                                      {isCommentOpen && (
                                        <div className="absolute left-1/2 -translate-x-1/2 mt-2 bg-white border border-slate-200 rounded-2xl p-3 shadow-xl z-20 w-48 text-left space-y-2">
                                          <label className="text-[9px] uppercase font-bold text-slate-500 block">
                                            Bazar Note
                                          </label>
                                          <textarea
                                            value={activeCommentText}
                                            onChange={(e) =>
                                              setActiveCommentText(
                                                e.target.value,
                                              )
                                            }
                                            placeholder="Item details..."
                                            rows={2}
                                            className="bg-slate-50 border border-slate-200 rounded-xl p-1.5 w-full text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-sans"
                                          />
                                          <div className="flex justify-end gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setActiveCommentCell(null)
                                              }
                                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-[10px] rounded-lg font-semibold text-slate-600 border-0 cursor-pointer"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                try {
                                                  const inputEl =
                                                    document.getElementById(
                                                      `bazar-input-${item.day}-${u._id}`,
                                                    ) as HTMLInputElement;
                                                  const currentAmount = inputEl
                                                    ? parseFloat(
                                                        inputEl.value,
                                                      ) || 0
                                                    : costVal;
                                                  if (currentAmount <= 0) {
                                                    showAlert(
                                                      "Amount Required",
                                                      "Please enter an expense amount before saving a note.",
                                                    );
                                                    return;
                                                  }
                                                  await api.post(
                                                    "/tracker/bazar/update",
                                                    {
                                                      monthId,
                                                      day: item.day,
                                                      userId: u._id,
                                                      amount: currentAmount,
                                                      note: activeCommentText,
                                                      activeUserId,
                                                      activeUserName,
                                                    },
                                                  );
                                                  fetchTracker();
                                                  setActiveCommentCell(null);
                                                  showAlert(
                                                    "Success",
                                                    "Bazar cost and note saved successfully!",
                                                  );
                                                } catch (err) {
                                                  console.error(
                                                    "Error saving bazar note:",
                                                    err,
                                                  );
                                                }
                                              }}
                                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-[10px] rounded-lg font-bold text-white border-0 cursor-pointer shadow-xs"
                                            >
                                              Save
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                            {/* Totals row */}
                            <tr className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800 text-xs">
                              <td className="py-3 px-4 text-center uppercase tracking-wider">
                                Total
                              </td>
                              <td className="py-3 px-4 text-center text-slate-400 font-medium italic">
                                --
                              </td>
                              {trackerData.users.map((u) => {
                                const sum = trackerData.bazar.reduce(
                                  (acc, item) => acc + (item.costs[u._id] || 0),
                                  0,
                                );
                                return (
                                  <td
                                    key={u._id}
                                    className="py-3 px-4 text-center text-rose-500 font-extrabold text-sm"
                                  >
                                    ৳{sum.toFixed(2)}
                                  </td>
                                );
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : trackerSubTab === "deposits" ? (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="font-bold text-base text-slate-900 font-serif">
                            Daily Meal Deposits (Given for Meal)
                          </h3>
                          <p className="text-xs text-slate-500">
                            Enter deposits made by each roommate for meals.
                            Updates auto-save on blur.
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                            Total Combined Deposits
                          </span>
                          <span className="text-xl font-black text-emerald-600">
                            ৳
                            {trackerData.deposits
                              .reduce(
                                (acc, item) =>
                                  acc +
                                  Object.values(item.amounts).reduce(
                                    (s, c) => s + c,
                                    0,
                                  ),
                                0,
                              )
                              .toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-[500px] shadow-xs">
                        <table className="w-full text-left border-collapse min-w-[600px] sticky-header">
                          <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr className="border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                              <th className="py-3 px-4 w-24 text-center">
                                Day
                              </th>
                              {trackerData.users.map((u) => (
                                <th
                                  key={u._id}
                                  className="py-3 px-4 text-center"
                                >
                                  {u.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {trackerData.deposits.map((item) => (
                              <tr
                                key={item.day}
                                className="hover:bg-slate-50 text-slate-800 text-xs border-b border-slate-100"
                              >
                                <td className="py-2 px-4 font-bold text-slate-500 text-center bg-slate-50/50">
                                  Day {item.day}
                                </td>
                                {trackerData.users.map((u) => {
                                  const depVal = item.amounts[u._id] || 0;
                                  const isCommentOpen =
                                    activeCommentCell?.type === "deposit" &&
                                    activeCommentCell?.day === item.day &&
                                    activeCommentCell?.userId === u._id;
                                  const hasNote = !!item.notes?.[u._id];
                                  return (
                                    <td
                                      key={u._id}
                                      className="py-2 px-4 text-center relative"
                                    >
                                      <div className="flex items-center justify-center gap-1">
                                        <div className="flex items-center justify-center w-24">
                                          <span className="text-slate-400 mr-0.5 text-[10px] font-bold">
                                            ৳
                                          </span>
                                          <SmartMathInput
                                            id={`deposit-input-${item.day}-${u._id}`}
                                            value={depVal}
                                            onChange={(val) =>
                                              handleDepositChange(
                                                item.day,
                                                u._id,
                                                val,
                                              )
                                            }
                                            placeholder="0"
                                            className="bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-1 w-full text-center focus:outline-none focus:border-emerald-500 font-bold transition-all text-xs text-slate-900 shadow-xs"
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (isCommentOpen) {
                                              setActiveCommentCell(null);
                                            } else {
                                              setActiveCommentCell({
                                                type: "deposit",
                                                day: item.day,
                                                userId: u._id,
                                              });
                                              setActiveCommentText(
                                                item.notes?.[u._id] || "",
                                              );
                                            }
                                          }}
                                          className={`p-1 rounded-lg transition-all cursor-pointer border-0 ${
                                            hasNote
                                              ? "text-emerald-600 bg-emerald-50 border border-emerald-100"
                                              : "text-slate-400 hover:text-slate-700 bg-transparent hover:bg-slate-100"
                                          }`}
                                          title={
                                            item.notes?.[u._id] || "Add note"
                                          }
                                        >
                                          <MessageSquare size={12} />
                                        </button>
                                      </div>

                                      {isCommentOpen && (
                                        <div className="absolute left-1/2 -translate-x-1/2 mt-2 bg-white border border-slate-200 rounded-2xl p-3 shadow-xl z-20 w-48 text-left space-y-2">
                                          <label className="text-[9px] uppercase font-bold text-slate-500 block">
                                            Deposit Note
                                          </label>
                                          <textarea
                                            value={activeCommentText}
                                            onChange={(e) =>
                                              setActiveCommentText(
                                                e.target.value,
                                              )
                                            }
                                            placeholder="Deposit details..."
                                            rows={2}
                                            className="bg-slate-50 border border-slate-200 rounded-xl p-1.5 w-full text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-sans"
                                          />
                                          <div className="flex justify-end gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setActiveCommentCell(null)
                                              }
                                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-[10px] rounded-lg font-semibold text-slate-600 border-0 cursor-pointer"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                try {
                                                  const inputEl =
                                                    document.getElementById(
                                                      `deposit-input-${item.day}-${u._id}`,
                                                    ) as HTMLInputElement;
                                                  const currentAmount = inputEl
                                                    ? parseFloat(
                                                        inputEl.value,
                                                      ) || 0
                                                    : depVal;
                                                  if (currentAmount <= 0) {
                                                    showAlert(
                                                      "Amount Required",
                                                      "Please enter a deposit amount before saving a note.",
                                                    );
                                                    return;
                                                  }
                                                  await api.post(
                                                    "/tracker/deposits/update",
                                                    {
                                                      monthId,
                                                      day: item.day,
                                                      userId: u._id,
                                                      amount: currentAmount,
                                                      note: activeCommentText,
                                                      activeUserId,
                                                      activeUserName,
                                                    },
                                                  );
                                                  fetchTracker();
                                                  setActiveCommentCell(null);
                                                  showAlert(
                                                    "Success",
                                                    "Deposit and note saved successfully!",
                                                  );
                                                } catch (err) {
                                                  console.error(
                                                    "Error saving deposit note:",
                                                    err,
                                                  );
                                                }
                                              }}
                                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-[10px] rounded-lg font-bold text-white border-0 cursor-pointer shadow-xs"
                                            >
                                              Save
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                            {/* Totals row */}
                            <tr className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800 text-xs">
                              <td className="py-3 px-4 text-center uppercase tracking-wider">
                                Total
                              </td>
                              {trackerData.users.map((u) => {
                                const sum = trackerData.deposits.reduce(
                                  (acc, item) =>
                                    acc + (item.amounts[u._id] || 0),
                                  0,
                                );
                                return (
                                  <td
                                    key={u._id}
                                    className="py-3 px-4 text-center text-emerald-600 font-extrabold text-sm"
                                  >
                                    ৳{sum.toFixed(2)}
                                  </td>
                                );
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {/* Total Remaining Cash & Stats Panel */}
                      {walletData &&
                        (() => {
                          const totalHouseDeposits =
                            walletData.userSummaries.reduce(
                              (sum, u) => sum + (u.deposits || 0),
                              0,
                            );
                          const totalHouseSpent =
                            walletData.userSummaries.reduce(
                              (sum, u) => sum + u.spent,
                              0,
                            );
                          const totalHouseRemaining =
                            totalHouseDeposits - totalHouseSpent;
                          return (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 relative overflow-hidden shadow-xs">
                                <span className="text-xs font-semibold text-slate-500 uppercase">
                                  Total House Deposits
                                </span>
                                <h3 className="text-2xl font-black mt-2 text-emerald-600 font-serif">
                                  ৳{totalHouseDeposits.toFixed(2)}
                                </h3>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Total cash collected from everyone
                                </p>
                              </div>
                              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 relative overflow-hidden shadow-xs">
                                <span className="text-xs font-semibold text-slate-500 uppercase">
                                  Total Spent on Bazar
                                </span>
                                <h3 className="text-2xl font-black mt-2 text-rose-500 font-serif">
                                  ৳{totalHouseSpent.toFixed(2)}
                                </h3>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Total cost of grocery items purchased
                                </p>
                              </div>
                              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 relative overflow-hidden shadow-xs">
                                <span className="text-xs font-semibold text-slate-500 uppercase">
                                  Total Remaining Cash
                                </span>
                                <h3 className="text-2xl font-black mt-2 text-slate-900 font-serif">
                                  ৳{totalHouseRemaining.toFixed(2)}
                                </h3>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Cash in hand available for upcoming trips
                                </p>
                              </div>
                            </div>
                          );
                        })()}

                      {/* Grid Layout: Record Transfer Form on Left/Top, Summary on Right/Top */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Form */}
                        <div className="bg-slate-50 p-6 border border-slate-200 rounded-2xl space-y-4">
                          <h3 className="font-bold text-base text-slate-900 font-serif">
                            Record Cash Transfer
                          </h3>
                          <p className="text-xs text-slate-500">
                            Log when a roommate takes cash from another to fund
                            a bazar trip.
                          </p>
                          <form
                            id="cash-transfer-form"
                            onSubmit={handleAddTransfer}
                            className="space-y-4"
                          >
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                                Taken From (Giver)
                              </label>
                              <select
                                value={walletFrom}
                                onChange={(e) => setWalletFrom(e.target.value)}
                                className="bg-white border border-slate-200 text-xs text-slate-800 rounded-xl px-2.5 py-1.5 w-full focus:outline-none focus:border-emerald-500 font-semibold cursor-pointer shadow-xs"
                              >
                                <option value="">-- Select Roommate --</option>
                                {trackerData.users.map((u) => (
                                  <option key={u._id} value={u._id}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                                Given To (Taker)
                              </label>
                              <select
                                value={walletTo}
                                onChange={(e) => setWalletTo(e.target.value)}
                                className="bg-white border border-slate-200 text-xs text-slate-800 rounded-xl px-2.5 py-1.5 w-full focus:outline-none focus:border-emerald-500 font-semibold cursor-pointer shadow-xs"
                              >
                                <option value="">-- Select Roommate --</option>
                                {trackerData.users.map((u) => (
                                  <option key={u._id} value={u._id}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                                Amount (৳)
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1.5 text-xs text-slate-400 font-bold">
                                  ৳
                                </span>
                                <input
                                  type="number"
                                  placeholder="0.00"
                                  value={walletAmount}
                                  onChange={(e) =>
                                    setWalletAmount(e.target.value)
                                  }
                                  className="bg-white border border-slate-200 text-xs text-slate-800 rounded-xl pl-7 pr-3 py-1.5 w-full focus:outline-none focus:border-emerald-500 font-semibold shadow-xs"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                                Note / Context
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. For Friday Bazar"
                                value={walletNote}
                                onChange={(e) => setWalletNote(e.target.value)}
                                className="bg-white border border-slate-200 text-xs text-slate-800 rounded-xl px-3 py-1.5 w-full focus:outline-none focus:border-emerald-500 shadow-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                                Transfer Date
                              </label>
                              <input
                                type="date"
                                value={walletDate}
                                onChange={(e) => setWalletDate(e.target.value)}
                                className="bg-white border border-slate-200 text-xs text-slate-800 rounded-xl px-3 py-1.5 w-full focus:outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
                              />
                            </div>
                            <button
                              type="submit"
                              className="bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white py-2 px-4 rounded-xl w-full transition-all shadow-md shadow-emerald-600/20 cursor-pointer border-0"
                            >
                              Record Transfer
                            </button>
                          </form>
                        </div>

                        {/* Summary */}
                        <div className="lg:col-span-2 bg-slate-50 p-6 border border-slate-200 rounded-2xl space-y-4">
                          <div>
                            <h3 className="font-bold text-base text-slate-900 font-serif">
                              Wallet Summary
                            </h3>
                            <p className="text-xs text-slate-500">
                              Current cash-in-hand adjustments computed from
                              transfers & spending.
                            </p>
                          </div>
                          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-white border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                                  <th className="py-2.5 px-3">Roommate</th>
                                  <th className="py-2.5 px-3 text-right text-emerald-600">
                                    Meal Deposits
                                  </th>
                                  <th className="py-2.5 px-3 text-right text-slate-700">
                                    Received (Taker)
                                  </th>
                                  <th className="py-2.5 px-3 text-right text-slate-700">
                                    Given (Giver)
                                  </th>
                                  <th className="py-2.5 px-3 text-right text-rose-500">
                                    Bazar Spent
                                  </th>
                                  <th className="py-2.5 px-3 text-right">
                                    Cash Balance
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {walletData?.userSummaries.map((summary) => {
                                  // Cash Balance starts at deposits, adding received transfers, and deducting given transfers & spent on bazar
                                  const balance =
                                    (summary.deposits || 0) +
                                    summary.received -
                                    summary.given -
                                    summary.spent;
                                  return (
                                    <tr
                                      key={summary.userId}
                                      className="hover:bg-white text-slate-800"
                                    >
                                      <td className="py-3.5 px-3 font-semibold text-slate-900">
                                        {summary.name}
                                      </td>
                                      <td className="py-3.5 px-3 text-right font-medium text-emerald-600">
                                        ৳{(summary.deposits || 0).toFixed(2)}
                                      </td>
                                      <td className="py-3.5 px-3 text-right font-medium text-slate-700">
                                        ৳{summary.received.toFixed(2)}
                                      </td>
                                      <td className="py-3.5 px-3 text-right font-medium text-slate-700">
                                        ৳{summary.given.toFixed(2)}
                                      </td>
                                      <td className="py-3.5 px-3 text-right font-medium text-rose-500">
                                        ৳{summary.spent.toFixed(2)}
                                      </td>
                                      <td
                                        className={`py-3.5 px-3 text-right font-bold ${balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                                      >
                                        {balance >= 0
                                          ? `৳${balance.toFixed(2)} (Remaining)`
                                          : `৳${Math.abs(balance).toFixed(2)} (Owes)`}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* Recent Transfers Log */}
                      <div className="bg-slate-50 p-6 border border-slate-200 rounded-2xl space-y-4">
                        <h3 className="font-bold text-base text-slate-900 font-serif">
                          Transfer Transaction History
                        </h3>
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-white border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                                <th className="py-2.5 px-4">Date</th>
                                <th className="py-2.5 px-3">Giver (From)</th>
                                <th className="py-2.5 px-3">Taker (To)</th>
                                <th className="py-2.5 px-3 text-right">
                                  Amount
                                </th>
                                <th className="py-2.5 px-4">Note</th>
                                <th className="py-2.5 px-4 text-center">
                                  Action
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {walletData &&
                              walletData.transfers &&
                              walletData.transfers.length > 0 ? (
                                walletData.transfers.map((tx) => {
                                  const giverName =
                                    trackerData.users.find(
                                      (u) => u._id === tx.from,
                                    )?.name || "Unknown";
                                  const takerName =
                                    trackerData.users.find(
                                      (u) => u._id === tx.to,
                                    )?.name || "Unknown";
                                  return (
                                    <tr
                                      key={tx._id}
                                      className="hover:bg-white text-slate-800"
                                    >
                                      <td className="py-2.5 px-4 text-slate-500">
                                        {new Date(tx.date).toLocaleDateString()}
                                      </td>
                                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                                        {giverName}
                                      </td>
                                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                                        {takerName}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-bold text-rose-500">
                                        ৳{tx.amount.toFixed(2)}
                                      </td>
                                      <td className="py-2.5 px-4 text-slate-500 italic">
                                        {tx.note || "--"}
                                      </td>
                                      <td className="py-2.5 px-4 text-center">
                                        <button
                                          onClick={() =>
                                            handleDeleteTransfer(tx._id)
                                          }
                                          className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 transition-all cursor-pointer border-0 bg-transparent"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr>
                                  <td
                                    colSpan={6}
                                    className="py-8 text-center text-slate-400 italic font-medium"
                                  >
                                    🌱 No transfers recorded yet — enjoy the
                                    quiet!
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Roommate calculations tab details */}
          {activeTab === "dashboard" &&
            (loading ? (
              <div className="flex flex-col items-center justify-center h-96 gap-4">
                <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                <p className="text-slate-400 text-sm font-semibold">
                  Gathering our house records...
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-96 gap-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
                <span className="text-4xl">🏡</span>
                <h3 className="text-lg font-bold text-white font-serif">
                  A Cozy Snag
                </h3>
                <p className="text-slate-400 text-sm text-center max-w-md">
                  We couldn't connect to our home database. Let's try opening
                  the doors again.
                </p>
                <button
                  onClick={() => setMonthId(monthId)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold mt-2 transition-all cursor-pointer"
                >
                  Knock Again
                </button>
              </div>
            ) : (
              <>
                {/* Heading + Take a Tour button */}
                <div
                  id="dashboard-greeting"
                  className="flex items-start justify-between"
                >
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight font-serif">
                      {getGreeting()}, {currentUser?.name || "Roommate"}!
                    </h2>
                    <p className="text-slate-500 text-sm">
                      Welcome home. Here is how the household is doing today.
                    </p>
                  </div>
                  <button
                    onClick={() => launchTour(true, 200)}
                    className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 shadow-xs"
                    title="Take the guided onboarding tour"
                  >
                    <HelpCircle size={14} />
                    <span>Take a Tour</span>
                  </button>
                </div>

                {summaryData ? (
                  <>
                    {/* Stats Grid */}
                    <div
                      id="dashboard-stats"
                      className="grid grid-cols-1 sm:grid-cols-3 gap-6"
                    >
                      {/* Card 1: Groceries & Bazar */}
                      <div className="bg-white border border-slate-200 rounded-3xl p-6 relative overflow-hidden shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:translate-y-[2px] transition-all duration-200 group">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Groceries & Bazar Costs
                          </span>
                          <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                            <DollarSign size={20} />
                          </div>
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight mt-3">
                          {currencySymbol}{summaryData.totalMealCost.toFixed(2)}
                        </h3>
                        <div className="inline-flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1 rounded-xl mt-3 font-semibold">
                          <TrendingUp size={14} className="text-rose-500" />
                          <span>Shared household groceries</span>
                        </div>
                      </div>

                      {/* Card 2: Shared Meals Cooked */}
                      <div className="bg-white border border-slate-200 rounded-3xl p-6 relative overflow-hidden shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:translate-y-[2px] transition-all duration-200 group">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Shared Meals Cooked
                          </span>
                          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                            <Utensils size={20} />
                          </div>
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight mt-3">
                          {summaryData.totalMeals.toFixed(1)}
                        </h3>
                        <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-xl mt-3 font-semibold">
                          <UserCheck size={14} className="text-emerald-600" />
                          <span>Freshly cooked for roommates</span>
                        </div>
                      </div>

                      {/* Card 3: Today's Meal Rate */}
                      <div className="bg-white border border-slate-200 rounded-3xl p-6 relative overflow-hidden shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:translate-y-[2px] transition-all duration-200 group">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Today's Meal Rate
                          </span>
                          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                            <TrendingUp size={20} />
                          </div>
                        </div>
                        <h3 className="text-3xl font-black text-emerald-600 tracking-tight mt-3">
                          {currencySymbol}{summaryData.mealRate.toFixed(2)}{" "}
                          <span className="text-xs text-slate-500 font-normal">
                            / meal
                          </span>
                        </h3>
                        <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-xl mt-3 font-semibold">
                          <TrendingDown size={14} className="text-emerald-600" />
                          <span>Cost per individual serving</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Entry Widget */}
                    <QuickActionWidget
                      monthId={monthId}
                      daysInMonth={trackerData?.daysInMonth || 30}
                      users={summaryData.userStandings.map((u) => ({
                        _id: u.userId,
                        name: u.name,
                      }))}
                      currencySymbol={currencySymbol}
                      activeUserId={activeUserId}
                      activeUserName={activeUserName}
                      utilityCategories={summaryData.utilitySummary?.categories || {}}
                      utilities={summaryData.monthlyBill?.utilities || {}}
                      userStandings={summaryData.userStandings.map((u) => ({
                        userId: u.userId,
                        name: u.name,
                        utilityShare: u.utilityShare || 0,
                        prevUtilityDue: u.prevUtilityDue || 0,
                        utilityPayment: u.utilityPayment || 0,
                        utilityDue: u.utilityDue || 0,
                      }))}
                      onRefresh={fetchSummary}
                      showAlert={showAlert}
                    />

                    {/* Overview Content Grid */}
                    <div className="grid grid-cols-1 gap-8">
                      {/* ⚡ Utility Dashboard Section */}
                      <div id="utility-dashboard-section" className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-200/50 space-y-6 relative overflow-hidden hover:shadow-2xl hover:translate-y-[2px] transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                          <div>
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-bold shadow-xs">
                                <Zap size={18} />
                              </div>
                              <h3 className="font-bold text-lg text-slate-900 font-serif">
                                Utility Bills & Direct Payments
                              </h3>
                              {summaryData.utilitySummary?.isDone && (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                  <CheckCircle2 size={12} />
                                  ALL BILLS PAID
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Real-time tracking of monthly shared utility bills, collections, and direct payments to service providers.
                            </p>
                          </div>
                        </div>

                        {/* 4 Utility Metric Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {/* 1. Total Bill */}
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 shadow-xs transition-all">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                              Total Utility Bill (মোট বিল)
                            </span>
                            <h4 className="text-2xl font-black text-slate-900 mt-1.5">
                              {currencySymbol}{(summaryData.utilitySummary?.totalBill || 0).toFixed(2)}
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-1">
                              Total shared obligations this month
                            </p>
                          </div>

                          {/* 2. Collected */}
                          <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4.5 shadow-xs transition-all">
                            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                              Collected (টাকা উঠেছে)
                            </span>
                            <h4 className="text-2xl font-black text-emerald-600 mt-1.5">
                              {currencySymbol}{(summaryData.utilitySummary?.totalCollected || 0).toFixed(2)}
                            </h4>
                            <p className="text-[11px] text-emerald-700/80 mt-1">
                              Collected from roommate contributions
                            </p>
                          </div>

                          {/* 3. Paid to Providers */}
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 shadow-xs transition-all">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                              Paid (পরিশোধ হয়েছে)
                            </span>
                            <h4 className="text-2xl font-black text-slate-900 mt-1.5">
                              {currencySymbol}{(summaryData.utilitySummary?.totalPaid || 0).toFixed(2)}
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-1">
                              Directly paid to service providers
                            </p>
                          </div>

                          {/* 4. Fund in Hand / Remaining */}
                          <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4.5 shadow-xs transition-all">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                                Fund in Hand (হাতে ক্যাশ)
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                (summaryData.utilitySummary?.fundInHand || 0) > 0
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : "bg-slate-200 text-slate-600"
                              }`}>
                                Due: {currencySymbol}{(summaryData.utilitySummary?.totalRemaining || 0).toFixed(0)}
                              </span>
                            </div>
                            <h4 className="text-2xl font-black text-emerald-600 mt-1.5">
                              {currencySymbol}{(summaryData.utilitySummary?.fundInHand || 0).toFixed(2)}
                            </h4>
                            <p className="text-[11px] text-emerald-700/80 mt-1">
                              {(summaryData.utilitySummary?.totalRemaining || 0) > 0 
                                ? `${currencySymbol}${(summaryData.utilitySummary?.totalRemaining || 0).toFixed(2)} bills still to pay`
                                : "All bills cleared ✅"}
                            </p>
                          </div>
                        </div>

                        {/* Highlighted "My Share" Card for active logged-in user */}
                        {(() => {
                          const myStanding = summaryData.userStandings.find((u) => u.userId === (currentUser?._id || activeUserId));
                          if (!myStanding) return null;
                          const isMyUtilityDone = (myStanding.utilityDue || 0) <= 0;
                          return (
                            <div className="bg-slate-50 border-2 border-emerald-500/30 rounded-2xl p-5 shadow-xs transition-all">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                                      <Sparkles size={14} /> My Utility Share (আমার ব্যক্তিগত হিসাব)
                                    </span>
                                    {isMyUtilityDone ? (
                                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Check size={10} /> CLEARED
                                      </span>
                                    ) : (
                                      <span className="bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                        DUE TO PAY
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500">
                                    Personal utility responsibility for {myStanding.name} for {monthId}
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 sm:gap-6 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xs">
                                  <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                                      My Monthly Share
                                    </span>
                                    <span className="text-base font-bold text-slate-900">
                                      {currencySymbol}{myStanding.utilityShare.toFixed(2)}
                                    </span>
                                  </div>

                                  {myStanding.prevUtilityDue !== 0 && (
                                    <div className="border-l border-slate-200 pl-4">
                                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                                        Prev Due
                                      </span>
                                      <span className={`text-base font-bold ${myStanding.prevUtilityDue > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                        {myStanding.prevUtilityDue > 0 ? "+" : ""}{currencySymbol}{myStanding.prevUtilityDue.toFixed(2)}
                                      </span>
                                    </div>
                                  )}

                                  <div className="border-l border-slate-200 pl-4">
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                                      My Paid / Bills
                                    </span>
                                    <span className="text-base font-bold text-emerald-600">
                                      {currencySymbol}{myStanding.utilityPayment.toFixed(2)}
                                    </span>
                                  </div>

                                  <div className="border-l border-slate-200 pl-4">
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                                      Net Utility Due
                                    </span>
                                    <span className={`text-base font-extrabold ${myStanding.utilityDue > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                      {myStanding.utilityDue > 0 ? "" : "+"}{currencySymbol}{Math.abs(myStanding.utilityDue).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Category Breakdown Grid with Auto-DONE status */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                              Configured Utility Category Breakdown (ক্যাটাগরি অনুযায়ী বিল)
                            </h4>
                            <span className="text-[11px] text-slate-400">
                              Auto-completes when paid amount reaches target
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            {(() => {
                              const categories = summaryData.utilitySummary?.categories || {};
                              const defaultKeys = [
                                { key: "wifi", label: "WiFi Internet" },
                                { key: "electricity", label: "Electricity" },
                                { key: "gas", label: "Gas / Fuel" },
                                { key: "garbage", label: "Garbage Collection" },
                                { key: "bashaUti", label: "Building Maintenance" },
                                { key: "pani", label: "Water Supply (Pani)" },
                                { key: "bua", label: "Housekeeper / Maid (Bua)" },
                                { key: "extra", label: "Misc / Extra" },
                              ];

                              const allKeys = Array.from(new Set([...defaultKeys.map(d => d.key), ...Object.keys(categories)]));

                              return allKeys.map((k) => {
                                const cat = categories[k] || {
                                  key: k,
                                  label: defaultKeys.find(d => d.key === k)?.label || k,
                                  targetAmount: (summaryData.monthlyBill?.utilities as any)?.[k] || 0,
                                  paidAmount: 0,
                                  remaining: (summaryData.monthlyBill?.utilities as any)?.[k] || 0,
                                  percent: 0,
                                  isDone: false,
                                  note: (summaryData.monthlyBill?.utilityNotes as any)?.[k] || "",
                                  payments: [],
                                };

                                const target = cat.targetAmount || 0;
                                const paid = cat.paidAmount || 0;
                                const isDone = cat.isDone;
                                const percent = cat.percent || (target > 0 ? Math.min(100, Math.round((paid / target) * 100)) : 0);

                                return (
                                  <div
                                    key={k}
                                    className={`flex flex-col justify-between p-4 rounded-2xl transition-all border shadow-xs ${
                                      isDone
                                        ? "bg-emerald-50/60 border-emerald-200 hover:border-emerald-300"
                                        : paid > 0
                                        ? "bg-amber-50/50 border-amber-200 hover:border-amber-300"
                                        : "bg-slate-50/80 border-slate-200 hover:border-slate-300 hover:bg-white"
                                    }`}
                                  >
                                    <div className="space-y-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <span className={`p-1.5 rounded-lg text-xs ${
                                            isDone ? "bg-emerald-100 text-emerald-600" : paid > 0 ? "bg-amber-100 text-amber-600" : "bg-slate-200 text-slate-500"
                                          }`}>
                                            {k === "wifi" ? <Wifi size={14} /> : k === "electricity" ? <Zap size={14} /> : k === "gas" ? <Flame size={14} /> : k === "garbage" ? <Trash size={14} /> : k === "pani" ? <Droplet size={14} /> : k === "bua" ? <User size={14} /> : <Receipt size={14} />}
                                          </span>
                                          <span className="text-xs font-bold text-slate-900 truncate max-w-[110px]" title={cat.label}>
                                            {cat.label}
                                          </span>
                                        </div>

                                        {isDone ? (
                                          <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                            <Check size={10} /> DONE
                                          </span>
                                        ) : paid > 0 ? (
                                          <span className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                                            {percent}%
                                          </span>
                                        ) : (
                                          <span className="bg-slate-200 text-slate-600 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0">
                                            UNPAID
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex justify-between items-baseline pt-1">
                                        <span className="text-xs text-slate-500">Target:</span>
                                        <span className="text-xs font-bold text-slate-900">
                                          {currencySymbol}{target.toFixed(2)}
                                        </span>
                                      </div>

                                      <div className="flex justify-between items-baseline text-[11px]">
                                        <span className="text-slate-500">Paid:</span>
                                        <span className={`font-semibold ${paid > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                                          {currencySymbol}{paid.toFixed(2)}
                                        </span>
                                      </div>

                                      {/* Progress bar */}
                                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                        <div
                                          className={`h-full transition-all duration-500 rounded-full ${
                                            isDone ? "bg-emerald-500" : paid > 0 ? "bg-amber-500" : "bg-slate-300"
                                          }`}
                                          style={{ width: `${percent}%` }}
                                        />
                                      </div>

                                      {cat.note && (
                                        <p className="text-[10px] text-amber-700 italic bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded truncate" title={cat.note}>
                                          📌 {cat.note}
                                        </p>
                                      )}

                                      {/* Direct Payments List if any */}
                                      {cat.payments && cat.payments.length > 0 && (
                                        <div className="pt-1 border-t border-slate-200 space-y-1">
                                          <span className="text-[9px] text-slate-400 uppercase font-semibold block">
                                            Direct Payments:
                                          </span>
                                          {cat.payments.map((p, idx) => (
                                            <div key={p._id || idx} className="flex justify-between text-[10px] text-slate-600">
                                              <span className="truncate max-w-[90px]">{p.paidBy?.name || "Direct"}</span>
                                              <span className="font-semibold text-emerald-600">{currencySymbol}{p.amount}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>

                          {/* General Utility Deposits / Handover to Manager List */}
                          {summaryData.utilitySummary?.generalPayments && summaryData.utilitySummary.generalPayments.length > 0 && (
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 mt-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Sparkles size={15} className="text-emerald-600" />
                                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    General Utility Deposits to Fund / Manager (কমন ফান্ডে মেম্বারদের জমা)
                                  </h5>
                                </div>
                                <span className="text-xs font-bold text-emerald-700">
                                  Total Deposited: {currencySymbol}{(summaryData.utilitySummary.totalGeneralDeposits || 0).toFixed(2)}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {summaryData.utilitySummary.generalPayments.map((p, idx) => (
                                  <div key={p._id || idx} className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-xs shadow-xs">
                                    <div className="space-y-0.5">
                                      <span className="font-bold text-slate-900 block">
                                        {p.paidBy?.name || "Roommate"}
                                      </span>
                                      {p.note && <span className="text-[10px] text-slate-500 block truncate max-w-[150px]">{p.note}</span>}
                                    </div>
                                    <span className="font-bold text-emerald-600">
                                      {currencySymbol}{p.amount.toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 🏢 Section: House Rent Tracking */}
                      <div id="rent-tracking-section" className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-200/50 space-y-6 hover:shadow-2xl hover:translate-y-[2px] transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                          <div>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold">
                                <Building size={18} />
                              </div>
                              <h3 className="font-bold text-lg text-slate-900 font-serif">
                                House Rent Tracking (বাসা ভাড়া)
                              </h3>
                              {summaryData.rentSummary?.isDone && (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                  <CheckCircle2 size={12} />
                                  FULL RENT PAID ✅
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Monthly house rent shares, individual payments, and remaining balances.
                            </p>
                          </div>
                        </div>

                        {/* Rent Metric Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-xs">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                              Total House Rent (মোট ভাড়া)
                            </span>
                            <h4 className="text-xl font-black text-slate-900 mt-1">
                              {currencySymbol}{(summaryData.rentSummary?.totalRent || 0).toFixed(2)}
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-1">
                              Total monthly rent for the entire house
                            </p>
                          </div>

                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-xs">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                              Total Rent Paid (পরিশোধিত ভাড়া)
                            </span>
                            <h4 className="text-xl font-black text-emerald-600 mt-1">
                              {currencySymbol}{(summaryData.rentSummary?.totalPaid || 0).toFixed(2)}
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-1">
                              Collected / paid to landlord
                            </p>
                          </div>

                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-xs">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                              Remaining Rent Due (বাকি ভাড়া)
                            </span>
                            <h4 className={`text-xl font-black mt-1 ${(summaryData.rentSummary?.totalRemaining || 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                              {currencySymbol}{(summaryData.rentSummary?.totalRemaining || 0).toFixed(2)}
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-1">
                              {(summaryData.rentSummary?.totalRemaining || 0) > 0 ? "Pending collection" : "All roommates cleared rent ✅"}
                            </p>
                          </div>
                        </div>

                        {/* Roommate Rent Breakdown Grid */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                            Roommate Rent Breakdown (রুমমেটদের ভাড়ার হিসাব)
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {(summaryData.rentSummary?.roommateBreakdown || []).map((rm) => (
                              <div
                                key={rm.userId}
                                className={`p-4 rounded-2xl border shadow-xs transition-all ${
                                  rm.isDone
                                    ? "bg-emerald-50/50 border-emerald-200"
                                    : "bg-slate-50/80 border-slate-200 hover:bg-white"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                                      {rm.name.split(" ").map(n => n[0]).join("")}
                                    </div>
                                    <span className="text-xs font-bold text-slate-900">{rm.name}</span>
                                  </div>
                                  {rm.isDone ? (
                                    <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <Check size={10} /> PAID
                                    </span>
                                  ) : (
                                    <span className="bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                      DUE
                                    </span>
                                  )}
                                </div>

                                <div className="mt-3 space-y-1.5 text-xs">
                                  <div className="flex justify-between text-slate-500">
                                    <span>Rent Portion:</span>
                                    <span className="font-semibold text-slate-900">{currencySymbol}{rm.rentPortion.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-slate-500">
                                    <span>Paid:</span>
                                    <span className="font-semibold text-emerald-600">{currencySymbol}{rm.rentPayment.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold">
                                    <span className="text-slate-700">Net Due:</span>
                                    <span className={rm.rentDue > 0 ? "text-rose-600" : "text-emerald-600"}>
                                      {currencySymbol}{rm.rentDue.toFixed(2)}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  onClick={() => {
                                    setRentModalUser({
                                      userId: rm.userId,
                                      name: rm.name,
                                      rentPortion: rm.rentPortion,
                                      rentPayment: rm.rentPayment,
                                      rentDue: rm.rentDue,
                                    });
                                    setRentPaymentInput(rm.rentDue > 0 ? rm.rentDue.toString() : "");
                                    setIsRentModalOpen(true);
                                  }}
                                  className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all cursor-pointer border-0 shadow-xs"
                                >
                                  <CreditCard size={12} />
                                  <span>Record Rent Payment</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* 💼 Section: Grocery Wallet & Member Balances */}
                      <div id="grocery-wallet-section" className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-200/50 space-y-6 hover:shadow-2xl hover:translate-y-[2px] transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                          <div>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center font-bold">
                                <Wallet size={18} />
                              </div>
                              <h3 className="font-bold text-lg text-slate-900 font-serif">
                                Grocery Wallet & Cash in Hand (মেস ফান্ড ও ব্যালেন্স)
                              </h3>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Who is currently holding mess cash in hand, and member grocery shopping contributions.
                            </p>
                          </div>
                        </div>

                        {/* Cash In Hand Grid */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                              Cash In Hand (কার কাছে মেসের কত টাকা নগদ জমা আছে)
                            </h4>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {summaryData.userStandings.map((user) => {
                              const cashInHand = user.walletBalance || 0;
                              const hasCash = cashInHand > 0;
                              return (
                                <div
                                  key={user.userId}
                                  className={`p-4 rounded-2xl border shadow-xs transition-all ${
                                    hasCash
                                      ? "bg-emerald-50/60 border-emerald-200"
                                      : "bg-slate-50/80 border-slate-200 hover:bg-white"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                                        {user.name.split(" ").map(n => n[0]).join("")}
                                      </div>
                                      <span className="text-xs font-bold text-slate-900">{user.name}</span>
                                    </div>
                                    {hasCash ? (
                                      <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                        Holding Cash
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400">৳0 Cash</span>
                                    )}
                                  </div>

                                  <div className="mt-3 flex items-baseline justify-between">
                                    <span className="text-[11px] text-slate-500">Cash in Hand:</span>
                                    <span className={`text-lg font-black ${hasCash ? "text-emerald-600" : "text-slate-400"}`}>
                                      {currencySymbol}{cashInHand.toFixed(2)}
                                    </span>
                                  </div>

                                  <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between text-[11px] text-slate-500">
                                    <span>Bazar Spent:</span>
                                    <span className="font-semibold text-rose-500">{currencySymbol}{user.walletSpent.toFixed(2)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Simplified Ledger Table */}
                        <div id="roommate-standing" className="space-y-3 pt-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                Roommate Standing Statement (সকল খাতের ব্যালেন্স বিবরণী)
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                Independent breakdown of Food Due, Utility Due, and Rent Due for each roommate.
                              </p>
                            </div>
                          </div>

                          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
                            <table className="w-full text-left border-collapse min-w-[850px]">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider">
                                  <th className="py-4 px-4">Roommate</th>
                                  <th className="py-4 px-3 text-center">Meals</th>
                                  <th className="py-4 px-3 text-right">Meal Cost</th>
                                  <th className="py-4 px-3 text-right">Given for Meal</th>
                                  <th className="py-4 px-3 text-right text-rose-500">Spent on Bazar</th>
                                  <th className="py-4 px-3 text-right text-slate-700">Food Due</th>
                                  <th className="py-4 px-3 text-right text-emerald-600">Utility Due</th>
                                  <th className="py-4 px-3 text-right text-slate-700">Rent Due</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {summaryData.userStandings.map((user) => {
                                  return (
                                    <tr
                                      key={user.userId}
                                      className="hover:bg-slate-50 text-slate-800 text-sm transition-all border-b border-slate-100"
                                    >
                                      <td className="py-5 px-4 font-semibold text-slate-900">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                                            {user.name
                                              .split(" ")
                                              .map((n) => n[0])
                                              .join("")}
                                          </div>
                                          <div>
                                            <p className="font-bold text-slate-900">{user.name}</p>
                                            <div className="flex flex-col gap-0.5">
                                              <span className="text-[10px] text-slate-400 capitalize leading-none font-medium">
                                                {user.role}
                                              </span>
                                              {user.note && (
                                                <span
                                                  className="text-[10px] text-amber-700 italic bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-1 max-w-[200px] truncate"
                                                  title={user.note}
                                                >
                                                  📝 {user.note}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="py-5 px-3 text-center font-medium text-slate-700">
                                        {user.userTotalMeals.toFixed(1)}
                                      </td>
                                      <td className="py-5 px-3 text-right font-medium text-slate-700">
                                        <div>
                                          {currencySymbol}{user.mealCostPortion.toFixed(2)}
                                        </div>
                                        {user.prevMealDue !== 0 && (
                                          <span className="text-[10px] text-slate-400 block">
                                            Prev: {user.prevMealDue >= 0 ? "+" : ""}
                                            {currencySymbol}{user.prevMealDue % 1 === 0 ? user.prevMealDue.toFixed(0) : user.prevMealDue.toString()}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-5 px-3 text-right font-semibold text-emerald-600">
                                        {currencySymbol}{user.totalDeposits.toFixed(2)}
                                      </td>
                                      <td className="py-5 px-3 text-right font-semibold text-rose-500">
                                        <div>{currencySymbol}{user.walletSpent.toFixed(2)}</div>
                                        {user.walletGiven !== 0 || user.walletReceived !== 0 ? (
                                          <span className="text-[10px] text-slate-400 block leading-tight">
                                            Given: {currencySymbol}{user.walletGiven % 1 === 0 ? user.walletGiven.toFixed(0) : user.walletGiven.toString()} |
                                            Recv: {currencySymbol}{user.walletReceived % 1 === 0 ? user.walletReceived.toFixed(0) : user.walletReceived.toString()}
                                            <br />
                                            Net:{" "}
                                            {user.walletGiven - user.walletReceived >= 0 ? "+" : ""}
                                            {currencySymbol}{(user.netBazarPaid || 0) % 1 === 0 ? (user.netBazarPaid || 0).toFixed(0) : (user.netBazarPaid || 0).toString()}
                                          </span>
                                        ) : null}
                                      </td>
                                      <td
                                        className={`py-5 px-3 text-right font-bold ${user.foodDue > 0 ? "text-rose-600" : "text-emerald-600"}`}
                                      >
                                        {user.foodDue >= 0 ? "" : "+"}{currencySymbol}
                                        {Math.abs(user.foodDue).toFixed(2)}
                                      </td>
                                      <td className="py-5 px-3 text-right font-medium text-slate-700">
                                        <div
                                          className={`font-bold ${user.utilityDue > 0 ? "text-rose-600" : "text-emerald-600"}`}
                                        >
                                          {user.utilityDue >= 0 ? "" : "+"}{currencySymbol}
                                          {Math.abs(user.utilityDue).toFixed(2)}
                                        </div>
                                        <span className="text-[10px] text-slate-400 block leading-tight">
                                          Share: {currencySymbol}{user.utilityShare % 1 === 0 ? user.utilityShare.toFixed(0) : user.utilityShare.toString()} |
                                          Prev:{" "}
                                          {user.prevUtilityDue >= 0 ? "+" : ""}{currencySymbol}
                                          {user.prevUtilityDue % 1 === 0 ? user.prevUtilityDue.toFixed(0) : user.prevUtilityDue.toString()}
                                          <br />
                                          Paid: -{currencySymbol}{user.utilityPayment % 1 === 0 ? user.utilityPayment.toFixed(0) : user.utilityPayment.toString()}
                                        </span>
                                      </td>
                                      <td className="py-5 px-3 text-right font-medium text-slate-700">
                                        <div
                                          className={`font-bold ${user.rentDue > 0 ? "text-rose-600" : "text-emerald-600"}`}
                                        >
                                          {currencySymbol}{user.rentDue.toFixed(2)}
                                        </div>
                                        <span className="text-[10px] text-slate-400 block leading-tight">
                                          Rent: {currencySymbol}{user.rentPortion.toFixed(0)} |
                                          Paid: -{currencySymbol}
                                          {(user.rentPayment || 0).toFixed(0)}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div
                    id="dashboard-stats"
                    className="flex flex-col items-center justify-center py-16 bg-white border border-slate-200 rounded-3xl text-center space-y-4 shadow-xl shadow-slate-200/50 animate-fade-in"
                  >
                    <span className="text-5xl">🏠</span>
                    <h3 className="text-lg font-bold text-slate-900 font-serif">
                      Your home is all set up!
                    </h3>
                    <p className="text-slate-500 text-sm max-w-md">
                      Start by configuring your monthly bills, inviting your
                      roommates, and recording your first meals and
                      expenses. Your stats will appear here once you have
                      data.
                    </p>
                    <button
                      onClick={openConfigModal}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer mt-2 border-0 shadow-md shadow-emerald-600/20"
                    >
                      <Sliders size={14} />
                      <span>Configure Bills to Get Started</span>
                    </button>
                  </div>
                )}
              </>
            ))}

          {/* Notepad / Purchase Memo Tab */}
          {activeTab === "notepad" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 font-serif">
                    House Notes & Purchases
                  </h2>
                  <p className="text-slate-500 text-sm">
                    Ad-hoc notes, lists, reminders, and small grocery items
                    (like brooms, cleaning supplies) for the house.
                  </p>
                </div>
              </div>

              {/* Add Note Form */}
              <form
                id="create-note-form"
                onSubmit={handleCreateNote}
                className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-200/50 space-y-4 hover:shadow-2xl hover:translate-y-[2px] transition-all"
              >
                <h3 className="font-bold text-sm text-slate-900 font-serif">
                  Create a Note / Purchase
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      placeholder="What did you buy or what is the note? (e.g. Bought a broom for kitchen)"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-4 py-2 w-full focus:outline-none focus:border-emerald-500 text-xs text-slate-900 shadow-xs"
                      required
                    />
                  </div>
                  <div>
                    <select
                      value={noteCategory}
                      onChange={(e) => setNoteCategory(e.target.value as any)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:border-emerald-500 text-xs text-slate-800 cursor-pointer shadow-xs"
                    >
                      <option value="general">📋 General Memo</option>
                      <option value="purchase">🛒 Purchase / Cost</option>
                      <option value="reminder">🔔 Reminder</option>
                      <option value="todo">✅ To-Do Item</option>
                    </select>
                  </div>
                  {noteCategory === "purchase" ? (
                    <div className="flex items-center animate-fade-in">
                      <span className="text-slate-400 mr-1.5 text-xs font-bold">
                        ৳
                      </span>
                      <input
                        type="number"
                        placeholder="Cost amount"
                        value={noteAmount}
                        onChange={(e) => setNoteAmount(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:border-emerald-500 text-xs text-slate-900 shadow-xs"
                        required
                      />
                    </div>
                  ) : noteCategory === "reminder" ? (
                    <div className="flex items-center animate-fade-in w-full">
                      <input
                        type="datetime-local"
                        value={noteReminderDate}
                        onChange={(e) => setNoteReminderDate(e.target.value)}
                        onClick={(e) => e.currentTarget.showPicker()}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:border-emerald-500 text-xs text-slate-900 cursor-pointer shadow-xs"
                        required
                      />
                    </div>
                  ) : (
                    <div className="flex items-center opacity-40">
                      <span className="text-slate-400 mr-1.5 text-xs font-bold">
                        ৳
                      </span>
                      <input
                        type="text"
                        placeholder="N/A"
                        className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none text-xs text-slate-400 cursor-not-allowed"
                        disabled
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white px-5 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer border-0"
                  >
                    Add Note
                  </button>
                </div>
              </form>

              {/* Notes Grid */}
              {notesLoading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
                  <p className="text-slate-500 text-xs font-medium">
                    Opening the notepad...
                  </p>
                </div>
              ) : notes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {notes.map((note) => {
                    const isEditing = editingNoteId === note._id;
                    const catColors = {
                      general:
                        "text-slate-700 bg-slate-100 border-slate-200",
                      purchase:
                        "text-rose-600 bg-rose-50 border-rose-200",
                      reminder:
                        "text-amber-700 bg-amber-50 border-amber-200",
                      todo: "text-emerald-700 bg-emerald-50 border-emerald-200",
                    };
                    const categoryEmoji = {
                      general: "📋",
                      purchase: "🛒",
                      reminder: "🔔",
                      todo: "✅",
                    };
                    return (
                      <div
                        key={note._id}
                        className={`bg-white border rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4 transition-all hover:shadow-md hover:translate-y-[1px] relative overflow-hidden ${
                          note.pinned
                            ? "border-emerald-400 ring-2 ring-emerald-500/20"
                            : "border-slate-200"
                        }`}
                      >
                        {/* Pin ribbon */}
                        {note.pinned && (
                          <div className="absolute top-0 right-0 bg-emerald-600 text-[8px] font-black tracking-widest text-white px-2 py-0.5 rounded-bl uppercase">
                            PINNED
                          </div>
                        )}

                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border ${catColors[note.category] || catColors.general}`}
                              >
                                {categoryEmoji[note.category]} {note.category}
                              </span>
                              {note.category === "todo" && note.completed && (
                                <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border text-emerald-700 bg-emerald-50 border-emerald-200">
                                  Done ✓
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleNotePin(note._id, note.pinned)
                                }
                                className={`p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer border-0 bg-transparent ${
                                  note.pinned
                                    ? "text-emerald-600"
                                    : "text-slate-400 hover:text-slate-700"
                                }`}
                                title={note.pinned ? "Unpin" : "Pin to top"}
                              >
                                <Pin size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteNote(note._id)}
                                className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
                                title="Delete note"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {isEditing ? (
                            <div className="space-y-3">
                              <textarea
                                value={editingNoteText}
                                onChange={(e) =>
                                  setEditingNoteText(e.target.value)
                                }
                                className="bg-slate-50 border border-slate-200 rounded-lg p-2 w-full text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <select
                                  value={editingNoteCategory}
                                  onChange={(e) =>
                                    setEditingNoteCategory(
                                      e.target.value as any,
                                    )
                                  }
                                  className="bg-slate-50 border border-slate-200 rounded-lg p-1 text-[10px] text-slate-800"
                                >
                                  <option value="general">📋 General</option>
                                  <option value="purchase">🛒 Purchase</option>
                                  <option value="reminder">🔔 Reminder</option>
                                  <option value="todo">✅ To-Do</option>
                                </select>
                                {editingNoteCategory === "purchase" ? (
                                  <input
                                    type="number"
                                    value={editingNoteAmount}
                                    onChange={(e) =>
                                      setEditingNoteAmount(e.target.value)
                                    }
                                    className="bg-slate-50 border border-slate-200 rounded-lg p-1 text-[10px] text-slate-900 w-24 text-right"
                                    placeholder="Cost"
                                    required
                                  />
                                ) : editingNoteCategory === "reminder" ? (
                                  <input
                                    type="datetime-local"
                                    value={editingNoteReminderDate}
                                    onChange={(e) =>
                                      setEditingNoteReminderDate(e.target.value)
                                    }
                                    onClick={(e) =>
                                      e.currentTarget.showPicker()
                                    }
                                    className="bg-slate-50 border border-slate-200 rounded-lg p-1 text-[10px] text-slate-900 cursor-pointer"
                                    required
                                  />
                                ) : null}
                              </div>
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteId(null)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-semibold text-slate-600 cursor-pointer border-0"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveNoteEdit(note._id)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[10px] font-bold text-white cursor-pointer border-0 shadow-xs"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p
                                className={`text-xs font-medium leading-relaxed whitespace-pre-wrap ${
                                  note.category === "todo" && note.completed
                                    ? "line-through text-slate-400"
                                    : "text-slate-800"
                                }`}
                              >
                                {note.text}
                              </p>
                              {note.category === "purchase" &&
                                note.amount > 0 && (
                                  <p className="text-sm font-black text-rose-500 font-serif">
                                    ৳{note.amount.toFixed(2)}
                                  </p>
                                )}
                              {note.category === "reminder" &&
                                note.reminderDate && (
                                  <div className="mt-1 flex items-center">
                                    {renderReminderTimer(note)}
                                  </div>
                                )}
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                          <span className="font-semibold text-slate-600">
                            {note.createdByName || "Roommate"}
                          </span>
                          <div className="flex items-center gap-2">
                            {note.category === "todo" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleTodoCompleted(
                                    note._id,
                                    !!note.completed,
                                  )
                                }
                                className={`font-bold transition-colors cursor-pointer border-0 bg-transparent ${
                                  note.completed
                                    ? "text-slate-400 hover:text-slate-600"
                                    : "text-emerald-600 hover:text-emerald-700"
                                }`}
                              >
                                {note.completed
                                  ? "Mark Pending"
                                  : "Mark Done ✓"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteId(note._id);
                                setEditingNoteText(note.text);
                                setEditingNoteCategory(note.category);
                                setEditingNoteAmount(
                                  note.amount?.toString() || "",
                                );
                                setEditingNoteReminderDate(
                                  note.reminderDate
                                    ? new Date(note.reminderDate)
                                        .toISOString()
                                        .slice(0, 16)
                                    : "",
                                );
                              }}
                              className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer border-0 bg-transparent"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 bg-white border border-slate-200 rounded-3xl p-6 gap-2 text-slate-500 italic shadow-xs">
                  <span>📝 No notes or house purchase logs recorded yet.</span>
                </div>
              )}
            </div>
          )}

          {/* Change History Audit Log Tab */}
          {activeTab === "history" && (
            <div
              id="history-log-container"
              className="space-y-6 animate-fade-in"
            >
              <div>
                <h2 className="text-2xl font-bold text-slate-900 font-serif">
                  Change History Log
                </h2>
                <p className="text-slate-500 text-sm">
                  Full audit trail of all household modifications, transactions,
                  configurations, and notes for {monthId}.
                </p>
              </div>

              {auditLoading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
                  <p className="text-slate-500 text-xs font-medium">
                    Opening the history books...
                  </p>
                </div>
              ) : auditLogs.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-200/50 overflow-hidden hover:shadow-2xl hover:translate-y-[2px] transition-all">
                    <div className="divide-y divide-slate-100">
                      {auditLogs.map((log) => {
                        const actionEmoji = {
                          UPDATE_MEAL: "🍴",
                          UPDATE_BAZAR: "🛒",
                          UPDATE_DEPOSIT: "💰",
                          ADD_TRANSFER: "💸",
                          DELETE_TRANSFER: "❌",
                          UPDATE_BILL_CONFIG: "⚙️",
                          CREATE_MONTH: "📅",
                          ADD_NOTE: "📝",
                          EDIT_NOTE: "✏️",
                          DELETE_NOTE: "🗑️",
                          ASSIGN_BAZAR_USER: "👤",
                          UPDATE_CONFIG: "🔧",
                        };
                        return (
                          <div
                            key={log._id}
                            className="py-3.5 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 first:pt-1 last:pb-1 text-xs"
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-lg mt-0.5">
                                {(actionEmoji as any)[log.action] || "📝"}
                              </span>
                              <div>
                                <p className="text-xs text-slate-900 font-semibold">
                                  {log.changes?.[0]?.detail ||
                                    `${log.userName} triggered ${log.action}`}
                                </p>
                                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mt-0.5">
                                  Action by:{" "}
                                  <span className="text-emerald-700 font-bold">
                                    {log.userName}
                                  </span>
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[10px] text-slate-400 block font-medium">
                                {new Date(log.createdAt).toLocaleDateString()}{" "}
                                {new Date(log.createdAt).toLocaleTimeString(
                                  [],
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pagination */}
                  {auditTotalPages > 1 && (
                    <div className="flex justify-center items-center gap-2">
                      <button
                        onClick={() =>
                          fetchAuditLogs(Math.max(1, auditPage - 1))
                        }
                        disabled={auditPage === 1}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                      >
                        Prev
                      </button>
                      <span className="text-xs text-slate-500 font-medium">
                        Page {auditPage} of {auditTotalPages}
                      </span>
                      <button
                        onClick={() =>
                          fetchAuditLogs(
                            Math.min(auditTotalPages, auditPage + 1),
                          )
                        }
                        disabled={auditPage === auditTotalPages}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 bg-white border border-slate-200 rounded-3xl p-6 gap-2 text-slate-500 italic shadow-xs">
                  <span>📜 No history logs captured for {monthId} yet.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Configuration Modal */}
      {isConfigModalOpen && billConfig && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white border border-slate-200 w-full max-w-4xl rounded-3xl p-6 shadow-2xl space-y-6 text-slate-900">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 font-serif">
                  Configure Rent & Utilities
                </h3>
                <p className="text-slate-500 text-xs mt-0.5 font-medium">
                  Set up roommate rent shares, shared utilities, and previous
                  adjustments for {monthId}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="text-slate-500 hover:text-slate-900 font-bold text-sm bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer border-0"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSaveBillConfig} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Column 1: Rent Config */}
                <div className="space-y-4 bg-slate-50 p-4 border border-slate-200 rounded-2xl">
                  <h4 className="font-bold text-xs text-emerald-700 uppercase tracking-wider">
                    Home Rent Settings
                  </h4>
                  <div className="space-y-3">
                    {summaryData?.userStandings.map((u) => {
                      const rentVal = billConfig.rent[u.userId] || 0;
                      return (
                        <div
                          key={u.userId}
                          className="flex justify-between items-center gap-2"
                        >
                          <label className="text-xs text-slate-700 font-medium">
                            {u.name}
                          </label>
                          <div className="flex items-center">
                            <span className="text-[10px] text-slate-400 mr-1">
                              ৳
                            </span>
                            <input
                              type="number"
                              value={rentVal}
                              onChange={(e) =>
                                setBillConfig({
                                  ...billConfig,
                                  rent: {
                                    ...billConfig.rent,
                                    [u.userId]: parseFloat(e.target.value) || 0,
                                  },
                                })
                              }
                              className="bg-white border border-slate-200 rounded-xl px-2 py-1 w-24 text-right focus:outline-none focus:border-emerald-500 text-xs text-slate-900 font-bold shadow-xs"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Column 2: Utilities Config */}
                <div className="space-y-4 bg-slate-50 p-4 border border-slate-200 rounded-2xl">
                  <h4 className="font-bold text-xs text-emerald-700 uppercase tracking-wider font-semibold">
                    Utility Category Bills
                  </h4>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {Object.keys(billConfig.utilities || {}).map((utilKey) => {
                      const val = (billConfig.utilities as any)[utilKey] || 0;
                      const isOwner = homeData?.admin === currentUser?._id;
                      const hasPermission =
                        isOwner ||
                        (homeData?.utilityControlMembers || []).includes(
                          currentUser?._id,
                        );
                      const getCategoryLabel = (k: string) => {
                        const labels: any = {
                          wifi: "WiFi Internet",
                          electricity: "Electricity",
                          gas: "Gas / Fuel",
                          garbage: "Garbage Collection",
                          bashaUti: "Building Maintenance",
                          pani: "Water Supply (Pani)",
                          bua: "Cook / Maid (Bua)",
                          extra: "Miscellaneous Extra",
                        };
                        return (
                          labels[k] || k.charAt(0).toUpperCase() + k.slice(1)
                        );
                      };

                      const currentRule = billConfig.utilitySplitRules?.[utilKey] || {
                        mode: "equal",
                        customValues: {},
                      };
                      const isExpanded = expandedSplitUtil === utilKey;

                      const previewShares = computePreviewShares(
                        val,
                        currentRule.mode,
                        currentRule.customValues || {},
                        summaryData?.userStandings || [],
                      );

                      return (
                        <div
                          key={utilKey}
                          className="p-3 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-xs"
                        >
                          <div className="flex justify-between items-center gap-2">
                            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                              <span>{getCategoryLabel(utilKey)}</span>
                              {currentRule.mode !== "equal" && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                                  {currentRule.mode}
                                </span>
                              )}
                              {hasPermission &&
                                ![
                                  "wifi",
                                  "electricity",
                                  "gas",
                                  "garbage",
                                  "bashaUti",
                                  "pani",
                                  "bua",
                                  "extra",
                                ].includes(utilKey) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedUtils = {
                                        ...billConfig.utilities,
                                      };
                                      delete (updatedUtils as any)[utilKey];
                                      const updatedNotes = {
                                        ...(billConfig.utilityNotes || {}),
                                      };
                                      delete (updatedNotes as any)[utilKey];
                                      const updatedRules = {
                                        ...(billConfig.utilitySplitRules || {}),
                                      };
                                      delete (updatedRules as any)[utilKey];
                                      setBillConfig({
                                        ...billConfig,
                                        utilities: updatedUtils,
                                        utilityNotes: updatedNotes,
                                        utilitySplitRules: updatedRules,
                                      });
                                    }}
                                    className="text-slate-400 hover:text-rose-500 p-0.5 rounded cursor-pointer shrink-0 transition-colors border-0 bg-transparent"
                                    title={`Delete category ${getCategoryLabel(utilKey)}`}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                            </div>
                            <div className="flex items-center shrink-0">
                              <span className="text-[10px] text-slate-400 mr-1">
                                ৳
                              </span>
                              <input
                                type="number"
                                value={val}
                                onChange={(e) =>
                                  setBillConfig({
                                    ...billConfig,
                                    utilities: {
                                      ...billConfig.utilities,
                                      [utilKey]:
                                        parseFloat(e.target.value) || 0,
                                    },
                                  })
                                }
                                className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 w-24 text-right focus:outline-none focus:border-emerald-500 text-xs text-slate-900 font-bold"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Add memo (e.g. Paid directly)"
                              value={billConfig.utilityNotes?.[utilKey] || ""}
                              onChange={(e) =>
                                setBillConfig({
                                  ...billConfig,
                                  utilityNotes: {
                                    ...(billConfig.utilityNotes || {}),
                                    [utilKey]: e.target.value,
                                  },
                                })
                              }
                              className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 w-full focus:outline-none text-[10px] text-slate-800 italic"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedSplitUtil(
                                  isExpanded ? null : utilKey,
                                )
                              }
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                                isExpanded || currentRule.mode !== "equal"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                              }`}
                              title="Configure custom formula/split rules for this utility"
                            >
                              <Sliders size={11} />
                              <span>Formula</span>
                            </button>
                          </div>

                          {/* Expanded Custom Split Engine Box */}
                          {isExpanded && (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 mt-2 text-xs animate-fade-in">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-900 text-[11px] flex items-center gap-1">
                                  <Sliders size={12} className="text-emerald-600" /> Custom Formula: {getCategoryLabel(utilKey)}
                                </span>
                                <span className="text-[10px] text-slate-500 font-bold">
                                  Total: ৳{val}
                                </span>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                  Split Mode Formula:
                                </label>
                                <select
                                  value={currentRule.mode}
                                  onChange={(e) => {
                                    const newMode = e.target.value as any;
                                    const updatedRules = {
                                      ...(billConfig.utilitySplitRules || {}),
                                      [utilKey]: {
                                        mode: newMode,
                                        customValues:
                                          currentRule.customValues || {},
                                      },
                                    };
                                    setBillConfig({
                                      ...billConfig,
                                      utilitySplitRules: updatedRules,
                                    });
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-xl p-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
                                >
                                  <option value="equal">Equal Split (Total ÷ Roommates)</option>
                                  <option value="weighted">Weighted Shares (e.g., 3:2:2:2 for High-End PC)</option>
                                  <option value="surcharge">Extra Surcharge (+৳ Offset for PC/AC)</option>
                                  <option value="fixed">Fixed Amount (Roommate pays fixed ৳)</option>
                                </select>
                              </div>

                              <p className="text-[10px] text-slate-600 bg-white p-2 rounded-xl border border-slate-200 leading-relaxed shadow-xs">
                                {currentRule.mode === "weighted" && "💡 Assign share weights (e.g. 3 for PC user, 2 for others). Bill is split proportionally."}
                                {currentRule.mode === "surcharge" && "💡 Enter extra +৳ surcharge for high-usage roommates (PC/AC). Surcharges are added after splitting remaining bill equally."}
                                {currentRule.mode === "fixed" && "💡 Enter fixed ৳ amount for specific roommates. Remaining bill is divided among other roommates."}
                                {currentRule.mode === "equal" && "💡 Standard equal split among all room members."}
                              </p>

                              {currentRule.mode !== "equal" && (
                                <div className="space-y-2 pt-1 border-t border-slate-200">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Roommate Formula Shares & Live Breakdown:
                                  </span>
                                  {summaryData?.userStandings.map((u) => {
                                    const customVal =
                                      currentRule.customValues?.[u.userId] ??
                                      (currentRule.mode === "weighted" ? 1 : 0);
                                    const shareVal = previewShares[u.userId] || 0;

                                    return (
                                      <div
                                        key={u.userId}
                                        className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-white border border-slate-200 text-[11px] shadow-xs"
                                      >
                                        <span className="font-semibold text-slate-800 truncate max-w-[100px]">
                                          {u.name}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <div className="flex items-center gap-1">
                                            <span className="text-[9px] text-slate-400">
                                              {currentRule.mode === "weighted"
                                                ? "Shares:"
                                                : currentRule.mode === "surcharge"
                                                ? "+৳:"
                                                : "Fixed ৳:"}
                                            </span>
                                            <input
                                              type="number"
                                              value={customVal}
                                              onChange={(e) => {
                                                const newVal =
                                                  parseFloat(e.target.value) || 0;
                                                const updatedVals = {
                                                  ...(currentRule.customValues ||
                                                    {}),
                                                  [u.userId]: newVal,
                                                };
                                                const updatedRules = {
                                                  ...(billConfig.utilitySplitRules ||
                                                    {}),
                                                  [utilKey]: {
                                                    mode: currentRule.mode,
                                                    customValues: updatedVals,
                                                  },
                                                };
                                                setBillConfig({
                                                  ...billConfig,
                                                  utilitySplitRules: updatedRules,
                                                });
                                              }}
                                              className="bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5 w-16 text-right text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                                            />
                                          </div>
                                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-lg border border-emerald-200">
                                            ৳
                                            {shareVal % 1 === 0
                                              ? shareVal.toFixed(0)
                                              : shareVal.toFixed(1)}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* New Category Box if user has permission */}
                    {(() => {
                      const isOwner = homeData?.admin === currentUser?._id;
                      const hasPermission =
                        isOwner ||
                        (homeData?.utilityControlMembers || []).includes(
                          currentUser?._id,
                        );
                      if (!hasPermission) return null;
                      return (
                        <div className="pt-3 border-t border-slate-200 mt-3 space-y-2">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Add Utility Category
                          </p>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              placeholder="Name (e.g. Water)"
                              id="new-utility-category"
                              className="bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-2.5 py-1 text-xs text-slate-800 focus:outline-none w-full shadow-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const inputEl = document.getElementById(
                                  "new-utility-category",
                                );
                                const newCat = (inputEl as HTMLInputElement)?.value?.trim();
                                if (!newCat) return;
                                const normalizedKey = newCat
                                  .toLowerCase()
                                  .replace(/[^a-z0-9]/g, "");
                                if (!normalizedKey) return;
                                if (
                                  (billConfig.utilities as any)[
                                    normalizedKey
                                  ] !== undefined
                                ) {
                                  showAlert(
                                    "Error",
                                    "Category already exists!",
                                  );
                                  return;
                                }
                                setBillConfig({
                                  ...billConfig,
                                  utilities: {
                                    ...billConfig.utilities,
                                    [normalizedKey]: 0,
                                  },
                                });
                                if (inputEl) (inputEl as HTMLInputElement).value = "";
                              }}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-3 rounded-xl transition-all cursor-pointer shrink-0 border-0 shadow-xs"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Column 3: Dues & Payments Ledger */}
                <div className="space-y-4 bg-slate-50 p-4 border border-slate-200 rounded-2xl">
                  <h4 className="font-bold text-xs text-emerald-700 uppercase tracking-wider">
                    Dues & Payments Ledger
                  </h4>
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                    {billConfig.adjustments.map((adj, index) => {
                      const user = summaryData?.userStandings.find(
                        (u) => u.userId === adj.user,
                      );
                      if (!user) return null;
                      return (
                        <div
                          key={adj.user}
                          className="border-b border-slate-200 pb-3 space-y-2 last:border-b-0"
                        >
                          <p className="text-xs font-bold text-slate-900">
                            {user.name}
                          </p>

                          <div className="flex justify-between items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-medium">
                              Prev Utility Due
                            </span>
                            <input
                              type="number"
                              value={adj.prevUtilityDue}
                              onChange={(e) => {
                                const newAdj = [...billConfig.adjustments];
                                newAdj[index] = {
                                  ...adj,
                                  prevUtilityDue:
                                    parseFloat(e.target.value) || 0,
                                };
                                setBillConfig({
                                  ...billConfig,
                                  adjustments: newAdj,
                                });
                              }}
                              className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 w-20 text-right focus:outline-none focus:border-emerald-500 text-[10px] text-slate-900 font-bold shadow-xs"
                            />
                          </div>

                          <div className="flex justify-between items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-medium">
                              Prev Meal Due
                            </span>
                            <input
                              type="number"
                              value={adj.prevMealDue}
                              onChange={(e) => {
                                const newAdj = [...billConfig.adjustments];
                                newAdj[index] = {
                                  ...adj,
                                  prevMealDue: parseFloat(e.target.value) || 0,
                                };
                                setBillConfig({
                                  ...billConfig,
                                  adjustments: newAdj,
                                });
                              }}
                              className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 w-20 text-right focus:outline-none focus:border-emerald-500 text-[10px] text-slate-900 font-bold shadow-xs"
                            />
                          </div>

                          <div className="flex justify-between items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-medium">
                              Utility Paid (New Given)
                            </span>
                            <input
                              type="number"
                              value={adj.utilityPayment}
                              onChange={(e) => {
                                const newAdj = [...billConfig.adjustments];
                                newAdj[index] = {
                                  ...adj,
                                  utilityPayment:
                                    parseFloat(e.target.value) || 0,
                                };
                                setBillConfig({
                                  ...billConfig,
                                  adjustments: newAdj,
                                });
                              }}
                              className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 w-20 text-right focus:outline-none focus:border-emerald-500 text-[10px] text-slate-900 font-bold shadow-xs"
                            />
                          </div>

                          <div className="flex justify-between items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-medium">
                              Rent Paid (New Given)
                            </span>
                            <input
                              type="number"
                              value={adj.rentPayment || 0}
                              onChange={(e) => {
                                const newAdj = [...billConfig.adjustments];
                                newAdj[index] = {
                                  ...adj,
                                  rentPayment: parseFloat(e.target.value) || 0,
                                };
                                setBillConfig({
                                  ...billConfig,
                                  adjustments: newAdj,
                                });
                              }}
                              className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 w-20 text-right focus:outline-none focus:border-emerald-500 text-[10px] text-slate-900 font-bold shadow-xs"
                            />
                          </div>

                          <input
                            type="text"
                            placeholder="Roommate notes..."
                            value={adj.note || ""}
                            onChange={(e) => {
                              const newAdj = [...billConfig.adjustments];
                              newAdj[index] = { ...adj, note: e.target.value };
                              setBillConfig({
                                ...billConfig,
                                adjustments: newAdj,
                              });
                            }}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 w-full focus:outline-none focus:border-emerald-500 text-[10px] text-slate-800 italic shadow-xs"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600 px-4 py-2 rounded-xl transition-all cursor-pointer border-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white px-5 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer border-0"
                >
                  Save Configurations
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Month Creation Modal */}
      {isNewMonthModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-6 text-slate-900">
            <div>
              <h3 className="text-xl font-bold text-slate-900 font-serif">
                Create New Month
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">
                Initialize the next calendar month. Dues and standing
                calculations will automatically carry forward.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                  Base Month (Carry from)
                </span>
                <select
                  value={newMonthPrevMonthId}
                  onChange={(e) => setNewMonthPrevMonthId(e.target.value)}
                  className="bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 border border-slate-200 rounded-xl p-2 w-full cursor-pointer shadow-xs"
                >
                  {availableMonths.map((m) => {
                    const parts = m.split("-");
                    const displayName =
                      parts.length === 2 ? `${parts[0]} ${parts[1]}` : m;
                    return (
                      <option key={m} value={m}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 leading-relaxed shadow-xs">
                🚀 <strong>Auto-Carry Forward Enabled</strong>: The system will automatically
                calculate the surplus/deficit for everyone and apply them as
                <strong> Prev Utility Due</strong> and <strong>Prev Meal Due</strong> in the new month
                config.
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setIsNewMonthModalOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600 px-4 py-2 rounded-xl transition-all cursor-pointer border-0"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateMonth}
                className="bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white px-5 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer border-0"
              >
                Create Month
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Quick Rent Payment Modal */}
      {isRentModalOpen && rentModalUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 animate-fade-in text-slate-900">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-serif">
                    Record Rent Payment
                  </h3>
                  <p className="text-slate-500 text-xs mt-0.5">
                    For {rentModalUser.name} ({monthId})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRentModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm p-1 rounded-lg bg-transparent border-0 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Status Card */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-center shadow-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                  Rent Share
                </span>
                <span className="text-xs font-bold text-slate-900">
                  {currencySymbol}{rentModalUser.rentPortion.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                  Already Paid
                </span>
                <span className="text-xs font-bold text-emerald-600">
                  {currencySymbol}{rentModalUser.rentPayment.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                  Remaining Due
                </span>
                <span className={`text-xs font-bold ${rentModalUser.rentDue > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {currencySymbol}{rentModalUser.rentDue.toFixed(2)}
                </span>
              </div>
            </div>

            <form onSubmit={handleRecordRentPayment} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700">
                    Payment Amount ({currencySymbol})
                  </label>
                  {rentModalUser.rentDue > 0 && (
                    <button
                      type="button"
                      onClick={() => setRentPaymentInput(rentModalUser.rentDue.toString())}
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 underline cursor-pointer bg-transparent border-0"
                    >
                      Fill Unpaid Due ({currencySymbol}{rentModalUser.rentDue})
                    </button>
                  )}
                </div>
                <SmartMathInput
                  value={rentPaymentInput}
                  onChange={(val) => setRentPaymentInput(val)}
                  placeholder="e.g. 6250 or 5000+1250"
                  className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 w-full text-sm text-slate-900 font-bold focus:outline-none focus:border-emerald-500 shadow-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Payment Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid via bKash / Cash to landlord"
                  value={rentPaymentNote}
                  onChange={(e) => setRentPaymentNote(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-4 py-2 w-full text-xs text-slate-900 focus:outline-none focus:border-emerald-500 shadow-xs"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRentModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600 px-4 py-2 rounded-xl transition-all cursor-pointer border-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRent}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white px-5 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5 border-0"
                >
                  {submittingRent && <Loader2 size={13} className="animate-spin" />}
                  <span>Record Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reusable Confirm/Alert Dialog Modal */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        isAlert={confirmDialog.isAlert}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() =>
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        }
      />

      {/* Household Settings Modal */}
      {isHomeSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-6 text-slate-900">
            <div>
              <h3 className="text-xl font-bold text-slate-900 font-serif">
                Household Settings
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">
                Customize your household name and preferred currency symbol.
              </p>
            </div>

            <form onSubmit={handleSaveHomeSettings} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  Household Name
                </label>
                <input
                  type="text"
                  value={editHomeName}
                  onChange={(e) => setEditHomeName(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 w-full text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-medium shadow-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  Preferred Currency
                </label>
                <select
                  value={editHomeCurrency}
                  onChange={(e) => setEditHomeCurrency(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 w-full text-xs text-slate-800 focus:outline-none focus:border-emerald-500 font-medium cursor-pointer shadow-xs"
                >
                  <option value="৳">৳ (BDT - Taka)</option>
                  <option value="$">$ (USD - Dollar)</option>
                  <option value="€">€ (EUR - Euro)</option>
                  <option value="£">£ (GBP - Pound)</option>
                  <option value="₹">₹ (INR - Rupee)</option>
                  <option value="C$">C$ (CAD - Canadian Dollar)</option>
                  <option value="A$">A$ (AUD - Australian Dollar)</option>
                </select>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-4">
                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <Key size={12} className="text-emerald-600" />
                  <span>Roommates & Account Credentials</span>
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {homeData?.members?.map((member: any) => (
                    <div
                      key={member._id}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 flex items-center justify-between gap-2 shadow-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {member.name}
                          </span>
                          {member.role === "admin" && (
                            <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-emerald-200">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {member.email || "No email set"}
                          {member.nickname && ` • @${member.nickname}`}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenEditRoommate(member)}
                        className="bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
                        title="Reset Email / Password"
                      >
                        <Key size={12} className="text-emerald-600" />
                        <span>Reset</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsHomeSettingsOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600 px-4 py-2 rounded-xl transition-all cursor-pointer border-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingHomeSettings}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white px-5 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5 border-0"
                >
                  {savingHomeSettings && (
                    <Loader2 size={13} className="animate-spin" />
                  )}
                  <span>Save Settings</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Roommate Credentials Modal */}
      {editingRoommate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 text-slate-900">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-serif flex items-center gap-2">
                  <Key size={18} className="text-emerald-600" />
                  <span>Update {editingRoommate.name}'s Account</span>
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  Update login email or set a new password for this roommate without losing any history.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRoommate(null)}
                className="text-slate-400 hover:text-slate-700 text-sm p-1 cursor-pointer bg-transparent border-0"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRoommateCredentials} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  New Email Address
                </label>
                <input
                  type="email"
                  value={editRoommateEmail}
                  onChange={(e) => setEditRoommateEmail(e.target.value)}
                  placeholder="e.g. real_email@gmail.com"
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 w-full text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-medium shadow-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  Handle / Nickname
                </label>
                <input
                  type="text"
                  value={editRoommateNickname}
                  onChange={(e) => setEditRoommateNickname(e.target.value)}
                  placeholder="e.g. borno"
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 w-full text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-medium shadow-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  Reset Password (Leave blank to keep unchanged)
                </label>
                <input
                  type="password"
                  value={editRoommatePassword}
                  onChange={(e) => setEditRoommatePassword(e.target.value)}
                  placeholder="New password (min 4 characters)"
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 w-full text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-medium shadow-xs"
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-[11px] text-emerald-800 shadow-xs">
                💡 <strong>Data Safe:</strong> Updating credentials will immediately allow your roommate to log in with their new email/password while keeping 100% of their meal logs, deposits, and dues intact!
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingRoommate(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600 px-4 py-2 rounded-xl transition-all cursor-pointer border-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRoommateCredentials}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white px-5 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5 border-0"
                >
                  {savingRoommateCredentials && (
                    <Loader2 size={13} className="animate-spin" />
                  )}
                  <span>Save Credentials</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Device Consent Modal */}
      {showConsentModal && (
        <DeviceConsentModal
          onConsentGranted={() => {
            setShowConsentModal(false);
            fetchConsentStatus();
          }}
          onCancel={() => setShowConsentModal(false)}
        />
      )}

      {/* Device Tracking Settings Modal */}
      {showTrackingSettings && (
        <DeviceTrackingSettings
          isActive={consentStatus.isActive}
          onConsentChanged={() => {
            fetchConsentStatus();
          }}
          onClose={() => setShowTrackingSettings(false)}
        />
      )}

      {/* Device Download Help Modal */}
      {showDownloadHelp && (
        <DeviceDownloadHelp onClose={() => setShowDownloadHelp(false)} />
      )}

      {/* LifeOS Pro Upgrade Modal */}
      {showProModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 relative overflow-hidden text-slate-900">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Crown size={20} className="text-amber-500" />
                <h3 className="font-serif font-black text-lg text-slate-900">
                  LifeOS Pro Subscription
                </h3>
              </div>
              <button
                onClick={() => setShowProModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg bg-transparent border-0 cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {/* Service Unavailable Banner */}
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-start gap-3 text-xs text-emerald-800 leading-relaxed shadow-xs">
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <strong className="block font-bold text-slate-900 mb-0.5">
                  Pro Service Unavailable Right Now
                </strong>
                LifeOS Pro subscriptions are currently unavailable right now while we update our payment gateways. Please check back later!
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center space-y-2 shadow-xs">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                Household Plan
              </span>
              <div className="text-3xl font-black text-emerald-600">
                {currencySymbol === "৳" ? "৳199" : "$1.99"}
                <span className="text-xs text-slate-500 font-normal"> / month</span>
              </div>
              <p className="text-[11px] text-slate-500">
                One subscription unlocks Pro for all members of <strong className="text-slate-900">{homeName}</strong>.
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <div className="flex items-center gap-2.5">
                <Check size={15} className="text-emerald-600" />
                <span>Full Device Desk Telemetry & GPU tracking</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check size={15} className="text-emerald-600" />
                <span>Unlimited PC pairing & activity history</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check size={15} className="text-emerald-600" />
                <span>Priority support & instant cloud syncing</span>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={() => {
                  showAlert(
                    "Pro Service Unavailable",
                    "LifeOS Pro subscription service is currently unavailable right now. Please check back later!"
                  );
                }}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3.5 rounded-2xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 border-0"
              >
                <AlertCircle size={16} className="text-amber-400" />
                <span>Pro Service Unavailable Right Now</span>
              </button>
              <button
                onClick={() => setShowProModal(false)}
                className="w-full bg-transparent text-slate-500 hover:text-slate-800 text-xs py-2 cursor-pointer border-none font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Quick Calculator Widget */}
      <QuickCalculatorModal
        isOpen={showQuickCalc}
        onClose={() => setShowQuickCalc(false)}
      />
    </div>
  );
}
