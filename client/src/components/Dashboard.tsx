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
  Monitor,
  Tag,
  Download,
  AlertCircle,
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
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

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

interface MonthlyBillConfig {
  monthId: string;
  rent: { [userId: string]: number };
  utilities: {
    wifi: number;
    electricity: number;
    gas: number;
    garbage: number;
    bashaUti: number;
    pani: number;
    bua: number;
    extra: number;
  };
  adjustments: Array<{
    user: string;
    prevUtilityDue: number;
    prevMealDue: number;
    utilityPayment: number;
    rentPayment: number;
    note?: string;
  }>;
  utilityNotes?: { [key: string]: string };
}

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
}

interface DeviceInfo {
  deviceId: string;
  owner: {
    name: string;
    email: string;
    role: string;
  } | null;
}

interface TelemetryRecord {
  _id: string;
  deviceId: string;
  timestamp: string;
  cpuUsage: number;
  ramUsage: number;
  uptime: number;
  activityBreakdown: {
    Coding: number;
    Gaming: number;
    Browsing: number;
    Other: number;
  };
}

export default function Dashboard() {
  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good morning";
    if (hr < 17) return "Good afternoon";
    return "Good evening";
  };

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "hardware" | "tracker" | "notepad" | "history"
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

  // Telemetry States
  const [devicesList, setDevicesList] = useState<DeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] =
    useState<string>("jashore-laptop");
  const [telemetryData, setTelemetryData] = useState<TelemetryRecord[] | null>(
    null,
  );
  const [telemetryLoading, setTelemetryLoading] = useState<boolean>(false);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);

  // Device Usage Tracking States
  const [consentStatus, setConsentStatus] = useState<{
    isActive: boolean;
    consentedAt: string | null;
  }>({ isActive: false, consentedAt: null });
  const [usageSummary, setUsageSummary] = useState<{
    totalHours: number;
    categoryBreakdown: Array<{ name: string; seconds: number; hours: number }>;
    deviceLedger: Array<{
      deviceId: string;
      deviceName: string;
      ownerName: string;
      usageHours: number;
      usagePercent: number;
    }>;
    period: string;
  } | null>(null);
  const [usageLoading, setUsageLoading] = useState<boolean>(false);
  const [usagePeriod, setUsagePeriod] = useState<"daily" | "monthly">("daily");
  const [untaggedApps, setUntaggedApps] = useState<
    Array<{
      appName: string;
      totalSeconds: number;
      totalHours: number;
      sessionCount: number;
      suggestedCategory: string | null;
    }>
  >([]);
  const [untaggedLoading, setUntaggedLoading] = useState<boolean>(false);
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);
  const [showTrackingSettings, setShowTrackingSettings] = useState<boolean>(false);
  const [showDownloadHelp, setShowDownloadHelp] = useState<boolean>(false);
  const [trackingIndicatorVisible, setTrackingIndicatorVisible] = useState<boolean>(false);

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

  // Dynamic Month States
  const [availableMonths, setAvailableMonths] = useState<string[]>([
    "July-2026",
    "June-2026",
  ]);
  const [isNewMonthModalOpen, setIsNewMonthModalOpen] =
    useState<boolean>(false);
  const [newMonthPrevMonthId, setNewMonthPrevMonthId] =
    useState<string>("July-2026");

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

  const fetchHomeDetails = async () => {
    try {
      const response = await api.get("/home/details");
      if (response.data.home) {
        setHomeData(response.data.home);
        setHomeName(response.data.home.name);
      }
    } catch (err) {
      console.error("Error fetching home details:", err);
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
    "dashboard" | "tracker" | "hardware" | "notepad" | "history" | null
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
            setActiveTab("tracker");
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

  // Fetch summary calculations
  useEffect(() => {
    fetchSummary();
  }, [monthId]);

  // Fetch list of unique devices in household
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await api.get<DeviceInfo[]>("/telemetry/info/devices");
        setDevicesList(response.data);
        if (response.data.length > 0) {
          // Default to the first found device ID
          setSelectedDeviceId(response.data[0].deviceId);
        }
      } catch (err) {
        console.error("Error fetching devices list:", err);
      }
    };

    fetchDevices();
  }, []);

  // Fetch telemetry logs for active device
  useEffect(() => {
    if (activeTab !== "hardware" || !selectedDeviceId) return;

    const fetchTelemetry = async () => {
      setTelemetryLoading(true);
      setTelemetryError(null);
      try {
        const response = await api.get<TelemetryRecord[]>(
          `/telemetry/${selectedDeviceId}`,
        );
        const sortedData = [...response.data].reverse();
        setTelemetryData(sortedData);
      } catch (err: any) {
        console.error("Error fetching telemetry:", err);
        setTelemetryError(err.message || "Failed to fetch telemetry logs.");
      } finally {
        setTelemetryLoading(false);
      }
    };

    fetchTelemetry();
  }, [activeTab, selectedDeviceId]);

  // Device Usage Tracking Functions
  const fetchConsentStatus = async () => {
    try {
      const response = await api.get("/device-consent/me");
      setConsentStatus({
        isActive: response.data.isActive,
        consentedAt: response.data.consent?.consentedAt || null,
      });
      setTrackingIndicatorVisible(response.data.isActive);
    } catch (err) {
      console.error("Error fetching consent status:", err);
    }
  };

  const fetchUsageSummary = async () => {
    if (!consentStatus.isActive) return;
    setUsageLoading(true);
    try {
      const response = await api.get("/device-usage/summary", {
        params: { period: usagePeriod },
      });
      setUsageSummary(response.data);
    } catch (err) {
      console.error("Error fetching usage summary:", err);
    } finally {
      setUsageLoading(false);
    }
  };

  const fetchUntaggedApps = async () => {
    if (!consentStatus.isActive) return;
    setUntaggedLoading(true);
    try {
      const response = await api.get("/device-usage/untagged");
      setUntaggedApps(response.data.apps);
    } catch (err) {
      console.error("Error fetching untagged apps:", err);
    } finally {
      setUntaggedLoading(false);
    }
  };

  const handleTagApp = async (appName: string, category: string) => {
    try {
      await api.post("/device-usage/categories/tag", { appName, category });
      await fetchUntaggedApps();
      await fetchUsageSummary();
    } catch (err: any) {
      showAlert(
        "Error",
        err.response?.data?.error || "Failed to tag app category",
      );
    }
  };

  const handleGeneratePairingCode = async () => {
    try {
      const response = await api.post("/devices/pair", {
        deviceName: `${currentUser?.name || "My"}'s Device`,
        os: navigator.platform,
      });
      showAlert(
        "Pairing Code Generated",
        `Your pairing code is: ${response.data.pairingCode}\n\nEnter this code in the LifeOS Agent on your device to link it. This code expires in 15 minutes.`,
      );
    } catch (err: any) {
      showAlert(
        "Error",
        err.response?.data?.error || "Failed to generate pairing code",
      );
    }
  };

  // Fetch consent status on mount and when user changes
  useEffect(() => {
    if (currentUser?.homeId) {
      fetchConsentStatus();
    }
  }, [currentUser]);

  // Fetch usage data when consent is active and tab is hardware
  useEffect(() => {
    if (activeTab === "hardware" && consentStatus.isActive) {
      fetchUsageSummary();
      fetchUntaggedApps();
    }
  }, [activeTab, consentStatus.isActive, usagePeriod]);

  // Process data for the activity breakdown PieChart
  const getPieData = () => {
    if (!telemetryData || telemetryData.length === 0) return [];
    let coding = 0,
      gaming = 0,
      browsing = 0,
      other = 0;
    telemetryData.forEach((item) => {
      coding += item.activityBreakdown?.Coding || 0;
      gaming += item.activityBreakdown?.Gaming || 0;
      browsing += item.activityBreakdown?.Browsing || 0;
      other += item.activityBreakdown?.Other || 0;
    });
    return [
      { name: "Coding", value: coding },
      { name: "Gaming", value: gaming },
      { name: "Browsing", value: browsing },
      { name: "Other", value: other },
    ].filter((item) => item.value > 0);
  };

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  const pieData = getPieData();
  const PIE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#64748b"];

  if (authLoading) {
    return (
      <div className="min-h-screen w-screen bg-[#FAF6F0] flex flex-col items-center justify-center text-[#4A3728]">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#C4634F] mx-auto" />
          <p className="text-xs font-semibold tracking-wider uppercase text-[#8C7662]">
            Loading Cozy Ledger...
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
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/30">
              <Home size={20} />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none tracking-wide text-white font-serif">
                LifeOS
              </h1>
              <span className="text-[10px] text-indigo-400 font-extrabold tracking-wider uppercase">
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
                  ? "bg-indigo-600/15 text-indigo-400 border-l-4 border-indigo-500"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <Home size={18} />
              <span>Welcome Home</span>
            </button>
            <button
              id="sidebar-tab-tracker"
              onClick={() => setActiveTab("tracker")}
              className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === "tracker"
                  ? "bg-indigo-600/15 text-indigo-400 border-l-4 border-indigo-500"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <Utensils size={18} />
              <span>Kitchen & Meals</span>
              {tourStarted && tourPointerTab === "tracker" && (
                <span className="pointer-events-none absolute -right-1 top-1/2 -translate-y-1/2 text-slate-200/65 drop-shadow-[0_0_8px_rgba(148,163,184,0.28)] animate-bounce">
                  <MousePointer2 size={18} />
                </span>
              )}
            </button>
            <button
              id="sidebar-tab-hardware"
              onClick={() => setActiveTab("hardware")}
              className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === "hardware"
                  ? "bg-indigo-650/15 text-indigo-400 border-l-4 border-indigo-500"
                  : "text-slate-400 hover:bg-slate-850 hover:text-slate-200"
              }`}
            >
              <Laptop size={18} />
              <span>Device Desk</span>
              {tourStarted && tourPointerTab === "hardware" && (
                <span className="pointer-events-none absolute -right-1 top-1/2 -translate-y-1/2 text-slate-200/65 drop-shadow-[0_0_8px_rgba(148,163,184,0.28)] animate-bounce">
                  <MousePointer2 size={18} />
                </span>
              )}
            </button>
            <button
              id="sidebar-tab-notepad"
              onClick={() => setActiveTab("notepad")}
              className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === "notepad"
                  ? "bg-indigo-650/15 text-indigo-400 border-l-4 border-indigo-500"
                  : "text-slate-400 hover:bg-slate-850 hover:text-slate-200"
              }`}
            >
              <StickyNote size={18} />
              <span>House Notes</span>
              {tourStarted && tourPointerTab === "notepad" && (
                <span className="pointer-events-none absolute -right-1 top-1/2 -translate-y-1/2 text-slate-200/65 drop-shadow-[0_0_8px_rgba(148,163,184,0.28)] animate-bounce">
                  <MousePointer2 size={18} />
                </span>
              )}
            </button>
            <button
              id="sidebar-tab-history"
              onClick={() => setActiveTab("history")}
              className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === "history"
                  ? "bg-indigo-650/15 text-indigo-400 border-l-4 border-indigo-500"
                  : "text-slate-400 hover:bg-slate-850 hover:text-slate-200"
              }`}
            >
              <History size={18} />
              <span>Change History</span>
              {tourStarted && tourPointerTab === "history" && (
                <span className="pointer-events-none absolute -right-1 top-1/2 -translate-y-1/2 text-slate-200/65 drop-shadow-[0_0_8px_rgba(148,163,184,0.28)] animate-bounce">
                  <MousePointer2 size={18} />
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Current Session User / Roommate Invites */}
        <div className="p-4 border-t border-slate-800 space-y-4">
          {/* User profile */}
          <div className="p-3 rounded-2xl bg-indigo-950/20 border border-indigo-900/35 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#C4634F] flex items-center justify-center font-serif font-black text-white text-sm shadow-md shrink-0">
                {currentUser?.name
                  ? currentUser.name.substring(0, 2).toUpperCase()
                  : "??"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                  Logged In As
                </p>
                <p className="text-xs font-bold text-white truncate mt-1">
                  {currentUser?.name}
                </p>
                <p className="text-[9px] text-[#8A9A7E] font-medium mt-0.5 font-mono">
                  @{currentUser?.nickname}
                </p>
              </div>
              <button
                onClick={handleLogout}
                title="Logout"
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-450 transition-all cursor-pointer border-none bg-transparent"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>

          {/* Admin invite roomies */}
          {currentUser?.role === "admin" && (
            <form
              onSubmit={handleInviteRoommate}
              className="space-y-2 p-3 bg-slate-900/30 border border-slate-800 rounded-2xl"
            >
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                Invite Roommate
              </p>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Nickname"
                  value={inviteNickname}
                  onChange={(e) => setInviteNickname(e.target.value)}
                  className="bg-slate-950 border border-slate-800 focus:border-indigo-650 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none w-full font-sans font-bold"
                  required
                />
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-[10px] px-2.5 rounded-lg transition-all cursor-pointer shrink-0"
                >
                  {inviteLoading ? "..." : "Invite"}
                </button>
              </div>
            </form>
          )}

          {/* Roommates & Bill Config Permission Control */}
          {homeData?.members && homeData.members.length > 1 && (
            <div className="p-3 bg-slate-900/30 border border-slate-800 rounded-2xl space-y-2 mt-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
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
                      className="flex justify-between items-center gap-2 text-[11px] py-1.5 border-b border-slate-850 last:border-b-0"
                    >
                      <span className="text-slate-300 font-medium truncate font-sans">
                        @{member.nickname}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-bold tracking-wider uppercase transition-colors duration-200 ${hasControl ? "text-indigo-400" : "text-slate-500"}`}
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
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none items-center ${
                            hasControl ? "bg-indigo-600" : "bg-slate-800"
                          } ${!canToggle ? "opacity-40 cursor-not-allowed" : "hover:bg-slate-750"}`}
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
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/40 backdrop-blur-md shrink-0">
          {["notepad", "history"].includes(activeTab) ? (
            <div className="flex items-center gap-4 bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-700 w-80 animate-fade-in">
              <Search size={16} className="text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab === "notepad" ? "notes" : "history logs"}...`}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="bg-transparent border-none text-xs text-slate-200 focus:outline-none w-full font-medium"
              />
            </div>
          ) : (
            <div className="w-80" />
          )}

          <div id="top-bar-controls" className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-slate-300">
              <Home size={16} className="text-indigo-400" />
              <span className="text-xs font-bold text-slate-450 uppercase tracking-widest">
                {homeName}
              </span>
            </div>

            <div className="flex items-center gap-2 text-slate-300">
              <Calendar size={16} className="text-indigo-400" />
              <select
                value={monthId}
                onChange={(e) => setMonthId(e.target.value)}
                disabled={activeTab === "hardware"}
                className="bg-slate-800 text-xs font-semibold text-slate-200 focus:outline-none border border-slate-700 rounded-lg px-2.5 py-1 uppercase tracking-wider cursor-pointer disabled:opacity-50"
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
                  className="flex items-center gap-1 bg-emerald-650 hover:bg-emerald-750 text-xs font-bold text-white px-3 py-1.5 rounded-lg shadow transition-all cursor-pointer animate-fade-in"
                  title="Create a new month with carried forward dues"
                >
                  <Plus size={14} />
                  <span>+ New Month</span>
                </button>

                <button
                  onClick={() => setIsConfigModalOpen(true)}
                  className="flex items-center gap-1.5 bg-indigo-650 hover:bg-indigo-750 text-xs font-bold text-white px-3 py-1.5 rounded-lg shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
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
                className="relative p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
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
                <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-4 z-50 space-y-3 text-left">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-white">
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
                        className="text-[10px] text-indigo-400 hover:text-indigo-305 transition-colors font-bold cursor-pointer bg-transparent border-0"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic py-2 text-center">
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
                          className={`p-2.5 rounded-lg border text-[11px] cursor-pointer transition-all ${
                            n.read
                              ? "bg-slate-950/20 border-slate-850 text-slate-500"
                              : "bg-indigo-950/20 border-indigo-900/30 text-white font-medium hover:bg-indigo-950/40"
                          }`}
                        >
                          <p>{n.text}</p>
                          <span className="text-[9px] text-slate-500 mt-1 block">
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
          {/* Hardware & Telemetry View */}
          {activeTab === "hardware" && (
            <div id="device-desk-container" className="space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight font-serif">
                    Device Desk
                  </h2>
                  <p className="text-slate-400 text-sm">
                    Track application usage and device activity across your household.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {trackingIndicatorVisible && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        Tracking Active
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => setShowTrackingSettings(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-semibold text-slate-300 cursor-pointer transition-all"
                  >
                    <Sliders size={14} />
                    Settings
                  </button>
                </div>
              </div>

              {/* Consent Required State */}
              {!consentStatus.isActive && (
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center space-y-6">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-indigo-600/20 text-indigo-400 mx-auto">
                    <Monitor size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white font-serif">
                      Enable Device Tracking
                    </h3>
                    <p className="text-slate-400 text-sm max-w-md mx-auto">
                      Track which applications are used and for how long across your household devices. 
                      GPU data helps categorize gaming vs work activities.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => setShowConsentModal(true)}
                      className="flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer transition-all"
                    >
                      Enable Tracking
                    </button>
                    <button
                      onClick={handleGeneratePairingCode}
                      className="flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl cursor-pointer transition-all"
                    >
                      <Download size={14} />
                      Get Pairing Code
                    </button>
                  </div>
                  <button
                    onClick={() => setShowDownloadHelp(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                  >
                    Installation help for unsigned apps
                  </button>
                  <div className="bg-slate-800/30 rounded-xl px-4 py-3 border border-slate-800 text-xs text-slate-400 leading-relaxed max-w-lg mx-auto">
                    <p className="font-semibold text-slate-300 mb-1">We track:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>Application/process names and duration</li>
                      <li>GPU utilization (for category suggestions)</li>
                    </ul>
                    <p className="font-semibold text-slate-300 mt-2 mb-1">Never tracked:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>Window titles, URLs, browser history, screen content</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Active Tracking State */}
              {consentStatus.isActive && (
                <>
                  {/* Period Toggle */}
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
                    <button
                      onClick={() => setUsagePeriod("daily")}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        usagePeriod === "daily"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setUsagePeriod("monthly")}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        usagePeriod === "monthly"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      This Month
                    </button>
                  </div>

                  {usageLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                      <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                      <p className="text-slate-400 text-sm font-medium">
                        Loading usage data...
                      </p>
                    </div>
                  ) : usageSummary ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Category Breakdown Chart */}
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                        <div>
                          <h3 className="font-bold text-sm text-white">
                            Application Share
                          </h3>
                          <span className="text-[10px] text-slate-500 block">
                            {usagePeriod === "daily" ? "Today's" : "This month's"} category breakdown
                          </span>
                        </div>
                        {usageSummary.categoryBreakdown.length > 0 ? (
                          <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={usageSummary.categoryBreakdown.map((item) => ({
                                    name: item.name,
                                    value: item.hours,
                                  }))}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={45}
                                  outerRadius={65}
                                  paddingAngle={5}
                                  dataKey="value"
                                >
                                  {usageSummary.categoryBreakdown.map((_, index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                                    />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value) => [`${value.toFixed(1)} hrs`, "Duration"]} />
                                <Legend layout="horizontal" align="center" verticalAlign="bottom" />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs py-8">
                            No usage data yet
                          </div>
                        )}
                        <div className="text-center">
                          <span className="text-2xl font-black text-indigo-400">
                            {usageSummary.totalHours.toFixed(1)}
                          </span>
                          <span className="text-xs text-slate-500 block uppercase tracking-wider">
                            Total Hours
                          </span>
                        </div>
                      </div>

                      {/* Device Usage Ledger */}
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                        <div>
                          <h3 className="font-bold text-sm text-white">
                            Device Usage Ledger
                          </h3>
                          <span className="text-[10px] text-slate-500 block">
                            Usage by device across household
                          </span>
                        </div>
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {usageSummary.deviceLedger.length > 0 ? (
                            usageSummary.deviceLedger.map((dev) => (
                              <div
                                key={dev.deviceId}
                                className="flex justify-between items-center bg-slate-800/35 p-3 rounded-xl border border-slate-800/50"
                              >
                                <div>
                                  <span className="font-semibold text-xs text-white block uppercase tracking-wider">
                                    {dev.deviceName || dev.deviceId}
                                  </span>
                                  <span className="text-[10px] text-indigo-400 capitalize">
                                    {dev.ownerName}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-bold text-indigo-400 block">
                                    {dev.usageHours.toFixed(1)} hrs
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    {dev.usagePercent.toFixed(1)}% share
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-slate-500 text-xs py-4 text-center">
                              No devices with usage data
                            </p>
                          )}
                        </div>
                      </div>

                      {/* New Apps to Tag */}
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                        <div>
                          <h3 className="font-bold text-sm text-white flex items-center gap-2">
                            <Tag size={14} />
                            New Apps This Week
                          </h3>
                          <span className="text-[10px] text-slate-500 block">
                            Tag apps to categorize household usage
                          </span>
                        </div>
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {untaggedLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 size={16} className="animate-spin text-slate-500" />
                            </div>
                          ) : untaggedApps.length > 0 ? (
                            untaggedApps.slice(0, 5).map((app) => (
                              <div
                                key={app.appName}
                                className="bg-slate-800/35 p-3 rounded-xl border border-slate-800/50 space-y-2"
                              >
                                <div className="flex justify-between items-start">
                                  <span className="font-semibold text-xs text-white block">
                                    {app.appName}
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    {app.totalHours.toFixed(1)} hrs
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  <select
                                    value={app.suggestedCategory || ""}
                                    onChange={(e) => handleTagApp(app.appName, e.target.value)}
                                    className="flex-1 bg-slate-900 text-xs text-slate-300 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer"
                                  >
                                    <option value="">Select category...</option>
                                    <option value="Gaming">Gaming</option>
                                    <option value="Work">Work</option>
                                    <option value="Entertainment">Entertainment</option>
                                    <option value="Other">Other</option>
                                  </select>
                                </div>
                                {app.suggestedCategory && (
                                  <span className="text-[10px] text-amber-400">
                                    Suggested: {app.suggestedCategory} (GPU &gt; 50%)
                                  </span>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-slate-500 text-xs py-4 text-center">
                              All apps are categorized
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 gap-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
                      <AlertCircle size={32} className="text-slate-500" />
                      <h3 className="text-lg font-bold text-white font-serif">
                        No Usage Data Yet
                      </h3>
                      <p className="text-slate-400 text-sm text-center max-w-md">
                        Install the LifeOS Agent on your devices and enter the pairing code to start tracking usage.
                      </p>
                      <button
                        onClick={handleGeneratePairingCode}
                        className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer transition-all"
                      >
                        <Download size={14} />
                        Get Pairing Code
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {(activeTab as any) === "hardware-disabled" && (
            <div className="space-y-8">
              {/* Heading and Device Selector */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight font-serif">
                    Device Desk
                  </h2>
                  <p className="text-slate-400 text-sm">
                    Check active computer units and system health in the house.
                  </p>
                </div>

                <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5">
                  <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                    Select Device:
                  </span>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="bg-slate-800 text-xs font-bold text-indigo-400 focus:outline-none border border-slate-700 rounded px-2.5 py-1.5 cursor-pointer uppercase tracking-widest"
                  >
                    {devicesList.map((dev) => (
                      <option key={dev.deviceId} value={dev.deviceId}>
                        {dev.deviceId} {dev.owner ? `(${dev.owner.name})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {telemetryLoading ? (
                <div className="flex flex-col items-center justify-center h-96 gap-4">
                  <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                  <p className="text-slate-400 text-sm font-semibold">
                    Listening for home devices...
                  </p>
                </div>
              ) : telemetryError ? (
                <div className="flex flex-col items-center justify-center h-96 gap-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
                  <span className="text-4xl">🔌</span>
                  <h3 className="text-lg font-bold text-white font-serif">
                    Device Desk is Quiet
                  </h3>
                  <p className="text-slate-400 text-sm text-center max-w-md">
                    The telemetry database is offline right now. Enjoy the
                    peaceful silence, or click below to check again.
                  </p>
                  <button
                    onClick={() => setSelectedDeviceId(selectedDeviceId)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold mt-2 transition-all cursor-pointer"
                  >
                    Try Listening Again
                  </button>
                </div>
              ) : telemetryData && telemetryData.length > 0 ? (
                <>
                  {/* Uptime and Status Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                        Device Uptime
                      </span>
                      <h3 className="text-2xl font-extrabold mt-2 text-emerald-400">
                        {formatUptime(
                          telemetryData[telemetryData.length - 1].uptime,
                        )}
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-2">
                        Active boot duration
                      </p>
                    </div>

                    <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                        Current CPU Load
                      </span>
                      <h3 className="text-2xl font-extrabold mt-2 text-rose-400">
                        {telemetryData[
                          telemetryData.length - 1
                        ].cpuUsage.toFixed(1)}
                        %
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-2">
                        Latest telemetry snapshot
                      </p>
                    </div>

                    <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                        Current RAM Load
                      </span>
                      <h3 className="text-2xl font-extrabold mt-2 text-indigo-400">
                        {telemetryData[
                          telemetryData.length - 1
                        ].ramUsage.toFixed(1)}
                        %
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-2">
                        Latest telemetry snapshot
                      </p>
                    </div>

                    <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                        System State
                      </span>
                      <h3 className="text-2xl font-extrabold mt-2 text-emerald-400">
                        ONLINE
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-2">
                        Receiving telemetry logs
                      </p>
                    </div>
                  </div>

                  {/* Two-Column Graphs */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Line Chart */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:col-span-2 shadow-xl space-y-6">
                      <div>
                        <h3 className="font-bold text-lg text-white">
                          System Utilization Over Time
                        </h3>
                        <p className="text-xs text-slate-400">
                          Real-time load statistics tracking CPU vs memory usage
                          cycles.
                        </p>
                      </div>

                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={telemetryData}
                            margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#1e293b"
                            />
                            <XAxis
                              dataKey="timestamp"
                              stroke="#94a3b8"
                              fontSize={10}
                              tickLine={false}
                              tickFormatter={(tick) =>
                                new Date(tick).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })
                              }
                            />
                            <YAxis
                              stroke="#94a3b8"
                              fontSize={10}
                              domain={[0, 100]}
                              tickLine={false}
                              axisLine={false}
                            />
                            <Tooltip
                              labelFormatter={(label) =>
                                new Date(label).toLocaleString()
                              }
                            />
                            <Legend verticalAlign="top" height={36} />
                            <Line
                              type="monotone"
                              dataKey="cpuUsage"
                              name="CPU Usage (%)"
                              stroke="#C4634F"
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 6 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="ramUsage"
                              name="RAM Usage (%)"
                              stroke="#6366f1"
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Pie Chart & Comparative Hours */}
                    <div className="space-y-8 flex flex-col justify-between">
                      {/* Pie Chart */}
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex-1 space-y-4 flex flex-col justify-between">
                        <div>
                          <h3 className="font-bold text-sm text-white">
                            Device Application Share
                          </h3>
                          <span className="text-[10px] text-slate-500 block">
                            Active window category share
                          </span>
                        </div>

                        {pieData.length > 0 ? (
                          <div className="h-44 w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={pieData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={45}
                                  outerRadius={65}
                                  paddingAngle={5}
                                  dataKey="value"
                                >
                                  {pieData.map((_, index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={
                                        PIE_COLORS[index % PIE_COLORS.length]
                                      }
                                    />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(value) => [
                                    `${value} logs`,
                                    "Duration",
                                  ]}
                                />
                                <Legend
                                  layout="horizontal"
                                  align="center"
                                  verticalAlign="bottom"
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
                            No application logs found.
                          </div>
                        )}
                      </div>

                      {/* Device Usage Ledger */}
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                        <div>
                          <h3 className="font-bold text-sm text-white">
                            Device Usage Ledger
                          </h3>
                          <span className="text-[10px] text-slate-500 block">
                            Total active usage hours for each registered device
                          </span>
                        </div>

                        <div className="space-y-3">
                          {summaryData?.deviceUsages &&
                          summaryData.deviceUsages.length > 0 ? (
                            summaryData.deviceUsages.map((dev) => (
                              <div
                                key={dev.deviceId}
                                className="flex justify-between items-center bg-slate-800/35 p-3 rounded-xl border border-slate-800/50"
                              >
                                <div>
                                  <span className="font-semibold text-xs text-white block uppercase tracking-wider">
                                    {dev.deviceId}
                                  </span>
                                  <span className="text-[10px] text-indigo-400 capitalize">
                                    Owner: {dev.ownerName}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-bold text-indigo-400 block">
                                    {dev.usageHours.toFixed(1)} hrs
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    {dev.usagePercent.toFixed(1)}% share
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-slate-500 text-xs py-4 text-center">
                              No active devices right now — all quiet in the
                              house.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-96 gap-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
                  <span className="text-4xl">🔌</span>
                  <h3 className="text-lg font-bold text-white font-serif">
                    Device Desk is Offline
                  </h3>
                  <p className="text-slate-400 text-sm text-center max-w-sm">
                    No telemetry records exist for this device yet. Start the
                    python telemetry agent to share health snapshots.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Daily Tracker View */}
          {activeTab === "tracker" && (
            <div className="space-y-6">
              {/* Header section */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight font-serif">
                    Kitchen & Meals
                  </h2>
                  <p className="text-slate-400 text-sm">
                    Log daily roommate meal counts and shared grocery expenses.
                  </p>
                </div>

                <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5">
                  <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
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
                    className="bg-slate-800 text-indigo-400 text-xs font-bold w-16 text-center border border-slate-700 rounded-lg py-1 px-1.5 focus:outline-none"
                  />
                </div>
              </div>

              {/* Sub-tabs toggles */}
              <div
                id="meals-tabs-container"
                className="flex gap-4 border-b border-slate-800 pb-px"
              >
                <button
                  onClick={() => setTrackerSubTab("meals")}
                  className={`pb-3 font-semibold text-sm transition-all relative cursor-pointer ${
                    trackerSubTab === "meals"
                      ? "text-indigo-400 border-b-2 border-indigo-500 font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Meals Eaten
                </button>
                <button
                  onClick={() => setTrackerSubTab("bazar")}
                  className={`pb-3 font-semibold text-sm transition-all relative cursor-pointer ${
                    trackerSubTab === "bazar"
                      ? "text-amber-500 border-b-2 border-amber-550 font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Grocery Bills
                </button>
                <button
                  onClick={() => setTrackerSubTab("deposits")}
                  className={`pb-3 font-semibold text-sm transition-all relative cursor-pointer ${
                    trackerSubTab === "deposits"
                      ? "text-emerald-450 border-b-2 border-emerald-500 font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Meal Deposits
                </button>
                <button
                  onClick={() => setTrackerSubTab("wallet")}
                  className={`pb-3 font-semibold text-sm transition-all relative cursor-pointer ${
                    trackerSubTab === "wallet"
                      ? "text-indigo-400 border-b-2 border-indigo-500 font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Grocery Wallet
                </button>
              </div>

              {trackerLoading ? (
                <div className="flex flex-col items-center justify-center h-96 gap-4">
                  <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                  <p className="text-slate-400 text-sm font-medium">
                    Opening the kitchen cabinets...
                  </p>
                </div>
              ) : trackerError ? (
                <div className="flex flex-col items-center justify-center h-96 gap-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
                  <span className="text-4xl">🍳</span>
                  <h3 className="text-lg font-bold text-white font-serif">
                    Kitchen Snag
                  </h3>
                  <p className="text-slate-400 text-sm text-center max-w-md">
                    We couldn't open the kitchen ledger. Let's try checking the
                    cupboards again.
                  </p>
                </div>
              ) : trackerData ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                  {trackerSubTab === "meals" ? (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="font-bold text-base text-white">
                            Daily Meals Consumed
                          </h3>
                          <p className="text-xs text-slate-400">
                            Click (+) or (-) to update daily meals.
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                            Total Combined Meals
                          </span>
                          <span className="text-xl font-black text-indigo-400">
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

                      <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-[500px]">
                        <table className="w-full text-left border-collapse min-w-[600px] sticky-header">
                          <thead className="bg-slate-950/95 sticky top-0 z-10">
                            <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
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
                          <tbody className="divide-y divide-slate-800/80">
                            {trackerData.meals.map((item) => (
                              <tr
                                key={item.day}
                                className="hover:bg-slate-800/20 text-slate-200 text-xs border-b border-slate-800/40"
                              >
                                <td className="py-2.5 px-4 font-bold text-slate-400 text-center bg-slate-950/20">
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
                                          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center transition-all focus:outline-none"
                                        >
                                          -
                                        </button>
                                        <span
                                          className={`w-8 font-semibold text-center ${count > 0 ? "text-indigo-400 font-bold" : "text-slate-500"}`}
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
                                          className="w-6 h-6 rounded bg-slate-800 hover:bg-indigo-650 hover:text-white text-indigo-400 font-bold flex items-center justify-center transition-all focus:outline-none"
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
                            <tr className="bg-slate-950/60 border-t border-slate-800 font-bold text-slate-200 text-xs">
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
                                    className="py-3 px-4 text-center text-indigo-400 font-extrabold text-sm"
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
                          <h3 className="font-bold text-base text-white">
                            Daily Bazar Expenses
                          </h3>
                          <p className="text-xs text-slate-400">
                            Enter amounts spent on bazar for each roommate.
                            Updates auto-save on blur.
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                            Total Combined Bazar Cost
                          </span>
                          <span className="text-xl font-black text-amber-400">
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

                      <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-[500px]">
                        <table className="w-full text-left border-collapse min-w-[600px] sticky-header">
                          <thead className="bg-slate-950/95 sticky top-0 z-10">
                            <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
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
                          <tbody className="divide-y divide-slate-800/80">
                            {trackerData.bazar.map((item) => (
                              <tr
                                key={item.day}
                                className="hover:bg-slate-800/20 text-slate-200 text-xs border-b border-slate-800/40"
                              >
                                <td className="py-2 px-4 font-bold text-slate-400 text-center bg-slate-950/20">
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
                                    className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded px-2.5 py-1 w-full focus:outline-none focus:border-amber-500 font-semibold cursor-pointer"
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
                                        <div className="flex items-center justify-center">
                                          <span className="text-slate-500 mr-0.5 text-[10px] font-bold">
                                            ৳
                                          </span>
                                          <input
                                            id={`bazar-input-${item.day}-${u._id}`}
                                            type="number"
                                            defaultValue={
                                              costVal === 0 ? "" : costVal
                                            }
                                            placeholder="0"
                                            onBlur={(e) =>
                                              handleBazarChange(
                                                item.day,
                                                u._id,
                                                e.target.value,
                                              )
                                            }
                                            className="bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded px-2 py-1 w-20 text-center focus:outline-none focus:border-amber-500 font-semibold transition-all text-xs text-white"
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
                                          className={`p-1 rounded transition-all cursor-pointer ${
                                            hasNote
                                              ? "text-amber-500 bg-amber-500/10"
                                              : "text-slate-500 hover:text-slate-205 hover:bg-slate-800"
                                          }`}
                                          title={
                                            item.notes?.[u._id] || "Add note"
                                          }
                                        >
                                          <MessageSquare size={12} />
                                        </button>
                                      </div>

                                      {isCommentOpen && (
                                        <div className="absolute left-1/2 -translate-x-1/2 mt-2 bg-slate-900 border border-slate-800 rounded-xl p-2.5 shadow-xl z-20 w-48 text-left space-y-2">
                                          <label className="text-[9px] uppercase font-bold text-slate-400 block">
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
                                            className="bg-slate-800 border border-slate-700 rounded p-1.5 w-full text-xs text-white focus:outline-none focus:border-amber-500 font-sans"
                                          />
                                          <div className="flex justify-end gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setActiveCommentCell(null)
                                              }
                                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] rounded font-semibold text-slate-350"
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
                                              className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-[10px] rounded font-semibold text-white"
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
                            <tr className="bg-slate-950/60 border-t border-slate-800 font-bold text-slate-200 text-xs">
                              <td className="py-3 px-4 text-center uppercase tracking-wider">
                                Total
                              </td>
                              <td className="py-3 px-4 text-center text-slate-500 font-medium italic">
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
                                    className="py-3 px-4 text-center text-amber-400 font-extrabold text-sm"
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
                          <h3 className="font-bold text-base text-white">
                            Daily Meal Deposits (Given for Meal)
                          </h3>
                          <p className="text-xs text-slate-400">
                            Enter deposits made by each roommate for meals.
                            Updates auto-save on blur.
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                            Total Combined Deposits
                          </span>
                          <span className="text-xl font-black text-emerald-400">
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

                      <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-[500px]">
                        <table className="w-full text-left border-collapse min-w-[600px] sticky-header">
                          <thead className="bg-slate-950/95 sticky top-0 z-10">
                            <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
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
                          <tbody className="divide-y divide-slate-800/80">
                            {trackerData.deposits.map((item) => (
                              <tr
                                key={item.day}
                                className="hover:bg-slate-800/20 text-slate-200 text-xs border-b border-slate-800/40"
                              >
                                <td className="py-2 px-4 font-bold text-slate-400 text-center bg-slate-950/20">
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
                                        <div className="flex items-center justify-center">
                                          <span className="text-slate-500 mr-0.5 text-[10px] font-bold">
                                            ৳
                                          </span>
                                          <input
                                            id={`deposit-input-${item.day}-${u._id}`}
                                            type="number"
                                            defaultValue={
                                              depVal === 0 ? "" : depVal
                                            }
                                            placeholder="0"
                                            onBlur={(e) =>
                                              handleDepositChange(
                                                item.day,
                                                u._id,
                                                e.target.value,
                                              )
                                            }
                                            className="bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded px-2 py-1 w-20 text-center focus:outline-none focus:border-emerald-500 font-semibold transition-all text-xs text-white"
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
                                          className={`p-1 rounded transition-all cursor-pointer ${
                                            hasNote
                                              ? "text-emerald-400 bg-emerald-400/10"
                                              : "text-slate-500 hover:text-slate-205 hover:bg-slate-800"
                                          }`}
                                          title={
                                            item.notes?.[u._id] || "Add note"
                                          }
                                        >
                                          <MessageSquare size={12} />
                                        </button>
                                      </div>

                                      {isCommentOpen && (
                                        <div className="absolute left-1/2 -translate-x-1/2 mt-2 bg-slate-900 border border-slate-800 rounded-xl p-2.5 shadow-xl z-20 w-48 text-left space-y-2">
                                          <label className="text-[9px] uppercase font-bold text-slate-400 block">
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
                                            className="bg-slate-800 border border-slate-700 rounded p-1.5 w-full text-xs text-white focus:outline-none focus:border-emerald-500 font-sans"
                                          />
                                          <div className="flex justify-end gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setActiveCommentCell(null)
                                              }
                                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] rounded font-semibold text-slate-350"
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
                                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-[10px] rounded font-semibold text-white"
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
                            <tr className="bg-slate-950/60 border-t border-slate-800 font-bold text-slate-200 text-xs">
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
                                    className="py-3 px-4 text-center text-emerald-400 font-extrabold text-sm"
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
                              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-md">
                                <span className="text-xs font-semibold text-slate-400 uppercase">
                                  Total House Deposits
                                </span>
                                <h3 className="text-2xl font-bold mt-2 text-emerald-400 font-serif">
                                  ৳{totalHouseDeposits.toFixed(2)}
                                </h3>
                                <p className="text-[10px] text-slate-500 mt-1">
                                  Total cash collected from everyone
                                </p>
                              </div>
                              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-md">
                                <span className="text-xs font-semibold text-slate-400 uppercase">
                                  Total Spent on Bazar
                                </span>
                                <h3 className="text-2xl font-bold mt-2 text-amber-500 font-serif">
                                  ৳{totalHouseSpent.toFixed(2)}
                                </h3>
                                <p className="text-[10px] text-slate-500 mt-1">
                                  Total cost of grocery items purchased
                                </p>
                              </div>
                              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-md">
                                <span className="text-xs font-semibold text-slate-400 uppercase">
                                  Total Remaining Cash
                                </span>
                                <h3 className="text-2xl font-bold mt-2 text-indigo-400 font-serif">
                                  ৳{totalHouseRemaining.toFixed(2)}
                                </h3>
                                <p className="text-[10px] text-slate-500 mt-1">
                                  Cash in hand available for upcoming trips
                                </p>
                              </div>
                            </div>
                          );
                        })()}

                      {/* Grid Layout: Record Transfer Form on Left/Top, Summary on Right/Top */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Form */}
                        <div className="bg-slate-950/40 p-6 border border-slate-800 rounded-2xl space-y-4">
                          <h3 className="font-bold text-base text-white">
                            Record Cash Transfer
                          </h3>
                          <p className="text-xs text-slate-400">
                            Log when a roommate takes cash from another to fund
                            a bazar trip.
                          </p>
                          <form
                            id="cash-transfer-form"
                            onSubmit={handleAddTransfer}
                            className="space-y-4"
                          >
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                                Taken From (Giver)
                              </label>
                              <select
                                value={walletFrom}
                                onChange={(e) => setWalletFrom(e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded px-2.5 py-1.5 w-full focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer"
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
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                                Given To (Taker)
                              </label>
                              <select
                                value={walletTo}
                                onChange={(e) => setWalletTo(e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded px-2.5 py-1.5 w-full focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer"
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
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                                Amount (৳)
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1.5 text-xs text-slate-500 font-bold">
                                  ৳
                                </span>
                                <input
                                  type="number"
                                  placeholder="0.00"
                                  value={walletAmount}
                                  onChange={(e) =>
                                    setWalletAmount(e.target.value)
                                  }
                                  className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded pl-7 pr-3 py-1.5 w-full focus:outline-none focus:border-indigo-500 font-semibold text-white"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                                Note / Context
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. For Friday Bazar"
                                value={walletNote}
                                onChange={(e) => setWalletNote(e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded px-3 py-1.5 w-full focus:outline-none focus:border-indigo-500 text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                                Transfer Date
                              </label>
                              <input
                                type="date"
                                value={walletDate}
                                onChange={(e) => setWalletDate(e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded px-3 py-1.5 w-full focus:outline-none focus:border-indigo-500 text-white cursor-pointer"
                              />
                            </div>
                            <button
                              type="submit"
                              className="bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white py-2 px-4 rounded-xl w-full transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
                            >
                              Record Transfer
                            </button>
                          </form>
                        </div>

                        {/* Summary */}
                        <div className="lg:col-span-2 bg-slate-950/20 p-6 border border-slate-800 rounded-2xl space-y-4">
                          <div>
                            <h3 className="font-bold text-base text-white">
                              Wallet Summary
                            </h3>
                            <p className="text-xs text-slate-400">
                              Current cash-in-hand adjustments computed from
                              transfers & spending.
                            </p>
                          </div>
                          <div className="overflow-x-auto rounded-xl border border-slate-800">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                                  <th className="py-2.5 px-3">Roommate</th>
                                  <th className="py-2.5 px-3 text-right text-emerald-400">
                                    Meal Deposits
                                  </th>
                                  <th className="py-2.5 px-3 text-right text-teal-400">
                                    Received (Taker)
                                  </th>
                                  <th className="py-2.5 px-3 text-right text-indigo-400">
                                    Given (Giver)
                                  </th>
                                  <th className="py-2.5 px-3 text-right text-amber-400">
                                    Bazar Spent
                                  </th>
                                  <th className="py-2.5 px-3 text-right">
                                    Cash Balance
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/80">
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
                                      className="hover:bg-slate-850/40 text-slate-200"
                                    >
                                      <td className="py-3.5 px-3 font-semibold text-white">
                                        {summary.name}
                                      </td>
                                      <td className="py-3.5 px-3 text-right font-medium text-emerald-400">
                                        ৳{(summary.deposits || 0).toFixed(2)}
                                      </td>
                                      <td className="py-3.5 px-3 text-right font-medium text-teal-400">
                                        ৳{summary.received.toFixed(2)}
                                      </td>
                                      <td className="py-3.5 px-3 text-right font-medium text-indigo-400">
                                        ৳{summary.given.toFixed(2)}
                                      </td>
                                      <td className="py-3.5 px-3 text-right font-medium text-amber-400">
                                        ৳{summary.spent.toFixed(2)}
                                      </td>
                                      <td
                                        className={`py-3.5 px-3 text-right font-bold ${balance >= 0 ? "text-emerald-400" : "text-rose-450"}`}
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
                      <div className="bg-slate-950/20 p-6 border border-slate-800 rounded-2xl space-y-4">
                        <h3 className="font-bold text-base text-white">
                          Transfer Transaction History
                        </h3>
                        <div className="overflow-x-auto rounded-xl border border-slate-800">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
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
                            <tbody className="divide-y divide-slate-800/80">
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
                                      className="hover:bg-slate-850/40 text-slate-200"
                                    >
                                      <td className="py-2.5 px-4 text-slate-400">
                                        {new Date(tx.date).toLocaleDateString()}
                                      </td>
                                      <td className="py-2.5 px-3 font-semibold text-white">
                                        {giverName}
                                      </td>
                                      <td className="py-2.5 px-3 font-semibold text-white">
                                        {takerName}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-bold text-amber-400">
                                        ৳{tx.amount.toFixed(2)}
                                      </td>
                                      <td className="py-2.5 px-4 text-slate-400 italic">
                                        {tx.note || "--"}
                                      </td>
                                      <td className="py-2.5 px-4 text-center">
                                        <button
                                          onClick={() =>
                                            handleDeleteTransfer(tx._id)
                                          }
                                          className="text-rose-500 hover:text-rose-450 p-1 rounded hover:bg-rose-500/10 transition-all cursor-pointer"
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
                                    className="py-8 text-center text-slate-500 italic font-medium"
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
                {/* Overview Sub-view */}
                {activeTab === "dashboard" && (
                  <>
                    {/* Heading + Take a Tour button */}
                    <div
                      id="dashboard-greeting"
                      className="flex items-start justify-between"
                    >
                      <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight font-serif">
                          {getGreeting()}, {currentUser?.name || "Roommate"}!
                        </h2>
                        <p className="text-slate-400 text-sm">
                          Welcome home. Here is how the household is doing
                          today.
                        </p>
                      </div>
                      <button
                        onClick={() => launchTour(true, 200)}
                        className="flex items-center gap-1.5 bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-400 text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0"
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
                          className="grid grid-cols-1 md:grid-cols-3 gap-6"
                        >
                          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-3 text-indigo-500/10">
                              <DollarSign size={80} />
                            </div>
                            <span className="text-xs font-semibold text-slate-400 uppercase">
                              Groceries & Bazar Costs
                            </span>
                            <h3 className="text-2xl font-bold mt-2">
                              ৳{summaryData.totalMealCost.toFixed(2)}
                            </h3>
                            <div className="flex items-center gap-1.5 text-xs text-indigo-400 mt-2 font-medium">
                              <TrendingUp size={14} />
                              <span>For shared household meals</span>
                            </div>
                          </div>

                          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-3 text-emerald-500/10">
                              <Utensils size={80} />
                            </div>
                            <span className="text-xs font-semibold text-slate-400 uppercase">
                              Shared Meals Cooked
                            </span>
                            <h3 className="text-2xl font-bold mt-2">
                              {summaryData.totalMeals.toFixed(1)}
                            </h3>
                            <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-2 font-medium">
                              <UserCheck size={14} />
                              <span>Freshly cooked for roommates & guests</span>
                            </div>
                          </div>

                          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-3 text-amber-500/10">
                              <TrendingUp size={80} />
                            </div>
                            <span className="text-xs font-semibold text-slate-400 uppercase">
                              Today's Meal Rate
                            </span>
                            <h3 className="text-2xl font-bold mt-2 text-amber-400">
                              ৳{summaryData.mealRate.toFixed(2)}{" "}
                              <span className="text-xs text-slate-500 font-normal">
                                / meal
                              </span>
                            </h3>
                            <div className="flex items-center gap-1.5 text-xs text-amber-500 mt-2 font-medium">
                              <TrendingDown size={14} />
                              <span>Average cost per individual serving</span>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div
                        id="dashboard-stats"
                        className="flex flex-col items-center justify-center py-16 bg-slate-900/30 border border-slate-800/50 rounded-2xl text-center space-y-4 animate-fade-in"
                      >
                        <span className="text-5xl">🏠</span>
                        <h3 className="text-lg font-bold text-white font-serif">
                          Your home is all set up!
                        </h3>
                        <p className="text-slate-400 text-sm max-w-md">
                          Start by configuring your monthly bills, inviting your
                          roommates, and recording your first meals and
                          expenses. Your stats will appear here once you have
                          data.
                        </p>
                        <button
                          onClick={() => setIsConfigModalOpen(true)}
                          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer mt-2"
                        >
                          <Sliders size={14} />
                          <span>Configure Bills to Get Started</span>
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Ledger Standings Sub-view or visual compare */}
                {summaryData && (
                  <div className="grid grid-cols-1 gap-8">
                    {/* Ledger Table */}
                    <div
                      id="roommate-standing"
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6"
                    >
                      <div>
                        <h3 className="font-bold text-lg text-white">
                          Roommate Standing Statement
                        </h3>
                        <p className="text-xs text-slate-400">
                          Detailed list of calculations used to determine final
                          standings.
                        </p>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-800">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                          <thead>
                            <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                              <th className="py-4 px-4">Roommate</th>
                              <th className="py-4 px-3 text-center">Meals</th>
                              <th className="py-4 px-3 text-right">
                                Meal Cost
                              </th>
                              <th className="py-4 px-3 text-right">
                                Given for Meal
                              </th>
                              <th className="py-4 px-3 text-right text-orange-400">
                                Spent on Bazar
                              </th>
                              <th className="py-4 px-3 text-right text-amber-400">
                                Food Due
                              </th>
                              <th className="py-4 px-3 text-right text-cyan-400">
                                Utility Due
                              </th>
                              <th className="py-4 px-3 text-right text-indigo-400">
                                Rent Due
                              </th>
                              <th className="py-4 px-3 text-right">
                                Final Due
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80">
                            {summaryData.userStandings.map((user) => {
                              const isOwed = user.finalDue < 0;
                              const formattedStanding = isOwed
                                ? `+৳${Math.abs(user.finalDue).toFixed(2)} (Refund)`
                                : `৳${user.finalDue.toFixed(2)} (Owes)`;

                              return (
                                <tr
                                  key={user.userId}
                                  className="hover:bg-slate-800/25 text-slate-200 text-sm transition-all border-b border-slate-800/40"
                                >
                                  <td className="py-5 px-4 font-semibold text-white">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs">
                                        {user.name
                                          .split(" ")
                                          .map((n) => n[0])
                                          .join("")}
                                      </div>
                                      <div>
                                        <p>{user.name}</p>
                                        <div className="flex flex-col gap-0.5">
                                          <span className="text-[10px] text-slate-500 capitalize leading-none">
                                            {user.role}
                                          </span>
                                          {user.note && (
                                            <span
                                              className="text-[10px] text-amber-500 italic bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/10 mt-1 max-w-[200px] truncate"
                                              title={user.note}
                                            >
                                              📝 {user.note}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-5 px-3 text-center font-medium text-slate-300">
                                    {user.userTotalMeals.toFixed(1)}
                                  </td>
                                  <td className="py-5 px-3 text-right font-medium text-slate-300">
                                    <div>
                                      ৳{user.mealCostPortion.toFixed(2)}
                                    </div>
                                    {user.prevMealDue !== 0 && (
                                      <span className="text-[10px] text-slate-500 block">
                                        Prev: {user.prevMealDue >= 0 ? "+" : ""}
                                        ৳{user.prevMealDue.toFixed(0)}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-5 px-3 text-right font-semibold text-emerald-400">
                                    ৳{user.totalDeposits.toFixed(2)}
                                  </td>
                                  <td className="py-5 px-3 text-right font-semibold text-orange-400">
                                    <div>৳{user.walletSpent.toFixed(2)}</div>
                                    {user.walletGiven !== 0 ||
                                    user.walletReceived !== 0 ? (
                                      <span className="text-[10px] text-slate-500 block leading-tight">
                                        Given: ৳{user.walletGiven.toFixed(0)} |
                                        Recv: ৳{user.walletReceived.toFixed(0)}
                                        <br />
                                        Net:{" "}
                                        {user.walletGiven -
                                          user.walletReceived >=
                                        0
                                          ? "+"
                                          : ""}
                                        ৳{(user.netBazarPaid || 0).toFixed(0)}
                                      </span>
                                    ) : null}
                                  </td>
                                  <td
                                    className={`py-5 px-3 text-right font-bold ${user.foodDue > 0 ? "text-rose-450" : "text-emerald-400"}`}
                                  >
                                    {user.foodDue >= 0 ? "" : "+"}৳
                                    {Math.abs(user.foodDue).toFixed(2)}
                                  </td>
                                  <td className="py-5 px-3 text-right font-medium text-slate-300">
                                    <div
                                      className={`font-bold ${user.utilityDue > 0 ? "text-rose-450" : "text-emerald-400"}`}
                                    >
                                      {user.utilityDue >= 0 ? "" : "+"}৳
                                      {Math.abs(user.utilityDue).toFixed(2)}
                                    </div>
                                    <span className="text-[10px] text-slate-500 block leading-tight">
                                      Share: ৳{user.utilityShare.toFixed(0)} |
                                      Prev:{" "}
                                      {user.prevUtilityDue >= 0 ? "+" : ""}৳
                                      {user.prevUtilityDue.toFixed(0)}
                                      <br />
                                      Paid: -৳{user.utilityPayment.toFixed(0)}
                                    </span>
                                  </td>
                                  <td className="py-5 px-3 text-right font-medium text-slate-300">
                                    <div
                                      className={`font-bold ${user.rentDue > 0 ? "text-rose-450" : "text-indigo-300"}`}
                                    >
                                      ৳{user.rentDue.toFixed(2)}
                                    </div>
                                    <span className="text-[10px] text-slate-500 block leading-tight">
                                      Rent: ৳{user.rentPortion.toFixed(0)} |
                                      Paid: -৳
                                      {(user.rentPayment || 0).toFixed(0)}
                                    </span>
                                  </td>
                                  <td
                                    className={`py-5 px-3 text-right font-bold transition-colors ${
                                      isOwed
                                        ? "text-emerald-400"
                                        : "text-rose-450"
                                    }`}
                                  >
                                    {formattedStanding}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Shared Utilities notes */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                      <div>
                        <h3 className="font-bold text-lg text-white">
                          Shared Utility Category Bills
                        </h3>
                        <p className="text-xs text-slate-400">
                          Breakdown of the shared house utilities for this
                          month.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { key: "wifi", label: "WiFi" },
                          { key: "electricity", label: "Electricity" },
                          { key: "gas", label: "Gas" },
                          { key: "garbage", label: "Garbage" },
                          { key: "bashaUti", label: "Home Utility" },
                          { key: "pani", label: "Water (Pani)" },
                          { key: "bua", label: "Maid (Bua)" },
                          { key: "extra", label: "Extra" },
                        ].map((util) => {
                          const val =
                            (summaryData.monthlyBill?.utilities as any)?.[
                              util.key
                            ] || 0;
                          const noteText =
                            (summaryData.monthlyBill?.utilityNotes as any)?.[
                              util.key
                            ] || "";
                          return (
                            <div
                              key={util.key}
                              className="flex flex-col gap-1 p-2.5 rounded-xl bg-slate-950/20 border border-slate-800/60 hover:border-slate-755 transition-all"
                            >
                              <div className="flex justify-between items-center text-xs font-bold text-white">
                                <span>{util.label}</span>
                                <span className="text-indigo-400">
                                  ৳{val.toFixed(2)}
                                </span>
                              </div>
                              {noteText && (
                                <p
                                  className="text-[10px] text-amber-500 italic bg-amber-500/5 border border-amber-500/10 px-1.5 py-0.5 rounded leading-normal mt-0.5 hover:bg-amber-500/10 transition-colors"
                                  title={noteText}
                                >
                                  📌 {noteText}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ))}

          {/* Notepad Tab */}
          {activeTab === "notepad" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-2xl font-bold text-white font-serif">
                    House Notes & Purchases
                  </h2>
                  <p className="text-slate-400 text-sm">
                    Ad-hoc notes, lists, reminders, and small grocery items
                    (like brooms, cleaning supplies) for the house.
                  </p>
                </div>
              </div>

              {/* Add Note Form */}
              <form
                id="create-note-form"
                onSubmit={handleCreateNote}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4"
              >
                <h3 className="font-bold text-sm text-white">
                  Create a Note / Purchase
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      placeholder="What did you buy or what is the note? (e.g. Bought a broom for kitchen)"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2 w-full focus:outline-none focus:border-indigo-500 text-xs text-white"
                      required
                    />
                  </div>
                  <div>
                    <select
                      value={noteCategory}
                      onChange={(e) => setNoteCategory(e.target.value as any)}
                      className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 w-full focus:outline-none focus:border-indigo-500 text-xs text-slate-200 cursor-pointer"
                    >
                      <option value="general">📋 General Memo</option>
                      <option value="purchase">🛒 Purchase / Cost</option>
                      <option value="reminder">🔔 Reminder</option>
                      <option value="todo">✅ To-Do Item</option>
                    </select>
                  </div>
                  {noteCategory === "purchase" ? (
                    <div className="flex items-center animate-fade-in">
                      <span className="text-slate-500 mr-1.5 text-xs font-bold">
                        ৳
                      </span>
                      <input
                        type="number"
                        placeholder="Cost amount"
                        value={noteAmount}
                        onChange={(e) => setNoteAmount(e.target.value)}
                        className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 w-full focus:outline-none focus:border-indigo-500 text-xs text-white"
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
                        className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 w-full focus:outline-none focus:border-indigo-500 text-xs text-white cursor-pointer"
                        style={{ colorScheme: "dark" }}
                        required
                      />
                    </div>
                  ) : (
                    <div className="flex items-center opacity-40">
                      <span className="text-slate-500 mr-1.5 text-xs font-bold">
                        ৳
                      </span>
                      <input
                        type="text"
                        placeholder="N/A"
                        className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 w-full focus:outline-none text-xs text-white cursor-not-allowed"
                        disabled
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="bg-indigo-650 hover:bg-indigo-750 text-xs font-bold text-white px-5 py-2.5 rounded-xl shadow transition-all cursor-pointer"
                  >
                    Add Note
                  </button>
                </div>
              </form>

              {/* Notes Grid */}
              {notesLoading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <Loader2 className="h-8 w-8 text-indigo-650 animate-spin" />
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
                        "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
                      purchase:
                        "text-amber-500 bg-amber-500/10 border-amber-500/20",
                      reminder:
                        "text-rose-450 bg-rose-505/10 border-rose-500/20",
                      todo: "text-emerald-450 bg-emerald-500/10 border-emerald-500/20",
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
                        className={`bg-slate-900 border rounded-2xl p-5 shadow-md flex flex-col justify-between gap-4 transition-all hover:shadow-lg relative overflow-hidden ${
                          note.pinned
                            ? "border-amber-500 ring-1 ring-amber-500/20"
                            : "border-slate-800"
                        }`}
                      >
                        {/* Pin ribbon */}
                        {note.pinned && (
                          <div className="absolute top-0 right-0 bg-amber-500 text-[8px] font-black tracking-widest text-slate-950 px-2 py-0.5 rounded-bl uppercase">
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
                                <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border text-emerald-450 bg-emerald-500/10 border-emerald-500/20">
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
                                className={`p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer ${
                                  note.pinned
                                    ? "text-amber-500"
                                    : "text-slate-500 hover:text-slate-300"
                                }`}
                                title={note.pinned ? "Unpin" : "Pin to top"}
                              >
                                <Pin size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteNote(note._id)}
                                className="p-1 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
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
                                className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 w-full text-xs text-white focus:outline-none"
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
                                  className="bg-slate-950/60 border border-slate-800 rounded-lg p-1 text-[10px] text-slate-200"
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
                                    className="bg-slate-950/60 border border-slate-800 rounded-lg p-1 text-[10px] text-white w-24 text-right"
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
                                    className="bg-slate-950/60 border border-slate-800 rounded-lg p-1 text-[10px] text-white cursor-pointer"
                                    style={{ colorScheme: "dark" }}
                                    required
                                  />
                                ) : null}
                              </div>
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteId(null)}
                                  className="px-2 py-1 bg-slate-850 hover:bg-slate-800 rounded text-[10px] font-semibold text-slate-300 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveNoteEdit(note._id)}
                                  className="px-2 py-1 bg-indigo-650 hover:bg-indigo-755 rounded text-[10px] font-semibold text-white cursor-pointer"
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
                                    ? "line-through text-slate-500"
                                    : "text-slate-100"
                                }`}
                              >
                                {note.text}
                              </p>
                              {note.category === "purchase" &&
                                note.amount > 0 && (
                                  <p className="text-sm font-black text-amber-500 font-serif">
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

                        {!isEditing && (
                          <div className="flex justify-between items-center border-t border-slate-800/60 pt-3 text-[10px] text-slate-500 font-medium">
                            <span className="truncate">
                              By {note.createdByName || "Someone"}
                            </span>
                            <span>
                              {new Date(note.createdAt).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })}
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
                                  className={`font-bold transition-colors cursor-pointer ${
                                    note.completed
                                      ? "text-emerald-500 hover:text-emerald-400"
                                      : "text-slate-400 hover:text-white"
                                  }`}
                                >
                                  {note.completed ? "✓ Done" : "☐ Mark Done"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNoteId(note._id);
                                  setEditingNoteText(note.text);
                                  setEditingNoteCategory(note.category);
                                  setEditingNoteAmount(note.amount.toString());
                                  setEditingNoteReminderDate(
                                    note.reminderDate
                                      ? new Date(note.reminderDate)
                                          .toISOString()
                                          .substring(0, 16)
                                      : "",
                                  );
                                }}
                                className="text-indigo-400 hover:text-indigo-305 transition-colors cursor-pointer font-bold"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 bg-slate-900 border border-slate-800 rounded-2xl p-6 gap-2 text-slate-400 italic bg-slate-900">
                  <span>📝 Notepad is empty for {monthId}.</span>
                  <span className="text-[10px]">
                    Add shopping items, home notes, or reminders above!
                  </span>
                </div>
              )}
            </div>
          )}

          {/* History / Audit Log Tab */}
          {activeTab === "history" && (
            <div
              id="history-log-container"
              className="space-y-6 animate-fade-in"
            >
              <div>
                <h2 className="text-2xl font-bold text-white font-serif">
                  Change History Log
                </h2>
                <p className="text-slate-400 text-sm">
                  Full audit trail of all household modifications, transactions,
                  configurations, and notes for {monthId}.
                </p>
              </div>

              {auditLoading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <Loader2 className="h-8 w-8 text-indigo-650 animate-spin" />
                  <p className="text-slate-500 text-xs font-medium">
                    Opening the history books...
                  </p>
                </div>
              ) : auditLogs.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md overflow-hidden">
                    <div className="divide-y divide-slate-850">
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
                                <p className="text-xs text-slate-100 font-medium">
                                  {log.changes?.[0]?.detail ||
                                    `${log.userName} triggered ${log.action}`}
                                </p>
                                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mt-0.5">
                                  Action by:{" "}
                                  <span className="text-indigo-400 font-bold">
                                    {log.userName}
                                  </span>
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[10px] text-slate-500 block">
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
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-lg disabled:opacity-50 transition-all cursor-pointer"
                      >
                        Prev
                      </button>
                      <span className="text-xs text-slate-400">
                        Page {auditPage} of {auditTotalPages}
                      </span>
                      <button
                        onClick={() =>
                          fetchAuditLogs(
                            Math.min(auditTotalPages, auditPage + 1),
                          )
                        }
                        disabled={auditPage === auditTotalPages}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-lg disabled:opacity-50 transition-all cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 bg-slate-900 border border-slate-800 rounded-2xl p-6 gap-2 text-slate-400 italic">
                  <span>📜 No history logs captured for {monthId} yet.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Configuration Modal */}
      {isConfigModalOpen && billConfig && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white font-serif">
                  Configure Rent & Utilities
                </h3>
                <p className="text-slate-400 text-xs mt-0.5 font-medium">
                  Set up roommate rent shares, shared utilities, and previous
                  adjustments for {monthId}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold text-sm bg-slate-800 hover:bg-slate-750 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSaveBillConfig} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Column 1: Rent Config */}
                <div className="space-y-4 bg-slate-950/40 p-4 border border-slate-800 rounded-xl">
                  <h4 className="font-bold text-xs text-indigo-400 uppercase tracking-wider">
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
                          <label className="text-xs text-slate-300 font-medium">
                            {u.name}
                          </label>
                          <div className="flex items-center">
                            <span className="text-[10px] text-slate-500 mr-1">
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
                              className="bg-slate-900 border border-slate-800 rounded px-2 py-1 w-24 text-right focus:outline-none text-xs text-white"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Column 2: Utilities Config */}
                <div className="space-y-4 bg-slate-950/40 p-4 border border-slate-800 rounded-xl">
                  <h4 className="font-bold text-xs text-indigo-400 uppercase tracking-wider font-semibold">
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
                          wifi: "WiFi",
                          electricity: "Electricity",
                          gas: "Gas",
                          garbage: "Garbage",
                          bashaUti: "Home Utility (Basha)",
                          pani: "Pani",
                          bua: "Bua",
                          extra: "Extra",
                        };
                        return (
                          labels[k] || k.charAt(0).toUpperCase() + k.slice(1)
                        );
                      };
                      return (
                        <div
                          key={utilKey}
                          className="space-y-1 border-b border-slate-800/40 pb-2 last:border-b-0"
                        >
                          <div className="flex justify-between items-center gap-2">
                            <div className="flex items-center gap-1 min-w-0">
                              <label
                                className="text-xs text-slate-300 font-medium truncate"
                                title={getCategoryLabel(utilKey)}
                              >
                                {getCategoryLabel(utilKey)}
                              </label>
                              {hasPermission && (
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
                                    setBillConfig({
                                      ...billConfig,
                                      utilities: updatedUtils,
                                      utilityNotes: updatedNotes,
                                    });
                                  }}
                                  className="text-slate-500 hover:text-rose-450 p-0.5 rounded cursor-pointer shrink-0 transition-colors"
                                  title={`Delete category ${getCategoryLabel(utilKey)}`}
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                            <div className="flex items-center shrink-0">
                              <span className="text-[10px] text-slate-500 mr-1">
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
                                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 w-24 text-right focus:outline-none text-xs text-white font-bold"
                              />
                            </div>
                          </div>
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
                            className="bg-slate-950/60 border border-slate-850 rounded px-2 py-1 w-full focus:outline-none text-[10px] text-slate-350 italic text-white"
                          />
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
                        <div className="pt-3 border-t border-slate-800/80 mt-3 space-y-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                            Add Utility Category
                          </p>
                          <div className="flex gap-1">
                            <input
                              type="text"
                              placeholder="Name (e.g. Water)"
                              id="new-utility-category"
                              className="bg-slate-950 border border-slate-850 focus:border-indigo-650 rounded px-2 py-1 text-xs text-white focus:outline-none w-full font-sans"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const inputEl = document.getElementById(
                                  "new-utility-category",
                                ) as HTMLInputElement;
                                const newCat = inputEl?.value?.trim();
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
                                inputEl.value = "";
                              }}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-2.5 rounded transition-all cursor-pointer shrink-0"
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
                <div className="space-y-4 bg-slate-950/40 p-4 border border-slate-800 rounded-xl">
                  <h4 className="font-bold text-xs text-indigo-400 uppercase tracking-wider">
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
                          className="border-b border-slate-800/60 pb-3 space-y-2 last:border-b-0"
                        >
                          <p className="text-xs font-bold text-white">
                            {user.name}
                          </p>

                          <div className="flex justify-between items-center gap-2">
                            <span className="text-[10px] text-slate-400">
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
                              className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 w-20 text-right focus:outline-none text-[10px] text-white"
                            />
                          </div>

                          <div className="flex justify-between items-center gap-2">
                            <span className="text-[10px] text-slate-400">
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
                              className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 w-20 text-right focus:outline-none text-[10px] text-white"
                            />
                          </div>

                          <div className="flex justify-between items-center gap-2">
                            <span className="text-[10px] text-slate-400">
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
                              className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 w-20 text-right focus:outline-none text-[10px] text-white"
                            />
                          </div>

                          <div className="flex justify-between items-center gap-2">
                            <span className="text-[10px] text-slate-400">
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
                              className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 w-20 text-right focus:outline-none text-[10px] text-white"
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
                            className="bg-slate-950/60 border border-slate-850 rounded px-2 py-1 w-full focus:outline-none text-[10px] text-slate-350 italic text-white"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-300 px-4 py-2 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white px-5 py-2 rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
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
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white font-serif">
                Create New Month
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Initialize the next calendar month. Dues and standing
                calculations will automatically carry forward.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider block">
                  Base Month (Carry from)
                </span>
                <select
                  value={newMonthPrevMonthId}
                  onChange={(e) => setNewMonthPrevMonthId(e.target.value)}
                  className="bg-slate-900 text-xs font-bold text-slate-200 focus:outline-none border border-slate-700 rounded-lg p-2 w-full cursor-pointer"
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

              <div className="p-3 bg-indigo-950/20 border border-indigo-900/30 rounded-xl text-xs text-indigo-300 leading-relaxed">
                🚀 **Auto-Carry Forward Enabled**: The system will automatically
                calculate the surplus/deficit for everyone and apply them as
                **Prev Utility Due** and **Prev Meal Due** in the new month
                config.
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setIsNewMonthModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-350 px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateMonth}
                className="bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white px-5 py-2 rounded-xl shadow-lg transition-all cursor-pointer"
              >
                Create Month
              </button>
            </div>
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
            if (!consentStatus.isActive) {
              setUsageSummary(null);
              setUntaggedApps([]);
            }
          }}
          onClose={() => setShowTrackingSettings(false)}
        />
      )}

      {/* Device Download Help Modal */}
      {showDownloadHelp && (
        <DeviceDownloadHelp onClose={() => setShowDownloadHelp(false)} />
      )}
    </div>
  );
}
