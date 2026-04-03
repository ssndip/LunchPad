import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Utensils,
  Settings,
  CreditCard,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  ChevronRight,
  AlertCircle,
  LayoutDashboard,
  LogOut,
  Users,
  Loader2,
  Zap,
  Menu,
  X,
  RotateCcw,
  AlertTriangle,
  HelpCircle,
  Calendar,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MenuItem, Order, AppState, Card, DailySummary } from "./types";
import { translations, Language } from "./translations";

const SystemClock = ({ lang }: { lang: Language }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {time.toLocaleTimeString(lang === "bg" ? "bg-BG" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })}
    </>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<AppState>("kiosk");
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [rfid, setRfid] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<MenuItem[]>([]);
  const [lang, setLang] = useState<Language>(
    (localStorage.getItem("lang") as Language) || "en",
  );

  const t = (path: string) => {
    const parts = path.split(".");
    let current: any = translations[lang];
    for (const part of parts) {
      if (!current || current[part] === undefined) return path;
      current = current[part];
    }
    return current;
  };

  useEffect(() => {
    localStorage.setItem("lang", lang);
  }, [lang]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [kioskOpen, setKioskOpen] = useState(true);
  const [adminPin, setAdminPin] = useState<string>("");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [orderButtonEnabled, setOrderButtonEnabled] = useState(true);
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [minuteTick, setMinuteTick] = useState(0);

  const rfidInputRef = useRef<HTMLInputElement>(null);
  const ws = useRef<WebSocket | null>(null);

  const managerRfidRef = useRef<HTMLInputElement>(null);

  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const fetchInitialState = async () => {
    try {
      const response = await fetch("/api/init");
      if (response.ok) {
        const data = await response.json();
        if (data.menu) setMenu(data.menu);
        if (data.kioskOpen !== undefined) setKioskOpen(data.kioskOpen);
        if (data.globalAccess !== undefined) setGlobalAccess(data.globalAccess);
        if (data.orderButtonEnabled !== undefined)
          setOrderButtonEnabled(data.orderButtonEnabled);
        if (data.testModeEnabled !== undefined)
          setTestModeEnabled(data.testModeEnabled);
        if (data.kioskAutoTiming !== undefined)
          setKioskAutoTiming(data.kioskAutoTiming);
        if (data.kioskOpenTime !== undefined)
          setKioskOpenTime(data.kioskOpenTime);
        if (data.kioskCloseTime !== undefined)
          setKioskCloseTime(data.kioskCloseTime);
        if (data.kioskCloseDay !== undefined)
          setKioskCloseDay(data.kioskCloseDay);
        setConnectionError(null);
      }
    } catch (err) {
      console.error("Failed to fetch initial state", err);
    }
  };

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    isDestructive = false,
    confirmText = "Confirm",
  ) => {
    setConfirmConfig({ title, message, onConfirm, isDestructive, confirmText });
  };

  useEffect(() => {
    const storedPin = sessionStorage.getItem("adminPin");
    if (storedPin) {
      setAdminPin(storedPin);
      setView("manager");
    }
  }, []);

  useEffect(() => {
    if (adminPin && view === "manager") {
      const headers = { "x-admin-pin": adminPin };
      Promise.all([
        fetch("/api/cards", { headers }),
        fetch("/api/orders", { headers }),
      ])
        .then(async ([cardsRes, ordersRes]) => {
          if (cardsRes.ok && ordersRes.ok) {
            const [cardsData, ordersData] = await Promise.all([
              cardsRes.json(),
              ordersRes.json(),
            ]);
            if (Array.isArray(cardsData)) setCards(cardsData);
            if (Array.isArray(ordersData)) setOrders(ordersData);
          }
        })
        .catch((err) => console.error("Initial admin fetch failed", err));
    }
  }, [adminPin, view]);

  useEffect(() => {
    fetchInitialState();

    // WebSocket connection logic (sync only)
    let reconnectTimer: any;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      ws.current = new WebSocket(`${protocol}//${host}`);

      ws.current.onopen = () => {
        console.log("WebSocket Connected");
        if (reconnectTimer) clearInterval(reconnectTimer);
      };

      ws.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case "INITIAL_STATE":
            console.log(
              "Received INITIAL_STATE. Cards:",
              message.cards?.length,
            );
            setMenu(message.menu);
            if (message.orders?.length > 0) setOrders(message.orders);
            setKioskOpen(message.kioskOpen);
            if (message.cards?.length > 0) setCards(message.cards);
            break;
          case "MENU_UPDATE":
            setMenu(message.data);
            break;
          case "CARDS_UPDATE":
            console.log("Received CARDS_UPDATE signal.");
            {
              const pin = sessionStorage.getItem("adminPin");
              if (pin) {
                fetch("/api/cards", { headers: { "x-admin-pin": pin } })
                  .then((res) => res.json())
                  .then((data) => {
                    if (Array.isArray(data)) setCards(data);
                  })
                  .catch((err) =>
                    console.error("Failed to fetch cards on update", err),
                  );
              }
            }
            break;
          case "NEW_ORDER":
            setOrders((prev) => [message.data, ...prev]);
            break;
          case "STATUS_UPDATE":
            setKioskOpen(message.data.kioskOpen);
            if (message.data.orderButtonEnabled !== undefined) {
              setOrderButtonEnabled(message.data.orderButtonEnabled);
            }
            if (message.data.testModeEnabled !== undefined) {
              setTestModeEnabled(message.data.testModeEnabled);
            }
            if (message.data.kioskAutoTiming !== undefined) {
              setKioskAutoTiming(message.data.kioskAutoTiming);
            }
            if (message.data.kioskOpenTime !== undefined) {
              setKioskOpenTime(message.data.kioskOpenTime);
            }
            if (message.data.kioskCloseTime !== undefined) {
              setKioskCloseTime(message.data.kioskCloseTime);
            }
            if (message.data.kioskCloseDay !== undefined) {
              setKioskCloseDay(message.data.kioskCloseDay);
            }
            break;
        }
      };

      ws.current.onclose = (event) => {
        console.log("WebSocket Disconnected. Code:", event.code);
        if (event.code === 4003) {
          setConnectionError("Global Access Disabled");
          // Don't auto-reconnect if it's a security rejection
        } else {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      ws.current.onerror = (err) => {
        console.error("WebSocket Error:", err);
        ws.current?.close();
      };
    };

    connect();

    return () => {
      if (ws.current) ws.current.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "menu" | "orders" | "cards" | "history" | "settings"
  >("menu");
  const [editingMenu, setEditingMenu] = useState<MenuItem[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [globalAccess, setGlobalAccess] = useState(false);
  const [kioskAutoTiming, setKioskAutoTiming] = useState(false);
  const [kioskOpenTime, setKioskOpenTime] = useState("00:00");
  const [kioskCloseTime, setKioskCloseTime] = useState("09:00");
  const [kioskCloseDay, setKioskCloseDay] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setMinuteTick((prev) => prev + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  // ⚡ Bolt: Memoize Kiosk Auto-Timing computation so it only runs on minute boundaries
  const computedKioskOpen = useMemo(() => {
    if (!kioskAutoTiming) return kioskOpen;
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = kioskOpenTime.split(":").map(Number);
    const [closeH, closeM] = kioskCloseTime.split(":").map(Number);
    const open = openH * 60 + openM;
    const close = closeH * 60 + closeM;

    if (kioskCloseDay === 1) {
      return current >= open || current < close;
    } else {
      return current >= open && current < close;
    }
  }, [
    minuteTick,
    kioskAutoTiming,
    kioskOpen,
    kioskOpenTime,
    kioskCloseTime,
    kioskCloseDay,
  ]);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [dailyDetails, setDailyDetails] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    rfid: "",
    ownerName: "",
  });

  const [pasteText, setPasteText] = useState("");
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);

  const [pasteCardsText, setPasteCardsText] = useState("");
  const [isPasteCardsModalOpen, setIsPasteCardsModalOpen] = useState(false);
  const [newCardRfid, setNewCardRfid] = useState("");
  const [newCardOwner, setNewCardOwner] = useState("");
  const [newCardIsAdmin, setNewCardIsAdmin] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
    confirmText?: string;
  } | null>(null);

  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinUpdateStatus, setPinUpdateStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  useEffect(() => {
    setEditingMenu(menu);
  }, [menu]);

  const fetchHistory = async () => {
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/history?${params}`, {
        headers: { "x-admin-pin": adminPin },
      });
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  const fetchSummaries = async () => {
    try {
      const response = await fetch("/api/summaries", {
        headers: { "x-admin-pin": adminPin },
      });
      const data = await response.json();
      setSummaries(data);
    } catch (err) {
      console.error("Failed to fetch summaries", err);
    }
  };

  const fetchDailyDetails = async (date: string) => {
    if (expandedDate === date) {
      setExpandedDate(null);
      return;
    }
    try {
      const response = await fetch(`/api/summaries/${date}`, {
        headers: { "x-admin-pin": adminPin },
      });
      const data = await response.json();
      setDailyDetails(data);
      setExpandedDate(date);
    } catch (err) {
      console.error("Failed to fetch daily details", err);
    }
  };

  const copyDailySummary = (date: string, total: number) => {
    const summaryText =
      `Daily Summary: ${date}\n` +
      `--- \n` +
      dailyDetails
        .map(
          (item) =>
            `${item.category} | ${item.name} | ${item.quantity} | €${item.total.toFixed(2)}`,
        )
        .join("\n") +
      `\n---\n` +
      `TOTAL: €${total.toFixed(2)}`;

    navigator.clipboard
      .writeText(summaryText)
      .then(() => {
        alert("Summary copied to clipboard!");
      })
      .catch((err) => {
        console.error("Failed to copy", err);
      });
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings", {
        headers: { "x-admin-pin": adminPin },
      });
      const data = await response.json();
      setGlobalAccess(data.globalAccess);
      setOrderButtonEnabled(data.orderButtonEnabled);
      if (data.testModeEnabled !== undefined)
        setTestModeEnabled(data.testModeEnabled);
      if (data.kioskAutoTiming !== undefined)
        setKioskAutoTiming(data.kioskAutoTiming);
      if (data.kioskOpenTime !== undefined)
        setKioskOpenTime(data.kioskOpenTime);
      if (data.kioskCloseTime !== undefined)
        setKioskCloseTime(data.kioskCloseTime);
      if (data.kioskCloseDay !== undefined)
        setKioskCloseDay(data.kioskCloseDay);
    } catch (err) {
      console.error("Failed to fetch settings", err);
    }
  };

  const updateSettings = async (
    access: boolean,
    orderBtn: boolean,
    testMode?: boolean,
    autoTiming?: boolean,
    openTime?: string,
    closeTime?: string,
    closeDay?: number,
  ) => {
    try {
      // Optimistic update
      setGlobalAccess(access);
      setOrderButtonEnabled(orderBtn);
      if (testMode !== undefined) setTestModeEnabled(testMode);
      if (autoTiming !== undefined) setKioskAutoTiming(autoTiming);
      if (openTime !== undefined) setKioskOpenTime(openTime);
      if (closeTime !== undefined) setKioskCloseTime(closeTime);
      if (closeDay !== undefined) setKioskCloseDay(closeDay);

      await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-pin": adminPin,
        },
        body: JSON.stringify({
          globalAccess: access,
          orderButtonEnabled: orderBtn,
          testModeEnabled: testMode !== undefined ? testMode : testModeEnabled,
          kioskAutoTiming:
            autoTiming !== undefined ? autoTiming : kioskAutoTiming,
          kioskOpenTime: openTime !== undefined ? openTime : kioskOpenTime,
          kioskCloseTime: closeTime !== undefined ? closeTime : kioskCloseTime,
          kioskCloseDay: closeDay !== undefined ? closeDay : kioskCloseDay,
        }),
      });
    } catch (err) {
      console.error("Failed to update settings", err);
    }
  };

  const handleUpdatePin = async () => {
    if (!newPin || newPin !== confirmPin) return;

    try {
      setPinUpdateStatus("loading");
      const response = await fetch("/api/settings/pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-pin": adminPin,
        },
        body: JSON.stringify({ newPin }),
      });

      if (response.ok) {
        setPinUpdateStatus("success");
        setAdminPin(newPin); // Update current session PIN
        setNewPin("");
        setConfirmPin("");
        setTimeout(() => setPinUpdateStatus("idle"), 3000);
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update PIN");
        setPinUpdateStatus("error");
        setTimeout(() => setPinUpdateStatus("idle"), 3000);
      }
    } catch (err) {
      console.error("Failed to update PIN", err);
      setPinUpdateStatus("error");
      setTimeout(() => setPinUpdateStatus("idle"), 3000);
    }
  };

  const resetCardBalance = async (rfid: string) => {
    showConfirm(
      t("cards.clear_balance"),
      t("modals.reset_warning"),
      async () => {
        try {
          await fetch(`/api/cards/${rfid}/reset`, {
            method: "POST",
            headers: { "x-admin-pin": adminPin },
          });
        } catch (err) {
          console.error("Failed to reset card balance", err);
        }
      },
      true,
      t("cards.clear_balance"),
    );
  };

  useEffect(() => {
    setIsScanning(false); // Reset scanning status on view/tab change
    if (view === "manager") {
      if (activeTab === "history") {
        fetchHistory();
      } else if (activeTab === "orders") {
        fetchSummaries();
      } else if (activeTab === "settings") {
        fetchSettings();
      }
    }
  }, [activeTab, view]);

  const addItem = () => {
    const newItem: MenuItem = {
      id: Date.now(),
      name: "New Dish",
      description: "Description here",
      price: 0,
      available: true,
      category: "General",
    };
    const updated = [...editingMenu, newItem];
    setEditingMenu(updated);
    updateMenu(updated);
  };

  const updateItem = (id: number, field: keyof MenuItem, value: any) => {
    const updated = editingMenu.map((item) =>
      item.id === id ? { ...item, [field]: value } : item,
    );
    setEditingMenu(updated);
    updateMenu(updated);
  };

  const removeItem = (id: number) => {
    showConfirm(
      t("modals.remove_item"),
      t("modals.remove_item_warning"),
      () => {
        const updated = editingMenu.filter((item) => item.id !== id);
        setEditingMenu(updated);
        updateMenu(updated);
      },
      true,
      t("modals.remove"),
    );
  };

  const handlePasteMenu = () => {
    const lines = pasteText.split("\n");
    const newItems: MenuItem[] = [];
    let currentId = Date.now();
    let currentCategory = "General";

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      const priceMatch = trimmedLine.match(/(\d+(?:\.\d+)?)€/);

      if (
        !priceMatch &&
        trimmedLine.length > 3 &&
        !trimmedLine.startsWith("-")
      ) {
        currentCategory = trimmedLine.replace(/:$/, "").trim();
        return;
      }

      if (priceMatch) {
        const price = parseFloat(priceMatch[1]);
        let name = trimmedLine.split(priceMatch[0])[0].trim();

        if (name.startsWith("-")) name = name.substring(1).trim();

        newItems.push({
          id: currentId++,
          name,
          description: "Imported via paste",
          price,
          available: true,
          category: currentCategory,
        });
      }
    });

    if (newItems.length > 0) {
      setEditingMenu(newItems);
      updateMenu(newItems);
      setIsPasteModalOpen(false);
      setPasteText("");
    }
  };

  const addManualCard = async () => {
    if (!newCardRfid || !newCardOwner) return;

    const cleanRfid = newCardRfid
      .trim()
      .replace(/[^\x20-\x7E]/g, "")
      .toLowerCase();

    if (cleanRfid.length === 0) {
      setNewCardRfid("");
      return;
    }

    const newCard: Card = {
      rfid: cleanRfid,
      ownerName: newCardOwner.trim(),
      balance: 0,
      isAdmin: newCardIsAdmin,
    };

    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-pin": adminPin,
        },
        body: JSON.stringify(newCard),
      });
      if (response.ok) {
        setNewCardRfid("");
        setNewCardOwner("");
        setLastScanned(null);
        setNewCardIsAdmin(false);
      }
    } catch (err) {
      console.error("Failed to add card", err);
    }
  };

  const removeCard = async (rfid: string) => {
    showConfirm(
      t("cards.delete_card"),
      t("modals.delete_warning"),
      async () => {
        try {
          setCards((prev) => prev.filter((c) => c.rfid !== rfid)); // Optimistic update
          await fetch(`/api/cards/${rfid}`, {
            method: "DELETE",
            headers: { "x-admin-pin": adminPin },
          });
        } catch (err) {
          console.error("Failed to remove card", err);
        }
      },
      true,
      t("modals.remove"),
    );
  };

  const handlePasteCards = async () => {
    const lines = pasteCardsText.split("\n");
    const newCards: Card[] = [];

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      const parts = trimmedLine.split(/\s+/);
      if (parts.length >= 2) {
        const rfid = parts[0]
          .trim()
          .replace(/[^\x20-\x7E]/g, "")
          .toLowerCase();
        const ownerName = parts.slice(1).join(" ").trim();
        if (rfid && ownerName) {
          newCards.push({ rfid, ownerName, balance: 0 });
        }
      }
    });

    if (newCards.length > 0) {
      try {
        await fetch("/api/cards/batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-pin": adminPin,
          },
          body: JSON.stringify(newCards),
        });
        setIsPasteCardsModalOpen(false);
        setPasteCardsText("");
      } catch (err) {
        console.error("Failed to batch add cards", err);
      }
    }
  };

  const resetAllBalances = async () => {
    showConfirm(
      t("cards.reset_monthly_balances"),
      t("modals.reset_warning"),
      async () => {
        try {
          setCards((prev) => prev.map((c) => ({ ...c, balance: 0 }))); // Optimistic update
          await fetch("/api/cards/reset-all", {
            method: "POST",
            headers: { "x-admin-pin": adminPin },
          });
        } catch (err) {
          console.error("Failed to reset balances", err);
        }
      },
      true,
      t("cards.reset_monthly_balances"),
    );
  };

  const updateCards = async (updatedCards: Card[]) => {
    try {
      setCards(updatedCards); // Optimistic update
      await fetch("/api/cards/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-pin": adminPin,
        },
        body: JSON.stringify(updatedCards),
      });
    } catch (err) {
      console.error("Failed to update cards", err);
    }
  };

  const toggleItem = (item: MenuItem) => {
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.id === item.id);
      if (exists) {
        return prev.filter((i) => i.id !== item.id);
      }
      return [...prev, item];
    });
  };

  // ⚡ Bolt: Memoize selected items to a Set for O(1) lookup during render loop
  const selectedItemIds = useMemo(
    () => new Set(selectedItems.map((i) => i.id)),
    [selectedItems],
  );

  // ⚡ Bolt: Memoize total price calculation
  const totalPrice = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.price, 0),
    [selectedItems],
  );

  // --- Manager Aggregation Hooks (Moved to top to fix Error #310) ---
  interface AggregatedItem {
    name: string;
    count: number;
    total: number;
    category: string;
  }

  // ⚡ Bolt: Memoize expensive O(orders * items_per_order) calculation
  const { aggregatedOrders, totalRevenue, totalItemsSold } = useMemo(() => {
    if (!Array.isArray(orders)) {
      return { aggregatedOrders: {}, totalRevenue: 0, totalItemsSold: 0 };
    }

    const aggOrders = orders.reduce(
      (acc, order) => {
        if (!order || !Array.isArray(order.items)) return acc;
        order.items.forEach((item) => {
          if (!item || !item.id) return;
          if (!acc[item.id]) {
            acc[item.id] = {
              name: item.name || "Unknown Item",
              count: 0,
              total: 0,
              category: item.category || "Uncategorized",
            };
          }
          acc[item.id].count += 1;
          acc[item.id].total += Number(item.price) || 0;
        });
        return acc;
      },
      {} as Record<number, AggregatedItem>,
    );

    const totals = (Object.values(aggOrders) as AggregatedItem[]).reduce(
      (acc, item) => {
        acc.totalRevenue += item.total;
        acc.totalItemsSold += item.count;
        return acc;
      },
      { totalRevenue: 0, totalItemsSold: 0 },
    );

    return {
      aggregatedOrders: aggOrders,
      totalRevenue: totals.totalRevenue,
      totalItemsSold: totals.totalItemsSold,
    };
  }, [orders]);

  useEffect(() => {
    if (view === "kiosk" && kioskOpen && selectedItems.length > 0) {
      rfidInputRef.current?.focus();
    }
  }, [view, kioskOpen, selectedItems.length]);

  const handleOrder = async (rfidOverride?: string | React.MouseEvent) => {
    // If called via onClick, rfidOverride is the event object. Ignore it.
    let activeRfid = typeof rfidOverride === "string" ? rfidOverride : rfid;

    // Test mode bypass: if no RFID scanned and Test Mode is ON, use TEST-ADMIN
    if ((!activeRfid || activeRfid.trim() === "") && testModeEnabled) {
      activeRfid = "TEST-ADMIN";
    }

    if (!activeRfid || selectedItems.length === 0) {
      console.warn("[DEBUG] Order aborted: No RFID or no items selected.", {
        activeRfid,
        itemCount: selectedItems.length,
      });
      return;
    }

    try {
      setIsScanning(true);
      console.log(
        `[DEBUG] Sending Order for RFID: "${activeRfid}" (Test Mode: ${testModeEnabled})`,
      );

      const response = await fetch("/api/v1/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfid: activeRfid.trim(),
          itemIds: selectedItems.map((i) => i.id),
        }),
      });

      if (response.ok) {
        setShowSuccess(true);
        setSelectedItems([]);
        setRfid("");
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          setError(data.error || "Order failed. Please try again.");
        } else {
          const text = await response.text();
          setError(`Server error (${response.status}): ${text.slice(0, 50)}`);
        }
        // Clear RFID on error too if it was a bad card/insufficient balance
        setRfid("");
        setTimeout(() => setError(null), 5000);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Network error. Please check your connection and try again.");
      setRfid("");
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsScanning(false);
    }
  };

  const toggleKiosk = async (open: boolean) => {
    try {
      setKioskOpen(open); // Optimistic update
      await fetch("/api/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-pin": adminPin,
        },
        body: JSON.stringify({ open }),
      });
    } catch (err) {
      console.error("Failed to toggle kiosk", err);
    }
  };

  const updateMenu = async (newMenu: MenuItem[]) => {
    try {
      setMenu(newMenu); // Optimistic update
      setEditingMenu(newMenu);
      await fetch("/api/menu", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-pin": adminPin,
        },
        body: JSON.stringify(newMenu),
      });
    } catch (err) {
      console.error("Failed to update menu", err);
    }
  };
  // ⚡ Bolt: Memoize grouped menu to prevent redundant O(n) reduction on every render
  const groupedMenu = useMemo(
    () =>
      menu.reduce(
        (acc, item) => {
          if (!acc[item.category]) acc[item.category] = [];
          acc[item.category].push(item);
          return acc;
        },
        {} as Record<string, MenuItem[]>,
      ),
    [menu],
  );

  if (view === "kiosk") {
    const matchedCard = rfid ? true : undefined; // Optimistic match for Kiosk since cards aren't leaked to client anymore

    if (!kioskOpen) {
      return (
        <div className="h-[100dvh] overflow-hidden bg-neutral-100 flex items-center justify-center p-8">
          <div className="bg-white p-12 rounded-[40px] shadow-2xl text-center max-w-lg">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <LogOut className="w-12 h-12 text-red-600" />
            </div>
            <h1 className="text-4xl font-black text-neutral-900 mb-4 uppercase tracking-tighter">
              {t("kiosk.ordering_closed")}
            </h1>
            <p className="text-neutral-500 text-lg leading-relaxed">
              {t("kiosk.check_back_tomorrow")}
            </p>
            <button
              onClick={() => setView("manager")}
              className="mt-8 px-8 py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all"
            >
              {t("navigation.admin_login")}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        key="kiosk-view"
        className="h-[100dvh] overflow-hidden bg-[#F8F9FA] flex flex-col relative font-sans"
      >
        {/* Dynamic Background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-neutral-200 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-neutral-100 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="relative z-10 flex-1 flex flex-col p-4 md:p-8">
          <header className="flex justify-between items-center mb-4 shrink-0">
            <div className="flex flex-wrap items-baseline gap-4">
              <h1 className="text-2xl font-black text-neutral-900 tracking-tighter uppercase leading-none">
                {t("kiosk.daily_menu")}
              </h1>
              <span className="text-2xl font-mono text-neutral-400 uppercase tracking-tighter leading-none">
                {(() => {
                  // ⚡ Bolt: We can recalculate this inline on minute ticks, but memoizing is better
                  const now = new Date();
                  const currentHHmm =
                    now.getHours().toString().padStart(2, "0") +
                    ":" +
                    now.getMinutes().toString().padStart(2, "0");
                  const targetDate = new Date(now);
                  if (kioskAutoTiming && currentHHmm >= kioskCloseTime) {
                    targetDate.setDate(now.getDate() + 1);
                  }
                  return targetDate.toLocaleDateString(
                    lang === "bg" ? "bg-BG" : "en-US",
                    {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    },
                  );
                })()}
              </span>
              {kioskAutoTiming && (
                <span className="text-[10px] font-bold px-3 py-1 bg-white text-neutral-500 rounded-full border border-neutral-200 uppercase tracking-widest shadow-sm">
                  {t("kiosk.orders_for")}
                </span>
              )}
            </div>
            <button
              onClick={() => setView("manager")}
              className="group p-2 rounded-xl bg-white border border-neutral-200 shadow-sm hover:shadow-md transition-all active:scale-95"
              title="Manager Settings"
              aria-label="Manager Settings"
            >
              <Settings className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
            </button>
          </header>

          <div className="flex-1 columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
            {connectionError ? (
              <div className="bg-white p-12 rounded-[40px] border-2 border-dashed border-red-200 text-center col-span-full shadow-lg">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-black text-neutral-900 mb-2 uppercase tracking-tighter">
                  {t("kiosk.connection_restricted")}
                </h3>
                <p className="text-neutral-500 text-sm max-w-md mx-auto leading-relaxed">
                  {t("kiosk.restricted_message")}
                </p>
              </div>
            ) : !orderButtonEnabled ? (
              <div className="bg-white p-12 rounded-[40px] border-2 border-dashed border-neutral-200 text-center col-span-full shadow-sm">
                <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Utensils className="w-8 h-8 text-neutral-400" />
                </div>
                <h3 className="text-xl font-black text-neutral-900 mb-2 uppercase tracking-tighter">
                  {t("kiosk.testing_mode")}
                </h3>
                <p className="text-neutral-400 text-sm max-w-md mx-auto leading-relaxed">
                  {t("kiosk.ordering_disabled")}
                </p>
              </div>
            ) : Object.keys(groupedMenu).length === 0 ? (
              <div className="bg-white p-12 rounded-[40px] border border-neutral-200 text-center col-span-full shadow-sm">
                <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Clock className="w-8 h-8 text-neutral-400" />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-1">
                  {t("kiosk.no_items_available")}
                </h3>
                <p className="text-neutral-400 text-xs uppercase tracking-widest font-mono">
                  {t("kiosk.check_later")}
                </p>
              </div>
            ) : (
              (Object.entries(groupedMenu) as [string, MenuItem[]][]).map(
                ([category, items]) => (
                  <section
                    key={category}
                    className="break-inside-avoid bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden mb-4"
                  >
                    <div className="px-3 py-1.5 bg-neutral-50 border-b border-neutral-100 flex justify-between items-center">
                      <h2 className="text-[9px] font-black text-neutral-800 uppercase tracking-[0.2em]">
                        {category}
                      </h2>
                      <span className="text-[8px] font-mono text-neutral-400">
                        {items.filter((i) => i.available).length}
                      </span>
                    </div>

                    <div className="divide-y divide-neutral-50">
                      {items
                        .filter((item) => item.available)
                        .map((item) => {
                          const isSelected = selectedItemIds.has(item.id);
                          return (
                            <motion.div
                              key={item.id}
                              layout
                              initial={false}
                              animate={{
                                backgroundColor: isSelected
                                  ? "#000000"
                                  : "#ffffff",
                                color: isSelected ? "#ffffff" : "#404040",
                                scale: isSelected ? 1.02 : 1,
                              }}
                              transition={{ duration: 0.15 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => toggleItem(item)}
                              className={`cursor-pointer group flex justify-between items-center px-4 py-3 transition-all duration-150 relative rounded-lg mb-1 overflow-hidden ${
                                isSelected
                                  ? "shadow-xl z-10"
                                  : "hover:bg-neutral-50 border border-transparent hover:border-neutral-200"
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <AnimatePresence mode="wait">
                                  {isSelected && (
                                    <motion.div
                                      initial={{ scale: 0, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0, opacity: 0 }}
                                      transition={{
                                        type: "spring",
                                        stiffness: 300,
                                        damping: 20,
                                      }}
                                    >
                                      <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                                <span className="text-[15px] font-bold block truncate">
                                  {item.name}
                                </span>
                              </div>
                              <div className="shrink-0 ml-4">
                                <span className="text-[13px] font-black font-mono">
                                  €{item.price.toFixed(2)}
                                </span>
                              </div>

                              {/* Animated selection bar highlight */}
                              {isSelected && (
                                <motion.div
                                  layoutId="active-pill"
                                  className="absolute left-0 top-0 bottom-0 w-1 bg-white"
                                />
                              )}
                            </motion.div>
                          );
                        })}
                    </div>
                  </section>
                ),
              )
            )}
          </div>

          <AnimatePresence>
            {selectedItems.length > 0 && orderButtonEnabled && (
              <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="fixed bottom-12 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4"
              >
                <div className="bg-white rounded-3xl shadow-2xl border border-neutral-200 p-4 flex flex-col md:flex-row items-center gap-4">
                  <div className="flex-1">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-0.5">
                      {t("orders.total")}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-neutral-900 tracking-tighter">
                        €{totalPrice.toFixed(2)}
                      </span>
                      <span className="text-sm font-bold text-neutral-400 uppercase tracking-widest">
                        ({selectedItems.length}{" "}
                        {selectedItems.length === 1
                          ? t("menu.item")
                          : t("menu.items")}
                        )
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                      onClick={() => setSelectedItems([])}
                      className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                      title="Clear order items"
                      aria-label="Clear order items"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <div className="relative flex-1 md:w-48">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <div className="relative w-full">
                        <input
                          ref={rfidInputRef}
                          type="text"
                          placeholder={t("cards.scan_to_register")}
                          aria-label={t("cards.scan_to_register")}
                          value={rfid}
                          autoComplete="off"
                          onChange={(e) => setRfid(e.target.value)}
                          onFocus={(e) => {
                            setError(null);
                            if (e.target.value) {
                              e.target.select();
                            }
                          }}
                          onBlur={() => {
                            // Removed auto-focus to allow typing in other fields/chat
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const currentVal = (
                                e.currentTarget as HTMLInputElement
                              ).value;
                              if (!currentVal) return;

                              // Remove ALL non-printable characters and whitespace
                              const cleanRfid = currentVal
                                .trim()
                                .replace(/[^\x20-\x7E]/g, "")
                                .toLowerCase();
                              console.log(
                                `[Kiosk] Scanned: "${cleanRfid}" (original: "${currentVal}")`,
                              );

                              if (cleanRfid.length === 0) {
                                setRfid("");
                                return;
                              }
                              setLastScanned(cleanRfid);
                              handleOrder(cleanRfid); // Let backend validate
                            }
                          }}
                          className={`w-full pl-9 pr-10 py-2 bg-neutral-100 rounded-xl border-none focus:outline-none transition-all font-mono text-sm ${
                            rfid && !matchedCard
                              ? "ring-4 ring-red-500 bg-red-50"
                              : "focus:ring-4 focus:ring-neutral-900"
                          }`}
                        />
                        {rfid && (
                          <button
                            onClick={() => setRfid("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
                            title="Clear RFID input"
                            aria-label="Clear RFID input"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {rfid && !matchedCard && (
                        <motion.p
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="absolute -top-6 left-0 text-[10px] font-bold text-red-600 bg-white px-2 py-0.5 rounded-full border border-red-200 shadow-sm whitespace-nowrap"
                        >
                          {t("cards.unregistered")}
                        </motion.p>
                      )}
                    </div>
                    <button
                      onClick={() => handleOrder()}
                      disabled={
                        isScanning ||
                        selectedItems.length === 0 ||
                        (!testModeEnabled && (!rfid || !matchedCard)) ||
                        !computedKioskOpen
                      }
                      className="px-6 py-2 bg-neutral-900 text-white rounded-xl font-bold text-sm hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                      {isScanning ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      {testModeEnabled && !rfid ? "Test Order" : "Order"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showSuccess && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50"
              >
                <div className="bg-neutral-900 text-white p-12 rounded-[60px] text-center shadow-2xl">
                  <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-8">
                    <CheckCircle2 className="w-12 h-12 text-white" />
                  </div>
                  <h2 className="text-4xl font-bold mb-4">
                    {t("kiosk.order_success")}
                  </h2>
                  <p className="text-neutral-400 text-lg">
                    {t("kiosk.order_success")}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === "manager" && !adminPin) {
    return (
      <div
        key="manager-login"
        className="h-[100dvh] overflow-hidden bg-neutral-100 flex items-center justify-center p-8"
      >
        <div className="bg-white p-12 rounded-[40px] shadow-2xl text-center max-w-lg">
          <h1 className="text-4xl font-black text-neutral-900 mb-4 uppercase tracking-tighter">
            {t("navigation.admin_login")}
          </h1>
          <p className="text-neutral-500 mb-6">{t("navigation.enter_pin")}</p>
          <input
            type="password"
            placeholder="****"
            aria-label={t("navigation.enter_pin")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const pin = (e.currentTarget as HTMLInputElement).value;
                if (pin) {
                  setAdminPin(pin);
                  // Trigger a fetch to cards to verify pin
                  Promise.all([
                    fetch("/api/cards", { headers: { "x-admin-pin": pin } }),
                    fetch("/api/orders", { headers: { "x-admin-pin": pin } }),
                  ])
                    .then(async ([cardsRes, ordersRes]) => {
                      if (!cardsRes.ok || !ordersRes.ok) {
                        setAdminPin("");
                        alert(t("navigation.invalid_pin"));
                      } else {
                        sessionStorage.setItem("adminPin", pin);
                        window.location.reload();
                      }
                    })
                    .catch(() => {
                      setAdminPin("");
                      alert(t("navigation.network_error"));
                    });
                }
              }
            }}
            className="w-full px-4 py-4 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono text-center text-2xl mb-6 tracking-[0.5em]"
            autoFocus
          />
          <button
            onClick={() => {
              setView("kiosk");
              setAdminPin("");
            }}
            className="text-neutral-500 hover:text-neutral-900 transition-colors font-bold uppercase tracking-widest text-xs"
          >
            {t("navigation.exit")}
          </button>
        </div>
      </div>
    );
  }

  const navLinks = (
    <nav className="flex-1 space-y-2">
      {[
        {
          id: "menu",
          icon: <Utensils className="w-5 h-5" />,
          label: t("navigation.menu_management"),
        },
        {
          id: "orders",
          icon: <Clock className="w-5 h-5" />,
          label: t("navigation.order_summary"),
        },
        {
          id: "history",
          icon: <Clock className="w-5 h-5" />,
          label: t("navigation.history"),
        },
        {
          id: "cards",
          icon: <Users className="w-5 h-5" />,
          label: t("navigation.card_management"),
        },
        {
          id: "settings",
          icon: <Settings className="w-5 h-5" />,
          label: t("navigation.system_settings"),
        },
      ].map((link) => (
        <button
          key={link.id}
          onClick={() => {
            setActiveTab(link.id as any);
            setIsMobileMenuOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === link.id ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:bg-neutral-50"}`}
        >
          {link.icon} {link.label}
        </button>
      ))}
    </nav>
  );

  return (
    <div
      key="manager-dashboard"
      className="h-[100dvh] overflow-hidden bg-neutral-100 flex relative"
    >
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white z-[70] p-8 flex flex-col shadow-2xl md:hidden"
            >
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center text-white">
                    <LayoutDashboard className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold">{t("navigation.admin")}</h2>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400"
                  aria-label="Close menu"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              {navLinks}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 bg-white border-r border-neutral-200 p-8 flex-col shrink-0">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center text-white">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold">{t("navigation.admin")}</h2>
        </div>
        {navLinks}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-neutral-50">
        <div className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-neutral-200 shadow-sm flex items-center justify-between px-4 md:px-12 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 hover:bg-neutral-100 rounded-xl text-neutral-600 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs font-serif italic text-neutral-400 tracking-widest uppercase">
                {t("navigation.dashboard")}
              </span>
              <ChevronRight className="hidden sm:inline w-3 h-3 text-neutral-300" />
              <span className="text-xs font-bold text-neutral-900 uppercase tracking-widest">
                {[
                  { id: "menu", label: t("navigation.menu_management") },
                  { id: "orders", label: t("navigation.order_summary") },
                  { id: "history", label: t("navigation.history") },
                  { id: "cards", label: t("navigation.card_management") },
                  { id: "settings", label: t("navigation.system_settings") },
                ].find((tab) => tab.id === activeTab)?.label || activeTab}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-6">
            <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-1.5 sm:py-2 bg-neutral-50 rounded-2xl border border-neutral-100">
              <div className="hidden xs:flex flex-col">
                <p className="text-[9px] font-mono uppercase tracking-widest text-neutral-400">
                  {t("menu.status")}
                </p>
                <span
                  className={`text-[10px] font-black uppercase tracking-widest ${computedKioskOpen ? "text-green-600" : "text-red-600"}`}
                >
                  {computedKioskOpen ? t("menu.active") : t("menu.inactive")}
                </span>
              </div>
              <div className="hidden xs:block w-px h-6 bg-neutral-200" />
              <button
                onClick={() => {
                  if (kioskAutoTiming) {
                    // If in Auto mode, clicking the button disables Auto and forces the new manual state
                    updateSettings(
                      globalAccess,
                      orderButtonEnabled,
                      testModeEnabled,
                      false,
                    );
                  }
                  toggleKiosk(!kioskOpen);
                }}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm ${computedKioskOpen ? "bg-white text-red-600 hover:bg-red-50 border border-red-100" : "bg-neutral-900 text-white hover:bg-neutral-800"}`}
              >
                {computedKioskOpen ? t("modals.close") : t("modals.open")}
              </button>
            </div>

            <button
              onClick={() => {
                sessionStorage.removeItem("adminPin");
                window.location.reload();
              }}
              className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-red-500 text-white rounded-xl font-bold text-[10px] sm:text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-md shadow-red-200"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />{" "}
              <span className="hidden xxs:inline">{t("navigation.exit")}</span>
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-4 sm:p-8 lg:p-12">
          {activeTab === "menu" ? (
            <>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-2">
                    {t("navigation.menu_management")}
                  </h1>
                  <p className="text-neutral-500 text-sm md:text-base">
                    {t("menu.management_desc")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 sm:gap-4">
                  <button
                    onClick={() => setIsPasteModalOpen(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-white border border-neutral-200 text-neutral-900 rounded-xl font-bold hover:bg-neutral-50 transition-all text-sm"
                  >
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5" />{" "}
                    {t("menu.paste_title")}
                  </button>
                  <button
                    onClick={addItem}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all text-sm"
                  >
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5" />{" "}
                    {t("menu.add_item")}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {isPasteModalOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                      className="bg-white rounded-[32px] w-full max-w-2xl p-8 shadow-2xl"
                    >
                      <h2 className="text-2xl font-bold mb-4">
                        {t("menu.paste_title")}
                      </h2>
                      <p className="text-neutral-500 mb-6 text-sm">
                        {t("menu.paste_instructions")}
                      </p>
                      <textarea
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        placeholder={t("menu.paste_placeholder")}
                        className="w-full h-64 p-4 bg-neutral-50 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono text-sm mb-6"
                      />
                      <div className="flex justify-end gap-4">
                        <button
                          onClick={() => setIsPasteModalOpen(false)}
                          className="px-6 py-3 text-neutral-500 font-bold hover:bg-neutral-50 rounded-xl transition-all"
                        >
                          {t("modals.cancel")}
                        </button>
                        <button
                          onClick={handlePasteMenu}
                          className="px-8 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all"
                        >
                          {t("menu.paste_title")}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-0">
                    <thead>
                      <tr className="border-bottom border-neutral-100">
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">
                          {t("menu.category")}
                        </th>
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">
                          {t("menu.name")}
                        </th>
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">
                          {t("menu.price")}
                        </th>
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">
                          {t("menu.status")}
                        </th>
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">
                          {t("cards.actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {Array.isArray(editingMenu) &&
                        editingMenu.map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-neutral-50 transition-colors"
                          >
                            <td className="p-6">
                              <input
                                type="text"
                                value={item.category || ""}
                                aria-label={`${t("menu.category")} for ${item.name || "new item"}`}
                                onChange={(e) =>
                                  updateItem(
                                    item.id,
                                    "category",
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-transparent border-none focus:ring-0 text-neutral-400 text-xs uppercase tracking-widest p-0"
                              />
                            </td>
                            <td className="p-6">
                              <input
                                type="text"
                                value={item.name || ""}
                                aria-label={`${t("menu.name")} for ${item.name || "new item"}`}
                                onChange={(e) =>
                                  updateItem(item.id, "name", e.target.value)
                                }
                                className="w-full bg-transparent border-none focus:ring-0 font-bold text-neutral-900 p-0"
                              />
                            </td>
                            <td className="p-6">
                              <div className="flex items-center gap-1">
                                <span className="text-neutral-400">€</span>
                                <input
                                  type="number"
                                  value={item.price || 0}
                                  aria-label={`${t("menu.price")} for ${item.name || "new item"}`}
                                  onChange={(e) =>
                                    updateItem(
                                      item.id,
                                      "price",
                                      parseFloat(e.target.value),
                                    )
                                  }
                                  className="w-20 bg-transparent border-none focus:ring-0 font-mono font-bold p-0"
                                />
                              </div>
                            </td>
                            <td className="p-6">
                              <button
                                onClick={() =>
                                  updateItem(
                                    item.id,
                                    "available",
                                    !item.available,
                                  )
                                }
                                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tighter ${
                                  item.available
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {item.available
                                  ? t("menu.active")
                                  : t("menu.inactive")}
                              </button>
                            </td>
                            <td className="p-6">
                              <button
                                onClick={() => removeItem(item.id)}
                                className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                                title={`Remove ${item.name}`}
                                aria-label={`Remove ${item.name}`}
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : activeTab === "orders" ? (
            <>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-2">
                    {t("navigation.order_summary")}
                  </h1>
                  <p className="text-neutral-500 text-sm md:text-base">
                    {t("orders.performance_subtitle")}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-0">
                    <thead>
                      <tr className="border-bottom border-neutral-100">
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">
                          {t("orders.date")}
                        </th>
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 text-center">
                          {t("navigation.order_summary")}
                        </th>
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 text-right">
                          {t("orders.total")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {Array.isArray(summaries) &&
                        summaries.map((summary) => (
                          <React.Fragment key={summary.date}>
                            <tr
                              onClick={() => {
                                console.log(
                                  "Expanding summary for:",
                                  summary.date,
                                );
                                fetchDailyDetails(summary.date);
                              }}
                              className={`transition-colors cursor-pointer group ${expandedDate === summary.date ? "bg-neutral-50" : "hover:bg-neutral-50"}`}
                            >
                              <td className="p-6 font-bold text-neutral-900">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${expandedDate === summary.date ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-400 group-hover:text-neutral-900 group-hover:bg-neutral-200"}`}
                                  >
                                    <ChevronRight
                                      className={`w-4 h-4 transition-transform duration-300 ${expandedDate === summary.date ? "rotate-90" : ""}`}
                                    />
                                  </div>
                                  <span className="tracking-tight">
                                    {summary.date || "Unknown Date"}
                                  </span>
                                </div>
                              </td>
                              <td className="p-6 text-center">
                                <span className="px-4 py-1.5 bg-neutral-100 rounded-full font-mono font-bold text-neutral-900 group-hover:bg-neutral-200 transition-colors">
                                  {Number(summary.orderCount) || 0}
                                </span>
                              </td>
                              <td className="p-6 text-right font-mono font-bold text-neutral-900">
                                €{(Number(summary.totalSales) || 0).toFixed(2)}
                              </td>
                            </tr>
                            {expandedDate === summary.date && (
                              <tr>
                                <td
                                  colSpan={3}
                                  className="p-0 bg-neutral-50 border-b border-neutral-100"
                                >
                                  <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="p-8"
                                  >
                                    <div className="flex justify-between items-center mb-6">
                                      <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-neutral-900 rounded-full" />
                                        <h3 className="text-sm font-black uppercase tracking-widest text-neutral-900">
                                          {t("orders.items_breakdown")}
                                        </h3>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyDailySummary(
                                            summary.date,
                                            summary.totalSales,
                                          );
                                        }}
                                        className="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-xl active:scale-95"
                                      >
                                        <Plus className="w-4 h-4" />{" "}
                                        {t("orders.copy_summary")}
                                      </button>
                                    </div>

                                    <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-2xl">
                                      <table className="w-full text-left text-sm">
                                        <thead>
                                          <tr className="bg-neutral-50/50 border-b border-neutral-100">
                                            <th className="p-5 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                                              {t("menu.category")} /{" "}
                                              {t("menu.name")}
                                            </th>
                                            <th className="p-5 font-mono text-[10px] uppercase tracking-widest text-neutral-400 text-center">
                                              {t("orders.quantity")}
                                            </th>
                                            <th className="p-5 font-mono text-[10px] uppercase tracking-widest text-neutral-400 text-right">
                                              {t("menu.price")}
                                            </th>
                                            <th className="p-5 font-mono text-[10px] uppercase tracking-widest text-neutral-400 text-right">
                                              {t("orders.total")}
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-50">
                                          {Array.isArray(dailyDetails) &&
                                            dailyDetails.map((item, idx) => (
                                              <tr
                                                key={idx}
                                                className="hover:bg-neutral-50 transition-colors"
                                              >
                                                <td className="p-5">
                                                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mb-0.5">
                                                    {item.category ||
                                                      "Uncategorized"}
                                                  </p>
                                                  <p className="font-bold text-neutral-900 text-base">
                                                    {item.name ||
                                                      "Unknown Item"}
                                                  </p>
                                                </td>
                                                <td className="p-5 text-center">
                                                  <span className="bg-neutral-100 px-3 py-1 rounded-lg font-mono font-black text-neutral-900">
                                                    {Number(item.quantity) || 0}
                                                  </span>
                                                </td>
                                                <td className="p-5 text-right font-mono text-neutral-500">
                                                  €
                                                  {(
                                                    Number(item.price) || 0
                                                  ).toFixed(2)}
                                                </td>
                                                <td className="p-5 text-right font-mono font-bold text-neutral-900">
                                                  €
                                                  {(
                                                    Number(item.total) || 0
                                                  ).toFixed(2)}
                                                </td>
                                              </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                          <tr className="bg-neutral-900 text-white">
                                            <td
                                              colSpan={3}
                                              className="p-5 font-bold uppercase tracking-widest text-xs text-right"
                                            >
                                              {t("orders.total")}
                                            </td>
                                            <td className="p-5 text-right font-mono font-black text-lg">
                                              €{summary.totalSales.toFixed(2)}
                                            </td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  </motion.div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      {summaries.length === 0 && (
                        <tr>
                          <td
                            colSpan={3}
                            className="p-12 text-center text-neutral-400 italic"
                          >
                            {t("orders.no_orders")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : activeTab === "history" ? (
            <>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-2">
                    {t("navigation.history")}
                  </h1>
                  <p className="text-neutral-500 text-sm md:text-base">
                    Search and filter all past orders
                  </p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm mb-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label
                      htmlFor="startDate"
                      className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1"
                    >
                      {t("filters.start_date")}
                    </label>
                    <input
                      id="startDate"
                      type="date"
                      value={filters.startDate}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          startDate: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="endDate"
                      className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1"
                    >
                      {t("filters.end_date")}
                    </label>
                    <input
                      id="endDate"
                      type="date"
                      value={filters.endDate}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          endDate: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="rfidSearch"
                      className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1"
                    >
                      {t("cards.rfid")} / {t("cards.owner_name")}
                    </label>
                    <input
                      id="rfidSearch"
                      type="text"
                      value={filters.rfid}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          rfid: e.target.value,
                        }))
                      }
                      placeholder={t("filters.search_placeholder")}
                      className="w-full px-4 py-2 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all text-sm"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={fetchHistory}
                      className="w-full py-2 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all"
                    >
                      {t("filters.apply")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-0">
                    <thead>
                      <tr className="border-bottom border-neutral-100">
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">
                          {t("orders.timestamp")}
                        </th>
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">
                          {t("orders.cardholder")}
                        </th>
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">
                          {t("orders.items")}
                        </th>
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 text-right">
                          {t("orders.total")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {Array.isArray(history) &&
                        history.map((order) => (
                          <tr
                            key={order.id}
                            className="hover:bg-neutral-50 transition-colors"
                          >
                            <td className="p-6">
                              <p className="font-bold text-neutral-900">
                                {new Date(order.timestamp).toLocaleDateString()}
                              </p>
                              <p className="text-[10px] text-neutral-400 font-mono">
                                {new Date(order.timestamp).toLocaleTimeString()}
                              </p>
                            </td>
                            <td className="p-6">
                              <p className="font-bold text-neutral-900">
                                {order.ownerName || "Unknown User"}
                              </p>
                              <p className="text-[10px] text-neutral-400 font-mono">
                                {order.rfid || "N/A"}
                              </p>
                            </td>
                            <td className="p-6">
                              <p className="text-xs text-neutral-600">
                                {Array.isArray(order.items)
                                  ? order.items.map((i) => i.name).join(", ")
                                  : "No items"}
                              </p>
                            </td>
                            <td className="p-6 text-right font-mono font-bold text-neutral-900">
                              €{(Number(order.totalPrice) || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      {(!Array.isArray(history) || history.length === 0) && (
                        <tr>
                          <td
                            colSpan={4}
                            className="p-12 text-center text-neutral-400 italic"
                          >
                            No orders found matching filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : activeTab === "settings" ? (
            <>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-2">
                    {t("navigation.system_settings")}
                  </h1>
                  <p className="text-neutral-500 text-sm md:text-base">
                    {t("settings.global_desc")}
                  </p>
                </div>
              </div>

              <div className="max-w-2xl">
                {/* Language Section */}
                <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm mb-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center text-neutral-900">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-neutral-900">
                          {t("settings.language")}
                        </h3>
                        <p className="text-sm text-neutral-500 italic">
                          {t("settings.language")}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 p-1 bg-neutral-100 rounded-xl">
                      <button
                        onClick={() => setLang("en")}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${lang === "en" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
                      >
                        EN
                      </button>
                      <button
                        onClick={() => setLang("bg")}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${lang === "bg" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
                      >
                        BG
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center">
                        <Settings className="w-6 h-6 text-neutral-900" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-neutral-900">
                          {t("settings.global_access")}
                        </h3>
                        <p className="text-sm text-neutral-500 italic">
                          {t("settings.global_access_desc")}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        updateSettings(
                          !globalAccess,
                          orderButtonEnabled,
                          testModeEnabled,
                        )
                      }
                      role="switch"
                      aria-checked={globalAccess}
                      className={`w-16 h-8 rounded-full transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 ${globalAccess ? "bg-neutral-900" : "bg-neutral-200"}`}
                      aria-label="Toggle Global Network Access"
                    >
                      <div
                        className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${globalAccess ? "left-9" : "left-1"}`}
                      />
                    </button>
                  </div>

                  <div className="p-6 bg-neutral-50 rounded-3xl border border-neutral-100">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-neutral-400 mt-0.5" />
                      <div className="text-xs text-neutral-500 leading-relaxed font-serif italic">
                        {t("settings.global_access_warning")}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center">
                        <Plus className="w-6 h-6 text-neutral-900" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-neutral-900">
                          {t("settings.ordering_functionality")}
                        </h3>
                        <p className="text-sm text-neutral-500 italic">
                          {t("settings.ordering_desc")}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        updateSettings(
                          globalAccess,
                          !orderButtonEnabled,
                          testModeEnabled,
                        )
                      }
                      role="switch"
                      aria-checked={orderButtonEnabled}
                      className={`w-16 h-8 rounded-full transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 ${orderButtonEnabled ? "bg-neutral-900" : "bg-neutral-200"}`}
                      aria-label="Toggle Ordering Functionality"
                    >
                      <div
                        className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${orderButtonEnabled ? "left-9" : "left-1"}`}
                      />
                    </button>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                        <Zap className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-neutral-900">
                          {t("settings.test_mode")}
                        </h3>
                        <p className="text-sm text-neutral-500 italic">
                          {t("settings.test_mode_desc")}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        updateSettings(
                          globalAccess,
                          orderButtonEnabled,
                          !testModeEnabled,
                        )
                      }
                      role="switch"
                      aria-checked={testModeEnabled}
                      className={`w-16 h-8 rounded-full transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 ${testModeEnabled ? "bg-indigo-600" : "bg-neutral-200"}`}
                      aria-label="Toggle Test Mode"
                    >
                      <div
                        className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${testModeEnabled ? "left-9" : "left-1"}`}
                      />
                    </button>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm mb-8">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center">
                        <Clock className="w-6 h-6 text-neutral-900" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold text-neutral-900">
                            {t("settings.kiosk_status")}
                          </h3>
                          <div className="px-3 py-1 bg-neutral-900 text-white rounded-lg text-[10px] font-mono font-bold tracking-wider flex items-center gap-2 shadow-lg shadow-neutral-100">
                            <span
                              className={`w-1.5 h-1.5 rounded-full animate-pulse ${kioskOpen ? "bg-green-500" : "bg-red-500"}`}
                            />
                            <SystemClock lang={lang} />
                          </div>
                        </div>
                        <p className="text-sm text-neutral-500 italic">
                          {t("settings.kiosk_status_desc")}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (kioskAutoTiming) {
                          // If in Auto mode, clicking the button disables Auto and forces the new manual state
                          updateSettings(
                            globalAccess,
                            orderButtonEnabled,
                            testModeEnabled,
                            false,
                          );
                        }
                        toggleKiosk(!kioskOpen);
                      }}
                      role="switch"
                      aria-checked={computedKioskOpen}
                      className={`w-16 h-8 rounded-full transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 ${computedKioskOpen ? "bg-neutral-900" : "bg-neutral-200"}`}
                      aria-label="Toggle Kiosk Manual Status"
                    >
                      <div
                        className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${computedKioskOpen ? "left-9" : "left-1"}`}
                      />
                    </button>
                  </div>

                  <div className="h-px bg-neutral-100 mb-8" />

                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-neutral-900">
                          {t("settings.auto_timing")}
                        </h4>
                        <p className="text-sm text-neutral-500 italic">
                          {t("settings.auto_timing_desc")}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        updateSettings(
                          globalAccess,
                          orderButtonEnabled,
                          testModeEnabled,
                          !kioskAutoTiming,
                        )
                      }
                      role="switch"
                      aria-checked={kioskAutoTiming}
                      className={`w-16 h-8 rounded-full transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 ${kioskAutoTiming ? "bg-neutral-900" : "bg-neutral-200"}`}
                      aria-label="Toggle Kiosk Auto-Timing"
                    >
                      <div
                        className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${kioskAutoTiming ? "left-9" : "left-1"}`}
                      />
                    </button>
                  </div>

                  {kioskAutoTiming && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-neutral-50 rounded-3xl border border-neutral-100"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label
                            htmlFor="kioskOpenTime"
                            className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400"
                          >
                            {t("settings.open_at")}
                          </label>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-green-50 text-green-600 rounded-full border border-green-100 uppercase tracking-tighter">
                            {t("settings.today")}
                          </span>
                        </div>
                        <input
                          id="kioskOpenTime"
                          type="time"
                          value={kioskOpenTime}
                          onChange={(e) =>
                            updateSettings(
                              globalAccess,
                              orderButtonEnabled,
                              testModeEnabled,
                              kioskAutoTiming,
                              e.target.value,
                              kioskCloseTime,
                            )
                          }
                          className="w-full px-4 py-3 bg-white rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label
                            htmlFor="kioskCloseTime"
                            className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400"
                          >
                            {t("settings.close_at")}
                          </label>
                          <div className="flex bg-neutral-100 p-0.5 rounded-lg border border-neutral-200">
                            <button
                              onClick={() =>
                                updateSettings(
                                  globalAccess,
                                  orderButtonEnabled,
                                  testModeEnabled,
                                  kioskAutoTiming,
                                  kioskOpenTime,
                                  kioskCloseTime,
                                  0,
                                )
                              }
                              className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${kioskCloseDay === 0 ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"}`}
                            >
                              {t("settings.today")}
                            </button>
                            <button
                              onClick={() =>
                                updateSettings(
                                  globalAccess,
                                  orderButtonEnabled,
                                  testModeEnabled,
                                  kioskAutoTiming,
                                  kioskOpenTime,
                                  kioskCloseTime,
                                  1,
                                )
                              }
                              className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${kioskCloseDay === 1 ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"}`}
                            >
                              {t("settings.tomorrow")}
                            </button>
                          </div>
                        </div>
                        <input
                          id="kioskCloseTime"
                          type="time"
                          value={kioskCloseTime}
                          onChange={(e) =>
                            updateSettings(
                              globalAccess,
                              orderButtonEnabled,
                              testModeEnabled,
                              kioskAutoTiming,
                              kioskOpenTime,
                              e.target.value,
                            )
                          }
                          className="w-full px-4 py-3 bg-white rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Security Section */}
                <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm mb-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                      <Settings className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-neutral-900">
                        {t("settings.change_pin")}
                      </h3>
                      <p className="text-sm text-neutral-500 italic">
                        Update your administrative PIN
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 max-w-sm">
                    <div>
                      <label
                        htmlFor="newPin"
                        className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1"
                      >
                        {t("settings.new_pin")}
                      </label>
                      <input
                        id="newPin"
                        type="password"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        placeholder="****"
                        className="w-full px-4 py-3 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="confirmPin"
                        className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1"
                      >
                        {t("settings.confirm_new_pin")}
                      </label>
                      <input
                        id="confirmPin"
                        type="password"
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value)}
                        placeholder="****"
                        className="w-full px-4 py-3 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono"
                      />
                    </div>

                    <button
                      onClick={handleUpdatePin}
                      disabled={
                        pinUpdateStatus === "loading" ||
                        !newPin ||
                        newPin !== confirmPin
                      }
                      className={`w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${
                        pinUpdateStatus === "success"
                          ? "bg-green-600 text-white"
                          : pinUpdateStatus === "error"
                            ? "bg-red-600 text-white"
                            : "bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
                      }`}
                    >
                      {pinUpdateStatus === "loading" ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : pinUpdateStatus === "success" ? (
                        <>
                          <CheckCircle2 className="w-5 h-5" /> PIN Updated
                        </>
                      ) : (
                        t("settings.update_pin")
                      )}
                    </button>

                    {newPin && confirmPin && newPin !== confirmPin && (
                      <p className="text-xs text-red-500 font-bold">
                        PINs do not match
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-2">
                    {t("navigation.card_management")}
                  </h1>
                  <p className="text-neutral-500 text-sm md:text-base">
                    {t("cards.management_desc")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 sm:gap-4">
                  <button
                    onClick={resetAllBalances}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-white border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-all text-sm"
                  >
                    <Trash2 className="w-4 h-4" />{" "}
                    {t("cards.reset_monthly_balances")}
                  </button>
                  <button
                    onClick={() => setIsPasteCardsModalOpen(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-white border border-neutral-200 text-neutral-900 rounded-xl font-bold hover:bg-neutral-50 transition-all text-sm"
                  >
                    <Plus className="w-4 h-4" /> {t("cards.import_cards")}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {isPasteCardsModalOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                      className="bg-white rounded-[32px] w-full max-w-2xl p-8 shadow-2xl"
                    >
                      <h2 className="text-2xl font-bold mb-4">
                        {t("cards.import_cards")}
                      </h2>
                      <p className="text-neutral-500 mb-6 text-sm">
                        {t("cards.import_instructions")}
                      </p>
                      <textarea
                        value={pasteCardsText}
                        onChange={(e) => setPasteCardsText(e.target.value)}
                        placeholder={t("cards.import_placeholder")}
                        className="w-full h-64 p-4 bg-neutral-50 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono text-sm mb-6"
                      />
                      <div className="flex justify-end gap-4">
                        <button
                          onClick={() => setIsPasteCardsModalOpen(false)}
                          className="px-6 py-3 text-neutral-500 font-bold hover:bg-neutral-50 rounded-xl transition-all"
                        >
                          {t("modals.cancel")}
                        </button>
                        <button
                          onClick={handlePasteCards}
                          className="px-8 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all"
                        >
                          {t("cards.import_cards")}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-0">
                        <thead>
                          <tr className="border-bottom border-neutral-100">
                            <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">
                              {t("cards.rfid")}
                            </th>
                            <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">
                              {t("cards.owner_name")}
                            </th>
                            <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 text-center">
                              {t("cards.admin")}
                            </th>
                            <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 text-right">
                              {t("cards.owed")}
                            </th>
                            <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 text-right">
                              {t("cards.actions")}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {Array.isArray(cards) &&
                            cards.map((card) => (
                              <tr
                                key={card.rfid}
                                className="hover:bg-neutral-50 transition-colors"
                              >
                                <td className="p-6 font-mono text-sm text-neutral-600">
                                  {card.rfid}
                                </td>
                                <td className="p-6 font-bold text-neutral-900">
                                  {card.ownerName || "N/A"}
                                </td>
                                <td className="p-6 text-center">
                                  <button
                                    onClick={() => {
                                      const updated = cards.map((c) =>
                                        c.rfid === card.rfid
                                          ? { ...c, isAdmin: !c.isAdmin }
                                          : c,
                                      );
                                      updateCards(updated);
                                    }}
                                    role="switch"
                                    aria-checked={card.isAdmin}
                                    className={`w-10 h-5 md:w-12 md:h-6 rounded-full transition-all mx-auto relative focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 ${card.isAdmin ? "bg-neutral-900" : "bg-neutral-200"}`}
                                    aria-label="Toggle Admin Privileges"
                                  >
                                    <div
                                      className={`absolute top-0.5 w-4 h-4 md:w-5 md:h-5 bg-white rounded-full transition-all ${card.isAdmin ? "left-[1.35rem] md:left-[1.65rem]" : "left-0.5"}`}
                                    />
                                  </button>
                                </td>
                                <td className="p-6 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-neutral-400">€</span>
                                    <input
                                      type="number"
                                      value={Number(card.balance) || 0}
                                      aria-label={`Balance for ${card.ownerName || card.rfid}`}
                                      onChange={(e) => {
                                        const updated = cards.map((c) =>
                                          c.rfid === card.rfid
                                            ? {
                                                ...c,
                                                balance: parseFloat(
                                                  e.target.value,
                                                ),
                                              }
                                            : c,
                                        );
                                        updateCards(updated);
                                      }}
                                      className="w-20 bg-transparent border-none focus:ring-0 font-mono font-bold text-right p-0"
                                    />
                                  </div>
                                </td>
                                <td className="p-6 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() =>
                                        resetCardBalance(card.rfid)
                                      }
                                      className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-red-600 transition-colors"
                                      title={t("cards.clear_balance_tooltip")}
                                      aria-label={t(
                                        "cards.clear_balance_tooltip",
                                      )}
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => removeCard(card.rfid)}
                                      className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-red-600 transition-colors"
                                      title={t("cards.delete_card")}
                                      aria-label={t("cards.delete_card")}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          {(!Array.isArray(cards) || cards.length === 0) && (
                            <tr>
                              <td
                                colSpan={4}
                                className="p-12 text-center text-neutral-400 italic"
                              >
                                {t("cards.no_cards")}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
                    <h3 className="text-lg font-bold mb-4">
                      {t("cards.add_new_card")}
                    </h3>
                    <div className="space-y-4">
                      <button
                        onClick={() => {
                          setIsScanning(true);
                          managerRfidRef.current?.focus();
                        }}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border-2 ${
                          isScanning
                            ? "bg-neutral-900 text-white border-neutral-900 ring-4 ring-neutral-100"
                            : "bg-white text-neutral-900 border-neutral-200 hover:border-neutral-900"
                        }`}
                      >
                        <CreditCard
                          className={`w-4 h-4 ${isScanning ? "animate-pulse" : ""}`}
                        />
                        {isScanning
                          ? "Waiting for Scan..."
                          : t("cards.scan_to_register")}
                      </button>

                      {lastScanned && (
                        <div className="p-3 bg-neutral-50 rounded-xl border border-dashed border-neutral-300">
                          <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1">
                            Last Scanned RFID
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-neutral-900">
                              {lastScanned}
                            </span>
                            <button
                              onClick={() => setNewCardRfid(lastScanned)}
                              className="text-[10px] font-bold text-neutral-900 underline uppercase tracking-widest"
                            >
                              Use
                            </button>
                          </div>
                        </div>
                      )}
                      <div>
                        <label
                          htmlFor="newCardRfid"
                          className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1"
                        >
                          {t("cards.rfid")}
                        </label>
                        <input
                          id="newCardRfid"
                          ref={managerRfidRef}
                          type="text"
                          value={newCardRfid}
                          onFocus={() => setIsScanning(true)}
                          onBlur={() => setIsScanning(false)}
                          onChange={(e) => setNewCardRfid(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const clean = e.currentTarget.value
                                .trim()
                                .replace(/[^\x20-\x7E]/g, "");
                              setNewCardRfid(clean);
                              setLastScanned(clean);
                              setIsScanning(false);
                              // Move focus to owner name
                              const nextInput =
                                e.currentTarget.parentElement?.nextElementSibling?.querySelector(
                                  "input",
                                );
                              (nextInput as HTMLInputElement)?.focus();
                            }
                          }}
                          placeholder={t("cards.rfid_placeholder")}
                          className="w-full px-4 py-2 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="newCardOwner"
                          className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1"
                        >
                          {t("cards.owner_name")}
                        </label>
                        <input
                          id="newCardOwner"
                          type="text"
                          value={newCardOwner}
                          onChange={(e) => setNewCardOwner(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addManualCard();
                            }
                          }}
                          placeholder={t("cards.owner_placeholder")}
                          className="w-full px-4 py-2 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-3 py-2">
                        <button
                          onClick={() => setNewCardIsAdmin(!newCardIsAdmin)}
                          role="switch"
                          aria-checked={newCardIsAdmin}
                          className={`w-10 h-5 md:w-12 md:h-6 rounded-full transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 ${newCardIsAdmin ? "bg-neutral-900" : "bg-neutral-200"}`}
                          aria-label="Toggle Admin Privileges for new card"
                        >
                          <div
                            className={`absolute top-0.5 w-4 h-4 md:w-5 md:h-5 bg-white rounded-full transition-all ${newCardIsAdmin ? "left-[1.35rem] md:left-[1.65rem]" : "left-0.5"}`}
                          />
                        </button>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
                          {t("cards.admin_privileges")}
                        </span>
                      </div>
                      <button
                        onClick={addManualCard}
                        disabled={!newCardRfid || !newCardOwner}
                        className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 disabled:opacity-50 transition-all"
                      >
                        {t("cards.add_new_card")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmConfig && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmConfig(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl border border-neutral-100 overflow-hidden"
            >
              {/* Visual Accent */}
              <div
                className={`absolute top-0 left-0 w-full h-1.5 ${confirmConfig.isDestructive ? "bg-red-500" : "bg-neutral-900"}`}
              />

              <div className="flex items-center gap-4 mb-6">
                {confirmConfig.isDestructive ? (
                  <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-neutral-50 flex items-center justify-center text-neutral-900 shrink-0">
                    <HelpCircle className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold text-neutral-900">
                    {confirmConfig.title}
                  </h3>
                  <p className="text-neutral-500 text-sm mt-1">
                    Please confirm this action
                  </p>
                </div>
              </div>

              <p className="text-neutral-600 mb-8 leading-relaxed">
                {confirmConfig.message}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmConfig(null)}
                  className="flex-1 py-3 px-6 rounded-2xl bg-neutral-100 text-neutral-600 font-bold hover:bg-neutral-200 transition-all text-sm"
                >
                  {t("modals.cancel")}
                </button>
                <button
                  onClick={() => {
                    confirmConfig.onConfirm();
                    setConfirmConfig(null);
                  }}
                  className={`flex-1 py-3 px-6 rounded-2xl text-white font-bold transition-all shadow-lg text-sm ${
                    confirmConfig.isDestructive
                      ? "bg-red-500 hover:bg-red-600 shadow-red-100"
                      : "bg-neutral-900 hover:bg-neutral-800 shadow-neutral-100"
                  }`}
                >
                  {confirmConfig.confirmText || t("modals.confirm")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
