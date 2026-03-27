import React, { useState, useEffect, useRef } from 'react';
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
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MenuItem, Order, AppState, Card, DailySummary } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<AppState>('kiosk');
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [rfid, setRfid] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<MenuItem[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [kioskOpen, setKioskOpen] = useState(true);
  
  const rfidInputRef = useRef<HTMLInputElement>(null);
  const ws = useRef<WebSocket | null>(null);

  const managerRfidRef = useRef<HTMLInputElement>(null);

  const [lastScanned, setLastScanned] = useState<string | null>(null);

  useEffect(() => {
    // WebSocket connection logic
    let reconnectTimer: any;
    
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      ws.current = new WebSocket(`${protocol}//${host}`);

      ws.current.onopen = () => {
        console.log('WebSocket Connected');
        if (reconnectTimer) clearInterval(reconnectTimer);
      };

      ws.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case 'INITIAL_STATE':
            console.log('Received INITIAL_STATE. Cards:', message.cards?.length);
            setMenu(message.menu);
            setOrders(message.orders);
            setKioskOpen(message.kioskOpen);
            setCards(message.cards || []);
            break;
          case 'MENU_UPDATE':
            setMenu(message.data);
            break;
          case 'CARDS_UPDATE':
            console.log('Received CARDS_UPDATE. New count:', message.data?.length);
            setCards(message.data);
            break;
          case 'NEW_ORDER':
            setOrders(prev => [message.data, ...prev]);
            break;
          case 'STATUS_UPDATE':
            setKioskOpen(message.data.kioskOpen);
            break;
        }
      };

      ws.current.onclose = () => {
        console.log('WebSocket Disconnected. Reconnecting...');
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.current.onerror = (err) => {
        console.error('WebSocket Error:', err);
        ws.current?.close();
      };
    };

    connect();

    return () => {
      if (ws.current) ws.current.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  const [activeTab, setActiveTab] = useState<'menu' | 'orders' | 'cards' | 'history'>('menu');
  const [editingMenu, setEditingMenu] = useState<MenuItem[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    rfid: '',
    ownerName: ''
  });
  
  const [pasteText, setPasteText] = useState('');
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  
  const [pasteCardsText, setPasteCardsText] = useState('');
  const [isPasteCardsModalOpen, setIsPasteCardsModalOpen] = useState(false);
  const [newCardRfid, setNewCardRfid] = useState('');
  const [newCardOwner, setNewCardOwner] = useState('');

  useEffect(() => {
    setEditingMenu(menu);
  }, [menu]);

  const fetchHistory = async () => {
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/history?${params}`);
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  const fetchSummaries = async () => {
    try {
      const response = await fetch('/api/summaries');
      const data = await response.json();
      setSummaries(data);
    } catch (err) {
      console.error('Failed to fetch summaries', err);
    }
  };

  useEffect(() => {
    if (view === 'manager') {
      if (activeTab === 'history') {
        fetchHistory();
      } else if (activeTab === 'orders') {
        fetchSummaries();
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
      category: "General"
    };
    const updated = [...editingMenu, newItem];
    setEditingMenu(updated);
    updateMenu(updated);
  };

  const updateItem = (id: number, field: keyof MenuItem, value: any) => {
    const updated = editingMenu.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    );
    setEditingMenu(updated);
    updateMenu(updated);
  };

  const removeItem = (id: number) => {
    const updated = editingMenu.filter(item => item.id !== id);
    setEditingMenu(updated);
    updateMenu(updated);
  };

  const handlePasteMenu = () => {
    const lines = pasteText.split('\n');
    const newItems: MenuItem[] = [];
    let currentId = Date.now();
    let currentCategory = "General";

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      const priceMatch = trimmedLine.match(/(\d+(?:\.\d+)?)€/);
      
      if (!priceMatch && trimmedLine.length > 3 && !trimmedLine.startsWith('-')) {
        currentCategory = trimmedLine.replace(/:$/, '').trim();
        return;
      }

      if (priceMatch) {
        const price = parseFloat(priceMatch[1]);
        let name = trimmedLine.split(priceMatch[0])[0].trim();
        
        if (name.startsWith('-')) name = name.substring(1).trim();

        newItems.push({
          id: currentId++,
          name,
          description: "Imported via paste",
          price,
          available: true,
          category: currentCategory
        });
      }
    });

    if (newItems.length > 0) {
      setEditingMenu(newItems);
      updateMenu(newItems);
      setIsPasteModalOpen(false);
      setPasteText('');
    }
  };

  const addManualCard = async () => {
    if (!newCardRfid || !newCardOwner) return;
    
    const cleanRfid = newCardRfid.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
    
    if (cleanRfid.length === 0) {
      setNewCardRfid('');
      return;
    }

    const newCard: Card = {
      rfid: cleanRfid,
      ownerName: newCardOwner.trim(),
      balance: 0
    };

    try {
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCard),
      });
      if (response.ok) {
        setNewCardRfid('');
        setNewCardOwner('');
        setLastScanned(null);
      }
    } catch (err) {
      console.error('Failed to add card', err);
    }
  };

  const removeCard = async (rfid: string) => {
    try {
      await fetch(`/api/cards/${rfid}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to remove card', err);
    }
  };

  const handlePasteCards = async () => {
    const lines = pasteCardsText.split('\n');
    const newCards: Card[] = [];

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      const parts = trimmedLine.split(/\s+/);
      if (parts.length >= 2) {
        const rfid = parts[0].trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
        const ownerName = parts.slice(1).join(' ').trim();
        if (rfid && ownerName) {
          newCards.push({ rfid, ownerName, balance: 0 });
        }
      }
    });

    if (newCards.length > 0) {
      try {
        await fetch('/api/cards/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newCards),
        });
        setIsPasteCardsModalOpen(false);
        setPasteCardsText('');
      } catch (err) {
        console.error('Failed to batch add cards', err);
      }
    }
  };

  const resetAllBalances = async () => {
    if (!confirm('Are you sure you want to reset ALL monthly balances to 0? This should usually be done at the end of the month.')) return;
    try {
      await fetch('/api/cards/reset-all', { method: 'POST' });
    } catch (err) {
      console.error('Failed to reset balances', err);
    }
  };

  const updateCards = async (updatedCards: Card[]) => {
    try {
      await fetch('/api/cards/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCards),
      });
    } catch (err) {
      console.error('Failed to update cards', err);
    }
  };

  const toggleItem = (item: MenuItem) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) {
        return prev.filter(i => i.id !== item.id);
      }
      return [...prev, item];
    });
  };

  const totalPrice = selectedItems.reduce((sum, item) => sum + item.price, 0);

  useEffect(() => {
    if (view === 'kiosk' && kioskOpen && selectedItems.length > 0) {
      rfidInputRef.current?.focus();
    }
  }, [view, kioskOpen, selectedItems.length]);

  const handleOrder = async (rfidOverride?: string) => {
    const activeRfid = rfidOverride || rfid;
    if (!activeRfid || selectedItems.length === 0) return;

    try {
      const response = await fetch('/api/v1/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfid: activeRfid.trim(), itemIds: selectedItems.map(i => i.id) }),
      });

      if (response.ok) {
        setShowSuccess(true);
        setSelectedItems([]);
        setRfid('');
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          setError(data.error || 'Order failed. Please try again.');
        } else {
          const text = await response.text();
          setError(`Server error (${response.status}): ${text.slice(0, 50)}`);
        }
        // Clear RFID on error too if it was a bad card/insufficient balance
        setRfid('');
        setTimeout(() => setError(null), 5000);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Network error. Please check your connection and try again.');
      setRfid('');
      setTimeout(() => setError(null), 5000);
    }
  };

  const toggleKiosk = async (open: boolean) => {
    try {
      await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ open }),
      });
    } catch (err) {
      console.error('Failed to toggle kiosk', err);
    }
  };

  const updateMenu = async (newMenu: MenuItem[]) => {
    try {
      await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMenu),
      });
    } catch (err) {
      console.error('Failed to update menu', err);
    }
  };

  if (view === 'kiosk') {
    const groupedMenu = menu.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);

    const matchedCard = rfid ? cards.find(c =>
      c.rfid.trim().toLowerCase() === rfid.trim().toLowerCase()
    ) : undefined;

    if (!kioskOpen) {
      return (
        <div className="h-screen bg-neutral-100 flex items-center justify-center p-8">
          <div className="bg-white p-12 rounded-[40px] shadow-2xl text-center max-w-lg">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <LogOut className="w-12 h-12 text-red-600" />
            </div>
            <h1 className="text-4xl font-black text-neutral-900 mb-4 uppercase tracking-tighter">Ordering Closed</h1>
            <p className="text-neutral-500 text-lg leading-relaxed">
              The kitchen is no longer accepting new orders for today. Please check back tomorrow!
            </p>
            <button 
              onClick={() => setView('manager')}
              className="mt-8 px-8 py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all"
            >
              Manager Login
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col relative font-sans">
        {/* Dynamic Background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-neutral-200 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-neutral-100 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="relative z-10 flex-1 flex flex-col p-4 md:p-8">
          <header className="flex justify-between items-center mb-4 shrink-0">
            <div>
              <h1 className="text-2xl font-black text-neutral-900 tracking-tighter uppercase leading-none">
                Daily Menu
              </h1>
              <p className="text-[9px] text-neutral-400 font-mono uppercase tracking-[0.2em] mt-1">
                {new Date().toLocaleDateString('bg-BG', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <button 
              onClick={() => setView('manager')}
              className="group p-2 rounded-xl bg-white border border-neutral-200 shadow-sm hover:shadow-md transition-all active:scale-95"
            >
              <Settings className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
            </button>
          </header>

          <div className="flex-1 columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
            {(Object.entries(groupedMenu) as [string, MenuItem[]][]).map(([category, items]) => (
              <section 
                key={category} 
                className="break-inside-avoid bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden"
              >
                <div className="px-3 py-1.5 bg-neutral-50 border-b border-neutral-100 flex justify-between items-center">
                  <h2 className="text-[9px] font-black text-neutral-800 uppercase tracking-[0.2em]">
                    {category}
                  </h2>
                  <span className="text-[8px] font-mono text-neutral-400">
                    {items.filter(i => i.available).length}
                  </span>
                </div>
                
                <div className="divide-y divide-neutral-50">
                  {items.filter(item => item.available).map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={false}
                      animate={{ 
                        backgroundColor: selectedItems.find(i => i.id === item.id) ? "#000000" : "#ffffff",
                        color: selectedItems.find(i => i.id === item.id) ? "#ffffff" : "#404040",
                        scale: selectedItems.find(i => i.id === item.id) ? 1.02 : 1,
                      }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleItem(item)}
                      className={`cursor-pointer group flex justify-between items-center px-4 py-3 transition-all duration-300 relative rounded-lg mb-1 overflow-hidden ${
                        selectedItems.find(i => i.id === item.id) 
                          ? 'shadow-xl z-10' 
                          : 'hover:bg-neutral-50 border border-transparent hover:border-neutral-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <AnimatePresence mode="wait">
                          {selectedItems.find(i => i.id === item.id) && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            >
                              <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <span className={`text-[15px] font-bold block truncate`}>
                          {item.name}
                        </span>
                      </div>
                      <div className="shrink-0 ml-4">
                        <span className={`text-[13px] font-black font-mono`}>
                          €{item.price.toFixed(2)}
                        </span>
                      </div>

                      {/* Animated selection bar highlight */}
                      {selectedItems.find(i => i.id === item.id) && (
                        <motion.div 
                          layoutId="active-pill"
                          className="absolute left-0 top-0 bottom-0 w-1 bg-white"
                        />
                      )}
                    </motion.div>
                  ))}
                </div>
              </section>
            ))}
          </div>

        <AnimatePresence>
          {selectedItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-12 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4"
            >
              <div className="bg-white rounded-3xl shadow-2xl border border-neutral-200 p-4 flex flex-col md:flex-row items-center gap-4">
                <div className="flex-1">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-0.5">Order Total</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-neutral-900 tracking-tighter">€{totalPrice.toFixed(2)}</span>
                    <span className="text-sm font-bold text-neutral-400 uppercase tracking-widest">
                      ({selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'})
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button 
                    onClick={() => setSelectedItems([])}
                    className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <div className="relative flex-1 md:w-48">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <div className="relative w-full">
                      <input
                        ref={rfidInputRef}
                        type="text"
                        placeholder="Scan Card Now"
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
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const currentVal = (e.currentTarget as HTMLInputElement).value;
                            if (!currentVal) return;
                            
                            // Remove ALL non-printable characters and whitespace
                            const cleanRfid = currentVal.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
                            console.log(`[Kiosk] Scanned: "${cleanRfid}" (original: "${currentVal}")`);
                            
                            if (cleanRfid.length === 0) {
                              setRfid('');
                              return;
                            }
                            setLastScanned(cleanRfid);
                            const card = cards.find(c => {
                              const cardRfid = c.rfid.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
                              return cardRfid === cleanRfid;
                            });

                            if (card) {
                              console.log(`[Kiosk] Found card for RFID: ${cleanRfid}`, card);
                              handleOrder(cleanRfid);
                            } else {
                              console.warn(`[Kiosk] RFID ${cleanRfid} not found in cards list:`, cards.map(c => c.rfid));
                              setError(`Unregistered Card: ${cleanRfid}`);
                              setTimeout(() => setError(null), 5000);
                              setRfid('');
                            }
                          }
                        }}
                        className={`w-full pl-9 pr-10 py-2 bg-neutral-100 rounded-xl border-none focus:outline-none transition-all font-mono text-sm ${
                          rfid && !matchedCard
                            ? 'ring-4 ring-red-500 bg-red-50' 
                            : 'focus:ring-4 focus:ring-neutral-900'
                        }`}
                      />
                      {rfid && (
                        <button 
                          tabIndex={-1}
                          onClick={() => setRfid('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
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
                        Unregistered Card
                      </motion.p>
                    )}
                    {matchedCard && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute -top-12 left-0 bg-white px-3 py-1 rounded-xl border border-neutral-200 shadow-sm whitespace-nowrap"
                      >
                        <p className="text-[10px] font-bold text-neutral-900">Owner: {cards.find(c => c.rfid.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase() === rfid.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase())?.ownerName}</p>
                        <p className="text-[10px] font-mono text-neutral-500">Owed: €{cards.find(c => c.rfid.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase() === rfid.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase())?.balance.toFixed(2)}</p>
                      </motion.div>
                    )}
                  </div>
                  <button
                    onClick={handleOrder}
                    disabled={!rfid || !matchedCard}
                    className="px-6 py-2 bg-neutral-900 text-white rounded-xl font-bold text-sm hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    Order <ChevronRight className="w-4 h-4" />
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
                <h2 className="text-4xl font-bold mb-4">Order Placed!</h2>
                <p className="text-neutral-400 text-lg">Your lunch is being prepared.</p>
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

  // Aggregate orders for Manager View
  interface AggregatedItem {
    name: string;
    count: number;
    total: number;
    category: string;
  }

  const aggregatedOrders = orders.reduce((acc, order) => {
    order.items.forEach(item => {
      if (!acc[item.id]) {
        acc[item.id] = { name: item.name, count: 0, total: 0, category: item.category };
      }
      acc[item.id].count += 1;
      acc[item.id].total += item.price;
    });
    return acc;
  }, {} as Record<number, AggregatedItem>);

  const totalRevenue = (Object.values(aggregatedOrders) as AggregatedItem[]).reduce((sum, item) => sum + item.total, 0);
  const totalItemsSold = (Object.values(aggregatedOrders) as AggregatedItem[]).reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="min-h-screen bg-neutral-100 flex">
        {/* Sidebar */}
        <aside className="w-72 bg-white border-r border-neutral-200 p-8 flex flex-col">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold">Admin</h2>
          </div>
          
          <nav className="flex-1 space-y-2">
            <button 
              onClick={() => setActiveTab('menu')}
              tabIndex={-1}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'menu' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500 hover:bg-neutral-50'}`}
            >
              <Utensils className="w-5 h-5" /> Menu Management
            </button>
            <button 
              onClick={() => setActiveTab('orders')}
              tabIndex={-1}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'orders' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500 hover:bg-neutral-50'}`}
            >
              <Clock className="w-5 h-5" /> Order Summary
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              tabIndex={-1}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'history' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500 hover:bg-neutral-50'}`}
            >
              <Clock className="w-5 h-5" /> History
            </button>
            <button 
              onClick={() => setActiveTab('cards')}
              tabIndex={-1}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'cards' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500 hover:bg-neutral-50'}`}
            >
              <Users className="w-5 h-5" /> Card Management
            </button>
          </nav>

          <div className="mb-6 p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-2">Kiosk Status</p>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-widest ${kioskOpen ? 'text-green-600' : 'text-red-600'}`}>
                {kioskOpen ? 'Open' : 'Closed'}
              </span>
              <button 
                onClick={() => toggleKiosk(!kioskOpen)}
                tabIndex={-1}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${kioskOpen ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
              >
                {kioskOpen ? 'Close Kiosk' : 'Open Kiosk'}
              </button>
            </div>
          </div>

          <button 
            onClick={() => setView('kiosk')}
            tabIndex={-1}
            className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl font-medium transition-colors"
          >
            <LogOut className="w-5 h-5" /> Exit Admin
          </button>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-12 overflow-y-auto">
          <div className="max-w-5xl mx-auto">
            {activeTab === 'menu' ? (
              <>
                <div className="flex justify-between items-end mb-12">
                  <div>
                    <h1 className="text-4xl font-bold text-neutral-900 mb-2">Menu Management</h1>
                    <p className="text-neutral-500">Update today's offerings and prices</p>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setIsPasteModalOpen(true)}
                      tabIndex={-1}
                      className="flex items-center gap-2 px-6 py-3 bg-white border border-neutral-200 text-neutral-900 rounded-xl font-bold hover:bg-neutral-50 transition-all"
                    >
                      <Plus className="w-5 h-5" /> Paste Menu
                    </button>
                    <button 
                      onClick={addItem}
                      tabIndex={-1}
                      className="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all"
                    >
                      <Plus className="w-5 h-5" /> Add Item
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
                        <h2 className="text-2xl font-bold mb-4">Paste Menu Text</h2>
                        <p className="text-neutral-500 mb-6 text-sm">Paste the menu text from your table. We'll automatically detect items and prices (e.g., "- Item Name 1.80€").</p>
                        <textarea
                          value={pasteText}
                          onChange={(e) => setPasteText(e.target.value)}
                          placeholder="Paste here..."
                          className="w-full h-64 p-4 bg-neutral-50 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono text-sm mb-6"
                        />
                        <div className="flex justify-end gap-4">
                          <button
                            onClick={() => setIsPasteModalOpen(false)}
                            className="px-6 py-3 text-neutral-500 font-bold hover:bg-neutral-50 rounded-xl transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handlePasteMenu}
                            className="px-8 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all"
                          >
                            Import Menu
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-bottom border-neutral-100">
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">Category</th>
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">Name</th>
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">Price</th>
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">Status</th>
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {editingMenu.map((item) => (
                        <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="p-6">
                            <input
                              type="text"
                              value={item.category}
                              onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                              className="w-full bg-transparent border-none focus:ring-0 text-neutral-400 text-xs uppercase tracking-widest p-0"
                            />
                          </td>
                          <td className="p-6">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                              className="w-full bg-transparent border-none focus:ring-0 font-bold text-neutral-900 p-0"
                            />
                          </td>
                          <td className="p-6">
                            <div className="flex items-center gap-1">
                              <span className="text-neutral-400">$</span>
                              <input
                                type="number"
                                value={item.price}
                                onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value))}
                                className="w-20 bg-transparent border-none focus:ring-0 font-mono font-bold p-0"
                              />
                            </div>
                          </td>
                          <td className="p-6">
                            <button
                              onClick={() => updateItem(item.id, 'available', !item.available)}
                              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tighter ${
                                item.available 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {item.available ? 'Available' : 'Sold Out'}
                            </button>
                          </td>
                          <td className="p-6">
                            <button 
                              onClick={() => removeItem(item.id)}
                              className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : activeTab === 'orders' ? (
              <>
                <div className="flex justify-between items-end mb-12">
                  <div>
                    <h1 className="text-4xl font-bold text-neutral-900 mb-2">Daily Summaries</h1>
                    <p className="text-neutral-500">Historical performance by day</p>
                  </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-bottom border-neutral-100">
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">Date</th>
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 text-center">Orders</th>
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 text-right">Total Sales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {summaries.map((summary) => (
                        <tr key={summary.date} className="hover:bg-neutral-50 transition-colors">
                          <td className="p-6 font-bold text-neutral-900">{summary.date}</td>
                          <td className="p-6 text-center">
                            <span className="px-3 py-1 bg-neutral-100 rounded-full font-mono font-bold text-neutral-900">
                              {summary.orderCount}
                            </span>
                          </td>
                          <td className="p-6 text-right font-mono font-bold text-neutral-900">
                            €{summary.totalSales.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {summaries.length === 0 && (
                        <tr>
                          <td colSpan={3} className="p-12 text-center text-neutral-400 italic">
                            No summaries available yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : activeTab === 'history' ? (
              <>
                <div className="flex justify-between items-end mb-12">
                  <div>
                    <h1 className="text-4xl font-bold text-neutral-900 mb-2">Order History</h1>
                    <p className="text-neutral-500">Search and filter all past orders</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1">Start Date</label>
                      <input 
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full px-4 py-2 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1">End Date</label>
                      <input 
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full px-4 py-2 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1">RFID / Card</label>
                      <input 
                        type="text"
                        value={filters.rfid}
                        onChange={(e) => setFilters(prev => ({ ...prev, rfid: e.target.value }))}
                        placeholder="Search RFID..."
                        className="w-full px-4 py-2 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all text-sm"
                      />
                    </div>
                    <div className="flex items-end">
                      <button 
                        onClick={fetchHistory}
                        className="w-full py-2 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all"
                      >
                        Apply Filters
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-bottom border-neutral-100">
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">Date/Time</th>
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">Cardholder</th>
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">Items</th>
                        <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {history.map((order) => (
                        <tr key={order.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="p-6">
                            <p className="font-bold text-neutral-900">{new Date(order.timestamp).toLocaleDateString()}</p>
                            <p className="text-[10px] text-neutral-400 font-mono">{new Date(order.timestamp).toLocaleTimeString()}</p>
                          </td>
                          <td className="p-6">
                            <p className="font-bold text-neutral-900">{order.ownerName}</p>
                            <p className="text-[10px] text-neutral-400 font-mono">{order.rfid}</p>
                          </td>
                          <td className="p-6">
                            <p className="text-xs text-neutral-600">{order.items.map(i => i.name).join(', ')}</p>
                          </td>
                          <td className="p-6 text-right font-mono font-bold text-neutral-900">
                            €{order.totalPrice.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {history.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-12 text-center text-neutral-400 italic">
                            No orders found matching filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-end mb-12">
                  <div>
                    <h1 className="text-4xl font-bold text-neutral-900 mb-2">Card Management</h1>
                    <p className="text-neutral-500">Track accumulated costs per cardholder. Reset manually each month.</p>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={resetAllBalances}
                      className="flex items-center gap-2 px-6 py-3 bg-white border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-5 h-5" /> Reset Monthly Balances
                    </button>
                    <button 
                      onClick={() => setIsPasteCardsModalOpen(true)}
                      className="flex items-center gap-2 px-6 py-3 bg-white border border-neutral-200 text-neutral-900 rounded-xl font-bold hover:bg-neutral-50 transition-all"
                    >
                      <Plus className="w-5 h-5" /> Import Cards
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
                        <h2 className="text-2xl font-bold mb-4">Import Cards</h2>
                        <p className="text-neutral-500 mb-6 text-sm">Paste a list of cards. Format: "RFID Name" (one per line). Duplicates will be merged.</p>
                        <textarea
                          value={pasteCardsText}
                          onChange={(e) => setPasteCardsText(e.target.value)}
                          placeholder="12345678 John Doe&#10;87654321 Jane Smith"
                          className="w-full h-64 p-4 bg-neutral-50 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono text-sm mb-6"
                        />
                        <div className="flex justify-end gap-4">
                          <button
                            onClick={() => setIsPasteCardsModalOpen(false)}
                            className="px-6 py-3 text-neutral-500 font-bold hover:bg-neutral-50 rounded-xl transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handlePasteCards}
                            className="px-8 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all"
                          >
                            Import Cards
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-bottom border-neutral-100">
                            <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">RFID</th>
                            <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">Owner Name</th>
                            <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 text-right">Owed</th>
                            <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {cards.map((card) => (
                            <tr key={card.rfid} className="hover:bg-neutral-50 transition-colors">
                              <td className="p-6 font-mono text-sm text-neutral-600">{card.rfid}</td>
                              <td className="p-6 font-bold text-neutral-900">{card.ownerName}</td>
                              <td className="p-6 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-neutral-400">€</span>
                                  <input 
                                    type="number"
                                    value={card.balance}
                                    onChange={(e) => {
                                      const updated = cards.map(c => c.rfid === card.rfid ? { ...c, balance: parseFloat(e.target.value) } : c);
                                      updateCards(updated);
                                    }}
                                    className="w-20 bg-transparent border-none focus:ring-0 font-mono font-bold text-right p-0"
                                  />
                                </div>
                              </td>
                              <td className="p-6 text-right">
                                <button 
                                  onClick={() => removeCard(card.rfid)}
                                  className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {cards.length === 0 && (
                            <tr>
                              <td colSpan={3} className="p-12 text-center text-neutral-400 italic">
                                No cards registered yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
                      <h3 className="text-lg font-bold mb-4">Add New Card</h3>
                      <div className="space-y-4">
                        <button 
                          onClick={() => {
                            setIsScanning(true);
                            managerRfidRef.current?.focus();
                          }}
                          tabIndex={-1}
                          className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border-2 ${
                            isScanning 
                              ? 'bg-neutral-900 text-white border-neutral-900 ring-4 ring-neutral-100' 
                              : 'bg-white text-neutral-900 border-neutral-200 hover:border-neutral-900'
                          }`}
                        >
                          <CreditCard className={`w-4 h-4 ${isScanning ? 'animate-pulse' : ''}`} />
                          {isScanning ? 'Waiting for Scan...' : 'Scan to Register'}
                        </button>

                        {lastScanned && (
                          <div className="p-3 bg-neutral-50 rounded-xl border border-dashed border-neutral-300">
                            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1">Last Scanned RFID</p>
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-neutral-900">{lastScanned}</span>
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
                          <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1">RFID Number</label>
                          <input 
                            ref={managerRfidRef}
                            type="text"
                            value={newCardRfid}
                            onFocus={() => setIsScanning(true)}
                            onBlur={() => setIsScanning(false)}
                            onChange={(e) => setNewCardRfid(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const clean = e.currentTarget.value.trim().replace(/[^\x20-\x7E]/g, '');
                                setNewCardRfid(clean);
                                setLastScanned(clean);
                                setIsScanning(false);
                                // Move focus to owner name
                                const nextInput = e.currentTarget.parentElement?.nextElementSibling?.querySelector('input');
                                (nextInput as HTMLInputElement)?.focus();
                              }
                            }}
                            placeholder="e.g. 12345678"
                            className="w-full px-4 py-2 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1">Owner Name</label>
                          <input 
                            type="text"
                            value={newCardOwner}
                            onChange={(e) => setNewCardOwner(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addManualCard();
                              }
                            }}
                            placeholder="e.g. John Doe"
                            className="w-full px-4 py-2 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all text-sm"
                          />
                        </div>
                        <button 
                          onClick={addManualCard}
                          disabled={!newCardRfid || !newCardOwner}
                          tabIndex={-1}
                          className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 disabled:opacity-50 transition-all"
                        >
                          Add Card
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    );
  };

  export default App;
